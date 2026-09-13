/**
 * Resolves `type:id` references against `registry.json`.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────────────────
 *
 * `scripts/registry/validate-registry.sh` prints "244/244 valid, 0 missing dependencies" and
 * exits 0. That is a FALSE GREEN. It is blind in two structural ways:
 *
 *   1. It reads `registry.json` and nothing else, so component `dependencies:` authored in
 *      on-disk frontmatter are never parsed. Drift between a registry entry and the file that
 *      actually ships is undetectable — which is how three dead refs in
 *      `.opencode/command/add-context.md` shipped unnoticed.
 *   2. It walks `.components.*[].dependencies` only. `.profiles.*.components` is never
 *      validated, which is how a wildcard expanding to zero matches sits in the `advanced`
 *      profile unseen.
 *
 * This resolver reads all three sources the repo authors and applies the resolution rule the
 * validator documents for itself. It is measured against the oracle in
 * `tests/support/references.ts` (see `tests/unit/build/reference-resolution.test.ts`).
 *
 * ─── Corpus scope ───────────────────────────────────────────────────────────────────────
 *
 * {@link ReferenceResolver.findDeadReferences} covers the *legacy* corpus: registry component
 * dependencies, registry profile component lists, and `.opencode/**` `dependencies:`
 * frontmatter. That is deliberately the same corpus `registry.json` governs today, because
 * `registry.json` is what `install.sh` actually reads at install time.
 *
 * The canonical `content/agents/**` tree is NOT part of that corpus — it is not yet wired
 * into any install path. Scan it explicitly with {@link ReferenceResolver.resolveMany} if you
 * want its verdict; be aware it surfaces `subagent:batch-executor`, which exists on disk but
 * is absent from `registry.json`.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import matter from "gray-matter";

// ============================================================================
// TYPES
// ============================================================================

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

/** Where registry context `path` values are rooted. Wildcards expand against this prefix. */
const CONTEXT_ROOT = ".opencode/context/";

export type ResolutionStatus =
  | "ok"
  | "invalid-format"
  | "unknown-type"
  | "dead-id"
  | "dead-wildcard";

export interface RegistryComponent {
  id: string;
  name?: string;
  path?: string;
  aliases?: string[];
  dependencies?: string[];
}

export interface Registry {
  components: Record<string, RegistryComponent[]>;
  profiles: Record<string, { components?: string[] }>;
}

/** A reference together with where it was authored. */
export interface Reference {
  /** The raw `type:id` string as authored. */
  ref: string;
  /** Human-readable origin, e.g. `.opencode/command/add-context.md`. */
  source: string;
}

export interface ResolveResult {
  ok: boolean;
  status: ResolutionStatus;
  /** Repo-relative path of the component backing this ref. Set only for a single `ok` match. */
  path?: string;
  /** Repo-relative paths a wildcard expanded to. Set only for an `ok` wildcard. */
  matches?: string[];
  /** Why it failed, in one sentence. Absent when `ok`. */
  reason?: string;
}

export interface Resolution extends Reference, ResolveResult {}

// ============================================================================
// INDEX
// ============================================================================

interface RegistryIndex {
  /** type -> set of ids (including aliases, which `install.sh` also matches on). */
  idsByType: Map<string, Set<string>>;
  /** `type:id` -> repo-relative path, for reporting what backs a reference. */
  pathByRef: Map<string, string>;
  /** Every registry context path, for wildcard expansion. */
  contextPaths: Set<string>;
}

function buildIndex(registry: Registry): RegistryIndex {
  const idsByType = new Map<string, Set<string>>();
  const pathByRef = new Map<string, string>();
  const contextPaths = new Set<string>();

  for (const [category, components] of Object.entries(registry.components)) {
    const type = CATEGORY_TO_TYPE[category];
    if (type === undefined) continue;

    const ids = idsByType.get(type) ?? new Set<string>();

    for (const component of components) {
      ids.add(component.id);
      if (component.path !== undefined) pathByRef.set(`${type}:${component.id}`, component.path);

      // `install.sh` resolve_dependencies matches `.id == $id or (.aliases | index($id))`,
      // so an alias is a legitimate way to name a component. Mirror that or we would report
      // refs as dead that the installer resolves fine.
      for (const alias of component.aliases ?? []) {
        ids.add(alias);
        if (component.path !== undefined) pathByRef.set(`${type}:${alias}`, component.path);
      }

      if (type === "context" && component.path !== undefined) contextPaths.add(component.path);
    }

    idsByType.set(type, ids);
  }

  return { idsByType, pathByRef, contextPaths };
}

// ============================================================================
// FILE WALKING
// ============================================================================

/** Recursively list files under `dir` matching `extension`, sorted for determinism. */
function listFiles(dir: string, extension = ".md"): string[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];

  const walk = (current: string): string[] =>
    readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
      const full = join(current, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && entry.name.endsWith(extension) ? [full] : [];
    });

  // Sort once at the end over full paths: readdir order is filesystem-dependent and the
  // determinism gate (subtask 11) fails on any enumeration nondeterminism.
  return walk(dir).sort(compare);
}

/** Locale-independent string ordering. `localeCompare` is locale-dependent — never use it here. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Repo-relative, POSIX-separated path — stable across platforms. */
function toPosixRelative(root: string, absolute: string): string {
  return relative(root, absolute).split(sep).join("/");
}

// ============================================================================
// RESOLVER
// ============================================================================

export class ReferenceResolver {
  private readonly root: string;
  private registryCache?: Registry;
  private indexCache?: RegistryIndex;

  /**
   * @param root - Repository root. Everything is resolved relative to this, so the resolver
   *               is testable against a fixture tree rather than a hardcoded path.
   */
  constructor(root: string) {
    this.root = root;
  }

  /** The parsed `registry.json`, read once per instance. */
  registry(): Registry {
    if (this.registryCache === undefined) {
      this.registryCache = JSON.parse(
        readFileSync(join(this.root, "registry.json"), "utf-8")
      ) as Registry;
    }
    return this.registryCache;
  }

  private index(): RegistryIndex {
    if (this.indexCache === undefined) this.indexCache = buildIndex(this.registry());
    return this.indexCache;
  }

  /**
   * Resolve a single `type:id` reference.
   *
   * The rule is the one `validate-registry.sh` documents for itself:
   *   - exact registry id (or alias) match, OR
   *   - for `context:`, the path form `.opencode/context/<id>.md`, OR
   *   - for a trailing `*`, at least one registry context path under `.opencode/context/<prefix>`.
   *
   * Deliberately NOT tolerated: an id that already ends in `.md`. Registry context ids are
   * bare slugs — none contains `/` or ends in `.md`. Accepting `context:core/standards/mvi.md`
   * would invent a second, undeclared namespace and paper over exactly the drift this resolver
   * exists to catch.
   */
  resolve(ref: string): ResolveResult {
    const registryIndex = this.index();
    const separator = ref.indexOf(":");

    if (separator <= 0 || separator === ref.length - 1) {
      return {
        ok: false,
        status: "invalid-format",
        reason: `"${ref}" is not of the form "<type>:<id>"`,
      };
    }

    const type = ref.slice(0, separator);
    const id = ref.slice(separator + 1);
    const ids = registryIndex.idsByType.get(type);

    if (ids === undefined) {
      const known = [...registryIndex.idsByType.keys()].sort(compare).join(", ");
      return {
        ok: false,
        status: "unknown-type",
        reason: `"${type}" is not a registry component type (known: ${known})`,
      };
    }

    if (id.includes("*")) {
      const prefix = id.slice(0, id.indexOf("*"));
      const matches = [...registryIndex.contextPaths]
        .filter((path) => path.startsWith(CONTEXT_ROOT + prefix))
        .sort(compare);

      return matches.length > 0
        ? { ok: true, status: "ok", matches }
        : {
            ok: false,
            status: "dead-wildcard",
            reason:
              `wildcard "${ref}" expands to 0 matches — no registry context path starts ` +
              `with "${CONTEXT_ROOT}${prefix}"`,
          };
    }

    if (ids.has(id)) {
      const path = registryIndex.pathByRef.get(`${type}:${id}`);
      return path === undefined ? { ok: true, status: "ok" } : { ok: true, status: "ok", path };
    }

    // A context may also be named by its path-without-extension, e.g. `context:ui/web/design-systems`.
    const pathForm = `${CONTEXT_ROOT}${id}.md`;
    if (type === "context" && registryIndex.contextPaths.has(pathForm)) {
      return { ok: true, status: "ok", path: pathForm };
    }

    return {
      ok: false,
      status: "dead-id",
      reason: `no registry component has id "${id}" of type "${type}"`,
    };
  }

  /** Resolve a batch of references, preserving their source attribution. */
  resolveMany(references: readonly Reference[]): Resolution[] {
    return references.map((reference) => ({ ...reference, ...this.resolve(reference.ref) }));
  }

  // --------------------------------------------------------------------------
  // Reference collection — the three sources the repo authors
  // --------------------------------------------------------------------------

  /** Every reference authored in `registry.json` component `dependencies` arrays. */
  componentReferences(): Reference[] {
    return Object.entries(this.registry().components).flatMap(([category, components]) =>
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
   * `validate-registry.sh` never looks here — this is where the dead wildcard lives.
   */
  profileReferences(): Reference[] {
    return Object.entries(this.registry().profiles).flatMap(([name, profile]) =>
      (profile.components ?? []).map((ref) => ({
        ref,
        source: `registry.json profiles.${name}.components`,
      }))
    );
  }

  /**
   * Every reference authored in on-disk `dependencies:` frontmatter under `dir`.
   * `validate-registry.sh` never looks here either — 3 of the 4 known dead refs live here.
   */
  frontmatterReferences(dir = ".opencode"): Reference[] {
    return listFiles(join(this.root, dir)).flatMap((file) => {
      const source = toPosixRelative(this.root, file);
      let data: Record<string, unknown>;

      try {
        ({ data } = matter(readFileSync(file, "utf-8")));
      } catch {
        // Unparseable frontmatter is a schema defect, owned by the schema suite. Skipping it
        // keeps this collector about reference rot only.
        return [];
      }

      const dependencies = data.dependencies;
      if (!Array.isArray(dependencies)) return [];

      return dependencies
        .filter((ref): ref is string => typeof ref === "string")
        .map((ref) => ({ ref, source }));
    });
  }

  /** Every reference in the legacy corpus `registry.json` governs. */
  allReferences(): Reference[] {
    return [
      ...this.componentReferences(),
      ...this.profileReferences(),
      ...this.frontmatterReferences(),
    ];
  }

  /**
   * Every reference in the legacy corpus that does not resolve.
   *
   * Async because callers treat resolution as an I/O-bound build step; the work itself is
   * synchronous file reads.
   */
  findDeadReferences(): Promise<Resolution[]> {
    return Promise.resolve(this.resolveMany(this.allReferences()).filter((r) => !r.ok));
  }
}

/** Render resolutions as one greppable line each, for failure messages. */
export function formatResolutions(resolutions: readonly Resolution[]): string {
  return resolutions.length === 0
    ? "  (none)"
    : resolutions
        .map((r) => `  ${r.source}\n    ${r.ref} -> ${r.status}: ${r.reason ?? ""}`)
        .join("\n");
}
