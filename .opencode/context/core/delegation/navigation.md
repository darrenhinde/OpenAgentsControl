<!-- Context: delegation/navigation | Priority: high | Version: 1.0 | Updated: 2026-01-18 -->
# Delegation Control System

## Overview

The delegation control system helps agents make intelligent routing decisions and validate execution patterns.

**Purpose**: Provide fast, pattern-based decisions for:
- When to delegate vs execute directly
- Which subagent to use
- What context to load first
- Whether task status was properly updated

## Context Files

### Core Files

- **routing-patterns.md** - Phase 1: Pre-approval routing decisions
  - Triggers: Before Stage 2 (Approve)
  - Purpose: Determine execution path (direct, delegate, context-first)
  - Output: Routing decision + pre-actions

- **validation-checks.md** - Phase 2: Post-execution validation
  - Triggers: After Stage 3 (Execute), before Stage 4 (Validate)
  - Purpose: Verify delegation was correct, tasks updated
  - Output: Validation report + corrective actions

## Usage Pattern

### Phase 1: Routing Decision (Pre-Approval)

```javascript
task(
  subagent_type="DelegationController",
  description="Route decision for task",
  prompt="Phase: routing
  
User request: {request}
Discovered context: {context_files}
Files involved: {file_count}

Determine routing decision."
)
```

**Returns**:
```json
{
  "phase": "routing",
  "routing": "delegate_taskmanager|execute_direct|needs_context_first|execute_existing_task",
  "reason": "Brief explanation",
  "pre_actions": ["use_contextscout", "load_standards", "check_task_status"],
  "context_files": ["paths to load"],
  "confidence": "high|medium|low"
}
```

### Phase 2: Validation (Post-Execution)

```javascript
task(
  subagent_type="DelegationController",
  description="Validate execution",
  prompt="Phase: validation

Execution summary: {what_happened}
Task files: {task_json_paths}
Delegation used: {yes/no}
Context loaded: {context_files}

Validate execution was correct."
)
```

**Returns**:
```json
{
  "phase": "validation",
  "status": "ok|missing_task_update|missing_context|incorrect_delegation",
  "issues": ["list of issues found"],
  "actions": ["corrective actions needed"],
  "severity": "low|medium|high"
}
```

## Integration Points

### OpenAgent Workflow Integration

```
Stage 1: Analyze
  ↓
Stage 1.5: Discover (ContextScout)
  ↓
Stage 1.75: Route Decision (DelegationController Phase 1) ← NEW
  ↓
Stage 2: Approve (includes routing decision)
  ↓
Stage 3: Execute
  ↓
Stage 4.5: Validate Delegation (DelegationController Phase 2) ← NEW
  ↓
Stage 4: Validate (quality checks)
  ↓
Stage 5: Summarize
```

## Decision Matrix

| Scenario | Routing Decision | Validation Focus |
|----------|-----------------|------------------|
| Simple 1-file change | `execute_direct` | Skip validation |
| Complex feature (4+ files) | `delegate_taskmanager` | Tasks created & started |
| Existing task work | `execute_existing_task` | Status updated correctly |
| Missing context | `needs_context_first` | Context loaded before exec |
| Parallel subtasks | `batch_delegate_coder` | All marked in_progress |

## Principles

- **Fast decisions**: Pattern-based, not deep reasoning (0.1-0.2 temp)
- **Clear output**: JSON format, no ambiguity
- **Non-invasive**: Doesn't change existing agents
- **Auditable**: Creates decision trail
- **Flexible**: Can be called by any agent when uncertain

## Related

- `.opencode/context/core/workflows/task-delegation.md` - Full delegation process
- `.opencode/context/core/task-management/navigation.md` - Task management system
- `.opencode/agent/subagents/core/delegation-controller.md` - Agent implementation
