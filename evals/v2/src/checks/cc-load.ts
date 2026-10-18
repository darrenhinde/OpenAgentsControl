import { cpSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { claudeRunArgv, parseClaudeStream, sessionStartPayload, type ClaudeRunResult } from "../../../../packages/compatibility-layer/src/hosts/claude-code/driver.ts";
import type { CheckDef, CheckOutcome, RunContext } from "../core/types.ts";
import { lintCcAgentExamples } from "../lints/cc-agent-examples.ts";
import { frontmatter } from "../lints/files.ts";
import { isoEnv, makeIsoDirs, runIsolated, safePath, sandboxMode } from "../sandbox/env.ts";
import { safetyLedger } from "../sandbox/ledger.ts";
import { cachedWhich, lastLine } from "./helpers.ts";
import { runHost } from "./host-run.ts";

/**
 * `claude plugin validate --strict --json` on a COPY of the plugin (agents never see the repo),
 * through the sandbox wrapper with a throwaway HOME and a dummy key. No model call is made.
 */
function validate(id: string, what: "plugin" | "marketplace"): CheckDef {
  return {
    id,
    area: "cc-load",
    layer: "L0",
    tier: "quick",
    run: async (ctx: RunContext): Promise<CheckOutcome> => {
      const claude = await cachedWhich("claude");
      if (!claude) return { ok: false, skip: "claude not on PATH" };
      const d = makeIsoDirs(ctx.tmpRoot, id);
      const filter = (src: string): boolean => !src.includes("node_modules");
      cpSync(join(ctx.repo, "plugins", "claude-code"), join(d.work, "plugins", "claude-code"), { recursive: true, filter });
      if (what === "marketplace") cpSync(join(ctx.repo, ".claude-plugin"), join(d.work, ".claude-plugin"), { recursive: true });
      const target = what === "plugin" ? join(d.work, "plugins", "claude-code") : d.work;
      const r = await runIsolated({
        dirs: d,
        env: isoEnv(d, safePath([claude, await cachedWhich("node")]), {
          ANTHROPIC_API_KEY: `sk-ant-dummy-${ctx.runId}`,
          ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
        }),
        argv: [claude, "plugin", "validate", "--strict", "--json", target],
        target: { repo: ctx.repo, repoDeny: ctx.repo },
        timeoutMs: 60_000,
        onData: (s) => ctx.log(s.replace(/\n$/, "")),
      });
      ctx.log(`# exit ${r.code} in ${r.ms} ms`);
      let summary = r.code === 0 ? undefined : lastLine(r.out);
      const m = /"message"\s*:\s*"([^"]+)"/.exec(r.out);
      if (r.code !== 0 && m?.[1]) summary = m[1].slice(0, 100);
      return { ok: r.code === 0, summary, sandbox: { mode: "seatbelt" } };
    },
  };
}

/** L0: each shipped Claude agent keeps its <example> dispatch blocks (lost in 104356a). */
const agentDispatchExamples: CheckDef = {
  id: "cc/agent-dispatch-examples",
  area: "cc-load",
  layer: "L0",
  tier: "quick",
  run: (ctx: RunContext): Promise<CheckOutcome> => {
    const dir = join(ctx.repo, "plugins", "claude-code", "agents");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => ({ name: f, text: readFileSync(join(dir, f), "utf8") }));
    const res = lintCcAgentExamples(files);
    for (const f of res.missing) ctx.log(`MISSING <example>: plugins/claude-code/agents/${f}`);
    ctx.log(`${res.withExamples}/${res.total} agents have <example> blocks`);
    return Promise.resolve({
      ok: res.missing.length === 0,
      summary: `${res.withExamples}/${res.total} Claude agents have <example> blocks`,
      metrics: { agents: res.total, withExamples: res.withExamples },
    });
  },
};

/** What the shipped plugin should register, read from plugins/claude-code itself. */
export function expectedPluginComponents(pluginDir: string): { agents: string[]; skills: string[]; commands: string[] } {
  const ls = (d: string): string[] => (existsSync(join(pluginDir, d)) ? readdirSync(join(pluginDir, d)) : []);
  const agents = ls("agents").filter((f) => f.endsWith(".md")).map((f) => {
    const name = frontmatter(readFileSync(join(pluginDir, "agents", f), "utf8")).data.name;
    return `oac:${typeof name === "string" && name ? name : basename(f, ".md")}`;
  });
  const skills = ls("skills").filter((d) => existsSync(join(pluginDir, "skills", d, "SKILL.md"))).map((d) => `oac:${d}`);
  const commands = ls("commands").filter((f) => f.endsWith(".md")).map((f) => `oac:${basename(f, ".md")}`);
  return { agents: agents.sort(), skills: skills.sort(), commands: commands.sort() };
}

interface PluginRun {
  stream: ClaudeRunResult;
  expected: ReturnType<typeof expectedPluginComponents>;
  artifacts: string;
  code: number;
}

/**
 * One `claude -p hi` with a COPY of plugins/claude-code passed via --plugin-dir, an isolated
 * HOME, the dummy key and the Anthropic fake model; shared by cc/plugin-load and
 * cc/sessionstart-payload (plan §3.4). Never --bare: it would skip the SessionStart hook.
 */
async function pluginRun(ctx: RunContext): Promise<PluginRun | undefined> {
  const cached = ctx.shared.get("cc-plugin-run") as PluginRun | undefined;
  if (cached) return cached;
  const bin = await cachedWhich("claude");
  if (!bin) return undefined;
  const src = join(ctx.repo, "plugins", "claude-code");
  let pluginDir = "";
  const run = await runHost(ctx, {
    name: "cc-plugin-load",
    host: "claude-code",
    script: [],
    prepare: (d) => {
      pluginDir = join(d.root, "plugin-copy");
      cpSync(src, pluginDir, { recursive: true, filter: (p) => !p.includes("node_modules") });
    },
    argv: () => claudeRunArgv({ bin, prompt: "hi", pluginDir, needsHooks: true }),
    extraBins: [await cachedWhich("bash")],
    timeoutMs: 60_000,
  });
  const res: PluginRun = { stream: parseClaudeStream(run.out), expected: expectedPluginComponents(src), artifacts: run.artifacts, code: run.code };
  ctx.shared.set("cc-plugin-run", res);
  return res;
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const pluginLoad: CheckDef = {
  id: "cc/plugin-load",
  area: "cc-load",
  layer: "L1",
  host: "claude-code",
  tier: "hosts",
  run: async (ctx) => {
    const r = await pluginRun(ctx);
    if (!r) return { ok: false, skip: "claude not on PATH" };
    const init = r.stream.init;
    if (!init) return { ok: false, summary: `driver contract broken: no system/init event (exit ${r.code})`, artifacts: r.artifacts };
    const plugins = Array.isArray(init.plugins) ? (init.plugins as Record<string, unknown>[]) : [];
    const oac = plugins.find((p) => p.name === "oac" && p.source === "oac@inline");
    const agents = strList(init.agents);
    const skills = strList(init.skills);
    const slash = strList(init.slash_commands);
    const mcp = Array.isArray(init.mcp_servers) ? init.mcp_servers.length : -1;
    const missing = {
      agents: r.expected.agents.filter((a) => !agents.includes(a)),
      skills: r.expected.skills.filter((s) => !skills.includes(s)),
      commands: r.expected.commands.filter((c) => !slash.includes(c)),
    };
    const problems: string[] = [];
    if (!oac) problems.push("plugin oac@inline not listed");
    for (const [k, v] of Object.entries(missing)) if (v.length) problems.push(`missing ${k}: ${v.join(",")}`);
    if (r.stream.apiKeySource !== "ANTHROPIC_API_KEY") {
      problems.push(`apiKeySource=${r.stream.apiKeySource ?? "?"}`);
      safetyLedger().authViolations.push(`cc/plugin-load: apiKeySource=${r.stream.apiKeySource ?? "?"}`);
    }
    if (mcp !== 0) problems.push(`mcp_servers=${mcp}`);
    const oacAgents = agents.filter((a) => a.startsWith("oac:")).length;
    const oacSkills = skills.filter((a) => a.startsWith("oac:")).length;
    const oacSlash = slash.filter((a) => a.startsWith("oac:")).length;
    ctx.log(`plugin: ${JSON.stringify(oac ?? null)}`);
    ctx.log(`expected agents ${r.expected.agents.join(",")}`);
    ctx.log(`expected skills ${r.expected.skills.join(",")}  commands ${r.expected.commands.join(",")}`);
    ctx.log(`init: ${oacAgents} oac agents, ${oacSkills} oac skills, ${oacSlash} oac slash commands, apiKeySource=${r.stream.apiKeySource}, mcp_servers=${mcp}`);
    for (const p of problems) ctx.log(`PROBLEM ${p}`);
    return {
      ok: problems.length === 0,
      summary: problems.length ? problems.join("; ").slice(0, 120) : `${oacAgents} agents, ${oacSkills} skills, ${oacSlash} slash commands; key from ANTHROPIC_API_KEY`,
      metrics: { agents: oacAgents, skills: oacSkills, slashCommands: oacSlash },
      artifacts: r.artifacts,
      sandbox: { mode: sandboxMode() },
    };
  },
};

/** v1.1 target (02 §6.2): startup injection ≤ 3 lines / 400 B, and no "MUST" / context-discovery push. */
export const SESSIONSTART_LIMITS = { linesMax: 3, bytesMax: 400, mustNotContain: ["MUST", "context-discovery"] };

const sessionStartPayloadCheck: CheckDef = {
  id: "cc/sessionstart-payload",
  area: "cc-load",
  layer: "L1",
  host: "claude-code",
  tier: "hosts",
  run: async (ctx) => {
    const r = await pluginRun(ctx);
    if (!r) return { ok: false, skip: "claude not on PATH" };
    const p = sessionStartPayload(r.stream);
    if (!p) return { ok: false, summary: "driver contract broken: no SessionStart:startup hook_response in the stream", artifacts: r.artifacts };
    const hits = SESSIONSTART_LIMITS.mustNotContain.filter((w) => p.context.includes(w));
    ctx.log(`SessionStart:startup stdout ${p.stdoutBytes} B; injected context ${p.lines} lines / ${p.bytes} B; contains ${JSON.stringify(hits)}`);
    ctx.log(`limits: ≤ ${SESSIONSTART_LIMITS.linesMax} lines, ≤ ${SESSIONSTART_LIMITS.bytesMax} B, none of ${JSON.stringify(SESSIONSTART_LIMITS.mustNotContain)}`);
    const ok = p.lines <= SESSIONSTART_LIMITS.linesMax && p.bytes <= SESSIONSTART_LIMITS.bytesMax && hits.length === 0;
    const kb = (n: number): string => (n / 1024).toFixed(1);
    return {
      ok,
      summary: `${p.lines} lines / ${kb(p.bytes)} KB context (${kb(p.stdoutBytes)} KB hook stdout) at startup; limit ${SESSIONSTART_LIMITS.linesMax} lines${hits.length ? `; has ${hits.join(", ")}` : ""}`,
      metrics: { lines: p.lines, bytes: p.bytes, stdoutBytes: p.stdoutBytes },
      artifacts: r.artifacts,
    };
  },
};

export const ccLoadChecks: CheckDef[] = [
  validate("cc/plugin-validate", "plugin"),
  validate("cc/marketplace-validate", "marketplace"),
  agentDispatchExamples,
];

/** hosts tier: one sandboxed plugin load feeds both rows. */
export const ccLoadHostChecks: CheckDef[] = [pluginLoad, sessionStartPayloadCheck];
