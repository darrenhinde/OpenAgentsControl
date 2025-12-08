#!/bin/bash
# uninstall.sh - Uninstalls OpenCode Agents

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}OpenCode Agents Uninstaller${NC}"
echo "=============================="
echo ""

# Parse arguments
UNINSTALL_TYPE=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --global)
            UNINSTALL_TYPE="global"
            shift
            ;;
        --local)
            UNINSTALL_TYPE="local"
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./uninstall.sh [options]"
            echo ""
            echo "Options:"
            echo "  --global    Uninstall from ~/.config/opencode"
            echo "  --local     Uninstall from current directory .opencode/"
            echo "  --force     Skip confirmation prompts"
            echo "  --help      Show this help message"
            echo ""
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Determine uninstall location
if [ -z "$UNINSTALL_TYPE" ]; then
    echo "Select uninstall location:"
    echo "  1) Local (.opencode/ in current directory)"
    echo "  2) Global (~/.config/opencode/)"
    echo ""
    read -p "Enter your choice [1-2]: " choice
    
    case $choice in
        1) UNINSTALL_TYPE="local" ;;
        2) UNINSTALL_TYPE="global" ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
fi

# Set target directory
if [ "$UNINSTALL_TYPE" == "global" ]; then
    TARGET_DIR="$HOME/.config/opencode"
else
    TARGET_DIR="$(pwd)/.opencode"
fi

echo ""
echo -e "${YELLOW}Uninstall location:${NC} $TARGET_DIR"
echo ""

# Check if installation exists
if [ ! -f "$TARGET_DIR/.opencode-agents-version" ]; then
    echo -e "${YELLOW}⚠️  No OpenCode Agents installation found at: $TARGET_DIR${NC}"
    echo ""
    echo "This directory may contain other files or a manual installation."
    echo ""
    
    if [ "$FORCE" != "true" ]; then
        read -p "Continue with uninstall anyway? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Uninstall cancelled."
            exit 0
        fi
    fi
else
    # Show installation info
    echo "Installation details:"
    cat "$TARGET_DIR/.opencode-agents-version"
    echo ""
fi

# Confirm uninstall
if [ "$FORCE" != "true" ]; then
    echo -e "${RED}⚠️  This will remove all OpenCode Agents files from: $TARGET_DIR${NC}"
    echo ""
    echo "The following will be removed:"
    echo "  - $TARGET_DIR/agent/"
    echo "  - $TARGET_DIR/command/"
    echo "  - $TARGET_DIR/context/"
    echo "  - $TARGET_DIR/.opencode-agents-version"
    echo ""
    read -p "Are you sure you want to uninstall? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Uninstall cancelled."
        exit 0
    fi
fi

# Perform uninstall
echo ""
echo "Uninstalling..."

removed_count=0

# Remove agent directory
if [ -d "$TARGET_DIR/agent" ]; then
    rm -rf "$TARGET_DIR/agent"
    echo -e "${GREEN}✓${NC} Removed agents"
    removed_count=$((removed_count + 1))
fi

# Remove command directory
if [ -d "$TARGET_DIR/command" ]; then
    rm -rf "$TARGET_DIR/command"
    echo -e "${GREEN}✓${NC} Removed commands"
    removed_count=$((removed_count + 1))
fi

# Remove context directory
if [ -d "$TARGET_DIR/context" ]; then
    rm -rf "$TARGET_DIR/context"
    echo -e "${GREEN}✓${NC} Removed context files"
    removed_count=$((removed_count + 1))
fi

# Remove version file
if [ -f "$TARGET_DIR/.opencode-agents-version" ]; then
    rm -f "$TARGET_DIR/.opencode-agents-version"
    echo -e "${GREEN}✓${NC} Removed installation metadata"
fi

# Remove AGENTS.md.new if it exists
if [ -f "$TARGET_DIR/AGENTS.md.new" ]; then
    rm -f "$TARGET_DIR/AGENTS.md.new"
    echo -e "${GREEN}✓${NC} Removed AGENTS.md.new"
fi

# Check if directory is now empty
if [ -d "$TARGET_DIR" ]; then
    if [ -z "$(ls -A "$TARGET_DIR")" ]; then
        read -p "Remove empty directory $TARGET_DIR? (y/N): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rmdir "$TARGET_DIR"
            echo -e "${GREEN}✓${NC} Removed directory"
        fi
    else
        echo ""
        echo -e "${YELLOW}ℹ${NC}  Directory not empty. Remaining files:"
        ls -la "$TARGET_DIR"
    fi
fi

echo ""
echo -e "${GREEN}✅ Uninstall complete!${NC}"
echo ""

if [ $removed_count -eq 0 ]; then
    echo "No OpenCode Agents files were found to remove."
else
    echo "Removed $removed_count component(s)."
fi

echo ""
echo "To reinstall, run:"
echo "  ./install.sh"
echo ""

exit 0
