<!-- Context: openagents-repo/standards/subagent-structure | Priority: critical | Version: 2.0 | Updated: 2026-09-02 -->
# Standard: Subagent File Structure

Create and edit subagents in `agent-library/agents/{category}/<id>.md`. This canonical source contains both the prompt and its metadata.

```markdown
---
name: MyAgent
description: "Brief description"
mode: subagent
oac:
  id: my-agent
  name: MyAgent
  category: core
  type: subagent
  version: "1.0.0"
  author: opencode
  tags: [example]
  dependencies: []
  exclude: [claude-code]   # omit `targets:` to ship to every host; see guides/authoring-agents.md
---

# MyAgent
> **Mission**: One focused outcome.
```

## Required structure

1. Valid OpenCode root fields and one `oac:` block.
2. A mission, critical rules, context, workflow, and output expectations.
3. Appropriate tool permissions and target overrides when needed.

## Generation

`oac build` reads canonical content and emits the registry and target-specific files. Output lands in `built-ai-configs/<target>/`, mirrored to `.opencode/agent/**` and `plugins/claude-code/agents/**`. Do not edit any of these generated files, and do not maintain metadata in a sidecar.

See [agent frontmatter](agent-frontmatter.md) for field details.
