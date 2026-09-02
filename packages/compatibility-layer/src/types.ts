import { z } from "zod";

// ============================================================================
// Tool Access Schema
// ============================================================================

/**
 * Defines which tools an agent has access to.
 * Each tool can be enabled/disabled via boolean flags.
 */
export const ToolAccessSchema = z.object({
  read: z.boolean().optional(),
  write: z.boolean().optional(),
  edit: z.boolean().optional(),
  bash: z.boolean().optional(),
  task: z.boolean().optional(),
  grep: z.boolean().optional(),
  glob: z.boolean().optional(),
  patch: z.boolean().optional(),
  question: z.boolean().optional(),
});

// ============================================================================
// Permission Schemas
// ============================================================================

/**
 * A single permission decision.
 *
 * Field name rationale: `action` mirrors OpenCode's own runtime rule shape
 * (`{ permission, pattern, action }`), verified against the installed resolver in
 * `docs/architecture/canonical-refactor/10-PRECEDENCE-EXPERIMENT.md` §7.
 */
export const PermissionActionSchema = z.enum(["allow", "deny", "ask"]);

/**
 * Permission rules can be:
 * - A literal: "allow", "deny", "ask"
 * - A boolean (true = allow, false = deny)
 * - A record mapping specific operations to permission literals
 *
 * This is the *authored* (on-disk YAML) form. It is sugar over the canonical
 * ordered form below — see {@link desugarPermission}.
 */
export const PermissionRuleSchema = z.union([
  z.literal("allow"),
  z.literal("deny"),
  z.literal("ask"),
  z.boolean(),
  z.record(z.string(), PermissionActionSchema),
]);

/**
 * The legacy/authored `permission:` mapping exactly as OpenCode accepts it on disk:
 * capability name -> rule. This is what {@link AgentFrontmatterSchema} still carries,
 * so existing agent files keep parsing unchanged.
 *
 * ⚠️ A JS object is an UNORDERED map as far as any schema is concerned. This shape is
 * accepted as INPUT only; the canonical representation is {@link GranularPermissionSchema}.
 */
export const PermissionMapSchema = z.record(z.string(), PermissionRuleSchema);

/**
 * One ordered rule within a capability. `pattern` is a glob whose namespace depends on
 * the capability (path glob for read/write/edit, command glob for bash, agent id for task).
 */
export const PermissionRuleEntrySchema = z
  .object({
    pattern: z.string().min(1),
    action: PermissionActionSchema,
  })
  .strict();

/**
 * Ordered rules for a single capability. **Array order is semantic**: rules are evaluated
 * in authored order and the LAST matching rule wins.
 *
 * Duplicate patterns are representable here by design — the OpenCode serializer, not the
 * schema, is responsible for refusing to emit them (the map format cannot round-trip them).
 */
export const PermissionRuleListSchema = z.array(PermissionRuleEntrySchema);

/**
 * One capability's ordered rule list. Capability entries are themselves ordered, because
 * OpenCode flattens the capability map into a single rule list before resolving and
 * wildcard capability keys (e.g. `"*"`) can match alongside specific ones.
 */
export const GranularPermissionEntrySchema = z
  .object({
    capability: z.string().min(1),
    rules: PermissionRuleListSchema,
  })
  .strict();

/**
 * Granular permissions in their canonical, ORDER-PRESERVING representation.
 *
 * This deliberately replaces the previous `z.record(...)` map. Last-match-wins precedence
 * is meaningless without a guaranteed order, and a record only preserved order by accident
 * of ECMAScript string-key insertion ordering — an accident that demonstrably breaks for
 * integer-like keys (see {@link desugarPermission}).
 *
 * Semantics (confirmed live against OpenCode 1.17.20 —
 * `docs/architecture/canonical-refactor/10-PRECEDENCE-EXPERIMENT.md`):
 * flatten entries in order, then resolve with **last-match-wins** (`Array.findLast`).
 */
export const GranularPermissionSchema = z.array(GranularPermissionEntrySchema);

/** Scopes that ECMAScript would silently reorder to the front of an object's key list. */
const INTEGER_LIKE_SCOPE = /^\d+$/;

/**
 * What an author may write under `permission:` — either the canonical ordered form or the
 * OpenCode map sugar. Desugars to the canonical ordered form, preserving source order.
 */
export const PermissionInputSchema = z
  .union([GranularPermissionSchema, PermissionMapSchema])
  .transform((input, ctx) => desugar(input, ctx));

// ----------------------------------------------------------------------------
// Permission desugaring
// ----------------------------------------------------------------------------

type PermissionRuleInput = z.infer<typeof PermissionRuleSchema>;
type PermissionRuleEntryOut = z.infer<typeof PermissionRuleEntrySchema>;
type GranularPermissionOut = z.infer<typeof GranularPermissionSchema>;

/** Reject scopes ECMAScript key ordering would silently move, invalidating rule order. */
function reject(scope: string, ctx: z.RefinementCtx, path: (string | number)[]): boolean {
  if (!INTEGER_LIKE_SCOPE.test(scope.trim())) return false;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path,
    message:
      `integer-like scope "${scope}" is not allowed: ECMAScript reorders integer-like ` +
      `object keys to the front, which silently changes last-match-wins precedence`,
  });
  return true;
}

/** Expand one authored rule (scalar, boolean or scope map) into ordered rule entries. */
function expand(
  rule: PermissionRuleInput,
  ctx: z.RefinementCtx,
  path: (string | number)[]
): PermissionRuleEntryOut[] {
  if (typeof rule === "boolean") {
    return [{ pattern: "*", action: rule ? "allow" : "deny" }];
  }
  if (typeof rule === "string") {
    return [{ pattern: "*", action: rule }];
  }
  return Object.entries(rule).flatMap(([pattern, action]) =>
    reject(pattern, ctx, [...path, pattern]) ? [] : [{ pattern, action }]
  );
}

/**
 * Back-compat parser: converts authored `permission:` input into the canonical ordered
 * form **in source order**.
 *
 * - `edit: deny`                     -> [{ capability: "edit", rules: [{ pattern: "*", action: "deny" }] }]
 * - `bash: { "*": deny, "ls*": allow }` -> rules in exactly that order (the later rule wins)
 * - already-ordered input            -> identity
 */
function desugar(
  input: GranularPermissionOut | Record<string, PermissionRuleInput>,
  ctx: z.RefinementCtx
): GranularPermissionOut {
  if (Array.isArray(input)) return input;
  return Object.entries(input).flatMap(([capability, rule]) =>
    reject(capability, ctx, [capability])
      ? []
      : [{ capability, rules: expand(rule, ctx, [capability]) }]
  );
}

/**
 * Desugar authored permission input into the canonical ordered form.
 * Throws a `ZodError` on integer-like scopes or malformed input.
 */
export function desugarPermission(input: unknown): GranularPermissionOut {
  return PermissionInputSchema.parse(input);
}

// ============================================================================
// Context Schemas
// ============================================================================

/**
 * Context priority levels for loading order and importance.
 */
export const ContextPrioritySchema = z.enum(["critical", "high", "medium", "low"]);

/**
 * References a context file with optional priority and description.
 */
export const ContextReferenceSchema = z.object({
  path: z.string(),
  priority: ContextPrioritySchema.optional(),
  description: z.string().optional(),
});

// ============================================================================
// Dependency Schema
// ============================================================================

/**
 * References external dependencies like subagents, contexts, commands, skills, or tools.
 */
export const DependencyReferenceSchema = z.object({
  type: z.enum(["subagent", "context", "command", "skill", "tool"]),
  id: z.string(),
});

// ============================================================================
// Agent Configuration Schemas
// ============================================================================

/**
 * Defines the operational mode of an agent.
 */
export const AgentModeSchema = z.enum(["primary", "subagent", "all"]);

/**
 * Agent categories for organizational purposes.
 */
export const AgentCategorySchema = z.enum([
  "core",
  "development",
  "content",
  "data",
  "product",
  "learning",
  "meta",
  "specialist",
]);

/**
 * Defines whether this is a primary agent or subagent.
 */
export const AgentTypeSchema = z.enum(["agent", "subagent"]);

// ============================================================================
// Model Configuration Schemas
// ============================================================================

/**
 * Model identifier - can be any string representing a model name or ID.
 */
export const ModelIdentifierSchema = z.union([z.string(), z.string()]);

/**
 * Temperature parameter for model inference (typically 0.0 to 2.0).
 */
export const TemperatureSchema = z.number();

// ============================================================================
// Skill Schema
// ============================================================================

/**
 * Skill reference can be:
 * - A simple string (skill name)
 * - An object with name and optional configuration
 */
export const SkillReferenceSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    config: z.record(z.string(), z.any()).optional(),
  }),
]);

// ============================================================================
// Hook Schemas
// ============================================================================

/**
 * Events that can trigger hooks during agent execution.
 */
export const HookEventSchema = z.enum([
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "AgentStart",
  "AgentEnd",
]);

/**
 * Defines a hook that executes commands in response to specific events.
 */
export const HookDefinitionSchema = z.object({
  event: HookEventSchema,
  matchers: z.array(z.string()).optional(),
  commands: z.array(
    z.object({
      type: z.literal("command"),
      command: z.string(),
    })
  ),
});

// ============================================================================
// Agent Frontmatter Schema
// ============================================================================

/**
 * Agent frontmatter contains the primary configuration defined in the agent's
 * markdown file header (YAML frontmatter).
 */
export const AgentFrontmatterSchema = z.object({
  name: z.string(),
  description: z.string(),
  mode: AgentModeSchema,
  temperature: TemperatureSchema.optional(),
  model: ModelIdentifierSchema.optional(),
  maxSteps: z.number().optional(),
  disable: z.boolean().optional(),
  hidden: z.boolean().optional(),
  prompt: z.string().optional(),
  tools: ToolAccessSchema.optional(),
  permission: PermissionMapSchema.optional(),
  skills: z.array(SkillReferenceSchema).optional(),
  hooks: z.array(HookDefinitionSchema).optional(),
});

// ============================================================================
// Canonical `oac:` Frontmatter Block
// ============================================================================

/**
 * Stable machine identity. Kebab-case slug, verified against the canonical agent corpus.
 */
export const OacIdSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "id must be kebab-case: lowercase alphanumeric words joined by single hyphens"
  );

/** SemVer of the authored component. Corpus uses 1.0.0 / 2.0.0. */
export const OacVersionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "version must be SemVer (MAJOR.MINOR.PATCH)");

const CATEGORY_ROOTS: readonly string[] = [
  ...AgentCategorySchema.options,
  // Present in the real corpus but absent from AgentCategorySchema:
  "subagents", // 20 entries: subagents/{code,core,development,system-builder,test,utils}
  "testing", // 1 entry: eval-runner
];

const CATEGORY_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Organizational category. Mirrors the agent's directory under `.opencode/agent/`:
 * a closed root vocabulary, optionally followed by one `/`-joined sub-segment.
 *
 * ⚠️ Deliberately a superset of {@link AgentCategorySchema}, which cannot express categories
 * the corpus uses (`subagents/core`, `subagents/code`, …, `testing`). The ratified
 * "the schema must accept its own corpus" rule (02-canonical-schema.md v3) wins over the
 * brief's "reuses AgentCategorySchema". The root stays closed so typos are still caught.
 */
export const OacCategorySchema = z.string().refine(
  (value) => {
    const segments = value.split("/");
    if (segments.length > 2) return false;
    const [root = "", sub] = segments;
    if (!CATEGORY_ROOTS.includes(root)) return false;
    return sub === undefined || CATEGORY_SEGMENT.test(sub);
  },
  {
    message:
      `category must be "<root>" or "<root>/<segment>" where root is one of: ` +
      CATEGORY_ROOTS.join(", "),
  }
);

/**
 * Platforms a component can declare as an emit target. Every value here has a
 * working adapter; which of them `oac build` actually wires up is a separate,
 * narrower question — see the build command's target registry.
 */
export const BuildTargetSchema = z.enum([
  "opencode",
  "claude-code",
]);

/**
 * Which platforms this component is emitted to. At least one target is required;
 * `targets: []` is rejected because a component that emits nowhere is dead weight the
 * build would silently skip. Defaults to `["opencode"]` — true of all 34 agents on disk —
 * so a minimal authored `oac:` block needs no boilerplate for the common target.
 */
export const BuildTargetsSchema = z
  .array(BuildTargetSchema)
  .min(1, "targets must list at least one build target")
  .default(["opencode"]);

/**
 * A dependency reference in either authored form:
 * - the flat typed string the corpus uses today (`"subagent:tester"`, `"context:standards-code"`)
 * - the structured {@link DependencyReferenceSchema} form
 *
 * Both normalize to `{ type, id }`, giving canonical consumers one stable representation.
 */
export const DependencyRefInputSchema = z.union([
  z.string().transform((value, ctx): z.infer<typeof DependencyReferenceSchema> => {
    const separator = value.indexOf(":");
    const parsed = DependencyReferenceSchema.safeParse({
      type: value.slice(0, separator),
      id: value.slice(separator + 1),
    });
    if (separator <= 0 || !parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `dependency "${value}" must be "<type>:<id>" where type is one of: ` +
          DependencyReferenceSchema.shape.type.options.join(", "),
      });
      return z.NEVER;
    }
    return parsed.data;
  }),
  DependencyReferenceSchema,
]);

/**
 * What one target may override about this component, authored by a human.
 *
 * ## Why overrides exist: some things are not derivable
 *
 * A canonical `permission:` block is OpenCode's own field, and on OpenCode it is *enforcement*:
 * ordered globs, last-match-wins, applied per agent. Other targets cannot enforce that. Claude
 * Code is the live example — verified against its docs on 2026-07-15:
 *
 * - subagent frontmatter carries `tools:`/`disallowedTools:` and nothing else
 *   (`sub-agents.md`, "Supported frontmatter fields");
 * - permission RULES exist, but only in `settings.json`, and they "apply to the entire
 *   session, not only the plugin subagent" (`sub-agents.md`) — there is no per-agent scope;
 * - a plugin's own `settings.json` supports only the `agent` and `subagentStatusLine` keys
 *   (`plugins-reference.md`), so a plugin cannot ship permission rules even session-wide;
 * - precedence is category-based (deny → ask → allow, specificity-blind, `permissions.md`),
 *   which cannot express last-match-wins even in principle.
 *
 * So "what should this agent be allowed to do on Claude Code?" **cannot be computed** from the
 * permission block. Deriving it and fixing up the failures was tried and was a mistake: every
 * answer is either a crippled agent (fail-closed denies `externalscout` the Read it exists to
 * do) or a silent widening (which is how the shipped agents came to leak). It is a judgement
 * call, so a human writes it down here, and the adapter does as it is told.
 *
 * Say WHY in a YAML comment next to the grant. That is where a reader looks anyway.
 */
export const TargetOverrideSchema = z
  .object({
    /** Component name on this target. Defaults to {@link OacBlockSchema}'s `id`. */
    name: z.string().min(1).optional(),
    /** Target-native model id (e.g. Claude Code's `sonnet`), distinct from OpenCode's. */
    model: z.string().min(1).optional(),
    /**
     * The tools this component is granted on this target, in the target's own vocabulary.
     *
     * Deliberately `string[]`, not an enum: each target names its tools differently, and the
     * adapter that owns those names validates them. A schema-level enum here would make
     * `types.ts` know about every target's tool list.
     */
    tools: z.array(z.string().min(1)).optional(),
  })
  .strict();

/**
 * Per-target overrides, keyed by target.
 *
 * A closed object rather than `z.record(BuildTargetSchema, …)` so a typo'd or unknown target
 * key is a parse error instead of a silently-ignored block that never takes effect.
 */
export const TargetOverridesSchema = z
  .object({
    opencode: TargetOverrideSchema.optional(),
    "claude-code": TargetOverrideSchema.optional(),
  })
  .strict();

/**
 * The canonical `oac:` frontmatter block — everything a component needs that OpenCode's
 * frontmatter schema rejects as an unknown field. `oac build` strips this block when emitting
 * OpenCode agent files.
 *
 * Strict: an unknown key is an error, never silently dropped.
 */
export const OacBlockFieldsSchema = z
  .object({
    id: OacIdSchema,
    name: z.string().min(1),
    category: OacCategorySchema,
    type: AgentTypeSchema,
    version: OacVersionSchema.default("1.0.0"),
    author: z.string().min(1).default("opencode"),
    tags: z.array(z.string()).default([]),
    dependencies: z.array(DependencyRefInputSchema).default([]),
    targets: BuildTargetsSchema,
    overrides: TargetOverridesSchema.default({}),
  })
  .strict();

/**
 * The `oac:` block as parsed. {@link OacBlockFieldsSchema} plus the cross-field checks.
 *
 * This is a `ZodEffects`, so it has no `.shape`; reach for {@link OacBlockFieldsSchema} when
 * you need the field list itself.
 */
export const OacBlockSchema = OacBlockFieldsSchema
  .superRefine((oac, ctx) => {
    // An override for a target this component does not emit to is dead config: it looks like
    // it is doing something and never runs. Almost always a half-finished edit to `targets`.
    for (const target of Object.keys(oac.overrides)) {
      if (!oac.targets.includes(target as z.infer<typeof BuildTargetSchema>)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overrides", target],
          message:
            `override declared for target "${target}", which is not in targets ` +
            `[${oac.targets.join(", ")}] — it would never be applied`,
        });
      }
    }
  });

// ============================================================================
// Canonical Agent Schema
// ============================================================================

/**
 * A canonical agent file: OpenCode-legal frontmatter PLUS the `oac:` block. One file
 * fully defines one component — no sidecar, no second source of truth.
 *
 * `permission` accepts the authored OpenCode map sugar and desugars it into the ordered
 * {@link GranularPermissionSchema} form, in source order.
 */
export const CanonicalAgentSchema = AgentFrontmatterSchema.extend({
  oac: OacBlockSchema,
  permission: PermissionInputSchema.optional(),
});

// ============================================================================
// Canonical Profile Schemas
// ============================================================================

/**
 * A context profile: a named, reusable bundle of context ids, authored at
 * `content/profiles/context/<id>.json`. System profiles compose these rather than
 * listing contexts directly, so a team standard set is written once and shared.
 *
 * A context entry may be a registry wildcard (e.g. `core/*`) — a directory subscription
 * that also installs future files added under that prefix. Wildcards are authored
 * verbatim and expanded at emission/install time, never in the authored source.
 *
 * Strict: an unknown key is an error, never silently dropped.
 */
export const ContextProfileSchema = z
  .object({
    id: OacIdSchema,
    contexts: z
      .array(z.string().min(1))
      .min(1, "a context profile that names no contexts installs nothing"),
  })
  .strict();

/**
 * A system profile: the smallest installable unit — a set of agents plus the context
 * profiles that back them, authored at `content/profiles/system/<id>.json`.
 *
 * "Install `developer` and you get a working set" is a promise about the CLOSURE: every
 * component must resolve, or the profile is broken no matter how deep the break hides.
 * {@link import("./core/ProfileLoader.js").ProfileLoader.resolveSystemProfile} enforces that.
 *
 * `agents` names BOTH primary agents and subagents: the canonical tree collapses them —
 * a subagent is just an agent file under `content/agents/subagents/**` — so the legacy
 * `agent:`/`subagent:` distinction is an emission detail, not an authoring one.
 *
 * The remaining kinds are optional because most profiles name none of a given kind; a
 * field left out parses to nothing and installs nothing. There is deliberately no
 * `subagents` field and no wildcard expansion here: profiles name concrete ids, and the
 * registry emitter, not the author, worries about categories.
 *
 * Strict: an unknown key is an error, never silently dropped.
 */
export const SystemProfileSchema = z
  .object({
    id: OacIdSchema,
    agents: z
      .array(z.string().min(1))
      .min(1, "a system profile that names no agents installs nothing"),
    contextProfiles: z
      .array(z.string().min(1))
      .min(1, "a system profile that names no context profiles installs nothing"),
    commands: z.array(z.string().min(1)).optional(),
    tools: z.array(z.string().min(1)).optional(),
    skills: z.array(z.string().min(1)).optional(),
    plugins: z.array(z.string().min(1)).optional(),
    config: z.array(z.string().min(1)).optional(),
  })
  .strict();

// ============================================================================
// OpenAgent Schema
// ============================================================================

/**
 * Complete OpenAgent schema combining frontmatter, metadata, system prompt,
 * contexts, and optional sections.
 * 
 * This represents the full agent definition after parsing an agent file.
 */
export const OpenAgentSchema = z.object({
  frontmatter: AgentFrontmatterSchema,
  metadata: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    category: AgentCategorySchema.optional(),
    type: AgentTypeSchema.optional(),
    version: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).optional().default([]).optional(),
    dependencies: z.array(DependencyReferenceSchema).optional().default([]).optional(),
  }),
  systemPrompt: z.string(),
  contexts: z.array(ContextReferenceSchema).optional().default([]),
  sections: z.object({
    skills: z.array(z.string()).optional().default([]),
    examples: z.array(z.string()).optional().default([]),
    commands: z.array(z.string()).optional().default([]),
    workflow: z.string().optional(),
  }).optional(),
});

// ============================================================================
// Tool Configuration Schema
// ============================================================================

/**
 * Configuration file output for external tools.
 * Contains the file name, content, and encoding format.
 */
export const ToolConfigSchema = z.object({
  fileName: z.string(),
  content: z.string(),
  encoding: z.enum(["utf-8", "base64"]).optional().default("utf-8"),
});

// ============================================================================
// Type Exports (z.infer)
// ============================================================================

export type ToolAccess = z.infer<typeof ToolAccessSchema>;
export type PermissionAction = z.infer<typeof PermissionActionSchema>;
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;
/** The authored (OpenCode on-disk) permission map. Unordered — input only. */
export type PermissionMap = z.infer<typeof PermissionMapSchema>;
export type PermissionRuleEntry = z.infer<typeof PermissionRuleEntrySchema>;
export type PermissionRuleList = z.infer<typeof PermissionRuleListSchema>;
export type GranularPermissionEntry = z.infer<typeof GranularPermissionEntrySchema>;
/** Canonical ORDERED granular permissions. Array order is semantic (last-match-wins). */
export type GranularPermission = z.infer<typeof GranularPermissionSchema>;
/** Authored permission input, before desugaring. */
export type PermissionInput = z.input<typeof PermissionInputSchema>;
export type ContextPriority = z.infer<typeof ContextPrioritySchema>;
export type ContextReference = z.infer<typeof ContextReferenceSchema>;
export type DependencyReference = z.infer<typeof DependencyReferenceSchema>;
export type AgentMode = z.infer<typeof AgentModeSchema>;
export type AgentCategory = z.infer<typeof AgentCategorySchema>;
export type AgentType = z.infer<typeof AgentTypeSchema>;
export type ModelIdentifier = z.infer<typeof ModelIdentifierSchema>;
export type Temperature = z.infer<typeof TemperatureSchema>;
export type SkillReference = z.infer<typeof SkillReferenceSchema>;
export type HookEvent = z.infer<typeof HookEventSchema>;
export type HookDefinition = z.infer<typeof HookDefinitionSchema>;
export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;
export type OacId = z.infer<typeof OacIdSchema>;
export type OacCategory = z.infer<typeof OacCategorySchema>;
export type BuildTarget = z.infer<typeof BuildTargetSchema>;
export type TargetOverride = z.infer<typeof TargetOverrideSchema>;
export type TargetOverrides = z.infer<typeof TargetOverridesSchema>;
export type OacBlock = z.infer<typeof OacBlockSchema>;
/** Authored `oac:` block, before defaults are applied. */
export type OacBlockInput = z.input<typeof OacBlockSchema>;
export type CanonicalAgent = z.infer<typeof CanonicalAgentSchema>;
export type ContextProfile = z.infer<typeof ContextProfileSchema>;
export type SystemProfile = z.infer<typeof SystemProfileSchema>;
export type OpenAgent = z.infer<typeof OpenAgentSchema>;
export type ToolConfig = z.infer<typeof ToolConfigSchema>;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Describes the capabilities of a specific tool/platform that OpenAgent
 * configurations can be converted to.
 */
export interface ToolCapabilities {
  name: string;
  displayName: string;
  supportsMultipleAgents: boolean;
  supportsSkills: boolean;
  supportsHooks: boolean;
  supportsGranularPermissions: boolean;
  supportsContexts: boolean;
  supportsCustomModels: boolean;
  supportsTemperature: boolean;
  supportsMaxSteps: boolean;
  configFormat: "markdown" | "yaml" | "json" | "plain";
  outputStructure: "single-file" | "multi-file" | "directory";
  notes?: string[];
}

/**
 * Result of converting an OpenAgent configuration to another tool's format.
 * Includes the generated config files, warnings, and optional errors.
 */
export interface ConversionResult {
  success: boolean;
  configs: ToolConfig[];
  warnings: string[];
  errors?: string[];
  capabilities?: ToolCapabilities;
}
