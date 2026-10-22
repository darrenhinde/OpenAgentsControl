# OpenAgent Eval Audit

This audit classifies the active `OpenAgent` evals into `keep`, `rewrite`, and `archive` based on the desired behavior for the rewritten agent.

## Desired behavior

- proceed on low-risk local work,
- ask only on real risk,
- load context before substantive work,
- delegate when it clearly helps,
- validate and summarize cleanly.

## Keep

These still enforce behavior we want.

### Context loading

- `tests/01-critical-rules/context-loading/01-code-task.yaml`
- `tests/01-critical-rules/context-loading/02-docs-task.yaml`
- `tests/01-critical-rules/context-loading/03-tests-task.yaml`
- `tests/01-critical-rules/context-loading/04-delegation-task.yaml`
- `tests/01-critical-rules/context-loading/05-review-task.yaml`
- `tests/01-critical-rules/context-loading/12-correct-context-file-positive.yaml`

### Failure handling

- `tests/01-critical-rules/stop-on-failure/01-test-failure-stop.yaml`
- `tests/01-critical-rules/stop-on-failure/02-stop-and-report-positive.yaml`
- `tests/01-critical-rules/stop-on-failure/03-auto-fix-negative.yaml`
- `tests/01-critical-rules/report-first/01-correct-workflow-positive.yaml`

### Tool and execution hygiene

- `tests/09-tool-usage/dedicated-tools-usage.yaml`
- `tests/09-tool-usage/bash-antipattern-violation.yaml`
- `tests/10-execution-balance/execution-balance-positive.yaml`
- `tests/10-execution-balance/execution-balance-negative.yaml`

## Rewrite

These cover important areas, but the active criteria encode behavior we want to change.

### Approval gate

- `tests/01-critical-rules/approval-gate/01-skip-approval-detection.yaml`
- `tests/01-critical-rules/approval-gate/02-missing-approval-negative.yaml`
- `tests/01-critical-rules/approval-gate/03-conversational-no-approval.yaml`
- `tests/01-critical-rules/approval-gate/04-approval-after-execution-negative.yaml`
- `tests/01-critical-rules/approval-gate/05-approval-before-execution-positive.yaml`

Rewrite goal:
- stop testing `ask before any execution`
- start testing `ask before destructive, irreversible, external-side-effecting, or materially high-impact actions`
- preserve direct handling for read-only and low-risk local work

### Workflow stages

- `tests/02-workflow-stages/execute/01-simple-task.yaml`
- `tests/02-workflow-stages/execute/02-create-component.yaml`
- `tests/smoke-test.yaml`

Rewrite goal:
- stop requiring approval-stage theater for simple local tasks
- test that actionable requests lead to tool use and completion

### Delegation

- `tests/08-delegation/simple-task-direct.yaml`
- `tests/08-delegation/complex-task-delegation.yaml`
- `tests/08-delegation/task-manager-delegation.yaml`
- `tests/delegation/contextscout-delegation.yaml`

Rewrite goal:
- keep the direct-vs-delegate distinction
- reduce over-prescription of exact wording and exact subagent paths
- allow reasonable delegation instead of one ceremonial path

### Rewrite suite added during this refactor

- `tests/11-rewrite/*.yaml`

Rewrite goal:
- keep the intent
- tighten the criteria to what the framework can actually assert today

## Archive

These mostly preserve obsolete behavior or duplicate newer coverage.

- `tests/_archive/**`
- `tests/openrouter/**`

## Framework gap

The framework is much better at detecting missing approval than unnecessary approval.

It can already test:

- risky action still requires approval
- read-only work does not require approval
- context loading
- tool hygiene
- delegation on clearly complex work

It cannot yet cleanly enforce:

- the agent did not ask unnecessarily for a low-risk local write

That should be added as a framework capability, not worked around by keeping bad tests.

## Recommended next steps

1. Rewrite active approval-gate tests around real risk.
2. Rewrite simple workflow tests to reward direct execution.
3. Keep context, failure, tool, and execution-balance tests as the stable core.
4. Add framework support for `unnecessary-approval` detection.
