/**
 * @openagents-control/compatibility-layer
 * 
 * A TypeScript library for converting OpenAgents Control agent definitions
 * to and from other AI coding tool formats (Cursor, Claude, Windsurf, etc.).
 * 
 * @module @openagents-control/compatibility-layer
 * 
 * @example
 * ```typescript
 * import { loadAgent, registry, CursorAdapter } from '@openagents-control/compatibility-layer';
 * 
 * // Load an OAC agent
 * const agent = await loadAgent('.opencode/agent/opencoder.md');
 * 
 * // Convert to Cursor format
 * const cursorAdapter = registry.get('cursor');
 * const result = await cursorAdapter.fromOAC(agent);
 * ```
 */

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

/**
 * All Zod schemas and TypeScript types for OpenAgents Control.
 * 
 * Includes:
 * - OpenAgent, AgentFrontmatter, AgentMetadata
 * - ToolAccess, PermissionRule, GranularPermission
 * - ContextReference, DependencyReference
 * - ModelIdentifier, TemperatureSchema
 * - SkillReference, HookDefinition
 * - ToolCapabilities, ConversionResult
 */
export * from "./types.js";

// ============================================================================
// CORE - Agent Loading
// ============================================================================

/**
 * AgentLoader class and convenience functions for loading OAC agent files.
 * 
 * @example
 * ```typescript
 * import { loadAgent, loadAgents } from '@openagents-control/compatibility-layer';
 * 
 * // Load single agent
 * const agent = await loadAgent('.opencode/agent/opencoder.md');
 * 
 * // Load all agents from directory
 * const agents = await loadAgents('.opencode/agent/');
 * ```
 */
export {
  AgentLoader,
  loadAgent,
  loadAgents,
} from "./core/AgentLoader.js";

/**
 * Error classes from AgentLoader for handling load failures.
 * 
 * - AgentLoadError: Base error for agent loading
 * - FrontmatterParseError: YAML parsing errors
 * - ValidationError: Zod schema validation errors
 */
export {
  AgentLoadError,
  FrontmatterParseError,
  ValidationError,
} from "./core/AgentLoader.js";

// ============================================================================
// CORE - Adapter Registry
// ============================================================================

/**
 * AdapterRegistry for managing tool adapters.
 * 
 * @example
 * ```typescript
 * import { registry, getAdapter } from '@openagents-control/compatibility-layer';
 * 
 * // Get adapter from registry
 * const adapter = getAdapter('cursor');
 * 
 * // List all adapters
 * const names = registry.list();
 * ```
 */
export {
  AdapterRegistry,
  registry,
  getAdapter,
  listAdapters,
  getAllCapabilities,
} from "./core/AdapterRegistry.js";

/**
 * Error class for adapter registry operations.
 */
export { AdapterRegistryError } from "./core/AdapterRegistry.js";

/**
 * Type for adapter information including capabilities.
 */
export type { AdapterInfo } from "./core/AdapterRegistry.js";

// ============================================================================
// ADAPTERS - Base Class
// ============================================================================

/**
 * BaseAdapter abstract class for creating custom adapters.
 * 
 * @example
 * ```typescript
 * import { BaseAdapter } from '@openagents-control/compatibility-layer';
 * 
 * class MyAdapter extends BaseAdapter {
 *   readonly name = 'my-tool';
 *   readonly displayName = 'My Tool';
 *   
 *   async toOAC(source: string): Promise<OpenAgent> {
 *     // Implementation
 *   }
 *   
 *   async fromOAC(agent: OpenAgent): Promise<ConversionResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export { BaseAdapter } from "./adapters/BaseAdapter.js";

// ============================================================================
// ADAPTERS - Built-in Implementations
// ============================================================================

/**
 * Built-in adapters for popular AI coding tools.
 * 
 * Note: These will be available in Phase 2.
 * For now, they need to be registered manually.
 * 
 * @example
 * ```typescript
 * // Available in Phase 2:
 * // import { CursorAdapter, ClaudeAdapter, WindsurfAdapter } from '@openagents-control/compatibility-layer';
 * ```
 */

// Phase 2 adapters (implemented)
export { CursorAdapter } from "./adapters/CursorAdapter.js";
export { ClaudeAdapter } from "./adapters/ClaudeAdapter.js";
export { WindsurfAdapter } from "./adapters/WindsurfAdapter.js";
export { OpenClawAdapter } from "./adapters/OpenClawAdapter.js";

// ============================================================================
// MAPPERS - Feature Translation (Phase 3)
// ============================================================================

/**
 * ToolMapper for translating tool names between platforms.
 * 
 * @example
 * ```typescript
 * import { mapToolFromOAC, mapToolToOAC } from '@openagents-control/compatibility-layer';
 * 
 * mapToolFromOAC('bash', 'cursor'); // => { name: 'terminal', exact: true }
 * ```
 */
export {
  mapToolToOAC,
  mapToolFromOAC,
  mapToolAccessFromOAC,
  mapToolAccessToOAC,
  getSupportedTools,
  getUnsupportedTools,
  isToolSupported,
  type ToolPlatform,
  type ToolMappingConfig,
  type ToolMappingResult,
} from "./mappers/ToolMapper.js";

/**
 * PermissionMapper for translating between granular and binary permissions.
 * 
 * @example
 * ```typescript
 * import { mapPermissionsFromOAC } from '@openagents-control/compatibility-layer';
 * 
 * mapPermissionsFromOAC({ bash: { "*": "allow" } }, 'claude');
 * // => { permissions: { bash: true }, warnings: [...] }
 * ```
 */
export {
  resolvePermissionRule,
  isGranularRule,
  mapPermissionsFromOAC,
  mapPermissionsToOAC,
  createGranularRule,
  extractPatterns,
  mergePermissionRules,
  hasGranularPermissions,
  hasAskPermissions,
  analyzePermissionDegradation,
  createPermissionIndex,
  type PermissionPlatform,
  type BinaryPermissions,
  type PermissionMappingResult,
  type DegradationStrategy,
  type PermissionIndex,
  type PermissionIndexEntry,
} from "./mappers/PermissionMapper.js";

/**
 * ModelMapper for translating AI model identifiers.
 * 
 * @example
 * ```typescript
 * import { mapModelFromOAC, getModelsForPlatform } from '@openagents-control/compatibility-layer';
 * 
 * mapModelFromOAC('claude-sonnet-4', 'cursor');
 * // => { id: 'claude-sonnet-4', exact: true }
 * ```
 */
export {
  mapModelFromOAC,
  mapModelToOAC,
  getModelFamily,
  getModelInfo,
  getAllModels,
  getModelsForPlatform,
  isModelAvailable,
  getDefaultModel,
  type ModelPlatform,
  type ModelMappingResult,
  type ModelFamily,
  type ModelInfo,
} from "./mappers/ModelMapper.js";

/**
 * ContextMapper for translating context file paths.
 * 
 * @example
 * ```typescript
 * import { mapContextPathFromOAC } from '@openagents-control/compatibility-layer';
 * 
 * mapContextPathFromOAC('.opencode/context/core/standards.md', 'claude');
 * // => { path: '.claude/skills/core-standards.md', exact: true }
 * ```
 */
export {
  mapContextPathFromOAC,
  mapContextPathToOAC,
  mapContextReferenceFromOAC,
  mapContextReferencesFromOAC,
  mapSkillsToClaudeFormat,
  mapSkillsFromClaudeFormat,
  getContextBaseDir,
  supportsExternalContext,
  supportsContextSubdirs,
  supportsContextPriority,
  createContextReference,
  normalizeContextPath,
  getRelativeContextPath,
  type ContextPlatform,
  type ContextMappingResult,
} from "./mappers/ContextMapper.js";

// ============================================================================
// CORE - Capability Matrix & Translation Engine (Phase 3)
// ============================================================================

/**
 * CapabilityMatrix for feature compatibility analysis.
 * 
 * @example
 * ```typescript
 * import { analyzeCompatibility, getToolCapabilities } from '@openagents-control/compatibility-layer';
 * 
 * const result = analyzeCompatibility(agent, 'cursor');
 * // => { compatible: false, warnings: [...], blockers: [...] }
 * ```
 */
export {
  getCapabilityMatrix,
  getFeaturesByCategory,
  getFeatureSupport,
  isFeatureSupported,
  analyzeCompatibility,
  getToolCapabilities,
  comparePlatforms,
  getConversionSummary,
  type Platform,
  type FeatureCategory,
  type SupportLevel,
  type FeatureDefinition,
  type CompatibilityResult,
} from "./core/CapabilityMatrix.js";

/**
 * TranslationEngine for orchestrating complete agent translation.
 * 
 * @example
 * ```typescript
 * import { TranslationEngine, translate } from '@openagents-control/compatibility-layer';
 * 
 * // Using the engine
 * const engine = new TranslationEngine();
 * const result = engine.translate(agent, 'cursor');
 * 
 * // Quick translate
 * const result = translate(agent, 'cursor');
 * ```
 */
export {
  TranslationEngine,
  createTranslationEngine,
  translate,
  previewTranslation,
  type TranslationTarget,
  type TranslationOptions,
  type TranslationResult,
  type ReverseTranslationResult,
} from "./core/TranslationEngine.js";

// ============================================================================
// VERSION INFO
// ============================================================================

/**
 * Package version (injected at build time)
 */
export const VERSION = "0.1.0";
