/**
 * Naming lint: the rules in docs/architecture/NAMING.md, over the canonical source.
 * Pure: loaded canonical agents in, findings out.
 *
 * REPORT-ONLY. Existing agents predate these rules and are renamed in a later step, so nothing
 * here fails a build, counts toward `--strict`, or joins the degradation-warning baseline.
 * `oac build` prints the findings in their own "naming" section.
 *
 * Rules (level `warn` unless noted):
 *   id-kebab-case        `oac.id` is lowercase words joined by single hyphens.
 *   filename-is-id       the file name (minus `.md`) equals `oac.id`.
 *   id-agent-suffix      `oac.id` must not end in `-agent`.
 *   subagents-folder     no path segment is `subagents/` (category is the only folder axis).
 *   host-name-override   `oac.overrides.claude-code.name` differs from the derived default (the id).
 *   role-suffix          (`info`) the last word is not in {@link ROLE_SUFFIXES}.
 */

import type { CanonicalAgentFile } from "../../core/AgentLoader.js";

export type NamingLevel = "warn" | "info";

export interface NamingFinding {
  /** Source path relative to the agent content root. */
  path: string;
  id: string;
  rule: string;
  level: NamingLevel;
  message: string;
}

/** The agreed role-suffix vocabulary. Others are allowed and only produce an `info` note. */
export const ROLE_SUFFIXES: readonly string[] = [
  "scout", "manager", "specialist", "reviewer", "writer", "analyzer", "executor", "orchestrator",
  "generator", "creator", "designer", "engineer", "retriever", "organizer", "mapper", "responder",
  "runner", "engine",
];

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The slice of a canonical agent the lint reads (structurally a `CanonicalAgentFile`). */
export type NamingSubject = Pick<CanonicalAgentFile, "relativePath"> & {
  oac: Pick<CanonicalAgentFile["oac"], "id"> & { overrides?: { "claude-code"?: { name?: string } } };
};

export function lintNaming(agents: readonly NamingSubject[]): NamingFinding[] {
  const out: NamingFinding[] = [];
  for (const { relativePath: path, oac } of agents) {
    const id = oac.id;
    const add = (rule: string, level: NamingLevel, message: string): void => {
      out.push({ path, id, rule, level, message });
    };
    const segments = path.split("/");
    const file = (segments[segments.length - 1] ?? "").replace(/\.md$/, "");

    if (!KEBAB.test(id)) add("id-kebab-case", "warn", `id "${id}" is not kebab-case`);
    if (file !== id) add("filename-is-id", "warn", `file name "${file}" != id "${id}"`);
    if (id.endsWith("-agent")) add("id-agent-suffix", "warn", `id "${id}" ends in "-agent"; the id never repeats the type`);
    if (segments.slice(0, -1).includes("subagents")) {
      add("subagents-folder", "warn", `lives under subagents/; category is the only folder axis (type: is the primary/subagent switch)`);
    }
    const override = oac.overrides?.["claude-code"]?.name;
    if (override !== undefined && override !== id) {
      add("host-name-override", "warn", `claude-code name override "${override}" differs from the derived default "${id}"`);
    }
    const last = id.split("-").pop() ?? id;
    if (id.includes("-") && !ROLE_SUFFIXES.includes(last)) {
      add("role-suffix", "info", `suffix "-${last}" is not in the role vocabulary`);
    }
  }
  return out;
}
