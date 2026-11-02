<!-- Context: openagents-repo/core-concepts/agent-metadata | Priority: critical | Version: 2.0 | Updated: 2026-09-02 -->
# Core Concept: Agent Metadata

## Current metadata workflow

`agent-library/agents/**` is the canonical source. Keep OpenCode configuration and OpenAgents Control metadata together in the agent's frontmatter:

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
  exclude: [claude-code]
---
```

`oac:` is OpenAgents Control metadata. It is not an OpenCode field; `oac build` reads it from canonical content and emits target-specific artifacts.

## Registry generation

Do not edit registry entries or a metadata sidecar. The RegistryEmitter reads canonical `agent-library/agents/**` files and emits the registry during `oac build`.

```text
agent-library/agents/** (frontmatter + oac)
  → RegistryEmitter
  → generated registry and target outputs
```

When changing an agent, edit its canonical file, then run `make build-canonical` and `bash scripts/registry/validate-registry.sh`. Generated `.opencode/agent/**` and `plugins/**` files are outputs, not sources.

## Metadata checklist

- Use a stable kebab-case `oac.id`.
- Keep `oac.category`, `type`, `tags`, and `dependencies` with the agent.
- Shipping is OPT-OUT: omit `oac.targets` to ship to every build target, and opt out per host with `oac.exclude`; declare `targets` explicitly only for exceptions (see `standards/agent-frontmatter.md`). Put target-only settings in `oac.overrides`.
- Do not merge metadata from a second source.

## Eval runner

`eval-runner` is a normal canonical agent: `agent-library/agents/subagents/test/eval-runner.md`, with its own `oac:` block, built like every other agent. There is no exception and no metadata sidecar.

## Related

- [Agent frontmatter](../standards/agent-frontmatter.md)
- [Subagent structure](../standards/subagent-structure.md)
- [Canonical build](canonical-build.md), [Authoring agents](../guides/authoring-agents.md)
