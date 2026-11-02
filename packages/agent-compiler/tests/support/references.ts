/**
 * A reference-resolution ORACLE for the tests.
 *
 * Why a test-local oracle exists at all: `scripts/registry/validate-registry.sh` reports
 * "244/244 valid, 0 missing dependencies" and exits 0 — a FALSE GREEN. It is blind in two
 * specific ways, both verified on disk (see reference-resolution.test.ts):
 *
 *   1. It only ever reads `registry.json`. Component `dependencies:` authored in on-disk
 *      frontmatter are never parsed, so frontmatter that has drifted from its registry
 *      entry is invisible to it.
 *   2. It walks `.components.*[].dependencies` only. `.profiles.*.components` — 209 refs
 *      across 5 profiles — is never validated at all.
 *
 * This oracle reads both sources from disk and applies the resolution rule the validator
 * itself documents, so the tests can assert what the validator cannot see. Subtask 05 owns
 * the SHIPPED resolver (`src/core/ReferenceResolver.ts`); this oracle is what that resolver
 * is measured against.
 */

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import matter from "gray-matter";
import { listFiles, repoPath } from "./pending.js";

/** Registry category key -> the `type` prefix used in a `type:id` reference. */
const CATEGORY_TO_TYPE: Readonly<Record<string, string>> = {
  agents: "agent",
  subagents: "subagent",
  commands: "command",
  tools: "tool",
  plugins: "plugin",
  skills: "skill",
  contexts: "context",
  config: "config",
};

const CONTEXT_ROOT = ".opencode/context/";

export type ResolutionStatus =
  | "ok"
  | "invalid-format"
  | "unknown-type"
  | "dead-id"
  | "dead-wildcard";

export interface RegistryComponent {
  id: string;
  name: string;
  path: string;
  dependencies?: string[];
}

export interface Registry {
  components: Record<string, RegistryComponent[]>;
  profiles: Record<string, { components?: string[] }>;
}

/** Where a reference was authored — reported verbatim in failure messages. */
export interface Reference {
  /** The raw `type:id` string as authored. */
  ref: string;
  /** Human-readable origin, e.g. `.opencode/command/add-context.md` or `registry.json profiles.advanced`. */
  source: string;
}

export interface Resolution extends Reference {
  status: ResolutionStatus;
  /** Why it failed, in one sentence. Empty for `ok`. */
  reason: string;
}

export function loadRegistry(): Registry {
  return JSON.parse(readFileSync(repoPath("registry.json"), "utf-8")) as Registry;
}

interface Index {
  idsByType: Map<string, Set<string>>;
  contextPaths: Set<string>;
}

function index(registry: Registry): Index {
  const idsByType = new Map<string, Set<string>>();
  const contextPaths = new Set<string>();

  for (const [category, components] of Object.entries(registry.components)) {
    const type = CATEGORY_TO_TYPE[category];
    if (type === undefined) continue;

    const ids = idsByType.get(type) ?? new Set<string>();
    for (const component of components) {
      ids.add(component.id);
      if (type === "context") contextPaths.add(component.path);
    }
    idsByType.set(type, ids);
  }

  return { idsByType, contextPaths };
}

/**
 * Resolve one `type:id` reference against the registry.
 *
 * The rule is the one `validate-registry.sh` documents for itself:
 *   - exact registry id match, OR
 *   - for `context:`, the path form `.opencode/context/<id>.md`, OR
 *   - for a trailing `*`, at least one registry context path under `.opencode/context/<prefix>`.
 *
 * Note what is deliberately NOT tolerated: an id that already ends in `.md`. Registry ids are
 * bare slugs — zero of the registry's context ids contain `/` or end in `.md` (asserted in
 * reference-resolution.test.ts). Accepting `context:core/standards/mvi.md` as a path would
 * invent a second, undeclared namespace and paper over exactly the drift these tests exist
 * to catch.
 */
export function resolveReference(ref: string, registryIndex: Index): Resolution {
  const base: Reference = { ref, source: "" };
  const separator = ref.indexOf(":");

  if (separator <= 0 || separator === ref.length - 1) {
    return {
      ...base,
      status: "invalid-format",
      reason: `"${ref}" is not of the form "<type>:<id>"`,
    };
  }

  const type = ref.slice(0, separator);
  const id = ref.slice(separator + 1);
  const ids = registryIndex.idsByType.get(type);

  if (ids === undefined) {
    return {
      ...base,
      status: "unknown-type",
      reason: `"${type}" is not a registry component type (known: ${[...registryIndex.idsByType.keys()].sort().join(", ")})`,
    };
  }

  if (id.includes("*")) {
    const prefix = id.slice(0, id.indexOf("*"));
    const matches = [...registryIndex.contextPaths].filter((path) =>
      path.startsWith(CONTEXT_ROOT + prefix)
    );

    return matches.length > 0
      ? { ...base, status: "ok", reason: "" }
      : {
          ...base,
          status: "dead-wildcard",
          reason: `wildcard "${ref}" expands to 0 components — no registry context path starts with "${CONTEXT_ROOT}${prefix}"`,
        };
  }

  if (ids.has(id)) return { ...base, status: "ok", reason: "" };

  if (type === "context" && registryIndex.contextPaths.has(`${CONTEXT_ROOT}${id}.md`)) {
    return { ...base, status: "ok", reason: "" };
  }

  return {
    ...base,
    status: "dead-id",
    reason: `no registry component has id "${id}" of type "${type}"`,
  };
}

/** Every reference authored in `registry.json` component `dependencies` arrays. */
export function registryComponentReferences(registry: Registry): Reference[] {
  return Object.entries(registry.components).flatMap(([category, components]) =>
    components.flatMap((component) =>
      (component.dependencies ?? []).map((ref) => ({
        ref,
        source: `registry.json components.${category}[id=${component.id}].dependencies`,
      }))
    )
  );
}

/**
 * Every reference authored in `registry.json` profile component lists.
 * `validate-registry.sh` never looks here.
 */
export function profileReferences(registry: Registry): Reference[] {
  return Object.entries(registry.profiles).flatMap(([name, profile]) =>
    (profile.components ?? []).map((ref) => ({
      ref,
      source: `registry.json profiles.${name}.components`,
    }))
  );
}

/**
 * Every reference authored in on-disk `dependencies:` frontmatter under `.opencode/`.
 * `validate-registry.sh` never looks here either — this is where 3 of the 4 dead refs live.
 */
export function frontmatterReferences(): Reference[] {
  return listFiles(repoPath(".opencode"), ".md").flatMap((file) => {
    const source = relative(repoPath(), file);
    let data: Record<string, unknown>;

    try {
      ({ data } = matter(readFileSync(file, "utf-8")));
    } catch {
      // A file whose frontmatter does not parse is a different defect, owned by the schema
      // suite. Skipping it here keeps this collector about reference rot only.
      return [];
    }

    const dependencies = data.dependencies;
    if (!Array.isArray(dependencies)) return [];

    return dependencies
      .filter((ref): ref is string => typeof ref === "string")
      .map((ref) => ({ ref, source }));
  });
}

/** Every reference the repo authors, from all three sources. */
export function allReferences(registry: Registry = loadRegistry()): Reference[] {
  return [
    ...registryComponentReferences(registry),
    ...profileReferences(registry),
    ...frontmatterReferences(),
  ];
}

/** Resolve a batch of references, preserving their source attribution. */
export function resolveAll(references: Reference[], registry: Registry = loadRegistry()): Resolution[] {
  const registryIndex = index(registry);
  return references.map((reference) => ({
    ...resolveReference(reference.ref, registryIndex),
    source: reference.source,
  }));
}

/** Just the broken ones. */
export function deadReferences(registry: Registry = loadRegistry()): Resolution[] {
  return resolveAll(allReferences(registry), registry).filter(
    (resolution) => resolution.status !== "ok"
  );
}

/** Render resolutions as one greppable line each, for failure messages. */
export function format(resolutions: readonly Resolution[]): string {
  return resolutions.length === 0
    ? "  (none)"
    : resolutions.map((r) => `  ${r.source}\n    ${r.ref} -> ${r.status}: ${r.reason}`).join("\n");
}
