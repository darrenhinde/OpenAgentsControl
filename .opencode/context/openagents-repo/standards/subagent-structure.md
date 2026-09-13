<!-- Context: openagents-repo/standards/subagent-structure | Priority: critical | Version: 2.0 | Updated: 2026-09-02 -->
# Standard: Subagent File Structure

Create and edit subagents in `content/agents/subagents/{category}/`. This canonical source contains both the prompt and its metadata.

```markdown
---
name: MyAgent
description: "Brief description"
mode: subagent
oac:
  id: my-agent
  name: MyAgent
  category: subagents/core
  type: subagent
  version: "1.0.0"
  author: opencode
  tags: [example]
  dependencies: []
  targets: [opencode]
---

# MyAgent
> **Mission**: One focused outcome.
```

## Required structure

1. Valid OpenCode root fields and one `oac:` block.
2. A mission, critical rules, context, workflow, and output expectations.
3. Appropriate tool permissions and target overrides when needed.

## Generation

RegistryEmitter reads canonical content and emits the registry and target-specific files. Do not edit generated `.opencode/agent/**` or `plugins/**` files, and do not maintain metadata in a sidecar.

See [agent frontmatter](agent-frontmatter.md) for field details.
