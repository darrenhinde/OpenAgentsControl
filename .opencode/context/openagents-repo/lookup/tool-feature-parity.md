<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Lookup: Tool Feature Parity Matrix

**Purpose**: Quick reference for feature support across AI coding tools

**Last Updated**: 2026-02-04

---

## Feature Comparison

### Core Features

| Feature | OAC | Claude Code | Cursor IDE | Windsurf | Notes |
|---------|-----|-------------|------------|----------|-------|
| **Multiple agents** | ✅ Yes | ✅ Yes | ❌ Single only | ✅ Yes | Cursor requires merged config |
| **Agent modes** | ✅ primary/subagent | ✅ Yes | ❌ No | ⚠️ Partial | OAC has explicit mode field |
| **Temperature control** | ✅ 0.0-2.0 | ❌ No | ⚠️ Limited | ⚠️ Limited | Maps to creativity settings |
| **Model selection** | ✅ Full control | ✅ Yes | ✅ Yes | ✅ Yes | Different ID formats |
| **Context files** | ✅ .opencode/context/ | ✅ Skills system | ✅ .cursorrules | ✅ Yes | Path mapping required |

### Tool Permissions

| Tool Access | OAC | Claude Code | Cursor IDE | Windsurf |
|-------------|-----|-------------|------------|----------|
| **read** | ✅ Granular | ⚠️ Binary on/off | ⚠️ Binary | ⚠️ Binary |
| **write** | ✅ Granular | ⚠️ Binary | ⚠️ Binary | ⚠️ Binary |
| **edit** | ✅ Granular | ⚠️ Binary | ⚠️ Binary | ⚠️ Binary |
| **bash** | ✅ Granular | ✅ Yes | ✅ Yes | ✅ Yes |
| **task** | ✅ Delegation | ✅ Yes | ❌ No | ⚠️ Limited |
| **grep/glob** | ✅ Separate | ✅ Yes | ✅ Yes | ✅ Yes |

**Legend**: ✅ Full support | ⚠️ Partial/degraded | ❌ Not supported

### Advanced Features

| Feature | OAC | Claude Code | Cursor IDE | Windsurf |
|---------|-----|-------------|------------|----------|
| **Skills system** | ✅ Yes | ✅ Yes | ❌ No | ⚠️ Partial |
| **Hooks** | ✅ 5 types | ✅ Yes | ❌ No | ❌ No |
| **Dependencies** | ✅ Explicit | ✅ Yes | ❌ No | ⚠️ Partial |
| **Priority levels** | ✅ 4 levels | ⚠️ 2 levels | ❌ No | ⚠️ 2 levels |
| **Agent categories** | ✅ 8 types | ⚠️ Limited | ❌ No | ⚠️ Limited |

---

## Hook Event Support

| Event | OAC | Claude Code | Cursor | Windsurf |
|-------|-----|-------------|--------|----------|
| PreToolUse | ✅ | ✅ | ❌ | ❌ |
| PostToolUse | ✅ | ✅ | ❌ | ❌ |
| PermissionRequest | ✅ | ✅ | ❌ | ❌ |
| AgentStart | ✅ | ✅ | ❌ | ❌ |
| AgentEnd | ✅ | ✅ | ❌ | ❌ |

---

## Permission Granularity Mapping

### OAC → Other Tools (Degradation)

```
OAC Granular Permission:
{
  allow: ["src/**/*.ts"],
  deny: ["src/secrets/**"],
  ask: ["package.json"]
}

↓ Maps to ↓

Claude: tools.write = true (with warnings in skills)
Cursor: Full write access (no granularity)
Windsurf: Basic allow/deny (ask → deny)
```

---

## Model ID Mapping

| OAC Model ID | Claude Code | Cursor IDE | Windsurf |
|--------------|-------------|------------|----------|
| claude-sonnet-4 | claude-sonnet-4-20250514 | claude-sonnet-4 | claude-4-sonnet |
| gpt-4 | N/A | gpt-4 | gpt-4 |
| gpt-4-turbo | N/A | gpt-4-turbo | gpt-4-turbo |

---

## Configuration File Paths

| Tool | Primary Config | Context/Skills | Agents |
|------|----------------|----------------|--------|
| **OAC** | .opencode/agent/ | .opencode/context/ | .opencode/agent/*.md |
| **Claude** | .claude/config.json | .claude/skills/ | .claude/agents/ |
| **Cursor** | .cursorrules | (inline) | Single file only |
| **Windsurf** | .windsurf/config.json | .windsurf/context/ | .windsurf/agents/ |

---

## Conversion Compatibility

### OAC → Claude Code
- ✅ Full feature preservation
- ⚠️ Temperature ignored (not supported)
- ✅ Hooks preserved
- ✅ Skills map 1:1

### OAC → Cursor IDE
- ⚠️ Multiple agents → merged single file
- ❌ Hooks lost
- ❌ Skills → inline context
- ⚠️ Granular permissions → binary

### OAC → Windsurf
- ✅ Multiple agents preserved
- ⚠️ Temperature → creativity setting
- ❌ Hooks lost
- ⚠️ Skills → partial mapping

### Reverse Conversions
- Claude → OAC: ✅ High fidelity
- Cursor → OAC: ⚠️ Limited (single agent)
- Windsurf → OAC: ⚠️ Partial feature loss

---

## Reference

- **Implementation**: `packages/agent-compiler/src/mappers/`
- **Related**:
  - concepts/compatibility-layer.md
  - examples/baseadapter-pattern.md
  - guides/compatibility-layer-workflow.md
