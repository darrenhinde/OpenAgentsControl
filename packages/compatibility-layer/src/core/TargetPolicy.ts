/**
 * TargetPolicy — which build targets an agent is emitted to. Pure.
 *
 * ## The shipping rule (one derivation, all consumers read it)
 *
 * - An agent that **omits `targets:`** ships to EVERY build target (the roster below,
 *   derived from `BuildTargetSchema`'s enum in `types.ts` — the single roster source), minus
 *   any `oac.exclude` entries. Opt-out is the default so adding host #4 costs the corpus
 *   nothing (absent a host whose agents each require authored overrides — as claude-code
 *   does); the build degrades what the new host cannot express.
 * - An agent that **declares `targets:`** ships to exactly those (plus `opencode-v1`
 *   following `opencode`), minus `exclude` — the schema already rejects `exclude` entries
 *   that narrow nothing, so a declared list is authoritative.
 * - `exclude` is a per-target literal: excluding `opencode` does not imply excluding
 *   `opencode-v1` (they are separate targets; say both if you mean both).
 * - Declaring `opencode-v1` ALONE still makes an agent v1-only, which is how an agent that
 *   depends on a v1-only tool stays off the v2 install.
 *
 * The schema's effective set (`targets minus exclude`) and the set this function answers
 * agree on every per-target question — except the `opencode-v1`-follows-`opencode` rule,
 * which only this function implements (the schema's `effective` computation cannot know
 * about the follows relation, and must not). `OacBlockSchema.superRefine` validates
 * overrides against the same `targets minus exclude` derivation.
 */

import { BuildTargetSchema } from "../types.js";

/** The build targets that exist, in the declared literal order the build iterates. */
export const BUILD_TARGETS = BuildTargetSchema.options;

export type BuildTarget = (typeof BUILD_TARGETS)[number];

/** The slice of a canonical agent this policy reads. */
export interface DeclaresTargets {
  oac: { targets: readonly string[]; exclude?: readonly string[] };
}

export function emitsTo(agent: DeclaresTargets, target: BuildTarget): boolean {
  if (agent.oac.exclude?.includes(target)) return false;
  const declared = agent.oac.targets;
  if (target === "opencode-v1") return declared.includes("opencode") || declared.includes("opencode-v1");
  return declared.includes(target);
}
