# Workflow Guide

This directory contains GitHub Actions workflows for automated testing, validation, and releases.

## Workflow Overview

### For Contributors (PR Workflows)

#### `pr-checks.yml` - Fast Build Validation
**Triggers:** Pull requests to main/dev with evals changes  
**Duration:** < 2 minutes  
**What it does:**
- ✅ TypeScript compilation check
- ✅ YAML test suite validation
- ✅ Fast feedback on code quality

**Fork-friendly:** ✅ Yes - read-only checks

---

#### `validate-registry.yml` - Registry Validation
**Triggers:** Pull requests to main/dev  
**Duration:** < 1 minute  
**What it does:**
- ✅ Validates registry.json paths
- ✅ Auto-detects new components
- ✅ Validates prompts use defaults
- ✅ **Internal PRs:** Auto-commits registry updates
- ✅ **Fork PRs:** Posts comment with instructions

**Fork-friendly:** ✅ Yes - detects forks and provides guidance

---

### For Maintainers (Post-Merge Workflows)

#### `post-merge.yml` - Auto-Versioning & Releases
**Triggers:** Push to main branch  
**Duration:** < 1 minute  
**What it does:**
- ✅ Auto-bumps version based on conventional commits
- ✅ Updates CHANGELOG.md
- ✅ Creates git tag
- ✅ Publishes GitHub release

**Conventional Commit Examples:**
```bash
feat: add new feature        # → Minor bump (0.1.0 → 0.2.0)
fix: bug fix                 # → Patch bump (0.1.0 → 0.1.1)
feat!: breaking change       # → Major bump (0.1.0 → 1.0.0)
[alpha] experimental         # → Alpha bump (0.1.0-alpha.1)
```

**Manual override:** Can skip version bump via workflow_dispatch

---

#### `update-registry.yml` - Registry Auto-Update
**Triggers:** Push to main with .opencode changes  
**Duration:** < 1 minute  
**What it does:**
- ✅ Auto-detects new components
- ✅ Updates registry.json
- ✅ Commits changes to main

---

#### `sync-docs.yml` - Documentation Sync
**Triggers:** Push to main with registry/component changes  
**Duration:** Variable (depends on OpenCode)  
**What it does:**
- ✅ Creates sync branch
- ✅ Opens issue for OpenCode to update docs
- ✅ Syncs component counts with registry

---

### Integration Workflows

#### `opencode.yml` - OpenCode Integration
**Triggers:** Issue comments with `/opencode` or `/oc`  
**What it does:**
- ✅ Enables OpenCode AI assistance on issues
- ✅ Restricted to maintainers only

---

## Workflow Philosophy

### Design Principles

1. **Fast Feedback** - PRs get results in < 2 minutes
2. **Fork-Friendly** - No push attempts to fork branches
3. **Cost-Effective** - No expensive AI tests on every PR
4. **Maintainer Control** - Manual overrides available
5. **Clear Communication** - Helpful error messages and guidance

### What Changed (Dec 2025)

**Before:**
- ❌ Expensive AI tests on every PR (15 min, costs money)
- ❌ Fork PRs failed with confusing errors
- ❌ Slow feedback loop

**After:**
- ✅ Fast build checks (< 2 min, free)
- ✅ Fork-friendly workflows
- ✅ Manual AI testing when needed
- ✅ Auto-versioning preserved (moved to post-merge)

See [_archive/README.md](_archive/README.md) for details on removed workflows.

---

## For Contributors

### What Runs on Your PR

1. **Build Check** (`pr-checks.yml`)
   - TypeScript compilation
   - YAML validation
   - Fast (< 2 min)

2. **Registry Validation** (`validate-registry.yml`)
   - Path validation
   - Component detection
   - Prompt validation

### If Checks Fail

See [EXTERNAL_PR_GUIDE.md](../EXTERNAL_PR_GUIDE.md) for detailed instructions.

**Quick fixes:**
```bash
# Build errors
cd evals/framework && npm run build

# Registry updates
./scripts/registry/auto-detect-components.sh --auto-add

# Prompt issues
./scripts/prompts/use-prompt.sh <agent> default
```

---

## For Maintainers

### Manual Testing

```bash
# Test PR locally
gh pr checkout <PR_NUMBER>
cd evals/framework
npm install
npm run build

# Run AI tests (optional)
npm run test:ci
```

### Manual Overrides

**Skip validation:**
```bash
gh workflow run validate-registry.yml -f skip_validation=true
```

**Skip version bump:**
```bash
gh workflow run post-merge.yml -f skip_version_bump=true
```

### Version Management

Version bumping is automatic based on commit messages. See [VERSION_BUMP_GUIDE.md](VERSION_BUMP_GUIDE.md).

**Manual version bump:**
```bash
npm run version:bump:patch  # 0.1.0 → 0.1.1
npm run version:bump:minor  # 0.1.0 → 0.2.0
npm run version:bump:major  # 0.1.0 → 1.0.0
```

---

## Workflow Status

| Workflow | Status | Purpose | Fork-Friendly |
|----------|--------|---------|---------------|
| pr-checks.yml | ✅ Active | Fast build validation | ✅ Yes |
| validate-registry.yml | ✅ Active | Registry validation | ✅ Yes |
| post-merge.yml | ✅ Active | Auto-versioning | N/A (main only) |
| update-registry.yml | ✅ Active | Registry auto-update | N/A (main only) |
| sync-docs.yml | ✅ Active | Doc sync | N/A (main only) |
| opencode.yml | ✅ Active | OpenCode integration | N/A (issues only) |
| test-agents.yml | 🗄️ Archived | Expensive AI tests | ❌ No |
| validate-test-suites.yml | 🗄️ Archived | Redundant validation | ✅ Yes |

---

## Questions?

- **Contributors:** See [EXTERNAL_PR_GUIDE.md](../EXTERNAL_PR_GUIDE.md)
- **Maintainers:** See [PROJECT_CLI_GUIDE.md](../PROJECT_CLI_GUIDE.md)
- **Version Bumping:** See [VERSION_BUMP_GUIDE.md](VERSION_BUMP_GUIDE.md)
- **Archived Workflows:** See [_archive/README.md](_archive/README.md)
