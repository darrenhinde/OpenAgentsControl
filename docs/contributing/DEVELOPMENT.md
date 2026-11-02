# Development Guide

**Complete guide for developing on the OpenAgents Control repository**

This guide covers everything you need to know to develop agents, commands, tools, and contribute to the OpenAgents Control ecosystem.

## Table of Contents

- [Getting Started](#getting-started)
- [Repository Structure](#repository-structure)
- [Development Workflow](#development-workflow)
- [Creating New Agents](#creating-new-agents)
- [Testing](#testing)
- [Best Practices](#best-practices)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **OpenCode CLI** installed ([installation guide](https://opencode.ai/docs))
- **Node.js** 20+, **pnpm** and **Bun** (compiler, CLI and `make` targets)
- **Git** for version control
- **Bash** (macOS/Linux) or **Git Bash** (Windows)

### Clone and Setup

```bash
git clone https://github.com/darrenhinde/OpenAgentsControl.git
cd OpenAgentsControl
pnpm install --frozen-lockfile     # compiler and CLI workspaces

# eval framework (only if you work on evals)
cd evals/framework && npm install && cd ../..
```

### Verify Setup

```bash
make check-core                    # builds, drift gate, compiler + CLI tests, typecheck, installer tests
bun run validate:registry          # registry paths and dependencies
```

---

## Repository Structure

```
agent-library/                 # SOURCE of every agent (edit here)
├── agents/<category>/*.md     #   one file per agent; `oac:` block + OpenCode frontmatter
└── profiles/{system,context}/ #   install tiers and context sets
packages/
├── agent-compiler/            # build library: src/{core,adapters,hosts,verify}
└── cli/                       # the `oac` CLI
built-ai-configs/              # GENERATED output per tool (opencode, opencode-v1, claude-code, registry)
                               #   except opencode-v1/{tool,plugin,plugins,skills,command}: hand-maintained
.opencode/                     # this repo's own OpenCode config
├── agent/                     #   GENERATED mirror of built-ai-configs/opencode/agent
├── command/ context/ skills/ prompts/   hand-written
plugins/claude-code/           # Claude Code plugin: agents/ is a GENERATED mirror; skills, commands, hooks are hand-written
.oac/build-manifest.json       # GENERATED ledger of every built file
evals/                         # eval frameworks and suites
scripts/                       # registry, validation, installer tests, prompts (see scripts/README.md)
docs/                          # documentation (start at docs/README.md)
install.sh, update.sh          # shell installer and updater
```

### Key Directories Explained

#### `agent-library/agents/` (the source) and `.opencode/agent/` (generated)
Agents are the "brains" of the system. **Edit them in `agent-library/agents/<category>/`.**
`oac build` (`make build-canonical`) compiles them into `built-ai-configs/<tool>/` and mirrors
`built-ai-configs/opencode/agent/` to `.opencode/agent/` and `built-ai-configs/claude-code/agents/` to
`plugins/claude-code/agents/`. CI fails on a hand edit of any of those. See
[agent-library/README.md](../../agent-library/README.md) and [CORE.md](../architecture/CORE.md).
Source categories: `core/` (openagent, opencoder), `meta/`, `content/`, `data/`, and `subagents/<group>/`
(code, core, development, planning, system-builder, test, utils).

#### `.opencode/command/`
Slash commands that users can invoke:
- **openagents/new-agents/** - ⭐ **NEW**: Agent creation system with research-backed principles
- **prompt-engineering/** - Prompt optimization tools

#### `.opencode/context/`
Context files that agents load on-demand:
- **core/** - Standards, patterns, workflows
- **project/** - Project-specific context (CLAUDE.md pattern)

#### `.opencode/prompts/`
Prompt library with model-specific variants (category-based structure):
- Allows experimentation without breaking main branch
- Each variant has test results documented
- Organized by category matching agent structure (core/, development/, etc.)

#### `evals/`
Comprehensive testing framework:
- **agents/** - Test suites for each agent (8 essential tests)
- **framework/** - Testing infrastructure
- **results/** - Test results and reports

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/my-new-feature
```

### 2. Make Your Changes

Follow the appropriate guide:
- [Creating New Agents](#creating-new-agents)
- [Adding Commands](#adding-commands)
- [Adding Tools](#adding-tools)
- [Writing Tests](#writing-tests)

### 3. Test Your Changes

```bash
make build-canonical               # if you touched agent-library/
make check-core

# eval tests
cd evals/framework
npm test -- --agent=your-agent

# Test manually (v2 addresses agents by oac.id)
opencode --agent your-agent
```

### 4. Commit and Push

Commit the source and the regenerated files together.

```bash
git add -A
git commit -m "feat: add new feature"
git push origin feature/my-new-feature
```

### 5. Create Pull Request

- Use conventional commit format in PR title
- Fill out PR template completely
- Ensure CI passes

---

## Creating New Agents

### ⭐ NEW: Research-Backed Agent Creation System

We now have a streamlined system for creating agents following **Anthropic 2025 research best practices**.

#### Quick Start

Write the agent by hand in `agent-library/` (next section). The `/create-agent` command under
`.opencode/command/openagents/new-agents/` can draft the prompt, but it writes to `.opencode/agent/`,
which is generated and overwritten by the next build: move what it produces into `agent-library/agents/`
and add the `oac:` block.

#### Research-Backed Principles

The agent creation system follows these proven patterns:

##### 1. Single Agent + Tools > Multi-Agent for Coding

**Why**: Code changes are deeply dependent. Sub-agents can't coordinate edits to the same file.

**Application**:
- Use ONE lead agent with tool-based sub-functions
- NOT autonomous sub-agents for coding
- Multi-agent only for truly independent tasks (static analysis, test execution, code search)

##### 2. Minimal Prompts at "Right Altitude" (~500 tokens)

**Why**: "Find the smallest possible set of high-signal tokens that maximize likelihood of desired outcome"

**The Balance**:
| Too Vague | Right Altitude ✅ | Too Rigid |
|-----------|------------------|-----------|
| "Write good code" | Clear heuristics + examples | 50-line prompt with edge cases |

**Application**:
- Clear heuristics, not exhaustive rules
- Examples > edge case lists
- Show ONE canonical example, not 20 scenarios

##### 3. Just-in-Time Context Loading

**Why**: Prevents "drowning in irrelevant information"

**Application**:
- Tools load context on demand (not pre-loaded)
- CLAUDE.md pattern for project context
- File metadata guides behavior

##### 4. Tool Clarity

**Why**: "Tool ambiguity is one of the biggest failure modes"

**Application**:
```markdown
<tool name="read_file">
  <purpose>Load specific file for analysis or modification</purpose>
  <when_to_use>You need to examine or edit a file</when_to_use>
  <when_not_to_use>You already have the file content in context</when_not_to_use>
</tool>
```

##### 5. Extended Thinking for Complex Tasks

**Why**: Improved instruction-following and reasoning efficiency

**Application**:
- Trigger thinking before complex tasks
- "Think hard about how to approach this problem..."
- Phrases mapped to thinking budget (think, think hard, think harder)

##### 6. Compaction for Long Sessions

**Why**: Maintain context efficiency over long-horizon tasks

**Application**:
- Agent writes notes to persistent memory
- Summarizes when context fills
- Preserves: architectural decisions, unresolved bugs, implementation details
- Discards: redundant tool outputs

##### 7. Parallel Tool Calling

**Why**: "Parallel tool calling cut research time by up to 90%"

**Application**:
- Can do in parallel: Run linter, execute tests, check type errors
- NOT in parallel: Apply fix, then test (sequential)

##### 8. Outcome-Focused Evaluation

**Why**: "Token usage explains 80% of performance variance"

**Measure**:
- ✅ Does it solve the task?
- ✅ Token usage reasonable?
- ✅ Tool calls appropriate?
- ❌ NOT: "Did it follow exact steps I imagined?"

#### Manual Agent Creation

If you prefer manual creation, follow this structure:

**1. Create the agent file** in `agent-library/agents/<category>/my-agent.md`, then `make build-canonical`.

Frontmatter is OpenCode's (`description`, `mode`, `temperature`, `permission`) plus an `oac:` block
(`id`, `name`, `category`, `type`, and `overrides.claude-code.tools` for Claude Code). Every field and
the common build errors are in [agent-library/README.md](../../agent-library/README.md).

```markdown
---
name: MyAgent
description: "Brief one-line description"
mode: primary
temperature: 0.1
permission:
  bash:
    "rm -rf *": "ask"
    "sudo *": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
oac:
  id: my-agent
  name: MyAgent
  category: development
  type: agent
  overrides:
    claude-code:
      tools: [Read, Write, Edit, Glob, Grep, Bash]
---

# My Agent

<role>Clear, concise role - what this agent does</role>

<approach>
1. Read and understand the context
2. Think about the approach before acting
3. Implement changes incrementally
4. Verify each step with appropriate tools
5. Complete with clear summary
</approach>

<heuristics>
- Decompose problems before implementing
- Use tools intentionally (not speculatively)
- Verify outputs before claiming completion
- Stop on errors and report (don't auto-fix blindly)
</heuristics>

<output>
Always include: what you did, why, and test/validation results.
</output>
```

**2. Create Context File** (`.opencode/context/project/my-agent-context.md`)

```markdown
# My Agent Context

## Key Commands
- command 1: what it does
- command 2: what it does

## File Structure
- path pattern: what goes here

## Code Style
- style rule 1
- style rule 2

## Workflow Rules
- workflow rule 1
- workflow rule 2

## Before Committing
1. check 1
2. check 2
```

**3. Create Test Suite**

Use the test generator:
```bash
/create-tests my-agent
```

Or manually create 8 tests in `evals/agents/my-agent/tests/`:
1. `planning/planning-approval-001.yaml`
2. `context-loading/context-before-code-001.yaml`
3. `implementation/incremental-001.yaml`
4. `implementation/tool-usage-001.yaml`
5. `error-handling/stop-on-failure-001.yaml`
6. `implementation/extended-thinking-001.yaml`
7. `long-horizon/compaction-001.yaml`
8. `completion/handoff-001.yaml`

**4. Register the agent**

Nothing to do: `oac build` adds the agent to `built-ai-configs/registry/registry.json` and
`registry.v1.json`. To have an install tier ship it, add its `id` to `agents` in
`agent-library/profiles/system/<tier>.json`. Do not run `scripts/registry/register-component.sh`
for agents; it only touches the generated registry's date.

#### Templates

Pre-built templates (they predate the canonical layout: add the `oac:` block and place the file in `agent-library/`) are in:
```
.opencode/command/openagents/new-agents/templates/
├── agent-template.md              # Minimal agent template
├── context-template.md            # CLAUDE.md pattern
├── test-config-template.yaml      # Test configuration
└── test-*.yaml                    # 8 test templates
```

---

## Adding Commands

Commands are slash commands users can invoke.

### Structure

```markdown
---
description: "What this command does"
---

# Command Name

<target_argument> $ARGUMENTS </target_argument>

<role>
What this command specializes in
</role>

<task>
Specific objective of this command
</task>

<workflow>
  <step_1>
    Action and process
  </step_1>
  
  <step_2>
    Action and process
  </step_2>
</workflow>
```

### Example

See `.opencode/command/openagents/new-agents/create-agent.md` for a complete example.

---

## Adding Tools

Tools are TypeScript utilities that agents can use.

### Structure

```typescript
/**
 * Tool Name
 * 
 * Brief description of what this tool does
 */

export function myTool(param: string): string {
  // Implementation
  return result;
}
```

### Location

Tools only load on OpenCode v1 (v2 does not scan them). They are hand-maintained in `built-ai-configs/opencode-v1/tool/`; the build neither writes nor checks them.

---

## Testing

### Test Framework

We use a comprehensive evaluation framework in `evals/framework/`.

### Running Tests

```bash
# Run all tests
cd evals/framework
npm test

# Run tests for specific agent
npm test -- --agent=openagent

# Run specific category
npm test -- --agent=openagent --category=planning

# Run single test
npm test -- --agent=openagent --test=planning-approval-001

# Verbose output
npm test -- --verbose
```

### Writing Tests

Each agent should have 8 essential test types:

1. **Planning & Approval** - Verify plan-first approach
2. **Context Loading** - Ensure just-in-time context retrieval
3. **Incremental Implementation** - Verify step-by-step execution
4. **Tool Usage** - Check correct tool selection
5. **Error Handling** - Verify stop-on-failure behavior
6. **Extended Thinking** - Check decomposition before coding
7. **Compaction** - Verify long session handling
8. **Completion** - Check proper output and handoff

### Test Structure

```yaml
id: test-id-001
name: Test Name
description: |
  What this test verifies

category: planning
agent: my-agent
model: anthropic/claude-sonnet-4-5

prompt: |
  Test prompt

behavior:
  mustContain:
    - "expected text"
  mustNotContain:
    - "forbidden text"
  mustUseAnyOf: [[tool1], [tool2]]
  minToolCalls: 1

expectedViolations:
  - rule: rule-name
    shouldViolate: false
    severity: error

approvalStrategy:
  type: auto-approve

timeout: 30000

tags:
  - tag1
  - tag2
```

### Test Templates

Use the templates in `.opencode/command/openagents/new-agents/templates/` as starting points.

---

## Best Practices

### Agent Design

✅ **Do**:
- Keep system prompts minimal (~500 tokens)
- Use clear heuristics, not exhaustive rules
- Provide ONE canonical example
- Define tools with clear purpose and when to use/not use
- Load context on-demand (just-in-time)
- Measure outcomes: Does it solve the task?

❌ **Don't**:
- Create sub-agents for dependent tasks (code is sequential)
- Pre-load entire codebase into context
- Write exhaustive edge case lists in prompts
- Give vague tool descriptions
- Use multi-agent if you could use single agent + tools
- Minimize tool calls (some redundancy is fine)

### Code Style

#### Markdown
- Use clear, concise language
- Include examples
- Add code blocks with syntax highlighting
- Use proper heading hierarchy

#### TypeScript
- Follow existing code style
- Add JSDoc comments
- Use TypeScript types (no `any`)
- Export functions explicitly

#### Bash Scripts
- Use `set -e` for error handling
- Add comments for complex logic
- Use meaningful variable names
- Include help text

### File Naming

- **kebab-case** for file names: `my-new-agent.md`
- **PascalCase** for TypeScript types/interfaces
- **camelCase** for variables and functions

---

## Common Tasks

### Update an Existing Agent

```bash
# 1. Edit the canonical agent file, then rebuild built-ai-configs/ and its mirrors
vim agent-library/agents/<category>/my-agent.md
make build-canonical

# 2. Test changes
cd evals/framework
npm test -- --agent=my-agent

# 3. Update tests if needed
vim evals/agents/my-agent/tests/...

# 4. Commit
git add .
git commit -m "feat: improve my-agent behavior"
```

### Add a New Test

```bash
# 1. Create test file
vim evals/agents/my-agent/tests/new-category/new-test-001.yaml

# 2. Update config
vim evals/agents/my-agent/config/config.yaml
# Add new category to testPaths

# 3. Run test
cd evals/framework
npm test -- --agent=my-agent --test=new-test-001
```

### Create a Prompt Variant

```bash
# 1. Copy template
cp .opencode/prompts/core/openagent/TEMPLATE.md .opencode/prompts/core/openagent/my-variant.md

# 2. Edit variant
vim .opencode/prompts/core/openagent/my-variant.md

# 3. Test variant
./scripts/prompts/test-prompt.sh --agent=openagent --variant=my-variant

# 4. Update README with results
vim .opencode/prompts/core/openagent/README.md
```

### Validate Before PR

```bash
# Build, drift gate, tests
make check-core

# Validate component structure
./scripts/registry/validate-component.sh

# Ensure using default prompts
./scripts/prompts/validate-pr.sh

# Run all tests
cd evals/framework
npm test

# Validate registry
bun run validate:registry
```

---

## Troubleshooting

### Tests Failing

**Problem**: Tests fail after making changes

**Solution**:
1. Check test output for specific failures
2. Run with `--verbose` flag for details
3. Verify agent follows expected behavior
4. Update tests if behavior intentionally changed

### Registry Validation Fails

**Problem**: `bun run validate:registry` fails

**Solution**:
1. Check `built-ai-configs/registry/registry.json` syntax (never hand-edit the agent and subagent entries: rebuild with `make build-canonical`)
2. Ensure all referenced files exist
3. Verify frontmatter in agent files is valid YAML
4. Run `./scripts/registry/validate-component.sh` for details

### Agent Not Loading Context

**Problem**: Agent doesn't load context files

**Solution**:
1. Verify context file exists in `.opencode/context/`
2. Check agent has `read` tool enabled
3. Ensure context file path is correct
4. Test with simple prompt that requires context

### Tool Not Working

**Problem**: Custom tool not accessible to agent

**Solution**:
1. Verify the tool is in `built-ai-configs/opencode-v1/tool/` and you are on OpenCode v1
2. Check tool is exported properly
3. Ensure agent has tool enabled in frontmatter
4. Reinstall for v1: `oac update --opencode v1`

---

## Additional Resources

### Documentation
- [Contributing Guide](CONTRIBUTING.md) - General contribution guidelines
- [Agent Creation System](../../.opencode/command/openagents/new-agents/README.md) - Detailed agent creation guide
- [Research-Backed Prompt Design](../agents/research-backed-prompt-design.md) - Prompt engineering principles
- [Test Design Guide](../../evals/framework/docs/test-design-guide.md) - Writing effective tests

### Examples
- [OpenAgent](../../agent-library/agents/core/openagent.md) - Universal orchestrator example
- [OpenCoder](../../agent-library/agents/core/opencoder.md) - Development specialist example
- [Subagents](../../agent-library/agents/subagents/) - Specialized subagent examples
- [Test Suites](../../evals/agents/) - Comprehensive test examples

### Tools
- [Agent Creation Command](../../.opencode/command/openagents/new-agents/create-agent.md)
- [Test Generator Command](../../.opencode/command/openagents/new-agents/create-tests.md)
- [Prompt Optimizer](../../.opencode/command/prompt-engineering/prompt-enhancer.md)

---

## Questions?

- **Issues**: Open an issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Email security issues privately

---

**Happy developing! 🚀**
