#!/usr/bin/env bash

#############################################################################
# Auto-Detect Components Script
# Scans .opencode directory for new components not in registry
# Suggests additions with proper metadata
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
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTO_ADD=false
DRY_RUN=false

# Arrays to store new components
declare -a NEW_COMPONENTS

#############################################################################
# Utility Functions
#############################################################################

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           Auto-Detect Components v1.0.0                       ║"
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
    echo "  -a, --auto-add      Automatically add new components to registry"
    echo "  -d, --dry-run       Show what would be added without modifying registry"
    echo "  -h, --help          Show this help message"
    echo ""
    exit 0
}

#############################################################################
# Component Detection
#############################################################################

extract_metadata_from_file() {
    local file=$1
    local id=""
    local name=""
    local description=""
    
    # Try to extract from frontmatter (YAML)
    if grep -q "^---$" "$file" 2>/dev/null; then
        # Extract description from frontmatter
        description=$(sed -n '/^---$/,/^---$/p' "$file" | grep "^description:" | sed 's/description: *"\?\(.*\)"\?/\1/' | head -1)
    fi
    
    # If no description in frontmatter, try to get from first heading or paragraph
    if [ -z "$description" ]; then
        description=$(grep -m 1 "^# " "$file" | sed 's/^# //' || echo "")
    fi
    
    # Generate ID from filename
    local filename=$(basename "$file" .md)
    id=$(echo "$filename" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    
    # Generate name from filename (capitalize words)
    name=$(echo "$filename" | sed 's/-/ /g' | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) tolower(substr($i,2))}1')
    
    echo "${id}|${name}|${description}"
}

detect_component_type() {
    local path=$1
    
    if [[ "$path" == *"/agent/subagents/"* ]]; then
        echo "subagent"
    elif [[ "$path" == *"/agent/"* ]]; then
        echo "agent"
    elif [[ "$path" == *"/command/"* ]]; then
        echo "command"
    elif [[ "$path" == *"/tool/"* ]]; then
        echo "tool"
    elif [[ "$path" == *"/plugin/"* ]]; then
        echo "plugin"
    elif [[ "$path" == *"/context/"* ]]; then
        echo "context"
    else
        echo "unknown"
    fi
}

get_registry_key() {
    local type=$1
    case "$type" in
        config) echo "config" ;;
        *) echo "${type}s" ;;
    esac
}

scan_for_new_components() {
    print_info "Scanning for new components..."
    echo ""
    
    # Get all paths from registry
    local registry_paths=$(jq -r '.components | to_entries[] | .value[] | .path' "$REGISTRY_FILE" 2>/dev/null | sort -u)
    
    # Scan .opencode directory
    local categories=("agent" "command" "tool" "plugin" "context")
    
    for category in "${categories[@]}"; do
        local category_dir="$REPO_ROOT/.opencode/$category"
        
        if [ ! -d "$category_dir" ]; then
            continue
        fi
        
        # Find all .md files (excluding node_modules, tests, docs)
        while IFS= read -r file; do
            local rel_path="${file#$REPO_ROOT/}"
            
            # Skip node_modules, tests, docs, templates
            if [[ "$rel_path" == *"/node_modules/"* ]] || \
               [[ "$rel_path" == *"/tests/"* ]] || \
               [[ "$rel_path" == *"/docs/"* ]] || \
               [[ "$rel_path" == *"/template"* ]] || \
               [[ "$rel_path" == *"README.md" ]] || \
               [[ "$rel_path" == *"index.md" ]]; then
                continue
            fi
            
            # Check if this path is in registry
            if ! echo "$registry_paths" | grep -q "^${rel_path}$"; then
                # Extract metadata
                local metadata=$(extract_metadata_from_file "$file")
                IFS='|' read -r id name description <<< "$metadata"
                
                # Detect component type
                local comp_type=$(detect_component_type "$rel_path")
                
                if [ "$comp_type" != "unknown" ]; then
                    NEW_COMPONENTS+=("${comp_type}|${id}|${name}|${description}|${rel_path}")
                    print_warning "New ${comp_type}: ${name} (${id})"
                    echo "  Path: ${rel_path}"
                    [ -n "$description" ] && echo "  Description: ${description}"
                    echo ""
                fi
            fi
        done < <(find "$category_dir" -type f -name "*.md" 2>/dev/null)
    done
}

add_component_to_registry() {
    local comp_type=$1
    local id=$2
    local name=$3
    local description=$4
    local path=$5
    
    # Default description if empty
    if [ -z "$description" ]; then
        description="Component: ${name}"
    fi
    
    # Escape quotes and special characters in description
    description=$(echo "$description" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
    
    # Get registry key (agents, subagents, commands, etc.)
    local registry_key=$(get_registry_key "$comp_type")
    
    # Use jq to properly construct JSON (avoids escaping issues)
    local temp_file="${REGISTRY_FILE}.tmp"
    jq --arg id "$id" \
       --arg name "$name" \
       --arg type "$comp_type" \
       --arg path "$path" \
       --arg desc "$description" \
       ".components.${registry_key} += [{
         \"id\": \$id,
         \"name\": \$name,
         \"type\": \$type,
         \"path\": \$path,
         \"description\": \$desc,
         \"tags\": [],
         \"dependencies\": [],
         \"category\": \"standard\"
       }]" "$REGISTRY_FILE" > "$temp_file"
    
    if [ $? -eq 0 ]; then
        mv "$temp_file" "$REGISTRY_FILE"
        print_success "Added ${comp_type}: ${name}"
    else
        print_error "Failed to add ${comp_type}: ${name}"
        rm -f "$temp_file"
        return 1
    fi
}

#############################################################################
# Main
#############################################################################

main() {
    # Parse arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            -a|--auto-add)
                AUTO_ADD=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                echo "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    print_header
    
    # Check dependencies
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        exit 1
    fi
    
    # Validate registry file
    if [ ! -f "$REGISTRY_FILE" ]; then
        print_error "Registry file not found: $REGISTRY_FILE"
        exit 1
    fi
    
    if ! jq empty "$REGISTRY_FILE" 2>/dev/null; then
        print_error "Registry file is not valid JSON"
        exit 1
    fi
    
    # Scan for new components
    scan_for_new_components
    
    # Summary
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Summary${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    if [ ${#NEW_COMPONENTS[@]} -eq 0 ]; then
        print_success "No new components found. Registry is up to date!"
        exit 0
    fi
    
    echo -e "Found ${YELLOW}${#NEW_COMPONENTS[@]}${NC} new component(s)"
    echo ""
    
    # Add components if auto-add is enabled
    if [ "$AUTO_ADD" = true ] && [ "$DRY_RUN" = false ]; then
        print_info "Adding new components to registry..."
        echo ""
        
        local added=0
        for entry in "${NEW_COMPONENTS[@]}"; do
            IFS='|' read -r comp_type id name description path <<< "$entry"
            if add_component_to_registry "$comp_type" "$id" "$name" "$description" "$path"; then
                added=$((added + 1))
            fi
        done
        
        # Update timestamp
        jq '.metadata.lastUpdated = (now | strftime("%Y-%m-%d"))' "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp"
        mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
        
        echo ""
        print_success "Added ${added} component(s) to registry"
        
    elif [ "$DRY_RUN" = true ]; then
        print_info "Dry run mode - no changes made to registry"
        echo ""
        echo "Run without --dry-run to add these components"
        
    else
        print_info "Run with --auto-add to add these components to registry"
        echo ""
        echo "Or manually add them to registry.json"
    fi
    
    exit 0
}

main "$@"
