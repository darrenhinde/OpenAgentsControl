# Prompt Library System

**Multi-model prompt variants with integrated evaluation framework for testing and validation.**

---

## 🎯 Quick Start

### Testing a Prompt Variant

```bash
# Test with eval framework (recommended)
cd evals/framework
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=smoke-test

# Test with specific model
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/llama3.2 --suite=core-tests

# View results
open ../results/index.html
```

### Using a Variant Permanently

```bash
# Switch to a variant
./scripts/prompts/use-prompt.sh openagent llama

# Restore default
./scripts/prompts/use-prompt.sh openagent default
```

---

## 📁 Structure

```
.opencode/prompts/
├── README.md                    # This file
├── openagent/                   # OpenAgent variants
│   ├── default.md              # Stable default (Claude-optimized)
│   ├── gpt.md                  # GPT-4 optimized
│   ├── gemini.md               # Gemini optimized
│   ├── grok.md                 # Grok optimized
│   ├── llama.md                # Llama/OSS optimized
│   ├── TEMPLATE.md             # Template for new variants
│   ├── README.md               # Variant documentation
│   └── results/                # Per-variant test results
│       ├── gpt-results.json
│       ├── gemini-results.json
│       └── llama-results.json
└── opencoder/                   # OpenCoder variants
    └── ...
```

---

## 🧪 Evaluation Framework Integration

### Running Tests with Variants

The eval framework automatically:
- ✅ Switches to the specified variant
- ✅ Runs your test suite
- ✅ Tracks results per variant
- ✅ Restores the default prompt after tests

```bash
# Smoke test (1 test, ~30s)
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=smoke-test

# Core suite (7 tests, ~5-8min)
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --suite=core-tests

# Custom test pattern
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --pattern="01-critical-rules/**/*.yaml"
```

### Auto-Model Detection

Variants specify recommended models in their YAML frontmatter:

```yaml
---
model_family: llama
recommended_models:
  - ollama/llama3.2
  - ollama/qwen2.5
---
```

If you don't specify `--model`, the framework uses the first recommended model.

### Results Tracking

Results are saved in two locations:
1. **Main results:** `evals/results/latest.json` (includes `prompt_variant` field)
2. **Per-variant:** `.opencode/prompts/{agent}/results/{variant}-results.json`

View in dashboard: `evals/results/index.html` (filter by variant)

---

## 📝 Creating a New Variant

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
---
```

### Step 3: Customize Prompt

Edit the prompt content below the frontmatter for your target model.

### Step 4: Validate

```bash
# Validate the variant exists and metadata is correct
cd evals/framework
npm run eval:sdk -- --agent=openagent --prompt-variant=my-variant --suite=smoke-test
```

### Step 5: Test Thoroughly

```bash
# Run core test suite
npm run eval:sdk -- --agent=openagent --prompt-variant=my-variant --suite=core-tests

# Check results
open ../results/index.html
```

### Step 6: Document Results

Update `.opencode/prompts/openagent/README.md` with:
- Test results (pass rate, timing)
- Known issues or limitations
- Recommended use cases

---

## 🎯 Available Variants

### OpenAgent

| Variant | Model Family | Status | Best For |
|---------|--------------|--------|----------|
| `default` | Claude | ✅ Stable | Production use, Claude models |
| `gpt` | GPT | ✅ Stable | GPT-4, GPT-4o |
| `gemini` | Gemini | ✅ Stable | Gemini 2.0, Gemini Pro |
| `grok` | Grok | ✅ Stable | Grok models (free tier) |
| `llama` | Llama/OSS | ✅ Stable | Llama, Qwen, DeepSeek, other OSS |

See [openagent/README.md](openagent/README.md) for detailed test results.

### OpenCoder

Coming soon.

---

## 🔧 Advanced Usage

### Custom Test Suites

Create custom test suites for your variant:

```bash
# Create suite
cp evals/agents/openagent/config/smoke-test.json \
   evals/agents/openagent/config/my-suite.json

# Edit suite (add your tests)
# Validate suite
cd evals/framework && npm run validate:suites openagent

# Run with your variant
npm run eval:sdk -- --agent=openagent --prompt-variant=my-variant --suite=my-suite
```

See [evals/TEST_SUITE_VALIDATION.md](../../evals/TEST_SUITE_VALIDATION.md) for details.

### Comparing Models

Test the same variant with different models:

```bash
# Test Llama 3.2
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/llama3.2 --suite=core-tests

# Test Qwen 2.5
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/qwen2.5 --suite=core-tests

# Compare results in dashboard
open evals/results/index.html
```

---

## 📊 Understanding Results

### Dashboard Features

The results dashboard (`evals/results/index.html`) shows:
- ✅ Filter by prompt variant
- ✅ Filter by model
- ✅ Pass/fail rates per variant
- ✅ Test execution times
- ✅ Detailed test results

### Result Files

**Main results** (`evals/results/latest.json`):
```json
{
  "meta": {
    "agent": "openagent",
    "model": "ollama/llama3.2",
    "prompt_variant": "llama",
    "model_family": "llama"
  },
  "summary": {
    "total": 7,
    "passed": 7,
    "failed": 0,
    "pass_rate": 1
  }
}
```

**Per-variant results** (`.opencode/prompts/openagent/results/llama-results.json`):
- Tracks all test runs for this variant
- Shows trends over time
- Helps identify regressions

---

## 🚀 For Contributors

### Creating a Variant for PR

1. **Create your variant** (don't modify default.md)
2. **Test thoroughly** with eval framework
3. **Document results** in agent README
4. **Submit PR** with variant file only

### PR Requirements

- ✅ Variant has YAML frontmatter with metadata
- ✅ Variant passes core test suite (≥85% pass rate)
- ✅ Results documented in agent README
- ✅ Default prompt unchanged
- ✅ CI validation passes

### Validation

```bash
# Validate your variant
cd evals/framework
npm run eval:sdk -- --agent=openagent --prompt-variant=your-variant --suite=core-tests

# Ensure PR uses default
./scripts/prompts/validate-pr.sh
```

---

## 🎓 Design Principles

### 1. Default is Stable
- `default.md` is tested and production-ready
- Optimized for Claude (primary model)
- All PRs must use default

### 2. Variants are Experiments
- Optimized for specific models/use cases
- May have different trade-offs
- Results documented transparently

### 3. Results are Tracked
- Every test run tracked per variant
- Dashboard shows variant performance
- Easy to compare variants

### 4. Easy to Test
- One command to test any variant
- Automatic model detection
- Results saved automatically

### 5. Safe to Experiment
- Variants don't affect default
- Easy to switch and restore
- Test before committing

---

## 📚 Related Documentation

- [Eval Framework Guide](../../evals/EVAL_FRAMEWORK_GUIDE.md) - How to run tests
- [Test Suite Validation](../../evals/TEST_SUITE_VALIDATION.md) - Creating test suites
- [OpenAgent Variants](openagent/README.md) - OpenAgent-specific docs
- [Contributing Guide](../../docs/contributing/CONTRIBUTING.md) - Contribution guidelines

---

## 🆘 Troubleshooting

### Variant Not Found

```bash
# List available variants
ls .opencode/prompts/openagent/*.md

# Check variant exists
npm run eval:sdk -- --agent=openagent --prompt-variant=your-variant --suite=smoke-test
```

### Tests Failing

1. Check variant metadata (YAML frontmatter)
2. Verify recommended model is available
3. Run with debug flag: `--debug`
4. Check results in dashboard

### Model Not Available

```bash
# Check available models
# For Ollama: ollama list
# For OpenRouter: check openrouter.ai/models

# Specify model explicitly
npm run eval:sdk -- --agent=openagent --prompt-variant=llama --model=ollama/llama3.2
```

---

## 💡 Tips

- **Start with smoke-test** - Fast validation (1 test, ~30s)
- **Use core-tests for thorough testing** - 7 tests, ~5-8min
- **Check dashboard regularly** - Visual feedback on variant performance
- **Document your findings** - Help others by sharing results
- **Test with multiple models** - Same variant may perform differently

---

## 🔮 Future Enhancements

- [ ] Automated variant comparison reports
- [ ] Performance benchmarking across variants
- [ ] Variant recommendation based on model
- [ ] Historical trend analysis
- [ ] A/B testing framework

---

**Questions?** See [openagent/README.md](openagent/README.md) or open an issue.
