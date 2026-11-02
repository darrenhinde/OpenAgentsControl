# The core system

One flow is the product. Everything else either feeds it, checks it, or is history.

```
agent-library/agents + profiles   ->   packages/agent-compiler   ->   built-ai-configs/
  one file per agent                     core/  parse, resolve, emit     opencode/       OpenCode v2 (default)
  `oac:` block + overrides               adapters/  one per tool         opencode-v1/    OpenCode v1 (on request)
                                                                          claude-code/    Claude Code
                                  packages/cli  (oac build / init / add / update / doctor / apply)
                                  install.sh, update.sh                   registry/       registry.json, registry.v1.json
                                  scripts/validation/check-build-drift.sh
```

Author an agent once in `agent-library/`. `oac build` converts it for each tool. The drift
gate fails CI if the committed output differs from a fresh build, so generated files are never
hand-edited. Not everything under `built-ai-configs/` is generated; see the next section.

## Generated vs hand-maintained

The ledger `.oac/build-manifest.json` lists exactly the generated files (117 today). `oac build`
writes, prunes and drift-checks those and nothing else.

| Path | Status |
| --- | --- |
| `built-ai-configs/opencode/agent/*.md` | generated |
| `built-ai-configs/opencode-v1/agent/**/*.md` | generated |
| `built-ai-configs/claude-code/agents/*.md` | generated |
| `built-ai-configs/registry/registry.json`, `registry.v1.json` | generated (agent, subagent and tier sections; other categories are carried through from the committed file) |
| `built-ai-configs/README.md` | generated |
| `.opencode/agent/*.md`, `plugins/claude-code/agents/*.md` | generated mirrors |
| `.oac/build-manifest.json` | generated ledger |
| `built-ai-configs/opencode-v1/{tool,plugin,plugins,skills,command}/**` (25 files) and `built-ai-configs/opencode-v1/agent/**/0-category.json` | **hand-maintained** v1 assets. Edit them directly; the build and the drift gate ignore them. |

## Tiers

| Tier | What | Rule |
| --- | --- | --- |
| **Core** | `agent-library/` (agents, profiles), `packages/agent-compiler/src/{core,adapters}`, `packages/cli`, `built-ai-configs/`, `install.sh`, `update.sh`, the drift gate, the compiler and CLI tests | Must be green to merge. `make check-core` runs it. |
| **Supporting** | `packages/agent-compiler/src/{verify,hosts}`, `evals/v2`, the Claude plugin's skills, commands and hooks, the context library | Kept and tested, off the critical path. |
| **Peripheral** | Older eval trees, planning notes, reports, one-off scripts | Moved under `docs/history/` or `legacy/`, or removed once nothing references them. |

## What "healthy" means

`make check-core` must pass. It runs:

1. build the compiler and the CLI;
2. the drift gate: a real build, then no change to any generated file;
3. compiler tests (vitest) and CLI tests (`bun test`);
4. typecheck of both packages;
5. the change-detection tests that decide which CI gates run;
6. the installer flavor tests (`scripts/tests/test-flavor-install.sh`, bash).

`oac build` itself also reports degradation warnings, dead delegation references and lint
findings on the tree it is about to write. A lint error fails the build; warnings, dead
references and lint warnings are reported and fail only under `--strict`. Dead references and
lint findings should be zero.

## Adding to the core

- New agent: one file in `agent-library/agents/**`, then `make build-canonical`; steps in [agent-library/README.md](../../agent-library/README.md#the-workflow).
- New host: one adapter in `packages/agent-compiler/src/adapters/` and one entry in the target
  tables in `core/`. Anything the host cannot express must produce a degradation warning.
- Never hand-edit a generated path from the table above. Hand-maintained v1 assets are edited in place.
