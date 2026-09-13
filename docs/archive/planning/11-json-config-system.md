# JSON-Based Agent Configuration System

**Date**: 2026-02-15  
**Status**: Architecture Design  
**Branch**: `feature/oac-package-refactor`  
**Priority**: CRITICAL - Foundation for v2.0

---

## 🎯 Vision

Transform agent management from markdown-based to **JSON-configured, type-safe, multi-IDE compatible** system with single source of truth.

### Current Problems

❌ **Markdown agents are hard to parse and validate**  
❌ **No type safety or schema validation**  
❌ **Difficult to extract metadata programmatically**  
❌ **Can't easily query agent properties**  
❌ **Version management is manual**  
❌ **Hard to convert between IDE formats**  
❌ **Duplication across IDEs (OpenCode, Claude, Cursor)**

### New Approach

✅ **Single source of truth** - `.opencode/` contains universal format  
✅ **JSON config + Markdown prompts** - Separation of concerns  
✅ **Type-safe** - Full TypeScript interfaces  
✅ **Queryable** - Easy filtering and searching  
✅ **Validatable** - JSON Schema validation  
✅ **Versionable** - Semantic versioning built-in  
✅ **Convertible** - Transform to any IDE format  
✅ **Multi-IDE** - Apply to OpenCode, Claude, Cursor, Windsurf

---

## 🏗️ Architecture

### Single Source of Truth

```
.opencode/                          ← UNIVERSAL FORMAT (source of truth)
├── agents/
│   ├── core/
│   │   ├── openagent/
│   │   │   ├── agent.json          ← Configuration (metadata, permissions, tools)
│   │   │   ├── prompt.md           ← Prompt content (human-readable)
│   │   │   ├── system.md           ← System instructions (optional)
│   │   │   └── examples.md         ← Examples (optional)
│   │   └── opencoder/
│   │       ├── agent.json
│   │       └── prompt.md
│   │
│   ├── subagents/
│   │   ├── code-reviewer/
│   │   │   ├── agent.json
│   │   │   └── prompt.md
│   │   └── test-engineer/
│   │       ├── agent.json
│   │       └── prompt.md
│   │
│   └── manifest.json               ← Registry of all agents
│
├── context/                        ← Context files (unchanged)
├── skills/                         ← Skills (unchanged)
├── tools/                          ← MCP tools (unchanged)
└── config.json                     ← Main OAC config

         ↓ OAC CLI converts/applies ↓

┌────────────┬─────────────┬──────────┬───────────┐
│ OpenCode   │ Claude Code │ Cursor   │ Windsurf  │
│ (native)   │ (convert)   │ (flatten)│ (flatten) │
└────────────┴─────────────┴──────────┴───────────┘
```

---

## 📄 Agent Configuration Schema

### TypeScript Interface

```typescript
// packages/core/src/types/agent.ts

export interface AgentConfig {
  // Metadata
  $schema: string;
  version: string;
  id: string;
  name: string;
  description: string;
  category: 'core' | 'subagent' | 'specialist' | 'meta';
  
  // Agent behavior
  mode: 'primary' | 'subagent' | 'tool';
  model?: string;
  
  // Prompt configuration
  prompt: {
    file?: string;           // Path to prompt file (e.g., "./prompt.md")
    inline?: string;         // Inline prompt (for simple agents)
    system?: string;         // System instructions file
    examples?: string;       // Examples file
    temperature?: number;
    maxTokens?: number;
  };
  
  // Permissions (approval gates)
  permissions: {
    bash?: PermissionLevel;
    write?: PermissionLevel;
    edit?: PermissionLevel;
    read?: PermissionLevel;
    task?: PermissionLevel;
    [key: string]: PermissionLevel | undefined;
  };
  
  // Tools (MCP)
  tools: {
    [toolName: string]: boolean | ToolConfig;
  };
  
  // Skills
  skills?: string[];
  
  // Plugins
  plugins?: string[];
  
  // Context files (@ notation)
  context?: string[];
  
  // Dependencies
  dependencies?: {
    agents?: string[];
    subagents?: string[];
    skills?: string[];
    tools?: string[];
  };
  
  // IDE Compatibility
  compatibility: {
    opencode: CompatibilityLevel;
    claude: CompatibilityLevel;
    cursor: CompatibilityLevel;
    windsurf: CompatibilityLevel;
    [ide: string]: CompatibilityLevel;
  };
  
  // Metadata
  author?: string;
  license?: string;
  repository?: string;
  tags?: string[];
}

export type PermissionLevel = 'allow' | 'approve' | 'deny';
export type CompatibilityLevel = 'full' | 'partial' | 'none';

export interface ToolConfig {
  enabled: boolean;
  config?: Record<string, any>;
}
```

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["$schema", "version", "id", "name", "mode", "prompt", "permissions", "tools", "compatibility"],
  "properties": {
    "$schema": {
      "type": "string",
      "const": "https://openagents.dev/schemas/agent-v2.json"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "name": {
      "type": "string"
    },
    "description": {
      "type": "string"
    },
    "category": {
      "type": "string",
      "enum": ["core", "subagent", "specialist", "meta"]
    },
    "mode": {
      "type": "string",
      "enum": ["primary", "subagent", "tool"]
    },
    "model": {
      "type": "string"
    },
    "prompt": {
      "type": "object",
      "properties": {
        "file": { "type": "string" },
        "inline": { "type": "string" },
        "system": { "type": "string" },
        "examples": { "type": "string" },
        "temperature": { "type": "number", "minimum": 0, "maximum": 2 },
        "maxTokens": { "type": "number", "minimum": 1 }
      }
    },
    "permissions": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "enum": ["allow", "approve", "deny"]
      }
    },
    "tools": {
      "type": "object",
      "additionalProperties": {
        "oneOf": [
          { "type": "boolean" },
          {
            "type": "object",
            "properties": {
              "enabled": { "type": "boolean" },
              "config": { "type": "object" }
            }
          }
        ]
      }
    },
    "compatibility": {
      "type": "object",
      "required": ["opencode", "claude", "cursor", "windsurf"],
      "properties": {
        "opencode": { "type": "string", "enum": ["full", "partial", "none"] },
        "claude": { "type": "string", "enum": ["full", "partial", "none"] },
        "cursor": { "type": "string", "enum": ["full", "partial", "none"] },
        "windsurf": { "type": "string", "enum": ["full", "partial", "none"] }
      }
    }
  }
}
```

---

## 📋 Example Configurations

### Example 1: OpenAgent (Primary Agent)

**`.opencode/agents/core/openagent/agent.json`**:

```json
{
  "$schema": "https://openagents.dev/schemas/agent-v2.json",
  "version": "2.0.0",
  "id": "openagent",
  "name": "OpenAgent",
  "description": "Meta orchestration agent for complex workflows",
  "category": "core",
  
  "mode": "primary",
  "model": "anthropic/claude-sonnet-4-20250514",
  
  "prompt": {
    "file": "./prompt.md",
    "system": "./system.md",
    "examples": "./examples.md",
    "temperature": 0.7,
    "maxTokens": 8000
  },
  
  "permissions": {
    "bash": "approve",
    "write": "approve",
    "edit": "approve",
    "read": "allow",
    "task": "approve",
    "glob": "allow",
    "grep": "allow"
  },
  
  "tools": {
    "bash": true,
    "read": true,
    "write": true,
    "edit": true,
    "task": true,
    "glob": true,
    "grep": true,
    "todowrite": true,
    "todoread": true
  },
  
  "skills": [
    "task-management",
    "context-discovery"
  ],
  
  "plugins": [],
  
  "context": [
    "@core/standards/code-quality",
    "@core/workflows/task-delegation",
    "@core/workflows/code-review"
  ],
  
  "dependencies": {
    "subagents": [
      "task-manager",
      "context-scout",
      "coder-agent",
      "code-reviewer",
      "test-engineer",
      "doc-writer"
    ],
    "skills": [
      "task-management"
    ],
    "tools": [
      "bash",
      "read",
      "write",
      "edit",
      "task"
    ]
  },
  
  "compatibility": {
    "opencode": "full",
    "claude": "full",
    "cursor": "partial",
    "windsurf": "partial"
  },
  
  "author": "NextSystems",
  "license": "MIT",
  "repository": "https://github.com/nextsystems/openagents-control",
  "tags": [
    "orchestration",
    "meta",
    "planning",
    "delegation"
  ]
}
```

**`.opencode/agents/core/openagent/prompt.md`**:

```markdown
You are OpenAgent, a meta orchestration agent for complex workflows.

## Your Role

You coordinate complex tasks by:
1. Analyzing user requests
2. Breaking down into subtasks
3. Delegating to specialist agents
4. Validating results
5. Completing the workflow

## Key Principles

- Always use ContextScout before execution
- Request approval before bash/write/edit/task
- Stop on test failures
- Maintain clear communication

## Workflow

[Stage 1: Analyze]
- Classify task type and complexity
- Use ContextScout for discovery

[Stage 2: Plan]
- Present plan and get approval
- Identify context needed

[Stage 3: Execute]
- Load context
- Execute or delegate
- Track progress

[Stage 4: Validate]
- Run tests
- Stop on failure
- Report results

[Stage 5: Complete]
- Update docs
- Summarize changes
- Confirm satisfaction
```

### Example 2: CodeReviewer (Subagent)

**`.opencode/agents/subagents/code-reviewer/agent.json`**:

```json
{
  "$schema": "https://openagents.dev/schemas/agent-v2.json",
  "version": "1.0.0",
  "id": "code-reviewer",
  "name": "CodeReviewer",
  "description": "Reviews code for best practices and potential issues",
  "category": "subagent",
  
  "mode": "subagent",
  "model": "anthropic/claude-sonnet-4-20250514",
  
  "prompt": {
    "file": "./prompt.md",
    "temperature": 0.3,
    "maxTokens": 4000
  },
  
  "permissions": {
    "bash": "deny",
    "write": "deny",
    "edit": "deny",
    "read": "allow",
    "glob": "allow",
    "grep": "allow"
  },
  
  "tools": {
    "read": true,
    "glob": true,
    "grep": true
  },
  
  "skills": [],
  "plugins": [],
  
  "context": [
    "@core/standards/code-quality",
    "@core/standards/security-patterns",
    "@core/workflows/code-review"
  ],
  
  "dependencies": {
    "tools": ["read", "glob", "grep"]
  },
  
  "compatibility": {
    "opencode": "full",
    "claude": "full",
    "cursor": "partial",
    "windsurf": "partial"
  },
  
  "author": "NextSystems",
  "license": "MIT",
  "tags": [
    "code-review",
    "quality",
    "security"
  ]
}
```

**`.opencode/agents/subagents/code-reviewer/prompt.md`**:

```markdown
You are CodeReviewer, a specialist in code quality and security.

## Your Role

Review code for:
- Security vulnerabilities
- Performance issues
- Best practices violations
- Maintainability concerns
- Code smells

## Review Process

1. Read the code files
2. Analyze against standards
3. Identify issues by severity
4. Provide actionable recommendations
5. Suggest improvements

## Output Format

**Critical Issues**: Security vulnerabilities, data loss risks
**High Priority**: Performance problems, major code smells
**Medium Priority**: Best practice violations
**Low Priority**: Style improvements, minor optimizations

Always provide specific line numbers and code examples.
```

---

## 🔧 Format Converters

### OpenCode Converter

```typescript
// packages/core/src/agent/converters/opencode.ts

export class OpenCodeConverter {
  convert(config: AgentConfig): string {
    const openCodeConfig = {
      $schema: "https://opencode.ai/config.json",
      agent: {
        [config.id]: {
          mode: config.mode,
          model: config.model,
          prompt: config.prompt.file 
            ? `{file:${config.prompt.file}}` 
            : config.prompt.inline,
          tools: this.convertTools(config.tools),
          permissions: config.permissions
        }
      }
    };
    
    return JSON.stringify(openCodeConfig, null, 2);
  }
  
  private convertTools(tools: Record<string, boolean | any>): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    
    for (const [name, value] of Object.entries(tools)) {
      result[name] = typeof value === 'boolean' ? value : value.enabled;
    }
    
    return result;
  }
}
```

### Claude Converter

```typescript
// packages/core/src/agent/converters/claude.ts

export class ClaudeConverter {
  convert(config: AgentConfig): string {
    // Claude uses similar format but doesn't support skills/plugins
    
    const claudeConfig = {
      agent: {
        [config.id]: {
          mode: config.mode,
          model: config.model,
          prompt: config.prompt.content || config.prompt.inline,
          tools: this.filterSupportedTools(config.tools),
          permissions: config.permissions
        }
      }
    };
    
    return JSON.stringify(claudeConfig, null, 2);
  }
  
  private filterSupportedTools(tools: Record<string, boolean | any>): Record<string, boolean> {
    // Claude only supports: bash, read, write, edit, glob, grep
    const supported = ['bash', 'read', 'write', 'edit', 'glob', 'grep'];
    const result: Record<string, boolean> = {};
    
    for (const [name, value] of Object.entries(tools)) {
      if (supported.includes(name)) {
        result[name] = typeof value === 'boolean' ? value : value.enabled;
      }
    }
    
    return result;
  }
}
```

### Cursor Converter

```typescript
// packages/core/src/agent/converters/cursor.ts

export class CursorConverter {
  convert(config: AgentConfig): string {
    // Cursor uses plain text .cursorrules
    let rules = `# ${config.name}\n\n`;
    rules += `${config.description}\n\n`;
    
    // Add prompt content (flattened)
    if (config.prompt.content) {
      rules += this.flattenPrompt(config.prompt.content);
    }
    
    // Add permissions as rules
    rules += '\n\n## Permissions\n\n';
    for (const [tool, level] of Object.entries(config.permissions)) {
      rules += `- ${tool}: ${level}\n`;
    }
    
    return rules;
  }
  
  private flattenPrompt(content: string): string {
    // Remove complex sections, keep simple instructions
    let result = content;
    
    // Remove frontmatter
    result = result.replace(/^---[\s\S]*?---\n/m, '');
    
    // Remove complex sections
    const sectionsToRemove = ['Workflow', 'Examples', 'Advanced'];
    for (const section of sectionsToRemove) {
      const regex = new RegExp(`## ${section}[\\s\\S]*?(?=##|$)`, 'gi');
      result = result.replace(regex, '');
    }
    
    return result.trim();
  }
}
```

---

## 🚀 OAC CLI Commands

### Convert Command

```bash
# Convert agent to specific IDE format
oac convert openagent --to=opencode
oac convert openagent --to=claude
oac convert openagent --to=cursor

# Convert all agents
oac convert --all --to=opencode

# Output to file
oac convert openagent --to=opencode --output=.opencode/config.json

# Dry run (show output without writing)
oac convert openagent --to=cursor --dry-run
```

### Validate Command

```bash
# Validate agent config against schema
oac validate openagent

# Validate all agents
oac validate --all

# Check IDE compatibility
oac validate openagent --ide=cursor

# Verbose output
oac validate openagent --verbose
```

### Apply Command

```bash
# Apply agent to IDE (auto-convert)
oac apply openagent --ide=opencode
oac apply openagent --ide=claude
oac apply openagent --ide=cursor

# Apply all agents
oac apply --all --ide=opencode

# Apply with profile
oac apply --profile=developer --ide=opencode

# Dry run
oac apply openagent --ide=cursor --dry-run

# Force overwrite
oac apply openagent --ide=opencode --force
```

### Create Command

```bash
# Create new agent interactively
oac create agent

# Create from template
oac create agent --template=subagent --name=my-reviewer

# Create with wizard
oac create agent --wizard
```

### Info Command

```bash
# Show agent info
oac info openagent

# Show compatibility matrix
oac info openagent --compatibility

# Show dependencies
oac info openagent --dependencies

# Show all metadata
oac info openagent --full
```

---

## 📊 Benefits

### 1. Type Safety

```typescript
// Full TypeScript support
import { AgentConfig } from '@oac/types';

const config: AgentConfig = {
  // IDE autocomplete works!
  id: 'my-agent',
  name: 'MyAgent',
  mode: 'subagent',
  // TypeScript validates everything
  permissions: {
    bash: 'approve',  // ✅ Valid
    write: 'invalid'  // ❌ Type error!
  }
};
```

### 2. Easy Querying

```typescript
// Find all agents that use bash
const bashAgents = agents.filter(a => a.tools.bash === true);

// Find agents compatible with Cursor
const cursorAgents = agents.filter(a => a.compatibility.cursor !== 'none');

// Find all subagents
const subagents = agents.filter(a => a.mode === 'subagent');

// Find agents by category
const coreAgents = agents.filter(a => a.category === 'core');
```

### 3. Schema Validation

```bash
# Validate against JSON schema
oac validate openagent

# Output:
# ✅ Valid agent config
# ✅ All required fields present
# ✅ Permissions valid (allow/approve/deny)
# ✅ Tools valid
# ✅ Compatibility matrix complete
# ✅ Version format valid (2.0.0)
```

### 4. Version Management

```json
{
  "version": "2.0.0",
  "compatibility": {
    "oac": ">=0.8.0",
    "opencode": ">=1.0.0"
  }
}
```

### 5. Easy Conversion

```typescript
// Convert to any format
const openCodeConfig = converterRegistry.convert(agentConfig, 'opencode');
const claudeConfig = converterRegistry.convert(agentConfig, 'claude');
const cursorRules = converterRegistry.convert(agentConfig, 'cursor');

// All from single source!
```

### 6. Separation of Concerns

```
agent.json     → Configuration (machine-readable, type-safe)
prompt.md      → Content (human-readable, editable)
system.md      → System instructions (optional)
examples.md    → Examples (optional)
```

### 7. IDE Support

```typescript
// VS Code autocomplete
{
  "id": "my-agent",
  "mode": "sub"  // ← Autocomplete suggests: "subagent"
  "permissions": {
    "bash": "app"  // ← Autocomplete suggests: "approve"
  }
}
```

---

## 🗺️ Migration Path

### Phase 1: Infrastructure (Week 1)

**Goal**: Build JSON config system and converters

- [ ] Define TypeScript interfaces (`packages/core/src/types/agent.ts`)
- [ ] Create JSON schema (`packages/core/src/schemas/agent-v2.json`)
- [ ] Build config loader (`packages/core/src/agent/loader.ts`)
- [ ] Build converters:
  - [ ] OpenCode converter
  - [ ] Claude converter
  - [ ] Cursor converter
  - [ ] Windsurf converter
- [ ] Build converter registry
- [ ] Add unit tests

**Deliverables**:
- ✅ TypeScript types
- ✅ JSON schema
- ✅ Config loader with validation
- ✅ All converters implemented
- ✅ Test coverage >80%

---

### Phase 2: CLI Commands (Week 2)

**Goal**: Implement CLI for convert/validate/apply

- [ ] Implement `oac convert` command
  - [ ] Support `--to` flag (opencode, claude, cursor)
  - [ ] Support `--output` flag
  - [ ] Support `--dry-run` flag
  - [ ] Support `--all` flag
- [ ] Implement `oac validate` command
  - [ ] Schema validation
  - [ ] Compatibility checking
  - [ ] Dependency validation
- [ ] Implement `oac apply` command
  - [ ] Auto-detect IDE
  - [ ] Convert and apply
  - [ ] Support `--force` flag
  - [ ] Support `--dry-run` flag
- [ ] Implement `oac info` command
  - [ ] Show agent metadata
  - [ ] Show compatibility matrix
  - [ ] Show dependencies
- [ ] Add help text and examples

**Deliverables**:
- ✅ All CLI commands working
- ✅ Help documentation
- ✅ Error handling
- ✅ User-friendly output

---

### Phase 3: Migration Script (Week 3)

**Goal**: Migrate existing markdown agents to JSON config

- [ ] Write migration script (`scripts/migrate-agents.ts`)
  - [ ] Parse markdown frontmatter
  - [ ] Extract metadata
  - [ ] Generate agent.json
  - [ ] Split prompt into prompt.md
  - [ ] Preserve all information
- [ ] Migrate core agents:
  - [ ] OpenAgent
  - [ ] OpenCoder
- [ ] Migrate all subagents:
  - [ ] TaskManager
  - [ ] ContextScout
  - [ ] CoderAgent
  - [ ] CodeReviewer
  - [ ] TestEngineer
  - [ ] DocWriter
  - [ ] BuildAgent
  - [ ] (all others)
- [ ] Generate manifest.json
- [ ] Validate all migrated configs

**Deliverables**:
- ✅ Migration script
- ✅ All agents migrated
- ✅ Validation passing
- ✅ No data loss

---

### Phase 4: Testing & Validation (Week 4)

**Goal**: Comprehensive testing of new system

- [ ] Unit tests:
  - [ ] Config loader
  - [ ] Each converter
  - [ ] Validation logic
- [ ] Integration tests:
  - [ ] Convert → Apply workflow
  - [ ] Multi-IDE apply
  - [ ] Profile-based apply
- [ ] End-to-end tests:
  - [ ] Create agent → Validate → Apply → Test
- [ ] Compatibility tests:
  - [ ] OpenCode native format
  - [ ] Claude conversion
  - [ ] Cursor flattening
- [ ] Performance tests:
  - [ ] Load 100+ agents
  - [ ] Convert all agents
  - [ ] Apply to multiple IDEs

**Deliverables**:
- ✅ Test coverage >90%
- ✅ All tests passing
- ✅ Performance benchmarks
- ✅ Compatibility verified

---

### Phase 5: Documentation (Week 5)

**Goal**: Complete documentation for new system

- [ ] User documentation:
  - [ ] JSON config format guide
  - [ ] Migration guide (markdown → JSON)
  - [ ] CLI command reference
  - [ ] IDE compatibility matrix
  - [ ] Best practices
- [ ] Developer documentation:
  - [ ] TypeScript interfaces
  - [ ] Converter API
  - [ ] Adding new IDE support
  - [ ] Schema extension guide
- [ ] Examples:
  - [ ] Simple agent
  - [ ] Complex agent with all features
  - [ ] Subagent
  - [ ] Multi-IDE setup

**Deliverables**:
- ✅ Complete user docs
- ✅ Complete dev docs
- ✅ Example agents
- ✅ Migration guide

---

### Phase 6: Deprecation (Week 6)

**Goal**: Deprecate old markdown format

- [ ] Add deprecation warnings:
  - [ ] Warn when loading markdown agents
  - [ ] Suggest migration command
  - [ ] Show migration guide link
- [ ] Update registry.json:
  - [ ] Point to new JSON configs
  - [ ] Mark markdown agents as deprecated
- [ ] Update install.sh:
  - [ ] Use new JSON format
  - [ ] Auto-migrate on install
- [ ] Update CI/CD:
  - [ ] Validate JSON configs
  - [ ] Fail on markdown agents (optional)

**Deliverables**:
- ✅ Deprecation warnings
- ✅ Updated registry
- ✅ Updated installer
- ✅ CI/CD validation

---

## 📋 Implementation Checklist

### Week 1: Infrastructure
- [ ] Create `packages/core/src/types/agent.ts`
- [ ] Create `packages/core/src/schemas/agent-v2.json`
- [ ] Create `packages/core/src/agent/loader.ts`
- [ ] Create `packages/core/src/agent/converters/opencode.ts`
- [ ] Create `packages/core/src/agent/converters/claude.ts`
- [ ] Create `packages/core/src/agent/converters/cursor.ts`
- [ ] Create `packages/core/src/agent/converters/windsurf.ts`
- [ ] Create `packages/core/src/agent/converters/registry.ts`
- [ ] Write unit tests
- [ ] Validate with sample configs

### Week 2: CLI Commands
- [ ] Create `packages/core/src/cli/convert.ts`
- [ ] Create `packages/core/src/cli/validate.ts`
- [ ] Create `packages/core/src/cli/apply.ts`
- [ ] Create `packages/core/src/cli/info.ts`
- [ ] Add to main CLI entry point
- [ ] Write help text
- [ ] Add examples
- [ ] Test all commands

### Week 3: Migration
- [ ] Create `scripts/migrate-agents.ts`
- [ ] Migrate OpenAgent
- [ ] Migrate OpenCoder
- [ ] Migrate all subagents
- [ ] Generate manifest.json
- [ ] Validate all configs
- [ ] Test conversions

### Week 4: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write e2e tests
- [ ] Performance testing
- [ ] Compatibility testing
- [ ] Fix any issues

### Week 5: Documentation
- [ ] Write user guide
- [ ] Write dev guide
- [ ] Write migration guide
- [ ] Create examples
- [ ] Update README
- [ ] Update CHANGELOG

### Week 6: Deprecation
- [ ] Add warnings
- [ ] Update registry
- [ ] Update installer
- [ ] Update CI/CD
- [ ] Final testing
- [ ] Release v2.0.0

---

## 🎯 Success Criteria

### Must Have
- ✅ All agents converted to JSON config
- ✅ All CLI commands working
- ✅ OpenCode, Claude, Cursor converters working
- ✅ Schema validation working
- ✅ Migration script working
- ✅ Documentation complete
- ✅ Tests passing (>90% coverage)

### Nice to Have
- ✅ Windsurf converter
- ✅ Auto-migration on install
- ✅ IDE detection
- ✅ Interactive agent creation wizard
- ✅ Web-based config editor

### Future Enhancements
- 🔮 Remote agent registry
- 🔮 Agent marketplace
- 🔮 Visual agent builder
- 🔮 Agent versioning system
- 🔮 Agent templates library

---

## 📊 Comparison: Before vs After

### Before (Markdown)

```markdown
---
id: openagent
name: OpenAgent
type: orchestrator
---

# OpenAgent

You are OpenAgent...

## Tools
- bash (approve)
- write (approve)
- edit (approve)

## Skills
- task-management

## Context
- .opencode/context/core/standards/code-quality.md
```

**Problems**:
- ❌ Hard to parse
- ❌ No validation
- ❌ No type safety
- ❌ Hard to query
- ❌ Manual conversion

### After (JSON + Markdown)

**agent.json**:
```json
{
  "id": "openagent",
  "name": "OpenAgent",
  "mode": "primary",
  "prompt": { "file": "./prompt.md" },
  "permissions": {
    "bash": "approve",
    "write": "approve",
    "edit": "approve"
  },
  "tools": {
    "bash": true,
    "write": true,
    "edit": true
  },
  "skills": ["task-management"],
  "context": ["@core/standards/code-quality"]
}
```

**prompt.md**:
```markdown
You are OpenAgent...
```

**Benefits**:
- ✅ Easy to parse
- ✅ Schema validated
- ✅ Type safe
- ✅ Easy to query
- ✅ Auto-convert to any IDE

---

## 🚀 Next Steps

1. **Review this plan** - Get team approval
2. **Set up branch** - `feature/json-config-system`
3. **Start Phase 1** - Build infrastructure
4. **Weekly reviews** - Track progress
5. **Launch v2.0.0** - After 6 weeks

---

**Status**: Ready for implementation  
**Estimated Timeline**: 6 weeks  
**Risk Level**: Low (backward compatible during migration)  
**Impact**: High (foundation for all future features)

---

**Last Updated**: 2026-02-15  
**Next Review**: After Phase 1 completion
