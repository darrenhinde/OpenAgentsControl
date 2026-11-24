#!/bin/bash

# Demo script for enhanced eval framework features
# Shows:
# 1. Enhanced approval detection with confidence levels
# 2. --show-failures flag for debugging failed tests

echo "=========================================="
echo "Enhanced Eval Framework Features Demo"
echo "=========================================="
echo ""

echo "Feature 1: Enhanced Approval Detection"
echo "---------------------------------------"
echo "✅ High confidence patterns:"
echo "   - 'approval needed before proceeding'"
echo "   - 'please confirm before'"
echo "   - 'ready to proceed?'"
echo ""
echo "✅ Medium confidence patterns:"
echo "   - 'would you like me to'"
echo "   - 'should I proceed'"
echo "   - 'is this okay?'"
echo ""
echo "✅ Low confidence patterns (with false positive filtering):"
echo "   - 'may I' (but NOT 'may I help you')"
echo "   - 'can I' (but NOT 'can I assist you')"
echo ""
echo "✅ Captures:"
echo "   - Approval text (the actual sentence)"
echo "   - What is being approved (extracted from plan)"
echo "   - Confidence level (high/medium/low)"
echo ""

echo "Feature 2: --show-failures Flag"
echo "--------------------------------"
echo "Usage: pnpm run eval:sdk -- --agent=openagent --show-failures"
echo ""
echo "When a test fails, automatically shows:"
echo "  - Full session timeline"
echo "  - All messages (user + assistant)"
echo "  - All tool calls with inputs/outputs"
echo "  - Timestamps (relative to session start)"
echo "  - Violations highlighted"
echo ""

echo "Feature 3: --test-id Flag"
echo "-------------------------"
echo "Usage: pnpm run eval:sdk -- --agent=openagent --test-id=approval-gate-basic"
echo ""
echo "Run a specific test by ID for faster iteration"
echo ""

echo "=========================================="
echo "Running Unit Tests"
echo "=========================================="
echo ""

# Run the approval detection unit tests
npm test -- src/evaluators/__tests__/approval-detection.test.ts --run

echo ""
echo "=========================================="
echo "Demo Complete!"
echo "=========================================="
echo ""
echo "To try the --show-failures flag:"
echo "  pnpm run eval:sdk -- --agent=openagent --test-id=YOUR_TEST_ID --show-failures"
echo ""
