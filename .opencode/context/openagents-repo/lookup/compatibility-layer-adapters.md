<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Lookup: Compatibility Layer Adapters

**Purpose**: Quick reference for implemented adapter details

**Last Updated**: 2026-02-05

---

## Adapter Summary

| Adapter | Lines | Tests | Coverage | Status |
|---------|-------|-------|----------|--------|
| **ClaudeAdapter** | 600 | 80 | 96% | ✅ Complete |
| **CursorAdapter** | 554 | 78 | 99% | ✅ Complete |
| **WindsurfAdapter** | 514 | 78 | 99% | ✅ Complete |

**Total**: 1,858 lines of TypeScript, 236 tests

---

## ClaudeAdapter

**Format**: `.claude/config.json` (primary), `.claude/agents/*.md` (subagents)

**Capabilities**:
- ✅ Multiple agents
- ✅ Skills system
- ✅ Hooks (5 types: PreToolUse, PostToolUse, PermissionRequest, AgentStart, AgentEnd)
- ⚠️ Binary permissions (granular → degraded)
- ❌ Temperature not supported

**Key Mappings**:
- Model: `claude-sonnet-4` ↔ `claude-sonnet-4-20250514`
- Permissions: Granular OAC → `permissionMode` (default/acceptEdits/dontAsk/bypassPermissions)
- Contexts → Skills system

**Tests**: 80 tests covering toOAC(), fromOAC(), roundtrip, error handling

---

## CursorAdapter

**Format**: `.cursorrules` (single file in project root)

**Capabilities**:
- ❌ Single agent only (multi-agent → merged)
- ❌ No Skills system (contexts → inlined)
- ❌ No Hooks
- ⚠️ Binary permissions only
- ✅ Temperature support (limited)

**Key Features**:
- `mergeAgents()` method for multi-agent → single-file conversion
- Optional YAML frontmatter
- Context inlining with references

**Key Mappings**:
- Model: `claude-sonnet-4` → `claude-3-sonnet` (fallback to v3)
- Multiple agents → Merged with section headers

**Tests**: 78 tests covering toOAC(), fromOAC(), merging, error handling

---

## WindsurfAdapter

**Format**: `.windsurf/config.json`, `.windsurf/agents/*.json`

**Capabilities**:
- ✅ Multiple agents (`.windsurf/agents/`)
- ⚠️ Partial Skills (→ context references)
- ❌ No Hooks
- ⚠️ Binary permissions only
- ✅ Temperature via creativity setting

**Key Mappings**:
- Model: `claude-sonnet-4` ↔ `claude-4-sonnet`
- Temperature ↔ Creativity: `≤0.4 → low`, `≤0.8 → medium`, `>0.8 → high`
- Priority: `critical/high → high`, `medium/low → low`
- Skills → Context file references in `.windsurf/context/`

**Tests**: 78 tests covering toOAC(), fromOAC(), creativity mapping, error handling

---

## Mappers (Phase 3 ✅)

All mappers are pure functions used by adapters and TranslationEngine:

| Mapper | Lines | Tests | Coverage | Purpose |
|--------|-------|-------|----------|---------|
| **ToolMapper** | 308 | 34 | 100% | Tool name mapping (bash↔terminal, etc.) |
| **PermissionMapper** | 354 | 37 | 98% | Granular↔binary permissions |
| **ModelMapper** | 413 | 37 | 99% | Model ID mapping with fallbacks |
| **ContextMapper** | 384 | 51 | 97% | Context path mapping between platforms |

---

## Core Services (Phase 3 ✅)

| Service | Lines | Tests | Coverage | Purpose |
|---------|-------|-------|----------|---------|
| **CapabilityMatrix** | 559 | 43 | 99% | Feature compatibility analysis |
| **TranslationEngine** | 453 | 47 | 99% | Orchestrates all mappers |

---

## Common Patterns

### Bidirectional Conversion
All 3 adapters support:
- `toOAC()`: Tool format → OpenAgent
- `fromOAC()`: OpenAgent → Tool format

### Graceful Degradation
All adapters warn when features are lost:
- Granular permissions → Binary on/off
- Unsupported features → Warning messages
- Feature loss → Clear user notifications

### Type Safety
- All extend `BaseAdapter`
- Full TypeScript strict mode
- Zod schema validation
- 0 compilation errors

---

## Feature Parity Matrix

| Feature | OAC | Claude | Cursor | Windsurf |
|---------|-----|--------|--------|----------|
| Multiple Agents | ✅ | ✅ | ❌ | ✅ |
| Granular Permissions | ✅ | ❌ | ❌ | ❌ |
| Ask Permissions | ✅ | ❌ | ❌ | ❌ |
| Hooks | ✅ | ✅ | ❌ | ❌ |
| Skills | ✅ | ✅ | ❌ | ⚠️ |
| External Context | ✅ | ✅ | ❌ | ✅ |
| Context Priority | ✅ | ❌ | ❌ | ❌ |
| Temperature | ✅ | ❌ | ⚠️ | ✅ |
| Model Selection | ✅ | ✅ | ✅ | ✅ |
| Task Delegation | ✅ | ✅ | ❌ | ⚠️ |

Legend: ✅ Full support, ⚠️ Partial support, ❌ Not supported

---

## Reference

**Implementation**: `packages/agent-compiler/src/adapters/`
**Issue**: https://github.com/darrenhinde/OpenAgentsControl/issues/141

**Related**:
- lookup/compatibility-layer-progress.md
- lookup/compatibility-layer-structure.md
- guides/compatibility-layer-workflow.md
