# Command Creator - Evaluation Tests

## Overview

**Agent:** `CommandCreator`  
**Parent Agent:** `system-builder`  
**Description:** Creates custom slash commands with clear syntax

## Test Structure

```
system-builder/command-creator/
├── config/
│   └── config.yaml          # Test configuration
├── tests/
│   └── smoke-test.yaml      # Basic sanity check
├── prompts/                 # Prompt variants (future)
└── README.md                # This file
```

## Running Tests

### Standalone Mode
Tests the subagent directly (forces `mode: primary`):

```bash
# Using npm
npm run eval:sdk -- --subagent=system-builder-command-creator

# Using Makefile
make test-subagent SUBAGENT=system-builder-command-creator

# Verbose output
npm run eval:sdk -- --subagent=system-builder-command-creator --verbose
```

### Delegation Mode
Tests via parent agent (real-world usage):

```bash
# Using npm
npm run eval:sdk -- --subagent=system-builder-command-creator --delegate

# Using Makefile
make test-subagent-delegate SUBAGENT=system-builder-command-creator
```

## Test Suites

### Smoke Tests
- **Purpose:** Basic sanity checks
- **Coverage:** Agent initialization, basic tool usage
- **Status:** ✅ Implemented

### Standalone Tests
- **Purpose:** Test subagent in isolation
- **Coverage:** Core functionality without parent delegation
- **Status:** 🚧 TODO

### Delegation Tests
- **Purpose:** Test subagent via parent agent
- **Coverage:** Real-world delegation scenarios
- **Status:** 🚧 TODO

## Adding Tests

1. Create test file in `tests/` directory
2. Follow the YAML schema from `evals/agents/shared/tests/golden/`
3. Add appropriate tags: `subagent`, `system-builder-command-creator`, suite name
4. Update this README with test description

## Prompt Variants

The `prompts/` directory is reserved for model-specific prompt variants:
- `gpt.md` - GPT-optimized prompts
- `gemini.md` - Gemini-optimized prompts
- `llama.md` - Llama-optimized prompts
- etc.

**Status:** 🚧 Not yet implemented

## Related Documentation

- [Subagent Testing Guide](../../../SUBAGENT_TESTING.md)
- [Eval Framework Guide](../../../README.md)
- [Agent Source](.opencode/agent/CommandCreator.md)

