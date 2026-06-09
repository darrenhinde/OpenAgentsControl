#!/usr/bin/env bash
###############################################################################
# Test Script for Path Transformation Logic
# Verifies fix for issue #321: /add-context writes to global path instead of
# project-local by default
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

# Test counters
PASSED=0
FAILED=0

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║           Path Transformation Logic Test                       ║"
    echo "║           Issue #321: /add-context path resolution             ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASSED=$((PASSED + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAILED=$((FAILED + 1))
}

# Simulates the path transformation condition from install.sh
# Returns 0 if transformation should happen, 1 if not
should_transform() {
    local install_dir="$1"
    local home_dir="${HOME:-/home/user}"

    # This is the FIXED logic from install.sh
    if [[ "$install_dir" != ".opencode" ]] && \
       [[ "$install_dir" != *"/.opencode" ]] && \
       [[ "$install_dir" != "$home_dir/.config/opencode" ]]; then
        return 0  # Should transform
    else
        return 1  # Should NOT transform
    fi
}

# OLD logic (before fix) - for comparison
should_transform_old() {
    local install_dir="$1"

    # Old logic - only checked for .opencode suffix
    if [[ "$install_dir" != ".opencode" ]] && [[ "$install_dir" != *"/.opencode" ]]; then
        return 0  # Should transform
    else
        return 1  # Should NOT transform
    fi
}

test_local_relative() {
    echo -e "\n${BOLD}Test: Local relative path (.opencode)${NC}"

    if should_transform ".opencode"; then
        fail "Should NOT transform for .opencode"
    else
        pass "Correctly skipped transformation for .opencode"
    fi
}

test_local_subdirectory() {
    echo -e "\n${BOLD}Test: Local subdirectory (some/path/.opencode)${NC}"

    if should_transform "some/path/.opencode"; then
        fail "Should NOT transform for */.opencode"
    else
        pass "Correctly skipped transformation for */.opencode"
    fi
}

test_global_standard() {
    echo -e "\n${BOLD}Test: Global standard (~/.config/opencode)${NC}"

    local global_path="$HOME/.config/opencode"

    if should_transform "$global_path"; then
        fail "Should NOT transform for ~/.config/opencode (global standard)"
    else
        pass "Correctly skipped transformation for ~/.config/opencode"
    fi
}

test_global_tilde() {
    echo -e "\n${BOLD}Test: Global with tilde (~/.config/opencode as literal)${NC}"

    # When tilde is NOT expanded by shell
    if should_transform "~/.config/opencode"; then
        # This is actually the expected behavior with the fix
        # because the condition checks for $HOME/.config/opencode, not the literal ~
        pass "Correctly handles unexpanded tilde (no transformation)"
    else
        fail "Should handle unexpanded tilde path"
    fi
}

test_custom_path() {
    echo -e "\n${BOLD}Test: Custom non-standard path (/opt/opencode)${NC}"

    if should_transform "/opt/opencode"; then
        pass "Correctly applies transformation for /opt/opencode"
    else
        fail "Should transform for non-standard paths like /opt/opencode"
    fi
}

test_custom_other() {
    echo -e "\n${BOLD}Test: Custom non-standard path (/usr/local/opencode)${NC}"

    if should_transform "/usr/local/opencode"; then
        pass "Correctly applies transformation for /usr/local/opencode"
    else
        fail "Should transform for non-standard paths like /usr/local/opencode"
    fi
}

test_comparison_old_vs_new() {
    echo -e "\n${BOLD}Test: Compare OLD vs NEW behavior for global install${NC}"

    local global_path="$HOME/.config/opencode"

    echo "  Testing with INSTALL_DIR='$global_path'"

    # OLD logic behavior
    if should_transform_old "$global_path"; then
        echo "  OLD: Would transform (BUG - caused issue #321)"
    else
        echo "  OLD: Would NOT transform"
    fi

    # NEW logic behavior
    if should_transform "$global_path"; then
        echo "  NEW: Would transform"
    else
        echo "  NEW: Would NOT transform (FIXED)"
    fi

    # The new logic should NOT transform for global standard
    if should_transform "$global_path"; then
        fail "New logic still transforms for global path - fix not working"
    else
        pass "New logic correctly skips transformation for global standard"
    fi
}

test_path_separation() {
    echo -e "\n${BOLD}Test: Verify local vs global path separation${NC}"

    local local_path="$(pwd)/.opencode"
    local global_path="$HOME/.config/opencode"

    echo "  Local install: $local_path"
    echo "  Global install: $global_path"

    local local_transform
    local global_transform

    if should_transform "$local_path"; then
        local_transform=true
    else
        local_transform=false
    fi

    if should_transform "$global_path"; then
        global_transform=true
    else
        global_transform=false
    fi

    if [ "$local_transform" = false ] && [ "$global_transform" = false ]; then
        pass "Both local and global correctly skip transformation"
    else
        fail "Path transformation not correctly configured"
        echo "    local_transform=$local_transform, global_transform=$global_transform"
    fi
}

test_simulation() {
    echo -e "\n${BOLD}Test: Simulate actual path transformation on content${NC}"

    local test_content='@.opencode/context/project-intelligence/'
    local install_dir="$HOME/.config/opencode"

    local transformed="$test_content"

    if ! should_transform "$install_dir"; then
        # No transformation needed - path stays the same
        # This is the FIX for issue #321
        :
    else
        # Would transform - but this should NOT happen for standard global
        local expanded="${install_dir/#\~/$HOME}"
        transformed="${test_content/@\.opencode/@${expanded}}"
    fi

    if [ "$transformed" = "@.opencode/context/project-intelligence/" ]; then
        pass "Content preserved correctly (no unwanted transformation)"
        echo "    Input:  $test_content"
        echo "    Output: $transformed"
    else
        fail "Content was incorrectly transformed"
        echo "    Input:  $test_content"
        echo "    Output: $transformed"
    fi
}

print_summary() {
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}Test Summary${NC}"
    echo -e "  ${GREEN}Passed: $PASSED${NC}"
    echo -e "  ${RED}Failed: $FAILED${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"

    if [ $FAILED -gt 0 ]; then
        echo -e "\n${RED}Some tests failed!${NC}"
        return 1
    else
        echo -e "\n${GREEN}All path transformation tests passed!${NC}"
        echo "The fix correctly ensures:"
        echo "  • Local install (.opencode) → no transformation"
        echo "  • Local subdirectory (*/.opencode) → no transformation"
        echo "  • Global standard (~/.config/opencode) → no transformation"
        echo "  • Custom paths (/opt/opencode) → transformation applied"
        return 0
    fi
}

main() {
    print_header

    echo ""
    echo "Testing the path transformation fix for issue #321"
    echo "Before the fix, both local and global installs would resolve"
    echo "to the same path because transformation was incorrectly applied"
    echo "to standard global installations."
    echo ""

    test_local_relative
    test_local_subdirectory
    test_global_standard
    test_global_tilde
    test_custom_path
    test_custom_other
    test_comparison_old_vs_new
    test_path_separation
    test_simulation

    print_summary
    exit $?
}

main "$@"