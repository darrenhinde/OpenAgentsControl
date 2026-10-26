# @controlstack/compatibility-layer

The build library behind `oac build`. It loads the canonical content tree
(`content/agents/**`, `content/profiles/**`) and emits the per-tool trees plus
`registry.json`.

## What it contains

| Module | Purpose |
|---|---|
| `core/AgentLoader` | Parses canonical agent files (OpenCode frontmatter + `oac:` block) |
| `core/ProfileLoader` | Loads system and context profiles and resolves their closures |
| `core/ReferenceResolver` | Resolves `type:id` references against `registry.json` |
| `core/RegistryEmitter` | Generates `registry.json` from canonical content |
| `core/BuildPipeline` | `plan` → `write` / `check`, with ledger-gated pruning |
| `core/Capabilities` | Ordered permission rules, last-match-wins, fail-closed degradation |
| `core/CapabilityMatrix` | What each target (OpenCode, Claude Code) can express |
| `adapters/OpenCodeAdapter` | Emits `hosts/opencode/agent/**` (mirrored to `.opencode/agent/**`) by stripping the `oac:` block |
| `adapters/ClaudeAdapter` | Emits `hosts/claude-code/agents/**` (mirrored to `plugins/claude-code/agents/**`) from per-target overrides and host blocks |
| `mappers/*` | Tool, permission, model and context translation for Claude Code |

Targets are OpenCode and Claude Code only. Cursor and Windsurf support was
removed on 2026-09-02 to keep the system simple to manage.

## Usage

```typescript
import { plan, write, check } from "@controlstack/compatibility-layer";

const built = await plan({ root: process.cwd() });
// Every target is written in place; `outputRoots` can rebase one elsewhere if needed.
const result = write(built, { root: process.cwd() });
```

Most users never import this package directly; use the `oac` CLI:

```bash
oac build          # regenerate hosts/**, its mirrors, registry.json, the manifest
oac build --check  # report drift, write nothing
```

## Development

```bash
pnpm run build      # tsc
pnpm run test       # vitest
pnpm run lint       # eslint
```
