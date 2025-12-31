#!/bin/bash
# Verification script for test migration
# Checks that migrated tests are identical to originals

set -e

echo "🔍 Verifying OpenAgent Test Migration"
echo ""

ERRORS=0

# Function to compare files
compare_files() {
    local original=$1
    local migrated=$2
    local name=$3
    
    if [ ! -f "$original" ]; then
        echo "  ⚠️  Original not found: $original"
        return
    fi
    
    if [ ! -f "$migrated" ]; then
        echo "  ❌ Migrated file missing: $migrated"
        ((ERRORS++))
        return
    fi
    
    if diff -q "$original" "$migrated" > /dev/null 2>&1; then
        echo "  ✅ $name"
    else
        echo "  ❌ $name - FILES DIFFER!"
        ((ERRORS++))
    fi
}

echo "📋 Checking migrated test files..."
echo ""

# Critical Rules - Approval Gate
echo "01-critical-rules/approval-gate/"
compare_files \
    "edge-case/no-approval-negative.yaml" \
    "01-critical-rules/approval-gate/01-skip-approval-detection.yaml" \
    "skip-approval-detection"

compare_files \
    "edge-case/missing-approval-negative.yaml" \
    "01-critical-rules/approval-gate/02-missing-approval-negative.yaml" \
    "missing-approval-negative"

compare_files \
    "business/conv-simple-001.yaml" \
    "01-critical-rules/approval-gate/03-conversational-no-approval.yaml" \
    "conversational-no-approval"

echo ""

# Critical Rules - Context Loading
echo "01-critical-rules/context-loading/"
compare_files \
    "developer/ctx-code-001.yaml" \
    "01-critical-rules/context-loading/01-code-task.yaml" \
    "code-task"

compare_files \
    "developer/ctx-docs-001.yaml" \
    "01-critical-rules/context-loading/02-docs-task.yaml" \
    "docs-task"

compare_files \
    "developer/ctx-tests-001.yaml" \
    "01-critical-rules/context-loading/03-tests-task.yaml" \
    "tests-task"

compare_files \
    "developer/ctx-delegation-001.yaml" \
    "01-critical-rules/context-loading/04-delegation-task.yaml" \
    "delegation-task"

compare_files \
    "developer/ctx-review-001.yaml" \
    "01-critical-rules/context-loading/05-review-task.yaml" \
    "review-task"

compare_files \
    "context-loading/ctx-simple-coding-standards.yaml" \
    "01-critical-rules/context-loading/06-simple-coding-standards.yaml" \
    "simple-coding-standards"

compare_files \
    "context-loading/ctx-multi-standards-to-docs.yaml" \
    "01-critical-rules/context-loading/09-multi-standards-to-docs.yaml" \
    "multi-standards-to-docs"

echo ""

# Critical Rules - Stop on Failure
echo "01-critical-rules/stop-on-failure/"
compare_files \
    "developer/fail-stop-001.yaml" \
    "01-critical-rules/stop-on-failure/01-test-failure-stop.yaml" \
    "test-failure-stop"

echo ""

# Workflow Stages - Execute
echo "02-workflow-stages/execute/"
compare_files \
    "developer/task-simple-001.yaml" \
    "02-workflow-stages/execute/01-simple-task.yaml" \
    "simple-task"

compare_files \
    "developer/create-component.yaml" \
    "02-workflow-stages/execute/02-create-component.yaml" \
    "create-component"

echo ""

# Execution Paths - Task
echo "04-execution-paths/task/"
compare_files \
    "developer/install-dependencies.yaml" \
    "04-execution-paths/task/01-install-dependencies.yaml" \
    "install-dependencies"

echo ""

# Edge Cases - Overrides
echo "05-edge-cases/overrides/"
compare_files \
    "edge-case/just-do-it.yaml" \
    "05-edge-cases/overrides/01-just-do-it.yaml" \
    "just-do-it"

echo ""

# Integration - Medium
echo "06-integration/medium/"
compare_files \
    "developer/ctx-multi-turn-001.yaml" \
    "06-integration/medium/01-multi-turn-context.yaml" \
    "multi-turn-context"

compare_files \
    "business/data-analysis.yaml" \
    "06-integration/medium/02-data-analysis.yaml" \
    "data-analysis"

echo ""
echo "📊 Summary"
echo "=========="

# Count files
MIGRATED_COUNT=$(find 0[1-6]-* -name "*.yaml" 2>/dev/null | wc -l | tr -d ' ')
echo "Migrated tests: $MIGRATED_COUNT"

# Count by category
echo ""
echo "By category:"
for dir in 0[1-6]-*/; do
    count=$(find "$dir" -name "*.yaml" 2>/dev/null | wc -l | tr -d ' ')
    echo "  $(basename $dir): $count tests"
done

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All migrated tests verified successfully!"
    exit 0
else
    echo "❌ Found $ERRORS error(s) in migration"
    exit 1
fi
