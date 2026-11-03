# The core system

One flow is the product. Everything else either feeds it, checks it, or is history.

```
agent-library/{agents,skills,commands} + profiles   ->   packages/agent-compiler   ->   built-ai-configs/
  one file per agent/command, one folder per skill      core/  parse, resolve, emit     opencode/       OpenCode v2 (default)
  `oac:` block + overrides                              adapters/  one per tool         opencode-v1/    OpenCode v1 (on request)
                                                                                         claude-code/    Claude Code
agent-library/context/**  --- copied verbatim --->  .opencode/context/**  (the one installed location, every host)

                                  packages/cli  (oac build / init / add / update / doctor / apply)
                                  install.sh, update.sh                   registry/       registry.json, registry.v1.json
                                  scripts/validation/check-build-drift.sh
```

Author an agent, skill or command once in `agent-library/`. `oac build` converts it for each tool. The drift
gate fails CI if the committed output differs from a fresh build, so generated files are never
hand-edited. Not everything under `built-ai-configs/` is generated; see the next section.

## Repo map

Hand-edited means you change it directly. Generated means `oac build` writes it and the drift gate rejects a hand edit.

| Path | What | Hand-edited or generated |
| --- | --- | --- |
| `agent-library/agents/` | one canonical file per agent, folder = category | hand-edited (the source) |
| `agent-library/skills/` | one folder per skill | hand-edited (the source) |
| `agent-library/commands/` | one file per command, at most one group folder | hand-edited (the source) |
| `agent-library/context/` | the context library; `components.json` makes files installable | hand-edited (the source) |
| `agent-library/profiles/` | `system/` install tiers, `context/` named context sets | hand-edited (the source); the registry's `profiles` section is generated from it |
| `agent-library/retired.json` | ids removed on purpose, so a rebuild and `oac update` clean them up | hand-edited |
| `built-ai-configs/` | what each tool gets: `opencode/`, `opencode-v1/`, `claude-code/`, `registry/` | generated, except the v1-only assets in the table below and the registry's `tools`/`plugins`/`config` sections |
| `.oac/build-manifest.json` | ledger of every generated file | generated |
| `.opencode/{agent,skills,command,context}/` | live mirror of the build, used by this repo and shipped in the npm package | generated |
| `.opencode/{prompts,scripts,docs}/`, `.opencode/config.json`, `.opencode/opencode.json` | runtime config and helpers (most ship with installs) | hand-edited |
| `packages/agent-compiler/` | the build library (`src/core`, `src/adapters`; `src/verify`, `src/hosts` are supporting) | hand-edited |
| `packages/cli/` | the `oac` CLI | hand-edited |
| `plugins/claude-code/` | the Claude Code plugin: `{agents,skills,commands}` and `context` (symlink) are generated mirrors | generated mirrors; hooks and manifests are hand-edited |
| `docs/` | documentation; `docs/history/` is the archive, `docs/lessons-learnt/` the decision log | hand-edited |
| `evals/` | evaluation frameworks and suites | hand-edited |
| `scripts/` | installer tests, validators, registry tools, version bump | hand-edited |
| `.github/` | CI workflows, templates, CODEOWNERS | hand-edited |

Other top-level files and folders, and who reads them:

| Path | Role | Read by |
| --- | --- | --- |
| `install.sh`, `update.sh` | shell installer and updater, fetched by raw GitHub URL | README, `package.json` `files`, CI |
| `bin/oac.js` | the `oac` executable | `package.json` `bin` |
| `VERSION` | version stamp, kept in step with `package.json` | `package.json` `files` and `version:bump:*`, `.github/workflows/post-merge-pr.yml` |
| `env.example` | template that ships as the `env-example` registry config component | `package.json` `files`, the registry, `install.sh` |
| `SECURITY.md` | security policy | GitHub, `.github/CODEOWNERS` |
| `integrations/claude-code/` | older standalone Claude Code converter and installer scripts, fetched by raw URL from its README | its README; excluded from the npm package by `.npmignore` |
| `.tmp/` | scaffold folders (`architecture`, `backlog`, `contracts`, `story-maps`) for agent working files; the rest of `.tmp/` is ignored | `scripts/maintenance/cleanup-stale-sessions.sh`, `scripts/external-context/`, `.gitignore` |
| `.claude-plugin/marketplace.json` | Claude Code marketplace entry | Claude Code `/plugin marketplace add` |
| `.env`, `.claude/`, `.qodo/` | local only: `.env` is git-ignored, `.claude/` and `.qodo/` hold no tracked files | nothing in the repo |
| `.oac/` | the build ledger; keep it | `oac build`, the drift gate |

## Generated vs hand-maintained

The ledger `.oac/build-manifest.json` lists exactly the generated files (553 today). `oac build`
writes, prunes and drift-checks those and nothing else.

| Path | Status |
| --- | --- |
| `built-ai-configs/opencode/{agent,skills,command}/**` | generated |
| `built-ai-configs/opencode-v1/{agent/**/*.md,skills,command}/**` | generated |
| `built-ai-configs/claude-code/{agents,skills,commands}/**` | generated |
| `built-ai-configs/registry/registry.json`, `registry.v1.json` | generated (agent, subagent, skill, command, context and profile sections; tools, plugins and config are carried through from the committed file) |
| `built-ai-configs/README.md` | generated |
| `.opencode/{agent,skills,command}/**`, `plugins/claude-code/{agents,skills,commands}/**` | generated mirrors |
| `.opencode/context/**` | generated verbatim copy of `agent-library/context/**` (source: [CONTEXT.md](CONTEXT.md)); `plugins/claude-code/context` is a symlink to it |
| `.oac/build-manifest.json` | generated ledger |
| `built-ai-configs/opencode-v1/{tool,plugin,plugins}/**` (23 files) and `built-ai-configs/opencode-v1/agent/**/0-category.json` | **hand-maintained** v1 assets. Edit them directly; the build and the drift gate ignore them. |

## Tiers

| Tier | What | Rule |
| --- | --- | --- |
| **Core** | `agent-library/` (agents, skills, commands, profiles), `packages/agent-compiler/src/{core,adapters}`, `packages/cli`, `built-ai-configs/`, `install.sh`, `update.sh`, the drift gate, the compiler and CLI tests | Must be green to merge. `make check-core` runs it. |
| **Supporting** | `packages/agent-compiler/src/{verify,hosts}`, `evals/v2`, the Claude plugin's hooks, the context library (content is hand-written; its copy is built and drift-checked) | Kept and tested, off the critical path. |
| **Peripheral** | Older eval trees, planning notes, reports, one-off scripts | Moved under `docs/history/` or `legacy/`, or removed once nothing references them. |

## What "healthy" means

`make check-core` must pass. It runs:

1. build the compiler and the CLI;
2. the drift gate: a real build, then no change to any generated file;
3. compiler tests (vitest) and CLI tests (`bun test`);
4. typecheck and lint of the compiler, typecheck of the CLI;
5. the change-detection tests that decide which CI gates run;
6. the installer flavor tests (`scripts/tests/test-flavor-install.sh`, bash).
7. a report-only scan for dead relative links in the top-level docs (`scripts/validation/check-doc-links.sh`).

`oac build` itself also reports degradation warnings, dead delegation references and lint
findings on the tree it is about to write. A lint error fails the build; warnings, dead
references and lint warnings are reported and fail only under `--strict`. Dead references and
lint findings should be zero.

## Adding to the core

- New agent: name it per [NAMING.md](NAMING.md); one file in `agent-library/agents/**`, then `make build-canonical`; steps in [agent-library/README.md](../../agent-library/README.md#the-workflow).
- New skill or command: a folder in `agent-library/skills/` or a file in `agent-library/commands/`, then `make build-canonical`; spec in [SKILLS-AND-COMMANDS.md](SKILLS-AND-COMMANDS.md), worked example in [agent-library/README.md](../../agent-library/README.md#skills-and-commands).
- New or changed context file: under `agent-library/context/`, then `make build-canonical`; a `components.json` entry makes it installable by `install.sh`; spec in [CONTEXT.md](CONTEXT.md).
- New host: one adapter in `packages/agent-compiler/src/adapters/` and one entry in the target
  tables in `core/`. Anything the host cannot express must produce a degradation warning.
- Never hand-edit a generated path from the table above. Hand-maintained v1 assets are edited in place.
