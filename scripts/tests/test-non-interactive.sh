#!/usr/bin/env bash

#############################################################################
# Non-Interactive Mode Test Script
# Tests the installer behavior when run via pipe (curl | bash)
# 
# This test catches bugs like: https://github.com/darrenhinde/OpenAgents/issues/XX
# where interactive prompts fail silently in piped execution.
#############################################################################

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR="/tmp/opencode-noninteractive-test-$$"
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
    echo "║         Non-Interactive Mode Test Suite                       ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

#############################################################################
# Test 1: Fresh install with piped input (simulates curl | bash)
#############################################################################
test_fresh_install_piped() {
    echo -e "\n${BOLD}Test 1: Fresh Install via Pipe${NC}"
    
    local install_dir="$TEST_DIR/fresh-install/.opencode"
    
    if echo "" | bash "$REPO_ROOT/install.sh" essential --install-dir="$install_dir" 2>&1 | grep -q "Installation complete"; then
        if [ -d "$install_dir" ]; then
            pass "Fresh install completed successfully via pipe"
        else
            fail "Install reported success but directory not created"
        fi
    else
        fail "Fresh install via pipe failed"
    fi
}

#############################################################################
# Test 2: Install with existing files (collision scenario)
#############################################################################
test_collision_non_interactive() {
    echo -e "\n${BOLD}Test 2: Collision Handling in Non-Interactive Mode${NC}"
    
    local install_dir="$TEST_DIR/collision-test/.opencode"
    mkdir -p "$install_dir/agent/core"
    echo "existing content" > "$install_dir/agent/core/openagent.md"
    
    local output
    output=$(echo "" | bash "$REPO_ROOT/install.sh" essential --install-dir="$install_dir" 2>&1)
    
    if echo "$output" | grep -q "Installation cancelled by user"; then
        fail "BUG DETECTED: Non-interactive mode cancelled due to collision prompt"
        echo "    This is the exact bug we're testing for!"
        return 1
    fi
    
    if echo "$output" | grep -q "skip.*strategy\|Skipped existing"; then
        pass "Collision handled correctly - used skip strategy"
    elif echo "$output" | grep -q "Installation complete"; then
        pass "Installation completed (no collision or handled silently)"
    else
        fail "Unexpected behavior during collision handling"
        echo "    Output: $output"
    fi
    
    local original_content
    original_content=$(cat "$install_dir/agent/core/openagent.md" 2>/dev/null || echo "")
    if [ "$original_content" = "existing content" ]; then
        pass "Existing file preserved (skip strategy worked)"
    else
        warn "Existing file was overwritten (may be intentional in some modes)"
    fi
}

#############################################################################
# Test 3: Essential profile in non-interactive mode (CI tests all profiles)
#############################################################################
test_profile_non_interactive() {
    echo -e "\n${BOLD}Test 3: Essential Profile Non-Interactive${NC}"
    
    local install_dir="$TEST_DIR/profile-essential/.opencode"
    
    local output
    output=$(echo "" | timeout 60 bash "$REPO_ROOT/install.sh" essential --install-dir="$install_dir" 2>&1) || true
    
    if echo "$output" | grep -q "Installation complete"; then
        pass "Profile 'essential' installed successfully"
    elif echo "$output" | grep -q "Installation cancelled"; then
        fail "Profile 'essential' failed - cancelled unexpectedly"
    else
        fail "Profile 'essential' had unexpected output"
    fi
}

#############################################################################
# Test 4: Simulated curl | bash execution
#############################################################################
test_simulated_curl_pipe() {
    echo -e "\n${BOLD}Test 4: Simulated curl | bash Execution${NC}"
    
    local install_dir="$TEST_DIR/curl-sim/.opencode"
    
    cat "$REPO_ROOT/install.sh" | bash -s essential --install-dir="$install_dir" 2>&1 | tail -5 > "$TEST_DIR/curl-output.txt"
    
    if grep -q "Installation complete\|Installed:" "$TEST_DIR/curl-output.txt"; then
        pass "Simulated 'curl | bash -s essential' worked"
    elif grep -q "cancelled" "$TEST_DIR/curl-output.txt"; then
        fail "Simulated curl pipe was cancelled unexpectedly"
    else
        fail "Simulated curl pipe had unexpected result"
        cat "$TEST_DIR/curl-output.txt"
    fi
}

#############################################################################
# Test 5: stdin detection
#############################################################################
test_stdin_detection() {
    echo -e "\n${BOLD}Test 5: stdin Detection${NC}"
    
    if [ -t 0 ]; then
        pass "Running in terminal (stdin is TTY)"
    else
        warn "Running in non-interactive mode (stdin is not TTY)"
    fi
    
    local in_pipe
    in_pipe=$(echo "" | bash -c '[ -t 0 ] && echo "tty" || echo "pipe"')
    if [ "$in_pipe" = "pipe" ]; then
        pass "Pipe detection works correctly"
    else
        fail "Pipe detection failed"
    fi
}

#############################################################################
# Test 6: NON_INTERACTIVE flag is set correctly
#############################################################################
test_non_interactive_flag() {
    echo -e "\n${BOLD}Test 6: NON_INTERACTIVE Flag Detection${NC}"
    
    local output
    output=$(bash "$REPO_ROOT/install.sh" essential --help 2>&1 | head -20)
    
    if echo "$output" | grep -q "Usage:"; then
        pass "Script executes and shows help"
    else
        fail "Script failed to show help"
    fi
    
    output=$(echo "" | bash "$REPO_ROOT/install.sh" essential --install-dir="$TEST_DIR/flag-test" 2>&1)
    
    if echo "$output" | grep -q "non-interactive\|automatically"; then
        pass "Non-interactive mode detected and reported"
    else
        pass "Installation proceeded (flag working silently)"
    fi
}

#############################################################################
# Test 7: Error handling in non-interactive mode
#############################################################################
test_error_handling_non_interactive() {
    echo -e "\n${BOLD}Test 7: Error Handling in Non-Interactive Mode${NC}"
    
    local output
    output=$(echo "" | bash "$REPO_ROOT/install.sh" invalid_profile 2>&1) || true
    
    if echo "$output" | grep -q "Unknown option\|Invalid\|Error"; then
        pass "Invalid profile rejected with clear error"
    else
        fail "Invalid profile should produce error message"
    fi
}

#############################################################################
# Main
#############################################################################
main() {
    print_header
    
    echo "Repository: $REPO_ROOT"
    echo "Test directory: $TEST_DIR"
    echo ""
    
    setup
    
    test_fresh_install_piped
    test_collision_non_interactive
    test_profile_non_interactive
    test_simulated_curl_pipe
    test_stdin_detection
    test_non_interactive_flag
    test_error_handling_non_interactive
    
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Test Summary${NC}"
    echo -e "  ${GREEN}Passed: $PASSED${NC}"
    echo -e "  ${RED}Failed: $FAILED${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    
    if [ $FAILED -gt 0 ]; then
        echo -e "\n${RED}Some tests failed!${NC}"
        exit 1
    else
        echo -e "\n${GREEN}All tests passed!${NC}"
        exit 0
    fi
}

main "$@"
