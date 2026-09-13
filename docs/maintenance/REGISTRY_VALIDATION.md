# Registry Validation & Dependency Checking

> **Current state (2026-09-02):** This maintenance record predates the canonical metadata migration. Current agent metadata comes only from `content/agents/**` `oac:` blocks through RegistryEmitter; do not edit or restore the retired metadata sidecar.

This document describes the comprehensive validation system to prevent registry inconsistencies and ensure the installer works correctly.

## Overview

We have three levels of validation to catch issues before they reach users:

1. **Registry Validator** - Validates that registry paths point to actual files
2. **Dependency Checker** - Validates that all dependencies and profile references exist
3. **Installer Test** - Simulates the installer to ensure files are accessible

## Scripts

### 1. Registry Validator (`validate-registry.ts`)

Validates that all paths in `registry.json` point to actual files on disk.

**Usage:**
```bash
# Basic validation
bun run scripts/registry/validate-registry.ts

# With verbose output
bun run scripts/registry/validate-registry.ts --verbose

# With fix suggestions
bun run scripts/registry/validate-registry.ts --fix
```

**Checks:**
- All component paths exist
- All dependencies exist in registry
- Registry is valid JSON

**Exit codes:**
- 0 = All paths valid
- 1 = Missing files found
- 2 = Registry parse error

### 2. Dependency Checker (`check-dependencies.ts`)

Comprehensive check for missing dependencies and profile inconsistencies.

**Usage:**
```bash
# Basic check
bun run scripts/registry/check-dependencies.ts

# With verbose output
bun run scripts/registry/check-dependencies.ts --verbose
```

**Checks:**
- All profile components exist in registry
- All component dependencies exist in registry
- Critical infrastructure files are included
- No orphaned references

**Critical files that must be in registry:**
- `root-navigation` (`.opencode/context/navigation.md`)
- `context-paths-config` (`.opencode/context/core/config/paths.json`)
- `context-system` (`.opencode/context/core/context-system.md`)

**Exit codes:**
- 0 = All checks passed
- 1 = Missing dependencies found
- 2 = Critical files missing
- 3 = Configuration errors

### 3. Installer Test (`test-installer-files.sh`)

Simulates the installer by checking if files are accessible from GitHub.

**Usage:**
```bash
# Test with local registry (faster, for development)
./scripts/tests/test-installer-files.sh --local --profile=essential

# Test with remote registry (simulates actual installation)
./scripts/tests/test-installer-files.sh --profile=essential

# Test all components
./scripts/tests/test-installer-files.sh --local --all

# Test specific profile with verbose output
./scripts/tests/test-installer-files.sh --local --profile=developer --verbose
```

**Supported profiles:**
- `essential` - Minimal starter kit
- `developer` - Complete dev environment
- `business` - Business automation
- `full` - Everything included
- `advanced` - With System Builder

## Integration with CI/CD

### GitHub Actions

Add this to `.github/workflows/registry-validation.yml`:

```yaml
name: Registry Validation

on:
  push:
    paths:
      - 'registry.json'
      - '.opencode/profiles/**'
      - '.opencode/config/**'
      - 'scripts/registry/**'
  pull_request:
    paths:
      - 'registry.json'
      - '.opencode/profiles/**'
      - '.opencode/config/**'
      - 'scripts/registry/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Bun
      uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
    
    - name: Install dependencies
      run: bun install
    
    - name: Validate registry paths
      run: bun run scripts/registry/validate-registry.ts
    
    - name: Check dependencies
      run: bun run scripts/registry/check-dependencies.ts
    
    - name: Test installer (Essential profile)
      run: |
        chmod +x scripts/tests/test-installer-files.sh
        ./scripts/tests/test-installer-files.sh --local --profile=essential
    
    - name: Test installer (Developer profile)
      run: ./scripts/tests/test-installer-files.sh --local --profile=developer
```

### Pre-commit Hook

Install the pre-commit hook to catch issues before committing:

```bash
# Copy the hook to .git/hooks
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Or use with Husky
npx husky add .husky/pre-commit "bun run scripts/registry/check-dependencies.ts"
```

## Common Issues & Solutions

### Issue: "Missing critical file: Root navigation"

**Cause:** `navigation.md` at `.opencode/context/navigation.md` is not in registry.

**Solution:**
```json
{
  "id": "root-navigation",
  "name": "Root Navigation",
  "type": "context",
  "path": ".opencode/context/navigation.md",
  "category": "essential"
}
```

### Issue: "Profile references missing component: context:adding-skill"

**Cause:** Profile references a component ID that doesn't exist in registry.

**Solution:**
1. Check if the component was renamed (e.g., `adding-skill` → `adding-skill-basics`)
2. Update the profile to use the correct ID
3. Run `bun run scripts/registry/check-dependencies.ts` to verify

### Issue: "Component depends on missing: context:workflows-delegation"

**Cause:** A component's `dependencies` array references a non-existent component.

**Solution:**
1. Check if the dependency was renamed or removed
2. Update the component's dependencies
3. For agents, update dependencies in the canonical `content/agents/**` source and regenerate the registry with `oac build`

### Issue: Split files not in registry

**Cause:** When a file is split (e.g., `design-iteration.md` → multiple files), the new files weren't added to registry.

**Solution:**
1. Identify all split files: `ls .opencode/context/core/workflows/design-iteration-*.md`
2. Add each to registry with unique IDs
3. Remove the old monolithic entry if it no longer exists
4. Update any dependencies that reference the old ID

## Best Practices

### Before Committing Changes

Always run:
```bash
# 1. Validate registry
bun run scripts/registry/validate-registry.ts

# 2. Check dependencies
bun run scripts/registry/check-dependencies.ts

# 3. Test installer
./scripts/tests/test-installer-files.sh --local --profile=essential
```

### When Adding New Components

1. **Add to registry.json:**
   - Ensure unique ID
   - Correct path relative to repo root
   - Appropriate category (essential, standard, advanced)

2. **Add to profiles:**
   - Update `.opencode/profiles/<name>/profile.json`
   - Also check if profiles section exists in registry.json

3. **Add dependencies:**
   - If component references other components, add to `dependencies` array
   - Verify all dependencies exist

4. **Run validation:**
   ```bash
   bun run scripts/registry/check-dependencies.ts
   ```

### When Removing Components

1. **Remove from registry.json:**
   - Delete the component entry

2. **Update dependent components:**
   - Search for references: `grep -r "component:old-id" .opencode/`
   - Update or remove dependencies

3. **Update profiles:**
   - Remove from all profile.json files
   - Check both `.opencode/profiles/` and registry.json profiles section

4. **Run validation:**
   ```bash
   bun run scripts/registry/check-dependencies.ts
   ```

### When Splitting Files

1. **Create new registry entries:**
   - Add each split file with unique ID
   - Example: `design-iteration-overview`, `design-iteration-plan-file`

2. **Remove old entry:**
   - Delete the monolithic file entry from registry

3. **Update dependencies:**
   - Find all references to old ID: `grep -r "context:old-id" .opencode/ registry.json`
   - Update to reference new split files

4. **Update profiles:**
   - Replace old reference with new split file references

## Troubleshooting

### Script fails with "bun not found"

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

### "Registry file not found"

Ensure you're running from repo root:
```bash
cd /path/to/OpenAgentsControl
bun run scripts/registry/check-dependencies.ts
```

### Check passes locally but fails in CI

Make sure all files are committed:
```bash
git status
# Commit any uncommitted files before pushing
```

## Quick Reference

```bash
# Full validation suite
bun run scripts/registry/validate-registry.ts && \
bun run scripts/registry/check-dependencies.ts && \
./scripts/tests/test-installer-files.sh --local --all

# Just check dependencies (fastest)
bun run scripts/registry/check-dependencies.ts

# Test specific profile
./scripts/tests/test-installer-files.sh --local --profile=essential

# Check with verbose output
bun run scripts/registry/check-dependencies.ts --verbose
```

## Related Documentation

- [Registry Structure](REGISTRY_STRUCTURE.md) - How registry.json is organized
- [Adding Components](../guides/ADDING_COMPONENTS.md) - Step-by-step guide
- [ContextScout Fix](CONTEXTSCOUT_FIX.md) - Example of fixing missing dependencies
- [Registry Fixes Summary](REGISTRY_FIXES_SUMMARY.md) - Previous fixes made
