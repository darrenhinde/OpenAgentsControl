# Documentation map

**Working on the repo? Read [../agent-library/README.md](../agent-library/README.md) (row 4) and nothing else is required.**
[CORE.md](architecture/CORE.md), [CONTRIBUTING.md](contributing/CONTRIBUTING.md) and [DEVELOPMENT.md](contributing/DEVELOPMENT.md)
are optional depth. Users only need the first two rows.

| # | Read | For |
| --- | --- | --- |
| 1 | [../README.md](../README.md) | What OAC is, how to install it |
| 2 | [getting-started/installation.md](getting-started/installation.md) | Installer options, collision handling ([collision-handling.md](getting-started/collision-handling.md)) |
| 3 | [architecture/CORE.md](architecture/CORE.md) | The one flow: `agent-library/` -> compiler -> `built-ai-configs/`; what must stay green |
| 4 | [../agent-library/README.md](../agent-library/README.md) | Write or change an agent, skill or command: file anatomy, workflow, build errors |
| 5 | [../packages/cli/README.md](../packages/cli/README.md) | The `oac` commands and flags; how `install.sh` relates |
| 6 | [../packages/agent-compiler/README.md](../packages/agent-compiler/README.md) | The build library behind `oac build` |
| 7 | [architecture/NAMING.md](architecture/NAMING.md) | Naming and layout rules for agent, skill and command ids; the report-only naming lint |
| 8 | [architecture/SKILLS-AND-COMMANDS.md](architecture/SKILLS-AND-COMMANDS.md) | Skills and commands as canonical content: layout, `oac:` block, per-host output, registry, lints |
| 9 | [features/opencode-v1-and-v2.md](features/opencode-v1-and-v2.md) | Why v1 and v2 output differ, how the choice is recorded |

What each tool gets, per host: [../built-ai-configs/README.md](../built-ai-configs/README.md) (generated).
Component registry: [../built-ai-configs/registry/registry.json](../built-ai-configs/registry/registry.json) (generated).

## Contributing

- [contributing/CONTRIBUTING.md](contributing/CONTRIBUTING.md): conventions, registry, opening a PR
- [contributing/DEVELOPMENT.md](contributing/DEVELOPMENT.md): tool versions, setup, repo layout, what the checks run
- [contributing/CODE_OF_CONDUCT.md](contributing/CODE_OF_CONDUCT.md)
- [github/GITHUB_SETTINGS.md](github/GITHUB_SETTINGS.md): repository settings checklist

## Other topics

- [agents/](agents/): per-agent guides ([openagent](agents/openagent.md), [opencoder](agents/opencoder.md))
- [features/system-builder/](features/system-builder/): build an AI system for your domain
- [features/agent-system-blueprint.md](features/agent-system-blueprint.md): architecture patterns
- [guides/building-with-opencode.md](guides/building-with-opencode.md)
- [lessons-learnt/](lessons-learnt/): product decisions (D-NNN) and lessons (L-NNN)
- [NORTH_STAR.md](NORTH_STAR.md), [ROADMAP.md](ROADMAP.md)
- [maintenance/](maintenance/): audits and registry notes
- [history/](history/) and [architecture/canonical-refactor/](architecture/canonical-refactor/): historical records, not current guidance

[../CHANGELOG.md](../CHANGELOG.md) has version history.
