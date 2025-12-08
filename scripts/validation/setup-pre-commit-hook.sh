#!/bin/bash
# setup-pre-commit-hook.sh
# Sets up a pre-commit hook to validate test suites before committing
#
# Usage:
#   ./scripts/validation/setup-pre-commit-hook.sh

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

HOOK_FILE="$PROJECT_ROOT/.git/hooks/pre-commit"

echo -e "${BLUE}Setting up pre-commit hook for test suite validation...${NC}"
echo ""

# Create pre-commit hook
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
# Pre-commit hook: Validate test suite JSON files

# Get list of staged JSON files in config directories
STAGED_SUITES=$(git diff --cached --name-only --diff-filter=ACM | grep -E 'evals/agents/.*/config/.*\.json$' || true)

if [[ -n "$STAGED_SUITES" ]]; then
    echo "🔍 Validating test suite JSON files..."
    
    # Run validation
    if ! ./scripts/validation/validate-test-suites.sh --all; then
        echo ""
        echo "❌ Test suite validation failed!"
        echo "   Fix the errors above before committing."
        echo ""
        echo "To skip this check (not recommended):"
        echo "   git commit --no-verify"
        exit 1
    fi
    
    echo "✅ Test suite validation passed"
fi

exit 0
EOF

# Make hook executable
chmod +x "$HOOK_FILE"

echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
echo ""
echo "The hook will automatically validate test suite JSON files before each commit."
echo ""
echo "To test it:"
echo "  1. Edit a test suite: evals/agents/openagent/config/core-tests.json"
echo "  2. Stage the file: git add evals/agents/openagent/config/core-tests.json"
echo "  3. Try to commit: git commit -m 'test'"
echo ""
echo "To skip validation (not recommended):"
echo "  git commit --no-verify"
