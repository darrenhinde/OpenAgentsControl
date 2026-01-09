# OpenCode Agent Evaluation Framework - Complete Guide

**Comprehensive SDK-based evaluation framework for testing OpenCode agents with real execution, event streaming, and automated validation.**

Last Updated: November 27, 2025

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [What This Framework Does](#what-this-framework-does)
3. [How Tests Work](#how-tests-work)
4. [Writing Tests](#writing-tests)
5. [Validation Features](#validation-features)
6. [Running Tests](#running-tests)
7. [Understanding Results](#understanding-results)
8. [Troubleshooting](#troubleshooting)
9. [Key Learnings](#key-learnings)

---

## 🚀 Quick Start

```bash
# Install and build
cd evals/framework
npm install
npm run build

# Run all tests (uses free model by default)
npm run eval:sdk

# Run specific agent
npm run eval:sdk -- --agent=openagent
npm run eval:sdk -- --agent=opencoder

# Debug mode (verbose output, keeps sessions)
npm run eval:sdk -- --debug

# View results dashboard
cd ../results && ./serve.sh
```

---

## 🎯 What This Framework Does

### Purpose
Validates that OpenCode agents follow their defined rules and behaviors through **real execution** with actual sessions, not mocks.

### Key Capabilities

✅ **Real Execution** - Creates actual OpenCode sessions, sends prompts, captures responses
✅ **Event Streaming** - Monitors all events (tool calls, messages, permissions) in real-time
✅ **Automated Validation** - Runs evaluators to check compliance with agent rules
✅ **Content Validation** - Verifies file contents, not just that tools were called
✅ **Subagent Verification** - Validates delegation and subagent behavior
✅ **Enhanced Logging** - Captures full tool inputs/outputs with timing
✅ **Multi-turn Support** - Handles approval workflows and complex conversations

### What Gets Tested

| Validation Type | What It Checks |
|----------------|----------------|
| **Approval Gate** | Agent asks for approval before executing risky operations |
| **Context Loading** | Agent loads required context files before execution |
| **Delegation** | Agent delegates complex tasks (4+ files) to task-manager |
| **Tool Usage** | Agent uses correct tools for the task |
| **Behavior** | Agent follows expected behavior patterns |
| **Subagent** | Subagents execute correctly when delegated |
| **Content** | Files contain expected content and patterns |

---

## 🔧 How Tests Work

### Test Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        TEST RUNNER                               │
├─────────────────────────────────────────────────────────────────┤
│  1. Clean test_tmp/ directory                                    │
│  2. Start opencode server (from git root)                        │
│  3. For each test:                                               │
│     a. Create session with specified agent                       │
│     b. Send prompt(s) (single or multi-turn)                     │
│     c. Capture events via event stream                           │
│     d. Extract tool inputs/outputs (enhanced logging)            │
│     e. Run evaluators on session data                            │
│     f. Validate behavior expectations                            │
│     g. Check content expectations                                │
│     h. Verify subagent behavior (if delegated)                   │
│     i. Delete session (unless --debug)                           │
│  4. Clean test_tmp/ directory                                    │
│  5. Generate results (JSON + dashboard)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Where Data Lives

**During Test Execution:**
```
~/.local/share/opencode/storage/
├── session/          # Session metadata (by project hash)
├── message/          # Messages per session (ses_xxx/)
├── part/             # Tool calls, text parts, etc.
└── session_diff/     # Session changes
```

**Test Results:**
```
evals/results/
├── latest.json           # Most recent run
├── history/2025-11/      # Historical runs
└── index.html            # Interactive dashboard
```

### Event Stream Monitoring

The framework listens to the OpenCode event stream and captures:

```typescript
// Events captured in real-time
- session.created/updated
- message.created/updated
- part.created/updated (includes tool calls)
- permission.request/response

// Enhanced with tool details (NEW)
- Tool name, input, output
- Start time, end time, duration
- Success/error status
```

---

## ✍️ Writing Tests

### Basic Test Structure

```yaml
id: my-test-001
name: My Test Name
description: What this test validates

category: developer  # developer, business, creative, edge-case
agent: openagent     # openagent, opencoder
model: opencode/grok-code  # Optional, defaults to free tier

# Single prompt (simple tests)
prompt: |
  Create a function called add in math.ts

# OR Multi-turn prompts (for approval workflows)
prompts:
  - text: |
      Create a function called add in math.ts
    expectContext: true
    contextFile: ".opencode/context/core/standards/code.md"
  
  - text: "Yes, proceed with the plan."
    delayMs: 2000

# Expected behavior
behavior:
  mustUseTools: [read, write]
  requiresApproval: true
  requiresContext: true
  minToolCalls: 2

# Expected violations (should NOT violate these)
expectedViolations:
  - rule: approval-gate
    shouldViolate: false
    severity: error

# Approval strategy
approvalStrategy:
  type: auto-approve

timeout: 120000
```

### Multi-Turn Tests (Critical for OpenAgent)

**Why Multi-Turn?** OpenAgent requires approval before execution. Single-turn tests will fail because the agent asks for approval but never receives it.

```yaml
# ❌ WRONG - Single turn (agent asks approval, never gets it)
prompt: "Create a file at test.txt"

# ✅ CORRECT - Multi-turn (agent asks, user approves)
prompts:
  - text: "Create a file at test.txt"
  - text: "Yes, proceed."
    delayMs: 2000
```

---

## 🎨 Validation Features

### 1. Content Validation (NEW)

Validates the **actual content** of files written/edited:

```yaml
behavior:
  mustUseTools: [write]
  
  contentExpectations:
    - filePath: "src/math.ts"
      mustContain:
        - "export function add"
        - ": number"
      mustNotContain:
        - "console.log"
        - "any"
      minLength: 100
      maxLength: 500
```

**Validation Types:**
- `mustContain` - Required patterns (40% weight)
- `mustNotContain` - Forbidden patterns (30% weight)
- `mustMatch` - Regex pattern (20% weight)
- `minLength` - Minimum content length (5% weight)
- `maxLength` - Maximum content length (5% weight)

### 2. Subagent Verification (NEW)

Validates delegation and subagent behavior:

```yaml
behavior:
  mustUseTools: [task]
  shouldDelegate: true
  
  delegationExpectations:
    subagentType: "CoderAgent"
    subagentMustUseTools: [write, read]
    subagentMinToolCalls: 2
    subagentMustComplete: true
```

**Checks:**
- Correct subagent type invoked (30% weight)
- Subagent used required tools (40% weight)
- Minimum tool calls met (20% weight)
- Subagent completed successfully (10% weight)

### 3. Enhanced Approval Detection (NEW)

More sophisticated approval validation:

```yaml
behavior:
  requiresApproval: true
  
  approvalExpectations:
    minConfidence: high  # high, medium, low
    approvalMustMention:
      - "file"
      - "create"
    requireExplicitApproval: true
```

### 4. Debug Options (NEW)

Enhanced debugging capabilities:

```yaml
behavior:
  debug:
    logToolDetails: true        # Log all tool I/O
    saveReplayOnFailure: true   # Save session for replay
    exportMarkdown: true        # Export to markdown
```

### 5. Tool Usage Validation

```yaml
behavior:
  # Must use these tools
  mustUseTools: [read, write]
  
  # Must use at least one of these sets
  mustUseAnyOf: [[bash], [list]]
  
  # May use these (optional)
  mayUseTools: [glob, grep]
  
  # Must NOT use these
  mustNotUseTools: [edit]
  
  # Tool call count
  minToolCalls: 2
  maxToolCalls: 10
```

---

## 🏃 Running Tests

### Basic Commands

```bash
# Run all tests
npm run eval:sdk

# Run specific agent
npm run eval:sdk -- --agent=openagent

# Run with debug output
npm run eval:sdk -- --debug

# Filter tests by pattern
npm run eval:sdk -- --agent=openagent --filter="context-loading"
```

### Batch Execution (Avoid Rate Limits)

```bash
# Run in batches of 3 with 10s delays
cd evals/framework/scripts/utils
./run-tests-batch.sh openagent 3 10
```

### Debug Mode Features

When running with `--debug`:
- ✅ Full event logging with tool I/O
- ✅ Sessions kept for inspection
- ✅ Detailed timeline output
- ✅ Tool duration tracking

**Example Debug Output:**
```
────────────────────────────────────────────────────────────
🔧 TOOL: write (completed)
────────────────────────────────────────────────────────────

📥 INPUT:
{
  "filePath": "test.ts",
  "content": "export function add..."
}

📤 OUTPUT:
{
  "success": true,
  "bytesWritten": 67
}

⏱️  Duration: 12ms
────────────────────────────────────────────────────────────
```

---

## 📊 Understanding Results

### Test Output

```
============================================================
Running test: ctx-code-001 - Code Task with Context Loading
============================================================
Approval strategy: Auto-approve all permission requests
Creating session...
Session created: ses_abc123
Agent: openagent
Model: anthropic/claude-sonnet-4-5

Sending 2 prompts (multi-turn)...
Prompt 1/2: Create a function...
  Completed
Prompt 2/2: Yes, proceed...
  Completed

Running evaluators...
  ✅ approval-gate: PASSED
  ✅ context-loading: PASSED
  ✅ tool-usage: PASSED
  ✅ behavior: PASSED
  ✅ content: PASSED

Test PASSED
Duration: 35142ms
Events captured: 116
```

### Results Dashboard

```bash
cd evals/results
./serve.sh
# Open http://localhost:8000
```

**Dashboard Features:**
- Filter by agent, category, status
- View violation details
- See test trends over time
- Export results

### Understanding Violations

```
Violations Detected:
  1. [error] missing-required-tool: Required tool 'write' was not used
  2. [error] missing-required-patterns: File missing: export function
  3. [warning] over-delegation: Delegated for < 4 files (acceptable)
```

**Severity Levels:**
- `error` - Test fails
- `warning` - Test passes but flagged
- `info` - Informational only

---

## 🔍 Troubleshooting

### Common Issues

#### 1. Tests Failing with "No tool calls"

**Problem:** Agent responds but doesn't execute tools.

**Cause:** Single-turn test when multi-turn needed (OpenAgent requires approval).

**Solution:**
```yaml
# Change from:
prompt: "Create a file"

# To:
prompts:
  - text: "Create a file"
  - text: "Yes, proceed."
    delayMs: 2000
```

#### 2. Duplicate Test IDs

**Problem:** Same test ID appears in multiple files.

**Cause:** Old and new test structures both present.

**Solution:** Ensure unique test IDs across all test files.

```bash
# Check for duplicates
find evals/agents/*/tests -name "*.yaml" -exec grep "^id:" {} \; | sort | uniq -d
```

#### 3. Context Not Loading

**Problem:** Context loading evaluator fails.

**Cause:** Context file read before first prompt sent.

**Solution:** Use `expectContext: true` on the prompt that needs context:

```yaml
prompts:
  - text: "Create a function"
    expectContext: true
    contextFile: ".opencode/context/core/standards/code.md"
```

#### 4. Content Validation Fails

**Problem:** Content expectations not met.

**Cause:** File content doesn't match expectations.

**Debug:**
```bash
# Run with debug to see actual content
npm run eval:sdk -- --debug --filter="your-test"

# Check the file that was written
cat evals/test_tmp/your-file.ts
```

---

## 🎓 Key Learnings

### 1. Duplicate Test IDs Are Dangerous

**Problem:** When multiple test files have the same `id`, the test runner loads both but only one executes (unpredictably).

**Solution:** Always ensure unique test IDs. Use a naming convention:
```
{category}-{feature}-{number}
ctx-code-001
ctx-docs-002
```

### 2. Multi-Turn is Essential for OpenAgent

**Problem:** OpenAgent asks for approval before execution. Single-turn tests fail because the agent never receives approval.

**Solution:** Always use multi-turn prompts for OpenAgent:
```yaml
prompts:
  - text: "Do the task"
  - text: "Yes, proceed."
    delayMs: 2000
```

### 3. Content Validation > Tool Usage

**Problem:** Checking IF a tool was called doesn't verify WHAT it did.

**Solution:** Use content expectations to validate actual output:
```yaml
behavior:
  mustUseTools: [write]  # Checks IF write was called
  
  contentExpectations:   # Checks WHAT was written
    - filePath: "test.ts"
      mustContain: ["export", "function"]
```

### 4. Enhanced Logging is Foundational

**Problem:** Without tool I/O logging, debugging failures is difficult.

**Solution:** Enhanced event logging captures everything:
- Tool inputs and outputs
- Duration per tool
- Error details
- Enables content validation and subagent verification

### 5. Backward Compatibility Matters

**Problem:** Adding new features can break existing tests.

**Solution:** Make all new fields optional:
```typescript
contentExpectations?: ContentExpectation[];  // Optional
delegationExpectations?: DelegationExpectation;  // Optional
```

---

## 📁 Directory Structure

```
evals/
├── framework/                    # Test framework code
│   ├── src/
│   │   ├── evaluators/          # Validation logic
│   │   │   ├── approval-gate-evaluator.ts
│   │   │   ├── context-loading-evaluator.ts
│   │   │   ├── delegation-evaluator.ts
│   │   │   ├── tool-usage-evaluator.ts
│   │   │   ├── behavior-evaluator.ts
│   │   │   ├── subagent-evaluator.ts      # NEW
│   │   │   └── content-evaluator.ts       # NEW
│   │   ├── sdk/                 # Test execution
│   │   │   ├── test-runner.ts
│   │   │   ├── test-executor.ts
│   │   │   ├── event-stream-handler.ts    # Enhanced
│   │   │   ├── event-logger.ts            # Enhanced
│   │   │   └── test-case-schema.ts        # Updated
│   │   └── types/               # TypeScript types
│   └── package.json
│
├── agents/                       # Agent-specific tests
│   ├── openagent/
│   │   └── tests/
│   │       ├── 01-critical-rules/
│   │       ├── 02-workflow-stages/
│   │       ├── 03-delegation/
│   │       ├── 04-execution-paths/
│   │       ├── 05-edge-cases/
│   │       └── 06-integration/
│   └── opencoder/
│       └── tests/
│
├── results/                      # Test results
│   ├── latest.json
│   ├── history/
│   └── index.html               # Dashboard
│
└── test_tmp/                     # Temporary test files
```

---

## 🚀 Next Steps

### For Test Writers

1. **Start Simple** - Write basic tests first, add complexity later
2. **Use Multi-Turn** - Always for OpenAgent approval workflows
3. **Validate Content** - Don't just check tools, check outputs
4. **Test Incrementally** - Run tests frequently during development

### For Framework Developers

**Remaining Enhancements:**

1. **Task 03: Enhanced Approval Detection** (~1 hour)
   - High/medium/low confidence levels
   - Capture actual approval text
   - Reduce false positives/negatives

2. **Task 04: Session Replay Utility** (~1.5 hours)
   - Replay failed sessions for debugging
   - Console/markdown/HTML output
   - CLI: `npm run replay <session-id>`

3. **Task 07: Integration Testing** (~1 hour)
   - End-to-end integration tests
   - Verify all features work together
   - Performance benchmarks

### For Production Use

1. **Run Full Test Suite** - Verify all tests pass
2. **Update Agent Docs** - Document new validation features
3. **Create Migration Guide** - Help users update existing tests
4. **Monitor Pass Rates** - Track test health over time

---

## 📚 Additional Resources

- **Test Examples**: `evals/agents/openagent/tests/06-integration/medium/03-full-validation-example.yaml`
- **Framework Code**: `evals/framework/src/`
- **Results Dashboard**: `evals/results/index.html`
- **Session Storage**: `~/.local/share/opencode/storage/`

---

## 🤝 Contributing

When adding new tests:

1. ✅ Use unique test IDs
2. ✅ Use multi-turn for approval workflows
3. ✅ Add content expectations when validating outputs
4. ✅ Include clear descriptions
5. ✅ Test locally before committing
6. ✅ Update this guide if adding new features

---

**Last Updated:** November 27, 2025  
**Framework Version:** 0.1.0  
**Status:** Production Ready ✅
