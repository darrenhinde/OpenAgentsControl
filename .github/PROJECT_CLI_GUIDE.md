# GitHub Project CLI Guide

Quick reference for managing your OpenAgents Control project board from the terminal.

## 🚀 Quick Start

```bash
# View all available commands
make help

# Create a new idea
make idea TITLE="Add eval harness for OSS models" LABELS="idea,evals"

# List all ideas
make ideas

# Open project board in browser
make board
```

---

## 📋 Common Workflows

### Creating Ideas

**Simple idea:**
```bash
make idea TITLE="Improve documentation"
```

**Idea with description:**
```bash
make idea TITLE="Add support for Cursor" BODY="Extend the framework to work with Cursor IDE" LABELS="idea,feature"
```

**Using gh directly:**
```bash
gh issue create \
  --repo darrenhinde/OpenAgentsControl \
  --title "Add eval harness for small OSS models" \
  --body "Problem: Need to test agents with smaller models\n\nProposed solution: Create eval harness" \
  --label "idea,agents,evals"
```

### Viewing & Managing Ideas

**List all open ideas:**
```bash
make ideas
# or
gh issue list --repo darrenhinde/OpenAgentsControl --label idea
```

**View specific issue:**
```bash
make issue-view NUM=123
# or
gh issue view 123 --repo darrenhinde/OpenAgentsControl
```

**Comment on an idea:**
```bash
make issue-comment NUM=123 COMMENT="Leaning towards X approach"
# or
gh issue comment 123 --repo darrenhinde/OpenAgentsControl --body "Great idea!"
```

**Close when done:**
```bash
make issue-close NUM=123
# or
gh issue close 123 --repo darrenhinde/OpenAgentsControl
```

### Project Board Management

**Open board in browser:**
```bash
make board
```

**View project info:**
```bash
make project-info
```

**List all project items:**
```bash
make project-items
```

**Add issue to project:**
```bash
make add-to-project ISSUE_URL=https://github.com/darrenhinde/OpenAgentsControl/issues/123
# or
gh project item-add 2 --owner darrenhinde --url https://github.com/darrenhinde/OpenAgentsControl/issues/123
```

---

## 🏷️ Labels

Available labels for categorizing issues:

- `idea` - High-level proposals
- `feature` - New features
- `bug` - Bug fixes
- `docs` - Documentation
- `agents` - Agent system
- `evals` - Evaluation framework
- `framework` - Core framework

**List all labels:**
```bash
make labels
```

**Create new label:**
```bash
gh label create "priority-high" --repo darrenhinde/OpenAgentsControl --color "d73a4a" --description "High priority"
```

---

## 🔧 Advanced Usage

### Edit Project Fields (Status, Priority)

**Note:** This requires knowing the item ID from the project.

```bash
# Get item list with IDs
gh project item-list 2 --owner darrenhinde --format json

# Edit item status
gh project item-edit 2 \
  --owner darrenhinde \
  --id ITEM_ID \
  --field "Status" \
  --value "In Progress"
```

### Milestones

**Create milestone:**
```bash
gh milestone create "v0.2 - DX & Examples" \
  --repo darrenhinde/OpenAgentsControl \
  --description "Short-term focus on developer experience"
```

**Attach milestone to issue:**
```bash
gh issue edit 123 --repo darrenhinde/OpenAgentsControl --milestone "v0.2 - DX & Examples"
```

### Bulk Operations

**Close multiple issues:**
```bash
for i in 123 124 125; do
  gh issue close $i --repo darrenhinde/OpenAgentsControl
done
```

**Add label to multiple issues:**
```bash
for i in 123 124 125; do
  gh issue edit $i --repo darrenhinde/OpenAgentsControl --add-label "priority-high"
done
```

---

## 📝 Daily Workflow Example

```bash
# Morning: Check what's on the board
make ideas

# Create a new idea
make idea TITLE="Add local eval runner" BODY="Run evals locally without cloud" LABELS="idea,evals"

# Start working on issue #42
make issue-comment NUM=42 COMMENT="Starting work on this today"

# Open board to see progress
make board

# Evening: Close completed issue
make issue-close NUM=42
```

---

## 🔗 Resources

- **Project Board:** https://github.com/users/darrenhinde/projects/2
- **Repository:** https://github.com/darrenhinde/OpenAgentsControl
- **GitHub CLI Docs:** https://cli.github.com/manual/

---

## 💡 Tips

1. **Use aliases in your shell:**
   ```bash
   # Add to ~/.bashrc or ~/.zshrc
   alias oa-idea='make -C ~/Documents/GitHub/opencode-agents idea'
   alias oa-list='make -C ~/Documents/GitHub/opencode-agents ideas'
   alias oa-board='make -C ~/Documents/GitHub/opencode-agents board'
   ```

2. **Create issue templates:**
   - Already available in `.github/ISSUE_TEMPLATE/`
   - Use `gh issue create` to pick a template interactively

3. **Use saved searches:**
   ```bash
   # Save common queries as shell functions
   function oa-my-issues() {
     gh issue list --repo darrenhinde/OpenAgentsControl --assignee @me
   }
   ```

4. **Combine with git workflow:**
   ```bash
   # Create issue and branch in one go
   ISSUE=$(gh issue create --repo darrenhinde/OpenAgentsControl --title "Fix bug" --label bug --format json | jq -r .number)
   git checkout -b "fix/issue-$ISSUE"
   ```

---

**Last Updated:** December 4, 2025
