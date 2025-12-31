# backend specialist Prompt Variants

## Default Prompt

The **default prompt** is the agent file itself: `.opencode/agent/development/backend-specialist.md`

This is optimized for **Claude** (Anthropic models) and serves as the baseline.

## Model-Specific Variants

This directory is ready for model-specific optimizations:

| Variant | Model Family | Status | Best For |
|---------|--------------|--------|----------|
| gpt.md | GPT | 📝 Not yet created | GPT-4, GPT-4o |
| llama.md | Llama/OSS | 📝 Not yet created | Llama, Qwen, DeepSeek |
| gemini.md | Gemini | 📝 Not yet created | Gemini Pro, Gemini Ultra |

## Creating Variants

To create a model-specific variant:

1. Copy the agent file as a starting point
2. Adapt the prompt for the target model's characteristics
3. Test with the eval framework
4. Document results in this README

## Testing Variants

```bash
cd evals/framework

# Test default (agent file itself)
npm run eval:sdk -- --agent=development/backend-specialist

# Test model variants (when created)
npm run eval:sdk -- --agent=development/backend-specialist --prompt-variant=gpt
npm run eval:sdk -- --agent=development/backend-specialist --prompt-variant=llama
```

## Results

| Variant | Pass Rate | Notes |
|---------|-----------|-------|
| default (agent file) | - | Not yet tested |
| gpt | - | Not yet created |
| llama | - | Not yet created |
| gemini | - | Not yet created |
