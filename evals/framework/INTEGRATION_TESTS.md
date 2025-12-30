# Integration Tests - Eval Pipeline

## Overview

Comprehensive integration tests for the OpenCode evaluation framework that validate the complete pipeline from test execution through evaluation and reporting.

## Test File

**Location**: `src/__tests__/eval-pipeline-integration.test.ts`

**Test Count**: 14 comprehensive integration tests

**Status**: ✅ All tests passing (14/14)

## Test Coverage

### 1. Single Test Execution (3 tests)

Tests basic test case execution and evaluation:

- **Simple test case end-to-end**: Validates basic prompt execution, event capture, evaluation, and scoring
- **Test with tool execution**: Validates tool execution detection and evaluation
- **Approval gate violations**: Validates approval denial detection

### 2. Multiple Test Execution (1 test)

Tests batch execution capabilities:

- **Execute multiple tests in sequence**: Validates sequential test execution with proper session isolation

### 3. Evaluator Integration (2 tests)

Tests evaluator coordination and aggregation:

- **Multiple evaluators on same session**: Validates that multiple evaluators can analyze the same session
- **Violation aggregation**: Validates that violations from multiple evaluators are properly aggregated and counted

### 4. Session Data Collection (2 tests)

Tests session data collection and timeline building:

- **Complete session timeline**: Validates timeline building from session data
- **Session with no tool execution**: Validates handling of text-only sessions

### 5. Error Handling (2 tests)

Tests error scenarios and edge cases:

- **Test timeout handling**: Validates graceful timeout handling
- **Invalid session ID**: Validates error handling for non-existent sessions

### 6. Result Validation (2 tests)

Tests result structure and validation:

- **Result structure validation**: Validates complete result object structure
- **Overall score calculation**: Validates score aggregation from multiple evaluators

### 7. Report Generation (2 tests)

Tests report generation capabilities:

- **Text report generation**: Validates single-session report generation
- **Batch summary report**: Validates multi-session summary generation

## Running the Tests

### Run Integration Tests Only

```bash
cd evals/framework
SKIP_INTEGRATION=false npm test -- src/__tests__/eval-pipeline-integration.test.ts --run
```

### Run All Tests (Including Integration)

```bash
cd evals/framework
SKIP_INTEGRATION=false npm test -- --run
```

### Skip Integration Tests (Default)

Integration tests are skipped by default in CI environments and when `SKIP_INTEGRATION=true`:

```bash
cd evals/framework
npm test -- --run  # Integration tests skipped
```

## Test Requirements

Integration tests require:

1. **OpenCode CLI installed**: The `opencode` command must be available
2. **Running server**: Tests start their own server instance
3. **Network access**: Tests communicate with the local server
4. **Time**: Integration tests take ~60 seconds to complete

## Test Architecture

### Components Tested

1. **TestRunner**: Orchestrates test execution
2. **TestExecutor**: Executes individual test cases
3. **SessionReader**: Reads session data from storage
4. **TimelineBuilder**: Builds event timelines from sessions
5. **EvaluatorRunner**: Runs evaluators and aggregates results
6. **Individual Evaluators**: ApprovalGate, ContextLoading, ToolUsage, etc.

### Test Flow

```
Test Case → TestRunner → TestExecutor → Agent Execution
                                              ↓
                                        Session Data
                                              ↓
                                     SessionReader
                                              ↓
                                    TimelineBuilder
                                              ↓
                                    EvaluatorRunner
                                              ↓
                                    Multiple Evaluators
                                              ↓
                                    Aggregated Results
                                              ↓
                                    Report Generation
```

## Key Validations

### Execution Phase

- ✅ Session creation and management
- ✅ Event stream handling
- ✅ Approval strategy execution
- ✅ Tool execution detection
- ✅ Timeout handling
- ✅ Error handling

### Evaluation Phase

- ✅ Timeline building from session data
- ✅ Multiple evaluators running on same session
- ✅ Violation detection and tracking
- ✅ Evidence collection
- ✅ Score calculation
- ✅ Pass/fail determination

### Reporting Phase

- ✅ Result structure validation
- ✅ Violation aggregation
- ✅ Score aggregation
- ✅ Text report generation
- ✅ Batch summary generation

## Test Isolation

Each test:

- Creates its own session
- Runs independently
- Cleans up after completion
- Does not affect other tests

Sessions are tracked in `sessionIds` array and cleaned up in `afterAll` hook.

## Performance

- **Total Duration**: ~60 seconds for all 14 tests
- **Average per test**: ~4 seconds
- **Longest test**: Batch execution (~8 seconds)
- **Shortest test**: Error handling (~2 seconds)

## Debugging

To enable debug output:

```bash
cd evals/framework
DEBUG_VERBOSE=true SKIP_INTEGRATION=false npm test -- src/__tests__/eval-pipeline-integration.test.ts --run
```

This will show:

- Detailed event logs
- Evaluator execution details
- Session data
- Timeline events
- Violation details

## Future Enhancements

Potential additions to integration tests:

1. **Multi-turn conversation tests**: Test complex multi-message interactions
2. **Delegation tests**: Test subagent delegation scenarios
3. **Context loading tests**: Test context file loading and validation
4. **Performance benchmarks**: Test execution speed and resource usage
5. **Parallel execution**: Test concurrent test execution
6. **Custom evaluator tests**: Test custom evaluator registration and execution

## Related Documentation

- [Eval Framework README](./README.md)
- [Creating Tests Guide](../CREATING_TESTS.md)
- [Migration Guide](../MIGRATION_GUIDE.md)
- [Subagent Testing](../SUBAGENT_TESTING.md)
