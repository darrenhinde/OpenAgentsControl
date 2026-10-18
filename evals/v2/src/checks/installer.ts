import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { CheckDef, CheckOutcome, RunContext } from "../core/types.ts";
import { isoEnv, makeIsoDirs, runIsolated, safePath, sandboxMode } from "../sandbox/env.ts";
import { cachedWhich, cmdCheck, lastLine, missing } from "./helpers.ts";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const sha = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

async function toolPath(): Promise<string> {
  return safePath([await cachedWhich("bash"), await cachedWhich("curl"), await cachedWhich("jq"), await cachedWhich("git")]);
}

/**
 * Baseline row 20. The script runs `install.sh help|list|<profile>` from the repo root and
 * probes GitHub (non-fatal). It runs inside the sandbox with the repo readable but nothing under
 * /Users writable and no network, so it can't touch the checkout or reach the internet.
 */
const compatibility: CheckDef = {
  id: "inst/compatibility",
  area: "installer",
  layer: "L0",
  tier: "quick",
  run: async (ctx: RunContext): Promise<CheckOutcome> => {
    const absent = await missing(["curl", "jq"]);
    if (absent) return { ok: false, skip: absent };
    const d = makeIsoDirs(ctx.tmpRoot, "inst-compatibility");
    const r = await runIsolated({
      dirs: { ...d, work: ctx.repo },
      env: isoEnv(d, await toolPath(), { CI: "1" }),
      argv: ["/bin/bash", "scripts/tests/test-compatibility.sh"],
      target: { repo: ctx.repo, repoDeny: "/nonexistent" },
      timeoutMs: 180_000,
      onData: (s) => ctx.log(s.replace(/\n$/, "")),
    });
    ctx.log(`# exit ${r.code} in ${r.ms} ms (sandbox=${sandboxMode()})`);
    return { ok: r.code === 0, summary: r.code === 0 ? undefined : `exit ${r.code}: ${lastLine(r.out)}`, sandbox: { mode: sandboxMode() } };
  },
};

/**
 * New (D-014): install.sh against the LOCAL tree via OAC_RAW_URL=file://<repo>, into a temp dir
 * outside $HOME and the repo, under the sandbox. Every installed file must be byte-identical to
 * the checkout, which proves the local tree (not the pushed branch) was installed.
 */
const installShLocal: CheckDef = {
  id: "inst/install-sh-local",
  area: "installer",
  layer: "L1",
  tier: "quick",
  run: async (ctx: RunContext): Promise<CheckOutcome> => {
    const absent = await missing(["curl", "jq"]);
    if (absent) return { ok: false, skip: absent };
    const d = makeIsoDirs(ctx.tmpRoot, "inst-install-sh-local");
    const target = join(d.work, ".opencode");
    const r = await runIsolated({
      dirs: d,
      env: isoEnv(d, await toolPath(), { OAC_RAW_URL: `file://${ctx.repo}`, REGISTRY_URL: `file://${ctx.repo}/registry.json` }),
      argv: ["/bin/bash", join(ctx.repo, "install.sh"), "essential", `--install-dir=${target}`],
      target: { repo: ctx.repo, repoDeny: "/nonexistent" },
      timeoutMs: 120_000,
      onData: (s) => ctx.log(s.replace(/\n$/, "")),
    });
    ctx.log(`# exit ${r.code} in ${r.ms} ms`);
    if (r.code !== 0) return { ok: false, summary: `install.sh exit ${r.code}: ${lastLine(r.out)}` };
    if (!existsSync(target)) return { ok: false, summary: "install.sh exited 0 but wrote no .opencode/" };
    const files = walk(target);
    const mismatched: string[] = [];
    for (const f of files) {
      const rel = relative(target, f);
      const src = join(ctx.repo, ".opencode", rel);
      if (!existsSync(src) || !statSync(src).isFile()) continue; // installer-generated (e.g. config), not a copy
      if (sha(src) !== sha(f)) mismatched.push(rel);
    }
    for (const m of mismatched) ctx.log(`MISMATCH ${m}`);
    ctx.log(`installed ${files.length} files, ${mismatched.length} differ from the local tree`);
    return {
      ok: files.length > 0 && mismatched.length === 0,
      summary: mismatched.length ? `${mismatched.length} installed files differ from the local tree` : `${files.length} files from the local tree`,
      metrics: { files: files.length, mismatched: mismatched.length },
    };
  },
};

export const installerChecks: CheckDef[] = [
  cmdCheck({
    id: "inst/shell-syntax", area: "installer",
    cmd: ["bash", "-c", 'bash -n install.sh && bash -n update.sh && for f in scripts/tests/*.sh; do bash -n "$f" || exit 1; done'],
  }),
  cmdCheck({ id: "inst/shellcheck", area: "installer", needs: ["shellcheck"], cmd: ["shellcheck", "-S", "error", "install.sh"] }),
  compatibility,
  installShLocal,
];

/** Network-only installer checks: listed so the table shows them as skipped (all tier). */
export const installerNetworkChecks: CheckDef[] = ["inst/install-sh-e2e", "inst/non-interactive", "inst/profile-smoke"].map((id) => ({
  id,
  area: "installer" as const,
  layer: "L1" as const,
  tier: "all" as const,
  run: (): Promise<CheckOutcome> => Promise.resolve({ ok: false, skip: "network tier (all) not implemented in this suite yet" }),
}));
