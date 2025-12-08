#!/bin/bash
# validate-test-suites.sh
# Validates all test suite JSON files against schema and checks paths exist
#
# Usage:
#   ./scripts/validation/validate-test-suites.sh [agent]
#   ./scripts/validation/validate-test-suites.sh openagent
#   ./scripts/validation/validate-test-suites.sh --all
#
# Exit codes:
#   0 - All suites valid
#   1 - Validation errors found
#   2 - Missing dependencies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Check for ajv-cli (JSON schema validator)
# Use npx to run from local node_modules
if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ Error: npx not found (Node.js required)${NC}"
    exit 2
fi

# Check if ajv-cli is installed
if ! (cd "$PROJECT_ROOT/evals/framework" && npx ajv validate -s /dev/null -d /dev/null 2>&1 | grep -q "valid"); then
    echo -e "${RED}❌ Error: ajv-cli not found${NC}"
    echo ""
    echo "Install with: cd evals/framework && npm install"
    echo "Or globally: npm install -g ajv-cli"
    exit 2
fi

AJV_CMD="cd $PROJECT_ROOT/evals/framework && npx ajv"

# Parse arguments
AGENT="${1:-openagent}"
VALIDATE_ALL=false

if [[ "$1" == "--all" ]]; then
    VALIDATE_ALL=true
fi

# Counters
TOTAL_SUITES=0
VALID_SUITES=0
INVALID_SUITES=0
TOTAL_ERRORS=0
TOTAL_WARNINGS=0

echo -e "${BLUE}🔍 Validating Test Suites${NC}"
echo ""

# Function to validate a single suite
validate_suite() {
    local agent=$1
    local suite_file=$2
    local suite_name=$(basename "$suite_file" .json)
    
    TOTAL_SUITES=$((TOTAL_SUITES + 1))
    
    echo -e "${BLUE}Validating:${NC} $agent/$suite_name"
    
    local schema_file="$PROJECT_ROOT/evals/agents/$agent/config/suite-schema.json"
    local tests_dir="$PROJECT_ROOT/evals/agents/$agent/tests"
    
    local suite_valid=true
    local suite_errors=0
    local suite_warnings=0
    
    # 1. Validate JSON syntax
    if ! jq empty "$suite_file" 2>/dev/null; then
        echo -e "  ${RED}❌ Invalid JSON syntax${NC}"
        suite_valid=false
        suite_errors=$((suite_errors + 1))
        INVALID_SUITES=$((INVALID_SUITES + 1))
        TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
        return
    fi
    
    # 2. Validate against schema
    if [[ -f "$schema_file" ]]; then
        validation_output=$(eval "$AJV_CMD validate -s \"$schema_file\" -d \"$suite_file\" --strict=false 2>&1")
        if ! echo "$validation_output" | grep -q "valid"; then
            echo -e "  ${RED}❌ Schema validation failed${NC}"
            echo "$validation_output" | grep -v "valid" | sed 's/^/     /'
            suite_valid=false
            suite_errors=$((suite_errors + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠️  Schema not found: $schema_file${NC}"
        suite_warnings=$((suite_warnings + 1))
    fi
    
    # 3. Validate test paths exist
    local missing_tests=()
    local test_count=0
    
    while IFS= read -r test_path; do
        test_count=$((test_count + 1))
        local full_path="$tests_dir/$test_path"
        
        if [[ ! -f "$full_path" ]]; then
            missing_tests+=("$test_path")
        fi
    done < <(jq -r '.tests[].path' "$suite_file")
    
    # 4. Check test count matches
    local declared_count=$(jq -r '.totalTests' "$suite_file")
    if [[ "$test_count" -ne "$declared_count" ]]; then
        echo -e "  ${YELLOW}⚠️  Test count mismatch: found $test_count, declared $declared_count${NC}"
        suite_warnings=$((suite_warnings + 1))
    fi
    
    # 5. Report missing tests
    if [[ ${#missing_tests[@]} -gt 0 ]]; then
        echo -e "  ${RED}❌ Missing test files (${#missing_tests[@]}):${NC}"
        for missing in "${missing_tests[@]}"; do
            echo -e "     - $missing"
            
            # Suggest similar files
            local dir=$(dirname "$missing")
            local filename=$(basename "$missing")
            if [[ -d "$tests_dir/$dir" ]]; then
                local similar=$(find "$tests_dir/$dir" -name "*.yaml" -type f -exec basename {} \; | grep -i "$(echo $filename | cut -d'-' -f1)" | head -3)
                if [[ -n "$similar" ]]; then
                    echo -e "       ${YELLOW}Did you mean?${NC}"
                    echo "$similar" | sed 's/^/         - /'
                fi
            fi
        done
        suite_valid=false
        suite_errors=$((suite_errors + ${#missing_tests[@]}))
    fi
    
    # 6. Summary for this suite
    if [[ "$suite_valid" == true ]]; then
        echo -e "  ${GREEN}✅ Valid${NC} ($test_count tests)"
        VALID_SUITES=$((VALID_SUITES + 1))
    else
        echo -e "  ${RED}❌ Invalid${NC} ($suite_errors errors, $suite_warnings warnings)"
        INVALID_SUITES=$((INVALID_SUITES + 1))
    fi
    
    TOTAL_ERRORS=$((TOTAL_ERRORS + suite_errors))
    TOTAL_WARNINGS=$((TOTAL_WARNINGS + suite_warnings))
    
    echo ""
}

# Validate suites
if [[ "$VALIDATE_ALL" == true ]]; then
    # Validate all agents
    for agent_dir in "$PROJECT_ROOT/evals/agents"/*; do
        if [[ -d "$agent_dir" ]]; then
            agent=$(basename "$agent_dir")
            
            # Check for suites directory
            suites_dir="$agent_dir/config/suites"
            if [[ -d "$suites_dir" ]]; then
                for suite_file in "$suites_dir"/*.json; do
                    if [[ -f "$suite_file" ]]; then
                        validate_suite "$agent" "$suite_file"
                    fi
                done
            fi
            
            # Check for legacy core-tests.json
            legacy_file="$agent_dir/config/core-tests.json"
            if [[ -f "$legacy_file" ]]; then
                validate_suite "$agent" "$legacy_file"
            fi
        fi
    done
else
    # Validate specific agent
    agent_dir="$PROJECT_ROOT/evals/agents/$AGENT"
    
    if [[ ! -d "$agent_dir" ]]; then
        echo -e "${RED}❌ Agent not found: $AGENT${NC}"
        exit 1
    fi
    
    # Check for suites directory
    suites_dir="$agent_dir/config/suites"
    if [[ -d "$suites_dir" ]]; then
        for suite_file in "$suites_dir"/*.json; do
            if [[ -f "$suite_file" ]]; then
                validate_suite "$AGENT" "$suite_file"
            fi
        done
    fi
    
    # Check for legacy core-tests.json
    legacy_file="$agent_dir/config/core-tests.json"
    if [[ -f "$legacy_file" ]]; then
        validate_suite "$AGENT" "$legacy_file"
    fi
    
    if [[ $TOTAL_SUITES -eq 0 ]]; then
        echo -e "${YELLOW}⚠️  No test suites found for agent: $AGENT${NC}"
        echo ""
        echo "Expected locations:"
        echo "  - $suites_dir/*.json"
        echo "  - $legacy_file"
        exit 1
    fi
fi

# Final summary
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "Total suites:    $TOTAL_SUITES"
echo -e "${GREEN}Valid suites:    $VALID_SUITES${NC}"
if [[ $INVALID_SUITES -gt 0 ]]; then
    echo -e "${RED}Invalid suites:  $INVALID_SUITES${NC}"
fi
if [[ $TOTAL_ERRORS -gt 0 ]]; then
    echo -e "${RED}Total errors:    $TOTAL_ERRORS${NC}"
fi
if [[ $TOTAL_WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}Total warnings:  $TOTAL_WARNINGS${NC}"
fi
echo ""

# Exit with appropriate code
if [[ $INVALID_SUITES -gt 0 ]] || [[ $TOTAL_ERRORS -gt 0 ]]; then
    echo -e "${RED}❌ Validation failed${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All suites valid${NC}"
    exit 0
fi
