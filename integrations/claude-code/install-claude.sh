#!/usr/bin/env bash
#
# install-claude.sh
# Installs OpenAgents Control to Claude Code with automatic conversion
#

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Determine paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCODE_DIR="$REPO_ROOT/.opencode/agent"
CONVERTER_DIR="$SCRIPT_DIR/converter"
PLUGIN_DEST="$HOME/.claude/plugins/openagents-control-bridge"
NODE_BIN="${NODE_BIN:-node}"

echo -e "${GREEN}🚀 OpenAgents Control → Claude Code Installer${NC}"
echo -e "   Source: $OPENCODE_DIR"
echo -e "   Destination: $PLUGIN_DEST"
echo ""

# Check prerequisites
check_prereqs() {
    local missing=()

    # Check for node
    if ! command -v "$NODE_BIN" >/dev/null 2>&1; then
        missing+=("$NODE_BIN")
    fi

    # Check for bash
    if ! command -v bash >/dev/null 2>&1; then
        missing+=("bash")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}✗ Missing required commands: ${missing[*]}${NC}" >&2
        echo -e "  Install Node.js: https://nodejs.org/" >&2
        exit 1
    fi
}

# Run converter
run_converter() {
    echo -e "${YELLOW}🔄 Converting agents to Claude format...${NC}"
    cd "$CONVERTER_DIR"

    if ! "$NODE_BIN" src/convert-agents.js 2>&1 | grep -q "Conversion complete"; then
        echo -e "${RED}✗ Conversion failed${NC}" >&2
        exit 1
    fi

    echo -e "${GREEN}✅ Conversion complete${NC}"
}

# Install plugin
install_plugin() {
    echo -e "${YELLOW}📦 Installing plugin...${NC}"

    # Create destination
    mkdir -p "$HOME/.claude/plugins"

    # Remove old installation
    if [ -d "$PLUGIN_DEST" ]; then
        echo "🗑️  Removing old installation..."
        rm -rf "$PLUGIN_DEST"
    fi

    # Copy from generated (always fresh conversion)
    cp -r "$CONVERTER_DIR/generated" "$PLUGIN_DEST"

    echo -e "${GREEN}✅ Installation complete${NC}"
}

# Verify installation
verify() {
    if [ ! -f "$PLUGIN_DEST/agents/core/openagent.md" ]; then
        echo -e "${RED}✗ Installation verification failed${NC}" >&2
        echo "  Expected: $PLUGIN_DEST/agents/core/openagent.md" >&2
        exit 1
    fi

    echo ""
    echo -e "${GREEN}✨ Installation successful!${NC}"
    echo ""
    echo "To use with Claude Code:"
    echo "   claude --plugin-dir $PLUGIN_DEST"
    echo ""
    echo "Or add to your Claude Code settings for automatic loading:"
    echo '   { "plugins": ["openagents-control-bridge"] }'
    echo ""
    echo "Verify Claude Code installation:"
    echo "   claude --version"
}

# Main workflow
main() {
    check_prereqs
    run_converter
    install_plugin
    verify
}

# Allow specifying custom Node.js binary via NODE_BIN environment variable
main "$@"
