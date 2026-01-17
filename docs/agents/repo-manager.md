# Repository Manager Agent v2.0

**Agent ID**: `repo-manager`  
**Category**: Meta  
**Type**: Meta Agent  
**Version**: 2.0.0  
**Status**: Stable

---

## Overview

The Repository Manager is a meta agent specifically designed for managing development work on the OpenAgents Control repository itself. It provides **lazy context loading**, **smart delegation**, and **automatic documentation updates** with intelligent subagent coordination.

### What's New in v2.0

- ✅ **Lazy Context Loading** - Uses `contextscout` for dynamic context discovery
- ✅ **Smart Delegation** - Session files for complex tasks, inline context for simple
- ✅ **Predictable Workflow** - Same 6-stage process every time
- ✅ **No Hardcoded Paths** - Adapts to any repo structure
- ✅ **Clear Decision Trees** - Explicit logic for when to delegate vs execute

---

## Purpose

While `openagent` is a universal agent for any project, `repo-manager` is specialized for OpenAgents Control repository development. It understands the repository's structure, conventions, and standards, ensuring all work follows established patterns.

---

## Key Features

### 1. **Lazy Context Loading**
- Uses `contextscout` subagent for dynamic discovery
- Loads context **just-in-time** (after approval, before execution)
- No hardcoded paths - adapts to repo changes
- Only loads what's needed for the specific task

### 2. **Smart Delegation Strategy**
- **Complex tasks** (4+ files, >60min) → Session file + task-manager
- **Simple specialists** (tester, reviewer) → Inline context
- **Direct execution** (1-3 files) → No delegation

### 3. **Session-Based Coordination**
- Creates `.tmp/sessions/{timestamp}-{task-slug}/` for complex tasks
- Context file contains: user request, context files to load, requirements, exit criteria
- Shared memory for subagent coordination
- Automatic cleanup after completion

### 4. **Approval-Gated Workflow**
- Never executes without explicit user approval
- Presents clear implementation plans before proceeding
- Stops on validation failures and requests approval for fixes

### 5. **Automatic Documentation Updates**
- Identifies documentation affected by changes
- Updates docs automatically or delegates to documentation subagent
- Keeps README files, guides, and context files current

### 6. **Validation Integration**
- Runs validation scripts automatically (registry, test suites)
- Executes eval tests when applicable
- Stops on failure and reports issues clearly

---

## When to Use

Use `repo-manager` for:
- ✅ Creating new agents
- ✅ Creating/modifying eval tests
- ✅ Updating the registry
- ✅ Managing context files
- ✅ Updating documentation
- ✅ Any OpenAgents Control repository development

Don't use `repo-manager` for:
- ❌ Working on user projects (use `openagent` instead)
- ❌ General coding tasks outside this repo
- ❌ Questions about other projects

---

## The 6-Stage Workflow

Every task follows the same predictable workflow:

```
┌─────────────────────────────────────────────────────────────┐
│ STAGE 1: ANALYZE                                            │
│ - Classify task type (agent, eval, registry, docs, etc.)   │
│ - Determine complexity (simple vs complex)                  │
│ - Decide execution path (question vs task)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 2: PLAN & APPROVE                                     │
│ - Create implementation plan                                │
│ - List files to create/modify                               │
│ - Identify context needed (don't load yet)                  │
│ - Request approval                                          │
│ - ✅ Wait for user approval                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 3: LOAD CONTEXT (Lazy Loading)                        │
│ - Load quick-start.md (always)                              │
│ - Delegate to contextscout for discovery               │
│ - Load discovered context files                             │
│ - Extract key requirements                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 4: EXECUTE                                            │
│ - Decision: Complex → Session file + delegate               │
│ - Decision: Simple specialist → Inline context              │
│ - Decision: Direct → Execute with loaded context            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 5: VALIDATE                                           │
│ - Run validation scripts                                    │
│ - Run tests if applicable                                   │
│ - On failure: STOP → REPORT → PROPOSE → APPROVE → FIX       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ STAGE 6: COMPLETE                                           │
│ - Update affected documentation                             │
│ - Summarize all changes                                     │
│ - Confirm user satisfaction                                 │
│ - Cleanup session files (if created)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Lazy Context Loading (Stage 3)

Instead of hardcoding context file paths, repo-manager uses **contextscout** for dynamic discovery:

### How It Works

1. **Load quick-start.md** (always - orientation file)
   ```
   Read: .opencode/context/openagents-repo/quick-start.md
   ```

2. **Delegate to contextscout** for discovery
   ```javascript
    task(
      subagent_type="ContextScout",
      description="Find context for {task-type}",
     prompt="Search for context files related to: {task-type}
             
             Return:
             - Exact file paths
             - Brief summaries
             - Priority order"
   )
   ```

3. **Load discovered files** in priority order
   ```
   FOR EACH file in discovered_files:
     Read: {file-path}
   ```

4. **Extract requirements** from loaded context
   - Naming conventions
   - File structure requirements
   - Validation requirements
   - Testing requirements

### Benefits

- ✅ No hardcoded paths - adapts to repo changes
- ✅ Only loads what's needed - true lazy loading
- ✅ Discovers new context files automatically
- ✅ Works even if context structure changes

---

## Smart Delegation (Stage 4)

Repo-manager uses three delegation strategies based on task complexity:

### Strategy 1: Session File Delegation (Complex Tasks)

**When**: 4+ files, >60min, complex dependencies, task breakdown needed

**Subagents**: task-manager, documentation

**Process**:
1. Create session directory: `.tmp/sessions/{timestamp}-{task-slug}/`
2. Write `context.md` with:
   - User request
   - Context files to load
   - Key requirements (extracted from Stage 3)
   - Files to create/modify
   - Exit criteria
3. Delegate with context path
4. Cleanup after completion

**Example**:
```javascript
task(
  subagent_type="TaskManager",
  prompt="Load context from .tmp/sessions/20250114-143022-parallel-tests/context.md
          
          Break down this feature into atomic subtasks.
          Follow all requirements in context file."
)
```

### Strategy 2: Inline Context Delegation (Simple Specialists)

**When**: Simple delegation to specialists (tester, reviewer, coder-agent)

**Subagents**: tester, reviewer, coder-agent, build-agent

**Process**:
1. No session file needed
2. Pass context directly in prompt
3. Include extracted requirements from Stage 3

**Example**:
```javascript
task(
  subagent_type="TestEngineer",
  prompt="Context to load:
          - .opencode/context/core/standards/tests.md
          
          Task: Write tests for {feature}
          
          Requirements:
          - Positive and negative test cases
          - Arrange-Act-Assert pattern
          
          Files to test:
          - {file1}
          - {file2}"
)
```

### Strategy 3: Direct Execution (No Delegation)

**When**: 1-3 files, straightforward, <30min

**Process**:
1. Execute directly using context loaded in Stage 3
2. Apply requirements extracted from context
3. Create/modify files as planned

---

## Available Subagents

### Core Subagents (Planning & Coordination)

| Subagent | Purpose | Context Strategy |
|----------|---------|------------------|
| **task-manager** | Break down complex features into atomic subtasks | Session file |
| **contextscout** | Find and retrieve relevant context files | None (discovery) |
| **documentation** | Generate/update comprehensive documentation | Session file |

### Code Subagents (Implementation & Quality)

| Subagent | Purpose | Context Strategy |
|----------|---------|------------------|
| **coder-agent** | Execute simple coding subtasks | Inline |
| **tester** | Write tests following TDD | Inline |
| **reviewer** | Code review, security, quality checks | Inline |
| **build-agent** | Type checking, build validation | Inline |

---

## Session File Structure

When creating session files for complex tasks:

```
.tmp/sessions/{timestamp}-{task-slug}/
├── context.md              # Shared context for all subagents
└── .manifest.json          # Track session metadata
```

### context.md Template

```markdown
# Task Context: {Task Name}

Session ID: {timestamp}-{task-slug}
Created: {ISO timestamp}
Status: in_progress

## Current Request
{Original user request}

## Context Files to Load
- .opencode/context/openagents-repo/quick-start.md
- {other context files discovered in Stage 3}

## Key Requirements (Extracted from Context)
- {requirement 1}
- {requirement 2}

## Files to Create/Modify
- {file 1} - {purpose}
- {file 2} - {purpose}

## Technical Constraints
{Any technical constraints}

## Exit Criteria
- [ ] {criteria 1}
- [ ] {criteria 2}

## Progress Tracking
- [ ] Context loaded and understood
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Documentation updated

---
**Instructions for Subagent**:
{Specific instructions}
```

---

## Examples

### Example 1: Simple Agent Creation (Direct Execution)

**User**: "Create a new data analyst agent"

**Workflow**:

1. **Analyze**: Task type = agent-creation, Complexity = simple (4 files)
2. **Plan**: Present plan to create 4 files, request approval
3. **LoadContext**:
   - Load quick-start.md
   - Delegate to contextscout: "Find context for agent-creation"
   - Load discovered files: agents.md, adding-agent.md, code.md
   - Extract: frontmatter format, category structure, naming conventions
4. **Execute**: Direct execution (4 files, straightforward)
   - Create agent file with proper frontmatter
   - Create eval structure
   - Update registry
5. **Validate**: Run registry validation, smoke test
6. **Complete**: Update docs, summarize, confirm

**Context Flow**: ✅ Lazy loaded, ✅ No session files, ✅ Direct execution

---

### Example 2: Complex Feature (Delegation Chain)

**User**: "Build parallel test execution for eval framework"

**Workflow**:

1. **Analyze**: Task type = general-development, Complexity = complex (6+ files, >60min)
2. **Plan**: Present plan to delegate to task-manager, request approval
3. **LoadContext**:
   - Load quick-start.md
   - Delegate to contextscout: "Find context for eval framework development"
   - Load discovered files: evals.md, code.md, tests.md, patterns.md
   - Extract: modular patterns, test requirements, eval structure
4. **Execute**: Session delegation
   - Create `.tmp/sessions/20250114-143022-parallel-tests/context.md`
   - Delegate to task-manager with context path
   - Task-manager creates subtasks
   - Implement subtasks (delegate to coder-agent or execute directly)
5. **Validate**:
   - Run tests
   - Delegate to tester for validation
   - Delegate to reviewer for quality check
6. **Complete**:
   - Delegate to documentation for docs update
   - Summarize changes
   - Cleanup session files

**Context Flow**: ✅ Lazy loaded, ✅ Session file created, ✅ Shared memory, ✅ Clean coordination

---

## Decision Matrix

| Scenario | Context Loading | Session File? | Delegation |
|----------|----------------|---------------|------------|
| Simple agent creation | Lazy (contextscout) | ❌ No | None (direct) |
| Complex feature (4+ files) | Lazy (contextscout) | ✅ Yes | task-manager |
| Write tests | Lazy (contextscout) | ❌ No | tester (inline) |
| Code review | Lazy (contextscout) | ❌ No | reviewer (inline) |
| Simple implementation | Lazy (contextscout) | ❌ No | coder-agent (inline) |
| Comprehensive docs | Lazy (contextscout) | ✅ Yes | documentation |
| Find context files | None (discovery agent) | ❌ No | contextscout |

---

## Quality Standards

### Repository Conventions
- Follow category-based organization (core, development, content, etc.)
- Use proper frontmatter metadata in agent files
- Follow naming conventions (kebab-case for files)
- Include proper tags and dependencies
- Validate against registry schema

### Context Awareness
- Load quick-start.md for every task
- Use contextscout for dynamic discovery
- Apply standards from core/standards/
- Follow workflows from core/workflows/
- Reference context files (don't duplicate content)

### Documentation Maintenance
- Update docs when making changes
- Keep README files current
- Update version/date stamps
- Maintain consistency across docs
- Follow docs standards

### Validation Requirements
- Run validation scripts before completion
- Test agents with eval framework
- Validate registry entries
- Check file structure
- Verify documentation links

---

## Critical Rules

1. **Approval Gate**: Request approval before ANY execution (bash, write, edit, task)
2. **Context First**: Load repo context BEFORE executing (lazy, via contextscout)
3. **Stop on Failure**: STOP on test fail/errors - NEVER auto-fix
4. **Report First**: On fail: REPORT→PROPOSE FIX→REQUEST APPROVAL→FIX
5. **Confirm Cleanup**: Confirm before deleting session files

---

## Testing

**Eval Tests**: `evals/agents/meta/repo-manager/`

**Test Suites**:
- `smoke-test.yaml` - Basic functionality
- `context-loading-test.yaml` - Lazy context loading
- `delegation-test.yaml` - Delegation decisions and session files

**Run Tests**:
```bash
cd evals/framework
npm run eval:sdk -- --agent=meta/repo-manager
```

**Run Specific Test**:
```bash
cd evals/framework
npm run eval:sdk -- --agent=meta/repo-manager --pattern="smoke-test.yaml"
```

---

## Comparison: v1.0 vs v2.0

| Aspect | v1.0 | v2.0 |
|--------|------|------|
| **Context Loading** | Upfront (hardcoded paths) | Lazy (contextscout) |
| **Session Files** | Always creates bundles | Only for complex tasks |
| **Context Passing** | Always via files | Smart (inline vs session) |
| **Workflow Stages** | 8 stages | 6 stages |
| **Lines of Code** | 763 lines | ~650 lines |
| **Adaptability** | Hardcoded paths | Dynamic discovery |
| **Clarity** | Over-specified | Clear decision trees |

---

## Principles

1. **Lazy Loading**: Fetch context when needed via contextscout, not before
2. **Smart Delegation**: Session files for complex, inline for simple
3. **Safety First**: Always request approval, stop on failure
4. **Quality Focused**: Validate against repo standards, never auto-fix
5. **Adaptive**: Direct execution for simple, delegation for complex
6. **Discoverable**: Use contextscout for dynamic context discovery
7. **Predictable**: Same workflow every time

---

**Last Updated**: 2025-01-14  
**Maintainer**: opencode  
**Status**: Stable  
**Version**: 2.0.0
