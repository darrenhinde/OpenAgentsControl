# OpenAgent Test Folder Structure

## Design Principles

1. **Organized by Priority & Complexity** - Critical rules first, then by test complexity
2. **Manageable Execution** - Complex tests isolated with appropriate timeouts
3. **Safe File Creation** - All file operations use `evals/test_tmp/` or `.tmp/`
4. **Scalable** - Easy to add new tests in the right category
5. **Clear Naming** - Folder names indicate purpose and execution characteristics

## Folder Structure

```
evals/agents/openagent/tests/
├── 01-critical-rules/          # Tier 1: Critical rules (MUST pass)
│   ├── approval-gate/          # @approval_gate rule tests
│   ├── context-loading/        # @critical_context_requirement tests
│   ├── stop-on-failure/        # @stop_on_failure rule tests
│   ├── report-first/           # @report_first rule tests
│   └── confirm-cleanup/        # @confirm_cleanup rule tests
│
├── 02-workflow-stages/         # Tier 2: Workflow validation
│   ├── analyze/                # Stage 1: Analyze
│   ├── approve/                # Stage 2: Approve
│   ├── execute/                # Stage 3: Execute (routing, context loading)
│   ├── validate/               # Stage 4: Validate
│   ├── summarize/              # Stage 5: Summarize
│   └── confirm/                # Stage 6: Confirm
│
├── 03-delegation/              # Delegation scenarios
│   ├── scale/                  # 4+ files delegation
│   ├── expertise/              # Specialized knowledge delegation
│   ├── complexity/             # Multi-step dependencies
│   ├── review/                 # Multi-component review
│   └── context-bundles/        # Context bundle creation/passing
│
├── 04-execution-paths/         # Conversational vs Task paths
│   ├── conversational/         # Pure questions (no approval)
│   ├── task/                   # Execution tasks (requires approval)
│   └── hybrid/                 # Mixed scenarios
│
├── 05-edge-cases/              # Edge cases and boundary conditions
│   ├── tier-conflicts/         # Tier 1 vs Tier 2/3 priority conflicts
│   ├── boundary/               # Boundary conditions (exactly 4 files, etc.)
│   ├── overrides/              # "Just do it" and other overrides
│   └── negative/               # Negative tests (what should NOT happen)
│
└── 06-integration/             # Complex multi-turn scenarios
    ├── simple/                 # 1-2 turns, single context
    ├── medium/                 # 3-5 turns, multiple contexts
    └── complex/                # 6+ turns, delegation + validation
```

## Timeout Guidelines by Category

### Critical Rules (01-critical-rules/)
- **Simple tests**: 60s (60000ms)
- **Multi-turn tests**: 120s (120000ms)
- **Rationale**: Core functionality, should be fast

### Workflow Stages (02-workflow-stages/)
- **Simple tests**: 60s
- **Multi-turn tests**: 120s
- **Complex validation**: 180s (180000ms)

### Delegation (03-delegation/)
- **Simple delegation**: 90s (90000ms)
- **With context bundles**: 120s
- **Complex multi-agent**: 180s
- **Rationale**: Delegation involves subagent coordination

### Execution Paths (04-execution-paths/)
- **Conversational**: 30s (30000ms)
- **Task execution**: 60s
- **Hybrid**: 90s

### Edge Cases (05-edge-cases/)
- **Simple edge cases**: 60s
- **Complex edge cases**: 120s

### Integration (06-integration/)
- **Simple (1-2 turns)**: 120s
- **Medium (3-5 turns)**: 180s
- **Complex (6+ turns)**: 300s (5 minutes)
- **Rationale**: Multi-turn scenarios need time for user interaction simulation

## File Creation Rules

All tests MUST use these paths for file creation:

### Temporary Test Files
```yaml
# ✅ CORRECT
prompt: |
  Create a file at evals/test_tmp/test-output.txt

# ❌ WRONG
prompt: |
  Create a file at /tmp/test-output.txt
```

### Session/Context Files
```yaml
# ✅ CORRECT - Agent creates these automatically
# Tests verify creation at:
.tmp/sessions/{session-id}/
.tmp/context/{session-id}/bundle.md

# ❌ WRONG - Don't hardcode paths
```

### Cleanup
- `evals/test_tmp/` is cleaned before/after test runs
- `.tmp/` is managed by the agent (tests verify, don't create)
- Session files deleted after tests (unless --debug flag)

## Test Naming Convention

```
{sequence}-{description}-{type}.yaml

Examples:
01-approval-before-bash-positive.yaml
02-approval-missing-negative.yaml
03-just-do-it-override.yaml
```

**Sequence**: 01, 02, 03... (execution order within folder)
**Description**: Brief description (kebab-case)
**Type**: 
- `positive` - Expected to pass
- `negative` - Expected to catch violations
- `boundary` - Boundary condition test
- `override` - Tests override behavior

## Migration Plan

### Phase 1: Move Existing Tests (Immediate)
```bash
# Current structure → New structure
business/conv-simple-001.yaml → 04-execution-paths/conversational/01-simple-question.yaml
edge-case/no-approval-negative.yaml → 01-critical-rules/approval-gate/02-skip-approval-detection.yaml
edge-case/missing-approval-negative.yaml → 01-critical-rules/approval-gate/03-missing-approval-negative.yaml
edge-case/just-do-it.yaml → 05-edge-cases/overrides/01-just-do-it.yaml
developer/fail-stop-001.yaml → 01-critical-rules/stop-on-failure/01-test-failure-stop.yaml
developer/ctx-code-001.yaml → 01-critical-rules/context-loading/01-code-task.yaml
developer/ctx-docs-001.yaml → 01-critical-rules/context-loading/02-docs-task.yaml
developer/ctx-tests-001.yaml → 01-critical-rules/context-loading/03-tests-task.yaml
developer/ctx-delegation-001.yaml → 01-critical-rules/context-loading/04-delegation-task.yaml
developer/ctx-review-001.yaml → 01-critical-rules/context-loading/05-review-task.yaml
context-loading/* → 01-critical-rules/context-loading/
```

### Phase 2: Add Missing Critical Tests (High Priority)
```
01-critical-rules/report-first/01-error-report-workflow.yaml
01-critical-rules/report-first/02-auto-fix-negative.yaml
01-critical-rules/confirm-cleanup/01-session-cleanup.yaml
01-critical-rules/confirm-cleanup/02-temp-files-cleanup.yaml
```

### Phase 3: Add Delegation Tests (Medium Priority)
```
03-delegation/scale/01-exactly-4-files.yaml
03-delegation/scale/02-3-files-negative.yaml
03-delegation/expertise/01-security-audit.yaml
03-delegation/context-bundles/01-bundle-creation.yaml
```

### Phase 4: Add Workflow & Integration Tests (Lower Priority)
```
02-workflow-stages/validate/01-quality-check.yaml
02-workflow-stages/validate/02-additional-checks-prompt.yaml
06-integration/complex/01-multi-turn-delegation.yaml
```

## Running Tests by Category

```bash
# Run all critical rule tests (fast, must pass)
npm run eval:sdk -- --agent=openagent --pattern="01-critical-rules/**/*.yaml"

# Run specific critical rule category
npm run eval:sdk -- --agent=openagent --pattern="01-critical-rules/approval-gate/*.yaml"

# Run delegation tests (slower)
npm run eval:sdk -- --agent=openagent --pattern="03-delegation/**/*.yaml"

# Run integration tests (slowest, run last)
npm run eval:sdk -- --agent=openagent --pattern="06-integration/**/*.yaml"

# Run all tests in order (CI/CD)
npm run eval:sdk -- --agent=openagent
```

## Test Execution Order

When running all tests, they execute in this order:

1. **01-critical-rules/** - Fast, foundational (5-10 min)
2. **02-workflow-stages/** - Medium speed (5-10 min)
3. **04-execution-paths/** - Fast (2-5 min)
4. **05-edge-cases/** - Medium speed (5-10 min)
5. **03-delegation/** - Slower, involves subagents (10-15 min)
6. **06-integration/** - Slowest, complex scenarios (15-30 min)

**Total estimated time**: 40-80 minutes for full suite

## Benefits of This Structure

1. **Priority-based** - Critical tests run first, fail fast
2. **Isolated complexity** - Complex tests don't slow down simple tests
3. **Easy navigation** - Clear folder names indicate purpose
4. **Scalable** - Easy to add new tests in right category
5. **CI/CD friendly** - Can run subsets based on priority
6. **Debugging** - Easy to isolate and debug specific categories
7. **Documentation** - Structure itself documents test organization

## Next Steps

1. Create folder structure
2. Migrate existing tests
3. Add missing critical tests
4. Update CI/CD to run by priority
5. Document test patterns in each category
