/**
 * @controlstack/compatibility-layer
 * 
 * The build library behind `oac build`: loads canonical content/ and emits
 * OpenCode and Claude Code trees plus registry.json.
 * 
 * @module @controlstack/compatibility-layer
 * 
 */

// ============================================================================
// TYPES & SCHEMAS
// ============================================================================

/**
 * All Zod schemas and TypeScript types for OpenAgents Control.
 * 
 * Includes:
 * - OpenAgent, AgentFrontmatter
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
 * import { loadAgent, loadAgents } from '@controlstack/compatibility-layer';
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
  MissingOacBlockError,
  ValidationError,
} from "./core/AgentLoader.js";

// ============================================================================
// CORE - Canonical Agent Loading (`oac:` block)
// ============================================================================

/**
 * Loads canonical agent files — OpenCode frontmatter plus the `oac:` block — from a
 * configurable content root (`content/agents/**` by default).
 *
 * Identity comes from `oac.id`, never the filename: `subagents/code/test-engineer.md`
 * declares `id: tester`, and `tester` is what the registry, profiles and context docs
 * reference.
 *
 * @example
 * ```typescript
 * const agents = await loadCanonicalAgents('content/agents');
 * // sorted by oac.id, deterministic regardless of filesystem enumeration order
 * ```
 */
export {
  CanonicalAgentLoader,
  loadCanonicalAgents,
  DEFAULT_CONTENT_ROOT,
} from "./core/AgentLoader.js";

export type { CanonicalAgentFile } from "./core/AgentLoader.js";

// ============================================================================
// CORE - Registry Emission
// ============================================================================

/**
 * Generates `registry.json` from canonical component and profile trees, replacing the
 * hand-editing that `scripts/registry/auto-detect-components.sh` only ever appended to.
 *
 * It owns `components.agents`, `components.subagents`, and profile component lists; contexts,
 * commands, tools, plugins, skills, config, and profile metadata remain carried from the base.
 * Output is byte-stable and a fixed point over itself, so `oac build && git diff --exit-code`
 * is a real drift gate.
 *
 * @example
 * ```typescript
 * import { emitRegistry } from '@controlstack/compatibility-layer';
 *
 * // The bytes to write to registry.json — identical across runs.
 * const json = await emitRegistry(process.cwd());
 * ```
 */
export {
  RegistryEmitter,
  emitRegistry,
  serializeRegistry,
  entryForAgent,
} from "./core/RegistryEmitter.js";

export type {
  RegistryDocument,
  RegistryEntry,
  RegistryEmitterOptions,
} from "./core/RegistryEmitter.js";

// ============================================================================
// CORE - Build Pipeline
// ============================================================================

/**
 * The whole of `oac build`: load `content/agents/**`, honour each agent's `oac.targets`, run
 * the matching adapter, and reconcile the generated trees.
 *
 * {@link plan} computes; {@link write} reconciles; {@link check} compares without touching
 * anything. Splitting them is what makes `--check` and `--dry-run` share the build's code path
 * rather than re-implement it.
 *
 * Orphan removal is gated on {@link BuildManifest}: the build removes a file only if a
 * previous build recorded writing that exact path with those exact bytes. A file it never
 * generated can never become a prune candidate.
 *
 * @example
 * ```typescript
 * import { plan, write } from '@controlstack/compatibility-layer';
 *
 * const built = await plan({ root: process.cwd() });
 * // Emit .opencode/** and registry.json in place; stage claude-code for review.
 * const result = write(built, {
 *   root: process.cwd(),
 *   outputRoots: { "claude-code": ".tmp/oac-build" },
 * });
 * ```
 */
export {
  BUILD_TARGETS,
  build,
  buildAgent,
  buildAgentIn,
  check,
  plan,
  readManifest,
  repoRelative,
  serializeManifest,
  write,
} from "./core/BuildPipeline.js";

export type {
  BuildFile,
  BuildManifest,
  BuildOptions,
  BuildPlan,
  BuildTarget,
  BuildWarning,
  Drift,
  ManifestEntry,
  OutputRoots,
  WriteOptions,
  WriteResult,
} from "./core/BuildPipeline.js";

// ============================================================================
// CORE - Reference Resolution & Profiles
// ============================================================================

/**
 * Resolves `type:id` references against `registry.json`, catching the reference rot that
 * `scripts/registry/validate-registry.sh` reports as 244/244 green.
 */
export { ReferenceResolver, formatResolutions } from "./core/ReferenceResolver.js";

export type {
  Reference,
  Registry,
  RegistryComponent,
  Resolution,
  ResolutionStatus,
  ResolveResult,
} from "./core/ReferenceResolver.js";

/**
 * Loads install profiles and computes their transitive closures — what "install this
 * profile" actually means.
 */
export { ProfileLoader, ProfileLoadError, ProfileSchema } from "./core/ProfileLoader.js";

export type {
  ClosureResult,
  LoadedProfile,
  Profile,
  ProfileDrift,
} from "./core/ProfileLoader.js";

// ============================================================================
// ADAPTERS - Base Class
// ============================================================================

/**
 * BaseAdapter abstract class for creating custom adapters.
 * 
 * @example
 * ```typescript
 * import { BaseAdapter } from '@controlstack/compatibility-layer';
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
 * ClaudeAdapter — emits Claude Code agent files from canonical content.
 */
export { ClaudeAdapter } from "./adapters/ClaudeAdapter.js";

/**
 * OpenCodeAdapter — emits `.opencode/agent/**` from the canonical `content/agents/**` tree by
 * stripping the `oac:` block. The canonical build target.
 *
 * @example
 * ```typescript
 * import { OpenCodeAdapter } from '@controlstack/compatibility-layer';
 *
 * const { content } = await new OpenCodeAdapter().fromCanonical(source);
 * ```
 */
export {
  OpenCodeAdapter,
  OpenCodeEmitError,
  OPENCODE_AGENT_ROOT,
} from "./adapters/OpenCodeAdapter.js";

export type {
  CanonicalEmitResult,
  FromCanonicalOptions,
} from "./adapters/OpenCodeAdapter.js";

// ============================================================================
// MAPPERS - Feature Translation (Phase 3)
// ============================================================================

/**
 * ToolMapper for translating tool names between platforms.
 * 
 * @example
 * ```typescript
 * import { mapToolFromOAC, mapToolToOAC } from '@controlstack/compatibility-layer';
 * 
 * mapToolFromOAC('bash', 'claude'); // => { name: 'Bash', exact: true }
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
 * import { mapPermissionsFromOAC } from '@controlstack/compatibility-layer';
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
  type PermissionPlatform,
  type BinaryPermissions,
  type PermissionMappingResult,
  type DegradationStrategy,
} from "./mappers/PermissionMapper.js";

/**
 * ModelMapper for translating AI model identifiers.
 * 
 * @example
 * ```typescript
 * import { mapModelFromOAC, getModelsForPlatform } from '@controlstack/compatibility-layer';
 * 
 * mapModelFromOAC('claude-sonnet-4', 'claude');
 * // => { id: 'claude-sonnet-4-20250514', exact: true }
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
 * import { mapContextPathFromOAC } from '@controlstack/compatibility-layer';
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
// CORE - Capability Matrix
// ============================================================================

/**
 * CapabilityMatrix for feature compatibility analysis.
 * 
 * @example
 * ```typescript
 * import { analyzeCompatibility, getToolCapabilities } from '@controlstack/compatibility-layer';
 * 
 * const result = analyzeCompatibility(agent, 'claude');
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

// ============================================================================
// VERSION INFO
// ============================================================================

/**
 * Package version (injected at build time)
 */
export const VERSION = "0.1.0";
