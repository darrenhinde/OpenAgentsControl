# Coder Agent - Evaluation Tests

## Overview

**Agent:** `CoderAgent`  
**Parent Agent:** `opencoder`  
**Description:** Executes focused coding subtasks in sequence

## Test Structure

```
code/coder-agent/
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
npm run eval:sdk -- --subagent=code-coder-agent

# Using Makefile
make test-subagent SUBAGENT=code-coder-agent

# Verbose output
npm run eval:sdk -- --subagent=code-coder-agent --verbose
```

### Delegation Mode
Tests via parent agent (real-world usage):

```bash
# Using npm
npm run eval:sdk -- --subagent=code-coder-agent --delegate

# Using Makefile
make test-subagent-delegate SUBAGENT=code-coder-agent
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
3. Add appropriate tags: `subagent`, `code-coder-agent`, suite name
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
- [Agent Source](.opencode/agent/CoderAgent.md)

