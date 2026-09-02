import type {
  OpenAgent,
  ConversionResult,
  ToolCapabilities,
} from "../types.js";

/**
 * Abstract base class for all tool adapters.
 * 
 * Tool adapters convert OpenAgents Control agents to/from tool-specific formats.
 * Each adapter implements bidirectional conversion and reports its capabilities.
 * 
 * @example
 * ```ts
 * class MyToolAdapter extends BaseAdapter {
 *   readonly name = 'my-tool';
 *   readonly displayName = 'My Tool';
 *   
 *   async toOAC(source: string): Promise\u003cOpenAgent\u003e {
 *     // Parse the tool's native format
 *     // Convert to OpenAgent
 *   }
 *   
 *   async fromOAC(agent: OpenAgent): Promise\u003cConversionResult\u003e {
 *     // Convert OpenAgent to the tool's format
 *     // Return converted files
 *   }
 * }
 * ```
 */
export abstract class BaseAdapter {
  /**
   * Unique identifier for this adapter (e.g., "claude", "opencode")
   */
  abstract readonly name: string;

  /**
   * Human-readable display name (e.g., "Claude Code", "OpenCode")
   */
  abstract readonly displayName: string;

  /**
   * Protected constructor - only subclasses can instantiate
   */
  protected constructor() {}

  // ============================================================================
  // ABSTRACT METHODS - Must be implemented by subclasses
  // ============================================================================

  /**
   * Convert from tool-specific format TO OpenAgents Control format.
   * 
   * @param source - The tool-specific config file content
   * @returns Parsed OpenAgent object
   * @throws {Error} If parsing or conversion fails
   */
  abstract toOAC(source: string): Promise<OpenAgent>;

  /**
   * Convert FROM OpenAgents Control format to tool-specific format.
   * 
   * @param agent - The OpenAgent to convert
   * @returns Conversion result with generated files, warnings, and errors
   */
  abstract fromOAC(agent: OpenAgent): Promise<ConversionResult>;

  /**
   * Get the configuration path where files should be written.
   * 
   * @param agent - Optional agent for context-specific paths
   * @returns Relative path from project root (e.g., "CLAUDE.md", ".claude/")
   */
  abstract getConfigPath(agent?: OpenAgent): string;

  /**
   * Get capabilities of this tool.
   * 
   * @returns Tool capabilities object describing supported features
   */
  abstract getCapabilities(): ToolCapabilities;

  /**
   * Validate if an agent can be converted with full fidelity.
   * 
   * @param agent - The agent to validate
   * @returns Array of warnings about features that will be lost or degraded
   */
  abstract validateConversion(agent: OpenAgent): string[];

  // ============================================================================
  // CONCRETE METHODS - Common functionality for all adapters
  // ============================================================================

  /**
   * Check if a specific feature is supported by this adapter.
   * 
   * @param feature - The feature name to check
   * @returns True if supported, false otherwise
   */
  supportsFeature(feature: keyof ToolCapabilities): boolean {
    const capabilities = this.getCapabilities();
    return capabilities[feature] === true;
  }

  /**
   * Log a warning message (can be overridden for custom logging).
   * 
   * @param message - Warning message
   */
  protected warn(message: string): void {
    console.warn(`[${this.name}] ${message}`);
  }

  /**
   * Log an error message (can be overridden for custom logging).
   * 
   * @param message - Error message
   */
  protected error(message: string): void {
    console.error(`[${this.name}] ${message}`);
  }

  /**
   * Create a successful conversion result.
   * 
   * @param configs - Generated configuration files
   * @param warnings - Optional warnings
   * @returns ConversionResult object
   */
  protected createSuccessResult(
    configs: ConversionResult["configs"],
    warnings: string[] = []
  ): ConversionResult {
    return {
      success: true,
      configs,
      warnings,
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * Create a failed conversion result.
   * 
   * @param errors - Error messages
   * @param warnings - Optional warnings
   * @returns ConversionResult object
   */
  protected createErrorResult(
    errors: string[],
    warnings: string[] = []
  ): ConversionResult {
    return {
      success: false,
      configs: [],
      warnings,
      errors,
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * Safely parse JSON with error handling.
   * 
   * @param content - JSON string to parse
   * @param filename - Optional filename for error messages
   * @returns Parsed object or null on error
   */
  protected safeParseJSON(content: string, filename?: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      const context = filename ? ` in ${filename}` : "";
      this.error(`Failed to parse JSON${context}: ${String(error)}`);
      return null;
    }
  }

  /**
   * Generate a standard warning message for unsupported features.
   * 
   * @param feature - Feature name
   * @param value - Feature value (if applicable)
   * @returns Formatted warning message
   */
  protected unsupportedFeatureWarning(
    feature: string,
    value?: string | number | boolean
  ): string {
    const valueStr = value !== undefined ? ` (${String(value)})` : "";
    return `⚠️  Feature '${feature}'${valueStr} is not supported by ${this.displayName}`;
  }

  /**
   * Generate a standard warning message for degraded features.
   * 
   * @param feature - Feature name
   * @param from - Original format
   * @param to - Target format
   * @returns Formatted warning message
   */
  protected degradedFeatureWarning(
    feature: string,
    from: string,
    to: string
  ): string {
    return `⚠️  Feature '${feature}' will be degraded: ${from} → ${to}`;
  }
}
