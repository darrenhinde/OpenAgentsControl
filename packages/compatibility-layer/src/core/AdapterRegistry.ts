import type { BaseAdapter } from "../adapters/BaseAdapter.js";
import type { ToolCapabilities } from "../types.js";

// ============================================================================
// ADAPTER REGISTRY TYPES
// ============================================================================

/**
 * Information about a registered adapter including its capabilities
 */
export interface AdapterInfo {
  name: string;
  adapter: BaseAdapter;
  capabilities: ToolCapabilities;
}

/**
 * Registry error for missing or duplicate adapters
 */
export class AdapterRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterRegistryError";
  }
}

// ============================================================================
// ADAPTER REGISTRY CLASS
// ============================================================================

/**
 * Registry for managing tool adapters.
 * 
 * The registry maintains a collection of adapters and provides
 * type-safe registration, lookup, and querying capabilities.
 * 
 * Features:
 * - Type-safe adapter storage with Map
 * - Alias support for adapter names
 * - Capability-based adapter discovery
 * - Singleton pattern for global registry
 * 
 * @example
 * ```ts
 * const registry = new AdapterRegistry();
 * 
 * // Register adapter with aliases
 * registry.register(new CursorAdapter(), ['cursor-ide', 'cursor-editor']);
 * 
 * // Get adapter by name or alias
 * const adapter = registry.get('cursor'); // or 'cursor-ide'
 * 
 * // List all adapters
 * const names = registry.list(); // ['claude', 'cursor', 'windsurf']
 * ```
 */
export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();
  private aliases: Map<string, string> = new Map();

  constructor() {
    // Registry starts empty - adapters registered manually or via registerBuiltInAdapters()
  }

  /**
   * Register a tool adapter with optional aliases.
   * 
   * @param adapter - The adapter instance to register
   * @param aliases - Optional array of alias names
   * @throws {AdapterRegistryError} If adapter with same name already exists
   * 
   * @example
   * ```ts
   * registry.register(new CursorAdapter(), ['cursor-ide', 'cursor-editor']);
   * ```
   */
  register(adapter: BaseAdapter, aliases?: string[]): void {
    const normalizedName = adapter.name.toLowerCase();

    // Check for duplicate registration
    if (this.adapters.has(normalizedName)) {
      throw new AdapterRegistryError(
        `Adapter '${adapter.name}' is already registered. Use a different name or unregister the existing adapter first.`
      );
    }

    // Register main adapter
    this.adapters.set(normalizedName, adapter);

    // Register aliases
    if (aliases && aliases.length > 0) {
      aliases.forEach((alias) => {
        const normalizedAlias = alias.toLowerCase();
        
        // Check if alias conflicts with existing adapter name
        if (this.adapters.has(normalizedAlias)) {
          throw new AdapterRegistryError(
            `Alias '${alias}' conflicts with existing adapter name '${normalizedAlias}'`
          );
        }

        // Check if alias is already registered
        if (this.aliases.has(normalizedAlias)) {
          throw new AdapterRegistryError(
            `Alias '${alias}' is already registered for adapter '${this.aliases.get(normalizedAlias)}'`
          );
        }

        this.aliases.set(normalizedAlias, normalizedName);
      });
    }
  }

  /**
   * Get an adapter by name or alias.
   * 
   * @param nameOrAlias - The adapter name or alias (case-insensitive)
   * @returns The adapter instance, or undefined if not found
   * 
   * @example
   * ```ts
   * const adapter = registry.get('cursor'); // or 'cursor-ide'
   * if (adapter) {
   *   const result = await adapter.fromOAC(agent);
   * }
   * ```
   */
  get(nameOrAlias: string): BaseAdapter | undefined {
    const normalized = nameOrAlias.toLowerCase();

    // Try direct lookup
    if (this.adapters.has(normalized)) {
      return this.adapters.get(normalized);
    }

    // Try alias lookup
    if (this.aliases.has(normalized)) {
      const actualName = this.aliases.get(normalized);
      if (actualName) {
        return this.adapters.get(actualName);
      }
    }

    return undefined;
  }

  /**
   * Check if an adapter exists by name or alias.
   * 
   * @param nameOrAlias - The adapter name or alias (case-insensitive)
   * @returns True if adapter exists, false otherwise
   * 
   * @example
   * ```ts
   * if (registry.has('cursor')) {
   *   console.log('Cursor adapter is available');
   * }
   * ```
   */
  has(nameOrAlias: string): boolean {
    return this.get(nameOrAlias) !== undefined;
  }

  /**
   * List all registered adapter names (sorted alphabetically).
   * 
   * @returns Array of adapter names
   * 
   * @example
   * ```ts
   * const names = registry.list(); // ['claude', 'cursor', 'windsurf']
   * ```
   */
  list(): string[] {
    return Array.from(this.adapters.keys()).sort();
  }

  /**
   * Get all adapters with their capabilities.
   * 
   * @returns Array of adapter info objects (sorted by name)
   * 
   * @example
   * ```ts
   * const all = registry.getAll();
   * all.forEach(({ name, capabilities }) => {
   *   console.log(`${name}: supports ${capabilities.multipleAgents ? 'multiple' : 'single'} agents`);
   * });
   * ```
   */
  getAll(): AdapterInfo[] {
    const result: AdapterInfo[] = [];

    this.adapters.forEach((adapter, name) => {
      result.push({
        name,
        adapter,
        capabilities: adapter.getCapabilities(),
      });
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get capabilities for a specific adapter.
   * 
   * @param nameOrAlias - The adapter name or alias
   * @returns Tool capabilities, or undefined if adapter not found
   * 
   * @example
   * ```ts
   * const caps = registry.getCapabilities('cursor');
   * if (caps?.multipleAgents === false) {
   *   console.warn('Cursor only supports single agent files');
   * }
   * ```
   */
  getCapabilities(nameOrAlias: string): ToolCapabilities | undefined {
    const adapter = this.get(nameOrAlias);
    return adapter?.getCapabilities();
  }

  /**
   * Find all adapters that support a specific feature.
   * 
   * @param feature - The feature key to search for
   * @returns Array of adapters that support the feature
   * 
   * @example
   * ```ts
   * const withMultiAgent = registry.findByFeature('multipleAgents');
   * console.log(`${withMultiAgent.length} adapters support multiple agents`);
   * ```
   */
  findByFeature(feature: keyof ToolCapabilities): BaseAdapter[] {
    const result: BaseAdapter[] = [];

    this.adapters.forEach((adapter) => {
      const capabilities = adapter.getCapabilities();
      if (capabilities[feature] === true) {
        result.push(adapter);
      }
    });

    return result;
  }

  /**
   * Unregister an adapter by name.
   * 
   * @param name - The adapter name to remove
   * @returns True if adapter was removed, false if not found
   * 
   * @example
   * ```ts
   * registry.unregister('cursor');
   * ```
   */
  unregister(name: string): boolean {
    const normalized = name.toLowerCase();

    // Remove adapter
    const removed = this.adapters.delete(normalized);

    // Remove all aliases pointing to this adapter
    if (removed) {
      const aliasesToRemove: string[] = [];
      this.aliases.forEach((adapterName, alias) => {
        if (adapterName === normalized) {
          aliasesToRemove.push(alias);
        }
      });
      aliasesToRemove.forEach((alias) => this.aliases.delete(alias));
    }

    return removed;
  }

  /**
   * Clear all registered adapters and aliases.
   * 
   * @example
   * ```ts
   * registry.clear();
   * console.log(registry.list()); // []
   * ```
   */
  clear(): void {
    this.adapters.clear();
    this.aliases.clear();
  }

  /**
   * Get the number of registered adapters.
   * 
   * @returns Count of registered adapters (excluding aliases)
   */
  get size(): number {
    return this.adapters.size;
  }

  /**
   * Register built-in adapters (lazy loading).
   * 
   * This method is called on-demand to avoid circular dependencies.
   * Adapters are imported dynamically when first needed.
   * 
   * @example
   * ```ts
   * await registry.registerBuiltInAdapters();
   * ```
   */
  async registerBuiltInAdapters(): Promise<void> {
    // Dynamic imports to avoid circular dependencies
    try {
      // Cursor IDE
      const { CursorAdapter } = await import("../adapters/CursorAdapter.js");
      this.register(new CursorAdapter(), ["cursor-ide", "cursor-editor"]);
    } catch (error) {
      // Adapter not yet implemented - skip silently
    }

    try {
      // Claude Code
      const { ClaudeAdapter } = await import("../adapters/ClaudeAdapter.js");
      this.register(new ClaudeAdapter(), ["claude-code", "anthropic-claude"]);
    } catch (error) {
      // Adapter not yet implemented - skip silently
    }

    try {
      // Windsurf (experimental)
      const { WindsurfAdapter } = await import("../adapters/WindsurfAdapter.js");
      this.register(new WindsurfAdapter(), ["windsurf-ide"]);
    } catch (error) {
      // Adapter not yet implemented - skip silently
    }

    try {
      // OpenClaw
      const { OpenClawAdapter } = await import("../adapters/OpenClawAdapter.js");
      this.register(new OpenClawAdapter(), ["openclaw-gateway"]);
    } catch (error) {
      // Adapter not yet implemented - skip silently
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Global singleton registry instance.
 * 
 * Use this for most cases unless you need isolated registries for testing.
 * 
 * @example
 * ```ts
 * import { registry } from './core/AdapterRegistry.js';
 * 
 * const adapter = registry.get('cursor');
 * ```
 */
export const registry = new AdapterRegistry();

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Get an adapter from the global registry.
 * 
 * @param nameOrAlias - The adapter name or alias
 * @returns The adapter instance, or undefined if not found
 * 
 * @example
 * ```ts
 * const adapter = getAdapter('cursor');
 * ```
 */
export function getAdapter(nameOrAlias: string): BaseAdapter | undefined {
  return registry.get(nameOrAlias);
}

/**
 * List all adapters in the global registry.
 * 
 * @returns Array of adapter names
 * 
 * @example
 * ```ts
 * const names = listAdapters(); // ['claude', 'cursor', 'windsurf']
 * ```
 */
export function listAdapters(): string[] {
  return registry.list();
}

/**
 * Get all adapter capabilities from the global registry.
 * 
 * @returns Array of objects with name and capabilities
 * 
 * @example
 * ```ts
 * const capabilities = getAllCapabilities();
 * capabilities.forEach(({ name, capabilities }) => {
 *   console.log(`${name}:`, capabilities);
 * });
 * ```
 */
export function getAllCapabilities(): Array<{ name: string; capabilities: ToolCapabilities }> {
  return registry.getAll().map(({ name, capabilities }) => ({
    name,
    capabilities,
  }));
}
