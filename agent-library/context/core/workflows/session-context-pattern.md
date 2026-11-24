<!-- Context: workflows/session-context | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Session Context Pattern

## Problem

**Context Fragmentation in Multi-Agent Orchestration**

When orchestrating complex features across multiple agents (TaskManager → CoderAgent → TestEngineer), each agent is stateless and loses context between delegations:

- **TaskManager** creates subtasks but doesn't know what ContextScout discovered
- **CoderAgent** doesn't see what ArchitectureAnalyzer decided
- **TestEngineer** doesn't know what files CoderAgent created
- **Orchestrator** has to manually pass context in every delegation

This leads to:

- ❌ Repeated context discovery (inefficient)
- ❌ Inconsistent decisions (agents don't see previous choices)
- ❌ Lost architectural context (bounded contexts, contracts, ADRs)
- ❌ Manual context passing (error-prone, verbose)

## Solution

**Persistent Session Context File**

Create a single `context.md` file that all agents read and update throughout the feature lifecycle:

```
.tmp/sessions/{session-id}/context.md
```

This file acts as the **shared memory** for the entire orchestration session.

## Architecture

### Session Lifecycle

```
1. Orchestrator creates session → context.md initialized
2. ContextScout updates → adds context_files
3. ArchitectureAnalyzer updates → adds bounded_context, module
4. TaskManager reads context → creates subtasks with full context
5. CoderAgent reads context → knows all decisions, files, contracts
6. TestEngineer reads context → knows what to test
7. Orchestrator marks complete → session archived
```

### Context.md Structure

```markdown
# Task Context: {Feature Name}

Session ID: {session-id}
Created: {timestamp}
Status: in_progress | completed | blocked

## Current Request

{Original user request - what we're building}

## Context Files to Load

- {Standards paths - coding conventions, patterns, security rules}

## Reference Files

- {Source material - existing project files to look at}

## Architecture

- Bounded Context: {DDD context from ArchitectureAnalyzer}
- Module: {Package/module name}
- Vertical Slice: {Feature slice from StoryMapper}

## User Stories

- {Story 1 from StoryMapper}
- {Story 2}

## Priorities

- RICE Score: {score from PrioritizationEngine}
- WSJF Score: {score}
- Release Slice: {v1.0.0, Q1-2026, MVP}

## Contracts

- {type}: {name} ({status})
  Path: {contract file path}

## Architectural Decision Records

- {ADR-ID}: {title}
  Path: {adr file path}

## Progress

Current Stage: {Stage N: Name}

Completed Stages:

- {Stage 0: Context Loading}
- {Stage 1: Planning}

Stage Outputs:

- {Stage 0}:
  - {Output 1}
  - {Output 2}

## Key Decisions

- [{timestamp}] {decision}
  Rationale: {why this choice was made}

## Files Created

- {file path 1}
- {file path 2}

## Exit Criteria

- [ ] {criterion 1}
- [ ] {criterion 2}
- [x] {completed criterion}
```

## When to Use

### Use Session Context When:

✅ **Multi-agent orchestration** - Feature requires 3+ agents working sequentially
✅ **Complex features** - Needs architecture analysis, contracts, ADRs
✅ **Stateful workflows** - Later agents need to know what earlier agents did
✅ **Context-heavy tasks** - Lots of standards, patterns, decisions to track

### Don't Use Session Context When:

❌ **Single agent tasks** - Simple subtask execution (CoderAgent alone)
❌ **Stateless operations** - Each task is independent
❌ **Quick fixes** - Bug fixes, small updates

## Usage by Agent Type

### Orchestrator (MetaAgent)

**Stage 0: Initialize Session**

```typescript
import { createSession } from ".opencode/skills/project-orchestration/scripts/session-context-manager";

const result = createSession(feature, request, {
  contextFiles: [], // Will be populated by ContextScout
  referenceFiles: [],
  exitCriteria: [
    "All subtasks completed",
    "Tests passing",
    "Documentation updated",
  ],
});

const sessionId = result.sessionId;
// Pass sessionId to all subsequent agents
```

**Between Stages: Update Context**

```typescript
import { updateSession, markStageComplete } from "./session-context-manager";

// After ContextScout completes
updateSession(sessionId, {
  contextFiles: [
    ".opencode/context/core/standards/code-quality.md",
    ".opencode/context/core/standards/security-patterns.md",
  ],
});

// After ArchitectureAnalyzer completes
updateSession(sessionId, {
  architecture: {
    boundedContext: "authentication",
    module: "@app/auth",
  },
});

// Mark stage complete
markStageComplete(sessionId, "Stage 1: Planning", [
  ".tmp/tasks/auth-system/task.json",
  ".tmp/tasks/auth-system/subtask_01.json",
]);
```

**Final Stage: Complete Session**

```typescript
updateSession(sessionId, { status: "completed" });
```

### TaskManager

**Stage 0: Load Session Context**

```typescript
import { loadSession } from ".opencode/skills/project-orchestration/scripts/session-context-manager";

const result = loadSession(sessionId);
if (!result.success) {
  throw new Error(`Session not found: ${sessionId}`);
}

const session = result.session;

// Use session context for task planning
const contextFiles = session.contextFiles; // Standards to follow
const referenceFiles = session.referenceFiles; // Source files to look at
const architecture = session.architecture; // Bounded context, module
const contracts = session.contracts; // API contracts
const adrs = session.adrs; // Architectural decisions
```

**Stage 2: Create Tasks with Full Context**

```json
{
  "id": "auth-system",
  "name": "Authentication System",
  "context_files": ["...from session.contextFiles..."],
  "reference_files": ["...from session.referenceFiles..."],
  "bounded_context": "...from session.architecture.boundedContext...",
  "module": "...from session.architecture.module...",
  "contracts": ["...from session.contracts..."],
  "related_adrs": ["...from session.adrs..."]
}
```

**Stage 3: Update Progress**

```typescript
import { addDecision } from "./session-context-manager";

addDecision(sessionId, {
  decision: "Split authentication into 3 subtasks: schema, service, middleware",
  rationale: "Each subtask is atomic (1-2 hours) and has clear dependencies",
});
```

### CoderAgent

**Before Coding: Load Session Context**

```typescript
import { loadSession } from ".opencode/skills/project-orchestration/scripts/session-context-manager";

const result = loadSession(sessionId);
const session = result.session;

// Read context files (standards)
session.contextFiles.forEach((file) => {
  // Load coding standards, security patterns
});

// Read reference files (existing code)
session.referenceFiles.forEach((file) => {
  // Study existing patterns
});

// Check architectural constraints
const boundedContext = session.architecture?.boundedContext;
const contracts = session.contracts; // API contracts to implement
const adrs = session.adrs; // Architectural decisions to follow
```

**After Coding: Track Files Created**

```typescript
import { addFile } from "./session-context-manager";

addFile(sessionId, "src/auth/jwt.service.ts");
addFile(sessionId, "src/auth/jwt.service.test.ts");
```

### ContextScout

**After Discovery: Update Session**

```typescript
import { updateSession } from "./session-context-manager";

updateSession(sessionId, {
  contextFiles: [
    ".opencode/context/core/standards/code-quality.md",
    ".opencode/context/core/standards/security-patterns.md",
    "(example: .opencode/context/core/standards/naming-conventions.md)",
  ],
  referenceFiles: [
    "src/middleware/auth.middleware.ts",
    "src/config/jwt.config.ts",
  ],
});
```

### ArchitectureAnalyzer

**After Analysis: Update Session**

```typescript
import { updateSession, addDecision } from "./session-context-manager";

updateSession(sessionId, {
  architecture: {
    boundedContext: "authentication",
    module: "@app/auth",
    verticalSlice: "user-login",
  },
});

addDecision(sessionId, {
  decision: "Place authentication in separate bounded context",
  rationale:
    "Auth is a core domain with clear boundaries, used by multiple features",
});
```

### ContractManager

**After Contract Definition: Update Session**

```typescript
import { updateSession } from "./session-context-manager";

updateSession(sessionId, {
  contracts: [
    {
      type: "api",
      name: "AuthAPI",
      path: "src/api/auth.contract.ts",
      status: "defined",
    },
    {
      type: "interface",
      name: "JWTService",
      path: "src/auth/jwt.service.ts",
      status: "draft",
    },
  ],
});
```

## API Reference

### createSession(feature, request, options)

Initialize a new session with context.md file.

**Parameters:**

- `feature` (string) - Feature name (kebab-case)
- `request` (string) - Original user request
- `options` (object) - Optional configuration
  - `contextFiles` (string[]) - Standards paths
  - `referenceFiles` (string[]) - Source file paths
  - `exitCriteria` (string[]) - Completion criteria
  - `architecture` (object) - Bounded context, module, vertical slice
  - `stories` (string[]) - User stories
  - `priorities` (object) - RICE/WSJF scores, release slice
  - `contracts` (array) - API/interface contracts
  - `adrs` (array) - Architectural decision records

**Returns:**

```typescript
{ success: boolean; sessionId?: string; error?: string }
```

**Example:**

```typescript
const result = createSession("auth-system", "Implement JWT authentication", {
  exitCriteria: ["All tests passing", "JWT tokens signed with RS256"],
});
// result.sessionId = "auth-system-2026-02-15T10-30-00-000Z"
```

### loadSession(sessionId)

Read session context from context.md.

**Parameters:**

- `sessionId` (string) - Session identifier

**Returns:**

```typescript
{ success: boolean; session?: SessionContext; error?: string }
```

**Example:**

```typescript
const result = loadSession("auth-system-2026-02-15T10-30-00-000Z");
if (result.success) {
  const contextFiles = result.session.contextFiles;
  const architecture = result.session.architecture;
}
```

### updateSession(sessionId, updates)

Append new information to session context.

**Parameters:**

- `sessionId` (string) - Session identifier
- `updates` (object) - Fields to update
  - `status` - 'in_progress' | 'completed' | 'blocked'
  - `contextFiles` - Add standards paths (merged with existing)
  - `referenceFiles` - Add source file paths (merged with existing)
  - `architecture` - Update bounded context, module, vertical slice
  - `stories` - Add user stories
  - `priorities` - Update RICE/WSJF scores
  - `contracts` - Add contracts
  - `adrs` - Add ADRs

**Returns:**

```typescript
{ success: boolean; error?: string }
```

**Example:**

```typescript
updateSession(sessionId, {
  architecture: {
    boundedContext: "authentication",
    module: "@app/auth",
  },
  contracts: [
    {
      type: "api",
      name: "AuthAPI",
      path: "src/api/auth.contract.ts",
      status: "defined",
    },
  ],
});
```

### markStageComplete(sessionId, stage, outputs)

Mark a workflow stage as complete and record outputs.

**Parameters:**

- `sessionId` (string) - Session identifier
- `stage` (string) - Stage name (e.g., "Stage 1: Planning")
- `outputs` (string[]) - Files/artifacts created in this stage

**Returns:**

```typescript
{ success: boolean; error?: string }
```

**Example:**

```typescript
markStageComplete(sessionId, "Stage 1: Planning", [
  ".tmp/tasks/auth-system/task.json",
  ".tmp/tasks/auth-system/subtask_01.json",
  ".tmp/tasks/auth-system/subtask_02.json",
]);
```

### addDecision(sessionId, decision)

Log a key decision with rationale.

**Parameters:**

- `sessionId` (string) - Session identifier
- `decision` (object)
  - `decision` (string) - What was decided
  - `rationale` (string) - Why this choice was made

**Returns:**

```typescript
{ success: boolean; error?: string }
```

**Example:**

```typescript
addDecision(sessionId, {
  decision: "Use RS256 for JWT signing instead of HS256",
  rationale:
    "RS256 (asymmetric) is more secure for distributed systems where tokens are verified by multiple services",
});
```

### addFile(sessionId, filePath)

Track a file created during the session.

**Parameters:**

- `sessionId` (string) - Session identifier
- `filePath` (string) - Path to created file

**Returns:**

```typescript
{ success: boolean; error?: string }
```

**Example:**

```typescript
addFile(sessionId, "src/auth/jwt.service.ts");
addFile(sessionId, "src/auth/jwt.service.test.ts");
```

### getSessionSummary(sessionId)

Get current session state summary.

**Parameters:**

- `sessionId` (string) - Session identifier

**Returns:**

```typescript
{
  success: boolean;
  summary?: {
    sessionId: string;
    feature: string;
    status: string;
    currentStage: string;
    completedStages: number;
    totalDecisions: number;
    filesCreated: number;
    exitCriteriaMet: number;
    exitCriteriaTotal: number;
  };
  error?: string;
}
```

**Example:**

```typescript
const result = getSessionSummary(sessionId);
console.log(`Progress: ${result.summary.completedStages} stages complete`);
console.log(`Files: ${result.summary.filesCreated} created`);
console.log(
  `Exit Criteria: ${result.summary.exitCriteriaMet}/${result.summary.exitCriteriaTotal}`,
);
```

## CLI Usage

```bash
# Create session
npx ts-node session-context-manager.ts create auth-system "Implement JWT authentication"

# Load session
npx ts-node session-context-manager.ts load auth-system-2026-02-15T10-30-00-000Z

# Show summary
npx ts-node session-context-manager.ts summary auth-system-2026-02-15T10-30-00-000Z
```

## Benefits

✅ **No context loss** - All agents see the full picture
✅ **Consistent decisions** - Architectural choices tracked and visible
✅ **Efficient** - Context discovered once, used by all agents
✅ **Auditable** - Complete history of decisions and progress
✅ **Self-documenting** - context.md is human-readable
✅ **Resumable** - Can pause and resume orchestration

## Best Practices

### 1. Initialize Early

Create session at the start of orchestration, before any agent work begins.

### 2. Update After Each Stage

Every agent that completes work should update the session context.

### 3. Read Before Acting

Every agent should load session context before starting work.

### 4. Track Decisions

Use `addDecision()` for any architectural or design choice.

### 5. Track Files

Use `addFile()` for every file created (helps with cleanup, rollback).

### 6. Use Exit Criteria

Define clear, binary exit criteria at session creation.

## Example: Full Orchestration Flow

```typescript
// Orchestrator: Initialize
const { sessionId } = createSession(
  "auth-system",
  "Implement JWT authentication",
  {
    exitCriteria: ["All tests passing", "JWT tokens signed with RS256"],
  },
);

// Stage 0: ContextScout discovers context
updateSession(sessionId, {
  contextFiles: [".opencode/context/core/standards/code-quality.md"],
  referenceFiles: ["src/middleware/auth.middleware.ts"],
});
markStageComplete(sessionId, "Stage 0: Context Loading", []);

// Stage 1: ArchitectureAnalyzer analyzes
updateSession(sessionId, {
  architecture: { boundedContext: "authentication", module: "@app/auth" },
});
addDecision(sessionId, {
  decision: "Separate bounded context for auth",
  rationale: "Core domain with clear boundaries",
});
markStageComplete(sessionId, "Stage 1: Architecture Analysis", []);

// Stage 2: TaskManager creates tasks
const { session } = loadSession(sessionId);
// Use session.contextFiles, session.architecture in task.json
markStageComplete(sessionId, "Stage 2: Task Planning", [
  ".tmp/tasks/auth-system/task.json",
]);

// Stage 3: CoderAgent implements
const { session } = loadSession(sessionId);
// Read session.contextFiles, session.contracts
addFile(sessionId, "src/auth/jwt.service.ts");
markStageComplete(sessionId, "Stage 3: Implementation", [
  "src/auth/jwt.service.ts",
]);

// Stage 4: Complete
updateSession(sessionId, { status: "completed" });
```

## Related

- `.opencode/skills/project-orchestration/scripts/session-context-manager.ts` - Implementation
- `.opencode/context/core/task-management/standards/task-schema.md` - Task JSON schema
- `.opencode/context/core/workflows/task-delegation-basics.md` - Multi-agent orchestration
- `.tmp/sessions/test-task-manager/context.md` - Example session context
