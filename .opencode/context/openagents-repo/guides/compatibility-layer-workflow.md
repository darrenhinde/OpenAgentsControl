<!-- Context: openagents-repo/guides | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Guide: Compatibility Layer Development Workflow

**Purpose**: Step-by-step process for extending the compatibility layer to support new AI coding tools

**Last Updated**: 2026-02-05

---

## When to Use This Guide

- Adding support for a new AI coding tool (e.g., Codeium, GitHub Copilot)
- Extending existing adapter capabilities
- Understanding the development phases for compatibility work

---

## Development Phases

### Phase 1: Foundation ✅ COMPLETE

**Objective**: Set up project infrastructure and core types

1. **Project Setup** (1.5h) ✅
   - Create `packages/agent-compiler/package.json`
   - Configure TypeScript with strict mode
   - Set up Vitest with 80%+ coverage thresholds

2. **Type System** (1.5h) ✅
   - Create `src/types.ts` with Zod schemas
   - Define `OpenAgentSchema`, `AgentFrontmatterSchema`
   - Export TypeScript types with `z.infer<>`

3. **Base Adapter** (1.5h) ✅
   - Create `src/adapters/BaseAdapter.ts` abstract class
   - Define abstract methods: `toOAC()`, `fromOAC()`, `getCapabilities()`

4. **Agent Loader** (1.5h) ✅
   - Create `src/core/AgentLoader.ts`
   - Use gray-matter for YAML frontmatter parsing

5. **Adapter Registry** (1h) ✅
   - Create `src/core/AdapterRegistry.ts`
   - Implement registry pattern with `Map<string, BaseAdapter>`

6. **Public API** (1h) ✅
   - Create `src/index.ts`
   - Export all public APIs

**Result**: 1,475 lines TypeScript, 0 compilation errors

---

### Phase 2: Adapter Migration ✅ COMPLETE

**Objective**: Migrate existing adapters to TypeScript

7. **Claude Adapter** (3h) ✅ - 600 lines
8. **Cursor Adapter** (3h) ✅ - 554 lines
9. **Windsurf Adapter** (3h) ✅ - 514 lines
10. **ClaudeAdapter Tests** ✅ - 80 tests, 96% coverage
11. **CursorAdapter Tests** ✅ - 78 tests, 99% coverage
12. **WindsurfAdapter Tests** ✅ - 78 tests, 99% coverage

**Result**: 1,858 lines TypeScript, 236 tests passing

---

### Phase 3: Mappers & Translation ✅ COMPLETE

**Objective**: Implement feature mapping logic

13. **Tool Mapper** ✅ - 308 lines, 34 tests, 100% coverage
14. **Permission Mapper** ✅ - 354 lines, 37 tests, 98% coverage
15. **Model Mapper** ✅ - 413 lines, 37 tests, 99% coverage
16. **Context Mapper** ✅ - 384 lines, 51 tests, 97% coverage
17. **Capability Matrix** ✅ - 559 lines, 43 tests, 99% coverage
18. **Translation Engine** ✅ - 453 lines, 47 tests, 99% coverage
19. **Mapper Tests** ✅ - 249 tests total

**Result**: 2,471 lines TypeScript, 249 tests passing

---

### Phase 4: CLI Tool ⬅️ NEXT

**Objective**: Build command-line interface

20. **CLI Scaffolding** (1.5h)
    - Create `src/cli/index.ts` with Commander.js
    - Define commands: convert, validate, migrate, info
    - Set up chalk for colored output, ora for spinners

21. **Convert Command** (2h)
    - Implement `commands/convert.ts`
    - Usage: `oac-compat convert --from oac --to claude agent.md`
    - Support batch conversion

22. **Validate Command** (1.5h)
    - Implement `commands/validate.ts`
    - Check compatibility before conversion
    - Report warnings and incompatibilities

23. **Migrate Command** (2h)
    - Implement `commands/migrate.ts`
    - Migrate entire projects (all agents + context)
    - Generate migration report

24. **Info Command** (1h)
    - Implement `commands/info.ts`
    - Show tool capabilities and feature matrices
    - Display adapter list

25. **CLI Integration Tests** (2h)
    - Test each command end-to-end
    - Test error handling
    - Test output formatting

---

### Phase 5: Documentation

**Objective**: Create migration guides and API docs

26-30. **Migration Guides** (4h total)
    - `docs/migration-guides/cursor-to-oac.md`
    - `docs/migration-guides/claude-to-oac.md`
    - `docs/migration-guides/oac-to-cursor.md`
    - `docs/migration-guides/oac-to-claude.md`
    - `docs/migration-guides/oac-to-windsurf.md`

31. **Feature Matrices** (1h)
    - Generate comparison tables
    - Document degradation patterns

32. **API Documentation** (1h)
    - Document programmatic API usage
    - Add examples for each adapter

---

## Adding a New Tool Adapter

### Step-by-Step

1. **Research Tool Format**
   - Study tool's configuration file structure
   - Identify supported features
   - Note limitations vs OAC

2. **Create Adapter Class**
   ```typescript
   export class NewToolAdapter extends BaseAdapter {
     name = 'newtool'
     displayName = 'New Tool'
     
     async toOAC(source: string): Promise<OpenAgent> { /* ... */ }
     async fromOAC(agent: OpenAgent): Promise<ConversionResult> { /* ... */ }
     getConfigPath(): string { /* ... */ }
     getCapabilities(): ToolCapabilities { /* ... */ }
     validateConversion(agent: OpenAgent): string[] { /* ... */ }
   }
   ```

3. **Use Existing Mappers**
   - ToolMapper for tool name translation
   - PermissionMapper for permission translation
   - ModelMapper for model ID translation
   - ContextMapper for context path translation

4. **Register Adapter**
   ```typescript
   AdapterRegistry.register(new NewToolAdapter())
   ```

5. **Write Tests** (Target: 80%+ coverage)

6. **Update Documentation**

---

## Success Criteria

**Phase 1-3** ✅ ACHIEVED:
- [x] All files compile without errors
- [x] Zod schemas validate correctly
- [x] All 3 adapters migrated to TypeScript
- [x] Unit tests pass with 80%+ coverage
- [x] All mappers are pure functions
- [x] Graceful degradation works

**Phase 4** (upcoming):
- [ ] CLI commands work end-to-end
- [ ] Error handling is comprehensive
- [ ] Output is user-friendly

**Phase 5** (upcoming):
- [ ] Migration guides cover all tools
- [ ] API docs are complete
- [ ] Examples demonstrate usage

---

## Reference

- **Issue**: https://github.com/darrenhinde/OpenAgentsControl/issues/141
- **Branch**: `devalexanderdaza/issue141`
- **Location**: `packages/agent-compiler/`

**Related**:
- lookup/compatibility-layer-progress.md
- lookup/compatibility-layer-adapters.md
- lookup/compatibility-layer-structure.md
