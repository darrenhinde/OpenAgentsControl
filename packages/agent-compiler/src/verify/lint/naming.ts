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
 *   id-compound-word     the id contains a run-together word from {@link KNOWN_COMPOUNDS}.
 *   display-name         the OpenCode `name` is not PascalCase(id) (brand ids and an `Open` prefix exempt).
 *   category-deprecated  the category is a deprecated alias (`subagents/*`, `testing`, `development`).
 *   category-folder      the folder under agents/ is not the category (one level, no nesting).
 *
 * Skipped on purpose: `type` vs folder. `type` (agent/subagent) is orthogonal to category
 * (`core/` holds both openagent and context-scout), so there is nothing to check.
 *
 * Allow-lists (documented in NAMING.md): {@link LEGACY_AGENT_SUFFIX_IDS}, {@link BRAND_IDS}.
 */

import { DEPRECATED_CATEGORIES } from "../../types.js";
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

/** Run-together words that must be hyphenated in an id: found as a whole id or one hyphen-separated part. */
export const KNOWN_COMPOUNDS: Readonly<Record<string, string>> = {
  contextscout: "context-scout",
  externalscout: "external-scout",
};

/**
 * Ids that keep the `-agent` suffix for now: plugin-facing names (`oac:coder-agent`). A documented
 * exception, listed in NAMING.md as "legacy exceptions, revisit".
 */
export const LEGACY_AGENT_SUFFIX_IDS: readonly string[] = ["coder-agent", "build-agent"];

/** Brand ids: their display name is the product spelling, not PascalCase(id). */
export const BRAND_IDS: Readonly<Record<string, string>> = {
  openagent: "OpenAgent",
  opencoder: "OpenCoder",
};

/** Id parts that stay upper-case in a display name (`adr-manager` -> `ADRManager`). */
export const ACRONYMS: readonly string[] = ["adr"];

/** The display name an id derives: each hyphen part capitalised (acronyms upper-cased), joined. */
export function derivedDisplayName(id: string): string {
  return id
    .split("-")
    .map((part) => (ACRONYMS.includes(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The slice of a canonical agent the lint reads (structurally a `CanonicalAgentFile`). */
export type NamingSubject = Pick<CanonicalAgentFile, "relativePath"> & {
  oac: Pick<CanonicalAgentFile["oac"], "id"> & {
    name?: string;
    category?: string;
    overrides?: { "claude-code"?: { name?: string } };
  };
  /** The OpenCode frontmatter; its `name` (falling back to `oac.name`) is the v1 id / display name. */
  frontmatter?: { name?: string };
};

export function lintNaming(agents: readonly NamingSubject[]): NamingFinding[] {
  const out: NamingFinding[] = [];
  for (const { relativePath: path, oac, frontmatter } of agents) {
    const id = oac.id;
    const add = (rule: string, level: NamingLevel, message: string): void => {
      out.push({ path, id, rule, level, message });
    };
    const segments = path.split("/");
    const file = (segments[segments.length - 1] ?? "").replace(/\.md$/, "");

    if (!KEBAB.test(id)) add("id-kebab-case", "warn", `id "${id}" is not kebab-case`);
    if (file !== id) add("filename-is-id", "warn", `file name "${file}" != id "${id}"`);
    if (id.endsWith("-agent") && !LEGACY_AGENT_SUFFIX_IDS.includes(id)) add("id-agent-suffix", "warn", `id "${id}" ends in "-agent"; the id never repeats the type`);
    if (segments.slice(0, -1).includes("subagents")) {
      add("subagents-folder", "warn", `lives under subagents/; category is the only folder axis (type: is the primary/subagent switch)`);
    }
    const override = oac.overrides?.["claude-code"]?.name;
    if (override !== undefined && override !== id) {
      add("host-name-override", "warn", `claude-code name override "${override}" differs from the derived default "${id}"`);
    }
    for (const part of id.split("-")) {
      const fix = KNOWN_COMPOUNDS[part];
      if (fix !== undefined) add("id-compound-word", "warn", `"${part}" is run together; write "${fix}"`);
    }
    const display = frontmatter?.name ?? oac.name;
    if (display !== undefined) {
      const derived = BRAND_IDS[id] ?? derivedDisplayName(id);
      if (display !== derived && display !== `Open${derived}`) {
        add("display-name", "warn", `display name "${display}" != derived "${derived}" (PascalCase of the id; an \`Open\` prefix is allowed)`);
      }
    }
    const category = oac.category;
    if (category !== undefined) {
      const root = category.split("/")[0] ?? category;
      if (root in DEPRECATED_CATEGORIES) {
        add("category-deprecated", "warn", `category "${category}" is deprecated; use ${DEPRECATED_CATEGORIES[root]}`);
      }
      const folder = segments.slice(0, -1).join("/");
      if (folder !== category) add("category-folder", "warn", `folder "${folder || "."}" != category "${category}"`);
    }
    const last = id.split("-").pop() ?? id;
    if (id.includes("-") && !ROLE_SUFFIXES.includes(last)) {
      add("role-suffix", "info", `suffix "-${last}" is not in the role vocabulary`);
    }
  }
  return out;
}
