# ContextScout Testing Strategy

## What Are We Actually Testing?

### The Confusion

ContextScout is a **subagent** with `mode: subagent`, which means:
- **Production**: OpenAgent calls ContextScout via `task` tool
- **Testing**: We can test it TWO ways

**Current Problem**: Our tests are mixing both approaches and not testing either properly.

---

## Two Testing Approaches

### Approach 1: Test ContextScout Directly (Standalone Mode)

**What we're testing**: ContextScout's logic in isolation

**How it works**:
```bash
# Force ContextScout to run as primary agent
npm run eval:sdk -- --subagent=contextscout --pattern="smoke-test.yaml"
```

**What happens**:
- Eval framework forces `mode: primary` (overrides `mode: subagent`)
- ContextScout receives user prompt directly
- ContextScout uses tools (glob, read, grep) directly
- No OpenAgent involved

**Use when**:
- ✅ Debugging ContextScout's logic
- ✅ Testing tool usage (glob, read, grep)
- ✅ Verifying output format
- ✅ Developing new features

**Limitations**:
- ⚠️ Not how it runs in production
- ⚠️ Doesn't test delegation
- ⚠️ Doesn't test OpenAgent integration

---

### Approach 2: Test OpenAgent → ContextScout Delegation

**What we're testing**: OpenAgent's ability to delegate to ContextScout

**How it works**:
```bash
# Test delegation from OpenAgent to ContextScout
npm run eval:sdk -- --agent=core/openagent --pattern="delegation-test.yaml"
```

**What happens**:
- OpenAgent receives user prompt
- OpenAgent decides to delegate to ContextScout
- OpenAgent calls `task(subagent_type="ContextScout", ...)`
- ContextScout runs as subagent
- ContextScout returns results to OpenAgent
- OpenAgent presents results to user

**Use when**:
- ✅ Testing production workflow
- ✅ Verifying delegation logic
- ✅ Testing integration
- ✅ Validating real-world usage

**Limitations**:
- ⚠️ Harder to debug (two agents involved)
- ⚠️ Slower (more overhead)
- ⚠️ Tests both OpenAgent AND ContextScout

---

## Current Test Issues

### Issue 1: Wrong Testing Mode

**Current**:
```bash
npm run eval:sdk -- --agent=ContextScout
```

**Problem**: This runs through OpenAgent but doesn't properly test delegation

**What actually happens**:
1. Eval framework loads `ContextScout` as the agent
2. OpenAgent wraps it (because it's in subagents/ directory)
3. OpenAgent receives the test prompt
4. OpenAgent answers directly OR tries to delegate
5. ContextScout may or may not be invoked

**Result**: Inconsistent - sometimes ContextScout runs, sometimes it doesn't

---

### Issue 2: No Clear Test Separation

**Current tests mix concerns**:
- Some tests expect ContextScout to use tools directly
- Some tests expect OpenAgent to delegate
- No clear separation of what's being tested

**Result**: Tests fail for unclear reasons

---

## Recommended Testing Strategy

### Phase 1: Test ContextScout Directly (Standalone)

**Goal**: Verify ContextScout's core logic works

**Tests**:
1. ✅ Discovery - Can ContextScout find context files?
2. ✅ Search - Can ContextScout locate specific files?
3. ✅ Extraction - Can ContextScout extract key findings?
4. ✅ Output Format - Does ContextScout return proper format?
5. ✅ Error Handling - Does ContextScout handle errors gracefully?

**Command**:
```bash
cd evals/framework
npm run eval:sdk -- --subagent=contextscout --pattern="standalone/*.yaml"
```

**Test Structure**:
```yaml
# evals/agents/ContextScout/tests/standalone/01-discovery.yaml
id: contextscout-standalone-discovery
name: "ContextScout Standalone: Discovery Test"
description: |
  Tests ContextScout's ability to discover context files when running
  as a standalone agent (mode: primary override).
  
  This tests ContextScout's logic in isolation, not delegation.

prompts:
  - text: |
      Find all context files in .opencode/context/core/
      
      Return:
      - Exact file paths
      - File count
      - Directory structure

approvalStrategy:
  type: auto-approve

behavior:
  mustUseTools:
    - glob  # ContextScout MUST use glob to discover files
    - list  # ContextScout MUST use list to explore structure
  minToolCalls: 2
  maxToolCalls: 20

# Verify ContextScout's output
assertions:
  - type: output_contains
    value: ".opencode/context/core/"
  - type: tool_called
    tool: "glob"
  - type: tool_called
    tool: "list"

timeout: 60000

tags:
  - contextscout
  - standalone
  - discovery
  - unit-test
```

---

### Phase 2: Test OpenAgent → ContextScout Delegation

**Goal**: Verify OpenAgent delegates to ContextScout correctly

**Tests**:
1. ✅ Delegation Trigger - Does OpenAgent recognize when to delegate?
2. ✅ Delegation Format - Does OpenAgent pass correct parameters?
3. ✅ Result Handling - Does OpenAgent present ContextScout's results?
4. ✅ Error Propagation - Does OpenAgent handle ContextScout errors?

**Command**:
```bash
cd evals/framework
npm run eval:sdk -- --agent=core/openagent --pattern="delegation/*.yaml"
```

**Test Structure**:
```yaml
# evals/agents/core/openagent/tests/delegation/contextscout-delegation.yaml
id: openagent-contextscout-delegation
name: "OpenAgent: ContextScout Delegation Test"
description: |
  Tests OpenAgent's ability to delegate to ContextScout.
  
  This tests the delegation workflow, not ContextScout's logic.

prompts:
  - text: |
      I need to find context files for code standards. Can you help?

approvalStrategy:
  type: auto-approve

behavior:
  mustUseTools:
    - task  # OpenAgent MUST use task tool to delegate
  minToolCalls: 1
  maxToolCalls: 10

# Verify OpenAgent delegates to ContextScout
assertions:
  - type: tool_called
    tool: "task"
    with_args:
      subagent_type: "ContextScout"
  - type: output_contains
    value: ".opencode/context/core/standards/code.md"

timeout: 120000

tags:
  - openagent
  - delegation
  - contextscout
  - integration-test
```

---

## Debugging Guide

### Debugging Standalone Tests

**When test fails**:

1. **Check tool usage**:
   ```bash
   # Run with debug
   npm run eval:sdk -- --subagent=contextscout --pattern="test.yaml" --debug
   
   # Look for tool calls
   cat evals/results/latest.json | jq '.tests[0].timeline[] | select(.type == "tool_call")'
   ```

2. **Verify ContextScout is running**:
   ```bash
   # Check agent name in logs
   # Should see: "Agent: ContextScout" (not "Agent: OpenAgent")
   ```

3. **Check output format**:
   ```bash
   # View agent response
   cat evals/results/latest.json | jq '.tests[0].timeline[] | select(.type == "assistant_message")'
   ```

4. **Common issues**:
   - ❌ Agent not using tools → Check `mustUseTools` in test
   - ❌ Wrong output format → Check ContextScout prompt
   - ❌ Timeout → Increase timeout or simplify test

---

### Debugging Delegation Tests

**When test fails**:

1. **Check if delegation happened**:
   ```bash
   # Look for task tool call
   cat evals/results/latest.json | jq '.tests[0].timeline[] | select(.tool == "task")'
   ```

2. **Verify delegation parameters**:
   ```bash
   # Check subagent_type
   cat evals/results/latest.json | jq '.tests[0].timeline[] | select(.tool == "task") | .arguments'
   ```

3. **Check ContextScout's response**:
   ```bash
   # Look for ContextScout's output in timeline
   # Should see nested agent execution
   ```

4. **Common issues**:
   - ❌ OpenAgent doesn't delegate → Prompt not clear enough
   - ❌ Wrong subagent called → OpenAgent chose different subagent
   - ❌ Delegation fails → Check ContextScout is registered

---

## Test File Organization

### Recommended Structure

```
evals/agents/ContextScout/
├── config/
│   └── config.yaml                      # Test configuration
├── tests/
│   ├── standalone/                      # Phase 1: Test ContextScout directly
│   │   ├── 01-discovery.yaml           # Find files
│   │   ├── 02-search.yaml              # Search for specific files
│   │   ├── 03-extraction.yaml          # Extract key findings
│   │   ├── 04-output-format.yaml       # Verify output format
│   │   ├── 05-error-handling.yaml      # Handle errors
│   │   ├── 06-false-positive.yaml      # Prevent hallucinations
│   │   ├── 07-invalid-path.yaml        # Handle invalid paths
│   │   ├── 08-ambiguous-query.yaml     # Handle vague queries
│   │   ├── 09-mvi-detection.yaml       # Detect MVI compliance
│   │   └── 10-empty-directory.yaml     # Handle empty dirs
│   └── delegation/                      # Phase 2: Test OpenAgent delegation
│       ├── 01-trigger.yaml             # Does OpenAgent delegate?
│       ├── 02-parameters.yaml          # Correct parameters?
│       └── 03-results.yaml             # Results presented correctly?
└── README.md
```

---

## Implementation Plan

### Step 1: Reorganize Tests (30 min)

1. Create `tests/standalone/` directory
2. Move current tests to `standalone/`
3. Update test descriptions to clarify "standalone mode"
4. Update config.yaml

### Step 2: Fix Standalone Tests (1 hour)

1. Update test command to use `--subagent=contextscout`
2. Add `mustUseTools` to enforce tool usage
3. Add assertions to verify output
4. Run and debug each test

### Step 3: Create Delegation Tests (1 hour)

1. Create `tests/delegation/` directory
2. Create OpenAgent delegation tests
3. Test delegation trigger
4. Test result handling

### Step 4: Document Results (30 min)

1. Update README with test results
2. Document debugging procedures
3. Create troubleshooting guide

---

## Quick Reference

### Test ContextScout Directly
```bash
# Standalone mode - tests ContextScout's logic
npm run eval:sdk -- --subagent=contextscout --pattern="standalone/*.yaml"
```

### Test OpenAgent Delegation
```bash
# Delegation mode - tests OpenAgent → ContextScout
npm run eval:sdk -- --agent=core/openagent --pattern="delegation/*.yaml"
```

### Debug Standalone Test
```bash
# Run with debug output
npm run eval:sdk -- --subagent=contextscout --pattern="standalone/01-discovery.yaml" --debug

# Check tool calls
cat evals/results/latest.json | jq '.tests[0].timeline[] | select(.type == "tool_call") | {tool, args}'
```

### Debug Delegation Test
```bash
# Run with debug output
npm run eval:sdk -- --agent=core/openagent --pattern="delegation/01-trigger.yaml" --debug

# Check if delegation happened
cat evals/results/latest.json | jq '.tests[0].timeline[] | select(.tool == "task")'
```

---

## Bottom Line

**What should we test?**

1. **Phase 1**: Test ContextScout's logic directly (standalone mode)
   - Verify tool usage (glob, read, grep)
   - Verify output format
   - Verify error handling

2. **Phase 2**: Test OpenAgent's delegation (integration mode)
   - Verify OpenAgent delegates correctly
   - Verify results are presented properly
   - Verify error propagation

**Current status**: Tests are confused - mixing both modes

**Next step**: Reorganize tests into `standalone/` and `delegation/` directories

---

**Last Updated**: 2026-01-07  
**Status**: Strategy defined, implementation pending
