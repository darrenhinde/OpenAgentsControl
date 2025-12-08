# Archived Workflows

These workflows were removed as part of the fork-friendly workflow simplification on 2025-12-08.

## Why We Archived These Workflows

### Problem Statement
The original workflows had several issues:
1. **Expensive AI tests on every PR** - Running full agent evaluations cost money and took 15+ minutes
2. **Fork PR failures** - External contributors experienced confusing workflow failures
3. **Over-engineering** - Too much automation for simple validation tasks
4. **Poor contributor experience** - Slow feedback and unclear error messages

### Solution
We simplified the workflow architecture to be:
- **Fast** - Build checks complete in < 2 minutes
- **Fork-friendly** - No push attempts to fork branches
- **Cost-effective** - No AI tests on every PR
- **Clear** - Better error messages and contributor guidance

---

## Archived Workflows

### `test-agents.yml` (Archived: 2025-12-08)

**What it did:**
- Ran full AI agent tests (OpenAgent and OpenCoder) on every PR
- Spawned OpenCode CLI and executed evaluation framework
- Auto-bumped versions after merge
- Created GitHub releases

**Why removed:**
- ❌ Expensive (AI API calls on every PR)
- ❌ Slow (15 minutes per PR)
- ❌ Overkill for PR validation
- ❌ Failed on fork PRs due to permission issues

**Replaced by:**
- ✅ `pr-checks.yml` - Fast build validation for PRs (< 2 min, free)
- ✅ `post-merge.yml` - Auto-versioning after merge (keeps the good automation!)
- ✅ Manual testing: `npm run test:ci` when needed

**Key features preserved:**
- ✅ Auto-version bumping (moved to post-merge.yml)
- ✅ Automatic GitHub releases (moved to post-merge.yml)
- ✅ Conventional commit parsing (moved to post-merge.yml)

---

### `validate-test-suites.yml` (Archived: 2025-12-08)

**What it did:**
- Validated YAML test suite files
- Ran on every test file change
- Posted PR comments on validation failures

**Why removed:**
- ❌ Redundant with build check
- ❌ Could be combined with other validation

**Replaced by:**
- ✅ `pr-checks.yml` - Includes YAML validation as part of build check

---

## New Workflow Architecture

```
.github/workflows/
├── pr-checks.yml              # Fast build validation (all PRs)
├── validate-registry.yml      # Registry validation (fork-friendly)
├── post-merge.yml             # Auto-version + releases (main only)
├── opencode.yml               # OpenCode integration
├── sync-docs.yml              # Doc sync
├── update-registry.yml        # Registry updates
└── _archive/
    ├── README.md              # This file
    ├── test-agents.yml        # Old expensive AI tests
    └── validate-test-suites.yml  # Old YAML validation
```

---

## Testing Philosophy

### Before (Expensive)
- ❌ AI tests on every PR (15 min, costs money)
- ❌ Fork PRs failed with confusing errors
- ❌ Slow feedback loop
- ❌ Over-engineered for simple validation

### After (Efficient)
- ✅ Fast build checks on PRs (< 2 min, free)
- ✅ Fork-friendly workflows
- ✅ Manual AI testing when needed
- ✅ Auto-versioning after merge (preserved!)
- ✅ Clear contributor guidance

---

## For Maintainers

### Running AI Tests Manually

If you need to run the full agent tests:

```bash
# Locally
npm run test:ci

# Or specific agents
npm run test:openagent
npm run test:opencoder

# With specific models
npm run test:openagent:claude
npm run test:openagent:grok
```

### Restoring Old Workflows (Not Recommended)

If you need to restore these workflows for reference:

```bash
# Copy back to workflows directory
cp .github/workflows/_archive/test-agents.yml .github/workflows/

# But consider: Do you really need expensive AI tests on every PR?
```

---

## Migration Notes

**What changed for contributors:**
- ✅ Faster PR feedback (2 min vs 15 min)
- ✅ No confusing fork PR failures
- ✅ Clear instructions when fixes needed

**What changed for maintainers:**
- ✅ Lower CI costs (no AI tests per PR)
- ✅ Same auto-versioning (moved to post-merge.yml)
- ✅ Same auto-releases (moved to post-merge.yml)
- ✅ Manual control over AI testing

**What stayed the same:**
- ✅ Auto-version bumping based on conventional commits
- ✅ Automatic CHANGELOG updates
- ✅ Automatic GitHub releases
- ✅ Registry validation and auto-updates
- ✅ Documentation sync

---

## Questions?

See the main workflow documentation:
- [EXTERNAL_PR_GUIDE.md](../../EXTERNAL_PR_GUIDE.md) - For contributors
- [VERSION_BUMP_GUIDE.md](../VERSION_BUMP_GUIDE.md) - For version management
