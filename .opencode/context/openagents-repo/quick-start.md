<!-- Context: openagents-repo/quick-start | Priority: critical | Version: 2.0 | Updated: 2026-11-02 -->

# OpenAgents Control Repository - Quick Start

**Purpose**: Get oriented in this repo in 2 minutes.

## What this repo is

Agents are authored once in `agent-library/agents/**`. `oac build` generates the OpenCode v2, OpenCode v1 and
Claude Code copies, the installer registries and the live mirrors. CI fails if committed output differs from a
fresh build. Read `core-concepts/canonical-build.md` first.

## I need to...

| Task | Load |
|---|---|
| Add or change an agent | `guides/authoring-agents.md` (+ `standards/agent-frontmatter.md`) |
| Understand the system | `core-concepts/canonical-build.md` |
| Change the compiler or CLI, add a host | `guides/compiler-development.md` |
| Add or remove a context file, fix the registry | `guides/updating-registry.md`, `core-concepts/registry.md` |
| Find a file | `lookup/file-locations.md` |
| Run commands | `lookup/commands.md` |
| Build failed, drift gate red | `guides/debugging.md` |
| Test an agent | `core-concepts/evals.md`, `guides/testing-agent.md` |
| Install / `oac` CLI | `guides/oac-cli-install.md` |
| Cut a release | `guides/creating-release.md` |

## Essential commands

```bash
make build-canonical                         # regenerate everything from agent-library/
make check-core                              # full health check (includes the drift gate)
bash scripts/registry/validate-registry.sh   # registry paths and dependencies
bun run scripts/registry/check-dependencies.ts
```

## Rules

- Edit sources, never generated files: `built-ai-configs/**`, `.opencode/agent/**`, `plugins/claude-code/agents/**`, `.oac/build-manifest.json`.
- Commit source and regenerated output together.
- A new agent must appear in a system profile (`agent-library/profiles/system/*.json`) to be installable.
- Context files (`.opencode/context/**`) are hand-maintained and registered by hand in both registries.

## Related

`navigation.md`, `docs/architecture/CORE.md`
