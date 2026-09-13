/**
 * PermissionMapper - Translates permissions between OAC granular and tool binary formats
 *
 * OAC supports granular permissions with allow/deny/ask patterns.
 * Most other tools only support binary (on/off) permissions.
 * This mapper handles the translation with graceful degradation.
 *
 * @example
 * ```ts
 * // OAC granular → Claude binary
 * mapPermissionsFromOAC({ bash: { "rm *": "deny", "*": "allow" } }, 'claude')
 * // => { bash: true, warnings: ["Granular bash permissions degraded to binary"] }
 * ```
 */

import type { PermissionMap, PermissionRule } from "../types.js";

// ============================================================================
// Types
// ============================================================================

export type PermissionPlatform = "oac" | "claude";

/**
 * Binary permission representation used by most tools
 */
export interface BinaryPermissions {
  read?: boolean;
  write?: boolean;
  edit?: boolean;
  bash?: boolean;
  task?: boolean;
  grep?: boolean;
  glob?: boolean;
}

/**
 * Result of permission mapping
 */
export interface PermissionMappingResult {
  permissions: BinaryPermissions | PermissionMap;
  warnings: string[];
}

/**
 * Permission strategy when converting from granular to binary
 */
export type DegradationStrategy = "permissive" | "restrictive" | "ask-as-deny";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Platform-specific permission capabilities
 */
const PLATFORM_CAPABILITIES: Record<
  Exclude<PermissionPlatform, "oac">,
  { supportsGranular: boolean; supportsAsk: boolean }
> = {
  claude: { supportsGranular: false, supportsAsk: false },
};

// ============================================================================
// Core Mapping Functions (Pure)
// ============================================================================

/**
 * Resolve a single permission rule to a boolean value.
 *
 * @param rule - Permission rule (allow/deny/ask/boolean/record)
 * @param strategy - How to handle 'ask' permissions
 * @returns Boolean permission value
 */
export function resolvePermissionRule(
  rule: PermissionRule,
  strategy: DegradationStrategy = "permissive"
): boolean {
  // Handle boolean directly
  if (typeof rule === "boolean") {
    return rule;
  }

  // Handle literal strings
  if (rule === "allow") return true;
  if (rule === "deny") return false;
  if (rule === "ask") {
    switch (strategy) {
      case "permissive":
        return true;
      case "restrictive":
      case "ask-as-deny":
        return false;
    }
  }

  // Handle record (complex granular rules)
  if (typeof rule === "object" && rule !== null) {
    // Check if there's any "allow" in the record
    const values = Object.values(rule);
    const hasAllow = values.some((v) => v === "allow");
    const hasDeny = values.some((v) => v === "deny");

    switch (strategy) {
      case "permissive":
        return hasAllow || !hasDeny;
      case "restrictive":
        return hasAllow && !hasDeny;
      case "ask-as-deny":
        return hasAllow && !hasDeny;
    }
  }

  // Default to permissive
  return true;
}

/**
 * Check if a permission rule is granular (not simple boolean/literal).
 */
export function isGranularRule(rule: PermissionRule): boolean {
  if (typeof rule === "boolean") return false;
  if (rule === "allow" || rule === "deny" || rule === "ask") return false;
  return typeof rule === "object" && rule !== null;
}

/**
 * Map OAC granular permissions to binary permissions for a target platform.
 *
 * @param permissions - OAC granular permissions
 * @param platform - Target platform
 * @param strategy - How to handle 'ask' and granular rules
 * @returns Binary permissions with warnings
 */
export function mapPermissionsFromOAC(
  permissions: PermissionMap,
  platform: Exclude<PermissionPlatform, "oac">,
  strategy: DegradationStrategy = "permissive"
): PermissionMappingResult {
  const capabilities = PLATFORM_CAPABILITIES[platform];
  const result: BinaryPermissions = {};
  const warnings: string[] = [];

  for (const [tool, rule] of Object.entries(permissions)) {
    // Check for granular permission degradation
    if (isGranularRule(rule) && !capabilities.supportsGranular) {
      warnings.push(
        `⚠️  Granular '${tool}' permissions degraded to binary for ${platform}`
      );
    }

    // Check for 'ask' permission degradation
    if (rule === "ask" && !capabilities.supportsAsk) {
      const action = strategy === "permissive" ? "allowed" : "denied";
      warnings.push(
        `⚠️  Permission '${tool}: ask' converted to '${action}' for ${platform}`
      );
    }

    // Resolve to boolean
    const boolValue = resolvePermissionRule(rule, strategy);
    (result as Record<string, boolean>)[tool] = boolValue;
  }

  return { permissions: result, warnings };
}

/**
 * Map binary permissions to OAC granular format.
 * Since binary is a subset of granular, this is a straightforward conversion.
 *
 * @param permissions - Binary permissions from another tool
 * @param platform - Source platform
 * @returns Granular permissions (no warnings needed for upgrade)
 */
export function mapPermissionsToOAC(
  permissions: BinaryPermissions,
  _platform: Exclude<PermissionPlatform, "oac">
): PermissionMappingResult {
  const result: PermissionMap = {};

  for (const [tool, enabled] of Object.entries(permissions)) {
    if (enabled !== undefined) {
      result[tool] = enabled ? "allow" : "deny";
    }
  }

  return { permissions: result, warnings: [] };
}

// ============================================================================
// Granular Permission Utilities
// ============================================================================

/**
 * Create a granular permission rule from patterns.
 *
 * @param allow - Patterns to allow
 * @param deny - Patterns to deny
 * @param ask - Patterns that require confirmation
 * @returns Granular permission rule
 */
export function createGranularRule(
  allow: string[] = [],
  deny: string[] = [],
  ask: string[] = []
): PermissionRule {
  const rule: Record<string, "allow" | "deny" | "ask"> = {};

  for (const pattern of allow) {
    rule[pattern] = "allow";
  }
  for (const pattern of deny) {
    rule[pattern] = "deny";
  }
  for (const pattern of ask) {
    rule[pattern] = "ask";
  }

  return rule;
}

/**
 * Extract patterns from a granular permission rule.
 *
 * @param rule - Granular permission rule
 * @returns Object with allow, deny, and ask patterns
 */
export function extractPatterns(rule: PermissionRule): {
  allow: string[];
  deny: string[];
  ask: string[];
} {
  const result = { allow: [] as string[], deny: [] as string[], ask: [] as string[] };

  if (typeof rule === "boolean") {
    result[rule ? "allow" : "deny"].push("*");
    return result;
  }

  if (rule === "allow" || rule === "deny" || rule === "ask") {
    result[rule].push("*");
    return result;
  }

  if (typeof rule === "object" && rule !== null) {
    for (const [pattern, permission] of Object.entries(rule)) {
      if (permission === "allow" || permission === "deny" || permission === "ask") {
        result[permission].push(pattern);
      }
    }
  }

  return result;
}

/**
 * Merge multiple permission rules into one.
 * Later rules override earlier ones for the same patterns.
 *
 * @param rules - Permission rules to merge
 * @returns Merged permission rule
 */
export function mergePermissionRules(...rules: PermissionRule[]): PermissionRule {
  const merged: Record<string, "allow" | "deny" | "ask"> = {};

  for (const rule of rules) {
    const patterns = extractPatterns(rule);

    for (const pattern of patterns.allow) {
      merged[pattern] = "allow";
    }
    for (const pattern of patterns.deny) {
      merged[pattern] = "deny";
    }
    for (const pattern of patterns.ask) {
      merged[pattern] = "ask";
    }
  }

  // Simplify if only one universal pattern
  const keys = Object.keys(merged);
  if (keys.length === 1 && keys[0] === "*") {
    const value = merged["*"];
    if (value !== undefined) {
      return value;
    }
  }

  return merged;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if permissions have any granular rules that would be degraded.
 *
 * @param permissions - OAC permissions to check
 * @returns True if any granular rules exist
 */
export function hasGranularPermissions(permissions: PermissionMap): boolean {
  return Object.values(permissions).some(isGranularRule);
}

/**
 * Check if permissions have any 'ask' rules.
 *
 * @param permissions - OAC permissions to check
 * @returns True if any 'ask' rules exist
 */
export function hasAskPermissions(permissions: PermissionMap): boolean {
  const checkRule = (rule: PermissionRule): boolean => {
    if (rule === "ask") return true;
    if (typeof rule === "object" && rule !== null) {
      return Object.values(rule).some((v) => v === "ask");
    }
    return false;
  };

  return Object.values(permissions).some(checkRule);
}

/**
 * Generate warnings for permission degradation without actually converting.
 *
 * @param permissions - OAC permissions to analyze
 * @param platform - Target platform
 * @returns Array of warning messages
 */
export function analyzePermissionDegradation(
  permissions: PermissionMap,
  platform: Exclude<PermissionPlatform, "oac">
): string[] {
  const warnings: string[] = [];
  const capabilities = PLATFORM_CAPABILITIES[platform];

  if (hasGranularPermissions(permissions) && !capabilities.supportsGranular) {
    warnings.push(
      `⚠️  ${platform} does not support granular permissions - rules will be simplified`
    );
  }

  if (hasAskPermissions(permissions) && !capabilities.supportsAsk) {
    warnings.push(
      `⚠️  ${platform} does not support 'ask' permissions - will be converted to allow/deny`
    );
  }

  return warnings;
}
