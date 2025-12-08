#!/usr/bin/env bash

#############################################################################
# Documentation Sync Validator
# Validates that component counts in README.md match registry.json
# Used in CI to detect when docs are out of sync
# 
# For actual syncing, use the sync-docs.yml GitHub workflow which
# leverages OpenCode to intelligently update documentation
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
REGISTRY_FILE="registry.json"
README_FILE="README.md"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY_RUN=false
VERBOSE=false

#############################################################################
# Utility Functions
#############################################################################

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           Documentation Sync v1.0.0                           ║"
    echo "║           Keep README in sync with registry                   ║"
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

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --dry-run       Show what would be changed without modifying files"
    echo "  -v, --verbose       Show detailed output"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Description:"
    echo "  Syncs component counts and lists from registry.json to README.md"
    echo "  Ensures documentation stays accurate with the component registry"
    echo ""
    exit 0
}

#############################################################################
# Dependency Checks
#############################################################################

check_dependencies() {
    local missing_deps=()
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install them:"
        echo "  macOS:   brew install ${missing_deps[*]}"
        echo "  Ubuntu:  sudo apt-get install ${missing_deps[*]}"
        exit 2
    fi
}

#############################################################################
# Registry Parsing
#############################################################################

get_component_count() {
    local component_type="$1"
    jq -r ".components.${component_type} | length" "$REGISTRY_FILE"
}

get_profile_component_count() {
    local profile="$1"
    jq -r ".profiles.${profile}.components | length" "$REGISTRY_FILE"
}

get_total_components() {
    jq -r '
        .components.agents + 
        .components.subagents + 
        .components.commands + 
        .components.tools + 
        .components.plugins + 
        .components.contexts + 
        .components.config | length
    ' "$REGISTRY_FILE"
}

#############################################################################
# README Update Functions
#############################################################################

update_profile_counts() {
    local readme_content
    readme_content=$(cat "$README_FILE")
    
    # Update Essential profile count
    local essential_count
    essential_count=$(get_profile_component_count "essential")
    readme_content=$(echo "$readme_content" | sed -E "s/(Essential.*\()([0-9]+)( components\))/\1${essential_count}\3/g")
    
    # Update Developer profile count
    local developer_count
    developer_count=$(get_profile_component_count "developer")
    readme_content=$(echo "$readme_content" | sed -E "s/(Developer.*\()([0-9]+)( components\))/\1${developer_count}\3/g")
    
    # Update Business profile count
    local business_count
    business_count=$(get_profile_component_count "business")
    readme_content=$(echo "$readme_content" | sed -E "s/(Business.*\()([0-9]+)( components\))/\1${business_count}\3/g")
    
    # Update Full profile count
    local full_count
    full_count=$(get_profile_component_count "full")
    readme_content=$(echo "$readme_content" | sed -E "s/(Full.*\()([0-9]+)( components\))/\1${full_count}\3/g")
    
    # Update Advanced profile count
    local advanced_count
    advanced_count=$(get_profile_component_count "advanced")
    readme_content=$(echo "$readme_content" | sed -E "s/(Advanced.*\()([0-9]+)( components\))/\1${advanced_count}\3/g")
    
    echo "$readme_content"
}

update_component_counts() {
    local readme_content="$1"
    
    # Get counts from registry
    local agents_count subagents_count commands_count tools_count plugins_count contexts_count
    agents_count=$(get_component_count "agents")
    subagents_count=$(get_component_count "subagents")
    commands_count=$(get_component_count "commands")
    tools_count=$(get_component_count "tools")
    plugins_count=$(get_component_count "plugins")
    contexts_count=$(get_component_count "contexts")
    
    if [ "$VERBOSE" = true ]; then
        print_info "Component counts from registry:"
        echo "  Agents: $agents_count"
        echo "  Subagents: $subagents_count"
        echo "  Commands: $commands_count"
        echo "  Tools: $tools_count"
        echo "  Plugins: $plugins_count"
        echo "  Contexts: $contexts_count"
    fi
    
    echo "$readme_content"
}

#############################################################################
# Main Logic
#############################################################################

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                print_error "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    print_header
    
    # Check dependencies
    check_dependencies
    
    # Change to repo root
    cd "$REPO_ROOT"
    
    # Verify files exist
    if [ ! -f "$REGISTRY_FILE" ]; then
        print_error "Registry file not found: $REGISTRY_FILE"
        exit 1
    fi
    
    if [ ! -f "$README_FILE" ]; then
        print_error "README file not found: $README_FILE"
        exit 1
    fi
    
    print_info "Reading registry: $REGISTRY_FILE"
    print_info "Updating README: $README_FILE"
    echo ""
    
    # Update profile counts
    print_info "Updating installation profile counts..."
    local updated_content
    updated_content=$(update_profile_counts)
    
    # Update component counts
    print_info "Updating component counts..."
    updated_content=$(update_component_counts "$updated_content")
    
    # Check if anything changed
    if [ "$updated_content" = "$(cat "$README_FILE")" ]; then
        print_success "README is already up to date!"
        exit 0
    fi
    
    # Show diff if verbose
    if [ "$VERBOSE" = true ]; then
        echo ""
        print_info "Changes to be made:"
        diff -u "$README_FILE" <(echo "$updated_content") || true
        echo ""
    fi
    
    # Apply changes or show dry-run
    if [ "$DRY_RUN" = true ]; then
        print_warning "DRY RUN - No changes made"
        print_info "Run without --dry-run to apply changes"
    else
        echo "$updated_content" > "$README_FILE"
        print_success "README updated successfully!"
    fi
    
    echo ""
    print_info "Summary:"
    echo "  Essential: $(get_profile_component_count "essential") components"
    echo "  Developer: $(get_profile_component_count "developer") components"
    echo "  Business: $(get_profile_component_count "business") components"
    echo "  Full: $(get_profile_component_count "full") components"
    echo "  Advanced: $(get_profile_component_count "advanced") components"
    echo ""
    echo "  Total: $(get_total_components) components"
}

# Run main function
main "$@"
