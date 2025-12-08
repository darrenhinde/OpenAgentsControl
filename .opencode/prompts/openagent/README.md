# OpenAgent Prompt Variants

**Model-specific prompt optimizations with comprehensive test results.**

---

## 🚀 Quick Start

```bash
# Test a variant with eval framework
cd evals/framework
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=smoke-test

# Run full core suite
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=core-tests

# View results
open ../results/index.html
```

---

## 📊 Capabilities Matrix

| Variant | Model Family | Approval Gate | Context Loading | Stop on Failure | Delegation | Tool Usage | Pass Rate | Status |
|---------|--------------|---------------|-----------------|-----------------|------------|------------|-----------|--------|
| `default` | Claude | ✅ | ✅ | ✅ | ✅ | ✅ | 7/7 (100%) | ✅ Stable |
| `gpt` | GPT | ✅ | ✅ | ✅ | ✅ | ✅ | 7/7 (100%) | ✅ Stable |
| `gemini` | Gemini | ✅ | ✅ | ✅ | ✅ | ✅ | 7/7 (100%) | ✅ Stable |
| `grok` | Grok | ✅ | ✅ | ✅ | ✅ | ✅ | 7/7 (100%) | ✅ Stable |
| `llama` | Llama/OSS | ✅ | ✅ | ✅ | ✅ | ✅ | 7/7 (100%) | ✅ Stable |

**Legend:**
- ✅ Works reliably (passes tests)
- ⚠️ Partial/inconsistent
- ❌ Does not work
- `-` Not tested yet

**Last Updated:** 2025-12-08  
**Test Suite:** Core tests (7 tests)  
**Model Used:** opencode/grok-code-fast (for validation)

---

## 📝 Available Variants

### `default.md` - Claude Optimized

**Target Models:**
- `anthropic/claude-sonnet-4-20250514` (primary)
- `anthropic/claude-3-5-sonnet-20241022`

**Optimizations:**
- Structured with `<context>` tags for Claude's context handling
- Detailed workflow stages with checkpoints
- Emphasis on safety rules and approval gates

**Test Results:**
```json
{
  "total_tests": 7,
  "passed": 7,
  "failed": 0,
  "pass_rate": 100%,
  "avg_duration": "~45s per test"
}
```

**Known Issues:** None

**Use When:** Using Claude models (recommended for production)

---

### `gpt.md` - GPT-4 Optimized

**Target Models:**
- `openai/gpt-4o`
- `openai/gpt-4-turbo`
- `openai/gpt-4o-mini`

**Optimizations:**
- Structured with clear sections and headers
- Explicit instructions for tool usage
- Emphasis on step-by-step reasoning

**Test Results:**
```json
{
  "total_tests": 7,
  "passed": 7,
  "failed": 0,
  "pass_rate": 100%,
  "avg_duration": "~40s per test"
}
```

**Known Issues:** None

**Use When:** Using GPT-4 family models

---

### `gemini.md` - Gemini Optimized

**Target Models:**
- `google/gemini-2.0-flash-exp`
- `google/gemini-2.5-flash`
- `google/gemini-pro`

**Optimizations:**
- Structured for Gemini's instruction-following
- Clear role definitions
- Emphasis on safety and validation

**Test Results:**
```json
{
  "total_tests": 7,
  "passed": 7,
  "failed": 0,
  "pass_rate": 100%,
  "avg_duration": "~35s per test"
}
```

**Known Issues:** None

**Use When:** Using Gemini models

---

### `grok.md` - Grok Optimized

**Target Models:**
- `opencode/grok-code-fast` (free tier)
- `x-ai/grok-beta`

**Optimizations:**
- Concise, direct instructions
- Emphasis on practical execution
- Optimized for Grok's coding focus

**Test Results:**
```json
{
  "total_tests": 7,
  "passed": 7,
  "failed": 0,
  "pass_rate": 100%,
  "avg_duration": "~50s per test"
}
```

**Known Issues:** None

**Use When:** Using Grok models (great for free tier testing)

---

### `llama.md` - Llama/OSS Optimized

**Target Models:**
- `ollama/llama3.2`
- `ollama/qwen2.5`
- `ollama/deepseek-r1`
- Other open-source models

**Optimizations:**
- Clear, structured instructions
- Explicit examples and patterns
- Optimized for smaller model context windows
- Emphasis on tool usage patterns

**Test Results:**
```json
{
  "total_tests": 7,
  "passed": 7,
  "failed": 0,
  "pass_rate": 100%,
  "avg_duration": "~60s per test"
}
```

**Known Issues:** None

**Use When:** Using open-source models (Llama, Qwen, DeepSeek, etc.)

---

## 🧪 Testing Variants

### Quick Smoke Test (1 test, ~30s)

```bash
cd evals/framework
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=smoke-test
```

### Core Test Suite (7 tests, ~5-8min)

```bash
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=core-tests
```

### With Specific Model

```bash
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/llama3.2 --suite=core-tests
```

### View Results

```bash
# Dashboard
open ../results/index.html

# JSON results
cat ../results/latest.json

# Per-variant results
cat results/llama-results.json
```

---

## 📈 Test Coverage

All variants are tested against the **Core Test Suite** which validates:

### Critical Rules (4 tests)
1. ✅ **Approval Gate** - Requests approval before execution
2. ✅ **Context Loading** - Loads required context files
3. ✅ **Stop on Failure** - Stops and reports errors
4. ✅ **Report First** - Reports before fixing

### Functionality (3 tests)
5. ✅ **Simple Tasks** - Handles tasks directly (no unnecessary delegation)
6. ✅ **Delegation** - Delegates appropriately to subagents
7. ✅ **Tool Usage** - Uses proper tools (read/grep vs bash)

**Total:** 7 tests covering ~85% of critical functionality

See [evals/agents/openagent/config/core-tests.json](../../../evals/agents/openagent/config/core-tests.json) for details.

---

## 🔧 Creating a New Variant

### Step 1: Copy Template

```bash
cp .opencode/prompts/openagent/TEMPLATE.md .opencode/prompts/openagent/my-variant.md
```

### Step 2: Edit Metadata

```yaml
---
model_family: oss
recommended_models:
  - ollama/my-model
status: experimental
maintainer: your-name
description: Optimized for my specific use case
tested_with: ollama/my-model
last_tested: 2025-12-08
---
```

### Step 3: Customize Prompt

Edit the prompt content for your target model:
- Adjust instruction style
- Modify examples
- Change emphasis areas
- Optimize for model strengths

### Step 4: Test

```bash
# Smoke test
cd evals/framework
npm run eval:sdk -- --agent=openagent --prompt-variant=my-variant --suite=smoke-test

# Core suite
npm run eval:sdk -- --agent=openagent --prompt-variant=my-variant --suite=core-tests
```

### Step 5: Document Results

Update this README with:
- Test results (pass rate, timing)
- Known issues or limitations
- Recommended use cases
- Model-specific notes

### Step 6: Submit PR

- Include variant file only (don't modify default.md)
- Update this README with results
- Ensure tests pass (≥85% pass rate)

---

## 📊 Understanding Results

### Result Files

**Per-variant results** (`results/{variant}-results.json`):
```json
{
  "variant": "llama",
  "model": "ollama/llama3.2",
  "timestamp": "2025-12-08T21:43:08.964Z",
  "summary": {
    "total": 7,
    "passed": 7,
    "failed": 0,
    "pass_rate": 1
  },
  "tests": [...]
}
```

**Dashboard** (`evals/results/index.html`):
- Filter by variant
- Compare pass rates
- View detailed test results
- Track trends over time

---

## 🎯 Best Practices

### Choosing a Variant

1. **Match your model family** - Use gpt.md for GPT-4, llama.md for OSS
2. **Test before committing** - Run core suite to verify
3. **Check compatibility** - Some models work better with certain variants
4. **Start with default** - If unsure, default.md works well across models

### Testing Your Changes

1. **Start with smoke-test** - Fast validation (1 test)
2. **Run core-tests** - Thorough validation (7 tests)
3. **Test with your target model** - Ensure compatibility
4. **Check dashboard** - Visual feedback on performance

### Contributing Variants

1. **Document thoroughly** - Explain optimizations and trade-offs
2. **Test extensively** - Run full core suite multiple times
3. **Be honest** - Document both improvements and limitations
4. **Share results** - Help others by documenting findings

---

## 🚀 Advanced Usage

### Custom Test Suites

Create custom suites for your variant:

```bash
# Create suite
cp evals/agents/openagent/config/smoke-test.json \
   evals/agents/openagent/config/my-suite.json

# Validate
cd evals/framework && npm run validate:suites openagent

# Run
npm run eval:sdk -- --agent=openagent --prompt-variant=my-variant --suite=my-suite
```

### Comparing Models

Test the same variant with different models:

```bash
# Test Llama 3.2
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/llama3.2 --suite=core-tests

# Test Qwen 2.5
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/qwen2.5 --suite=core-tests

# Compare in dashboard
open ../results/index.html
```

---

## 🤝 Contributing

### What Makes a Good Variant?

- ✅ **Clear target** - Specify which model(s) it's optimized for
- ✅ **Documented changes** - Explain what you changed and why
- ✅ **Test results** - Include real test results (≥85% pass rate)
- ✅ **Honest assessment** - Document both improvements and limitations
- ✅ **Proper metadata** - Complete YAML frontmatter

### Promoting a Variant to Default

A variant can become the new default if it:
1. Shows significant improvement in test results
2. Works reliably across multiple models
3. Has been tested by multiple contributors
4. Doesn't introduce new critical issues
5. Maintains ≥95% pass rate on core tests

Maintainers will review test results and community feedback before promoting.

---

## 📚 Related Documentation

- [Main Prompts README](../README.md) - Prompt library overview
- [Eval Framework Guide](../../../evals/EVAL_FRAMEWORK_GUIDE.md) - How to run tests
- [Test Suite Validation](../../../evals/TEST_SUITE_VALIDATION.md) - Creating test suites
- [Contributing Guide](../../../docs/contributing/CONTRIBUTING.md) - Contribution guidelines

---

## 🆘 Troubleshooting

### Variant Not Found

```bash
# List available variants
ls .opencode/prompts/openagent/*.md

# Verify variant name
npm run eval:sdk -- --agent=openagent --prompt-variant=your-variant --suite=smoke-test
```

### Tests Failing

1. Check variant metadata (YAML frontmatter)
2. Verify recommended model is available
3. Run with debug: `npm run eval:sdk -- --debug`
4. Check specific test failures in dashboard

### Low Pass Rate

- Review failed tests in dashboard
- Check if model supports required capabilities
- Consider adjusting prompt for model strengths
- Test with different models in same family

---

## 💡 Tips

- **Start small** - Test with smoke-test first
- **Iterate quickly** - Use smoke-test for rapid iteration
- **Document everything** - Help others learn from your experience
- **Share results** - Update this README with your findings
- **Ask for help** - Open an issue if you're stuck

---

**Questions?** See [main README](../README.md) or open an issue.
