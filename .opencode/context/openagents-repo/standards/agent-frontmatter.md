<!-- Context: openagents-repo/standards/agent-frontmatter | Priority: critical | Version: 2.0 | Updated: 2026-09-02 -->
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
  targets: [opencode, claude-code]
---
```

## Rules

- Put OpenCode fields (`name`, `description`, `mode`, `tools`, `permission`, and related options) at the frontmatter root.
- Put registry metadata only in `oac:`.
- Do not duplicate metadata in another file or add an auto-detect merge step.
- Use `permission` (singular), never duplicate YAML keys, and use one frontmatter block.

## Build flow

The RegistryEmitter consumes `content/agents/**` and emits registry and target artifacts. Edit canonical content, then regenerate and validate; never edit generated `.opencode/agent/**` or plugin outputs.

## Checklist

- [ ] Valid YAML and OpenCode root fields
- [ ] Complete `oac:` identity, category, type, version, author, targets
- [ ] Dependencies declared in `oac.dependencies`
- [ ] Compatibility build and registry validation run
