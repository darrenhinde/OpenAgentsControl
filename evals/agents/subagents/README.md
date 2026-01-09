# Subagent Evaluation Tests

## Overview

This directory contains evaluation tests for all 14 OpenCode subagents. Each subagent has its own test suite with configuration, smoke tests, and placeholder directories for prompt variants.

## Directory Structure

```
subagents/
├── code/                    # Code-focused subagents (parent: opencoder)
│   ├── build-agent/
│   ├── codebase-pattern-analyst/
│   ├── coder-agent/
│   ├── reviewer/
│   └── tester/
├── core/                    # Core orchestration subagents (parent: openagent)
│   ├── contextscout/
│   ├── documentation/
│   └── task-manager/
├── system-builder/          # System builder subagents (parent: system-builder)
│   ├── agent-generator/
│   ├── command-creator/
│   ├── context-organizer/
│   ├── domain-analyzer/
│   └── workflow-designer/
└── utils/                   # Utility subagents (parent: openagent)
    └── image-specialist/
```

Each subagent directory contains:
- `config/config.yaml` - Test configuration
- `tests/smoke-test.yaml` - Basic sanity check
- `prompts/` - Placeholder for model-specific prompt variants
- `README.md` - Subagent-specific documentation

## Subagent Inventory

### Code Subagents (Parent: opencoder)

| Subagent | Description | Status |
|----------|-------------|--------|
| **build-agent** | Type checking and build validation | ✅ Smoke test ready |
| **codebase-pattern-analyst** | Finding similar implementations | ✅ Smoke test ready |
| **coder-agent** | Focused coding subtasks | ✅ Smoke test ready |
| **reviewer** | Code review and quality assurance | ✅ Smoke test ready |
| **tester** | Test authoring and TDD | ✅ Smoke test ready |

### Core Subagents (Parent: openagent)

| Subagent | Description | Status |
|----------|-------------|--------|
| **contextscout** | Context search and retrieval | ✅ Smoke test ready |
| **documentation** | Documentation authoring | ✅ Smoke test ready |
| **task-manager** | Task breakdown with dependency tracking | ✅ Smoke test ready |

### System Builder Subagents (Parent: system-builder)

| Subagent | Description | Status |
|----------|-------------|--------|
| **agent-generator** | XML-optimized agent generation | ✅ Smoke test ready |
| **command-creator** | Custom slash command creation | ✅ Smoke test ready |
| **context-organizer** | Context file organization | ✅ Smoke test ready |
| **domain-analyzer** | Domain concept analysis | ✅ Smoke test ready |
| **workflow-designer** | Workflow definition design | ✅ Smoke test ready |

### Utils Subagents (Parent: openagent)

| Subagent | Description | Status |
|----------|-------------|--------|
| **image-specialist** | Image editing and analysis | ✅ Smoke test ready |

## Running Tests

### Quick Start

```bash
# Test a specific subagent (standalone mode)
npm run eval:sdk -- --subagent=coder-agent

# Test via parent agent (delegation mode)
npm run eval:sdk -- --subagent=coder-agent --delegate

# Using Makefile shortcuts
make test-subagent SUBAGENT=coder-agent
make test-subagent-delegate SUBAGENT=coder-agent
```

### Test All Subagents

```bash
# Run smoke tests for all code subagents
for agent in build-agent codebase-pattern-analyst coder-agent reviewer tester; do
  npm run eval:sdk -- --subagent=$agent --pattern="**/smoke-test.yaml"
done

# Run smoke tests for all core subagents
for agent in contextscout documentation task-manager; do
  npm run eval:sdk -- --subagent=$agent --pattern="**/smoke-test.yaml"
done

# Run smoke tests for all system-builder subagents
for agent in agent-generator command-creator context-organizer domain-analyzer workflow-designer; do
  npm run eval:sdk -- --subagent=$agent --pattern="**/smoke-test.yaml"
done

# Run smoke test for utils subagent
npm run eval:sdk -- --subagent=image-specialist --pattern="**/smoke-test.yaml"
```

### Verbose Output

```bash
# See full conversation and tool calls
npm run eval:sdk -- --subagent=coder-agent --verbose
```

## Test Modes

### Standalone Mode (Default)
- Forces `mode: primary` in the subagent file
- Tests subagent directly without parent delegation
- Useful for isolated functionality testing
- **Use case:** Unit testing subagent behavior

### Delegation Mode
- Tests subagent via its parent agent
- Simulates real-world usage patterns
- Parent agent delegates to subagent
- **Use case:** Integration testing

## Test Suites

Each subagent supports three test suites:

1. **smoke** - Basic sanity checks (✅ Implemented)
2. **standalone** - Isolated functionality tests (🚧 TODO)
3. **delegation** - Parent delegation scenarios (🚧 TODO)

## Adding New Tests

1. Navigate to the subagent's `tests/` directory
2. Create a new YAML test file following the schema:

```yaml
id: subagent-name-test-id
name: "Test Name"
description: |
  Test description
category: developer

prompts:
  - text: |
      Your test prompt here

approvalStrategy:
  type: auto-approve  # or manual-approve

behavior:
  mustUseTools:
    - tool-name
  minToolCalls: 1
  maxToolCalls: 5

expectedViolations:
  - rule: approval-gate
    shouldViolate: false
    severity: error

timeout: 60000

tags:
  - subagent
  - subagent-name
  - test-suite-name
```

3. Update the subagent's README.md
4. Run the test to verify

## Prompt Variants

The `prompts/` directory in each subagent is reserved for model-specific prompt variants:

```
prompts/
├── gpt.md          # GPT-optimized prompts
├── gemini.md       # Gemini-optimized prompts
├── llama.md        # Llama-optimized prompts
├── grok.md         # Grok-optimized prompts
└── README.md       # Variant documentation
```

**Status:** 🚧 Not yet implemented (directories created with .gitkeep)

## File Statistics

- **Total subagents:** 14
- **Config files:** 14 (config.yaml)
- **Smoke tests:** 14 (smoke-test.yaml)
- **Test configs:** 14 (config.yaml)
- **READMEs:** 14
- **Prompt directories:** 14 (with .gitkeep)
- **Total files:** 56

## Related Documentation

- [Subagent Testing Guide](../../SUBAGENT_TESTING.md) - Comprehensive testing guide
- [Eval Framework Guide](../../README.md) - Main evaluation framework documentation
- [Creating Tests](../../CREATING_TESTS.md) - Test authoring guide
- [Agent Source Files](.opencode/agent/subagents/) - Original subagent definitions

## Next Steps

### Immediate Priorities

1. **Run Smoke Tests** - Verify all 14 smoke tests pass
   ```bash
   # Test each subagent
   npm run eval:sdk -- --subagent=coder-agent
   npm run eval:sdk -- --subagent=task-manager
   # ... etc
   ```

2. **Create Standalone Test Suite** - Add comprehensive standalone tests
   - Focus on core functionality
   - Test tool usage patterns
   - Validate approval gates
   - Check context loading

3. **Create Delegation Test Suite** - Add parent delegation tests
   - Test real-world delegation scenarios
   - Validate parent → subagent communication
   - Check handoff patterns

4. **Add Prompt Variants** - Create model-specific prompts
   - GPT optimizations
   - Gemini optimizations
   - Llama optimizations

### Long-term Goals

- [ ] Achieve 100% smoke test pass rate
- [ ] Create comprehensive standalone test coverage
- [ ] Create comprehensive delegation test coverage
- [ ] Add performance benchmarking
- [ ] Add multi-model testing
- [ ] Document best practices per subagent
- [ ] Create test templates for common patterns

## Contributing

When adding tests for subagents:

1. Follow the existing directory structure
2. Use descriptive test IDs and names
3. Add appropriate tags for filtering
4. Document expected behavior
5. Update the subagent's README
6. Run tests locally before committing

## Support

For issues or questions:
- See [SUBAGENT_TESTING.md](../../SUBAGENT_TESTING.md) for detailed testing guide
- Check individual subagent READMEs for specific documentation
- Review [evals/README.md](../../README.md) for framework documentation
