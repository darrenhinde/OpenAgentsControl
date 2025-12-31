#!/bin/bash
# Migration script to move existing tests to new folder structure
# Run from: evals/agents/openagent/tests/

set -e

echo "🔄 Migrating OpenAgent tests to new folder structure..."
echo ""

# Function to move and rename test
move_test() {
    local src=$1
    local dest=$2
    local new_name=$3
    
    if [ -f "$src" ]; then
        echo "  Moving: $src"
        echo "      → $dest/$new_name"
        cp "$src" "$dest/$new_name"
    else
        echo "  ⚠️  Not found: $src"
    fi
}

# ============================================================
# Phase 1: Critical Rules - Approval Gate
# ============================================================
echo "📁 01-critical-rules/approval-gate/"
move_test "edge-case/no-approval-negative.yaml" \
          "01-critical-rules/approval-gate" \
          "01-skip-approval-detection.yaml"

move_test "edge-case/missing-approval-negative.yaml" \
          "01-critical-rules/approval-gate" \
          "02-missing-approval-negative.yaml"

move_test "business/conv-simple-001.yaml" \
          "01-critical-rules/approval-gate" \
          "03-conversational-no-approval.yaml"

echo ""

# ============================================================
# Phase 1: Critical Rules - Context Loading
# ============================================================
echo "📁 01-critical-rules/context-loading/"
move_test "developer/ctx-code-001.yaml" \
          "01-critical-rules/context-loading" \
          "01-code-task.yaml"

move_test "developer/ctx-code-001-claude.yaml" \
          "01-critical-rules/context-loading" \
          "01-code-task-claude.yaml"

move_test "developer/ctx-docs-001.yaml" \
          "01-critical-rules/context-loading" \
          "02-docs-task.yaml"

move_test "developer/ctx-tests-001.yaml" \
          "01-critical-rules/context-loading" \
          "03-tests-task.yaml"

move_test "developer/ctx-delegation-001.yaml" \
          "01-critical-rules/context-loading" \
          "04-delegation-task.yaml"

move_test "developer/ctx-review-001.yaml" \
          "01-critical-rules/context-loading" \
          "05-review-task.yaml"

move_test "context-loading/ctx-simple-coding-standards.yaml" \
          "01-critical-rules/context-loading" \
          "06-simple-coding-standards.yaml"

move_test "context-loading/ctx-simple-documentation-format.yaml" \
          "01-critical-rules/context-loading" \
          "07-simple-documentation-format.yaml"

move_test "context-loading/ctx-simple-testing-approach.yaml" \
          "01-critical-rules/context-loading" \
          "08-simple-testing-approach.yaml"

move_test "context-loading/ctx-multi-standards-to-docs.yaml" \
          "01-critical-rules/context-loading" \
          "09-multi-standards-to-docs.yaml"

move_test "context-loading/ctx-multi-error-handling-to-tests.yaml" \
          "01-critical-rules/context-loading" \
          "10-multi-error-handling-to-tests.yaml"

echo ""

# ============================================================
# Phase 1: Critical Rules - Stop on Failure
# ============================================================
echo "📁 01-critical-rules/stop-on-failure/"
move_test "developer/fail-stop-001.yaml" \
          "01-critical-rules/stop-on-failure" \
          "01-test-failure-stop.yaml"

echo ""

# ============================================================
# Phase 2: Workflow Stages - Execute
# ============================================================
echo "📁 02-workflow-stages/execute/"
move_test "developer/task-simple-001.yaml" \
          "02-workflow-stages/execute" \
          "01-simple-task.yaml"

move_test "developer/create-component.yaml" \
          "02-workflow-stages/execute" \
          "02-create-component.yaml"

echo ""

# ============================================================
# Phase 4: Execution Paths - Conversational
# ============================================================
echo "📁 04-execution-paths/conversational/"
# Already moved conv-simple-001.yaml to approval-gate
# (it tests both conversational path AND no-approval requirement)

echo ""

# ============================================================
# Phase 4: Execution Paths - Task
# ============================================================
echo "📁 04-execution-paths/task/"
move_test "developer/install-dependencies.yaml" \
          "04-execution-paths/task" \
          "01-install-dependencies.yaml"

move_test "developer/install-dependencies-v2.yaml" \
          "04-execution-paths/task" \
          "02-install-dependencies-v2.yaml"

echo ""

# ============================================================
# Phase 5: Edge Cases - Overrides
# ============================================================
echo "📁 05-edge-cases/overrides/"
move_test "edge-case/just-do-it.yaml" \
          "05-edge-cases/overrides" \
          "01-just-do-it.yaml"

echo ""

# ============================================================
# Phase 6: Integration - Medium
# ============================================================
echo "📁 06-integration/medium/"
move_test "developer/ctx-multi-turn-001.yaml" \
          "06-integration/medium" \
          "01-multi-turn-context.yaml"

move_test "business/data-analysis.yaml" \
          "06-integration/medium" \
          "02-data-analysis.yaml"

echo ""
echo "✅ Migration complete!"
echo ""
echo "📊 Summary:"
echo "  - Migrated tests are COPIED (originals preserved)"
echo "  - Review migrated tests before deleting originals"
echo "  - Run tests to verify: npm run eval:sdk -- --agent=openagent"
echo ""
echo "🗑️  To remove old folders after verification:"
echo "  rm -rf business/ context-loading/ developer/ edge-case/"
echo ""
