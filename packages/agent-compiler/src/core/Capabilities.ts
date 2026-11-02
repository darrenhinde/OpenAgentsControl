/**
 * Capabilities — the shipped permission resolver.
 *
 * Ordered rules, LAST-MATCH-WINS, and the fail-closed projection onto targets that have no
 * scoped-permission concept.
 *
 * ## Why this module exists
 *
 * `types.ts` guarantees that authored order survives parsing; it deliberately stops there.
 * Order-preservation without a last-match-wins resolver is not a security property: a
 * faithful `[allow *, deny rm*]` list plus a first-match resolver answers "rm -rf / →
 * allow". This module is the resolver that makes the preserved order mean something.
 *
 * ## Semantics are copied from OpenCode, not invented here
 *
 * Verified live against OpenCode 1.17.20 —
 * `docs/architecture/canonical-refactor/10-PRECEDENCE-EXPERIMENT.md` — and cross-read against
 * that release's own resolver (`packages/opencode/src/permission/index.ts`,
 * `packages/core/src/util/wildcard.ts` @ tag v1.17.20):
 *
 * ```ts
 * rulesets.flat().findLast((rule) =>
 *   Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern))
 * ```
 *
 * Three consequences this module mirrors exactly:
 * 1. **Capability entries flatten before resolution**, so a `"*"` capability competes
 *    positionally with specific ones and can be overridden by a later entry.
 * 2. **`findLast`** — the last matching rule wins, with no specificity ranking anywhere.
 * 3. **The scope matcher is a regex-derived wildcard, not a path glob** (see
 *    {@link matchScope}): `*` crosses `/` and spaces, which is what makes real corpus rules
 *    like `"npx ts-node*stage-cli*"` and `"bash .opencode/skill/…/router.sh*"` match.
 *
 * ## What this module does NOT do
 *
 * "No rule matched" is reported as `undefined`, never guessed. OpenCode's own terminal
 * fallback is `ask`, but in a live install a global baseline rule
 * (`{permission:"*", pattern:"*", action:"allow"}`) precedes every agent rule — observed
 * verbatim in probe 1 — so an unmatched request resolves `allow` via that baseline rather
 * than via the fallback. Hardcoding either answer here would be a fabricated default; the
 * caller supplies the target's own default, or consults {@link implicitDefault}.
 */

import type { GranularPermission, PermissionAction, PermissionRuleEntry } from "../types.js";

// ============================================================================
// Types
// ============================================================================

/** One rule with its capability attached — the shape OpenCode resolves over. */
export interface FlatPermissionRule {
  capability: string;
  pattern: string;
  action: PermissionAction;
}

/**
 * The terminal default for a capability whose rules do not cover a request (02 §1.2.5,
 * ratified). Deliberately data, not an exception: this module owns the *rule*, while raising
 * on `ambiguous` is the parser's call at parse time.
 */
export type ImplicitDefault =
  | { kind: "unconstrained" }
  | { kind: "total" }
  | { kind: "default"; action: Extract<PermissionAction, "allow" | "deny"> }
  | { kind: "ambiguous"; reason: string };

/** A capability collapsed to the single on/off grant a flat-list target can carry. */
export interface BinaryProjection {
  allowed: boolean;
  warnings: string[];
}

/** Binds a target's tool name to the canonical capability that governs it. */
export interface ToolBinding {
  tool: string;
  capability: string;
}

/** A canonical permission spec projected onto flat `tools` / `disallowedTools` lists. */
export interface FlatToolProjection {
  tools: string[];
  disallowedTools: string[];
  warnings: string[];
}

/** Options shared by the degradation projections. */
export interface DegradationOptions {
  /** Target name used in warning text. */
  target?: string;
}

// ============================================================================
// Scope matching
// ============================================================================

/** Exactly the metacharacter set OpenCode's `Wildcard.match` escapes — `*`/`?` excluded. */
const REGEX_METACHARACTERS = /[.+^${}()|[\]\\]/g;

/** Patterns provably total. Conservative on purpose: a false negative only fails closed. */
const TOTAL_PATTERN = /^\*+$/;

/**
 * Match a concrete candidate against one authored scope pattern.
 *
 * A line-by-line mirror of OpenCode 1.17.20's `Wildcard.match(str, pattern)`, including its
 * quirks, because a matcher that disagrees with the runtime silently mis-reports what a
 * shipped agent can do:
 * - `*` → `.*` and `?` → `.`, so wildcards cross `/` and spaces (it is NOT a path glob).
 * - a pattern ending in `" *"` makes the trailing argument optional, so `"sudo *"` matches
 *   both `sudo apt install` and a bare `sudo`.
 * - backslashes normalize to `/` on both sides.
 *
 * **Deliberate deviation:** upstream adds the `i` flag on win32. This build is a file
 * generator whose output must not depend on the host OS (12-DISPATCH determinism rule), so
 * matching is always case-sensitive. The divergence is confined to Windows authors relying
 * on case-insensitive scope matching; it makes a rule match *less* often here than at
 * runtime, which is reported as a degradation rather than assumed away.
 *
 * @param candidate concrete request (a command line, a path, an agent id)
 * @param pattern authored scope pattern
 */
export function matchScope(candidate: string, pattern: string): boolean {
  const subject = candidate.replaceAll("\\", "/");
  let escaped = pattern
    .replaceAll("\\", "/")
    .replace(REGEX_METACHARACTERS, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");

  if (escaped.endsWith(" .*")) {
    escaped = `${escaped.slice(0, -3)}( .*)?`;
  }

  return new RegExp(`^${escaped}$`, "s").test(subject);
}

/** True when `pattern` matches every candidate, making a rule list terminal. */
export function isTotalPattern(pattern: string): boolean {
  return TOTAL_PATTERN.test(pattern);
}

// ============================================================================
// Resolution — last-match-wins
// ============================================================================

/**
 * Flatten capability entries into one ordered rule list, preserving authored order.
 *
 * This mirrors OpenCode's `fromConfig` + `rulesets.flat()`: capability order is semantic, so
 * flattening must never sort, group or dedupe.
 */
export function flattenPermissions(permissions: GranularPermission): FlatPermissionRule[] {
  return permissions.flatMap((entry) =>
    entry.rules.map((rule) => ({
      capability: entry.capability,
      pattern: rule.pattern,
      action: rule.action,
    }))
  );
}

/**
 * Every rule that governs `capability`, in authored order.
 *
 * The capability side is wildcard-matched (as upstream does), so a `"*"` capability entry is
 * included in — and ordered against — a specific capability's own rules.
 */
export function rulesFor(
  permissions: GranularPermission,
  capability: string
): FlatPermissionRule[] {
  return flattenPermissions(permissions).filter((rule) =>
    matchScope(capability, rule.capability)
  );
}

/**
 * Resolve a concrete request against an ordered permission spec — **last match wins**.
 *
 * @returns the winning action, or `undefined` when no rule matched at all. `undefined` means
 * "the author said nothing about this"; the caller applies the target's default or
 * {@link implicitDefault}. It never means `allow`.
 *
 * @example
 * // deny-all-then-allowlist, the shape the shipped agents rely on
 * resolvePermission(perms, "bash", "git status");   // => "allow"  (later rule wins)
 * resolvePermission(perms, "bash", "curl evil.sh"); // => "deny"   (only "*" matches)
 */
export function resolvePermission(
  permissions: GranularPermission,
  capability: string,
  candidate: string
): PermissionAction | undefined {
  return flattenPermissions(permissions).findLast(
    (rule) => matchScope(capability, rule.capability) && matchScope(candidate, rule.pattern)
  )?.action;
}

/**
 * The implicit terminal default for one capability's rules (02 §1.2.5, ratified).
 *
 * The rule in one line: **no total rule present → the opposite of the decisions present;
 * mixed decisions without a total rule are ambiguous.**
 *
 * - all `deny` → implicit `allow` (a restriction list over an otherwise-permitted tool —
 *   this is what makes `coder-agent.edit`'s five secret-globs behave as OpenCode does live)
 * - all `allow` → implicit `deny` (an allowlist; anything unlisted is out)
 * - mixed, or any `ask` → `ambiguous`: `ask` has no defensible opposite and a mixed list has
 *   no recoverable terminal intent. Guessing here is how the live security gap happened, so
 *   the answer is "the author must add an explicit `*` rule", not a guess.
 */
export function implicitDefault(rules: readonly PermissionRuleEntry[]): ImplicitDefault {
  if (rules.length === 0) return { kind: "unconstrained" };
  if (rules.some((rule) => isTotalPattern(rule.pattern))) return { kind: "total" };

  const actions = new Set(rules.map((rule) => rule.action));

  if (actions.size === 1) {
    if (actions.has("deny")) return { kind: "default", action: "allow" };
    if (actions.has("allow")) return { kind: "default", action: "deny" };
  }

  return {
    kind: "ambiguous",
    reason:
      `rules use ${[...actions].sort().join(" + ")} with no "*" rule, so the intended ` +
      `default for unmatched requests is unrecoverable — add an explicit { "*": … } rule`,
  };
}

// ============================================================================
// Degradation — ordered rules onto targets with no scoping
// ============================================================================

/**
 * Is this rule list exactly equivalent to one blanket decision?
 *
 * Only when every rule carries the same action AND some rule is total. Anything else — an
 * allowlist under a catch-all deny, an allow-all with exceptions, a bare restriction list
 * whose implicit default is the opposite of its rules — has at least two possible outcomes
 * and therefore no flat-list equivalent.
 */
function uniformAction(rules: readonly FlatPermissionRule[]): PermissionAction | undefined {
  const actions = new Set(rules.map((rule) => rule.action));
  if (actions.size !== 1) return undefined;
  if (!rules.some((rule) => isTotalPattern(rule.pattern))) return undefined;
  return rules[0]?.action;
}

/** Render rules compactly for a warning, so the user sees what could not be carried. */
function describe(rules: readonly FlatPermissionRule[]): string {
  return rules.map((rule) => `"${rule.pattern}": ${rule.action}`).join(", ");
}

/**
 * Collapse one capability's ordered rules to the single grant a flat-list target can carry.
 *
 * **Fails closed by construction.** The projection is `allowed: true` only when the rules are
 * *provably* a blanket allow. Every other shape — including "there is an allow rule in here
 * somewhere" — projects to `allowed: false` plus a warning. Consequences that fall out:
 *
 * - a rule set containing any `deny` can never yield an allowed tool: it is either a uniform
 *   deny (denied) or mixed (denied, warned);
 * - `ask` degrades to `deny`, never `allow`, on targets with no ask concept, and warns;
 * - the live security gap (a deny-all-then-allowlist `bash`, or `edit` guarded by secret
 *   globs) surfaces as a loud refusal instead of an unrestricted tool.
 *
 * A capability with no rules is `allowed: true` with no warning: that is not a widening but
 * the ratified "absent capability → the tool's own default" rule (02 §1.2.5 case 1),
 * confirmed live — `openagent` declares no `write` key and OpenCode permits write.
 *
 * @returns `allowed` plus a warning for every semantic actually lost. A provably exact
 * projection loses nothing and is silent — warnings mean loss, so they must not become noise.
 */
export function degradeToBinary(
  permissions: GranularPermission,
  capability: string,
  options: DegradationOptions = {}
): BinaryProjection {
  const target = options.target ?? "this target";
  const rules = rulesFor(permissions, capability);

  if (rules.length === 0) return { allowed: true, warnings: [] };

  const uniform = uniformAction(rules);

  if (uniform === "allow") return { allowed: true, warnings: [] };
  if (uniform === "deny") return { allowed: false, warnings: [] };

  if (uniform === "ask") {
    return {
      allowed: false,
      warnings: [
        `⚠️  Permission '${capability}: ask' degraded to 'deny' for ${target}: ` +
          `${target} has no 'ask' concept, and 'allow' would grant unprompted what the ` +
          `author wanted confirmed.`,
      ],
    };
  }

  const warnings = [
    `⚠️  Permission '${capability}' has no equivalent on ${target}: ` +
      `${rules.length} ordered rule(s) [${describe(rules)}] resolve differently per request, ` +
      `but ${target} carries one flat on/off decision. Projected to 'deny' (fail-closed) — ` +
      `granting '${capability}' would hand ${target} the tool with none of the scoping.`,
  ];

  if (rules.some((rule) => rule.action === "ask")) {
    warnings.push(
      `⚠️  Permission '${capability}' contains 'ask' rule(s), which ${target} cannot express.`
    );
  }

  const fallback = implicitDefault(rules);
  if (fallback.kind === "ambiguous") {
    warnings.push(`⚠️  Permission '${capability}' is ambiguous: ${fallback.reason}.`);
  }

  return { allowed: false, warnings };
}

/**
 * Project a canonical permission spec onto a target's flat `tools` / `disallowedTools` lists.
 *
 * Every bound tool lands in exactly one list — never omitted from both, because "absent"
 * reads as "target default" to the target and would hand back the ambiguity this projection
 * exists to remove. Deterministic: output follows `bindings` order and nothing is sorted.
 *
 * @param bindings the target's tool names paired with the capability governing each. Supplied
 * by the adapter, which owns tool naming; this module owns only the allow/deny decision.
 */
export function projectToFlatTools(
  permissions: GranularPermission,
  bindings: readonly ToolBinding[],
  options: DegradationOptions = {}
): FlatToolProjection {
  const projection: FlatToolProjection = { tools: [], disallowedTools: [], warnings: [] };

  for (const binding of bindings) {
    const { allowed, warnings } = degradeToBinary(permissions, binding.capability, options);
    (allowed ? projection.tools : projection.disallowedTools).push(binding.tool);
    projection.warnings.push(...warnings);
  }

  return projection;
}
