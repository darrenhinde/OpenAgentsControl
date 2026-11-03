<!-- Context: openagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Code Formatting Hook

**Purpose**: Auto-format files after Claude edits them

---

## TypeScript/Prettier Hook

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.file_path' | { read file_path; if echo \"$file_path\" | grep -q '\\.ts$'; then npx prettier --write \"$file_path\"; fi; }"
      }]
    }]
  }
}
```

---

## How It Works

1. Triggers after Edit or Write tool completes
2. Extracts file path from JSON input via jq
3. Checks if file is `.ts` extension
4. Runs prettier on matching files

---

## Variations

**Go files**:
```bash
if echo "$file_path" | grep -q '\\.go$'; then gofmt -w "$file_path"; fi
```

**Python files**:
```bash
if echo "$file_path" | grep -q '\\.py$'; then black "$file_path"; fi
```

**Multiple extensions**:
```bash
if echo "$file_path" | grep -qE '\\.(ts|tsx|js|jsx)$'; then npx prettier --write "$file_path"; fi
```

---

## Related

- `../../lookup/hook-events.md` - Hook events reference
- `./protection-hook.md` - File protection example

**Reference**: https://docs.anthropic.com/en/docs/claude-code/hooks
