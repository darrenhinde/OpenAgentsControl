/**
 * AgentIdResolver — one alias table, two id spaces.
 *
 * ─── Why it exists ──────────────────────────────────────────────────────────────────────
 *
 * OpenCode v1 registers an agent under its frontmatter `name:` (config.ts:337-343) and v2 under
 * its file name (V2SRC core/src/config/plugin/agent.ts L180-211), which this build makes the
 * agent's `oac.id`. A delegation reference — a `task:` permission key, a `subagent_type` value —
 * must therefore be spelled in the id space of the TARGET it is emitted for, and the canonical
 * source cannot be written in both at once.
 *
 * So references in the source are written in any ACCEPTED spelling (the `oac.id`, the display
 * name, or a case/punctuation variant) and this class resolves each to the right id for the
 * target. It is pure: it is built from the loaded agents and holds no I/O.
 *
 * ─── Fail closed ────────────────────────────────────────────────────────────────────────
 *
 * A reference that names no agent is an error, never a pass-through: a `task:` key that matches
 * nothing is a rule that silently never fires (this is how 31 of 33 keys came to match no
 * v1 agent). Two agents that normalise to the same alias are also an error, since resolution
 * would then depend on iteration order.
 */

import type { CanonicalAgentFile } from "./AgentLoader.js";

/** The id space a reference is being resolved into. */
export type IdTarget = "opencode" | "opencode-v1";

/** What the resolver needs to know about one agent. */
export interface ResolverAgent {
  /** `oac.id` — the v2 id (the emitted file name). */
  id: string;
  /** `oac.name`. */
  oacName: string;
  /** Frontmatter `name:` — the v1 id. */
  name: string;
}

export class AgentIdResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentIdResolutionError";
  }
}

/** Lowercase, alphanumerics only: `Context Retriever`, `context-retriever` and `ContextRetriever` agree. */
export function normalizeAlias(ref: string): string {
  return ref.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True for a permission key that is a pattern rather than a name. */
export function isGlob(ref: string): boolean {
  return ref.includes("*") || ref.includes("?");
}

export class AgentIdResolver {
  private constructor(
    private readonly byExact: ReadonlyMap<string, ResolverAgent>,
    private readonly byNormalized: ReadonlyMap<string, ResolverAgent>,
  ) {}

  /** Build from explicit agents. Throws {@link AgentIdResolutionError} on any ambiguity. */
  static from(agents: readonly ResolverAgent[]): AgentIdResolver {
    const byExact = new Map<string, ResolverAgent>();
    const byNormalized = new Map<string, ResolverAgent>();
    const ids = new Set<string>();

    for (const agent of agents) {
      if (ids.has(agent.id)) {
        throw new AgentIdResolutionError(`duplicate agent id "${agent.id}"`);
      }
      ids.add(agent.id);

      for (const alias of new Set([agent.id, agent.oacName, agent.name])) {
        const exactOwner = byExact.get(alias);
        if (exactOwner !== undefined && exactOwner !== agent) {
          throw new AgentIdResolutionError(
            `alias "${alias}" is ambiguous: it names both "${exactOwner.id}" and "${agent.id}"`,
          );
        }
        byExact.set(alias, agent);

        const key = normalizeAlias(alias);
        const owner = byNormalized.get(key);
        if (owner !== undefined && owner !== agent) {
          throw new AgentIdResolutionError(
            `alias "${alias}" collides after normalisation (${key}): it could mean "${owner.id}" or "${agent.id}"`,
          );
        }
        byNormalized.set(key, agent);
      }
    }
    return new AgentIdResolver(byExact, byNormalized);
  }

  /** Build from the canonical corpus as the loader returns it. */
  static fromCanonical(files: readonly CanonicalAgentFile[]): AgentIdResolver {
    return AgentIdResolver.from(
      files.map((file) => ({
        id: file.oac.id,
        oacName: file.oac.name,
        // `frontmatter.name` is optional since v2 files name agents by their file; the
        // `oac:` block's name is always present and is the authored display name.
        name: file.frontmatter.name ?? file.oac.name,
      })),
    );
  }

  /** The agent a reference names, trying the exact spelling before the normalised one. */
  resolve(ref: string): ResolverAgent | undefined {
    return this.byExact.get(ref) ?? this.byNormalized.get(normalizeAlias(ref));
  }

  /**
   * The id to write for `ref` on `target`. Globs pass through. Throws when `ref` names no agent.
   */
  idFor(target: IdTarget, ref: string): string {
    if (isGlob(ref)) return ref;
    const agent = this.resolve(ref);
    if (agent === undefined) {
      throw new AgentIdResolutionError(`"${ref}" names no canonical agent (accepted: an oac.id or display name)`);
    }
    return target === "opencode" ? agent.id : agent.name;
  }
}
