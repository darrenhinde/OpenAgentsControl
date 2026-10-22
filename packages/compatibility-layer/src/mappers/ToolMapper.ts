/**
 * ToolMapper - Maps tool names between OAC and other formats
 *
 * Pure functions for bidirectional tool name mapping.
 * Handles differences in how tools are named across platforms.
 *
 * @example
 * ```ts
 * mapToolToOAC('terminal', 'claude') // => 'bash'
 * mapToolFromOAC('bash', 'claude')   // => 'terminal'
 * ```
 */

import type { ToolAccess } from "../types.js";

// ============================================================================
// Types
// ============================================================================

/**
 * Supported tool platforms for mapping
 */
export type ToolPlatform = "oac" | "claude" | "cursor" | "windsurf" | "openclaw";

/**
 * Tool mapping configuration for a specific platform
 */
export interface ToolMappingConfig {
  /** Map from OAC tool name to platform tool name */
  fromOAC: Record<string, string>;
  /** Map from platform tool name to OAC tool name */
  toOAC: Record<string, string>;
  /** Tools that are not supported by this platform */
  unsupported: string[];
}

/**
 * Result of a tool mapping operation
 */
export interface ToolMappingResult {
  /** The mapped tool name */
  name: string;
  /** Whether the mapping was exact or a fallback */
  exact: boolean;
  /** Warning message if mapping was degraded */
  warning?: string;
}

// ============================================================================
// Mapping Tables
// ============================================================================

/**
 * Tool name mappings for each platform
 */
const TOOL_MAPPINGS: Record<Exclude<ToolPlatform, "oac">, ToolMappingConfig> = {
  claude: {
    fromOAC: {
      bash: "Bash",
      read: "Read",
      write: "Write",
      edit: "Edit",
      glob: "Glob",
      grep: "Grep",
      task: "Task",
      patch: "Edit", // Claude uses Edit for patching
    },
    toOAC: {
      Bash: "bash",
      Read: "read",
      Write: "write",
      Edit: "edit",
      Glob: "glob",
      Grep: "grep",
      Task: "task",
      // Claude-specific tools that map to OAC equivalents
      WebSearch: "bash", // Approximation
      WebFetch: "bash", // Approximation
    },
    unsupported: [], // Claude supports most tools
  },

  cursor: {
    fromOAC: {
      bash: "terminal",
      read: "file_read",
      write: "file_write",
      edit: "file_edit",
      glob: "file_search",
      grep: "content_search",
      task: "task", // Not really supported, maps to itself
      patch: "file_edit",
    },
    toOAC: {
      terminal: "bash",
      file_read: "read",
      file_write: "write",
      file_edit: "edit",
      file_search: "glob",
      content_search: "grep",
    },
    unsupported: ["task"], // Cursor doesn't support delegation
  },

  windsurf: {
    fromOAC: {
      bash: "shell",
      read: "read_file",
      write: "write_file",
      edit: "edit_file",
      glob: "find_files",
      grep: "search_content",
      task: "delegate", // Limited support
      patch: "edit_file",
    },
    toOAC: {
      shell: "bash",
      read_file: "read",
      write_file: "write",
      edit_file: "edit",
      find_files: "glob",
      search_content: "grep",
      delegate: "task",
    },
    unsupported: [], // Windsurf has equivalents for most
  },

  openclaw: {
    fromOAC: {
      bash: "exec",
      read: "read",
      write: "write",
      edit: "edit",
      glob: "glob",
      grep: "grep",
      task: "sessions_spawn", // Subagent delegation
      patch: "edit",
    },
    toOAC: {
      exec: "bash",
      read: "read",
      write: "write",
      edit: "edit",
      glob: "glob",
      grep: "grep",
      sessions_spawn: "task",
    },
    unsupported: [], // OpenClaw has equivalents for all OAC tools
  },
};

// ============================================================================
// Core Mapping Functions (Pure)
// ============================================================================

/**
 * Map a single tool name from platform format to OAC format.
 *
 * @param toolName - Tool name in platform format
 * @param platform - Source platform
 * @returns Mapping result with OAC tool name
 */
export function mapToolToOAC(
  toolName: string,
  platform: Exclude<ToolPlatform, "oac">
): ToolMappingResult {
  const mapping = TOOL_MAPPINGS[platform];
  const oacName = mapping.toOAC[toolName];

  if (oacName) {
    return { name: oacName, exact: true };
  }

  // Fallback: use lowercase version as-is
  const fallbackName = toolName.toLowerCase();
  return {
    name: fallbackName,
    exact: false,
    warning: `Unknown tool '${toolName}' from ${platform}, using '${fallbackName}'`,
  };
}

/**
 * Map a single tool name from OAC format to platform format.
 *
 * @param toolName - Tool name in OAC format
 * @param platform - Target platform
 * @returns Mapping result with platform tool name
 */
export function mapToolFromOAC(
  toolName: string,
  platform: Exclude<ToolPlatform, "oac">
): ToolMappingResult {
  const mapping = TOOL_MAPPINGS[platform];

  // Check if tool is unsupported
  if (mapping.unsupported.includes(toolName)) {
    return {
      name: toolName,
      exact: false,
      warning: `Tool '${toolName}' is not supported by ${platform}`,
    };
  }

  const platformName = mapping.fromOAC[toolName];

  if (platformName) {
    return { name: platformName, exact: true };
  }

  // Fallback: use the OAC name as-is
  return {
    name: toolName,
    exact: false,
    warning: `No mapping for tool '${toolName}' to ${platform}, using as-is`,
  };
}

// ============================================================================
// Batch Mapping Functions
// ============================================================================

/**
 * Map all tools from a ToolAccess object to platform format.
 *
 * @param tools - OAC ToolAccess object
 * @param platform - Target platform
 * @returns Object with mapped tools and warnings
 */
export function mapToolAccessFromOAC(
  tools: ToolAccess,
  platform: Exclude<ToolPlatform, "oac">
): { tools: Record<string, boolean>; warnings: string[] } {
  const result: Record<string, boolean> = {};
  const warnings: string[] = [];

  for (const [toolName, enabled] of Object.entries(tools)) {
    if (enabled === undefined) continue;

    const mapping = mapToolFromOAC(toolName, platform);
    result[mapping.name] = enabled;

    if (mapping.warning) {
      warnings.push(mapping.warning);
    }
  }

  return { tools: result, warnings };
}

/**
 * Map platform tools to OAC ToolAccess format.
 *
 * @param tools - Platform tools object
 * @param platform - Source platform
 * @returns Object with OAC ToolAccess and warnings
 */
export function mapToolAccessToOAC(
  tools: Record<string, boolean>,
  platform: Exclude<ToolPlatform, "oac">
): { tools: ToolAccess; warnings: string[] } {
  const result: ToolAccess = {};
  const warnings: string[] = [];

  for (const [toolName, enabled] of Object.entries(tools)) {
    const mapping = mapToolToOAC(toolName, platform);

    // Map to the correct OAC tool property
    const oacTool = mapping.name as keyof ToolAccess;
    if (isValidOACTool(oacTool)) {
      result[oacTool] = enabled;
    }

    if (mapping.warning) {
      warnings.push(mapping.warning);
    }
  }

  return { tools: result, warnings };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a tool name is a valid OAC tool.
 */
function isValidOACTool(name: string): name is keyof ToolAccess {
  const validTools = ["read", "write", "edit", "bash", "task", "grep", "glob", "patch", "question"];
  return validTools.includes(name);
}

/**
 * Get list of tools supported by a platform.
 *
 * @param platform - Target platform
 * @returns Array of supported tool names
 */
export function getSupportedTools(
  platform: Exclude<ToolPlatform, "oac">
): string[] {
  const mapping = TOOL_MAPPINGS[platform];
  return Object.keys(mapping.fromOAC);
}

/**
 * Get list of tools NOT supported by a platform.
 *
 * @param platform - Target platform
 * @returns Array of unsupported OAC tool names
 */
export function getUnsupportedTools(
  platform: Exclude<ToolPlatform, "oac">
): string[] {
  return TOOL_MAPPINGS[platform].unsupported;
}

/**
 * Check if a specific tool is supported by a platform.
 *
 * @param toolName - OAC tool name
 * @param platform - Target platform
 * @returns True if supported
 */
export function isToolSupported(
  toolName: string,
  platform: Exclude<ToolPlatform, "oac">
): boolean {
  return !TOOL_MAPPINGS[platform].unsupported.includes(toolName);
}
