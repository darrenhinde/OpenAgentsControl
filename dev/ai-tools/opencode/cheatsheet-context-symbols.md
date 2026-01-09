# OpenCode Context Reference Cheat Sheet

> **Purpose**: Master reference for defining files, agents, and tools in prompts that work seamlessly with OpenCode's automatic tool resolution.

---

## 🎯 Quick Reference Table

| Type | Syntax | Auto-Loaded? | AI Action Required | When to Use |
|------|--------|--------------|-------------------|-------------|
| **File (Initial)** | `@file.md` | ✅ Yes | ❌ No | User's initial prompt |
| **File (Nested)** | `@file.md` | ❌ No | ✅ Yes (read_file) | Inside loaded files |
| **Directory** | `@src/components/` | ✅ Yes | ❌ No | Folder context |
| **Sub-Agent (Context)** | `@agent-name` | ✅ Yes* | ❌ No | Reference agent info |
| **Sub-Agent (Invoke)** | `task(subagent_type="name")` | ❌ No | ✅ Yes (task tool) | Delegate tasks |
| **Shell Command** | `` !`command` `` | ✅ Yes | ❌ No | Inline command output |
| **Config File** | `instructions: []` in `opencode.json` | ✅ Yes | ❌ No | Always-needed context |
| **Agent (Markdown)** | `.opencode/agent/**/*.md` | ✅ Auto-registered | ❌ No | Define agents |

---


## 🔑 Key Takeaways

1. **@ in agent markdown** = Just informational text
2. **@ in user prompt** = OpenCode processes it (loads files/metadata)
3. **To invoke agents** = Always use `task` tool
4. **Agent names** = Full path from `.opencode/agent/` directory
5. **Don't use @ to list agents** in your prompt - it's confusing!

The `@` symbol only has special meaning in **USER PROMPTS**, not in **AGENT SYSTEM PROMPTS**.

------

## 🔧 Shell Commands

### Inline Shell Commands (Automatic Execution)

Use the `` !`command` `` syntax to execute commands and inline their output into prompts:

```markdown
# Example: Include git information
Current branch: !`git branch --show-current`
Recent commits: !`git log --oneline -5`

# Example: Include system information  
Node version: !`node --version`
Available memory: !`free -h | grep Mem`

# Example: Include file contents
Database schema: !`cat schema.sql`

# Example: Include directory structure
Project structure:
!`tree -L 2 -I 'node_modules|dist'`
```

**How it works:**
- ✅ Commands execute when prompt is processed
- ✅ Output is inserted into the prompt text
- ✅ Great for dynamic context (git status, file lists, system info)
- ⚠️ Commands run in shell with current working directory

### Shell Command Patterns

#### Git Context

```markdown
## Current Work Context

Branch: !`git branch --show-current`
Modified files: !`git status --short`
Last commit: !`git log -1 --pretty=format:'%h - %s'`
Uncommitted changes:
!`git diff --stat`
```

#### Project Structure

```markdown
## Project Layout

!`find src -type f -name '*.ts' | head -20`

## Component Structure  

!`tree src/components -L 2`
```

#### Environment Information

```markdown
## Environment

Node: !`node --version`
npm: !`npm --version`
OS: !`uname -a`
```

#### File Content Snippets

```markdown
## Configuration

Current eslint rules:
!`cat .eslintrc.json`

Package scripts:
!`cat package.json | jq .scripts`
```

### When to Use Shell Commands vs Tools

| Scenario | Use Shell `!` Syntax | Use `run_terminal_cmd` Tool |
|----------|---------------------|---------------------------|
| **Static context in prompt** | ✅ | ❌ |
| **Git information** | ✅ | ❌ |
| **File contents** | ✅ | ❌ |
| **Interactive AI execution** | ❌ | ✅ |
| **Based on AI decisions** | ❌ | ✅ |
| **Build/test commands** | ❌ | ✅ |
| **Requires error handling** | ❌ | ✅ |

---

## 📁 File References

### Initial Prompt (Automatic)
When **you** type this in your prompt:

```markdown
Follow guidelines in @GUIDELINES.md
Use patterns from @src/patterns/
```

**OpenCode automatically:**
- ✅ Reads `GUIDELINES.md`
- ✅ Lists `src/patterns/` directory
- ✅ Attaches content to AI context
- ❌ Does NOT read nested @ references inside these files

### Nested References (Requires AI Action)

When `GUIDELINES.md` contains:

```markdown
Also see @CODE_STYLE.md and @TESTING.md
```

**OpenCode does:**
- ❌ Does NOT automatically read these
- ✅ AI sees them as plain text

**To make AI read them, use explicit instructions:**

```markdown
# GUIDELINES.md

⚠️ **CRITICAL**: Before proceeding, read these files using read_file:

1. @CODE_STYLE.md - Coding standards (READ FIRST)
2. @TESTING.md - Testing patterns (READ FIRST)  
3. @ARCHITECTURE.md - System design (READ FIRST)

[rest of your guidelines...]
```

**Key phrases that work:**
- ✅ `READ FIRST`
- ✅ `use read_file tool`
- ✅ `CRITICAL: Read these files`
- ✅ `Load immediately before proceeding`

---

## 🤖 Sub-Agent References

### ⚠️ CRITICAL: Agent Context vs Agent Invocation

**IMPORTANT DISTINCTION: Agent Files vs Agent Names**

#### Understanding the Difference

**Agent File** (Documentation):
- Path: `.opencode/agents/subagents/core/taskmanager.md`
- This is a MARKDOWN FILE describing the agent
- Use `@.opencode/agents/subagents/core/taskmanager.md` to load file content
- Result: Loads documentation/instructions as text

**Agent Name** (System Registration):
- Name: `taskmanager` (registered in OpenCode)
- This is the actual AGENT that can execute tasks
- Use `task(subagent_type="taskmanager", ...)` to invoke
- Result: Agent runs and performs work

#### Scenario 1: Using `@agent-name` (USUALLY NOT RECOMMENDED)
When you use `@agent-name` in **your initial prompt**:

```markdown
Use @reviewer agent for code review
```

**What happens:**
1. ✅ OpenCode checks if it's a file at that path
2. ❌ File doesn't exist → Checks if it's a registered agent
3. ✅ If agent exists: Attaches agent **metadata** as context (name, description, tools)
4. ❌ Does **NOT invoke/run** the agent
5. ⚠️ This loads agent info but doesn't execute anything

**Result:** AI knows the agent exists but doesn't execute it.

**When to use:** Rarely needed. Only if you want to reference agent capabilities in context.

#### Scenario 2: Agent Invocation (RECOMMENDED)
To actually **run** an agent and execute tasks:

```javascript
// AI must explicitly call the task tool
task(
  subagent_type="CodeReviewer",
  description="Review code",
  prompt="Review the auth implementation for security issues"
)
```

**Result:** Agent **executes** and returns results.

**When to use:** Always - this is how you actually invoke agents.

#### Scenario 3: Loading Agent Documentation Files
If you have agent documentation files:

```markdown
# Initial prompt
Follow guidelines in @.opencode/agents/subagents/core/taskmanager.md
```

**What happens:**
1. ✅ Loads the **file** content as context
2. ❌ Does NOT invoke the agent
3. ✅ Good for loading agent usage instructions

**When to use:** When you want to load documentation about how to use agents.

---

### Best Practice: Clear Agent Instructions

**❌ DON'T write this (confusing - uses @ for agents):**
```markdown
Use @reviewer to review code
Review with @taskmanager agent
```
**Problems:**
- Loads agent metadata, doesn't invoke
- AI might be confused about how to use it
- Mixing file syntax with agent invocation

**✅ DO write this (clear and explicit):**

**Option 1: If you have agent documentation files**
```markdown
# Load agent documentation (file)
@.opencode/agents/subagents/core/taskmanager.md

# Then instruct AI how to invoke (not using @)
**Agent: `taskmanager`**
- Purpose: Task planning and breakdown
- Invoke with: task(subagent_type="taskmanager", description="Plan X", prompt="Break down feature Y")
```

**Option 2: Direct invocation instructions (no @ at all)**
```markdown
**Agent: `reviewer`** - Code review agent
- Purpose: Review code for quality and security
- When: After implementing features
- Invoke with: task(subagent_type="CodeReviewer", description="Review X", prompt="Review Y for Z issues")

**DO NOT use @reviewer** - This loads metadata, not invocation
**ALWAYS use task tool** - This actually runs the agent
```

---

### Listing Sub-Agents

```markdown
# Available Sub-Agents

⚠️ **IMPORTANT**: These agents are NOT loaded as context. You MUST invoke them using the `task` tool:

## Code Agents

**Agent: `tester`** (DO NOT use @tester as context reference)
- **Purpose**: Test generation and execution
- **When to invoke**: After implementing features, before commits
- **Tool call**: 
  ```javascript
  task(
    subagent_type="TestEngineer",
    description="Test auth",
    prompt="Write comprehensive tests for auth module with >80% coverage"
  )
  ```

**Agent: `reviewer`** (DO NOT use @reviewer as context reference)
- **Purpose**: Code review and quality checks  
- **When to invoke**: After completing code changes
- **Tool call**: 
  ```javascript
  task(
    subagent_type="CodeReviewer",
    description="Review changes",
    prompt="Review the authentication implementation for security vulnerabilities, code quality, and best practices"
  )
  ```

## Core Agents

**Agent: `planner`** (DO NOT use @planner as context reference)
- **Purpose**: Project planning and task breakdown
- **When to invoke**: Starting large features or projects
- **Tool call**: 
  ```javascript
  task(
    subagent_type="planner",
    description="Plan feature",
    prompt="Break down the payment system feature into implementable tasks with dependencies"
  )
  ```
```

### Proactive Sub-Agent Invocation

To make the AI **automatically** invoke sub-agents at appropriate times:

```markdown
## Agent Automation Rules

**CRITICAL**: Agents are invoked via `task` tool, NOT by referencing them with @.

**After completing code changes, ALWAYS:**
1. Invoke the `tester` agent using `task` tool to write and run tests
2. Invoke the `reviewer` agent using `task` tool to review code quality
3. Report results back to the user

**Example workflow:**
1. User requests feature
2. You implement the code
3. Automatically call: 
   ```javascript
   task(subagent_type="TestEngineer", description="Test feature", prompt="Write tests for X")
   ```
4. Automatically call: 
   ```javascript
   task(subagent_type="CodeReviewer", description="Review feature", prompt="Review X for quality")
   ```
5. Summarize results for user

**Important**: 
- Sub-agents return results ONLY to you. You must summarize for the user.
- DO NOT use `@agent-name` syntax to invoke agents
- ALWAYS use the `task` tool for agent invocation
```

---

## 🛠️ Tool References

### Built-in OpenCode Tools

```markdown
## Available Tools

**File Operations**
- `read_file` - Read file contents (supports line ranges)
- `write_file` - Create or overwrite files  
- `search_replace` - Edit files with precision
- `list_dir` - List directory contents
- `glob_file_search` - Find files by pattern

**Code Operations**
- `grep` - Search code with ripgrep
- `codebase_search` - Semantic code search

**Execution**
- `run_terminal_cmd` - Execute shell commands
- `task` - Invoke sub-agents

**Planning**
- `todo_write` - Create and manage task lists
```

### When to Reference Tools

```markdown
# Task Instructions

When you need to find configuration files, use `glob_file_search` to locate them.

When analyzing code patterns, use `codebase_search` for semantic understanding.

When editing code, use `search_replace` for precision rather than rewriting entire files.
```

---

## 💡 Complete Example: Index File

Here's a **production-ready index file** that works perfectly with OpenCode:

```markdown
# Project Context Index

## 📋 Quick Start

**CRITICAL INSTRUCTION**: Before proceeding with ANY task:
1. Read the files marked `[READ FIRST]` using the `read_file` tool
2. Review the available sub-agents below
3. Follow the coding standards and patterns defined in these files

---

## 📚 Core Documentation [READ FIRST]

Load these files immediately using `read_file`:

- @docs/CODING_STANDARDS.md - TypeScript/React coding patterns
- @docs/TESTING_STRATEGY.md - Test requirements and patterns
- @docs/ARCHITECTURE.md - System design and component structure
- @.opencode/WORKFLOWS.md - Development workflows and CI/CD

---

## 🤖 Available Sub-Agents

Use the `task` tool to invoke these specialized agents:

### Development Agents

**@subagents/code/implementer** - Complex feature implementation
```javascript
task(
  subagent_type="implementer",
  description="Implement user auth",
  prompt="Create complete authentication system with JWT tokens, including login, logout, and session management. Follow patterns in @docs/ARCHITECTURE.md"
)
```

**@TestEngineer** - Test generation and execution
```javascript
task(
  subagent_type="TestEngineer", 
  description="Test auth system",
  prompt="Write comprehensive unit and integration tests for the authentication module. Ensure >80% coverage. Run tests and report results."
)
```

**@CodeReviewer** - Code quality and security review
```javascript
task(
  subagent_type="CodeReviewer",
  description="Review auth code",
  prompt="Review the authentication implementation for security vulnerabilities, code quality, and adherence to @docs/CODING_STANDARDS.md. Provide specific improvement suggestions."
)
```

### Documentation Agents

**@subagents/docs/technical-writer** - API and code documentation
```javascript
task(
  subagent_type="technical-writer",
  description="Document auth API", 
  prompt="Generate comprehensive API documentation for the authentication endpoints, including request/response examples and error codes."
)
```

### Planning Agents

**@subagents/core/architect** - System design and planning
```javascript
task(
  subagent_type="architect",
  description="Design payment system",
  prompt="Design a payment processing system architecture that integrates with Stripe. Break down into implementable tasks. Consider scalability and error handling."
)
```

---

## 🔄 Automated Workflows

### After Implementing Code

**ALWAYS execute this workflow:**

1. **Test** - Invoke `@TestEngineer` to validate implementation
2. **Review** - Invoke `@CodeReviewer` for quality check
3. **Document** - Update relevant documentation
4. **Report** - Summarize results to user with:
   - What was implemented
   - Test results and coverage
   - Any issues found in review
   - Next recommended steps

### Before Starting Large Features

**ALWAYS execute this workflow:**

1. **Plan** - Invoke `@subagents/core/architect` for design
2. **Load Context** - Read relevant documentation from @docs/
3. **Break Down** - Create detailed TODO list with `todo_write`
4. **Confirm** - Ask user to confirm approach

---

## 📖 Additional Context Files

### Code Patterns & Examples

For specific implementation patterns, read these on-demand:

- @examples/api-patterns.ts - REST API implementation patterns
- @examples/component-patterns.tsx - React component patterns
- @examples/test-patterns.test.ts - Testing patterns and fixtures
- @examples/error-handling.ts - Error handling strategies

### Configuration Files

Reference these when setting up tools or CI/CD:

- @.github/workflows/ - GitHub Actions workflows
- @tsconfig.json - TypeScript configuration
- @package.json - Project dependencies and scripts

---

## 🎯 Tool Usage Guidelines

### File Search Strategy

1. **Known filename**: Use `read_file` directly
2. **Pattern match**: Use `glob_file_search` (e.g., "*.test.ts")
3. **Semantic search**: Use `codebase_search` (e.g., "authentication logic")
4. **Text search**: Use `grep` for exact text matches

### Editing Strategy

1. **Small changes**: Use `search_replace` for precision
2. **New files**: Use `write_file`
3. **Large refactors**: Consider sub-agent with `task` tool

### Execution Strategy

1. **Simple commands**: Use `run_terminal_cmd`
2. **Complex workflows**: Create shell scripts first
3. **Multi-step tasks**: Use sub-agents with `task` tool

---

## ⚠️ Common Pitfalls to Avoid

### ❌ DON'T DO THIS:

```markdown
# Bad: Using @ syntax for agent invocation
Use @tester when needed
Review with @reviewer after coding

# Bad: Treating agents like files
Read @tester for testing guidelines
See @reviewer documentation

# Bad: Vague agent reference
Use the tester agent when needed

# Bad: Assuming nested files are auto-loaded
See @guidelines.md (which references @other.md)

# Bad: Not specifying how to invoke
Available agents: tester, reviewer, planner

# Bad: Mixing context and invocation
Use @agent-name to run the agent
```

### ✅ DO THIS:

```markdown
# Good: Explicit tool call for agent invocation
**Agent: `tester`** - Invoke ONLY via task tool:
task(subagent_type="TestEngineer", description="Test feature", prompt="Write comprehensive tests for X")

# Good: Clear separation of concerns
**File**: @docs/testing-guide.md - Load with read_file
**Agent**: `tester` - Invoke with task tool

# Good: Explicit read instruction for nested refs
**CRITICAL**: Read @guidelines.md, then read all files it references using read_file

# Good: Clear tool invocation
Use the `codebase_search` tool to find authentication logic

# Good: Proactive invocation instruction
After implementing code, ALWAYS invoke the tester agent:
task(subagent_type="TestEngineer", description="Test X", prompt="Write and run tests for X")
```

---

## 🚀 Quick Start Template

Copy this template to create your own index:

```markdown
# [Project Name] Context Index

## 🎯 Before Starting ANY Task

**CRITICAL**: Load these files first using `read_file`:
1. @[PATH_TO_GUIDELINES]
2. @[PATH_TO_STANDARDS]
3. @[PATH_TO_ARCHITECTURE]

---

## 🤖 Sub-Agents (MUST use `task` tool to invoke)

**Agent: `[AGENT_NAME]`** (DO NOT use @[AGENT_NAME] as context)
- Purpose: [Description]
- When to invoke: [When to invoke]
- Tool call: 
  ```javascript
  task(
    subagent_type="[AGENT_NAME]",
    description="[SHORT_DESC]",
    prompt="[DETAILED_TASK_INSTRUCTIONS]"
  )
  ```

---

## 🔄 Standard Workflows

### After Code Changes
1. Invoke tester agent via `task` tool
2. Invoke reviewer agent via `task` tool  
3. Report results to user

Example:
```javascript
// Step 1: Test
task(subagent_type="[TESTER_AGENT]", description="Test feature", prompt="Write tests for X")

// Step 2: Review
task(subagent_type="[REVIEWER_AGENT]", description="Review feature", prompt="Review X for quality")

// Step 3: Summarize results for user
```

---

## 📚 Reference Files (Load on-demand)

- @[FILE_PATH] - [Description] (Read when: [TRIGGER])

---
```

---

## 🔍 Verification Checklist

Before sharing your index file, verify:

- [ ] All **file** references use `@` prefix
- [ ] Agent references use `task` tool, NOT `@` syntax
- [ ] Agent names are plain text (e.g., `tester`), not `@tester`
- [ ] Nested file references have explicit "READ FIRST" instructions
- [ ] Sub-agents have complete `task()` tool call examples
- [ ] Sub-agents show when/why to invoke them
- [ ] Clear distinction between files (@file.md) and agents (task tool)
- [ ] Automated workflows use `task` tool for agents
- [ ] Tool usage instructions are specific
- [ ] No ambiguous or vague instructions
- [ ] No mixing of @ syntax for agents

---

## 📝 Quick Reference Notes

- **Files**: Use `@path/to/file.md` in prompts (auto-loaded initially, nested require read_file)
- **Agent Files**: Use `@.opencode/agents/subagents/core/agent.md` to load documentation
- **Agent Invocation**: Use `task` tool, NOT `@agent-name` syntax
- **Agent Names**: Plain text only (e.g., `taskmanager`), never `@taskmanager`
- **Shell**: Use `` !`command` `` for automatic execution in prompts
- **Key Rule**: `@` is for FILES only, `task` tool is for AGENTS
- **Rare Exception**: `@agent-name` loads agent metadata (usually not needed)

---

## 🎨 Advanced Patterns

### Combining Multiple Context Types

```markdown
# Complete Feature Context

## Files to Read [READ FIRST]
@docs/auth-spec.md
@src/auth/types.ts

## Current Implementation
!`find src/auth -type f -name '*.ts'`

## Git Context
Branch: !`git branch --show-current`
Changes: !`git diff --name-only`

## Environment
Node: !`node --version`
Dependencies: !`npm list --depth=0 | grep auth`

## Sub-Agents Available

**@subagents/code/implementer** - Use for implementation
**@TestEngineer** - Use for testing

## Task
Implement the authentication flow following @docs/auth-spec.md
```

### Dynamic File Loading

```markdown
# Load All Test Files

Test files in project:
!`find . -name "*.test.ts" -o -name "*.spec.ts"`

**INSTRUCTION**: Read all test files above using `read_file` to understand testing patterns.
```

### Conditional Context

```markdown
# Database Migration Context

## Current Migration Status
!`npm run db:status 2>&1`

## Latest Migration
!`ls -t migrations/ | head -1 | xargs cat`

**If migrations are pending**: Read @docs/migration-guide.md
**If migrations are up-to-date**: Proceed with schema changes
```

### Nested Shell Commands with File References

```markdown
# Component Analysis

## All React Components
!`find src -name "*.tsx" | grep -v test`

## Component Guidelines
@docs/component-patterns.md

**CRITICAL**: 
1. Review the component list above
2. Read @docs/component-patterns.md using `read_file`
3. Ensure new components follow established patterns
```

---

## 🔗 Shell Command Cheat Sheet

### Git Commands

```bash
# Current branch
!`git branch --show-current`

# Recent commits
!`git log --oneline -n 10`

# Modified files
!`git status --short`

# Diff summary
!`git diff --stat`

# Authors
!`git shortlog -sn --all`

# Current commit hash
!`git rev-parse HEAD`
```

### File System Commands

```bash
# List TypeScript files
!`find src -name "*.ts" -type f`

# Count lines of code
!`find src -name "*.ts" | xargs wc -l | tail -1`

# Recent files
!`ls -lt src | head -10`

# Directory tree
!`tree -L 3 -I 'node_modules|dist|.git'`

# File size summary
!`du -sh src/*`
```

### Project Info Commands

```bash
# Package version
!`cat package.json | jq -r .version`

# Dependencies
!`npm list --depth=0`

# Scripts
!`cat package.json | jq .scripts`

# Node version
!`node --version`

# npm version
!`npm --version`
```

### Search Commands

```bash
# Find TODO comments
!`grep -r "TODO" src --include="*.ts"`

# Find FIXME comments
!`grep -r "FIXME" src --include="*.ts"`

# Find specific function
!`grep -rn "function authenticate" src`

# Count test files
!`find . -name "*.test.ts" | wc -l`
```

### System Commands

```bash
# OS info
!`uname -a`

# Memory usage
!`free -h`

# Disk usage
!`df -h .`

# Process list (filtered)
!`ps aux | grep node`
```

---

## 🎯 Complete Real-World Example

```markdown
# Feature Implementation: User Authentication

## Pre-Flight Context Loading

### CRITICAL: Read These Files First
1. @docs/CODING_STANDARDS.md
2. @docs/AUTH_ARCHITECTURE.md  
3. @src/auth/interfaces.ts
4. @tests/auth/auth.test.ts

### Current State

**Branch**: !`git branch --show-current`

**Modified Files**:
!`git status --short`

**Existing Auth Files**:
!`find src/auth -name "*.ts" -type f`

**Test Coverage**:
!`npm run test:coverage -- src/auth 2>&1 | tail -5`

### Dependencies

**Current Auth Libraries**:
!`npm list | grep -E "(passport|jwt|bcrypt)"`

**Node Version**: !`node --version`

## Sub-Agents Available

**@subagents/code/implementer** - Feature implementation
- Use when: Implementing new auth flows
- Example: `task(subagent_type="implementer", description="OAuth flow", prompt="Implement OAuth2 flow with Google, following patterns in @docs/AUTH_ARCHITECTURE.md")`

**@TestEngineer** - Test creation
- Use when: After implementing auth features  
- Example: `task(subagent_type="TestEngineer", description="Test OAuth", prompt="Write integration tests for OAuth2 flow with >90% coverage")`

**@subagents/security/auditor** - Security review
- Use when: Before deploying auth changes
- Example: `task(subagent_type="auditor", description="Audit auth", prompt="Review auth implementation for security vulnerabilities, SQL injection, XSS, and CSRF")`

## Implementation Workflow

### Step 1: Context Loading
1. Read all files marked [READ FIRST]
2. Review current implementation: !`cat src/auth/auth.service.ts`
3. Review existing tests: !`cat tests/auth/auth.test.ts`

### Step 2: Implementation
1. Implement feature following @docs/CODING_STANDARDS.md
2. Follow patterns from @src/auth/interfaces.ts
3. Update types in @src/auth/types.ts

### Step 3: Testing
1. Invoke tester agent via `task` tool for test creation
   ```javascript
   task(subagent_type="TestEngineer", description="Test auth", prompt="Write tests for auth module")
   ```
2. Run tests: Use `run_terminal_cmd` for `npm test`
3. Verify coverage meets requirements

### Step 4: Review
1. Invoke security auditor agent via `task` tool
   ```javascript
   task(subagent_type="auditor", description="Security audit", prompt="Review auth for vulnerabilities")
   ```
2. Address any issues found
3. Re-run tests after fixes

### Step 5: Documentation
1. Update @docs/AUTH_ARCHITECTURE.md with changes
2. Add inline code documentation
3. Update API documentation

## Reference Files (Load on-demand)

- @docs/api/auth-endpoints.md - API documentation
- @examples/auth-examples.ts - Usage examples
- @config/auth.config.ts - Configuration options

## Additional Context

**Database Schema**:
!`cat migrations/latest_auth_schema.sql`

**Environment Variables**:
!`cat .env.example | grep AUTH`

---

**REMEMBER**: 
- Files: Use `@filename` (nested require read_file)
- Agents: Use `task` tool, NOT `@agent-name`
- Shell: `` !`cmd` `` executes automatically in prompt
- Agent names are plain text (e.g., `tester`), never `@tester`
```

---

## 📝 Notes

- **Auto-loaded**: Initial `@` references in YOUR prompt (files only)
- **Requires tool call**: Nested `@` references in loaded files
- **Agent as context**: `@agent-name` in initial prompt attaches agent info (not invocation)
- **Agent invocation**: Always requires `task` tool call - NEVER use `@` syntax
- **Shell commands**: `` !`command` `` syntax executes automatically in prompt processing
- **Tool commands**: `run_terminal_cmd` for AI-driven execution during conversation
- **Key distinction**: Files use `@`, Agents use `task` tool

---

## 🎯 Quick Decision Tree

**Need to load a file?**
- Initial prompt → Use `@path/to/file.md`
- Nested reference → Add "READ FIRST" instruction for AI to use `read_file`
- Agent docs → Use `@.opencode/agents/subagents/core/agent.md` (file path)

**Need to invoke an agent?**
- ❌ **NEVER** use `@agent-name` syntax for invocation
- ✅ AI must call `task(subagent_type="name", ...)`
- ✅ Use plain agent names (e.g., `taskmanager`, not `@taskmanager`)
- ✅ Add clear invocation instructions in your context
- ⚠️ Using `@agent-name` only loads metadata (rarely useful)

**Need to run a command?**
- Static context → Use `` !`command` `` in prompt
- AI-driven execution → AI uses `run_terminal_cmd` tool

**Structure Example:**
```
Files (use @):          Agents (use task):
@docs/guide.md          task(subagent_type="CodeReviewer", ...)
@src/types.ts           task(subagent_type="TestEngineer", ...)
@.opencode/agents/      [agent name without @]
  taskmanager.md        
```

---

---

## 🎯 THE PERFECT PROMPT TEMPLATE

Use this template to avoid ALL confusion and work seamlessly with OpenCode:

### Template Structure

```markdown
# [Task Name]

## 📋 Context Files (Load with read_file tool)

**CRITICAL**: Read these files FIRST using the `read_file` tool:
1. @docs/coding-standards.md
2. @docs/architecture.md
3. @src/types/core.ts

---

## 📚 Additional Documentation (Auto-loaded)

Current git status:
Branch: !`git branch --show-current`
Recent changes: !`git status --short`

Project structure:
!`find src -type d -maxdepth 2`

---

## 🤖 Available Agents (Invoke via task tool ONLY)

**IMPORTANT**: DO NOT use @ syntax for agents. Use the `task` tool to invoke.

### Agent: `implementer`
**Purpose**: Complex feature implementation
**When to invoke**: When implementing new features or major refactors
**How to invoke**:
```javascript
task(
  subagent_type="implementer",
  description="Implement feature X",
  prompt="Create complete implementation of X following @docs/architecture.md patterns. Include error handling and validation."
)
```

### Agent: `tester`
**Purpose**: Test creation and execution
**When to invoke**: After implementing features, before committing
**How to invoke**:
```javascript
task(
  subagent_type="TestEngineer",
  description="Test feature X",
  prompt="Write comprehensive tests for X with >80% coverage. Run tests and report results."
)
```

### Agent: `reviewer`
**Purpose**: Code review and quality checks
**When to invoke**: After code changes, before finalizing
**How to invoke**:
```javascript
task(
  subagent_type="CodeReviewer",
  description="Review feature X",
  prompt="Review the implementation of X for code quality, security vulnerabilities, and adherence to @docs/coding-standards.md"
)
```

---

## 🔄 Required Workflow

**After implementing ANY code:**
1. Invoke `tester` agent using task tool
2. Invoke `reviewer` agent using task tool
3. Summarize results to user

---

## 🎯 Your Task

[Describe the specific task here]

---

## ⚠️ Important Reminders

- Files: Use `@path/to/file.md` syntax
- Agent invocation: Use `task(subagent_type="name", ...)` 
- NEVER use `@agent-name` to invoke agents
- Agent names are plain text: `tester`, `reviewer`, NOT `@tester`
```

---

### Real-World Example: Perfect Prompt

```markdown
# Implement User Authentication System

## 📋 Context Files (Load FIRST)

**CRITICAL**: Use `read_file` tool to load these before starting:
1. @docs/CODING_STANDARDS.md - TypeScript coding patterns
2. @docs/AUTH_ARCHITECTURE.md - Authentication design patterns
3. @src/auth/types.ts - Existing auth type definitions
4. @tests/auth/auth.test.ts - Existing test patterns

---

## 📚 Current State (Auto-loaded)

**Git Context**:
Branch: !`git branch --show-current`
Modified: !`git status --short`

**Existing Auth Files**:
!`find src/auth -name "*.ts" -type f`

**Dependencies**:
!`npm list | grep -E "(jwt|bcrypt|passport)"`

---

## 🤖 Available Agents

### Agent: `implementer`
Purpose: Feature implementation
Invoke with:
```javascript
task(
  subagent_type="implementer",
  description="Implement auth flow",
  prompt="Create authentication system with JWT tokens, including login, logout, and session management. Follow patterns in @docs/AUTH_ARCHITECTURE.md. Include middleware, controllers, and services."
)
```

### Agent: `tester`
Purpose: Test creation
Invoke with:
```javascript
task(
  subagent_type="TestEngineer",
  description="Test auth system",
  prompt="Write unit and integration tests for authentication module. Cover login, logout, token refresh, and session management. Ensure >85% coverage. Run tests and report results."
)
```

### Agent: `reviewer`
Purpose: Security and quality review
Invoke with:
```javascript
task(
  subagent_type="CodeReviewer",
  description="Review auth implementation",
  prompt="Review authentication implementation for security vulnerabilities (SQL injection, XSS, CSRF), proper token handling, password security, and adherence to @docs/CODING_STANDARDS.md"
)
```

---

## 🔄 Required Workflow

**You MUST follow this workflow:**

1. **Read Context**: Load all files marked [CRITICAL] above
2. **Implement**: Create the authentication system
3. **Test**: Invoke `tester` agent via task tool
4. **Review**: Invoke `reviewer` agent via task tool
5. **Report**: Summarize implementation, test results, and review findings

---

## 🎯 Task Details

Implement a complete authentication system with:
- JWT-based authentication
- Login/logout endpoints
- Token refresh mechanism
- Session management
- Password hashing with bcrypt
- Middleware for protected routes

Requirements:
- Follow patterns in @docs/AUTH_ARCHITECTURE.md
- Adhere to @docs/CODING_STANDARDS.md
- Integrate with existing user model in @src/models/user.ts
- Add proper error handling
- Include request validation

---

## ⚠️ Important Rules

- Load files with @ syntax: `@docs/file.md`
- Invoke agents with task tool: `task(subagent_type="name", ...)`
- NEVER use `@agent-name` to invoke agents
- Agent names are plain text: `tester`, NOT `@tester`
- Shell commands auto-execute: !`git status`
```

---

## 📝 Anti-Pattern Examples (What NOT To Do)

### ❌ BAD PROMPT (Confusing)
```markdown
Use @tester and @reviewer agents to test the code.
Follow @guidelines and implement authentication.
```

**Problems:**
- Uses `@` for agents (only loads metadata, doesn't invoke)
- No clear invocation instructions
- Mixing file and agent syntax
- No explicit workflow

### ✅ GOOD PROMPT (Clear)
```markdown
# Implement Authentication

## Context Files
**Read these using read_file tool:**
- @docs/guidelines.md

## Agents
**Agent: `tester`** - Invoke with task tool:
task(subagent_type="TestEngineer", description="Test auth", prompt="...")

**Agent: `reviewer`** - Invoke with task tool:
task(subagent_type="CodeReviewer", description="Review auth", prompt="...")

## Workflow
1. Read @docs/guidelines.md
2. Implement feature
3. Invoke tester agent via task tool
4. Invoke reviewer agent via task tool
```

---

## 🎨 Prompt Templates by Use Case

### Template 1: Simple Feature Implementation
```markdown
# Implement [Feature Name]

## Context
Read: @docs/standards.md

Git status: !`git status --short`

## Task
[Detailed description]

## No Agents Needed
(Simple task, no agents required)
```

### Template 2: Complex Feature with Agents
```markdown
# Implement [Complex Feature]

## Context Files (Read FIRST)
1. @docs/standards.md
2. @docs/architecture.md

## Current State
!`git status --short`
!`find src/[module] -name "*.ts"`

## Available Agents

**Agent: `implementer`**
Invoke: task(subagent_type="implementer", description="...", prompt="...")

**Agent: `tester`**
Invoke: task(subagent_type="TestEngineer", description="...", prompt="...")

## Workflow
1. Read context files
2. Implement feature
3. Invoke tester agent
4. Report results
```

### Template 3: Code Review Task
```markdown
# Review [Feature/Module]

## Context
Files to review:
!`git diff --name-only main...HEAD`

Recent changes:
!`git log --oneline -5`

## Agent

**Agent: `reviewer`**
Invoke immediately:
task(
  subagent_type="CodeReviewer",
  description="Review recent changes",
  prompt="Review all changes in current branch for code quality, security, and adherence to standards"
)

## Task
Run code review and report findings.
```

### Template 4: Documentation Task
```markdown
# Document [Feature]

## Context
Implementation files:
!`find src/[module] -name "*.ts"`

## Agent

**Agent: `documenter`**
Invoke: task(subagent_type="documenter", description="Document X", prompt="...")

## Task
Generate comprehensive documentation for [feature].
```

---

## 🔑 Golden Rules for Perfect Prompts

1. **Files**: Always use `@path/to/file.md`
2. **Agents**: Always use `task(subagent_type="name", ...)`
3. **Shell**: Always use `` !`command` `` for dynamic context
4. **Clarity**: Separate files, agents, and tasks into clear sections
5. **Workflow**: Always specify the execution order
6. **Agent Names**: Plain text only - `tester`, never `@tester`
7. **Context First**: Load all context before describing the task
8. **Explicit Instructions**: Tell AI exactly when and how to invoke agents

---

## 🎯 REAL-WORLD EXAMPLE: Your Agent Setup

Based on your actual agent configurations (task-manager subagent + orchestration agent):

### Your Agent Files Structure & Naming

**CRITICAL**: Agents are defined in MARKDOWN files. The agent NAME comes from the FILE PATH!

```
.opencode/
  agent/                          # All agents as markdown files
    subagents/
      core/
        task-manager.md           # Agent name: "TaskManager"
    orchestration-agent.md        # Agent name: "orchestration-agent"
    code/
      reviewer.md                 # Agent name: "code/reviewer"
      tester.md                   # Agent name: "code/tester"
```

**Markdown Agent File Format:**
```markdown
---
description: "Brief description of agent"
mode: subagent                    # or "primary" or "all"
temperature: 0.2
tools:
  read: true
  write: true
  edit: true
  bash: true
  task: true
permissions:
  edit:
    "**/*.secret": "deny"
  bash:
    "rm -rf *": "deny"
---

# Agent Prompt Content Here

Your agent instructions, personality, rules, etc.
All the markdown content becomes the agent's system prompt.
```

**How OpenCode determines agent names (from source code):**
1. Scans `.opencode/agent/**/*.md` files recursively
2. Parses YAML frontmatter (between `---` markers) for config
3. Uses markdown content as the agent's system prompt
4. Agent name = file path from `agent/` directory (minus `.md`)

**Examples:**
- File: `.opencode/agent/task-manager.md` → Name: `task-manager`
- File: `.opencode/agent/TaskManager.md` → Name: `TaskManager`
- File: `.opencode/agent/code/reviewer.md` → Name: `code/reviewer`

**No opencode.json needed!** Everything is in markdown.

### ❌ WRONG: Confusing Prompt

```markdown
Use @task-manager to break down the feature
Have @orchestration-agent coordinate the work
```

**Problems:**
- Using `@` for agent invocation (only loads metadata)
- AI won't actually invoke the agents
- Wrong agent name - should include full path: `TaskManager`
- Confusing agent files with agent invocation

### ✅ CORRECT: Clear Prompt

```markdown
# Implement User Dashboard Feature

## 📋 Context Files (Load FIRST)

**Agent Documentation** (optional - only if you need to understand agent capabilities):
- @.opencode/agent/orchestration-agent.md - Main agent guidelines
- @.opencode/agent/TaskManager.md - Task breakdown process

**Project Documentation**:
- @docs/coding-standards.md
- @docs/architecture.md

**Current State**:
Branch: !`git branch --show-current`
Files: !`find src/dashboard -name "*.ts"`

---

## 🤖 Available Agents

### Agent: `TaskManager` (Subagent)

**IMPORTANT**: Agent is defined in a MARKDOWN file. The agent name comes from the file path!

**File location**: `.opencode/agent/TaskManager.md`
**Agent name**: `TaskManager` (path from `agent/` directory)
**Format**: Markdown with YAML frontmatter

**File structure:**
```markdown
---
description: "Breaks down complex features into subtasks"
mode: subagent
temperature: 0.1
tools: { read: true, write: true, ... }
---

# Task Manager Agent Prompt
[Your agent instructions here...]
```

**Purpose**: Break down complex features into atomic subtasks

**When to invoke**: 
- Feature has 4+ components
- Need structured task breakdown
- Complex dependencies exist

**How to invoke**:
```javascript
task(
  subagent_type="TaskManager",
  description="Break down dashboard feature",
  prompt="Break down the user dashboard feature into atomic subtasks. Feature includes: profile widget, activity feed, notification center, and settings panel. Create structured task files in /tasks/ directory following your two-phase workflow."
)
```

**What it does**:
1. Analyzes feature and creates subtask plan
2. Waits for your approval
3. Creates task files in `tasks/subtasks/{feature}/`
4. Returns task sequence and dependencies

---

## 🔄 Required Workflow

**For complex features (4+ components):**

1. **Invoke task-manager** to break down the feature
   ```javascript
   task(
     subagent_type="TaskManager",
     description="Break down dashboard",
     prompt="Analyze and break down user dashboard feature with profile, activity, notifications, and settings components. Create task files with dependencies and acceptance criteria."
   )
   ```

2. **Review the task plan** (agent will request approval)

3. **Approve and let agent create files**

4. **Implement tasks** sequentially based on dependencies

5. **Validate each task** against acceptance criteria

---

## 🎯 Your Task

Implement a user dashboard feature with:
- Profile widget (avatar, name, stats)
- Activity feed (recent actions, timestamps)
- Notification center (alerts, read/unread states)
- Settings panel (preferences, theme toggle)

Requirements:
- Follow @docs/architecture.md patterns
- Responsive design
- Real-time updates for notifications
- Accessibility compliant

**Since this is complex (4+ components), invoke the task-manager agent first.**

---

## ⚠️ Important Notes

- **Agent files** (`.md` in `.opencode/agents/`): Use `@` to load as documentation
- **Agent invocation**: Use `task(subagent_type="name", ...)` to actually run the agent
- **Agent names**: Plain text - `task-manager`, NOT `@task-manager`
- The orchestration agent is your primary agent (already active)
- Invoke `task-manager` when you need feature breakdown
```

---

## 🎨 Prompt Templates for Your Specific Agents

### Template 1: Complex Feature (Needs Task Breakdown)

```markdown
# Implement [Complex Feature Name]

## 📋 Context

**Read these files:**
- @docs/coding-standards.md
- @docs/architecture.md
- @.opencode/context/core/workflows/delegation.md

**Current state:**
!`git status --short`
!`find src/[module] -type f`

---

## 🤖 Agent: TaskManager

**Invoke immediately for task breakdown:**

```javascript
task(
  subagent_type="TaskManager",
  description="Break down [feature]",
  prompt="Break down [feature description] into atomic subtasks. Include:
  - Component 1: [details]
  - Component 2: [details]
  - Component 3: [details]
  
  Create task files in /tasks/ with dependencies, acceptance criteria, and test requirements. Follow your two-phase workflow (plan → approve → create files)."
)
```

---

## 🎯 Task Details

[Detailed feature requirements]

---

## 🔄 Workflow

1. Invoke task-manager for breakdown
2. Review and approve task plan
3. Implement tasks in dependency order
4. Validate against acceptance criteria
5. Report completion
```

### Template 2: Simple Task (Direct Execution)

```markdown
# [Simple Task Name]

## 📋 Context

**Read:**
- @docs/coding-standards.md

**Current state:**
!`git status --short`

---

## 🎯 Task

[Task description - simple, 1-3 files]

---

## ⚠️ Notes

- Simple task, no task-manager needed
- Execute directly
- Follow coding standards from @docs/coding-standards.md
```

### Template 3: Coordination Task (Uses Orchestration Features)

```markdown
# Coordinate [Multi-Step Feature]

## 📋 Context

**Read orchestration guidelines:**
- @.opencode/agents/orchestration-agent.md
- @.opencode/context/core/workflows/delegation.md

**Current state:**
!`git status --short`

---

## 🔄 Coordination Workflow

This task requires coordination across multiple steps:

1. **Break down** feature using task-manager
2. **Implement** core components
3. **Delegate** complex subsystems if needed
4. **Validate** integration
5. **Report** completion

---

## 🤖 Agents Available

**Agent: `TaskManager`** - For feature breakdown
Invoke: task(subagent_type="TaskManager", description="...", prompt="...")

**Agent: `general`** - For delegated complex work (if needed)
Invoke: task(subagent_type="general", description="...", prompt="...")

---

## 🎯 Task

[Complex coordinated task description]

---

## 📝 Orchestration Rules

From @.opencode/agents/orchestration-agent.md:
- Request approval before execution
- Stop on failures (don't auto-fix)
- Report → Propose → Approve → Fix
- Confirm before cleanup
```

---

## 🎯 Key Insights for Your Setup

### Your Orchestration Agent (Primary)
- **Already active** - it's processing your prompts
- **Has task delegation** capability
- **Follows approval workflow**
- **Can invoke task-manager** when needed

### Your Task-Manager Subagent
- **Invoked via task tool** when you need breakdown
- **Two-phase workflow**: Plan → Approve → Create
- **Creates files** in `tasks/subtasks/{feature}/`
- **Returns structured** task plans

### Critical Distinctions

| What | File Syntax | Agent Invocation |
|------|-------------|------------------|
| Load agent docs | `@.opencode/agent/TaskManager.md` | N/A |
| Invoke task-manager | N/A | `task(subagent_type="TaskManager", ...)` |
| Reference in text | "the task-manager agent" or "TaskManager" | N/A |
| Load project docs | `@docs/standards.md` | N/A |

**KEY INSIGHT**: The agent name comes from the file path structure, NOT just the filename!

### Decision Flow

```
Is it complex (4+ components)?
  ↓ YES
  Invoke task-manager → Get breakdown → Implement tasks
  
  ↓ NO
  Execute directly (orchestration agent handles it)

Need to understand agents?
  ↓ YES
  Load agent docs: @.opencode/agents/[agent].md
  
  ↓ NO
  Skip - just invoke when needed
```

---

---

## 🤔 Design Philosophy: Why List Subagents?

**You might ask**: "Why do I need to tell the AI about subagents in my prompt when the `task` tool already lists them?"

**You're right - it's redundant!** Here's the reality:

### The Ideal World (How It Should Work)
```markdown
---
tools:
  task: true  # AI should figure out the rest
---

# Your Agent
Delegate complex work to specialized subagents.
```

The AI should:
1. ✅ See the `task` tool
2. ✅ Read the tool's description (which lists agents)
3. ✅ Use it when appropriate

### The Real World (Current AI Limitations)

Current AI models don't always:
- ❌ Read tool descriptions carefully
- ❌ Remember to check available tools
- ❌ Connect "complex task" → "delegate" → "use task tool"

So we **compensate** by:
- Explicitly mentioning agents in prompts
- Providing invocation examples
- Repeating instructions

### Two Approaches

**Option 1: Minimal (Trust the Tool)**
```markdown
For complex work, use the `task` tool to delegate to specialized subagents.
Available agents are documented in the task tool description.
```
- ✅ Clean, minimal
- ⚠️ AI might not delegate when it should

**Option 2: Explicit (Be Redundant)**
```markdown
Available subagents via task tool:
- TaskManager - For feature breakdown
- TestEngineer - For testing

Invoke with: task(subagent_type="...", description="...", prompt="...")
```
- ⚠️ Redundant with tool description
- ✅ AI consistently delegates appropriately

**Recommendation**:

**Last Updated**: 2024-11-21
**OpenCode Version**: Latest

