#!/bin/bash
# Validate that all agents use their default prompts
# This ensures PRs maintain stable defaults in the main branch

set -e

AGENT_DIR=".opencode/agent"
PROMPTS_DIR=".opencode/prompts"
FAILED=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Validating agent prompts..."
echo ""

# Check if prompts directory exists
if [ ! -d "$PROMPTS_DIR" ]; then
  echo -e "${YELLOW}⚠️  Prompts library not yet set up${NC}"
  echo "   This is expected if the prompt library system hasn't been implemented yet."
  echo "   Skipping validation."
  exit 0
fi

# Find all agent markdown files (excluding subagents)
for agent_file in "$AGENT_DIR"/*.md; do
  # Skip if no files found
  [ -e "$agent_file" ] || continue
  
  agent_name=$(basename "$agent_file" .md)
  default_file="$PROMPTS_DIR/$agent_name/default.md"
  
  # Check if default exists
  if [ ! -f "$default_file" ]; then
    echo -e "${YELLOW}⚠️  No default found for $agent_name${NC}"
    echo "   Expected: $default_file"
    echo "   This agent will be skipped."
    echo ""
    WARNINGS=$((WARNINGS + 1))
    continue
  fi
  
  # Compare files
  if ! diff -q "$agent_file" "$default_file" > /dev/null 2>&1; then
    echo -e "${RED}❌ $agent_name.md does not match default${NC}"
    echo "   Current:  $agent_file"
    echo "   Expected: $default_file"
    echo ""
    echo "   To fix this:"
    echo "   ./scripts/prompts/use-prompt.sh $agent_name default"
    echo ""
    FAILED=$((FAILED + 1))
  else
    echo -e "${GREEN}✅ $agent_name.md matches default${NC}"
  fi
done

echo ""

# Summary
if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ All agents use default prompts${NC}"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Validation passed with $WARNINGS warning(s)${NC}"
  echo "   Some agents don't have defaults yet - this is expected during development."
  exit 0
else
  echo -e "${RED}❌ PR validation failed - $FAILED agent(s) do not use default prompts${NC}"
  echo ""
  echo "PRs must use default prompts to keep the main branch stable."
  echo ""
  echo "To fix:"
  echo "  1. Restore defaults: ./scripts/prompts/use-prompt.sh <agent> default"
  echo "  2. Or run: ./scripts/prompts/validate-pr.sh"
  echo ""
  echo "If you're adding a new prompt variant:"
  echo "  - Add it to .opencode/prompts/<agent>/<variant>.md"
  echo "  - Do NOT modify .opencode/agent/<agent>.md"
  echo "  - See docs/contributing/CONTRIBUTING.md for details"
  echo ""
  exit 1
fi
