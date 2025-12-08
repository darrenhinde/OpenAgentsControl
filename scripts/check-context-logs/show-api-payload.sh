#!/usr/bin/env bash
#
# Show what actually gets sent to the AI API
# This demonstrates why caching saves money
#

set -euo pipefail

AGENT="${1:-build}"
SESSION_ID="${2:-demo}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  What Gets Sent to AI API (Anthropic/Claude)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Every single request sends this structure:"
echo ""

cat << 'EOF'
{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 8192,
  "system": [
    {
      "type": "text",
      "text": "<SYSTEM PROMPT 1 - BASE INSTRUCTIONS>",
      "cache_control": {"type": "ephemeral"}  ← CACHED HERE
    },
    {
      "type": "text", 
      "text": "<SYSTEM PROMPT 2 - ENVIRONMENT + CUSTOM>",
      "cache_control": {"type": "ephemeral"}  ← CACHED HERE
    }
  ],
  "messages": [
    {"role": "user", "content": "Your first message"},
    {"role": "assistant", "content": "AI's response"},
    {"role": "user", "content": "Your second message"}  ← Only this changes!
  ],
  "tools": [
    /* 14 tool definitions with schemas */
  ]
}
EOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

WORKSPACE_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROMPT_DIR="$WORKSPACE_ROOT/packages/opencode/src/session/prompt"

echo "SYSTEM PROMPT 1 - Base Instructions (~1,735 tokens)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "File: packages/opencode/src/session/prompt/anthropic.txt"
echo ""
head -20 "$PROMPT_DIR/anthropic.txt"
echo ""
echo "... (truncated, see full file for complete instructions) ..."
echo ""
echo ""

echo "SYSTEM PROMPT 2 - Environment + Custom Instructions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Environment Info (~40 tokens):"
echo "   - Working directory"
echo "   - Git repo status"  
echo "   - Platform"
echo "   - Current date"
echo ""
echo "2. Project Tree (~500+ tokens):"
if [[ -d "$WORKSPACE_ROOT/.git" ]]; then
    echo ""
    git ls-files 2>/dev/null | head -20 | sed 's/^/   - /'
    echo "   ... (up to 200 files listed)"
else
    echo "   (No git repo)"
fi
echo ""
echo "3. Custom Instructions (~273 tokens):"
echo "   - AGENTS.md"
echo "   - CLAUDE.md" 
echo "   - Any files from config.instructions"
echo ""
echo ""

echo "TOOL DEFINITIONS (~5,274 tokens)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Each tool includes:"
echo "  - Name and description"
echo "  - JSON Schema for parameters"
echo "  - Validation rules"
echo ""
echo "Example tool definition:"
cat << 'EOF'
{
  "name": "read",
  "description": "Read files from the filesystem. Can read multiple...",
  "input_schema": {
    "type": "object",
    "properties": {
      "paths": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Array of file paths to read..."
      }
    },
    "required": ["paths"]
  }
}
EOF
echo ""
echo "× 14 tools = ~5,274 tokens"
echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WHY YOU NEED ALL OF THIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "❌ WITHOUT system prompts:"
echo "   - AI doesn't know it's OpenCode"
echo "   - No instructions on how to use tools"
echo "   - No context about your project"
echo "   - Can't follow coding standards"
echo ""
echo "✅ WITH system prompts (cached):"
echo "   - AI knows its purpose and capabilities"
echo "   - Knows which tools are available"
echo "   - Understands your project structure"
echo "   - Follows your custom instructions"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COST COMPARISON"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "WITHOUT CACHING (10 requests):"
echo "  Request 1: 8,000 tokens × $0.003/1K = $0.024"
echo "  Request 2: 8,000 tokens × $0.003/1K = $0.024"
echo "  Request 3: 8,000 tokens × $0.003/1K = $0.024"
echo "  ..."
echo "  Total: 80,000 tokens = $0.240"
echo ""
echo "WITH CACHING (10 requests):"
echo "  Request 1: 8,000 cache write × $0.00375/1K = $0.030"
echo "  Request 2: 8,000 cache read  × $0.0003/1K  = $0.0024"
echo "  Request 3: 8,000 cache read  × $0.0003/1K  = $0.0024"
echo "  ..."
echo "  Total: $0.030 + (9 × $0.0024) = $0.0516"
echo ""
echo "  SAVINGS: $0.240 - $0.0516 = $0.1884 (78% cheaper!)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The cache contains REQUIRED context that MUST be sent"
echo "with every request. Without it, the AI can't function."
echo ""
echo "You're not paying extra - you're SAVING money! 💰"
echo ""

