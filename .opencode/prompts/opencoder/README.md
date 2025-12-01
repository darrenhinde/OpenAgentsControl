# OpenCoder Prompt Variants

## Capabilities Matrix

| Variant | Code Quality | TDD Support | Incremental Dev | Build Checks | Test Execution | Pass Rate | Last Tested |
|---------|--------------|-------------|-----------------|--------------|----------------|-----------|-------------|
| default | ✅ | ✅ | ✅ | ✅ | ✅ | Not yet tested | - |

**Legend:**
- ✅ Works reliably
- ⚠️ Partial/inconsistent
- ❌ Does not work
- `-` Not tested yet

## Variants

### `default.md`
- **Target**: Claude Sonnet 4.5 (anthropic/claude-sonnet-4-5)
- **Focus**: Clean, maintainable code with TDD workflow
- **Status**: Stable, used in all PRs
- **Note**: For smaller/faster models, create a variant optimized for that model
- **Features**:
  - Plan-and-approve workflow
  - Incremental implementation
  - Test-driven development
  - Build and type checking
- **Test Results**: See `results/default-results.json` (once tested)

## Testing a Variant

```bash
# Test the default variant
./scripts/prompts/test-prompt.sh opencoder default

# View results
cat .opencode/prompts/opencoder/results/default-results.json
```

## Creating a New Variant

1. Copy `TEMPLATE.md` to `your-variant.md`
2. Edit for your target model or use case
3. Test: `./scripts/prompts/test-prompt.sh opencoder your-variant`
4. Update this README with results
5. Submit PR (variant only, not as default)

## Contributing

See `TEMPLATE.md` for the structure and `docs/contributing/CONTRIBUTING.md` for guidelines.
