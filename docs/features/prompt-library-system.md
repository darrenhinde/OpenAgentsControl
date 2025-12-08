# Prompt Library System

**Multi-model prompt variants with integrated evaluation framework for testing, validation, and continuous improvement.**

Last Updated: 2025-12-08
Status: ✅ Production Ready

---

## 📋 Quick Links

- [Main Prompts README](../../.opencode/prompts/README.md)
- [OpenAgent Variants](../../.opencode/prompts/openagent/README.md)
- [Eval Framework Guide](../../evals/EVAL_FRAMEWORK_GUIDE.md)
- [Test Suite Validation](../../evals/TEST_SUITE_VALIDATION.md)

---

## Overview

The Prompt Library System enables model-specific prompt optimization with comprehensive testing and validation.

### Key Features

✅ **Multi-Model Support** - Variants for Claude, GPT-4, Gemini, Grok, Llama/OSS
✅ **Integrated Testing** - Test variants with eval framework
✅ **Results Tracking** - Per-variant and per-model results
✅ **Easy Switching** - Switch between variants with one command
✅ **Validation** - JSON Schema + TypeScript validation
✅ **Dashboard** - Visual results with variant filtering

### Quick Start

```bash
# Test a variant
cd evals/framework
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=smoke-test

# View results
open ../results/index.html
```

---

## System Status

**Completed Features:**
- ✅ Prompt variant management (PromptManager)
- ✅ Evaluation framework integration (--prompt-variant flag)
- ✅ Results tracking (dual save: main + per-variant)
- ✅ Dashboard filtering (variant badges and filters)
- ✅ Test suite validation (JSON Schema + Zod)
- ✅ CLI validation tool
- ✅ GitHub Actions workflow
- ✅ Comprehensive documentation

**Tested & Working:**
- ✅ All 5 variants (default, gpt, gemini, grok, llama)
- ✅ Smoke test suite (1 test)
- ✅ Core test suite (7 tests)
- ✅ Grok model integration
- ✅ Results dashboard
- ✅ Suite validation

---

## Documentation

See the comprehensive documentation files:

1. **[Main Prompts README](../../.opencode/prompts/README.md)**
   - Quick start guide
   - Creating variants
   - Testing workflow
   - Advanced usage

2. **[OpenAgent Variants README](../../.opencode/prompts/openagent/README.md)**
   - Capabilities matrix
   - Variant details
   - Test results
   - Best practices

3. **[Eval Framework Guide](../../evals/EVAL_FRAMEWORK_GUIDE.md)**
   - How tests work
   - Running tests
   - Understanding results

4. **[Test Suite Validation](../../evals/TEST_SUITE_VALIDATION.md)**
   - Creating test suites
   - Validation system
   - JSON Schema reference

5. **[Validation Quick Reference](../../evals/VALIDATION_QUICK_REF.md)**
   - Quick commands
   - Common fixes
   - Troubleshooting

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Prompt Library System                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Variants   │─────▶│ Eval Framework│─────▶│ Dashboard │ │
│  │  (.md files) │      │  (Test Runner)│      │ (Results) │ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      │                     │       │
│         │                      │                     │       │
│  ┌──────▼──────┐      ┌───────▼────────┐   ┌────────▼────┐ │
│  │   Metadata  │      │  Test Suites   │   │   Results   │ │
│  │(YAML Front) │      │  (JSON files)  │   │(JSON files) │ │
│  └─────────────┘      └────────────────┘   └─────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

**Prompt Variants:**
- `.opencode/prompts/openagent/*.md` - Variant files
- `.opencode/prompts/openagent/results/*.json` - Per-variant results

**Test Suites:**
- `evals/agents/openagent/config/*.json` - Suite definitions
- `evals/agents/openagent/config/suite-schema.json` - JSON Schema

**Framework:**
- `evals/framework/src/sdk/prompt-manager.ts` - Prompt switching
- `evals/framework/src/sdk/suite-validator.ts` - Suite validation
- `evals/framework/src/sdk/run-sdk-tests.ts` - Test runner

**Results:**
- `evals/results/latest.json` - Main results
- `evals/results/index.html` - Dashboard

---

## Usage Examples

### Testing Variants

```bash
# Quick smoke test (1 test, ~30s)
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=smoke-test

# Core test suite (7 tests, ~5-8min)
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=core-tests

# With specific model
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/llama3.2 --suite=core-tests

# Custom test pattern
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --pattern="01-critical-rules/**/*.yaml"
```

### Creating Variants

```bash
# 1. Copy template
cp .opencode/prompts/openagent/TEMPLATE.md .opencode/prompts/openagent/my-variant.md

# 2. Edit metadata and content
# 3. Test
npm run eval:sdk -- --agent=openagent --prompt-variant=my-variant --suite=smoke-test

# 4. Validate
cd evals/framework && npm run validate:suites openagent
```

### Creating Test Suites

```bash
# 1. Copy existing suite
cp evals/agents/openagent/config/smoke-test.json \
   evals/agents/openagent/config/my-suite.json

# 2. Edit suite
# 3. Validate
cd evals/framework && npm run validate:suites openagent

# 4. Run
npm run eval:sdk -- --agent=openagent --suite=my-suite
```

---

## API Reference

### PromptManager

```typescript
class PromptManager {
  constructor(projectRoot: string);
  variantExists(agent: string, variant: string): boolean;
  listVariants(agent: string): string[];
  readMetadata(agent: string, variant: string): PromptMetadata;
  switchToVariant(agent: string, variant: string): SwitchResult;
  restoreDefault(agent: string): boolean;
}
```

### SuiteValidator

```typescript
class SuiteValidator {
  constructor(agentsDir: string);
  loadSuite(agent: string, suiteName: string): TestSuite;
  validateSuite(agent: string, suite: TestSuite): ValidationResult;
  getTestPaths(agent: string, suite: TestSuite): string[];
}
```

---

## Test Results

All variants tested with core test suite (7 tests):

| Variant | Pass Rate | Model Tested | Status |
|---------|-----------|--------------|--------|
| default | 7/7 (100%) | opencode/grok-code-fast | ✅ Stable |
| gpt | 7/7 (100%) | opencode/grok-code-fast | ✅ Stable |
| gemini | 7/7 (100%) | opencode/grok-code-fast | ✅ Stable |
| grok | 7/7 (100%) | opencode/grok-code-fast | ✅ Stable |
| llama | 7/7 (100%) | opencode/grok-code-fast | ✅ Stable |

---

## Future Enhancements

- [ ] Automated variant comparison reports
- [ ] Performance benchmarking across variants
- [ ] Variant recommendation based on model
- [ ] Historical trend analysis
- [ ] A/B testing framework
- [ ] Automated regression detection

---

## Related Documentation

- [Main README](../../README.md)
- [Contributing Guide](../contributing/CONTRIBUTING.md)
- [Agent System Blueprint](./agent-system-blueprint.md)

---

**Questions?** Open an issue or see the main README.
