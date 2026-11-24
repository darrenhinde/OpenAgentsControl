#!/bin/bash

# Run a test with full conversation output
# Usage: ./run-test-verbose.sh <agent> <pattern>
# Example: ./run-test-verbose.sh opencoder "planning/*.yaml"

AGENT=${1:-opencoder}
PATTERN=${2:-"**/*.yaml"}

echo "🚀 Running test with verbose output..."
echo "Agent: $AGENT"
echo "Pattern: $PATTERN"
echo ""

# Run test with debug mode and capture session ID
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUTPUT=$(pnpm --dir "$SCRIPT_DIR/.." run eval:sdk -- --agent="$AGENT" --pattern="$PATTERN" --debug 2>&1)

# Extract session ID from output
SESSION_ID=$(echo "$OUTPUT" | grep -o "Session created: ses_[a-zA-Z0-9]*" | head -1 | cut -d' ' -f3)

# Show test summary
echo "$OUTPUT" | grep -A 20 "TEST RESULTS"

if [ -n "$SESSION_ID" ]; then
  echo ""
  echo "========================================================================"
  echo "FULL CONVERSATION"
  echo "========================================================================"
  echo ""
  
  # Show full conversation
  "$SCRIPT_DIR/debug/show-test-conversation.sh" "$SESSION_ID"
else
  echo ""
  echo "⚠️  No session ID found. Test may have failed to start."
  echo ""
  echo "Full output:"
  echo "$OUTPUT"
fi
