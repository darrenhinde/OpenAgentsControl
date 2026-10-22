---
name: model-router
description: Per-agent model routing with tier-based configuration — assign models to agents by role, reconfigure from one place
version: 1.0.0
author: opencode
type: skill
category: configuration
tags:
  - models
  - routing
  - configuration
  - agents
  - tiers
---

# Model Router Skill

> **Purpose**: Configure which AI model each agent and subagent uses — from a single config file. Change a tier, re-apply, and all agents in that tier update instantly.

---

## What I Do

I provide tier-based model routing for all agents and subagents:

- **Define tiers** — Group models by capability (fast, medium, powerful)
- **Assign agents to tiers** — Map each agent to the right model tier
- **Apply in one command** — Sync model settings to all agent frontmatter
- **Detect drift** — Spot when an agent's frontmatter doesn't match its tier
- **Reconfigure instantly** — Change a tier's model, then apply

---

## Why This Exists

OpenCode supports per-agent `model` configuration in agent markdown frontmatter and `opencode.json`. But with 30+ agents, manually editing each one is tedious and error-prone. This skill gives you a **single source of truth** (`model-tiers.json`) and a command to propagate changes.

---

## Quick Start

```bash
# See current assignments and any drift
bash .opencode/skills/model-router/router.sh status

# Apply tier config to all agent frontmatter
bash .opencode/skills/model-router/router.sh apply

# Preview changes without writing
bash .opencode/skills/model-router/router.sh apply --dry-run
```

---

## Command Reference

| Command | Description |
|---------|-------------|
| `status` | Show current agent→model assignments and drift from config |
| `apply [--dry-run]` | Sync model-tiers.json → agent markdown frontmatter |
| `tier <name> <model-id>` | Change a tier's model (e.g., `tier fast lmstudio/phi-4-mini`) |
| `assign <agent-id> <tier>` | Move an agent to a different tier (e.g., `assign contextscout medium`) |
| `tiers` | List all tier definitions with models and settings |
| `unassigned` | Show agents in registry not yet in assignments |
| `help` | Show help message |

---

## Architecture

```
.opencode/skills/model-router/
├── SKILL.md                          # This file
├── router.sh                         # CLI router (entry point)
├── config/
│   └── model-tiers.json              # Central model routing config (source of truth)
└── scripts/
    └── model-router.ts               # Apply/status/tier/assign automation
```

---

## Config File: model-tiers.json

The single source of truth for model routing. Located at:
`.opencode/skills/model-router/config/model-tiers.json`

### Schema

```json
{
  "version": "1.0.0",
  "tiers": {
    "<tier-name>": {
      "description": "What this tier is for",
      "model": "provider/model-id",
      "temperature": 0.2,
      "top_p": 0.9
    }
  },
  "defaults": {
    "primary_agents": "tier-name",
    "subagents": "tier-name"
  },
  "assignments": {
    "<agent-id>": "<tier-name>"
  }
}
```

### Default Tiers

| Tier | Purpose | Example Model |
|------|---------|---------------|
| **fast** | Simple tasks: web fetch, context scout, search | `lmstudio/gpt-oss-20b` |
| **medium** | Coding, testing, medium-complexity tasks | `lmstudio/qwen3-coder-30b` |
| **powerful** | Planning, orchestration, doc writing, architecture | `anthropic/claude-sonnet-4-20250514` |

### Default Assignments

| Tier | Agents |
|------|--------|
| **powerful** | openagent, opencoder, task-manager, documentation, domain-analyzer, agent-generator, context-organizer, workflow-designer, command-creator, architecture-analyzer, contract-manager, adr-manager, prioritization-engine, story-mapper, stage-orchestrator |
| **medium** | coder-agent, tester, build-agent, reviewer, batch-executor, frontend-specialist, devops-specialist |
| **fast** | contextscout, externalscout, context-retriever, context-manager, image-specialist, simple-responder |

---

## How Apply Works

1. Reads `model-tiers.json` to get tier→model mappings
2. Reads `registry.json` to resolve agent-id → file path
3. For each agent in `assignments`, resolves its tier to `model`, `temperature`, `top_p`
4. Updates the agent's markdown frontmatter in-place (only `model`, `temperature`, `top_p` fields)
5. Preserves all other frontmatter fields (name, description, mode, permission, etc.)
6. Reports what changed

---

## Common Workflows

### 1. Check Current State

```bash
bash .opencode/skills/model-router/router.sh status
```

Shows all agent→model assignments, grouped by tier. Highlights any drift (agent frontmatter doesn't match its tier).

### 2. Switch All "fast" Agents to a New Model

```bash
# Step 1: Update the tier definition
bash .opencode/skills/model-router/router.sh tier fast lmstudio/phi-4-mini

# Step 2: Preview the changes
bash .opencode/skills/model-router/router.sh apply --dry-run

# Step 3: Apply
bash .opencode/skills/model-router/router.sh apply
```

### 3. Move a Single Agent to a Different Tier

```bash
# Move contextscout from "fast" to "medium"
bash .opencode/skills/model-router/router.sh assign contextscout medium

# Apply the change
bash .opencode/skills/model-router/router.sh apply
```

### 4. Add a New Tier

Edit `model-tiers.json` directly to add a new tier:

```json
{
  "tiers": {
    "fast": { ... },
    "medium": { ... },
    "powerful": { ... },
    "reasoning": {
      "description": "Deep reasoning for complex analysis",
      "model": "openai/o3-mini",
      "temperature": 1.0,
      "top_p": 0.95
    }
  }
}
```

Then assign agents to it and apply:

```bash
bash .opencode/skills/model-router/router.sh assign task-manager reasoning
bash .opencode/skills/model-router/router.sh apply
```

### 5. Find Unassigned Agents

```bash
bash .opencode/skills/model-router/router.sh unassigned
```

Shows agents in the registry that aren't in `assignments` yet, so you can add them.

---

## Key Concepts

### Tiers

A tier groups model settings (model ID, temperature, top_p) under a name. All agents assigned to a tier share the same model configuration. This means you can switch 10 agents from one model to another by changing a single tier definition.

### Assignments

The `assignments` map links each agent-id to a tier name. This is the routing table. When you run `apply`, the script resolves each agent's tier to its model settings and writes those to the agent's frontmatter.

### Drift

Drift occurs when an agent's frontmatter `model` field doesn't match what its tier defines. This can happen if someone manually edits an agent file, or if you change a tier but forget to apply. The `status` command detects and reports drift.

### Apply Target

The `apply` command writes `model`, `temperature`, and `top_p` into each agent's markdown frontmatter. This is where OpenCode natively reads model configuration. Provider settings (API keys, base URLs) remain in `opencode.json` — this skill only manages the agent→model assignment.

---

## Integration

### With OpenCode

OpenCode natively reads `model`, `temperature`, and `top_p` from agent frontmatter. After running `apply`, the next time an agent is invoked, it will use the new model.

### With Profiles

Profiles (`.opencode/profiles/`) determine which agents are **included** in a setup. Model routing determines which **model** each included agent uses. They are orthogonal — you can use both together.

### With Registry

The `registry.json` provides the agent-id → file-path mapping. The model router reads this to find each agent's markdown file when applying.

---

## Troubleshooting

### "Config not found"
Make sure `.opencode/skills/model-router/config/model-tiers.json` exists.

### "Registry not found"
Make sure `registry.json` exists at the project root.

### "No frontmatter found in file"
The agent's markdown file may not have a YAML frontmatter block. Add one with `---` delimiters.

### "Drift detected"
Run `bash .opencode/skills/model-router/router.sh apply` to sync all agents with their tier definitions.

### Model not showing up after apply
Restart OpenCode to pick up the frontmatter changes, or switch agents and switch back.

---

**Model Router Skill** — Configure per-agent models from a single file!
