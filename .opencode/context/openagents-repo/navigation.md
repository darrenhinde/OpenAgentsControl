# OpenAgents Control Repository Context

**Purpose**: Context files specific to the OpenAgents Control repository

**Last Updated**: 2026-01-13

---

## Quick Navigation

| Function | Files | Purpose |
|----------|-------|---------|
| **Concepts** | 2 files | Core ideas and principles |
| **Examples** | 1 file | Working code samples |
| **Guides** | 8 files | Step-by-step workflows |
| **Lookup** | 4 files | Quick reference tables |
| **Errors** | 1 file | Common issues + solutions |

---

## Concepts (Core Ideas)

| File | Topic | Priority |
|------|-------|----------|
| `concepts/subagent-testing-modes.md` | Standalone vs delegation testing | ⭐⭐⭐⭐⭐ |

**When to read**: Before testing any subagent

---

## Examples (Working Code)

| File | Topic | Priority |
|------|-------|----------|
| `examples/subagent-prompt-structure.md` | Optimized subagent prompt template | ⭐⭐⭐⭐ |

**When to read**: When creating or optimizing subagent prompts

---

## Guides (Step-by-Step)

| File | Topic | Priority |
|------|-------|----------|
| `guides/testing-subagents.md` | How to test subagents standalone | ⭐⭐⭐⭐⭐ |
| `guides/adding-agent.md` | How to add new agents | ⭐⭐⭐⭐ |
| `guides/testing-agent.md` | How to test agents | ⭐⭐⭐⭐ |
| `guides/external-libraries-workflow.md` | How to handle external library dependencies | ⭐⭐⭐⭐ |
| `guides/updating-registry.md` | How to update registry | ⭐⭐⭐ |
| `guides/debugging.md` | How to debug issues | ⭐⭐⭐ |
| `guides/resolving-installer-wildcard-failures.md` | Fix wildcard context install failures | ⭐⭐⭐ |
| `guides/creating-release.md` | How to create releases | ⭐⭐ |

**When to read**: When performing specific tasks

---

## Lookup (Quick Reference)

| File | Topic | Priority |
|------|-------|----------|
| `lookup/subagent-test-commands.md` | Subagent testing commands | ⭐⭐⭐⭐⭐ |
| `lookup/file-locations.md` | Where files are located | ⭐⭐⭐⭐ |
| `lookup/commands.md` | Available slash commands | ⭐⭐⭐ |

**When to read**: Quick command lookups

---

## Errors (Troubleshooting)

| File | Topic | Priority |
|------|-------|----------|
| `errors/tool-permission-errors.md` | Tool permission issues | ⭐⭐⭐⭐⭐ |

**When to read**: When tests fail with permission errors

---

## Core Concepts (Foundational)

| File | Topic | Priority |
|------|-------|----------|
| `core-concepts/agents.md` | How agents work | ⭐⭐⭐⭐⭐ |
| `core-concepts/evals.md` | How testing works | ⭐⭐⭐⭐⭐ |
| `core-concepts/registry.md` | How registry works | ⭐⭐⭐⭐ |
| `core-concepts/categories.md` | How organization works | ⭐⭐⭐ |

**When to read**: First time working in this repo

---

## Loading Strategy

### For Subagent Testing:
1. Load `concepts/subagent-testing-modes.md` (understand modes)
2. Load `guides/testing-subagents.md` (step-by-step)
3. Reference `lookup/subagent-test-commands.md` (commands)
4. If errors: Load `errors/tool-permission-errors.md`

### For Agent Creation:
1. Load `core-concepts/agents.md` (understand structure)
2. Load `guides/adding-agent.md` (step-by-step)
3. **If using external libraries**: Load `guides/external-libraries-workflow.md` (fetch docs)
4. Load `examples/subagent-prompt-structure.md` (if subagent)
5. Load `guides/testing-agent.md` (validate)

### For Debugging:
1. Load `guides/debugging.md` (general approach)
2. Load specific error file from `errors/`
3. Reference `lookup/file-locations.md` (find files)

---

## File Size Compliance

All files follow MVI principle (<200 lines):

- ✅ Concepts: <100 lines
- ✅ Examples: <100 lines
- ✅ Guides: <150 lines
- ✅ Lookup: <100 lines
- ✅ Errors: <150 lines

---

## Related Context

- `../core/` - Core system context (standards, patterns)
- `../core/context-system/` - Context management system
- `quick-start.md` - 2-minute repo orientation
- `../content-creation/navigation.md` - Content creation principles
- `../to-be-consumed/claude-code-docs/plugins.md` - Claude Code extension docs

---

## Contributing

When adding new context files:

1. Follow MVI principle (<200 lines)
2. Use function-based organization (concepts/, examples/, guides/, lookup/, errors/)
3. Update this README.md navigation
4. Add cross-references to related files
5. Validate with `/context validate`
