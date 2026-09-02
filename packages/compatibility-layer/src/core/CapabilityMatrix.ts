/**
 * CapabilityMatrix - Feature compatibility matrix across platforms
 *
 * Provides a centralized registry of what features each platform supports,
 * enabling pre-conversion validation and compatibility reporting.
 *
 * @example
 * ```ts
 * const compatibility = analyzeCompatibility(agent, 'claude');
 * // => { compatible: false, warnings: [...], blockers: [...] }
 * ```
 */

import type { OpenAgent, ToolCapabilities } from "../types.js";

/**
 * Re-export only. The ordered-rule collapse lives in `Capabilities.ts`, which owns
 * last-match-wins; this file is a static per-platform support matrix and must not grow a
 * second, divergent resolver. Callers reach `degradeToBinary` here because a per-capability
 * grant is the matrix's own question ("what survives on this platform?"), answered by the
 * resolver rather than duplicated against it.
 *
 * ## Ownership (settled by subtask 07; subtask 04 flagged the overlap)
 *
 * `Capabilities.ts` is the sole IMPLEMENTATION — one resolver, one fail-closed projection.
 * This module is a re-export SURFACE and nothing more: no logic, no wrapper, no defaults.
 * The re-export is load-bearing rather than convenience —
 * `tests/unit/build/permission-ordering.test.ts` imports `degradeToBinary` from this path by
 * name and pins it to subtask 07, so deleting it would break a green gate. New code should
 * prefer importing from `./Capabilities.js` directly; adapters that need the flat-list
 * projection want `projectToFlatTools`, which is only exported there.
 */
export { degradeToBinary } from "./Capabilities.js";
export type { BinaryProjection } from "./Capabilities.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Every platform this matrix describes.
 *
 * `oac` is the IR itself — the canonical source every other column is measured against — not
 * an emitted target; it has no adapter. The rest map 1:1 onto `src/adapters/*Adapter.ts`.
 *
 * **`opencode` was absent from this union until 2026-07-15**, despite OpenCode being one of
 * the two first-class targets (`07-EXECUTION-PLAN.md`) and `OpenCodeAdapter` shipping since
 * `d100ccd`. The consequence was not cosmetic: with nowhere to be described, OpenCodeAdapter
 * hand-wrote its own `getCapabilities()` while ClaudeAdapter derived from this table — two
 * patterns, and the drift that follows. See {@link getToolCapabilities}.
 */
export type Platform = "oac" | "claude" | "opencode";

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
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "agentModes",
    category: "agents",
    description: "Primary/subagent mode distinction",
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "agentCategories",
    category: "agents",
    description: "Agent categorization (core, development, etc.)",
    // Claude Code agent frontmatter has no category field — the canonical `oac.category`
    // survives only as the directory an author happens to file the source under, and is not
    // carried into the emitted agent at all.
    //
    // OpenCode strips the `oac:` block too, so `category` is likewise not a frontmatter field
    // there — but its agents are emitted to `.opencode/agent/<category>/<name>.md`, mirroring
    // content/agents/, so the category survives structurally and round-trips via the path.
    // Claude's are flat (`plugins/claude-code/agents/<id>.md`), so it is lost outright.
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: {
      claude: "No category field in agent frontmatter — dropped on emit",
      opencode: "Carried as the agent's directory (.opencode/agent/<category>/), not a field",
    },
  },

  // Permission Features
  //
  // OpenCode scores "full" across this whole category for one reason: the canonical
  // `permission:` block IS OpenCode's own field. There is no projection on that path —
  // OpenCodeAdapter emits the rules verbatim and OpenCode resolves them last-match-wins.
  // Every other target is measured by how much of that shape it loses.
  {
    name: "granularPermissions",
    category: "permissions",
    description: "Fine-grained allow/deny/ask patterns",
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: {
      claude:
        "tools/disallowedTools are flat name lists — a capability is wholly granted or " +
        "wholly denied, so anything scoped degrades fail-closed to disallowedTools",
    },
  },
  {
    name: "orderedPermissionRules",
    category: "permissions",
    description: "Ordered rule lists resolved last-match-wins (deny-all-then-allowlist)",
    // The central fact of the canonical refactor, and previously unrepresented here: the
    // shipped agents' security posture IS the rule order (`bash: {"*": deny, "git log*":
    // allow}`). A target scoring "none" cannot carry that shape at all, which is why
    // Capabilities.degradeToBinary refuses it rather than picking a winning rule.
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: {
      claude: "No rule ordering concept — the allowlist cannot be carried, so Bash is denied",
      opencode: "Rules keep their authored order; OpenCode resolves them last-match-wins",
    },
  },
  {
    name: "askPermissions",
    category: "permissions",
    description: "Interactive permission requests",
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: {
      claude: "No 'ask' in agent frontmatter — degrades to deny, never to allow",
    },
  },
  {
    name: "pathPatterns",
    category: "permissions",
    description: "Glob patterns for file permissions",
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: {
      claude: "Tool grants carry no path scope — secret-file denies cannot be expressed",
    },
  },

  // Tool Features
  {
    name: "binaryToolGrants",
    category: "tools",
    description: "Flat allow/deny lists of tool names (tools / disallowedTools)",
    // What Claude Code DOES support, stated positively — this is the entire target surface
    // ClaudeAdapter emits into, and the matrix previously described only what was missing.
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "taskDelegation",
    category: "tools",
    description: "Agent-to-agent task delegation",
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "bashExecution",
    category: "tools",
    description: "Shell command execution",
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "fileOperations",
    category: "tools",
    description: "Read/write/edit file operations",
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "searchOperations",
    category: "tools",
    description: "Grep/glob search operations",
    support: { oac: "full", claude: "full", opencode: "full" },
  },

  // Context Features
  {
    name: "externalContext",
    category: "context",
    description: "External context file references",
    // Ruled 2026-07-15: the feature is external *references*; inlining bytes is degradation.
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "contextPriority",
    category: "context",
    description: "Priority levels for context loading",
    // OpenCode installs context files byte-for-byte, so the MVI header that carries the level
    // (`<!-- Context: … | Priority: critical | … -->`) survives verbatim in .opencode/context/.
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: { opencode: "MVI priority header survives verbatim in the installed context file" },
  },
  {
    name: "contextSubdirs",
    category: "context",
    description: "Nested context directory structure",
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "skillsSystem",
    category: "context",
    description: "Loadable skill modules",
    support: { oac: "full", claude: "full", opencode: "full" },
  },

  // Model Features
  {
    name: "modelSelection",
    category: "model",
    description: "Custom model selection",
    support: { oac: "full", claude: "full", opencode: "full" },
  },
  {
    name: "temperatureControl",
    category: "model",
    description: "Temperature parameter control",
    // opencode "full" verified against disk: real agents carry the field
    // (.opencode/agent/eval-runner.md, subagents/system-builder/command-creator.md).
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: {
      claude: "Temperature not configurable",
    },
  },
  {
    name: "maxSteps",
    category: "model",
    description: "Maximum execution steps limit",
    // opencode "full" verified against disk — same agents as temperatureControl.
    support: { oac: "full", claude: "none", opencode: "full" },
  },

  // Advanced Features
  {
    name: "hooks",
    category: "advanced",
    description: "Event hooks (PreToolUse, PostToolUse, etc.)",
    // opencode "none": .opencode/plugin/ holds plugins (agent-validator.ts), which are a
    // different mechanism — there is no PreToolUse/PostToolUse event surface to emit into.
    // Matches OpenCodeAdapter's own long-standing `supportsHooks: false`.
    support: { oac: "full", claude: "full", opencode: "none" },
    notes: {
      opencode: "Plugins (.opencode/plugin/) are a different mechanism, not event hooks",
    },
  },
  {
    name: "dependencies",
    category: "advanced",
    description: "Agent dependency declarations",
    // Claude Code agent frontmatter accepts name/description/tools/disallowedTools/model and
    // nothing else. `oac.dependencies` is resolved at build time and then dropped; the
    // emitted agent declares no dependencies, so "full" overstated this.
    //
    // OpenCode is "none" for the same reason, which is easy to miss because OpenCode is the
    // canonical target: `dependencies` lives in the `oac:` block, and OpenCodeAdapter strips
    // that block on emit. Being lossless about OpenCode's OWN fields does not make it
    // lossless about OAC's.
    support: { oac: "full", claude: "none", opencode: "none" },
    notes: {
      claude: "Dependencies resolve at build time; not carried in agent frontmatter",
      opencode: "Declared in the oac: block, which is stripped on emit; resolved at build time",
    },
  },
  {
    name: "priorityLevels",
    category: "advanced",
    description: "Task priority levels",
    // "2 levels" was not a Claude Code feature — nothing in agent frontmatter or the plugin
    // format expresses task priority.
    //
    // FIXME(2026-07-15): this row describes a concept that does not exist. `types.ts` has only
    // ContextPrioritySchema — CONTEXT priority — whose four levels (critical/high/medium/low)
    // are almost certainly the "4 levels" the oac note means. There is no task-priority field
    // anywhere in the canonical schema, which makes this row a mis-named duplicate of
    // `contextPriority`. Left as-is deliberately: deciding whether to delete it or rename it is
    // a separate call, and folding that into an opencode-gap fix would bury it.
    support: { oac: "full", claude: "none", opencode: "full" },
    notes: {
      oac: "4 levels",
      claude: "No task priority concept",
      opencode: "Tracks contextPriority — see the FIXME on this row",
    },
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
    opencode: "OpenCode",
  };

  const configFormats: Record<Exclude<Platform, "oac">, ToolCapabilities["configFormat"]> = {
    // Claude Code agents are markdown files with YAML frontmatter
    // (`plugins/claude-code/agents/<id>.md`). This row previously read "json" on the
    // reasoning that `settings.json` is JSON — but settings.json is not what any adapter
    // emits, and ClaudeAdapter.getCapabilities() simultaneously reported "markdown". One
    // platform cannot have two answers about itself; the emitted artifact decides.
    claude: "markdown",
    // Agent files are markdown with YAML frontmatter, emitted to
    // .opencode/agent/<category>/<name>.md.
    opencode: "markdown",
  };

  const outputStructures: Record<
    Exclude<Platform, "oac">,
    ToolCapabilities["outputStructure"]
  > = {
    claude: "directory",
    opencode: "directory",
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
