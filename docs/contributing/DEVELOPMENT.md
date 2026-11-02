# Development setup

Optional depth. To write or change an agent you only need [agent-library/README.md](../../agent-library/README.md);
this page covers machine setup, the repo layout, what the checks run, and where the tests live.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Bun | 1.3.14 (CI pins it) | runs the CLI, `make` targets and some tests |
| pnpm | 10.33.4, taken from the `packageManager` field in `package.json` | installs the workspaces |
| Node.js | 20+ | compiler, typecheck and the eval framework |
| jq | any | needed by `install.sh` and the installer tests |
| Git, Bash | | macOS/Linux, or Git Bash on Windows |
| OpenCode / Claude Code | optional | only to try an agent by hand |

## Setup

```bash
git clone https://github.com/darrenhinde/OpenAgentsControl.git
cd OpenAgentsControl
pnpm install --frozen-lockfile     # installs every workspace, including evals/framework
make check-core                    # should end with "Core is healthy"
```

Expected noise, both harmless:

- pnpm prints `Ignored build scripts: esbuild@...`. pnpm 10 skips dependency build scripts unless approved;
  nothing here needs them. Do not run `pnpm approve-builds`.
- `oac build` ends with `14 degradation warning(s)` on a clean checkout. That is the baseline: places where a
  host cannot express an OpenCode feature. A change that raises the number deserves a look
  (`oac build --verbose` lists them); the build fails only on errors.

Use `pnpm install` for `evals/framework` too (it is a workspace); `npm install` inside it fails.

## The loop

Edit `agent-library/agents/**`, `make build-canonical`, `make check-core`, commit source and generated
files together. The full version, with a worked example, is in [agent-library/README.md](../../agent-library/README.md#the-workflow).

## Repository layout

```
agent-library/                 SOURCE of every agent (edit here)
  agents/<dir>/*.md              one file per agent; OpenCode frontmatter + an `oac:` block
  profiles/{system,context}/     install tiers and context sets
packages/
  agent-compiler/                build library: src/{core,adapters,hosts,verify}
  cli/                           the `oac` CLI
built-ai-configs/              GENERATED output per tool (opencode, opencode-v1, claude-code, registry)
                                 except opencode-v1/{tool,plugin,plugins,skills,command}: hand-maintained
.opencode/                     this repo's own OpenCode config
  agent/                         GENERATED mirror of built-ai-configs/opencode/agent
  command/ context/ skills/ prompts/   hand-written
plugins/claude-code/           Claude Code plugin: agents/ is a GENERATED mirror; skills, commands, hooks are hand-written
.oac/build-manifest.json       GENERATED ledger of every built file
evals/                         eval framework and suites
scripts/                       registry, validation, installer tests, prompts (see scripts/README.md)
docs/                          documentation (start at docs/README.md)
install.sh, update.sh          shell installer and updater
```

Never hand-edit anything marked GENERATED: CI fails on any difference. Details and the exact list:
[CORE.md](../architecture/CORE.md).

## What the checks run

`make check-core` (also what CI reproduces): the drift gate (`make check-canonical-drift`), compiler tests
(vitest), CLI tests (`bun test`), typecheck of both packages, change-detection tests
(`bun test scripts/validation`) and the installer tests (`scripts/tests/test-flavor-install.sh`).

<!-- TODO-after-code: (1) check-core no longer hard-codes agent counts, so adding an agent keeps it green; today it fails on two count assertions in packages/agent-compiler/tests (golden-files.test.ts, lint-opencode.test.ts) after you add an agent. (4) pnpm run lint in packages/agent-compiler passes and is part of check-core. -->

Other checks, each passing on a clean checkout:

```bash
bun run validate:registry                              # registry paths and dependencies
pnpm --dir evals/framework run test:ci                 # eval framework unit tests (no model calls)
pnpm --dir evals/framework run validate:suites:all     # eval suite YAML validity
```

`./scripts/registry/validate-component.sh` is a legacy structure check that fails on this layout; ignore it.

## Where the tests are

| What | Where | Run |
| --- | --- | --- |
| Compiler | `packages/agent-compiler/tests/` | `pnpm --dir packages/agent-compiler exec vitest run` |
| CLI | `packages/cli/` | `cd packages/cli && bun test` |
| Change detection | `scripts/validation/` | `bun test scripts/validation` |
| Installers | `scripts/tests/` | `/bin/bash scripts/tests/test-flavor-install.sh` (others: [scripts/tests/README.md](../../scripts/tests/README.md)) |
| Agent behaviour evals (call a model) | `evals/` | [evals/README.md](../../evals/README.md), [ADDING_EVALUATOR.md](ADDING_EVALUATOR.md) |

## Other kinds of change

- **Commands, context, skills**: hand-written under `.opencode/command/`, `.opencode/context/`,
  `.opencode/skills/`; registering them is in [CONTRIBUTING.md](CONTRIBUTING.md#registry).
- **Tools and plugins**: OpenCode v1 only, hand-maintained in `built-ai-configs/opencode-v1/{tool,plugin,plugins}/`;
  the build neither writes nor checks them.
- **Prompt variants**: [CONTRIBUTING.md](CONTRIBUTING.md#prompt-variants).

## Release

Versions are bumped on merge to `main` from the conventional-commit prefix; see
[.github/workflows/VERSION_BUMP_GUIDE.md](../../.github/workflows/VERSION_BUMP_GUIDE.md) and
`.github/workflows/create-release.yml`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `build --check` or `make check-core` prints `modified <path>` | A generated file was edited or the source changed without a rebuild: `make build-canonical`. |
| `oac build` exits 1 | Read the message; most are in [Common build errors](../../agent-library/README.md#common-build-errors). |
| `bun run validate:registry` fails | Never hand-edit agent entries in the registry; rebuild. For other categories see [CONTRIBUTING.md](CONTRIBUTING.md#registry). |
| `npm install` fails in `evals/framework` | Use `pnpm install` at the repo root. |

Questions: issues for bugs, Discussions for questions, private email for security.
