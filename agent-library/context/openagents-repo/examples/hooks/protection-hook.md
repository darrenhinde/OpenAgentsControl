<!-- Context: openagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# File Protection Hook

**Purpose**: Block edits to sensitive files

---

## Configuration

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "python3 -c \"import json, sys; data=json.load(sys.stdin); path=data.get('tool_input',{}).get('file_path',''); sys.exit(2 if any(p in path for p in ['.env', 'package-lock.json', '.git/']) else 0)\""
      }]
    }]
  }
}
```

---

## How It Works

1. Triggers BEFORE Edit or Write tool executes
2. Reads file path from JSON input
3. Checks against protected patterns
4. Exit code 2 blocks the operation
5. Claude receives feedback about blocked file

---

## Protected Patterns

Default patterns to block:
- `.env` - Environment secrets
- `package-lock.json` - Dependency locks
- `.git/` - Git internals
- `credentials.json` - API keys
- `*.pem`, `*.key` - Private keys

---

## Custom Protection Script

```python
#!/usr/bin/env python3
import json, sys

PROTECTED = ['.env', 'package-lock.json', '.git/', 
             'credentials', '.pem', '.key', 'secrets']

data = json.load(sys.stdin)
path = data.get('tool_input', {}).get('file_path', '')

if any(p in path for p in PROTECTED):
    print(f"Blocked: {path} is protected", file=sys.stderr)
    sys.exit(2)

sys.exit(0)
```

---

## Related

- `../../lookup/hook-events.md` - Hook events reference
- `./formatting-hook.md` - Auto-format example

**Reference**: https://docs.anthropic.com/en/docs/claude-code/hooks
