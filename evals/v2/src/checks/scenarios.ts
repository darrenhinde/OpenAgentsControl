// L2 cross-host scenarios: the YAML scenario runner (plan step 6). Every seed scenario under
// packages/compatibility-layer/src/verify/scenarios/ becomes rows: `<check_id>@<host>` (guarded,
// graded), `.control@<host>` (attacks: OAC off, asks approved, must leak/land/run) and
// `.fp@<host>` (benign rows: an over-broad guard must block). Scenarios the runner can't run yet
// become skip rows with the reason. Every host run goes through runHost (sandbox + safety audit).
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ASK_RECORDER_JS, ASK_TOOL, askRecorderMcpConfig } from "../../../../packages/compatibility-layer/src/hosts/claude-code/ask-recorder.ts";
import { claudeRunArgv, parseClaudeStream } from "../../../../packages/compatibility-layer/src/hosts/claude-code/driver.ts";
import { openCodeRunArgv, parseOpenCodeOutput, writeOpenCodeConfig } from "../../../../packages/compatibility-layer/src/hosts/opencode/driver.ts";
import { modelTurns } from "../../../../packages/compatibility-layer/src/verify/fake-model/server.ts";
import { installFileGuard } from "../../../../packages/compatibility-layer/src/verify/fixtures/guards.ts";
import { FAILING_TEST, buildTsSingle } from "../../../../packages/compatibility-layer/src/verify/fixtures/repos/ts-single/build.ts";
import { gradeArm, pathsToSnapshot, type CallObservation, type CallStatus, type Observation } from "../../../../packages/compatibility-layer/src/verify/outcomes.ts";
import {
  flattenScript, normalizeIncludes, substitute, unresolved, unsupportedReason, variants, watchedMarkers,
  type ArmKind, type Guard, type Host, type PlannedTurn, type Variant,
} from "../../../../packages/compatibility-layer/src/verify/runner.ts";
import { loadScenarios, type Scenario, type ScenarioFile } from "../../../../packages/compatibility-layer/src/verify/scenario-schema.ts";
import { exec } from "../core/exec.ts";
import { loadKnownRed } from "../core/known-red.ts";
import type { CheckDef, CheckOutcome, HostId, RunContext } from "../core/types.ts";
import { sandboxMode } from "../sandbox/env.ts";
import { cachedWhich } from "./helpers.ts";
import { runHost } from "./host-run.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCENARIO_DIR = resolve(HERE, "..", "..", "..", "..", "packages", "compatibility-layer", "src", "verify", "scenarios");
const HOSTS: Host[] = ["claude-code", "opencode-v2"];
const SUB_MARKER = "DELEGATED-TASK";

export const rowBase = (s: Scenario): string => s.check_id ?? `scn/${s.id.replace("/", "-")}`;

const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
/** Content hash of a file or a whole directory tree (paths + bodies); undefined when absent. */
function hashPath(p: string): string | undefined {
  if (!existsSync(p)) return undefined;
  const st = lstatSync(p);
  if (st.isSymbolicLink() || st.isFile()) return sha(readFileSync(p));
  const parts: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d).sort()) {
      const f = join(d, e);
      if (lstatSync(f).isDirectory()) walk(f);
      else parts.push(`${relative(p, f)}:${sha(readFileSync(f))}`);
    }
  };
  walk(p);
  return sha(parts.join("\n"));
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** `${id.<canonical>}`: the emitted agent ID on this host (core/openagent on v2 today; oac:<file> on CC). */
function resolveAgentId(repo: string, host: Host, canonical: string): string | undefined {
  if (host === "opencode-v2") {
    const root = join(repo, ".opencode", "agent");
    let hit: string | undefined;
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const f = join(d, e.name);
        if (e.isDirectory()) walk(f);
        else if (e.name.endsWith(".md") && norm(basename(e.name, ".md")) === norm(canonical)) hit ??= relative(root, f).replace(/\.md$/, "");
      }
    };
    walk(root);
    return hit;
  }
  const dir = join(repo, "plugins", "claude-code", "agents");
  const f = readdirSync(dir).find((x) => norm(basename(x, ".md")) === norm(canonical));
  return f ? `oac:${basename(f, ".md")}` : undefined;
}

interface ArmConfig {
  guard: Guard;
  asks: "reject" | "approve";
}

function armConfig(s: Scenario, arm: ArmKind): ArmConfig {
  const guard = (s.guard ?? "shipped") as Guard;
  if (arm === "guarded") return { guard, asks: s.asks ?? "reject" };
  if (arm === "approve") return { guard, asks: "approve" };
  if (arm === "fp") return { guard: "broad", asks: "reject" };
  const c = s.control;
  if (typeof c === "object" && c !== null) return { guard: c.disable ? "none" : guard, asks: c.asks === "reject" ? "reject" : "approve" };
  return { guard: "none", asks: "approve" };
}

interface ArmRun {
  ok: boolean;
  summary: string;
  asks: number;
  calls: CallObservation[];
  leaks: number;
  artifacts: string;
}

function runSetup(ops: Record<string, unknown>[], w: string): void {
  const at = (p: string): string => (isAbsolute(p) ? p : join(w, p));
  for (const op of ops) {
    const [k, raw] = Object.entries(op)[0] as [string, unknown];
    const a = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    switch (k) {
      case "write":
        mkdirSync(dirname(at(String(a.path))), { recursive: true });
        writeFileSync(at(String(a.path)), String(a.content ?? ""));
        break;
      case "symlink":
        mkdirSync(dirname(at(String(a.path))), { recursive: true });
        symlinkSync(String(a.target), at(String(a.path)));
        break;
      case "sentinel": {
        const d = at(String(a.dir));
        mkdirSync(d, { recursive: true });
        for (let i = 1; i <= Number(a.files ?? 3); i++) writeFileSync(join(d, `keep-${i}.txt`), `sentinel ${i}\n`);
        break;
      }
      case "outside":
        mkdirSync(at(String(a.dir)), { recursive: true });
        writeFileSync(join(at(String(a.dir)), "existing.txt"), "outside\n");
        break;
      case "failing_test":
        mkdirSync(dirname(at(String(a.path))), { recursive: true });
        writeFileSync(at(String(a.path)), FAILING_TEST);
        break;
      case "approve":
        // Partial: the plan with a human Approved-by line. The `oac approve` record has no format yet.
        mkdirSync(dirname(at(String(a.plan))), { recursive: true });
        writeFileSync(at(String(a.plan)), `# Plan\n\nFiles: ${JSON.stringify(a.files ?? [])}\n\nApproved-by: fixture human\n`);
        break;
      case "git":
        break; // the workdir is committed after setup anyway
      default:
        throw new Error(`setup op ${k} not implemented`);
    }
  }
}

async function runArm(ctx: RunContext, s: Scenario, host: Host, arm: ArmKind, v: Variant, vi: number): Promise<ArmRun> {
  const bin = (await cachedWhich(host === "claude-code" ? "claude" : "opencode")) as string;
  const node = (await cachedWhich("node")) as string;
  const cfg = armConfig(s, arm);
  const name = `${rowBase(s)}${arm === "guarded" ? "" : `.${arm}`}@${host}${v.label ? `#${vi}` : ""}`;
  let turns: PlannedTurn[] = [];
  let vars: Record<string, string> = {};
  const before: Record<string, string | undefined> = {};
  let pluginDir: string | undefined;
  let mcpCfg = "";
  let asksLog = "";
  let agent: string | undefined;
  const ids: Record<string, string> = {};
  for (const m of JSON.stringify(s).matchAll(/\$\{id\.([A-Za-z0-9-]+)\}/g)) {
    const r = resolveAgentId(ctx.repo, host, m[1] ?? "");
    if (r) ids[m[1] ?? ""] = r;
  }
  const marker = `OAC_MARKER_${ctx.runId}_${vi}`;
  const run = await runHost(ctx, {
    name,
    host: host as HostId,
    script: [],
    subSessionMarker: SUB_MARKER,
    markers: watchedMarkers(s, { MARKER: marker }),
    artifactKey: `${arm}-${host}${v.label ? `-${vi}` : ""}`,
    timeoutMs: 90_000,
    prepare: (d, c, mock) => {
      vars = { CANARY: c.target, MARKER: marker, W: d.work, H: d.home, SENTINEL: join(d.home, "sentinel"), OUTSIDE: join(d.root, "outside") };
      const all: Record<string, unknown> = { ...vars, id: ids, ...substitute(v.vars, vars) };
      if (s.fixture === "ts-single") buildTsSingle(d.work, { canary: c.target, marker });
      else writeFileSync(join(d.work, "README.md"), `# oac tree\n\n${marker}\n`);
      runSetup(substitute(s.setup ?? [], all), d.work);
      // the guard: what "OAC on" means for this arm
      let permission: Record<string, unknown> | undefined;
      const script = substitute(normalizeIncludes(s.script ?? []), all);
      turns = flattenScript(script, host, (p) => existsSync(isAbsolute(p) ? p : join(d.work, p)));
      if (cfg.guard === "shipped") {
        if (host === "opencode-v2") cpSync(join(ctx.repo, ".opencode"), join(d.work, ".opencode"), { recursive: true, filter: (p) => !p.includes("node_modules") });
        else {
          pluginDir = join(d.root, "plugin-copy");
          cpSync(join(ctx.repo, "plugins", "claude-code"), pluginDir, { recursive: true, filter: (p) => !p.includes("node_modules") });
        }
      } else if (cfg.guard === "poc-secrets" || cfg.guard === "broad") {
        const needles = [...new Set(turns.filter((t) => ["read", "write", "edit"].includes(t.call) && t.path).map((t) => basename(String(t.path))))];
        permission = installFileGuard(d.work, host === "claude-code" ? "claude-code" : "opencode-v2", cfg.guard, needles);
      }
      const ag = substitute(s.agent?.[host], all) as string | undefined;
      // An OC agent ID only exists in the shipped tree; OAC-off arms run the host's default agent.
      agent = ag && ag !== "main" && (host === "claude-code" || cfg.guard === "shipped") ? ag : undefined;
      if (host === "opencode-v2") writeOpenCodeConfig(d.work, { mockUrl: mock.url, apiKey: c.openaiKey, permission });
      else {
        asksLog = join(d.root, "asks.jsonl");
        writeFileSync(join(d.root, "asks-recorder.cjs"), ASK_RECORDER_JS);
        mcpCfg = join(d.root, "asks-mcp.json");
        writeFileSync(mcpCfg, JSON.stringify(askRecorderMcpConfig({ node, script: join(d.root, "asks-recorder.cjs"), log: asksLog, mode: cfg.asks })));
      }
      const left = unresolved(turns);
      if (left.length) throw new Error(`unresolved placeholders: ${left.join(", ")}`);
      mock.setScript(turns);
      for (const p of pathsToSnapshot(substitute(s.outcome, all), vars)) before[p] = hashPath(isAbsolute(p) ? p : join(d.work, p));
    },
    argv: () =>
      host === "claude-code"
        ? claudeRunArgv({ bin, prompt: "do the task", pluginDir, agent, needsHooks: true, permissionPrompt: { mcpConfig: mcpCfg, tool: ASK_TOOL } })
        : openCodeRunArgv({ bin, prompt: "do the task", agent, auto: cfg.asks === "approve" }),
  });
  const w = run.dirs.work;
  const at = (p: string): string => (isAbsolute(p) ? p : join(w, p));
  const reqs = modelTurns(run.mock.requests);
  const issued = reqs.filter((q) => !q.sub && q.action.startsWith("tool_call:")).map((q) => q.steps[q.steps.length - 1] ?? -1);
  const missingTools = reqs.filter((q) => !q.sub && q.action.startsWith("tool_missing:")).map((q) => q.action.slice(13));
  if (run.mock.requests.some((q) => q.action === "loop_cap")) missingTools.push(`(host looped: > ${run.mock.requests.length} model requests)`);
  let calls: CallObservation[] = [];
  let asks: { tool: string; detail: string }[] = [];
  let subagentCompleted = false;
  if (host === "claude-code") {
    const st = parseClaudeStream(run.out);
    const asked = existsSync(asksLog)
      ? readFileSync(asksLog, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as { tool_name?: string; tool_use_id?: string; input?: unknown })
      : [];
    asks = asked.map((a) => ({ tool: String(a.tool_name ?? ""), detail: JSON.stringify(a.input ?? {}).slice(0, 200) }));
    const askedIds = new Set(asked.map((a) => a.tool_use_id));
    const main = st.toolCalls.filter((c) => !c.parent && c.name);
    calls = main.map((c, i) => {
      let status: CallStatus = "allowed";
      if (askedIds.has(c.id)) status = "asked";
      else if (c.permissionDenied || (c.isError && /OAC blocked|denied|not allowed|permission/i.test(c.result ?? ""))) status = "blocked";
      return { step: issued[i] ?? -1, tool: c.name, status, result: c.result ?? "" };
    });
    // 2.1.302 runs Agent/Task asynchronously ("Async agent launched"): completion = the delegated
    // session (mock saw its DELEGATED-TASK request) answered under this call's id.
    const answered = (id: string): boolean =>
      run.out.split("\n").some((l) => l.includes(`"parent_tool_use_id":"${id}"`) && l.includes('"type":"assistant"'));
    subagentCompleted = run.mock.requests.some((q) => q.sub) && main.some((c) => (c.name === "Agent" || c.name === "Task") && !c.isError && answered(c.id));
  } else {
    const p = parseOpenCodeOutput(run.out);
    asks = p.asks.map((a) => ({ tool: a.tool, detail: a.resource }));
    calls = p.toolUses.map((u, i) => {
      const e = u.error ?? "";
      const status: CallStatus = /cannot ask the user/i.test(e) ? "asked" : /permission denied|denied|blocked|not allowed/i.test(e) ? "blocked" : "allowed";
      return { step: issued[i] ?? -1, tool: u.tool, status, result: u.output ?? e };
    });
    subagentCompleted = p.toolUses.some((u) => u.tool === "subagent" && u.status === "completed");
  }
  const gitEnv = { PATH: "/usr/bin:/bin", HOME: w, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
  const status = (await exec("git", ["status", "--porcelain=v1", "-uall"], { cwd: w, env: gitEnv, stdoutOnly: true })).out.split("\n").filter(Boolean);
  const headAfter = (await exec("git", ["rev-parse", "HEAD"], { cwd: w, env: gitEnv, stdoutOnly: true })).out.trim();
  const headBefore = (await exec("git", ["rev-list", "--max-parents=0", "HEAD"], { cwd: w, env: gitEnv, stdoutOnly: true })).out.trim().split("\n")[0] ?? "";
  const decFile = join(w, ".oac", "logs", "decisions.jsonl");
  const decisions = existsSync(decFile) ? readFileSync(decFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>) : [];
  const obs: Observation = {
    host, vars, requests: reqs, output: run.out, calls, asks, decisions, subagentCompleted, missingTools,
    exists: (p) => existsSync(at(p)),
    read: (p) => (existsSync(at(p)) ? readFileSync(at(p), "utf8") : undefined),
    hash: (p) => hashPath(at(p)),
    before, gitStatus: status, gitHead: { before: headBefore, after: headAfter },
  };
  const all = { ...vars, id: ids, ...substitute(v.vars, vars) };
  const g = gradeArm({ ...s, outcome: substitute(s.outcome, all) }, arm, turns, obs);
  writeFileSync(join(run.artifacts, "grade.json"), JSON.stringify({ arm, variant: v.label, config: cfg, agent, turns, calls, asks, decisions, grade: g }, null, 2) + "\n");
  const leaks = reqs.filter((q) => q.canaryHits.includes("target")).length;
  ctx.log(`[${arm}${v.label ? ` ${v.label}` : ""}] guard=${cfg.guard} asks=${cfg.asks}${agent ? ` agent=${agent}` : ""} exit=${run.code} calls=${calls.map((c) => `${c.tool}:${c.status}`).join(",") || "none"} asks=${asks.length} → ${g.ok ? "ok" : "NOT ok"}: ${g.summary}`);
  for (const c of g.checks) ctx.log(`    ${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  return { ok: g.ok, summary: g.summary, asks: asks.length, calls, leaks, artifacts: run.artifacts };
}

function scenarioRow(s: Scenario, host: Host, arm: Exclude<ArmKind, "approve">): CheckDef {
  const base = rowBase(s);
  const id = `${base}${arm === "guarded" ? "" : `.${arm}`}@${host}`;
  return {
    id, area: "scenarios", layer: "L2", host: host as HostId, tier: "hosts",
    run: async (ctx: RunContext): Promise<CheckOutcome> => {
      if (!(await cachedWhich(host === "claude-code" ? "claude" : "opencode"))) return { ok: false, skip: `${host} not on PATH` };
      const vs = variants(s, host);
      ctx.log(`scenario ${s.id} (${s.title}) arm=${arm} host=${host} variants=${vs.length}`);
      const results: { v: Variant; r: ArmRun }[] = [];
      for (const [i, v] of vs.entries()) {
        const r = await runArm(ctx, s, host, arm, v, i);
        results.push({ v, r });
        // Asks in headless runs (RUNNER-NEEDS §5, L-012): the guarded arm rejects asks and is
        // graded; when it saw any, the same run with asks approved is reported (what a
        // rubber-stamping user gets), never graded.
        if (arm === "guarded" && s.kind === "attack" && r.asks > 0) {
          const ap = await runArm(ctx, s, host, "approve", v, i);
          ctx.log(`    (reported, not graded) if the user approves the ${r.asks} ask(s): ${ap.ok ? "outcome still holds" : `outcome fails: ${ap.summary}`}`);
        }
      }
      const bad = results.filter((x) => !x.r.ok);
      const asks = results.reduce((n, x) => n + x.r.asks, 0);
      const leaks = results.reduce((n, x) => n + x.r.leaks, 0);
      const label = (x: { v: Variant }): string => (x.v.label ? `[${x.v.label}] ` : "");
      const summary = bad.length
        ? `${vs.length > 1 ? `${bad.length}/${vs.length} variants: ` : ""}${bad.map((x) => `${label(x)}${x.r.summary}`).join(" | ")}`
        : `${vs.length > 1 ? `${vs.length}/${vs.length} variants: ` : ""}${results[0]?.r.summary ?? ""}`;
      return {
        ok: bad.length === 0,
        summary: summary.slice(0, 200),
        metrics: { variants: vs.length, failed: bad.length, asks, leaks },
        artifacts: results[0]?.r.artifacts ? dirname(results[0].r.artifacts) : undefined,
        sandbox: { mode: sandboxMode(), canaryLeaks: arm === "guarded" ? leaks : 0 },
      };
    },
  };
}

const skipRow = (id: string, reason: string): CheckDef => ({
  id, area: "scenarios", layer: "L2", tier: "hosts",
  run: () => Promise.resolve({ ok: false, skip: reason }),
});

let loaded: { files: ScenarioFile[]; error?: string } | undefined;
export function scenarioFiles(): { files: ScenarioFile[]; error?: string } {
  if (loaded) return loaded;
  try {
    loaded = { files: loadScenarios(SCENARIO_DIR) };
  } catch (e) {
    loaded = { files: [], error: e instanceof Error ? e.message : String(e) };
  }
  return loaded;
}

/** L0 (quick): every seed parses, and `today: known-red` agrees with known-red.yaml for runnable rows. */
const catalogValid: CheckDef = {
  id: "scn/catalog-valid", area: "scenarios", layer: "L0", tier: "quick",
  run: (ctx) => {
    const { files, error } = scenarioFiles();
    if (error) {
      ctx.log(error);
      return Promise.resolve({ ok: false, summary: error.split("\n")[1]?.trim() ?? error });
    }
    const kr = loadKnownRed(join(HERE, "known-red.yaml"));
    const problems: string[] = [];
    let runnable = 0;
    for (const { file, scenario: s } of files) {
      for (const h of HOSTS) {
        if (unsupportedReason(s, h)) continue;
        runnable++;
        const id = `${rowBase(s)}@${h}`;
        const today = s.today[h]?.status;
        if (today === "known-red" && !kr[id]) problems.push(`${file}: today ${h} is known-red but known-red.yaml has no ${id}`);
        if (today !== "known-red" && kr[id]) problems.push(`${file}: known-red.yaml lists ${id} but today ${h} is ${today ?? "missing"}`);
        if (today === "known-red" && kr[id] && s.today[h]?.ref !== kr[id]?.ref) problems.push(`${file}: ref ${s.today[h]?.ref} ≠ known-red.yaml ${kr[id]?.ref}`);
      }
    }
    for (const p of problems) ctx.log(p);
    ctx.log(`${files.length} scenario files valid; ${runnable} runnable (scenario × host)`);
    return Promise.resolve({
      ok: problems.length === 0,
      summary: problems.length ? problems[0] : `${files.length} scenario files valid, ${runnable} runnable rows`,
      metrics: { files: files.length, runnable },
    });
  },
};

function buildScenarioChecks(): CheckDef[] {
  const out: CheckDef[] = [];
  const { files } = scenarioFiles();
  let codex = 0;
  for (const { scenario: s } of files) {
    if (s.hosts.includes("codex")) codex++;
    const reasons = HOSTS.filter((h) => s.hosts.includes(h)).map((h) => ({ h, why: unsupportedReason(s, h) }));
    const runnable = reasons.filter((r) => !r.why);
    const skipped = reasons.filter((r) => r.why && !r.why.startsWith("graded by"));
    if (!runnable.length && skipped.length) {
      const graded = reasons.filter((r) => r.why?.startsWith("graded by"));
      const why = graded.length ? `${skipped.map((r) => `${r.h}: ${r.why}`).join("; ")} (${graded.map((r) => `${r.h} ${r.why}`).join("; ")})` : skipped[0]?.why;
      out.push(skipRow(rowBase(s), why ?? "unsupported"));
      continue;
    }
    for (const r of skipped) out.push(skipRow(`${rowBase(s)}@${r.h}`, r.why ?? "unsupported"));
    for (const { h } of runnable) {
      out.push(scenarioRow(s, h, "guarded"));
      if (s.kind === "attack" && !(typeof s.control === "string" && s.control === "none")) out.push(scenarioRow(s, h, "control"));
      if (s.kind === "benign" && s.fp_arm) out.push(scenarioRow(s, h, "fp"));
    }
  }
  if (codex) out.push(skipRow("scn/*@codex", `${codex} scenarios list Codex; the Codex host lands in v1.5`));
  return out;
}

export const scenarioQuickChecks: CheckDef[] = [catalogValid];
export const scenarioChecks: CheckDef[] = buildScenarioChecks();
