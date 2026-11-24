#!/bin/bash

# Batch Test Runner for OpenCode Agents
# Runs tests in smaller batches to avoid API timeouts and rate limits

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
AGENT="${1:-openagent}"
BATCH_SIZE="${2:-3}"
DELAY_BETWEEN_BATCHES="${3:-10}"
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
FRAMEWORK_ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

echo -e "${GREEN}🚀 Batch Test Runner${NC}"
echo "Agent: $AGENT"
echo "Batch size: $BATCH_SIZE tests"
echo "Delay between batches: ${DELAY_BETWEEN_BATCHES}s"
echo ""

# Get all test files
TEST_DIR="$FRAMEWORK_ROOT/../agents/$AGENT/tests"

if [ ! -d "$TEST_DIR" ]; then
  echo -e "${RED}❌ Test directory not found: $TEST_DIR${NC}"
  exit 1
fi

# Find all test files
TEST_FILES=$(find "$TEST_DIR" -name "*.yaml" -type f | sort)
TOTAL_TESTS=$(echo "$TEST_FILES" | wc -l | tr -d ' ')

echo -e "${GREEN}Found $TOTAL_TESTS test files${NC}"
echo ""

# Split into batches
BATCH_NUM=1
CURRENT_BATCH=()
BATCH_COUNT=0

for TEST_FILE in $TEST_FILES; do
  CURRENT_BATCH+=("$TEST_FILE")
  BATCH_COUNT=$((BATCH_COUNT + 1))
  
  # Run batch when it reaches BATCH_SIZE or is the last file
  # shellcheck disable=SC2143
  if [ $BATCH_COUNT -eq $BATCH_SIZE ] || [ "$(echo "$TEST_FILES" | grep -c "$TEST_FILE")" -eq $TOTAL_TESTS ]; then
    echo -e "${YELLOW}📦 Running Batch $BATCH_NUM (${#CURRENT_BATCH[@]} tests)${NC}"
    echo "----------------------------------------"
    
    # Build pattern for this batch
    PATTERNS=""
    for FILE in "${CURRENT_BATCH[@]}"; do
      # Extract relative path from test directory
      # shellcheck disable=SC2001
      REL_PATH=$(echo "$FILE" | sed "s|$TEST_DIR/||")
      echo "  - $REL_PATH"
      
      # Add to pattern (run each test individually to avoid conflicts)
      if [ -z "$PATTERNS" ]; then
        PATTERNS="$REL_PATH"
      else
        PATTERNS="$PATTERNS|$REL_PATH"
      fi
    done
    
    echo ""
    
    # Run tests in this batch
    for FILE in "${CURRENT_BATCH[@]}"; do
      # shellcheck disable=SC2001
      REL_PATH=$(echo "$FILE" | sed "s|$TEST_DIR/||")
      echo -e "${GREEN}▶ Running: $REL_PATH${NC}"
      
      pnpm --dir "$FRAMEWORK_ROOT" run eval:sdk -- --agent="$AGENT" --pattern="$REL_PATH" 2>&1 | grep -E "(PASSED|FAILED|Duration|Violations)" || true
      
      echo ""
    done
    
    # Reset batch
    CURRENT_BATCH=()
    BATCH_COUNT=0
    BATCH_NUM=$((BATCH_NUM + 1))
    
    # Delay between batches (except for last batch)
    if [ $BATCH_NUM -le $((TOTAL_TESTS / BATCH_SIZE + 1)) ]; then
      echo -e "${YELLOW}⏳ Waiting ${DELAY_BETWEEN_BATCHES}s before next batch...${NC}"
      echo ""
      sleep $DELAY_BETWEEN_BATCHES
    fi
  fi
done

echo -e "${GREEN}✅ All batches completed!${NC}"
echo ""
echo "View results:"
echo "  cd ../results && ./serve.sh"
