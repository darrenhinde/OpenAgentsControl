# Category-Based Agent System

**Version**: 2.0.0  
**Status**: Active  
**Last Updated**: 2025-12-09

---

## 🎯 Overview

The category-based agent system organizes agents into logical categories, making it easier to discover, contribute, and maintain domain-specific agents.

### Key Concepts

**Three-Tier Hierarchy**:
1. **Core Agents** - Primary agents users interact with (orchestrator, coder)
2. **Category Agents** - Domain-specific specialists (frontend, copywriter, etc.)
3. **Subagents** - Delegated specialists called by core/category agents (tester, reviewer, etc.)

---

## 📁 Directory Structure

```
.opencode/agent/
├── core/                    # Core Agents (System-level)
│   ├── openagent.md         # Universal coordinator
│   └── opencoder.md         # Development specialist
│
├── meta/                    # Meta-level Agents
│   └── system-builder.md    # System architect
│
├── development/             # Development Specialists
│   ├── frontend-specialist.md
│   ├── backend-specialist.md
│   ├── devops-specialist.md
│   └── codebase-agent.md
│
├── content/                 # Content Creation
│   ├── copywriter.md
│   └── technical-writer.md
│
├── data/                    # Data & Analysis
│   └── data-analyst.md
│
├── product/                 # Product & Strategy
│   └── (empty - ready for contributions)
│
├── learning/                # Education & Coaching
│   └── (empty - ready for contributions)
│
└── subagents/              # Delegated Specialists
    ├── code/               # Code-related
    ├── core/               # Core workflow
    ├── system-builder/     # System generation
    └── utils/              # Utilities
```

---

## 🔧 Using Category Agents

### Installation

```bash
# Install all development agents
./install.sh developer

# Install specific profile
./install.sh full
```

### Running Tests

```bash
cd evals/framework

# Test core agent
npm run eval:sdk -- --agent=core/openagent

# Test category agent
npm run eval:sdk -- --agent=development/frontend-specialist

# Test subagent
npm run eval:sdk -- --agent=TestEngineer
```

### Agent Invocation

**Core Agents** - Direct invocation:
```bash
opencode --agent core/openagent
opencode --agent core/opencoder
```

**Category Agents** - Direct invocation:
```bash
opencode --agent development/frontend-specialist
opencode --agent content/copywriter
```

**Subagents** - Via task delegation:
```javascript
// From core or category agent
task(
  subagent_type="TestEngineer",
  description="Write tests",
  prompt="Create comprehensive tests for the authentication module"
)
```

---

## 📊 Categories

### Core (`core/`)

**Purpose**: Essential system-level agents for daily development work

**Agents**:
- `core/openagent` - Universal task coordinator
- `core/opencoder` - Development specialist

**When to use**: Primary agents for general tasks and development

---

### Meta (`meta/`)

**Purpose**: Meta-level agents for system generation and architecture design

**Agents**:
- `meta/system-builder` - System architect and generator

**When to use**: Building custom AI systems and agent architectures

---

### Development (`development/`)

**Purpose**: Software development specialists

**Agents**:
- `development/frontend-specialist` - React, Vue, modern CSS
- `development/backend-specialist` - APIs, databases, server-side
- `development/devops-specialist` - CI/CD, infrastructure
- `development/codebase-agent` - Multi-language implementation

**When to use**: Domain-specific development tasks

---

### Content (`content/`)

**Purpose**: Writing and content creation

**Agents**:
- `content/copywriter` - Marketing copy, brand messaging
- `content/technical-writer` - Documentation, API docs

**When to use**: Content creation and documentation

---

### Data (`data/`)

**Purpose**: Data analysis and research

**Agents**:
- `data/data-analyst` - Data analysis, visualization, insights

**When to use**: Data-driven tasks

---

### Product (`product/`)

**Purpose**: Product management and strategy

**Status**: Ready for contributions

**Potential Agents**:
- Product manager
- User researcher
- Business analyst

---

### Learning (`learning/`)

**Purpose**: Education and coaching

**Status**: Ready for contributions

**Potential Agents**:
- Tutor
- CBT coach
- Curriculum designer

---

## 🆚 Core vs Category vs Subagents

### Core Agents

**Characteristics**:
- System-level, maintained by repository
- General-purpose, work across domains
- Primary entry points for users
- Can delegate to category agents or subagents

**Examples**: `core/openagent`, `core/opencoder`

---

### Category Agents

**Characteristics**:
- Domain-specific specialists
- User-facing (can be invoked directly)
- Community-contributed
- Can delegate to subagents

**Examples**: `development/frontend-specialist`, `content/copywriter`

---

### Subagents

**Characteristics**:
- Focused, single-purpose functionality
- NOT directly invoked by users
- Called via task delegation
- Support core and category agents

**Examples**: `TestEngineer`, `TaskManager`

---

## 🔄 Backward Compatibility

### Old Format Still Works

The old flat structure is still supported:

```bash
# Old format (still works)
npm run eval:sdk -- --agent=openagent
npm run eval:sdk -- --agent=opencoder

# New format (recommended)
npm run eval:sdk -- --agent=core/openagent
npm run eval:sdk -- --agent=core/opencoder
```

### Path Resolution

The eval framework automatically resolves old agent names:
- `openagent` → `core/openagent`
- `opencoder` → `core/opencoder`
- `system-builder` → `meta/system-builder`

### Deprecation Timeline

- **v2.0.0** (current): New structure, old paths work with warnings
- **v2.1.0**: Old paths still work, louder warnings
- **v3.0.0**: Remove old paths (breaking change)

---

## 🤝 Contributing Category Agents

See [ADDING_CATEGORY_AGENT.md](../contributing/ADDING_CATEGORY_AGENT.md) for detailed instructions.

### Quick Start

1. **Choose a category** (development, content, data, product, learning)
2. **Create agent file**: `.opencode/agent/{category}/{agent-name}.md`
3. **Add frontmatter** with metadata
4. **Create tests**: `evals/agents/{category}/{agent-name}/`
5. **Submit PR**

### Agent File Template

```markdown
---
id: agent-name
name: Agent Name
description: Brief description
category: development
type: standard
version: 1.0.0
author: your-name

mode: primary
model: anthropic/claude-sonnet-4-5
temperature: 0.1

tools:
  read: true
  write: true
  edit: true
  bash: false
  glob: true
  grep: true
  task: true

dependencies:
  context:
    - development/patterns
  tools: []

tags:
  - development
  - specialist
---

# Agent Name

You are a specialist in...

## Your Role

[Define role and responsibilities]

## Workflow

1. **Analyze** - Understand the request
2. **Plan** - Create implementation plan
3. **Request Approval** - Present plan to user
4. **Implement** - Execute following patterns
5. **Validate** - Test and verify
```

---

## 📚 Related Documentation

- [Migration Guide](../guides/MIGRATION_V2.md) - Migrating from v1.x to v2.0
- [Contributing Guide](../contributing/CONTRIBUTING.md) - General contribution guidelines
- [Adding Category Agents](../contributing/ADDING_CATEGORY_AGENT.md) - Detailed agent creation guide
- [Eval Framework](../../evals/framework/README.md) - Testing agents

---

## 🔍 Examples

### Example 1: Using Frontend Specialist

```bash
# Install
./install.sh developer

# Test
cd evals/framework
npm run eval:sdk -- --agent=development/frontend-specialist

# Use
opencode --agent development/frontend-specialist
```

### Example 2: Creating a New Category Agent

```bash
# Create agent file
vim .opencode/agent/product/product-manager.md

# Create test structure
mkdir -p evals/agents/product/product-manager/{config,tests}

# Create smoke test
vim evals/agents/product/product-manager/tests/smoke-test.yaml

# Validate
./scripts/registry/validate-agent-structure.sh

# Test
cd evals/framework
npm run eval:sdk -- --agent=product/product-manager
```

### Example 3: Delegating to Subagent

From a category agent:

```javascript
// Delegate test creation to tester subagent
task(
  subagent_type="TestEngineer",
  description="Create tests",
  prompt="Write comprehensive unit tests for the UserService class"
)
```

---

## ❓ FAQ

### Q: Can I still use the old agent names?

**A**: Yes! Old names like `openagent` and `opencoder` still work and will continue to work until v3.0.0.

### Q: How do I know which category to use?

**A**: Choose based on the agent's primary domain:
- Code-related → `development/`
- Writing-related → `content/`
- Data-related → `data/`
- Product-related → `product/`
- Teaching-related → `learning/`

### Q: Can an agent be in multiple categories?

**A**: No, each agent belongs to one category. If an agent spans multiple domains, choose the primary domain or create a more general agent in `core/`.

### Q: What's the difference between a category agent and a subagent?

**A**: 
- **Category agents** are user-facing and can be invoked directly
- **Subagents** are internal and only called via task delegation

### Q: How do I test my category agent?

**A**: Create a test suite in `evals/agents/{category}/{agent-name}/` and run:
```bash
cd evals/framework
npm run eval:sdk -- --agent={category}/{agent-name}
```

---

## 🎓 Best Practices

1. **Choose the right category** - Place agents in their primary domain
2. **Follow naming conventions** - Use kebab-case for agent IDs
3. **Write comprehensive tests** - At least a smoke test
4. **Document dependencies** - List required context files
5. **Keep agents focused** - One domain, one responsibility
6. **Use subagents** - Delegate complex subtasks

---

## 📊 System Statistics

- **Categories**: 6 (core, development, content, data, product, learning)
- **Core Agents**: 3
- **Category Agents**: 7
- **Subagents**: 13
- **Total Agents**: 23

---

**Last Updated**: 2025-12-09  
**Version**: 2.0.0
