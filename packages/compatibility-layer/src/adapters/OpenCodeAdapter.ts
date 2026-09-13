/**
 * OpenCodeAdapter — emits `.opencode/agent/**` from the canonical `content/agents/**` tree.
 *
 * ## What this adapter does
 *
 * Exactly one thing: it removes the `oac:` block from a canonical agent file and leaves every
 * other byte alone. That is the whole transform. The canonical file is *defined* as
 * "OpenCode-legal frontmatter PLUS an `oac:` block", so the OpenCode emission is the canonical
 * file minus that block — nothing to re-derive, nothing to re-format.
 *
 * ## Why it strips text instead of re-serializing YAML
 *
 * The obvious implementation — parse the frontmatter, delete `oac`, `yaml.dump()` the rest —
 * cannot work here, and the reason is worth recording because it will look like an omission
 * otherwise.
 *
 * The 33 shipped agents are hand-authored, and their YAML carries author decisions no dumper
 * reproduces: `"bash .opencode/skills/task-management/router.sh complete*": "allow"` is quoted
 * while the sibling `contextscout: "allow"` is not; actions are quoted (`"deny"`) where YAML
 * does not require it. A round-trip through `yaml.dump()` renormalizes all of it and every one
 * of the 33 files comes back byte-different. Since `oac build && git diff --exit-code` is the
 * gate this refactor rests on (07 Stage 3), a renormalizing emitter would either fail the gate
 * forever or force a 33-file reformatting commit that buries any real drift in noise.
 *
 * Textual excision makes byte-identity the *default* rather than something chased with
 * special cases, and it keeps comments and blank lines — which a dumper silently discards.
 *
 * The parse still happens: the file is validated against {@link CanonicalAgentSchema} and the
 * emitted result is re-parsed and checked (see {@link OpenCodeAdapter.fromCanonical}). Parsing
 * decides *whether* to emit; it just does not decide the bytes.
 *
 * ## What OpenCode actually accepts — verified against source, not docs
 *
 * Checked against the OpenCode checkout at `/Users/darrenhinde/Documents/GitHub/opencode`
 * (`packages/opencode/src/config/config.ts`, v1.1.48+118 / commit `b9aad20be`) and confirmed
 * live against the installed 1.18.1 binary:
 *
 * - **`name:` is legal.** It is listed in the Agent schema's own `knownKeys` (config.ts:636),
 *   and the markdown agent loader builds `{ name: <path-derived>, ...md.data }` (config.ts:336-338)
 *   — the frontmatter spread comes *second*, so an authored `name:` OVERRIDES the path-derived
 *   one and becomes the key the agent registers under (config.ts:343). Emitting `name:` is
 *   therefore not merely allowed, it is REQUIRED to preserve identity: drop it and `CoderAgent`
 *   silently becomes `coder-agent`, breaking every `task:` rule that names it.
 *
 * - **Unknown keys are NOT rejected.** The Agent schema ends in `.catchall(z.any())`
 *   (config.ts:633) and sweeps anything outside `knownKeys` into `options` (config.ts:654-658).
 *   So `oac:` would not actually break OpenCode. Stripping it is hygiene — keeping build-time
 *   metadata out of an agent's runtime `options` — not a hard requirement.
 *
 * - **The permission vocabulary is OPEN.** `Permission` is a `z.object({...}).catchall(
 *   PermissionRule).or(PermissionAction)` (config.ts:553-580), and `skill` (config.ts:575) and
 *   `question` (config.ts:569) are known keys. Capability names are therefore treated here as
 *   opaque strings — never validated against a closed enum.
 *
 * - **Authored order is load-bearing.** `permissionTransform` (config.ts:541) rebuilds the
 *   permission map from `__originalKeys` precisely to preserve the order the author wrote,
 *   because resolution is last-match-wins. Textual passthrough preserves it exactly.
 */

import * as yaml from "js-yaml";
import { BaseAdapter } from "./BaseAdapter.js";
import { getToolCapabilities } from "../core/CapabilityMatrix.js";
import {
  CanonicalAgentSchema,
  desugarPermission,
  type ConversionResult,
  type GranularPermission,
  type OpenAgent,
  type ToolCapabilities,
} from "../types.js";

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
const OPENCODE_KNOWN_KEYS: ReadonlySet<string> = new Set([
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
const OAC_KEY = "oac";

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
interface SplitFile {
  /** Frontmatter lines, excluding both `---` delimiters. */
  frontmatter: string[];
  /** Everything after the closing `---` line, verbatim (including its leading newline). */
  rest: string;
}

const BLANK = /^\s*$/;
const INDENTED = /^[ \t]/;

/** True for a top-level `key:` line — the only thing that can end a nested block. */
function isTopLevelKey(line: string, key: string): boolean {
  return new RegExp(`^${key}\\s*:`).test(line);
}

/**
 * Split a canonical file at its FIRST closing `---`.
 *
 * The first delimiter matters: agent bodies routinely contain `---` horizontal rules
 * (`coder-agent.md` has five), and a greedy match would swallow half the prompt into the
 * frontmatter.
 */
function splitFrontmatter(source: string, filePath?: string): SplitFile {
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
 * Remove the top-level `oac:` block from frontmatter lines.
 *
 * Consumes the `oac:` line plus its indented continuation. Blank lines are consumed only when
 * more of the block follows them, so a blank SEPARATOR after the block survives — otherwise an
 * `oac:` block sitting mid-frontmatter would silently eat the spacing around the next key.
 * Flow style (`oac: {id: x}`) has no continuation and drops as a single line.
 */
function stripOacBlock(frontmatter: string[]): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < frontmatter.length) {
    const line = frontmatter[i]!;

    if (!isTopLevelKey(line, OAC_KEY)) {
      out.push(line);
      i += 1;
      continue;
    }

    i += 1; // the `oac:` line itself
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

/** Reassemble a file from stripped frontmatter and an untouched remainder. */
function rebuild(frontmatter: string[], rest: string): string {
  return ["---", ...frontmatter].join("\n") + "\n" + rest;
}

// ============================================================================
// Parsing helpers
// ============================================================================

/** Parse a frontmatter block into a plain object, or fail with a located message. */
function parseFrontmatter(lines: string[], filePath?: string): Record<string, unknown> {
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
function orderedPermissions(value: unknown): GranularPermission | undefined {
  return value === undefined ? undefined : desugarPermission(value);
}

/** Compare two ordered permission specs for exact equality, order included. */
function samePermissions(a?: GranularPermission, b?: GranularPermission): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// ============================================================================
// Adapter
// ============================================================================

/**
 * Emits OpenCode agent files from canonical sources.
 *
 * @example
 * ```ts
 * const adapter = new OpenCodeAdapter();
 * const { content, warnings } = await adapter.fromCanonical(
 *   readFileSync("content/agents/subagents/code/coder-agent.md", "utf-8")
 * );
 * // -> the same file with its `oac:` block removed, byte-for-byte otherwise
 * ```
 */
export class OpenCodeAdapter extends BaseAdapter {
  readonly name = "opencode";
  readonly displayName = "OpenCode";

  constructor() {
    super();
  }

  // ==========================================================================
  // Canonical emission — the build path
  // ==========================================================================

  /**
   * Emit the OpenCode agent file for one canonical source.
   *
   * Deterministic by construction: the output is a subsequence of the input's bytes. There is
   * no clock, no host path, no directory read and no map iteration anywhere on this path, so
   * two runs cannot differ.
   *
   * `async` deliberately: every failure below must surface as a REJECTED promise, not a
   * synchronous throw. A method typed `Promise<T>` that throws synchronously breaks
   * `fromCanonical(x).catch(...)` — the caller's handler is never installed and the error
   * escapes as an uncaught exception, which for a build tool means a stack trace instead of
   * "this file is missing its oac: block".
   *
   * @param source - a canonical agent file: OpenCode frontmatter + an `oac:` block.
   * @returns the emitted content plus any warnings.
   * @throws {OpenCodeEmitError} when the source is malformed, carries no `oac:` block, or when
   * the emitted result would not round-trip its permissions.
   */
  // `async` turns a malformed source into a rejection rather than a synchronous throw past
  // the caller's .catch(), so require-await's assumption does not hold here.
  // eslint-disable-next-line @typescript-eslint/require-await
  async fromCanonical(
    source: string,
    options: FromCanonicalOptions = {}
  ): Promise<CanonicalEmitResult> {
    const { filePath } = options;
    const { frontmatter, rest } = splitFrontmatter(source, filePath);
    const parsed = parseFrontmatter(frontmatter, filePath);

    if (!(OAC_KEY in parsed)) {
      throw new OpenCodeEmitError(
        "no `oac:` block. A canonical agent file must carry one; without it this file is " +
          "already an OpenCode agent and does not belong in the canonical tree.",
        filePath
      );
    }

    // Validate the whole canonical shape before emitting. This is what rejects a bad `oac:`
    // block, an integer-like permission scope (which ECMAScript would reorder, silently
    // changing last-match-wins precedence) and a malformed permission map.
    const validated = CanonicalAgentSchema.safeParse(parsed);
    if (!validated.success) {
      throw new OpenCodeEmitError(
        `canonical validation failed:\n${validated.error.errors
          .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("\n")}`,
        filePath
      );
    }

    const stripped = stripOacBlock(frontmatter);
    const content = rebuild(stripped, rest);

    return {
      content,
      warnings: this.verifyEmission(content, parsed, filePath),
    };
  }

  /**
   * Re-parse the emitted file and prove the strip did what it claims.
   *
   * Text surgery earns this check. A parse-and-dump emitter is wrong in obvious, visible ways;
   * a line-range strip is wrong in quiet ones — an off-by-one that clips the last permission
   * rule produces a file that still parses, still loads, and silently grants less (or more)
   * than the author wrote. So the postcondition is asserted rather than assumed.
   *
   * @returns warnings for recoverable observations; throws when the emission is not faithful.
   */
  private verifyEmission(
    content: string,
    source: Record<string, unknown>,
    filePath?: string
  ): string[] {
    const emitted = parseFrontmatter(splitFrontmatter(content, filePath).frontmatter, filePath);

    // 1. The oac block is gone — proven by parsing, not by grepping for "oac:".
    if (OAC_KEY in emitted) {
      throw new OpenCodeEmitError(
        "internal error: emitted frontmatter still carries an `oac:` key.",
        filePath
      );
    }

    // 2. Every other key survived, with an identical value. Catches both a clipped block and
    //    an over-eager strip that swallowed the key after `oac:`.
    const expected = Object.keys(source).filter((key) => key !== OAC_KEY);
    const actual = Object.keys(emitted);

    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw new OpenCodeEmitError(
        `internal error: stripping \`oac:\` changed the frontmatter keys.\n` +
          `  expected: ${expected.join(", ") || "(none)"}\n` +
          `  emitted:  ${actual.join(", ") || "(none)"}`,
        filePath
      );
    }

    for (const key of expected) {
      if (JSON.stringify(emitted[key]) !== JSON.stringify(source[key])) {
        throw new OpenCodeEmitError(
          `internal error: stripping \`oac:\` altered the value of \`${key}\`.`,
          filePath
        );
      }
    }

    // 3. Permissions desugar to the same ORDERED rules. The deep-equal above already implies
    //    this, but it is asserted in the canonical representation as well: order is the whole
    //    security property here, and `JSON.stringify` comparing two objects is only
    //    order-sensitive by accident of insertion order.
    if (
      !samePermissions(
        orderedPermissions(source["permission"]),
        orderedPermissions(emitted["permission"])
      )
    ) {
      throw new OpenCodeEmitError(
        "internal error: emitted permissions do not match the source in order or content.",
        filePath
      );
    }

    // 4. Report anything OpenCode would sweep into `options` rather than act on.
    return actual
      .filter((key) => !OPENCODE_KNOWN_KEYS.has(key))
      .map(
        (key) =>
          `⚠️  Frontmatter key '${key}' is not part of OpenCode's agent schema ` +
          `(config.ts:635-652). OpenCode will collect it into the agent's \`options\` rather ` +
          `than act on it.`
      );
  }

  /**
   * The path an emitted agent is written to, relative to the project root.
   *
   * Derived from the source's path under the content root, NOT from `oac.category` + `oac.id`.
   * That distinction is load-bearing: `content/agents/subagents/code/test-engineer.md` declares
   * `id: tester`, so composing the path from the id would emit `subagents/code/tester.md` and
   * orphan the `test-engineer.md` that OpenCode is already loading. The filesystem is the
   * authority on layout; `oac.category` merely describes it.
   *
   * @param relativePath - POSIX path relative to the content root, e.g.
   * `"subagents/code/coder-agent.md"`.
   */
  outputPath(relativePath: string): string {
    return `${OPENCODE_AGENT_ROOT}/${relativePath}`;
  }

  // ==========================================================================
  // BaseAdapter surface
  // ==========================================================================

  /**
   * OpenCode agent files ARE the canonical format minus `oac:`, so importing one is a matter
   * of reading its frontmatter. Identity that only the `oac:` block carries (id, category,
   * version, …) cannot be recovered from an OpenCode file and is left to the caller.
   */
  toOAC(source: string): Promise<OpenAgent> {
    const { frontmatter, rest } = splitFrontmatter(source);
    const parsed = parseFrontmatter(frontmatter);
    const body = rest.replace(/^---\r?\n?/, "");

    const name = typeof parsed["name"] === "string" ? parsed["name"] : "opencode-agent";

    return Promise.resolve({
      frontmatter: {
        name,
        description:
          typeof parsed["description"] === "string"
            ? parsed["description"]
            : "Agent imported from OpenCode",
        mode:
          parsed["mode"] === "primary" || parsed["mode"] === "all" ? parsed["mode"] : "subagent",
        ...(typeof parsed["temperature"] === "number"
          ? { temperature: parsed["temperature"] }
          : {}),
        ...(typeof parsed["model"] === "string" ? { model: parsed["model"] } : {}),
      },
      metadata: { name, tags: [], dependencies: [] },
      systemPrompt: body.trim(),
      contexts: [],
    });
  }

  /**
   * Legacy `OpenAgent` -> OpenCode conversion.
   *
   * Deliberately unimplemented. The canonical build uses {@link fromCanonical}, whose input is
   * the authored file itself; `OpenAgent` is the *lossy* legacy shape, whose `permission` field
   * is an unordered `Record`. Emitting OpenCode from it would mean re-serializing a map whose
   * key order is an ECMAScript accident — exactly the last-match-wins corruption this refactor
   * exists to remove. Failing loudly beats shipping a plausible reordering.
   */
  fromOAC(_agent: OpenAgent): Promise<ConversionResult> {
    return Promise.resolve(
      this.createErrorResult([
        "OpenCodeAdapter does not implement fromOAC(). Use fromCanonical(source) instead: " +
          "OpenAgent cannot carry ordered permission rules, so emitting OpenCode from it " +
          "would risk silently reordering a last-match-wins permission block.",
      ])
    );
  }

  /** Agents live under `.opencode/agent/`; the per-agent path comes from {@link outputPath}. */
  getConfigPath(): string {
    return `${OPENCODE_AGENT_ROOT}/`;
  }

  /**
   * OpenCode is the canonical target: it is the only one that carries ordered, scoped
   * permissions without degradation, which is why this adapter has no projection logic.
   */
  getCapabilities(): ToolCapabilities {
    return {
      ...getToolCapabilities("opencode"),
      displayName: this.displayName,
      notes: [
        "Agent files live at .opencode/agent/<category>/<name>.md, mirroring content/agents/.",
        "Emission strips the `oac:` block and preserves every other byte, including comments.",
        "Permission rules keep their authored order; OpenCode resolves them last-match-wins.",
      ],
    };
  }

  /**
   * Nothing is lost emitting a canonical agent to OpenCode — the frontmatter is already
   * OpenCode's own — so this reports only what OpenCode would not act on.
   */
  validateConversion(agent: OpenAgent): string[] {
    const warnings: string[] = [];

    // `hooks` is an OAC concept with no counterpart in OpenCode's Agent schema
    // (config.ts:635-652), so it would be swept into `options` and never fire.
    if (agent.frontmatter.hooks?.length) {
      warnings.push(
        this.unsupportedFeatureWarning("hooks", `${agent.frontmatter.hooks.length} hook(s)`)
      );
    }

    return warnings;
  }
}
