# ContextScout Integration Test Plan

**Purpose**: Validate that OpenAgent and OpenCoder use ContextScout effectively to discover and load the RIGHT context at the RIGHT time.

**Date**: 2026-01-07  
**Status**: Draft - Ready for Review

---

## Core Questions

1. **When should agents use ContextScout vs. hardcoded context paths?**
2. **Does ContextScout improve speed, accuracy, or predictability?**
3. **Are agents using ContextScout when they should?**
4. **Does ContextScout help or hurt the workflow?**

---

## Test Scenarios

### Scenario 1: Known Context (Hardcoded Paths Should Win)

**Task**: "Write a new function to calculate fibonacci numbers"

**Expected Behavior**:
- Agent should DIRECTLY load `.opencode/context/core/standards/code.md`
- NO need for ContextScout (path is well-known)
- Fast execution (no discovery overhead)

**Why**: For standard tasks (code/docs/tests), agents already know the context path. ContextScout adds overhead without value.

**Test**:
```yaml
name: "OpenCoder: Known Context - Direct Loading"
prompts:
  - text: "Write a new function to calculate fibonacci numbers"
expectations:
  - type: context_loaded
    contexts: [".opencode/context/core/standards/code.md"]
  - type: tool_not_called
    tool: "task"
    reason: "Should not delegate to ContextScout for known context"
  - type: max_duration
    value: 30000  # Should be fast without discovery
```

---

### Scenario 2: Unknown Domain (ContextScout Should Help)

**Task**: "Find context files about eval framework testing patterns"

**Expected Behavior**:
- Agent should use ContextScout to discover eval-specific context
- ContextScout finds `.opencode/context/openagents-repo/core-concepts/evals.md`
- Agent loads discovered files
- More accurate than guessing

**Why**: For domain-specific or unfamiliar topics, ContextScout discovers relevant files that agents might miss.

**Test**:
```yaml
name: "OpenAgent: Unknown Domain - ContextScout Discovery"
prompts:
  - text: "Find context files about eval framework testing patterns"
expectations:
  - type: tool_called
    tool: "task"
    args_contain: "ContextScout"
  - type: context_loaded
    contexts: [".opencode/context/openagents-repo/core-concepts/evals.md"]
  - type: max_duration
    value: 60000  # Discovery adds time, but finds right context
```

---

### Scenario 3: Ambiguous Task (ContextScout Clarifies)

**Task**: "Help me improve the documentation"

**Expected Behavior**:
- Agent unsure which docs (code docs? user docs? API docs?)
- Uses ContextScout to discover available doc standards
- ContextScout returns multiple options with priorities
- Agent asks user to clarify OR picks most relevant

**Why**: ContextScout helps agents understand what context exists when task is vague.

**Test**:
```yaml
name: "OpenAgent: Ambiguous Task - ContextScout Clarification"
prompts:
  - text: "Help me improve the documentation"
expectations:
  - type: tool_called
    tool: "task"
    args_contain: "contextscout"
  - type: output_contains
    value: "documentation"
  - type: behavior
    check: "agent_asks_for_clarification OR agent_loads_relevant_context"
```

---

### Scenario 4: Multi-Domain Task (ContextScout Finds All)

**Task**: "Create a new agent with tests and documentation"

**Expected Behavior**:
- Agent needs: code standards, test standards, doc standards, agent creation guide
- Uses ContextScout to discover ALL relevant files
- ContextScout returns prioritized list
- Agent loads in correct order

**Why**: Complex tasks need multiple context files. ContextScout ensures nothing is missed.

**Test**:
```yaml
name: "OpenAgent: Multi-Domain - ContextScout Comprehensive Discovery"
prompts:
  - text: "Create a new agent with tests and documentation"
expectations:
  - type: tool_called
    tool: "task"
    args_contain: "contextscout"
  - type: context_loaded
    contexts:
      - ".opencode/context/core/standards/code.md"
      - ".opencode/context/core/standards/tests.md"
      - ".opencode/context/core/standards/docs.md"
      - ".opencode/context/openagents-repo/guides/adding-agent.md"
  - type: loading_order
    check: "critical_files_loaded_first"
```

---

### Scenario 5: Speed Test (Direct vs. Discovery)

**Task A**: "Write a function" (direct loading)  
**Task B**: "Write a function" (with ContextScout discovery)

**Expected Behavior**:
- Task A: Loads code.md directly (~5-10s)
- Task B: Uses ContextScout, then loads code.md (~15-25s)
- Task A should be faster for known context

**Why**: Measure the overhead of ContextScout for known tasks.

**Test**:
```yaml
name: "Performance: Direct Loading vs. ContextScout Discovery"
variants:
  - name: "direct"
    force_behavior: "skip_contextscout"
    expected_duration: 10000
  - name: "discovery"
    force_behavior: "use_contextscout"
    expected_duration: 25000
comparison:
  - type: duration_difference
    max_overhead: 15000  # ContextScout should add <15s
```

---

### Scenario 6: Accuracy Test (Does ContextScout Find Right Files?)

**Task**: "Find context about MVI principles"

**Expected Behavior**:
- ContextScout searches for "MVI"
- Finds `.opencode/context/core/context-system/standards/mvi.md`
- Returns exact path with line ranges
- Agent loads correct file

**Why**: Validate ContextScout's search accuracy.

**Test**:
```yaml
name: "Accuracy: ContextScout Finds Correct Files"
prompts:
  - text: "Find context about MVI principles"
expectations:
  - type: tool_called
    tool: "task"
    args_contain: "contextscout"
  - type: context_loaded
    contexts: [".opencode/context/core/context-system/standards/mvi.md"]
  - type: no_false_positives
    check: "only_relevant_files_loaded"
```

---

### Scenario 7: Predictability Test (Consistent Behavior)

**Task**: Run same task 5 times, check if agent uses ContextScout consistently

**Expected Behavior**:
- For known tasks: NEVER uses ContextScout (5/5 times)
- For unknown tasks: ALWAYS uses ContextScout (5/5 times)
- Consistent decision-making

**Why**: Agents should be predictable, not random.

**Test**:
```yaml
name: "Predictability: Consistent ContextScout Usage"
iterations: 5
prompts:
  - text: "Write a function to parse JSON"  # Known task
expectations:
  - type: consistency
    check: "contextscout_usage_same_across_runs"
  - type: expected_behavior
    value: "never_uses_contextscout"  # Known context path
```

---

## Decision Matrix: When to Use ContextScout

| Scenario | Use ContextScout? | Why |
|----------|-------------------|-----|
| Standard code task | ❌ NO | Path known: `.opencode/context/core/standards/code.md` |
| Standard docs task | ❌ NO | Path known: `.opencode/context/core/standards/docs.md` |
| Standard tests task | ❌ NO | Path known: `.opencode/context/core/standards/tests.md` |
| Domain-specific task | ✅ YES | Need to discover domain context (e.g., evals, registry) |
| Unfamiliar topic | ✅ YES | Don't know what context exists |
| Multi-domain task | ✅ YES | Need to find ALL relevant files |
| Ambiguous request | ✅ YES | Clarify what context is available |
| Error/troubleshooting | ✅ YES | Find error-specific guides |

---

## Success Criteria

### ContextScout is "The Way Forward" if:

1. ✅ **Accuracy**: Finds correct context files 95%+ of the time
2. ✅ **Speed**: Adds <15s overhead for discovery
3. ✅ **Predictability**: Agents use it consistently for unknown domains
4. ✅ **Value**: Improves outcomes for complex/multi-domain tasks
5. ✅ **Simplicity**: Doesn't add confusion or complexity

### ContextScout is "Not Worth It" if:

1. ❌ **Slow**: Adds >30s overhead
2. ❌ **Inaccurate**: Finds wrong files >20% of the time
3. ❌ **Unpredictable**: Agents use it randomly
4. ❌ **Overhead**: Used for simple tasks where direct loading is better
5. ❌ **Complexity**: Makes workflows harder to understand

---

## Recommended Test Implementation

### Phase 1: Basic Integration (3 tests)
1. Known context - direct loading (should NOT use ContextScout)
2. Unknown domain - discovery (should use ContextScout)
3. Accuracy - finds correct files

### Phase 2: Performance (2 tests)
4. Speed comparison (direct vs. discovery)
5. Overhead measurement

### Phase 3: Predictability (2 tests)
6. Consistency across runs
7. Multi-domain comprehensive discovery

---

## Next Steps

1. **Review this plan** - Does it answer your questions?
2. **Implement Phase 1 tests** - Basic integration validation
3. **Run tests and analyze results** - Measure actual behavior
4. **Decide**: Is ContextScout improving workflows or adding complexity?
5. **Refine agent prompts** - Update when/how to use ContextScout based on results

---

**Key Insight**: ContextScout should be used for **discovery** (unknown domains), NOT for **known paths** (standard code/docs/tests). The test suite will validate this hypothesis.
