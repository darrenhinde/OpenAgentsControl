# OpenCoder ContextScout Integration Tests

**Purpose**: Validate that OpenCoder uses ContextScout proactively when encountering unfamiliar patterns or domain-specific requirements.

**Created**: 2026-01-09  
**Status**: Ready to Run

---

## Test Suite Overview

### Test 1: Implicit Pattern Discovery 🔍
**File**: `01-implicit-pattern-discovery.yaml`

**Scenario**: "Add a new evaluator to the eval framework"

**Validates**:
- OpenCoder recognizes unfamiliar domain (eval framework)
- OpenCoder delegates to ContextScout WITHOUT being told
- OpenCoder loads discovered context files
- OpenCoder applies discovered patterns to implementation

**Expected Behavior**:
- ✅ Delegates to ContextScout automatically
- ✅ Loads eval framework context
- ✅ Proposes plan following discovered patterns
- ✅ Requests approval before implementation
- ✅ Implements code matching framework patterns

**This test SHOULD FAIL if**:
- ❌ OpenCoder doesn't use ContextScout (guesses patterns)
- ❌ OpenCoder implements without loading context
- ❌ OpenCoder uses wrong patterns (not from context)

---

## Running Tests

### Run All OpenCoder Integration Tests
```bash
cd evals/framework
npm run eval:sdk -- --agent=core/opencoder --pattern="contextscout-integration/*.yaml"
```

### Run Individual Test
```bash
npm run eval:sdk -- --agent=core/opencoder --pattern="01-implicit-pattern-discovery.yaml"
```

### Run with Debug
```bash
npm run eval:sdk -- --agent=core/opencoder --debug --pattern="01-implicit-pattern-discovery.yaml"
```

---

## Success Criteria

### OpenCoder is "Using ContextScout Correctly" if:

1. ✅ **Proactive**: Uses ContextScout without being told
2. ✅ **Recognition**: Recognizes unfamiliar domains (eval framework, registry, etc.)
3. ✅ **Context-First**: Loads context BEFORE implementation
4. ✅ **Pattern Application**: Applies discovered patterns in code
5. ✅ **Approval Gate**: Still requests approval before implementation

### OpenCoder is "Not Using ContextScout" if:

1. ❌ **Guessing**: Implements without discovering patterns
2. ❌ **Wrong Patterns**: Uses patterns not from discovered context
3. ❌ **Skipping Discovery**: Doesn't delegate to ContextScout for unfamiliar domains
4. ❌ **Inconsistent**: Sometimes uses ContextScout, sometimes doesn't

---

## Expected Outcome

### Test 1: Implicit Pattern Discovery
```
✅ PASS

Workflow:
1. User: "Add a new evaluator to the eval framework"
2. OpenCoder: Recognizes "eval framework" as unfamiliar domain
3. OpenCoder: Delegates to ContextScout (WITHOUT being told)
4. ContextScout: Finds eval framework context files
5. OpenCoder: Loads discovered files
6. OpenCoder: Proposes plan following discovered patterns
7. User: Approves
8. OpenCoder: Implements evaluator matching framework patterns

Key Validations:
✅ Used task tool to delegate to ContextScout
✅ Loaded context files before implementation
✅ Proposed plan mentions discovered patterns
✅ Requested approval before implementation
✅ Implementation matches eval framework patterns
```

---

## Debugging Failed Tests

### If Test Fails: OpenCoder Didn't Use ContextScout

**Problem**: OpenCoder implemented without discovering patterns

**Check**:
1. Did OpenCoder use task tool to delegate to ContextScout?
2. Did OpenCoder load any context files?
3. Did OpenCoder mention "eval framework" patterns in plan?

**Possible Causes**:
- OpenCoder prompt doesn't emphasize ContextScout usage
- OpenCoder doesn't recognize "eval framework" as unfamiliar
- OpenCoder skips discovery for efficiency

**Fix**:
- Update OpenCoder prompt to emphasize proactive ContextScout usage
- Add more examples of when to use ContextScout
- Make ContextScout usage more explicit in workflow

---

### If Test Fails: OpenCoder Used Wrong Patterns

**Problem**: OpenCoder implemented but patterns don't match framework

**Check**:
1. Did OpenCoder load eval framework context?
2. Did OpenCoder read the discovered files?
3. Does implementation match patterns from context files?

**Possible Causes**:
- OpenCoder loaded context but didn't apply it
- OpenCoder used generic patterns instead of framework-specific
- Context files don't contain clear patterns

**Fix**:
- Emphasize "apply discovered patterns" in OpenCoder prompt
- Improve context files to include clearer pattern examples
- Add validation step to check pattern matching

---

## Related Documentation

- [OpenCoder Agent](.opencode/agent/core/opencoder.md)
- [ContextScout Agent](.opencode/agent/ContextScout.md)
- [OpenAgent Integration Tests](../../openagent/tests/contextscout-integration/)
- [ContextScout Tests](../../../ContextScout/tests/)

---

**Key Insight**: OpenCoder should proactively use ContextScout when encountering unfamiliar domains or patterns, ensuring implementations match project standards and framework patterns.
