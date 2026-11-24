# Context Installer Scripts

TypeScript implementation of the context installer for the Claude Code plugin.

## Overview

This directory contains a TypeScript-based context installer that downloads context files from the OpenAgents Control repository using git sparse-checkout.

## Files

### Core Implementation

- **`install-context.ts`** - Main installer script with CLI interface
- **`test-install.ts`** - Test script for verifying installation against real GitHub repository

### Type Definitions

- **`types/registry.ts`** - Registry schema and types (with Zod validation)
- **`types/manifest.ts`** - Manifest schema and types

### Utilities

- **`utils/registry-fetcher.ts`** - Fetch and parse built-ai-configs/registry/registry.json from GitHub
- **`utils/git-sparse.ts`** - Git sparse-checkout operations

## Usage

### Install Context

```bash
# Install essential profile (default)
bun run plugins/claude-code/scripts/install-context.ts

# Install specific profile
bun run plugins/claude-code/scripts/install-context.ts --profile=standard

# Install specific components
bun run plugins/claude-code/scripts/install-context.ts --component=core-standards --component=openagents-repo

# Dry run (see what would be installed)
bun run plugins/claude-code/scripts/install-context.ts --profile=extended --dry-run

# Force reinstall with verbose output
bun run plugins/claude-code/scripts/install-context.ts --force --verbose
```

### Run Tests

```bash
# Run test suite
bun run plugins/claude-code/scripts/test-install.ts
```

## Profiles

- **essential** - Minimal components for basic functionality
- **standard** - Standard components for typical use
- **extended** - Extended components for advanced features
- **specialized** - Specialized components for specific domains
- **all** - All available context

## Features

✅ Fetch built-ai-configs/registry/registry.json from GitHub  
✅ Parse and validate with Zod  
✅ Filter context components by profile  
✅ Download using git sparse-checkout  
✅ Create manifest tracking installation  
✅ Handle errors gracefully  
✅ Dry run mode  
✅ Verbose logging  
✅ Force reinstall option

## Architecture

### Registry Fetching

The `registry-fetcher` utility:
1. Fetches built-ai-configs/registry/registry.json from GitHub raw URL
2. Validates structure with Zod schema
3. Filters components by profile or custom IDs
4. Extracts unique directory paths for sparse checkout

### Git Sparse Checkout

The `git-sparse` utility:
1. Clones repository with `--filter=blob:none --sparse`
2. Configures sparse-checkout for specific paths
3. Copies files to target directory
4. Cleans up temporary files

### Manifest Creation

The installer creates a `.context-manifest.json` file tracking:
- Installation profile
- Source repository and commit SHA
- Downloaded components with local paths
- Installation timestamp

## Testing

The test script (`test-install.ts`) verifies:

1. **Registry Fetch** - Fetches from real GitHub repository
2. **Profile Filtering** - Filters components by profile
3. **Dry Run** - Simulates installation without downloading

To test actual installation, uncomment Test 4 in `test-install.ts`.

## Example Output

```
Context Installer
========================

ℹ Profile: essential
ℹ Repository: darrenhinde/OpenAgentsControl
ℹ Branch: main
ℹ Dry run: false

ℹ Fetching registry from GitHub...
✓ Registry version: 2.0.0
✓ Context components available: 150

ℹ Filtering by profile: essential
✓ Selected 12 components

ℹ Downloading context files...
✓ Files downloaded successfully

ℹ Copying files to context directory...
✓ Files copied to: /path/to/context

ℹ Creating manifest...
✓ Manifest created: .context-manifest.json

ℹ Verifying installation...
✓ Installation complete!
ℹ Files verified: 12/12
```

## Error Handling

The installer handles:
- Network failures (GitHub unavailable)
- Invalid registry structure
- Git command failures
- Missing dependencies (git not installed)
- File system errors

All errors are logged with clear messages and the installer exits with appropriate exit codes.

## Dependencies

- **Bun** - Runtime and package manager
- **Zod** - Schema validation
- **Git** - Sparse checkout operations

## Development

### Type Safety

All types are defined in `types/` directory with Zod schemas for runtime validation.

### Testing

Run tests before committing changes:

```bash
bun run plugins/claude-code/scripts/test-install.ts
```

### Adding New Profiles

To add a new profile, update the `Profile` type in `types/registry.ts` and the profile mapping in `utils/registry-fetcher.ts`.

## Migration from JavaScript

This TypeScript implementation replaces the original `install-context.js` with:
- Type safety with TypeScript and Zod
- Better error handling
- Modular architecture
- Comprehensive testing
- Improved documentation

The JavaScript version is kept for backward compatibility but the TypeScript version is recommended for new installations.
