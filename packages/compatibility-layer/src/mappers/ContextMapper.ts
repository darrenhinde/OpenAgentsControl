/**
 * ContextMapper - Maps context file paths between OAC and other platforms
 *
 * Different tools store context/skills in different locations with different
 * naming conventions. This mapper handles path translation.
 *
 * @example
 * ```ts
 * mapContextPathFromOAC('.opencode/context/core/standards.md', 'claude')
 * // => { path: '.claude/skills/core-standards.md', exact: true }
 * ```
 */

import type { ContextReference, SkillReference } from "../types.js";

// ============================================================================
// Types
// ============================================================================

export type ContextPlatform = "oac" | "claude" | "cursor" | "windsurf" | "openclaw";

/**
 * Result of a context path mapping operation
 */
export interface ContextMappingResult {
  /** The mapped path */
  path: string;
  /** Whether the mapping was exact or approximated */
  exact: boolean;
  /** Warning message if mapping was degraded */
  warning?: string;
}

/**
 * Configuration for context locations per platform
 */
interface ContextConfig {
  /** Base directory for context files */
  baseDir: string;
  /** File extension for context files */
  extension: string;
  /** Supports subdirectories */
  supportsSubdirs: boolean;
  /** Supports priority metadata */
  supportsPriority: boolean;
  /** Inline-only (no external files) */
  inlineOnly: boolean;
}

// ============================================================================
// Platform Configurations
// ============================================================================

const CONTEXT_CONFIGS: Record<ContextPlatform, ContextConfig> = {
  oac: {
    baseDir: ".opencode/context",
    extension: ".md",
    supportsSubdirs: true,
    supportsPriority: true,
    inlineOnly: false,
  },
  claude: {
    baseDir: ".claude/skills",
    extension: ".md",
    supportsSubdirs: true,
    supportsPriority: false,
    inlineOnly: false,
  },
  cursor: {
    baseDir: "",
    extension: "",
    supportsSubdirs: false,
    supportsPriority: false,
    inlineOnly: true, // Cursor uses inline context in .cursorrules
  },
  windsurf: {
    baseDir: ".windsurf/context",
    extension: ".md",
    supportsSubdirs: true,
    supportsPriority: false,
    inlineOnly: false,
  },
  openclaw: {
    // OpenClaw references OAC context files in place (no copy) - same layout as oac
    baseDir: ".opencode/context",
    extension: ".md",
    supportsSubdirs: true,
    supportsPriority: true,
    inlineOnly: false,
  },
};

// ============================================================================
// Core Mapping Functions (Pure)
// ============================================================================

/**
 * Map a context file path from OAC format to a target platform format.
 *
 * @param oacPath - OAC context path (e.g., '.opencode/context/core/standards.md')
 * @param platform - Target platform
 * @returns Mapping result with platform path
 */
export function mapContextPathFromOAC(
  oacPath: string,
  platform: Exclude<ContextPlatform, "oac">
): ContextMappingResult {
  const oacConfig = CONTEXT_CONFIGS.oac;
  const targetConfig = CONTEXT_CONFIGS[platform];

  // Handle inline-only platforms
  if (targetConfig.inlineOnly) {
    return {
      path: "",
      exact: false,
      warning: `${platform} does not support external context files - content must be inline`,
    };
  }

  // Remove OAC base dir prefix
  let relativePath = oacPath;
  if (oacPath.startsWith(oacConfig.baseDir)) {
    relativePath = oacPath.slice(oacConfig.baseDir.length + 1); // +1 for the /
  }

  // Handle subdirectories
  if (!targetConfig.supportsSubdirs && relativePath.includes("/")) {
    // Flatten the path by replacing / with -
    const flatPath = relativePath.replace(/\//g, "-");
    const targetPath = `${targetConfig.baseDir}/${flatPath}`;

    return {
      path: targetPath,
      exact: false,
      warning: `${platform} does not support subdirectories - path flattened`,
    };
  }

  // Build target path
  const targetPath = targetConfig.baseDir
    ? `${targetConfig.baseDir}/${relativePath}`
    : relativePath;

  return { path: targetPath, exact: true };
}

/**
 * Map a context file path from a platform format to OAC format.
 *
 * @param platformPath - Platform context path
 * @param platform - Source platform
 * @returns Mapping result with OAC path
 */
export function mapContextPathToOAC(
  platformPath: string,
  platform: Exclude<ContextPlatform, "oac">
): ContextMappingResult {
  const sourceConfig = CONTEXT_CONFIGS[platform];
  const oacConfig = CONTEXT_CONFIGS.oac;

  // Handle inline-only platforms
  if (sourceConfig.inlineOnly) {
    return {
      path: "",
      exact: false,
      warning: `${platform} uses inline context - no path to convert`,
    };
  }

  // Remove platform base dir prefix
  let relativePath = platformPath;
  if (sourceConfig.baseDir && platformPath.startsWith(sourceConfig.baseDir)) {
    relativePath = platformPath.slice(sourceConfig.baseDir.length + 1);
  }

  // Build OAC path
  const oacPath = `${oacConfig.baseDir}/${relativePath}`;

  return { path: oacPath, exact: true };
}

// ============================================================================
// Context Reference Mapping
// ============================================================================

/**
 * Map an OAC ContextReference to a platform path.
 *
 * @param context - OAC context reference
 * @param platform - Target platform
 * @returns Mapping result
 */
export function mapContextReferenceFromOAC(
  context: ContextReference,
  platform: Exclude<ContextPlatform, "oac">
): ContextMappingResult & { priority?: string } {
  const pathResult = mapContextPathFromOAC(context.path, platform);

  // Add priority warning if target doesn't support it
  const targetConfig = CONTEXT_CONFIGS[platform];
  const warnings: string[] = [];

  if (pathResult.warning) {
    warnings.push(pathResult.warning);
  }

  if (context.priority && !targetConfig.supportsPriority) {
    warnings.push(
      `${platform} does not support priority metadata - '${context.priority}' will be ignored`
    );
  }

  return {
    path: pathResult.path,
    exact: pathResult.exact && warnings.length === 0,
    warning: warnings.length > 0 ? warnings.join("; ") : undefined,
    priority: context.priority,
  };
}

/**
 * Map multiple OAC context references to a platform.
 *
 * @param contexts - Array of OAC context references
 * @param platform - Target platform
 * @returns Object with mapped paths and warnings
 */
export function mapContextReferencesFromOAC(
  contexts: ContextReference[],
  platform: Exclude<ContextPlatform, "oac">
): { paths: string[]; warnings: string[] } {
  const paths: string[] = [];
  const warnings: string[] = [];

  for (const context of contexts) {
    const result = mapContextReferenceFromOAC(context, platform);
    if (result.path) {
      paths.push(result.path);
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  return { paths, warnings };
}

// ============================================================================
// Skill Reference Mapping (OAC → Claude)
// ============================================================================

/**
 * Map OAC skills to Claude skills format.
 *
 * @param skills - OAC skill references
 * @returns Object with Claude skill paths and warnings
 */
export function mapSkillsToClaudeFormat(
  skills: SkillReference[]
): { skills: string[]; warnings: string[] } {
  const claudeSkills: string[] = [];
  const warnings: string[] = [];

  for (const skill of skills) {
    if (typeof skill === "string") {
      // Simple string skill
      claudeSkills.push(`.claude/skills/${skill}.md`);
    } else {
      // Object skill with config
      claudeSkills.push(`.claude/skills/${skill.name}.md`);
      if (skill.config && Object.keys(skill.config).length > 0) {
        warnings.push(
          `Skill config for '${skill.name}' will be ignored - Claude skills don't support inline config`
        );
      }
    }
  }

  return { skills: claudeSkills, warnings };
}

/**
 * Map Claude skills to OAC skill references.
 *
 * @param skillPaths - Claude skill paths
 * @returns Array of OAC skill references
 */
export function mapSkillsFromClaudeFormat(
  skillPaths: string[]
): SkillReference[] {
  return skillPaths.map((path): SkillReference => {
    // Extract skill name from path
    const match = path.match(/\/([^/]+)\.md$/);
    // Use the matched name or fall back to the full path
    return match?.[1] ?? path;
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the context base directory for a platform.
 *
 * @param platform - Target platform
 * @returns Base directory path
 */
export function getContextBaseDir(platform: ContextPlatform): string {
  return CONTEXT_CONFIGS[platform].baseDir;
}

/**
 * Check if a platform supports external context files.
 *
 * @param platform - Target platform
 * @returns True if external files are supported
 */
export function supportsExternalContext(platform: ContextPlatform): boolean {
  return !CONTEXT_CONFIGS[platform].inlineOnly;
}

/**
 * Check if a platform supports context subdirectories.
 *
 * @param platform - Target platform
 * @returns True if subdirectories are supported
 */
export function supportsContextSubdirs(platform: ContextPlatform): boolean {
  return CONTEXT_CONFIGS[platform].supportsSubdirs;
}

/**
 * Check if a platform supports context priority metadata.
 *
 * @param platform - Target platform
 * @returns True if priority is supported
 */
export function supportsContextPriority(platform: ContextPlatform): boolean {
  return CONTEXT_CONFIGS[platform].supportsPriority;
}

/**
 * Create an OAC context reference.
 *
 * @param path - Context file path
 * @param priority - Optional priority level
 * @param description - Optional description
 * @returns ContextReference object
 */
export function createContextReference(
  path: string,
  priority?: "critical" | "high" | "medium" | "low",
  description?: string
): ContextReference {
  return {
    path,
    ...(priority && { priority }),
    ...(description && { description }),
  };
}

/**
 * Normalize a context path (remove redundant slashes, etc.).
 *
 * @param path - Context path to normalize
 * @returns Normalized path
 */
export function normalizeContextPath(path: string): string {
  return path
    .replace(/\/+/g, "/") // Remove duplicate slashes
    .replace(/^\//, "") // Remove leading slash
    .replace(/\/$/, ""); // Remove trailing slash
}

/**
 * Get the relative path within the context directory.
 *
 * @param fullPath - Full context file path
 * @param platform - Platform the path belongs to
 * @returns Relative path within context directory
 */
export function getRelativeContextPath(
  fullPath: string,
  platform: ContextPlatform
): string {
  const baseDir = CONTEXT_CONFIGS[platform].baseDir;
  if (baseDir && fullPath.startsWith(baseDir)) {
    return fullPath.slice(baseDir.length + 1);
  }
  return fullPath;
}
