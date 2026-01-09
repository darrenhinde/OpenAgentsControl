# ContextScout Integration Tests

**Purpose**: Validate that OpenAgent uses ContextScout effectively - at the right time, for the right reasons, with the right outcomes.

**Created**: 2026-01-07  
**Status**: Ready to Run

---

## The Big Question

**Should we use ContextScout to help agents discover context, or is it adding unnecessary complexity?**

These tests answer:
1. ✅ When should agents use ContextScout vs. direct loading?
2. ✅ Does ContextScout improve accuracy and completeness?
3. ✅ What's the performance trade-off?
4. ✅ Are agents using it predictably?

---

## Test Suite

### Test 1: Known Context - Direct Loading ⚡
**File**: `01-known-context-direct-load.yaml`

**Scenario**: "Write a fibonacci function"

**Expected**: Agent should DIRECTLY load `code.md` without using ContextScout

**Why**: For standard tasks (code/docs/tests), the context path is well-known. ContextScout adds overhead without value.

**Success Criteria**:
- ✅ Loads `.opencode/context/core/standards/code.md`
- ✅ Does NOT use task tool (no ContextScout delegation)
- ✅ Completes in <30 seconds

---

### Test 2: Unknown Domain - Discovery 🔍
**File**: `02-unknown-domain-discovery.yaml`

**Scenario**: "Explain how the eval framework works"

**Expected**: Agent should USE ContextScout to discover eval-specific context

**Why**: For domain-specific topics, agents don't know what context exists. ContextScout discovers relevant files.

**Success Criteria**:
- ✅ Delegates to ContextScout
- ✅ Finds `.opencode/context/openagents-repo/core-concepts/evals.md`
- ✅ Loads discovered files
- ✅ Provides comprehensive answer

---

### Test 3: Accuracy - Correct Files 🎯
**File**: `03-accuracy-correct-files.yaml`

**Scenario**: "What are the MVI principles?"

**Expected**: ContextScout finds the CORRECT file (mvi.md), not random files

**Why**: Validates ContextScout's search accuracy and relevance filtering.

**Success Criteria**:
- ✅ Uses ContextScout to search
- ✅ Finds `.opencode/context/core/context-system/standards/mvi.md`
- ✅ No irrelevant files loaded
- ✅ Accurate explanation of MVI

---

## Running the Tests

### Run All Integration Tests
```bash
cd evals/framework
npm run eval:sdk -- --agent=core/openagent --pattern="contextscout-integration/*.yaml"
```

### Run Individual Tests
```bash
# Test 1: Known context (should NOT use ContextScout)
npm run eval:sdk -- --agent=core/openagent --pattern="01-known-context-direct-load.yaml"

# Test 2: Unknown domain (should use ContextScout)
npm run eval:sdk -- --agent=core/openagent --pattern="02-unknown-domain-discovery.yaml"

# Test 3: Accuracy (ContextScout finds correct files)
npm run eval:sdk -- --agent=core/openagent --pattern="03-accuracy-correct-files.yaml"
```

### Run Without Evaluators (Focus on Behavior)
```bash
npm run eval:sdk -- --agent=core/openagent --pattern="contextscout-integration/*.yaml" --no-evaluators
```

---

## Interpreting Results

### Scenario A: ContextScout is "The Way Forward" ✅

**If tests show**:
- Test 1: Agent loads code.md directly (fast, no ContextScout)
- Test 2: Agent uses ContextScout, finds eval context (accurate discovery)
- Test 3: ContextScout finds mvi.md correctly (high accuracy)

**Conclusion**: ContextScout is valuable for discovery, agents use it intelligently

**Action**: Keep ContextScout, refine when/how agents use it

---

### Scenario B: ContextScout Adds Overhead Without Value ❌

**If tests show**:
- Test 1: Agent uses ContextScout for simple task (unnecessary overhead)
- Test 2: Agent doesn't use ContextScout, misses domain context (inconsistent)
- Test 3: ContextScout finds wrong files (poor accuracy)

**Conclusion**: ContextScout isn't helping, agents aren't using it predictably

**Action**: Remove ContextScout OR fix agent decision-making

---

### Scenario C: Mixed Results - Needs Refinement ⚠️

**If tests show**:
- Test 1: Sometimes uses ContextScout, sometimes doesn't (unpredictable)
- Test 2: Uses ContextScout but takes too long (>60s)
- Test 3: Finds correct files but also loads irrelevant ones (noisy)

**Conclusion**: ContextScout has potential but needs tuning

**Action**: Refine agent prompts, improve ContextScout search, add decision criteria

---

## Decision Matrix

| Test Result | Interpretation | Action |
|-------------|----------------|--------|
| All 3 pass | ✅ ContextScout working as designed | Keep it, document best practices |
| Test 1 fails (uses ContextScout) | ⚠️ Agents using it when they shouldn't | Refine agent decision logic |
| Test 2 fails (no ContextScout) | ⚠️ Agents not using it when they should | Update agent prompts |
| Test 3 fails (wrong files) | ❌ ContextScout search accuracy poor | Improve ContextScout search logic |
| All 3 fail | ❌ ContextScout not ready | Disable or redesign |

---

## Success Metrics

### ContextScout is "Worth It" if:

1. **Accuracy**: Finds correct files 90%+ of the time (Test 3)
2. **Efficiency**: Agents skip it for known tasks (Test 1)
3. **Discovery**: Agents use it for unknown domains (Test 2)
4. **Speed**: Adds <30s overhead for discovery (Test 2)
5. **Predictability**: Consistent behavior across runs

### ContextScout is "Not Worth It" if:

1. **Overhead**: Used for simple tasks where direct loading is faster
2. **Inaccuracy**: Finds wrong files >20% of the time
3. **Unpredictability**: Random usage, no clear pattern
4. **Complexity**: Makes workflows harder to understand
5. **Slowness**: Adds >60s to task completion

---

## Next Steps

1. **Run Phase 1 tests** (these 3 tests)
2. **Analyze results** using decision matrix above
3. **Decide**: Is ContextScout improving workflows?
4. **If YES**: Document best practices, add more tests
5. **If NO**: Disable ContextScout, use direct loading only
6. **If MIXED**: Refine agent prompts and ContextScout search

---

## Related Documentation

- [ContextScout Agent](.opencode/agent/ContextScout.md)
- [ContextScout Tests](../../../ContextScout/README.md)
- [OpenAgent Workflow](.opencode/agent/core/openagent.md)
- [Test Plan](./contextscout-integration-test-plan.md)

---

**Key Insight**: ContextScout should be a **discovery tool** for unknown domains, NOT a replacement for direct loading of well-known context paths. These tests validate this hypothesis.
