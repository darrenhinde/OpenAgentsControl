# ContextScout Test Plan

## Test Coverage Analysis

### Current Test Status

| Test | Type | Coverage | Status | Issues |
|------|------|----------|--------|--------|
| smoke-test.yaml | Positive | Basic operation | ✅ Passing | Too simple - doesn't validate output quality |
| 02-discovery-test.yaml | Positive | Structure discovery | ⚠️ Needs validation | No assertions on output format |
| 03-search-standards.yaml | Positive | File search | ⚠️ Needs validation | No verification of line ranges |
| 04-content-extraction.yaml | Positive | Content extraction | ⚠️ Needs validation | No verification of key findings |
| 05-no-context-handling.yaml | Negative | Empty directory | ⚠️ Needs validation | Doesn't verify honest reporting |

### Test Coverage Gaps

**Missing Positive Tests:**
- ✅ Verify file paths are exact and valid
- ✅ Verify line ranges are accurate
- ✅ Verify priority ratings are appropriate
- ✅ Verify MVI compliance detection
- ✅ Verify function-based folder detection
- ✅ Verify loading order recommendations

**Missing Negative Tests:**
- ❌ Invalid path handling (non-existent directories)
- ❌ Malformed context files (invalid YAML, broken markdown)
- ❌ Ambiguous search queries
- ❌ Context files without clear structure
- ❌ Circular dependencies in context
- ❌ False positive prevention (claiming files exist that don't)

---

## Test Categories

### 1. Positive Tests (Happy Path)

**Purpose**: Verify ContextScout works correctly with valid inputs

#### Test: Valid Context Discovery
**Input**: "Find context for code standards"
**Expected Output**:
- ✅ Returns `.opencode/context/core/standards/code.md`
- ✅ Includes line ranges (e.g., "lines 22-27")
- ✅ Priority: ⭐⭐⭐⭐⭐ (Critical)
- ✅ Function type: Guide
- ✅ Key findings: 3-5 specific points
- ✅ Loading order: "Load this file NOW"

**Assertions**:
```yaml
assertions:
  - type: output_contains
    value: ".opencode/context/core/standards/code.md"
  - type: output_contains
    value: "lines"
  - type: output_contains
    value: "⭐⭐⭐⭐⭐"
  - type: output_contains
    value: "Key Findings"
```

#### Test: MVI-Aware Prioritization
**Input**: "Find context files, prioritize by MVI compliance"
**Expected Output**:
- ✅ Files <200 lines ranked higher
- ✅ Files with clear sections ranked higher
- ✅ Files with navigation README ranked higher
- ✅ Priority ratings reflect MVI compliance

**Assertions**:
```yaml
assertions:
  - type: custom
    validator: "verify_mvi_prioritization"
    description: "Files <200 lines should have higher priority"
```

#### Test: Function-Based Discovery
**Input**: "Find examples of how to write tests"
**Expected Output**:
- ✅ Searches `examples/` folder first
- ✅ Returns example files, not just guides
- ✅ Identifies function type: "Example"
- ✅ Provides minimal working code

**Assertions**:
```yaml
assertions:
  - type: output_contains
    value: "examples/"
  - type: output_contains
    value: "Type: Example"
```

---

### 2. Negative Tests (Error Handling)

**Purpose**: Verify ContextScout handles invalid inputs gracefully

#### Test: Non-Existent Directory
**Input**: "Find context in /fake/directory/that/does/not/exist"
**Expected Output**:
- ✅ Reports directory doesn't exist
- ✅ Doesn't fabricate results
- ✅ Suggests checking path
- ✅ No false positives

**Assertions**:
```yaml
assertions:
  - type: output_not_contains
    value: "Found context files"
  - type: output_contains
    value: "not found"
  - type: tool_not_called
    tool: "read"
    reason: "Should not attempt to read non-existent files"
```

#### Test: Ambiguous Query
**Input**: "Find stuff"
**Expected Output**:
- ✅ Asks for clarification
- ✅ Suggests specific search terms
- ✅ Doesn't return random files
- ✅ Provides examples of valid queries

**Assertions**:
```yaml
assertions:
  - type: output_contains
    value: "clarify"
  - type: output_contains
    value: "specific"
```

#### Test: Malformed Context File
**Input**: "Find context in directory with broken YAML frontmatter"
**Expected Output**:
- ✅ Reports file has issues
- ✅ Attempts to extract what it can
- ✅ Warns about malformed content
- ✅ Doesn't crash or hang

**Assertions**:
```yaml
assertions:
  - type: output_contains
    value: "malformed"
  - type: no_errors
    description: "Should handle gracefully without crashing"
```

#### Test: False Positive Prevention
**Input**: "Find API documentation"
**Expected Output**:
- ✅ Only returns files that actually exist
- ✅ Verifies file paths before reporting
- ✅ Doesn't hallucinate file names
- ✅ Uses glob/list to verify existence

**Assertions**:
```yaml
assertions:
  - type: all_paths_exist
    description: "Every file path mentioned must actually exist"
  - type: tool_called
    tool: "glob"
    reason: "Must verify files exist before claiming they do"
```

---

### 3. Edge Case Tests

**Purpose**: Verify ContextScout handles boundary conditions

#### Test: Empty Context Directory
**Input**: "Find context in empty .tmp/test-fixtures/empty/"
**Expected Output**:
- ✅ Reports no context found
- ✅ Suggests creating context structure
- ✅ Provides template/example
- ✅ Honest about lack of results

**Status**: ✅ Already implemented (05-no-context-handling.yaml)

#### Test: Very Large Context File (>1000 lines)
**Input**: "Extract key findings from large context file"
**Expected Output**:
- ✅ Identifies file is not MVI compliant
- ✅ Suggests splitting into smaller files
- ✅ Still extracts key findings
- ✅ Provides line ranges for sections

**Assertions**:
```yaml
assertions:
  - type: output_contains
    value: "MVI"
  - type: output_contains
    value: "lines"
```

#### Test: Circular Context Dependencies
**Input**: "Find context for X which depends on Y which depends on X"
**Expected Output**:
- ✅ Detects circular dependency
- ✅ Reports the cycle
- ✅ Suggests breaking the cycle
- ✅ Doesn't infinite loop

**Assertions**:
```yaml
assertions:
  - type: output_contains
    value: "circular"
  - type: timeout_not_exceeded
    max_duration: 30000
```

---

## Recommended Test Additions

### High Priority (Add These First)

1. **test-06-exact-paths.yaml** - Verify file paths are exact and valid
2. **test-07-line-ranges.yaml** - Verify line ranges are accurate
3. **test-08-false-positive.yaml** - Prevent hallucinated file paths
4. **test-09-invalid-path.yaml** - Handle non-existent directories
5. **test-10-ambiguous-query.yaml** - Handle vague requests

### Medium Priority

6. **test-11-mvi-detection.yaml** - Verify MVI compliance detection
7. **test-12-function-folders.yaml** - Verify function-based discovery
8. **test-13-priority-ratings.yaml** - Verify priority ratings are appropriate
9. **test-14-large-files.yaml** - Handle files >200 lines
10. **test-15-malformed-content.yaml** - Handle broken YAML/markdown

### Low Priority

11. **test-16-circular-deps.yaml** - Detect circular dependencies
12. **test-17-performance.yaml** - Verify response time <30s
13. **test-18-multiple-matches.yaml** - Handle multiple matching files
14. **test-19-no-readme.yaml** - Handle directories without README
15. **test-20-integration.yaml** - Full workflow test

---

## Test Quality Checklist

For each test, verify:

- [ ] **Clear purpose** - What specific behavior is being tested?
- [ ] **Specific assertions** - What exact output is expected?
- [ ] **Positive AND negative** - Tests both success and failure cases
- [ ] **No false positives** - Test would fail if agent misbehaves
- [ ] **No false negatives** - Test wouldn't fail for correct behavior
- [ ] **Fast execution** - Completes in <30 seconds
- [ ] **Deterministic** - Same input always produces same result
- [ ] **Independent** - Doesn't depend on other tests

---

## Current Test Issues

### Issue 1: Smoke Test Too Simple
**Problem**: Current smoke test just checks if agent responds, doesn't validate output quality
**Fix**: Add assertions for expected output format

### Issue 2: No Output Validation
**Problem**: Tests don't verify the actual content of responses
**Fix**: Add `assertions` section to each test with specific checks

### Issue 3: No False Positive Prevention
**Problem**: Tests don't verify agent isn't hallucinating file paths
**Fix**: Add test that verifies all mentioned paths actually exist

### Issue 4: No Negative Tests
**Problem**: Only 1 negative test (empty directory), need more
**Fix**: Add tests for invalid paths, ambiguous queries, malformed files

### Issue 5: No Performance Tests
**Problem**: No verification that ContextScout responds quickly
**Fix**: Add timeout assertions and performance benchmarks

---

## Next Steps

1. **Review current tests** - Analyze what they actually validate
2. **Add assertions** - Add specific output validation to existing tests
3. **Create negative tests** - Add 5 new negative test cases
4. **Run full suite** - Verify all tests pass
5. **Document results** - Update README with test coverage

---

**Last Updated**: 2026-01-07  
**Status**: Test plan created, implementation pending
