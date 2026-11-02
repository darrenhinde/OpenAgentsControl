<!-- Context: openagents-repo/navigation | Priority: critical | Version: 2.0 | Updated: 2026-11-02 -->

# OpenAgents Control Repository Context

**Purpose**: Context for agents working on THIS repo. Start with `quick-start.md`, then `core-concepts/canonical-build.md`.

## Start here

| File | Topic |
|------|-------|
| `quick-start.md` | 2-minute orientation and task router |
| `core-concepts/canonical-build.md` | How agents are authored once and built for every tool |
| `guides/authoring-agents.md` | Add or change an agent; `oac:` fields; common build errors |
| `guides/compiler-development.md` | Change the compiler or CLI; add a host; `make check-core` |
| `lookup/file-locations.md` | Generated vs hand-maintained paths |
| `lookup/commands.md` | Make targets, `oac`, validators, evals |

## By folder

| Folder | Contents | Index |
|--------|----------|-------|
| `core-concepts/` | canonical build, registry, agent metadata, evals | [navigation](core-concepts/navigation.md) |
| `guides/` | authoring, registry, CLI install, testing, debugging, releases, skills | [navigation](guides/navigation.md) |
| `lookup/` | file locations, commands, subagent and skill references | [navigation](lookup/navigation.md) |
| `standards/` | agent frontmatter, subagent structure, permission patterns | [navigation](standards/navigation.md) |
| `concepts/` | hooks, skills, subagents, subagent testing modes | [navigation](concepts/navigation.md) |
| `examples/` | hooks, skills, subagents, prompt and bundle examples | [navigation](examples/navigation.md) |
| `errors/` | permission and skills errors | [navigation](errors/navigation.md) |
| `quality/` | registry dependency validation | [navigation](quality/navigation.md) |
| `templates/` | context bundle template | [navigation](templates/navigation.md) |
| `plugins/` | OpenCode plugin system context | [navigation](plugins/navigation.md) |

## Loading strategy

- **Agent creation**: `standards/agent-frontmatter.md` -> `core-concepts/canonical-build.md` -> `guides/authoring-agents.md` -> `guides/testing-agent.md`. If the agent uses an external library, add `guides/external-libraries-workflow.md`.
- **Compiler / CLI work**: `core-concepts/canonical-build.md` -> `guides/compiler-development.md` -> `guides/debugging.md`.
- **Registry or context files**: `core-concepts/registry.md` -> `guides/updating-registry.md` -> `quality/registry-dependencies.md`.
- **Subagent testing**: `concepts/subagent-testing-modes.md` -> `guides/testing-subagents.md` -> `lookup/subagent-test-commands.md`; on failures `errors/tool-permission-errors.md`.
- **Issues**: `guides/github-issues-workflow.md`.

## Related

- `../core/` and `../core/context-system/`: general standards and the context system
- `docs/architecture/CORE.md` in the repo root: the canonical system overview

## Contributing

Keep files short (MVI, about 200 lines or fewer) with the leading `<!-- Context: ... -->` line. When you add, remove or
rename a file here, update the folder's `navigation.md`, both registry files (`guides/updating-registry.md`), and run
the registry validators.
