# Integration Tests

**Priority**: LOW (Complex scenarios)  
**Timeout**: 120-300s  
**Must Pass**: NICE TO HAVE (validates real-world usage)

## Purpose

Complex multi-turn scenarios that test multiple features working together:
- Multiple workflow stages
- Context loading + delegation
- Error handling + recovery
- Multi-agent coordination

## Subfolders

### simple/ (1-2 turns, single context)
Simple multi-turn conversations with minimal complexity.

**Characteristics**:
- 1-2 user messages
- Single context file
- Single workflow path
- No delegation

**Timeout**: 120s

**Example**:
```yaml
prompts:
  - text: "What are our coding standards?"
  - text: "Create a function following those standards"
```

### medium/ (3-5 turns, multiple contexts)
Medium complexity with multiple contexts and workflows.

**Characteristics**:
- 3-5 user messages
- Multiple context files
- May involve delegation
- Multiple workflow stages

**Timeout**: 180s

**Example**:
```yaml
prompts:
  - text: "What are our coding standards?"
  - text: "What are our documentation standards?"
  - text: "Create a function with documentation"
  - text: "approve"
```

### complex/ (6+ turns, delegation + validation)
Complex scenarios with full workflow validation.

**Characteristics**:
- 6+ user messages
- Multiple context files
- Delegation required
- Full workflow: Analyze→Approve→Execute→Validate→Summarize→Confirm
- Error handling and recovery

**Timeout**: 300s (5 minutes)

**Example**:
```yaml
prompts:
  - text: "Create authentication system (5 files)"
  - text: "approve delegation"
  - text: "Run tests"
  - text: "approve test run"
  # Test fails
  - text: "Fix the errors"
  - text: "approve fix"
  - text: "Run tests again"
  - text: "approve"
```

## File Creation Rules

All file operations use safe paths:

```yaml
# ✅ CORRECT
evals/test_tmp/
.tmp/sessions/{session-id}/
.tmp/context/{session-id}/

# ❌ WRONG
/tmp/
~/
```

## Running These Tests

```bash
# Run all integration tests (SLOW - 15-30 min)
npm run eval:sdk -- --agent=openagent --pattern="06-integration/**/*.yaml"

# Run by complexity
npm run eval:sdk -- --agent=openagent --pattern="06-integration/simple/*.yaml"
npm run eval:sdk -- --agent=openagent --pattern="06-integration/medium/*.yaml"
npm run eval:sdk -- --agent=openagent --pattern="06-integration/complex/*.yaml"
```

## Success Criteria

These tests validate real-world usage patterns:
- **SHOULD pass** for production readiness
- **MAY fail** during development
- **MUST pass** before major releases

Failures here indicate issues with complex workflows, not basic functionality.

## Test Design Guidelines

### Simple Tests
- Focus on single feature
- Minimal user interaction
- Clear success criteria

### Medium Tests
- Test feature combinations
- Multiple contexts
- Realistic workflows

### Complex Tests
- Full end-to-end scenarios
- Error handling
- Recovery workflows
- Multi-agent coordination

## Debugging

For complex tests that fail:

1. **Run with --debug flag**:
   ```bash
   npm run eval:sdk -- --agent=openagent --pattern="06-integration/complex/01-*.yaml" --debug
   ```

2. **Check session files** (preserved in debug mode):
   ```bash
   ls ~/.local/share/opencode/storage/session/
   ```

3. **Review event timeline**:
   - Look for missing stages
   - Check tool call sequence
   - Verify context loading

4. **Simplify the test**:
   - Remove turns to isolate issue
   - Test individual stages separately
   - Move to simpler category if needed
