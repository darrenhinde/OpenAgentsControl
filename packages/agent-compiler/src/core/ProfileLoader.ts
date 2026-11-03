/**
 * Loads install profiles and computes their transitive closures.
 *
 * ─── What a profile promises ────────────────────────────────────────────────────────────
 *
 * A profile is a promise: "install `developer` and you get a working set". That promise is
 * only kept if every component the profile names resolves, AND every dependency of those
 * components resolves, recursively. A profile naming a live component that depends on a dead
 * one is just as broken as one naming the dead component directly — the install fails at the
 * same point, one level deeper. So the unit of validation is the CLOSURE, not the named list.
 *
 * ─── One source ─────────────────────────────────────────────────────────────────────────
 *
 * Canonical profiles live in `agent-library/profiles/**` and are emitted into
 * `built-ai-configs/registry/registry.json` `.profiles.<name>.components`, which is what
 * `install.sh` ACTUALLY reads (`get_profile_components`). The old hand-maintained
 * `.opencode/profiles/<name>/profile.json` files had drifted from that list, nothing installed
 * them, and they have been removed. {@link ProfileLoader.resolveClosure} validates the
 * registry list, which is the one an install uses.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { ContextProfileSchema, SystemProfileSchema } from "../types.js";
import { ReferenceResolver, type Reference, type Resolution } from "./ReferenceResolver.js";

// ============================================================================
// TYPES
// ============================================================================

export interface ClosureResult {
  /** Every ref in the transitive closure, deduplicated and sorted. */
  ids: string[];
  /** The closure with source attribution, in discovery order. */
  refs: Reference[];
  /** The subset of the closure that does not resolve. */
  missing: Resolution[];
}

/**
 * The result of resolving a system profile: deduplicated, locale-independently sorted ids.
 * Every key is always present; a kind the profile does not name resolves to `[]`.
 */
export interface SystemProfileResolution {
  agents: string[];
  contexts: string[];
  commands: string[];
  tools: string[];
  skills: string[];
  plugins: string[];
  config: string[];
}

/** Canonical system profiles: `agent-library/profiles/system/<id>.json`. */
const SYSTEM_PROFILES_DIR = "agent-library/profiles/system";

/** Canonical context profiles: `agent-library/profiles/context/<id>.json`. */
const CONTEXT_PROFILES_DIR = "agent-library/profiles/context";

/** Locale-independent ordering. `localeCompare` is locale-dependent — never use it here. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export class ProfileLoadError extends Error {
  public readonly filePath: string;
  public override readonly cause?: unknown;

  constructor(message: string, filePath: string, cause?: unknown) {
    super(message);
    this.filePath = filePath;
    this.cause = cause;
    this.name = "ProfileLoadError";
  }
}

// ============================================================================
// LOADER
// ============================================================================

/**
 * What a target cannot install. A profile is a target-neutral statement of intent ("developer
 * gets these tools and plugins"); a target that cannot load some of it resolves the remainder
 * and drops the rest ON PURPOSE, instead of failing the whole profile. Everything else still
 * fails closed.
 */
export interface ProfileOmissions {
  /** Component kinds the target cannot install at all (e.g. v2 cannot load tools or plugins). */
  kinds?: readonly ("tools" | "plugins")[];
  /** Agent ids the target does not ship (e.g. a v1-only agent on v2). */
  agents?: ReadonlySet<string>;
  /**
   * Maps an authored agent id to its canonical id (a deprecated `oac.aliases` entry to the
   * current id). Applied before `agents` filtering and resolution; the caller records the
   * deprecation.
   */
  canonicalAgent?: (id: string) => string;
}

export class ProfileLoader {
  private readonly root: string;
  private readonly resolver: ReferenceResolver;

  /**
   * @param root     - Repository root, so the loader is testable against a fixture tree.
   * @param resolver - Reference resolver to validate closures with. Defaults to one rooted at
   *                   `root`; injectable so a caller can share one index across loaders.
   */
  constructor(root: string, resolver: ReferenceResolver = new ReferenceResolver(root)) {
    this.root = root;
    this.resolver = resolver;
  }

  /** Every profile id the registry declares, sorted. */
  list(): Promise<string[]> {
    return Promise.resolve(Object.keys(this.resolver.registry().profiles).sort(compare));
  }

  /**
   * Expand a profile to its transitive closure and report what does not resolve.
   *
   * Seeds from `built-ai-configs/registry/registry.json` `.profiles.<id>.components`, then follows each component's declared `dependencies`
   * from the registry. Cycles terminate on the `seen` set.
   */
  resolveClosure(id: string): Promise<ClosureResult> {
    try {
      return Promise.resolve(this.closure(id));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private closure(id: string): ClosureResult {
    const registry = this.resolver.registry();
    const registryProfile = registry.profiles[id];
    if (!registryProfile) {
      throw new ProfileLoadError(
        `Profile not found in built-ai-configs/registry/registry.json: ${id}`,
        `built-ai-configs/registry/registry.json profiles.${id}`
      );
    }

    // `type:id` -> component, so a ref can be followed to its dependencies.
    const byRef = new Map<string, { dependencies?: string[] }>();
    for (const [category, components] of Object.entries(registry.components)) {
      // agents -> agent, contexts -> context, ...; `config` is already singular and stays put.
      const type = category.replace(/s$/, "");
      for (const component of components) byRef.set(`${type}:${component.id}`, component);
    }

    const seeds: Reference[] = (registryProfile.components ?? []).map((ref) => ({
      ref,
      source: `built-ai-configs/registry/registry.json profiles.${id}.components`,
    }));

    const seen = new Set<string>();
    const refs: Reference[] = [];
    const queue = [...seeds];

    while (queue.length > 0) {
      const reference = queue.shift()!;
      if (seen.has(reference.ref)) continue;
      seen.add(reference.ref);
      refs.push(reference);

      for (const dependency of byRef.get(reference.ref)?.dependencies ?? []) {
        queue.push({
          ref: dependency,
          source: `${reference.source} -> ${reference.ref} depends on`,
        });
      }
    }

    return {
      ids: [...seen].sort(compare),
      refs,
      missing: this.resolver.resolveMany(refs).filter((resolution) => !resolution.ok),
    };
  }

  // --------------------------------------------------------------------------
  // Canonical profiles (agent-library/profiles/**)
  // --------------------------------------------------------------------------

  /**
   * Resolve a system profile to its full component closure.
   *
   * Unlike the legacy profile sources above, canonical profiles have exactly ONE source
   * (`agent-library/profiles/**`), so there is no union to referee: a profile is sound only when
   * EVERY component it names — directly or via a context profile — resolves against the
   * registry. Any miss fails the whole profile, closed.
   *
   * Output is deduplicated and locale-independently sorted, so authored order never leaks
   * into the emitted install plan.
   */
  async resolveSystemProfile(id: string, omit: ProfileOmissions = {}): Promise<SystemProfileResolution> {
    const loaded = await this.loadProfile(SYSTEM_PROFILES_DIR, id, SystemProfileSchema, "system profile");
    const system = {
      ...loaded,
      agents: loaded.agents
        .map((agent) => omit.canonicalAgent?.(agent) ?? agent)
        .filter((agent) => !omit.agents?.has(agent)),
      ...(omit.kinds?.includes("tools") ? { tools: [] } : {}),
      ...(omit.kinds?.includes("plugins") ? { plugins: [] } : {}),
    };

    const contextIds: string[] = [];
    for (const contextProfileId of system.contextProfiles) {
      const contextProfile = await this.loadProfile(
        CONTEXT_PROFILES_DIR,
        contextProfileId,
        ContextProfileSchema,
        "context profile"
      );
      contextIds.push(...contextProfile.contexts);
    }

    // One table drives every component kind: field on the schema -> registry ref type.
    // `agents` covers subagents too — the canonical tree collapses that distinction.
    const KINDS: readonly (readonly [keyof Omit<SystemProfileResolution, "contexts">, string])[] = [
      ["agents", "agent"],
      ["commands", "command"],
      ["tools", "tool"],
      ["skills", "skill"],
      ["plugins", "plugin"],
      ["config", "config"],
    ];

    const references: Reference[] = contextIds.map((context) => ({
      ref: `context:${context}`,
      source: `${CONTEXT_PROFILES_DIR} contexts`,
    }));

    for (const [field, type] of KINDS) {
      for (const component of system[field] ?? []) {
        references.push(
          field === "agents"
            ? this.resolveAgentRef(component, `${SYSTEM_PROFILES_DIR}/${id}.json agents`)
            : {
                ref: `${type}:${component}`,
                source: `${SYSTEM_PROFILES_DIR}/${id}.json ${field}`,
              }
        );
      }
    }

    const failures = this.resolver.resolveMany(references).filter((resolution) => !resolution.ok);
    if (failures.length > 0) {
      throw new ProfileLoadError(
        `System profile "${id}" cannot be installed:\n` +
          failures.map((f) => `  ${f.ref} does not resolve: ${f.reason}`).join("\n"),
        `${SYSTEM_PROFILES_DIR}/${id}.json`
      );
    }

    return {
      agents: [...new Set(system.agents)].sort(compare),
      contexts: [...new Set(contextIds)].sort(compare),
      commands: [...new Set(system.commands ?? [])].sort(compare),
      tools: [...new Set(system.tools ?? [])].sort(compare),
      skills: [...new Set(system.skills ?? [])].sort(compare),
      plugins: [...new Set(system.plugins ?? [])].sort(compare),
      config: [...new Set(system.config ?? [])].sort(compare),
    };
  }

  /**
   * Resolve one id from the `agents` field against BOTH registry categories.
   *
   * The canonical tree collapses subagents into agents (`agent-library/agents/subagents/**` is
   * still an agent file), so an authored id may legitimately live in either legacy
   * category until the registry emitter splits them back out. Primary form is `agent:`;
   * `subagent:` is the fallback. Both failing reports the primary with the fallback noted.
   */
  private resolveAgentRef(id: string, source: string): Resolution {
    const asAgent = this.resolver.resolve(`agent:${id}`);
    if (asAgent.ok) return { ref: `agent:${id}`, source, ...asAgent };

    const asSubagent = this.resolver.resolve(`subagent:${id}`);
    if (asSubagent.ok) return { ref: `subagent:${id}`, source, ...asSubagent };

    return {
      ref: `agent:${id}`,
      source,
      ...asAgent,
      reason: `${asAgent.reason} (also tried as "subagent:${id}": ${asSubagent.reason})`,
    };
  }

  /** Load, validate and return one canonical profile JSON document. */
  private loadProfile<T>(
    dir: string,
    id: string,
    schema: z.ZodType<T>,
    kind: string
  ): Promise<T> {
    const relativePath = `${dir}/${id}.json`;
    const absolute = join(this.root, relativePath);

    if (!existsSync(absolute)) {
      throw new ProfileLoadError(`${kind} "${id}" not found: ${relativePath}`, relativePath);
    }

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(absolute, "utf-8"));
    } catch (cause) {
      throw new ProfileLoadError(`Failed to parse ${kind}: ${relativePath}`, relativePath, cause);
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ProfileLoadError(
        `Invalid ${kind} ${relativePath}:\n${parsed.error.errors
          .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
          .join("\n")}`,
        relativePath,
        parsed.error
      );
    }

    return Promise.resolve(parsed.data);
  }
}
