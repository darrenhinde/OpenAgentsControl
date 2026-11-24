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

# Defaults and argument parsing
AGENT=all
MODEL=opencode/grok-code-fast
AGENT_SET=false
MODEL_SET=false
CORE_MODE=false
EXTRA_ARGS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --core)
      CORE_MODE=true
      ;;
    --*)
      EXTRA_ARGS+=("$1")
      ;;
    *)
      if [ "$AGENT_SET" = false ]; then
        AGENT="$1"
        AGENT_SET=true
      elif [ "$MODEL_SET" = false ]; then
        MODEL="$1"
        MODEL_SET=true
      else
        EXTRA_ARGS+=("$1")
      fi
      ;;
  esac
  shift
done

echo -e "${BLUE}🧪 OpenCode Agents Test Runner${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
if [ "$CORE_MODE" = true ]; then
  echo -e "Mode:   ${YELLOW}CORE TEST SUITE (7 tests, ~5-8 min)${NC}"
fi
echo -e "Agent:  ${GREEN}${AGENT}${NC}"
echo -e "Model:  ${GREEN}${MODEL}${NC}"
if [ -n "${EXTRA_ARGS[*]}" ]; then
  echo -e "Extra:  ${YELLOW}${EXTRA_ARGS[*]}${NC}"
fi

REPO_ROOT=$(cd "$(dirname "$0")/../.." && pwd)

# Check if dependencies are installed
if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo -e "${YELLOW}⚠️  Dependencies not installed. Running pnpm install...${NC}"
  pnpm --dir "$REPO_ROOT" install
  echo ""
fi

# Run tests
EVAL_SCRIPT=eval:sdk
if [ "$CORE_MODE" = true ]; then
  EVAL_SCRIPT=eval:sdk:core
fi

if [ "$AGENT" = "all" ]; then
  echo -e "${YELLOW}Running tests for ALL agents...${NC}"
  pnpm --dir "$REPO_ROOT/evals/framework" run "$EVAL_SCRIPT" -- --model="$MODEL" "${EXTRA_ARGS[@]}" && EXIT_CODE=0 || EXIT_CODE=$?
else
  echo -e "${YELLOW}Running tests for ${AGENT}...${NC}"
  pnpm --dir "$REPO_ROOT/evals/framework" run "$EVAL_SCRIPT" -- --agent="$AGENT" --model="$MODEL" "${EXTRA_ARGS[@]}" && EXIT_CODE=0 || EXIT_CODE=$?
fi

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ Tests complete!${NC}"
else
  echo -e "${RED}❌ Tests failed with exit code ${EXIT_CODE}${NC}"
fi
echo -e "${BLUE}View results: pnpm run dashboard${NC}"
echo ""

exit $EXIT_CODE
