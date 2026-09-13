# OAC Package Refactor — Master Planning Document

**Document**: 12-MASTER-SYNTHESIS.md  
**GitHub Issue**: #206  
**Status**: Authoritative Implementation Plan  
**Date**: 2026-02-19  
**Synthesized from**: 6 specialist research agents (Context, Agent Behaviour, Task Breakdown, Plugin System, ExternalScout, CLI & Multi-IDE)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [The 5 Core Subsystems](#3-the-5-core-subsystems)
4. [Implementation Phases (9 Weeks)](#4-implementation-phases-9-weeks)
5. [Key Technical Decisions](#5-key-technical-decisions)
6. [Critical Gaps to Address](#6-critical-gaps-to-address)
7. [Configuration Schema](#7-configuration-schema)
8. [Auto-Update Strategy](#8-auto-update-strategy)
9. [CLI Command Reference](#9-cli-command-reference)
10. [Success Metrics](#10-success-metrics)

---

## 1. Executive Summary

### What We Are Building

OAC (`@nextsystems/oac`) is transitioning from a 52KB bash-script installer (`install.sh`) into a proper npm CLI package with a rich plugin system, registry-backed component management, and first-class multi-IDE support.

The refactored OAC manages four types of AI configuration artifacts across four IDEs:

| Artifact | Description | Primary Location |
|----------|-------------|------------------|
| **Agents** | `.md` files with YAML frontmatter defining AI personas and permissions | `.opencode/agent/` |
| **Context files** | Markdown guides that shape AI behaviour in a session | `.opencode/context/` |
| **Skills** | Loadable modules (`SKILL.md` + `router.sh` + `scripts/`) | `.opencode/skills/` |
| **Plugins** | IDE integration hooks (TypeScript events, file-based, shell scripts) | IDE-specific |

| IDE | Priority | Integration Method |
|-----|----------|--------------------|
| OpenCode | PRIMARY | TypeScript npm plugin (`"plugin": ["@nextsystems/oac"]`) |
| Claude Code | Secondary | File-based plugin (`.claude-plugin/`) |
| Cursor | Tertiary | Router pattern in `.cursorrules` |
| Windsurf | Partial | Partial compatibility adapter |

### Key Architectural Decisions (Summary)

1. **OpenCode is the primary target** — richest plugin API (25+ events, custom tools, TypeScript SDK). All other IDEs are adaptation layers.
2. **Bundle context into npm, do not fetch at runtime** — eliminates network dependency during AI sessions, enables offline use, provides version-locked reproducibility.
3. **`agent.json` + `prompt.md` as source of truth** — clean separation of metadata/configuration from prose content; generate IDE-specific formats from this canonical form.
4. **shadcn-inspired registry** — adapt the shadcn component registry pattern for agents, skills, and context files. Already have `registry.json` in the repo.
5. **`oac.lock` lockfile** — reproducible installs across machines and CI, analogous to `package-lock.json`.
6. **Two-layer update system** — `update-notifier` for the CLI binary itself; hash-based registry polling for content files.
7. **Monorepo with tsup** — `packages/cli` (new) + `packages/compatibility-layer` (existing) + `packages/plugin-abilities` (existing).

### Success Criteria

- `npx @nextsystems/oac init` completes full project setup in under 2 minutes
- All bundled content survives `npm update` without overwriting user customizations
- OpenCode auto-updates agent/context files on every session start via `session.created` event
- `oac doctor` catches 100% of common misconfiguration issues
- Registry supports community-published agents/skills with SHA256 verification
- Zero bash script dependency for any core functionality (install.sh becomes legacy/deprecated)

---

## 2. Architecture Overview

### Package Structure (Monorepo)

```
@nextsystems/oac/                    # Root package (npm: @nextsystems/oac)
├── bin/
│   └── oac.js                       # CLI entry point (compiled)
├── packages/
│   ├── cli/                         # NEW: Full commander.js CLI
│   │   ├── src/
│   │   │   ├── commands/            # One file per command group
│   │   │   ├── registry/            # Registry client
│   │   │   ├── resolvers/           # 6-layer context resolver
│   │   │   ├── adapters/            # IDE format adapters
│   │   │   └── index.ts             # Entry point
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── compatibility-layer/         # EXISTING: Multi-IDE adapters
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   │   ├── claude.ts        # COMPLETE
│   │   │   │   ├── cursor.ts        # COMPLETE
│   │   │   │   └── windsurf.ts      # COMPLETE
│   │   │   └── index.ts
│   │   └── package.json
│   └── plugin-abilities/            # EXISTING: OpenCode plugin
│       ├── src/
│       │   ├── events/              # 25+ OpenCode event handlers
│       │   └── index.ts
│       └── package.json
├── .opencode/                       # Bundled OAC configuration
│   ├── agent/                       # Agent .md files (YAML frontmatter)
│   ├── context/                     # Bundled context files
│   ├── skills/                      # Skill packages
│   ├── plugin/                      # OpenCode plugin hooks
│   └── opencode.json                # OpenCode config
├── registry.json                    # Component registry (shadcn-style)
├── manifest.json                    # Bundle manifest with checksums
├── oac.lock                         # Lockfile template (copied to project)
└── package.json
```

### The 5 Core Subsystems and Their Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                     OAC CLI (Subsystem 1)                        │
│  oac init / add / update / remove / context / skill / plugin    │
│  oac doctor / rollback / publish / browse / search              │
└──────────┬────────────┬───────────────┬────────────┬────────────┘
           │            │               │            │
           ▼            ▼               ▼            ▼
┌──────────────┐ ┌────────────┐ ┌──────────────┐ ┌─────────────┐
│   Context    │ │  Agent &   │ │   Plugin     │ │  Registry & │
│   System     │ │   Skill    │ │   System     │ │  Community  │
│ (Subsystem 2)│ │ Management │ │ (Subsystem 4)│ │(Subsystem 5)│
│              │ │(Subsystem 3│ │              │ │             │
│ 6-layer      │ │            │ │ OpenCode     │ │ shadcn      │
│ resolution   │ │ agent.json │ │ Claude Code  │ │ registry    │
│ Bundle/      │ │ + prompt.md│ │ Cursor       │ │ oac.lock    │
│ manifest     │ │ Presets    │ │ Windsurf     │ │ SHA256 hash │
│ Auto-update  │ │ Skills pkg │ │ session.     │ │ verify      │
└──────────────┘ └────────────┘ │ created hook │ └─────────────┘
                                └──────────────┘
```

### Data Flow: From Registry to IDE

```
npm registry / community registry
         │
         │  oac add agent/openagent
         ▼
   Registry Client
         │ fetches files + verifies SHA256
         ▼
   oac.lock updated
         │
         ├──► .opencode/agent/openagent/
         │      ├── agent.json       (metadata, permissions, config)
         │      └── prompt.md        (prose content)
         │
         │  oac compat apply --ide=cursor
         ▼
   Compatibility Adapter
         │
         ├──► .cursorrules           (Cursor router pattern)
         ├──► CLAUDE.md             (Claude Code format)
         └──► .windsurfrules        (Windsurf format)
```

### Data Flow: Auto-Update via OpenCode Plugin

```
OpenCode session starts
         │
         │  fires session.created event
         ▼
   plugin-abilities/src/events/session.ts
         │
         │  reads oac.lock
         │  checks registry for newer versions
         │  compares SHA256 of installed files
         ▼
   No user modifications detected → auto-update silently
   User modifications detected    → prompt user (or skip in --yolo mode)
         │
         ▼
   Files updated in .opencode/
   IDE picks up changes on next tool invocation
```

---

## 3. The 5 Core Subsystems

---

### Subsystem 1: CLI & Package Distribution

#### Current State

The current `bin/oac.js` is 91 lines of Node.js that spawns `install.sh` (52KB bash script). It has no command parsing, no help text, no interactive prompts, and no multi-IDE awareness. The npm package `files` array in `package.json` already bundles `.opencode/` content correctly.

#### Target State

A full `commander.js`-based CLI with 20+ commands, interactive prompts via `@inquirer/prompts`, progress indication via `ora`, and coloured output via `chalk`. Built with `tsup` into `dist/cli.js`, entry point remains `bin/oac.js` which simply requires the compiled output.

#### Package Structure

```json
// packages/cli/package.json
{
  "name": "@nextsystems/oac-cli",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "build": "tsup src/index.ts --format cjs --dts",
    "test": "vitest run",
    "dev": "tsup src/index.ts --watch"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "@inquirer/prompts": "^5.0.0",
    "ora": "^8.0.0",
    "chalk": "^5.0.0",
    "conf": "^13.0.0",
    "fs-extra": "^11.0.0",
    "semver": "^7.6.0",
    "zod": "^3.23.0",
    "update-notifier": "^7.0.0"
  }
}
```

#### Commander.js Structure

```typescript
// packages/cli/src/index.ts
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { addCommand } from "./commands/add";
import { contextCommand } from "./commands/context";
import { skillCommand } from "./commands/skill";
import { pluginCommand } from "./commands/plugin";
import { doctorCommand } from "./commands/doctor";

const program = new Command()
  .name("oac")
  .description("AI agent configuration manager")
  .version(packageJson.version)
  .option("--yolo", "skip all confirmations")
  .option("--no-color", "disable color output");

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(contextCommand);
program.addCommand(skillCommand);
program.addCommand(pluginCommand);
program.addCommand(doctorCommand);
// ... additional commands

program.parse();
```

#### Key Design Decisions

- **tsup over tsc**: tsup bundles dependencies into a single file, eliminating runtime `node_modules` resolution issues when installed globally via `npm install -g`
- **`--yolo` flag**: Skips all `inquirer` prompts and confirmation gates. Required for CI/automation use cases
- **`conf` for global config**: Uses OS-appropriate config directory (`~/.config/oac/` on Linux/Mac, `%APPDATA%/oac/` on Windows). Survives npm updates
- **`update-notifier`**: Background process checks npm registry for CLI updates; shows non-blocking notification at session end

#### Critical Gaps

- The entire `packages/cli/` package does not exist yet — needs to be created from scratch
- `bin/oac.js` needs to be rewritten to simply `require('../packages/cli/dist/index.js')`
- `install.sh` remains as legacy fallback during transition but should be deprecated in v1.0

---

### Subsystem 2: Context System

#### Current State

Context files exist in `.opencode/context/` with a rich function-based and concern-based organizational pattern. `CONTEXT_SYSTEM_GUIDE.md` (16KB) documents the system thoroughly. However there is no programmatic management — files are installed/copied by `install.sh` and never updated automatically.

#### Target State

A 6-layer resolution system where the CLI and plugin can deterministically locate, version, and update context files. All OAC-maintained context files are bundled into the npm package with SHA256 checksums tracked in `manifest.json`.

#### The 6-Layer Priority Resolution

```
Priority (highest to lowest):
┌─────────────────────────────────────────────────────┐
│ 1. .oac/context/          project override          │ ← USER OWNED
│ 2. .opencode/context/     IDE config dir            │ ← OAC MANAGED (with user edits)
│ 3. IDE-specific dir       e.g. .cursor/context/     │ ← IDE MANAGED
│ 4. docs/                  project documentation     │ ← PROJECT OWNED
│ 5. ~/.config/oac/context/ user global overrides     │ ← USER OWNED
│ 6. npm package bundled    @nextsystems/oac/context/  │ ← OAC DEFAULT
└─────────────────────────────────────────────────────┘
```

Resolution algorithm:
1. Walk layers 1-6 in order
2. First file found at a given logical name wins
3. User-owned layers (1, 4, 5) are never overwritten by `oac update`
4. OAC-managed layer (2) is updated only when no user modifications detected (SHA256 match)

#### Bundle/Manifest Approach

```json
// manifest.json (in npm package root, copied to .oac/manifest.json on init)
{
  "version": "0.7.1",
  "generatedAt": "2026-02-19T00:00:00Z",
  "context": {
    "typescript-patterns.md": {
      "sha256": "a1b2c3d4...",
      "size": 4821,
      "category": "language",
      "description": "TypeScript coding patterns and conventions"
    },
    "git-workflow.md": {
      "sha256": "e5f6a7b8...",
      "size": 2341,
      "category": "workflow"
    }
  },
  "agents": {
    "openagent": {
      "sha256": "c9d0e1f2...",
      "files": ["agent.json", "prompt.md"]
    }
  },
  "skills": {
    "task-management": {
      "sha256": "f3a4b5c6...",
      "files": ["SKILL.md", "router.sh", "scripts/task-cli.js"]
    }
  }
}
```

#### Auto-Update Mechanism

```
oac update context (or: triggered by session.created event)
         │
         ├── Read .oac/manifest.json (installed versions + hashes)
         ├── Fetch registry for latest manifest
         ├── For each context file:
         │    ├── SHA256(installed file) == manifest.sha256?
         │    │    YES → file is stock OAC → safe to update
         │    │    NO  → file has user modifications
         │    │         ├── update mode == "auto-all"  → overwrite + backup
         │    │         ├── update mode == "auto-safe" → skip + notify
         │    │         └── update mode == "manual"    → skip silently
         │    └── New version available? → download + install + update manifest
         └── Print summary of updated / skipped / conflict files
```

#### CLI Commands

```bash
oac context install [name]     # Install a specific context file
oac context update [name]      # Update installed context files
oac context validate           # Validate all context files are syntactically correct
oac context resolve <name>     # Show which layer a context file resolves from
oac context list               # List all context files with source layer
oac context diff <name>        # Show diff between installed and stock version
```

#### Key Design Decisions

- **Bundle into npm, not fetch at runtime**: Context files are needed the moment an AI session starts. Network dependency at that point is unacceptable. Bundling ensures offline functionality and version-locked reproducibility.
- **ContextScout navigation**: The existing ContextScout agent that discovers relevant context via navigation is preserved. The CLI manages the underlying files; ContextScout operates on them.
- **`manifest.json` is the authoritative truth**: Neither `package.json` version nor git history determines what's installed — only `manifest.json` + SHA256 comparison.

---

### Subsystem 3: Agent & Skill Management

#### Current State

Agents are `.md` files with YAML frontmatter in `.opencode/agent/`. No programmatic management exists. Skills live in `.opencode/skills/` as `SKILL.md` + `router.sh` + `scripts/` bundles. `task-cli.ts` is a TypeScript file requiring `ts-node` to run — this is a critical gap.

#### Target State

A canonical `agent.json` + `prompt.md` two-file representation per agent, with IDE-specific formats generated on demand. Skills are proper packages with compiled JS. A preset system allows user customizations to survive updates.

#### Agent Architecture: `agent.json` + `prompt.md`

```
.opencode/agent/openagent/
├── agent.json        # Metadata, permissions, config, OAC-specific data
└── prompt.md         # The actual agent prompt content (prose)
```

```json
// agent.json — canonical agent definition
{
  "name": "openagent",
  "displayName": "Open Agent",
  "version": "2.1.0",
  "description": "Primary orchestration agent for plan-first development",
  "model": "claude-sonnet-4-5",
  "maxTokens": 8192,
  "permission": [
    { "deny": "bash(**)" },
    { "allow": "bash(git status, git diff, git log)" },
    { "allow": "bash(npm run*)" }
  ],
  "tools": ["read", "write", "edit", "bash", "glob", "grep"],
  "tags": ["orchestration", "planning", "primary"],
  "oac": {
    "bundledSha256": "a1b2c3d4e5f6...",
    "installedAt": "2026-02-19T00:00:00Z",
    "source": "registry",
    "presetApplied": "team-lead-preset"
  }
}
```

```markdown
---
name: openagent
model: claude-sonnet-4-5
maxTokens: 8192
---

# Open Agent

You are OpenAgent, the primary orchestration agent...
[prose content continues]
```

**Design principle**: `prompt.md` YAML frontmatter contains only fields that the IDE (OpenCode) reads natively. All OAC-specific metadata goes in `agent.json`. This avoids frontmatter bloat and keeps IDE compatibility clean.

#### Permission System

The `permission:` field uses **last-match-wins** evaluation (same as OpenCode's native system):

```json
"permission": [
  { "deny": "bash(**)" },          // default deny all bash
  { "allow": "bash(git status)" }, // allow specific git commands
  { "allow": "bash(npm run*)" }    // allow npm run commands
]
```

Rules are evaluated in order; the LAST matching rule wins. This matches OpenCode's permission semantics exactly, ensuring IDE-native compatibility.

#### Preset System

User customizations are stored separately from stock agent files:

```
~/.config/oac/presets/
├── team-lead-preset.json       # User's customizations
└── solo-dev-preset.json

// team-lead-preset.json
{
  "name": "team-lead-preset",
  "appliesTo": ["openagent", "task-manager"],
  "overrides": {
    "model": "claude-opus-4-5",
    "maxTokens": 16384,
    "permission": [
      { "allow": "bash(docker*)" }
    ]
  },
  "promptAppend": "\n\n## Team Context\nAlways consider team conventions..."
}
```

When `oac update` runs:
1. Stock `agent.json` + `prompt.md` are updated from registry
2. Preset is re-applied on top of updated stock
3. Final merged files written to `.opencode/agent/`
4. User never loses customizations

#### Essential Agents

| Agent | Purpose | Critical |
|-------|---------|---------|
| `openagent` | Primary orchestration, plan-first development | Yes |
| `opencoder` | Code implementation | Yes |
| `contextscout` | Context discovery and navigation | Yes |
| `externalscout` | External documentation fetching | Yes |
| `task-manager` | Task breakdown and tracking | Yes |
| `coder-agent` | Focused coding tasks | Yes |

#### Skill Packaging

```
.opencode/skills/task-management/
├── SKILL.md          # Skill definition (YAML frontmatter + prose)
├── router.sh         # Dispatch script (must be fully implemented, not stub)
└── scripts/
    ├── task-cli.js   # COMPILED from task-cli.ts (NOT ts-node)
    └── helpers.js
```

```yaml
# SKILL.md frontmatter
---
name: task-management
version: 1.2.0
description: Task breakdown, tracking, and validation
entrypoint: router.sh
scripts:
  - scripts/task-cli.js
permissions:
  - read: ".tmp/sessions/**"
  - write: ".tmp/sessions/**"
---
```

#### Four Core Skills

| Skill | Status | Critical Gap |
|-------|--------|-------------|
| `task-management` | Mostly complete | `task-cli.ts` must be compiled to JS |
| `context-manager` | router.sh is STUB | Needs full implementation (highest priority) |
| `context7` | Complete | None |
| `smart-router-skill` | Complete | None |

#### CLI Commands

```bash
oac add agent <name>           # Install agent from registry
oac remove agent <name>        # Remove agent
oac list agents                # List installed agents
oac customize agent <name>     # Open editor for agent customization
oac presets list               # List available presets
oac presets apply <preset>     # Apply preset to agents
oac validate agents            # Validate all agent files
oac create agent               # Interactive agent creation wizard

oac skill install <name>       # Install skill from registry
oac skill list                 # List installed skills
oac skill update [name]        # Update skill(s)
oac skill remove <name>        # Remove skill
oac skill validate             # Validate all skills

oac task status                # Show current task session status
oac task next                  # Get next task
oac task complete <id>         # Mark task as complete
```

---

### Subsystem 4: Plugin System

#### Current State

**Two existing plugin systems**:
1. **Claude Code** (`.claude-plugin/`): File-based plugin using `session-start.sh` bash script. Functional but bash-only.
2. **OpenCode** (`packages/plugin-abilities/`): TypeScript event system. Compatibility layer (Phases 1-3) is ~59% complete. CLI integration is missing.

Adapters for Claude, Cursor, and Windsurf exist in `packages/compatibility-layer/` and are functionally complete but have no CLI wiring.

#### Target State

OAC becomes a first-class OpenCode npm plugin registered in `opencode.json`:

```json
// .opencode/opencode.json
{
  "plugin": ["@nextsystems/oac"],
  "model": "claude-sonnet-4-5",
  "theme": "opencode"
}
```

This single line activates the full OAC plugin system including auto-updates on session start.

#### OpenCode Plugin (PRIMARY)

OpenCode offers the richest integration API:
- 25+ lifecycle events (session.created, file.changed, tool.before, tool.after, etc.)
- Custom tool registration
- TypeScript SDK with full type safety
- npm-based distribution (no file copying required)

```typescript
// packages/plugin-abilities/src/index.ts
import type { Plugin } from "@opencode/sdk";
import { handleSessionCreated } from "./events/session";
import { handleToolBefore } from "./events/tools";

export default {
  name: "@nextsystems/oac",
  version: "0.7.1",

  events: {
    "session.created": handleSessionCreated,
    "tool.before": handleToolBefore,
  },

  tools: [
    // Custom OAC tools exposed to the AI
  ],
} satisfies Plugin;
```

```typescript
// packages/plugin-abilities/src/events/session.ts
export async function handleSessionCreated(ctx: SessionContext) {
  // 1. Check for OAC updates
  const updates = await checkForUpdates();

  // 2. Apply safe updates (no user modifications)
  await applySafeUpdates(updates);

  // 3. Notify about skipped updates (user-modified files)
  if (updates.conflicts.length > 0) {
    ctx.notify(`OAC: ${updates.conflicts.length} files have local modifications — run 'oac update' to manage`);
  }

  // 4. Validate active context
  await validateActiveContext(ctx);
}
```

#### Claude Code Plugin (Secondary)

The `.claude-plugin/session-start.sh` needs to be rewritten in TypeScript and compiled:

```
.claude-plugin/
├── plugin.json          # Plugin manifest
├── session-start.js     # Compiled from session-start.ts
└── src/
    └── session-start.ts # TypeScript source
```

```json
// .claude-plugin/plugin.json
{
  "name": "@nextsystems/oac",
  "version": "0.7.1",
  "hooks": {
    "session-start": "node session-start.js"
  }
}
```

#### Cursor Integration

Cursor uses a single `.cursorrules` file (100KB limit). OAC generates this file from installed agents/context:

```bash
oac compat apply --ide=cursor
# Generates .cursorrules with router pattern:
# - Lists available agent personas
# - Includes abbreviated context
# - Stays under 100KB limit
```

#### Windsurf Integration

Windsurf uses `.windsurfrules`. Adapter is functionally complete; needs CLI wiring only.

#### Compatibility Layer CLI (Missing — High Priority)

The compatibility adapters exist but have NO CLI. This must be added:

```bash
oac compat apply --ide=cursor        # Generate cursor-specific files
oac compat apply --ide=claude        # Generate CLAUDE.md etc.
oac compat apply --ide=windsurf      # Generate .windsurfrules
oac compat apply --all               # Apply all compatible IDEs
oac compat status                    # Show compatibility status per IDE
oac compat validate --ide=cursor     # Validate generated files
```

#### Plugin CLI Commands

```bash
oac plugin install <name>            # Install plugin from registry
oac plugin update [name]             # Update plugin(s)
oac plugin remove <name>             # Remove plugin
oac plugin list                      # List installed plugins
oac plugin configure <name>          # Configure plugin settings
oac plugin create                    # Scaffold new plugin
```

---

### Subsystem 5: Registry & Community

#### Current State

`registry.json` exists at the repo root (106KB). It appears to be a flat JSON file. The exact format and whether it follows a published schema is unclear. No community contribution workflow exists. No lockfile system exists.

#### Target State

A shadcn-inspired registry with:
- Typed component entries with SHA256 verification
- `oac.lock` lockfile for reproducible installs
- Community contribution via PR workflow
- Security scanning on all community contributions

#### Registry Item Format

```json
// registry.json
{
  "version": "1",
  "registryUrl": "https://registry.nextsystems.dev/oac",
  "items": [
    {
      "name": "openagent",
      "type": "oac:agent",
      "version": "2.1.0",
      "description": "Primary orchestration agent for plan-first development",
      "tags": ["orchestration", "planning", "primary"],
      "author": "nextsystems",
      "license": "MIT",
      "files": [
        {
          "path": "agent.json",
          "target": ".opencode/agent/openagent/agent.json",
          "url": "https://registry.nextsystems.dev/oac/agents/openagent/2.1.0/agent.json",
          "sha256": "a1b2c3d4..."
        },
        {
          "path": "prompt.md",
          "target": ".opencode/agent/openagent/prompt.md",
          "url": "https://registry.nextsystems.dev/oac/agents/openagent/2.1.0/prompt.md",
          "sha256": "e5f6a7b8..."
        }
      ],
      "dependencies": [],
      "peerDependencies": ["context7"]
    },
    {
      "name": "task-management",
      "type": "oac:skill",
      "version": "1.2.0",
      "files": [
        {
          "path": "SKILL.md",
          "target": ".opencode/skills/task-management/SKILL.md",
          "url": "...",
          "sha256": "..."
        },
        {
          "path": "router.sh",
          "target": ".opencode/skills/task-management/router.sh",
          "url": "...",
          "sha256": "..."
        },
        {
          "path": "scripts/task-cli.js",
          "target": ".opencode/skills/task-management/scripts/task-cli.js",
          "url": "...",
          "sha256": "..."
        }
      ]
    }
  ]
}
```

#### `oac.lock` Format

```json
// oac.lock (committed to git — enables reproducible installs)
{
  "version": "1",
  "generatedAt": "2026-02-19T00:00:00Z",
  "oacVersion": "0.7.1",
  "installed": {
    "agents": {
      "openagent": {
        "version": "2.1.0",
        "source": "registry",
        "sha256": {
          "agent.json": "a1b2c3d4...",
          "prompt.md": "e5f6a7b8..."
        },
        "installedAt": "2026-02-19T00:00:00Z",
        "userModified": {
          "agent.json": false,
          "prompt.md": true
        }
      }
    },
    "skills": {
      "task-management": {
        "version": "1.2.0",
        "source": "registry",
        "sha256": { ... },
        "installedAt": "..."
      }
    },
    "context": {
      "typescript-patterns.md": {
        "version": "1.0.3",
        "source": "bundled",
        "sha256": "...",
        "installedAt": "..."
      }
    }
  }
}
```

#### Directory Ownership (oh-my-zsh Pattern)

```
.opencode/agent/
├── openagent/          # OAC-managed (tracked in oac.lock)
├── task-manager/       # OAC-managed
└── custom/             # USER-OWNED (never touched by oac update)
    └── my-custom-agent/
```

OAC **never** modifies files in `.opencode/agent/custom/` or `.opencode/context/custom/`. This is the clean separation between OAC-managed and user-owned content.

#### CLI Commands

```bash
oac browse                           # TUI browser of registry
oac search <query>                   # Search registry
oac publish <path>                   # Publish to community registry
oac registry add <url>               # Add custom registry source
oac registry list                    # List configured registries
```

---

## 4. Implementation Phases (9 Weeks)

### Phase Overview

```
Week 1-2: Foundation & Package Structure
Week 3:   Context System
Week 4:   Agent & Skill Management
Week 5:   Plugin System (OpenCode primary)
Week 6:   Compatibility Layer CLI
Week 7:   Registry & Lockfile
Week 8:   Auto-Update & Community
Week 9:   Polish, Doctor, Testing
```

---

### Phase 1: Foundation (Week 1-2)

**Goal**: Working CLI binary with package structure. `oac --help` works and shows all commands.

**What Gets Built**:

1. Create `packages/cli/` package
   - `tsconfig.json`, `package.json` with all dependencies
   - `tsup.config.ts` for build
   - `src/index.ts` with commander.js skeleton
   - All command files as stubs (return "not yet implemented")

2. Rewrite `bin/oac.js`
   ```javascript
   #!/usr/bin/env node
   require('../packages/cli/dist/index.js');
   ```

3. Add `packages/cli` to root `workspaces` in `package.json`

4. Configure `tsup` to compile `task-cli.ts` → `task-cli.js`
   - Remove `ts-node` dependency from skills
   - Update `router.sh` references to use compiled `task-cli.js`

5. Set up `vitest` for testing across all packages

6. Create `~/.config/oac/config.json` initialization in `oac init`

**Dependencies**: None (this is the foundation everything else builds on)

**Validation Criteria**:
- `oac --help` lists all planned commands with descriptions
- `oac --version` outputs correct version
- `npx @nextsystems/oac init` runs without error
- All packages build with zero TypeScript errors
- `task-cli.js` executes correctly without `ts-node`

---

### Phase 2: Init & Doctor (Week 2)

**Goal**: `oac init` sets up a project correctly. `oac doctor` diagnoses problems.

**What Gets Built**:

1. `oac init` command (interactive wizard)
   ```
   ? Which IDE are you using? (OpenCode / Claude Code / Cursor / Windsurf / Multiple)
   ? Install standard agent pack? (Yes / No / Select)
   ? Enable auto-updates? (Auto-safe / Auto-all / Manual)
   ? Create .oac/config.json? (Yes)
   ```
   - Creates `.oac/config.json` (project config)
   - Creates `oac.lock` (empty initially)
   - Copies bundled content to `.opencode/`
   - Creates `manifest.json` copy in project
   - Adds entries to `.gitignore` (sessions, tmp)

2. `oac doctor` command
   - Checks: OAC version vs latest
   - Checks: oac.lock exists and is valid
   - Checks: all agents in oac.lock are present on disk
   - Checks: all SHA256s match (detects corruption)
   - Checks: IDE-specific config is correct
   - Checks: `task-cli.js` is compiled (not `.ts`)
   - Checks: context-manager `router.sh` is not a stub
   - Reports: pass/warn/fail per check

**Validation Criteria**:
- `oac init` completes in < 30 seconds on first run
- `oac doctor` correctly identifies a deliberately broken install
- `oac doctor --fix` auto-repairs fixable issues

---

### Phase 3: Context System (Week 3)

**Goal**: Full context system with 6-layer resolution and CLI management.

**What Gets Built**:

1. `ContextResolver` class implementing 6-layer resolution
2. `oac context list` — shows all context with source layer
3. `oac context resolve <name>` — shows which layer wins
4. `oac context install <name>` — installs specific context file
5. `oac context update` — updates all OAC-managed context
6. `oac context validate` — validates syntax
7. `oac context diff <name>` — diff vs stock version

**Context Resolver Implementation**:

```typescript
// packages/cli/src/resolvers/context.ts
const RESOLUTION_LAYERS = [
  { name: "project-override",  path: ".oac/context",                    userOwned: true },
  { name: "opencode-config",   path: ".opencode/context",               userOwned: false },
  { name: "ide-specific",      path: ".cursor/context",                  userOwned: false },
  { name: "project-docs",      path: "docs",                            userOwned: true },
  { name: "user-global",       path: "~/.config/oac/context",           userOwned: true },
  { name: "npm-bundled",       path: "__dirname/../../.opencode/context", userOwned: false },
];

export async function resolveContext(name: string): Promise<ResolvedContext> {
  for (const layer of RESOLUTION_LAYERS) {
    const filePath = join(layer.path, name);
    if (await exists(filePath)) {
      return { filePath, layer, userOwned: layer.userOwned };
    }
  }
  throw new Error(`Context file not found: ${name}`);
}
```

**Validation Criteria**:
- `oac context list` shows correct source layer for each file
- Updating a user-modified file is blocked/warned
- `oac context resolve` output matches manual file system inspection

---

### Phase 4: Agent & Skill Management (Week 4)

**Goal**: Full agent and skill lifecycle management. Preset system working.

**What Gets Built**:

1. `agent.json` schema with Zod validation
2. `oac add agent <name>` — install from registry
3. `oac remove agent <name>` — remove with confirmation
4. `oac list agents` — tabular view with versions
5. `oac customize agent <name>` — opens editor, saves to preset
6. `oac presets list/apply` — preset management
7. `oac validate agents` — schema validation
8. **Fix context-manager router.sh stub** — implement full dispatch logic
9. `oac skill install/list/update/remove/validate`

**Agent Schema (Zod)**:

```typescript
// packages/cli/src/schemas/agent.ts
const AgentSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  displayName: z.string(),
  version: z.string(),
  description: z.string(),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  permission: z.array(z.union([
    z.object({ allow: z.string() }),
    z.object({ deny: z.string() }),
  ])).optional(),
  tools: z.array(z.string()).optional(),
  tags: z.array(z.string()).default([]),
  oac: z.object({
    bundledSha256: z.string(),
    installedAt: z.string(),
    source: z.enum(["registry", "bundled", "local"]),
    presetApplied: z.string().optional(),
  }).optional(),
});
```

**context-manager router.sh** (critical gap fix):

```bash
#!/usr/bin/env bash
# router.sh — context-manager skill dispatcher
set -euo pipefail

COMMAND="${1:-help}"
SCRIPTS_DIR="$(dirname "$0")/scripts"

case "$COMMAND" in
  discover)    node "$SCRIPTS_DIR/discover.js" "${@:2}" ;;
  fetch)       node "$SCRIPTS_DIR/fetch.js" "${@:2}" ;;
  harvest)     node "$SCRIPTS_DIR/harvest.js" "${@:2}" ;;
  extract)     node "$SCRIPTS_DIR/extract.js" "${@:2}" ;;
  compress)    node "$SCRIPTS_DIR/compress.js" "${@:2}" ;;
  organize)    node "$SCRIPTS_DIR/organize.js" "${@:2}" ;;
  cleanup)     node "$SCRIPTS_DIR/cleanup.js" "${@:2}" ;;
  workflow)    node "$SCRIPTS_DIR/workflow.js" "${@:2}" ;;
  *)           echo "Usage: router.sh <discover|fetch|harvest|extract|compress|organize|cleanup|workflow>"; exit 1 ;;
esac
```

**Validation Criteria**:
- `oac add agent openagent` installs correctly and updates `oac.lock`
- `oac customize agent openagent` opens editor and saves preset
- After `oac update`, customizations survive
- `oac validate agents` catches malformed `agent.json`
- context-manager `router.sh` dispatches all 8 commands correctly

---

### Phase 5: OpenCode Plugin (Week 5)

**Goal**: OAC registers as an OpenCode npm plugin. Auto-update works on session start.

**What Gets Built**:

1. Complete `packages/plugin-abilities/src/index.ts` as a proper OpenCode plugin
2. `session.created` event handler with update check logic
3. Register in `.opencode/opencode.json` as `"plugin": ["@nextsystems/oac"]`
4. Session management CLI: `oac session list/clean`

**OpenCode Plugin Registration**:

```json
// .opencode/opencode.json (updated)
{
  "plugin": ["@nextsystems/oac"],
  "model": "claude-sonnet-4-5",
  "theme": "opencode"
}
```

**Session Created Handler**:

```typescript
// packages/plugin-abilities/src/events/session.ts
import { checkForUpdates, applySafeUpdates } from "../updater";
import { readLockfile } from "../lockfile";

export async function handleSessionCreated(ctx: SessionContext) {
  try {
    const lockfile = await readLockfile();
    const updates = await checkForUpdates(lockfile);

    if (updates.safe.length > 0) {
      await applySafeUpdates(updates.safe);
      // Silent — don't interrupt the user's session
    }

    if (updates.conflicts.length > 0 && !lockfile.config.suppressConflictWarnings) {
      ctx.log.warn(
        `OAC: ${updates.conflicts.length} components have updates but local modifications. ` +
        `Run 'oac update --interactive' to manage.`
      );
    }
  } catch (err) {
    // Never crash the user's session due to OAC errors
    ctx.log.debug(`OAC update check failed: ${err.message}`);
  }
}
```

**Validation Criteria**:
- OpenCode loads `@nextsystems/oac` plugin without error
- `session.created` fires and completes without affecting session start time > 500ms
- Auto-update correctly identifies modified files and skips them
- Plugin unloads cleanly when removed from `opencode.json`

---

### Phase 6: Compatibility Layer CLI (Week 6)

**Goal**: All existing compatibility adapters (Claude, Cursor, Windsurf) wired to CLI commands.

**What Gets Built**:

1. `oac compat apply --ide=<ide>` command wiring to existing adapters
2. `oac compat status` — show what's generated for each IDE
3. `oac compat validate --ide=<ide>` — validate generated files
4. Claude Code plugin: rewrite `session-start.sh` → `session-start.ts` → compile to `session-start.js`
5. Cursor: enforce 100KB limit in generator, warn if exceeded

**Compat Apply Implementation**:

```typescript
// packages/cli/src/commands/compat.ts
import { ClaudeAdapter } from "@nextsystems/oac-compatibility-layer";
import { CursorAdapter } from "@nextsystems/oac-compatibility-layer";
import { WindsurfAdapter } from "@nextsystems/oac-compatibility-layer";

export const compatApplyCommand = new Command("apply")
  .option("--ide <ide>", "target IDE (claude|cursor|windsurf|all)")
  .option("--dry-run", "show what would be generated without writing")
  .action(async (options) => {
    const agents = await loadInstalledAgents();
    const context = await loadInstalledContext();

    const adapters = resolveAdapters(options.ide);
    for (const adapter of adapters) {
      const output = await adapter.generate({ agents, context });
      if (!options.dryRun) {
        await adapter.write(output);
      }
      console.log(`Generated ${adapter.name} files`);
    }
  });
```

**Validation Criteria**:
- `oac compat apply --all` runs without error with a fresh install
- Cursor output stays under 100KB
- Claude Code `session-start.js` runs without `ts-node`
- `oac compat status` correctly shows missing/present/outdated state

---

### Phase 7: Registry & Lockfile (Week 7)

**Goal**: Full registry client with lockfile. `oac add` fetches from registry and records in lock.

**What Gets Built**:

1. Registry client with SHA256 verification
2. `oac.lock` read/write with atomic updates
3. `oac add` fetches from registry, verifies hash, writes to disk, updates lock
4. `oac remove` removes files and updates lock
5. `oac browse` TUI browser of registry items
6. `oac search <query>` search registry

**Registry Client**:

```typescript
// packages/cli/src/registry/client.ts
export class RegistryClient {
  async fetch(name: string, type: OACItemType): Promise<RegistryItem> {
    const url = `${this.baseUrl}/${type}s/${name}`;
    const item = await fetch(url).then(r => r.json());
    return RegistryItemSchema.parse(item);
  }

  async download(item: RegistryItem): Promise<DownloadedFiles> {
    const files = await Promise.all(
      item.files.map(async (f) => {
        const content = await fetch(f.url).then(r => r.text());
        const sha256 = await computeSHA256(content);
        if (sha256 !== f.sha256) {
          throw new Error(`SHA256 mismatch for ${f.path}: expected ${f.sha256}, got ${sha256}`);
        }
        return { ...f, content };
      })
    );
    return files;
  }
}
```

**Atomic Lockfile Updates**:

```typescript
// packages/cli/src/registry/lockfile.ts
export async function updateLockfile(
  lockfilePath: string,
  updates: LockfileUpdate[]
): Promise<void> {
  const tmpPath = lockfilePath + ".tmp";
  const lock = await readLockfile(lockfilePath);
  for (const update of updates) {
    applyUpdate(lock, update);
  }
  await writeFile(tmpPath, JSON.stringify(lock, null, 2));
  await rename(tmpPath, lockfilePath); // Atomic rename
}
```

**Validation Criteria**:
- `oac add agent openagent` downloads, verifies SHA256, installs, updates `oac.lock`
- Corrupted download (wrong SHA256) is rejected with clear error
- `oac.lock` is valid JSON after every operation
- `oac remove agent openagent` removes files and updates `oac.lock`

---

### Phase 8: Auto-Update & Community (Week 8)

**Goal**: Background update checking, conflict resolution, community publish workflow.

**What Gets Built**:

1. `update-notifier` integration for CLI binary updates
2. Registry polling with configurable interval
3. `oac update` with `--interactive` conflict resolution
4. `oac rollback <component>` to previous version
5. `oac publish` workflow for community contributions
6. Update modes: `manual` / `auto-safe` / `auto-all` / `locked`

**Update Modes**:

```typescript
type UpdateMode = 
  | "manual"      // Never auto-update, always prompt
  | "auto-safe"   // Auto-update files with no local modifications
  | "auto-all"    // Auto-update everything, backup modifications
  | "locked"      // Never update, lock.json is authoritative
```

**Rollback**:

```typescript
// oac rollback openagent
// Reads previous version from lock history
// Fetches from registry at pinned version
// Restores files + updates lock
```

**Validation Criteria**:
- `update-notifier` shows update message when newer CLI version available
- `oac update --interactive` correctly shows diffs and prompts for each conflict
- `oac rollback openagent` restores previous version
- Update mode `auto-safe` correctly skips user-modified files
- Update mode `auto-all` creates backup before overwriting

---

### Phase 9: Polish & Testing (Week 9)

**Goal**: Production-ready package with comprehensive test coverage and documentation.

**What Gets Built**:

1. Unit tests for all core functionality (vitest)
2. Integration tests for CLI commands
3. End-to-end test: fresh install → configure → update cycle
4. `oac doctor` covers all known failure modes
5. Performance: measure and optimize `session.created` handler
6. README and getting-started guide updates
7. Deprecation of `install.sh` with migration notice

**Test Coverage Targets**:
- Unit tests: ≥ 80% coverage on `packages/cli/src/`
- Integration tests: all 20+ commands
- E2E test: full install/update/rollback cycle

**Validation Criteria**:
- All tests pass on macOS, Linux, Windows (via GitHub Actions)
- `oac init` completes in < 2 minutes on fresh machine
- `session.created` handler adds < 500ms to session start
- `oac doctor` passes on a correct install

---

## 5. Key Technical Decisions

### Decision 1: OpenCode as Primary Target

**Rationale**: OpenCode offers a TypeScript plugin SDK with 25+ lifecycle events, custom tool registration, and npm-based distribution. This is the richest integration model available among the four IDEs. By targeting OpenCode first, we get:
- Auto-update on every session start (via `session.created`)
- Type-safe plugin development
- Zero file-copying for plugin distribution (npm handles it)
- Future access to new OpenCode capabilities as they're released

Claude Code, Cursor, and Windsurf are adaptation layers — we write once for OpenCode and adapt for others.

### Decision 2: Bundle Context into npm (Not Fetch at Runtime)

**Rationale**: Context files are needed the moment an AI session starts. A network fetch at that moment creates:
- Latency (adds delay to every session)
- Network dependency (fails offline, in CI, on slow connections)
- Version drift (server updates mid-session)

By bundling context into the npm package, we get zero-latency access, offline functionality, and version-locked reproducibility. The `manifest.json` + SHA256 system handles update detection separately from file delivery.

### Decision 3: `agent.json` + `prompt.md` Separation

**Rationale**: Separating metadata from prose has three benefits:
1. **Diffability**: `agent.json` changes (model, permissions) are clearly separated from prompt content changes — easier to review in PRs
2. **IDE compatibility**: `prompt.md` frontmatter contains only fields OpenCode reads natively. OAC metadata in `agent.json` doesn't pollute the frontmatter
3. **Preset application**: Presets can override specific `agent.json` fields without touching `prompt.md`, and vice versa

### Decision 4: shadcn Registry Pattern

**Rationale**: shadcn demonstrated that a file-copy registry model is superior to package-per-component for configuration files. Benefits:
- Users own their copies — they can modify them freely
- No npm install needed to add an agent/skill/context file
- SHA256 verification provides security without requiring a signing infrastructure
- Community can contribute by PR to `registry.json`

The `oac.lock` lockfile extends this pattern with version pinning and reproducibility.

### Decision 5: Backward Compatibility Strategy

During the 9-week transition:
- `install.sh` continues to work but shows a deprecation notice
- `bin/oac.js` is backward compatible — no arguments → runs equivalent of old behavior
- All files installed by old `install.sh` remain valid; `oac doctor` can adopt them into `oac.lock`
- `oac init --import` scans existing `.opencode/` and creates `oac.lock` from discovered files

---

## 6. Critical Gaps to Address

These are gaps that will break functionality if not addressed before launch. Ordered by priority.

### Gap 1: context-manager router.sh is a STUB (P0)

**Current state**: `router.sh` in `.opencode/skills/context-manager/` exists but dispatches nothing.  
**Impact**: The context-manager skill is completely non-functional.  
**Fix**: Implement full dispatch logic to 8 subcommands (see Phase 4 above).  
**Owner**: Phase 4, Week 4.

### Gap 2: task-cli.ts requires ts-node (P0)

**Current state**: `task-cli.ts` is invoked directly via `ts-node` in `router.sh`.  
**Impact**: Breaks in any environment without `ts-node` (most production setups).  
**Fix**: Compile `task-cli.ts` → `task-cli.js` via `tsup` in the build pipeline. Update `router.sh` to call `node task-cli.js`.  
**Owner**: Phase 1, Week 1.

### Gap 3: Compatibility Layer has no CLI (P1)

**Current state**: `packages/compatibility-layer/` adapters are functionally complete but have zero CLI exposure.  
**Impact**: Multi-IDE users cannot generate Claude/Cursor/Windsurf files via `oac` commands.  
**Fix**: Wire adapters to `oac compat apply` command (Phase 6, Week 6).  
**Owner**: Phase 6, Week 6.

### Gap 4: OpenCode plugin does not exist as a proper plugin (P1)

**Current state**: `packages/plugin-abilities/` has event handler stubs but is not registered in `opencode.json` as a proper plugin.  
**Impact**: Auto-update via `session.created` does not fire.  
**Fix**: Complete plugin-abilities implementation and add to `opencode.json` plugin array.  
**Owner**: Phase 5, Week 5.

### Gap 5: No lockfile system (P1)

**Current state**: Installed components are not tracked. No reproducibility.  
**Impact**: Teams cannot share exact installs. Updates cannot detect user modifications.  
**Fix**: Implement `oac.lock` with atomic read/write (Phase 7, Week 7).  
**Owner**: Phase 7, Week 7.

### Gap 6: Full CLI does not exist (P0 — foundation)

**Current state**: `bin/oac.js` is 91 lines that spawns `install.sh`.  
**Impact**: Everything depends on this being fixed.  
**Fix**: Create `packages/cli/` and rewrite `bin/oac.js` (Phase 1, Week 1-2).  
**Owner**: Phase 1, Week 1.

### Gap 7: No test infrastructure (P2)

**Current state**: No tests exist anywhere in the codebase.  
**Impact**: Regressions will go undetected. Cannot validate fixes.  
**Fix**: Set up vitest in Phase 1, write tests progressively through Phases 2-9.  
**Owner**: Phase 1 (setup) + ongoing.

---

## 7. Configuration Schema

### Global Config: `~/.config/oac/config.json`

```json
{
  "$schema": "https://registry.nextsystems.dev/oac/schemas/global-config.json",
  "version": "1",
  "defaults": {
    "ide": "opencode",
    "updateMode": "auto-safe",
    "registry": "https://registry.nextsystems.dev/oac",
    "telemetry": false
  },
  "presets": {
    "default": "~/.config/oac/presets/default.json"
  },
  "auth": {
    "registryToken": null
  }
}
```

**`updateMode` values**:
- `"manual"` — Never auto-update. Run `oac update` explicitly.
- `"auto-safe"` — Auto-update only files matching stock SHA256 (default).
- `"auto-all"` — Auto-update everything. Creates `.oac/backups/` before overwriting.
- `"locked"` — Never update. `oac.lock` is authoritative.

### Project Config: `.oac/config.json`

```json
{
  "$schema": "https://registry.nextsystems.dev/oac/schemas/project-config.json",
  "version": "1",
  "project": {
    "name": "my-project",
    "ide": "opencode",
    "updateMode": "auto-safe"
  },
  "agents": {
    "enabled": ["openagent", "task-manager", "contextscout"],
    "disabled": []
  },
  "context": {
    "enabled": ["typescript-patterns", "git-workflow"],
    "disabled": []
  },
  "skills": {
    "enabled": ["task-management", "context-manager", "context7"],
    "disabled": []
  },
  "compatibility": {
    "cursor": { "enabled": true, "autoRegenerate": true },
    "claude": { "enabled": true, "autoRegenerate": false },
    "windsurf": { "enabled": false }
  }
}
```

### `oac.lock` Format

```json
{
  "$schema": "https://registry.nextsystems.dev/oac/schemas/lockfile.json",
  "version": "1",
  "generatedAt": "2026-02-19T00:00:00Z",
  "oacVersion": "0.7.1",
  "installed": {
    "agents": {
      "<name>": {
        "version": "<semver>",
        "source": "registry | bundled | local",
        "registryUrl": "<url>",
        "sha256": {
          "<filename>": "<sha256>"
        },
        "installedAt": "<iso8601>",
        "updatedAt": "<iso8601>",
        "userModified": {
          "<filename>": true | false
        },
        "presetApplied": "<preset-name> | null"
      }
    },
    "skills": { "<same shape>" },
    "context": { "<same shape>" },
    "plugins": { "<same shape>" }
  },
  "history": [
    {
      "action": "add | update | remove | rollback",
      "component": "<type>/<name>",
      "fromVersion": "<semver> | null",
      "toVersion": "<semver>",
      "timestamp": "<iso8601>"
    }
  ]
}
```

### OAC Component Manifest: `manifest.json`

```json
{
  "$schema": "https://registry.nextsystems.dev/oac/schemas/manifest.json",
  "version": "1",
  "packageVersion": "0.7.1",
  "generatedAt": "2026-02-19T00:00:00Z",
  "agents": {
    "<name>": {
      "version": "<semver>",
      "description": "<string>",
      "files": {
        "<filename>": {
          "sha256": "<sha256>",
          "size": 4821
        }
      }
    }
  },
  "skills": { "<same shape>" },
  "context": {
    "<filename>": {
      "version": "<semver>",
      "sha256": "<sha256>",
      "size": 2341,
      "category": "language | workflow | tooling | project"
    }
  }
}
```

---

## 8. Auto-Update Strategy

### Two-Layer Update System

**Layer 1: CLI Binary Updates** (via `update-notifier`)

```typescript
// packages/cli/src/index.ts
import updateNotifier from "update-notifier";
import packageJson from "../../package.json";

const notifier = updateNotifier({
  pkg: packageJson,
  updateCheckInterval: 1000 * 60 * 60 * 24, // Check daily
});

// Non-blocking: shows notification at end of command
notifier.notify();
```

**Layer 2: Content File Updates** (hash-based registry polling)

```
Content update check flow:

1. Read oac.lock (installed versions + sha256)
2. Fetch registry manifest (latest versions + sha256)
3. For each installed component:
   a. Compare installed version vs registry version (semver)
   b. If newer version available:
      i.  Compute SHA256 of file on disk
      ii. Compare to oac.lock sha256 for that file
          MATCH  → file is stock OAC → SAFE TO UPDATE
          DIFFER → file has user modifications → RESPECT updateMode
4. Apply updates according to updateMode
5. Update oac.lock
```

### Hash-Based Conflict Detection

The SHA256 stored in `oac.lock` is the hash of the file **as installed from the registry**, not the current file on disk. This allows detection of user modifications:

```typescript
async function detectModification(
  installedPath: string,
  lockEntry: LockfileEntry
): Promise<boolean> {
  const currentContent = await readFile(installedPath);
  const currentSha256 = await sha256(currentContent);
  const installedSha256 = lockEntry.sha256[basename(installedPath)];
  return currentSha256 !== installedSha256;
}
```

### User-Owned vs OAC-Managed Files

```
OAC-MANAGED (tracked in oac.lock, updated by oac update):
  .opencode/agent/<name>/          (standard agents)
  .opencode/context/<name>.md     (standard context)
  .opencode/skills/<name>/         (standard skills)

USER-OWNED (never touched by oac update):
  .opencode/agent/custom/          (user's custom agents)
  .opencode/context/custom/        (user's custom context)
  .oac/context/                    (project overrides, highest priority)
  docs/                            (project documentation)
  ~/.config/oac/presets/           (user presets)
```

### Update Modes in Detail

| Mode | Behavior | Best For |
|------|----------|---------|
| `manual` | Never updates automatically. Must run `oac update` | Teams with strict change control |
| `auto-safe` | Updates only files with SHA256 matching oac.lock (default) | Solo developers, most teams |
| `auto-all` | Updates everything; backs up modified files to `.oac/backups/` | Users who want always-latest |
| `locked` | Ignores registry. oac.lock is authoritative. | CI/CD, reproducible builds |

### Update in OpenCode Plugin

```typescript
// Runs on every session.created — must be fast
export async function handleSessionCreated(ctx: SessionContext) {
  const updateMode = await getUpdateMode();
  if (updateMode === "locked") return; // Fast exit for locked mode

  const check = await checkUpdatesWithTimeout(5000); // 5s timeout
  if (!check) return; // Network unavailable — skip silently

  if (check.safeUpdates.length > 0 && updateMode !== "manual") {
    await applySafeUpdates(check.safeUpdates); // Unmodified files
  }

  if (check.conflicts.length > 0) {
    ctx.log.info(`OAC: ${check.conflicts.length} updates available (run 'oac update')`);
  }
}
```

---

## 9. CLI Command Reference

### Core Commands

```bash
oac init [--ide <ide>] [--no-agents] [--no-context] [--yolo]
  Initialize OAC in the current project. Interactive wizard by default.
  Creates: .oac/config.json, oac.lock, copies bundled content

oac add <type> <name> [--version <semver>] [--yolo]
  Install a component from the registry.
  Types: agent, skill, context, plugin
  Example: oac add agent openagent

oac remove <type> <name> [--yolo]
  Remove an installed component.
  Example: oac remove agent openagent

oac update [type] [name] [--interactive] [--dry-run] [--yolo]
  Update installed components. Without args, updates all safe components.
  --interactive: prompts for each conflict
  --dry-run: shows what would be updated without making changes

oac list [type] [--format table|json]
  List installed components with versions and modification status.
  Example: oac list agents

oac doctor [--fix]
  Diagnose installation issues. --fix auto-repairs fixable issues.

oac rollback <type> <name> [--version <semver>]
  Rollback a component to a previous version.
  Example: oac rollback agent openagent --version 2.0.0
```

### Context Commands

```bash
oac context install <name>
  Install a specific context file from the registry.

oac context update [name]
  Update context file(s). Without name, updates all safe context.

oac context list [--format table|json]
  List installed context files with source layer.

oac context resolve <name>
  Show which resolution layer provides a context file.

oac context validate [name]
  Validate context file syntax and frontmatter.

oac context diff <name>
  Show diff between installed file and stock (registry) version.
```

### Agent Commands

```bash
oac add agent <name>              # Install from registry
oac remove agent <name>           # Remove agent
oac list agents                   # List with versions and status
oac customize agent <name>        # Open editor, save as preset
oac validate agents [name]        # Validate agent.json schema
oac create agent                  # Interactive creation wizard
oac show agent <name>             # Show agent configuration

oac presets list                  # List available presets
oac presets apply <preset> [agents...]   # Apply preset to agents
oac presets create <name>         # Create preset from current customizations
oac presets remove <name>         # Delete preset
```

### Skill Commands

```bash
oac skill install <name>          # Install skill from registry
oac skill update [name]           # Update skill(s)
oac skill remove <name>           # Remove skill
oac skill list                    # List installed skills
oac skill validate [name]         # Validate SKILL.md and router.sh
oac skill run <name> <command>    # Run skill command directly

oac task status                   # Show current task session
oac task next                     # Get next task from session
oac task complete <id>            # Mark task as complete
oac task session list             # List task sessions
oac task session clean [--older-than <days>]  # Clean old sessions
```

### Plugin Commands

```bash
oac plugin install <name>         # Install plugin from registry
oac plugin update [name]          # Update plugin(s)
oac plugin remove <name>          # Remove plugin
oac plugin list                   # List installed plugins
oac plugin configure <name>       # Configure plugin settings
oac plugin create                 # Scaffold new plugin
```

### Compatibility Commands

```bash
oac compat apply [--ide <ide>] [--all] [--dry-run]
  Generate IDE-specific files from installed agents/context.
  IDEs: cursor, claude, windsurf
  Example: oac compat apply --ide cursor

oac compat status
  Show compatibility file status for each supported IDE.

oac compat validate [--ide <ide>]
  Validate generated compatibility files.

oac compat clean [--ide <ide>]
  Remove generated compatibility files.
```

### Registry Commands

```bash
oac browse [type]                 # TUI browser of registry
oac search <query> [--type <type>]  # Search registry
oac publish <path>                # Publish component to community registry
oac registry add <url>            # Add custom registry source
oac registry remove <url>         # Remove custom registry
oac registry list                 # List configured registries
oac registry status               # Check registry connectivity
```

### Configuration Commands

```bash
oac configure                     # Interactive config editor
oac configure get <key>           # Get config value
oac configure set <key> <value>   # Set config value
oac configure reset               # Reset to defaults

oac show [type] [name]            # Show details of installed component
oac edit [type] [name]            # Open component in $EDITOR
```

### Global Flags

```bash
--yolo                  # Skip all confirmations
--no-color              # Disable color output
--quiet                 # Minimal output
--verbose               # Verbose output
--debug                 # Debug output with stack traces
--json                  # Output as JSON (machine-readable)
--config <path>         # Use alternate config file
--registry <url>        # Use alternate registry URL
```

---

## 10. Success Metrics

### Technical Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Test coverage | ≥ 80% on `packages/cli/src/` | vitest coverage |
| Build time | < 30 seconds for full build | `time npm run build` |
| CLI startup time | < 200ms for `oac --version` | `time oac --version` |
| `oac init` time | < 2 minutes on fresh machine | Manual timing |
| `session.created` overhead | < 500ms | OpenCode plugin timing |
| Bundle size | < 5MB total npm package | `npm pack --dry-run` |
| TypeScript errors | 0 errors on `tsc --noEmit` | CI check |
| Zero bash dependencies | `oac` commands work without bash | Test on fresh Windows VM |

### User Experience Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Setup time (solo dev) | < 2 minutes from `npx @nextsystems/oac init` to working | User testing |
| Update friction | Zero prompts in `auto-safe` mode | Automated test |
| Customization survival rate | 100% presets survive `oac update` | Integration test |
| `oac doctor` detection rate | 100% of documented failure modes | Test against each failure mode |
| Rollback reliability | `oac rollback` succeeds 100% if oac.lock is present | Integration test |

### Community Adoption Metrics (6-month targets)

| Metric | Target |
|--------|--------|
| npm weekly downloads | > 1,000 |
| Community registry contributions | > 10 agents/skills submitted |
| GitHub issues: "broken install" | < 5% of total issues |
| `oac doctor --fix` auto-repair success rate | > 90% |
| Multi-IDE users | > 20% of users run `oac compat apply` |

### Migration Metrics

| Metric | Target |
|--------|--------|
| `install.sh` usage | < 20% of installs by Week 9 |
| Users successfully migrated via `oac init --import` | > 80% |
| Regressions reported after migration | 0 P0/P1 bugs |

---

## Appendix A: File Naming Conventions

```
Agents:   .opencode/agent/<name>/agent.json + prompt.md
Skills:   .opencode/skills/<name>/SKILL.md + router.sh + scripts/*.js
Context:  .opencode/context/<name>.md
Plugins:  packages/plugin-abilities/ (OpenCode) | .claude-plugin/ (Claude Code)
Config:   .oac/config.json (project) | ~/.config/oac/config.json (global)
Lock:     oac.lock (project root, commit to git)
Manifest: manifest.json (project root, commit to git)
Backups:  .oac/backups/<timestamp>/<component>/ (git-ignored)
Sessions: .tmp/sessions/ (git-ignored)
Presets:  ~/.config/oac/presets/<name>.json (survives npm updates)
```

## Appendix B: Dependency Rationale

| Package | Purpose | Why Not Alternative |
|---------|---------|---------------------|
| `commander` | CLI framework | Battle-tested, good TypeScript support. Yargs has more complex API. |
| `@inquirer/prompts` | Interactive prompts | Official Inquirer v9 rewrite, modular. Better than `enquirer` |
| `ora` | Spinners | Standard, well-maintained |
| `chalk` | Colors | Standard, ESM-compatible v5 |
| `conf` | Global config persistence | OS-correct paths, handles JSON schema |
| `fs-extra` | File operations | Adds `copy`, `ensureDir`, `readJSON` etc. Better than raw `fs` |
| `semver` | Version comparison | npm's own semver library, authoritative |
| `zod` | Schema validation | Best TypeScript DX, composable schemas |
| `update-notifier` | CLI update notifications | Non-blocking background check |
| `tsup` | Build tool | Bundles deps, fast, simple config |
| `vitest` | Testing | Fast, native ESM, compatible with tsup |

## Appendix C: Migration Path from install.sh

```bash
# Old workflow:
curl -fsSL https://install.nextsystems.dev/oac | bash

# New workflow (v1.0):
npx @nextsystems/oac init

# For existing users:
oac init --import          # Scans .opencode/ and creates oac.lock
oac doctor                 # Validates the import
oac compat apply --all     # Regenerates IDE-specific files

# install.sh shows deprecation notice but continues to work:
echo "DEPRECATED: install.sh will be removed in v2.0. Run: npx @nextsystems/oac init"
```

---

*Document status: Authoritative master plan. All implementation decisions should reference this document. Update this document when architectural decisions change.*

*Next action: Begin Phase 1 — create `packages/cli/` package structure and rewrite `bin/oac.js`.*
