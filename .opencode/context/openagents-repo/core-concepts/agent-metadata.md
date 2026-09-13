<!-- Context: openagents-repo/core-concepts/agent-metadata | Priority: critical | Version: 2.0 | Updated: 2026-09-02 -->
# Core Concept: Agent Metadata

## Current metadata workflow

`content/agents/**` is the canonical source. Keep OpenCode configuration and OpenAgents Control metadata together in the agent's frontmatter:

```yaml
---
name: MyAgent
description: "Does one focused task"
mode: subagent
oac:
  id: my-agent
  name: MyAgent
  category: subagents/code
  type: subagent
  version: "1.0.0"
  author: opencode
  tags: [example]
  dependencies: []
  targets: [opencode]
---
```

`oac:` is OpenAgents Control metadata. It is not an OpenCode field; the compatibility build reads it from canonical content and emits target-specific artifacts.

## Registry generation

Do not edit registry entries or a metadata sidecar. The RegistryEmitter reads canonical `content/agents/**` files and emits the registry during the compatibility build.

```text
content/agents/** (frontmatter + oac)
  → RegistryEmitter
  → generated registry and target outputs
```

When changing an agent, edit its canonical file, then run the project's compatibility build and registry validation. Generated `.opencode/agent/**` and `plugins/**` files are outputs, not sources.

## Metadata checklist

- Use a stable kebab-case `oac.id`.
- Keep `oac.category`, `type`, `tags`, and `dependencies` with the agent.
- Declare each target in `oac.targets`; put target-only settings in `oac.overrides`.
- Do not merge metadata from a second source.

## Eval runner exception

`.opencode/agent/eval-runner.md` is an intentionally registry-carried evaluation harness. It is not canonical agent content and is not a replacement for `oac:` metadata. Its exception does not restore the retired metadata sidecar or a sidecar-merge workflow.

## Related

- [Agent frontmatter](../standards/agent-frontmatter.md)
- [Subagent structure](../standards/subagent-structure.md)
