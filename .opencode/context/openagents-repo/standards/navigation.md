<!-- Context: openagents-repo/standards/navigation | Priority: critical | Version: 2.0 | Updated: 2026-09-02 -->
# OpenAgents Repo Standards

## Agent authoring

1. Edit the canonical agent under `agent-library/agents/**`.
2. Keep OpenCode settings at the frontmatter root and OpenAgents Control metadata in `oac:`.
3. Run `make build-canonical`; `oac build` generates the host trees and the registry entries from canonical content.
4. Validate: `make check-canonical-drift` and `bash scripts/registry/validate-registry.sh`.

Do not edit generated `built-ai-configs/**`, its mirrors `.opencode/agent/**` and `plugins/claude-code/agents/**`, registry output, or a metadata sidecar.

## Standards

| File | Use |
|---|---|
| [agent-frontmatter.md](agent-frontmatter.md) | Canonical frontmatter and `oac:` schema |
| [subagent-structure.md](subagent-structure.md) | Prompt structure and canonical location |
| [agent metadata](../core-concepts/agent-metadata.md) | Metadata and RegistryEmitter flow |
| [permission-patterns.md](permission-patterns.md) | Ordered permission rule patterns |
| [opencode-typescript.md](opencode-typescript.md) | OpenCode source TypeScript conventions (large reference) |

## Quick example

```yaml
oac:
  id: my-agent
  category: subagents/core
  type: subagent
  exclude: [claude-code]
```
