<!-- Context: openagents-repo/creating-plugins | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Creating Plugins

**Purpose**: Step-by-step guide to create Claude Code plugins

---

## Quickstart Workflow

1. **Create directory**: `mkdir my-plugin`
2. **Create manifest**: `mkdir my-plugin/.claude-plugin`
3. **Add plugin.json** with name, description, version
4. **Add commands**: `mkdir my-plugin/commands` → add `.md` files
5. **Test**: `claude --plugin-dir ./my-plugin`
6. **Use**: `/my-plugin:command-name`

---

## Key Points

- Filename becomes command name (e.g., `hello.md` → `/plugin:hello`)
- Use `$ARGUMENTS` placeholder for user input
- Use `$1`, `$2` for individual arguments
- Restart Claude Code to pick up changes
- Load multiple: `claude --plugin-dir ./one --plugin-dir ./two`

---

## Command File Format

```markdown
---
description: Greet the user with a personalized message
---

# Hello Command

Greet the user named "$ARGUMENTS" warmly.
```

---

## Adding Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Commands | `commands/*.md` | Slash commands |
| Agents | `agents/*.md` | Custom subagents |
| Skills | `skills/*/SKILL.md` | Agent capabilities |
| Hooks | `hooks/hooks.json` | Event handlers |
| MCP | `.mcp.json` | External tools |
| LSP | `.lsp.json` | Code intelligence |

---

## Related

- `../concepts/plugin-architecture.md` - Architecture overview
- `../lookup/plugin-structure.md` - Full directory structure
- `./migrating-to-plugins.md` - Convert standalone to plugin

**Reference**: https://docs.anthropic.com/en/docs/claude-code/plugins
