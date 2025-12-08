# Context Reference Convention

## Overview

All context file references in OpenAgents **MUST** use the standardized format:

```markdown
@.opencode/context/path/to/file.md
```

This convention is **required** for the installation system to work correctly across local and global installations.

---

## The Requirement

### ✅ Correct Format

```markdown
@.opencode/context/core/essential-patterns.md
@.opencode/context/project/project-context.md
@.opencode/context/security/auth.md
```

### ❌ Incorrect Formats

```markdown
@context/core/patterns.md           ❌ Missing .opencode prefix
@~/context/file.md                  ❌ Absolute path (breaks local installs)
@$CONTEXT_DIR/file.md               ❌ Variables (can't be transformed)
../context/file.md                  ❌ Relative path (unreliable)
```

---

## Why This Convention?

### Problem: Local vs Global Installations

Users can install OpenAgents in two ways:

**Local Install:**
```bash
.opencode/
├── agent/
├── command/
└── context/
```
References work as: `@.opencode/context/file.md` (relative to current directory)

**Global Install:**
```bash
~/.config/opencode/
├── agent/
├── command/
└── context/
```
References need to be: `@~/.config/opencode/context/file.md` (absolute path)

### Solution: Install-Time Transformation

The installation script automatically transforms references based on installation type:

```bash
# Local install (.opencode/)
@.opencode/context/test.md  →  @.opencode/context/test.md  (no change)

# Global install (~/.config/opencode/)
@.opencode/context/test.md  →  @~/.config/opencode/context/test.md  (transformed)

# Custom install (/usr/local/opencode/)
@.opencode/context/test.md  →  @/usr/local/opencode/context/test.md  (transformed)
```

---

## How It Works

### Repository Files (Source)

All files in the repository use the standard format:

```markdown
# Example Agent

Load patterns from @.opencode/context/core/essential-patterns.md
```

### Installation Process

When a user installs globally, the installer:

1. Downloads the file
2. Detects global installation (INSTALL_DIR != ".opencode")
3. Transforms all references:
   ```bash
   sed -e "s|@\.opencode/context/|@${INSTALL_DIR}/context/|g" \
       -e "s|\.opencode/context|${INSTALL_DIR}/context|g" file.md
   ```
4. Saves the transformed file

### Result

**After global install to ~/.config/opencode:**
```markdown
# Example Agent

Load patterns from @/Users/username/.config/opencode/context/core/essential-patterns.md
```

---

## What Gets Transformed

### All File Types

The transformation applies to **EVERY** file during installation:

- ✅ Agent files (`.opencode/agent/*.md`)
- ✅ Subagent files (`.opencode/agent/subagents/*.md`)
- ✅ Command files (`.opencode/command/*.md`)
- ✅ Context files (`.opencode/context/**/*.md`)
- ✅ Any other markdown files

### All Reference Types

Both patterns are transformed:

**Pattern 1: @ References (OpenCode syntax)**
```markdown
@.opencode/context/file.md  →  @/install/path/context/file.md
```

**Pattern 2: Shell Commands**
```markdown
.opencode/context/file.md  →  /install/path/context/file.md
```

---

## Testing & Validation

### Why We Enforce This

During development and testing, we discovered:

1. **Inconsistent references broke installations** - Some files used `@context/`, others used `@.opencode/context/`
2. **Variable-based paths couldn't be transformed** - `@$CONTEXT_DIR/file.md` can't be reliably replaced
3. **Relative paths were unreliable** - `../context/file.md` broke when files moved
4. **Absolute paths broke local installs** - `@~/.config/opencode/context/` doesn't work for `.opencode/`

### Test Results

With the standardized convention:
- ✅ 31/31 tests passed (100% success rate)
- ✅ Works for local installations
- ✅ Works for global installations
- ✅ Works for custom installation paths
- ✅ Transforms all file types correctly
- ✅ Handles multiple references per file

---

## Implementation Details

### Detection Logic

The installer determines if transformation is needed:

```bash
if [[ "$INSTALL_DIR" != ".opencode" ]] && [[ "$INSTALL_DIR" != *"/.opencode" ]]; then
    # Global install detected → Transform paths
else
    # Local install detected → Keep original paths
fi
```

### Transformation Command

```bash
sed -i.bak -e "s|@\.opencode/context/|@${expanded_path}/context/|g" \
           -e "s|\.opencode/context|${expanded_path}/context|g" "$dest"
rm -f "${dest}.bak"
```

**Explanation:**
- `-i.bak` - Edit in-place, create backup
- First pattern - Transform @ references
- Second pattern - Transform shell command paths
- `g` flag - Replace ALL occurrences
- Remove backup file after transformation

---

## Developer Guidelines

### When Creating New Files

**Always use the standard format:**

```markdown
# Good Examples ✅
@.opencode/context/core/essential-patterns.md
@.opencode/context/project/project-context.md
@.opencode/context/security/auth.md

# Bad Examples ❌
@context/file.md
@~/context/file.md
@$CONTEXT_DIR/file.md
../context/file.md
```

### When Referencing Context

**In agents:**
```markdown
Load context from @.opencode/context/core/essential-patterns.md
```

**In commands:**
```markdown
Reference: @.opencode/context/project/project-context.md
```

**In context files:**
```markdown
See also: @.opencode/context/security/auth.md
```

**In shell commands:**
```markdown
!`ls .opencode/context/`
!`find .opencode/context -name "*.md"`
```

---

## Validation

### Pre-Commit Validation

The repository includes a validation script:

```bash
./scripts/validation/validate-context-refs.sh
```

This checks all markdown files for:
- ✅ Correct `@.opencode/context/` format
- ❌ Forbidden dynamic variables (`@$VAR/`)
- ❌ Non-standard references

### Manual Validation

Check a file manually:

```bash
# Should only find @.opencode/context/ references
grep -E '@[^~$]' file.md | grep -v '@.opencode/context/'

# Should return nothing (empty result = good)
```

---

## Examples

### Example 1: Agent File

**File:** `.opencode/agent/openagent.md`

```markdown
# OpenAgent

<context>
Load essential patterns from @.opencode/context/core/essential-patterns.md
Load project context from @.opencode/context/project/project-context.md
</context>

## Workflow
1. Analyze request
2. Check patterns in @.opencode/context/core/essential-patterns.md
3. Execute task
```

**After global install to ~/.config/opencode:**
```markdown
# OpenAgent

<context>
Load essential patterns from @/Users/username/.config/opencode/context/core/essential-patterns.md
Load project context from @/Users/username/.config/opencode/context/project/project-context.md
</context>

## Workflow
1. Analyze request
2. Check patterns in @/Users/username/.config/opencode/context/core/essential-patterns.md
3. Execute task
```

---

### Example 2: Command File

**File:** `.opencode/command/commit.md`

```markdown
# Commit Command

Reference patterns from @.opencode/context/core/essential-patterns.md

Check .opencode/context/project/project-context.md for commit conventions.
```

**After global install to /usr/local/opencode:**
```markdown
# Commit Command

Reference patterns from @/usr/local/opencode/context/core/essential-patterns.md

Check /usr/local/opencode/context/project/project-context.md for commit conventions.
```

---

## Summary

### The Rule

**All context references MUST use:**
```markdown
@.opencode/context/path/to/file.md
```

### Why

- ✅ Works for local installations
- ✅ Works for global installations
- ✅ Works for custom installation paths
- ✅ Automatically transformed during installation
- ✅ Tested and validated
- ✅ Consistent across all files

### Enforcement

- Pre-commit validation script
- Installation system validation
- Code review guidelines
- This documentation

---

## Related Documentation

- [Installation Flow Analysis](../../INSTALLATION_FLOW_ANALYSIS.md)
- [Test Report](../../TEST_REPORT.md)
- [Final Review](../../FINAL_REVIEW.md)

---

**Last Updated:** 2024-11-19  
**Status:** Required Convention  
**Validation:** Automated via `scripts/validation/validate-context-refs.sh`
