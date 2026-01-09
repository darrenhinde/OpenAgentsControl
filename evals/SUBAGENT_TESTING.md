# Subagent Testing Guide

Quick reference for testing subagents with the evaluation framework.

---

## 🎯 Two Testing Modes

### 1. Standalone Mode (Default)
Tests the subagent directly by forcing `mode: primary`.

```bash
# CLI
npm run eval:sdk -- --subagent=coder-agent

# Makefile
make test-subagent SUBAGENT=coder-agent
```

**What happens:**
- ✅ Subagent runs as primary agent (mode override)
- ✅ Tests subagent logic in isolation
- ⚠️ Not how it runs in production (production uses `mode: subagent`)

**Use when:**
- Debugging subagent behavior
- Testing subagent logic independently
- Developing new subagents

### 2. Delegation Mode
Tests the subagent via its parent agent (real-world usage).

```bash
# CLI
npm run eval:sdk -- --subagent=coder-agent --delegate

# Makefile
make test-subagent-delegate SUBAGENT=coder-agent
```

**What happens:**
- ✅ Parent agent delegates to subagent
- ✅ Tests real production workflow
- ✅ Validates delegation logic

**Use when:**
- Testing production workflows
- Validating delegation patterns
- Integration testing

---

## 📋 Available Subagents

### Code Subagents (Parent: opencoder)
```bash
--subagent=coder-agent              # Simple task executor
--subagent=tester                   # Test authoring
--subagent=reviewer                 # Code review
--subagent=build-agent              # Type check & build
--subagent=codebase-pattern-analyst # Pattern analysis
```

### Core Subagents (Parent: openagent)
```bash
--subagent=task-manager             # Feature breakdown
--subagent=documentation            # Doc generation
--subagent=contextscout        # Context search
```

### System-Builder Subagents (Parent: system-builder)
```bash
--subagent=agent-generator          # Agent creation
--subagent=command-creator          # Command creation
--subagent=context-organizer        # Context organization
--subagent=domain-analyzer          # Domain analysis
--subagent=workflow-designer        # Workflow design
```

### Utils Subagents (Parent: openagent)
```bash
--subagent=image-specialist         # Image editing
```

---

## 🚀 Quick Examples

### Test coder-agent standalone
```bash
# With npm
npm run eval:sdk -- --subagent=coder-agent --pattern="**/smoke-test.yaml"

# With make
make test-subagent SUBAGENT=coder-agent
```

### Test coder-agent via opencoder delegation
```bash
# With npm
npm run eval:sdk -- --subagent=coder-agent --delegate --verbose

# With make
make test-subagent-delegate SUBAGENT=coder-agent
```

### Test with specific model
```bash
npm run eval:sdk -- --subagent=tester --model=anthropic/claude-3-5-sonnet-20241022
```

### Debug with verbose output
```bash
npm run eval:sdk -- --subagent=reviewer --verbose --debug
```

---

## 📊 Output Examples

### Standalone Mode
```
⚡ Standalone Test Mode
   Subagent: coder-agent
   Mode: Forced to 'primary' for direct testing
   Note: In production, this subagent runs as 'mode: subagent'

Starting test runner...
[TestRunner] Forced mode: primary for standalone subagent testing
✅ Test runner started
```

### Delegation Mode
```
🔗 Delegation Test Mode
   Subagent: coder-agent
   Parent: opencoder
   Tests will verify delegation from opencoder → coder-agent

Starting test runner...
✅ Test runner started
```

---

## ❌ Error Handling

### Unknown Subagent
```bash
$ npm run eval:sdk -- --subagent=unknown-agent

❌ Error: Unknown subagent 'unknown-agent'

📋 Available subagents:

  Code subagents (parent: opencoder):
    - coder-agent, tester, reviewer, build-agent, codebase-pattern-analyst

  Core subagents (parent: openagent):
    - task-manager, documentation, contextscout

  System-builder subagents (parent: system-builder):
    - agent-generator, command-creator, context-organizer
    - domain-analyzer, workflow-designer

  Utils subagents (parent: openagent):
    - image-specialist
```

### Invalid Flag Combination
```bash
$ npm run eval:sdk -- --agent=openagent --subagent=coder-agent --delegate

❌ Error: Cannot use --delegate with --agent
   Use either:
     --subagent=NAME              (standalone mode)
     --subagent=NAME --delegate   (delegation mode)
     --agent=NAME                 (main agent)
```

### Agent File Not Found
```bash
$ npm run eval:sdk -- --subagent=missing-agent

❌ Error: Agent file not found: .opencode/agent/subagents/code/missing-agent.md
Available agents: openagent, opencoder, coder-agent, tester, ...
```

---

## 🧪 Creating Subagent Tests

### Directory Structure
```
evals/agents/subagents/
└── coder-agent/
    └── tests/
        ├── standalone/           # For --subagent mode
        │   ├── 01-simple-task.yaml
        │   └── 02-error-handling.yaml
        └── delegation/           # For --subagent --delegate mode
            ├── 01-opencoder-delegates.yaml
            └── 02-task-completion.yaml
```

### Standalone Test Example
```yaml
id: coder-standalone-01
name: Coder Agent - Simple Function Creation
description: Test coder-agent creates a simple function

prompts:
  - text: |
      Create a simple add function in src/utils/math.ts

behavior:
  mustUseTools: [write]
  requiresApproval: true

expectedViolations:
  - rule: approval-gate
    shouldViolate: false
```

### Delegation Test Example
```yaml
id: coder-delegation-01
name: OpenCoder Delegates to Coder Agent
description: Test opencoder correctly delegates to coder-agent

prompts:
  - text: |
      Create a simple utility function.
      This is a simple task, delegate it to @coder-agent.

behavior:
  mustUseTools: [task]  # Must delegate
  requiresApproval: true

expectedViolations:
  - rule: delegation
    shouldViolate: false
```

---

## 💡 Best Practices

1. **Start with standalone mode** for quick iteration
2. **Use delegation mode** for production validation
3. **Test both modes** for comprehensive coverage
4. **Use --verbose** when debugging
5. **Check parent agent** matches your use case

---

## 🔧 Troubleshooting

### Subagent doesn't respond
- ✅ Check mode was forced to primary (standalone mode)
- ✅ Verify agent file exists
- ✅ Check OpenCode server logs with --debug

### Delegation not working
- ✅ Verify parent agent is correct
- ✅ Check delegation syntax in test prompt
- ✅ Use --verbose to see full conversation

### Tests failing unexpectedly
- ✅ Run with --verbose to see full output
- ✅ Check evaluator violations
- ✅ Verify test expectations match mode

---

**Questions?** See [evals/README.md](./README.md) or open an issue.
