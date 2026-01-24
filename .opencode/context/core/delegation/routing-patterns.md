<!-- Context: delegation/routing-patterns | Priority: high | Version: 1.0 | Updated: 2026-01-18 -->
# Routing Patterns - Phase 1 Decision Logic

## Purpose

Fast, pattern-based routing decisions to determine execution path BEFORE approval stage.

**When to use**: Stage 1.75 (after Discover, before Approve)

**Output**: JSON routing decision with pre-actions

## Routing Categories

### 1. `execute_direct`

**When to use**:
- Single file modification
- Straightforward change (typo, comment, simple update)
- Clear bug fix with known solution
- No dependencies or complexity

**Patterns**:
```regex
/single file/i
/typo|fix typo|correct spelling/i
/add comment|update comment/i
/simple (change|update|fix)/i
/straightforward/i
```

**File count**: 1-2 files

**Pre-actions**: 
- Load relevant context if code/docs/tests
- No delegation needed

**Example**:
```json
{
  "routing": "execute_direct",
  "reason": "Single file typo fix, no complexity",
  "pre_actions": [],
  "context_files": [],
  "confidence": "high"
}
```

---

### 2. `delegate_taskmanager`

**When to use**:
- 4+ files involved
- Multi-component feature
- Dependencies between tasks
- Complex workflow (auth, API, multi-step)
- User explicitly requests task breakdown

**Patterns**:
```regex
/\d+ files/i (where count >= 4)
/(complex|multi-step|multi-component) (feature|system)/i
/(auth|authentication) system/i
/with (dependencies|tests|middleware)/i
/break.*down|plan.*tasks/i
```

**File count**: 4+ files

**Pre-actions**:
- `use_contextscout` (if not already done)
- `load_standards` (code-quality.md)
- `load_task_management_context` (task-management/navigation.md)

**Example**:
```json
{
  "routing": "delegate_taskmanager",
  "reason": "Complex feature spanning 6 files with dependencies",
  "pre_actions": ["load_standards", "load_task_management_context"],
  "context_files": [
    ".opencode/context/core/standards/code-quality.md",
    ".opencode/context/core/task-management/navigation.md"
  ],
  "confidence": "high"
}
```

---

### 3. `needs_context_first`

**When to use**:
- No context discovered yet
- New domain/technology not in codebase
- Unclear patterns or standards
- Implementation needs discovery first

**Patterns**:
```regex
/no context (found|available)/i
/unclear (pattern|standard|approach)/i
/new (domain|technology|framework)/i
/need.*discover|find.*patterns/i
```

**Context files**: Empty or insufficient

**Pre-actions**:
- `use_contextscout` (mandatory)
- Wait for context discovery before routing

**Example**:
```json
{
  "routing": "needs_context_first",
  "reason": "API implementation needs patterns/standards discovery",
  "pre_actions": ["use_contextscout"],
  "context_files": [],
  "confidence": "high"
}
```

---

### 4. `execute_existing_task`

**When to use**:
- Continuing work on existing task
- Task JSON files exist (.tmp/tasks/{feature}/)
- User says "continue", "next task", "work on {task}"

**Patterns**:
```regex
/continue (working|task|feature)/i
/next (task|subtask)/i
/work on (task|subtask)/i
/resume/i
```

**Task files**: `.tmp/tasks/{feature}/task.json` exists

**Pre-actions**:
- `check_task_status` (run task-cli.ts status)
- `load_task_context` (read task.json + subtask_NN.json)
- `mark_in_progress` (update status)

**Example**:
```json
{
  "routing": "execute_existing_task",
  "reason": "Continuing existing auth-system task",
  "pre_actions": ["check_task_status", "load_task_context", "mark_in_progress"],
  "context_files": [".tmp/tasks/auth-system/subtask_02.json"],
  "confidence": "high"
}
```

---

### 5. `batch_delegate_coder`

**When to use**:
- Multiple parallel/isolated tasks
- Tasks marked `parallel: true` in JSON
- No dependencies between tasks
- Can be executed concurrently

**Patterns**:
```regex
/parallel tasks/i
/isolated (tasks|subtasks)/i
/batch (execute|process)/i
```

**Task files**: Multiple subtasks with `parallel: true`

**Pre-actions**:
- `check_parallel_tasks` (run task-cli.ts parallel)
- `load_task_contexts` (read all parallel subtask JSONs)
- `mark_all_in_progress`

**Example**:
```json
{
  "routing": "batch_delegate_coder",
  "reason": "3 parallel subtasks ready (no dependencies)",
  "pre_actions": ["check_parallel_tasks", "load_task_contexts"],
  "context_files": [
    ".tmp/tasks/auth-system/subtask_03.json",
    ".tmp/tasks/auth-system/subtask_04.json",
    ".tmp/tasks/auth-system/subtask_05.json"
  ],
  "confidence": "high"
}
```

---

## Decision Algorithm

### Step 1: Check for existing tasks
```
IF .tmp/tasks/{feature}/ exists:
  → routing = "execute_existing_task"
  → RETURN
```

### Step 2: Check context availability
```
IF context_files.length == 0 AND task_needs_context:
  → routing = "needs_context_first"
  → RETURN
```

### Step 3: Check complexity
```
IF file_count >= 4 OR has_dependencies OR multi_component:
  → routing = "delegate_taskmanager"
  → RETURN
```

### Step 4: Check for parallel tasks
```
IF multiple_tasks AND all_parallel:
  → routing = "batch_delegate_coder"
  → RETURN
```

### Step 5: Default to direct execution
```
ELSE:
  → routing = "execute_direct"
  → RETURN
```

## Confidence Levels

- **high**: Clear pattern match, unambiguous
- **medium**: Multiple patterns match, needs user confirmation
- **low**: Unclear, recommend asking user for clarification

## Edge Cases

### Ambiguous file count
```
User: "Update authentication"
Files: Unknown

→ routing = "needs_context_first"
→ reason = "File count unknown, need discovery first"
```

### User override
```
User: "Just do it directly, don't delegate"

→ routing = "execute_direct"
→ reason = "User explicitly requested direct execution"
→ confidence = "high"
```

### Missing information
```
User: "Implement feature X"
Context: None
Files: Unknown

→ routing = "needs_context_first"
→ pre_actions = ["use_contextscout", "clarify_scope"]
```

## Output Format

Always return JSON:

```json
{
  "phase": "routing",
  "routing": "execute_direct|delegate_taskmanager|needs_context_first|execute_existing_task|batch_delegate_coder",
  "reason": "Brief 1-sentence explanation",
  "pre_actions": ["action1", "action2"],
  "context_files": ["path1", "path2"],
  "confidence": "high|medium|low"
}
```

## Integration with OpenAgent

OpenAgent calls DelegationController at Stage 1.75:

```javascript
const routingDecision = await task({
  subagent_type: "DelegationController",
  description: "Route decision",
  prompt: `Phase: routing
  
User request: ${userRequest}
Discovered context: ${contextFiles}
Files involved: ${fileCount}
Existing tasks: ${taskFiles}

Determine routing decision.`
});

// Use routing decision in approval plan
const approvalPlan = `
## Proposed Plan

**Routing**: ${routingDecision.routing}
**Reason**: ${routingDecision.reason}

**Pre-execution actions**:
${routingDecision.pre_actions.map(a => `- ${a}`).join('\n')}

**Approval needed before proceeding.**
`;
```

## Related

- `validation-checks.md` - Phase 2 validation logic
- `navigation.md` - Overview and integration
- `.opencode/context/core/workflows/task-delegation.md` - Full delegation process
