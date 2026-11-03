<!-- Context: core/harvest | Priority: medium | Version: 1.0 | Updated: 2026-02-15 -->

# Context Harvest Operation

**Purpose**: Extract knowledge from AI summaries → permanent context, then clean workspace

**Last Updated**: 2026-01-06

---

## Core Problem

AI agents create summary files (OVERVIEW.md, SESSION-*.md, SUMMARY.md) that contain valuable knowledge but clutter the workspace. These files "plague" the codebase.

**Solution**: Harvest the knowledge → permanent context, then delete the summaries.

---

## Auto-Detection Patterns

<rule id="summary_patterns" enforcement="strict">
  Harvest automatically detects these patterns:
  
  Filename patterns:
  - *OVERVIEW.md
  - *SUMMARY.md
  - SESSION-*.md
  - CONTEXT-*.md
  - *NOTES.md
  
  Location patterns:
  - Files in .tmp/ directory
  - Files with "Summary", "Overview", "Session" in title
  - Files >2KB in root directory (likely summaries)
</rule>

---

## 6-Stage Workflow

<workflow id="harvest" enforce="@critical_rules">
  
### Stage 1: Scan
**Action**: Find all summary files in workspace

**Process**:
1. Search for auto-detection patterns
2. Check .tmp/ directory
3. List files with sizes
4. Sort by modification date (newest first)

**Output**: List of candidate files

**Example**:
```
Found 3 summary documents:
1. CONTEXT-SYSTEM-OVERVIEW.md (4.2 KB, modified 1 hour ago)
2. SESSION-auth-work.md (1.8 KB, modified today)
3. .tmp/IMPLEMENTATION-NOTES.md (800 bytes, modified today)
```

---

### Stage 2: Analyze
**Action**: Categorize content by function

**Mapping Rules**:
| Content Type | Target Folder | How to Identify |
|--------------|---------------|-----------------|
| Design decisions | `concepts/` | "We decided to...", "Architecture", "Pattern" |
| Solutions/patterns | `examples/` | Code snippets, "Here's how we..." |
| Workflows | `guides/` | Numbered steps, "How to...", "Setup" |
| Errors encountered | `errors/` | Error messages, "Fixed issue", "Gotcha" |
| Reference data | `lookup/` | Tables, lists, paths, commands |

**Process**:
1. Read each file
2. Identify valuable sections (skip planning/conversation)
3. Categorize by function
4. Determine target file path
5. Generate preview (first 60 chars)

**Output**: Categorized items with letter IDs

---

### Stage 3: Approve (CRITICAL)
**Action**: Present approval UI with letter-based selection

<rule id="approval_gate" enforcement="strict">
  ALWAYS show approval UI before extracting/deleting.
  NEVER auto-harvest without user confirmation.
</rule>

**Format**:
```
### CONTEXT-SYSTEM-OVERVIEW.md (4.2 KB)

✓ [A] Design: Function-based context organization
    → Would add to: core/concepts/context-organization.md
    Preview: "Organize by function (concepts/, examples/...)..."

✓ [B] Pattern: Minimal Viable Information
    → Would add to: core/concepts/mvi-principle.md
    Preview: "Extract core only (1-3 sentences), 3-5 key points..."

✓ [C] Workflow: Harvesting summary documents
    → Would create: core/guides/harvesting.md
    Preview: "Scan for summaries → Extract → Approve → Delete"

✗ [D] Skip: Planning discussion notes (temporary knowledge)

---

### SESSION-auth-work.md (1.8 KB)

✓ [E] Error: JWT token expiration not handled
    → Would add to: development/errors/auth-errors.md
    Preview: "Symptom: 401 after 1 hour. Cause: No refresh flow..."

✓ [F] Example: JWT refresh token implementation
    → Would create: development/examples/jwt-refresh.md
    Preview: "Store refresh token → Check expiry → Request new..."

---

### .tmp/IMPLEMENTATION-NOTES.md (800 bytes)

✗ [G] Skip: Duplicate info (already in development/concepts/api-design.md)

---

**Quick options**:
- Type 'A B C E F' - Approve specific items
- Type 'all' - Approve all ✓ items (A B C E F)
- Type 'none' - Skip harvesting, delete files anyway
- Type 'cancel' - Keep files, don't harvest
```

**Validation**:
- MUST wait for user input
- MUST not proceed without approval
- If user types 'cancel', stop immediately

**Output**: List of approved items

---

### Stage 4: Extract
**Action**: Extract and minimize approved items

<rule id="extraction" enforce="@mvi_principle">
  Apply MVI to all extracted content:
  - Core concept: 1-3 sentences
  - Key points: 3-5 bullets
  - Minimal example: <10 lines
  - Reference link: to original source
  - Files: <200 lines each
</rule>

**Process**:
1. For each approved item:
   - Extract core content
   - Apply MVI minimization (see compact.md)
   - Generate preview of final content
2. Show extraction preview (APPROVAL REQUIRED):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Extraction Preview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] → core/concepts/context-organization.md (CREATE, 45 lines)
┌─────────────────────────────────────────────────────────┐
│ # Concept: Context Organization                         │
│                                                         │
│ **Purpose**: Function-based knowledge organization      │
│                                                         │
│ ## Core Concept                                         │
│ Organize context by function: concepts/, examples/...   │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘

[E] → development/errors/auth-errors.md (ADD to existing, 98 → 112 lines)
┌─────────────────────────────────────────────────────────┐
│ + ## Error: JWT Token Expiration Not Handled             │
│ +                                                       │
│ + **Symptom**: 401 after 1 hour                         │
│ + **Cause**: No refresh token flow                      │
│ + ...                                                   │
└─────────────────────────────────────────────────────────┘

... ({remaining_count} more items)

Show all? [y/n] | Approve extraction? [y/n/edit]: _
```

3. On approval:
   - Write files to disk
   - Add cross-references
   - Update navigation.md maps

**Output**: List of created/updated files

---

### Stage 5: Cleanup (APPROVAL REQUIRED)
**Action**: Archive or delete source summary files

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cleanup: Source Files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Successfully harvested from:
  CONTEXT-SYSTEM-OVERVIEW.md (4.2 KB)
  SESSION-auth-work.md (1.8 KB)

Skipped (no valuable content):
  .tmp/IMPLEMENTATION-NOTES.md (800 bytes)

How should we handle these source files?

  1. Archive (safe) — move to .tmp/archive/harvested/{date}/
     → Can restore later if needed

  2. Delete — permanently remove harvested files
     → Frees disk space, no undo

  3. Keep — leave source files in place
     → No cleanup, files remain where they are

Choose [1/2/3] (default: 1): _
```

<rule id="cleanup_safety" enforcement="strict">
  ONLY cleanup files that had content successfully harvested.
  If extraction failed, keep the original file.
</rule>

**Output**: Cleanup report

---

### Stage 6: Report
**Action**: Show comprehensive results summary

**Format**:
```
✅ Harvested 5 items into permanent context:
   - Added to core/concepts/context-organization.md
   - Added to core/concepts/mvi-principle.md
   - Created core/guides/harvesting.md
   - Added to development/errors/auth-errors.md
   - Created development/examples/jwt-refresh.md

🗑️ Cleaned up workspace:
   - Archived: CONTEXT-SYSTEM-OVERVIEW.md → .tmp/archive/harvested/2026-01-06/
   - Archived: SESSION-auth-work.md → .tmp/archive/harvested/2026-01-06/
   - Deleted: .tmp/IMPLEMENTATION-NOTES.md (no valuable content)

📊 Updated navigation maps:
   - .opencode/context/core/navigation.md
   - .opencode/context/development/navigation.md

💾 Disk space freed: 6.8 KB
```

</workflow>

---

## Usage Examples

### Scan entire workspace
```bash
/context harvest
```

### Scan specific directory
```bash
/context harvest .tmp/
/context harvest docs/sessions/
```

### Harvest specific file
```bash
/context harvest OVERVIEW.md
/context harvest SESSION-2026-01-06.md
```

---

## Smart Content Detection

### ✅ Extract (Valuable Knowledge)
- Design decisions ("We chose X because...")
- Patterns that worked ("This pattern solved...")
- Errors encountered + solutions
- API changes ("Updated from v1 to v2...")
- Performance findings ("Optimization reduced...")
- Core concepts explained

### ❌ Skip (Temporary/Noise)
- Planning discussion ("Should we...?", "Maybe try...")
- Conversational notes ("I think...", "We talked about...")
- Duplicate info (already in context)
- TODO lists (move to task system instead)
- Timestamps and session metadata

---

## Safety Features

1. **Approval gate** - Never auto-delete without confirmation
2. **Archive by default** - Move to .tmp/archive/, not permanent delete
3. **Validation** - Check file sizes, structure before committing
4. **Rollback** - Can restore from archive if needed
5. **Dry run** - Show what would happen before doing it

---

## Success Criteria

After harvest operation:

- [ ] Valuable knowledge extracted to permanent context?
- [ ] All extracted files <200 lines?
- [ ] Files in correct function folders?
- [ ] navigation.md navigation updated?
- [ ] Summary files archived/deleted?
- [ ] Workspace cleaner than before?
- [ ] No knowledge lost?

---

## Related

- compact.md - How to minimize extracted content
- mvi-principle.md - What to extract
- structure.md - Where files go
- creation.md - File creation rules
