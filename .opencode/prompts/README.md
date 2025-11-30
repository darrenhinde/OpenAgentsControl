# Prompt Library

This directory contains model-specific prompt variants for OpenCode agents.

## Structure

Each agent has its own directory:
- `openagent/` - Main orchestration agent
- `opencoder/` - Development specialist agent

## How It Works

### For Users

**Testing a variant:**
```bash
./scripts/prompts/test-prompt.sh openagent sonnet-4
```

**Using a variant permanently:**
```bash
./scripts/prompts/use-prompt.sh openagent sonnet-4
```

**Restoring default:**
```bash
./scripts/prompts/use-prompt.sh openagent default
```

### For Contributors

1. Copy `TEMPLATE.md` to create a new variant
2. Edit the prompt for your target model
3. Test it: `./scripts/prompts/test-prompt.sh openagent your-variant`
4. Document results in the agent's README
5. Submit PR with your variant (NOT as the default)

### For PRs

All PRs must use the default prompt. CI validates this automatically.

To ensure your PR uses defaults:
```bash
./scripts/prompts/validate-pr.sh
```

## Design Principles

1. **Default is Stable**: The `default.md` variant is tested and stable
2. **Variants are Experiments**: Other variants are optimized for specific models
3. **Results are Documented**: Each variant shows real test results
4. **PRs Use Default**: CI enforces this to keep main branch stable

## Model Compatibility

Different AI models have different strengths. The prompt library allows:
- **Optimization**: Prompts tailored to specific model capabilities
- **Experimentation**: Test new approaches without breaking main
- **Transparency**: Document what works and what doesn't
- **Flexibility**: Users choose the best prompt for their setup

## Contributing

See each agent's README for:
- Available variants
- Test results and capabilities
- How to create new variants
- Model-specific optimizations

For detailed contribution guidelines, see [CONTRIBUTING.md](../../docs/contributing/CONTRIBUTING.md).
