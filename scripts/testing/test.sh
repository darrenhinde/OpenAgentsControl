#!/bin/bash
# Advanced test runner with multi-agent support
# Usage: ./scripts/testing/test.sh [agent] [model] [options]
# Examples:
#   ./scripts/testing/test.sh openagent --core                    # Run core tests
#   ./scripts/testing/test.sh openagent opencode/grok-code-fast   # Run all tests with specific model
#   ./scripts/testing/test.sh openagent --core --debug            # Run core tests with debug

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Defaults
AGENT=${1:-all}
MODEL=${2:-opencode/grok-code-fast}
shift 2 2>/dev/null || true
EXTRA_ARGS="$@"

# Check if --core flag is present
CORE_MODE=false
if [[ "$AGENT" == "--core" ]] || [[ "$MODEL" == "--core" ]] || [[ "$EXTRA_ARGS" == *"--core"* ]]; then
  CORE_MODE=true
fi

echo -e "${BLUE}🧪 OpenCode Agents Test Runner${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
if [ "$CORE_MODE" = true ]; then
  echo -e "Mode:   ${YELLOW}CORE TEST SUITE (7 tests, ~5-8 min)${NC}"
fi
echo -e "Agent:  ${GREEN}${AGENT}${NC}"
echo -e "Model:  ${GREEN}${MODEL}${NC}"
if [ -n "$EXTRA_ARGS" ]; then
  echo -e "Extra:  ${YELLOW}${EXTRA_ARGS}${NC}"
fi
echo ""

# Navigate to framework directory
cd "$(dirname "$0")/../../evals/framework" || exit 1

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠️  Dependencies not installed. Running npm install...${NC}"
  npm install
  echo ""
fi

# Run tests
if [ "$AGENT" = "all" ]; then
  echo -e "${YELLOW}Running tests for ALL agents...${NC}"
  npm run eval:sdk -- --model="$MODEL" $EXTRA_ARGS
else
  echo -e "${YELLOW}Running tests for ${AGENT}...${NC}"
  npm run eval:sdk -- --agent="$AGENT" --model="$MODEL" $EXTRA_ARGS
fi

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Tests complete!${NC}"
else
  echo -e "${RED}❌ Tests failed with exit code ${EXIT_CODE}${NC}"
fi
echo -e "${BLUE}View results: npm run dashboard${NC}"
echo ""

exit $EXIT_CODE
