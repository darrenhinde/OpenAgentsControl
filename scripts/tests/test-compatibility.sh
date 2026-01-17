#!/usr/bin/env bash

#############################################################################
# Compatibility Test Script
# Tests the installer across different bash versions and platforms
#############################################################################

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         OpenCode Installer Compatibility Test                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() {
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "System Information:"
echo "  Platform: $(uname -s)"
echo "  Bash Version: $BASH_VERSION"
echo "  Shell: $SHELL"
echo ""

# Test 1: Bash version check
echo "Test 1: Bash Version Compatibility"
bash_major="${BASH_VERSION%%.*}"
if [ "$bash_major" -ge 3 ]; then
    pass "Bash version $BASH_VERSION is compatible (3.2+ required)"
else
    fail "Bash version $BASH_VERSION is too old (3.2+ required)"
fi

# Test 2: Required commands
echo ""
echo "Test 2: Required Dependencies"
for cmd in curl jq; do
    if command -v "$cmd" &> /dev/null; then
        pass "$cmd is installed"
    else
        fail "$cmd is not installed"
    fi
done

# Test 3: Script syntax check
echo ""
echo "Test 3: Script Syntax Check"
if bash -n install.sh 2>/dev/null; then
    pass "Script syntax is valid"
else
    fail "Script has syntax errors"
fi

# Test 4: Help command
echo ""
echo "Test 4: Help Command"
if bash install.sh help 2>&1 | grep -q "Usage:"; then
    pass "Help command works"
else
    fail "Help command failed"
fi

# Test 5: List command
echo ""
echo "Test 5: List Command"
if bash install.sh list 2>&1 | grep -q "Available Components"; then
    pass "List command works"
else
    fail "List command failed"
fi

# Test 6: Profile argument parsing
echo ""
echo "Test 6: Profile Argument Parsing"
for profile in essential developer full advanced; do
    if echo "n" | bash install.sh "$profile" 2>&1 | grep -q "Profile:"; then
        pass "Profile '$profile' argument works"
    else
        fail "Profile '$profile' argument failed"
    fi
done

# Test 7: Profile with dashes
echo ""
echo "Test 7: Profile Arguments with Dashes"
for profile in --essential --developer --full --advanced; do
    if echo "n" | bash install.sh "$profile" 2>&1 | grep -q "Profile:"; then
        pass "Profile '$profile' argument works"
    else
        fail "Profile '$profile' argument failed"
    fi
done

# Test 8: Array operations
echo ""
echo "Test 8: Array Operations"
test_array=()
test_array+=("item1")
test_array+=("item2")
if [ ${#test_array[@]} -eq 2 ]; then
    pass "Array operations work"
else
    fail "Array operations failed"
fi

# Test 9: Parameter expansion
echo ""
echo "Test 9: Parameter Expansion"
test_string="type:id"
type="${test_string%%:*}"
id="${test_string##*:}"
if [ "$type" = "type" ] && [ "$id" = "id" ]; then
    pass "Parameter expansion works"
else
    fail "Parameter expansion failed"
fi

# Test 10: Temp directory creation
echo ""
echo "Test 10: Temp Directory Operations"
test_temp="/tmp/opencode-test-$$"
mkdir -p "$test_temp"
if [ -d "$test_temp" ]; then
    pass "Temp directory creation works"
    rm -rf "$test_temp"
else
    fail "Temp directory creation failed"
fi

# Test 11: File operations
echo ""
echo "Test 11: File Operations"
test_file="/tmp/opencode-test-$$.txt"
echo "test" > "$test_file"
if [ -f "$test_file" ]; then
    content=$(cat "$test_file")
    if [ "$content" = "test" ]; then
        pass "File operations work"
        rm -f "$test_file"
    else
        fail "File read failed"
    fi
else
    fail "File write failed"
fi

# Test 12: Network connectivity
echo ""
echo "Test 12: Network Connectivity"
if curl -fsSL --max-time 5 https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/README.md > /dev/null 2>&1; then
    pass "Network connectivity to GitHub works"
else
    warn "Network connectivity test failed (may be offline)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  All Tests Passed! ✓                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Your system is compatible with the OpenCode installer."
echo "You can safely run:"
echo "  curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash"
echo ""
