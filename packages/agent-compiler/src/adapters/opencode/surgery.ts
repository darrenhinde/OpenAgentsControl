/**
 * Pure text surgery shared by both OpenCode targets (v2 and v1).
 *
 * Moved verbatim out of the original `OpenCodeAdapter`; the rationale for editing text rather
 * than re-serializing YAML is documented on `OpenCodeBaseAdapter`. Nothing here knows which
 * OpenCode major it is emitting for.
 */

import * as yaml from "js-yaml";
import { desugarPermission, type GranularPermission } from "../../types.js";
import type { AgentIdResolver } from "../../core/AgentIdResolver.js";

// ============================================================================
// Constants
// ============================================================================

/** Where OpenCode discovers agent files. Mirrors `AGENT_GLOB` (config.ts:311). */
export const OPENCODE_AGENT_ROOT = ".opencode/agent";

/**
 * The top-level frontmatter keys OpenCode recognises, copied verbatim from the Agent schema's
 * own `knownKeys` set (config.ts:635-652).
 *
 * Used only to WARN. OpenCode's `.catchall(z.any())` (config.ts:633) means an unknown key is
 * swept into `options` rather than rejected, so refusing to emit one would be this build
 * inventing a restriction the target does not have.
 */
export const OPENCODE_KNOWN_KEYS: ReadonlySet<string> = new Set([
  "name",
  "model",
  "variant",
  "prompt",
  "description",
  "temperature",
  "top_p",
  "mode",
  "hidden",
  "color",
  "steps",
  "maxSteps",
  "options",
  "permission",
  "disable",
  "tools",
]);

/** The `oac:` key itself — stripped, so it is never reported as an unknown key. */
export const OAC_KEY = "oac";

// ============================================================================
// Types
// ============================================================================

/** The result of emitting one canonical agent file. */
export interface CanonicalEmitResult {
  /** The emitted file content, ready to write verbatim. */
  content: string;
  /** Semantics lost or worth flagging. Empty means a provably faithful emission. */
  warnings: string[];
}

/** Options for {@link OpenCodeAdapter.fromCanonical}. */
export interface FromCanonicalOptions {
  /** Source path, used only to make error messages name the offending file. */
  filePath?: string;
  /**
   * Resolves delegation references to the target's id space. The build always supplies one.
   * Without it a reference is emitted as authored and a warning says so: standalone use of an
   * adapter on one file cannot know about the other agents.
   */
  resolver?: AgentIdResolver;
}

/** Raised when a canonical source cannot be emitted. Never thrown for a recoverable loss. */
export class OpenCodeEmitError extends Error {
  constructor(message: string, filePath?: string) {
    super(filePath ? `${filePath}: ${message}` : message);
    this.name = "OpenCodeEmitError";
  }
}

// ============================================================================
// Frontmatter text surgery
// ============================================================================

/** A canonical file split into the pieces the emitter manipulates, byte-preserving. */
export interface SplitFile {
  /** Frontmatter lines, excluding both `---` delimiters. */
  frontmatter: string[];
  /** Everything after the closing `---` line, verbatim (including its leading newline). */
  rest: string;
}

export const BLANK = /^\s*$/;
export const INDENTED = /^[ \t]/;

/** True for a top-level `key:` line — the only thing that can end a nested block. */
export function isTopLevelKey(line: string, key: string): boolean {
  return new RegExp(`^${key}\\s*:`).test(line);
}

/**
 * Split a canonical file at its FIRST closing `---`.
 *
 * The first delimiter matters: agent bodies routinely contain `---` horizontal rules
 * (`coder-agent.md` has five), and a greedy match would swallow half the prompt into the
 * frontmatter.
 */
export function splitFrontmatter(source: string, filePath?: string): SplitFile {
  const lines = source.split("\n");

  if (lines[0] !== "---" && lines[0]?.trimEnd() !== "---") {
    throw new OpenCodeEmitError(
      "no YAML frontmatter: a canonical agent file must open with `---`.",
      filePath
    );
  }

  const close = lines.findIndex((line, index) => index > 0 && line.trimEnd() === "---");
  if (close === -1) {
    throw new OpenCodeEmitError("unterminated YAML frontmatter: no closing `---`.", filePath);
  }

  return {
    frontmatter: lines.slice(1, close),
    // Rebuilt from the closing delimiter onward so no byte after it is ever touched.
    rest: lines.slice(close).join("\n"),
  };
}

/**
 * Remove a top-level block (`key:` plus its indented continuation) from frontmatter lines.
 *
 * Blank lines are consumed only when more of the block follows them, so a blank SEPARATOR after
 * the block survives — otherwise a block sitting mid-frontmatter would silently eat the spacing
 * around the next key. Flow style (`oac: {id: x}`) has no continuation and drops as one line.
 */
export function stripTopLevelKey(frontmatter: string[], key: string): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < frontmatter.length) {
    const line = frontmatter[i]!;

    if (!isTopLevelKey(line, key)) {
      out.push(line);
      i += 1;
      continue;
    }

    i += 1; // the `key:` line itself
    let end = i;
    while (end < frontmatter.length) {
      const next = frontmatter[end]!;
      if (INDENTED.test(next) || BLANK.test(next)) {
        end += 1;
        continue;
      }
      break;
    }
    // Give back trailing blanks: they separate the next key, they are not part of the block.
    while (end > i && BLANK.test(frontmatter[end - 1]!)) end -= 1;
    i = end;
  }

  return out;
}

/** Remove the top-level `oac:` block from frontmatter lines. */
export function stripOacBlock(frontmatter: string[]): string[] {
  return stripTopLevelKey(frontmatter, OAC_KEY);
}

/** Reassemble a file from stripped frontmatter and an untouched remainder. */
export function rebuild(frontmatter: string[], rest: string): string {
  return ["---", ...frontmatter].join("\n") + "\n" + rest;
}

// ============================================================================
// Parsing helpers
// ============================================================================

/** Parse a frontmatter block into a plain object, or fail with a located message. */
export function parseFrontmatter(lines: string[], filePath?: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = yaml.load(lines.join("\n"));
  } catch (cause) {
    throw new OpenCodeEmitError(
      `frontmatter is not valid YAML: ${cause instanceof Error ? cause.message : String(cause)}`,
      filePath
    );
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new OpenCodeEmitError("frontmatter must be a YAML mapping.", filePath);
  }

  return parsed as Record<string, unknown>;
}

/** Desugar a `permission:` value into ordered rules, or `undefined` when absent. */
export function orderedPermissions(value: unknown): GranularPermission | undefined {
  return value === undefined ? undefined : desugarPermission(value);
}

/** Compare two ordered permission specs for exact equality, order included. */
export function samePermissions(a?: GranularPermission, b?: GranularPermission): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

