#!/usr/bin/env bash

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR="/tmp/opencode-e2e-test-$$"
PASSED=0
FAILED=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

setup() {
    rm -rf "$TEST_DIR"
    mkdir -p "$TEST_DIR"
}

cleanup() {
    rm -rf "$TEST_DIR"
}

trap cleanup EXIT

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           End-to-End Installation Test Suite                  ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

test_essential_profile() {
    echo -e "\n${BOLD}Test: Essential Profile Installation${NC}"
    
    local install_dir="$TEST_DIR/essential/.opencode"
    
    bash "$REPO_ROOT/install.sh" essential --install-dir="$install_dir" > "$TEST_DIR/essential.log" 2>&1
    
    local expected_files=(
        "agent/core/openagent.md"
        "agent/subagents/core/task-manager.md"
        "agent/subagents/core/documentation.md"
        "command/context.md"
        "command/clean.md"
        "context/core/essential-patterns.md"
        "context/project/project-context.md"
    )
    
    local missing=0
    for file in "${expected_files[@]}"; do
        if [ -f "$install_dir/$file" ]; then
            pass "Found: $file"
        else
            fail "Missing: $file"
            ((missing++))
        fi
    done
    
    if [ $missing -eq 0 ]; then
        pass "Essential profile: all expected files present"
    fi
}

test_developer_profile() {
    echo -e "\n${BOLD}Test: Developer Profile Installation${NC}"
    
    local install_dir="$TEST_DIR/developer/.opencode"
    
    bash "$REPO_ROOT/install.sh" developer --install-dir="$install_dir" > "$TEST_DIR/developer.log" 2>&1
    
    local expected_files=(
        "agent/core/openagent.md"
        "agent/core/opencoder.md"
        "agent/subagents/code/tester.md"
        "agent/subagents/code/reviewer.md"
        "agent/subagents/code/build-agent.md"
        "command/commit.md"
        "command/test.md"
        "context/core/standards/code.md"
    )
    
    local found=0
    for file in "${expected_files[@]}"; do
        if [ -f "$install_dir/$file" ]; then
            ((found++))
        fi
    done
    
    if [ $found -ge 6 ]; then
        pass "Developer profile: $found/${#expected_files[@]} key files present"
    else
        fail "Developer profile: only $found/${#expected_files[@]} key files found"
    fi
}

test_custom_install_dir() {
    echo -e "\n${BOLD}Test: Custom Installation Directory${NC}"
    
    local custom_dir="$TEST_DIR/custom-location/my-agents"
    
    bash "$REPO_ROOT/install.sh" essential --install-dir="$custom_dir" > "$TEST_DIR/custom.log" 2>&1
    
    if [ -d "$custom_dir" ]; then
        pass "Custom directory created: $custom_dir"
    else
        fail "Custom directory not created"
    fi
    
    if [ -f "$custom_dir/agent/core/openagent.md" ]; then
        pass "Files installed to custom location"
    else
        fail "Files not found in custom location"
    fi
}

test_skip_existing_files() {
    echo -e "\n${BOLD}Test: Skip Existing Files Strategy${NC}"
    
    local install_dir="$TEST_DIR/skip-test/.opencode"
    mkdir -p "$install_dir/agent/core"
    
    echo "CUSTOM CONTENT - DO NOT OVERWRITE" > "$install_dir/agent/core/openagent.md"
    
    bash "$REPO_ROOT/install.sh" essential --install-dir="$install_dir" > "$TEST_DIR/skip.log" 2>&1
    
    local content
    content=$(cat "$install_dir/agent/core/openagent.md")
    
    if [[ "$content" == "CUSTOM CONTENT - DO NOT OVERWRITE" ]]; then
        pass "Existing file preserved (skip strategy working)"
    else
        fail "Existing file was overwritten"
    fi
}

test_file_content_validity() {
    echo -e "\n${BOLD}Test: File Content Validity${NC}"
    
    local install_dir="$TEST_DIR/content-test/.opencode"
    
    bash "$REPO_ROOT/install.sh" essential --install-dir="$install_dir" > "$TEST_DIR/content.log" 2>&1
    
    local agent_file="$install_dir/agent/core/openagent.md"
    
    if [ -f "$agent_file" ]; then
        if grep -q "OpenAgent\|openagent" "$agent_file"; then
            pass "Agent file contains expected content"
        else
            fail "Agent file appears empty or corrupted"
        fi
        
        local size
        size=$(wc -c < "$agent_file")
        if [ "$size" -gt 100 ]; then
            pass "Agent file has substantial content ($size bytes)"
        else
            fail "Agent file too small ($size bytes)"
        fi
    else
        fail "Agent file not found"
    fi
}

test_directory_structure() {
    echo -e "\n${BOLD}Test: Directory Structure${NC}"
    
    local install_dir="$TEST_DIR/structure-test/.opencode"
    
    bash "$REPO_ROOT/install.sh" developer --install-dir="$install_dir" > "$TEST_DIR/structure.log" 2>&1
    
    local expected_dirs=(
        "agent"
        "agent/core"
        "agent/subagents"
        "command"
        "context"
        "context/core"
    )
    
    for dir in "${expected_dirs[@]}"; do
        if [ -d "$install_dir/$dir" ]; then
            pass "Directory exists: $dir"
        else
            fail "Missing directory: $dir"
        fi
    done
}

test_registry_consistency() {
    echo -e "\n${BOLD}Test: Registry Consistency${NC}"
    
    if [ -f "$REPO_ROOT/registry.json" ]; then
        if command -v jq &> /dev/null; then
            local agent_count
            agent_count=$(jq '.components.agents | length' "$REPO_ROOT/registry.json")
            
            if [ "$agent_count" -gt 0 ]; then
                pass "Registry has $agent_count agents defined"
            else
                fail "Registry has no agents"
            fi
            
            local profile_count
            profile_count=$(jq '.profiles | keys | length' "$REPO_ROOT/registry.json")
            
            if [ "$profile_count" -ge 4 ]; then
                pass "Registry has $profile_count profiles"
            else
                fail "Registry missing profiles (found $profile_count)"
            fi
        else
            warn "jq not installed, skipping JSON validation"
        fi
    else
        fail "registry.json not found"
    fi
}

test_help_and_list() {
    echo -e "\n${BOLD}Test: Help and List Commands${NC}"
    
    if bash "$REPO_ROOT/install.sh" --help 2>&1 | grep -q "Usage:"; then
        pass "Help command works"
    else
        fail "Help command failed"
    fi
    
    if bash "$REPO_ROOT/install.sh" list 2>&1 | grep -q "Available Components\|Agents"; then
        pass "List command works"
    else
        fail "List command failed"
    fi
}

main() {
    print_header
    
    echo "Repository: $REPO_ROOT"
    echo "Test directory: $TEST_DIR"
    echo ""
    
    setup
    
    test_help_and_list
    test_essential_profile
    test_developer_profile
    test_custom_install_dir
    test_skip_existing_files
    test_file_content_validity
    test_directory_structure
    test_registry_consistency
    
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}E2E Test Summary${NC}"
    echo -e "  ${GREEN}Passed: $PASSED${NC}"
    echo -e "  ${RED}Failed: $FAILED${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    
    if [ $FAILED -gt 0 ]; then
        echo -e "\n${RED}Some tests failed!${NC}"
        exit 1
    else
        echo -e "\n${GREEN}All E2E tests passed!${NC}"
        exit 0
    fi
}

main "$@"
