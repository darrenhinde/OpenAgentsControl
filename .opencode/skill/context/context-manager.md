---
id: context-manager
name: Context Manager
description: "Comprehensive context management with 8 operations: discover, fetch, harvest, extract, compress, organize, cleanup, and process. Integrates with ContextScout and ExternalScout with lazy loading and clear guidance."
category: development
type: skill
version: 1.0.0
author: opencode
tags:
  - context-management
  - discovery
  - organization
  - cleanup
  - external-docs
  - lazy-loading

dependencies:
  - subagent:contextscout
  - subagent:externalscout
  - context:core/context-system
  - context:core/workflows/external-context-integration
---

# Context Manager Skill

> **Purpose**: Comprehensive context management operations with clear guidance, lazy loading, and safe operations for discovering, organizing, and maintaining project context.

---

## What I Do

I provide 8 powerful operations for managing context:

1. **DISCOVER** - Find context files by topic or path
2. **FETCH** - Get external documentation from libraries
3. **HARVEST** - Extract context from summary files
4. **EXTRACT** - Pull specific information from context
5. **COMPRESS** - Reduce large file sizes
6. **ORGANIZE** - Restructure context by concern
7. **CLEANUP** - Remove stale or temporary files
8. **PROCESS** - Guided workflow for context operations

---

## Quick Start

### 1. Discover Context
```bash
bash .opencode/skill/context/router.sh discover authentication
```
Finds all context files related to authentication patterns.

### 2. Fetch External Documentation
```bash
bash .opencode/skill/context/router.sh fetch "Drizzle ORM" "modular schemas"
```
Retrieves live documentation from external libraries.

### 3. Harvest Context
```bash
bash .opencode/skill/context/router.sh harvest ANALYSIS.md
```
Extracts key concepts from summary files into permanent context.

### 4. Extract Information
```bash
bash .opencode/skill/context/router.sh extract code-quality.md "naming conventions"
```
Pulls specific information from context files.

### 5. Compress Files
```bash
bash .opencode/skill/context/router.sh compress .opencode/context/ 100KB
```
Reduces large context files to save space.

### 6. Organize Context
```bash
bash .opencode/skill/context/router.sh organize .opencode/context/
```
Restructures context by concern for better organization.

### 7. Cleanup Stale Files
```bash
bash .opencode/skill/context/router.sh cleanup .tmp/ 7
```
Removes temporary or old files (older than 7 days).

### 8. Guided Workflow
```bash
bash .opencode/skill/context/router.sh process "organize authentication context" .opencode/context/
```
Step-by-step guidance for complex context operations.

---

## Operations Reference

### Operation 1: DISCOVER

**Purpose**: Find context files using intelligent discovery or direct search

**When to Use**:
- Need to find all context files in repository
- Looking for specific context by topic
- Mapping context structure
- Understanding what context exists

**Command**:
```bash
bash .opencode/skill/context/router.sh discover [topic]
```

**Examples**:
```bash
# Find all authentication context
bash .opencode/skill/context/router.sh discover authentication

# Find all API design context
bash .opencode/skill/context/router.sh discover "api design"

# Find all context in a directory
bash .opencode/skill/context/router.sh discover .opencode/context/development/
```

**Output**: List of matching context files with paths and descriptions

---

### Operation 2: FETCH

**Purpose**: Get current external documentation from libraries

**When to Use**:
- Need latest documentation for external library
- Building with new framework or tool
- Checking for API changes
- Verifying installation steps

**Command**:
```bash
bash .opencode/skill/context/router.sh fetch "[Library]" "[topic]"
```

**Examples**:
```bash
# Get Drizzle ORM documentation
bash .opencode/skill/context/router.sh fetch "Drizzle ORM" "modular schemas"

# Get Next.js documentation
bash .opencode/skill/context/router.sh fetch "Next.js" "app router setup"

# Get React documentation
bash .opencode/skill/context/router.sh fetch "React" "hooks best practices"
```

**Output**: Current documentation saved to `.opencode/context/external/[library]/`

---

### Operation 3: HARVEST

**Purpose**: Extract context from summary or analysis files

**When to Use**:
- Have analysis or summary file with key insights
- Need to convert temporary notes to permanent context
- Extracting patterns from project analysis
- Converting research into reusable context

**Command**:
```bash
bash .opencode/skill/context/router.sh harvest [file]
```

**Examples**:
```bash
# Extract from analysis file
bash .opencode/skill/context/router.sh harvest ANALYSIS.md

# Extract from research notes
bash .opencode/skill/context/router.sh harvest research/patterns.md

# Extract from project summary
bash .opencode/skill/context/router.sh harvest PROJECT_SUMMARY.md
```

**Output**: Extracted context organized into `.opencode/context/` structure

---

### Operation 4: EXTRACT

**Purpose**: Pull specific information from context files

**When to Use**:
- Need specific information from large context file
- Extracting code examples
- Getting specific patterns or guidelines
- Creating focused context bundles

**Command**:
```bash
bash .opencode/skill/context/router.sh extract [file] "[topic]"
```

**Examples**:
```bash
# Extract naming conventions
bash .opencode/skill/context/router.sh extract code-quality.md "naming conventions"

# Extract error handling patterns
bash .opencode/skill/context/router.sh extract code-quality.md "error handling"

# Extract security patterns
bash .opencode/skill/context/router.sh extract security-patterns.md "authentication"
```

**Output**: Extracted information in markdown format

---

### Operation 5: COMPRESS

**Purpose**: Reduce large context files to save space

**When to Use**:
- Context files are too large
- Need to optimize storage
- Preparing context for distribution
- Reducing token usage

**Command**:
```bash
bash .opencode/skill/context/router.sh compress [path] [size-limit]
```

**Examples**:
```bash
# Compress all context to 100KB files
bash .opencode/skill/context/router.sh compress .opencode/context/ 100KB

# Compress specific directory
bash .opencode/skill/context/router.sh compress .opencode/context/development/ 50KB

# Compress external context
bash .opencode/skill/context/router.sh compress .opencode/context/external/ 200KB
```

**Output**: Compressed context files with index for navigation

---

### Operation 6: ORGANIZE

**Purpose**: Restructure context by concern for better organization

**When to Use**:
- Context structure is messy or inconsistent
- Need to reorganize by topic or concern
- Improving context discoverability
- Consolidating related context

**Command**:
```bash
bash .opencode/skill/context/router.sh organize [path]
```

**Examples**:
```bash
# Organize all context
bash .opencode/skill/context/router.sh organize .opencode/context/

# Organize development context
bash .opencode/skill/context/router.sh organize .opencode/context/development/

# Organize external context
bash .opencode/skill/context/router.sh organize .opencode/context/external/
```

**Output**: Reorganized context with improved structure and navigation

---

### Operation 7: CLEANUP

**Purpose**: Remove stale or temporary files

**When to Use**:
- Cleaning up temporary context
- Removing old backups
- Deleting outdated external docs
- Freeing up space

**Command**:
```bash
bash .opencode/skill/context/router.sh cleanup [path] [days]
```

**Examples**:
```bash
# Remove files older than 7 days
bash .opencode/skill/context/router.sh cleanup .tmp/ 7

# Remove files older than 30 days
bash .opencode/skill/context/router.sh cleanup .opencode/context/external/ 30

# Remove backup files
bash .opencode/skill/context/router.sh cleanup .opencode/context/ 0 --pattern "*-backup*"
```

**Output**: List of removed files and freed space

---

### Operation 8: PROCESS

**Purpose**: Guided workflow for complex context operations

**When to Use**:
- Need step-by-step guidance
- Complex context operation
- First time doing an operation
- Want to understand the process

**Command**:
```bash
bash .opencode/skill/context/router.sh process "[description]" [path]
```

**Examples**:
```bash
# Guided workflow for organizing authentication context
bash .opencode/skill/context/router.sh process "organize authentication context" .opencode/context/

# Guided workflow for external library integration
bash .opencode/skill/context/router.sh process "integrate Drizzle ORM context" .opencode/context/

# Guided workflow for context cleanup
bash .opencode/skill/context/router.sh process "cleanup old external docs" .opencode/context/external/
```

**Output**: Step-by-step guidance with confirmations at each step

---

## Integration with Agents

### ContextScout Integration
- **Use ContextScout** for discovering internal project context
- **Use Context Manager** to organize and maintain discovered context
- **Workflow**: ContextScout discovers → Context Manager organizes

### ExternalScout Integration
- **Use ExternalScout** for fetching external library documentation
- **Use Context Manager** to organize and maintain external docs
- **Workflow**: ExternalScout fetches → Context Manager organizes

### Combined Workflow
```bash
# 1. Discover internal context
bash .opencode/skill/context/router.sh discover authentication

# 2. Fetch external library docs
bash .opencode/skill/context/router.sh fetch "Passport.js" "authentication strategies"

# 3. Organize both together
bash .opencode/skill/context/router.sh organize .opencode/context/

# 4. Extract specific patterns
bash .opencode/skill/context/router.sh extract code-quality.md "authentication patterns"
```

---

## Best Practices

### 1. Regular Discovery
- Run discovery regularly to find new context
- Keep context inventory up to date
- Document new context as it's created

### 2. External Documentation
- Fetch external docs when starting new features
- Keep external docs organized by library
- Update external docs when upgrading libraries

### 3. Context Organization
- Organize context by concern (not by file type)
- Use clear naming conventions
- Maintain consistent structure

### 4. Cleanup Schedule
- Run cleanup monthly to remove stale files
- Archive important context before cleanup
- Document what was removed

### 5. Lazy Loading
- Load context only when needed
- Use EXTRACT for specific information
- Compress large context files

---

## Troubleshooting

### Context Not Found
```bash
# Run discovery to find context
bash .opencode/skill/context/router.sh discover [topic]

# Check context structure
ls -la .opencode/context/
```

### External Docs Not Fetching
```bash
# Check internet connection
ping google.com

# Verify library name
bash .opencode/skill/context/router.sh fetch "[Library]" "help"
```

### Organization Issues
```bash
# Run organize with verbose output
bash .opencode/skill/context/router.sh organize .opencode/context/ --verbose

# Check for duplicate files
find .opencode/context/ -type f -name "*.md" | sort | uniq -d
```

### Cleanup Mistakes
```bash
# Check git history for deleted files
git log --diff-filter=D --summary | grep delete

# Restore from git
git checkout HEAD -- [file]
```

---

## Advanced Usage

### Custom Context Bundles
```bash
# Create focused context bundle
bash .opencode/skill/context/router.sh extract code-quality.md "naming conventions"
bash .opencode/skill/context/router.sh extract security-patterns.md "authentication"
# Combine into bundle for specific task
```

### Automated Context Updates
```bash
# Schedule regular discovery
crontab -e
# Add: 0 0 * * 0 bash .opencode/skill/context/router.sh discover all

# Schedule external doc updates
# Add: 0 0 * * 1 bash .opencode/skill/context/router.sh fetch "Next.js" "latest"
```

### Context Analytics
```bash
# Count context files
find .opencode/context/ -name "*.md" | wc -l

# Find largest context files
find .opencode/context/ -name "*.md" -exec wc -l {} + | sort -rn | head -10

# List all topics
find .opencode/context/ -name "*.md" | xargs grep "^#" | cut -d: -f2 | sort | uniq
```

---

## See Also

- [ContextScout](../core/contextscout.md) - Discover internal context
- [ExternalScout](../core/externalscout.md) - Fetch external documentation
- [Context System Guide](../../context/core/context-system.md) - Complete context system
- [Task Management](./task-management/SKILL.md) - Task management operations
