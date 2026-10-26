<!-- Context: openagents-repo/standards/agent-frontmatter | Priority: critical | Version: 2.1 | Updated: 2026-10-25 -->
# Standard: Agent Frontmatter

Canonical agent files live in `content/agents/**`. Their frontmatter combines valid OpenCode configuration with an `oac:` block for OpenAgents Control metadata.

```yaml
---
name: TestEngineer
description: "Test authoring and TDD agent"
mode: subagent
temperature: 0.1
permission:
  bash:
    "npm test *": allow
oac:
  id: tester
  name: TestEngineer
  category: subagents/code
  type: subagent
  version: "1.0.0"
  author: opencode
  tags: [testing, tdd]
  dependencies: [context:standards-tests]
  # Shipping scope — see "Shipping" below. Omit `targets:` to ship to every host;
  # opt out per host with `exclude:`.
  exclude: [claude-code]
---
```

## Rules

- Put OpenCode fields (`name`, `description`, `mode`, `tools`, `permission`, and related options) at the frontmatter root.
- Put registry metadata only in `oac:`.
- Do not duplicate metadata in another file or add an auto-detect merge step.
- Use `permission` (singular), never duplicate YAML keys, and use one frontmatter block.

## Shipping (the opt-out model)

How an agent reaches each AI tool, defined in `oac:` and enforced by `TargetPolicy`:

- **Omit `targets:`** → the agent ships to EVERY build target (`opencode`, `opencode-v1`, `claude-code`), minus any `oac.exclude` entries. This is the default and the common case.
- **`exclude: [host, …]`** → opt out of named hosts. Only meaningful with omitted `targets:`.
- **`targets: [host, …]`** → explicit opt-in list, for exceptions (today: the v1-only agent, `targets: [opencode-v1]`).
- Declaring both `targets` and `exclude` is allowed — `exclude` filters the declared list; an `exclude` entry naming a host the list already omits is a parse error, as is an override for a host the agent doesn't effectively ship to, and a targets/exclude combination that leaves nothing to emit.
- An agent shipping to `claude-code` MUST have an authored `tools` list in `oac.overrides["claude-code"]` (the build refuses otherwise, fail-closed). A `description` with `<example>` dispatch blocks is strongly recommended — Claude routes on it — but is optional (it falls back to the canonical description).
- `opencode-v1` follows `opencode`: declaring `opencode` ships both majors.

Consequence: adding a new build target costs the corpus nothing — agents default onto it and the build degrades what it cannot express. Opt out explicitly only where an agent must not ship.

## Build flow

The RegistryEmitter consumes `content/agents/**` and emits registry and target artifacts. Edit canonical content, then regenerate and validate; never edit generated output: `hosts/**`, or its mirrors `.opencode/agent/**` and `plugins/claude-code/agents/**`.

## Checklist

- [ ] Valid YAML and OpenCode root fields
- [ ] Complete `oac:` identity, category, type, version, author
- [ ] Shipping scope right: `targets:` omitted (default) or explicit/`exclude` where intended
- [ ] Dependencies declared in `oac.dependencies`
- [ ] Compatibility build and registry validation run
