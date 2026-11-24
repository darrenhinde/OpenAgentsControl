---
name: code-execution
description: Use when a subtask is ready to implement and has a subtask JSON file with acceptance criteria and deliverables.
context: fork
agent: coder-agent
---

# Code Execution

## Overview
Execute coding subtasks with self-review and quality validation. Runs in isolated coder-agent context with pre-loaded standards.

**Announce at start:** "I'm using the code-execution skill to implement [subtask title]."

## The Process

### Step 1: Read Subtask JSON

Load the subtask file specified in $ARGUMENTS:

```bash
Read: .tmp/tasks/{feature}/subtask_{seq}.json
```

Extract:
- `title` — What to implement
- `acceptance_criteria` — What defines success
- `deliverables` — Files/endpoints to create
- `context_files` — Standards to apply
- `reference_files` — Existing code to study

### Step 2: Load Context Files

Read each file in `context_files`:

```bash
Read: .opencode/context/core/standards/code-quality.md
Read: .opencode/context/core/standards/security-patterns.md
```

Understand:
- Project coding standards
- Naming conventions
- Security patterns
- Code quality requirements

### Step 3: Load Reference Files

Read each file in `reference_files`:

```bash
Read: src/middleware/auth.middleware.ts
```

Study:
- Existing patterns
- Code structure
- Conventions in use

### Step 4: Update Status to In Progress

Edit subtask JSON:

```json
"status": "in_progress",
"agent_id": "coder-agent",
"started_at": "2026-02-16T00:00:00Z"
```

### Step 5: Implement Deliverables

For each deliverable:
- Create or modify the specified file
- Follow acceptance criteria EXACTLY
- Apply standards from context_files
- Use patterns from reference_files
- Write clean, modular, functional code

### Step 6: Run Self-Review (MANDATORY)

**Type & Import Validation:**
- ✅ Function signatures match usage
- ✅ All imports/exports exist
- ✅ No missing type annotations
- ✅ No circular dependencies

**Anti-Pattern Scan:**
```bash
grep "console.log" deliverables  # NO debug statements
grep "TODO\|FIXME" deliverables  # NO unfinished work
grep "api[_-]key\|secret" deliverables  # NO hardcoded secrets
```

**Acceptance Criteria Check:**
- Re-read `acceptance_criteria` array
- Confirm EACH criterion met
- Fix unmet criteria before proceeding

### Step 7: Mark Complete

Update subtask status:

```bash
bash .opencode/skills/task-management/router.sh complete {feature} {seq} "{summary}"
```

Verify:

```bash
bash .opencode/skills/task-management/router.sh status {feature}
```

### Step 8: Return Report

```
✅ Subtask {feature}-{seq} COMPLETED

Self-Review: ✅ Types | ✅ Imports | ✅ No debug code | ✅ Criteria met

Deliverables:
- src/auth/jwt.service.ts
- src/auth/jwt.service.test.ts

Summary: JWT service with RS256 signing and 15min token expiry
```

## Error Handling

**Missing subtask JSON:**
- Main agent must create subtask before invoking this skill

**Context files not found:**
- Main agent must run `/context-discovery` first

**Acceptance criteria unmet:**
- DO NOT mark complete—fix issues first

## Red Flags

If you think any of these, STOP and re-read this skill:

- "I know the pattern, I don't need to read the context files"
- "I'll do the self-review quickly at the end"
- "The acceptance criteria are obvious, I don't need to check them"
- "I'll mark it done and fix the edge cases later"

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I've seen this pattern before, context files will just confirm what I know" | Projects diverge from common patterns. One wrong assumption = rework. Read the files. |
| "Self-review is just checking my own work" | Self-review catches type errors, missing imports, and debug code before the main agent sees it. |
| "The criteria are implied by the task title" | Implied criteria are unverifiable. If it's not written, it's not a gate. |
| "I'll handle edge cases in a follow-up" | Edge cases left for follow-up become bugs in production. Handle them now. |

## Remember

- Context FIRST, code SECOND—always read context_files before implementing
- One subtask at a time—complete fully before moving on
- Self-review is MANDATORY—quality gate before marking done
- Functional, declarative, modular—clean code patterns only
- Return results to main agent—report completion for orchestration

## Related

- context-discovery
- task-breakdown
- test-generation
- code-review

---

**Task**: Execute coding subtask: **$ARGUMENTS**
