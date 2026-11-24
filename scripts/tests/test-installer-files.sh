#!/usr/bin/env bash
###############################################################################
# Installer Test Script
# Simulates the installer and shows which files would fail to download
# Usage: ./scripts/tests/test-installer-files.sh [--profile=<profile>] [--verbose]
###############################################################################

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
BRANCH="main"
RAW_URL="https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/${BRANCH}"
TEMP_DIR="/tmp/opencode-installer-test-$$"

# Allow local testing (useful for CI/CD or when testing changes before pushing)
USE_LOCAL=false
LOCAL_REGISTRY="./built-ai-configs/registry/registry.json"

# Global variables
VERBOSE=false
TEST_PROFILE=""
FAILED_FILES=()
SKIPPED_FILES=()
SUCCESS_COUNT=0
FAIL_COUNT=0

# Cleanup function
# shellcheck disable=SC2329
cleanup() {
    rm -rf "$TEMP_DIR" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Print functions
print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           Installer File Test - v1.0.0                        ║"
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

print_step() {
    echo -e "\n${BOLD}$1${NC}"
}

# Check if URL is accessible
check_url() {
    local url="$1"
    local component="$2"
    
    if curl -fsSL --max-time 10 -I "$url" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Test a single file
test_file() {
    local path="$1"
    local component="$2"
    local url="${RAW_URL}/${path}"
    
    if check_url "$url" "$component"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        if [ "$VERBOSE" = true ]; then
            print_success "Accessible: ${path}"
        fi
        return 0
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        FAILED_FILES+=("${component}|${path}")
        print_error "NOT FOUND: ${path}"
        return 1
    fi
}

# Test components from a category
test_category() {
    local category="$1"
    local registry_file="$2"
    
    print_step "Testing ${category}..."
    
    local components
    components=$(jq -r ".components.${category}[]? | \"\(.id)|\(.path)\"" "$registry_file" 2>/dev/null || echo "")
    
    if [ -z "$components" ]; then
        print_warning "No components in category: ${category}"
        return
    fi
    
    while IFS='|' read -r id path; do
        [ -z "$id" ] && continue
        test_file "$path" "${category}:${id}"
    done <<< "$components"
}

# Test profile components
test_profile() {
    local profile="$1"
    local registry_file="$2"
    
    print_step "Testing Profile: ${profile}"
    
    # Get components from profile
    local components
    components=$(jq -r ".profiles.${profile}.components[]?" "$registry_file" 2>/dev/null || echo "")
    
    if [ -z "$components" ]; then
        print_error "Profile not found or empty: ${profile}"
        return 1
    fi
    
    print_info "Profile components:"
    
    while IFS= read -r component; do
        [ -z "$component" ] && continue
        
        local type="${component%%:*}"
        local id="${component##*:}"
        
        # Handle wildcards
        if [[ "$id" == *"*"* ]]; then
            print_info "  Wildcard: ${component} (expanding...)"
            
            if [ "$type" = "context" ]; then
                local prefix="${id%%\**}"
                prefix="${prefix%/}"
                
                # Find matching contexts
                local matches
                matches=$(jq -r ".components.contexts[]? | select(.path | startswith(\".opencode/context/${prefix}\")) | \"\(.id)|\(.path)\"" "$registry_file")
                
                while IFS='|' read -r match_id match_path; do
                    [ -z "$match_id" ] && continue
                    test_file "$match_path" "context:${match_id}"
                done <<< "$matches"
            fi
            continue
        fi
        
        # Get path for component
        local path
        path=$(jq -r ".components.${type}s[]? | select(.id == \"${id}\") | .path" "$registry_file")
        
        if [ -n "$path" ] && [ "$path" != "null" ]; then
            test_file "$path" "${component}"
        else
            print_warning "  Component not found in registry: ${component}"
            SKIPPED_FILES+=("${component}|not_in_registry")
        fi
    done <<< "$components"
}

# Test all categories
test_all() {
    local registry_file="$1"
    
    print_step "Testing All Component Categories"
    
    local categories=("agents" "subagents" "commands" "tools" "plugins" "skills" "contexts" "config")
    
    for category in "${categories[@]}"; do
        test_category "$category" "$registry_file"
    done
}

# Print summary
print_summary() {
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Test Summary${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Total files tested:  ${CYAN}$((SUCCESS_COUNT + FAIL_COUNT))${NC}"
    echo -e "Files accessible:    ${GREEN}${SUCCESS_COUNT}${NC}"
    echo -e "Files NOT FOUND:     ${RED}${FAIL_COUNT}${NC}"
    
    if [ ${#SKIPPED_FILES[@]} -gt 0 ]; then
        echo -e "Skipped:             ${YELLOW}${#SKIPPED_FILES[@]}${NC}"
    fi
    
    echo ""
    
    if [ $FAIL_COUNT -gt 0 ]; then
        print_error "Found ${FAIL_COUNT} file(s) that would FAIL during installation:"
        echo ""
        echo "Failed files:"
        for entry in "${FAILED_FILES[@]}"; do
            local component="${entry%%|*}"
            local path="${entry##*|}"
            echo "  - ${component}"
            echo "    URL: ${RAW_URL}/${path}"
        done
        echo ""
        echo -e "${YELLOW}These files need to be:${NC}"
        echo "  1. Added to the repository, OR"
        echo "  2. Removed from built-ai-configs/registry/registry.json"
        echo ""
        return 1
    else
        print_success "All files are accessible and would install successfully!"
        return 0
    fi
}

# Usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --profile=<name>    Test a specific profile (essential, developer, business, full, advanced)"
    echo "  --all               Test all components (default)"
    echo "  --verbose           Show successful file checks"
    echo "  --local             Use local built-ai-configs/registry/registry.json instead of downloading from GitHub"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Test all components (remote registry)"
    echo "  $0 --profile=essential               # Test essential profile"
    echo "  $0 --profile=developer --verbose     # Test developer profile with details"
    echo "  $0 --local                           # Test using local built-ai-configs/registry/registry.json"
    echo ""
    exit 0
}

# Main
main() {
    print_header
    
    # Parse arguments
    TEST_MODE="all"
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --profile=*)
                TEST_PROFILE="${1#*=}"
                TEST_MODE="profile"
                ;;
            --profile)
                if [ -n "$2" ]; then
                    TEST_PROFILE="$2"
                    TEST_MODE="profile"
                    shift
                else
                    echo "Error: --profile requires a profile name"
                    exit 1
                fi
                ;;
            --all)
                TEST_MODE="all"
                ;;
            --verbose)
                VERBOSE=true
                ;;
            --local)
                USE_LOCAL=true
                ;;
            --help|-h)
                usage
                ;;
            *)
                echo "Unknown option: $1"
                echo "Run '$0 --help' for usage information"
                exit 1
                ;;
        esac
        shift
    done
    
    # Check dependencies
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed"
        exit 1
    fi
    
    # Create temp directory
    mkdir -p "$TEMP_DIR"
    
    # Get registry (local or remote)
    if [ "$USE_LOCAL" = true ]; then
        print_step "Using local registry..."
        if [ ! -f "$LOCAL_REGISTRY" ]; then
            print_error "Local registry not found: $LOCAL_REGISTRY"
            exit 1
        fi
        cp "$LOCAL_REGISTRY" "${TEMP_DIR}/registry.json"
        print_success "Local registry loaded"
    else
        print_step "Downloading registry from GitHub..."
        if ! curl -fsSL "${RAW_URL}/built-ai-configs/registry/registry.json" -o "${TEMP_DIR}/registry.json"; then
            print_error "Failed to download registry from ${RAW_URL}/built-ai-configs/registry/registry.json"
            exit 1
        fi
        print_success "Registry downloaded successfully"
    fi
    
    # Validate registry JSON
    if ! jq empty "${TEMP_DIR}/registry.json" 2>/dev/null; then
        print_error "Registry is not valid JSON"
        exit 1
    fi
    
    # Run tests
    echo ""
    print_info "Testing file accessibility from: ${RAW_URL}"
    echo ""
    
    case "$TEST_MODE" in
        profile)
            if [ -z "$TEST_PROFILE" ]; then
                print_error "No profile specified. Use --profile=<name>"
                exit 1
            fi
            test_profile "$TEST_PROFILE" "${TEMP_DIR}/registry.json"
            ;;
        all)
            test_all "${TEMP_DIR}/registry.json"
            ;;
    esac
    
    # Print summary
    print_summary
    exit $?
}

main "$@"
# Shellcheck validation passed
