# Core Test Suite - Minimum Viable Tests

**Purpose:** Minimum tests needed to validate OpenAgent's 4 critical rules  
**Total:** 8 core tests (down from 49)

---

## Core Tests (8 tests)

### 1. Approval Gate (2 tests)
- ✅ `05-approval-before-execution-positive.yaml` - Standard approval workflow
- ❌ `02-missing-approval-negative.yaml` - Should fail without approval

### 2. Context Loading (3 tests)
- ✅ `01-code-task.yaml` - Code task loads code.md
- ✅ `02-docs-task.yaml` - Docs task loads docs.md
- ❌ `11-wrong-context-file-negative.yaml` - Should fail with wrong context

### 3. Stop on Failure (2 tests)
- ✅ `02-stop-and-report-positive.yaml` - Stops and reports
- ❌ `03-auto-fix-negative.yaml` - Should fail if auto-fixes

### 4. Report First (1 test)
- ✅ `01-correct-workflow-positive.yaml` - Report→Propose→Approve→Fix

---

## Why These 8 Tests?

**Approval Gate (2 tests):**
- Positive: Validates approval BEFORE execution works
- Negative: Validates missing approval is caught

**Context Loading (3 tests):**
- Code task: Most common use case
- Docs task: Second most common
- Wrong context: Validates evaluator catches wrong file

**Stop on Failure (2 tests):**
- Positive: Validates agent stops on error
- Negative: Validates auto-fix is caught

**Report First (1 test):**
- Validates Report→Propose→Approve→Fix workflow

---

## What We're NOT Testing (Can Add Later)

- Conversational path (3 tests)
- Multi-turn context (2 tests)
- Delegation (2 tests)
- Edge cases (3 tests)
- Integration (6 tests)
- Behavior validation (4 tests)
- Tool usage (2 tests)

**Total skipped:** 22 tests

---

## Token Optimization

**Full Suite:** 49 tests × ~7,000 tokens = ~343,000 tokens  
**Core Suite:** 8 tests × ~7,000 tokens = ~56,000 tokens  

**Savings:** 84% reduction in tokens
