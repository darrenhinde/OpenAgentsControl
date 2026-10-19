#!/bin/bash

# Test script for Agent Validator Plugin
# Tests basic plugin functionality and validation tools

echo "🧪 Testing Agent Validator Plugin"
echo "=================================="
echo ""

# Test 1: Simple task with approval gate
echo "📝 Test 1: Simple task (should request approval)"
echo "Running: 'List files in current directory'"
echo ""

opencode run "List the files in the current directory" --format json > /tmp/test1-output.json 2>&1

echo "✅ Test 1 complete"
echo ""

# Test 2: Validate the session
echo "📊 Test 2: Validate session behavior"
echo "Running: validate_session"
echo ""

opencode run "validate_session" --format json > /tmp/test2-output.json 2>&1

echo "✅ Test 2 complete"
echo ""

# Test 3: Check approval gates
echo "🔒 Test 3: Check approval gates"
echo "Running: check_approval_gates"
echo ""

opencode run "check_approval_gates" --format json > /tmp/test3-output.json 2>&1

echo "✅ Test 3 complete"
echo ""

# Display results
echo "=================================="
echo "📋 Test Results"
echo "=================================="
echo ""

echo "Test 1 Output (last 20 lines):"
echo "---"
tail -20 /tmp/test1-output.json
echo ""

echo "Test 2 Output (validation report):"
echo "---"
tail -30 /tmp/test2-output.json
echo ""

echo "Test 3 Output (approval gates):"
echo "---"
tail -20 /tmp/test3-output.json
echo ""

echo "=================================="
echo "✅ All tests complete!"
echo ""
echo "Full outputs saved to:"
echo "  - /tmp/test1-output.json"
echo "  - /tmp/test2-output.json"
echo "  - /tmp/test3-output.json"
