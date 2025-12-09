#!/bin/bash
# Validate prompt library structure
# Agent files in .opencode/agent/ are the canonical defaults
# Prompts in .opencode/prompts/ are model-specific variants

set -e

AGENT_DIR=".opencode/agent"
PROMPTS_DIR=".opencode/prompts"
FAILED=0
WARNINGS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Validating prompt library structure..."
echo ""

# Check if prompts directory exists
if [ ! -d "$PROMPTS_DIR" ]; then
  echo -e "${YELLOW}⚠️  Prompts library not yet set up${NC}"
  echo "   This is expected if the prompt library system hasn't been implemented yet."
  echo "   Skipping validation."
  exit 0
fi

# Validate structure: agent files are canonical, prompts are variants
echo -e "${BLUE}Architecture:${NC}"
echo "  • Agent files (.opencode/agent/*.md) = Canonical defaults"
echo "  • Prompt variants (.opencode/prompts/<agent>/<model>.md) = Model-specific optimizations"
echo ""

# Find all agent markdown files (excluding subagents)
for agent_file in "$AGENT_DIR"/*.md; do
  # Skip if no files found
  [ -e "$agent_file" ] || continue
  
  agent_name=$(basename "$agent_file" .md)
  prompts_subdir="$PROMPTS_DIR/$agent_name"
  
  # Check if prompts directory exists for this agent
  if [ ! -d "$prompts_subdir" ]; then
    echo -e "${YELLOW}⚠️  No prompt variants for $agent_name${NC}"
    echo "   Agent file: $agent_file (canonical default)"
    echo "   Variants directory: $prompts_subdir (not found)"
    echo "   This is OK - variants are optional."
    echo ""
    WARNINGS=$((WARNINGS + 1))
    continue
  fi
  
  # Check for default.md (should NOT exist in new architecture)
  if [ -f "$prompts_subdir/default.md" ]; then
    echo -e "${RED}❌ Found default.md for $agent_name${NC}"
    echo "   Location: $prompts_subdir/default.md"
    echo "   This file should not exist in the new architecture."
    echo ""
    echo "   To fix:"
    echo "   rm $prompts_subdir/default.md"
    echo ""
    echo "   The agent file is now the canonical default:"
    echo "   $agent_file"
    echo ""
    FAILED=$((FAILED + 1))
  else
    # Count variants
    variant_count=$(find "$prompts_subdir" -maxdepth 1 -name "*.md" -not -name "README.md" -not -name "TEMPLATE.md" | wc -l | tr -d ' ')
    
    if [ "$variant_count" -gt 0 ]; then
      echo -e "${GREEN}✅ $agent_name${NC}"
      echo "   Default: $agent_file"
      echo "   Variants: $variant_count model-specific optimization(s)"
    else
      echo -e "${GREEN}✅ $agent_name${NC}"
      echo "   Default: $agent_file"
      echo "   Variants: none (using default for all models)"
    fi
  fi
done

echo ""

# Summary
if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ Prompt library structure is valid${NC}"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Validation passed with $WARNINGS warning(s)${NC}"
  echo "   Some agents don't have variant directories yet - this is expected."
  exit 0
else
  echo -e "${RED}❌ PR validation failed - $FAILED issue(s) found${NC}"
  echo ""
  echo "The new prompt architecture:"
  echo "  • Agent files (.opencode/agent/*.md) are the canonical defaults"
  echo "  • Prompt variants (.opencode/prompts/<agent>/<model>.md) are model-specific"
  echo "  • default.md files should NOT exist"
  echo ""
  echo "See docs/contributing/CONTRIBUTING.md for details"
  echo ""
  exit 1
fi
