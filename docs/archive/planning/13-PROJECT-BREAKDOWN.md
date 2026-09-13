# OAC Package Refactor — Project Breakdown

**Document**: 13-PROJECT-BREAKDOWN.md  
**GitHub Issue**: #206  
**Status**: Approved for Implementation  
**Date**: 2026-02-19  
**Based on**: 12-MASTER-SYNTHESIS.md + Architecture Review (CodeReviewer)

> **Architecture Review Key Finding**: The synthesis plan is 75% solid. The critical gap is a missing **provider/adapter pattern** for non-IDE subsystems (context, task management, registry). This must be built in Project 1 before anything else. It enables users to swap out any subsystem — including the context system and task management — with their own implementations.

---

## Overview: 6 Discrete Projects

| # | Project | What It Builds | Depends On |
|---|---------|---------------|------------|
| **P1** | `@nextsystems/oac-core` | Shared interfaces, schemas, provider contracts | Nothing |
| **P2** | `@nextsystems/oac-cli` | Full CLI (commander.js, all commands, config, lockfile) | P1 |
| **P3** | Context System | 6-layer resolver, bundle/manifest, auto-update | P1, P2 |
| **P4** | Agent & Skill Management | agent.json+prompt.md, presets, skills packaging | P1, P2 |
| **P5** | Plugin System | OpenCode TS plugin, Claude Code rewrite, Cursor/Windsurf | P1, P2, P4 |
| **P6** | Registry & Community | shadcn registry, oac.lock, community publishing | P1, P2 |

Projects P3–P6 can be worked in parallel once P1 and P2 are complete.

---

## Project 1: `@nextsystems/oac-core` — Shared Interfaces & Provider Contracts

**Purpose**: Zero-dependency package containing all TypeScript interfaces, Zod schemas, and provider contracts. Every other package depends on this. Users implement these interfaces to swap subsystems.

**Why first**: Without this, schemas diverge between packages (already happening: `AgentFrontmatterSchema` in compatibility-layer vs planned `AgentSchema` in CLI). Fixes the dual-source-of-truth problem identified in the review.

### What to Build

#### 1.1 Provider Interfaces (The Extensibility Layer)

These are the interfaces users implement to replace OAC's default subsystems:

```typescript
// src/providers/context.ts
export interface IContextProvider {
  readonly id: string;
  readonly displayName: string;
  resolve(name: string): Promise<ContextFile | null>;
  list(query?: ContextQuery): Promise<ContextFile[]>;
  install(name: string, source: string | Buffer): Promise<void>;
  update(name: string, newContent: string, expectedSha256: string): Promise<'updated' | 'skipped' | 'conflict'>;
  isModified(name: string, installedSha256: string): Promise<boolean>;
  validate(name: string): Promise<ValidationResult>;
}

// src/providers/task-management.ts
export interface ITaskManagementProvider {
  readonly id: string;
  readonly displayName: string;
  createSession(tasks: Omit<Task, 'id'>[]): Promise<TaskSession>;
  getCurrentSession(): Promise<TaskSession | null>;
  getNextTask(sessionId: string): Promise<Task | null>;
  completeTask(sessionId: string, taskId: string): Promise<void>;
  listSessions(): Promise<TaskSession[]>;
  cleanSessions(olderThanDays: number): Promise<number>;
}

// src/providers/registry.ts
export interface IRegistryProvider {
  readonly id: string;
  readonly displayName: string;
  readonly baseUrl: string;
  fetch(name: string, type: ComponentType): Promise<RegistryItem>;
  search(query: string, options?: RegistrySearchOptions): Promise<RegistryItem[]>;
  download(item: RegistryItem): Promise<Array<{ file: RegistryFile; content: string }>>;
  ping(): Promise<boolean>;
  getLatestVersion(name: string, type: ComponentType): Promise<string>;
}

// src/providers/ide-adapter.ts
export interface IIDEAdapter {
  readonly id: string;
  readonly displayName: string;
  fromOAC(agent: OACAgent, context: OACContext[]): Promise<IDEAdapterResult>;
  toOAC(source: string): Promise<OACAgent>;
  getOutputPath(): string;
  getCapabilities(): IDECapabilities;
  validate(output: IDEAdapterResult): ValidationResult;
}

// src/providers/agent-profile.ts
export interface IAgentProfileProvider {
  readonly id: string;
  readonly displayName: string;
  list(): Promise<AgentProfile[]>;
  get(name: string): Promise<AgentProfile | null>;
  has(name: string): Promise<boolean>;
}
```

#### 1.2 Canonical Zod Schemas

One schema per concept, used by all packages:

```typescript
// src/schemas/agent.ts — The canonical agent schema
export const AgentConfigSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  displayName: z.string(),
  version: z.string(),
  description: z.string(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxSteps: z.number().optional(),
  mode: z.enum(['primary', 'subagent', 'all']).optional(),
  permission: z.array(PermissionRuleSchema).optional(),
  tools: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  oac: z.object({
    bundledSha256: z.string().optional(),
    installedAt: z.string().optional(),
    source: z.enum(['registry', 'bundled', 'local']),
    presetApplied: z.string().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
  }).optional(),
});

// src/schemas/config.ts — Global + project config
// src/schemas/lockfile.ts — oac.lock format
// src/schemas/registry.ts — registry.json + registry item format
// src/schemas/skill.ts — SKILL.md frontmatter
// src/schemas/context.ts — Context file frontmatter
// src/schemas/manifest.ts — manifest.json (npm bundle inventory)
```

#### 1.3 Provider Registry (Wiring Layer)

```typescript
// src/provider-registry.ts
export class ProviderRegistry {
  private contextProvider: IContextProvider;
  private taskProvider: ITaskManagementProvider;
  private registryProviders: Map<string, IRegistryProvider>;
  private ideAdapters: Map<string, IIDEAdapter>;
  private agentProfileProviders: Map<string, IAgentProfileProvider>;

  constructor(config: OACConfig) { /* initialize defaults */ }
  
  async loadFromConfig(config: OACConfig): Promise<void> {
    // Dynamically import custom providers from config.providers.*
    // Supports: npm package name, local path, or URL (for registry)
  }

  getContextProvider(): IContextProvider { ... }
  getTaskProvider(): ITaskManagementProvider { ... }
  getRegistry(name?: string): IRegistryProvider { ... }
  getAllRegistries(): IRegistryProvider[] { ... }
  getIDEAdapter(id: string): IIDEAdapter | undefined { ... }
}
```

#### 1.4 Shared Types

```typescript
// src/types/index.ts
export type ComponentType = 'agent' | 'skill' | 'context' | 'plugin';
export type UpdateMode = 'manual' | 'auto-safe' | 'auto-all' | 'locked';
export type ConflictStrategy = 'ask' | 'skip' | 'overwrite' | 'backup' | 'yolo';
export type InstallLocation = 'local' | 'global';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ContextFile {
  name: string;
  content: string;
  path: string;
  layer: string;
  userOwned: boolean;
  sha256: string;
}

export interface OACAgent {
  config: AgentConfig;
  promptMd: string;
  systemMd?: string;
}
// ... all shared types
```

### Package Structure

```
packages/core/
├── src/
│   ├── providers/
│   │   ├── context.ts          # IContextProvider interface
│   │   ├── task-management.ts  # ITaskManagementProvider interface
│   │   ├── registry.ts         # IRegistryProvider interface
│   │   ├── ide-adapter.ts      # IIDEAdapter interface
│   │   └── agent-profile.ts    # IAgentProfileProvider interface
│   ├── schemas/
│   │   ├── agent.ts            # AgentConfigSchema (Zod)
│   │   ├── config.ts           # OACConfigSchema (Zod)
│   │   ├── lockfile.ts         # LockfileSchema (Zod)
│   │   ├── registry.ts         # RegistrySchema + RegistryItemSchema (Zod)
│   │   ├── skill.ts            # SkillFrontmatterSchema (Zod)
│   │   ├── context.ts          # ContextFrontmatterSchema (Zod)
│   │   └── manifest.ts         # ManifestSchema (Zod)
│   ├── provider-registry.ts    # ProviderRegistry class
│   └── types/
│       └── index.ts            # All shared TypeScript types
├── package.json                # Zero runtime deps (only zod as peer)
└── tsconfig.json
```

### Key Constraints

- **Zero runtime dependencies** (except `zod` as a peer dep)
- All interfaces must be stable — breaking changes require major version bump
- Export everything from `index.ts` for clean imports: `import { IContextProvider } from '@nextsystems/oac-core'`
- Must be usable by third-party plugin authors to implement custom providers

### Context Files Needed

- `.opencode/context/core/standards/code-quality.md`
- `.opencode/context/core/standards/test-coverage.md`

### Validation Criteria

- [ ] All 5 provider interfaces defined and exported
- [ ] All Zod schemas match existing codebase field names (no divergence from compatibility-layer)
- [ ] `ProviderRegistry` loads custom providers from `config.providers.*` via dynamic import
- [ ] Zero runtime dependencies (only zod peer dep)
- [ ] 100% TypeScript strict mode
- [ ] All types exported from single `index.ts`

---

## Project 2: `@nextsystems/oac-cli` — Full CLI Package

**Purpose**: The main `oac` command. Commander.js-based CLI with all commands, config system, lockfile, approval/YOLO system, and wiring to all providers.

**Depends on**: Project 1 (`@nextsystems/oac-core`)

### What to Build

#### 2.1 CLI Entry Point & Command Structure

```typescript
// src/index.ts — lazy-loaded commands (keeps oac --version < 50ms)
program
  .command('init')
  .action(async (...args) => {
    const { initCommand } = await import('./commands/init.js');
    return initCommand(...args);
  });
// All commands use dynamic import — never eager-load
```

**Complete command surface**:

| Command | Description |
|---------|-------------|
| `oac init [profile]` | First-run wizard, project setup |
| `oac install <ide> [profile]` | Install for specific IDE |
| `oac add <component>` | Add individual component (agent/skill/context) |
| `oac update [component]` | Update installed components |
| `oac remove <component>` | Remove a component |
| `oac list [type]` | List installed/available components |
| `oac browse [type]` | Interactive TUI browser |
| `oac search <query>` | Search registry |
| `oac configure [subcommand]` | Manage configuration |
| `oac context <subcommand>` | Context system management |
| `oac skill <subcommand>` | Skill management |
| `oac plugin <subcommand>` | Plugin management |
| `oac doctor` | Diagnose installation health |
| `oac rollback [component]` | Undo last operation |
| `oac publish <path>` | Publish to community registry |
| `oac compat <subcommand>` | IDE compatibility tools |
| `oac show <component>` | Show component details |
| `oac presets <subcommand>` | Manage personal presets |
| `oac registry <subcommand>` | Manage registry sources |

**Global flags** (all commands):
```
--yolo          Skip all confirmations, auto-resolve conflicts
--dry-run       Preview changes without executing
--local         Force local install (.opencode/ in CWD)
--global        Force global install (~/.config/oac/)
--verbose       Detailed output
--quiet         Suppress output except errors
```

#### 2.2 Config System

```typescript
// src/config/manager.ts
export class ConfigManager {
  // Merges: defaults → global (~/.config/oac/config.json) → project (.oac/config.json)
  async load(): Promise<OACConfig>;
  async set(keyPath: string, value: unknown, scope: 'global' | 'local'): Promise<void>;
  async get(keyPath: string): Promise<unknown>;
  async validate(config: unknown): Promise<OACConfig>;  // Uses OACConfigSchema from core
}
```

**Config file locations**:
- Global: `~/.config/oac/config.json`
- Project: `.oac/config.json` (committed to git)
- Env overrides: `OAC_YOLO=true`, `OAC_REGISTRY_URL=...`, `OAC_BRANCH=...`

**Config schema** (key sections):
```json
{
  "version": "1.0.0",
  "preferences": {
    "defaultIDE": "opencode",
    "installLocation": "local",
    "yoloMode": false,
    "conflictStrategy": "ask",
    "autoBackup": true,
    "updateMode": "manual"
  },
  "providers": {
    "context": null,
    "taskManagement": null,
    "registry": null,
    "ideAdapters": []
  },
  "registries": [
    { "name": "official", "url": "https://registry.nextsystems.dev/oac", "priority": 1 }
  ],
  "ides": {
    "opencode": { "enabled": true, "path": ".opencode", "profile": "developer" },
    "cursor": { "enabled": false, "path": ".cursor", "profile": "developer" },
    "claude": { "enabled": false, "path": ".claude", "profile": "developer" }
  }
}
```

#### 2.3 Approval / YOLO System

```typescript
// src/approval/manager.ts
export class ApprovalManager {
  constructor(private opts: { yolo: boolean; strategy: ConflictStrategy }) {}

  // Returns: 'proceed' | 'skip' | 'backup-and-proceed' | 'abort'
  async resolveConflict(file: ConflictFile): Promise<ConflictResolution>;
  
  // Batch approval for multiple files
  async resolveAll(files: ConflictFile[]): Promise<Map<string, ConflictResolution>>;
  
  // Show diff between existing and new file
  async showDiff(existing: string, incoming: string): Promise<void>;
}
```

**Conflict resolution flow**:
1. File doesn't exist → install silently
2. File exists, SHA256 matches installed version → update silently (not user-modified)
3. File exists, SHA256 differs from installed → user-modified → prompt (or YOLO: backup+overwrite)
4. `--yolo` → backup all conflicts, overwrite all, report at end

#### 2.4 Lockfile System

```typescript
// src/lockfile/manager.ts
export class LockfileManager {
  // oac.lock format (committed to git)
  async read(): Promise<OACLock>;
  async write(lock: OACLock): Promise<void>;
  async addComponent(component: InstalledComponent): Promise<void>;
  async removeComponent(name: string, type: ComponentType): Promise<void>;
  async getComponent(name: string, type: ComponentType): Promise<InstalledComponent | null>;
  async isModified(name: string, type: ComponentType): Promise<boolean>;
  async pruneHistory(maxEntries?: number): Promise<void>;  // Prevents unbounded growth
}
```

**oac.lock format**:
```json
{
  "version": "1",
  "oacVersion": "1.0.0",
  "generated": "2026-02-19T00:00:00Z",
  "installed": {
    "opencode": {
      "profile": "developer",
      "location": "local",
      "path": ".opencode",
      "components": {
        "agent:openagent": {
          "version": "1.0.0",
          "sha256": "abc123",
          "installedAt": "2026-02-19T10:00:00Z",
          "source": "https://registry.nextsystems.dev/oac",
          "userModified": false
        }
      }
    }
  },
  "historyPolicy": { "maxEntries": 50 },
  "history": [
    { "timestamp": "...", "action": "install", "component": "agent:openagent", "version": "1.0.0" }
  ]
}
```

#### 2.5 Backup System

```typescript
// src/backup/manager.ts
export class BackupManager {
  // Backups stored in .oac/backups/ (git-ignored)
  async backup(filePath: string): Promise<string>;  // Returns backup path
  async restore(backupPath: string): Promise<void>;
  async listBackups(component?: string): Promise<Backup[]>;
  async pruneBackups(maxPerComponent?: number): Promise<void>;
}
```

#### 2.6 `oac doctor` Command

Checks (in order):
1. Node.js version ≥ 18
2. Config files valid JSON + schema
3. Registry reachable (network check)
4. All installed component files exist on disk
5. SHA256 integrity of installed files vs lockfile
6. Dependency graph complete (no missing deps)
7. IDE-specific paths exist and readable
8. `oac.lock` in sync with installed files
9. `task-cli.js` compiled (not just `.ts`)
10. `context-manager/router.sh` is not a stub
11. Git integration (uncommitted changes warning)
12. Custom providers loadable (if configured)

#### 2.7 Developer Tooling Scripts

```
scripts/
├── generate-manifest.ts    # Auto-generate manifest.json from .opencode/context/ files
├── generate-navigation.ts  # Auto-generate navigation.md files per category
├── validate-registry.ts    # Validate registry.json integrity (already exists, keep)
├── validate-content.ts     # Validate all context/agent/skill files
└── add-content.ts          # Scaffold new content with correct metadata
```

**Adding a new context file** (the simplified workflow):
```bash
# Before: manual SHA256, manual manifest.json, manual registry.json
# After:
npm run add-content -- --type context --name typescript-patterns --category development
# → Creates .opencode/context/development/typescript-patterns.md with frontmatter
# → Auto-updates manifest.json with SHA256
# → Auto-updates registry.json
# → Auto-updates navigation.md for that category
```

### Package Structure

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── init.ts
│   │   ├── install.ts
│   │   ├── add.ts
│   │   ├── update.ts
│   │   ├── remove.ts
│   │   ├── list.ts
│   │   ├── browse.ts
│   │   ├── search.ts
│   │   ├── configure.ts
│   │   ├── context.ts
│   │   ├── skill.ts
│   │   ├── plugin.ts
│   │   ├── doctor.ts
│   │   ├── rollback.ts
│   │   ├── publish.ts
│   │   ├── compat.ts
│   │   ├── show.ts
│   │   ├── presets.ts
│   │   └── registry.ts
│   ├── config/
│   │   ├── manager.ts
│   │   └── defaults.ts
│   ├── approval/
│   │   ├── manager.ts
│   │   └── strategies.ts
│   ├── lockfile/
│   │   └── manager.ts
│   ├── backup/
│   │   └── manager.ts
│   ├── ui/
│   │   ├── prompts.ts      # @inquirer/prompts wrappers
│   │   ├── progress.ts     # ora + cli-progress wrappers
│   │   └── logger.ts       # chalk + log levels
│   └── index.ts            # Commander setup, lazy command loading
├── scripts/
│   ├── generate-manifest.ts
│   ├── generate-navigation.ts
│   ├── validate-content.ts
│   └── add-content.ts
├── package.json
└── tsconfig.json
```

### Key Dependencies

```json
{
  "dependencies": {
    "@nextsystems/oac-core": "workspace:*",
    "commander": "^12.0.0",
    "@inquirer/prompts": "^5.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.1",
    "cli-progress": "^3.12.0",
    "update-notifier": "^7.3.1",
    "conf": "^13.0.0",
    "fs-extra": "^11.2.0",
    "glob": "^10.3.0",
    "gray-matter": "^4.0.3",
    "semver": "^7.6.0",
    "diff": "^5.2.0"
  }
}
```

### Validation Criteria

- [ ] `oac --version` completes in < 50ms (lazy loading)
- [ ] `oac init developer --yolo` completes in < 2 minutes
- [ ] All commands have `--dry-run` support
- [ ] `--yolo` flag skips all interactive prompts
- [ ] Config merges correctly: defaults → global → project → env vars
- [ ] `oac.lock` written after every install/update/remove
- [ ] `oac.lock` history capped at 50 entries
- [ ] `oac doctor` catches all 12 defined failure modes
- [ ] Backups created before any overwrite
- [ ] Custom providers load from `config.providers.*`
- [ ] 80%+ test coverage on core modules

---

## Project 3: Context System

**Purpose**: 6-layer context resolution, bundle/manifest management, auto-update, and the `oac context *` commands. Implements `IContextProvider` from Project 1.

**Depends on**: P1 (core interfaces), P2 (CLI commands, config)

### What to Build

#### 3.1 Default Context Provider (6-Layer Resolver)

```typescript
// src/providers/default-context-provider.ts
export class DefaultContextProvider implements IContextProvider {
  readonly id = 'oac-default';
  readonly displayName = 'OAC 6-Layer Context Resolver';

  private layers: string[];
  private cache: Map<string, ContextFile>;  // (filename, mtime) → ContextFile

  constructor(config: OACConfig) {
    this.layers = this.buildLayers(config);
  }

  private buildLayers(config: OACConfig): string[] {
    const projectRoot = process.cwd();
    const home = os.homedir();
    const pkgPath = dirname(require.resolve('@nextsystems/oac/package.json'));
    return [
      join(projectRoot, '.oac/context'),           // L1: project override (highest)
      join(projectRoot, '.opencode/context'),       // L2: project context
      join(projectRoot, '.claude/context'),          // L3: IDE-specific (claude)
      join(projectRoot, '.cursor/context'),          // L3: IDE-specific (cursor)
      join(projectRoot, 'docs/context'),             // L4: project docs
      join(home, '.config/oac/context'),             // L5: user global
      join(pkgPath, 'context'),                      // L6: OAC bundled (lowest)
    ];
  }

  async resolve(name: string): Promise<ContextFile | null> {
    // Check cache first (invalidate on mtime change)
    for (const [index, basePath] of this.layers.entries()) {
      const fullPath = join(basePath, name);
      if (await pathExists(fullPath)) {
        return this.buildContextFile(fullPath, LAYER_NAMES[index]);
      }
    }
    return null;
  }
}
```

#### 3.2 Manifest System

```typescript
// src/manifest/manager.ts
export class ManifestManager {
  // manifest.json = npm package inventory (never modified by users)
  async readBundled(): Promise<BundledManifest>;  // Reads from npm package
  
  // .opencode/.oac-manifest.json = project install state
  async readInstalled(projectRoot: string): Promise<InstalledManifest>;
  async writeInstalled(projectRoot: string, manifest: InstalledManifest): Promise<void>;
  
  // Compare to find what needs updating
  async computeDrift(projectRoot: string): Promise<DriftReport>;
}
```

**Manifest contract** (clarified from review):
- `manifest.json` (in npm package) = **what ships in the package** — never modified by users, auto-generated by `scripts/generate-manifest.ts`
- `.opencode/.oac-manifest.json` (in project) = **what's installed** — written by `oac context install`, read by `oac context update`
- `oac.lock` = **full install state** including non-context components

#### 3.3 Auto-Generated Manifest

```typescript
// scripts/generate-manifest.ts (runs at npm publish time)
// Scans .opencode/context/ → computes SHA256 for each file → writes manifest.json
// NEVER hand-maintain SHA256s
```

#### 3.4 Auto-Generated Navigation Files

```typescript
// scripts/generate-navigation.ts (runs at npm publish time)
// Reads manifest.json → generates navigation.md per category directory
// NEVER hand-maintain navigation.md files
```

#### 3.5 Context Resolution Map (for AI Sessions)

```typescript
// Written by OpenCode plugin at session.created
// Tells ContextScout which layer each file came from
// .oac/context-resolution-map.json (git-ignored)
{
  "generatedAt": "2026-02-19T10:00:00Z",
  "resolved": {
    "core/standards/code-quality.md": {
      "layer": 2,
      "layerName": "project-context",
      "path": ".opencode/context/core/standards/code-quality.md",
      "userModified": false
    }
  }
}
```

#### 3.6 CLI Commands

```bash
oac context install                     # Install from npm bundle (interactive)
oac context install --profile standard  # Select profile
oac context install --global            # Install to ~/.config/oac/context/
oac context install --ide claude        # Install to .claude/context/
oac context install --dry-run           # Preview

oac context update                      # Update from npm bundle (interactive)
oac context update --check              # Show what would change
oac context update --yolo               # Auto-apply all updates

oac context validate                    # Full validation report
oac context validate --ci               # Exit 1 on failure (for CI)
oac context validate --fix              # Auto-fix recoverable issues

oac context list                        # List all context files
oac context list --tree                 # As directory tree
oac context resolve <ref>               # Show which layer wins
oac context sources                     # Show all context source directories
oac context override <ref>              # Copy to .oac/context/ for customization
oac context add <source>                # Add external context (GitHub/local)
oac context diff <ref>                  # Diff installed vs bundled version
```

#### 3.7 Context Profiles

```json
// In manifest.json
{
  "profiles": {
    "essential": {
      "files": ["core/standards/code-quality", "core/standards/documentation", "core/standards/test-coverage"]
    },
    "standard": {
      "extends": "essential",
      "files": ["core/workflows/task-delegation-basics", "core/workflows/code-review", "core/standards/security-patterns"]
    },
    "developer": {
      "extends": "standard",
      "files": ["development/principles/clean-code", "development/principles/api-design"]
    }
  }
}
```

### Key Design Decisions

- **Bundle into npm, not fetch at runtime** — deterministic, offline-capable
- **Auto-generate manifest.json and navigation.md** — never hand-maintain SHA256s
- **Resolution map written at session start** — ContextScout knows which layer each file came from
- **Layer 1 (`.oac/context/`) is the escape hatch** — always wins, user-owned
- **Layer 6 (npm bundle) is always present** — no install required for fallback

### Validation Criteria

- [ ] `oac context resolve core/standards/code-quality.md` shows correct layer
- [ ] Layer 1 override wins over all other layers
- [ ] `scripts/generate-manifest.ts` produces correct SHA256s
- [ ] `scripts/generate-navigation.ts` produces valid navigation.md files
- [ ] `oac context validate --ci` exits 1 on broken references
- [ ] Resolution cache invalidates on file mtime change
- [ ] Custom context provider loads from `config.providers.context`
- [ ] Context resolution map written at session start

---

## Project 4: Agent & Skill Management

**Purpose**: `agent.json` + `prompt.md` architecture, preset/customization system, skill packaging, multi-IDE format conversion, and `oac add/customize/presets/skill` commands.

**Depends on**: P1 (core interfaces), P2 (CLI, config, lockfile)

### What to Build

#### 4.1 Agent Architecture

**Source of truth**: `agent.json` (config) + `prompt.md` (prose) per agent directory.

```
.opencode/agents/
├── core/
│   ├── openagent/
│   │   ├── agent.json      # Config, permissions, metadata
│   │   └── prompt.md       # Prose content (what the AI reads)
│   └── opencoder/
│       ├── agent.json
│       └── prompt.md
└── subagents/
    ├── contextscout/
    │   ├── agent.json
    │   └── prompt.md
    └── ...
```

**`agent.json` schema** (from `@nextsystems/oac-core`):
```json
{
  "name": "openagent",
  "displayName": "OpenAgent",
  "version": "1.0.0",
  "description": "Universal orchestrator for complex tasks",
  "mode": "primary",
  "temperature": 0.1,
  "permission": [
    { "bash": { "*": "deny", "git status*": "allow" } },
    { "edit": { "**/*.env*": "deny" } }
  ],
  "skills": ["task-management", "context-manager"],
  "oac": {
    "source": "bundled",
    "tags": ["universal", "orchestration"],
    "category": "core"
  }
}
```

**IDE format generation** (from `agent.json` + `prompt.md`):
- OpenCode: generates YAML frontmatter + prompt body → `.opencode/agent/core/openagent.md`
- Claude Code: generates Claude-compatible frontmatter → `.claude/agents/openagent.md`
- Cursor: merges all agents into `.cursorrules` (router pattern)
- Windsurf: generates `.windsurf/agents/openagent.json`

#### 4.2 Preset / Customization System

```
~/.config/oac/presets/          # User's personal presets (global)
├── agents/
│   ├── my-openagent.md         # Preset file with CUSTOMIZATION markers
│   └── strict-reviewer.md
└── .presets.json               # Index of presets

.oac/presets/                   # Team presets (committed to git)
├── team-lead.json
└── solo-dev.json
```

**Preset file format** (merge-safe):
```markdown
---
preset:
  name: my-openagent
  base: agent:openagent
  baseVersion: 1.0.0
  updateStrategy: manual
---

<!-- CUSTOMIZATION: Approval Gates -->
Auto-approve read operations (glob, read, grep)
<!-- END CUSTOMIZATION -->

[Rest of base agent prompt unchanged]
```

**Preset commands**:
```bash
oac customize agent:openagent           # Create preset (wizard)
oac use preset:my-openagent             # Activate for project
oac use preset:my-openagent --global    # Activate globally
oac presets list                        # List all presets
oac presets list --active               # Show active presets
oac import preset ./team-preset.md      # Import team preset
oac export preset:my-openagent          # Export for sharing
```

#### 4.3 Skill Packaging

**Skill structure** (standardized):
```
.opencode/skills/{skill-name}/
├── SKILL.md          # REQUIRED: frontmatter + instructions
├── router.sh         # OPTIONAL: CLI entry point
├── scripts/
│   └── *.js          # COMPILED (not .ts) — eliminates ts-node dependency
└── config/
    └── *.json
```

**Critical**: All TypeScript scripts compiled to JS as part of package build. `task-cli.ts` → `task-cli.js`. No ts-node at runtime.

**Skill commands**:
```bash
oac skill install task-management       # Install from OAC registry
oac skill install task-management@1.0.0 # Specific version
oac skill install --all                 # Install all bundled skills
oac skill list                          # List installed skills
oac skill update                        # Update all skills
oac skill remove task-management        # Remove skill
oac skill validate                      # Validate all skills
oac skill doctor                        # Health check (router.sh, scripts exist, etc.)
```

#### 4.4 context-manager Skill Implementation

**Critical gap**: `context-manager/router.sh` is currently a stub. Must implement:

```
.opencode/skills/context-manager/
├── SKILL.md
├── router.sh           # Routes to scripts below
└── scripts/
    ├── discover.js     # Glob-based context file discovery
    ├── fetch.js        # Calls ExternalScout / Context7 API
    ├── harvest.js      # Parses source doc, creates permanent context
    ├── extract.js      # Targeted extraction from context files
    ├── compress.js     # Summary/truncation of large files
    ├── organize.js     # File reorganization by concern
    ├── cleanup.js      # Removes stale .tmp/ files
    └── process.js      # Orchestrates multi-step guided workflows
```

#### 4.5 Task CLI Compilation

```bash
# Build step: compile task-cli.ts → task-cli.js
# Included in npm package files
# oac doctor checks for task-cli.js presence
```

**`oac task` commands** (wrapping compiled task-cli.js):
```bash
oac task status [feature]               # Show task status
oac task next [feature]                 # Show next eligible tasks
oac task complete <feature> <seq> "msg" # Mark complete
oac task validate [feature]             # Validate JSON files
oac task plan [feature] --visualize     # Show execution plan
```

**`oac session` commands**:
```bash
oac session list                        # List active sessions
oac session resume {session-id}         # Resume a session
oac session cleanup {session-id}        # Remove session files
oac session archive {session-id}        # Archive to .tmp/archive/
```

### Validation Criteria

- [ ] `agent.json` + `prompt.md` generates valid OpenCode frontmatter
- [ ] `agent.json` + `prompt.md` generates valid Claude Code format
- [ ] `agent.json` + `prompt.md` generates valid `.cursorrules` router
- [ ] Preset `<!-- CUSTOMIZATION: -->` markers survive agent updates
- [ ] `task-cli.js` compiled and included in npm package
- [ ] `context-manager/router.sh` routes to real implementations (not stub)
- [ ] All skill scripts are `.js` (no `.ts` at runtime)
- [ ] Custom task management provider loads from `config.providers.taskManagement`
- [ ] Team presets in `.oac/presets/` override global presets

---

## Project 5: Plugin System

**Purpose**: OpenCode TypeScript plugin (primary), Claude Code plugin rewrite, Cursor/Windsurf adapters, and `oac plugin *` commands.

**Depends on**: P1 (core interfaces), P2 (CLI), P4 (agent/skill management)

### What to Build

#### 5.1 OpenCode TypeScript Plugin (Primary — New)

```typescript
// .opencode/plugin/oac.ts (installed by oac plugin install opencode)
import type { Plugin } from "@opencode-ai/plugin";

export const OACPlugin: Plugin = async ({ project, client, $, directory }) => {
  const config = await loadOACConfig(directory);
  const manifest = await loadInstalledManifest(directory);
  const skillMap = await buildSkillMap(directory);

  return {
    // Register OAC agents
    config: async (currentConfig) => ({
      ...currentConfig,
      agents: [...(currentConfig.agents || []), ...await loadOACAgents(directory)]
    }),

    // Skills as tools + tool.execute.before hooks
    tool: createSkillTools(skillMap),

    // Session start: inject workflow + check updates
    "session.created": async ({ event }) => {
      // 1. Write context resolution map
      await writeContextResolutionMap(directory);
      
      // 2. Inject using-oac workflow (non-blocking)
      const workflow = skillMap.get('using-oac')?.content;
      if (workflow) {
        await client.session.prompt({
          path: { id: event.id },
          body: { noReply: true, parts: [{ type: "text", text: workflow }] }
        });
      }
      
      // 3. Check for updates (throttled: once per 24h, non-blocking)
      checkForUpdates(directory, client, event.id, config).catch(() => {});
    },

    // Skill invocation via tool hooks
    "tool.execute.before": async (input, output) => {
      if (input.tool.startsWith("oac_skill_")) {
        const skill = skillMap.get(input.tool);
        if (skill) {
          await client.session.prompt({
            path: { id: input.sessionID },
            body: { noReply: true, parts: [{ type: "text", text: skill.content }] }
          });
        }
      }
    },

    // Background cleanup on session idle
    "session.idle": async ({ event }) => {
      if (config.cleanup?.autoPrompt) {
        await cleanupOldTempFiles(directory, config.cleanup);
      }
    },
  };
};
```

**Auto-update via `session.created`**:
- Throttled: check once per 24 hours max
- Non-blocking: never delays session start
- Notification via `client.tui.showToast()`
- If `autoUpdate: "safe"`: silently update non-modified files
- If `autoUpdate: false` (default): show toast with `oac update` hint

#### 5.2 Claude Code Plugin Rewrite

**Current**: `session-start.sh` (bash, fragile JSON escaping)  
**Target**: `session-start.js` (compiled TypeScript, proper JSON.stringify)

```typescript
// plugins/claude-code/hooks/session-start.ts → compiled to session-start.js
import { readFileSync } from 'fs';
import { join } from 'path';

const skillPath = join(__dirname, '../skills/using-oac/SKILL.md');
const skillContent = readFileSync(skillPath, 'utf-8');

const output = {
  additionalContext: skillContent,
  hookSpecificOutput: {
    type: 'session-start',
    message: '🤖 OAC Active — 6-stage workflow enabled'
  }
};

process.stdout.write(JSON.stringify(output));
```

#### 5.3 Cursor Adapter (Router Pattern)

```typescript
// Generates .cursorrules from all installed agents
// Router pattern: single file, all agents merged with section headers
// 100KB limit enforced with warnings
export class CursorPluginAdapter {
  async generate(agents: OACAgent[], contexts: ContextFile[]): Promise<string> {
    // Sort: core agents first, then specialists
    // Embed essential context inline
    // Warn if > 80KB
    // Error if > 100KB
  }
}
```

#### 5.4 Plugin Commands

```bash
oac plugin install opencode             # Install OpenCode TypeScript plugin
oac plugin install claude               # Install Claude Code plugin
oac plugin install cursor               # Generate .cursorrules
oac plugin install windsurf             # Install Windsurf config
oac plugin install --all                # Install for all configured IDEs

oac plugin update opencode              # Update plugin
oac plugin update --all                 # Update all plugins
oac plugin update --check               # Check only

oac plugin remove opencode              # Remove plugin
oac plugin list                         # List installed plugins
oac plugin status                       # Health check
oac plugin configure opencode           # Configure plugin settings

oac plugin create <name>                # Scaffold new plugin
oac plugin test <name>                  # Test plugin
oac plugin publish <path>               # Publish to community
```

#### 5.5 Third-Party Plugin Support

```typescript
// oac.json — plugin manifest for community plugins
{
  "name": "oac-plugin-security-agents",
  "version": "1.0.0",
  "type": "plugin",
  "provides": ["agents", "skills", "context"],
  "ides": ["opencode", "claude"],
  "registry": "./registry.json"
}
```

```bash
# Install community plugin
oac plugin add oac-plugin-security-agents
oac plugin add https://github.com/user/my-oac-plugin
```

### Validation Criteria

- [ ] OpenCode plugin installs to `.opencode/plugin/oac.ts`
- [ ] `session.created` fires and injects workflow within 5 seconds
- [ ] Update check throttled to once per 24 hours
- [ ] `session.created` never crashes (silent failure on errors)
- [ ] Claude Code `session-start.js` uses `JSON.stringify` (not manual escaping)
- [ ] Cursor `.cursorrules` warns at 80KB, errors at 100KB
- [ ] Custom IDE adapters load from `config.providers.ideAdapters`
- [ ] `oac plugin status` shows health for all installed plugins

---

## Project 6: Registry & Community

**Purpose**: shadcn-inspired registry, `oac.lock` lockfile, community publishing, security scanning, and `oac publish/browse/search/registry` commands.

**Depends on**: P1 (core interfaces), P2 (CLI, lockfile)

### What to Build

#### 6.1 Registry Client

```typescript
// src/registry/client.ts
export class RegistryClient {
  constructor(private providers: IRegistryProvider[]) {}

  // Multi-registry resolution: highest priority wins
  async fetch(name: string, type: ComponentType): Promise<RegistryItem> {
    for (const provider of this.providers) {
      try {
        return await provider.fetch(name, type);
      } catch { continue; }
    }
    throw new Error(`Component not found: ${type}:${name}`);
  }

  async search(query: string, options?: RegistrySearchOptions): Promise<RegistryItem[]> {
    // Search all registries, deduplicate by name+type, sort by priority
    const results = await Promise.allSettled(
      this.providers.map(p => p.search(query, options))
    );
    return deduplicateAndSort(results);
  }
}
```

#### 6.2 Registry Format (shadcn-inspired)

**Registry index** (`registry.json`):
```json
{
  "$schema": "https://registry.nextsystems.dev/oac/schema/registry.json",
  "version": "3.0.0",
  "items": [
    {
      "name": "openagent",
      "type": "oac:agent",
      "title": "OpenAgent",
      "description": "Universal orchestrator",
      "version": "1.0.0",
      "ides": ["opencode", "claude", "cursor", "windsurf"],
      "registryDependencies": ["contextscout", "task-manager"],
      "files": [
        {
          "path": "agents/core/openagent/agent.json",
          "type": "oac:agent-config",
          "target": ".opencode/agents/core/openagent/agent.json"
        },
        {
          "path": "agents/core/openagent/prompt.md",
          "type": "oac:agent-prompt",
          "target": ".opencode/agents/core/openagent/prompt.md"
        }
      ]
    }
  ]
}
```

#### 6.3 Multi-Registry Support

```json
// config.json
{
  "registries": [
    { "name": "private", "url": "https://registry.company.com/oac", "priority": 1, "authToken": "${OAC_PRIVATE_TOKEN}" },
    { "name": "official", "url": "https://registry.nextsystems.dev/oac", "priority": 2 }
  ]
}
```

Resolution: highest priority registry wins. `oac add agent:openagent --registry official` to override.

#### 6.4 Community Publishing

```bash
oac publish ./my-agent/                 # Publish to community registry
# Flow:
# 1. Validate oac.json schema
# 2. Run security scan (secrets detection, malware check)
# 3. Compute SHA256 for all files
# 4. Submit PR to community registry repo
# 5. CI runs security scan
# 6. Maintainer reviews and merges

oac publish ./my-agent/ --private       # Publish to private registry
```

#### 6.5 Security Scanning

```typescript
// src/security/scanner.ts
export class SecurityScanner {
  async scan(files: string[]): Promise<ScanResult> {
    return {
      secrets: await this.detectSecrets(files),    // gitleaks patterns
      malware: await this.scanMalware(files),       // basic pattern matching
      permissions: await this.analyzePermissions(files),  // permission audit
      externalCalls: await this.findExternalCalls(files), // network calls
    };
  }
}
```

#### 6.6 Browse TUI

```typescript
// src/commands/browse.ts — interactive TUI using @inquirer/prompts
// Categories → Components → Preview → Install
// Arrow keys to navigate, Space to select, Enter to preview, 'i' to install
```

#### 6.7 Registry Commands

```bash
oac browse [type]                       # Interactive TUI browser
oac search <query>                      # Search all registries
oac show agent:openagent                # Show component details
oac verify agent:openagent              # Verify SHA256 + signature

oac registry list                       # List configured registries
oac registry add <url> [--name <name>]  # Add registry
oac registry remove <name>              # Remove registry
oac registry ping                       # Check all registries reachable
oac registry sync                       # Sync local cache

oac publish <path>                      # Publish to community
oac publish <path> --registry private   # Publish to private registry
```

### Validation Criteria

- [ ] Multi-registry resolution: private registry wins over official
- [ ] `oac search` works across all configured registries
- [ ] SHA256 verification on every download
- [ ] Security scan runs before `oac publish`
- [ ] `oac browse` TUI navigable with arrow keys
- [ ] Private registry supports auth token via env var
- [ ] Custom registry provider loads from `config.providers.registry`
- [ ] `oac.lock` updated after every registry operation

---

## Cross-Project: How Users Swap Subsystems

This is the key extensibility story. Users configure custom providers in `.oac/config.json`:

```json
{
  "providers": {
    "context": "@my-company/oac-notion-context",
    "taskManagement": "@my-company/oac-linear-provider",
    "registry": "https://registry.internal.company.com/oac",
    "ideAdapters": ["@my-company/oac-jetbrains-adapter"]
  }
}
```

**Custom context provider** (replaces ContextScout + 6-layer resolution):
```typescript
// @my-company/oac-notion-context
import type { IContextProvider } from '@nextsystems/oac-core';

export default class NotionContextProvider implements IContextProvider {
  readonly id = 'notion';
  readonly displayName = 'Notion Context Provider';
  // Fetches context from Notion database instead of filesystem
}
```

**Custom task management provider** (replaces TaskManager/BatchExecutor):
```typescript
// @my-company/oac-linear-provider
import type { ITaskManagementProvider } from '@nextsystems/oac-core';

export default class LinearTaskProvider implements ITaskManagementProvider {
  readonly id = 'linear';
  readonly displayName = 'Linear Issue Tracker';
  // Creates/reads tasks from Linear API instead of .tmp/tasks/ JSON files
}
```

**Custom IDE adapter** (adds JetBrains support):
```typescript
// @my-company/oac-jetbrains-adapter
import type { IIDEAdapter } from '@nextsystems/oac-core';

export default class JetBrainsAdapter implements IIDEAdapter {
  readonly id = 'jetbrains';
  readonly displayName = 'JetBrains AI Assistant';
  // Converts OAC agents to JetBrains AI Assistant format
}
```

---

## Implementation Order & Dependencies

```
Week 1-2:   P1 (core interfaces) — MUST BE FIRST
Week 3-4:   P2 (CLI foundation) — MUST BE SECOND
Week 5-6:   P3 + P4 in parallel (context system + agent/skill management)
Week 7:     P5 (plugin system) — needs P4 complete
Week 8-9:   P6 (registry + community) — can start after P2
```

```
P1 ──► P2 ──► P3 (parallel)
              P4 (parallel) ──► P5
              P6 (parallel)
```

---

## What Each Project Needs From the Existing Codebase

| Project | Reuse | Rewrite | New |
|---------|-------|---------|-----|
| P1 (core) | Types from compatibility-layer | Unify schemas | Provider interfaces |
| P2 (CLI) | `bin/oac.js` entry point | Full CLI (91 lines → full commander) | Config, lockfile, approval, backup |
| P3 (context) | `.opencode/context/` files | Context resolution (currently ContextScout only) | Manifest auto-gen, navigation auto-gen |
| P4 (agents/skills) | All `.opencode/agent/` files, skills | task-cli.ts → .js, context-manager stub | agent.json+prompt.md split, preset system |
| P5 (plugins) | Claude Code plugin structure | session-start.sh → .js | OpenCode TS plugin (new) |
| P6 (registry) | `registry.json` structure, validate-registry.ts | Registry format (v2→v3) | Multi-registry, community publishing, TUI |

---

## Success Criteria (All Projects)

- [ ] `npx @nextsystems/oac init developer` completes in < 2 minutes
- [ ] `oac --version` responds in < 50ms
- [ ] Custom context provider replaces ContextScout with zero CLI changes
- [ ] Custom task management provider replaces TaskManager with zero CLI changes
- [ ] Private registry works with auth token
- [ ] `oac doctor` catches all known failure modes
- [ ] All content files survive `npm update` without overwriting user customizations
- [ ] OpenCode auto-updates on session start (non-blocking)
- [ ] Zero bash script dependency for any core functionality
- [ ] 80%+ test coverage on all packages
- [ ] `oac.lock` enables reproducible installs across machines
