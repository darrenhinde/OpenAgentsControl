/**
 * Capability lint: an emitted agent must not be told to do what its host will not let it do.
 * Pure: text in, findings out.
 *
 * ─── Why this exists (L-001) ─────────────────────────────────────────────────────────────
 *
 * `104356a` regenerated the 7 Claude Code plugin agents from OpenCode-shaped source. Every file
 * still parsed, and every check passed, yet `code-reviewer` (tools: Read, Glob, Grep; Task
 * disallowed) was told "ALWAYS call ContextScout BEFORE reviewing any code" and handed a
 * `task(subagent_type="ContextScout", ...)` snippet; `coder-agent` (Bash disallowed) was given
 * `bash .opencode/skills/...` blocks; every `<example>` dispatch block vanished from the
 * descriptions; and 43 `.opencode/` paths leaked in. Schema checks cannot see any of that: the
 * defect is a mismatch between the prompt and the tool grant, so that is what this lint reads.
 *
 * ─── Rules ──────────────────────────────────────────────────────────────────────────────
 *
 * Claude Code ({@link lintClaudeAgents}), over `plugins/claude-code/agents/*.md`-shaped files:
 *
 *   delegation-without-task  error    The body tells an agent with no `Task` tool to delegate.
 *   bash-without-bash        error    The body gives shell commands to an agent with no `Bash`.
 *   description-no-example   error    `description:` has no `<example>` block. Claude Code picks
 *                                     a subagent from its description; the examples are how.
 *   opencode-path            warning  A `.opencode/` path outside {@link OPENCODE_PATH_ALLOWLIST}.
 *                                     A warning, not an error: the path may exist in a project
 *                                     that also runs OpenCode, so it is not provably impossible,
 *                                     only almost always a leak. `oac build --strict` fails on it.
 *
 * OpenCode ({@link lintOpenCodeDelegations}), v1 and v2 trees:
 *
 *   delegation-not-permitted error    The body delegates to an agent its `permission.task`
 *                                     (or v1 `tools.task: false`) denies.
 *
 * Unknown ids and v1/v2 vocabulary are already {@link ./opencode.ts}'s job; this file only adds
 * the "is it permitted" half and reuses that file's reference patterns.
 *
 * ─── Precision ──────────────────────────────────────────────────────────────────────────
 *
 * A delegation is either STRUCTURED (`task(`, `subagent(`, `subagent_type`, `agent="x"`) or an
 * IMPERATIVE naming a known agent: call/invoke/dispatch/spawn/launch <Agent>, delegate … to
 * <Agent>, use <Agent> to|for|via. A bare mention ("the main agent pre-loads ContextScout
 * results", "discoverable via ContextScout") is not a delegation. An imperative is skipped when
 * its clause is negated ("don't call …", "❌ …") or addressed to someone else ("ask the main
 * agent to call …"). Agent tokens must look like ids (kebab-case or CamelCase), so an agent
 * named `documentation` never turns the word into a reference. Imperatives inside fenced blocks
 * are ignored (fences hold output templates and illustrations), structured calls in fences are
 * not (a `task(` snippet is the instruction). Sections headed "Integration with …" / "… Main
 * Agent" describe another agent's flow and are skipped for delegation entirely.
 */

import { parseFrontmatter, splitFrontmatter } from "../../adapters/opencode/surgery.js";
import { normalizeAlias } from "../../core/AgentIdResolver.js";
import { AGENT_VALUE, SUBAGENT_TYPE, values, type LintFile, type LintFinding } from "./opencode.js";

/**
 * `.opencode/` paths a Claude agent may name: the context root and anything under it. The
 * context-discovery protocol checks `.oac` → `.claude/context` → `context` → `.opencode/context`,
 * so the last is a legitimate fallback and files under it are context-root-relative examples.
 */
export const OPENCODE_PATH_ALLOWLIST: readonly string[] = [".opencode/context"];

/** Agents named in prose across the corpus even when the linted set does not ship them. */
const ALWAYS_KNOWN_AGENTS = ["ContextScout", "ExternalScout"];

/** The Claude Code tool that delegates to a subagent, under both its names (`Agent` is newer). */
const DELEGATION_TOOLS = ["Task", "Agent"];

const SHELL_FENCE_LANGS = new Set(["bash", "sh", "shell", "zsh", "console", "terminal", "shell-session"]);

/** First words that make an inline `run \`...\`` a shell command rather than a script name. */
const SHELL_COMMANDS = new Set([
  "npm", "pnpm", "npx", "yarn", "bun", "bunx", "node", "deno", "git", "bash", "sh", "zsh", "make",
  "ls", "cat", "grep", "rg", "find", "mkdir", "cp", "mv", "rm", "touch", "chmod", "curl", "wget",
  "tsc", "jest", "vitest", "pytest", "python", "python3", "pip", "go", "cargo", "docker",
  "kubectl", "jq", "sed", "awk", "echo", "cd", "oac", "gh",
]);

const NAME = String.raw`\**@?([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)\**`;

/** Imperatives that hand work to a named agent. Group 1 is the agent token. */
const DELEGATION_PROSE: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:call|calls|calling|invoke|invokes|invoking|dispatch|dispatches|spawn|spawns|launch|launches)\s+(?:the\s+|a\s+)?${NAME}`, "gi"),
  new RegExp(String.raw`\bdelegat(?:e|es|ing)\s+(?:[\w-]+\s+){0,3}?to\s+(?:the\s+)?${NAME}`, "gi"),
  new RegExp(String.raw`\b(?:use|uses|using)\s+(?:the\s+)?${NAME}\s+(?:to|for|via)\b`, "gi"),
];

const STRUCTURED_DELEGATION = /(?<![\w.$])(?:task|subagent)\(|\bsubagent_type\b/;
const INLINE_RUN = /\b(?:run|runs|running|execute|executes|exec)\s+(?:the\s+)?(?:following\s+)?(?:command\s+)?:?\s*`([^`\n]+)`/gi;
const NEGATED = /(?:\b(?:not|never|don'?t|doesn'?t|cannot|can'?t|no|without|instead of|avoid)\b|❌)/i;
const OTHER_ACTOR = /\b(?:main agent|parent agent|primary agent|orchestrator|caller|the user)\b/i;
/** A heading (level 2+) for a section that describes ANOTHER agent's flow, not this one's. */
const OTHER_ACTOR_HEADING = /\bintegration\b|\bmain agent\b|\bwith (?:the )?orchestrator\b/i;
const OPENCODE_PATH = /(?<![\w.-])\.opencode\/([^\s`'"()[\]<>{},;|*]*)/g;

interface Parsed {
  file: LintFile;
  data: Record<string, unknown>;
  /** Body lines, starting with the closing `---`. */
  body: string[];
  /** 1-based file line of `body[0]`. */
  bodyStart: number;
}

function parse(file: LintFile, findings: LintFinding[]): Parsed | undefined {
  try {
    const { frontmatter, rest } = splitFrontmatter(file.text);
    return { file, data: parseFrontmatter(frontmatter), body: rest.split("\n"), bodyStart: frontmatter.length + 2 };
  } catch (cause) {
    findings.push({ path: file.path, rule: "frontmatter-invalid", message: cause instanceof Error ? cause.message : String(cause) });
    return undefined;
  }
}

/** The clause a match sits in: text since the last sentence break before it. */
function clauseBefore(line: string, index: number): string {
  return line.slice(0, index).split(/[.!?;]\s+|\s[—–]\s|→/).pop() ?? "";
}

function looksLikeId(token: string): boolean {
  return token.includes("-") || /[a-z0-9][A-Z]/.test(token);
}

/** Lines inside fenced code blocks, and the shell fences (line index + lang) among them. */
function fences(lines: readonly string[]): { inside: Set<number>; shell: { index: number; lang: string }[] } {
  const inside = new Set<number>();
  const shell: { index: number; lang: string }[] = [];
  let open: string | undefined;
  lines.forEach((line, index) => {
    const m = /^\s*(`{3,}|~{3,})\s*([\w+-]*)/.exec(line);
    if (open === undefined) {
      if (m === null) return;
      open = m[1]![0]!;
      inside.add(index);
      const lang = m[2]!.toLowerCase();
      if (SHELL_FENCE_LANGS.has(lang)) shell.push({ index, lang });
      return;
    }
    inside.add(index);
    if (m !== null && m[1]![0] === open && m[2] === "") open = undefined;
  });
  return { inside, shell };
}

/**
 * Lines in sections whose heading says they describe someone else ("Integration with
 * Orchestrator", "Integration with Main Agent"), or in the block under a bold lead-in naming
 * another actor ("**Orchestrator Response**:"): the steps there are the other agent's, so a
 * delegation in them is not an instruction to this one. Headings inside fences do not count.
 */
function otherActorSections(lines: readonly string[], inside: ReadonlySet<number>): Set<number> {
  const skipped = new Set<number>();
  let level: number | undefined;
  let label = false;
  lines.forEach((line, index) => {
    const heading = inside.has(index) ? null : /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      label = false;
      const depth = heading[1]!.length;
      if (level !== undefined && depth <= level) level = undefined;
      if (level === undefined && depth >= 2 && OTHER_ACTOR_HEADING.test(heading[2]!)) level = depth;
    }
    // A bold lead-in ("**Orchestrator Response**:") scopes the block right under it.
    if (!inside.has(index)) {
      const lead = /^\s*\*\*([^*]+)\*\*:?\s*$/.exec(line);
      if (lead !== null) label = OTHER_ACTOR.test(lead[1]!);
      else if (line.trim() === "") label = false;
    }
    if (level !== undefined || label) skipped.add(index);
  });
  return skipped;
}

/**
 * Every line that delegates, as `[line index, refs]`: structured calls anywhere (a `task(` snippet
 * in a fence is still an instruction), imperatives outside fences only (a fenced block is a
 * template or an illustration), nothing in another actor's section. `structured` is `[]` for a
 * line with a structured call whose target is not captured.
 */
function delegatingLines(
  lines: readonly string[],
  aliases: ReadonlyMap<string, string>,
  structured: (line: string) => string[] | undefined,
): [number, string[], boolean][] {
  const { inside } = fences(lines);
  const skipped = otherActorSections(lines, inside);
  const out: [number, string[], boolean][] = [];
  lines.forEach((line, index) => {
    if (skipped.has(index)) return;
    const calls = structured(line);
    const prose = inside.has(index) ? [] : delegationsIn(line, aliases);
    if (calls !== undefined || prose.length > 0) out.push([index, [...new Set([...(calls ?? []), ...prose])], calls !== undefined]);
  });
  return out;
}

/**
 * The agents a line's imperatives delegate to. `aliases` maps {@link normalizeAlias} forms to
 * the reference as the host spells it.
 */
function delegationsIn(line: string, aliases: ReadonlyMap<string, string>): string[] {
  const refs: string[] = [];
  for (const re of DELEGATION_PROSE) {
    for (const m of line.matchAll(re)) {
      const token = m[1]!;
      const ref = aliases.get(normalizeAlias(token));
      if (ref === undefined || !looksLikeId(token)) continue;
      const clause = clauseBefore(line, m.index);
      if (NEGATED.test(clause) || OTHER_ACTOR.test(clause)) continue;
      refs.push(ref);
    }
  }
  return refs;
}

function aliasTable(names: Iterable<string>): Map<string, string> {
  const table = new Map<string, string>();
  for (const name of names) if (!table.has(normalizeAlias(name))) table.set(normalizeAlias(name), name);
  return table;
}

// ============================================================================
// Claude Code
// ============================================================================

function toolList(value: unknown): string[] | undefined {
  const raw = typeof value === "string" ? value.split(",") : Array.isArray(value) ? value.map(String) : undefined;
  return raw?.map((t) => t.trim().replace(/\(.*$/, "")).filter((t) => t !== "");
}

/**
 * Claude Code: no `tools:` inherits every tool; `disallowedTools:` always subtracts. `names` are
 * aliases of one tool (Task/Agent): granted under any, denied under any.
 */
function grants(data: Record<string, unknown>, ...names: string[]): boolean {
  const tools = toolList(data["tools"]);
  const denied = toolList(data["disallowedTools"]) ?? [];
  return (tools === undefined || names.some((n) => tools.includes(n))) && !names.some((n) => denied.includes(n));
}

export interface ClaudeLintOptions {
  /** Extra agent names the body may reference (the linted files' `name:`s are always known). */
  agentNames?: readonly string[];
}

/** Lint emitted Claude Code agent files against their own tool grants. */
export function lintClaudeAgents(files: readonly LintFile[], options: ClaudeLintOptions = {}): LintFinding[] {
  const findings: LintFinding[] = [];
  const parsed = files.map((file) => parse(file, findings)).filter((p): p is Parsed => p !== undefined);
  const names = parsed.map((p) => p.data["name"]).filter((n): n is string => typeof n === "string");
  const aliases = aliasTable([...ALWAYS_KNOWN_AGENTS, ...names, ...(options.agentNames ?? [])]);

  for (const p of parsed) {
    const { path } = p.file;
    const at = (index: number): string => `line ${p.bodyStart + index}`;
    const canDelegate = grants(p.data, ...DELEGATION_TOOLS);
    const canShell = grants(p.data, "Bash");
    const { inside, shell } = fences(p.body);

    if (!canDelegate) {
      const structured = (line: string): string[] | undefined => (STRUCTURED_DELEGATION.test(line) ? [] : undefined);
      for (const [index, refs, isCall] of delegatingLines(p.body, aliases, structured)) {
        const what = isCall ? `delegation call: ${p.body[index]!.trim().slice(0, 100)}` : `told to delegate to ${refs.join(", ")}`;
        findings.push({ path, rule: "delegation-without-task", message: `${at(index)}: ${what}, but the agent has no Task tool` });
      }
    }

    if (!canShell) {
      for (const { index, lang } of shell) {
        findings.push({ path, rule: "bash-without-bash", message: `${at(index)}: \`\`\`${lang} block, but the agent has no Bash tool` });
      }
      p.body.forEach((line, index) => {
        if (inside.has(index)) return;
        for (const m of line.matchAll(INLINE_RUN)) {
          const command = m[1]!.trim().replace(/^\$\s*/, "").replace(/^(?:\w+=\S*\s+)+/, "");
          if (!SHELL_COMMANDS.has(command.split(/\s+/)[0] ?? "")) continue;
          if (NEGATED.test(clauseBefore(line, m.index))) continue;
          findings.push({ path, rule: "bash-without-bash", message: `${at(index)}: told to run \`${command}\`, but the agent has no Bash tool` });
        }
      });
    }

    const description = p.data["description"];
    if (typeof description !== "string" || !description.includes("<example>")) {
      findings.push({ path, rule: "description-no-example", message: "description has no <example> block; Claude Code selects a subagent from its description examples" });
    }

    const leaked = new Map<string, { count: number; first: string }>();
    const scan = (text: string, where: string): void => {
      for (const m of text.matchAll(OPENCODE_PATH)) {
        const full = `.opencode/${m[1]!.replace(/[.:]+$/, "")}`.replace(/\/$/, "");
        if (OPENCODE_PATH_ALLOWLIST.some((ok) => full === ok || full.startsWith(`${ok}/`))) continue;
        const seen = leaked.get(full);
        if (seen) seen.count++;
        else leaked.set(full, { count: 1, first: where });
      }
    };
    if (typeof description === "string") scan(description, "description");
    p.body.forEach((line, index) => scan(line, at(index)));
    for (const [leak, { count, first }] of leaked) {
      findings.push({ path, rule: "opencode-path", severity: "warning", message: `${first}: OpenCode path ${leak}${count > 1 ? ` (${count}x)` : ""} in a Claude Code agent` });
    }
  }
  return findings;
}

// ============================================================================
// OpenCode
// ============================================================================

export type OpenCodeFlavor = "v1" | "v2";

function wildcard(pattern: string, value: string): boolean {
  const re = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${re}$`).test(value);
}

/**
 * OpenCode's effective `task` action for delegating to `ref`: the LAST matching rule wins; no
 * matching rule is not a deny (v1 offers every agent whose evaluation is not `deny`).
 */
export function taskAction(data: Record<string, unknown>, ref: string): string {
  const tools = data["tools"];
  if (typeof tools === "object" && tools !== null && (tools as Record<string, unknown>)["task"] === false) return "deny";
  const permission = data["permission"];
  if (typeof permission === "string") return permission;
  if (typeof permission !== "object" || permission === null) return "allow";
  const task = (permission as Record<string, unknown>)["task"];
  if (typeof task === "string") return task;
  if (typeof task !== "object" || task === null) return "allow";
  let action = "ask";
  for (const [pattern, value] of Object.entries(task as Record<string, unknown>)) {
    if (typeof value === "string" && wildcard(pattern, ref)) action = value;
  }
  return action;
}

/** Lint an emitted OpenCode tree: every delegation in a body must be permitted by `permission.task`. */
export function lintOpenCodeDelegations(files: readonly LintFile[], flavor: OpenCodeFlavor): LintFinding[] {
  const findings: LintFinding[] = [];
  const parsed = files.map((file) => parse(file, findings)).filter((p): p is Parsed => p !== undefined);
  const idOf = (p: Parsed): string | undefined =>
    flavor === "v1"
      ? (typeof p.data["name"] === "string" ? p.data["name"] : undefined)
      : p.file.path.replace(/^.*\/agents?\//, "").replace(/\.md$/, "");
  const ids = parsed.map(idOf).filter((id): id is string => id !== undefined);
  const aliases = aliasTable(ids);
  const pattern = flavor === "v1" ? SUBAGENT_TYPE : AGENT_VALUE;
  const structured = (line: string): string[] | undefined => {
    const refs = values(pattern, line);
    return refs.length > 0 ? refs : undefined;
  };

  for (const p of parsed) {
    const { path } = p.file;
    const self = idOf(p);
    const checked = new Set<string>();
    for (const [index, refs] of delegatingLines(p.body, aliases, structured)) {
      for (const ref of refs) {
        if (ref === self || checked.has(ref)) continue;
        checked.add(ref);
        if (taskAction(p.data, ref) === "deny") {
          findings.push({ path, rule: "delegation-not-permitted", message: `line ${p.bodyStart + index}: delegates to "${ref}", which permission.task denies` });
        }
      }
    }
  }
  return findings;
}
