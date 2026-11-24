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
agent-library/                 SOURCE of every agent, skill, command and context file (edit here)
  agents/<category>/*.md         one file per agent; OpenCode frontmatter + an `oac:` block
  skills/ commands/ context/     skills, commands and the context library
  profiles/{system,context}/     install tiers and context sets
packages/
  agent-compiler/                build library: src/{core,adapters,hosts,verify}
  cli/                           the `oac` CLI
built-ai-configs/              GENERATED output per tool (opencode, opencode-v1, claude-code, registry)
                                 except opencode-v1/{tool,plugin,plugins}: hand-maintained
.opencode/                     this repo's own OpenCode config
  agent/ command/ skills/ context/   GENERATED mirrors (every file in them is in .oac/build-manifest.json,
                                   including agent/eval-runner.md, which is agent-library/agents/dev/eval-runner.md)
  prompts/ docs/ scripts/ config/    hand-written
plugins/claude-code/           Claude Code plugin: agents/ skills/ commands/ are GENERATED mirrors; hooks, settings and README are hand-written
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
(vitest), CLI tests (`bun test`), typecheck of both packages, the compiler lint (`pnpm --dir packages/agent-compiler run lint`), change-detection tests
(`bun test scripts/validation`) and the installer tests (`scripts/tests/test-flavor-install.sh`).
No test pins how many agents, skills, commands, context files or aliases exist (counts are floors), so adding one keeps it green.

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

- **Skills and commands**: canonical in `agent-library/skills/` and `agent-library/commands/`, built like
  agents ([agent-library/README.md](../../agent-library/README.md#skills-and-commands)).
- **Context**: hand-written under `.opencode/context/`; registering it is in [CONTRIBUTING.md](CONTRIBUTING.md#registry).
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
