#!/usr/bin/env bash

#############################################################################
# Registry Validator Script
# Validates that all paths in registry.json point to actual files
# Exit codes:
#   0 = All paths valid
#   1 = Missing files found
#   2 = Registry parse error or missing dependencies
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
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERBOSE=false
FIX_MODE=false

# Counters
TOTAL_PATHS=0
VALID_PATHS=0
MISSING_PATHS=0
ORPHANED_FILES=0
MISSING_DEPENDENCIES=0

# Arrays to store results
declare -a MISSING_FILES
declare -a ORPHANED_COMPONENTS
declare -a MISSING_DEPS

#############################################################################
# Utility Functions
#############################################################################

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           Registry Validator v1.0.0                           ║"
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
    echo "  -v, --verbose       Show detailed validation output"
    echo "  -f, --fix           Suggest fixes for missing files"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Exit codes:"
    echo "  0 = All paths valid"
    echo "  1 = Missing files found"
    echo "  2 = Registry parse error or missing dependencies"
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
        echo "  Fedora:  sudo dnf install ${missing_deps[*]}"
        exit 2
    fi
}

#############################################################################
# Registry Validation
#############################################################################

validate_registry_file() {
    if [ ! -f "$REGISTRY_FILE" ]; then
        print_error "Registry file not found: $REGISTRY_FILE"
        exit 2
    fi
    
    if ! jq empty "$REGISTRY_FILE" 2>/dev/null; then
        print_error "Registry file is not valid JSON"
        exit 2
    fi
    
    print_success "Registry file is valid JSON"
}

validate_component_paths() {
    local category=$1
    local category_display=$2
    
    [ "$VERBOSE" = true ] && echo -e "\n${BOLD}Checking ${category_display}...${NC}"
    
    # Get all components in this category
    local components
    components=$(jq -r ".components.${category}[]? | @json" "$REGISTRY_FILE" 2>/dev/null)
    
    if [ -z "$components" ]; then
        [ "$VERBOSE" = true ] && print_info "No ${category_display} found in registry"
        return
    fi
    
    while IFS= read -r component; do
        local id
        id=$(echo "$component" | jq -r '.id')
        local path
        path=$(echo "$component" | jq -r '.path')
        local name
        name=$(echo "$component" | jq -r '.name')
        
        TOTAL_PATHS=$((TOTAL_PATHS + 1))
        
        # Check if file exists
        if [ -f "$REPO_ROOT/$path" ]; then
            VALID_PATHS=$((VALID_PATHS + 1))
            [ "$VERBOSE" = true ] && print_success "${category_display}: ${name} (${id})"
        else
            MISSING_PATHS=$((MISSING_PATHS + 1))
            MISSING_FILES+=("${category}:${id}|${name}|${path}")
            print_error "${category_display}: ${name} (${id}) - File not found: ${path}"
            
            # Try to find similar files if in fix mode
            if [ "$FIX_MODE" = true ]; then
                suggest_fix "$path" "$id"
            fi
        fi
    done <<< "$components"
}

suggest_fix() {
    local missing_path=$1
    local component_id=$2
    
    # Extract directory and filename
    local dir
    dir=$(dirname "$missing_path")
    # local filename=$(basename "$missing_path") # Unused
    local base_dir
    base_dir=$(echo "$dir" | cut -d'/' -f1-3)  # e.g., .opencode/command
    
    # Look for similar files in the expected directory and subdirectories
    local similar_files
    similar_files=$(find "$REPO_ROOT/$base_dir" -type f -name "*.md" 2>/dev/null | grep -i "$component_id" || true)
    
    if [ -n "$similar_files" ]; then
        echo -e "  ${YELLOW}→ Possible matches:${NC}"
        while IFS= read -r file; do
            local rel_path="${file#$REPO_ROOT/}"
            echo -e "    ${CYAN}${rel_path}${NC}"
        done <<< "$similar_files"
    fi
}

scan_for_orphaned_files() {
    [ "$VERBOSE" = true ] && echo -e "\n${BOLD}Scanning for orphaned files...${NC}"
    
    # Get all paths from registry
    local registry_paths
    registry_paths=$(jq -r '.components | to_entries[] | .value[] | .path' "$REGISTRY_FILE" 2>/dev/null | sort -u)
    
    # Scan .opencode directory for markdown files
    local categories=("agent" "command" "tool" "plugin" "context")
    
    for category in "${categories[@]}"; do
        local category_dir="$REPO_ROOT/.opencode/$category"
        
        if [ ! -d "$category_dir" ]; then
            continue
        fi
        
        # Find all .md and .ts files (excluding node_modules)
        while IFS= read -r file; do
            local rel_path="${file#$REPO_ROOT/}"
            
            # Skip node_modules
            if [[ "$rel_path" == *"/node_modules/"* ]]; then
                continue
            fi
            
            # Skip README files
            if [[ "$rel_path" == *"README.md" ]]; then
                continue
            fi
            
            # Skip template files
            if [[ "$rel_path" == *"-template.md" ]]; then
                continue
            fi
            
            # Skip tool/plugin TypeScript files
            if [[ "$rel_path" == *"/tool/index.ts" ]] || [[ "$rel_path" == *"/tool/template/index.ts" ]]; then
                continue
            fi
            if [[ "$rel_path" == *"/plugin/agent-validator.ts" ]]; then
                continue
            fi
            
            # Skip plugin internal docs and tests
            if [[ "$rel_path" == *"/plugin/docs/"* ]] || [[ "$rel_path" == *"/plugin/tests/"* ]]; then
                continue
            fi
            
            # Skip scripts directories (internal CLI tools, not registry components)
            if [[ "$rel_path" == *"/scripts/"* ]]; then
                continue
            fi
            
            # Check if this path is in registry
            if ! echo "$registry_paths" | grep -q "^${rel_path}$"; then
                ORPHANED_FILES=$((ORPHANED_FILES + 1))
                ORPHANED_COMPONENTS+=("$rel_path")
                [ "$VERBOSE" = true ] && print_warning "Orphaned file (not in registry): ${rel_path}"
            fi
        done < <(find "$category_dir" -type f \( -name "*.md" -o -name "*.ts" \) 2>/dev/null)
    done
}

#############################################################################
# Dependency Validation
#############################################################################

check_dependency_exists() {
    local dep=$1
    
    # Parse dependency format: type:id
    if [[ ! "$dep" =~ ^([^:]+):(.+)$ ]]; then
        echo "invalid_format"
        return 1
    fi
    
    local dep_type="${BASH_REMATCH[1]}"
    local dep_id="${BASH_REMATCH[2]}"
    
    # Map dependency type to registry category
    local registry_category=""
    case "$dep_type" in
        agent)
            registry_category="agents"
            ;;
        subagent)
            registry_category="subagents"
            ;;
        command)
            registry_category="commands"
            ;;
        tool)
            registry_category="tools"
            ;;
        plugin)
            registry_category="plugins"
            ;;
        context)
            registry_category="contexts"
            ;;
        config)
            registry_category="config"
            ;;
        *)
            echo "unknown_type"
            return 1
            ;;
    esac
    
    # Check if component exists in registry
    # First try exact ID match
    local exists
    exists=$(jq -r ".components.${registry_category}[]? | select(.id == \"${dep_id}\") | .id" "$REGISTRY_FILE" 2>/dev/null)
    
    if [ -n "$exists" ]; then
        echo "found"
        return 0
    fi
    
    # For context dependencies, also try path-based lookup
    # Format: context:core/standards/code -> .opencode/context/core/standards/code.md
    if [ "$dep_type" = "context" ]; then
        # Check for wildcard pattern (e.g., context:core/context-system/*)
        if [[ "$dep_id" == *"*" ]]; then
            # Extract prefix before wildcard
            local prefix="${dep_id%%\**}"
            # Check if any context files match the prefix
            local matches
            matches=$(jq -r ".components.${registry_category}[]? | select(.path | startswith(\".opencode/context/${prefix}\")) | .id" "$REGISTRY_FILE" 2>/dev/null | head -1)
            
            if [ -n "$matches" ]; then
                echo "found"
                return 0
            fi
        else
            # Try exact path match
            local context_path=".opencode/context/${dep_id}.md"
            local exists_by_path
            exists_by_path=$(jq -r ".components.${registry_category}[]? | select(.path == \"${context_path}\") | .id" "$REGISTRY_FILE" 2>/dev/null)
            
            if [ -n "$exists_by_path" ]; then
                echo "found"
                return 0
            fi
        fi
    fi
    
    echo "not_found"
    return 1
}

validate_component_dependencies() {
    echo ""
    print_info "Validating component dependencies..."
    echo ""
    
    # Get all component types
    local component_types
    component_types=$(jq -r '.components | keys[]' "$REGISTRY_FILE" 2>/dev/null)
    
    while IFS= read -r comp_type; do
        # Get all components of this type
        local components
        components=$(jq -r ".components.${comp_type}[]? | @json" "$REGISTRY_FILE" 2>/dev/null)
        
        if [ -z "$components" ]; then
            continue
        fi
        
        while IFS= read -r component; do
            local id
            id=$(echo "$component" | jq -r '.id')
            local name
            name=$(echo "$component" | jq -r '.name')
            local dependencies
            dependencies=$(echo "$component" | jq -r '.dependencies[]?' 2>/dev/null)
            
            if [ -z "$dependencies" ]; then
                continue
            fi
            
            # Check each dependency
            while IFS= read -r dep; do
                if [ -z "$dep" ]; then
                    continue
                fi
                
                local result
                result=$(check_dependency_exists "$dep")
                
                case "$result" in
                    found)
                        [ "$VERBOSE" = true ] && print_success "Dependency OK: ${name} → ${dep}"
                        ;;
                    not_found)
                        MISSING_DEPENDENCIES=$((MISSING_DEPENDENCIES + 1))
                        MISSING_DEPS+=("${comp_type}|${id}|${name}|${dep}")
                        print_error "Missing dependency: ${name} (${comp_type%s}) depends on \"${dep}\" (not found in registry)"
                        ;;
                    invalid_format)
                        MISSING_DEPENDENCIES=$((MISSING_DEPENDENCIES + 1))
                        MISSING_DEPS+=("${comp_type}|${id}|${name}|${dep}")
                        print_error "Invalid dependency format: ${name} (${comp_type%s}) has invalid dependency \"${dep}\" (expected format: type:id)"
                        ;;
                    unknown_type)
                        MISSING_DEPENDENCIES=$((MISSING_DEPENDENCIES + 1))
                        MISSING_DEPS+=("${comp_type}|${id}|${name}|${dep}")
                        print_error "Unknown dependency type: ${name} (${comp_type%s}) has unknown dependency type in \"${dep}\""
                        ;;
                esac
            done <<< "$dependencies"
        done <<< "$components"
    done <<< "$component_types"
}

#############################################################################
# Reporting
#############################################################################

print_summary() {
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Validation Summary${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Total paths checked:    ${CYAN}${TOTAL_PATHS}${NC}"
    echo -e "Valid paths:            ${GREEN}${VALID_PATHS}${NC}"
    echo -e "Missing paths:          ${RED}${MISSING_PATHS}${NC}"
    echo -e "Missing dependencies:   ${RED}${MISSING_DEPENDENCIES}${NC}"
    
    if [ "$VERBOSE" = true ]; then
        echo -e "Orphaned files:         ${YELLOW}${ORPHANED_FILES}${NC}"
    fi
    
    echo ""
    
    local has_errors=false
    
    # Check for missing paths
    if [ $MISSING_PATHS -gt 0 ]; then
        has_errors=true
        print_error "Found ${MISSING_PATHS} missing file(s)"
        echo ""
        echo "Missing files:"
        for entry in "${MISSING_FILES[@]}"; do
            IFS='|' read -r cat_id name path <<< "$entry"
            echo "  - ${path} (${cat_id})"
        done
        echo ""
        
        if [ "$FIX_MODE" = false ]; then
            print_info "Run with --fix flag to see suggested fixes"
            echo ""
        fi
    fi
    
    # Check for missing dependencies
    if [ $MISSING_DEPENDENCIES -gt 0 ]; then
        has_errors=true
        print_error "Found ${MISSING_DEPENDENCIES} missing or invalid dependencies"
        echo ""
        echo "Missing dependencies:"
        for entry in "${MISSING_DEPS[@]}"; do
            IFS='|' read -r comp_type id name dep <<< "$entry"
            echo "  - ${name} (${comp_type%s}) → ${dep}"
        done
        echo ""
        print_info "Fix by either:"
        echo "  1. Adding the missing component to the registry"
        echo "  2. Removing the dependency from the component's frontmatter"
        echo ""
    fi
    
    # Success case
    if [ "$has_errors" = false ]; then
        print_success "All registry paths are valid!"
        print_success "All component dependencies are valid!"
        
        if [ $ORPHANED_FILES -gt 0 ] && [ "$VERBOSE" = true ]; then
            echo ""
            print_warning "Found ${ORPHANED_FILES} orphaned file(s) not in registry"
            echo ""
            echo "Orphaned files:"
            for file in "${ORPHANED_COMPONENTS[@]}"; do
                echo "  - $file"
            done
            echo ""
            echo "Consider adding these to registry.json or removing them."
        fi
        
        return 0
    else
        echo "Please fix these issues before proceeding."
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
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -f|--fix)
                FIX_MODE=true
                VERBOSE=true
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
    check_dependencies
    
    # Validate registry file
    validate_registry_file
    
    echo ""
    print_info "Validating component paths..."
    echo ""
    
    # Validate each category
    validate_component_paths "agents" "Agents"
    validate_component_paths "subagents" "Subagents"
    validate_component_paths "commands" "Commands"
    validate_component_paths "tools" "Tools"
    validate_component_paths "plugins" "Plugins"
    validate_component_paths "contexts" "Contexts"
    validate_component_paths "config" "Config"
    
    # Validate component dependencies
    validate_component_dependencies
    
    # Scan for orphaned files if verbose
    if [ "$VERBOSE" = true ]; then
        scan_for_orphaned_files
    fi
    
    # Print summary and exit with appropriate code
    if print_summary; then
        exit 0
    else
        exit 1
    fi
}

main "$@"
