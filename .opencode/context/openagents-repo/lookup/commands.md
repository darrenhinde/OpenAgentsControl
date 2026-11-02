<!-- Context: openagents-repo/lookup | Priority: high | Version: 2.0 | Updated: 2026-11-02 -->

# Lookup: Commands

**Purpose**: The commands used day to day in this repo. All run from the repo root.

## Build and health (canonical system)

| Command | Does |
|---|---|
| `make oac-cli` | build `packages/agent-compiler` and `packages/cli` (`packages/cli/dist/index.js`) |
| `make build-canonical` | `oac build`: regenerate every generated tree, both registries, `.oac/build-manifest.json` |
| `make check-canonical-drift` | real build, then fail if any generated file changed (the CI gate) |
| `make check-core` | drift gate + compiler vitest + CLI `bun test` + typecheck + `bun test scripts/validation` + installer flavor tests |
| `bun packages/cli/dist/index.js build --check` | report drift, write nothing |

`oac build` flags: `--target <tool...>` (opencode, opencode-v1, claude-code), `--check`, `--dry-run`, `--strict`,
`--no-prune`, `--verbose`, `--json` (reserved). Exit 1 on build or lint error; `--strict` also on warnings.

## Registry

```bash
bash scripts/registry/validate-registry.sh          # -v verbose, -f fix hints
bun run scripts/registry/check-dependencies.ts
bun scripts/registry/validate-registry.ts           # TypeScript validator
bash scripts/registry/validate-profile-coverage.sh
```

How to register context files: `guides/updating-registry.md`.

## The `oac` CLI (end users; `node bin/oac.js` / `@controlstack/oac`)

`oac init [--profile <id>] [--opencode v1|v2] [--context-only] [--dry-run]`, `oac add|remove <type:id>`,
`oac update [--check] [--yolo] [--opencode v1|v2]`, `oac apply claude`, `oac doctor`, `oac list`, `oac status`.
See `guides/oac-cli-install.md`.

## Install testing

```bash
REGISTRY_URL="file://$(pwd)/built-ai-configs/registry/registry.json" ./install.sh --list
/bin/bash scripts/tests/test-flavor-install.sh      # also part of make check-core
```

## Evals

```bash
make validate-evals                  # validate test suites (evals/framework)
make test-smoke                      # one smoke test
make test-agent AGENT=openagent
make test-subagent SUBAGENT=contextscout
make test-local TIER=quick           # evals/v2 local suite
cd evals/framework && npm run eval:sdk -- --agent=<id> [--debug]
```

More: `core-concepts/evals.md`, `lookup/subagent-test-commands.md`.

## Git and project board

`make issues`, `make board`, `make issue-view NUM=<n>`; `make help` lists all targets.

## Related

`guides/compiler-development.md`, `guides/authoring-agents.md`
