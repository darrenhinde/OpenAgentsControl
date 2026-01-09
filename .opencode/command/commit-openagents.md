---
description: Smart commit command for opencode-agents repository with automatic validation and conventional commits
---

# Commit OpenAgents Command

You are an AI agent that helps create well-formatted git commits specifically for the **opencode-agents** repository. This command handles the complete commit workflow including validation, testing, and pushing changes.

## Instructions for Agent

When the user runs this command, execute the following workflow:

### 1. **Smart Repo Analysis (Automatic)**

**Before doing anything, analyze the repo state:**

```bash
# Check current branch and status
git status
git branch --show-current

# Check for workflow issues
git tag --sort=-v:refname | head -5  # Check recent tags
cat VERSION  # Check current version
git log --oneline -5  # Check recent commits

# Check for stale automation branches
git branch -a | grep -E "chore/version-bump|docs/auto-sync" | wc -l
```

**Intelligent Analysis:**
- 🔍 **Version Sync Check**: Compare VERSION file with latest git tag
  - If VERSION > latest tag → Suggest creating missing release
  - If tags are missing → Offer to trigger release workflow
- 🧹 **Branch Cleanup**: Detect stale automation branches
  - Count `chore/version-bump-*` branches
  - Count `docs/auto-sync-*` branches
  - If > 3 stale branches → Suggest cleanup
- 🔄 **Workflow Health**: Check if workflows are working
  - Look for recent workflow runs
  - Check for disabled workflows that might be needed
- 📊 **Repo State**: Summarize current state
  - Current branch
  - Uncommitted changes
  - Recent activity

**Present Analysis:**
```
📊 Repo Health Check:
- Current branch: <branch>
- Version: <VERSION> | Latest tag: <tag>
- Stale branches: <count> automation branches
- Uncommitted changes: <count> files

[If issues detected:]
⚠️ Issues Found:
- Missing release for v<VERSION> (tag not created)
- <count> stale automation branches need cleanup

Would you like to:
1. Fix issues first (recommended)
2. Continue with commit
3. View detailed analysis
```

**If user chooses "Fix issues":**
- Offer to trigger `create-release.yml` workflow for missing tags
- Offer to clean up stale branches
- Offer to audit workflows if problems detected

### 2. **Pre-Commit Validation (Optional)**

**Ask user:**
```
Would you like to run smoke tests before committing? (y/n)
- y: Run validation tests
- n: Skip directly to commit
```

**If user chooses to run tests:**
```bash
cd evals/framework && npm run eval:sdk -- --agent=core/openagent --pattern="**/smoke-test.yaml"
cd evals/framework && npm run eval:sdk -- --agent=core/opencoder --pattern="**/smoke-test.yaml"
```

**Validation Rules:**
- ⚠️ If tests fail, ask user if they want to proceed or fix issues first
- ✅ Tests are optional - user can skip and commit directly

### 3. **Analyze Changes**
- Run `git status` to see all untracked files
- Run `git diff` to see both staged and unstaged changes
- Run `git log --oneline -5` to see recent commit style
- Identify the scope of changes (evals, scripts, docs, agents, workflows, etc.)
- **Special Detection**: Check if changes are workflow-related
  - If `.github/workflows/` modified → Suggest workflow validation
  - If new workflow added → Offer to document it
  - If workflow disabled/deleted → Ask for confirmation

### 4. **Stage Files Intelligently**
**Auto-stage based on change type:**
- If modifying evals framework → stage `evals/framework/`
- If modifying core agents → stage `.opencode/agent/core/`
- If modifying development agents → stage `.opencode/agent/development/`
- If modifying content agents → stage `.opencode/agent/content/`
- If modifying data agents → stage `.opencode/agent/data/`
- If modifying meta agents → stage `.opencode/agent/meta/`
- If modifying learning agents → stage `.opencode/agent/learning/`
- If modifying product agents → stage `.opencode/agent/product/`
- If modifying subagents → stage `.opencode/agent/subagents/`
- If modifying commands → stage `.opencode/command/`
- If modifying context → stage `.opencode/context/`
- If modifying scripts → stage `scripts/`
- If modifying docs → stage `docs/`
- If modifying CI/CD → stage `.github/workflows/`
- If user provides specific files → stage only those

**Never auto-stage:**
- `node_modules/`
- `.env` files
- `test_tmp/` or temporary directories
- `evals/results/` (test results)

### 5. **Generate Commit Message**

**Follow Conventional Commits (NO EMOJIS):**
```
<type>(<scope>): <description>

[optional body]
```

**Types for this repo:**
- `feat` - New features (agents, commands, tools)
- `fix` - Bug fixes
- `refactor` - Code restructuring without behavior change
- `test` - Test additions or modifications
- `docs` - Documentation updates
- `chore` - Maintenance tasks (dependencies, cleanup)
- `ci` - CI/CD pipeline changes
- `perf` - Performance improvements

**Scopes for this repo:**
- `evals` - Evaluation framework changes
- `agents/core` - Core agents (openagent, opencoder)
- `agents/meta` - Meta agents (system-builder, repo-manager)
- `agents/development` - Development category agents (frontend-specialist, backend-specialist, devops-specialist, codebase-agent)
- `agents/content` - Content category agents (copywriter, technical-writer)
- `agents/data` - Data category agents (data-analyst)
- `agents/learning` - Learning category agents
- `agents/product` - Product category agents
- `subagents/core` - Core subagents (task-manager, documentation, contextscout)
- `subagents/code` - Code subagents (coder-agent, tester, reviewer, build-agent, codebase-pattern-analyst)
- `subagents/system-builder` - System builder subagents (domain-analyzer, agent-generator, context-organizer, workflow-designer, command-creator)
- `subagents/utils` - Utility subagents (image-specialist)
- `commands` - Slash command changes
- `context` - Context file changes
- `scripts` - Build/test script changes
- `ci` - GitHub Actions workflow changes
- `docs` - Documentation changes
- `registry` - Registry.json changes

**Examples:**
```
feat(evals): add parallel test execution support
fix(agents/core): correct delegation logic in openagent
fix(agents/development): update frontend-specialist validation rules
feat(agents/content): add new copywriter capabilities
feat(agents/meta): enhance system-builder with new templates
refactor(evals): split test-runner into modular components
test(evals): add smoke tests for openagent
feat(subagents/code): add build validation to build-agent
feat(subagents/system-builder): improve domain-analyzer pattern detection
docs(readme): update installation instructions
chore(deps): upgrade evaluation framework dependencies
feat(registry): add new agent categories
ci: add automatic version bumping workflow
```

### 6. **Commit Analysis**

<commit_analysis>
- List all files that have been changed or added
- Summarize the nature of changes (new feature, bug fix, refactor, etc.)
- Identify the primary scope (evals, agents, scripts, etc.)
- Determine the purpose/motivation behind changes
- Assess impact on the overall project
- Check for sensitive information (API keys, tokens, etc.)
- Draft a concise commit message focusing on "why" not "what"
- Ensure message follows conventional commit format
- Verify message is specific and not generic
</commit_analysis>

### 7. **Execute Commit**
```bash
git add <relevant-files>
git commit -m "<type>(<scope>): <description>"
git status  # Verify commit succeeded
```

### 8. **Post-Commit Actions**

**Ask user:**
```
✅ Commit created: <commit-hash>
📝 Message: <commit-message>

Would you like to:
1. Push to remote (git push origin <branch>)
2. Create another commit
3. Done
```

**If user chooses push:**
```bash
git push origin <current-branch>
```

**Then inform based on commit type:**

**For workflow changes (`.github/workflows/`):**
```
🚀 Pushed workflow changes!

This will trigger:
- Workflow validation on PR
- Registry validation
- PR checks

⚠️ Important:
- New workflows won't run until merged to main
- Test workflows using workflow_dispatch if available
- Check GitHub Actions tab for workflow syntax errors
```

**For feature/fix commits to main:**
```
🚀 Pushed to main!

This will trigger:
- Post-merge version bump workflow
- Create version bump PR automatically
- Update VERSION, package.json, CHANGELOG.md
- After version bump PR merges → Create git tag & release

Expected flow:
1. Your commit merged ✅
2. Version bump PR created (automated)
3. Review & merge version bump PR
4. Git tag & GitHub release created automatically
```

**For other commits:**
```
🚀 Pushed to remote!

This will trigger:
- PR checks (if on feature branch)
- Registry validation
- Build & test validation
```

## Workflow Management (Smart Automation)

### Automatic Workflow Analysis

When committing workflow changes or when issues are detected, provide intelligent guidance:

**1. Version & Release Sync**
```bash
# Check if version and tags are in sync
VERSION=$(cat VERSION)
LATEST_TAG=$(git tag --sort=-v:refname | head -1)

if [ "v$VERSION" != "$LATEST_TAG" ]; then
  echo "⚠️ Version mismatch detected!"
  echo "VERSION file: $VERSION"
  echo "Latest tag: $LATEST_TAG"
  echo ""
  echo "Would you like to:"
  echo "1. Trigger create-release workflow to create v$VERSION tag/release"
  echo "2. Manually create tag: git tag v$VERSION && git push origin v$VERSION"
  echo "3. Ignore (version bump PR may be pending)"
fi
```

**2. Stale Branch Cleanup**
```bash
# Detect stale automation branches
STALE_BRANCHES=$(git branch -a | grep -E "chore/version-bump|docs/auto-sync" | wc -l)

if [ "$STALE_BRANCHES" -gt 3 ]; then
  echo "🧹 Found $STALE_BRANCHES stale automation branches"
  echo ""
  echo "Would you like to clean them up?"
  echo "1. Yes - delete merged automation branches"
  echo "2. No - keep them"
  echo "3. Show me the branches first"
fi
```

**3. Workflow Health Check**
```bash
# Check for common workflow issues
if [ -f .github/workflows/post-merge.yml.disabled ]; then
  echo "ℹ️ Found disabled workflow: post-merge.yml.disabled"
  echo "This workflow has been replaced by post-merge-pr.yml + create-release.yml"
  echo ""
  echo "Would you like to delete it? (cleanup)"
fi

# Check if create-release.yml exists
if [ ! -f .github/workflows/create-release.yml ]; then
  echo "⚠️ Missing create-release.yml workflow"
  echo "Tags and releases won't be created automatically!"
  echo ""
  echo "Would you like to create it?"
fi
```

**4. Workflow Documentation**

When new workflows are added, offer to update documentation:
```
✅ New workflow detected: <workflow-name>.yml

Would you like to:
1. Add entry to .github/workflows/WORKFLOW_AUDIT.md
2. Update navigation.md with workflow info
3. Skip documentation (do it later)
```

### Workflow Commit Best Practices

**For workflow changes, always:**
- Test workflow syntax before committing
- Document what the workflow does
- Explain why changes were made
- Note any breaking changes
- Update workflow audit documentation

**Commit message format for workflows:**
```
ci(workflows): <what changed>

Why: <reason for change>
Impact: <what this affects>
Testing: <how to test>
```

**Example:**
```
ci(workflows): add automatic release creation workflow

Why: Version bumps were happening but tags/releases weren't being created
Impact: After version bump PRs merge, tags and releases will be created automatically
Testing: Manually trigger workflow with: gh workflow run create-release.yml
```

## Repository-Specific Rules

### Version Bumping (Automatic via CI/CD)
Commits trigger automatic version bumps:
- `feat:` → minor bump (0.0.1 → 0.1.0)
- `fix:` → patch bump (0.0.1 → 0.0.2)
- `feat!:` or `BREAKING CHANGE:` → major bump (0.1.0 → 1.0.0)
- `[alpha]` in message → alpha bump (0.1.0-alpha.1 → 0.1.0-alpha.2)
- Default → patch bump (0.0.1 → 0.0.2)

### Files to Always Check
Before committing, verify these are in sync:
- `VERSION` file
- `package.json` version
- `CHANGELOG.md` (if manually updated)

### Pre-Commit Hooks
This repo may have pre-commit hooks that:
- Run linting
- Format code
- Run type checks

**If hooks modify files:**
- Automatically amend the commit to include hook changes
- Inform user that files were auto-formatted

## Error Handling

### If Smoke Tests Fail
```
⚠️ Smoke tests failed for <agent-name>

Failures:
<test-output>

Options:
1. Fix issues and retry
2. Run full test suite (cd evals/framework && npm run eval:sdk -- --agent=<category>/<agent>)
3. Proceed anyway (not recommended)
4. Cancel commit

What would you like to do?
```

### If No Changes Detected
```
ℹ️ No changes to commit. Working tree is clean.

Recent commits:
<git log --oneline -3>

Would you like to:
1. Check git status
2. View recent commits
3. Exit
```

### If Merge Conflicts
```
⚠️ Merge conflicts detected. Please resolve conflicts first.

Conflicted files:
<list-files>

Run: git status
```

## Active Workflows in This Repo

**Understanding the automation:**

1. **create-release.yml** ✅ NEW
   - Triggers: After version bump PRs merge (detects `version-bump` label)
   - Creates: Git tags and GitHub releases
   - Manual: Can trigger via `gh workflow run create-release.yml`

2. **post-merge-pr.yml** ✅ Active
   - Triggers: Push to main
   - Creates: Version bump PR (updates VERSION, package.json, CHANGELOG.md)
   - Skips: If commit has `version-bump` or `automated` label

3. **pr-checks.yml** ✅ Active
   - Triggers: Pull requests
   - Validates: PR title format, builds framework, runs tests
   - Required: Must pass before merge

4. **validate-registry.yml** ✅ Active
   - Triggers: Pull requests
   - Validates: Registry.json, prompt library structure
   - Auto-fixes: Adds new components to registry

5. **update-registry.yml** ✅ Active
   - Triggers: Push to main (when .opencode/ changes)
   - Updates: Registry.json automatically
   - Direct push: No PR needed

6. **sync-docs.yml** ✅ Active
   - Triggers: Push to main (when registry/components change)
   - Creates: GitHub issue for OpenCode to sync docs
   - Optional: Can be simplified if too complex

7. **validate-test-suites.yml** ✅ Active
   - Triggers: Pull requests (when evals/ changes)
   - Validates: YAML test files
   - Required: Must pass before merge

**Workflow Flow for Version Bumps:**
```
1. Merge feat/fix PR to main
   ↓
2. post-merge-pr.yml creates version bump PR
   ↓
3. Review & merge version bump PR
   ↓
4. create-release.yml creates tag & release
   ↓
5. Done! 🎉
```

## Agent Behavior Notes

- **Repo health first** - Always run smart analysis before committing
- **Workflow awareness** - Understand which workflows will trigger
- **Optional validation** - Ask user if they want to run smoke tests (not mandatory)
- **Smart staging** - Only stage relevant files based on change scope and category structure
- **Conventional commits** - Strictly follow conventional commit format (NO EMOJIS)
- **Scope awareness** - Use appropriate scope for this repository (include category paths)
- **Version awareness** - Inform user about automatic version bumping and release creation
- **CI/CD awareness** - Remind user that push triggers automated workflows
- **Security** - Never commit sensitive information (API keys, tokens, .env files)
- **Atomic commits** - Each commit should have a single, clear purpose
- **Push guidance** - Always ask before pushing to remote
- **Category-aware** - Recognize new agent organization (core, development, content, data, meta, learning, product)
- **Cleanup suggestions** - Offer to clean up stale branches and disabled workflows
- **Documentation** - Suggest updating workflow docs when workflows change

## Quick Reference

### Common Workflows

**Feature Addition:**
```bash
# 1. Optional: Run smoke tests
cd evals/framework && npm run eval:sdk -- --agent=core/openagent --pattern="**/smoke-test.yaml"

# 2. Stage and commit
git add <files>
git commit -m "feat(evals): add new evaluation metric"

# 3. Push
git push origin main
```

**Bug Fix:**
```bash
git add <files>
git commit -m "fix(agents/core): correct delegation threshold logic"
git push origin main
```

**Documentation:**
```bash
git add docs/
git commit -m "docs(guides): update testing documentation"
git push origin main
```

**Refactoring:**
```bash
git add evals/framework/src/
git commit -m "refactor(evals): extract validation logic into separate module"
git push origin main
```

## Success Criteria

A successful commit should:
- ✅ Follow conventional commit format (NO EMOJIS)
- ✅ Have appropriate scope with category path (e.g., agents/core, subagents/code)
- ✅ Be atomic (single purpose)
- ✅ Have clear, concise message
- ✅ Not include sensitive information
- ✅ Not include generated files (node_modules, build artifacts)
- ✅ Only stage relevant files based on category structure
- ✅ Trigger appropriate CI/CD workflows when pushed
- ✅ Optionally pass smoke tests if validation was requested
