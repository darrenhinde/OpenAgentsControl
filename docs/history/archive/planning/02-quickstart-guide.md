# OAC Package Refactor - Quick Start

**Purpose**: Quick reference for working on the OAC package refactor  
**Issue**: #206  
**Branch**: `feature/oac-package-refactor`  
**Context**: `features/oac-package-refactor.md`

---

## Current Status

✅ **Planning Complete**
- Context file created
- GitHub issue #206 created
- Feature branch created and pushed
- **CRITICAL features defined**:
  - User approval system with YOLO mode
  - Layered context resolution (project + global)

📝 **Next: Phase 1 - Core CLI Infrastructure**

## Critical Features Overview

### 1. User Approval System
- **Default**: Interactive approval for ALL file operations
- **YOLO Mode** (`--yolo`): Skip confirmations, auto-resolve, report at end
- **Always asks**: Local vs global install location
- **Conflict handling**: Show diffs, ask user, create backups
- **Safety**: Git detection, rollback support, audit log

### 2. Context Resolution
- **6-layer priority**: Project override → Project → IDE → Docs → User global → OAC official
- **Smart resolution**: Based on agent location (global vs local)
- **Configurable**: `preferLocal` option
- **CLI tools**: `oac context resolve`, `list`, `validate`, `override`, `sync`

---

## Quick Commands

```bash
# Switch to feature branch
git checkout feature/oac-package-refactor

# View full context
cat .opencode/context/openagents-repo/features/oac-package-refactor.md

# View GitHub issue
gh issue view 206

# Start Phase 1
# (See Phase 1 section below)
```

---

## Phase 1: Core CLI Infrastructure

**Goal**: Set up TypeScript project and configuration system

### Tasks

1. **Set up TypeScript project structure**
   ```bash
   mkdir -p src/{cli/{commands,config},core/{context,installer,approval},types,utils}
   npm install --save-dev typescript @types/node tsx vitest
   npx tsc --init
   ```

2. **Install CLI dependencies**
   ```bash
   npm install commander inquirer zod chalk ora boxen
   npm install --save-dev @types/inquirer
   ```

3. **Create configuration schema** (CRITICAL)
   - File: `src/cli/config/schema.ts`
   - Use Zod for validation
   - Define OACConfig interface
   - **Include**: `confirmOverwrites`, `yoloMode`, `preferLocal`, context resolution config

4. **Create configuration manager**
   - File: `src/cli/config/manager.ts`
   - Read/write config files
   - Merge global and local configs (priority: local > global)
   - Validate with schema
   - **Support**: `~/.config/oac/config.json` (global) and `.oac/config.json` (local)

5. **Create approval system** (CRITICAL)
   - File: `src/core/approval/manager.ts`
   - Interactive prompts for file operations
   - YOLO mode support
   - Conflict resolution strategies
   - Backup management
   - Audit logging

6. **Create context resolver** (CRITICAL)
   - File: `src/core/context/resolver.ts`
   - 6-layer priority resolution
   - Agent location detection (global vs local)
   - `preferLocal` configuration
   - Fallback support
   - Validation and suggestions

7. **Implement basic CLI commands**
   - File: `src/cli/index.ts` (Commander setup)
   - File: `src/cli/commands/configure.ts`
   - File: `src/cli/commands/list.ts`
   - File: `src/cli/commands/init.ts`
   - **Add global flags**: `--yolo`, `--dry-run`, `--local`, `--global`

8. **Update bin/oac.js**
   - Point to compiled TypeScript
   - Handle both legacy and new commands
   - Detect current working directory

9. **Write tests**
   - Test configuration schema
   - Test config manager (global + local merge)
   - Test approval system (interactive + YOLO)
   - Test context resolver (all 6 layers)
   - Test CLI commands

### Deliverables

- [ ] TypeScript project configured
- [ ] Configuration schema defined (with approval + context config)
- [ ] Configuration manager working (global + local merge)
- [ ] **Approval system working** (interactive + YOLO mode)
- [ ] **Context resolver working** (6-layer priority)
- [ ] `oac configure` command works
- [ ] `oac list` command works
- [ ] `oac init` command works (asks local vs global)
- [ ] `oac context resolve` command works
- [ ] Tests passing (including approval + context tests)

### Validation

```bash
# Test configuration (global + local)
oac configure show
oac configure set agents.permissions.bash auto
oac configure get agents.permissions.bash
oac configure set preferences.yoloMode true

# Test list
oac list
oac list --agents
oac list --local
oac list --global

# Test init (should ask local vs global)
cd /tmp/test-project
oac init developer
# Should prompt: "Install locally or globally?"

# Test approval system
cd /tmp/test-project
oac install opencode
# Should show file list and ask for confirmation

# Test YOLO mode
oac install opencode --yolo
# Should auto-confirm and report at end

# Test context resolution
oac context resolve 'core/standards/code-quality.md'
# Should show resolved path and priority

oac context list
# Should show all context files from all layers

oac context validate
# Should validate all context references
```

---

## Project Structure (Phase 1)

```
@nextsystems/oac/
├── bin/
│   └── oac.js                  # Updated entry point
├── src/
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── configure.ts    # NEW - Config management
│   │   │   ├── list.ts         # NEW - List components
│   │   │   ├── init.ts         # NEW - Initialize (asks local/global)
│   │   │   └── context.ts      # NEW - Context commands (resolve, list, validate)
│   │   ├── config/
│   │   │   ├── manager.ts      # NEW - Global + local merge
│   │   │   ├── schema.ts       # NEW - Zod schema (approval + context config)
│   │   │   └── defaults.ts     # NEW - Default config
│   │   └── index.ts            # NEW - Commander setup (global flags)
│   ├── core/
│   │   ├── approval/
│   │   │   ├── manager.ts      # NEW - Approval system (CRITICAL)
│   │   │   ├── strategies.ts   # NEW - Conflict strategies
│   │   │   └── backup.ts       # NEW - Backup management
│   │   ├── context/
│   │   │   ├── resolver.ts     # NEW - 6-layer resolution (CRITICAL)
│   │   │   ├── locator.ts      # NEW - Find context files
│   │   │   └── validator.ts    # NEW - Validate references
│   │   └── installer/
│   │       └── location.ts     # NEW - Detect local vs global
│   ├── types/
│   │   ├── config.ts           # NEW - Config types
│   │   ├── approval.ts         # NEW - Approval types
│   │   └── context.ts          # NEW - Context types
│   └── utils/
│       ├── logger.ts           # NEW - Logging
│       ├── prompts.ts          # NEW - Interactive prompts
│       └── git.ts              # NEW - Git detection
├── config/
│   └── oac.config.json         # NEW - Default config
├── tsconfig.json               # NEW
├── package.json                # UPDATED
└── .opencode/                  # EXISTING
```

---

## Configuration Schema (Reference)

```typescript
// src/cli/config/schema.ts
import { z } from 'zod';

export const OACConfigSchema = z.object({
  version: z.string(),
  preferences: z.object({
    defaultIDE: z.enum(['opencode', 'cursor', 'claude', 'windsurf']),
    installLocation: z.enum(['local', 'global']),
    autoUpdate: z.boolean(),
    updateChannel: z.enum(['stable', 'beta', 'alpha'])
  }),
  ides: z.record(z.object({
    enabled: z.boolean(),
    path: z.string(),
    profile: z.string()
  })),
  agents: z.object({
    behavior: z.object({
      approvalGates: z.boolean(),
      contextLoading: z.enum(['lazy', 'eager']),
      delegationThreshold: z.number()
    }),
    permissions: z.object({
      bash: z.enum(['approve', 'auto', 'deny']),
      write: z.enum(['approve', 'auto', 'deny']),
      edit: z.enum(['approve', 'auto', 'deny']),
      task: z.enum(['approve', 'auto', 'deny'])
    })
  }),
  context: z.object({
    locations: z.array(z.string()),
    autoDiscover: z.boolean(),
    cacheEnabled: z.boolean()
  }),
  registry: z.object({
    source: z.string().url(),
    localCache: z.string(),
    updateInterval: z.number()
  })
});

export type OACConfig = z.infer<typeof OACConfigSchema>;
```

---

## Default Configuration (Reference)

```json
{
  "version": "1.0.0",
  "preferences": {
    "defaultIDE": "opencode",
    "installLocation": "local",
    "autoUpdate": false,
    "updateChannel": "stable"
  },
  "ides": {
    "opencode": {
      "enabled": true,
      "path": ".opencode",
      "profile": "developer"
    },
    "cursor": {
      "enabled": false,
      "path": ".cursor",
      "profile": "developer"
    },
    "claude": {
      "enabled": false,
      "path": ".claude",
      "profile": "developer"
    },
    "windsurf": {
      "enabled": false,
      "path": ".windsurf",
      "profile": "developer"
    }
  },
  "agents": {
    "behavior": {
      "approvalGates": true,
      "contextLoading": "lazy",
      "delegationThreshold": 4
    },
    "permissions": {
      "bash": "approve",
      "write": "approve",
      "edit": "approve",
      "task": "approve"
    }
  },
  "context": {
    "locations": [
      ".opencode/context",
      ".claude/context",
      "docs/context"
    ],
    "autoDiscover": true,
    "cacheEnabled": true
  },
  "registry": {
    "source": "https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/registry.json",
    "localCache": "~/.config/oac/registry.cache.json",
    "updateInterval": 86400
  }
}
```

---

## Testing Strategy

### Unit Tests
```typescript
// src/cli/config/manager.test.ts
import { describe, it, expect } from 'vitest';
import { ConfigManager } from './manager';

describe('ConfigManager', () => {
  it('should load default config', async () => {
    const manager = new ConfigManager();
    const config = await manager.load();
    expect(config.version).toBe('1.0.0');
  });

  it('should validate config schema', async () => {
    const manager = new ConfigManager();
    const valid = await manager.validate(mockConfig);
    expect(valid).toBe(true);
  });

  it('should merge global and local configs', async () => {
    const manager = new ConfigManager();
    const config = await manager.load();
    expect(config.preferences.defaultIDE).toBeDefined();
  });
});
```

### Integration Tests
```bash
# Test CLI commands
npm run build
./bin/oac.js configure show
./bin/oac.js list
./bin/oac.js init developer
```

---

## Development Workflow

1. **Create feature branch** ✅
   ```bash
   git checkout feature/oac-package-refactor
   ```

2. **Set up TypeScript project**
   ```bash
   mkdir -p src/{cli/{commands,config},core,types,utils}
   npm install dependencies
   npx tsc --init
   ```

3. **Implement Phase 1 tasks**
   - Configuration schema
   - Configuration manager
   - CLI commands

4. **Write tests**
   ```bash
   npm run test
   ```

5. **Build and test locally**
   ```bash
   npm run build
   npm pack
   npm install -g ./nextsystems-oac-*.tgz
   oac configure
   ```

6. **Commit and push**
   ```bash
   git add .
   git commit -m "feat(phase1): implement core CLI infrastructure"
   git push
   ```

---

## Resources

**Context Files**:
- `features/oac-package-refactor.md` - Full feature context
- `core-concepts/registry.md` - Registry system
- `guides/npm-publishing.md` - Publishing workflow

**External Docs**:
- Commander.js: https://github.com/tj/commander.js
- Zod: https://zod.dev
- Inquirer: https://github.com/SBoudrias/Inquirer.js

**GitHub**:
- Issue: https://github.com/darrenhinde/OpenAgentsControl/issues/206
- Branch: `feature/oac-package-refactor`

---

## Next Phase Preview

**Phase 2: Registry & Component Management**
- Port registry validation to TypeScript
- Implement registry loader/resolver
- Create component installer
- Profile installer
- Dependency resolution

---

**Last Updated**: 2026-02-14  
**Status**: Ready to start Phase 1
