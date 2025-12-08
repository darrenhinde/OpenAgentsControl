#!/usr/bin/env bash
#
# OpenCode Agent Token Counter
# Estimates token count for agent prompts by analyzing all context sources
#
# Usage: ./count-agent-tokens.sh [agent-name] [model-id] [provider-id]
# Example: ./count-agent-tokens.sh build claude-3-5-sonnet-20241022 anthropic
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Default values
AGENT="${1:-build}"
MODEL="${2:-claude-3-5-sonnet-20241022}"
PROVIDER="${3:-anthropic}"
WORKSPACE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Token estimation: ~1.3 tokens per word (average for English)
TOKEN_MULTIPLIER=1.3

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${CYAN}  OpenCode Agent Token Counter${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Agent:${NC}    $AGENT"
echo -e "${BLUE}Model:${NC}    $MODEL"
echo -e "${BLUE}Provider:${NC} $PROVIDER"
echo -e "${BLUE}Workspace:${NC} $WORKSPACE_ROOT"
echo ""

TOTAL_TOKENS=0

# Function to count tokens in a file
count_tokens() {
    local file="$1"
    local label="$2"
    
    if [[ ! -f "$file" ]]; then
        return 0
    fi
    
    local word_count=$(wc -w < "$file" 2>/dev/null || echo 0)
    local token_estimate=$(echo "$word_count * $TOKEN_MULTIPLIER" | bc | cut -d. -f1)
    
    echo -e "${GREEN}✓${NC} ${label}"
    echo -e "  ${YELLOW}→${NC} $file"
    echo -e "  ${CYAN}~$token_estimate tokens${NC} ($word_count words)"
    echo ""
    
    TOTAL_TOKENS=$((TOTAL_TOKENS + token_estimate))
}

# Function to count tokens from command output
count_tokens_from_output() {
    local output="$1"
    local label="$2"
    
    if [[ -z "$output" ]]; then
        return 0
    fi
    
    local word_count=$(echo "$output" | wc -w)
    local token_estimate=$(echo "$word_count * $TOKEN_MULTIPLIER" | bc | cut -d. -f1)
    
    echo -e "${GREEN}✓${NC} ${label}"
    echo -e "  ${CYAN}~$token_estimate tokens${NC} ($word_count words)"
    echo ""
    
    TOTAL_TOKENS=$((TOTAL_TOKENS + token_estimate))
}

echo -e "${BOLD}${YELLOW}1. System Prompt Header${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Header (only for anthropic)
if [[ "$PROVIDER" == *"anthropic"* ]]; then
    HEADER_TOKENS=$(echo "You are Claude Code, Anthropic's official CLI for Claude." | wc -w | xargs -I {} echo "{} * $TOKEN_MULTIPLIER" | bc | cut -d. -f1)
    TOTAL_TOKENS=$((TOTAL_TOKENS + HEADER_TOKENS))
    echo -e "${GREEN}✓${NC} Anthropic Header"
    echo -e "  ${CYAN}~$HEADER_TOKENS tokens${NC}"
    echo ""
else
    echo -e "${YELLOW}⊘${NC} No header (non-Anthropic provider)"
    echo ""
fi

echo -e "${BOLD}${YELLOW}2. Base Model Prompt${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PROMPT_DIR="$WORKSPACE_ROOT/packages/opencode/src/session/prompt"

# Determine which base prompt to use
if [[ "$MODEL" == *"gpt-5"* ]]; then
    PROMPT_FILE="$PROMPT_DIR/codex.txt"
elif [[ "$MODEL" == *"gpt-"* ]] || [[ "$MODEL" == *"o1"* ]] || [[ "$MODEL" == *"o3"* ]]; then
    PROMPT_FILE="$PROMPT_DIR/beast.txt"
elif [[ "$MODEL" == *"gemini-"* ]]; then
    PROMPT_FILE="$PROMPT_DIR/gemini.txt"
elif [[ "$MODEL" == *"claude"* ]]; then
    PROMPT_FILE="$PROMPT_DIR/anthropic.txt"
else
    PROMPT_FILE="$PROMPT_DIR/qwen.txt"
fi

count_tokens "$PROMPT_FILE" "Base Model Prompt"

echo -e "${BOLD}${YELLOW}3. Environment Context${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Environment info (static text)
ENV_TEXT="Here is some useful information about the environment you are running in:
<env>
  Working directory: $WORKSPACE_ROOT
  Is directory a git repo: yes
  Platform: $(uname -s | tr '[:upper:]' '[:lower:]')
  Today's date: $(date +"%A %b %d, %Y")
</env>"

count_tokens_from_output "$ENV_TEXT" "Environment Info"

# Project tree (git ls-files limited to 200)
if [[ -d "$WORKSPACE_ROOT/.git" ]]; then
    cd "$WORKSPACE_ROOT"
    TREE_OUTPUT=$(git ls-files 2>/dev/null | head -n 200 | sed 's/^/  - /' 2>/dev/null || echo "  (tree unavailable)")
    PROJECT_TREE="<project>
$TREE_OUTPUT
</project>"
    count_tokens_from_output "$PROJECT_TREE" "Project Tree (up to 200 files)"
else
    echo -e "${YELLOW}⊘${NC} No project tree (not a git repo)"
    echo ""
fi

echo -e "${BOLD}${YELLOW}4. Custom Instructions${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

CUSTOM_FILES_FOUND=0

# Local rule files (search up from current dir)
LOCAL_RULES=("AGENTS.md" "CLAUDE.md" "CONTEXT.md")
for rule in "${LOCAL_RULES[@]}"; do
    # Find the file searching upward from workspace root
    FOUND_FILE=$(find "$WORKSPACE_ROOT" -maxdepth 3 -name "$rule" 2>/dev/null | head -n 1)
    if [[ -n "$FOUND_FILE" ]]; then
        count_tokens "$FOUND_FILE" "Local: $rule"
        CUSTOM_FILES_FOUND=1
    fi
done

# Global rule files
GLOBAL_RULES=(
    "$HOME/.config/opencode/AGENTS.md"
    "$HOME/.claude/CLAUDE.md"
)

for rule_file in "${GLOBAL_RULES[@]}"; do
    if [[ -f "$rule_file" ]]; then
        count_tokens "$rule_file" "Global: $(basename "$rule_file")"
        CUSTOM_FILES_FOUND=1
    fi
done

# Check config.instructions (only loads files explicitly listed)
CONFIG_FILE="$WORKSPACE_ROOT/opencode.json"
if [[ -f "$CONFIG_FILE" ]] && grep -q '"instructions"' "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${BLUE}Checking config.instructions...${NC}"
    # Extract instructions array (simplified - won't handle complex JSON)
    # This is a best-effort check; actual implementation uses proper JSON parsing
    echo -e "${YELLOW}Note: Script cannot parse instructions array. Check opencode.json manually.${NC}"
    echo ""
fi

if [[ $CUSTOM_FILES_FOUND -eq 0 ]]; then
    echo -e "${YELLOW}⊘${NC} No custom instruction files found"
    echo ""
fi

echo -e "${BOLD}${YELLOW}5. Tool Definitions${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TOOL_DIR="$WORKSPACE_ROOT/packages/opencode/src/tool"

if [[ -d "$TOOL_DIR" ]]; then
    echo -e "${BLUE}Counting built-in tool descriptions...${NC}"
    TOOL_COUNT=0
    TOOL_TOKENS=0
    
    for tool_desc in "$TOOL_DIR"/*.txt; do
        if [[ -f "$tool_desc" ]] && [[ ! "$tool_desc" =~ (todoread|todowrite) ]]; then
            word_count=$(wc -w < "$tool_desc")
            token_estimate=$(echo "$word_count * $TOKEN_MULTIPLIER" | bc | cut -d. -f1)
            TOOL_TOKENS=$((TOOL_TOKENS + token_estimate))
            TOOL_COUNT=$((TOOL_COUNT + 1))
        fi
    done
    
    # Add ~50 tokens per tool for JSON schema overhead
    SCHEMA_OVERHEAD=$((TOOL_COUNT * 50))
    TOOL_TOKENS=$((TOOL_TOKENS + SCHEMA_OVERHEAD))
    
    echo -e "${GREEN}✓${NC} $TOOL_COUNT tool definitions found"
    echo -e "  ${CYAN}~$TOOL_TOKENS tokens${NC} (descriptions + schemas)"
    echo ""
    TOTAL_TOKENS=$((TOTAL_TOKENS + TOOL_TOKENS))
else
    echo -e "${RED}✗${NC} Tool directory not found"
    echo ""
fi

echo -e "${BOLD}${YELLOW}6. Agent-Specific Configuration${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check opencode.json for agent config
CONFIG_FILE="$WORKSPACE_ROOT/opencode.json"
if [[ -f "$CONFIG_FILE" ]]; then
    echo -e "${GREEN}✓${NC} Found opencode.json"
    
    # Try to extract agent-specific prompt (this is a simplified check)
    if grep -q "\"$AGENT\"" "$CONFIG_FILE" 2>/dev/null; then
        echo -e "  ${YELLOW}→${NC} Agent '$AGENT' has custom configuration"
        echo -e "  ${CYAN}Note: Custom prompts counted separately if present${NC}"
    else
        echo -e "  ${YELLOW}→${NC} Using default configuration for '$AGENT' agent"
    fi
    echo ""
else
    echo -e "${YELLOW}⊘${NC} No opencode.json found (using defaults)"
    echo ""
fi

# Check for agent-specific markdown files
AGENT_MD_DIRS=(
    "$HOME/.config/opencode/agent"
    "$WORKSPACE_ROOT/.opencode/agent"
)

for agent_dir in "${AGENT_MD_DIRS[@]}"; do
    if [[ -d "$agent_dir" ]]; then
        AGENT_FILE="$agent_dir/${AGENT}.md"
        if [[ -f "$AGENT_FILE" ]]; then
            count_tokens "$AGENT_FILE" "Agent-specific: ${AGENT}.md"
        fi
    fi
done

echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}TOTAL ESTIMATED TOKENS: ~$TOTAL_TOKENS${NC}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Note:${NC} This is an estimate using word count × 1.3"
echo -e "      Actual token count may vary by ±10-20% depending on the tokenizer"
echo -e "      This count includes system prompts + context, but not your actual message"
echo ""

