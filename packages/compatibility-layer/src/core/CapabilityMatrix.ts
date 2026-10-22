/**
 * CapabilityMatrix - Feature compatibility matrix across platforms
 *
 * Provides a centralized registry of what features each platform supports,
 * enabling pre-conversion validation and compatibility reporting.
 *
 * @example
 * ```ts
 * const compatibility = analyzeCompatibility(agent, 'cursor');
 * // => { compatible: false, warnings: [...], blockers: [...] }
 * ```
 */

import type { OpenAgent, ToolCapabilities } from "../types.js";

// ============================================================================
// Types
// ============================================================================

export type Platform = "oac" | "claude" | "cursor" | "windsurf" | "openclaw";

/**
 * Feature categories for the capability matrix
 */
export type FeatureCategory =
  | "agents"
  | "permissions"
  | "tools"
  | "context"
  | "model"
  | "advanced";

/**
 * Support level for a feature
 */
export type SupportLevel = "full" | "partial" | "none";

/**
 * Feature definition in the capability matrix
 */
export interface FeatureDefinition {
  name: string;
  category: FeatureCategory;
  description: string;
  support: Record<Platform, SupportLevel>;
  notes?: Partial<Record<Platform, string>>;
}

/**
 * Compatibility analysis result
 */
export interface CompatibilityResult {
  /** Overall compatibility assessment */
  compatible: boolean;
  /** Score from 0-100 representing compatibility percentage */
  score: number;
  /** Warnings about features that will be degraded */
  warnings: string[];
  /** Blocking issues that prevent conversion */
  blockers: string[];
  /** Features that will be fully preserved */
  preserved: string[];
  /** Features that will be partially preserved */
  degraded: string[];
  /** Features that will be lost */
  lost: string[];
}

// ============================================================================
// Capability Matrix
// ============================================================================

/**
 * Complete feature capability matrix
 */
const CAPABILITY_MATRIX: FeatureDefinition[] = [
  // Agent Features
  {
    name: "multipleAgents",
    category: "agents",
    description: "Support for multiple agent definitions",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "full", openclaw: "full" },
    notes: { cursor: "Single .cursorrules file only - agents will be merged" },
  },
  {
    name: "agentModes",
    category: "agents",
    description: "Primary/subagent mode distinction",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "partial", openclaw: "full" },
    notes: { windsurf: "Limited mode support" },
  },
  {
    name: "agentCategories",
    category: "agents",
    description: "Agent categorization (core, development, etc.)",
    support: { oac: "full", claude: "partial", cursor: "none", windsurf: "partial", openclaw: "partial" },
  },

  // Permission Features
  {
    name: "granularPermissions",
    category: "permissions",
    description: "Fine-grained allow/deny/ask patterns",
    support: { oac: "full", claude: "none", cursor: "none", windsurf: "none", openclaw: "full" },
    notes: {
      claude: "Binary on/off only",
      cursor: "Binary on/off only",
      windsurf: "Binary on/off only",
      openclaw: "Full granular via before_tool_call hook (no degradation)",
    },
  },
  {
    name: "askPermissions",
    category: "permissions",
    description: "Interactive permission requests",
    support: { oac: "full", claude: "none", cursor: "none", windsurf: "none", openclaw: "full" },
  },
  {
    name: "pathPatterns",
    category: "permissions",
    description: "Glob patterns for file permissions",
    support: { oac: "full", claude: "none", cursor: "none", windsurf: "partial", openclaw: "full" },
  },

  // Tool Features
  {
    name: "taskDelegation",
    category: "tools",
    description: "Agent-to-agent task delegation",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "partial", openclaw: "full" },
    notes: { cursor: "No delegation support" },
  },
  {
    name: "bashExecution",
    category: "tools",
    description: "Shell command execution",
    support: { oac: "full", claude: "full", cursor: "full", windsurf: "full", openclaw: "full" },
  },
  {
    name: "fileOperations",
    category: "tools",
    description: "Read/write/edit file operations",
    support: { oac: "full", claude: "full", cursor: "full", windsurf: "full", openclaw: "full" },
  },
  {
    name: "searchOperations",
    category: "tools",
    description: "Grep/glob search operations",
    support: { oac: "full", claude: "full", cursor: "full", windsurf: "full", openclaw: "full" },
  },

  // Context Features
  {
    name: "externalContext",
    category: "context",
    description: "External context file references",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "full", openclaw: "full" },
    notes: { cursor: "Context must be inline in .cursorrules" },
  },
  {
    name: "contextPriority",
    category: "context",
    description: "Priority levels for context loading",
    support: { oac: "full", claude: "none", cursor: "none", windsurf: "none", openclaw: "full" },
  },
  {
    name: "contextSubdirs",
    category: "context",
    description: "Nested context directory structure",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "full", openclaw: "full" },
  },
  {
    name: "skillsSystem",
    category: "context",
    description: "Loadable skill modules",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "partial", openclaw: "full" },
  },

  // Model Features
  {
    name: "modelSelection",
    category: "model",
    description: "Custom model selection",
    support: { oac: "full", claude: "full", cursor: "full", windsurf: "full", openclaw: "full" },
  },
  {
    name: "temperatureControl",
    category: "model",
    description: "Temperature parameter control",
    support: { oac: "full", claude: "none", cursor: "partial", windsurf: "partial", openclaw: "full" },
    notes: {
      claude: "Temperature not configurable",
      cursor: "Limited range",
      windsurf: "Maps to creativity setting",
      openclaw: "Maps to params.temperature",
    },
  },
  {
    name: "maxSteps",
    category: "model",
    description: "Maximum execution steps limit",
    support: { oac: "full", claude: "none", cursor: "none", windsurf: "none", openclaw: "none" },
  },

  // Advanced Features
  {
    name: "hooks",
    category: "advanced",
    description: "Event hooks (PreToolUse, PostToolUse, etc.)",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "none", openclaw: "full" },
    notes: { cursor: "No hook support", windsurf: "No hook support" },
  },
  {
    name: "dependencies",
    category: "advanced",
    description: "Agent dependency declarations",
    support: { oac: "full", claude: "full", cursor: "none", windsurf: "partial", openclaw: "partial" },
  },
  {
    name: "priorityLevels",
    category: "advanced",
    description: "Task priority levels",
    support: { oac: "full", claude: "partial", cursor: "none", windsurf: "partial", openclaw: "partial" },
    notes: { oac: "4 levels", claude: "2 levels", windsurf: "2 levels" },
  },
];

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the full capability matrix.
 *
 * @returns Array of all feature definitions
 */
export function getCapabilityMatrix(): FeatureDefinition[] {
  return [...CAPABILITY_MATRIX];
}

/**
 * Get features by category.
 *
 * @param category - Feature category to filter by
 * @returns Array of features in that category
 */
export function getFeaturesByCategory(
  category: FeatureCategory
): FeatureDefinition[] {
  return CAPABILITY_MATRIX.filter((f) => f.category === category);
}

/**
 * Get the support level for a specific feature on a platform.
 *
 * @param featureName - Name of the feature
 * @param platform - Target platform
 * @returns Support level or undefined if feature not found
 */
export function getFeatureSupport(
  featureName: string,
  platform: Platform
): SupportLevel | undefined {
  const feature = CAPABILITY_MATRIX.find((f) => f.name === featureName);
  return feature?.support[platform];
}

/**
 * Check if a feature is fully supported on a platform.
 *
 * @param featureName - Name of the feature
 * @param platform - Target platform
 * @returns True if fully supported
 */
export function isFeatureSupported(
  featureName: string,
  platform: Platform
): boolean {
  return getFeatureSupport(featureName, platform) === "full";
}

// ============================================================================
// Compatibility Analysis
// ============================================================================

/**
 * Analyze compatibility of an OpenAgent with a target platform.
 *
 * @param agent - The OpenAgent to analyze
 * @param targetPlatform - Target platform for conversion
 * @returns Detailed compatibility analysis
 */
export function analyzeCompatibility(
  agent: OpenAgent,
  targetPlatform: Exclude<Platform, "oac">
): CompatibilityResult {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const preserved: string[] = [];
  const degraded: string[] = [];
  const lost: string[] = [];

  // Check agent mode
  if (agent.frontmatter.mode === "subagent") {
    const modeSupport = getFeatureSupport("agentModes", targetPlatform);
    if (modeSupport === "none") {
      warnings.push(`Agent mode 'subagent' not supported by ${targetPlatform}`);
      degraded.push("agentModes");
    } else if (modeSupport === "partial") {
      warnings.push(`Agent mode may have limited support on ${targetPlatform}`);
      degraded.push("agentModes");
    } else {
      preserved.push("agentModes");
    }
  }

  // Check temperature
  if (agent.frontmatter.temperature !== undefined) {
    const tempSupport = getFeatureSupport("temperatureControl", targetPlatform);
    if (tempSupport === "none") {
      warnings.push(
        `Temperature setting (${agent.frontmatter.temperature}) will be ignored by ${targetPlatform}`
      );
      lost.push("temperatureControl");
    } else if (tempSupport === "partial") {
      warnings.push(`Temperature will be approximated on ${targetPlatform}`);
      degraded.push("temperatureControl");
    } else {
      preserved.push("temperatureControl");
    }
  }

  // Check hooks
  if (agent.frontmatter.hooks && agent.frontmatter.hooks.length > 0) {
    const hookSupport = getFeatureSupport("hooks", targetPlatform);
    if (hookSupport === "none") {
      blockers.push(
        `Hooks are not supported by ${targetPlatform} - ${agent.frontmatter.hooks.length} hook(s) will be lost`
      );
      lost.push("hooks");
    } else {
      preserved.push("hooks");
    }
  }

  // Check skills
  if (agent.frontmatter.skills && agent.frontmatter.skills.length > 0) {
    const skillSupport = getFeatureSupport("skillsSystem", targetPlatform);
    if (skillSupport === "none") {
      warnings.push(
        `Skills system not supported by ${targetPlatform} - skills will be converted to inline context`
      );
      degraded.push("skillsSystem");
    } else if (skillSupport === "partial") {
      warnings.push(`Skills may have limited functionality on ${targetPlatform}`);
      degraded.push("skillsSystem");
    } else {
      preserved.push("skillsSystem");
    }
  }

  // Check granular permissions
  if (agent.frontmatter.permission) {
    const hasGranular = Object.values(agent.frontmatter.permission).some(
      (rule) => typeof rule === "object" && rule !== null
    );
    if (hasGranular) {
      const permSupport = getFeatureSupport("granularPermissions", targetPlatform);
      if (permSupport === "none") {
        warnings.push(
          `Granular permissions will be simplified to binary allow/deny for ${targetPlatform}`
        );
        degraded.push("granularPermissions");
      }
    }
  }

  // Check contexts
  if (agent.contexts && agent.contexts.length > 0) {
    const contextSupport = getFeatureSupport("externalContext", targetPlatform);
    if (contextSupport === "none") {
      warnings.push(
        `External context files not supported by ${targetPlatform} - content must be inline`
      );
      degraded.push("externalContext");
    } else {
      preserved.push("externalContext");
    }

    // Check priority
    const hasPriority = agent.contexts.some((c) => c.priority);
    if (hasPriority) {
      const prioritySupport = getFeatureSupport("contextPriority", targetPlatform);
      if (prioritySupport === "none") {
        warnings.push(`Context priority metadata will be ignored by ${targetPlatform}`);
        lost.push("contextPriority");
      }
    }
  }

  // Check maxSteps
  if (agent.frontmatter.maxSteps !== undefined) {
    const stepsSupport = getFeatureSupport("maxSteps", targetPlatform);
    if (stepsSupport === "none") {
      warnings.push(`maxSteps setting will be ignored by ${targetPlatform}`);
      lost.push("maxSteps");
    }
  }

  // Calculate compatibility score
  const totalFeatures = preserved.length + degraded.length + lost.length;
  const score =
    totalFeatures > 0
      ? Math.round(
          ((preserved.length + degraded.length * 0.5) / totalFeatures) * 100
        )
      : 100;

  return {
    compatible: blockers.length === 0,
    score,
    warnings,
    blockers,
    preserved,
    degraded,
    lost,
  };
}

// ============================================================================
// ToolCapabilities Generation
// ============================================================================

/**
 * Generate a ToolCapabilities object for a platform.
 *
 * @param platform - Target platform
 * @returns ToolCapabilities object
 */
export function getToolCapabilities(
  platform: Exclude<Platform, "oac">
): ToolCapabilities {
  const displayNames: Record<Exclude<Platform, "oac">, string> = {
    claude: "Claude Code",
    cursor: "Cursor IDE",
    windsurf: "Windsurf",
    openclaw: "OpenClaw",
  };

  const configFormats: Record<Exclude<Platform, "oac">, ToolCapabilities["configFormat"]> = {
    claude: "json",
    cursor: "plain",
    windsurf: "json",
    openclaw: "json",
  };

  const outputStructures: Record<
    Exclude<Platform, "oac">,
    ToolCapabilities["outputStructure"]
  > = {
    claude: "directory",
    cursor: "single-file",
    windsurf: "directory",
    openclaw: "directory",
  };

  return {
    name: platform,
    displayName: displayNames[platform],
    supportsMultipleAgents: isFeatureSupported("multipleAgents", platform),
    supportsSkills: getFeatureSupport("skillsSystem", platform) !== "none",
    supportsHooks: isFeatureSupported("hooks", platform),
    supportsGranularPermissions: isFeatureSupported("granularPermissions", platform),
    supportsContexts: getFeatureSupport("externalContext", platform) !== "none",
    supportsCustomModels: isFeatureSupported("modelSelection", platform),
    supportsTemperature: getFeatureSupport("temperatureControl", platform) !== "none",
    supportsMaxSteps: isFeatureSupported("maxSteps", platform),
    configFormat: configFormats[platform],
    outputStructure: outputStructures[platform],
  };
}

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Compare two platforms' capabilities.
 *
 * @param platformA - First platform
 * @param platformB - Second platform
 * @returns Comparison showing which features differ
 */
export function comparePlatforms(
  platformA: Platform,
  platformB: Platform
): {
  identical: string[];
  betterInA: string[];
  betterInB: string[];
  different: string[];
} {
  const identical: string[] = [];
  const betterInA: string[] = [];
  const betterInB: string[] = [];
  const different: string[] = [];

  const supportOrder: Record<SupportLevel, number> = {
    full: 2,
    partial: 1,
    none: 0,
  };

  for (const feature of CAPABILITY_MATRIX) {
    const supportA = feature.support[platformA];
    const supportB = feature.support[platformB];

    if (supportA === supportB) {
      identical.push(feature.name);
    } else {
      different.push(feature.name);
      if (supportOrder[supportA] > supportOrder[supportB]) {
        betterInA.push(feature.name);
      } else {
        betterInB.push(feature.name);
      }
    }
  }

  return { identical, betterInA, betterInB, different };
}

/**
 * Get a summary of what will happen during conversion.
 *
 * @param sourcePlatform - Source platform
 * @param targetPlatform - Target platform
 * @returns Human-readable summary
 */
export function getConversionSummary(
  sourcePlatform: Platform,
  targetPlatform: Platform
): string[] {
  const comparison = comparePlatforms(sourcePlatform, targetPlatform);
  const summary: string[] = [];

  if (comparison.betterInA.length > 0) {
    summary.push(
      `Features that may be degraded: ${comparison.betterInA.join(", ")}`
    );
  }

  if (comparison.betterInB.length > 0) {
    summary.push(
      `Features that may be enhanced: ${comparison.betterInB.join(", ")}`
    );
  }

  if (comparison.identical.length === CAPABILITY_MATRIX.length) {
    summary.push("Full feature parity - no degradation expected");
  }

  return summary;
}
