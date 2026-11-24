# New Agent Creation System

> **Note:** In the OAC repository itself, author agents in `agent-library/agents/` (see `agent-library/README.md`); the steps below describe a user project.

**Research-backed agent creation following Anthropic 2025 best practices**

## Overview

This command system helps you create production-ready OpenCode agents with:
- ✅ **Minimal prompts** (~500 tokens at "right altitude")
- ✅ **Single agent + tools** (not multi-agent for coding)
- ✅ **Just-in-time context** (loaded on demand, not pre-loaded)
- ✅ **Clear tool definitions** (purpose, when to use, when not to use)
- ✅ **Comprehensive testing** (8 essential test types)

## Quick Start

### Create a New Agent

```bash
# Interactive agent creation
/create-agent my-agent-name

# Or specify in prompt
"Create a new agent called 'python-dev' for Python development"
```

### Generate Test Suite

```bash
# Generate 8 comprehensive tests for existing agent
/create-tests my-agent-name
```

## Research-Backed Principles

### 1. Single Agent + Tools > Multi-Agent for Coding

**Finding**: "Most coding tasks involve fewer truly parallelizable tasks than research" (Anthropic 2025)

**Why this matters**:
- Code changes are deeply dependent on each other
- Sub-agents can't coordinate edits to the same file
- Agents waste time duplicating work
- Multi-agent excels at research (90.2% improvement) because searches are independent
- Code is sequential

**Application**:
- Use ONE lead agent with tool-based sub-functions
- NOT autonomous sub-agents for coding
- Multi-agent only for truly independent tasks:
  - Static analysis (no coordination needed)
  - Test execution
  - Code search/retrieval
- NOT for: refactoring, architecture decisions, multi-file changes

### 2. Right Altitude: Minimal Prompts

**Finding**: "Find the smallest possible set of high-signal tokens that maximize likelihood of desired outcome"

**The Balance**:
| Too Vague | Right Altitude ✅ | Too Rigid |
|-----------|------------------|-----------|
| "Write good code" | Clear heuristics + examples | 50-line prompt with edge cases |
| Fails to guide behavior | Flexible but specific | Brittle, hard to maintain |

**Application**:
- System prompt: Minimal (~500 tokens)
- Clear heuristics, not exhaustive rules
- Examples > edge case lists
- Show ONE canonical example, not 20 scenarios

### 3. Just-in-Time Context Loading

**Finding**: "Agents discover context layer by layer. File metadata guides behavior. Prevents drowning in irrelevant information"

**Context Management Layers**:
1. **System prompt**: Minimal (~500 tokens). Clear heuristics, not exhaustive rules.
2. **Just-in-time retrieval**: Tools that agents call to load context on demand (file paths, not full content)
3. **Working memory**: Keep only what's needed for the current task

**Why this beats pre-loading**:
- Agents discover context layer by layer
- File metadata (size, name, timestamps) guide behavior
- Prevents "drowning in irrelevant information"

### 4. CLAUDE.md Pattern

**Finding**: Anthropic's Claude Code uses this in production

**Create a project context file** automatically loaded into every session:

```markdown
# Project Context

## Bash Commands
- npm run test: Run unit tests
- npm run lint: Check code style
- npm run typecheck: Check TypeScript

## Code Style
- Use ES modules (import/export)
- Destructure imports when possible
- Use async/await, not callbacks

## Common Files & Patterns
- API handlers in src/handlers/
- Business logic in src/logic/
- Tests mirror source structure

## Workflow Rules
- Always run typecheck before committing
- Don't modify test files when writing implementation
- Use git history to understand WHY, not WHAT
```

**Benefits**:
- Eliminates repetitive context-loading
- Shared across team (check into git)
- Tuned like any prompt (run through prompt improvers)

### 5. Tool Clarity

**Finding**: "Tool ambiguity is one of the biggest failure modes"

**Bad tool design**:
```markdown
tool: "search_code"
description: "search code"  # Ambiguous!
```

**Good tool design**:
```markdown
tool: "read_file"
purpose: "Load a specific file for analysis or modification"
when_to_use: "You need to examine or edit a file"
when_not_to_use: "You already have the file content in context"
```

**Key principle**: If a human engineer can't definitively say which tool to use, neither can the agent.

### 6. Extended Thinking for Decomposition

**Finding**: "Improved instruction-following and reasoning efficiency for complex decomposition"

**Before jumping to code, trigger extended thinking**:
```
"Think about how to approach this problem. What files need to change? 
What are the dependencies? What should we test?"
```

**Phrases mapped to thinking budget**:
- "think" = basic
- "think hard" = 2x budget
- "think harder" = 3x budget
- "ultrathink" = maximum

### 7. Parallel Tool Calling

**Finding**: "Parallel tool calling cut research time by up to 90% for complex queries"

**Design workflows where agent can call multiple tools simultaneously**:

**Can do in parallel**:
- Run linter
- Execute tests
- Check type errors

**NOT in parallel** (sequential):
- Apply fix, then test

### 8. Outcome-Focused Evaluation

**Finding**: "Token usage explains 80% of performance variance. Number of tool calls ~10%. Model choice ~10%"

**What to measure**:
- ✅ Does it solve the task?
- ✅ Token usage reasonable?
- ✅ Tool calls appropriate?
- ❌ NOT: "Did it follow exact steps I imagined?"

**Application**:
- Optimize for using enough tokens to solve the problem
- Don't minimize tool calls (some redundancy is fine)
- Evaluate on real failure cases, not synthetic tests

## Agent Structure

### Minimal System Prompt Template (~500 tokens)

```markdown
---
description: "{one-line purpose}"
mode: primary
temperature: 0.1-0.7
tools:
  read: true
  write: true
  edit: true
  bash: true
  glob: true
  grep: true
---

# {Agent Name}

<role>
{Clear, concise role - what this agent does}
</role>

<approach>
1. {First step - usually read/understand}
2. {Second step - usually think/plan}
3. {Third step - usually implement/execute}
4. {Fourth step - usually verify/test}
5. {Fifth step - usually complete/handoff}
</approach>

<heuristics>
- {Key heuristic 1 - how to approach problems}
- {Key heuristic 2 - when to use tools}
- {Key heuristic 3 - how to verify work}
- {Key heuristic 4 - when to stop/report}
</heuristics>

<output>
Always include:
- What you did
- Why you did it that way
- {Domain-specific output requirement}
</output>

<examples>
  <example name="{Canonical Use Case}">
    **User**: "{typical request}"
    
    **Agent**:
    1. {Step 1 with tool usage}
    2. {Step 2 with reasoning}
    3. {Step 3 with output}
    
    **Result**: {Expected outcome}
  </example>
</examples>
```

## Test Suite (8 Essential Tests)

Every agent gets 8 comprehensive tests:

1. **Planning & Approval** - Verify plan-first approach
2. **Context Loading** - Ensure just-in-time context retrieval
3. **Incremental Implementation** - Verify step-by-step execution
4. **Tool Usage** - Check correct tool selection and usage
5. **Error Handling** - Verify stop-on-failure behavior
6. **Extended Thinking** - Check decomposition before coding
7. **Compaction** - Verify summarization for long sessions
8. **Completion** - Check proper output and handoff

## What NOT to Do

Based on failure modes found in production:

**Don't**:
- ❌ Create sub-agents for dependent tasks (code is sequential)
- ❌ Pre-load entire codebase into context (use just-in-time retrieval)
- ❌ Write exhaustive edge case lists in prompts (brittle, hard to maintain)
- ❌ Give vague tool descriptions (major failure mode)
- ❌ Use multi-agent if you could use single agent + tools
- ❌ Hardcode complex logic in prompts (use tools instead)
- ❌ Minimize tool calls (some redundancy is fine)

**Do**:
- ✅ Let agents discover context via tools
- ✅ Use examples instead of rules
- ✅ Keep system prompt minimal (~500 tokens)
- ✅ Be explicit about effort budgets ("3-5 tool calls, not 50")
- ✅ Evaluate on real failure cases, not synthetic tests
- ✅ Measure outcomes: Does it solve the task?

## Files Created

When you create a new agent, the system generates:

```
.opencode/agent/{agent-name}.md
  └─ Minimal system prompt (~500 tokens)

.opencode/context/project/{agent-name}-context.md
  └─ Project context (CLAUDE.md pattern)

evals/agents/{agent-name}/
  ├─ config/
  │   └─ config.yaml
  └─ tests/
      ├─ planning/
      │   └─ planning-approval-001.yaml
      ├─ context-loading/
      │   └─ context-before-code-001.yaml
      ├─ implementation/
      │   ├─ incremental-001.yaml
      │   ├─ tool-usage-001.yaml
      │   └─ extended-thinking-001.yaml
      ├─ error-handling/
      │   └─ stop-on-failure-001.yaml
      ├─ long-horizon/
      │   └─ compaction-001.yaml
      └─ completion/
          └─ handoff-001.yaml

built-ai-configs/registry/registry.json (updated)
```

## Usage Examples

### Example 1: Create Python Development Agent

```bash
User: "Create a new agent for Python development with testing and linting"

System creates:
- Agent: python-dev
- System prompt: ~500 tokens
- Tools: read, write, edit, bash, glob, grep
- Context file: Python-specific commands and patterns
- 8 comprehensive tests
```

### Example 2: Create API Testing Agent

```bash
User: "Create an agent for API endpoint testing"

System creates:
- Agent: api-tester
- System prompt: ~500 tokens
- Tools: read, bash, glob, grep (no write/edit)
- Context file: API testing patterns and commands
- 8 comprehensive tests
```

## Running Tests

```bash
# Run all tests for an agent
cd evals/framework
npm test -- --agent=my-agent-name

# Run specific category
npm test -- --agent=my-agent-name --category=planning

# Run single test
npm test -- --agent=my-agent-name --test=planning-approval-001
```

## Iteration and Improvement

1. **Test with real use cases** (not just synthetic tests)
2. **Measure outcomes**: Does it solve the task?
3. **Iterate based on actual failures** (not imagined edge cases)
4. **Update status** to "stable" when proven in production

## Research References

- **Anthropic Multi-Agent Research** (Sept-Dec 2025)
  - Single agent + tools > multi-agent for coding
  - Token usage explains 80% of performance variance
  
- **Context Engineering Best Practices** (Sept 2025)
  - "Find the smallest possible set of high-signal tokens"
  - Just-in-time retrieval beats pre-loading
  
- **Claude Code Production Patterns**
  - CLAUDE.md pattern for project context
  - Extended thinking for complex decomposition
  - Compaction for long-horizon tasks

## Support

For questions or issues:
1. Check existing agents: 
   - Core agents: `.opencode/agent/openagent.md`, `.opencode/agent/opencoder.md` (OpenCode v1 nests these under `agent/core/`)
   - Development agents: `.opencode/agent/frontend-specialist.md` (v1: `agent/dev/`)
   - Content agents: `.opencode/agent/copywriter.md` (v1: `agent/content/`)
2. Review test examples: `evals/agents/openagent/tests/`
3. See research docs: `docs/agents/research-backed-prompt-design.md`
