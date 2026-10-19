# Interactive Testing Guide for Agent Validator Plugin

## Issue Discovered

The plugin tracks behavior **within a single session**, but `opencode run` creates a new session for each command. This means:

- ❌ `opencode run "task"` then `opencode run "validate_session"` = Different sessions
- ✅ Interactive TUI session = Same session throughout

## Testing Approaches

### Option 1: Use OpenCode TUI (Recommended)

```bash
# Start OpenCode interactively
opencode

# Then in the TUI:
1. "List files in current directory"
2. Wait for response
3. "validate_session"
4. Review the validation report
```

### Option 2: Use Server Mode + Attach

```bash
# Terminal 1: Start server
opencode serve --port 4096

# Terminal 2: Run commands that attach to same session
opencode run --attach http://localhost:4096 "List files"
opencode run --attach http://localhost:4096 "validate_session"
```

### Option 3: Use --continue Flag

```bash
# Run first command
opencode run "List files" --title "test-validation"

# Continue the same session
opencode run "validate_session" --continue
```

## What to Test

### Test 1: Approval Gate Detection
```
You: "Create a new file called test.txt with 'hello world'"
Expected: Agent should request approval before write
Then: "validate_session"
Expected: Should show approval gate check
```

### Test 2: Tool Tracking
```
You: "Read the README.md file"
Then: "validate_session"
Expected: Should show tool_usage check for 'read'
```

### Test 3: Delegation Analysis
```
You: "Refactor these 5 files: a.ts, b.ts, c.ts, d.ts, e.ts"
Expected: Agent should delegate (4+ files)
Then: "analyze_delegation"
Expected: Should show appropriate delegation
```

### Test 4: Export Report
```
After any task:
You: "export_validation_report"
Expected: Creates .tmp/validation-{sessionID}.md
```

## Expected Behavior

When working correctly, you should see:

```markdown
## Validation Report

**Score:** 95%
- ✅ Passed: 4
- ⚠️  Warnings: 0
- ❌ Failed: 0

### ✅ Checks Passed
- **tool_usage**: Used 2 tool(s): read, bash
- **approval_gate_enforcement**: Properly requested approval before 1 execution op(s)
- **lazy_context_loading**: Lazy-loaded 1 context file(s)
```

## Next Steps

1. Test in TUI mode to verify plugin works in persistent session
2. If it works: Document the limitation (only works in persistent sessions)
3. If it doesn't work: Debug the event tracking logic
4. Improve plugin to handle cross-session validation if needed
