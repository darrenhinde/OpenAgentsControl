---
name: oac-cleanup
description: Clean up old temporary files from .tmp directory
argument-hint: "[--force] [--days=N]"
---

# Clean Up Temporary Files

Remove old temporary files from the `.tmp` directory to free up disk space.

## What Gets Cleaned

The cleanup script checks three directories:

1. **`.tmp/sessions/`** - Session context files older than 7 days
2. **`.tmp/tasks/`** - Completed task files older than 30 days
3. **`.tmp/external-context/`** - Cached external documentation older than 7 days

## Usage

### Interactive Cleanup (Recommended)

```bash
!`bash ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-tmp.sh`
```

This will:
1. Scan for old temporary files
2. Show you what will be deleted with sizes
3. Ask for confirmation before deleting

### Force Cleanup (Skip Confirmation)

```bash
!`bash ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-tmp.sh --force`
```

**⚠️ Warning**: This deletes files immediately without confirmation.

### Custom Age Thresholds

```bash
# Clean sessions older than 14 days
!`bash ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-tmp.sh --session-days=14`

# Clean tasks older than 60 days
!`bash ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-tmp.sh --task-days=60`

# Clean external context older than 3 days
!`bash ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-tmp.sh --external-days=3`

# Combine options
!`bash ${CLAUDE_PLUGIN_ROOT}/scripts/cleanup-tmp.sh --session-days=14 --task-days=60 --force`
```

## What Gets Preserved

The script is smart about what it deletes:

- **Active sessions** - Never deleted (even if old)
- **In-progress tasks** - Only completed tasks are eligible for cleanup
- **Recent files** - Files newer than the threshold are kept

## Configuration

You can customize default cleanup thresholds in your `.oac` config file:

```yaml
cleanup:
  auto_prompt: true      # Prompt for cleanup on session start
  session_days: 7        # Days before suggesting session cleanup
  task_days: 30          # Days before suggesting task cleanup
  external_days: 7       # Days before suggesting external context cleanup
```

See `/install-context` for more about configuration.

## Output

The script outputs JSON with cleanup results:

```json
{
  "status": "success",
  "deleted": {
    "sessions": 3,
    "tasks": 5,
    "external": 2
  },
  "freed_space": "2.4 MB",
  "summary": "Cleaned up 10 old temporary files, freed 2.4 MB"
}
```

## When to Run Cleanup

Run cleanup when:
- You see a warning on session start about old .tmp files
- Your `.tmp` directory is getting large
- You've finished a major feature and want to clean up
- Before committing to version control (keep .tmp clean)

## Troubleshooting

**"No old files found"**
- All your temporary files are recent
- Nothing to clean up

**"Permission denied"**
- Check file permissions on .tmp directory
- Make sure cleanup-tmp.sh is executable

**"Cannot delete active session"**
- The script detected an active session
- Close the session first, then run cleanup

## Related Commands

- `/oac:status` - Check current .tmp directory status
- `/install-context` - Configure cleanup settings
- `/oac:help` - General help

---

**Tip**: Run cleanup regularly to keep your workspace clean and avoid accumulating old temporary files.
