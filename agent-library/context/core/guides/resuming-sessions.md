<!-- Context: core/guides | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Guide: Resuming Multi-Session Tasks

**Purpose**: How to resume work from previous sessions using session context and task files

**Last Updated**: 2026-02-04

---

## When to Use This Guide

- Continuing work after a break or interruption
- Picking up a task from another agent or developer
- Understanding what was done in a previous session
- Avoiding duplicate work or lost progress

---

## Session File Structure

```
.tmp/
├── sessions/                      # Session context
│   └── {YYYY-MM-DD}-{task-slug}/
│       ├── context.md             # Full task context
│       └── PROGRESS.md            # Progress report
│
└── tasks/                         # Task breakdowns
    └── {task-slug}/
        ├── task.json              # Main task definition
        └── subtask_NN.json        # Individual subtasks
```

---

## Quick Resume Steps

### 1. Find Your Session (30 seconds)

```bash
# List recent sessions
ls -lt .tmp/sessions/ | head -5

# Most recent session
SESSION=$(ls -t .tmp/sessions/ | head -1)
echo "Latest session: $SESSION"
```

---

### 2. Read Progress Report (2 minutes)

```bash
# View progress
cat .tmp/sessions/$SESSION/PROGRESS.md
```

**Look for**:
- ✅ **Completed Work** - What's already done
- 🔥 **Next Steps** - What to do next
- 📊 **Overall Progress** - How much is complete
- ⚠️ **Blockers** - Any issues to resolve

---

### 3. Check Task Context (3 minutes)

```bash
# View full context
cat .tmp/sessions/$SESSION/context.md
```

**Key sections**:
- **Current Request** - What was asked for
- **Context Files** - Standards to follow (CRITICAL)
- **Reference Files** - Existing code to read
- **Components** - What needs to be built
- **Exit Criteria** - When you're done

---

### 4. Review Subtasks (2 minutes)

```bash
# Find task directory
TASK_DIR=.tmp/tasks/$(basename $SESSION | cut -d'-' -f4-)

# List subtasks
ls $TASK_DIR/subtask_*.json

# View next subtask
cat $TASK_DIR/subtask_04.json  # Example
```

**Subtask format**:
```json
{
  "id": "04",
  "name": "Migrate AgentLoader",
  "description": "Create src/core/AgentLoader.ts with load/parse functions",
  "estimated_hours": 1.5,
  "status": "pending",
  "dependencies": ["02"],
  "context_files": ["...standards to load..."],
  "acceptance_criteria": ["...checklist..."]
}
```

---

## Resume Workflow

### Option 1: Continue from Last Checkpoint

```bash
# 1. Check what's done
grep "✅" .tmp/sessions/$SESSION/PROGRESS.md

# 2. Find next task
grep "🔥 NEXT" .tmp/sessions/$SESSION/PROGRESS.md

# 3. Tell the agent
"Continue with subtask 04 from session $SESSION"
```

---

### Option 2: Jump to Specific Phase

```bash
# 1. View phase structure
cat .tmp/tasks/$TASK_DIR/task.json | jq '.phases'

# 2. Find phase tasks
cat .tmp/tasks/$TASK_DIR/task.json | jq '.phases[1]'  # Phase 2

# 3. Tell the agent
"Start Phase 2 - Adapters from session $SESSION"
```

---

### Option 3: Review and Decide

```bash
# 1. Quick status
cat .tmp/sessions/$SESSION/PROGRESS.md | grep -A5 "Overall Progress"

# 2. View completed work
cat .tmp/sessions/$SESSION/PROGRESS.md | grep -A20 "Completed Work"

# 3. Discuss with agent
"Show me the current status of session $SESSION and suggest next steps"
```

---

## Key Files to Read

### context.md (ALWAYS)

**Why**: Contains standards you MUST follow

```markdown
## Context Files (Standards to Follow)
- .opencode/context/core/standards/code-quality.md - CRITICAL
- .opencode/context/core/standards/test-coverage.md - CRITICAL
```

**Before writing any code**, load these standards!

---

### PROGRESS.md (RECOMMENDED)

**Why**: Shows exactly what's done and what's next

**Key sections**:
- **Overall Progress** - % complete, phases
- **Completed Work** - Files created, tasks done
- **Next Steps** - What to do immediately
- **Blockers** - Issues to resolve

---

### subtask_NN.json (WHEN NEEDED)

**Why**: Detailed task definition with acceptance criteria

**Use when**:
- Starting a new subtask
- Need to know exact requirements
- Want to see dependencies

---

## Common Scenarios

### Scenario 1: "I don't remember where I was"

```bash
# Quick catch-up
cat .tmp/sessions/$SESSION/PROGRESS.md | head -50
# Read: Overall Progress + Completed Work + Next Steps
```

**Time**: 2 minutes

---

### Scenario 2: "What was I supposed to build?"

```bash
# Read original request
cat .tmp/sessions/$SESSION/context.md | grep -A20 "Current Request"

# Read components
cat .tmp/sessions/$SESSION/context.md | grep -A30 "Components"
```

**Time**: 3 minutes

---

### Scenario 3: "What standards should I follow?"

```bash
# Read context files list
cat .tmp/sessions/$SESSION/context.md | grep -A15 "Context Files"

# Load the standards
cat .opencode/context/core/standards/code-quality.md
```

**Time**: 5 minutes

---

### Scenario 4: "How do I know when I'm done?"

```bash
# Read exit criteria
cat .tmp/sessions/$SESSION/context.md | grep -A20 "Exit Criteria"
```

**Time**: 1 minute

---

## Agent Instructions

When resuming a session, tell the agent:

```
"Resume session: {SESSION_ID}"
```

Or more specific:

```
"Continue with subtask 04 from session 2026-02-04-compatibility-layer-141"
```

The agent should:
1. ✅ Read context.md for standards
2. ✅ Read PROGRESS.md for current state
3. ✅ Load next subtask JSON
4. ✅ Load required context files (from subtask.context_files)
5. ✅ Propose next steps
6. ✅ Request approval before executing

---

## Session Lifecycle

### Active Session
- Created when task starts
- Updated after each subtask completes
- Contains live progress tracking

### Completed Session
- All subtasks marked complete
- Exit criteria met
- Ready for archival

### Archived Session
- Moved to `.tmp/archive/sessions/{date}/`
- Knowledge harvested to permanent context
- Task JSONs can be deleted

---

## Cleanup Checklist

After completing a session:

- [ ] All exit criteria met?
- [ ] Valuable knowledge harvested to context?
- [ ] Session files archived?
- [ ] Task JSONs cleaned up?
- [ ] Temporary files deleted?

---

## Best Practices

1. **Always read context.md first** - Contains critical standards
2. **Check PROGRESS.md before asking** - Likely has the answer
3. **Use subtask JSONs for detailed requirements** - Not just memory
4. **Update PROGRESS.md after each task** - Keep it current
5. **Archive when done** - Don't clutter workspace

---

## Reference

- **Session Template**: `.tmp/sessions/{YYYY-MM-DD}-{task-slug}/`
- **Task Template**: `.tmp/tasks/{task-slug}/`
- **Related**:
  - standards/code-quality.md (what to follow)
