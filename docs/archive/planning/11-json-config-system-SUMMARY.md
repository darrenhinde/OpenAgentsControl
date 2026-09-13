# JSON Config System - Quick Summary

**Document**: 11-json-config-system.md  
**Date**: 2026-02-15  
**Status**: Ready for Implementation

---

## 🎯 The Big Idea

**Transform from**: Markdown agents (hard to parse, no validation, IDE-specific)  
**Transform to**: JSON config + Markdown prompts (type-safe, validated, multi-IDE)

---

## 🏗️ Architecture

```
.opencode/                          ← SINGLE SOURCE OF TRUTH
├── agents/
│   ├── core/
│   │   └── openagent/
│   │       ├── agent.json          ← Config (metadata, permissions, tools)
│   │       └── prompt.md           ← Prompt (human-readable content)
│   └── manifest.json               ← Registry

         ↓ OAC CLI converts ↓

┌────────────┬─────────────┬──────────┬───────────┐
│ OpenCode   │ Claude Code │ Cursor   │ Windsurf  │
│ (native)   │ (convert)   │ (flatten)│ (flatten) │
└────────────┴─────────────┴──────────┴───────────┘
```

---

## 📄 What's in agent.json?

```json
{
  "id": "openagent",
  "name": "OpenAgent",
  "mode": "primary",
  "model": "anthropic/claude-sonnet-4-20250514",
  "prompt": { "file": "./prompt.md" },
  "permissions": {
    "bash": "approve",
    "write": "approve"
  },
  "tools": {
    "bash": true,
    "write": true
  },
  "compatibility": {
    "opencode": "full",
    "claude": "full",
    "cursor": "partial"
  }
}
```

---

## 🚀 CLI Commands

```bash
# Convert agent to IDE format
oac convert openagent --to=opencode
oac convert openagent --to=claude
oac convert openagent --to=cursor

# Validate agent config
oac validate openagent

# Apply to IDE (auto-convert)
oac apply openagent --ide=opencode
oac apply --all --ide=claude

# Create new agent
oac create agent --template=subagent
```

---

## ✅ Benefits

1. **Type-safe** - Full TypeScript support
2. **Queryable** - Easy to filter/search agents
3. **Validatable** - JSON Schema validation
4. **Versionable** - Semantic versioning
5. **Convertible** - Transform to any IDE format
6. **Maintainable** - Separation of config vs content
7. **Multi-IDE** - One source, many targets

---

## 📅 Implementation Timeline

**6 weeks total**:

- **Week 1**: Infrastructure (types, schema, loaders, converters)
- **Week 2**: CLI commands (convert, validate, apply, info)
- **Week 3**: Migration script (markdown → JSON)
- **Week 4**: Testing (unit, integration, e2e)
- **Week 5**: Documentation (user + dev guides)
- **Week 6**: Deprecation (warnings, CI/CD updates)

---

## 🎯 Success Criteria

- ✅ All agents converted to JSON config
- ✅ All CLI commands working
- ✅ OpenCode, Claude, Cursor converters working
- ✅ Schema validation working
- ✅ Migration script working
- ✅ Documentation complete
- ✅ Tests passing (>90% coverage)

---

## 📊 Before vs After

### Before (Markdown)
```markdown
---
id: openagent
---
# OpenAgent
You are OpenAgent...
## Tools
- bash (approve)
```
❌ Hard to parse  
❌ No validation  
❌ Manual conversion

### After (JSON + Markdown)
**agent.json**:
```json
{
  "id": "openagent",
  "permissions": { "bash": "approve" }
}
```
**prompt.md**:
```markdown
You are OpenAgent...
```
✅ Easy to parse  
✅ Schema validated  
✅ Auto-convert

---

## 🔗 Related Documents

- **Full Plan**: 11-json-config-system.md (85KB)
- **Main Plan**: 01-main-plan.md
- **Context System**: See session reports in `.tmp/sessions/20250215-context-system-analysis/`

---

**Ready to implement!** 🚀
