# @controlstack/agent-compiler

The build library behind `oac build`. It loads the canonical content tree
(`agent-library/agents/**`, `skills/**`, `commands/**`, `profiles/**`) and emits the per-tool trees plus
`built-ai-configs/registry/registry.json`.

## What it contains

`src/` has four folders plus `types.ts` (the Zod schemas, including the `oac:` block) and `index.ts`.

| Module | Purpose |
|---|---|
| `core/AgentLoader` | Parses canonical agent files (OpenCode frontmatter + `oac:` block) |
| `core/ProfileLoader` | Loads system and context profiles and resolves their closures |
| `core/ReferenceResolver` | Resolves `type:id` references against `built-ai-configs/registry/registry.json` |
| `core/RegistryEmitter`, `RegistryTargets` | Generate `registry.json` / `registry.v1.json` from canonical content |
| `core/TargetPolicy` | Which targets an agent ships to (`targets` minus `exclude`; `opencode-v1` follows `opencode`) |
| `core/AgentIdResolver`, `DelegationRewriter` | Spell delegation references (`permission.task` keys, `subagent_type`, `task(`) in each host's id space |
| `core/HostBlocks` | Filters `<!-- oac:only <host> -->` blocks |
| `core/Capabilities`, `CapabilityMatrix` | Ordered permission rules, what each target can express, degradation warnings |
| `core/BuildPipeline`, `BuildManifest` | `plan` -> `write` / `check`, with ledger-gated pruning (`.oac/build-manifest.json`) |
| `core/HostsReadme` | Generates `built-ai-configs/README.md` |
| `adapters/OpenCodeAdapter`, `adapters/opencode/` | OpenCode v2: `built-ai-configs/opencode/agent/**`, mirrored to `.opencode/agent/**` |
| `adapters/v1/OpenCodeV1Adapter` | OpenCode v1: `built-ai-configs/opencode-v1/agent/**` |
| `adapters/ClaudeAdapter` | Claude Code: `built-ai-configs/claude-code/agents/**`, mirrored to `plugins/claude-code/agents/**`, from `oac.overrides.claude-code` and host blocks |
| `hosts/` | Drivers that run a real OpenCode or Claude Code host (verification tier) |
| `verify/` | Lints run by every build (`verify/lint`), and the scenario runner and fixtures for host-level evals |

Build targets: `opencode` (v2), `opencode-v1` and `claude-code`. Cursor and Windsurf support was
removed on 2026-09-02 to keep the system simple to manage.

## Usage

```typescript
import { plan, write, check } from "@controlstack/agent-compiler";

const built = await plan({ root: process.cwd() });
// Every target is written in place; `outputRoots` can rebase one elsewhere if needed.
const result = write(built, { root: process.cwd() });
```

Most users never import this package directly; use the `oac` CLI ([packages/cli/README.md](../cli/README.md); authoring guide: [agent-library/README.md](../../agent-library/README.md)):

```bash
oac build          # regenerate built-ai-configs/**, its mirrors, built-ai-configs/registry/*.json, the manifest
oac build --check  # report drift, write nothing
```

## Development

```bash
pnpm run build      # tsc
pnpm run test       # vitest
pnpm run lint       # eslint
```

`make check-core` (repo root) runs these tests, the lint, the typecheck and the drift gate; use that before pushing.
