/**
 * TranslationEngine - Orchestrates all mappers for agent conversion
 *
 * The TranslationEngine coordinates ToolMapper, PermissionMapper, ModelMapper,
 * ContextMapper, and CapabilityMatrix to provide complete agent translation
 * between OAC and other platforms.
 *
 * @example
 * ```ts
 * const engine = new TranslationEngine();
 * const result = engine.translate(agent, 'cursor');
 * // => { agent: translatedAgent, warnings: [...], compatible: true }
 * ```
 */

import type {
  OpenAgent,
  AgentFrontmatter,
  ToolAccess,
  GranularPermission,
  ContextReference,
  SkillReference,
} from "../types.js";

import {
  mapToolAccessFromOAC,
  mapToolAccessToOAC,
} from "../mappers/ToolMapper.js";

import {
  mapPermissionsFromOAC,
  mapPermissionsToOAC,
  type DegradationStrategy,
  type BinaryPermissions,
} from "../mappers/PermissionMapper.js";

import {
  mapModelFromOAC,
  mapModelToOAC,
} from "../mappers/ModelMapper.js";

import {
  mapContextReferencesFromOAC,
  mapContextPathToOAC,
  mapSkillsToClaudeFormat,
  mapSkillsFromClaudeFormat,
} from "../mappers/ContextMapper.js";

import {
  analyzeCompatibility,
  getToolCapabilities,
  type Platform,
  type CompatibilityResult,
} from "../core/CapabilityMatrix.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Target platform for translation (excludes OAC since we translate TO/FROM OAC)
 */
export type TranslationTarget = Exclude<Platform, "oac">;

/**
 * Configuration options for translation
 */
export interface TranslationOptions {
  /** Strategy for handling 'ask' permissions (default: 'permissive') */
  permissionStrategy?: DegradationStrategy;
  /** Whether to include compatibility analysis (default: true) */
  analyzeCompatibility?: boolean;
  /** Whether to preserve unsupported features as comments (default: false) */
  preserveAsComments?: boolean;
  /** Custom model fallback if model not available on target */
  modelFallback?: string;
}

/**
 * Result of translating an agent
 */
export interface TranslationResult {
  /** The translated agent frontmatter */
  frontmatter: Partial<AgentFrontmatter>;
  /** Translated tools (platform format) */
  tools?: Record<string, boolean>;
  /** Translated permissions (platform format) */
  permissions?: BinaryPermissions;
  /** Translated model ID */
  model?: string;
  /** Translated context paths */
  contextPaths?: string[];
  /** Translated skills (for Claude) */
  skills?: string[];
  /** All warnings generated during translation */
  warnings: string[];
  /** Compatibility analysis result */
  compatibility?: CompatibilityResult;
  /** Whether translation was successful */
  success: boolean;
}

/**
 * Result of translating from a platform back to OAC
 */
export interface ReverseTranslationResult {
  /** Partial OAC agent that can be merged */
  agent: Partial<OpenAgent>;
  /** Warnings generated during translation */
  warnings: string[];
  /** Whether translation was successful */
  success: boolean;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<TranslationOptions> = {
  permissionStrategy: "permissive",
  analyzeCompatibility: true,
  preserveAsComments: false,
  modelFallback: "claude-sonnet-4",
};

// ============================================================================
// TranslationEngine Class
// ============================================================================

/**
 * Engine that orchestrates all mappers for complete agent translation.
 */
export class TranslationEngine {
  private options: Required<TranslationOptions>;

  constructor(options: TranslationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ==========================================================================
  // OAC → Platform Translation
  // ==========================================================================

  /**
   * Translate an OpenAgent to a target platform format.
   *
   * @param agent - The OpenAgent to translate
   * @param target - Target platform
   * @param options - Override default options
   * @returns Translation result
   */
  translate(
    agent: OpenAgent,
    target: TranslationTarget,
    options?: TranslationOptions
  ): TranslationResult {
    const opts = { ...this.options, ...options };
    const warnings: string[] = [];

    // Analyze compatibility first
    let compatibility: CompatibilityResult | undefined;
    if (opts.analyzeCompatibility) {
      compatibility = analyzeCompatibility(agent, target);
      warnings.push(...compatibility.warnings);
    }

    // Translate tools
    let tools: Record<string, boolean> | undefined;
    if (agent.frontmatter.tools) {
      const toolResult = mapToolAccessFromOAC(
        agent.frontmatter.tools,
        target
      );
      tools = toolResult.tools;
      warnings.push(...toolResult.warnings);
    }

    // Translate permissions
    let permissions: BinaryPermissions | undefined;
    if (agent.frontmatter.permission) {
      const permResult = mapPermissionsFromOAC(
        agent.frontmatter.permission,
        target,
        opts.permissionStrategy
      );
      permissions = permResult.permissions as BinaryPermissions;
      warnings.push(...permResult.warnings);
    }

    // Translate model
    let model: string | undefined;
    if (agent.frontmatter.model) {
      const modelResult = mapModelFromOAC(
        agent.frontmatter.model,
        target
      );
      model = modelResult.id;
      if (modelResult.warning) {
        warnings.push(modelResult.warning);
      }
    }

    // Translate contexts
    let contextPaths: string[] | undefined;
    if (agent.contexts && agent.contexts.length > 0) {
      const contextResult = mapContextReferencesFromOAC(
        agent.contexts,
        target
      );
      contextPaths = contextResult.paths;
      warnings.push(...contextResult.warnings);
    }

    // Translate skills (Claude/OpenClaw-specific)
    let skills: string[] | undefined;
    if ((target === "claude" || target === "openclaw") && agent.frontmatter.skills) {
      const skillResult = mapSkillsToClaudeFormat(agent.frontmatter.skills);
      skills = skillResult.skills;
      warnings.push(...skillResult.warnings);
    }

    // Build translated frontmatter
    const frontmatter: Partial<AgentFrontmatter> = {
      name: agent.frontmatter.name,
      description: agent.frontmatter.description,
      mode: agent.frontmatter.mode,
    };

    // Include temperature if supported
    if (agent.frontmatter.temperature !== undefined) {
      const capabilities = getToolCapabilities(target);
      if (capabilities.supportsTemperature) {
        frontmatter.temperature = agent.frontmatter.temperature;
      }
    }

    return {
      frontmatter,
      tools,
      permissions,
      model,
      contextPaths,
      skills,
      warnings,
      compatibility,
      success: !compatibility || compatibility.compatible,
    };
  }

  // ==========================================================================
  // Platform → OAC Translation
  // ==========================================================================

  /**
   * Translate from a platform format back to OAC format.
   *
   * @param source - Platform-specific agent data
   * @param platform - Source platform
   * @returns Partial OpenAgent that can be merged
   */
  translateToOAC(
    source: {
      name?: string;
      description?: string;
      tools?: Record<string, boolean>;
      permissions?: BinaryPermissions;
      model?: string;
      contextPaths?: string[];
      skills?: string[];
      systemPrompt?: string;
    },
    platform: TranslationTarget
  ): ReverseTranslationResult {
    const warnings: string[] = [];

    // Translate tools
    let oacTools: ToolAccess | undefined;
    if (source.tools) {
      const toolResult = mapToolAccessToOAC(source.tools, platform);
      oacTools = toolResult.tools;
      warnings.push(...toolResult.warnings);
    }

    // Translate permissions
    let oacPermissions: GranularPermission | undefined;
    if (source.permissions) {
      const permResult = mapPermissionsToOAC(
        source.permissions,
        platform
      );
      oacPermissions = permResult.permissions as GranularPermission;
      warnings.push(...permResult.warnings);
    }

    // Translate model
    let oacModel: string | undefined;
    if (source.model) {
      const modelResult = mapModelToOAC(source.model, platform);
      oacModel = modelResult.id;
      if (modelResult.warning) {
        warnings.push(modelResult.warning);
      }
    }

    // Translate context paths
    let oacContexts: ContextReference[] | undefined;
    if (source.contextPaths && source.contextPaths.length > 0) {
      oacContexts = source.contextPaths.map((path) => {
        const result = mapContextPathToOAC(path, platform);
        if (result.warning) {
          warnings.push(result.warning);
        }
        return { path: result.path };
      });
    }

    // Translate skills (from Claude format)
    let oacSkills: SkillReference[] | undefined;
    if (platform === "claude" && source.skills) {
      oacSkills = mapSkillsFromClaudeFormat(source.skills);
    }

    // Build partial OpenAgent
    const agent: Partial<OpenAgent> = {
      frontmatter: {
        name: source.name || "Unnamed Agent",
        description: source.description || "Imported agent",
        mode: "primary",
        ...(oacTools && { tools: oacTools }),
        ...(oacPermissions && { permission: oacPermissions }),
        ...(oacModel && { model: oacModel }),
        ...(oacSkills && { skills: oacSkills }),
      },
      ...(source.systemPrompt && { systemPrompt: source.systemPrompt }),
      ...(oacContexts && { contexts: oacContexts }),
    };

    return {
      agent,
      warnings,
      success: true,
    };
  }

  // ==========================================================================
  // Batch Translation
  // ==========================================================================

  /**
   * Translate multiple agents to a target platform.
   *
   * @param agents - Array of OpenAgents to translate
   * @param target - Target platform
   * @returns Array of translation results
   */
  translateBatch(
    agents: OpenAgent[],
    target: TranslationTarget
  ): TranslationResult[] {
    return agents.map((agent) => this.translate(agent, target));
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get a preview of what will happen during translation without actually translating.
   *
   * @param agent - The agent to preview
   * @param target - Target platform
   * @returns Compatibility analysis
   */
  preview(agent: OpenAgent, target: TranslationTarget): CompatibilityResult {
    return analyzeCompatibility(agent, target);
  }

  /**
   * Check if an agent can be translated to a target with full fidelity.
   *
   * @param agent - The agent to check
   * @param target - Target platform
   * @returns True if no features will be lost
   */
  isFullyCompatible(agent: OpenAgent, target: TranslationTarget): boolean {
    const result = analyzeCompatibility(agent, target);
    return result.lost.length === 0 && result.degraded.length === 0;
  }

  /**
   * Get the current translation options.
   *
   * @returns Current options
   */
  getOptions(): Required<TranslationOptions> {
    return { ...this.options };
  }

  /**
   * Update translation options.
   *
   * @param options - Options to merge
   */
  setOptions(options: TranslationOptions): void {
    this.options = { ...this.options, ...options };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a TranslationEngine with default options.
 *
 * @returns New TranslationEngine instance
 */
export function createTranslationEngine(
  options?: TranslationOptions
): TranslationEngine {
  return new TranslationEngine(options);
}

/**
 * Quick translate function for one-off translations.
 *
 * @param agent - Agent to translate
 * @param target - Target platform
 * @param options - Translation options
 * @returns Translation result
 */
export function translate(
  agent: OpenAgent,
  target: TranslationTarget,
  options?: TranslationOptions
): TranslationResult {
  const engine = new TranslationEngine(options);
  return engine.translate(agent, target);
}

/**
 * Quick preview function for one-off compatibility checks.
 *
 * @param agent - Agent to preview
 * @param target - Target platform
 * @returns Compatibility result
 */
export function previewTranslation(
  agent: OpenAgent,
  target: TranslationTarget
): CompatibilityResult {
  return analyzeCompatibility(agent, target);
}
