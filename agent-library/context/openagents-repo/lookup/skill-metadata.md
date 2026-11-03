<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Skill Metadata Fields

**Purpose**: Quick reference for SKILL.md frontmatter fields

---

## Required Fields

| Field | Description |
|-------|-------------|
| `name` | Unique identifier (lowercase, hyphens, max 64 chars) |
| `description` | What skill does and when to use (max 1024 chars) |

---

## Optional Fields

| Field | Default | Description |
|-------|---------|-------------|
| `allowed-tools` | All | Tools Claude can use without permission |
| `model` | Conversation | Model to use (e.g., `claude-sonnet-4-20250514`) |
| `context` | - | Set to `fork` for isolated sub-agent context |
| `agent` | `general-purpose` | Agent type when `context: fork` |
| `hooks` | - | Lifecycle hooks (`PreToolUse`, `PostToolUse`, `Stop`) |
| `user-invocable` | `true` | Show in slash command menu |
| `disable-model-invocation` | `false` | Block programmatic invocation |

---

## allowed-tools Syntax

```yaml
# Comma-separated
allowed-tools: Read, Grep, Glob

# YAML list
allowed-tools:
  - Read
  - Grep
  - Glob
```

---

## hooks Syntax

```yaml
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate.sh"
          once: true  # Run only once per session
```

---

## Visibility Control

| Setting | Slash Menu | Skill Tool | Auto-discovery |
|---------|------------|------------|----------------|
| Default | ✓ | ✓ | ✓ |
| `user-invocable: false` | ✗ | ✓ | ✓ |
| `disable-model-invocation: true` | ✓ | ✗ | ✓ |

---

## Related

- `../concepts/agent-skills.md` - Skills overview
- `../guides/creating-skills.md` - Creation guide

**Reference**: https://docs.anthropic.com/en/docs/claude-code/skills
