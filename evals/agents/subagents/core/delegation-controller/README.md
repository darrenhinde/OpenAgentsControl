# DelegationController Agent Tests

## Overview

Tests for the DelegationController subagent - a fast routing and validation controller for delegation decisions and task status verification.

**Agent**: `delegation-controller`  
**Category**: `subagents/core`  
**Version**: 1.0.0

## Agent Purpose

DelegationController provides two-phase decision support:

1. **Phase 1 (Routing)**: Pre-approval routing decisions
   - Determines execution path (direct, delegate, context-first)
   - Identifies required pre-actions
   - Suggests context files to load

2. **Phase 2 (Validation)**: Post-execution validation
   - Verifies task status updates
   - Checks context loading compliance
   - Validates delegation correctness
   - Identifies execution pattern issues

## Test Structure

```
tests/
├── 01-routing-simple.yaml          # Phase 1: Simple direct execution
├── 02-routing-complex.yaml         # Phase 1: Complex feature delegation
└── 03-validation-task-status.yaml  # Phase 2: Task status validation
```

## Test Categories

### Routing Tests (Phase 1)

Test routing decision patterns:
- ✅ Simple direct execution (1-2 files)
- ✅ Complex feature delegation (4+ files)
- 🔲 Needs context first (missing context)
- 🔲 Execute existing task (task continuation)
- 🔲 Batch delegate (parallel tasks)

### Validation Tests (Phase 2)

Test validation checks:
- ✅ Task created but not started
- 🔲 Task completed but not marked
- 🔲 Missing context (code without standards)
- 🔲 Should have delegated (4+ files direct)
- 🔲 Dependency violation

## Running Tests

### Run all tests
```bash
npm run eval:sdk -- --agent=delegation-controller
```

### Run specific test
```bash
npm run eval:sdk -- --test evals/agents/subagents/core/delegation-controller/tests/01-routing-simple.yaml
```

### Run by category
```bash
# Routing tests only
npm run eval:sdk -- --agent=delegation-controller --pattern="*routing*.yaml"

# Validation tests only
npm run eval:sdk -- --agent=delegation-controller --pattern="*validation*.yaml"
```

## Expected Behavior

### Phase 1: Routing Decision

**Input**:
```
Phase: routing

User request: {request}
Discovered context: {context_files}
Files involved: {count}
Existing tasks: {task_files}
```

**Output**:
```json
{
  "phase": "routing",
  "routing": "execute_direct|delegate_taskmanager|needs_context_first|execute_existing_task|batch_delegate_coder",
  "reason": "Brief explanation",
  "pre_actions": ["action1", "action2"],
  "context_files": ["path1", "path2"],
  "confidence": "high|medium|low"
}
```

### Phase 2: Validation

**Input**:
```
Phase: validation

Execution summary: {what_happened}
Task files: {task_json_paths}
Delegation used: {yes/no}
Context loaded: {context_files}
Files modified: {count}
Tools used: {tools}
```

**Output**:
```json
{
  "phase": "validation",
  "status": "ok|tasks_created_not_started|task_completed_not_marked|missing_context|...",
  "issues": ["issue1", "issue2"],
  "actions": ["action1", "action2"],
  "severity": "low|medium|high"
}
```

## Context Files

DelegationController loads context via @ symbol:

- `@navigation` → `.opencode/context/core/delegation/navigation.md` (always)
- `@routing-patterns` → `.opencode/context/core/delegation/routing-patterns.md` (Phase 1)
- `@validation-checks` → `.opencode/context/core/delegation/validation-checks.md` (Phase 2)

## Key Principles

1. **Fast decisions**: Pattern-based, minimal reasoning (temp 0.1)
2. **JSON output**: No markdown, no commentary
3. **Read-only**: No write/edit/task tools
4. **Stateless**: Reads current state from files
5. **Context-driven**: Loads phase-specific context

## Test Coverage Goals

- [ ] All 5 routing patterns tested
- [ ] All 4 validation check categories tested
- [ ] Edge cases (ambiguous, missing info)
- [ ] Confidence levels (high/medium/low)
- [ ] Severity levels (low/medium/high)

## Notes

- **No approval gates**: Subagent doesn't need approval (calling agent handles that)
- **No tool violations**: Only uses read, grep, glob, bash (task-cli.ts)
- **Fast execution**: Should complete in <5 seconds
- **Deterministic**: Same input → same output (temp 0.1)

## Related

- Agent: `.opencode/agent/subagents/core/delegation-controller.md`
- Context: `.opencode/context/core/delegation/`
- Integration: OpenAgent Stage 1.75 (routing) and Stage 4.5 (validation)
