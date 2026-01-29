---
name: context-manager
description: Context management skill providing discovery, fetching, harvesting, extraction, compression, organization, cleanup, and guided workflows for project context
version: 1.0.0
author: opencode
type: skill
category: development
tags:
  - context
  - management
  - discovery
  - organization
  - external-docs
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

**Syntax**:
```
discover [target]
```

**Examples**:
```bash
# Discover by topic
./router.sh discover "authentication patterns"

# Discover all context
./router.sh discover "all context files"

# Discover in specific directory
./router.sh discover ".opencode/context/core/"
```

**Output**:
- List of discovered files with paths and sizes
- File statistics (count, total size, last updated)
- Categorization by type
- Suggestions for next steps

---

### Operation 2: FETCH

**Purpose**: Fetch external documentation using ExternalScout

**When to Use**:
- Need live documentation from external libraries
- Setting up new external library integration
- Need version-specific documentation
- Want to cache external docs for team

**Syntax**:
```
fetch [libraries] [topics]
```

**Examples**:
```bash
# Fetch single library
./router.sh fetch "Drizzle ORM" "modular schemas"

# Fetch multiple libraries
./router.sh fetch "Drizzle ORM" "Better Auth" "Next.js" "modular schemas" "integration" "app router"

# Fetch with specific query
./router.sh fetch "Better Auth" "Next.js App Router integration with Drizzle adapter"
```

**Output**:
- Fetched files with paths
- File sizes and statistics
- Source URLs
- How to reference in context
- Manifest updates

---

### Operation 3: HARVEST

**Purpose**: Extract context from summary files and create permanent context

**When to Use**:
- Have summary documents that should become context
- Need to convert temporary notes to permanent context
- Want to extract key concepts from larger documents
- Need to organize scattered information

**Syntax**:
```
harvest [source-file]
```

**Examples**:
```bash
# Harvest from analysis
./router.sh harvest DEVELOPER_PROFILE_ANALYSIS.md

# Harvest from brainstorm
./router.sh harvest AGENT_NAMING_BRAINSTORM.md

# Harvest from UX analysis
./router.sh harvest UX_ANALYSIS_THREE_MAIN_AGENTS.md
```

**Output**:
- Created context file path
- Space saved (original vs. harvested)
- Content structure
- Updated navigation files
- How to use the new context

---

### Operation 4: EXTRACT

**Purpose**: Extract specific information from context files

**When to Use**:
- Need specific information from context
- Creating summaries or reports
- Building context bundles for subagents
- Validating context completeness

**Syntax**:
```
extract [file] [what-to-extract]
```

**Examples**:
```bash
# Extract naming conventions
./router.sh extract code-quality.md "naming conventions"

# Extract test patterns
./router.sh extract test-coverage.md "test patterns"

# Extract all standards
./router.sh extract ".opencode/context/core/" "all standards"
```

**Output**:
- Extracted information organized by topic
- Source file citations
- Relevance scores
- Usage suggestions
- Next steps

---

### Operation 5: COMPRESS

**Purpose**: Compress large context files to save space

**When to Use**:
- Context files are very large (>100 KB)
- Need to reduce disk space usage
- Archiving old context
- Preparing context for distribution

**Syntax**:
```
compress [target] [size-threshold]
```

**Examples**:
```bash
# Compress large files
./router.sh compress ".opencode/context/" "100 KB"

# Compress all context
./router.sh compress ".opencode/context/"

# Compress and archive
./router.sh compress ".opencode/context/development/" "50 KB"
```

**Output**:
- Compressed files with paths
- Space savings (before/after)
- Compression ratio
- Decompression instructions
- Manifest updates

---

### Operation 6: ORGANIZE

**Purpose**: Reorganize context files by concern (what you're doing) rather than function

**When to Use**:
- Context is scattered across multiple locations
- Need to reorganize by concern/topic
- Creating new context structure
- Consolidating related context

**Syntax**:
```
organize [target]
```

**Examples**:
```bash
# Organize by concern
./router.sh organize ".opencode/context/"

# Organize specific topic
./router.sh organize ".opencode/context/development/"
```

**Output**:
- Current structure analysis
- Proposed new structure
- Files moved and reorganized
- Updated references
- Navigation updates
- New structure overview

---

### Operation 7: CLEANUP

**Purpose**: Clean up stale, temporary, or unused context files

**When to Use**:
- Removing temporary files (.tmp/)
- Deleting old external context (>7 days)
- Removing duplicate context
- Archiving unused context

**Syntax**:
```
cleanup [target] [older-than-days]
```

**Examples**:
```bash
# Cleanup .tmp directory
./router.sh cleanup ".tmp/"

# Cleanup old external context
./router.sh cleanup ".tmp/external-context/" "7"

# Cleanup stale sessions
./router.sh cleanup ".tmp/sessions/" "3"
```

**Output**:
- Files to be deleted
- Space to be freed
- Impact analysis
- Recovery instructions
- Manifest updates

---

### Operation 8: PROCESS

**Purpose**: Provide guided workflow for processing context

**When to Use**:
- Need step-by-step guidance on context operations
- Processing multiple context files
- Learning context management workflow
- Automating context processing

**Syntax**:
```
process [goal] [scope]
```

**Examples**:
```bash
# Process authentication context
./router.sh process "organize authentication context" ".opencode/context/development/"

# Process all development context
./router.sh process "organize all development context" ".opencode/context/development/"

# Process external context
./router.sh process "fetch, persist, and reference external context" ".tmp/external-context/"
```

**Output**:
- Step-by-step workflow
- Progress indicators
- Discovered context
- Processing plan
- Execution results
- Validation results
- Summary and next steps

---

## Common Workflows

### Workflow 1: Discover & Extract
```
1. discover context for: "authentication"
   → Find all auth-related context

2. extract from: "security-patterns.md" what: "auth patterns"
   → Get specific patterns

3. Show results
   → Ready to use in session
```

### Workflow 2: Fetch & Reference
```
1. fetch external docs for: "Drizzle ORM"
   → Get live documentation

2. Show file paths
   → .tmp/external-context/drizzle-orm/...

3. Reference in session context
   → Add to "## External Context Fetched"

4. Pass to subagents
   → Include in subtask JSONs
```

### Workflow 3: Harvest & Organize
```
1. harvest context from: "ANALYSIS.md"
   → Extract key concepts

2. organize context by: "concern"
   → Restructure for clarity

3. Update documentation
   → Show new structure

4. Delete original summary
   → Clean up temporary files
```

### Workflow 4: Cleanup & Maintain
```
1. cleanup .tmp/ directory
   → Remove temporary files

2. cleanup external context older than: "7 days"
   → Remove stale external docs

3. Show space freed
   → Provide statistics

4. Update manifest
   → Keep tracking accurate
```

---

## Key Principles

### 1. Lazy Loading
- Discover files first (glob, grep)
- Load only what's needed (read specific files)
- Process incrementally (don't load entire repo)
- Reference context files, don't duplicate

### 2. Clear Guidance
- Explain what you're doing at each step
- Show file paths and sizes
- Provide before/after metrics
- Suggest next steps
- Ask for confirmation before destructive operations

### 3. Context Reference
- When discovering: cite which files found
- When processing: reference standards applied
- When organizing: show which patterns used
- When cleaning: explain what's being removed

### 4. Safe Operations
- Ask for confirmation before destructive ops
- Create backups when needed
- Verify integrity after operations
- Provide recovery instructions

---

## File Structure

```
.opencode/skill/context/
├── SKILL.md                          # This file
├── router.sh                         # CLI router (entry point)
├── CONTEXT_SKILL_QUICK_START.md      # Quick start guide
├── context-manager.md                # Detailed operation guide
└── navigation.md                     # Navigation index
```

---

## Integration Points

### With ContextScout
- ContextScout discovers context files
- This skill helps organize what ContextScout finds
- Can harvest context from ContextScout results

### With ExternalScout
- ExternalScout fetches external documentation
- This skill persists and organizes fetched docs
- Can reference external context in operations

### With TaskManager
- TaskManager references context in task definitions
- This skill ensures context files exist and are valid
- Can catalog which tasks use which context

### With Other Subagents
- All subagents depend on context structure
- This skill maintains and validates context
- Can identify context gaps that subagents need

---

## Success Criteria

You succeed when:
✅ Context files are discovered efficiently
✅ External documentation is fetched and persisted
✅ Context is harvested from summaries
✅ Key information is extracted clearly
✅ Large files are compressed safely
✅ Context is organized by concern
✅ Stale files are cleaned up safely
✅ User has clear guidance at each step
✅ All operations are reversible
✅ Documentation is updated

---

## Tips & Best Practices

### 1. Regular Discovery
Run discover operations regularly to understand your context structure and identify gaps.

### 2. Organize by Concern
Organize context by what you're doing (authentication, testing, etc.) not by function (standards, guides).

### 3. Lazy Load External Docs
Fetch external documentation only when needed, not preemptively.

### 4. Harvest Summaries
Convert temporary analysis documents into permanent context using harvest.

### 5. Regular Cleanup
Schedule regular cleanup operations to remove stale temporary files.

### 6. Validate After Changes
Always validate context integrity after making changes.

### 7. Document Organization
Keep navigation.md files up-to-date as you organize context.

### 8. Reference Standards
When extracting context, always cite the source files.

---

## Troubleshooting

### "Context files not found"
Run `discover all context files` to see what exists and where.

### "External docs failed to fetch"
Check that the library name is correct and ExternalScout is available.

### "Harvest created empty file"
The source file may not have enough high-signal content. Review and add manually.

### "Organization failed"
Check that all referenced files exist and navigation.md is valid.

### "Cleanup removed too much"
Check the backup at `.backup/cleanup-{date}.tar.gz` for recovery.

---

**Context Manager Skill** - Discover, organize, and maintain your project context!
