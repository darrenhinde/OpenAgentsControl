<!-- Context: workflows/delegation | Priority: high | Version: 2.0 | Updated: 2025-01-21 -->
# Delegation Context Template

## Quick Reference

**Process**: Create context → Populate → Delegate → Cleanup

**Location**: `.tmp/sessions/{timestamp}-{task-slug}/context.md`

**Template Sections**: Request, Requirements, Decisions, Files, Static Context, Constraints, Progress, Instructions

---

Use this template when creating temporary context files for task delegation.

## Template Structure

**Location**: `.tmp/sessions/{timestamp}-{task-slug}/context.md`

```markdown
# Task Context: {Task Name}

Session ID: {id}
Created: {timestamp}
Status: in_progress

## Current Request
{What user asked for}

## Requirements
- {requirement 1}
- {requirement 2}

## Decisions Made
- {decision 1 - approach/constraints}
- {decision 2}

## Files to Modify/Create
- {file 1} - {purpose}
- {file 2} - {purpose}
- {file 3} - {purpose}
- {file 4} - {purpose}

## Static Context Available
- .opencode/context/core/standards/code-quality.md (for code quality)
- .opencode/context/core/standards/test-coverage.md (for test requirements)
- .opencode/context/core/{standards|workflows}/{other-relevant}.md

## Constraints/Notes
{Important context, preferences, compatibility}

## Progress
- [ ] {task 1}
- [ ] {task 2}

---
**Instructions for Subagent:**
{Specific instructions on what to do}
```

## Delegation Process

**Step 1: Create temporary context**
- Location: `.tmp/sessions/{timestamp}-{task-slug}/context.md`
- Use template above

**Step 2: Populate context file**
- Fill in all sections with relevant details
- Reference static context files (don't duplicate content)

**Step 3: Delegate with context path**
```
Task: {brief description}
Context: .tmp/sessions/{id}/context.md

Read the context file for full details on requirements, decisions, and instructions.
Reference static context files as needed (lazy load).
```

**Step 4: Cleanup after completion**
- Ask user: "Task complete. Clean up session files at .tmp/sessions/{id}/?"
- If approved: Delete session directory
