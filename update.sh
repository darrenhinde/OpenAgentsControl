#!/usr/bin/env bash

#############################################################################
# OpenAgents Control Updater
# Updates existing OpenCode components to latest versions
#############################################################################

set -e

# Colors
GREEN='\033[0;32m'
# YELLOW='\033[1;33m' # Unused
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

REPO_URL="https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main"
INSTALL_DIR=".opencode"

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_step() { echo -e "\n${CYAN}${BOLD}▶${NC} $1\n"; }

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           OpenAgents Control Updater v1.0.0                   ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

update_component() {
    local path=$1
    local url="${REPO_URL}/${path}"
    
    if [ ! -f "$path" ]; then
        print_info "Skipping $path (not installed)"
        return
    fi
    
    # Backup existing file
    cp "$path" "${path}.backup"
    
    if curl -fsSL "$url" -o "$path"; then
        print_success "Updated $path"
        rm "${path}.backup"
    else
        print_info "Failed to update $path, restoring backup"
        mv "${path}.backup" "$path"
    fi
}

main() {
    print_header
    
    if [ ! -d "$INSTALL_DIR" ]; then
        echo "Error: $INSTALL_DIR directory not found"
        echo "Run install.sh first to install components"
        exit 1
    fi
    
    print_step "Updating components..."
    
    # Update all markdown files in .opencode
    while IFS= read -r -d '' file; do
        update_component "$file"
    done < <(find "$INSTALL_DIR" -name "*.md" -type f -print0)
    
    # Update TypeScript files
    while IFS= read -r -d '' file; do
        update_component "$file"
    done < <(find "$INSTALL_DIR" -name "*.ts" -type f -not -path "*/node_modules/*" -print0)
    
    # Update config files
    [ -f "env.example" ] && update_component "env.example"
    
    print_success "Update complete!"
}

main "$@"
