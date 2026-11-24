---
name: task-breakdown
description: Use when a feature touches 4 or more files, involves multiple components, or has subtasks that could run in parallel.
context: fork
agent: task-manager
---

# Task Breakdown

## Overview
Break down complex features into atomic, verifiable subtasks with dependency tracking. Each subtask gets its own JSON file with clear acceptance criteria and deliverables.

**Announce at start:** "I'm using the task-breakdown skill to create an execution plan for [feature]."

## The Process

### Step 1: Analyze Feature

Identify these elements:
- Core objective and scope
- Technical risks and dependencies
- Natural task boundaries
- Tasks that can run in parallel

### Step 2: Create Task Plan

Write `.tmp/tasks/{feature}/task.json`:

```json
{
  "id": "jwt-auth",
  "name": "JWT Authentication System",
  "status": "active",
  "objective": "Implement JWT-based authentication with refresh tokens",
  "context_files": [
    ".opencode/context/core/standards/code-quality.md",
    ".opencode/context/core/standards/security-patterns.md"
  ],
  "reference_files": [
    "src/middleware/auth.middleware.ts"
  ],
  "exit_criteria": [
    "All tests passing",
    "JWT tokens signed with RS256"
  ],
  "subtask_count": 3,
  "completed_count": 0,
  "created_at": "2026-02-16T02:00:00Z"
}
```

**Rules:**
- Feature ID: kebab-case
- Objective: max 200 chars
- `context_files`: standards/conventions ONLY
- `reference_files`: project source files ONLY
- Exit criteria: binary pass/fail

### Step 3: Generate Subtasks

Write `.tmp/tasks/{feature}/subtask_01.json`, `subtask_02.json`, etc:

```json
{
  "id": "jwt-auth-01",
  "seq": "01",
  "title": "Create JWT service with token generation",
  "status": "pending",
  "depends_on": [],
  "parallel": true,
  "suggested_agent": "CoderAgent",
  "context_files": [
    ".opencode/context/core/standards/security-patterns.md"
  ],
  "reference_files": [],
  "acceptance_criteria": [
    "JWT tokens signed with RS256 algorithm",
    "Access tokens expire in 15 minutes"
  ],
  "deliverables": [
    "src/auth/jwt.service.ts",
    "src/auth/jwt.service.test.ts"
  ]
}
```

**Rules:**
- Sequential numbering: 01, 02, 03...
- Atomic tasks: completable in 1-2 hours
- Dependencies: map via `depends_on` array
- Parallel tasks: set `parallel: true` for isolated work
- Agent assignment: CoderAgent, TestEngineer, CodeReviewer, OpenFrontendSpecialist
- Acceptance criteria: binary pass/fail only
- Deliverables: specific file paths or endpoints

### Step 4: Validate Structure

Verify:
- ✅ All JSON files valid
- ✅ Dependency references exist
- ✅ Context files separate from reference files
- ✅ Acceptance criteria are binary
- ✅ Deliverables are specific

### Step 5: Return Summary

```
## Tasks Created

Location: .tmp/tasks/jwt-auth/
Files: task.json + 3 subtasks

Subtasks:
- 01: Create JWT service (parallel: true, agent: CoderAgent)
- 02: Create password hashing util (parallel: true, agent: CoderAgent)
- 03: Integrate middleware (parallel: false, agent: CoderAgent)

Next Steps:
- Execute subtasks in dependency order
- Tasks 01 and 02 can run in parallel
- Task 03 depends on completion of 01 and 02
```

## Red Flags

If you think any of these, STOP and re-read this skill:

- "I can just implement it directly, it's not that complex"
- "The breakdown will take longer than just doing it"
- "I already know what needs to be done"
- "There's only really one task here"

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "It's only 3-4 files, I don't need a breakdown" | 3-4 files = multiple subtasks with dependencies. Skipping tracking means losing progress on failure. |
| "I'll track it in my head" | Subagents don't share memory. JSON files are the only reliable state. |
| "The tasks are obvious, no need to document them" | Obvious tasks still need acceptance criteria. "Done" without binary criteria is not done. |
| "Parallel execution isn't worth it for this" | Parallel tasks cut execution time in half. The JSON overhead is 2 minutes. The time saving is 20+. |

## Remember

- Each subtask completable in 1-2 hours (atomic)
- `context_files` = standards ONLY, `reference_files` = source code ONLY
- Acceptance criteria must be binary (pass/fail)
- Mark isolated tasks as `parallel: true`
- Assign appropriate agent for each subtask
- Deliverables must be specific file paths

## Related

- context-discovery
- code-execution
- parallel-execution

---

**Task**: Break down this feature into atomic subtasks: **$ARGUMENTS**
