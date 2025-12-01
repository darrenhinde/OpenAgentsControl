# OpenAgent Prompt Variants

## Capabilities Matrix

| Variant | Approval Gate | Context Loading | Stop on Failure | Simple Tasks | Tool Usage | Delegation | Pass Rate | Last Tested |
|---------|---------------|-----------------|-----------------|--------------|------------|------------|-----------|-------------|
| default | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ✅ | 3/7 (42.9%) | Not yet tested |

**Legend:**
- ✅ Works reliably
- ⚠️ Partial/inconsistent
- ❌ Does not work
- `-` Not tested yet

## Variants

### `default.md`
- **Target**: Claude Sonnet 4.5 (anthropic/claude-sonnet-4-5)
- **Focus**: Balanced capabilities, optimized for Sonnet 4.5
- **Status**: Stable, used in all PRs
- **Known Issues**: 
  - Approval gate requires runtime enforcement (cannot be fixed with prompts alone)
  - Stop on failure detection needs improvement
- **Test Results**: See `results/default-results.json`
- **Note**: For smaller/faster models, create a variant optimized for that model

## Testing a Variant

```bash
# Test the default variant
./scripts/prompts/test-prompt.sh openagent default

# View results
cat .opencode/prompts/openagent/results/default-results.json
```

## Creating a New Variant

1. Copy `TEMPLATE.md` to `your-variant.md`
2. Edit for your target model
3. Test: `./scripts/prompts/test-prompt.sh openagent your-variant`
4. Update this README with results
5. Submit PR (variant only, not as default)

## Contributing

See `TEMPLATE.md` for the structure and `docs/contributing/CONTRIBUTING.md` for guidelines.

### What Makes a Good Variant?

- **Clear Target**: Specify which model it's optimized for
- **Documented Changes**: Explain what you changed and why
- **Test Results**: Include real test results
- **Honest Assessment**: Document both improvements and limitations

### Promoting a Variant to Default

A variant can become the new default if it:
1. Shows significant improvement in test results
2. Works reliably across multiple models
3. Has been tested by multiple contributors
4. Doesn't introduce new critical issues

Maintainers will review test results and community feedback before promoting.
