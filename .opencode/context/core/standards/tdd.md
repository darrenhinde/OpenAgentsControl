# TDD Standards

> **Purpose**: Mandate test-first development for all coding tasks. No implementation without tests.

## TDD Definition

Test-Driven Development (TDD) is a **mandatory** development practice, not optional.

### Red-Green-Refactor Sequence

```
1. RED:    Write a failing test that defines expected behavior
2. GREEN:  Write minimal implementation to make test pass
3. REFACTOR: Clean up code while maintaining test coverage
```

**Critical**: Steps must occur in order. You cannot skip to GREEN without RED.

---

## Critical Rules

<rule id="test_first">
  BEFORE writing implementation code for ANY deliverable, verify test exists and is failing.
  If no test exists → write minimal failing test first (Red phase).
  If test exists but passes → fix test to expect correct behavior.
</rule>

<rule id="test_or_skip">
  If a deliverable has NO testable behavior (e.g., config file, static asset), explicitly document why in the subtask completion notes.
  All code deliverables require tests. Document exceptions.
</rule>

<rule id="green_enough">
  Implement ONLY what makes the test pass. No over-engineering, no future-proofing.
  Write the simplest solution that satisfies the test.
</rule>

<rule id="refactor_after">
  Refactor ONLY after test is green. Never refactor failing tests.
  Maintain all existing test coverage during refactor.
</rule>

<rule id="never_skip_tests">
  NEVER mark a subtask complete if tests are missing, failing, or not yet written.
  Completion requires: tests written + tests passing.
</rule>

---

## Test Type Matrix

| Deliverable Type | Required Test(s) | Test Location |
|-----------------|------------------|---------------|
| Utility function | Unit test (Vitest) | `src/utils/*.test.ts` |
| React component | Component test + E2E if interactive | `src/**/*.test.tsx` + `e2e/*.spec.ts` |
| API endpoint | Unit test + E2E | `src/**/*.test.ts` + `e2e/*.spec.ts` |
| Zustand store | Unit test | `src/stores/*.test.ts` |
| Custom hook | Unit test | `src/hooks/*.test.ts` |
| Type definition | No test required | N/A |
| Config file | No test required | N/A |
| Static asset | No test required | N/A |

---

## Test Quality Requirements

### Positive and Negative Tests

Every testable behavior MUST have:
- **Positive test**: Expected success case
- **Negative test**: Expected failure/edge case

```
Example:
- Positive: should return user data when valid ID provided
- Negative: should throw error when invalid ID provided
```

### Arrange-Act-Assert Pattern

ALL tests must follow AAA structure:

```typescript
// ARRANGE: Set up test data and conditions
const input = { id: '123', name: 'Test' };

// ACT: Execute the behavior being tested
const result = processUser(input);

// ASSERT: Verify the expected outcome
expect(result).toEqual({ id: '123', name: 'Test' });
```

### Mock External Dependencies

All external dependencies MUST be mocked:
- API calls (fetch, axios)
- localStorage/sessionStorage
- Browser APIs (window, document)
- Third-party libraries

Tests must be **deterministic** — no network flakiness, no time-dependent assertions.

---

## TDD Workflow in Subtasks

### For Each Deliverable:

1. **Check if test exists**
   - Scan for existing test file matching deliverable name
   - If missing → create new test file with failing test

2. **Verify test is in RED state**
   - Run test: it should FAIL
   - If test passes → fix assertion to expect correct behavior

3. **Write minimal implementation**
   - Only enough code to make test pass
   - No extra features, no future-proofing

4. **Run test → should be GREEN**
   - If fails → continue implementing until pass

5. **Refactor if needed**
   - Clean up while maintaining test coverage
   - Re-run tests to confirm still green

6. **Verify all tests pass**
   - Run full test suite
   - Confirm no regressions

---

## Blocking Rules for CoderAgent

CoderAgent MUST NOT mark subtask complete if ANY of these conditions exist:

- [ ] Test file missing for deliverable
- [ ] Test exists but not yet run
- [ ] Tests failing (not in GREEN state)
- [ ] No documentation for why deliverable has no test

**Self-Review must include test verification:**

```
Self-Review: ✅ Types clean | ✅ Imports verified | ✅ No debug artifacts | ✅ All acceptance criteria met | ✅ Tests RED→GREEN | ✅ External libs verified
```

---

## Context Discovery

When ContextScout loads context for a task:
1. Load `standards/tdd.md` (this file) — MANDATORY
2. Load `standards/code-quality.md` — for code style
3. Load project-specific test patterns from `context/`

All agents must acknowledge TDD standards before implementing.
