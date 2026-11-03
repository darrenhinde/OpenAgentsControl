/**
 * Lints for canonical skills and commands (`agent-library/skills|commands`).
 *
 * Two groups, mirroring how agents are checked:
 *
 *  - {@link lintAssetNaming}: id and folder rules from docs/architecture/NAMING.md. REPORT-ONLY,
 *    like the agent naming lint (printed after the summary, never counted, never fails).
 *  - {@link lintAssetReferences}: references that must resolve. Counted as lint warnings, so they
 *    fail `--strict` and `make check-core`'s zero-lint expectation:
 *      - `dead-dependency`: an `oac.dependencies` entry naming an agent, skill or command that
 *        does not exist in `agent-library/`;
 *      - `skill-agent-unknown`: a Claude skill's `agent:` field (a forked-context skill runs as that
 *        agent) names something that is neither a Claude Code agent nor a built-in one.
 *
 * Hard rules (id equals folder or file name, skill `name` equals id, no duplicate id or alias,
 * schema) are errors in the loader (`AssetLoader.ts`), not lints, because a violation makes the
 * output path ambiguous.
 */

import type { CanonicalAgentFile } from "../../core/AgentLoader.js";
import type { CanonicalAssetFile } from "../../core/AssetLoader.js";
import { KNOWN_COMPOUNDS } from "./naming.js";
import type { LintFinding } from "./opencode.js";

export interface AssetNamingFinding {
  /** Source path relative to `agent-library/`. */
  path: string;
  id: string;
  rule: string;
  level: "warn" | "info";
  message: string;
}

/** Skill ids that keep a `-skill` suffix for now (legacy; renaming moves an installed folder). */
export const LEGACY_ASSET_SUFFIX_IDS: readonly string[] = ["smart-router-skill"];

/** Command group folders deeper than one level that predate the rule. Revisit when they move. */
export const LEGACY_COMMAND_GROUPS: readonly string[] = ["openagents/new-agents"];

/** Claude Code's own subagents, valid as a forked skill's `agent:`. */
export const CLAUDE_BUILTIN_AGENTS: readonly string[] = ["Explore", "Plan", "general-purpose"];

const sourceOf = (asset: CanonicalAssetFile): string =>
  `${asset.kind === "skill" ? "skills" : "commands"}/${asset.relativePath}`;

export function lintAssetNaming(assets: readonly CanonicalAssetFile[]): AssetNamingFinding[] {
  const out: AssetNamingFinding[] = [];
  for (const asset of assets) {
    const { id } = asset.oac;
    const add = (rule: string, level: "warn" | "info", message: string): void => {
      out.push({ path: sourceOf(asset), id, rule, level, message });
    };
    const suffix = `-${asset.kind}`;
    if (id.endsWith(suffix) && !LEGACY_ASSET_SUFFIX_IDS.includes(id)) {
      add("id-type-suffix", "warn", `id "${id}" ends in "${suffix}"; the id never repeats the type`);
    }
    for (const part of id.split("-")) {
      const fix = KNOWN_COMPOUNDS[part];
      if (fix !== undefined) add("id-compound-word", "warn", `"${part}" is run together; write "${fix}"`);
    }
    if (asset.kind === "command" && asset.group.split("/").filter(Boolean).length > 1 && !LEGACY_COMMAND_GROUPS.includes(asset.group)) {
      add("command-group-depth", "warn", `group folder "${asset.group}" is more than one level deep; the group is one folder`);
    }
    const override = asset.oac.overrides["claude-code"]?.name;
    if (override !== undefined && override !== id) {
      add("host-name-override", "warn", `claude-code name override "${override}" differs from the id "${id}"`);
    }
  }
  return out;
}

export interface AssetReferenceInput {
  skills: readonly CanonicalAssetFile[];
  commands: readonly CanonicalAssetFile[];
  agents: readonly CanonicalAgentFile[];
}

export function lintAssetReferences({ skills, commands, agents }: AssetReferenceInput): LintFinding[] {
  const out: LintFinding[] = [];
  const known = {
    agent: new Set(agents.flatMap((agent) => [agent.oac.id, ...agent.oac.aliases])),
    skill: new Set(skills.flatMap((skill) => [skill.oac.id, ...skill.oac.aliases])),
    command: new Set(commands.flatMap((command) => [command.oac.id, ...command.oac.aliases])),
  };
  const claudeAgents = new Set([
    ...CLAUDE_BUILTIN_AGENTS,
    ...agents
      .filter((agent) => agent.oac.targets.includes("claude-code") && !agent.oac.exclude.includes("claude-code"))
      .flatMap((agent) => [agent.oac.id, ...agent.oac.aliases]),
  ]);

  for (const asset of [...skills, ...commands]) {
    const path = sourceOf(asset);
    for (const { type, id } of asset.oac.dependencies) {
      const roster = type === "subagent" || type === "agent" ? known.agent : type === "skill" ? known.skill : type === "command" ? known.command : undefined;
      if (roster !== undefined && !roster.has(id)) {
        out.push({ path, rule: "dead-dependency", severity: "warning", message: `oac.dependencies names ${type}:${id}, which does not exist in agent-library/` });
      }
    }
    const agent = asset.fields.agent;
    const shipsToClaude = asset.oac.targets.includes("claude-code") && !asset.oac.exclude.includes("claude-code");
    if (asset.kind === "skill" && shipsToClaude && typeof agent === "string" && !claudeAgents.has(agent)) {
      out.push({ path, rule: "skill-agent-unknown", severity: "warning", message: `frontmatter agent "${agent}" is not a Claude Code agent in agent-library/agents/ (or a built-in)` });
    }
  }
  return out;
}
