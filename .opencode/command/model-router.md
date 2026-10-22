---
description: Configure per-agent model routing — view, apply, and manage tier-based model assignments
tags:
  - models
  - routing
  - configuration
  - agents
dependencies:
  - skill:model-router
---

# Model Router

**Arguments**: `$ARGUMENTS`

---

## Default Behavior (No Arguments)

When invoked without arguments: `/model-router`

Runs `status` — shows current agent→model assignments and any drift.

---

## Commands

### `/model-router status`

Show all agent→model assignments grouped by tier. Highlights drift (when agent frontmatter doesn't match tier config).

### `/model-router apply`

Sync `model-tiers.json` to all agent markdown frontmatter. Writes `model`, `temperature`, and `top_p` to each agent's frontmatter based on its tier assignment.

**Always preview first**:
```bash
bash .opencode/skills/model-router/router.sh apply --dry-run
```

Then apply:
```bash
bash .opencode/skills/model-router/router.sh apply
```

### `/model-router tier <name> <model-id>`

Change a tier's model. Example:
```bash
bash .opencode/skills/model-router/router.sh tier fast lmstudio/phi-4-mini
```

After changing a tier, run `apply` to propagate.

### `/model-router assign <agent-id> <tier>`

Move an agent to a different tier. Example:
```bash
bash .opencode/skills/model-router/router.sh assign contextscout medium
```

After changing an assignment, run `apply` to propagate.

### `/model-router tiers`

List all tier definitions with their model, temperature, and top_p settings.

### `/model-router unassigned`

Show agents in the registry that aren't in `model-tiers.json` assignments yet.

---

## Config Location

`.opencode/skills/model-router/config/model-tiers.json`

Edit this file directly to add new tiers, change defaults, or bulk-edit assignments.

---

## Workflow

1. **View**: `/model-router status` — see current state
2. **Edit**: Change tier or assignment via CLI commands, or edit `model-tiers.json` directly
3. **Preview**: `bash .opencode/skills/model-router/router.sh apply --dry-run`
4. **Apply**: `bash .opencode/skills/model-router/router.sh apply`
