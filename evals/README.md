# Agent Evaluation Framework

Test and validate agent behavior with automated evaluations.

## Quick Start

```bash
cd evals/framework

# Run golden tests (baseline - 8 tests, ~2-3 min)
npm run eval:sdk -- --agent=openagent --pattern="**/golden/*.yaml"

# Run a specific test
npm run eval:sdk -- --agent=openagent --pattern="**/smoke-test.yaml"

# Run with debug output (includes multi-agent logging)
npm run eval:sdk -- --agent=openagent --pattern="**/golden/*.yaml" --debug
```

## ✨ New Features

### Multi-Agent Logging (Dec 2025)
Beautiful hierarchical logging shows parent-child delegation chains:

```
┌────────────────────────────────────────────────────────────┐
│ 🎯 PARENT: OpenAgent (ses_xxx...)                          │
└────────────────────────────────────────────────────────────┘
  
  ┌────────────────────────────────────────────────────────────┐
  │ 🎯 CHILD: simple-responder (ses_yyy...)                    │
  │    Parent: ses_xxx...                                      │
  │    Depth: 1                                                │
  └────────────────────────────────────────────────────────────┘
  
  ✅ CHILD COMPLETE (2.9s)
✅ PARENT COMPLETE (20.9s)
```

Enable with `--debug` flag. See [MULTI_AGENT_LOGGING_COMPLETE.md](MULTI_AGENT_LOGGING_COMPLETE.md) for details.

### Performance Improvements (Dec 2025)
- **10-20% faster tests** - Grace period reduced from 5s to 2s
- **Performance metrics** - Automatic collection of tool latencies, inference time
- **37 unit tests** - Complete test coverage for logging system

## Golden Tests

8 curated tests that validate core agent behaviors:

| Test | What It Validates |
|------|-------------------|
| 01-smoke-test | **Agent & subagent delegation** (multi-agent) |
| 02-context-loading | Agent reads context before answering |
| 03-read-before-write | Agent inspects before modifying |
| 04-write-with-approval | Agent asks before writing |
| 05-multi-turn-context | Agent remembers conversation |
| 06-task-breakdown | Agent reads standards before implementing |
| 07-tool-selection | Agent uses dedicated tools (not bash) |
| 08-error-handling | Agent handles errors gracefully |

```bash
# Run all golden tests
npm run eval:sdk -- --agent=openagent --pattern="**/golden/*.yaml"
```

## Creating Custom Tests

See **[CREATING_TESTS.md](CREATING_TESTS.md)** for:
- Test templates (copy and modify)
- Behavior options (mustUseTools, requiresApproval, etc.)
- **NEW:** `expectedContextFiles` - Explicitly specify which context files to validate
- Expected violations
- Examples

### New Feature: Explicit Context File Validation

You can now explicitly specify which context files the agent must read:

```yaml
behavior:
  requiresContext: true
  expectedContextFiles:
    - .opencode/context/core/standards/code.md
    - standards/code.md
```

See **[agents/shared/tests/EXPLICIT_CONTEXT_FILES.md](agents/shared/tests/EXPLICIT_CONTEXT_FILES.md)** for detailed guide.

Quick example:
```yaml
id: my-test
name: "My Test"
description: What this tests.
category: developer

prompts:
  - text: Read evals/test_tmp/README.md and summarize it.

approvalStrategy:
  type: auto-approve

behavior:
  mustUseTools: [read]

expectedViolations:
  - rule: approval-gate
    shouldViolate: false
    severity: error

timeout: 60000
```

## Evaluators

| Evaluator | What It Checks |
|-----------|----------------|
| **approval-gate** | Approval requested before risky operations |
| **context-loading** | Context files loaded before acting (supports explicit file specification) |
| **execution-balance** | Read operations before write operations |
| **tool-usage** | Dedicated tools used instead of bash |
| **behavior** | Expected tools used, forbidden tools avoided |
| **delegation** | Complex tasks delegated to subagents |
| **stop-on-failure** | Agent stops on errors instead of auto-fixing |

## Directory Structure

```
evals/
├── README.md                    # This file
├── CREATING_TESTS.md           # How to create custom tests
├── framework/                   # Test runner and evaluators
│   ├── src/
│   │   ├── sdk/                # Test execution
│   │   └── evaluators/         # Rule validators
│   └── README.md               # Technical details
├── agents/
│   ├── shared/tests/
│   │   ├── golden/             # 8 baseline tests
│   │   └── templates/          # Test templates
│   └── core/openagent/tests/   # Agent-specific tests
├── results/                     # Test results
│   ├── latest.json
│   └── index.html              # Dashboard
└── test_tmp/                    # Temp files (auto-cleaned)
```

## CLI Options

```bash
npm run eval:sdk -- [options]

Options:
  --agent=NAME           Agent to test (openagent, opencoder, core/openagent)
  --subagent=NAME        Test a subagent (coder-agent, tester, reviewer, etc.)
                         Default: Standalone mode (forces mode: primary)
  --delegate             Test subagent via parent delegation (requires --subagent)
  --pattern=GLOB         Test file pattern (default: **/*.yaml)
  --debug                Enable debug output, keep sessions for inspection
  --verbose              Show full conversation (prompts + responses) after each test
                         (automatically enables --debug)
  --model=PROVIDER/MODEL Override model (default: opencode/big-pickle)
  --timeout=MS           Test timeout (default: 60000)
  --prompt-variant=NAME  Use specific prompt variant (gpt, gemini, grok, llama)
                         Auto-detects recommended model from prompt metadata
  --no-evaluators        Skip running evaluators (faster iteration)
  --core                 Run core test suite only (7 tests, ~5-8 min)
```

### Examples

```bash
# Run golden tests with verbose output (see full conversations)
npm run eval:sdk -- --agent=openagent --pattern="**/golden/*.yaml" --verbose

# Test subagent standalone (forces mode: primary)
npm run eval:sdk -- --subagent=coder-agent

# Test subagent via delegation (uses parent agent)
npm run eval:sdk -- --subagent=coder-agent --delegate

# Test with a specific model
npm run eval:sdk -- --agent=openagent --model=anthropic/claude-3-5-sonnet-20241022

# Test with a prompt variant (auto-detects model)
npm run eval:sdk -- --agent=openagent --prompt-variant=llama

# Quick iteration without evaluators
npm run eval:sdk -- --agent=openagent --pattern="**/01-smoke-test.yaml" --no-evaluators
```

## Quick Commands (Makefile)

From the project root, you can use these shortcuts:

```bash
# Full pipeline: build, validate, run golden tests
make test-evals

# Just run golden tests (8 tests, ~3-5 min)
make test-golden

# Quick smoke test (1 test, ~30s)
make test-smoke

# Run with verbose output (see full conversations)
make test-verbose

# Test specific agent
make test-agent AGENT=opencoder

# Test subagent (standalone mode)
make test-subagent SUBAGENT=coder-agent

# Test subagent (delegation mode)
make test-subagent-delegate SUBAGENT=coder-agent

# Test with specific model
make test-model MODEL=anthropic/claude-3-5-sonnet-20241022

# Test with prompt variant
make test-variant VARIANT=llama

# View results
make view-results    # Open dashboard in browser
make show-results    # Show summary in terminal
```

**For detailed subagent testing guide, see [SUBAGENT_TESTING.md](./SUBAGENT_TESTING.md)**

## Results

Results are saved to `evals/results/`:
- `latest.json` - Most recent run
- `history/` - Historical results (by month)
- `index.html` - Dashboard (open in browser)

```bash
# View dashboard
make view-results
# Or manually:
cd evals/results && python -m http.server 8080
# Open http://localhost:8080
```
