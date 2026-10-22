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
 * Permission rules can be:
 * - A literal: "allow", "deny", "ask"
 * - A boolean (true = allow, false = deny)
 * - A record mapping specific operations to permission literals
 */
export const PermissionRuleSchema = z.union([
  z.literal("allow"),
  z.literal("deny"),
  z.literal("ask"),
  z.boolean(),
  z.record(z.string(), z.union([
    z.literal("allow"),
    z.literal("deny"),
    z.literal("ask"),
  ])),
]);

/**
 * Granular permissions allow fine-grained control over different operations.
 * Maps operation names to permission rules.
 */
export const GranularPermissionSchema = z.record(z.string(), PermissionRuleSchema);

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
 *
 * NOTE: Kept as a plain string instead of a strict enum. Real OAC metadata
 * (agent-metadata.json) uses values like "core", "testing", "subagents/core",
 * "subagents/system-builder" etc. — a strict enum rejected real assets and
 * broke AgentLoader. Category is organizational metadata, not behavior.
 */
export const AgentCategorySchema = z.string();

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
  permission: GranularPermissionSchema.optional(),
  skills: z.array(SkillReferenceSchema).optional(),
  hooks: z.array(HookDefinitionSchema).optional(),
});

// ============================================================================
// Agent Metadata Schema
// ============================================================================

/**
 * Agent metadata contains identification and organizational information.
 * Stored separately from frontmatter in agent-metadata.json.
 */
export const AgentMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: AgentCategorySchema,
  type: AgentTypeSchema,
  version: z.string(),
  author: z.string(),
  tags: z.array(z.string()).optional().default([]),
  dependencies: z.array(DependencyReferenceSchema).optional().default([]),
});

// ============================================================================
// OpenAgent Schema
// ============================================================================

/**
 * Complete OpenAgent schema combining frontmatter, metadata, system prompt,
 * contexts, and optional sections.
 * 
 * This represents the full agent definition after parsing and merging all
 * configuration sources.
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
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;
export type GranularPermission = z.infer<typeof GranularPermissionSchema>;
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
export type AgentMetadata = z.infer<typeof AgentMetadataSchema>;
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
