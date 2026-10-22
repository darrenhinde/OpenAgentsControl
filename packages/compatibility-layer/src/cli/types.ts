/**
 * CLI Type Definitions
 *
 * Type definitions for the oac-compat CLI tool.
 * Follows functional patterns with explicit types.
 *
 * @module cli/types
 */

// ============================================================================
// OUTPUT FORMATS
// ============================================================================

/**
 * Supported output formats for CLI commands
 */
export type OutputFormat = "text" | "json";

/**
 * Valid output format values (for validation)
 */
export const OUTPUT_FORMATS: readonly OutputFormat[] = ["text", "json"] as const;

/**
 * Check if a string is a valid output format
 */
export const isValidOutputFormat = (value: string): value is OutputFormat =>
  OUTPUT_FORMATS.includes(value as OutputFormat);

// ============================================================================
// GLOBAL OPTIONS
// ============================================================================

/**
 * Global CLI options available to all commands
 */
export interface GlobalOptions {
  /** Enable verbose output */
  readonly verbose?: boolean;
  /** Suppress all output except errors */
  readonly quiet?: boolean;
  /** Output format (text or json) */
  readonly outputFormat: OutputFormat;
}

/**
 * Default global options
 */
export const DEFAULT_GLOBAL_OPTIONS: GlobalOptions = {
  verbose: false,
  quiet: false,
  outputFormat: "text",
} as const;

// ============================================================================
// COMMAND OPTIONS
// ============================================================================

/**
 * Options for the 'convert' command
 */
export interface ConvertOptions extends GlobalOptions {
  /** Output file path */
  readonly output?: string;
  /** Target format (cursor, claude, windsurf, oac) */
  readonly format?: string;
  /** Source format (auto-detect if not specified) */
  readonly from?: string;
  /** Overwrite existing files */
  readonly force?: boolean;
}

/**
 * Options for the 'validate' command
 */
export interface ValidateOptions extends GlobalOptions {
  /** Target platform to validate against */
  readonly target?: string;
  /** Enable strict validation */
  readonly strict?: boolean;
}

/**
 * Options for the 'migrate' command
 */
export interface MigrateOptions extends GlobalOptions {
  /** Target format for migration */
  readonly format?: string;
  /** Output directory */
  readonly outDir?: string;
  /** Simulate migration without changes */
  readonly dryRun?: boolean;
  /** Overwrite existing files */
  readonly force?: boolean;
}

/**
 * Options for the 'info' command
 */
export interface InfoOptions extends GlobalOptions {
  /** Show detailed information */
  readonly detailed?: boolean;
  /** Compare with another platform */
  readonly compare?: string;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * CLI command result for consistent output handling
 */
export interface CommandResult<T = unknown> {
  /** Whether the command succeeded */
  readonly success: boolean;
  /** Result data (if success) */
  readonly data?: T;
  /** Error message (if failure) */
  readonly error?: string;
  /** Warning messages */
  readonly warnings?: readonly string[];
}

/**
 * Create a success result
 */
export const successResult = <T>(
  data: T,
  warnings?: readonly string[]
): CommandResult<T> => ({
  success: true,
  data,
  warnings,
});

/**
 * Create an error result
 */
export const errorResult = (
  error: string,
  warnings?: readonly string[]
): CommandResult<never> => ({
  success: false,
  error,
  warnings,
});

// ============================================================================
// SUPPORTED PLATFORMS
// ============================================================================

/**
 * Supported AI coding tool platforms
 */
export type Platform = "oac" | "cursor" | "claude" | "windsurf" | "openclaw";

/**
 * All supported platforms
 */
export const PLATFORMS: readonly Platform[] = [
  "oac",
  "cursor",
  "claude",
  "windsurf",
  "openclaw",
] as const;

/**
 * Platform display names
 */
export const PLATFORM_NAMES: Record<Platform, string> = {
  oac: "OpenAgents Control",
  cursor: "Cursor IDE",
  claude: "Claude Code",
  windsurf: "Windsurf",
  openclaw: "OpenClaw",
} as const;

/**
 * Check if a string is a valid platform
 */
export const isValidPlatform = (value: string): value is Platform =>
  PLATFORMS.includes(value as Platform);
