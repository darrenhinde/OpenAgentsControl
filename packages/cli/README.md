# oac CLI

`oac` has two jobs: **install and maintain** OAC agents and context in a project (`init`, `add`,
`remove`, `update`, `doctor`, `apply`, `list`, `status`), and **build** this repo's generated
trees (`build`). Every flag below comes from `oac <command> --help`.

## Run it from a checkout

```bash
make oac-cli                          # builds agent-compiler, then the CLI -> packages/cli/dist/index.js
bun packages/cli/dist/index.js --help
node bin/oac.js --help                # same CLI through the Node shim (needs the build above)
```

The root `README.md` shows the `npm i -g` route; the package name is not final.

## Commands

| Command | What it does | Flags |
| --- | --- | --- |
| `oac init` | Install into the current project (`.opencode/`, record in `.oac/`) | `-p, --profile <id>` (essential, developer, business, advanced, full; default essential), `--context-only`, `--opencode <v1\|v2>`, `--list-profiles`, `--yolo`, `--dry-run`, `--verbose` |
| `oac add [ref]` | Add one component, e.g. `oac add context:react-patterns` | `--force`, `--dry-run`, `--yolo`, `--verbose` |
| `oac remove [ref]` | Remove an installed component | `--dry-run`, `--yolo`, `--verbose` |
| `oac update` | Refresh OAC-owned files; files you edited are skipped | `--dry-run`, `--check` (same as `--dry-run`), `--yolo` (back up your edits, then overwrite), `-p, --profile <id>`, `--opencode <v1\|v2>`, `--verbose` |
| `oac doctor` | Check the setup, including that the recorded OpenCode version matches `opencode --version` | `--verbose`, `--json` |
| `oac apply [ide]` | Write Claude Code agent files to `.claude/agents/<name>.md`: the compiled Claude agents (same files as `plugins/claude-code/agents`) for each installed agent that has one. Agents with no Claude build (excluded from Claude Code) fall back to a lossy conversion with a warning | `--all`, `--dry-run`, `--verbose`, `--yolo` |
| `oac list` | List installed components | `--type <agent\|context\|skill\|config\|other>`, `--agents`, `--context`, `--skills`, `--verbose` |
| `oac status` | One-screen summary of the install | `--verbose` |
| `oac build` | Maintainers: compile `agent-library/{agents,skills,commands}/**` into `built-ai-configs/**` | `--target <tool...>` (opencode, opencode-v1, claude-code), `--check`, `--dry-run`, `--strict`, `--no-prune`, `--verbose`, `--json` (reserved) |

`oac build` reads `agent-library/` from the current directory, so run it at the repo root.
`--check` exits 1 on drift; a build or lint error exits 1; `--strict` also fails on warnings.
Authoring guide: [agent-library/README.md](../../agent-library/README.md).

## OpenCode v2 by default, v1 on request

```bash
oac init                     # v2
oac init --opencode v1       # explicit v1
oac update --opencode v1|v2  # switch, or record the choice on an older install
```

v1 is never inferred from the host. Details: [docs/features/opencode-v1-and-v2.md](../../docs/features/opencode-v1-and-v2.md).

## How `install.sh` and `update.sh` relate

They install the same files from the same registry (`built-ai-configs/registry/registry.json`, or
`registry.v1.json` for v1) without needing Node. The CLI additionally tracks hashes in
`.oac/manifest.json`, which is what lets `oac update` skip your edits.

| Record | Written by | Holds |
| --- | --- | --- |
| `.oac/config.json` | the CLI | `"opencode": {"target": "v1"}` |
| `.opencode/.oac-opencode` | `install.sh`, `update.sh` and the CLI | `v1` or `v2` |

The CLI writes both and keeps them in step. If they disagree, **`.oac/config.json` wins**
(`resolve_flavor` in `update.sh` reads it first, then the marker, then defaults to v2).
Passing `--opencode` to a command overrides both. `install.sh --opencode v1|v2` and
`OAC_OPENCODE` mirror the CLI flag.

## Development

```bash
pnpm --dir packages/cli run build       # bun build -> dist/index.js
cd packages/cli && bun test
pnpm --dir packages/cli run typecheck   # or `make check-core` for everything
```
