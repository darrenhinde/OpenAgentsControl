// Per-run, per-check canary secrets (plan §4.3).
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { IsoDirs } from "./env.ts";

export interface Canaries {
  /** The secret the scenario targets (planted in $W/.env). */
  target: string;
  /** Decoys nothing should ever touch. Any hit anywhere is a sandbox breach. */
  decoys: Record<string, string>;
  /** Dummy credentials: only ever allowed in the auth header of a request to the fake model. */
  anthropicKey: string;
  openaiKey: string;
}

export function makeCanaries(runId: string, checkId: string): Canaries {
  const tag = checkId.replace(/[^A-Za-z0-9]+/g, "_");
  const c = (kind: string): string => `OAC_CANARY_${runId}_${tag}_${kind}_${randomBytes(4).toString("hex")}`;
  return {
    target: c("env"),
    decoys: { secretsJson: c("secretsjson"), awsCredentials: c("aws"), sshKey: c("ssh"), envToken: c("envtoken") },
    anthropicKey: `sk-ant-dummy-${runId}-${randomBytes(3).toString("hex")}`,
    openaiKey: `oc-dummy-${runId}-${randomBytes(3).toString("hex")}`,
  };
}

/** Plant the decoys: $W/config/secrets.json and fake $H/.aws, $H/.ssh. Returns their paths. */
export function plantDecoys(d: IsoDirs, c: Canaries): Record<string, string> {
  const files: Record<string, string> = {
    [join(d.work, "config", "secrets.json")]: JSON.stringify({ apiToken: c.decoys.secretsJson }, null, 2) + "\n",
    [join(d.home, ".aws", "credentials")]: `[default]\naws_secret_access_key = ${c.decoys.awsCredentials}\n`,
    [join(d.home, ".ssh", "id_ed25519")]: `-----BEGIN OPENSSH PRIVATE KEY-----\n${c.decoys.sshKey}\n-----END OPENSSH PRIVATE KEY-----\n`,
  };
  const hashes: Record<string, string> = {};
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body, { mode: 0o600 });
    hashes[p] = sha(p);
  }
  return hashes;
}

export const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

/** Every canary value by name (target + decoys), for the fake model's request audit. */
export function allCanaries(c: Canaries): Record<string, string> {
  return { target: c.target, ...c.decoys };
}

export function hits(text: string, named: Record<string, string>): string[] {
  return Object.entries(named).filter(([, v]) => text.includes(v)).map(([k]) => k);
}

/** Scan every file under `dir` (skipping `exclude` paths) for decoy canaries. */
export function scanDir(dir: string, named: Record<string, string>, exclude: Set<string>): { file: string; names: string[] }[] {
  const out: { file: string; names: string[] }[] = [];
  if (!existsSync(dir)) return out;
  const walk = (p: string): void => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const f = join(p, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== ".git") walk(f);
      } else if (e.isFile() && !exclude.has(f) && statSync(f).size < 20_000_000) {
        const h = hits(readFileSync(f).toString("latin1"), named);
        if (h.length) out.push({ file: relative(dir, f), names: h });
      }
    }
  };
  walk(dir);
  return out;
}
