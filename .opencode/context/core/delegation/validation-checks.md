<!-- Context: delegation/validation-checks | Priority: high | Version: 1.0 | Updated: 2026-01-18 -->
# Validation Checks - Phase 2 Post-Execution Logic

## Purpose

Validate that execution followed correct patterns and task status was properly updated.

**When to use**: Stage 4.5 (after Execute, before Validate)

**Output**: JSON validation report with corrective actions

## Validation Categories

### 1. Task Status Validation

**Check**: Were task statuses properly updated?

**Scenarios**:

#### A. Tasks created but none started
```
Symptom: TaskManager created task.json + subtasks, all status="pending"
Issue: No subtask marked "in_progress"
Action: Suggest starting first available task
```

**Detection**:
```bash
# Check if all subtasks are pending
npx ts-node .opencode/context/tasks/scripts/task-cli.ts status {feature}
# If completed_count=0 and all pending → Issue
```

**Output**:
```json
{
  "status": "tasks_created_not_started",
  "issues": ["TaskManager created 5 subtasks but none marked in_progress"],
  "actions": ["suggest_next_task", "mark_subtask_01_ready"],
  "severity": "medium"
}
```

---

#### B. Task completed but not marked
```
Symptom: Work done, files created, but subtask still "in_progress"
Issue: Status not updated to "completed"
Action: Mark task complete and suggest next
```

**Detection**:
```bash
# Check deliverables exist
# Check acceptance_criteria met
# If all pass but status != "completed" → Issue
```

**Output**:
```json
{
  "status": "task_completed_not_marked",
  "issues": ["Subtask_02 deliverables complete but status still in_progress"],
  "actions": ["mark_subtask_02_completed", "suggest_next_task"],
  "severity": "medium"
}
```

---

#### C. Task started but no TodoWrite update
```
Symptom: Subtask marked "in_progress" but no TodoWrite tracking
Issue: No todo list for tracking progress
Action: Create todo list from subtask acceptance_criteria
```

**Detection**:
```bash
# Check if TodoRead returns empty
# Check if subtask has acceptance_criteria
# If criteria exist but no todos → Issue
```

**Output**:
```json
{
  "status": "missing_todo_tracking",
  "issues": ["Subtask in progress but no TodoWrite tracking"],
  "actions": ["create_todo_from_acceptance_criteria"],
  "severity": "low"
}
```

---

### 2. Context Loading Validation

**Check**: Was required context loaded before execution?

**Scenarios**:

#### A. Code written without standards
```
Symptom: Write/Edit tool used for code, but code-quality.md not loaded
Issue: Code may not follow project standards
Action: Load standards and review code
```

**Detection**:
```
IF tool_used IN ["write", "edit"]:
  IF file_type == "code" (*.ts, *.js, *.py, etc.):
    IF "code-quality.md" NOT IN loaded_context:
      → Issue
```

**Output**:
```json
{
  "status": "missing_context",
  "issues": ["Code written without loading code-quality.md"],
  "actions": ["load_standards", "review_code_against_standards"],
  "severity": "high"
}
```

---

#### B. Docs written without standards
```
Symptom: Write/Edit tool used for docs, but documentation.md not loaded
Issue: Docs may not follow project tone/structure
Action: Load standards and review docs
```

**Detection**:
```
IF tool_used IN ["write", "edit"]:
  IF file_type == "docs" (*.md, README, etc.):
    IF "documentation.md" NOT IN loaded_context:
      → Issue
```

**Output**:
```json
{
  "status": "missing_context",
  "issues": ["Documentation written without loading documentation.md"],
  "actions": ["load_doc_standards", "review_docs_against_standards"],
  "severity": "high"
}
```

---

#### C. Delegation without context bundle
```
Symptom: Task tool used to delegate, but no context bundle created
Issue: Subagent won't have necessary context
Action: Create context bundle and re-delegate
```

**Detection**:
```
IF tool_used == "task":
  IF delegation_target IN ["CoderAgent", "TaskManager"]:
    IF context_bundle NOT created:
      → Issue
```

**Output**:
```json
{
  "status": "missing_delegation_context",
  "issues": ["Delegated to CoderAgent without context bundle"],
  "actions": ["create_context_bundle", "re_delegate_with_context"],
  "severity": "high"
}
```

---

### 3. Delegation Correctness Validation

**Check**: Was the right delegation decision made?

**Scenarios**:

#### A. Should have delegated but didn't
```
Symptom: 4+ files modified directly without TaskManager
Issue: Complex task executed directly
Action: Suggest breaking down retrospectively
```

**Detection**:
```
IF files_modified >= 4:
  IF delegation_used == false:
    → Issue
```

**Output**:
```json
{
  "status": "should_have_delegated",
  "issues": ["Modified 6 files directly without TaskManager breakdown"],
  "actions": ["suggest_retrospective_breakdown", "document_approach"],
  "severity": "medium"
}
```

---

#### B. Delegated unnecessarily
```
Symptom: Single file change delegated to TaskManager
Issue: Overhead for simple task
Action: Note for future (not critical)
```

**Detection**:
```
IF files_modified <= 2:
  IF delegation_target == "TaskManager":
    → Issue (low severity)
```

**Output**:
```json
{
  "status": "unnecessary_delegation",
  "issues": ["Single file change delegated to TaskManager"],
  "actions": ["note_for_future"],
  "severity": "low"
}
```

---

### 4. Execution Pattern Validation

**Check**: Did execution follow expected patterns?

**Scenarios**:

#### A. Parallel tasks executed sequentially
```
Symptom: Multiple parallel:true tasks executed one-by-one
Issue: Missed opportunity for concurrent execution
Action: Suggest batching next time
```

**Detection**:
```bash
# Check if multiple subtasks have parallel:true
# Check if they were executed sequentially (timestamps)
# If sequential → Issue
```

**Output**:
```json
{
  "status": "missed_parallelization",
  "issues": ["3 parallel tasks executed sequentially"],
  "actions": ["suggest_batch_execution_next_time"],
  "severity": "low"
}
```

---

#### B. Dependencies violated
```
Symptom: Subtask_03 started before subtask_02 completed
Issue: Dependency order violated
Action: Stop and complete dependencies first
```

**Detection**:
```bash
# Read subtask_03.json depends_on
# Check if all dependencies are completed
# If not → Issue
```

**Output**:
```json
{
  "status": "dependency_violation",
  "issues": ["Subtask_03 started but depends_on subtask_02 not completed"],
  "actions": ["stop_current_task", "complete_dependencies_first"],
  "severity": "high"
}
```

---

## Validation Algorithm

### Step 1: Check task status updates
```
IF task_files exist:
  FOR each subtask:
    IF deliverables complete AND status != "completed":
      → Issue: task_completed_not_marked
    IF status == "in_progress" AND no TodoWrite:
      → Issue: missing_todo_tracking
```

### Step 2: Check context loading
```
IF tool_used IN ["write", "edit"]:
  required_context = get_required_context(file_type)
  IF required_context NOT IN loaded_context:
    → Issue: missing_context
```

### Step 3: Check delegation correctness
```
IF files_modified >= 4 AND delegation_used == false:
  → Issue: should_have_delegated

IF delegation_used:
  IF context_bundle NOT created:
    → Issue: missing_delegation_context
```

### Step 4: Check execution patterns
```
IF parallel_tasks exist:
  IF executed_sequentially:
    → Issue: missed_parallelization

IF dependencies exist:
  IF dependency_order violated:
    → Issue: dependency_violation
```

## Severity Levels

- **high**: Critical issue, must fix before proceeding
- **medium**: Important issue, should fix but not blocking
- **low**: Optimization opportunity, note for future

## Output Format

Always return JSON:

```json
{
  "phase": "validation",
  "status": "ok|tasks_created_not_started|task_completed_not_marked|missing_context|should_have_delegated|dependency_violation",
  "issues": ["issue1", "issue2"],
  "actions": ["action1", "action2"],
  "severity": "low|medium|high"
}
```

## Integration with OpenAgent

OpenAgent calls DelegationController at Stage 4.5:

```javascript
const validationReport = await task({
  subagent_type: "DelegationController",
  description: "Validate execution",
  prompt: `Phase: validation

Execution summary: ${executionSummary}
Task files: ${taskJsonPaths}
Delegation used: ${delegationUsed}
Context loaded: ${contextFiles}
Files modified: ${filesModified}
Tools used: ${toolsUsed}

Validate execution was correct.`
});

// Handle validation issues
if (validationReport.status !== "ok") {
  if (validationReport.severity === "high") {
    // Stop and report
    console.log("⚠️ Critical issues found:");
    validationReport.issues.forEach(issue => console.log(`- ${issue}`));
    console.log("\nRequired actions:");
    validationReport.actions.forEach(action => console.log(`- ${action}`));
    // Request approval to fix
  } else if (validationReport.severity === "medium") {
    // Report and suggest fix
    console.log("⚠️ Issues found (non-blocking):");
    validationReport.issues.forEach(issue => console.log(`- ${issue}`));
    console.log("\nSuggested actions:");
    validationReport.actions.forEach(action => console.log(`- ${action}`));
    // Ask user if they want to fix now
  } else {
    // Just note for future
    console.log("ℹ️ Optimization opportunities:");
    validationReport.issues.forEach(issue => console.log(`- ${issue}`));
  }
}
```

## Skip Validation Scenarios

Skip validation when:
- No execution happened (pure read/analysis)
- User explicitly requested skip
- Simple conversational response
- Bash-only operations (no code/docs/tasks)

## Related

- `routing-patterns.md` - Phase 1 routing logic
- `navigation.md` - Overview and integration
- `.opencode/context/core/standards/code-quality.md` - Code standards
- `.opencode/context/core/task-management/navigation.md` - Task management
