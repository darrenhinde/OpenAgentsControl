# ContextScout - Evaluation Tests

## Overview

**Agent:** `ContextScout`  
**Parent Agent:** `openagent`  
**Description:** Intelligent context discovery and retrieval with MVI-aware prioritization

## Test Structure

```
core/contextscout/
├── config/
│   └── config.yaml                  # Test configuration
├── tests/
│   ├── smoke-test.yaml              # ✅ Basic sanity check
│   ├── 02-discovery-test.yaml       # Context structure discovery
│   ├── 03-search-standards.yaml     # Search for specific files
│   ├── 04-content-extraction.yaml   # Extract key findings
│   └── 05-no-context-handling.yaml  # Edge case handling
├── prompts/                         # Prompt variants (future)
└── README.md                        # This file
```

## Running Tests

### Run All Tests

```bash
# Run all tests for ContextScout
cd evals/framework
npm run eval:sdk -- --agent=ContextScout

# Run specific test
npm run eval:sdk -- --agent=ContextScout --pattern="smoke-test.yaml"

# Run with debug output
npm run eval:sdk -- --agent=ContextScout --pattern="smoke-test.yaml" --debug
```

### Test Results

**Last Run:** 2026-01-07  
**Status:** ✅ Smoke test passing

```
✅ smoke-test.yaml - Basic operation verified
   Duration: 13.9s
   Tool calls: 2
   Violations: 0
```

**Other Tests:** Discovery, search, extraction, and edge case tests available but require longer timeouts.

## Test Suites

### Smoke Test (`smoke-test.yaml`)
- **Purpose:** Basic sanity check
- **Coverage:** Agent responds to simple context query
- **Status:** ✅ Passing
- **Prompt:** "What context files exist in .opencode/context/core/?"

### Discovery Test (`02-discovery-test.yaml`)
- **Purpose:** Map repository context structure
- **Coverage:** Discover directories, count files, identify patterns
- **Status:** ✅ Implemented
- **Prompt:** "Discover and map the context structure"

### Search Test (`03-search-standards.yaml`)
- **Purpose:** Find specific context files
- **Coverage:** Search for code standards, extract key findings
- **Status:** ✅ Implemented
- **Prompt:** "Find the code standards for this project"

### Extraction Test (`04-content-extraction.yaml`)
- **Purpose:** Extract meaningful information from context
- **Coverage:** Read files, extract findings, provide actionable steps
- **Status:** ✅ Implemented
- **Prompt:** "Search for documentation standards and extract key requirements"

### Edge Case Test (`05-no-context-handling.yaml`)
- **Purpose:** Handle missing context gracefully
- **Coverage:** Search empty directories, report honestly, suggest alternatives
- **Status:** ✅ Implemented
- **Prompt:** "Search for API design guidelines in empty directory"

## Adding Tests

1. Create test file in `tests/` directory
2. Follow the YAML schema from `evals/agents/shared/tests/golden/`
3. Add appropriate tags: `subagent`, `core-contextscout`, suite name
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
- [Agent Source](.opencode/agent/ContextScout.md)

