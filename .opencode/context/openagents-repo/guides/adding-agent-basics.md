<!-- Context: openagents-repo/guides | Priority: high | Version: 2.0 | Updated: 2026-10-25 -->

# Guide: Adding a New Agent (Basics)

**Prerequisites**: Load `standards/agent-frontmatter.md` and `standards/subagent-structure.md` first
**Purpose**: Create and register a new agent in 4 steps — the canonical way

---

## Overview

Agents are **authored once, in one canonical place**, and every AI tool's copy is generated:

1. Creating the canonical agent file
2. Building (this also emits the registry — no manual registry step)
3. Validating (drift gate + smoke test)
4. Testing installation

**Time**: ~15-20 minutes

> **Never** create files under `.opencode/agent/`, `hosts/`, or `plugins/claude-code/agents/`
> directly — those are generated build output. A hand edit there fails the drift gate
> (`scripts/validation/check-build-drift.sh`) and a build prunes orphans it.

---

## Step 1: Create the Canonical Agent File

### Choose Category

Canonical agents live under `content/agents/`:

```
content/agents/
├── core/                # system agents (openagent, opencoder)
├── subagents/
│   ├── code/            # coding subagents
│   ├── core/            # orchestration core (contextscout, task-manager, …)
│   ├── planning/        # planning subagents
│   ├── system-builder/  # meta-system builders
│   ├── development/     # dev specialists
│   ├── test/            # test subagents
│   └── utils/           # utilities
├── content/             # content creators (technical-writer, copywriter)
├── data/                # data analysts
└── meta/                # repo/meta management
```

### Create the File

```bash
touch content/agents/subagents/<group>/<agent-id>.md
```

Write it in the **canonical format** — full rules in `standards/agent-frontmatter.md`:

```markdown
---
name: MyAgent
description: One-line summary of what the agent does
mode: subagent
permission:
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"

oac:
  id: my-agent
  name: MyAgent
  category: subagents/<group>
  type: subagent
  version: "1.0.0"
  author: opencode
  tags: [tag1, tag2]
  dependencies:
    - context:standards-code
  # Shipping is OPT-OUT: omit `targets:` and the agent ships to every build target
  # (opencode, opencode-v1, claude-code). Opt out of a host explicitly:
  exclude:
    - claude-code
  # Only if this agent needs host-specific frontmatter, e.g.:
  # overrides:
  #   claude-code:
  #     name: my-agent-claude
  #     model: sonnet
  #     description: |
  #       (Claude routes on this — include <example> dispatch blocks.)
---

# MyAgent

> **Mission**: One line.

Body text here. Per-host body variants use host blocks:

<!-- oac:only claude-code -->
Claude-only body text (e.g. "context is pre-loaded").
<!-- /oac:only -->

<!-- oac:only opencode -->
OpenCode-only body text (e.g. "call ContextScout first").
<!-- /oac:only -->
```

Key rules:

- **Omit `targets:`** to ship everywhere; declare it only for exceptions (e.g. a v1-only agent: `targets: [opencode-v1]`).
- `exclude` is a *filter* on `targets` — declaring both is allowed, but an `exclude` entry naming a host the declared list already omits is a parse error (it narrows nothing). So is an override for a host the agent doesn't effectively ship to.
- The `oac:` block is authoring-only — the build strips it on emit.
- An agent that omits a `claude-code` override cannot ship there: the build **refuses** it (fail-closed). Either author the override or add `exclude: [claude-code]`.

---

## Step 2: Build

```bash
make build-canonical        # builds the CLI, then: 34+ agents -> all hosts
```

What this does:

- Emits every host's copy under `hosts/<host>/` (and the byte-identical live mirrors)
- **Emits `registry.json` / `registry.v1.json`** — there is no separate registry step
- Regenerates `hosts/README.md` (the agents-by-host index) and `.oac/build-manifest.json`
- Reports degradation warnings for anything a host cannot express

Open `hosts/README.md` after building — your agent should appear in the matrix.

---

## Step 3: Validate

```bash
# Drift gate — the build must not change anything on a second run
make check-canonical-drift

# Registry validation
./scripts/registry/validate-registry.sh

# Smoke eval (create the eval structure first — see adding-agent-testing.md)
cd evals/framework && npm run eval:sdk -- --agent={id} --pattern="**/smoke-test.yaml"
```

Commit the generated output alongside the source — the committed trees are what the
drift gate and CI check.

---

## Step 4: Test Installation

```bash
REGISTRY_URL="file://$(pwd)/registry.json" ./install.sh --list
```

---

## Checklist

- [ ] Canonical file created under `content/agents/**` (NOT `.opencode/agent/`)
- [ ] Valid YAML; OpenCode root fields at top; metadata only in `oac:`
- [ ] `oac:` complete: id, name, category, type, version, author, tags, dependencies
- [ ] Shipping scope right: `targets:` omitted (default) or explicit/`exclude` where intended
- [ ] `claude-code` override authored OR `exclude: [claude-code]` declared
- [ ] `make build-canonical` succeeds; warnings understood
- [ ] `make check-canonical-drift` passes
- [ ] Smoke test passes
- [ ] Agent appears in `./install.sh --list`

---

## Next Steps

- **Add more tests** → `adding-agent-testing.md`
- **Test thoroughly** → `testing-agent.md`
- **Debug issues** → `debugging.md`

---

## Related

- `standards/agent-frontmatter.md` — the canonical frontmatter standard
- `standards/subagent-structure.md` — body structure for subagents
- `standards/permission-patterns.md` — permission rule patterns
- `docs/features/conversion-engine.md` — how the build converts to each host
- `creating-subagents.md` — subagent-specific authoring notes
- `testing-agent.md` — testing guide
