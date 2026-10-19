// One sandboxed host run against the fake model, plus the safety audit every host run gets.
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { startFakeModel, type FakeModel, type ScriptTurn } from "../../../../packages/compatibility-layer/src/verify/fake-model/server.ts";
import { exec } from "../core/exec.ts";
import type { HostId, RunContext } from "../core/types.ts";
import { allCanaries, makeCanaries, plantDecoys, scanDir, sha, type Canaries } from "../sandbox/canary.ts";
import { isoEnv, makeIsoDirs, runIsolated, safePath, sandboxMode, type IsoDirs } from "../sandbox/env.ts";
import { assertContainedLaunch } from "../sandbox/gate.ts";
import { safetyLedger } from "../sandbox/ledger.ts";
import { cachedWhich } from "./helpers.ts";

export interface HostRun {
  out: string;
  code: number;
  mock: FakeModel;
  dirs: IsoDirs;
  canaries: Canaries;
  artifacts: string;
}

export async function gitInit(work: string): Promise<void> {
  const env = { PATH: "/usr/bin:/bin", HOME: work, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  await exec("git", ["init", "-q"], { cwd: work, env });
  await exec("git", ["add", "-A"], { cwd: work, env });
  await exec("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture"], { cwd: work, env });
}

/**
 * Run one host process against the fake model inside the sandbox, then apply the safety checks
 * that hold for EVERY host run: decoy canaries never appear anywhere, the only credential the
 * model ever sees is the run's dummy, and the planted decoy files are unchanged.
 */
export async function runHost(
  ctx: RunContext,
  o: {
    name: string;
    host: HostId;
    script: ScriptTurn[];
    prepare: (d: IsoDirs, c: Canaries, mock: FakeModel) => void | Promise<void>;
    argv: (d: IsoDirs, c: Canaries) => string[];
    timeoutMs?: number;
    /** More binaries whose directories go on the sandboxed PATH. */
    extraBins?: (string | undefined)[];
    /** Non-secret strings the mock records hits for (named `marker:<x>`). */
    markers?: Record<string, string>;
    /** Delegated sub-sessions carry this marker and get a plain "Done." */
    subSessionMarker?: string;
    /** Artifact sub-folder (default: the part of `name` after "@"). */
    artifactKey?: string;
  },
): Promise<HostRun> {
  const launch = { checkId: ctx.checkId, workload: ctx.workload };
  assertContainedLaunch(launch, sandboxMode());
  const ledger = safetyLedger();
  const dirs = makeIsoDirs(ctx.tmpRoot, o.name);
  const canaries = makeCanaries(ctx.runId, o.name);
  const decoyHashes = plantDecoys(dirs, canaries);
  ledger.canariesPlanted += 1 + Object.keys(canaries.decoys).length;
  const mock = await startFakeModel({
    script: o.script,
    canaries: { ...allCanaries(canaries), ...(o.markers ?? {}) },
    expectedAuth: { anthropicKey: canaries.anthropicKey, openaiKey: canaries.openaiKey },
    ...(o.subSessionMarker ? { subSessionMarker: o.subSessionMarker } : {}),
  });
  try {
    await o.prepare(dirs, canaries, mock);
    await gitInit(dirs.work);
    const bins = [await cachedWhich("node"), await cachedWhich("git"), await cachedWhich(o.host === "claude-code" ? "claude" : "opencode"), ...(o.extraBins ?? [])];
    const env = isoEnv(dirs, safePath(bins), {
      ANTHROPIC_API_KEY: canaries.anthropicKey,
      ANTHROPIC_BASE_URL: mock.url,
      OAC_FAKE_TOKEN: canaries.decoys.envToken ?? "",
    });
    ledger.agentRuns++;
    const r = await runIsolated({ dirs, env, argv: o.argv(dirs, canaries), target: { repo: ctx.repo, repoDeny: ctx.repo, launch }, timeoutMs: o.timeoutMs ?? 120_000, stdoutOnly: false });
    const art = ctx.artifactDir(o.artifactKey ?? o.name.replace(/^.*@/, ""));
    writeFileSync(join(art, "stream.jsonl"), r.out);
    writeFileSync(join(art, "mock.jsonl"), mock.requests.map((q) => JSON.stringify(q)).join("\n") + "\n");
    const dec = join(dirs.work, ".oac", "logs", "decisions.jsonl");
    if (existsSync(dec)) copyFileSync(dec, join(art, "decisions.jsonl"));

    auditHostRun(o.name, mock, canaries, decoyHashes, dirs, r.out);
    for (const q of mock.requests) if (q.action === "unhandled") ctx.log(`mock: unhandled request ${q.url}`);
    return { out: r.out, code: r.code, mock, dirs, canaries, artifacts: art };
  } finally {
    await mock.stop();
  }
}

/**
 * The safety checks that hold for EVERY host run: decoy canaries never appear anywhere (requests,
 * host output, files the host wrote), the planted decoys are unchanged, and the only credential
 * the model ever sees is the run's dummy key in the header its API uses.
 */
export function auditHostRun(name: string, mock: FakeModel, canaries: Canaries, decoyHashes: Record<string, string>, dirs: IsoDirs, out: string): void {
  const ledger = safetyLedger();
  // Safety: decoys never surface (requests, host output, anything the host wrote).
  const decoys = canaries.decoys;
  for (const q of mock.requests) for (const n of q.canaryHits) if (n in decoys) ledger.canaryLeaks.push(`${name}: decoy ${n} reached the model (${q.url})`);
  for (const [n, v] of Object.entries(decoys)) if (out.includes(v)) ledger.canaryLeaks.push(`${name}: decoy ${n} in host output`);
  const planted = new Set(Object.keys(decoyHashes));
  for (const h of [...scanDir(dirs.home, decoys, planted), ...scanDir(dirs.work, decoys, planted)]) ledger.canaryLeaks.push(`${name}: decoy ${h.names.join(",")} in ${h.file}`);
  for (const [p, h] of Object.entries(decoyHashes)) if (!existsSync(p) || sha(p) !== h) ledger.canaryLeaks.push(`${name}: decoy file changed: ${p}`);
  // Safety: auth shape. Only the run's dummy key, and only in the header its API uses.
  for (const q of mock.requests) {
    for (const a of q.auth) if (a.shape === "unexpected") ledger.authViolations.push(`${name}: ${a.header} carried a non-dummy credential (${a.hint ?? "?"})`);
    const key = q.api === "openai" ? q.auth.find((a) => a.header === "authorization") : q.auth.find((a) => a.header === "x-api-key");
    if (q.api !== "other" && key?.shape !== "dummy") ledger.authViolations.push(`${name}: ${q.api} request without the run's dummy key (${key?.header}: ${key?.shape})`);
  }
}

