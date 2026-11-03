<!-- Context: openagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# DB Query Validator Subagent

**Purpose**: Subagent with conditional tool validation via hooks

---

## Configuration

```yaml
---
name: db-reader
description: Execute read-only database queries. Use when analyzing data or generating reports.
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---

You are a database analyst with read-only access. Execute SELECT queries to answer questions about the data.

When asked to analyze data:
1. Identify which tables contain the relevant data
2. Write efficient SELECT queries with appropriate filters
3. Present results clearly with context

You cannot modify data. If asked to INSERT, UPDATE, DELETE, or modify schema, explain that you only have read access.
```

---

## Validation Script

```bash
#!/bin/bash
# ./scripts/validate-readonly-query.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block write operations (case-insensitive)
if echo "$COMMAND" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE|MERGE)\b' > /dev/null; then
  echo "Blocked: Write operations not allowed. Use SELECT queries only." >&2
  exit 2
fi

exit 0
```

Make executable: `chmod +x ./scripts/validate-readonly-query.sh`

---

## How It Works

1. Subagent has Bash access
2. PreToolUse hook intercepts every Bash command
3. Script checks for SQL write keywords
4. Exit 2 blocks operation, stderr fed to Claude
5. Exit 0 allows operation

---

## Key Pattern

Use hooks for **conditional validation** when:
- Tool access is needed but constrained
- Rules are dynamic/complex
- You need finer control than `tools` field provides

---

## Related

- `../../lookup/hook-events.md` - Hook reference
- `../../concepts/hooks-system.md` - Hooks overview

**Reference**: https://docs.anthropic.com/en/docs/claude-code/sub-agents
