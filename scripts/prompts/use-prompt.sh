#!/bin/bash
#
# use-prompt.sh - Switch an agent to use a specific prompt variant
#
# Usage:
#   ./scripts/prompts/use-prompt.sh --agent=openagent --variant=gpt
#   ./scripts/prompts/use-prompt.sh --agent=openagent --variant=default
#
# What it does:
#   1. If variant is "default", restores the canonical agent file (no-op, already default)
#   2. Otherwise, copies the model-specific variant to the agent location
#
# New Architecture:
#   - Agent files (.opencode/agent/*.md) are the canonical defaults
#   - Prompt variants (.opencode/prompts/<agent>/<model>.md) are model-specific optimizations
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
AGENT_NAME=""
PROMPT_VARIANT=""

# Paths
PROMPTS_DIR="$ROOT_DIR/.opencode/prompts"
AGENT_DIR="$ROOT_DIR/.opencode/agent"

# Function to extract metadata from prompt file
extract_metadata() {
    local file="$1"
    local key="$2"
    
    # Extract YAML frontmatter between --- markers
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
    echo "Usage: $0 --agent=<name> --variant=<name>"
    echo ""
    echo "Required:"
    echo "  --agent=NAME       Agent name (e.g., openagent, opencoder)"
    echo "  --variant=NAME     Prompt variant (default, gpt, gemini, grok, llama)"
    echo ""
    echo "Optional:"
    echo "  --help, -h         Show this help"
    echo ""
    echo -e "${BLUE}Architecture:${NC}"
    echo "  • Agent files (.opencode/agent/*.md) = Canonical defaults"
    echo "  • Prompt variants (.opencode/prompts/<agent>/<model>.md) = Model-specific"
    echo ""
    echo "Examples:"
    echo "  # Use default (canonical agent file)"
    echo "  $0 --agent=openagent --variant=default"
    echo ""
    echo "  # Switch to GPT-optimized prompt"
    echo "  $0 --agent=openagent --variant=gpt"
    echo ""
    echo "  # Switch to Gemini-optimized prompt"
    echo "  $0 --agent=openagent --variant=gemini"
    echo ""
    echo "Available prompts:"
    for agent_dir in "$PROMPTS_DIR"/*/; do
        [ -d "$agent_dir" ] || continue
        agent=$(basename "$agent_dir")
        echo "  $agent:"
        echo "    - default (canonical agent file)"
        for prompt in "$agent_dir"*.md; do
            if [[ -f "$prompt" ]] && [[ "$(basename "$prompt")" != "TEMPLATE.md" ]] && [[ "$(basename "$prompt")" != "README.md" ]]; then
                variant=$(basename "$prompt" .md)
                model_family=$(extract_metadata "$prompt" "model_family")
                if [[ -n "$model_family" ]]; then
                    echo "    - $variant ($model_family family)"
                else
                    echo "    - $variant"
                fi
            fi
        done
    done
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

# Validate arguments
if [[ -z "$AGENT_NAME" ]] || [[ -z "$PROMPT_VARIANT" ]]; then
    echo -e "${RED}Error: Missing required arguments${NC}"
    echo ""
    usage
fi

AGENT_FILE="$AGENT_DIR/$AGENT_NAME.md"

# Check agent exists
if [[ ! -f "$AGENT_FILE" ]]; then
    echo -e "${RED}Error: Agent not found: $AGENT_FILE${NC}"
    echo ""
    echo "Available agents:"
    ls -1 "$AGENT_DIR/"*.md 2>/dev/null | xargs -I {} basename {} .md || echo "  (none found)"
    exit 1
fi

# Handle "default" variant - agent file is already the default
if [[ "$PROMPT_VARIANT" == "default" ]]; then
    echo -e "${GREEN}✓${NC} Agent ${GREEN}$AGENT_NAME${NC} is using the ${GREEN}default${NC} prompt"
    echo ""
    echo "  Location: $AGENT_FILE"
    echo ""
    echo -e "${BLUE}Note:${NC} In the new architecture, agent files are the canonical defaults."
    echo "       No action needed - you're already using the default!"
    echo ""
    exit 0
fi

# For non-default variants, copy from prompts directory
PROMPT_FILE="$PROMPTS_DIR/$AGENT_NAME/$PROMPT_VARIANT.md"

# Check prompt exists
if [[ ! -f "$PROMPT_FILE" ]]; then
    echo -e "${RED}Error: Prompt variant not found: $PROMPT_FILE${NC}"
    echo ""
    echo "Available variants for $AGENT_NAME:"
    echo "  - default (canonical agent file)"
    if [[ -d "$PROMPTS_DIR/$AGENT_NAME" ]]; then
        ls -1 "$PROMPTS_DIR/$AGENT_NAME/"*.md 2>/dev/null | grep -v "TEMPLATE.md" | grep -v "README.md" | xargs -I {} basename {} .md || echo "  (no model variants found)"
    else
        echo "  (no model variants found)"
    fi
    exit 1
fi

# Read metadata from prompt file
MODEL_FAMILY=$(extract_metadata "$PROMPT_FILE" "model_family")
RECOMMENDED_MODELS=$(extract_recommended_models "$PROMPT_FILE")
STATUS=$(extract_metadata "$PROMPT_FILE" "status")

# Copy prompt to agent location
cp "$PROMPT_FILE" "$AGENT_FILE"

echo -e "${GREEN}✓${NC} Now using ${GREEN}$PROMPT_VARIANT${NC} prompt for ${GREEN}$AGENT_NAME${NC}"
echo ""
echo "  Source: $PROMPT_FILE"
echo "  Active: $AGENT_FILE"
echo ""

# Show metadata if available
if [[ -n "$MODEL_FAMILY" ]]; then
    echo -e "${YELLOW}Prompt Info:${NC}"
    echo "  Model Family: $MODEL_FAMILY"
    if [[ -n "$STATUS" ]]; then
        echo "  Status: $STATUS"
    fi
    if [[ -n "$RECOMMENDED_MODELS" ]]; then
        echo "  Recommended Models:"
        while IFS= read -r model; do
            echo "    - $model"
        done <<< "$RECOMMENDED_MODELS"
    fi
    echo ""
fi

echo "To restore the default:"
echo "  ./scripts/prompts/use-prompt.sh --agent=$AGENT_NAME --variant=default"
echo ""
echo "To test this prompt:"
echo "  ./scripts/prompts/test-prompt.sh --agent=$AGENT_NAME --variant=$PROMPT_VARIANT"
