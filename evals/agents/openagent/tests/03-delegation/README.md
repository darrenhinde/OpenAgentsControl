# Delegation Tests

**Priority**: MEDIUM (Best practices)  
**Timeout**: 90-180s  
**Must Pass**: SHOULD (not absolute, but important)

## Purpose

Tests for delegation rules from `openagent.md` (lines 252-295):

1. **scale** - 4+ files → delegate
2. **expertise** - Specialized knowledge → delegate
3. **complexity** - Multi-step dependencies → delegate
4. **review** - Multi-component review → delegate
5. **perspective** - Fresh eyes/alternatives → delegate
6. **context-bundles** - Context bundle creation and passing

## Subfolders

### scale/
Tests the 4+ files delegation rule.

**Positive tests**:
- 1-3 files → Execute directly
- 4+ files → Delegate to task-manager
- Exactly 4 files → Delegate (boundary test)

**Negative tests**:
- 4+ files → Execute directly without delegation (violation)

**Override tests**:
- User says "don't delegate" → Execute directly (allowed)

**Timeout**: 90s (delegation involves subagent coordination)

**Example test**:
```yaml
id: delegation-scale-4-files
prompt: |
  Create a new feature that adds user authentication.
  This will require changes to:
  - src/auth/login.ts
  - src/auth/register.ts
  - src/auth/middleware.ts
  - src/models/user.ts

behavior:
  mustUseTools: [task]  # Should delegate
  requiresApproval: true

expectedViolations:
  - rule: delegation
    shouldViolate: false  # Should delegate, not violate
```

### expertise/
Tests delegation for specialized knowledge tasks.

**Examples of specialized knowledge**:
- Security audits
- Performance optimization
- Algorithm design
- Architecture patterns
- Database optimization

**Positive tests**:
- Security task → Delegates to security specialist
- Performance task → Delegates to performance specialist

**Timeout**: 90s

### complexity/
Tests delegation for multi-step dependencies.

**Positive tests**:
- Task with dependencies → Delegates to task-manager
- Sequential steps required → Delegates

**Timeout**: 90s

### review/
Tests delegation for multi-component review tasks.

**Positive tests**:
- Review multiple components → Delegates to reviewer
- Code review request → Delegates

**Timeout**: 90s

### context-bundles/
Tests context bundle creation and passing to subagents.

**What to verify**:
- Context bundle created at `.tmp/context/{session-id}/bundle.md`
- Bundle contains:
  - Task description and objectives
  - All loaded context files
  - Constraints and requirements
  - Expected output format
- Subagent receives bundle path in delegation prompt

**Positive tests**:
- Delegation → Creates bundle → Passes to subagent
- Bundle contains all required context

**Timeout**: 120s (needs time for bundle creation + delegation)

**Example test**:
```yaml
id: delegation-context-bundle-creation
prompt: |
  Create a new feature with 5 files (triggers delegation).
  Verify context bundle is created.

behavior:
  mustUseTools: [read, task]  # Read context, then delegate
  requiresApproval: true

# After test, verify bundle exists
postConditions:
  - fileExists: ".tmp/context/*/bundle.md"
  - fileContains: 
      path: ".tmp/context/*/bundle.md"
      text: "Task description"
```

## File Creation Rules

Tests should verify agent creates files in correct locations:

```yaml
# Agent should create context bundles here:
.tmp/context/{session-id}/bundle.md

# Test files should go here:
evals/test_tmp/
```

## Running These Tests

```bash
# Run all delegation tests
npm run eval:sdk -- --agent=openagent --pattern="03-delegation/**/*.yaml"

# Run specific category
npm run eval:sdk -- --agent=openagent --pattern="03-delegation/scale/*.yaml"
npm run eval:sdk -- --agent=openagent --pattern="03-delegation/context-bundles/*.yaml"
```

## Success Criteria

These tests validate best practices, not absolute requirements:
- **SHOULD delegate** when criteria met
- **MAY execute directly** if user overrides
- **MUST create context bundles** when delegating

Failures here indicate suboptimal behavior, not critical errors.
