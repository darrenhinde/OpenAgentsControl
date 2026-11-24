# Task Schema Migration Guide

**Purpose**: Step-by-step guide for migrating from base task schema to enhanced task schema

**Version**: 1.0

**Last Updated**: 2026-02-14

---

## Overview

This guide helps you migrate existing task.json and subtask_NN.json files from the **base schema** to the **enhanced schema** with line-number precision, domain modeling, and prioritization features.

**Key Points**:
- ✅ **100% backward compatible** - No breaking changes
- ✅ **Gradual migration** - Adopt features incrementally
- ✅ **Mixed formats** - Old and new formats work together
- ✅ **Optional enhancements** - Use only what you need

---

## Quick Start

### Do I Need to Migrate?

**No migration required if**:
- Your tasks are simple and working well
- You don't need line-number precision for large files
- You're not doing domain modeling or release planning

**Consider migrating if**:
- Context files are large (>100 lines) and agents read unnecessary sections
- You need domain modeling (bounded contexts, modules, vertical slices)
- You're tracking API contracts or architectural decisions
- You need prioritization (RICE/WSJF scores)
- You're planning releases and need to group tasks

### Migration Strategy

**Recommended approach**: Start small, expand gradually

1. **Phase 1**: Add line-number precision to large context files
2. **Phase 2**: Add domain modeling fields (bounded_context, module)
3. **Phase 3**: Add contracts and ADR references
4. **Phase 4**: Add prioritization scores for release planning

---

## Field-by-Field Mapping

### Base Schema → Enhanced Schema

| Base Field | Enhanced Field | Change | Notes |
|------------|----------------|--------|-------|
| `context_files` | `context_files` | Format change | String → Object with line ranges |
| `reference_files` | `reference_files` | Format change | String → Object with line ranges |
| - | `bounded_context` | New (optional) | DDD bounded context |
| - | `module` | New (optional) | Module/package name |
| - | `vertical_slice` | New (optional) | Feature slice identifier |
| - | `contracts` | New (optional) | API/interface contracts |
| - | `design_components` | New (optional) | Figma/wireframe links |
| - | `related_adrs` | New (optional) | Architecture Decision Records |
| - | `rice_score` | New (optional) | RICE prioritization |
| - | `wsjf_score` | New (optional) | WSJF prioritization |
| - | `release_slice` | New (optional) | Release identifier |

**All other fields remain unchanged.**

---

## Migration Examples

### Example 1: Basic Migration (Line-Number Precision)

**Before** (base schema):
```json
{
  "id": "auth-system-02",
  "seq": "02",
  "title": "Create JWT service",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    ".opencode/context/core/standards/code-quality.md",
    ".opencode/context/core/standards/security-patterns.md"
  ],
  "reference_files": [
    "src/auth/token-utils.ts"
  ],
  "acceptance_criteria": [
    "JWT tokens signed with RS256",
    "Tests pass"
  ],
  "deliverables": [
    "src/auth/jwt.service.ts"
  ]
}
```

**After** (enhanced schema with line-number precision):
```json
{
  "id": "auth-system-02",
  "seq": "02",
  "title": "Create JWT service",
  "status": "pending",
  "depends_on": ["01"],
  "parallel": false,
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "53-72",
      "reason": "Pure function patterns for service layer"
    },
    {
      "path": ".opencode/context/core/standards/security-patterns.md",
      "lines": "120-145",
      "reason": "JWT signing and validation rules"
    }
  ],
  "reference_files": [
    {
      "path": "src/auth/token-utils.ts",
      "lines": "1-50",
      "reason": "Existing token utility functions to extend"
    }
  ],
  "acceptance_criteria": [
    "JWT tokens signed with RS256",
    "Tests pass"
  ],
  "deliverables": [
    "src/auth/jwt.service.ts"
  ]
}
```

**Benefits**:
- Agents read only relevant sections (53-72, 120-145) instead of entire files
- Reduced cognitive load and faster context loading
- Clear reasoning for why each file section is needed

---

### Example 2: Adding Domain Modeling

**Before** (base schema):
```json
{
  "id": "user-authentication",
  "name": "User Authentication System",
  "status": "active",
  "objective": "Implement JWT-based authentication",
  "context_files": [
    ".opencode/context/core/standards/code-quality.md"
  ],
  "exit_criteria": [
    "All tests passing"
  ],
  "subtask_count": 5,
  "completed_count": 0,
  "created_at": "2026-02-14T10:00:00Z"
}
```

**After** (enhanced schema with domain modeling):
```json
{
  "id": "user-authentication",
  "name": "User Authentication System",
  "status": "active",
  "objective": "Implement JWT-based authentication",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "53-95",
      "reason": "Pure function patterns"
    }
  ],
  "exit_criteria": [
    "All tests passing"
  ],
  "subtask_count": 5,
  "completed_count": 0,
  "created_at": "2026-02-14T10:00:00Z",
  "bounded_context": "authentication",
  "module": "@app/auth",
  "vertical_slice": "user-login"
}
```

**Benefits**:
- Clear domain boundaries (bounded_context)
- Module organization (module)
- Feature slice tracking (vertical_slice)
- Better architecture visibility

---

### Example 3: Adding Contracts and ADRs

**Before** (base schema):
```json
{
  "id": "auth-system-03",
  "seq": "03",
  "title": "Implement auth API endpoints",
  "status": "pending",
  "depends_on": ["02"],
  "acceptance_criteria": [
    "POST /auth/login works",
    "POST /auth/refresh works"
  ],
  "deliverables": [
    "src/api/auth.controller.ts"
  ]
}
```

**After** (enhanced schema with contracts and ADRs):
```json
{
  "id": "auth-system-03",
  "seq": "03",
  "title": "Implement auth API endpoints",
  "status": "pending",
  "depends_on": ["02"],
  "acceptance_criteria": [
    "POST /auth/login works",
    "POST /auth/refresh works"
  ],
  "deliverables": [
    "src/api/auth.controller.ts"
  ],
  "contracts": [
    {
      "type": "api",
      "name": "AuthAPI",
      "path": "src/api/auth.contract.ts",
      "status": "defined",
      "description": "REST endpoints for login, logout, refresh"
    }
  ],
  "related_adrs": [
    {
      "id": "ADR-003",
      "path": "docs/adr/003-jwt-authentication.md",
      "title": "Use JWT for stateless authentication",
      "decision": "JWT with RS256, 15-min access tokens"
    }
  ]
}
```

**Benefits**:
- Contract tracking ensures API consistency
- ADR references document architectural decisions
- Clear dependencies on interface definitions

---

### Example 4: Adding Prioritization

**Before** (base schema):
```json
{
  "id": "user-dashboard",
  "name": "User Dashboard",
  "status": "active",
  "objective": "Build user dashboard with analytics",
  "subtask_count": 8,
  "completed_count": 0,
  "created_at": "2026-02-14T10:00:00Z"
}
```

**After** (enhanced schema with prioritization):
```json
{
  "id": "user-dashboard",
  "name": "User Dashboard",
  "status": "active",
  "objective": "Build user dashboard with analytics",
  "subtask_count": 8,
  "completed_count": 0,
  "created_at": "2026-02-14T10:00:00Z",
  "rice_score": {
    "reach": 5000,
    "impact": 2,
    "confidence": 80,
    "effort": 3,
    "score": 2666.67
  },
  "wsjf_score": {
    "business_value": 8,
    "time_criticality": 6,
    "risk_reduction": 5,
    "job_size": 3,
    "score": 6.33
  },
  "release_slice": "v1.2.0"
}
```

**Benefits**:
- RICE score helps prioritize features
- WSJF score for SAFe/Agile planning
- Release grouping for roadmap planning

---

## When to Use Enhanced Fields

### Line-Number Precision (`lines` field)

**Use when**:
- Context file is >100 lines
- Only specific sections are relevant
- You want to reduce agent cognitive load

**Example**:
```json
{
  "path": ".opencode/context/core/standards/code-quality.md",
  "lines": "53-95",
  "reason": "Pure function patterns"
}
```

**Don't use when**:
- File is small (<50 lines)
- Entire file is relevant
- You're unsure which sections matter (use entire file first, refine later)

---

### Domain Modeling Fields

**Use `bounded_context` when**:
- You're doing Domain-Driven Design (DDD)
- You have clear domain boundaries (auth, billing, inventory)
- You want to track which domain each task belongs to

**Use `module` when**:
- You have a modular architecture
- You're using monorepo with packages
- You want to track which module/package is affected

**Use `vertical_slice` when**:
- You're using vertical slice architecture
- You want to track end-to-end features
- You need to group tasks by user-facing feature

**Example**:
```json
{
  "bounded_context": "authentication",
  "module": "@app/auth",
  "vertical_slice": "user-login"
}
```

---

### Contracts

**Use when**:
- You're defining or implementing APIs
- You have interface contracts between modules
- You're using event-driven architecture
- You need to track schema definitions

**Example**:
```json
{
  "contracts": [
    {
      "type": "api",
      "name": "UserAPI",
      "path": "src/api/user.contract.ts",
      "status": "defined",
      "description": "REST API for user CRUD"
    }
  ]
}
```

---

### Design Components

**Use when**:
- Task involves UI implementation
- You have Figma designs or wireframes
- You need to link mockups to implementation

**Example**:
```json
{
  "design_components": [
    {
      "type": "figma",
      "url": "https://figma.com/file/abc123/Login-Flow",
      "description": "Login page mockups"
    }
  ]
}
```

---

### ADR References

**Use when**:
- Task implements an architectural decision
- You have ADR documents
- You want to link decisions to implementation

**Example**:
```json
{
  "related_adrs": [
    {
      "id": "ADR-003",
      "path": "docs/adr/003-jwt-authentication.md",
      "title": "Use JWT for stateless authentication"
    }
  ]
}
```

---

### Prioritization Scores

**Use RICE when**:
- You need to prioritize features by impact
- You're doing product planning
- You want data-driven prioritization

**Use WSJF when**:
- You're using SAFe or Agile at scale
- You need weighted prioritization
- You're optimizing for shortest job first

**Use `release_slice` when**:
- You're planning releases
- You need to group tasks by version/sprint
- You're doing roadmap planning

---

## Migration Script

Use the provided migration script to automatically upgrade task files:

```bash
# Migrate a single task
npx ts-node .opencode/skills/task-management/scripts/migrate-schema.ts \
  --task multi-stage-orchestration-workflow

# Migrate all tasks
npx ts-node .opencode/skills/task-management/scripts/migrate-schema.ts --all

# Dry run (preview changes without writing)
npx ts-node .opencode/skills/task-management/scripts/migrate-schema.ts \
  --task auth-system --dry-run

# Add line-number precision only
npx ts-node .opencode/skills/task-management/scripts/migrate-schema.ts \
  --task auth-system --lines-only

# Add domain modeling fields
npx ts-node .opencode/skills/task-management/scripts/migrate-schema.ts \
  --task auth-system --add-domain \
  --bounded-context authentication \
  --module @app/auth
```

### Script Options

| Option | Description |
|--------|-------------|
| `--task <name>` | Migrate specific task |
| `--all` | Migrate all tasks in .tmp/tasks/ |
| `--dry-run` | Preview changes without writing |
| `--lines-only` | Add line-number precision only |
| `--add-domain` | Add domain modeling fields |
| `--bounded-context <name>` | Set bounded_context |
| `--module <name>` | Set module |
| `--vertical-slice <name>` | Set vertical_slice |
| `--release <name>` | Set release_slice |

---

## Backward Compatibility Guarantees

### 1. Old Format Still Works

**Guarantee**: All existing task.json and subtask_NN.json files work without modification.

**Example**:
```json
// This still works perfectly
"context_files": [
  ".opencode/context/core/standards/code-quality.md"
]
```

### 2. Mixed Formats Allowed

**Guarantee**: You can mix old and new formats in the same file.

**Example**:
```json
"context_files": [
  ".opencode/context/core/standards/code-quality.md",
  {
    "path": ".opencode/context/core/standards/security-patterns.md",
    "lines": "120-145",
    "reason": "JWT validation"
  }
]
```

### 3. All New Fields Optional

**Guarantee**: No new fields are required. Add them only when needed.

### 4. Agent Compatibility

**Guarantee**: All agents handle both old and new formats automatically.

**Implementation**:
```typescript
function loadContextFile(ref: string | ContextFileReference): string {
  if (typeof ref === 'string') {
    // Old format: read entire file
    return readFile(ref);
  } else {
    // New format: read specified lines
    const content = readFile(ref.path);
    if (ref.lines) {
      return extractLines(content, ref.lines);
    }
    return content;
  }
}
```

---

## Common Migration Pitfalls

### Pitfall 1: Breaking String Format

**Wrong** ❌:
```json
"context_files": [
  {
    ".opencode/context/core/standards/code-quality.md"
  }
]
```

**Right** ✅:
```json
"context_files": [
  {
    "path": ".opencode/context/core/standards/code-quality.md",
    "lines": "53-95",
    "reason": "Pure function patterns"
  }
]
```

**Fix**: Use `path` field, not bare string in object.

---

### Pitfall 2: Invalid Line Ranges

**Wrong** ❌:
```json
{
  "lines": "10-5"  // End before start
}
```

**Wrong** ❌:
```json
{
  "lines": "abc-def"  // Non-numeric
}
```

**Right** ✅:
```json
{
  "lines": "10-50"  // Valid range
}
```

**Right** ✅:
```json
{
  "lines": "1-20,45-60"  // Multiple ranges
}
```

**Fix**: Use format `"start-end"` or `"start1-end1,start2-end2"` with valid numbers.

---

### Pitfall 3: Mixing Standards and Source Files

**Wrong** ❌:
```json
"context_files": [
  ".opencode/context/core/standards/code-quality.md",
  "src/auth/service.ts"  // Source file in context_files!
]
```

**Right** ✅:
```json
"context_files": [
  ".opencode/context/core/standards/code-quality.md"
],
"reference_files": [
  "src/auth/service.ts"
]
```

**Fix**: Standards go in `context_files`, source code goes in `reference_files`.

---

### Pitfall 4: Forgetting `path` Field

**Wrong** ❌:
```json
{
  "lines": "10-50",
  "reason": "Pure functions"
  // Missing path!
}
```

**Right** ✅:
```json
{
  "path": ".opencode/context/core/standards/code-quality.md",
  "lines": "10-50",
  "reason": "Pure functions"
}
```

**Fix**: Always include `path` field in object format.

---

### Pitfall 5: Over-Engineering Simple Tasks

**Wrong** ❌:
```json
{
  "id": "simple-task-01",
  "title": "Fix typo in README",
  "context_files": [
    {
      "path": ".opencode/context/core/standards/code-quality.md",
      "lines": "1-165",
      "reason": "All standards"
    }
  ],
  "bounded_context": "documentation",
  "module": "@app/docs",
  "rice_score": { "reach": 1, "impact": 0.25, "confidence": 100, "effort": 0.1 }
}
```

**Right** ✅:
```json
{
  "id": "simple-task-01",
  "title": "Fix typo in README",
  "deliverables": ["README.md"]
}
```

**Fix**: Don't add enhanced fields to simple tasks. Use them only when they add value.

---

## Integration with Existing Workflows

### TaskManager Agent

**No changes required.** TaskManager can create tasks in either format.

**Recommendation**: Use enhanced format for new tasks, especially:
- Line-number precision for large context files
- Domain modeling for architecture visibility
- Contracts for API-driven development

### CoderAgent

**No changes required.** CoderAgent handles both formats automatically.

**Behavior**:
- String format → reads entire file
- Object format → reads specified lines only
- Logs line ranges and reasons for transparency

### Task CLI

**No changes required.** All CLI commands work with both formats.

**Commands**:
```bash
# Works with both old and new formats
npx ts-node .opencode/skills/task-management/scripts/task-cli.ts status
npx ts-node .opencode/skills/task-management/scripts/task-cli.ts next auth-system
npx ts-node .opencode/skills/task-management/scripts/task-cli.ts validate auth-system
```

### Orchestrator

**No changes required.** Orchestrator reads both formats.

**Benefit**: Enhanced fields (contracts, ADRs) provide better context for orchestration decisions.

---

## Migration Checklist

### Phase 1: Line-Number Precision

- [ ] Identify large context files (>100 lines)
- [ ] Determine relevant line ranges for each task
- [ ] Add `lines` and `reason` fields
- [ ] Test with CoderAgent to verify correct sections loaded
- [ ] Update reference_files with line ranges if needed

### Phase 2: Domain Modeling

- [ ] Define bounded contexts for your project
- [ ] Map tasks to bounded contexts
- [ ] Add `bounded_context` field to task.json files
- [ ] Add `module` field if using modular architecture
- [ ] Add `vertical_slice` field if using vertical slices

### Phase 3: Contracts and ADRs

- [ ] Identify API contracts in your project
- [ ] Add `contracts` field to relevant tasks
- [ ] Link ADR documents to tasks
- [ ] Add `related_adrs` field with ADR references
- [ ] Update contract status as implementation progresses

### Phase 4: Prioritization

- [ ] Calculate RICE scores for features
- [ ] Add `rice_score` to task.json files
- [ ] Calculate WSJF scores if using SAFe
- [ ] Add `wsjf_score` to task.json files
- [ ] Group tasks by release using `release_slice`

### Phase 5: Validation

- [ ] Run migration script with `--dry-run`
- [ ] Review generated changes
- [ ] Run `task-cli.ts validate` on migrated tasks
- [ ] Test with CoderAgent on sample tasks
- [ ] Verify backward compatibility with old tasks

---

## FAQ

### Q: Do I have to migrate all tasks at once?

**A**: No. You can migrate incrementally. Old and new formats work together.

### Q: Will old tasks break after migration?

**A**: No. All old tasks continue to work without modification.

### Q: Can I mix old and new formats in the same file?

**A**: Yes. You can have some context_files as strings and others as objects.

### Q: What if I don't know the line ranges?

**A**: Use the old string format first. Refine to line ranges later when you know which sections matter.

### Q: Do I need to add all enhanced fields?

**A**: No. Add only the fields that provide value for your use case.

### Q: How do I find the right line ranges?

**A**: 
1. Read the file manually
2. Use `grep -n` to find relevant sections
3. Use the migration script's `--dry-run` mode to preview
4. Refine based on agent feedback

### Q: What if line numbers change when files are updated?

**A**: Update line ranges when you update the referenced files. Consider using section headers instead of line numbers for more stable references (future enhancement).

### Q: Can I use the enhanced schema for new projects?

**A**: Yes. Start with enhanced schema from day one if you know you'll need the features.

### Q: Is there a performance benefit to line-number precision?

**A**: Yes. Agents load less content, reducing token usage and processing time.

### Q: How do I validate migrated tasks?

**A**: Use `task-cli.ts validate <feature>` to check JSON structure and dependencies.

---

## Related Documentation

- **Base Schema**: `.opencode/context/core/task-management/standards/task-schema.md`
- **Enhanced Schema**: `.opencode/context/core/task-management/standards/enhanced-task-schema.md`
- **Task Splitting Guide**: `.opencode/context/core/task-management/guides/splitting-tasks.md`
- **Task Management Guide**: `.opencode/context/core/task-management/guides/managing-tasks.md`
- **CLI Reference**: `.opencode/context/core/task-management/lookup/task-commands.md`

---

## Support

For issues or questions:
1. Check this migration guide
2. Review enhanced-task-schema.md for field definitions
3. Run migration script with `--dry-run` to preview changes
4. Test with small tasks first before migrating large features
