# WIP: Delegation Controller - Where We Left Off

**Date**: 2026-01-18  
**Branch**: `feature/delegation-controller`  
**Status**: PAUSED - Reviewing approach

## Original Problem

Agents sometimes miss:
1. When to delegate to TaskManager (4+ files, complex features)
2. When to update task status (mark in_progress, completed)

## What We Built

### Files Created:
- `.opencode/agent/subagents/core/delegation-controller.md` (410 lines)
- `.opencode/context/core/delegation/navigation.md` (130 lines)
- `.opencode/context/core/delegation/routing-patterns.md` (324 lines)
- `.opencode/context/core/delegation/validation-checks.md` (419 lines)
- Test suite: 3 YAML tests
- Framework integration: test-runner.ts, run-sdk-tests.ts

**Total**: ~1,300 lines of code

### Design:
- Two-phase agent:
  - **Phase 1 (Routing)**: Pre-approval routing decisions
  - **Phase 2 (Validation)**: Post-execution validation
- Temperature 0.1 for fast, deterministic decisions
- Context-driven via @ symbol
- JSON output format

### Test Results:
- ❌ First test failed: Agent called ContextScout instead of loading context directly
- ❌ Test timed out (32s)
- ❌ Violations: missing approval, wrong context file

## Critical Realization

**This is over-engineered.**

### Problems Identified:
1. **Added complexity** - 3 agents instead of 1 (OpenAgent → DelegationController → TaskManager)
2. **Extra latency** - Another LLM call (5-10s per decision)
3. **Doesn't fix root cause** - If OpenAgent can't follow rules, why would it call DelegationController?
4. **Maintenance burden** - 1,300 lines to maintain vs fixing OpenAgent prompt

### Key Question:
**Is the problem that agents CAN'T follow rules, or that the rules are UNCLEAR?**

If rules are unclear → Fix the rules (simpler)  
If agents can't follow clear rules → We have a model capability problem

## Alternative Approaches Discussed

### Option A: **Improve OpenAgent Prompt** (Recommended)
Add clear visual decision tree:
```markdown
<delegation_decision_tree>
  BEFORE Stage 2 (Approve), check:
  
  ┌─ Files involved >= 4? ────→ YES → MUST delegate to TaskManager
  │
  ├─ Multi-component feature? → YES → MUST delegate to TaskManager
  │
  └─ Otherwise ──────────────→ Execute directly
</delegation_decision_tree>
```

**Pros**: No new agent, immediate fix, simpler  
**Cons**: Doesn't solve "agents ignore rules" if that's the real issue

### Option B: **Validation-Only Agent** (Focused)
Skip routing. Just validate AFTER execution:
- Input: What happened
- Check: Did agent follow rules?
- Output: "OK" or "Issue: X"

**Pros**: Catches mistakes, simpler (50 lines)  
**Cons**: Reactive, not proactive

### Option C: **Structured Workflow Files** (No Agent)
JSON rules that OpenAgent loads mechanically.

**Pros**: Deterministic, fast, no LLM call  
**Cons**: Less flexible

### Option D: **Task Status Reminder** (Minimal)
Just add protocol to OpenAgent for task status updates.

**Pros**: Dead simple  
**Cons**: Only addresses task status, not delegation

## Recommended Next Steps

1. **Pause DelegationController development**
2. **Test hypothesis**: Try improving OpenAgent prompt first
3. **Measure**: Does clearer prompt reduce delegation/status mistakes?
4. **Decide**: If prompt fixes don't work, revisit controller approach

## Files to Keep/Delete

### Keep (for reference):
- This WIP-NOTES.md
- Context files (good patterns documented)

### Consider deleting:
- delegation-controller.md agent (too complex)
- Test suite (if we don't proceed)
- Framework integration changes

## Questions to Answer Before Proceeding

1. Do we have data on HOW OFTEN agents miss delegation decisions?
2. Is it a pattern recognition issue or a rule-following issue?
3. Would a simpler checklist/reminder work?
4. Is the two-phase approach (routing + validation) necessary?

## Conversation Context

User asked: "Can we make a commit but add where we left off"

This document serves as that record. The code is uncommitted but preserved on this branch for future reference.

---

**Next session**: Review this document and decide:
- Fix OpenAgent prompt (simple)
- Build minimal validator (focused)
- Continue with DelegationController (complex)
- Abandon approach entirely
