#!/usr/bin/env bash
# Show the actual data that's being cached

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  WHAT'S IN THE CACHE (9,053 tokens)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This is the EXACT data sent with EVERY request:"
echo ""

WORKSPACE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

echo "1️⃣  BASE SYSTEM PROMPT (~1,735 tokens)"
echo "   Location: packages/opencode/src/session/prompt/anthropic.txt"
echo ""
echo "   Content preview:"
echo "   ┌────────────────────────────────────────────────"
head -8 "$WORKSPACE/packages/opencode/src/session/prompt/anthropic.txt" | sed 's/^/   │ /'
echo "   │ ... (1,327 more words) ..."
echo "   └────────────────────────────────────────────────"
echo ""
echo "   ❓ Why needed?"
echo "      • Tells AI it's OpenCode"
echo "      • Defines tone and style"
echo "      • Lists available tools"
echo "      • Sets coding standards"
echo ""
echo ""

echo "2️⃣  PROJECT TREE (~525 tokens)"
echo "   Dynamically generated from your git repo"
echo ""
echo "   Content preview:"
echo "   ┌────────────────────────────────────────────────"
git ls-files 2>/dev/null | head -15 | sed 's/^/   │ /' || echo "   │ (no git repo)"
echo "   │ ... (up to 200 files)"
echo "   └────────────────────────────────────────────────"
echo ""
echo "   ❓ Why needed?"
echo "      • AI knows your project structure"
echo "      • Can suggest correct file paths"
echo "      • Understands your tech stack"
echo ""
echo ""

echo "3️⃣  CUSTOM INSTRUCTIONS (~273 tokens)"
echo "   From AGENTS.md and CLAUDE.md"
echo ""
if [ -f "$WORKSPACE/packages/desktop/AGENTS.md" ]; then
    echo "   AGENTS.md preview:"
    echo "   ┌────────────────────────────────────────────────"
    head -10 "$WORKSPACE/packages/desktop/AGENTS.md" | sed 's/^/   │ /'
    echo "   └────────────────────────────────────────────────"
fi
if [ -f "$HOME/.claude/CLAUDE.md" ]; then
    echo ""
    echo "   CLAUDE.md preview:"
    echo "   ┌────────────────────────────────────────────────"
    head -5 "$HOME/.claude/CLAUDE.md" | sed 's/^/   │ /'
    echo "   └────────────────────────────────────────────────"
fi
echo ""
echo "   ❓ Why needed?"
echo "      • Project-specific coding standards"
echo "      • Custom behaviors you defined"
echo ""
echo ""

echo "4️⃣  TOOL DEFINITIONS (~5,274 tokens)"
echo "   14 tools × ~377 tokens each"
echo ""
echo "   Example: 'read' tool definition:"
echo "   ┌────────────────────────────────────────────────"
cat << 'TOOL'
   │ {
   │   "name": "read",
   │   "description": "Read files from the filesystem. 
   │                   Can read multiple files...",
   │   "input_schema": {
   │     "type": "object",
   │     "properties": {
   │       "paths": {
   │         "type": "array",
   │         "items": {"type": "string"},
   │         "description": "Array of file paths..."
   │       }
   │     },
   │     "required": ["paths"]
   │   }
   │ }
TOOL
echo "   └────────────────────────────────────────────────"
echo ""
echo "   Full list: read, write, edit, bash, grep, glob,"
echo "              ls, patch, webfetch, task, multiedit,"
echo "              lsp-diagnostics, lsp-hover, invalid"
echo ""
echo "   ❓ Why needed?"
echo "      • AI knows what tools it can use"
echo "      • Understands tool parameters"
echo "      • Can call functions correctly"
echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  THE KEY INSIGHT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This data is REQUIRED for EVERY request:"
echo ""
echo "❌ Without it:"
echo "   User: \"Just say hi\""
echo "   API:  [No context, no tools, no instructions]"
echo "   AI:   \"Hi\" (but can't do anything else)"
echo ""
echo "✅ With it (cached):"
echo "   User: \"Just say hi\""
echo "   API:  [9,053 tokens of context - from CACHE]"
echo "   AI:   \"HI\" (and ready to use any tool, follow rules)"
echo ""
echo "Cost: Only ~905 tokens instead of 9,053! 💰"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
