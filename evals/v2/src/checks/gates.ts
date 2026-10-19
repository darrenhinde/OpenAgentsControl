import type { CheckDef, CheckOutcome, RunContext } from "../core/types.ts";
import { listFiles } from "../lints/files.ts";
import { lintNoHiddenTools } from "../lints/no-hidden-tools.ts";
import { lintSubagentKeys } from "../lints/subagent-keys.ts";

const md = (p: string): boolean => p.endsWith(".md");

const noHiddenTools: CheckDef = {
  id: "gates/no-hidden-tools",
  area: "gates",
  layer: "L0",
  tier: "quick",
  workload: "trusted-static",
  run: (ctx: RunContext): Promise<CheckOutcome> => {
    const canonical = lintNoHiddenTools(listFiles(ctx.repo, "content/agents", md));
    const emitted = lintNoHiddenTools(listFiles(ctx.repo, ".opencode/agent", md));
    for (const h of [...canonical, ...emitted]) ctx.log(`HIDDEN ${h.action.padEnd(9)} ${h.path}  (${h.key}: ${h.allows.length} allow rule(s), then "*": deny)`);
    const agents = new Set(emitted.map((h) => h.path));
    const byAction: Record<string, number> = {};
    for (const h of emitted) byAction[h.action] = (byAction[h.action] ?? 0) + 1;
    const parts = Object.entries(byAction).map(([a, n]) => `${a}(${n})`).join(" ");
    ctx.log(`emitted: ${agents.size} agents (${parts}); canonical: ${new Set(canonical.map((h) => h.path)).size} agents`);
    return Promise.resolve({
      ok: canonical.length + emitted.length === 0,
      summary: `${agents.size} agents: trailing "*": deny after allows hides ${parts}`,
      metrics: { agents: agents.size, canonicalAgents: new Set(canonical.map((h) => h.path)).size, ...byAction },
    });
  },
};

const subagentKeysExist: CheckDef = {
  id: "gates/subagent-keys-exist",
  area: "gates",
  layer: "L0",
  tier: "quick",
  workload: "trusted-static",
  run: (ctx: RunContext): Promise<CheckOutcome> => {
    const agents = listFiles(ctx.repo, ".opencode/agent", md);
    const prompts = [
      ...agents,
      ...listFiles(ctx.repo, ".opencode/command", md),
      ...listFiles(ctx.repo, ".opencode/skill", md),
      ...listFiles(ctx.repo, ".opencode/skills", md),
    ];
    const r = lintSubagentKeys(agents, prompts);
    for (const b of r.bad) ctx.log(`UNKNOWN ${b.kind.padEnd(8)} ${JSON.stringify(b.name).padEnd(28)} ${b.path}`);
    const names = new Map<string, number>();
    for (const b of r.bad) names.set(b.name, (names.get(b.name) ?? 0) + 1);
    const top = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${c}× ${n}`).join(", ");
    ctx.log(`${r.bad.length}/${r.refs} references name no emitted v2 agent ID; IDs: ${r.ids.length}`);
    return Promise.resolve({
      ok: r.bad.length === 0,
      summary: `${r.bad.length}/${r.refs} subagent refs name no v2 ID (${top})`,
      metrics: { refs: r.refs, unresolved: r.bad.length, taskKeys: r.bad.filter((b) => b.kind === "task-key").length },
    });
  },
};

export const gatesChecks: CheckDef[] = [noHiddenTools, subagentKeysExist];
