#!/usr/bin/env bash

#############################################################################
# Auto-Detect Components Script v2.0.0
# Scans .opencode directory for new components not in registry
# Validates existing entries, fixes typos, removes deleted components
# Performs security checks on component files
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
REGISTRY_FILE="registry.json"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTO_ADD=false
DRY_RUN=false
VALIDATE_EXISTING=true
SECURITY_CHECK=true

# Arrays to store components
declare -a NEW_COMPONENTS
declare -a FIXED_COMPONENTS
declare -a REMOVED_COMPONENTS
declare -a SECURITY_ISSUES

# Counters
TOTAL_FIXED=0
TOTAL_REMOVED=0
TOTAL_SECURITY_ISSUES=0

#############################################################################
# Utility Functions
#############################################################################

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           Auto-Detect Components v2.0.0                       ║"
    echo "║           Enhanced with Security & Validation                 ║"
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

print_security() {
    echo -e "${MAGENTA}🔒${NC} $1"
}

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --auto-add          Automatically add new components to registry"
    echo "  -d, --dry-run           Show what would be changed without modifying registry"
    echo "  -s, --skip-validation   Skip validation of existing registry entries"
    echo "  -n, --no-security       Skip security checks on component files"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Features:"
    echo "  • Detects new components in .opencode directory"
    echo "  • Validates existing registry entries"
    echo "  • Auto-fixes typos and wrong paths"
    echo "  • Removes entries for deleted components"
    echo "  • Performs security checks (permissions, secrets, path validation)"
    echo ""
    exit 0
}

#############################################################################
# Security Functions
#############################################################################

check_file_security() {
    local file=$1
    local issues=()
    
    # For markdown files, be less strict (they contain examples and documentation)
    if [[ "$file" == *.md ]]; then
        # Only check for executable permissions on markdown
        if [ -x "$file" ]; then
            issues+=("Markdown file should not be executable")
        fi
        
        # Check for actual secrets (not examples) - very specific patterns
        # Look for real API keys like sk-proj-xxxxx or ghp_xxxxx
        if grep -qE '(sk-proj-[a-zA-Z0-9]{40,}|ghp_[a-zA-Z0-9]{36,}|xox[baprs]-[a-zA-Z0-9-]{10,})' "$file" 2>/dev/null; then
            issues+=("Potential real API key detected")
        fi
    else
        # For non-markdown files, be more strict
        # Check file permissions (should not be world-writable)
        if [ -w "$file" ] && [ "$(stat -f '%A' "$file" 2>/dev/null || stat -c '%a' "$file" 2>/dev/null)" -gt 664 ]; then
            issues+=("File has overly permissive permissions")
        fi
        
        # Check for potential secrets
        if grep -qiE '(password|secret|api[_-]?key|token|credential|private[_-]?key).*[:=].*[a-zA-Z0-9]{20,}' "$file" 2>/dev/null; then
            issues+=("Potential hardcoded secrets detected")
        fi
    fi
    
    # Return issues
    if [ ${#issues[@]} -gt 0 ]; then
        printf '%s\n' "${issues[@]}"
        return 1
    fi
    return 0
}

run_security_checks() {
    if [ "$SECURITY_CHECK" = false ]; then
        return 0
    fi
    
    print_info "Running security checks..."
    echo ""
    
    local categories=("agent" "command" "tool" "plugin" "context")
    
    for category in "${categories[@]}"; do
        local category_dir="$REPO_ROOT/.opencode/$category"
        
        if [ ! -d "$category_dir" ]; then
            continue
        fi
        
        while IFS= read -r file; do
            local rel_path="${file#$REPO_ROOT/}"
            
            # Skip excluded directories
            if [[ "$rel_path" == *"/node_modules/"* ]] || \
               [[ "$rel_path" == *"/tests/"* ]] || \
               [[ "$rel_path" == *"/docs/"* ]]; then
                continue
            fi
            
            # Check security
            local security_output
            if ! security_output=$(check_file_security "$file"); then
                TOTAL_SECURITY_ISSUES=$((TOTAL_SECURITY_ISSUES + 1))
                SECURITY_ISSUES+=("${rel_path}|${security_output}")
                print_security "Security issue in: ${rel_path}"
                while IFS= read -r issue; do
                    echo "  - ${issue}"
                done <<< "$security_output"
                echo ""
            fi
        done < <(find "$category_dir" -type f -name "*.md" 2>/dev/null)
    done
    
    if [ $TOTAL_SECURITY_ISSUES -eq 0 ]; then
        print_success "No security issues found"
        echo ""
    fi
}

#############################################################################
# Path Validation and Fixing
#############################################################################

find_similar_path() {
    local wrong_path=$1
    local threshold=3  # Maximum edit distance
    
    # Get directory and filename
    local dir=$(dirname "$wrong_path")
    local filename=$(basename "$wrong_path")
    
    # Search for similar files in the expected directory and nearby
    local search_dirs=("$REPO_ROOT/$dir" "$REPO_ROOT/.opencode")
    
    for search_dir in "${search_dirs[@]}"; do
        if [ ! -d "$search_dir" ]; then
            continue
        fi
        
        # Find files with similar names
        while IFS= read -r candidate; do
            local candidate_rel="${candidate#$REPO_ROOT/}"
            local candidate_name=$(basename "$candidate")
            
            # Simple similarity check (could be enhanced with Levenshtein distance)
            if [[ "$candidate_name" == *"$filename"* ]] || [[ "$filename" == *"$candidate_name"* ]]; then
                echo "$candidate_rel"
                return 0
            fi
        done < <(find "$search_dir" -type f -name "*.md" 2>/dev/null)
    done
    
    return 1
}

validate_existing_entries() {
    if [ "$VALIDATE_EXISTING" = false ]; then
        return 0
    fi
    
    print_info "Validating existing registry entries..."
    echo ""
    
    # Get all component types from registry
    local component_types=$(jq -r '.components | keys[]' "$REGISTRY_FILE" 2>/dev/null)
    
    while IFS= read -r comp_type; do
        # Get all components of this type
        local count=$(jq -r ".components.${comp_type} | length" "$REGISTRY_FILE" 2>/dev/null)
        
        for ((i=0; i<count; i++)); do
            local id=$(jq -r ".components.${comp_type}[$i].id" "$REGISTRY_FILE" 2>/dev/null)
            local name=$(jq -r ".components.${comp_type}[$i].name" "$REGISTRY_FILE" 2>/dev/null)
            local path=$(jq -r ".components.${comp_type}[$i].path" "$REGISTRY_FILE" 2>/dev/null)
            
            # Skip if path is null or empty
            if [ -z "$path" ] || [ "$path" = "null" ]; then
                continue
            fi
            
            local full_path="$REPO_ROOT/$path"
            
            # Check if file exists
            if [ ! -f "$full_path" ]; then
                print_warning "Component file not found: ${name} (${path})"
                
                # Try to find similar path
                local similar_path
                if similar_path=$(find_similar_path "$path"); then
                    print_info "Found similar path: ${similar_path}"
                    
                    if [ "$AUTO_ADD" = true ] && [ "$DRY_RUN" = false ]; then
                        fix_component_path "$comp_type" "$i" "$id" "$name" "$path" "$similar_path"
                    else
                        FIXED_COMPONENTS+=("${comp_type}|${i}|${id}|${name}|${path}|${similar_path}")
                        echo "  Would fix: ${path} → ${similar_path}"
                    fi
                else
                    # No similar path found, mark for removal
                    if [ "$AUTO_ADD" = true ] && [ "$DRY_RUN" = false ]; then
                        remove_component_from_registry "$comp_type" "$id" "$name" "$path"
                    else
                        REMOVED_COMPONENTS+=("${comp_type}|${id}|${name}|${path}")
                        echo "  Would remove: ${name} (deleted)"
                    fi
                fi
                echo ""
            fi
        done
    done <<< "$component_types"
}

fix_component_path() {
    local comp_type=$1
    local index=$2
    local id=$3
    local name=$4
    local old_path=$5
    local new_path=$6
    
    local temp_file="${REGISTRY_FILE}.tmp"
    
    jq --arg type "$comp_type" \
       --argjson idx "$index" \
       --arg newpath "$new_path" \
       ".components[\$type][\$idx].path = \$newpath" \
       "$REGISTRY_FILE" > "$temp_file"
    
    if [ $? -eq 0 ]; then
        mv "$temp_file" "$REGISTRY_FILE"
        print_success "Fixed path for ${name}: ${old_path} → ${new_path}"
        TOTAL_FIXED=$((TOTAL_FIXED + 1))
    else
        print_error "Failed to fix path for ${name}"
        rm -f "$temp_file"
        return 1
    fi
}

remove_component_from_registry() {
    local comp_type=$1
    local id=$2
    local name=$3
    local path=$4
    
    local temp_file="${REGISTRY_FILE}.tmp"
    
    jq --arg type "$comp_type" \
       --arg id "$id" \
       ".components[\$type] = [.components[\$type][] | select(.id != \$id)]" \
       "$REGISTRY_FILE" > "$temp_file"
    
    if [ $? -eq 0 ]; then
        mv "$temp_file" "$REGISTRY_FILE"
        print_success "Removed deleted component: ${name}"
        TOTAL_REMOVED=$((TOTAL_REMOVED + 1))
    else
        print_error "Failed to remove component: ${name}"
        rm -f "$temp_file"
        return 1
    fi
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
            -s|--skip-validation)
                VALIDATE_EXISTING=false
                shift
                ;;
            -n|--no-security)
                SECURITY_CHECK=false
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
    
    # Run security checks
    run_security_checks
    
    # Validate existing entries (fixes and removals)
    validate_existing_entries
    
    # Scan for new components
    scan_for_new_components
    
    # Summary
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Summary${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Display counts
    echo -e "Security Issues:    ${MAGENTA}${TOTAL_SECURITY_ISSUES}${NC}"
    echo -e "Fixed Paths:        ${GREEN}${TOTAL_FIXED}${NC}"
    echo -e "Removed Components: ${RED}${TOTAL_REMOVED}${NC}"
    echo -e "New Components:     ${YELLOW}${#NEW_COMPONENTS[@]}${NC}"
    echo ""
    
    # Show pending fixes if in dry-run mode
    if [ ${#FIXED_COMPONENTS[@]} -gt 0 ] && [ "$DRY_RUN" = true ]; then
        echo -e "${BOLD}Pending Path Fixes:${NC}"
        for entry in "${FIXED_COMPONENTS[@]}"; do
            IFS='|' read -r comp_type index id name old_path new_path <<< "$entry"
            echo "  • ${name}: ${old_path} → ${new_path}"
        done
        echo ""
    fi
    
    # Show pending removals if in dry-run mode
    if [ ${#REMOVED_COMPONENTS[@]} -gt 0 ] && [ "$DRY_RUN" = true ]; then
        echo -e "${BOLD}Pending Removals:${NC}"
        for entry in "${REMOVED_COMPONENTS[@]}"; do
            IFS='|' read -r comp_type id name path <<< "$entry"
            echo "  • ${name} (${path})"
        done
        echo ""
    fi
    
    # Check if everything is up to date
    if [ ${#NEW_COMPONENTS[@]} -eq 0 ] && \
       [ ${#FIXED_COMPONENTS[@]} -eq 0 ] && \
       [ ${#REMOVED_COMPONENTS[@]} -eq 0 ] && \
       [ $TOTAL_FIXED -eq 0 ] && \
       [ $TOTAL_REMOVED -eq 0 ]; then
        print_success "Registry is up to date!"
        
        if [ $TOTAL_SECURITY_ISSUES -gt 0 ]; then
            echo ""
            print_warning "Please review and fix the ${TOTAL_SECURITY_ISSUES} security issue(s) found"
        fi
        
        exit 0
    fi
    
    # Add components if auto-add is enabled
    if [ "$AUTO_ADD" = true ] && [ "$DRY_RUN" = false ]; then
        if [ ${#NEW_COMPONENTS[@]} -gt 0 ]; then
            print_info "Adding new components to registry..."
            echo ""
            
            local added=0
            for entry in "${NEW_COMPONENTS[@]}"; do
                IFS='|' read -r comp_type id name description path <<< "$entry"
                if add_component_to_registry "$comp_type" "$id" "$name" "$description" "$path"; then
                    added=$((added + 1))
                fi
            done
            
            echo ""
            print_success "Added ${added} component(s) to registry"
        fi
        
        # Update timestamp
        jq '.metadata.lastUpdated = (now | strftime("%Y-%m-%d"))' "$REGISTRY_FILE" > "${REGISTRY_FILE}.tmp"
        mv "${REGISTRY_FILE}.tmp" "$REGISTRY_FILE"
        
    elif [ "$DRY_RUN" = true ]; then
        print_info "Dry run mode - no changes made to registry"
        echo ""
        echo "Run without --dry-run to apply these changes"
        
    else
        print_info "Run with --auto-add to apply these changes to registry"
        echo ""
        echo "Or manually update registry.json"
    fi
    
    # Final security warning
    if [ $TOTAL_SECURITY_ISSUES -gt 0 ]; then
        echo ""
        print_warning "⚠️  ${TOTAL_SECURITY_ISSUES} security issue(s) require attention"
    fi
    
    exit 0
}

main "$@"
