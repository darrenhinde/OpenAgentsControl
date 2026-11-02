<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Subagent Frontmatter

**Purpose**: Quick reference for subagent configuration fields

---

## Required Fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (lowercase, hyphens) |
| `description` | When Claude should delegate to this subagent |

---

## Optional Fields

| Field | Default | Description |
|-------|---------|-------------|
| `tools` | All | Tools subagent can use |
| `disallowedTools` | - | Tools to deny (removed from list) |
| `model` | `sonnet` | Model: `sonnet`, `opus`, `haiku`, `inherit` |
| `permissionMode` | `default` | Permission handling mode |
| `skills` | - | Skills to load into context |
| `hooks` | - | Lifecycle hooks for this subagent |

---

## Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Standard permission checking |
| `acceptEdits` | Auto-accept file edits |
| `dontAsk` | Auto-deny permission prompts |
| `bypassPermissions` | Skip all permission checks |
| `plan` | Read-only exploration |

⚠️ `bypassPermissions` is dangerous - skips all checks

---

## Hooks Syntax

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/lint.sh"
```

---

## Example

```yaml
---
name: debugger
description: Debugging specialist for errors and test failures
tools: Read, Edit, Bash, Grep, Glob
model: inherit
permissionMode: default
---

You are an expert debugger...
```

---

## Related

- `../concepts/subagents-system.md` - Subagents overview
- `../guides/authoring-agents.md` - Creation guide
- `../lookup/builtin-subagents.md` - Built-in subagents

**Reference**: https://docs.anthropic.com/en/docs/claude-code/sub-agents
