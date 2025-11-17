#!/usr/bin/env bash

#############################################################################
# OpenCode Agents Installer
# Interactive installer for OpenCode agents, commands, tools, and plugins
#############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/darrenhinde/opencode-agents"
BRANCH="${OPENCODE_BRANCH:-main}"  # Allow override via environment variable
RAW_URL="https://raw.githubusercontent.com/darrenhinde/opencode-agents/${BRANCH}"
REGISTRY_URL="${RAW_URL}/registry.json"
INSTALL_DIR=".opencode"
TEMP_DIR="/tmp/opencode-installer-$$"

# Global variables
SELECTED_COMPONENTS=()
INSTALL_MODE=""
PROFILE=""

#############################################################################
# Utility Functions
#############################################################################

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           OpenCode Agents Installer v1.0.0                    ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_step() {
    echo -e "\n${MAGENTA}${BOLD}▶${NC} $1\n"
}

#############################################################################
# Dependency Checks
#############################################################################

check_dependencies() {
    print_step "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install them:"
        echo "  macOS:   brew install ${missing_deps[*]}"
        echo "  Ubuntu:  sudo apt-get install ${missing_deps[*]}"
        echo "  Fedora:  sudo dnf install ${missing_deps[*]}"
        exit 1
    fi
    
    print_success "All dependencies found"
}

#############################################################################
# Registry Functions
#############################################################################

fetch_registry() {
    print_step "Fetching component registry..."
    
    mkdir -p "$TEMP_DIR"
    
    if ! curl -fsSL "$REGISTRY_URL" -o "$TEMP_DIR/registry.json"; then
        print_error "Failed to fetch registry from $REGISTRY_URL"
        exit 1
    fi
    
    print_success "Registry fetched successfully"
}

get_profile_components() {
    local profile=$1
    jq -r ".profiles.${profile}.components[]" "$TEMP_DIR/registry.json"
}

get_component_info() {
    local component_id=$1
    local component_type=$2
    
    jq -r ".components.${component_type}[] | select(.id == \"${component_id}\")" "$TEMP_DIR/registry.json"
}

resolve_dependencies() {
    local component=$1
    local type="${component%%:*}"
    local id="${component##*:}"
    
    # Get dependencies for this component
    local deps=$(jq -r ".components.${type}s[] | select(.id == \"${id}\") | .dependencies[]?" "$TEMP_DIR/registry.json" 2>/dev/null || echo "")
    
    if [ -n "$deps" ]; then
        for dep in $deps; do
            # Add dependency if not already in list
            if [[ ! " ${SELECTED_COMPONENTS[@]} " =~ " ${dep} " ]]; then
                SELECTED_COMPONENTS+=("$dep")
                # Recursively resolve dependencies
                resolve_dependencies "$dep"
            fi
        done
    fi
}

#############################################################################
# Installation Mode Selection
#############################################################################

show_main_menu() {
    clear
    print_header
    
    echo -e "${BOLD}Choose installation mode:${NC}\n"
    echo "  1) Quick Install (Choose a profile)"
    echo "  2) Custom Install (Pick individual components)"
    echo "  3) List Available Components"
    echo "  4) Exit"
    echo ""
    read -p "Enter your choice [1-4]: " choice
    
    case $choice in
        1) INSTALL_MODE="profile" ;;
        2) INSTALL_MODE="custom" ;;
        3) list_components; show_main_menu ;;
        4) cleanup_and_exit 0 ;;
        *) print_error "Invalid choice"; sleep 2; show_main_menu ;;
    esac
}

#############################################################################
# Profile Installation
#############################################################################

show_profile_menu() {
    clear
    print_header
    
    echo -e "${BOLD}Available Installation Profiles:${NC}\n"
    
    # Core profile
    local core_desc=$(jq -r '.profiles.core.description' "$TEMP_DIR/registry.json")
    local core_count=$(jq -r '.profiles.core.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${GREEN}1) Core${NC}"
    echo -e "     ${core_desc}"
    echo -e "     Components: ${core_count}\n"
    
    # Developer profile
    local dev_desc=$(jq -r '.profiles.developer.description' "$TEMP_DIR/registry.json")
    local dev_count=$(jq -r '.profiles.developer.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${BLUE}2) Developer${NC}"
    echo -e "     ${dev_desc}"
    echo -e "     Components: ${dev_count}\n"
    
    # Full profile
    local full_desc=$(jq -r '.profiles.full.description' "$TEMP_DIR/registry.json")
    local full_count=$(jq -r '.profiles.full.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${MAGENTA}3) Full${NC}"
    echo -e "     ${full_desc}"
    echo -e "     Components: ${full_count}\n"
    
    # Advanced profile
    local adv_desc=$(jq -r '.profiles.advanced.description' "$TEMP_DIR/registry.json")
    local adv_count=$(jq -r '.profiles.advanced.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${YELLOW}4) Advanced${NC}"
    echo -e "     ${adv_desc}"
    echo -e "     Components: ${adv_count}\n"
    
    echo "  5) Back to main menu"
    echo ""
    read -p "Enter your choice [1-5]: " choice
    
    case $choice in
        1) PROFILE="core" ;;
        2) PROFILE="developer" ;;
        3) PROFILE="full" ;;
        4) PROFILE="advanced" ;;
        5) show_main_menu; return ;;
        *) print_error "Invalid choice"; sleep 2; show_profile_menu; return ;;
    esac
    
    # Load profile components
    mapfile -t SELECTED_COMPONENTS < <(get_profile_components "$PROFILE")
    
    show_installation_preview
}

#############################################################################
# Custom Component Selection
#############################################################################

show_custom_menu() {
    clear
    print_header
    
    echo -e "${BOLD}Select component categories to install:${NC}\n"
    echo "Use space to toggle, Enter to continue"
    echo ""
    
    local categories=("agents" "subagents" "commands" "tools" "plugins" "contexts" "config")
    local selected_categories=()
    
    # Simple selection (for now, we'll make it interactive later)
    echo "Available categories:"
    for i in "${!categories[@]}"; do
        local cat="${categories[$i]}"
        local count=$(jq -r ".components.${cat} | length" "$TEMP_DIR/registry.json")
        echo "  $((i+1))) ${cat^} (${count} available)"
    done
    echo "  $((${#categories[@]}+1))) Select All"
    echo "  $((${#categories[@]}+2))) Continue to component selection"
    echo "  $((${#categories[@]}+3))) Back to main menu"
    echo ""
    
    read -p "Enter category numbers (space-separated) or option: " -a selections
    
    for sel in "${selections[@]}"; do
        if [ "$sel" -eq $((${#categories[@]}+1)) ]; then
            selected_categories=("${categories[@]}")
            break
        elif [ "$sel" -eq $((${#categories[@]}+2)) ]; then
            break
        elif [ "$sel" -eq $((${#categories[@]}+3)) ]; then
            show_main_menu
            return
        elif [ "$sel" -ge 1 ] && [ "$sel" -le ${#categories[@]} ]; then
            selected_categories+=("${categories[$((sel-1))]}")
        fi
    done
    
    if [ ${#selected_categories[@]} -eq 0 ]; then
        print_warning "No categories selected"
        sleep 2
        show_custom_menu
        return
    fi
    
    show_component_selection "${selected_categories[@]}"
}

show_component_selection() {
    local categories=("$@")
    clear
    print_header
    
    echo -e "${BOLD}Select components to install:${NC}\n"
    
    local all_components=()
    local component_details=()
    
    for category in "${categories[@]}"; do
        echo -e "${CYAN}${BOLD}${category^}:${NC}"
        
        local components=$(jq -r ".components.${category}[] | .id" "$TEMP_DIR/registry.json")
        
        local idx=1
        while IFS= read -r comp_id; do
            local comp_name=$(jq -r ".components.${category}[] | select(.id == \"${comp_id}\") | .name" "$TEMP_DIR/registry.json")
            local comp_desc=$(jq -r ".components.${category}[] | select(.id == \"${comp_id}\") | .description" "$TEMP_DIR/registry.json")
            
            echo "  ${idx}) ${comp_name}"
            echo "     ${comp_desc}"
            
            all_components+=("${category}:${comp_id}")
            component_details+=("${comp_name}|${comp_desc}")
            
            idx=$((idx+1))
        done <<< "$components"
        
        echo ""
    done
    
    echo "Enter component numbers (space-separated), 'all' for all, or 'done' to continue:"
    read -a selections
    
    for sel in "${selections[@]}"; do
        if [ "$sel" = "all" ]; then
            SELECTED_COMPONENTS=("${all_components[@]}")
            break
        elif [ "$sel" = "done" ]; then
            break
        elif [ "$sel" -ge 1 ] && [ "$sel" -le ${#all_components[@]} ]; then
            SELECTED_COMPONENTS+=("${all_components[$((sel-1))]}")
        fi
    done
    
    if [ ${#SELECTED_COMPONENTS[@]} -eq 0 ]; then
        print_warning "No components selected"
        sleep 2
        show_custom_menu
        return
    fi
    
    # Resolve dependencies
    print_step "Resolving dependencies..."
    local original_count=${#SELECTED_COMPONENTS[@]}
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        resolve_dependencies "$comp"
    done
    
    if [ ${#SELECTED_COMPONENTS[@]} -gt $original_count ]; then
        print_info "Added $((${#SELECTED_COMPONENTS[@]} - original_count)) dependencies"
    fi
    
    show_installation_preview
}

#############################################################################
# Installation Preview & Confirmation
#############################################################################

show_installation_preview() {
    clear
    print_header
    
    echo -e "${BOLD}Installation Preview${NC}\n"
    
    if [ -n "$PROFILE" ]; then
        echo -e "Profile: ${GREEN}${PROFILE}${NC}"
    else
        echo -e "Mode: ${GREEN}Custom${NC}"
    fi
    
    echo -e "\nComponents to install (${#SELECTED_COMPONENTS[@]} total):\n"
    
    # Group by type
    local agents=()
    local subagents=()
    local commands=()
    local tools=()
    local plugins=()
    local contexts=()
    local configs=()
    
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        local type="${comp%%:*}"
        case $type in
            agent) agents+=("$comp") ;;
            subagent) subagents+=("$comp") ;;
            command) commands+=("$comp") ;;
            tool) tools+=("$comp") ;;
            plugin) plugins+=("$comp") ;;
            context) contexts+=("$comp") ;;
            config) configs+=("$comp") ;;
        esac
    done
    
    [ ${#agents[@]} -gt 0 ] && echo -e "${CYAN}Agents (${#agents[@]}):${NC} ${agents[*]##*:}"
    [ ${#subagents[@]} -gt 0 ] && echo -e "${CYAN}Subagents (${#subagents[@]}):${NC} ${subagents[*]##*:}"
    [ ${#commands[@]} -gt 0 ] && echo -e "${CYAN}Commands (${#commands[@]}):${NC} ${commands[*]##*:}"
    [ ${#tools[@]} -gt 0 ] && echo -e "${CYAN}Tools (${#tools[@]}):${NC} ${tools[*]##*:}"
    [ ${#plugins[@]} -gt 0 ] && echo -e "${CYAN}Plugins (${#plugins[@]}):${NC} ${plugins[*]##*:}"
    [ ${#contexts[@]} -gt 0 ] && echo -e "${CYAN}Contexts (${#contexts[@]}):${NC} ${contexts[*]##*:}"
    [ ${#configs[@]} -gt 0 ] && echo -e "${CYAN}Config (${#configs[@]}):${NC} ${configs[*]##*:}"
    
    echo ""
    read -p "Proceed with installation? [Y/n]: " confirm
    
    if [[ $confirm =~ ^[Nn] ]]; then
        print_info "Installation cancelled"
        cleanup_and_exit 0
    fi
    
    perform_installation
}

#############################################################################
# Installation
#############################################################################

perform_installation() {
    print_step "Installing components..."
    
    # Check if .opencode already exists
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "$INSTALL_DIR directory already exists"
        read -p "Backup and continue? [Y/n]: " backup_confirm
        
        if [[ ! $backup_confirm =~ ^[Nn] ]]; then
            local backup_dir="${INSTALL_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
            mv "$INSTALL_DIR" "$backup_dir"
            print_success "Backed up to $backup_dir"
        else
            print_error "Installation cancelled"
            cleanup_and_exit 1
        fi
    fi
    
    # Create directory structure
    mkdir -p "$INSTALL_DIR"/{agent/subagents,command,tool,plugin,context/{core,project}}
    
    local installed=0
    local failed=0
    
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        local type="${comp%%:*}"
        local id="${comp##*:}"
        
        # Get component path
        local path=$(jq -r ".components.${type}s[] | select(.id == \"${id}\") | .path" "$TEMP_DIR/registry.json")
        
        if [ -z "$path" ] || [ "$path" = "null" ]; then
            print_warning "Could not find path for ${comp}"
            ((failed++))
            continue
        fi
        
        # Download component
        local url="${RAW_URL}/${path}"
        local dest="${path}"
        
        # Create parent directory if needed
        mkdir -p "$(dirname "$dest")"
        
        if curl -fsSL "$url" -o "$dest"; then
            print_success "Installed ${type}: ${id}"
            ((installed++))
        else
            print_error "Failed to install ${type}: ${id}"
            ((failed++))
        fi
    done
    
    # Handle additional paths for advanced profile
    if [ "$PROFILE" = "advanced" ]; then
        local additional_paths=$(jq -r '.profiles.advanced.additionalPaths[]?' "$TEMP_DIR/registry.json")
        if [ -n "$additional_paths" ]; then
            print_step "Installing additional paths..."
            while IFS= read -r path; do
                # For directories, we'd need to recursively download
                # For now, just note them
                print_info "Additional path: $path (manual download required)"
            done <<< "$additional_paths"
        fi
    fi
    
    echo ""
    print_success "Installation complete!"
    echo -e "  Installed: ${GREEN}${installed}${NC}"
    [ $failed -gt 0 ] && echo -e "  Failed: ${RED}${failed}${NC}"
    
    show_post_install
}

#############################################################################
# Post-Installation
#############################################################################

show_post_install() {
    echo ""
    print_step "Next Steps"
    
    echo "1. Review the installed components in .opencode/"
    echo "2. Copy env.example to .env and configure:"
    echo "   ${CYAN}cp env.example .env${NC}"
    echo "3. Start using OpenCode agents:"
    echo "   ${CYAN}opencode${NC}"
    echo ""
    
    print_info "Documentation: ${REPO_URL}"
    echo ""
    
    cleanup_and_exit 0
}

#############################################################################
# Component Listing
#############################################################################

list_components() {
    clear
    print_header
    
    echo -e "${BOLD}Available Components${NC}\n"
    
    local categories=("agents" "subagents" "commands" "tools" "plugins" "contexts")
    
    for category in "${categories[@]}"; do
        echo -e "${CYAN}${BOLD}${category^}:${NC}"
        
        local components=$(jq -r ".components.${category}[] | \"\(.id)|\(.name)|\(.description)\"" "$TEMP_DIR/registry.json")
        
        while IFS='|' read -r id name desc; do
            echo -e "  ${GREEN}${name}${NC} (${id})"
            echo -e "    ${desc}"
        done <<< "$components"
        
        echo ""
    done
    
    read -p "Press Enter to continue..."
}

#############################################################################
# Cleanup
#############################################################################

cleanup_and_exit() {
    rm -rf "$TEMP_DIR"
    exit "$1"
}

trap 'cleanup_and_exit 1' INT TERM

#############################################################################
# Main
#############################################################################

main() {
    # Parse command line arguments
    case "${1:-}" in
        --core)
            INSTALL_MODE="profile"
            PROFILE="core"
            ;;
        --developer)
            INSTALL_MODE="profile"
            PROFILE="developer"
            ;;
        --full)
            INSTALL_MODE="profile"
            PROFILE="full"
            ;;
        --advanced)
            INSTALL_MODE="profile"
            PROFILE="advanced"
            ;;
        --list)
            check_dependencies
            fetch_registry
            list_components
            cleanup_and_exit 0
            ;;
        --help|-h)
            print_header
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --core        Install core profile"
            echo "  --developer   Install developer profile"
            echo "  --full        Install full profile"
            echo "  --advanced    Install advanced profile"
            echo "  --list        List all available components"
            echo "  --help        Show this help message"
            echo ""
            echo "Without options, runs in interactive mode"
            exit 0
            ;;
    esac
    
    check_dependencies
    fetch_registry
    
    if [ -n "$PROFILE" ]; then
        # Non-interactive mode
        mapfile -t SELECTED_COMPONENTS < <(get_profile_components "$PROFILE")
        show_installation_preview
    else
        # Interactive mode
        show_main_menu
        
        if [ "$INSTALL_MODE" = "profile" ]; then
            show_profile_menu
        elif [ "$INSTALL_MODE" = "custom" ]; then
            show_custom_menu
        fi
    fi
}

main "$@"
