<!-- Context: quality/registry-dependencies | Priority: high | Version: 2.0 | Updated: 2026-11-02 -->

# Registry Dependency Validation

**Purpose**: Keep every `dependencies` reference in the registry resolvable.

## Rule

A component lists what it needs as `type:id` strings; every one must be a registry entry. Types are
`subagent`, `context`, `command`, `skill`, `tool` (agents use these in `oac.dependencies`; see `guides/authoring-agents.md`).
Contexts, commands, skills and tools declare theirs in their own registry entry.

```json
"dependencies": ["context:mvi", "subagent:contextscout"]
```

## Checks

```bash
bash scripts/registry/validate-registry.sh       # paths exist; dependencies exist
bun run scripts/registry/check-dependencies.ts   # dependencies, profile members, critical infrastructure files
oac build                                        # reports dead references for agent dependencies (fail with --strict)
```

Slash command `/check-context-deps` (`.opencode/command/openagents/check-context-deps.md`) scans a context
dependency tree from inside an agent session.

## Fixing failures

| Symptom | Fix |
|---|---|
| Dependency not found in registry | add the missing entry, or correct the id (`guides/updating-registry.md`) |
| Agent dead reference warning | fix `oac.dependencies` in the agent source, rebuild |
| Removing a component | first remove it from other entries' `dependencies` and from profile JSON, then from the registry |
| Profile member missing | the id in `agent-library/profiles/**` has no registry entry; fix the profile or register it |

Registered contexts that agents depend on (ContextScout declares `registry-dependencies`, `context-system`, `mvi`
among others) must not be deleted without updating those dependents.

## Related

`core-concepts/registry.md`, `guides/updating-registry.md`
