# OAC Provider/Adapter Pattern — Final Recommendation

**Document**: 14-PROVIDER-PATTERN-FINAL.md
**Status**: FINAL — authoritative before implementation starts
**Date**: 2026-02-19
**Author**: Architecture Review
**Drives**: Projects P1–P6 (all 6 projects)

> This document is the final word on provider/adapter architecture. No deviation from these
> patterns without a formal ADR. Implementation begins with these interfaces locked.

---

## 1. The Chosen Pattern

**Decision: Option C — Hybrid. Separate typed interfaces per subsystem sharing a common `OACPlugin` composition type.**

### Evaluation Matrix

| Criterion | Option A (Vite Monolith) | Option B (Separate Interfaces) | Option C (Hybrid) |
|-----------|--------------------------|-------------------------------|-------------------|
| Simplicity for community authors | Medium — one big object, most hooks irrelevant | High — implement only your subsystem | **High** — each interface is small and focused |
| TypeScript inference | Poor — optional methods on monolith collapse to `undefined` everywhere | **Excellent** — each interface fully typed | **Excellent** — each interface fully typed |
| OpenCode compatibility | Neutral | Neutral | **Best** — `OACPlugin` maps cleanly to OpenCode's plugin type |
| Composability | Poor — can't mix providers | Medium — wire manually | **Best** — `defineConfig()` composes cleanly |
| Testability | Poor — mock entire monolith | **Excellent** — mock one interface | **Excellent** — mock one interface |
| Fit with existing BaseAdapter | Poor — BaseAdapter is a class, not a hook object | Good — direct mapping | **Best** — IIDEAdapter extends the same contract |
| Plugin author DX | Poor — "which hook do I implement?" | Good | **Best** — `implements IContextProvider` is unambiguous |

### Rationale

Option A (Vite monolith) is rejected because OAC's subsystems have fundamentally **different dispatch semantics**:
- Context resolution is **first-match-wins** (one provider answers)
- IDE adapters are **fan-out** (all adapters write in parallel)
- Registry lookup is **priority-ordered fallthrough**

These cannot coexist correctly in a single optional-hook object without obscuring the semantics behind comments. A `NotionContextProvider` author does not need to know about IDE adapter hooks, and giving them an object with 25 optional methods is hostile.

Option B (pure separation) is good but loses the composition story. Users need one place to hand OAC their full configuration without assembling a `ProviderRegistry` manually.

Option C gives the best of both:
- Each interface is **small, focused, and semantically unambiguous**
- `OACPlugin` is the **user-facing composition type** — what goes in `oac.config.ts`
- `defineConfig()` provides the helper that validates and assembles everything
- The `ProviderRegistry` (internal to the CLI) wires dispatch semantics

**The Vite-style hooks apply at the `ProviderRegistry` dispatch level, not at the interface level.** The registry implements `callFirst()` and `callAll()` dispatch internally. Plugin authors just implement `IContextProvider`, not "hooks".

---

## 2. Final TypeScript Interfaces

These are authoritative. They go verbatim into `packages/core/src/`.

### 2.1 Supporting Types (`packages/core/src/types/index.ts`)

```typescript
// ============================================================================
// Primitive Types
// ============================================================================

export type ComponentType = 'agent' | 'skill' | 'context' | 'plugin';
export type UpdateMode = 'manual' | 'auto-safe' | 'auto-all' | 'locked';
export type ConflictStrategy = 'ask' | 'skip' | 'overwrite' | 'backup' | 'yolo';
export type InstallLocation = 'local' | 'global';
export type ContextLayerName =
  | 'project-override'    // L1: .oac/context/
  | 'project-context'     // L2: .opencode/context/
  | 'ide-specific'        // L3: .claude/context/, .cursor/context/
  | 'project-docs'        // L4: docs/context/
  | 'user-global'         // L5: ~/.config/oac/context/
  | 'oac-bundled';        // L6: npm package (lowest priority)

// ============================================================================
// Shared Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OACOperationResult<T = void> {
  success: boolean;
  data?: T;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Context Types
// ============================================================================

export interface ContextFile {
  /** Relative name used to resolve the file, e.g. "core/standards/code-quality.md" */
  name: string;
  content: string;
  /** Absolute path on disk */
  path: string;
  layer: ContextLayerName;
  /** True if the installed SHA256 differs from the bundled SHA256 */
  userOwned: boolean;
  sha256: string;
}

export interface ContextQuery {
  category?: string;
  layer?: ContextLayerName;
  userOwned?: boolean;
  tags?: string[];
}

// ============================================================================
// Task Management Types
// ============================================================================

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[]; // task IDs
  assignee?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskSession {
  id: string;
  feature: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface RegistryFile {
  /** Path within the registry item's source */
  path: string;
  type: string; // e.g. "oac:agent-config", "oac:agent-prompt", "oac:skill"
  /** Install target relative to project root */
  target: string;
}

export interface RegistryItem {
  name: string;
  type: ComponentType;
  title: string;
  description: string;
  version: string;
  ides: string[];
  registryDependencies: string[];
  files: RegistryFile[];
  sha256?: string;
  publishedAt?: string;
  author?: string;
  tags?: string[];
}

export interface RegistrySearchOptions {
  type?: ComponentType;
  ide?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// ============================================================================
// IDE Adapter Types
// ============================================================================

export interface IDECapabilities {
  /** IDE identifier, e.g. "opencode", "cursor", "claude", "windsurf" */
  id: string;
  displayName: string;
  supportsMultipleAgents: boolean;
  supportsSkills: boolean;
  supportsHooks: boolean;
  supportsGranularPermissions: boolean;
  supportsContexts: boolean;
  supportsCustomModels: boolean;
  supportsTemperature: boolean;
  supportsMaxSteps: boolean;
  configFormat: 'markdown' | 'yaml' | 'json' | 'plain';
  outputStructure: 'single-file' | 'multi-file' | 'directory';
  notes?: string[];
}

export interface IDEOutputFile {
  /** Absolute path to write */
  path: string;
  content: string;
  encoding?: 'utf-8' | 'base64';
}

export interface IDEAdapterResult {
  success: boolean;
  files: IDEOutputFile[];
  warnings: string[];
  errors: string[];
}

// ============================================================================
// Agent Profile Types
// ============================================================================

export interface AgentProfile {
  name: string;
  displayName: string;
  description: string;
  /** Agent IDs included in this profile */
  agents: string[];
  /** Skill IDs included in this profile */
  skills: string[];
  /** Context profile name (from manifest.json profiles) */
  contextProfile?: string;
}

// ============================================================================
// OAC Agent (canonical internal representation)
// ============================================================================

/**
 * OACAgent is the canonical internal representation of an agent.
 * It is the type that flows between subsystems. Adapters convert
 * to/from this type. It is NOT the same as OpenAgent (the legacy
 * compatibility-layer type).
 */
export interface OACAgent {
  /** From agent.json */
  config: import('../schemas/agent.js').AgentConfig;
  /** From prompt.md — the prose content */
  promptMd: string;
  /** From system.md — optional system prompt override */
  systemMd?: string;
  /** Resolved source path */
  sourcePath: string;
}

// ============================================================================
// OAC Context (resolved context file for IDE adapter consumption)
// ============================================================================

export type OACContext = ContextFile;
```

### 2.2 Provider Interfaces (`packages/core/src/providers/`)

#### `context.ts`

```typescript
import type { ContextFile, ContextQuery, ValidationResult } from '../types/index.js';

/**
 * Provides context files to OAC's resolution pipeline.
 *
 * The default implementation is the 6-layer filesystem resolver.
 * Replace with a Notion/Confluence/custom implementation by pointing
 * config.providers.context at your package.
 *
 * Dispatch: callFirst() — first provider that returns non-null wins.
 */
export interface IContextProvider {
  /** Unique stable identifier, e.g. "oac-default", "notion", "confluence" */
  readonly id: string;
  readonly displayName: string;

  /**
   * Resolve a single context file by name.
   * Return null if this provider does not have the file.
   */
  resolve(name: string): Promise<ContextFile | null>;

  /** List all context files this provider can serve. */
  list(query?: ContextQuery): Promise<ContextFile[]>;

  /**
   * Install a context file.
   * Called by `oac context install`.
   */
  install(name: string, source: string | Buffer): Promise<void>;

  /**
   * Update an existing context file if the installed version matches
   * expectedSha256. Returns 'skipped' if user-modified, 'conflict' if
   * the new content differs from expected.
   */
  update(
    name: string,
    newContent: string,
    expectedSha256: string
  ): Promise<'updated' | 'skipped' | 'conflict'>;

  /**
   * Return true if the installed file at `name` has been modified
   * relative to `installedSha256`.
   */
  isModified(name: string, installedSha256: string): Promise<boolean>;

  /** Full validation of a named context file. */
  validate(name: string): Promise<ValidationResult>;
}
```

#### `task-management.ts`

```typescript
import type { Task, TaskSession } from '../types/index.js';

/**
 * Manages task sessions for OAC's agent workflow system.
 *
 * The default implementation stores sessions as JSON in .tmp/tasks/.
 * Replace with a Linear/Jira/GitHub Issues implementation.
 *
 * Dispatch: single provider — no fan-out.
 */
export interface ITaskManagementProvider {
  readonly id: string;
  readonly displayName: string;

  /** Create a new task session with the given tasks. */
  createSession(tasks: Omit<Task, 'id'>[], feature: string): Promise<TaskSession>;

  /** Get the current active session, or null if none. */
  getCurrentSession(): Promise<TaskSession | null>;

  /**
   * Get the next eligible task (no unmet dependencies, status=pending).
   * Returns null when all tasks are complete.
   */
  getNextTask(sessionId: string): Promise<Task | null>;

  /** Mark a task as completed. */
  completeTask(sessionId: string, taskId: string): Promise<void>;

  /** List all sessions (active and archived). */
  listSessions(): Promise<TaskSession[]>;

  /** Delete sessions older than the given number of days. Returns count deleted. */
  cleanSessions(olderThanDays: number): Promise<number>;
}
```

#### `registry.ts`

```typescript
import type { RegistryItem, RegistryFile, RegistrySearchOptions, ComponentType } from '../types/index.js';

/**
 * Provides access to a component registry.
 *
 * The default implementation talks to registry.nextsystems.dev.
 * Replace with a private enterprise registry.
 *
 * Dispatch: callFirst() in priority order — highest-priority registry that
 * has the component wins. All registries participate in search (merged).
 */
export interface IRegistryProvider {
  readonly id: string;
  readonly displayName: string;
  /** Base URL of this registry, used for display and auth. */
  readonly baseUrl: string;
  /** Higher number = higher priority in multi-registry resolution. */
  readonly priority: number;

  /** Fetch metadata for a specific component. Throws if not found. */
  fetch(name: string, type: ComponentType): Promise<RegistryItem>;

  /** Search the registry. Returns empty array (not throws) if no results. */
  search(query: string, options?: RegistrySearchOptions): Promise<RegistryItem[]>;

  /**
   * Download all files for a registry item.
   * Returns array of { file, content } pairs ready to write to disk.
   */
  download(item: RegistryItem): Promise<Array<{ file: RegistryFile; content: string }>>;

  /** Health check. Returns true if registry is reachable. */
  ping(): Promise<boolean>;

  /** Get the latest published version string for a component. */
  getLatestVersion(name: string, type: ComponentType): Promise<string>;
}
```

#### `ide-adapter.ts`

```typescript
import type { OACAgent, OACContext, IDEAdapterResult, IDECapabilities, ValidationResult } from '../types/index.js';

/**
 * Converts OAC agents to IDE-specific configuration formats.
 *
 * Built-in implementations: OpenCode, Claude Code, Cursor, Windsurf.
 * Community extensions: JetBrains, Zed, etc.
 *
 * Dispatch: callAll() — ALL registered IDE adapters run in parallel.
 * Each adapter writes its own output files.
 */
export interface IIDEAdapter {
  /** Unique stable identifier, e.g. "opencode", "cursor", "claude", "windsurf" */
  readonly id: string;
  readonly displayName: string;

  /**
   * Convert OAC agents + context to this IDE's format.
   * Returns file paths and content to write, plus warnings.
   * MUST NOT write to disk — the caller writes the files.
   */
  fromOAC(agents: OACAgent[], context: OACContext[]): Promise<IDEAdapterResult>;

  /**
   * Parse this IDE's config format back to OAC agents.
   * Used by `oac compat import`.
   * `source` is the raw file content.
   */
  toOAC(source: string): Promise<OACAgent[]>;

  /**
   * Return the output directory/file path for this IDE.
   * Relative to project root, e.g. ".opencode", ".cursorrules".
   */
  getOutputPath(): string;

  /** Describe what this IDE supports. */
  getCapabilities(): IDECapabilities;

  /**
   * Validate the result before writing. Called after fromOAC().
   * Returns warnings about feature loss, size limits, etc.
   */
  validate(result: IDEAdapterResult): ValidationResult;
}
```

#### `agent-profile.ts`

```typescript
import type { AgentProfile } from '../types/index.js';

/**
 * Provides agent profiles (developer, minimal, enterprise, etc.).
 *
 * The default implementation reads from the OAC npm package manifest.
 * Enterprise users can point this at an internal profile registry.
 *
 * Dispatch: callFirst() — first provider that has the profile wins.
 */
export interface IAgentProfileProvider {
  readonly id: string;
  readonly displayName: string;

  /** List all available profiles. */
  list(): Promise<AgentProfile[]>;

  /** Get a profile by name. Returns null if not found. */
  get(name: string): Promise<AgentProfile | null>;

  /** Check if a profile exists. */
  has(name: string): Promise<boolean>;
}
```

### 2.3 `OACPlugin` — User-Facing Composition Type (`packages/core/src/plugin.ts`)

```typescript
import type { IContextProvider } from './providers/context.js';
import type { ITaskManagementProvider } from './providers/task-management.js';
import type { IRegistryProvider } from './providers/registry.js';
import type { IIDEAdapter } from './providers/ide-adapter.js';
import type { IAgentProfileProvider } from './providers/agent-profile.js';

/**
 * OACPlugin is what a user (or enterprise author) exports from oac.config.ts.
 *
 * All fields are optional. OAC uses defaults for any field not provided.
 *
 * @example
 * ```ts
 * // oac.config.ts
 * import { defineConfig } from '@nextsystems/oac-core';
 * import { NotionContextProvider } from '@my-company/oac-notion-context';
 * import { LinearTaskProvider } from '@my-company/oac-linear';
 *
 * export default defineConfig({
 *   context: new NotionContextProvider({ token: process.env.NOTION_TOKEN! }),
 *   taskManagement: new LinearTaskProvider({ apiKey: process.env.LINEAR_KEY! }),
 *   ideAdapters: [process.env.CI && new CIOnlyAdapter()].filter(Boolean),
 * });
 * ```
 */
export interface OACPlugin {
  /**
   * Replace the default 6-layer filesystem context resolver.
   * Provide ONE context provider. If multiple are needed, compose them
   * inside a wrapper that implements IContextProvider.
   */
  context?: IContextProvider;

  /**
   * Replace the default JSON-file task management system.
   */
  taskManagement?: ITaskManagementProvider;

  /**
   * Additional registry providers, prepended before the official registry.
   * The first registry in this array that finds a component wins.
   * The official registry is always appended as the final fallback.
   */
  registries?: IRegistryProvider[];

  /**
   * Additional IDE adapters. These are run IN ADDITION TO built-in adapters
   * unless you also set `replaceBuiltInAdapters: true`.
   *
   * Falsy values are filtered (enables: `process.env.CI && new CIAdapter()`).
   */
  ideAdapters?: Array<IIDEAdapter | false | null | undefined>;

  /**
   * If true, built-in IDE adapters (OpenCode, Claude, Cursor, Windsurf) are
   * NOT registered. Your `ideAdapters` array is the complete set.
   * Default: false.
   */
  replaceBuiltInAdapters?: boolean;

  /**
   * Additional agent profile providers, tried before the built-in manifest profiles.
   */
  profileProviders?: IAgentProfileProvider[];
}
```

### 2.4 `defineConfig()` Helper (`packages/core/src/define-config.ts`)

```typescript
import type { OACPlugin } from './plugin.js';

/**
 * Type-safe configuration helper. Validates the shape of your plugin
 * configuration at TypeScript compile time and provides IDE autocomplete.
 *
 * This is a pure identity function at runtime — it exists solely for
 * TypeScript's benefit and to signal intent to readers.
 *
 * @example
 * ```ts
 * // oac.config.ts
 * import { defineConfig } from '@nextsystems/oac-core';
 *
 * export default defineConfig({
 *   context: new NotionContextProvider(),
 * });
 * ```
 */
export function defineConfig(plugin: OACPlugin): OACPlugin {
  return plugin;
}
```

### 2.5 `ProviderRegistry` — Internal Wiring (`packages/core/src/provider-registry.ts`)

```typescript
import type { IContextProvider } from './providers/context.js';
import type { ITaskManagementProvider } from './providers/task-management.js';
import type { IRegistryProvider } from './providers/registry.js';
import type { IIDEAdapter } from './providers/ide-adapter.js';
import type { IAgentProfileProvider } from './providers/agent-profile.js';
import type { OACPlugin } from './plugin.js';

export class ProviderRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderRegistryError';
  }
}

/**
 * ProviderRegistry is the internal wiring layer used by the CLI.
 * It is NOT a singleton. Each CLI invocation creates one via
 * `createProviderRegistry(config, plugin)`.
 *
 * Dispatch semantics:
 * - Context: callFirst() — first provider returning non-null wins
 * - Task management: single provider
 * - Registry: callFirst() in priority order, all participate in search
 * - IDE adapters: callAll() — all run in parallel
 * - Profile providers: callFirst() — first provider returning non-null wins
 */
export class ProviderRegistry {
  private _context: IContextProvider;
  private _taskManagement: ITaskManagementProvider;
  private _registries: IRegistryProvider[];
  private _ideAdapters: Map<string, IIDEAdapter>;
  private _profileProviders: IAgentProfileProvider[];

  // Use createProviderRegistry() — not this constructor directly
  constructor(
    context: IContextProvider,
    taskManagement: ITaskManagementProvider,
    registries: IRegistryProvider[],
    ideAdapters: IIDEAdapter[],
    profileProviders: IAgentProfileProvider[]
  ) {
    this._context = context;
    this._taskManagement = taskManagement;
    // Sort registries by priority descending
    this._registries = [...registries].sort((a, b) => b.priority - a.priority);
    this._ideAdapters = new Map(ideAdapters.map(a => [a.id, a]));
    this._profileProviders = profileProviders;
  }

  // ── Context ──────────────────────────────────────────────────────────────

  get context(): IContextProvider {
    return this._context;
  }

  // ── Task Management ──────────────────────────────────────────────────────

  get taskManagement(): ITaskManagementProvider {
    return this._taskManagement;
  }

  // ── Registry ─────────────────────────────────────────────────────────────

  get registries(): IRegistryProvider[] {
    return this._registries;
  }

  getRegistry(id: string): IRegistryProvider | undefined {
    return this._registries.find(r => r.id === id);
  }

  /**
   * callFirst() for registry fetch/version lookup.
   * Tries each registry in priority order, returns first success.
   */
  async resolveFromRegistry<T>(
    fn: (registry: IRegistryProvider) => Promise<T>
  ): Promise<T> {
    const errors: Error[] = [];
    for (const registry of this._registries) {
      try {
        return await fn(registry);
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
    throw new ProviderRegistryError(
      `No registry satisfied the request. Errors:\n${errors.map(e => `  - ${e.message}`).join('\n')}`
    );
  }

  // ── IDE Adapters ─────────────────────────────────────────────────────────

  getIDEAdapter(id: string): IIDEAdapter | undefined {
    return this._ideAdapters.get(id);
  }

  get ideAdapters(): IIDEAdapter[] {
    return Array.from(this._ideAdapters.values());
  }

  /**
   * callAll() for IDE adapter output generation.
   * Runs all adapters in parallel. Partial failures are collected,
   * not thrown — the caller decides what to do with failed adapters.
   */
  async runAllAdapters(
    fn: (adapter: IIDEAdapter) => Promise<void>
  ): Promise<Map<string, Error | null>> {
    const results = new Map<string, Error | null>();
    await Promise.all(
      Array.from(this._ideAdapters.entries()).map(async ([id, adapter]) => {
        try {
          await fn(adapter);
          results.set(id, null);
        } catch (err) {
          results.set(id, err instanceof Error ? err : new Error(String(err)));
        }
      })
    );
    return results;
  }

  // ── Profile Providers ────────────────────────────────────────────────────

  get profileProviders(): IAgentProfileProvider[] {
    return this._profileProviders;
  }

  /**
   * callFirst() for profile resolution.
   */
  async resolveProfile(name: string): Promise<import('./types/index.js').AgentProfile | null> {
    for (const provider of this._profileProviders) {
      const profile = await provider.get(name);
      if (profile !== null) return profile;
    }
    return null;
  }
}

/**
 * Factory function — the ONLY way to create a ProviderRegistry.
 * Never export `new ProviderRegistry()` or a module-level instance.
 *
 * The CLI calls this once per invocation after loading oac.config.ts.
 * Tests call this with mock providers for isolation.
 */
export async function createProviderRegistry(
  plugin: OACPlugin,
  defaults: {
    context: IContextProvider;
    taskManagement: ITaskManagementProvider;
    officialRegistry: IRegistryProvider;
    builtInAdapters: IIDEAdapter[];
    builtInProfileProvider: IAgentProfileProvider;
  }
): Promise<ProviderRegistry> {
  const context = plugin.context ?? defaults.context;
  const taskManagement = plugin.taskManagement ?? defaults.taskManagement;

  const registries: IRegistryProvider[] = [
    ...(plugin.registries ?? []),
    defaults.officialRegistry,
  ];

  const ideAdapters: IIDEAdapter[] = plugin.replaceBuiltInAdapters
    ? (plugin.ideAdapters?.filter(Boolean) as IIDEAdapter[] ?? [])
    : [
        ...defaults.builtInAdapters,
        ...(plugin.ideAdapters?.filter(Boolean) as IIDEAdapter[] ?? []),
      ];

  const profileProviders: IAgentProfileProvider[] = [
    ...(plugin.profileProviders ?? []),
    defaults.builtInProfileProvider,
  ];

  return new ProviderRegistry(
    context,
    taskManagement,
    registries,
    ideAdapters,
    profileProviders
  );
}
```

---

## 3. How Existing Code Maps In

### 3.1 AdapterRegistry → ProviderRegistry

`AdapterRegistry` is kept in `packages/compatibility-layer/` for backward compatibility with the 236 existing tests. It is **not** moved — its role is narrower (IDE adapter storage). `ProviderRegistry` is the new top-level wiring for all subsystems.

```
AdapterRegistry (existing)         ProviderRegistry (new)
──────────────────────────         ───────────────────────
register(adapter, aliases)    →    constructor(ideAdapters: IIDEAdapter[])
get(nameOrAlias)              →    getIDEAdapter(id)
getAll()                      →    ideAdapters getter
findByFeature(feature)        →    (move to IDE-specific query utilities)
registerBuiltInAdapters()     →    defaults.builtInAdapters in createProviderRegistry()
export const registry = ...   →    DELETED (see §3.3)
```

`AdapterRegistry.registerBuiltInAdapters()` becomes a function in `packages/cli/src/defaults.ts`:

```typescript
// packages/cli/src/defaults.ts
export async function loadBuiltInAdapters(): Promise<IIDEAdapter[]> {
  const adapters: IIDEAdapter[] = [];
  const modules = [
    ['opencode', () => import('./adapters/opencode.js')],
    ['claude',   () => import('./adapters/claude.js')],
    ['cursor',   () => import('./adapters/cursor.js')],
    ['windsurf', () => import('./adapters/windsurf.js')],
  ] as const;

  for (const [id, loader] of modules) {
    try {
      const mod = await loader();
      adapters.push(mod.default);
    } catch {
      // Adapter not available in this build — skip silently
    }
  }
  return adapters;
}
```

### 3.2 BaseAdapter → IIDEAdapter

`BaseAdapter` maps to `IIDEAdapter` as follows:

| BaseAdapter | IIDEAdapter | Notes |
|-------------|-------------|-------|
| `abstract name: string` | `readonly id: string` | Renamed for clarity |
| `abstract displayName: string` | `readonly displayName: string` | Same |
| `abstract toOAC(source: string): Promise<OpenAgent>` | `toOAC(source: string): Promise<OACAgent[]>` | Now returns array (multi-agent IDEs) |
| `abstract fromOAC(agent: OpenAgent): Promise<ConversionResult>` | `fromOAC(agents: OACAgent[], context: OACContext[]): Promise<IDEAdapterResult>` | Takes all agents + context |
| `abstract getConfigPath(agent?)` | `getOutputPath(): string` | Simplified — path is static per IDE |
| `abstract getCapabilities(): ToolCapabilities` | `getCapabilities(): IDECapabilities` | `ToolCapabilities` renamed `IDECapabilities` |
| `abstract validateConversion(agent)` | `validate(result: IDEAdapterResult): ValidationResult` | Validates output, not input |

**Migration approach**: existing `ClaudeAdapter`, `CursorAdapter`, `WindsurfAdapter` stay in `packages/compatibility-layer/` and continue extending `BaseAdapter`. In Project 5, new adapter implementations in `packages/cli/src/adapters/` implement `IIDEAdapter` directly. Both patterns coexist during the transition.

### 3.3 Singleton Fix (Critical — Blocks Test Isolation)

**Before** (`packages/compatibility-layer/src/core/AdapterRegistry.ts:358`):
```typescript
// BUG: Module-level singleton — shared state bleeds between tests
export const registry = new AdapterRegistry();
```

**After**:
```typescript
// DELETED — do not export a module-level instance

// Keep the class and export it:
export { AdapterRegistry } from './AdapterRegistry.js';

// The CLI creates its own instance:
// const reg = new AdapterRegistry();
// await reg.registerBuiltInAdapters();
```

**For the CLI** (`packages/cli/src/index.ts`):
```typescript
// One instance per CLI invocation — created in the command handler, not at module load
async function runCommand(args: string[]): Promise<void> {
  const config = await loadOACConfig();
  const plugin = await loadUserPlugin(config);
  const registry = await createProviderRegistry(plugin, await loadDefaults(config));
  // pass `registry` into command handlers
}
```

**For the compatibility-layer tests** (backward-compatible fix, no test changes):

In test setup files, replace:
```typescript
import { registry } from '../core/AdapterRegistry.js';
// registry is the same singleton for all tests — BAD
```
with:
```typescript
import { AdapterRegistry } from '../core/AdapterRegistry.js';
const registry = new AdapterRegistry(); // fresh instance per test
```

If the tests import from the old path, add a `beforeEach` reset:
```typescript
import { registry } from '../core/AdapterRegistry.js';
beforeEach(() => registry.clear()); // temporary mitigation
```

This is the minimal fix that doesn't break the 236 tests while the full migration proceeds.

### 3.4 AgentLoader Module Globals Fix

**Before** (`packages/compatibility-layer/src/core/AgentLoader.ts:169`):
```typescript
// BUG: Module globals — bleed between tests, never invalidated
let cachedMetadata: Record<string, Partial<OpenAgent["metadata"]>> = {};
let metadataLoaded = false;
```

**After** — move cache into the class instance:
```typescript
export class AgentLoader {
  private projectRoot?: string;
  // Cache lives on the instance, not the module
  private cachedMetadata: Record<string, Partial<OpenAgent["metadata"]>> | null = null;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot;
  }

  private loadMetadataFile(): Record<string, Partial<OpenAgent["metadata"]>> {
    if (this.cachedMetadata !== null) {
      return this.cachedMetadata;
    }
    // ... same file loading logic ...
    this.cachedMetadata = parsed.agents || {};
    return this.cachedMetadata;
  }
}
```

Tests that need a fresh metadata load: `new AgentLoader(testRoot)` — the fresh instance has no cache. No test changes required.

### 3.5 Types From `types.ts`: Keep / Fix / Replace

| Type | Action | Reason |
|------|--------|--------|
| `ToolAccessSchema` | **Keep** — move to core | Still valid |
| `PermissionRuleSchema` | **Keep** — move to core | Still valid |
| `GranularPermissionSchema` | **Keep** — move to core | Still valid |
| `ContextPrioritySchema` | **Keep** — move to core | Still valid |
| `ModelIdentifierSchema` | **Fix** — `z.union([z.string(), z.string()])` → `z.string()` | Union of identical types is a bug |
| `TemperatureSchema` | **Fix** — add `.min(0).max(2)` | Unconstrained allows nonsense values |
| `AgentMetadataSchema` | **Fix** — make consistent with `OpenAgentSchema.metadata` (all optional or all required — pick one) | Strict vs loose mismatch causes validation failures |
| `OpenAgentSchema.metadata` | **Fix** — align with `AgentMetadataSchema` | One or the other must be the canonical shape |
| `ToolCapabilities` | **Rename** → `IDECapabilities` in core | More precise name, same fields |
| `ConversionResult` | **Replace** → `IDEAdapterResult` in core | Richer type (files vs configs, better error model) |
| `ToolConfig` | **Keep in compat-layer** — used by existing adapters | Not needed in core |
| `AgentFrontmatterSchema` | **Keep** — move to core | Canonical schema |
| `OpenAgentSchema` | **Keep** — move to core, fix metadata inconsistency | Canonical |

**Schema fix — ModelIdentifierSchema**:
```typescript
// Before (bug):
export const ModelIdentifierSchema = z.union([z.string(), z.string()]);

// After:
export const ModelIdentifierSchema = z.string()
  .min(1)
  .describe('Model identifier, e.g. "claude-opus-4-5", "gpt-4o", "gemini-2.0-flash"');
```

**Schema fix — TemperatureSchema**:
```typescript
// Before (unconstrained):
export const TemperatureSchema = z.number();

// After:
export const TemperatureSchema = z.number()
  .min(0)
  .max(2)
  .describe('Model temperature (0.0–2.0). Most IDEs cap at 1.0.');
```

**Schema fix — AgentMetadata strict/OpenAgent metadata loose**:
```typescript
// Root cause: AgentMetadataSchema requires category/type/author
// but OpenAgentSchema.metadata makes them all optional.
// Decision: OpenAgentSchema.metadata IS AgentMetadataSchema (all required except tags/deps)

export const OpenAgentSchema = z.object({
  frontmatter: AgentFrontmatterSchema,
  metadata: AgentMetadataSchema,   // Use the strict schema — it's the canonical shape
  systemPrompt: z.string(),
  contexts: z.array(ContextReferenceSchema).default([]),
  sections: z.object({ ... }).optional(),
});
```

---

## 4. Configuration Design

### 4.1 Format Decision: `oac.config.ts` (TypeScript)

**Decision: `oac.config.ts`, not `oac.config.json`.**

Rationale:
1. Providers are class instances — they cannot be expressed in JSON
2. Environment variable interpolation is native in TypeScript (`process.env.NOTION_TOKEN!`)
3. Conditional providers work naturally: `process.env.CI && ciAdapter()`
4. TypeScript gives compile-time validation of the config shape
5. `defineConfig()` provides full IDE autocomplete

JSON config is used for **data** (preferences, registries list, IDE paths). TypeScript is used for **behavior** (provider wiring).

The two files coexist:
- `.oac/config.json` — committed to git, data-only, no secrets
- `oac.config.ts` — committed to git, provider wiring, imports from npm packages
- `~/.config/oac/config.json` — user-global preferences (not committed)

### 4.2 Config Loading Pipeline

```typescript
// packages/cli/src/config/loader.ts

export async function loadFullConfig(cwd: string): Promise<{
  data: OACConfig;
  plugin: OACPlugin;
}> {
  // Step 1: Load data config (JSON, three-way merge)
  const defaults = getConfigDefaults();
  const globalData = await loadConfigJson('~/.config/oac/config.json');
  const projectData = await loadConfigJson(join(cwd, '.oac/config.json'));
  const envOverrides = readEnvOverrides();

  const data = OACConfigSchema.parse(
    deepMerge(defaults, globalData, projectData, envOverrides)
  );

  // Step 2: Load TypeScript plugin (optional)
  const pluginPath = join(cwd, 'oac.config.ts');
  let plugin: OACPlugin = {};

  if (await pathExists(pluginPath)) {
    // Use jiti for zero-config TS execution (no ts-node required)
    const { createJiti } = await import('jiti');
    const jiti = createJiti(import.meta.url);
    const mod = await jiti.import(pluginPath);
    plugin = mod.default ?? mod;
  }

  return { data, plugin };
}
```

### 4.3 Environment Variable Mapping

| Env Var | Maps To | Type |
|---------|---------|------|
| `OAC_YOLO=true` | `data.preferences.yoloMode` | boolean |
| `OAC_REGISTRY_URL=https://...` | Prepends to `data.registries` with priority 0 | string |
| `OAC_BRANCH=main` | `data.preferences.branch` | string |
| `OAC_INSTALL_LOCATION=global` | `data.preferences.installLocation` | `'local' \| 'global'` |
| `OAC_CONFLICT_STRATEGY=yolo` | `data.preferences.conflictStrategy` | ConflictStrategy |
| `OAC_PRIVATE_TOKEN=...` | Used by registry providers that opt in | string |
| `OAC_VERBOSE=true` | CLI verbosity | boolean |
| `OAC_QUIET=true` | CLI quiet mode | boolean |

Environment variables override JSON config but **cannot** wire providers (use `oac.config.ts` for that).

### 4.4 `defineConfig()` Signature (Final)

```typescript
// packages/core/src/define-config.ts

/**
 * @param plugin - Your OAC provider configuration
 * @returns The same object, typed as OACPlugin
 *
 * @example Minimal — override context only
 * ```ts
 * export default defineConfig({
 *   context: new NotionContextProvider({ token: process.env.NOTION_TOKEN! }),
 * });
 * ```
 *
 * @example Enterprise — full stack replacement
 * ```ts
 * export default defineConfig({
 *   context: new ConfluenceContextProvider({ baseUrl: '...', token: '...' }),
 *   taskManagement: new JiraTaskProvider({ projectKey: 'ENG', token: '...' }),
 *   registries: [new PrivateRegistryProvider({ url: '...', token: '...' })],
 *   ideAdapters: [new JetBrainsAdapter()],
 * });
 * ```
 *
 * @example Conditional — CI-only adapter
 * ```ts
 * export default defineConfig({
 *   ideAdapters: [
 *     process.env.CI && new CIMetricsAdapter(),
 *   ],
 * });
 * ```
 */
export function defineConfig(plugin: OACPlugin): OACPlugin {
  return plugin;
}
```

### 4.5 OACConfig Schema (Data Shape)

```typescript
// packages/core/src/schemas/config.ts

export const OACConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  preferences: z.object({
    defaultIDE: z.string().default('opencode'),
    installLocation: z.enum(['local', 'global']).default('local'),
    yoloMode: z.boolean().default(false),
    conflictStrategy: z.enum(['ask', 'skip', 'overwrite', 'backup', 'yolo']).default('ask'),
    autoBackup: z.boolean().default(true),
    updateMode: z.enum(['manual', 'auto-safe', 'auto-all', 'locked']).default('manual'),
    branch: z.string().default('main'),
  }).default({}),
  registries: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    priority: z.number().int().min(0).default(1),
    authTokenEnvVar: z.string().optional(), // e.g. "OAC_PRIVATE_TOKEN"
  })).default([{ name: 'official', url: 'https://registry.nextsystems.dev/oac', priority: 1 }]),
  ides: z.record(z.string(), z.object({
    enabled: z.boolean().default(false),
    path: z.string().optional(),
    profile: z.string().default('developer'),
  })).default({
    opencode: { enabled: true, path: '.opencode', profile: 'developer' },
  }),
});

export type OACConfig = z.infer<typeof OACConfigSchema>;
```

---

## 5. `packages/core` Final Structure

```
packages/core/
├── src/
│   ├── providers/
│   │   ├── context.ts             # IContextProvider interface
│   │   ├── task-management.ts     # ITaskManagementProvider interface
│   │   ├── registry.ts            # IRegistryProvider interface
│   │   ├── ide-adapter.ts         # IIDEAdapter interface
│   │   └── agent-profile.ts       # IAgentProfileProvider interface
│   ├── schemas/
│   │   ├── agent.ts               # AgentConfigSchema + AgentFrontmatterSchema (canonical)
│   │   ├── config.ts              # OACConfigSchema
│   │   ├── lockfile.ts            # OACLockSchema + InstalledComponentSchema
│   │   ├── registry.ts            # RegistryItemSchema + RegistrySchema
│   │   ├── skill.ts               # SkillFrontmatterSchema
│   │   ├── context.ts             # ContextFrontmatterSchema + ContextFileSchema
│   │   └── manifest.ts            # BundledManifestSchema + InstalledManifestSchema
│   ├── types/
│   │   └── index.ts               # All shared TypeScript types (§2.1 above)
│   ├── plugin.ts                  # OACPlugin interface
│   ├── define-config.ts           # defineConfig() helper
│   ├── provider-registry.ts       # ProviderRegistry class + createProviderRegistry()
│   └── index.ts                   # Re-exports everything (single import surface)
├── package.json
└── tsconfig.json
```

**`src/index.ts`** (complete barrel — everything available from `'@nextsystems/oac-core'`):
```typescript
// Providers
export type { IContextProvider } from './providers/context.js';
export type { ITaskManagementProvider } from './providers/task-management.js';
export type { IRegistryProvider } from './providers/registry.js';
export type { IIDEAdapter } from './providers/ide-adapter.js';
export type { IAgentProfileProvider } from './providers/agent-profile.js';

// Schemas (Zod objects, for runtime validation)
export { AgentFrontmatterSchema, AgentConfigSchema } from './schemas/agent.js';
export { OACConfigSchema } from './schemas/config.js';
export { OACLockSchema } from './schemas/lockfile.js';
export { RegistryItemSchema, RegistrySchema } from './schemas/registry.js';
export { SkillFrontmatterSchema } from './schemas/skill.js';
export { ContextFrontmatterSchema } from './schemas/context.js';
export { BundledManifestSchema, InstalledManifestSchema } from './schemas/manifest.js';

// Types (TypeScript-only)
export type {
  ComponentType, UpdateMode, ConflictStrategy, InstallLocation,
  ContextLayerName, ContextFile, ContextQuery,
  Task, TaskStatus, TaskPriority, TaskSession,
  RegistryFile, RegistryItem, RegistrySearchOptions,
  IDECapabilities, IDEOutputFile, IDEAdapterResult,
  AgentProfile, OACAgent, OACContext,
  ValidationResult, OACOperationResult,
  // Inferred from schemas
  AgentFrontmatter, AgentConfig, OACConfig, OACLock,
} from './types/index.js';

// Plugin system
export type { OACPlugin } from './plugin.js';
export { defineConfig } from './define-config.js';

// Provider registry (internal wiring — CLI uses this, not plugin authors)
export { ProviderRegistry, createProviderRegistry, ProviderRegistryError } from './provider-registry.js';
```

**`package.json`**:
```json
{
  "name": "@nextsystems/oac-core",
  "version": "1.0.0",
  "description": "Shared interfaces, schemas, and provider contracts for OAC",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "peerDependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.5.0",
    "zod": "^3.22.0"
  }
}
```

**Zero runtime dependencies.** `zod` is a peer dependency — the CLI and plugin authors both have it. This means `@nextsystems/oac-core` ships ~0 bytes of dependencies.

---

## 6. Migration Path (No Breaking Changes to 236 Tests)

The migration is designed so that every step leaves the test suite green. Each step is a separate PR.

### Step 1: Fix Module-Level Bugs (No New Code)

**PR: "fix: eliminate module-level singletons that break test isolation"**

1. In `AdapterRegistry.ts:358`: Remove `export const registry = new AdapterRegistry()`. Add `export function createAdapterRegistry(): AdapterRegistry { return new AdapterRegistry(); }`.
2. In test files that import `registry`: Add `beforeEach(() => registry.clear())` as a bridge (or switch to `createAdapterRegistry()`).
3. In `AgentLoader.ts:169`: Move `cachedMetadata` and `metadataLoaded` to instance fields.
4. In `plugin.ts`: Remove `const pluginInstance = new AbilitiesPlugin()`. Make `AbilitiesPlugin` instantiated in the consumer.

**Test impact**: Tests that relied on shared singleton state may need `beforeEach(() => registry.clear())`. All 236 tests must pass after this step.

### Step 2: Fix Schema Bugs

**PR: "fix: correct schema bugs in types.ts"**

1. Fix `ModelIdentifierSchema`: `z.union([z.string(), z.string()])` → `z.string()`
2. Fix `TemperatureSchema`: add `.min(0).max(2)`
3. Fix `AgentMetadataSchema` vs `OpenAgentSchema.metadata` inconsistency: use `AgentMetadataSchema` inside `OpenAgentSchema`

**Test impact**: Tests that previously passed invalid temperature/model values will now fail Zod validation — fix the test data, not the schema.

### Step 3: Create `packages/core` Package

**PR: "feat(core): create @nextsystems/oac-core with provider interfaces"**

1. Create `packages/core/` with the directory structure from §5
2. Copy types from `compatibility-layer/src/types.ts` into `core/src/schemas/` (with schema fixes applied)
3. Write the 5 provider interfaces, `OACPlugin`, `defineConfig()`, `ProviderRegistry`
4. Add `"@nextsystems/oac-core": "workspace:*"` to root `package.json`
5. Fix root `package.json` workspaces: `["packages/*", "evals/framework"]`

**Test impact**: Zero — no existing code changed, only new files added.

### Step 4: Wire Compatibility-Layer to Core Types

**PR: "refactor(compat): import shared types from @nextsystems/oac-core"**

1. In `compatibility-layer/src/types.ts`: Change schema definitions to re-export from `@nextsystems/oac-core` (keep backward-compatible exports)
2. In `compatibility-layer/src/adapters/BaseAdapter.ts`: Import `OACAgent`, `IDEAdapterResult` from `@nextsystems/oac-core`

**Test impact**: Zero if re-exports are clean. Run `tsc --noEmit` to confirm.

### Step 5: Migrate Adapters to IIDEAdapter

**PR: "refactor(compat): ClaudeAdapter, CursorAdapter, WindsurfAdapter implement IIDEAdapter"**

1. Add `implements IIDEAdapter` to each adapter class
2. Rename `name` → `id` on each adapter
3. Update `fromOAC` signature to accept `agents[]` + `context[]`
4. Add `validate()` method to each adapter

**Test impact**: Adapter tests that call `adapter.name` need updating to `adapter.id`. This is the one place where test changes are expected — they are mechanical renames.

### Step 6: CLI Wiring

**PR: "feat(cli): wire ProviderRegistry into CLI commands"**

1. Create `packages/cli/` with `createProviderRegistry()` call in CLI entry point
2. Load `oac.config.ts` via jiti if present
3. Pass `ProviderRegistry` into command handlers

**Test impact**: CLI tests get fresh registry per test via `createProviderRegistry()` with mock providers.

---

## 7. Impact on Each of the 6 Projects

### P1: `@nextsystems/oac-core`

This document **is** the specification for P1. The team builds exactly the interfaces, types, schemas, `OACPlugin`, `defineConfig()`, and `ProviderRegistry` defined in §2. The package has zero runtime dependencies (zod is peer). The 5 provider interfaces are the extensibility contract that must remain stable — no breaking changes without a major version bump. Primary deliverable: a clean `index.ts` barrel from which every other package imports. Time estimate: 1–2 weeks. The schema fixes in §3.5 are part of P1, not P4.

### P2: `@nextsystems/oac-cli`

P2 depends on P1 and builds around `createProviderRegistry()`. Every CLI command receives a `ProviderRegistry` instance, never a singleton. The `ConfigManager` loads `.oac/config.json` (data) and `oac.config.ts` (plugin wiring) separately via the pipeline in §4.2. The `jiti` dependency handles TypeScript config execution without requiring ts-node. CLI commands must never import providers directly — they receive them through the registry. The YOLO flag maps to `OACConfig.preferences.conflictStrategy = 'yolo'`, not a separate code path.

### P3: Context System

P3 implements `IContextProvider` twice: `DefaultContextProvider` (6-layer filesystem resolver) and tests can mock it. The `DefaultContextProvider` is the only built-in implementation; it is passed as `defaults.context` to `createProviderRegistry()`. The 6-layer resolution logic lives entirely inside this class — nothing else in the codebase does path resolution. `oac context install` calls `provider.install()`, `oac context update` calls `provider.update()`. The dispatch semantics (callFirst) mean that if an enterprise user provides a `NotionContextProvider`, the 6-layer resolver is completely bypassed — no partial execution, no fallthrough.

### P4: Agent & Skill Management

P4 introduces the `agent.json` + `prompt.md` split. The `OACAgent` type defined in §2.1 is exactly what flows between P4's loader and the IDE adapters. P4 implements `IAgentProfileProvider` (built-in, reading from `manifest.json` profiles). The `AgentLoader` refactor (instance-scoped cache, §3.4) is a P4 prerequisite and should be done in P1's bug-fix step. The `task-cli.ts → task-cli.js` compilation happens in P4's build pipeline; the resulting `.js` file implements the default `ITaskManagementProvider` behavior for local JSON sessions.

### P5: Plugin System

P5 implements the IDE adapters as `IIDEAdapter` (not extending `BaseAdapter`). The OpenCode TS plugin is an OpenCode plugin (a different abstraction — `Plugin` from `@opencode-ai/plugin`) that internally calls `createProviderRegistry()` to get the configured context and task providers. The Claude Code adapter implements `IIDEAdapter.fromOAC()` to generate `session-start.js`. Cursor and Windsurf adapters are straightforward `IIDEAdapter` implementations. The `callAll()` dispatch in `ProviderRegistry.runAllAdapters()` is what P5 calls when `oac install --all` runs — all IDE adapters execute in parallel.

### P6: Registry & Community

P6 implements `IRegistryProvider` as `OfficialRegistryProvider` (nextsystems.dev) and provides the wiring for user-configured private registries. The `RegistryClient` in §P6 of the breakdown maps to `ProviderRegistry.resolveFromRegistry()` — the priority-ordered callFirst dispatch. Multi-registry search is implemented by calling `search()` on all registries, deduplicating by `name+type`, and returning sorted results. Auth tokens for private registries are read from `config.registries[n].authTokenEnvVar` — the env var name is stored in config, the value is never stored.

---

## 8. Red Lines

The following are explicitly forbidden. Each has a one-line rationale.

| Do Not | Why |
|--------|-----|
| Export a module-level singleton (`export const registry = new X()`) | Singletons bleed state between tests and make isolation impossible |
| Add runtime dependencies to `packages/core` | Zero-dep is a load-time guarantee; adding deps violates the contract with plugin authors |
| Use `ts-node` at runtime | Eliminates a fragile dev dependency from production paths; use jiti or pre-compile |
| Merge `IContextProvider` and `ITaskManagementProvider` into one interface | Different dispatch semantics (callFirst vs single) cannot be unified without obscuring behavior |
| Make `OACPlugin` fields required | Plugin authors implement one subsystem; required fields force them to stub everything else |
| Use TSyringe, Inversify, or any DI container | Decorator-based DI requires `emitDecoratorMetadata`, is incompatible with ESM tree-shaking, and creates plugin author friction |
| Use Effect-TS | Its error model and type complexity is appropriate for library authors, not community plugin authors writing `implements IContextProvider` |
| Store auth tokens in `.oac/config.json` | Secrets in config files get committed to git; use env vars and store only the env var name |
| Implement `callAll()` dispatch outside `ProviderRegistry` | Dispatch semantics must be centralized; scattered fan-out logic produces inconsistent error handling |
| Give IDE adapters filesystem write access directly | Adapters return file content; the CLI writes files; this enables dry-run support and prevents adapters from bypassing conflict resolution |
| Use `z.union([z.string(), z.string()])` anywhere | Duplicate union members collapse to the first — this is always a bug |
| Share `AgentLoader` instance between parallel requests | `AgentLoader` has instance-scoped cache; a shared instance across concurrent loads will return stale data |
| Make `BaseAdapter` implement `IIDEAdapter` via inheritance | Inheritance creates a coupling between the compatibility-layer and core; the adapters in P5 implement `IIDEAdapter` directly |
| Hand-maintain SHA256 hashes in manifest.json | Manual SHA256s drift; `scripts/generate-manifest.ts` must be the only source |
| Put business logic in `defineConfig()` | It is an identity function for type safety; logic in it is invisible to callers |
| Make `ProviderRegistry` accept partial providers without defaults | A registry with no context provider crashes at runtime; defaults must be passed to `createProviderRegistry()` |

---

*This document supersedes all prior provider/adapter discussions. Implementation of P1 begins with the interfaces in §2 locked.*
