<!-- Context: openagents-repo/standards/navigation | Priority: critical | Version: 2.0 | Updated: 2026-09-02 -->
# OpenAgents Repo Standards

## Agent authoring

1. Edit the canonical agent under `content/agents/**`.
2. Keep OpenCode settings at the frontmatter root and OpenAgents Control metadata in `oac:`.
3. Regenerate artifacts through the compatibility build; RegistryEmitter creates the registry from canonical content.
4. Validate the emitted registry.

Do not edit generated `.opencode/agent/**`, `plugins/**`, registry output, or a metadata sidecar.

## Standards

| File | Use |
|---|---|
| [agent-frontmatter.md](agent-frontmatter.md) | Canonical frontmatter and `oac:` schema |
| [subagent-structure.md](subagent-structure.md) | Prompt structure and canonical location |
| [agent metadata](../core-concepts/agent-metadata.md) | Metadata and RegistryEmitter flow |

## Quick example

```yaml
oac:
  id: my-agent
  category: subagents/core
  type: subagent
  targets: [opencode]
```
