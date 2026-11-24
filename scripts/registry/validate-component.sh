#!/usr/bin/env bash

#############################################################################
# Component Validation Script
# Validates component structure and metadata for PRs
#############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

validate_markdown_frontmatter() {
    local file=$1
    
    print_info "Validating $file"
    
    # Check if file has frontmatter
    if ! head -n 1 "$file" | grep -q "^---$"; then
        print_warning "Missing frontmatter in $file"
        return
    fi
    
    # Extract frontmatter
    local frontmatter
    frontmatter=$(awk '/^---$/{if(++n==2)exit;next}n==1' "$file")
    
    # Check for description
    if ! echo "$frontmatter" | grep -q "^description:"; then
        print_warning "Missing 'description' in frontmatter of $file"
    else
        print_success "Has description"
    fi
    
    # For agents, check for mode
    if [[ "$file" == *"/agent/"* ]] && [[ "$file" != *"/subagents/"* ]]; then
        if ! echo "$frontmatter" | grep -q "^mode:"; then
            print_warning "Missing 'mode' in agent frontmatter of $file"
        fi
    fi
}

validate_typescript_file() {
    local file=$1
    
    print_info "Validating $file"
    
    # Check for basic TypeScript syntax (very basic check)
    if ! grep -q "export" "$file"; then
        print_warning "No exports found in $file"
    else
        print_success "Has exports"
    fi
    
    # Check for comments/documentation
    if ! grep -q "^\s*\*" "$file"; then
        print_warning "No JSDoc comments found in $file"
    else
        print_success "Has documentation"
    fi
}

validate_directory_structure() {
    print_info "Validating directory structure"
    
    local required_dirs=(
        ".opencode"
        ".opencode/agent"
        ".opencode/command"
        ".opencode/tool"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            print_error "Missing required directory: $dir"
        else
            print_success "Directory exists: $dir"
        fi
    done
    
    # Check for category subdirectories (optional but recommended)
    local category_dirs=(
        ".opencode/agent/core"
        ".opencode/agent/development"
        ".opencode/agent/content"
        ".opencode/agent/data"
        ".opencode/agent/learning"
        ".opencode/agent/product"
    )
    
    local found_categories=0
    for dir in "${category_dirs[@]}"; do
        if [ -d "$dir" ]; then
            found_categories=$((found_categories + 1))
        fi
    done
    
    if [ $found_categories -gt 0 ]; then
        print_success "Found $found_categories category subdirectories"
    else
        print_warning "No category subdirectories found (optional)"
    fi
}

validate_registry() {
    print_info "Validating built-ai-configs/registry/registry.json"
    
    if [ ! -f "built-ai-configs/registry/registry.json" ]; then
        print_error "built-ai-configs/registry/registry.json not found"
        return
    fi
    
    # Check if valid JSON
    if ! jq empty built-ai-configs/registry/registry.json 2>/dev/null; then
        print_error "built-ai-configs/registry/registry.json is not valid JSON"
        return
    fi
    
    print_success "built-ai-configs/registry/registry.json is valid JSON"
    
    # Check required fields
    local required_fields=("version" "repository" "components" "profiles" "metadata")
    
    for field in "${required_fields[@]}"; do
        if ! jq -e ".$field" built-ai-configs/registry/registry.json > /dev/null 2>&1; then
            print_error "Missing required field in built-ai-configs/registry/registry.json: $field"
        else
            print_success "Has field: $field"
        fi
    done
}

main() {
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           Component Validation                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    
    # Validate directory structure
    validate_directory_structure
    echo ""
    
    # Validate registry
    validate_registry
    echo ""
    
    # Validate all markdown files (excluding symlinks)
    echo "Validating markdown files..."
    while IFS= read -r -d '' file; do
        # Skip symlinks
        if [ -L "$file" ]; then
            continue
        fi
        validate_markdown_frontmatter "$file"
    done < <(find .opencode -name "*.md" -type f -print0 2>/dev/null)
    echo ""
    
    # Validate TypeScript files
    echo "Validating TypeScript files..."
    while IFS= read -r -d '' file; do
        validate_typescript_file "$file"
    done < <(find .opencode -name "*.ts" -type f -not -path "*/node_modules/*" -print0 2>/dev/null)
    echo ""
    
    # Summary
    echo "════════════════════════════════════════════════════════════════"
    echo "Validation Summary:"
    echo "  Errors:   $ERRORS"
    echo "  Warnings: $WARNINGS"
    echo "════════════════════════════════════════════════════════════════"
    
    if [ $ERRORS -gt 0 ]; then
        echo ""
        print_error "Validation failed with $ERRORS error(s)"
        exit 1
    elif [ $WARNINGS -gt 0 ]; then
        echo ""
        print_warning "Validation passed with $WARNINGS warning(s)"
        exit 0
    else
        echo ""
        print_success "All validations passed!"
        exit 0
    fi
}

main "$@"
