# CI/CD Workflow Guide - Build Validation System

## Overview

The build validation system has **two workflows** that handle different scenarios:

1. **PR Workflow** - Validates and blocks merge if registry is invalid
2. **Direct Push Workflow** - Auto-updates registry on direct pushes to main

---

## Workflow 1: Pull Request Validation

**File:** `.github/workflows/validate-registry.yml`

**Triggers:**
- Pull requests to `main` or `dev` branches
- Changes to `.opencode/**`, `registry.json`, or validation scripts

**What It Does:**

```
Developer creates PR
         ↓
GitHub Action runs automatically
         ↓
1. Auto-detect new components
   - Scans .opencode/ directory
   - Finds files not in registry
         ↓
2. Add to registry (if found)
   - Extracts metadata
   - Adds to registry.json
   - Commits to PR branch
         ↓
3. Validate registry
   - Checks all paths exist
   - Verifies JSON is valid
         ↓
4. Decision
   ├─ ✅ Valid → PR can merge
   └─ ❌ Invalid → PR BLOCKED
```

**Key Features:**
- ✅ **Blocks merge** if validation fails
- ✅ **Auto-commits** registry updates to PR branch
- ✅ **Detailed feedback** in PR checks
- ✅ **Prevents 404 errors** before they reach main

**Example Output:**
```
🔍 Auto-Detection Results
⚠️ New command: my-new-command
  Path: .opencode/command/my-new-command.md

📝 Adding New Components
✓ Added command: my-new-command

✅ Registry Validation
All registry paths are valid!
Total paths: 51
Valid: 51
Missing: 0

✅ Validation Passed
This PR is ready for review!
```

---

## Workflow 2: Direct Push to Main

**File:** `.github/workflows/update-registry.yml`

**Triggers:**
- Direct pushes to `main` branch
- Changes to `.opencode/**` (excluding registry.json)
- Manual workflow dispatch

**What It Does:**

```
Developer pushes directly to main
         ↓
GitHub Action runs automatically
         ↓
1. Auto-detect new components
   - Scans .opencode/ directory
   - Finds files not in registry
         ↓
2. Add to registry (if found)
   - Extracts metadata
   - Adds to registry.json
   - Commits to main
         ↓
3. Validate registry
   - Checks all paths exist
   - Verifies JSON is valid
         ↓
4. Report results
   ├─ ✅ Valid → Success
   └─ ⚠️ Invalid → Warning (doesn't block)
```

**Key Differences from PR Workflow:**
- ⚠️ **Does NOT block** - push already happened
- ⚠️ **Shows warning** if validation fails
- ✅ **Auto-commits** registry updates
- ✅ **Validates** but doesn't prevent push

**Why No Blocking?**
Since the push already happened, we can't block it. Instead:
- Shows clear warning in Actions summary
- Alerts team to fix registry
- Prevents future installation errors

**Example Output:**
```
🔍 Auto-Detection Results
✅ No new components found

✅ Registry Validation
All registry paths are valid!

Registry Statistics
- Agents: 4
- Commands: 12
- Contexts: 15
```

---

## Comparison Table

| Feature | PR Workflow | Direct Push Workflow |
|---------|-------------|---------------------|
| **Triggers** | Pull requests | Direct push to main |
| **Auto-detect** | ✅ Yes | ✅ Yes |
| **Auto-add** | ✅ Yes | ✅ Yes |
| **Validate** | ✅ Yes | ✅ Yes |
| **Block on failure** | ✅ Yes | ❌ No (warns only) |
| **Auto-commit** | ✅ To PR branch | ✅ To main |
| **Use case** | Normal development | Emergency fixes, maintainers |

---

## Recommended Workflow

### For Contributors (Recommended)

```bash
# 1. Create feature branch
git checkout -b feature/my-new-component

# 2. Add your component
echo "---
description: My awesome component
---
# My Component" > .opencode/command/my-component.md

# 3. Commit and push
git add .opencode/command/my-component.md
git commit -m "feat: add my-component"
git push origin feature/my-new-component

# 4. Create PR to dev
gh pr create --base dev --title "Add my-component"

# 5. GitHub Actions will:
#    - Auto-detect your component
#    - Add to registry.json
#    - Validate all paths
#    - Commit to your PR branch
#    - Block merge if invalid

# 6. Review and merge
# Your component is now in registry!
```

### For Maintainers (Direct Push)

```bash
# 1. Add component directly to main
git checkout main
echo "---
description: Urgent fix
---
# Fix" > .opencode/command/urgent-fix.md

# 2. Commit and push
git add .opencode/command/urgent-fix.md
git commit -m "fix: urgent component"
git push origin main

# 3. GitHub Actions will:
#    - Auto-detect your component
#    - Add to registry.json
#    - Validate all paths
#    - Commit registry update to main
#    - Warn if validation fails (but doesn't block)

# 4. Check Actions tab for results
# If warning, fix registry and push correction
```

---

## Manual Validation (Local)

Before pushing, you can validate locally:

```bash
# Check for new components
./scripts/auto-detect-components.sh --dry-run

# Add new components
./scripts/auto-detect-components.sh --auto-add

# Validate registry
./scripts/validate-registry.sh -v

# Get fix suggestions
./scripts/validate-registry.sh --fix
```

---

## Troubleshooting

### PR Blocked - Validation Failed

**Problem:** PR shows validation failure

**Solution:**
```bash
# 1. Check the error in PR checks
# 2. Run validator locally
./scripts/validate-registry.sh --fix

# 3. Fix the issues (usually path typos)
# 4. Commit and push
git add registry.json
git commit -m "fix: correct registry paths"
git push

# 5. PR checks will re-run automatically
```

### Direct Push - Validation Warning

**Problem:** Push succeeded but Actions shows warning

**Solution:**
```bash
# 1. Check Actions tab for details
# 2. Run validator locally
./scripts/validate-registry.sh --fix

# 3. Fix registry.json
# 4. Push correction
git add registry.json
git commit -m "fix: correct registry after direct push"
git push origin main
```

### Component Not Auto-Detected

**Problem:** Added file but not detected

**Possible causes:**
- File in excluded directory (tests/, docs/, node_modules/)
- File is README.md or index.md (excluded)
- File doesn't have .md extension
- File in wrong location (not in .opencode/)

**Solution:**
```bash
# Check if file would be detected
./scripts/auto-detect-components.sh --dry-run

# If not detected, check file location and name
# Move to correct location:
# - Agents: .opencode/agent/
# - Commands: .opencode/command/
# - Tools: .opencode/tool/
# - Plugins: .opencode/plugin/
# - Contexts: .opencode/context/
```

---

## Best Practices

### ✅ DO

- **Use PRs** for normal development (recommended)
- **Add frontmatter** to components with description
- **Test locally** before pushing
- **Review auto-commits** in PR before merging
- **Keep registry.json** in sync with files

### ❌ DON'T

- **Don't bypass PRs** unless emergency
- **Don't manually edit** registry.json (let automation handle it)
- **Don't ignore** validation warnings
- **Don't commit** broken registry paths
- **Don't skip** local validation

---

## Summary

**For 99% of cases:** Use PR workflow
- Creates PR → Auto-detect → Validate → Block if invalid → Merge

**For emergencies:** Direct push works
- Push to main → Auto-detect → Validate → Warn if invalid

**Both workflows:**
- ✅ Auto-detect new components
- ✅ Update registry automatically
- ✅ Validate all paths
- ✅ Prevent installation 404 errors

**The system ensures registry accuracy whether you use PRs or direct pushes!**
