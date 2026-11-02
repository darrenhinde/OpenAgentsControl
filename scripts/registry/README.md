# Registry Validation Scripts

This directory contains scripts to validate the `built-ai-configs/registry/registry.json` file.

## Available Scripts

### TypeScript Version (Recommended) ⚡

**Fast, modern, and easy to debug**

```bash
# Run validation
npm run validate:registry

# Run with verbose output
npm run validate:registry:verbose

# Run with fix suggestions
npm run validate:registry:fix

# Or run directly with bun
bun run scripts/registry/validate-registry.ts
bun run scripts/registry/validate-registry.ts -v
bun run scripts/registry/validate-registry.ts -f
```

**Requirements:**
- Bun runtime

**Features:**
- ✅ Fast execution (< 1 second)
- ✅ Easy to debug
- ✅ Type-safe
- ✅ Validates all registry paths
- ✅ Validates component dependencies
- ✅ Colored output
- ✅ Verbose mode
- ✅ Fix suggestions

### Bash Version (Legacy)

**Original bash script - still maintained for CI compatibility**

```bash
# Run validation
./scripts/registry/validate-registry.sh

# Run with verbose output
./scripts/registry/validate-registry.sh -v

# Run with fix suggestions
./scripts/registry/validate-registry.sh -f
```

**Requirements:**
- bash
- jq

**Note:** The bash version may hang in some CI environments. The TypeScript version is recommended for local development.

## What Gets Validated

Both scripts validate:

1. **Registry JSON Format** - Ensures `built-ai-configs/registry/registry.json` is valid JSON
2. **Component Paths** - Verifies all file paths in the registry exist
3. **Component Dependencies** - Validates that all dependencies reference existing components

## Exit Codes

- `0` - All paths valid, all dependencies valid
- `1` - Missing files or missing dependencies found
- `2` - Registry parse error or missing script dependencies

## CI Integration

The GitHub Actions workflow (`.github/workflows/validate-registry.yml`) currently uses the bash version for compatibility with the base branch workflow file. Once this PR is merged, future PRs can use the TypeScript version.

## Development

To modify the TypeScript validator:

1. Edit `scripts/registry/validate-registry.ts`
2. Test locally: `npm run validate:registry`
3. Commit changes

The TypeScript version is the source of truth for new features.
