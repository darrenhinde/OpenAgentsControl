# Installer and Registry Fixes Summary

> **Current state (2026-09-02):** This is a historical fixes summary. Current agent metadata comes only from `content/agents/**` `oac:` blocks through RegistryEmitter; references to the retired metadata sidecar describe the former system.

## Overview
This document summarizes the fixes made to resolve installer issues and registry inconsistencies.

## Issues Fixed

### 1. Dead Registry References (13 Missing Files)
The following registry entries pointed to files that no longer existed on disk:

| Old Entry | Status | Resolution |
|-----------|--------|------------|
| `workflows-delegation` | Split | Replaced with 3 split files |
| `design-iteration` | Split | Replaced with 8 split files |
| `design-assets` | Missing | Removed from registry |
| `animation-patterns` | Split | Replaced with 6 split files |
| `adding-agent` | Split | Replaced with 2 split files |
| `adding-skill` | Split | Replaced with 3 split files |
| `navigation-design` | Split | Replaced with 2 split files |
| `external-libraries` | Split | Replaced with 3 split files |
| `claude-agent-skills` | Missing | Removed (directory doesn't exist) |
| `claude-create-subagents` | Missing | Removed (directory doesn't exist) |
| `claude-hooks` | Missing | Removed (directory doesn't exist) |
| `claude-plugins` | Missing | Removed (directory doesn't exist) |
| `navigation` (to-be-consumed) | Missing | Removed (directory doesn't exist) |

### 2. New Registry Entries Added (27 Files)
The following split files were added to the registry:

#### Task Delegation (3 files)
- `task-delegation-basics`
- `task-delegation-specialists`
- `task-delegation-caching`

#### Design Iteration (8 files)
- `design-iteration-overview`
- `design-iteration-plan-file`
- `design-iteration-plan-iterations`
- `design-iteration-stage-layout`
- `design-iteration-stage-theme`
- `design-iteration-stage-implementation`
- `design-iteration-stage-animation`
- `design-iteration-visual-content`
- `design-iteration-best-practices`

#### External Libraries (3 files)
- `external-libraries-workflow`
- `external-libraries-scenarios`
- `external-libraries-faq`

#### Adding Agent (2 files)
- `adding-agent-basics`
- `adding-agent-testing`

#### Adding Skill (3 files)
- `adding-skill-basics`
- `adding-skill-implementation`
- `adding-skill-example`

#### Navigation Design (2 files)
- `navigation-design-basics`
- `navigation-templates`

#### Animation (6 files)
- `animation-basics`
- `animation-advanced`
- `animation-components`
- `animation-forms`
- `animation-chat`
- `animation-loading`

### 3. Dependency Updates
Updated dependencies in the following components to reference new file IDs:

- **OpenCoder agent**: `workflows-delegation` → `task-delegation-basics`, `external-libraries` → `external-libraries-workflow`
- **OpenAgent agent**: `external-libraries` → `external-libraries-workflow`
- **External Context Integration context**: `workflows-delegation` → `task-delegation-basics`
- **Essential profile**: `workflows-delegation` → `task-delegation-basics`

### 4. Profile Fixes
Updated profile files to remove references to deleted components:

- **Essential**: Removed `to-be-consumed/*`, updated `adding-skill` → `adding-skill-basics`
- **Developer**: Removed `to-be-consumed/*`, `design-assets`, `animation-patterns`, added animation split files
- **Business**: Removed `to-be-consumed/*`
- **Full**: Removed `to-be-consumed/*`, updated `adding-skill` → `adding-skill-basics`
- **Advanced**: Removed `to-be-consumed/*`, updated `adding-skill` → `adding-skill-basics`

## Files Modified

### Registry & Configuration
- `registry.json` - Fixed dead references, added 27 new entries, updated dependencies
- `.opencode/config/agent-metadata.json` - Updated agent dependencies

### Profiles
- `.opencode/profiles/essential/profile.json` - Fixed references
- `.opencode/profiles/developer/profile.json` - Fixed references, added animation files
- `.opencode/profiles/business/profile.json` - Removed to-be-consumed
- `.opencode/profiles/full/profile.json` - Fixed references
- `.opencode/profiles/advanced/profile.json` - Fixed references

### New Scripts
- `scripts/registry/fix-registry.py` - Automated script to fix registry issues
- `scripts/tests/test-installer-files.sh` - Test script to verify installer file accessibility

## Testing

### Registry Validation
```bash
bun run scripts/registry/validate-registry.ts
```
**Result**: ✅ All 242 paths valid, 0 missing files, 0 missing dependencies

### Installer File Test (All Components)
```bash
./scripts/tests/test-installer-files.sh --local --all
```
**Result**: ✅ All 242 files accessible and would install successfully

### Installer File Test (Essential Profile)
```bash
./scripts/tests/test-installer-files.sh --local --profile=essential
```
**Result**: ✅ 22 files accessible, 0 failures

### Installer File Test (Developer Profile)
```bash
./scripts/tests/test-installer-files.sh --local --profile=developer
```
**Result**: ✅ 199 files accessible, 0 failures

## Impact Analysis

### Before Fixes
- **Missing files in registry**: 13
- **Orphaned files on disk**: 78
- **Missing dependencies**: 3
- **Installer would fail**: Yes, on 13 files

### After Fixes
- **Missing files in registry**: 0
- **Orphaned files on disk**: 66 (reduced by adding 27 split files)
- **Missing dependencies**: 0
- **Installer would fail**: No

## Remaining Orphaned Files
There are still 66 orphaned files (files that exist on disk but aren't in registry). These include:
- Navigation files (directory indexes)
- UI design guides (premium-dark-ui series)
- Lookup and example files
- Plugin documentation

These files are not essential for the installer and can be added to registry as needed.

## Usage

### Run Registry Validation
```bash
bun run scripts/registry/validate-registry.ts --verbose
```

### Test Installer Files (Remote Registry)
```bash
./scripts/tests/test-installer-files.sh --profile=essential
```

### Test Installer Files (Local Registry)
```bash
./scripts/tests/test-installer-files.sh --local --profile=essential
```

### Test All Components
```bash
./scripts/tests/test-installer-files.sh --local --all --verbose
```

## Notes
- The `to-be-consumed` directory no longer exists, so references to it have been removed
- Config files (`env.example`, `README.md`) exist at the repository root, not in `.opencode/`
- The installer test script can use either remote (GitHub) or local registry for testing
- All profile configurations have been updated to use valid component IDs
