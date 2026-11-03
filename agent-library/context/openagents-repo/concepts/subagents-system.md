<!-- Context: openagents-repo/concepts | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Subagents System

**Purpose**: Specialized AI assistants with own context window for task-specific workflows

---

## Core Concept

Subagents are isolated AI assistants that handle specific tasks. Each runs in its own context with custom system prompt, specific tool access, and independent permissions. When Claude encounters a matching task, it delegates to the subagent.

---

## Key Benefits

- **Preserve context**: Keep exploration/implementation out of main conversation
- **Enforce constraints**: Limit which tools subagent can use
- **Reuse configs**: User-level subagents work across projects
- **Specialize behavior**: Focused prompts for specific domains
- **Control costs**: Route to faster/cheaper models (Haiku)

---

## How Delegation Works

1. Claude analyzes task description and subagent descriptions
2. Matches task to appropriate subagent
3. Delegates work to subagent's isolated context
4. Subagent works independently
5. Returns results to main conversation

---

## Subagent Locations

| Location | Scope | Priority |
|----------|-------|----------|
| `--agents` CLI flag | Current session | 1 (highest) |
| `.claude/agents/` | Current project | 2 |
| `~/.claude/agents/` | All your projects | 3 |
| Plugin's `agents/` | Plugin users | 4 (lowest) |

---

## Key Constraints

- Subagents cannot spawn other subagents
- Background subagents auto-deny permissions not pre-approved
- MCP tools not available in background subagents

---

## Related

- `../lookup/builtin-subagents.md` - Built-in subagents
- `../guides/authoring-agents.md` - Creation guide
- `../lookup/subagent-frontmatter.md` - Configuration

**Reference**: https://docs.anthropic.com/en/docs/claude-code/sub-agents
