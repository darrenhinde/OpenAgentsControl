<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Hook Events Reference

**Purpose**: Quick reference for all Claude Code hook events

---

## Available Events

| Event | When It Fires | Can Block? |
|-------|---------------|------------|
| `PreToolUse` | Before tool calls | Yes (exit 2) |
| `PostToolUse` | After tool calls complete | No |
| `PermissionRequest` | Permission dialog shown | Yes (allow/deny) |
| `UserPromptSubmit` | User submits prompt | No |
| `Notification` | Claude sends notification | No |
| `Stop` | Claude finishes responding | No |
| `SubagentStop` | Subagent task completes | No |
| `PreCompact` | Before compact operation | No |
| `SessionStart` | New/resumed session | No |
| `SessionEnd` | Session ends | No |

---

## Matcher Syntax

- `"Bash"` - Match specific tool
- `"Edit|Write"` - Match multiple tools (OR)
- `"*"` - Match all tools
- `""` - Match all (for Notification)

---

## Exit Codes

| Code | Behavior |
|------|----------|
| 0 | Success, continue execution |
| 1 | Error logged, continue execution |
| 2 | **Block operation**, feed stderr to Claude |

---

## Input/Output

Hooks receive JSON via stdin:
```json
{
  "tool_name": "Bash",
  "tool_input": { "command": "ls -la" },
  "session_id": "...",
  "transcript_path": "..."
}
```

Output to stderr is fed back to Claude when blocking (exit 2).

---

## Related

- `../concepts/hooks-system.md` - Hooks overview
- `../examples/hooks/` - Hook examples

**Reference**: https://docs.anthropic.com/en/docs/claude-code/hooks
