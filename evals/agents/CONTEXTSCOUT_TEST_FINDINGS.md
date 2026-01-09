# ContextScout Integration Test Findings

**Date**: 2026-01-09  
**Status**: Tests Created, Initial Run Complete

---

## Summary

We created comprehensive tests for ContextScout integration and ran initial tests. Here's what we learned:

---

## Key Findings

### 1. OpenAgent Does NOT Use ContextScout Proactively ❌

**Test**: `04-implicit-discovery.yaml` - "How does the registry system work?"

**Expected**: OpenAgent should delegate to ContextScout to discover registry context files

**Actual**: OpenAgent used `grep` and `read` directly to find information
- Used `grep` to search for "registry"
- Read `registry.json` directly
- Used `grep` to search for "auto-detect"
- Eventually found `.opencode/context/openagents-repo/core-concepts/registry.md`
- **Did NOT use the `task` tool to delegate to ContextScout**

**Conclusion**: OpenAgent is NOT proactively using ContextScout for discovery. It's doing its own searching.

---

### 2. OpenAgent Provides Minimal Responses for Discovery Requests ⚠️

**Test**: `02-unknown-domain-discovery.yaml` - "Explain how the eval framework works"

**Expected**: OpenAgent should use ContextScout and provide comprehensive answer

**Actual**: OpenAgent made only 1 tool call and provided minimal response
- Very short execution time (14.5s)
- Only 1 tool call (insufficient for discovery)
- Did NOT delegate to ContextScout

**Conclusion**: OpenAgent may be treating discovery requests as conversational rather than requiring deep context loading.

---

### 3. ContextScout Cannot Be Tested in True Standalone Mode 🔧

**Test**: `01-code-standards-discovery.yaml` via `--subagent=contextscout`

**Expected**: ContextScout runs as `mode: primary` and uses glob/read directly

**Actual**: Even in "standalone" mode, ContextScout is wrapped by a parent agent
- Test runner forces `mode: primary` (confirmed in debug logs)
- But ContextScout still tries to delegate to itself via `task` tool
- Tool calls show: `task → ContextScout` (recursive!)
- The test framework captures parent agent's tool calls, not nested subagent's

**Conclusion**: The eval framework's "standalone" mode doesn't truly run subagents standalone. They're still invoked through a parent wrapper.

---

### 4. Test Framework Limitations 📊

**Issue**: When testing subagents, the framework captures the parent agent's tool usage, not the subagent's internal tool usage.

**Impact**:
- Can't validate that ContextScout uses `glob/read/grep` internally
- Can only validate that parent agent delegates to ContextScout
- Behavior expectations (mustUseTools) check parent, not subagent

**Workaround Needed**: 
- Option A: Test ContextScout via delegation mode (`--subagent=contextscout --delegate`)
- Option B: Modify test framework to capture nested subagent tool calls
- Option C: Create integration tests that check end-to-end behavior

---

## Test Results Summary

| Test | Agent | Expected Behavior | Actual Behavior | Status |
|------|-------|-------------------|-----------------|--------|
| 04-implicit-discovery | OpenAgent | Use ContextScout | Used grep/read directly | ❌ FAIL |
| 02-unknown-domain | OpenAgent | Use ContextScout | Minimal response, no delegation | ❌ FAIL |
| 01-code-standards | ContextScout | Use glob/read | Delegated to itself (wrapper issue) | ❌ FAIL |

---

## Root Cause Analysis

### Why OpenAgent Doesn't Use ContextScout

Looking at OpenAgent's prompt (`.opencode/agent/core/openagent.md`):

**Stage 3.0: DiscoverContext** is marked as `optional="true"`

```xml
<step id="3.0" name="DiscoverContext" optional="true">
  OPTIONAL: Use ContextScout to discover relevant context files intelligently
  
  When to use ContextScout:
  - Unfamiliar with project structure or domain
  - Need to find domain-specific patterns or standards
  - Looking for examples, guides, or error solutions
  - Want to ensure you have all relevant context before proceeding
```

**Problem**: The step is optional, and the criteria are vague. OpenAgent can easily skip this step and use its own tools (grep/read) instead.

**Why this happens**:
1. OpenAgent has access to `grep` and `read` tools
2. Using grep/read is faster than delegating to ContextScout
3. The "when to use" criteria are subjective
4. No enforcement mechanism to ensure ContextScout is used

---

## Recommendations

### Short Term: Fix OpenAgent Prompt

**Option 1**: Make ContextScout usage more explicit for unfamiliar domains

```xml
<step id="3.0" name="DiscoverContext" required="conditional">
  Check if task involves unfamiliar domain:
  - Registry system, eval framework, agent creation, etc.
  
  IF unfamiliar domain:
    MUST delegate to ContextScout for discovery
  ELSE:
    MAY load known context directly
```

**Option 2**: Add a decision tree

```
Is this a standard task (code/docs/tests)? 
  YES → Load known context directly (.opencode/context/core/standards/*)
  NO → Is this domain-specific (registry, evals, agents)?
    YES → MUST use ContextScout for discovery
    NO → Proceed with available context
```

### Medium Term: Improve Test Framework

**Issue**: Can't test subagents in true standalone mode

**Solution**: Add nested tool call capture
- Track tool calls from parent AND subagents
- Separate validation for parent vs subagent behavior
- Add `nestedToolCalls` to test expectations

### Long Term: Evaluate ContextScout Value

**Question**: Is ContextScout actually needed?

**Evidence**:
- OpenAgent can discover context using grep/read directly
- ContextScout adds delegation overhead
- Agents aren't using it proactively

**Options**:
1. **Keep ContextScout**: Make usage mandatory for specific scenarios
2. **Simplify**: Remove ContextScout, improve direct discovery
3. **Hybrid**: Use ContextScout only for complex multi-domain queries

---

## Next Steps

### Immediate Actions

1. ✅ **Document findings** (this file)
2. ⏳ **Decide on ContextScout strategy**:
   - Make it mandatory for unfamiliar domains?
   - Remove it and improve direct discovery?
   - Keep it optional but improve prompts?

3. ⏳ **Fix test framework** to support true subagent testing
4. ⏳ **Update OpenAgent/OpenCoder prompts** based on decision

### Test Strategy Going Forward

**For now, focus on integration tests**:
- Test that OpenAgent CAN delegate to ContextScout (delegation mode)
- Test end-to-end behavior (does agent find correct context?)
- Don't worry about internal tool usage until framework supports it

**Create simpler tests**:
- Does OpenAgent find correct context files? (regardless of how)
- Does OpenAgent load context before execution?
- Does OpenAgent provide accurate answers?

---

## Files Created

### OpenAgent Integration Tests
- `evals/agents/core/openagent/tests/contextscout-integration/04-implicit-discovery.yaml`
- `evals/agents/core/openagent/tests/contextscout-integration/05-multi-domain-comprehensive.yaml`

### OpenCoder Integration Tests
- `evals/agents/core/opencoder/tests/contextscout-integration/01-implicit-pattern-discovery.yaml`
- `evals/agents/core/opencoder/tests/contextscout-integration/README.md`

### ContextScout Functionality Tests
- `evals/agents/ContextScout/tests/01-code-standards-discovery.yaml`
- `evals/agents/ContextScout/tests/02-domain-specific-discovery.yaml`
- `evals/agents/ContextScout/tests/03-bad-request-handling.yaml`
- `evals/agents/ContextScout/tests/04-multi-domain-comprehensive.yaml`
- `evals/agents/ContextScout/tests/05-tool-usage-validation.yaml`
- `evals/agents/ContextScout/tests/README.md`

### Documentation
- `evals/agents/CONTEXTSCOUT_INTEGRATION_TESTS.md` - Comprehensive test suite overview
- `evals/agents/CONTEXTSCOUT_TEST_FINDINGS.md` - This file

### Framework Updates
- Updated `evals/framework/src/sdk/run-sdk-tests.ts` - Added contextscout to subagent maps
- Updated `evals/framework/src/sdk/test-runner.ts` - Added contextscout to agent map
- Updated `evals/agents/ContextScout/config/config.yaml` - Added test suites

---

## Conclusion

**The tests revealed that OpenAgent and OpenCoder are NOT proactively using ContextScout as intended.** They're using their own discovery tools (grep/read) instead, which is actually faster but potentially less comprehensive.

**Decision needed**: Should we:
1. Enforce ContextScout usage for unfamiliar domains?
2. Remove ContextScout and improve direct discovery?
3. Keep current approach (optional ContextScout)?

**Test framework limitation**: Can't validate subagent internal behavior in standalone mode. Need to either fix framework or focus on integration/delegation tests.

---

**Next conversation**: Decide on ContextScout strategy and update agent prompts accordingly.
