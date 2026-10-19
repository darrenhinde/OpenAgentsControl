// T2 (plan §3.3, ported from scratch-testplan/t2-probe.sh): boot every emitted agent of the
// repo's .opencode/ tree on the real OpenCode v2 host against the fake model, and record which
// tools the host actually offered it. Plus delegate-by-name / delegate-by-id (#362).
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openCodeRunArgv, parseOpenCodeOutput, writeOpenCodeConfig } from "../../../../packages/compatibility-layer/src/hosts/opencode/driver.ts";
import { modelTurns, startFakeModel, type ScriptTurn } from "../../../../packages/compatibility-layer/src/verify/fake-model/server.ts";
import { exec } from "../core/exec.ts";
import type { CheckDef, RunContext } from "../core/types.ts";
import { emittedId, frontmatter, listFiles, v2Action } from "../lints/files.ts";
import { allCanaries, makeCanaries, plantDecoys, type Canaries } from "../sandbox/canary.ts";
import { isoEnv, makeIsoDirs, runIsolated, safePath, type IsoDirs } from "../sandbox/env.ts";
import { safetyLedger } from "../sandbox/ledger.ts";
import { cachedWhich } from "./helpers.ts";
import { auditHostRun } from "./host-run.ts";

interface AgentProbe {
  id: string;
  booted: boolean;
  error?: string;
  offered: string[];
  expected: string[];
  hidden: string[];
}

interface T2Result {
  agents: AgentProbe[];
  flatProbe: { id: string; flat: string; booted: boolean; error?: string };
  ms: number;
}

interface Tree {
  dirs: IsoDirs;
  canaries: Canaries;
  decoys: Record<string, string>;
  bin: string;
}

/** Tools an agent's frontmatter grants with at least one allow rule: those must be visible. */
export function expectedTools(text: string): string[] {
  const perm = frontmatter(text).data.permission;
  if (typeof perm !== "object" || perm === null) return [];
  const out = new Set<string>();
  for (const [k, v] of Object.entries(perm as Record<string, unknown>)) {
    const allows = v === "allow" || (typeof v === "object" && v !== null && Object.values(v as Record<string, unknown>).includes("allow"));
    if (allows) out.add(v2Action(k));
  }
  return [...out].sort();
}

/** One sandboxed copy of the repo's .opencode/ tree (no node_modules), shared by the T2 checks. */
async function tree(ctx: RunContext): Promise<Tree | undefined> {
  const cached = ctx.shared.get("oc-tree") as Tree | undefined;
  if (cached) return cached;
  const bin = await cachedWhich("opencode");
  if (!bin) return undefined;
  const dirs = makeIsoDirs(ctx.tmpRoot, "oc-agents-tree");
  cpSync(join(ctx.repo, ".opencode"), join(dirs.work, ".opencode"), { recursive: true, filter: (p) => !p.includes("node_modules") });
  const canaries = makeCanaries(ctx.runId, "oc-agents");
  const decoys = plantDecoys(dirs, canaries);
  safetyLedger().canariesPlanted += Object.keys(canaries.decoys).length;
  const env = { PATH: "/usr/bin:/bin", HOME: dirs.work, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  await exec("git", ["init", "-q"], { cwd: dirs.work, env });
  await exec("git", ["add", "-A"], { cwd: dirs.work, env });
  await exec("git", ["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "tree"], { cwd: dirs.work, env });
  const t = { dirs, canaries, decoys, bin };
  ctx.shared.set("oc-tree", t);
  return t;
}

async function runAgent(ctx: RunContext, t: Tree, agent: string, script: ScriptTurn[], prompt = "hi"): Promise<{ out: string; requests: ReturnType<typeof modelTurns>; all: number }> {
  const mock = await startFakeModel({
    script, canaries: allCanaries(t.canaries), expectedAuth: { openaiKey: t.canaries.openaiKey }, subSessionMarker: "DELEGATED-TASK",
  });
  try {
    writeOpenCodeConfig(t.dirs.work, { mockUrl: mock.url, apiKey: t.canaries.openaiKey });
    const env = isoEnv(t.dirs, safePath([t.bin, await cachedWhich("git")]), { OAC_FAKE_TOKEN: t.canaries.decoys.envToken ?? "" });
    safetyLedger().agentRuns++;
    const r = await runIsolated({
      dirs: t.dirs, env, argv: openCodeRunArgv({ bin: t.bin, prompt, agent, auto: true }),
      target: { repo: ctx.repo, repoDeny: ctx.repo }, timeoutMs: 60_000, stdoutOnly: false,
    });
    auditHostRun(`oc-agents:${agent}`, mock, t.canaries, t.decoys, t.dirs, r.out);
    return { out: r.out, requests: modelTurns(mock.requests), all: mock.requests.length };
  } finally {
    await mock.stop();
  }
}

async function probeAll(ctx: RunContext): Promise<T2Result | undefined> {
  const cached = ctx.shared.get("t2") as T2Result | undefined;
  if (cached) return cached;
  const t = await tree(ctx);
  if (!t) return undefined;
  const start = Date.now();
  const files = listFiles(t.dirs.work, ".opencode/agent", (p) => p.endsWith(".md"));
  const agents: AgentProbe[] = [];
  const raw: string[] = [];
  for (const f of files) {
    const id = emittedId(f.path);
    const r = await runAgent(ctx, t, id, []);
    const p = parseOpenCodeOutput(r.out);
    const turn = r.requests[r.requests.length - 1];
    const offered = [...(turn?.tools ?? [])].sort();
    const expected = expectedTools(readFileSync(join(t.dirs.work, f.path), "utf8"));
    const booted = r.requests.length > 0 && !p.errors.some((e) => /agent not found/i.test(e));
    const probe: AgentProbe = { id, booted, offered, expected, hidden: booted ? expected.filter((x) => !offered.includes(x)) : [] };
    if (p.errors.length) probe.error = p.errors.join(" | ").slice(0, 200);
    agents.push(probe);
    raw.push(JSON.stringify(probe));
  }
  // Flat-ID probe: v2 ignores `name:`; the canonical flat name of a nested agent must resolve.
  const nested = agents.find((a) => a.id === "core/openagent") ?? agents.find((a) => a.id.includes("/"));
  let flatProbe: T2Result["flatProbe"] = { id: "", flat: "", booted: true };
  if (nested) {
    const flat = nested.id.split("/").pop() ?? nested.id;
    const r = await runAgent(ctx, t, flat, []);
    const p = parseOpenCodeOutput(r.out);
    flatProbe = { id: nested.id, flat, booted: r.requests.length > 0 && !p.errors.some((e) => /agent not found/i.test(e)), error: p.errors[0] };
  }
  const res = { agents, flatProbe, ms: Date.now() - start };
  writeFileSync(join(ctx.artifactDir("opencode-v2"), "t2.jsonl"), raw.join("\n") + "\n");
  ctx.shared.set("t2", res);
  return res;
}

const agentsBoot: CheckDef = {
  id: "oc/agents-boot", area: "oc-load", layer: "L1", host: "opencode-v2", tier: "hosts",
  run: async (ctx) => {
    const r = await probeAll(ctx);
    if (!r) return { ok: false, skip: "opencode not on PATH" };
    const failed = r.agents.filter((a) => !a.booted);
    for (const a of r.agents) ctx.log(`${a.booted ? "boot " : "FAIL "} ${a.id}${a.error ? `  (${a.error})` : ""}`);
    ctx.log(`${r.agents.length} agents probed in ${r.ms} ms`);
    return {
      ok: failed.length === 0 && r.agents.length > 0,
      summary: `${r.agents.length - failed.length}/${r.agents.length} emitted agents boot on real v2${failed.length ? `; failed: ${failed.map((a) => a.id).join(", ")}` : ""}`,
      metrics: { agents: r.agents.length, booted: r.agents.length - failed.length },
    };
  },
};

const agentsToolsVisible: CheckDef = {
  id: "oc/agents-tools-visible", area: "oc-load", layer: "L1", host: "opencode-v2", tier: "hosts",
  run: async (ctx) => {
    const r = await probeAll(ctx);
    if (!r) return { ok: false, skip: "opencode not on PATH" };
    const bad = r.agents.filter((a) => a.hidden.length);
    const by: Record<string, number> = {};
    for (const a of bad) for (const h of a.hidden) by[h] = (by[h] ?? 0) + 1;
    for (const a of r.agents) ctx.log(`${a.hidden.length ? "HIDDEN" : "ok    "} ${a.id.padEnd(44)} expected [${a.expected.join(",")}]${a.hidden.length ? ` missing [${a.hidden.join(",")}]` : ""}  offered [${a.offered.join(",")}]`);
    const parts = Object.entries(by).map(([k, n]) => `${k}(${n})`).join(" ");
    return {
      ok: bad.length === 0,
      summary: bad.length ? `${bad.length}/${r.agents.length} agents lose a tool they allow: ${parts}` : `all ${r.agents.length} agents see every tool they allow`,
      metrics: { agents: r.agents.length, hiddenAgents: bad.length, ...by },
    };
  },
};

const flatIds: CheckDef = {
  id: "oc/flat-ids", area: "oc-load", layer: "L1", host: "opencode-v2", tier: "hosts",
  run: async (ctx) => {
    const r = await probeAll(ctx);
    if (!r) return { ok: false, skip: "opencode not on PATH" };
    const pathIds = r.agents.filter((a) => a.id.includes("/"));
    for (const a of pathIds) ctx.log(`path-derived ID: ${a.id}`);
    ctx.log(`live probe: --agent ${r.flatProbe.flat} (canonical name of ${r.flatProbe.id}) → ${r.flatProbe.booted ? "booted" : `not found (${r.flatProbe.error ?? "?"})`}`);
    return {
      ok: pathIds.length === 0 && r.flatProbe.booted,
      summary: `${pathIds.length}/${r.agents.length} IDs are path-derived; --agent ${r.flatProbe.flat} → ${r.flatProbe.booted ? "ok" : "Agent not found"}`,
      metrics: { agents: r.agents.length, pathIds: pathIds.length },
    };
  },
};

export const ocAgentsChecks: CheckDef[] = [agentsBoot, agentsToolsVisible, flatIds];
