#!/bin/bash
# validate-context-refs.sh - Validates that all context references follow the strict convention

set -e

echo "🔍 Validating context references..."
echo ""

errors=0
warnings=0

# Check if .opencode directory exists
if [ ! -d ".opencode" ]; then
    echo "❌ No .opencode directory found"
    echo "   Run this script from the repository root"
    exit 1
fi

# Validate agent files
echo "Checking agent files..."
if [ -d ".opencode/agent" ]; then
    while IFS= read -r file; do
        rel_file="${file#./}"
        
        # Check for forbidden dynamic variables
        if grep -E '@\$[^0-9]|@\$\{' "$file" > /dev/null 2>&1; then
            echo "❌ Dynamic context reference in: $rel_file"
            grep -n '@\$' "$file" | head -3
            errors=$((errors + 1))
        fi
        
        # Check for context references that don't follow convention
        # Allow: @.opencode/context/, @AGENTS.md, @.cursorrules, @$1, @$2, etc.
        if grep -E '@[^~$]' "$file" | \
           grep -v '@\.opencode/context/' | \
           grep -v '@AGENTS\.md' | \
           grep -v '@\.cursorrules' | \
           grep -v '@\$[0-9]' | \
           grep -v '^#' | \
           grep -v 'email' | \
           grep -v 'mailto' > /dev/null 2>&1; then
            
            echo "⚠️  Non-standard reference in: $rel_file"
            grep -E '@[^~$]' "$file" | \
                grep -v '@\.opencode/context/' | \
                grep -v '@AGENTS\.md' | \
                grep -v '@\.cursorrules' | \
                grep -v '@\$[0-9]' | \
                grep -v '^#' | \
                grep -v 'email' | \
                grep -v 'mailto' | head -2
            warnings=$((warnings + 1))
        fi
    done < <(find .opencode/agent -type f -name "*.md" 2>/dev/null)
fi

# Validate command files
echo "Checking command files..."
if [ -d ".opencode/command" ]; then
    while IFS= read -r file; do
        rel_file="${file#./}"
        
        # Check for forbidden dynamic variables
        if grep -E '@\$[^0-9]|@\$\{' "$file" > /dev/null 2>&1; then
            echo "❌ Dynamic context reference in: $rel_file"
            grep -n '@\$' "$file" | head -3
            errors=$((errors + 1))
        fi
        
        # Check for non-standard references
        if grep -E '@[^~$]' "$file" | \
           grep -v '@\.opencode/context/' | \
           grep -v '@AGENTS\.md' | \
           grep -v '@\.cursorrules' | \
           grep -v '@\$[0-9]' | \
           grep -v '^#' | \
           grep -v 'email' > /dev/null 2>&1; then
            
            echo "⚠️  Non-standard reference in: $rel_file"
            warnings=$((warnings + 1))
        fi
    done < <(find .opencode/command -type f -name "*.md" 2>/dev/null)
fi

# Validate context files (they can reference other context files)
echo "Checking context files..."
if [ -d ".opencode/context" ]; then
    while IFS= read -r file; do
        rel_file="${file#./}"
        
        # Check for dynamic variables
        if grep -E '@\$[^0-9]|@\$\{' "$file" > /dev/null 2>&1; then
            echo "❌ Dynamic context reference in: $rel_file"
            errors=$((errors + 1))
        fi
        
        # Check for context cross-references
        if grep '@' "$file" | grep -v '@\.opencode/context/' | grep -v '^#' | grep -v 'email' > /dev/null 2>&1; then
            echo "⚠️  Context file has non-standard reference: $rel_file"
            warnings=$((warnings + 1))
        fi
    done < <(find .opencode/context -type f -name "*.md" 2>/dev/null)
fi

# Check for shell commands with hardcoded paths
echo "Checking for shell commands with paths..."
while IFS= read -r file; do
    rel_file="${file#./}"
    
    if grep '!\`.*\.opencode/context' "$file" > /dev/null 2>&1; then
        echo "ℹ️  Shell command with path in: $rel_file"
        echo "   (Will be transformed during installation)"
    fi
done < <(find .opencode -type f -name "*.md" 2>/dev/null)

# Summary
echo ""
echo "=========================================="
if [ $errors -gt 0 ]; then
    echo "❌ Validation failed with $errors error(s) and $warnings warning(s)"
    echo ""
    echo "Errors must be fixed before installation."
    echo "All context references must use: @.opencode/context/{category}/{file}.md"
    exit 1
elif [ $warnings -gt 0 ]; then
    echo "⚠️  Validation passed with $warnings warning(s)"
    echo ""
    echo "Warnings indicate non-standard references that may not work correctly."
    echo "Consider updating them to use: @.opencode/context/{category}/{file}.md"
    exit 0
else
    echo "✅ All validations passed!"
    echo ""
    echo "All context references follow the correct convention."
    exit 0
fi
