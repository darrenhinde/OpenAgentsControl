# External PR Guide

This guide explains how GitHub Actions workflows behave for external contributors (fork PRs).

## For External Contributors (Fork PRs)

When you submit a PR from a fork, workflows run but **cannot auto-commit fixes** due to GitHub security restrictions.

### What Runs Automatically

✅ **Fast Build Check (< 2 minutes)**
- TypeScript compilation check
- YAML test suite validation
- Quick feedback on code quality

✅ **Registry Validation**
- Checks if `registry.json` matches actual files
- Validates all paths are correct
- Checks prompts use defaults
- **Cannot auto-commit** (you'll need to fix locally)

❌ **What Doesn't Run on PRs**
- Full AI agent tests (too expensive, run manually by maintainers)
- Auto-version bumping (happens after merge)

### What You Need to Do

If the validation workflow reports issues, you'll need to fix them locally:

#### 1. Build Failures

If TypeScript compilation fails:

```bash
# Build locally to see errors
cd evals/framework
npm install
npm run build

# Fix the errors, then commit
git add .
git commit -m "fix: resolve build errors"
git push
```

#### 2. Registry Issues

If new components are detected (you'll get a comment on your PR):

```bash
# Run auto-detect locally
./scripts/registry/auto-detect-components.sh --auto-add

# Commit the updated registry
git add registry.json
git commit -m "chore: update registry with new components"
git push
```

#### 3. Prompt Issues

If prompts don't match defaults:

```bash
# Restore default prompts
./scripts/prompts/use-prompt.sh <agent-name> default

# Commit the changes
git add .opencode/agent/
git commit -m "chore: restore default prompts"
git push
```

#### 4. Path Issues

If registry paths are invalid:

```bash
# Validate and see suggestions
./scripts/validate-registry.sh --fix

# Manually fix paths in registry.json
# Then commit
git add registry.json
git commit -m "fix: correct registry paths"
git push
```

### What Happens Next

1. **Fix Issues Locally**: If validation fails, fix issues and push
2. **Fast Feedback**: Build checks complete in < 2 minutes
3. **Maintainer Review**: A maintainer will review your code
4. **Merge**: Once everything passes, your PR will be merged!
5. **Auto-Release**: After merge, version is auto-bumped and release created (you don't need to do anything!)

---

## For Maintainers

### Handling External PRs

External PRs run normally but **cannot auto-commit** due to GitHub security (can't push to fork branches).

### Simple Overrides

If you need to override checks:

**Skip Validation:**
1. Go to **Actions** → **Validate Registry on PR**
2. Click **"Run workflow"**
3. Enable **"Skip validation checks"**
4. Run on the PR branch

**Skip Version Bump:**
1. Go to **Actions** → **Post-Merge Automation**
2. Click **"Run workflow"**
3. Enable **"Skip version bump"**
4. Run manually

### Workflow Behavior

| PR Type | Build Check | Registry Validation | Auto-Commit | AI Tests |
|---------|------------|-------------------|-------------|----------|
| **Internal PR** (branch) | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No* |
| **External PR** (fork) | ✅ Yes | ✅ Yes | ❌ No** | ❌ No* |

*AI tests don't run on PRs (too expensive) - maintainers run manually if needed  
**Cannot push to fork branches - contributor must fix locally

### Manual Testing External PRs

If you want to test an external PR locally:

```bash
# Fetch the PR
gh pr checkout <PR_NUMBER>

# Run build check
cd evals/framework
npm install
npm run build
npm run validate:suites:all

# Run validation
./scripts/registry/validate-registry.sh -v
./scripts/prompts/validate-pr.sh

# Auto-fix registry if needed
./scripts/registry/auto-detect-components.sh --auto-add

# Run AI tests (optional - only if needed)
npm run test:ci

# If everything passes, approve and merge
gh pr review <PR_NUMBER> --approve
gh pr merge <PR_NUMBER>
```

**Note:** AI tests are optional for PRs. The build check is usually sufficient.

---

## Workflow Files

- **`.github/workflows/pr-checks.yml`**: Fast build validation (< 2 min)
- **`.github/workflows/validate-registry.yml`**: Registry validation with override
- **`.github/workflows/post-merge.yml`**: Auto-versioning after merge (main only)

## Questions?

- **Contributors**: See [CONTRIBUTING.md](../docs/contributing/CONTRIBUTING.md)
- **Maintainers**: See [WORKFLOW_GUIDE.md](../WORKFLOW_GUIDE.md)
- **Issues**: Open a [GitHub Issue](https://github.com/darrenhinde/OpenAgents/issues)
