#!/bin/bash
#
# test-prompt.sh - Test a specific prompt variant for an agent
#
# Usage:
#   ./scripts/prompts/test-prompt.sh --agent=openagent --variant=default
#   ./scripts/prompts/test-prompt.sh --agent=openagent --variant=default --model=anthropic/claude-sonnet-4-5
#   ./scripts/prompts/test-prompt.sh --agent=openagent --variant=sonnet-4 --model=opencode/grok-code-fast
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

# Default values
AGENT_NAME=""
PROMPT_VARIANT=""
MODEL=""  # Will be set from metadata or user input

# Paths
PROMPTS_DIR="$ROOT_DIR/.opencode/prompts"
AGENT_DIR="$ROOT_DIR/.opencode/agent"
EVALS_DIR="$ROOT_DIR/evals/framework"
RESULTS_FILE="$ROOT_DIR/evals/results/latest.json"

# Function to extract metadata from prompt file
extract_metadata() {
    local file="$1"
    local key="$2"
    
    # Extract YAML frontmatter between --- markers
    # Look for key in the metadata section
    awk -v key="$key" '
        /^---$/ { in_yaml = !in_yaml; next }
        in_yaml && $0 ~ "^" key ":" {
            sub("^" key ": *", "")
            gsub(/"/, "")
            print
            exit
        }
    ' "$file"
}

# Function to extract recommended models array from metadata
extract_recommended_models() {
    local file="$1"
    
    # Extract recommended_models array from YAML
    awk '
        /^---$/ { in_yaml = !in_yaml; next }
        in_yaml && /^recommended_models:/ { in_models = 1; next }
        in_yaml && in_models && /^  - / {
            # Remove leading spaces, dash, and quotes
            gsub(/^  - /, "")
            gsub(/"/, "")
            # Remove comments
            sub(/ *#.*$/, "")
            # Trim whitespace
            gsub(/^ +| +$/, "")
            print
        }
        in_yaml && in_models && /^[a-z_]+:/ { exit }
    ' "$file"
}

usage() {
    echo "Usage: $0 --agent=<name> --variant=<name> [--model=<model>]"
    echo ""
    echo "Required:"
    echo "  --agent=NAME       Agent name (e.g., openagent, opencoder)"
    echo "  --variant=NAME     Prompt variant (default, gpt, gemini, grok, llama)"
    echo ""
    echo "Optional:"
    echo "  --model=MODEL      Model to test with (uses prompt metadata if not specified)"
    echo "  --help, -h         Show this help"
    echo ""
    echo -e "${BLUE}Architecture:${NC}"
    echo "  • default = Canonical agent file (.opencode/agent/<agent>.md)"
    echo "  • Other variants = Model-specific optimizations (.opencode/prompts/<agent>/<model>.md)"
    echo "  • Results always saved to .opencode/prompts/<agent>/results/"
    echo ""
    echo "Examples:"
    echo "  # Test default (canonical agent file)"
    echo "  $0 --agent=openagent --variant=default"
    echo ""
    echo "  # Test GPT-optimized prompt"
    echo "  $0 --agent=openagent --variant=gpt"
    echo ""
    echo "  # Test Gemini prompt with specific model"
    echo "  $0 --agent=openagent --variant=gemini --model=google/gemini-2.0-flash-exp"
    echo ""
    echo "  # Test Grok prompt"
    echo "  $0 --agent=openagent --variant=grok"
    echo ""
    echo "Available model families:"
    echo "  default    # Canonical agent file (Claude Sonnet 4.5)"
    echo "  gpt        # OpenAI GPT-4o, GPT-4o-mini, o1"
    echo "  gemini     # Google Gemini 2.0 Flash, Pro"
    echo "  grok       # xAI Grok (free tier available)"
    echo "  llama      # Meta Llama 3.1/3.2 (local or hosted)"
    echo ""
    echo "Note: Model-specific prompts contain metadata with recommended models."
    echo "      If --model is not specified, the primary recommendation is used."
    echo ""
    echo "Available variants for an agent:"
    echo "  ls $PROMPTS_DIR/<agent-name>/"
    exit 1
}

# Parse arguments
for arg in "$@"; do
    case $arg in
        --agent=*)
            AGENT_NAME="${arg#*=}"
            shift
            ;;
        --variant=*)
            PROMPT_VARIANT="${arg#*=}"
            shift
            ;;
        --model=*)
            MODEL="${arg#*=}"
            shift
            ;;
        --help|-h)
            usage
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            echo ""
            usage
            ;;
    esac
done

# Validate required arguments
if [[ -z "$AGENT_NAME" ]] || [[ -z "$PROMPT_VARIANT" ]]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo ""
    usage
fi

AGENT_FILE="$AGENT_DIR/$AGENT_NAME.md"
BACKUP_FILE="$AGENT_DIR/.$AGENT_NAME.md.backup"
VARIANT_RESULTS_DIR="$PROMPTS_DIR/$AGENT_NAME/results"
VARIANT_RESULTS_FILE="$VARIANT_RESULTS_DIR/$PROMPT_VARIANT-results.json"

# Handle "default" variant - use agent file directly
if [[ "$PROMPT_VARIANT" == "default" ]]; then
    PROMPT_FILE="$AGENT_FILE"
    echo -e "${BLUE}Testing default prompt (canonical agent file)${NC}"
else
    PROMPT_FILE="$PROMPTS_DIR/$AGENT_NAME/$PROMPT_VARIANT.md"
    
    # Check prompt exists
    if [[ ! -f "$PROMPT_FILE" ]]; then
        echo -e "${RED}Error: Prompt variant not found: $PROMPT_FILE${NC}"
        echo ""
        echo "Available variants for $AGENT_NAME:"
        echo "  - default (canonical agent file)"
        if [[ -d "$PROMPTS_DIR/$AGENT_NAME" ]]; then
            ls -1 "$PROMPTS_DIR/$AGENT_NAME/"*.md 2>/dev/null | grep -v "TEMPLATE.md" | grep -v "README.md" | xargs -I {} basename {} .md || echo "  (no model variants found)"
        fi
        exit 1
    fi
fi

# Read metadata from prompt file
MODEL_FAMILY=$(extract_metadata "$PROMPT_FILE" "model_family")
RECOMMENDED_MODELS=$(extract_recommended_models "$PROMPT_FILE")

# If no model specified, suggest from metadata
if [[ -z "$MODEL" ]]; then
    if [[ -n "$RECOMMENDED_MODELS" ]]; then
        echo -e "${YELLOW}No model specified. Reading recommendations from prompt metadata...${NC}"
        echo ""
        echo -e "${BLUE}Recommended models for '$PROMPT_VARIANT' (${MODEL_FAMILY} family):${NC}"
        
        # Display recommended models with numbers
        i=1
        while IFS= read -r model; do
            echo "  $i. $model"
            if [[ $i -eq 1 ]]; then
                PRIMARY_MODEL="$model"
            fi
            ((i++))
        done <<< "$RECOMMENDED_MODELS"
        
        echo ""
        echo -e "${YELLOW}Using primary recommendation: ${GREEN}$PRIMARY_MODEL${NC}"
        echo ""
        echo "To use a different model, run with: --model=<model-id>"
        echo ""
        
        MODEL="$PRIMARY_MODEL"
    else
        # Fallback to default if no metadata
        echo -e "${YELLOW}No metadata found. Using default model: anthropic/claude-sonnet-4-5${NC}"
        MODEL="anthropic/claude-sonnet-4-5"
    fi
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

# Step 2: Copy prompt variant to agent location (skip if testing default)
if [[ "$PROMPT_VARIANT" == "default" ]]; then
    echo -e "${YELLOW}[2/5] Using default prompt (already in place)...${NC}"
    echo "      Testing: $AGENT_FILE"
else
    echo -e "${YELLOW}[2/5] Copying prompt variant to agent location...${NC}"
    cp "$PROMPT_FILE" "$AGENT_FILE"
    echo "      Copied $PROMPT_FILE"
    echo "      To     $AGENT_FILE"
fi

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

# Run tests with real-time output
set +e  # Don't exit on test failure
npm run eval:sdk:core -- --agent="$AGENT_NAME" --model="$MODEL"
TEST_EXIT_CODE=$?
set -e

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

# Step 4: Restore original prompt (if we changed it)
echo ""
if [[ "$PROMPT_VARIANT" == "default" ]]; then
    echo -e "${YELLOW}[4/5] No restore needed (tested default)...${NC}"
    echo "      Agent file unchanged"
else
    echo -e "${YELLOW}[4/5] Restoring original prompt...${NC}"
    if [[ -f "$BACKUP_FILE" ]]; then
        cp "$BACKUP_FILE" "$AGENT_FILE"
        echo "      Restored from backup"
    else
        echo "      No backup to restore"
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
echo "  ./scripts/prompts/use-prompt.sh --agent=$AGENT_NAME --variant=$PROMPT_VARIANT"
