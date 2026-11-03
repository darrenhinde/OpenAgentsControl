# Context System TypeScript Coding Standards

**Purpose**: TypeScript coding standards for context system implementation  
**Scope**: Context resolver, CLI tools, and context management utilities  
**Last Updated**: 2026-02-16

---

## Overview

This document defines TypeScript coding standards specifically for the context system. These standards are extracted from the main OpenCode TypeScript standards and tailored for context-related code.

**Relationship to TypeScript Standards**:
- **Universal TypeScript** (`core/standards/typescript.md`) - Universal TypeScript patterns applicable to any project
- **OpenCode TypeScript** (`openagents-repo/standards/opencode-typescript.md`) - OpenCode-specific patterns (fn() wrapper, namespaces, etc.)
- **This file** (`typescript-coding.md`) - Context system-specific subset focused on context resolver, CLI tools, and context management utilities

**When to use which**:
- Writing TypeScript code anywhere → Load universal typescript.md
- Writing OpenCode-specific code → Load opencode-typescript.md
- Writing context system code specifically → Load universal typescript.md, opencode-typescript.md, AND this file
- This file extends the base standards with context-specific patterns, not replaces them

**Key Principles**:
1. **Type Safety First** - Use Zod schemas for runtime validation
2. **Functional Patterns** - Prefer pure functions over classes
3. **Error Handling** - Explicit error types with context
4. **Async Operations** - Proper handling of file I/O and git operations
5. **Testing** - Comprehensive test coverage for all resolver logic

---

## Implementation Status

This document describes both **current implementation** and **recommended patterns** for the context system.

**Legend**:
- ✅ **Current Implementation** - Patterns currently used in the codebase
- 🎯 **Recommended** - Patterns to adopt for improvements
- ⚠️ **Note** - Important clarifications or caveats

**Priority Improvements**:
1. Add Zod schemas for runtime validation (Section 1.1)
2. Implement typed error classes (Section 3.1)
3. Convert to async file operations (Section 4.1)
4. Add branded types for type safety (Section 1.3)

---

## 1. Type Definitions

### 1.1 Configuration Types

**Current Implementation: TypeScript interfaces**  
**Recommended: Zod schemas for runtime validation**

```typescript
// ✅ CURRENT IMPLEMENTATION - TypeScript interface
// packages/core/src/context/resolver.ts:11-28
export interface OACConfig {
  version: string;
  project?: {
    name: string;
    type: string;
    version: string;
  };
  context: {
    root: string;
    locations?: Record<string, string>;
    update?: {
      check_on_start?: boolean;
      auto_update?: boolean;
      interval?: string;
      strategy?: 'auto' | 'manual' | 'notify';
    };
  };
}

// Usage (current)
function loadConfig(path: string): OACConfig {
  const content = fs.readFileSync(path, 'utf-8');
  return JSON.parse(content); // No runtime validation
}

// 🎯 RECOMMENDED - Zod schema with runtime validation
import { z } from 'zod';

export const OACConfigSchema = z.object({
  version: z.string(),
  project: z.object({
    name: z.string(),
    type: z.string(),
    version: z.string(),
  }).optional(),
  context: z.object({
    root: z.string(),
    locations: z.record(z.string()).optional(),
    update: z.object({
      check_on_start: z.boolean().optional(),
      auto_update: z.boolean().optional(),
      interval: z.string().optional(),
      strategy: z.enum(['auto', 'manual', 'notify']).optional(),
    }).optional(),
  }),
});

export type OACConfig = z.infer<typeof OACConfigSchema>;

// Usage (recommended)
function loadConfig(path: string): OACConfig {
  const content = fs.readFileSync(path, 'utf-8');
  const parsed = JSON.parse(content);
  return OACConfigSchema.parse(parsed); // Validates at runtime
}
```

**File Reference**: `packages/core/src/context/resolver.ts:11-28`

### 1.2 Result Types

**Rule: Use discriminated unions for operation results**

```typescript
// ✅ GOOD - Discriminated union for results
export type ResolveResult = 
  | { success: true; path: string }
  | { success: false; error: string; category?: string };

export type UpdateResult =
  | { success: true; category: string; filesChanged: number }
  | { success: false; category: string; error: string };

// Usage
async function resolve(reference: string): Promise<ResolveResult> {
  try {
    const path = await resolveReference(reference);
    return { success: true, path };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}

// Consuming code
const result = await resolve('{context.root}/file.md');
if (result.success) {
  console.log(result.path); // TypeScript knows path exists
} else {
  console.error(result.error); // TypeScript knows error exists
}

// ❌ BAD - Throwing errors for expected failures
async function resolve(reference: string): Promise<string> {
  if (!isValid(reference)) {
    throw new Error('Invalid reference'); // Forces try/catch everywhere
  }
  return resolveReference(reference);
}
```

### 1.3 Branded Types for Identifiers

**Recommended Pattern: Use branded types for category names and references**

> ⚠️ **Note**: This pattern is not currently implemented in the context system, but is recommended for future type safety improvements.

```typescript
// 🎯 RECOMMENDED - Branded types for type safety
export type CategoryName = string & { readonly __brand: 'CategoryName' };
export type ContextReference = string & { readonly __brand: 'ContextReference' };

function createCategoryName(value: string): CategoryName {
  if (!/^[a-z][a-z0-9-]*$/.test(value)) {
    throw new Error('Invalid category name format');
  }
  return value as CategoryName;
}

function createContextReference(value: string): ContextReference {
  if (!/^\{context\.\w+\}\/.+$/.test(value)) {
    throw new Error('Invalid context reference format');
  }
  return value as ContextReference;
}

// Type-safe functions
function resolveCategory(category: CategoryName): string {
  // Only accepts validated category names
}

function parseReference(ref: ContextReference): { category: CategoryName; path: string } {
  // Only accepts validated references
}

// ❌ BAD - Plain strings allow invalid values
function resolveCategory(category: string): string {
  // Accepts any string, no validation
}
```

---

## 2. Class Design

### 2.1 Single Responsibility

**Rule: Classes should have a single, well-defined responsibility**

```typescript
// ✅ GOOD - Single responsibility: context resolution
export class ContextResolver {
  private config: OACConfig;
  private cacheDir = '.oac-cache/remote';
  
  constructor(configPath: string = '.oac') {
    this.config = this.loadConfig(configPath);
    this.ensureCacheDir();
  }
  
  async resolve(reference: string): Promise<string> {
    // Only handles resolution logic
  }
  
  private loadConfig(path: string): OACConfig {
    // Only handles config loading
  }
}

// ✅ GOOD - Separate class for cache management
export class CacheManager {
  constructor(private cacheDir: string) {}
  
  async get(category: string): Promise<string | null> {
    // Only handles cache operations
  }
  
  async set(category: string, path: string): Promise<void> {
    // Only handles cache operations
  }
  
  clear(category: string): void {
    // Only handles cache operations
  }
}

// ❌ BAD - Multiple responsibilities
export class ContextManager {
  async resolve(reference: string): Promise<string> {}
  async updateRemote(url: string): Promise<void> {}
  async validateConfig(config: unknown): OACConfig {}
  async formatOutput(data: unknown): string {}
  async sendNotification(message: string): void {}
  // Too many unrelated responsibilities!
}
```

**File Reference**: `packages/core/src/context/resolver.ts:38-472`

### 2.2 Private Methods

**Rule: Use private methods for internal logic, public for API**

```typescript
// ✅ GOOD - Clear public API, private implementation
export class ContextResolver {
  // Public API
  async resolve(reference: string): Promise<string> {
    const parsed = this.parseReference(reference);
    if (!parsed) return reference;
    
    const location = this.getLocation(parsed.category);
    
    if (this.isRemote(location)) {
      const localPath = await this.ensureRemote(location, parsed.category);
      return path.join(localPath, parsed.filePath);
    }
    
    return path.join(location, parsed.filePath);
  }
  
  // Private implementation details
  private parseReference(reference: string): { category: string; filePath: string } | null {
    const match = reference.match(/\{context\.(\w+)\}\/(.+)/);
    if (!match) return null;
    const [_, category, filePath] = match;
    return { category, filePath };
  }
  
  private getLocation(category: string): string {
    if (category === 'root') return this.config.context.root;
    return this.config.context.locations?.[category] ?? path.join(this.config.context.root, category);
  }
  
  private isRemote(location: string): boolean {
    return location.startsWith('git@') || location.startsWith('https://');
  }
  
  private async ensureRemote(url: string, category: string): Promise<string> {
    // Implementation
  }
}

// ❌ BAD - Everything public
export class ContextResolver {
  parseReference(reference: string) {} // Should be private
  getLocation(category: string) {} // Should be private
  isRemote(location: string) {} // Should be private
}
```

**File Reference**: `packages/core/src/context/resolver.ts:81-177`

---

## 3. Error Handling

### 3.1 Typed Errors

**Current Implementation: Generic Error**  
**Recommended: Specific error types for different failure modes**

```typescript
// ✅ CURRENT IMPLEMENTATION - Generic errors
// packages/core/src/context/resolver.ts:55
if (!fs.existsSync(this.configPath)) {
  throw new Error(`.oac config file not found at ${this.configPath}`);
}

// 🎯 RECOMMENDED - Typed error classes
export class ConfigNotFoundError extends Error {
  constructor(public readonly configPath: string) {
    super(`Config file not found at ${configPath}`);
    this.name = 'ConfigNotFoundError';
  }
}

export class InvalidConfigError extends Error {
  constructor(
    public readonly configPath: string,
    public readonly validationErrors: string[]
  ) {
    super(`Invalid config at ${configPath}: ${validationErrors.join(', ')}`);
    this.name = 'InvalidConfigError';
  }
}

export class CategoryNotFoundError extends Error {
  constructor(public readonly category: string) {
    super(`Unknown context category: ${category}`);
    this.name = 'CategoryNotFoundError';
  }
}

export class RemoteCloneError extends Error {
  constructor(
    public readonly url: string,
    public readonly cause: Error
  ) {
    super(`Failed to clone ${url}: ${cause.message}`);
    this.name = 'RemoteCloneError';
  }
}

// Usage with type checking
try {
  const config = loadConfig('.oac');
} catch (error) {
  if (error instanceof ConfigNotFoundError) {
    console.error(`Config not found: ${error.configPath}`);
    // Suggest creating config
  } else if (error instanceof InvalidConfigError) {
    console.error(`Invalid config: ${error.validationErrors.join('\n')}`);
    // Show validation errors
  } else {
    throw error; // Unexpected error
  }
}
```

**File Reference**: `packages/core/src/context/resolver.ts:54-64`

### 3.2 Error Context

**Rule: Include relevant context in error messages**

```typescript
// ✅ GOOD - Rich error context
private loadConfig(configPath: string): OACConfig {
  if (!fs.existsSync(configPath)) {
    throw new ConfigNotFoundError(configPath);
  }
  
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return OACConfigSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new InvalidConfigError(
        configPath,
        error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      );
    }
    throw new Error(
      `Failed to parse config at ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ❌ BAD - No context
private loadConfig(configPath: string): OACConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(content); // Throws generic errors
}
```

---

## 4. Async Operations

### 4.1 File I/O

**Rule: Use async file operations, handle errors explicitly**

```typescript
// ✅ GOOD - Async with proper error handling
import { promises as fs } from 'fs';

async function loadConfig(configPath: string): Promise<OACConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    return OACConfigSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ConfigNotFoundError(configPath);
    }
    throw error;
  }
}

// ✅ GOOD - Check existence before reading
async function readIfExists(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// ❌ BAD - Synchronous file operations
function loadConfig(configPath: string): OACConfig {
  const content = fs.readFileSync(configPath, 'utf-8'); // Blocks event loop
  return JSON.parse(content);
}
```

**File Reference**: `packages/core/src/context/resolver.ts:53-64`

### 4.2 Git Operations

**Rule: Use execSync for git commands, handle failures gracefully**

```typescript
// ✅ GOOD - Git operations with error handling
import { execSync } from 'child_process';

async function cloneRemote(url: string, localPath: string, category: string): Promise<void> {
  console.log(`📦 Cloning ${category} context from ${url}...`);
  
  try {
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    execSync(`git clone ${url} ${localPath}`, { stdio: 'inherit' });
    
    this.recordUpdate(category);
    console.log(`✅ Cloned ${category} successfully`);
  } catch (error) {
    throw new RemoteCloneError(
      url,
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

async function updateRemote(category: string, localPath: string): Promise<void> {
  console.log(`🔄 Updating ${category} context...`);
  
  try {
    execSync('git pull', { cwd: localPath, stdio: 'inherit' });
    this.recordUpdate(category);
    console.log(`✅ Updated ${category} successfully`);
  } catch (error) {
    console.warn(`⚠️  Failed to update ${category}: ${error instanceof Error ? error.message : String(error)}`);
    // Don't throw - update failures are non-fatal
  }
}

// ❌ BAD - No error handling
async function cloneRemote(url: string, localPath: string): Promise<void> {
  execSync(`git clone ${url} ${localPath}`); // Can fail silently
}
```

**File Reference**: `packages/core/src/context/resolver.ts:182-210`

---

## 5. Testing Standards

### 5.1 Test Structure

**Rule: Use describe/it blocks, setup/teardown for file operations**

```typescript
// ✅ GOOD - Comprehensive test structure
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ContextResolver } from '../resolver';
import type { OACConfig } from '../resolver';

describe('ContextResolver', () => {
  let tempDir: string;
  let configPath: string;
  let resolver: ContextResolver;

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oac-test-'));
    configPath = path.join(tempDir, '.oac');
    process.chdir(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('resolve', () => {
    beforeEach(() => {
      const config: OACConfig = {
        version: '1.0.0',
        context: {
          root: '.opencode/context',
          locations: {
            tasks: 'tasks/subtasks',
            docs: 'docs'
          }
        }
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      resolver = new ContextResolver(configPath);
    });

    it('should resolve root context reference', async () => {
      const result = await resolver.resolve('{context.root}/core/standards/code-quality.md');
      expect(result).toBe('.opencode/context/core/standards/code-quality.md');
    });

    it('should resolve tasks context reference', async () => {
      const result = await resolver.resolve('{context.tasks}/feature-name/01-task.md');
      expect(result).toBe('tasks/subtasks/feature-name/01-task.md');
    });

    it('should return original path if no context reference', async () => {
      const result = await resolver.resolve('regular/path/to/file.md');
      expect(result).toBe('regular/path/to/file.md');
    });
  });
});
```

**File Reference**: `packages/core/src/context/__tests__/resolver.test.ts:7-142`

### 5.2 Test Coverage

**Rule: Test happy path, error cases, and edge cases**

```typescript
// ✅ GOOD - Comprehensive test coverage
describe('ContextResolver', () => {
  describe('constructor', () => {
    it('should create resolver with default config path', () => {
      // Happy path
    });

    it('should create resolver with custom config path', () => {
      // Happy path variant
    });

    it('should throw error if config file does not exist', () => {
      // Error case
    });

    it('should throw error if config file is invalid JSON', () => {
      // Error case
    });
  });

  describe('resolve', () => {
    it('should resolve root context reference', async () => {
      // Happy path
    });

    it('should resolve custom location reference', async () => {
      // Happy path variant
    });

    it('should return original path if no context reference', async () => {
      // Edge case
    });

    it('should handle nested paths', async () => {
      // Edge case
    });

    it('should handle paths with special characters', async () => {
      // Edge case
    });
  });

  describe('edge cases', () => {
    it('should handle empty locations', () => {
      // Edge case
    });

    it('should handle paths with spaces', async () => {
      // Edge case
    });
  });
});
```

**File Reference**: `packages/core/src/context/__tests__/resolver.test.ts:28-318`

---

## 6. CLI Design

### 6.1 Command Structure

**Rule: Use commander.js pattern with typed options**

```typescript
// ✅ GOOD - Typed CLI commands
import { Command } from 'commander';
import { ContextResolver } from '@openagents/core';

const program = new Command();

program
  .name('oac')
  .description('OpenAgents Context CLI')
  .version('1.0.0');

program
  .command('resolve <reference>')
  .description('Resolve a context reference to a file path')
  .option('-c, --config <path>', 'Config file path', '.oac')
  .action(async (reference: string, options: { config: string }) => {
    try {
      const resolver = new ContextResolver(options.config);
      const resolved = await resolver.resolve(reference);
      console.log(resolved);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('update [category]')
  .description('Update remote context (all or specific category)')
  .option('-c, --config <path>', 'Config file path', '.oac')
  .action(async (category: string | undefined, options: { config: string }) => {
    try {
      const resolver = new ContextResolver(options.config);
      
      if (category) {
        await resolver.update(category);
      } else {
        await resolver.updateAll();
      }
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program.parse();
```

**File Reference**: `packages/cli/src/commands/context.ts`

### 6.2 Output Formatting

**Rule: Use consistent output formatting with colors/emojis**

```typescript
// ✅ GOOD - Consistent output formatting
import chalk from 'chalk';

function logSuccess(message: string): void {
  console.log(chalk.green(`✅ ${message}`));
}

function logError(message: string): void {
  console.error(chalk.red(`❌ ${message}`));
}

function logWarning(message: string): void {
  console.warn(chalk.yellow(`⚠️  ${message}`));
}

function logInfo(message: string): void {
  console.log(chalk.blue(`ℹ️  ${message}`));
}

// Usage
async function cloneRemote(url: string, category: string): Promise<void> {
  logInfo(`Cloning ${category} context from ${url}...`);
  
  try {
    execSync(`git clone ${url} ${localPath}`, { stdio: 'inherit' });
    logSuccess(`Cloned ${category} successfully`);
  } catch (error) {
    logError(`Failed to clone ${category}: ${error.message}`);
    throw error;
  }
}

// ❌ BAD - Inconsistent output
console.log('Cloning...');
console.log('Success!');
console.log('ERROR: Failed');
```

**File Reference**: `packages/core/src/context/resolver.ts:183-210`

---

## 7. Configuration Management

### 7.1 Config Loading

**Rule: Load config once, cache in instance**

```typescript
// ✅ GOOD - Load once, cache in instance
export class ContextResolver {
  private config: OACConfig;
  private configPath: string;

  constructor(configPath: string = '.oac') {
    this.configPath = configPath;
    this.config = this.loadConfig(); // Load once
    this.ensureCacheDir();
  }

  private loadConfig(): OACConfig {
    if (!fs.existsSync(this.configPath)) {
      throw new ConfigNotFoundError(this.configPath);
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const parsed = JSON.parse(content);
      return OACConfigSchema.parse(parsed);
    } catch (error) {
      throw new InvalidConfigError(this.configPath, [error.message]);
    }
  }

  // Use cached config
  async resolve(reference: string): Promise<string> {
    const location = this.getLocation(category); // Uses this.config
    // ...
  }
}

// ❌ BAD - Load config on every operation
export class ContextResolver {
  async resolve(reference: string): Promise<string> {
    const config = this.loadConfig(); // Loads every time!
    // ...
  }
}
```

**File Reference**: `packages/core/src/context/resolver.ts:44-64`

### 7.2 Default Values

**Rule: Provide sensible defaults, make config optional**

```typescript
// ✅ GOOD - Defaults with optional overrides
export const OACConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  project: z.object({
    name: z.string(),
    type: z.string(),
    version: z.string(),
  }).optional(),
  context: z.object({
    root: z.string().default('.opencode/context'),
    locations: z.record(z.string()).optional().default({}),
    update: z.object({
      check_on_start: z.boolean().default(false),
      auto_update: z.boolean().default(false),
      interval: z.string().default('1h'),
      strategy: z.enum(['auto', 'manual', 'notify']).default('manual'),
    }).optional().default({}),
  }),
});

// Minimal valid config
const minimalConfig = {
  context: {
    root: '.opencode/context'
  }
};

// Full config with overrides
const fullConfig = {
  version: '2.0.0',
  project: {
    name: 'my-project',
    type: 'agent-framework',
    version: '1.0.0'
  },
  context: {
    root: '.context',
    locations: {
      tasks: 'tasks',
      team: 'https://github.com/org/team-context.git'
    },
    update: {
      auto_update: true,
      interval: '30m',
      strategy: 'auto'
    }
  }
};
```

---

## 8. Path Handling

### 8.1 Path Resolution

**Rule: Use path.join for cross-platform compatibility**

```typescript
// ✅ GOOD - Cross-platform path handling
import * as path from 'path';

function resolveContextPath(category: string, filePath: string): string {
  const location = this.getLocation(category);
  return path.join(location, filePath); // Works on Windows and Unix
}

function getCacheDir(category: string): string {
  return path.join(this.cacheDir, category);
}

// ❌ BAD - Hardcoded path separators
function resolveContextPath(category: string, filePath: string): string {
  const location = this.getLocation(category);
  return `${location}/${filePath}`; // Breaks on Windows
}
```

**File Reference**: `packages/core/src/context/resolver.ts:98-102`

### 8.2 Path Validation

**Rule: Validate paths to prevent directory traversal**

```typescript
// ✅ GOOD - Path validation
import * as path from 'path';

function validatePath(filePath: string, baseDir: string): string {
  const normalized = path.normalize(filePath);
  const absolute = path.resolve(baseDir, normalized);
  
  // Ensure path is within baseDir
  if (!absolute.startsWith(path.resolve(baseDir))) {
    throw new Error(`Path traversal detected: ${filePath}`);
  }
  
  return absolute;
}

// Usage
const safePath = validatePath(userInput, this.config.context.root);

// ❌ BAD - No validation
function resolvePath(filePath: string): string {
  return path.join(this.config.context.root, filePath); // Vulnerable to ../../../etc/passwd
}
```

---

## 9. Caching Strategy

### 9.1 Cache Directory Structure

**Rule: Organize cache by category, track update times**

```typescript
// ✅ GOOD - Structured cache management
export class ContextResolver {
  private cacheDir = '.oac-cache/remote';
  private lastUpdateFile = '.oac-cache/.last-update.json';

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private recordUpdate(category: string): void {
    let updates: Record<string, number> = {};

    if (fs.existsSync(this.lastUpdateFile)) {
      try {
        updates = JSON.parse(fs.readFileSync(this.lastUpdateFile, 'utf-8'));
      } catch {
        // Ignore parse errors
      }
    }

    updates[category] = Date.now();

    fs.mkdirSync(path.dirname(this.lastUpdateFile), { recursive: true });
    fs.writeFileSync(this.lastUpdateFile, JSON.stringify(updates, null, 2));
  }

  private getLastUpdate(category: string): number | null {
    if (!fs.existsSync(this.lastUpdateFile)) {
      return null;
    }

    try {
      const updates = JSON.parse(fs.readFileSync(this.lastUpdateFile, 'utf-8'));
      return updates[category] || null;
    } catch {
      return null;
    }
  }
}
```

**File Reference**: `packages/core/src/context/resolver.ts:40-296`

---

## 10. Summary: Key Patterns

### TypeScript Patterns for Context System

1. **Zod Schemas** - Runtime validation for all config and input
2. **Branded Types** - Type-safe identifiers (CategoryName, ContextReference)
3. **Discriminated Unions** - Type-safe result types
4. **Typed Errors** - Specific error classes with context
5. **Async/Await** - Proper async handling for I/O operations
6. **Path Safety** - Cross-platform path handling with validation
7. **Cache Management** - Structured caching with update tracking
8. **Single Responsibility** - Classes with focused responsibilities
9. **Private Methods** - Clear public API, private implementation
10. **Comprehensive Testing** - Happy path, errors, and edge cases

### File References

- **Core Implementation**: `packages/core/src/context/resolver.ts`
- **Tests**: `packages/core/src/context/__tests__/resolver.test.ts`
- **CLI**: `packages/cli/src/commands/context.ts`
- **Types**: `packages/core/src/index.ts`

---

**Related Documents**:
- Universal TypeScript standards: `core/standards/typescript.md`
- OpenCode TypeScript standards: `openagents-repo/standards/opencode-typescript.md`
- Context system guide: `.opencode/context/core/context-system/guides/creation.md`
- Context structure: `.opencode/context/core/context-system/standards/structure.md`
