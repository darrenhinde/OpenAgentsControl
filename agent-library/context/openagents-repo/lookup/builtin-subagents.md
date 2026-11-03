<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Built-in Subagents

**Purpose**: Quick reference for Claude Code's default subagents

---

## Explore

**Model**: Haiku (fast, low-latency)
**Tools**: Read-only (denied Write, Edit)
**Purpose**: File discovery, code search, codebase exploration

Thoroughness levels:
- `quick` - Targeted lookups
- `medium` - Balanced exploration
- `very thorough` - Comprehensive analysis

---

## Plan

**Model**: Inherits from main conversation
**Tools**: Read-only (denied Write, Edit)
**Purpose**: Codebase research for planning

Used during plan mode to gather context before presenting a plan. Cannot spawn other subagents.

---

## general-purpose

**Model**: Inherits from main conversation
**Tools**: All tools
**Purpose**: Complex research, multi-step operations, code modifications

Used when task requires both exploration AND modification, complex reasoning, or multiple dependent steps.

---

## Other Built-in Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| Bash | Inherits | Terminal commands in separate context |
| statusline-setup | Sonnet | Configure status line (`/statusline`) |
| Claude Code Guide | Haiku | Questions about Claude Code features |

---

## Disabling Subagents

In settings or CLI:
```json
{
  "permissions": {
    "deny": ["Task(Explore)", "Task(my-custom-agent)"]
  }
}
```

Or: `claude --disallowedTools "Task(Explore)"`

---

## Related

- `../concepts/subagents-system.md` - Subagents overview
- `../guides/authoring-agents.md` - Custom subagents
- `../lookup/subagent-frontmatter.md` - Configuration

**Reference**: https://docs.anthropic.com/en/docs/claude-code/sub-agents
