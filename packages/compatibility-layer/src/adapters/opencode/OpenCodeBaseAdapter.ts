/**
 * OpenCodeBaseAdapter — the shared emission flow for both OpenCode targets (v2 and v1).
 *
 * Split from the original single `OpenCodeAdapter` so that everything specific to one OpenCode
 * major lives in a thin subclass: `OpenCodeAdapter` (v2, `.opencode/agent/`) and
 * `v1/OpenCodeV1Adapter` (v1, `v1-opencode/agent/`). Deleting v1 later deletes one subclass.
 *
 * Original description follows.
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

import { BaseAdapter } from "./../BaseAdapter.js";
import { getToolCapabilities } from "../../core/CapabilityMatrix.js";
import {
  CanonicalAgentSchema,
  type ConversionResult,
  type OpenAgent,
  type ToolCapabilities,
} from "../../types.js";
import {
  OAC_KEY,
  OPENCODE_KNOWN_KEYS,
  OpenCodeEmitError,
  orderedPermissions,
  parseFrontmatter,
  rebuild,
  samePermissions,
  splitFrontmatter,
  stripOacBlock,
  type CanonicalEmitResult,
  type FromCanonicalOptions,
} from "./surgery.js";

/** The frontmatter and body of an agent, between stripping `oac:` and writing the file. */
export interface EmitParts {
  /** Frontmatter lines, excluding both `---` delimiters. */
  frontmatter: string[];
  /** Everything from the closing `---` onward, verbatim. */
  rest: string;
}

/** What a subclass's {@link OpenCodeBaseAdapter.transform} returns. */
export interface Transformed extends EmitParts {
  warnings: string[];
}

export abstract class OpenCodeBaseAdapter extends BaseAdapter {
  constructor() {
    super();
  }

  /** Repo-relative root agents are written under, no trailing slash. */
  abstract readonly agentRoot: string;
  /** Human notes for the capability report. */
  protected abstract readonly layoutNote: string;

  /**
   * Target-specific rewrite of the stripped frontmatter and body. The default is the identity,
   * which is the whole of the original behaviour: the emission is the source minus `oac:`.
   */
  protected transform(parts: EmitParts, _parsed: Record<string, unknown>, _options: FromCanonicalOptions): Transformed {
    return { ...parts, warnings: [] };
  }

  /**
   * The frontmatter the emitted file must PARSE to, computed from the parsed source by a path
   * independent of the text surgery. The default is the source minus `oac:`.
   */
  protected expectedFrontmatter(parsed: Record<string, unknown>, _options: FromCanonicalOptions): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) if (key !== OAC_KEY) out[key] = value;
    return out;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async fromCanonical(source: string, options: FromCanonicalOptions = {}): Promise<CanonicalEmitResult> {
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

    const done = this.transform({ frontmatter: stripOacBlock(frontmatter), rest }, parsed, options);
    const content = rebuild(done.frontmatter, done.rest);

    return {
      content,
      warnings: [...done.warnings, ...this.verifyEmission(content, this.expectedFrontmatter(parsed, options), filePath)],
    };
  }

  /**
   * Re-parse the emitted file and prove the surgery did what it claims. Text surgery earns this
   * check: a line-range edit is wrong in quiet ways (an off-by-one that clips the last
   * permission rule still parses and silently grants less or more than the author wrote).
   */
  private verifyEmission(content: string, expected: Record<string, unknown>, filePath?: string): string[] {
    const emitted = parseFrontmatter(splitFrontmatter(content, filePath).frontmatter, filePath);

    if (OAC_KEY in emitted) {
      throw new OpenCodeEmitError("internal error: emitted frontmatter still carries an `oac:` key.", filePath);
    }

    const expectedKeys = Object.keys(expected);
    const actual = Object.keys(emitted);
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actual)) {
      throw new OpenCodeEmitError(
        `internal error: emission changed the frontmatter keys.\n` +
          `  expected: ${expectedKeys.join(", ") || "(none)"}\n` +
          `  emitted:  ${actual.join(", ") || "(none)"}`,
        filePath
      );
    }

    for (const key of expectedKeys) {
      if (JSON.stringify(emitted[key]) !== JSON.stringify(expected[key])) {
        throw new OpenCodeEmitError(`internal error: emission altered the value of \`${key}\`.`, filePath);
      }
    }

    // Permissions desugar to the same ORDERED rules; order is the whole security property.
    if (!samePermissions(orderedPermissions(expected["permission"]), orderedPermissions(emitted["permission"]))) {
      throw new OpenCodeEmitError(
        "internal error: emitted permissions do not match the source in order or content.",
        filePath
      );
    }

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
   * The path an emitted agent is written to, relative to the project root. Derived from the
   * source's path under the content root, not from `oac.category` + `oac.id`: the filesystem is
   * the authority on layout.
   */
  outputPath(relativePath: string): string {
    return `${this.agentRoot}/${relativePath}`;
  }

  // ==========================================================================
  // BaseAdapter surface
  // ==========================================================================

  toOAC(source: string): Promise<OpenAgent> {
    const { frontmatter, rest } = splitFrontmatter(source);
    const parsed = parseFrontmatter(frontmatter);
    const body = rest.replace(/^---\r?\n?/, "");
    const name = typeof parsed["name"] === "string" ? parsed["name"] : "opencode-agent";

    return Promise.resolve({
      frontmatter: {
        name,
        description:
          typeof parsed["description"] === "string" ? parsed["description"] : "Agent imported from OpenCode",
        mode: parsed["mode"] === "primary" || parsed["mode"] === "all" ? parsed["mode"] : "subagent",
        ...(typeof parsed["temperature"] === "number" ? { temperature: parsed["temperature"] } : {}),
        ...(typeof parsed["model"] === "string" ? { model: parsed["model"] } : {}),
      },
      metadata: { name, tags: [], dependencies: [] },
      systemPrompt: body.trim(),
      contexts: [],
    });
  }

  /** Deliberately unimplemented: OpenAgent cannot carry ordered permission rules. */
  fromOAC(_agent: OpenAgent): Promise<ConversionResult> {
    return Promise.resolve(
      this.createErrorResult([
        "OpenCodeAdapter does not implement fromOAC(). Use fromCanonical(source) instead: " +
          "OpenAgent cannot carry ordered permission rules, so emitting OpenCode from it " +
          "would risk silently reordering a last-match-wins permission block.",
      ])
    );
  }

  getConfigPath(): string {
    return `${this.agentRoot}/`;
  }

  getCapabilities(): ToolCapabilities {
    return {
      ...getToolCapabilities("opencode"),
      displayName: this.displayName,
      notes: [
        this.layoutNote,
        "Emission strips the `oac:` block and preserves every other byte, including comments.",
        "Permission rules keep their authored order; OpenCode resolves them last-match-wins.",
      ],
    };
  }

  validateConversion(agent: OpenAgent): string[] {
    const warnings: string[] = [];
    if (agent.frontmatter.hooks?.length) {
      warnings.push(this.unsupportedFeatureWarning("hooks", `${agent.frontmatter.hooks.length} hook(s)`));
    }
    return warnings;
  }
}
