<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Skills vs Other Options

**Purpose**: When to use Skills versus other Claude Code customizations

---

## Comparison Table

| Option | When It Runs | Best For |
|--------|--------------|----------|
| **Skills** | Claude chooses when relevant | Specialized knowledge (review standards, patterns) |
| **Slash commands** | You type `/command` | Reusable prompts (`/deploy staging`) |
| **CLAUDE.md** | Every conversation | Project-wide instructions |
| **Subagents** | Claude delegates or you invoke | Isolated context, different tools |
| **Hooks** | Specific tool events | Auto-format, logging, protection |
| **MCP servers** | Claude calls as needed | External tools and data sources |

---

## Key Distinctions

### Skills vs Slash Commands
- **Skills**: Claude decides when to use based on task
- **Commands**: You explicitly type `/command`

### Skills vs Subagents
- **Skills**: Add knowledge to current conversation
- **Subagents**: Separate context with own tools/permissions

### Skills vs MCP
- **Skills**: Tell Claude *how* to use tools
- **MCP**: *Provide* the tools themselves

### Skills vs CLAUDE.md
- **Skills**: Loaded only when relevant
- **CLAUDE.md**: Always loaded into every conversation

---

## Decision Guide

**Use Skills when**:
- Teaching domain-specific knowledge
- Defining review/coding standards
- Want Claude to decide when to apply

**Use Subagents when**:
- Need tool isolation
- Task produces verbose output
- Want separate context window

**Use CLAUDE.md when**:
- Rules apply to ALL interactions
- Project-wide coding standards

---

## Related

- `../concepts/agent-skills.md` - Skills overview
- `../concepts/subagents-system.md` - Subagents overview
- `../standards/subagent-structure.md` - Subagent patterns

**Reference**: https://docs.anthropic.com/en/docs/claude-code/skills
