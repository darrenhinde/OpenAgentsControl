/**
 * Lints for the context library (`agent-library/context/**`). REPORT-ONLY, like the naming lint:
 * `oac build` prints them after the summary, they are not counted, and they never change the exit
 * code. They exist so a move or a deletion that strands a reference shows up in the build that
 * causes it.
 *
 *  - `dead-link`: a Markdown link, or a literal `.opencode/context/<path>` mention, in a context file
 *    whose target is not in the library;
 *  - `navigation-dead-entry`: the same, in a `navigation.md` (a navigation file that lists a file
 *    that is not there misleads ContextScout, so it is reported separately and first);
 *  - `unreachable`: a Markdown file that no chain of references from the root `navigation.md` or
 *    `index.md` reaches (ContextScout finds context by walking navigation, so it never finds it);
 *  - `unregistered` (info): a Markdown file with no `components.json` entry. It still ships through
 *    `oac init --profile full`, but `install.sh` profiles install registry entries only.
 *
 * Targets that are placeholders in documentation (`{category}/{file}.md`, `*`, a `<name>`) are not
 * checked, nor are the literal example paths in {@link PLACEHOLDER_TARGETS}.
 */

import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { CONTEXT_OUTPUT_ROOT, type ContextLibrary } from "../../core/ContextLoader.js";

export type ContextRule = "dead-link" | "navigation-dead-entry" | "unreachable" | "unregistered";

export interface ContextFinding {
  /** Path inside the library. */
  path: string;
  rule: ContextRule;
  level: "warn" | "info";
  message: string;
}

/** Example paths the docs use on purpose; same intent as `scripts/validation/markdown-link-skip-patterns.txt`. */
export const PLACEHOLDER_TARGETS: readonly string[] = [
  "file.md",
  "security/auth-patterns.md",
  "architecture/ddd-patterns.md",
  "architecture/patterns.md",
  "core/story-mapping/guide.md",
  "core/prioritization/scoring.md",
  "core/standards/naming-conventions.md",
  "development/backend/auth/jwt-patterns.md",
];

const ROOT_FILES: readonly string[] = ["navigation.md", "index.md"];

const MD_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const PATH_MENTION = /@?\.opencode\/context\/([A-Za-z0-9_./-]+\.(?:md|json))/g;
/** A navigation file names its children in backticks: `core/standards/code-quality.md`. */
const BACKTICK_PATH = /`([A-Za-z0-9_./-]+\.md)`/g;

/** The part of a raw target we can resolve, or `null` when it is external, a placeholder or not a context file. */
function cleanTarget(raw: string): string | null {
  let target = raw.trim().replace(/^<|>$/g, "").replace(/^@/, "");
  target = target.split("#")[0]!.split("?")[0]!;
  if (target === "" || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/") || target.startsWith("~")) return null;
  if (/[{}*<>$[\]|\s]/.test(target)) return null;
  if (!/\.(md|json)$/.test(target)) return null;
  return target;
}

/** The library path a reference from `from` resolves to, or `null` when it points outside the library. */
function resolveInLibrary(from: string, target: string): string | null {
  if (target.startsWith(`${CONTEXT_OUTPUT_ROOT}/`)) return normalize(target.slice(CONTEXT_OUTPUT_ROOT.length + 1));
  if (target.startsWith(".opencode/") || target.startsWith(".claude/")) return null;
  const resolved = normalize(join(dirname(from), target));
  return resolved.startsWith("..") ? null : resolved;
}

interface Reference {
  from: string;
  target: string;
  raw: string;
}

/**
 * The library paths a navigation entry can mean. Navigation files write either a path relative to
 * the context root (`core/standards/code-quality.md`) or one relative to themselves
 * (`standards/code-quality.md`, `lookup/foo.md`), so a name is dead only when neither reads.
 */
function navigationCandidates(from: string, name: string): string[] {
  if (name.startsWith(`${CONTEXT_OUTPUT_ROOT}/`)) return [normalize(name.slice(CONTEXT_OUTPUT_ROOT.length + 1))];
  const local = normalize(join(dirname(from), name));
  const root = normalize(name);
  return [local, root].filter((candidate) => !candidate.startsWith(".."));
}

function referencesIn(from: string, text: string): Reference[] {
  const out: Reference[] = [];
  for (const match of text.matchAll(MD_LINK)) {
    const target = cleanTarget(match[1]!);
    if (target === null) continue;
    const resolved = resolveInLibrary(from, target);
    if (resolved !== null) out.push({ from, target: resolved, raw: match[1]! });
  }
  for (const match of text.matchAll(PATH_MENTION)) {
    const resolved = normalize(match[1]!);
    out.push({ from, target: resolved, raw: match[0] });
  }
  return out;
}

/** Backticked `.md` names in a navigation file, with every library path each could mean. */
function navigationEntries(from: string, text: string): Array<{ raw: string; candidates: string[] }> {
  const out: Array<{ raw: string; candidates: string[] }> = [];
  for (const match of text.matchAll(BACKTICK_PATH)) {
    const raw = match[1]!;
    // Paths into the rest of the repository (agents, docs) are not this library's to check.
    if (/[{}*<>$]/.test(raw) || /^(\.opencode\/(?!context\/)|\.claude\/|docs\/|~|\/)/.test(raw)) continue;
    out.push({ raw, candidates: navigationCandidates(from, raw) });
  }
  return out;
}

/** Run the context lints over a loaded library. Reads each Markdown file once. */
export function lintContext(library: ContextLibrary): ContextFinding[] {
  const known = new Set(library.files.map((file) => file.relativePath));
  const registered = new Set(library.components.map((component) => component.file));
  const regular = library.files.filter((file) => file.linkTarget === undefined && file.relativePath.endsWith(".md"));
  const findings: ContextFinding[] = [];
  const edges = new Map<string, Set<string>>();

  for (const file of regular) {
    const text = readFileSync(file.filePath, "utf-8");
    const isNavigation = file.relativePath === "navigation.md" || file.relativePath.endsWith("/navigation.md");
    const seen = new Set<string>();
    if (isNavigation) {
      for (const { raw, candidates } of navigationEntries(file.relativePath, text)) {
        const hit = candidates.find((candidate) => known.has(candidate));
        if (hit !== undefined) {
          edges.set(file.relativePath, (edges.get(file.relativePath) ?? new Set()).add(hit));
        } else if (!candidates.some((candidate) => PLACEHOLDER_TARGETS.includes(candidate)) && !seen.has(raw)) {
          seen.add(raw);
          findings.push({ path: file.relativePath, rule: "navigation-dead-entry", level: "warn", message: `\`${raw}\` is not in agent-library/context/` });
        }
      }
    }
    for (const ref of referencesIn(file.relativePath, text)) {
      if (PLACEHOLDER_TARGETS.includes(ref.target)) continue;
      if (known.has(ref.target)) {
        edges.set(file.relativePath, (edges.get(file.relativePath) ?? new Set()).add(ref.target));
        continue;
      }
      const key = `${ref.target}\u0000${isNavigation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        path: file.relativePath,
        rule: isNavigation ? "navigation-dead-entry" : "dead-link",
        level: "warn",
        message: `${ref.raw} -> ${ref.target} is not in agent-library/context/`,
      });
    }
  }

  // Reachability from the roots, following every resolved reference (a symlink counts as its target's name).
  const reached = new Set<string>();
  const queue = ROOT_FILES.filter((name) => known.has(name));
  while (queue.length > 0) {
    const next = queue.pop()!;
    if (reached.has(next)) continue;
    reached.add(next);
    for (const target of edges.get(next) ?? []) queue.push(target);
  }
  if (reached.size > 0) {
    for (const file of regular) {
      if (!reached.has(file.relativePath)) {
        findings.push({ path: file.relativePath, rule: "unreachable", level: "warn", message: "not reachable from navigation.md or index.md" });
      }
    }
  }

  if (library.components.length > 0) {
    for (const file of regular) {
      if (!registered.has(file.relativePath)) {
        findings.push({ path: file.relativePath, rule: "unregistered", level: "info", message: "no entry in components.json (installed by `oac init --profile full`, not by install.sh profiles)" });
      }
    }
  }

  const order: Record<ContextRule, number> = { "navigation-dead-entry": 0, "dead-link": 1, unreachable: 2, unregistered: 3 };
  return findings.sort((a, b) => order[a.rule] - order[b.rule] || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
