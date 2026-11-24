---
name: test-generation
description: Use when the user asks for tests, mentions TDD, or when new code has been written and needs test coverage.
context: fork
agent: test-engineer
---

# Test Generation

## Overview
Generate comprehensive tests following TDD principles and project testing standards. Runs in isolated test-engineer context with pre-loaded testing conventions.

**Announce at start:** "I'm using the test-generation skill to create tests for [feature/component]."

## The Process

### Step 1: Specify Test Requirements

Provide clear requirements to test-engineer:

```markdown
/test-generation

Feature: JWT token validation middleware

Behaviors:
1. Valid token → allow request
2. Expired token → reject with 401
3. Invalid signature → reject with 401
4. Missing token → reject with 401

Coverage: All critical paths

Testing Standards (pre-loaded):
- Framework: vitest
- Mocks: vi.mock()
- Structure: AAA pattern
```

### Step 2: Review Test Plan

Test-engineer proposes a test plan:

```markdown
## Test Plan

Behaviors:
1. Valid token
   - ✅ Positive: Allow request with valid JWT
   - ❌ Negative: Reject malformed JWT
2. Expired token
   - ✅ Positive: Normal token works
   - ❌ Negative: Expired token rejected with 401

Mocking Strategy:
- JWT verification: Mock with vi.mock()
- Request/Response: Use test doubles

Coverage Target: 95% line coverage, all critical paths
```

**IMPORTANT**: Review and approve before implementation proceeds.

### Step 3: Implement Tests

Test-engineer implements following AAA pattern (Arrange-Act-Assert):

```typescript
describe('JWT Middleware', () => {
  it('allows request with valid token', () => {
    // Arrange
    const req = mockRequest({ headers: { authorization: 'Bearer valid.jwt.token' } });
    
    // Act
    const result = jwtMiddleware(req);
    
    // Assert
    expect(result.authorized).toBe(true);
  });
});
```

### Step 4: Run Self-Review

Test-engineer verifies:
- ✅ Positive AND negative tests for each behavior
- ✅ AAA pattern followed
- ✅ All external dependencies mocked
- ✅ Tests are deterministic (no flakiness)
- ✅ Standards compliance

### Step 5: Run Tests

Execute test suite and verify all pass:

```bash
npm test -- jwt.middleware.test.ts
```

### Step 6: Return Results

```yaml
status: success
tests_written: 8
coverage:
  lines: 96%
  branches: 93%
  functions: 100%
behaviors_tested:
  - name: "Valid token handling"
    positive_tests: 2
    negative_tests: 2
test_results:
  passed: 8
  failed: 0
deliverables:
  - "src/auth/jwt.middleware.test.ts"
```

## TDD Workflow

For test-driven development, invoke BEFORE implementation:

```markdown
/test-generation

Write tests for user registration endpoint (not yet implemented):

Expected Behavior:
- POST /api/register with valid data → 201 + user object
- POST /api/register with duplicate email → 409 error
- POST /api/register with invalid email → 400 error

Note: Implementation does not exist. Write tests that define expected behavior.
```

Tests will fail initially—use them as spec to guide implementation.

## Error Handling

**Tests don't match project conventions:**
- Main agent must pre-load `.opencode/context/core/standards/tests.md`

**Missing edge cases:**
- Specify explicitly in requirements

**Flaky tests:**
- Ensure all external dependencies mocked

## Red Flags

If you think any of these, STOP and re-read this skill:

- "The implementation is simple enough that tests aren't needed"
- "I'll just write the happy path tests for now"
- "Mocking is too complex for this dependency"
- "I'll add tests after the feature is stable"

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "It's too simple to break" | Simple code breaks in simple ways. Tests document the contract, not just catch bugs. |
| "Negative tests are obvious failures, not worth writing" | Negative tests are where bugs hide. "Obviously fails" is not the same as "correctly fails". |
| "Mocking this dependency is too hard" | Hard-to-mock dependencies are a design smell. Mock them anyway and note the smell. |
| "Tests slow down delivery" | Tests without negative cases give false confidence. False confidence slows delivery more. |

## Remember

- Pre-load testing standards BEFORE invoking skill
- Specify clear behaviors and acceptance criteria
- Review test plan before implementation
- Both positive AND negative tests required
- All external dependencies MUST be mocked (no real network/DB calls)
- AAA pattern (Arrange-Act-Assert) mandatory
- Tests must be deterministic (no randomness or time dependencies)

## Related

- code-execution
- code-review
- context-discovery
