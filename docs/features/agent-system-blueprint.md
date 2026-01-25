# The OpenCode Agent System Blueprint

_Build Intelligent Workflow Systems with Context-Aware AI_

---

## 📘 What Is This Blueprint?

**This is a teaching document** that explains how the OpenCode agent system works and how to extend it for your needs.

**You don't need to read this to use the system** - the agents work out of the box. Read this document only if you want to:
- Understand the architecture behind the system
- Create your own custom agents and commands
- Extend the system with domain-specific patterns
- Learn how context loading and agent coordination works

**If you just want to start building**, skip this document and use `openagent` instead. See the [README.md](../../README.md) for quick start instructions.

---

## ⚡ TL;DR - Quick Reference

**For New Users:**
- Start with `opencode --agent OpenAgent` for all questions and tasks
- The agent handles planning, implementation, testing, and review automatically
- Add your coding patterns to `.opencode/context/project/project-context.md`
- Let the agent delegate to specialized subagents when needed

**For Advanced Users Building Custom Agents:**
- Use `/prompt-enchancer` to create complex agents with workflows
- Read this document to understand architecture patterns
- Learn how context loading works (the `@` symbol)
- Extend the system with domain-specific context files

**Core Concept:**
```
Commands load context → Agents execute with that context → Subagents handle specialized tasks
```

**When to read this document:**
- ✅ You want to create custom agents or commands
- ✅ You need to understand how context loading works
- ✅ You want to extend the system for your specific needs
- ❌ You just want to start building (use `openagent` instead)

---

## 🎯 What This Document Teaches

This blueprint explains the architecture patterns behind the OpenCode agent system. You'll learn:

- How context loading works (the `@` symbol)
- How agents, commands, and context files work together
- How to create custom agents and commands
- How to extend the system for your needs

> **📖 Installation & Usage:** See [README.md](../../README.md) in the repository root.

---

## Understanding Examples in This Document

**When you see commands like `/workflow`, `/plan-task`, `/create-frontend-component`:**
- These are pattern examples showing how you COULD structure commands
- Most aren't implemented in the repository
- The existing `openagent` and `opencoder` already handle these workflows
- Create them only if you have specific repeated patterns

**When you see extensive context hierarchies:**
- The repository includes `core/` and `project/` context files
- Add domain-specific files (`frontend/`, `backend/`, `database/`) as needed
- Start simple, expand based on your needs

**When you see task management structures:**
- The `task-manager` agent creates `tasks/` directories automatically
- `openagent` creates session files in `.tmp/sessions/` for context preservation
- No need to pre-create structures

---

## The Golden Rule

**Context flows in one direction: Commands load context immediately, Agents can look up additional context deterministically.**

Think of it like a well-organized library: the librarian (command) brings you the right books immediately, but you (agent) can look up specific references when needed.

---

## How @ Symbol Context Loading Works

### The Magic of Automatic Context Injection

When you create a slash command with `@` references, OpenCode automatically loads that context into the agent's memory BEFORE the agent starts thinking.

**Example command structure:**
- Command file references context files using `@.opencode/context/...`
- OpenCode reads those files automatically
- Context is injected into the agent's working memory
- Agent receives: user request + all loaded context + instructions
- Agent can immediately use patterns without looking them up

### Why This Is Powerful

**Without @ loading:**
- Agent doesn't know your patterns
- Has to search or use generic patterns
- Inconsistent results, slower execution

**With @ loading:**
- Agent has your patterns loaded immediately
- Follows your exact standards
- Consistent, fast, high-quality results

### Best Practices for Context Loading

1. **Load 2-4 context files maximum** - Prevent cognitive overload
2. **Always include core patterns** - Essential patterns every agent needs
3. **Load domain-specific patterns** - Based on what the command does
4. **Keep context files focused** - 50-150 lines each
5. **Use conditional loading** - Load different context based on request analysis

### Why This Architecture Matters

- **It's the foundation** of how agents get consistent context
- **It determines command design** - You must anticipate what context agents need
- **It explains the architecture** - Commands are "smart loaders", agents are "focused executors"
- **It guides best practices** - Load the right context, not too much, not too little

---

## Core Principles

### 1. Single-Level Context Loading

OpenCode processes `@` references only in command templates, NOT recursively in file contents.

- ✅ Works: `@` references in command files
- ❌ Doesn't work: `@` references inside context files (treated as plain text)

**Implication:** Commands must load ALL necessary context upfront. Agents can look up additional files using tools (read, grep, glob), but cannot use `@` loading themselves.

### 2. Deterministic vs Non-Deterministic Behavior

- **Commands**: Non-deterministic - Analyze requests and load appropriate context
- **Agents**: Deterministic - Predictable behavior, can look up additional context

### 3. Context Optimization

- **Maximum 4 context files per command** - 250-450 lines total
- **50-150 lines per context file** - Optimal range
- **Always load core patterns** - Plus request-specific context

---

## The System Components

### 1. Commands (.opencode/command/)

**What they do:** Entry points that load context based on request analysis

**Examples:**
- `/commit` - Smart git commits
- `/optimize` - Code optimization
- `/test` - Testing workflows
- `/prompt-enchancer` - Improve prompts and create complex agents

**How they work:**
- User types a command
- Command analyzes the request
- Loads appropriate context files using `@`
- Passes everything to an agent
- Agent executes with full context

### 2. Agents (.opencode/agent/)

**What they do:** AI workers with specific capabilities and predictable behavior

**Main agents in this repo:**
- `openagent` - Universal coordinator for general tasks, questions, and workflows (recommended default)
- `opencoder` - Specialized development agent for complex coding and architecture
- `system-builder` - Meta-level generator for creating custom AI architectures

**Subagents (specialized helpers):**

Core Coordination:
- `task-manager` - Task breakdown and planning
- `documentation` - Documentation authoring

Code Specialists:
- `coder-agent` - Quick implementations
- `reviewer` - Code review and security
- `tester` - Test creation and validation
- `build-agent` - Type checking and validation
- `codebase-pattern-analyst` - Pattern discovery

Utilities:
- `image-specialist` - Image generation (Gemini AI)

System Builder (Meta-Level):
- `domain-analyzer` - Domain analysis
- `agent-generator` - Agent generation
- `context-organizer` - Context organization
- `workflow-designer` - Workflow design
- `command-creator` - Command creation

**Agent structure:**
- Frontmatter with metadata (description, mode, tools, permissions)
- Clear instructions for behavior
- Specific rules and constraints
- Structured response formats

### 3. Context (.opencode/context/)

**What it is:** Layered knowledge system with your coding patterns

**Structure:**
- `core/` - Essential patterns (always loaded)
- `project/` - Your project-specific patterns
- Add more as needed: `frontend/`, `backend/`, `database/`, etc.

**How it works:**
- Context files contain your coding standards
- Commands load relevant context using `@`
- Agents follow those patterns automatically
- Single-level loading (no recursive references)

**Best practices:**
- Keep files focused (50-150 lines)
- Use clear pattern names
- Include when to use each pattern
- Add rules and constraints

### 4. Task Management (tasks/)

**What it is:** File-based progress tracking with checkboxes

**Structure:**
- `features/` - Feature development
- `fixes/` - Bug fixes
- `improvements/` - Code improvements
- `single/` - Simple tasks

**How it works:**
- `task-manager` creates task files automatically
- Each task has a plan with checkboxes
- Agents update progress as they work
- Quality gates ensure standards are met

### 5. Workflow Orchestration

**How agents coordinate:**
- Simple tasks (< 30 min) - Direct execution
- Medium tasks (30min-2hrs) - Task planning with tracking
- Complex tasks (> 2hrs) - Multi-phase with quality gates

**Quality gates:**
- Build validation (TypeScript, linting)
- Code review (security, quality)
- Testing (automated tests)
- Post-flight review (compliance check)

---

## System Flow

**Simple workflow:**
1. User makes request
2. Agent analyzes and plans
3. User approves
4. Agent implements step-by-step
5. Validation runs automatically
6. Complete

**Complex workflow:**
1. User makes request
2. Agent delegates to `@task-manager`
3. Task manager creates detailed plan
4. Agent implements one step at a time
5. Progress tracked in task files
6. Quality gates at milestones
7. Subagents handle specialized work
8. Post-flight review
9. Complete

---

## Context Loading Strategy

### Dynamic Context Loading

Commands can load different context based on request analysis:

- Analyze the user's request
- Determine domain (frontend, backend, database, etc.)
- Load base context (core patterns)
- Load domain-specific context conditionally
- Pass everything to agent

### Context Size Guidelines

- ✅ **Optimal**: 50-150 lines (focused, actionable)
- ⚠️ **Acceptable**: 150-250 lines (comprehensive but manageable)
- ❌ **Too Large**: 250+ lines (split into focused files)

### Context Loading Rules

1. Always load core patterns
2. Maximum 4 context files per command
3. Load based on request analysis (dynamic, not static)
4. Use bash commands for conditional loading

---

## Building Your Own Agents

### Use /prompt-enchancer

**If you're building custom agents with complex workflows, use the `/prompt-enchancer` command:**

- Helps you create well-structured agent prompts
- Guides you through best practices
- Ensures proper formatting and instructions
- Creates agents that work well with the system

**How to use it:**
```
/prompt-enchancer "I want to create an agent that does X"
```

The command will help you:
- Structure your agent properly
- Add appropriate context loading
- Define clear instructions
- Set up permissions and tools
- Create workflow patterns

### Agent Design Best Practices

1. **Make agents deterministic** - Predictable behavior
2. **Give clear, direct instructions** - Not documentation
3. **Separate concerns** - One agent, one responsibility
4. **Use structured response formats** - Consistent output
5. **Define permissions** - Control what agents can do
6. **Specify tools** - Only give access to what's needed

### When to Create Custom Agents

Create custom agents when:
- You have repeated workflows
- You need specialized behavior
- You want domain-specific expertise
- You have unique quality requirements

Don't create custom agents when:
- `openagent` or `opencoder` already handles it
- It's a one-time task
- You're just starting out

---

## Extending the System

### Adding Domain-Specific Context

1. Create context directory for your domain
2. Add pattern files (50-150 lines each)
3. Reference in commands using `@`
4. Agents automatically use your patterns

**Example domains:**
- Frontend (React, Vue, etc.)
- Backend (APIs, servers)
- Database (queries, schemas)
- Testing (unit, integration)
- Security (auth, validation)

### Creating Custom Commands

1. Identify repeated workflows
2. Determine what context is needed
3. Create command file with `@` references
4. Specify target agent
5. Add clear instructions
6. Test and refine

**Use `/prompt-enchancer` to help create complex commands.**

### Building Specialized Subagents

1. Identify specialized capability needed
2. Define clear scope and responsibility
3. Set appropriate permissions
4. Create focused instructions
5. Test with main agents

---

## Best Practices

### Context Management

- Keep context files focused (50-150 lines)
- Use single-level loading (no recursive `@` references)
- Load dynamically based on request analysis
- Always include core patterns

### Agent Design

- Make agents deterministic (predictable behavior)
- Give clear, direct instructions (not documentation)
- Separate concerns (one agent, one responsibility)
- Use structured response formats
- **Use `/prompt-enchancer` for complex agents**

### Task Management

- Break complex work into steps (15-30 minutes each)
- Use checkbox tracking for progress visibility
- Include validation criteria for each step
- Implement quality gates at key milestones

### Workflow Orchestration

- Analyze before routing (complexity and domain)
- Use appropriate workflows (simple vs complex)
- Coordinate multiple agents for complex tasks
- Validate at every step (build, test, review)

---

## The Simple Path (Recommended)

**Don't create specialized commands/agents right away. Instead:**

1. **Start with `openagent`** for everything (questions and tasks)
2. **Add context files** for your tech stack as needed
3. **Use `@task-manager`** when features get complex (openagent delegates automatically)
4. **Let subagents** handle specialized work (@tester, @reviewer, @coder-agent)
5. **Create specialized commands** only when you have repeated workflows
6. **Use `/prompt-enchancer`** when building custom agents

### Example Progression

**Week 1:** Use `openagent` for everything (questions and tasks)
**Week 2:** Add project-specific context to `project/project-context.md`
**Week 3:** Agent automatically picks up your patterns
**Week 4:** Create a command if you have repeated workflows (use `/prompt-enchancer`)

### How the System Improves

The system improves naturally as you:

1. Add context files - Capture your coding patterns
2. Refine agent prompts - Improve instructions based on results
3. Create project-specific commands - Automate repeated workflows
4. Build subagents - Extract specialized capabilities
5. Document in context/ - Every pattern you discover

**The key principle:** Start simple, extend only when you have a clear need.

---

## Project Structure

```
.opencode/
├── agent/              # AI agents
│   ├── core/
│   │   ├── openagent.md
│   │   └── opencoder.md
│   ├── meta/
│   │   └── system-builder.md
│   └── subagents/      # Specialized helpers
│       ├── reviewer.md
│       ├── tester.md
│       ├── coder-agent.md
│       ├── documentation.md
│       ├── build-agent.md
│       └── codebase-pattern-analyst.md
├── command/            # Slash commands
│   ├── commit.md
│   ├── optimize.md
│   ├── test.md
│   ├── clean.md
│   ├── context.md
│   ├── prompt-enchancer.md  # Use this to build agents!
│   └── worktrees.md
├── context/            # Coding patterns
│   ├── core/           # Essential patterns (always loaded)
│   │   └── essential-patterns.md
│   └── project/        # Your patterns (add here!)
│       └── project-context.md
├── plugin/             # Optional: Telegram notifications
└── tool/               # Optional: Gemini AI image tools
```

---

## Key Takeaways

1. **Context flows one direction** - Commands load immediately, Agents look up deterministically
2. **Keep context focused** - 50-150 lines per file, maximum 4 files per command
3. **Make agents predictable** - Deterministic behavior with clear instructions
4. **Track everything** - File-based task management with checkbox progress
5. **Validate continuously** - Quality gates and post-flight reviews
6. **Start simple** - Build core system first, add complexity gradually
7. **Use `/prompt-enchancer`** - When building custom agents with workflows

---

## Remember

_Think of this system like a professional development team: each member has a specific role, they communicate clearly, they track their work systematically, and they validate quality at every step._

_The `openagent` is your universal coordinator and `opencoder` is your senior developer. Add specialists only when needed._

_When you need to build custom agents, use `/prompt-enchancer` to create well-structured, complex agents with proper workflows._
