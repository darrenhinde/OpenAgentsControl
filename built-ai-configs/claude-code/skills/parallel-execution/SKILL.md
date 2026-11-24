---
name: parallel-execution
description: Use when multiple subtasks have no shared files or dependencies and can be executed simultaneously.
---

# Parallel Execution

## Overview
Execute multiple independent tasks simultaneously using multiple subagent invocations in a single message. Reduces implementation time by 50-80% for multi-component features.

**Announce at start:** "I'm using parallel-execution to run [N] independent tasks simultaneously."

## The Process

### Step 1: Identify Parallel Tasks

Check subtask JSON files for `parallel: true`:

```bash
bash .opencode/skills/task-management/router.sh parallel {feature}
```

Output shows which tasks can run together:

```
Batch 1 (Ready now):
- subtask_01.json (parallel: true)
- subtask_02.json (parallel: true)

Batch 2 (After Batch 1):
- subtask_03.json (depends_on: ["01", "02"])
```

### Step 2: Execute Parallel Batch

Make multiple task() calls in SINGLE message:

```markdown
I'll execute Batch 1 tasks in parallel:

task(
  subagent_type="CoderAgent",
  description="Execute subtask 01",
  prompt="Read .tmp/tasks/feature/subtask_01.json and implement..."
)

task(
  subagent_type="CoderAgent",
  description="Execute subtask 02",
  prompt="Read .tmp/tasks/feature/subtask_02.json and implement..."
)
```

**CRITICAL**: Both task() calls in SAME message—not separate messages.

### Step 3: Wait for All to Complete

All tasks in batch must complete before proceeding to next batch.

### Step 4: Verify Batch Completion

```bash
bash .opencode/skills/task-management/router.sh status {feature}
```

Check all tasks in batch marked `status: "completed"`.

### Step 5: Execute Next Batch

Once Batch 1 complete, proceed to Batch 2:

```markdown
task(
  subagent_type="CoderAgent",
  description="Execute subtask 03",
  prompt="Read .tmp/tasks/feature/subtask_03.json and integrate..."
)
```

## Example: Converting Multiple Files

```markdown
I'll convert these 5 subagent files in parallel:

task(subagent_type="CoderAgent", description="Convert auth-agent",
     prompt="Convert .opencode/agent/subagents/auth-agent.md to new format...")

task(subagent_type="CoderAgent", description="Convert user-agent",
     prompt="Convert .opencode/agent/subagents/user-agent.md to new format...")

task(subagent_type="CoderAgent", description="Convert payment-agent",
     prompt="Convert .opencode/agent/subagents/payment-agent.md to new format...")

task(subagent_type="CoderAgent", description="Convert notification-agent",
     prompt="Convert .opencode/agent/subagents/notification-agent.md to new format...")

task(subagent_type="CoderAgent", description="Convert analytics-agent",
     prompt="Convert .opencode/agent/subagents/analytics-agent.md to new format...")
```

**Time savings**: 5 tasks × 10 min = 50 min sequential → ~10 min parallel (80% faster)

## Avoiding Conflicts

**✅ GOOD (isolated files):**
```markdown
task(CoderAgent, "Create src/auth/service.ts")
task(CoderAgent, "Create src/user/service.ts")
task(CoderAgent, "Create src/payment/service.ts")
```

**❌ BAD (same file):**
```markdown
task(CoderAgent, "Add auth function to src/utils/helpers.ts")
task(CoderAgent, "Add validation function to src/utils/helpers.ts")
```
This causes merge conflicts—run sequentially instead.

## Pre-Load Shared Context

Load context ONCE before parallel execution:

```markdown
# Load context BEFORE parallel tasks
Read: .opencode/context/core/standards/code-quality.md
Read: .opencode/context/core/standards/security-patterns.md

# Now all parallel tasks have same context
task(CoderAgent, "Implement auth service...")
task(CoderAgent, "Implement user service...")
```

DO NOT let each task discover context separately (slower).

## Error Handling

**Task fails during parallel execution:**
- Fix failed task before proceeding to next batch
- Other tasks in batch can still be used

**Tasks completing out of order:**
- Don't start next batch until ALL current batch complete
- Use dependency tracking in subtask JSON

**File conflicts:**
- Review task breakdown—ensure true isolation
- If tasks MUST touch same file, mark `parallel: false`

## Remember

- Make multiple task() calls in SINGLE message for parallel execution
- Tasks must be truly independent (no shared files/state)
- Pre-load shared context ONCE before parallel tasks
- Wait for ALL tasks in batch to complete before next batch
- Time savings: 50-80% reduction for multi-component features
- Optimal batch size: 2-4 tasks (up to 8 if truly independent)
- DO NOT parallelize tasks that modify same file
- DO NOT parallelize tasks with dependencies

## Related

- task-breakdown
- context-discovery
- code-execution

---

**Key Pattern**: Multiple independent task() calls in SAME message = parallel execution.
