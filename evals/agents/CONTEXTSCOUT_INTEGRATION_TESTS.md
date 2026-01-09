# ContextScout Integration Test Suite

**Purpose**: Comprehensive validation that OpenAgent, OpenCoder, and ContextScout work together effectively for intelligent context discovery.

**Created**: 2026-01-09  
**Status**: Ready to Run

---

## Overview

This test suite answers the critical question: **Should agents use ContextScout for context discovery, and if so, when and how?**

### What We're Testing

1. **OpenAgent Integration** - Does OpenAgent use ContextScout proactively?
2. **OpenCoder Integration** - Does OpenCoder use ContextScout for unfamiliar patterns?
3. **ContextScout Functionality** - Does ContextScout discover context correctly?

---

## Test Structure

```
evals/agents/
├── core/
│   ├── openagent/tests/contextscout-integration/
│   │   ├── 01-known-context-direct-load.yaml          # Should NOT use ContextScout
│   │   ├── 02-unknown-domain-discovery.yaml           # Should use ContextScout
│   │   ├── 03-accuracy-correct-files.yaml             # ContextScout finds right files
│   │   ├── 04-implicit-discovery.yaml                 # NEW: Proactive usage
│   │   ├── 05-multi-domain-comprehensive.yaml         # NEW: Multi-domain discovery
│   │   └── README.md
│   │
│   └── opencoder/tests/contextscout-integration/
│       ├── 01-implicit-pattern-discovery.yaml         # NEW: Pattern discovery
│       └── README.md
│
└── ContextScout/tests/
    ├── 01-code-standards-discovery.yaml               # NEW: Basic discovery
    ├── 02-domain-specific-discovery.yaml              # NEW: Domain-specific
    ├── 03-bad-request-handling.yaml                   # NEW: Error handling
    ├── 04-multi-domain-comprehensive.yaml             # NEW: Multi-domain
    ├── 05-tool-usage-validation.yaml                  # NEW: Read-only enforcement
    └── README.md
```

---

## Test Categories

### Category A: OpenAgent Integration (6 tests)

**Location**: `evals/agents/core/openagent/tests/contextscout-integration/`

| Test | Purpose | Expected Behavior |
|------|---------|-------------------|
| 01-known-context | Validate direct loading for known tasks | Should NOT use ContextScout |
| 02-unknown-domain | Validate discovery for unfamiliar topics | Should use ContextScout |
| 03-accuracy | Validate ContextScout finds correct files | Finds MVI.md correctly |
| 04-implicit-discovery | **NEW**: Proactive usage without instruction | Uses ContextScout automatically |
| 05-multi-domain | **NEW**: Comprehensive multi-domain discovery | Finds all relevant files |

**Key Question**: Does OpenAgent know when to use ContextScout vs. direct loading?

---

### Category B: OpenCoder Integration (1 test)

**Location**: `evals/agents/core/opencoder/tests/contextscout-integration/`

| Test | Purpose | Expected Behavior |
|------|---------|-------------------|
| 01-implicit-pattern-discovery | **NEW**: Pattern discovery for unfamiliar code | Uses ContextScout for eval framework |

**Key Question**: Does OpenCoder discover patterns before implementing unfamiliar code?

---

### Category C: ContextScout Functionality (5 tests)

**Location**: `evals/agents/ContextScout/tests/`

| Test | Purpose | Expected Behavior |
|------|---------|-------------------|
| 01-code-standards | **NEW**: Basic discovery | Finds code-quality.md |
| 02-domain-specific | **NEW**: Domain-specific search | Finds eval framework context |
| 03-bad-request | **NEW**: Error handling | Handles invalid queries gracefully |
| 04-multi-domain | **NEW**: Comprehensive discovery | Finds 4-5 files across domains |
| 05-tool-usage | **NEW**: Read-only enforcement | Never uses write/edit/bash |

**Key Question**: Does ContextScout discover context correctly and safely?

---

## Running Tests

### Run All Integration Tests
```bash
cd evals/framework

# All OpenAgent integration tests
npm run eval:sdk -- --agent=core/openagent --pattern="contextscout-integration/*.yaml"

# All OpenCoder integration tests
npm run eval:sdk -- --agent=core/opencoder --pattern="contextscout-integration/*.yaml"

# All ContextScout functionality tests
npm run eval:sdk -- --agent=ContextScout
```

### Run Specific Test Categories
```bash
# Category A: OpenAgent Integration
npm run eval:sdk -- --agent=core/openagent --pattern="contextscout-integration/*.yaml"

# Category B: OpenCoder Integration
npm run eval:sdk -- --agent=core/opencoder --pattern="contextscout-integration/*.yaml"

# Category C: ContextScout Functionality
npm run eval:sdk -- --agent=ContextScout --pattern="*.yaml"
```

### Run Individual Tests
```bash
# OpenAgent: Implicit discovery (NEW)
npm run eval:sdk -- --agent=core/openagent --pattern="04-implicit-discovery.yaml"

# OpenCoder: Pattern discovery (NEW)
npm run eval:sdk -- --agent=core/opencoder --pattern="01-implicit-pattern-discovery.yaml"

# ContextScout: Bad request handling (NEW)
npm run eval:sdk -- --agent=ContextScout --pattern="03-bad-request-handling.yaml"
```

---

## Success Criteria

### ✅ ContextScout Integration is "Working" if:

#### OpenAgent
1. ✅ Loads known context directly (Test 01) - NO ContextScout
2. ✅ Uses ContextScout for unknown domains (Test 02, 04) - WITH ContextScout
3. ✅ Uses ContextScout proactively (Test 04) - WITHOUT being told
4. ✅ Finds all relevant files for multi-domain (Test 05)

#### OpenCoder
1. ✅ Uses ContextScout for unfamiliar patterns (Test 01)
2. ✅ Loads context BEFORE implementation
3. ✅ Applies discovered patterns in code

#### ContextScout
1. ✅ Uses glob/read/grep for discovery (Test 01, 02, 04)
2. ✅ Finds correct files 95%+ of time (Test 01, 02, 04)
3. ✅ Handles bad requests gracefully (Test 03)
4. ✅ Never uses write/edit/bash (Test 05)
5. ✅ Finds all relevant files for multi-domain (Test 04)

---

### ❌ ContextScout Integration is "Broken" if:

#### OpenAgent
1. ❌ Uses ContextScout for simple tasks (unnecessary overhead)
2. ❌ Doesn't use ContextScout for unknown domains (misses context)
3. ❌ Inconsistent behavior (sometimes uses, sometimes doesn't)

#### OpenCoder
1. ❌ Implements without discovering patterns (guesses)
2. ❌ Uses wrong patterns (not from discovered context)
3. ❌ Skips ContextScout for unfamiliar domains

#### ContextScout
1. ❌ Fabricates file paths without verification
2. ❌ Uses bash instead of glob/read/grep
3. ❌ Uses write/edit tools (read-only violation)
4. ❌ Finds wrong files >20% of time
5. ❌ Crashes or provides unhelpful errors

---

## Key Tests to Watch

### 🔥 Critical Tests (Must Pass)

1. **OpenAgent: 04-implicit-discovery.yaml** (NEW)
   - Tests proactive ContextScout usage
   - Agent should use ContextScout WITHOUT being told
   - FAIL = Agents aren't using ContextScout intelligently

2. **OpenCoder: 01-implicit-pattern-discovery.yaml** (NEW)
   - Tests pattern discovery before implementation
   - OpenCoder should discover eval framework patterns
   - FAIL = OpenCoder guesses patterns instead of discovering

3. **ContextScout: 03-bad-request-handling.yaml** (NEW)
   - Tests error handling for invalid queries
   - Should report honestly, not fabricate
   - FAIL = ContextScout fabricates non-existent files

4. **ContextScout: 05-tool-usage-validation.yaml** (NEW)
   - Tests read-only constraint enforcement
   - Should NEVER use write/edit/bash
   - FAIL = Security violation, ContextScout can modify files

---

## Interpreting Results

### Scenario A: All Tests Pass ✅
**Conclusion**: ContextScout integration is working as designed

**Actions**:
- Document best practices for when to use ContextScout
- Add more tests for edge cases
- Consider making ContextScout usage more prominent

---

### Scenario B: OpenAgent/OpenCoder Don't Use ContextScout ⚠️
**Symptoms**:
- Test 04 (implicit-discovery) fails
- Test 05 (multi-domain) fails
- OpenCoder test 01 fails

**Conclusion**: Agents aren't using ContextScout proactively

**Actions**:
- Update agent prompts to emphasize ContextScout usage
- Add more examples of when to use ContextScout
- Make ContextScout usage more explicit in workflow stages

---

### Scenario C: ContextScout Finds Wrong Files ❌
**Symptoms**:
- Test 01 (code-standards) fails
- Test 02 (domain-specific) fails
- Test 04 (multi-domain) fails

**Conclusion**: ContextScout search accuracy is poor

**Actions**:
- Improve ContextScout search logic
- Add better keyword matching
- Improve navigation.md usage
- Add more context file metadata

---

### Scenario D: ContextScout Violates Constraints 🚨
**Symptoms**:
- Test 05 (tool-usage) fails
- ContextScout uses write/edit/bash

**Conclusion**: Security violation - ContextScout is not read-only

**Actions**:
- FIX IMMEDIATELY - security issue
- Review ContextScout prompt for tool restrictions
- Add stricter tool permissions
- Re-test thoroughly

---

## Next Steps After Running Tests

### If All Tests Pass ✅
1. Document ContextScout best practices
2. Add ContextScout usage examples to agent docs
3. Create more advanced tests (performance, edge cases)
4. Consider expanding ContextScout to other agents

### If Some Tests Fail ⚠️
1. Analyze which category failed (Agent integration vs ContextScout functionality)
2. Review failure logs and session data
3. Update prompts or search logic based on failures
4. Re-run tests to validate fixes

### If Many Tests Fail ❌
1. Reassess ContextScout design
2. Consider simpler alternatives (direct loading only)
3. Gather more requirements from actual usage
4. Prototype improvements before re-testing

---

## Related Documentation

- [ContextScout Agent](.opencode/agent/ContextScout.md)
- [OpenAgent Workflow](.opencode/agent/core/openagent.md)
- [OpenCoder Workflow](.opencode/agent/core/opencoder.md)
- [Eval Framework Concepts](.opencode/context/openagents-repo/core-concepts/evals.md)
- [Test Plan](evals/agents/core/openagent/tests/contextscout-integration-test-plan.md)

---

## Summary

**Total Tests**: 12 (6 OpenAgent + 1 OpenCoder + 5 ContextScout)  
**New Tests**: 8 (created 2026-01-09)  
**Critical Tests**: 4 (implicit discovery, pattern discovery, bad requests, tool usage)

**Key Insight**: ContextScout should be used **proactively** by agents when encountering unfamiliar domains, NOT as a replacement for direct loading of well-known context. These tests validate this hypothesis comprehensively.

**Run Command**:
```bash
cd evals/framework

# Run everything
npm run eval:sdk -- --agent=core/openagent --pattern="contextscout-integration/*.yaml"
npm run eval:sdk -- --agent=core/opencoder --pattern="contextscout-integration/*.yaml"
npm run eval:sdk -- --agent=ContextScout
```
