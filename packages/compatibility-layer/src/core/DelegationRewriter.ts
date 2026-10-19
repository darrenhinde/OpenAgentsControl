/**
 * DelegationRewriter — pure rewrites of STRUCTURED delegation references.
 *
 * Three kinds of reference carry an agent id in a canonical file, and each is a place where the
 * id space of the target host matters:
 *
 *   1. `permission.task` keys in the frontmatter (the allow/deny list of who may be delegated to);
 *   2. `subagent_type` values in code-example calls in the body;
 *   3. positional `task(Name, …)` arguments in the same examples.
 *
 * On OpenCode v2 the call itself also changes shape: the tool is `subagent(agent=…)` where v1
 * has `task(subagent_type=…)` (V2SRC core/src/tool/plugin/subagent.ts). The v2 path therefore
 * renames the call and the parameter as well as the value.
 *
 * Plain prose that merely mentions an agent by name ("call ContextScout first") is NOT touched:
 * it still reads correctly, and rewriting it would degrade the prompt for no behavioural gain.
 *
 * Everything here is a total function of its inputs: no I/O, no clock, no ambient state. Each
 * rewrite is idempotent, so running a build over its own output changes nothing.
 */

import { BLANK, INDENTED, isTopLevelKey } from "../adapters/opencode/surgery.js";
import { AgentIdResolutionError, isGlob, type AgentIdResolver, type IdTarget } from "./AgentIdResolver.js";

/** A value that is a template placeholder (`[agent-name]`, `${id}`), not a real reference. */
const PLACEHOLDER = /[[\]<>{}$]/;

// ============================================================================
// Frontmatter: permission.task keys
// ============================================================================

const indentOf = (line: string): number => line.length - line.trimStart().length;
const isComment = (line: string): boolean => line.trimStart().startsWith("#");
const SAFE_PLAIN_KEY = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

/** key line: indent, key (quoted or plain), then everything from the colon on. */
const KEY_LINE = /^(\s+)("[^"]*"|'[^']*'|[^\s:"'#][^:]*?)(\s*:.*)$/;

/**
 * Rewrite the keys of `permission.task` using `mapKey`, touching nothing else.
 *
 * Values, comments, quoting of unchanged keys, glob keys and every other line are returned
 * byte-for-byte, which is what lets the surrounding build stay a textual excision.
 *
 * @throws when the task map is flow-style (`task: {a: allow}`), which line surgery cannot
 * rewrite faithfully, or when two keys collapse onto one id.
 */
export function rewriteTaskKeys(
  frontmatter: readonly string[],
  mapKey: (key: string) => string,
): string[] {
  const out = [...frontmatter];
  const permission = out.findIndex((line) => isTopLevelKey(line, "permission"));
  if (permission === -1) return out;

  let end = permission + 1;
  while (end < out.length && (BLANK.test(out[end]!) || INDENTED.test(out[end]!))) end += 1;

  const first = out.slice(permission + 1, end).find((line) => !BLANK.test(line) && !isComment(line));
  if (first === undefined) return out;
  const childIndent = indentOf(first);

  let task = -1;
  for (let i = permission + 1; i < end; i += 1) {
    if (indentOf(out[i]!) === childIndent && /^\s*task\s*:/.test(out[i]!)) {
      task = i;
      break;
    }
  }
  if (task === -1) return out;

  const rest = out[task]!.replace(/^\s*task\s*:/, "").replace(/#.*$/, "").trim();
  if (rest.startsWith("{")) {
    throw new AgentIdResolutionError(
      "permission.task is a flow-style mapping; write it as a block mapping so its keys can be rewritten faithfully",
    );
  }
  if (rest !== "") return out; // scalar rule such as `task: deny`: no keys

  const seen = new Set<string>();
  for (let j = task + 1; j < end; j += 1) {
    const line = out[j]!;
    if (BLANK.test(line) || isComment(line)) continue;
    if (indentOf(line) <= childIndent) break;
    const match = KEY_LINE.exec(line);
    if (match === null) continue;

    const raw = match[2]!;
    const quote = raw.startsWith('"') || raw.startsWith("'") ? raw[0]! : "";
    const key = quote === "" ? raw : raw.slice(1, -1);
    const next = isGlob(key) ? key : mapKey(key);

    if (!isGlob(next)) {
      if (seen.has(next)) {
        throw new AgentIdResolutionError(`two permission.task keys resolve to the same agent "${next}"`);
      }
      seen.add(next);
    }
    if (next === key) continue;

    const rendered = quote !== "" ? `${quote}${next}${quote}` : SAFE_PLAIN_KEY.test(next) ? next : `"${next}"`;
    out[j] = `${match[1]}${rendered}${match[3]}`;
  }
  return out;
}

// ============================================================================
// Body: code-example delegation
// ============================================================================

function resolveValue(resolver: AgentIdResolver, target: IdTarget, value: string): string {
  return PLACEHOLDER.test(value) ? value : resolver.idFor(target, value);
}

/** Resolve an identifier if it names an agent; otherwise leave it (it may be a variable). */
function resolveLoose(resolver: AgentIdResolver, target: IdTarget, ident: string): string {
  return resolver.resolve(ident) === undefined ? ident : resolver.idFor(target, ident);
}

/**
 * Rewrite structured delegation references in a body (or any prose-bearing text).
 *
 * @param target - the host the text is being emitted for.
 */
export function rewriteBodyRefs(text: string, target: IdTarget, resolver: AgentIdResolver): string {
  const v2 = target === "opencode";

  // subagent_type="Name"  (also `:` and single quotes)
  let out = text.replace(
    /\bsubagent_type(\s*[=:]\s*)(["'])([^"'\n]*)\2/g,
    (_m, sep: string, q: string, value: string) =>
      `${v2 ? "agent" : "subagent_type"}${sep}${q}${resolveValue(resolver, target, value)}${q}`,
  );

  if (v2) {
    out = out.replace(/\bsubagent_type\b/g, "agent"); // the parameter named in prose
    out = out.replace(/(?<![\w.$])task\(/g, "subagent(");
  }

  // positional first argument: task(Name, …) / subagent(Name, …)
  const call = v2 ? "subagent" : "task";
  const positional = new RegExp(`(?<![\\w.$])(${call}\\(\\s*)([A-Za-z][\\w-]*)(\\s*,)`, "g");
  out = out.replace(positional, (_m, head: string, ident: string, tail: string) => `${head}${resolveLoose(resolver, target, ident)}${tail}`);

  return out;
}
