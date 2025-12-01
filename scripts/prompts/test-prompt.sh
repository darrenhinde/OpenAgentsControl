#!/bin/bash
#
# test-prompt.sh - Test a specific prompt variant for an agent
#
# Usage:
#   ./scripts/prompts/test-prompt.sh <agent> <prompt-variant> [model]
#   ./scripts/prompts/test-prompt.sh openagent default
#   ./scripts/prompts/test-prompt.sh openagent default anthropic/claude-sonnet-4-5
#   ./scripts/prompts/test-prompt.sh openagent sonnet-4 opencode/grok-code-fast
#
# What it does:
#   1. Backs up current agent prompt
#   2. Copies the specified prompt variant to the agent location
#   3. Runs the eval tests with specified model (defaults to Sonnet 4.5)
#   4. Restores the original prompt (keeps default in place)
#   5. Outputs results summary
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Arguments
AGENT_NAME="${1:-}"
PROMPT_VARIANT="${2:-}"
MODEL="${3:-anthropic/claude-sonnet-4-5}"  # Default to Sonnet 4.5

# Paths
PROMPTS_DIR="$ROOT_DIR/.opencode/prompts"
AGENT_DIR="$ROOT_DIR/.opencode/agent"
EVALS_DIR="$ROOT_DIR/evals/framework"
RESULTS_FILE="$ROOT_DIR/evals/results/latest.json"
VARIANT_RESULTS_DIR="$PROMPTS_DIR/$AGENT_NAME/results"
VARIANT_RESULTS_FILE="$VARIANT_RESULTS_DIR/$PROMPT_VARIANT-results.json"

usage() {
    echo "Usage: $0 <agent-name> <prompt-variant> [model]"
    echo ""
    echo "Examples:"
    echo "  $0 openagent default                              # Test with Sonnet 4.5 (default)"
    echo "  $0 openagent default anthropic/claude-sonnet-4-5  # Test with Sonnet 4.5 (explicit)"
    echo "  $0 openagent sonnet-4 opencode/grok-code-fast     # Test with Grok Fast"
    echo ""
    echo "Available models:"
    echo "  anthropic/claude-sonnet-4-5      # Claude Sonnet 4.5 (default)"
    echo "  anthropic/claude-3-5-sonnet-20241022  # Claude Sonnet 3.5"
    echo "  opencode/grok-code-fast          # Grok Fast (free tier)"
    echo ""
    echo "Available prompts for an agent:"
    echo "  ls $PROMPTS_DIR/<agent-name>/"
    exit 1
}

# Validate arguments
if [[ -z "$AGENT_NAME" ]] || [[ -z "$PROMPT_VARIANT" ]]; then
    usage
fi

PROMPT_FILE="$PROMPTS_DIR/$AGENT_NAME/$PROMPT_VARIANT.md"
AGENT_FILE="$AGENT_DIR/$AGENT_NAME.md"
BACKUP_FILE="$AGENT_DIR/.$AGENT_NAME.md.backup"

# Check prompt exists
if [[ ! -f "$PROMPT_FILE" ]]; then
    echo -e "${RED}Error: Prompt not found: $PROMPT_FILE${NC}"
    echo ""
    echo "Available prompts for $AGENT_NAME:"
    ls -1 "$PROMPTS_DIR/$AGENT_NAME/" 2>/dev/null || echo "  (none found)"
    exit 1
fi

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testing Prompt: $AGENT_NAME / $PROMPT_VARIANT${NC}"
echo -e "${BLUE}║  Model: $MODEL${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Backup current agent prompt
echo -e "${YELLOW}[1/5] Backing up current agent prompt...${NC}"
if [[ -f "$AGENT_FILE" ]]; then
    cp "$AGENT_FILE" "$BACKUP_FILE"
    echo "      Backed up to $BACKUP_FILE"
else
    echo "      No existing agent file to backup"
fi

# Step 2: Copy prompt variant to agent location
echo -e "${YELLOW}[2/5] Copying prompt variant to agent location...${NC}"
cp "$PROMPT_FILE" "$AGENT_FILE"
echo "      Copied $PROMPT_FILE"
echo "      To     $AGENT_FILE"

# Step 3: Run tests
echo -e "${YELLOW}[3/5] Running core eval tests...${NC}"
echo ""
echo -e "${BLUE}Model: ${GREEN}$MODEL${NC}"
echo -e "${BLUE}Running 7 core tests (estimated 5-8 minutes):${NC}"
echo "  1. Approval Gate"
echo "  2. Context Loading (Simple)"
echo "  3. Context Loading (Multi-Turn)"
echo "  4. Stop on Failure"
echo "  5. Simple Task (No Delegation)"
echo "  6. Subagent Delegation"
echo "  7. Tool Usage"
echo ""
echo -e "${BLUE}Test output:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$EVALS_DIR"

# Run tests with real-time output (no capture)
npm run eval:sdk:core -- --agent="$AGENT_NAME" --model="$MODEL" 2>&1 | tee /tmp/test-output-$AGENT_NAME.txt
TEST_EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Step 4: Restore default prompt
echo ""
echo -e "${YELLOW}[4/5] Restoring default prompt...${NC}"
DEFAULT_PROMPT="$PROMPTS_DIR/$AGENT_NAME/default.md"
if [[ -f "$DEFAULT_PROMPT" ]]; then
    cp "$DEFAULT_PROMPT" "$AGENT_FILE"
    echo "      Restored default.md to agent location"
else
    # Restore backup if no default
    if [[ -f "$BACKUP_FILE" ]]; then
        cp "$BACKUP_FILE" "$AGENT_FILE"
        echo "      Restored from backup"
    fi
fi

# Clean up backup
rm -f "$BACKUP_FILE"

# Step 5: Save and show results summary
echo ""
echo -e "${YELLOW}[5/5] Saving Results${NC}"

# Create results directory if it doesn't exist
mkdir -p "$VARIANT_RESULTS_DIR"

# Save the test output for reference
if [[ -f "/tmp/test-output-$AGENT_NAME.txt" ]]; then
    cp "/tmp/test-output-$AGENT_NAME.txt" "$VARIANT_RESULTS_DIR/$PROMPT_VARIANT-output.log"
    echo "      Saved test output to: $VARIANT_RESULTS_DIR/$PROMPT_VARIANT-output.log"
fi

if [[ -f "$RESULTS_FILE" ]]; then
    # Extract summary from results JSON
    if command -v jq &> /dev/null; then
        PASS_COUNT=$(jq -r '.summary.passed // 0' "$RESULTS_FILE")
        TOTAL_COUNT=$(jq -r '.summary.total // 0' "$RESULTS_FILE")
        FAIL_COUNT=$(jq -r '.summary.failed // 0' "$RESULTS_FILE")
    else
        # Fallback if jq not available
        PASS_COUNT=$(grep -o '"passed":[0-9]*' "$RESULTS_FILE" | head -1 | grep -o '[0-9]*')
        TOTAL_COUNT=$(grep -o '"total":[0-9]*' "$RESULTS_FILE" | head -1 | grep -o '[0-9]*')
        FAIL_COUNT=$((TOTAL_COUNT - PASS_COUNT))
    fi
    
    # Calculate pass rate
    if [ $TOTAL_COUNT -gt 0 ]; then
        PASS_RATE=$(echo "scale=1; ($PASS_COUNT * 100) / $TOTAL_COUNT" | bc)
    else
        PASS_RATE="0.0"
    fi
    
    # Create variant results JSON
    cat > "$VARIANT_RESULTS_FILE" <<EOF
{
  "variant": "$PROMPT_VARIANT",
  "agent": "$AGENT_NAME",
  "model": "$MODEL",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "passed": $PASS_COUNT,
  "failed": $FAIL_COUNT,
  "total": $TOTAL_COUNT,
  "passRate": "${PASS_RATE}%",
  "fullResults": "$RESULTS_FILE"
}
EOF
    
    echo "      Saved results to: $VARIANT_RESULTS_FILE"
    
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Agent:     ${GREEN}$AGENT_NAME${NC}"
    echo -e "  Prompt:    ${GREEN}$PROMPT_VARIANT${NC}"
    echo -e "  Model:     ${GREEN}$MODEL${NC}"
    echo -e "  Results:   ${GREEN}$PASS_COUNT/$TOTAL_COUNT tests passed${NC} (${PASS_RATE}%)"
    echo ""
    echo "  Variant results: $VARIANT_RESULTS_FILE"
    echo "  Full results:    $RESULTS_FILE"
else
    echo -e "  ${RED}No results file found${NC}"
    echo "  Tests may not have run successfully"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Done!${NC} Default prompt restored to agent location."
echo ""
echo "To use this prompt permanently:"
echo "  ./scripts/prompts/use-prompt.sh $AGENT_NAME $PROMPT_VARIANT"
