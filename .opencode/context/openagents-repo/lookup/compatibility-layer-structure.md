<!-- Context: openagents-repo/lookup | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Lookup: Compatibility Layer File Structure

**Purpose**: Quick reference for where files go in the compatibility-layer package

**Last Updated**: 2026-02-05

---

## Package Location

```
packages/agent-compiler/
```

---

## Directory Structure (Current State)

```
compatibility-layer/
├── package.json              # Dependencies, scripts
├── tsconfig.json             # TypeScript config (strict, ES2022)
├── vitest.config.ts          # Test config (80% coverage threshold)
├── README.md                 # Package documentation
│
├── src/                      # Source code (5,799 lines)
│   ├── types.ts              # Zod schemas + type exports (315 lines) ✅
│   ├── index.ts              # Public API exports (335 lines) ✅
│   │
│   ├── adapters/             # Tool adapters ✅ COMPLETE
│   │   ├── BaseAdapter.ts    # Abstract base class (190 lines)
│   │   ├── ClaudeAdapter.ts  # Claude Code adapter (600 lines)
│   │   ├── CursorAdapter.ts  # Cursor IDE adapter (554 lines)
│   │   └── WindsurfAdapter.ts # Windsurf adapter (514 lines)
│   │
│   ├── core/                 # Core services ✅ COMPLETE
│   │   ├── AgentLoader.ts    # Load/parse OAC agents (386 lines)
│   │   ├── AdapterRegistry.ts # Adapter management (416 lines)
│   │   ├── CapabilityMatrix.ts # Feature parity tracking (559 lines)
│   │   └── TranslationEngine.ts # Conversion orchestration (453 lines)
│   │
│   ├── mappers/              # Feature mappers ✅ COMPLETE
│   │   ├── ToolMapper.ts     # Tool name mapping (308 lines)
│   │   ├── PermissionMapper.ts # Permission translation (354 lines)
│   │   ├── ModelMapper.ts    # Model ID mapping (413 lines)
│   │   └── ContextMapper.ts  # Context path mapping (384 lines)
│   │
│   └── cli/                  # Command-line interface 📝 TODO
│       ├── index.ts          # CLI entry point
│       └── commands/
│           ├── convert.ts    # Convert command
│           ├── validate.ts   # Validate command
│           ├── migrate.ts    # Migrate command
│           └── info.ts       # Info command
│
├── tests/                    # Test files (6,322 lines, 485 tests)
│   └── unit/
│       ├── adapters/         # Adapter tests ✅ COMPLETE
│       │   ├── ClaudeAdapter.test.ts (80 tests)
│       │   ├── CursorAdapter.test.ts (78 tests)
│       │   └── WindsurfAdapter.test.ts (78 tests)
│       ├── mappers/          # Mapper tests ✅ COMPLETE
│       │   ├── ToolMapper.test.ts (34 tests)
│       │   ├── PermissionMapper.test.ts (37 tests)
│       │   ├── ModelMapper.test.ts (37 tests)
│       │   └── ContextMapper.test.ts (51 tests)
│       └── core/             # Core tests ✅ COMPLETE
│           ├── CapabilityMatrix.test.ts (43 tests)
│           └── TranslationEngine.test.ts (47 tests)
│
├── docs/                     # Documentation 📝 TODO
│   ├── migration-guides/     # Migration instructions
│   ├── feature-matrices/     # Feature comparison tables
│   └── api/                  # API documentation
│
└── dist/                     # Compiled output (auto-generated)
```

---

## Implementation Status

### ✅ Complete (Phases 1-3)

| File | Lines | Tests | Coverage |
|------|-------|-------|----------|
| types.ts | 315 | - | - |
| index.ts | 335 | - | - |
| BaseAdapter.ts | 190 | - | 92% |
| ClaudeAdapter.ts | 600 | 80 | 96% |
| CursorAdapter.ts | 554 | 78 | 99% |
| WindsurfAdapter.ts | 514 | 78 | 99% |
| AgentLoader.ts | 386 | - | 0%* |
| AdapterRegistry.ts | 416 | - | 0%* |
| CapabilityMatrix.ts | 559 | 43 | 99% |
| TranslationEngine.ts | 453 | 47 | 99% |
| ToolMapper.ts | 308 | 34 | 100% |
| PermissionMapper.ts | 354 | 37 | 98% |
| ModelMapper.ts | 413 | 37 | 99% |
| ContextMapper.ts | 384 | 51 | 97% |

*AgentLoader and AdapterRegistry are tested indirectly via adapters

### 📝 Pending (Phase 4-5)

| File | Purpose | Phase |
|------|---------|-------|
| cli/index.ts | CLI entry point | 4 |
| cli/commands/convert.ts | Convert command | 4 |
| cli/commands/validate.ts | Validate command | 4 |
| cli/commands/migrate.ts | Migrate command | 4 |
| cli/commands/info.ts | Info command | 4 |
| docs/migration-guides/*.md | Migration guides | 5 |
| docs/api/*.md | API documentation | 5 |

---

## Dependencies

### Production

| Package | Purpose | Version |
|---------|---------|---------|
| zod | Schema validation | ^3.22.0 |
| js-yaml | YAML parsing | ^4.1.0 |
| gray-matter | Frontmatter extraction | ^4.0.3 |

### Development

| Package | Purpose | Version |
|---------|---------|---------|
| typescript | TypeScript compiler | ^5.4.0 |
| vitest | Test framework | ^1.6.1 |
| @vitest/coverage-v8 | Coverage reporting | ^1.6.1 |

### CLI (Phase 4 - to be added)

| Package | Purpose | Version |
|---------|---------|---------|
| commander | CLI framework | ^11.1.0 |
| chalk | Terminal colors | ^5.3.0 |
| ora | Loading spinners | ^7.0.1 |

---

## Scripts

```json
{
  "build": "tsc",
  "build:watch": "tsc --watch",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

---

## Reference

- **Issue**: https://github.com/darrenhinde/OpenAgentsControl/issues/141
- **Branch**: `devalexanderdaza/issue141`

**Related**:
- lookup/compatibility-layer-progress.md
- lookup/compatibility-layer-adapters.md
- guides/compatibility-layer-workflow.md
