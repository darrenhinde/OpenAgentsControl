#!/usr/bin/env bash

#############################################################################
# Component Registration Script - SIMPLIFIED VERSION
# Just preserves the manually created built-ai-configs/registry/registry.json
# Auto-scanning can be added later after more testing
#############################################################################

set -e

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║           Component Registration Script                       ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo "ℹ️  This script currently preserves the manually maintained built-ai-configs/registry/registry.json"
echo "ℹ️  Auto-scanning feature will be added in a future update"
echo ""

if [ ! -f "built-ai-configs/registry/registry.json" ]; then
    echo "❌ Error: built-ai-configs/registry/registry.json not found"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed"
    exit 1
fi

if ! jq empty built-ai-configs/registry/registry.json 2>/dev/null; then
    echo "❌ Error: built-ai-configs/registry/registry.json is not valid JSON"
    exit 1
fi

# Update the lastUpdated timestamp
jq '.metadata.lastUpdated = (now | strftime("%Y-%m-%d"))' built-ai-configs/registry/registry.json > built-ai-configs/registry/registry.json.tmp
mv built-ai-configs/registry/registry.json.tmp built-ai-configs/registry/registry.json

echo -e "${GREEN}✓${NC} Registry validated successfully"
echo ""
echo "Registry Statistics:"
echo "  Agents:    $(jq '.components.agents | length' built-ai-configs/registry/registry.json)"
echo "  Subagents: $(jq '.components.subagents | length' built-ai-configs/registry/registry.json)"
echo "  Commands:  $(jq '.components.commands | length' built-ai-configs/registry/registry.json)"
echo "  Tools:     $(jq '.components.tools | length' built-ai-configs/registry/registry.json)"
echo "  Plugins:   $(jq '.components.plugins | length' built-ai-configs/registry/registry.json)"
echo "  Contexts:  $(jq '.components.contexts | length' built-ai-configs/registry/registry.json)"
echo ""
echo -e "${GREEN}✓${NC} Done!"
