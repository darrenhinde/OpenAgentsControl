<!-- Context: openagents-repo/concepts | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Hooks System

**Purpose**: User-defined shell commands that execute at Claude Code lifecycle points

---

## Core Concept

Hooks provide **deterministic control** over Claude Code's behavior. Unlike prompting (which suggests), hooks **guarantee** certain actions happen at specific points in the workflow.

---

## Key Points

- Hooks are shell commands triggered by events
- Run automatically during agent loop with your credentials
- Can block operations (exit code 2), allow silently, or provide feedback
- Configure in `settings.json` or plugin's `hooks/hooks.json`
- Matchers filter which tools/events trigger the hook

---

## Common Use Cases

| Use Case | Event | Example |
|----------|-------|---------|
| Auto-format | `PostToolUse` | Run prettier after Edit/Write |
| Notifications | `Notification` | Desktop alert when input needed |
| File protection | `PreToolUse` | Block edits to .env files |
| Logging | `PreToolUse` | Track all bash commands |
| Feedback | `PostToolUse` | Lint check after code changes |

---

## Quick Example

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.command' >> ~/.claude/bash-log.txt"
      }]
    }]
  }
}
```

---

## Security Warning

Hooks run with your credentials. Malicious hooks can exfiltrate data. Always review hook implementations before adding them.

---

## Related

- `../lookup/hook-events.md` - All hook events
- `../examples/hooks/` - Hook examples

**Reference**: https://docs.anthropic.com/en/docs/claude-code/hooks
