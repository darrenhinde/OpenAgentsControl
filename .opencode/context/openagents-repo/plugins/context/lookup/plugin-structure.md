<!-- Context: openagents-repo/plugin-structure | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Plugin Directory Structure

**Purpose**: Quick reference for plugin file organization

---

## Standard Layout

```
my-plugin/
├── .claude-plugin/          # REQUIRED - manifest only
│   └── plugin.json          # Plugin identity
│
├── commands/                # Slash commands as .md files
│   └── hello.md
│
├── agents/                  # Custom subagent definitions
│   └── code-reviewer.md
│
├── skills/                  # Agent Skills
│   └── code-review/
│       └── SKILL.md
│
├── hooks/                   # Event handlers
│   └── hooks.json
│
├── .mcp.json               # MCP server configs
└── .lsp.json               # LSP server configs
```

---

## Critical Rules

- Only `plugin.json` goes inside `.claude-plugin/`
- All other directories at plugin root level
- Never put commands/, agents/, skills/ inside .claude-plugin/

---

## Manifest Schema

```json
{
  "name": "plugin-name",        // Required: namespace prefix
  "description": "What it does", // Required: shown in manager
  "version": "1.0.0",           // Required: semver
  "author": { "name": "You" },  // Optional
  "homepage": "https://...",    // Optional
  "repository": "https://...",  // Optional
  "license": "MIT"              // Optional
}
```

---

## Related

- `../concepts/plugin-architecture.md` - Architecture
- `../guides/creating-plugins.md` - Creation guide

**Reference**: https://docs.anthropic.com/en/docs/claude-code/plugins-reference
