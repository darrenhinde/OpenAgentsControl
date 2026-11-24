<!-- Context: openagents-repo/migrating-to-plugins | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Migrating Standalone to Plugin

**Purpose**: Convert `.claude/` configurations into shareable plugins

---

## Migration Steps

1. **Create plugin structure**:
   ```bash
   mkdir -p my-plugin/.claude-plugin
   ```

2. **Create manifest** (`my-plugin/.claude-plugin/plugin.json`):
   ```json
   {
     "name": "my-plugin",
     "description": "Migrated from standalone",
     "version": "1.0.0"
   }
   ```

3. **Copy components**:
   ```bash
   cp -r .claude/commands my-plugin/
   cp -r .claude/agents my-plugin/
   cp -r .claude/skills my-plugin/
   ```

4. **Migrate hooks** (from `settings.json` to `hooks/hooks.json`):
   ```bash
   mkdir my-plugin/hooks
   # Copy hooks object from settings.json
   ```

5. **Test**: `claude --plugin-dir ./my-plugin`

---

## What Changes

| Standalone | Plugin |
|------------|--------|
| One project only | Shareable via marketplaces |
| Files in `.claude/` | Files in `plugin-name/` |
| Hooks in `settings.json` | Hooks in `hooks/hooks.json` |
| Manual copy to share | Install with `/plugin install` |

---

## Key Points

- Plugin commands are namespaced (`/plugin:cmd` vs `/cmd`)
- Hook format is identical between settings.json and hooks.json
- Remove original `.claude/` files after verifying migration
- Plugin version takes precedence when loaded

---

## Related

- `../lookup/plugin-structure.md` - Directory structure
- `../concepts/plugin-architecture.md` - Architecture

**Reference**: https://docs.anthropic.com/en/docs/claude-code/plugins
