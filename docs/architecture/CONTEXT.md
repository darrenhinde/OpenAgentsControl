# The context library

The context library is the knowledge OAC ships next to its agents: standards, workflows, guides and
lookups that agents read at runtime (`core/standards/code-quality.md`, `openagents-repo/guides/...`).
Like agents, skills and commands, it is authored once in `agent-library/` and the build puts it where
every host and installer expects it. Unlike them it is **copied, never compiled**: a context file has
its own header (`<!-- Context: ... -->`), and `install.sh` rewrites the literal text `.opencode/context`
inside it at install time, so the build never changes a byte.

The inventory that led to this design, with evidence, is [CONTEXT-MAP.md](CONTEXT-MAP.md). Code:
`packages/agent-compiler/src/core/ContextLoader.ts`, the context parts of `BuildPipeline.ts` and
`RegistryEmitter.ts`, and `verify/lint/context.ts`.

## Layout

```
agent-library/context/
  components.json            registry metadata for the registered files (not shipped)
  index.md  navigation.md    the root of discovery
  core/  openagents-repo/  development/  ui/  content-creation/  project-intelligence/ ...
```

Every regular file under `agent-library/context/` ships at the same relative path, except
`components.json`. `.git/`, `node_modules/` and `.DS_Store` are skipped; every other file, dotfiles
included, ships. The layout is today's `.opencode/context/` layout, unchanged (see
[Re-taxonomy](#recommended-follow-up-re-taxonomy) for why).

**Symlinks are first-class.** `core/standards/{code,docs,tests}.md` are relative links to
`code-quality.md`, `documentation.md` and `test-coverage.md`, kept because the eval framework expects
those names. The loader requires a symlink to be relative and to point at a regular file inside the
library; the build creates the link, the ledger records the target, and the drift check compares
`readlink`. The writer never writes through a link, and replaces a file with a link (or the reverse)
instead of following it.

## Output

| What | Where | Why |
| --- | --- | --- |
| Verbatim copy of the library | `.opencode/context/**` (generated, ledgered, pruned, drift-checked) | The one installed location on every OpenCode route and the repo's raw URL for `update.sh`, the Claude `install-context.*` scripts and the npm bundle |
| OpenCode v1 | the same files | v1 and v2 share `.opencode/context`; the v1 registry lists the same paths |
| Claude Code plugin | `plugins/claude-code/context`, a directory symlink to `../../.opencode/context`, **unchanged** | Already the plugin's way to ship the same tree; the plugin tree stays byte-identical |
| `built-ai-configs/<host>/context` | none | Installers never read one; a third copy of 275 files would be dead weight |

The copy belongs to the `opencode` build target in the ledger (`assetKind: "context"`, `assetId` the
path inside the library, `root: ".opencode/context"`). A build over `--target claude-code` alone does
not touch it. Because only ledgered files are ever pruned, a file you add by hand to `.opencode/context/`
is never deleted, but the drift gate (which compares git status before and after a build) will not
treat it as drift either; do not put hand-written files there. Edit `agent-library/context/` instead.

## `components.json`

The registry's `components.contexts` is generated from this file. The metadata cannot come from the
Markdown (context files have no frontmatter, and ids such as `essential-patterns` are not derivable from
paths), so it sits next to the library:

```json
{
  "version": 1,
  "components": [
    {
      "id": "essential-patterns",
      "name": "Essential Patterns",
      "file": "core/essential-patterns.md",
      "description": "Core development patterns and best practices",
      "tags": ["patterns", "best-practices", "guidelines"],
      "dependencies": [],
      "category": "essential"
    }
  ]
}
```

- `file` is the path inside the library; the registry `path` is `.opencode/context/<file>` in both registries.
- Optional: `aliases`, `dependencies`. `id` and every alias are unique across the file. A listed file must exist.
- **The array order is the registry order.** It is curated, not sorted, and the generated section is
  byte-identical to the hand-written one it replaced (the build leaves `registry.json` and
  `registry.v1.json` unchanged).
- Once the library declares any component the section is fully owned: nothing is carried over from the
  committed registry. A library with none keeps the carry-through, so a tree without a library still builds.
- Three paths have two ids each (`standards-code` and `code-quality`, and so on). That is existing
  behaviour; the aliases `workflows-task-breakdown`, `workflows-sessions` and `workflows-component-planning`
  are the registry's `aliases`.
- A file with no entry still ships through `oac init --profile full` (the whole bundle), the Claude
  install scripts and the repository, but no `install.sh` profile installs it. 86 files are in that state
  today (41 sub-folder `navigation.md` files, which the CLI adds as a spine, and 45 content files).

Profiles are unchanged: `agent-library/profiles/context/*.json` list registry ids or directory globs
(`core/*`), resolved against the registry the build is about to write.

## Lints (report-only)

`oac build` prints these after the summary; they are not counted and never change the exit code.

| Rule | Checks |
| --- | --- |
| `navigation-dead-entry` | a backticked `.md` name in a `navigation.md` (read relative to the file, then to the library root) that is not in the library |
| `dead-link` | a Markdown link, or a literal `.opencode/context/<path>`, in any context file whose target is not in the library |
| `unreachable` | a Markdown file no chain of references from `navigation.md` or `index.md` reaches (`--verbose` lists them) |
| `unregistered` (info) | a Markdown file with no `components.json` entry (`--verbose` lists them) |

Documentation placeholders (`{category}/{file}.md`, `<name>`, the examples in `PLACEHOLDER_TARGETS`) are
skipped. Baseline at the move: 28 dead navigation entries, 2 dead links, 98 unreachable and 86
unregistered files; `tests/unit/build/context-corpus.test.ts` pins an upper bound so none can be added.

The same test is the **runtime path check**: every `.opencode/context/<path>` and `.claude/context/<path>`
named by an agent, skill or command in `agent-library/` must exist as a regular file in the library, which is
what a `full` install holds (the three legacy symlinks are not installed by `oac init` or `install.sh`). 13 paths
were already dangling and are listed in the test: documentation examples, stale names, and
`core/standards/{code,tests}.md`, which the `context-retriever` agent and the `test-generation` skill name but only
a repository checkout has (they should say `code-quality.md` and `test-coverage.md`). Fix one and delete it from
the list; never add one.

## Upgrades and compatibility

Nothing moves for an installed project. Every registered path is installable at the same location, so
`install.sh`, `update.sh`, `oac init`, `oac update`, `oac doctor`, the Claude `/oac:install-context`
scripts and every hardcoded `.opencode/context/...` reference behave as before. Edited and custom context
files are handled by the existing skip/backup rules; the build does not touch installs.

## Changing the library

1. Edit or add files under `agent-library/context/` (use `git mv` / `git rm`).
2. To make a new file installable by `install.sh` and profiles, add a `components.json` entry; to ship it
   in a tier, add its id or a glob to `agent-library/profiles/context/*.json`.
3. `make build-canonical`, commit the source and the generated `.opencode/context/**`, registries and ledger together.
4. `make check-core`.

Never edit `.opencode/context/**`: the drift gate fails on it, as for the other generated trees.

## Recommended follow-up: re-taxonomy

**Not done in this step, deliberately.** The top level is uneven (`core/` 88 files, `openagents-repo/` 88,
`development/` 34, `ui/` 30, then seven folders of 2 to 17) and mixes kinds (`core/` holds standards,
workflows, the context-system manual and config). A better taxonomy exists. The evidence says do not
reshuffle in the same step as the source move:

- ~1,100 hand-written references name these paths: 197 inside the library, 393 in scripts, tests and docs,
  174 in canonical agents/skills/commands, 65 in docs,, 271 in evals (counted by a throwaway script over tracked files, excluding `docs/history/`, generated trees and eval results).
- Profile wildcards (`core/*`, `development/*`, `ui/*`, `project-intelligence/*`) are directory prefixes
  over registry paths; a move silently changes what a profile installs.
- An installed copy of a moved file is orphaned and duplicated: there is no `supersedes` or `retired`
  mechanism for context files (both are limited to `.opencode/{agent,command,skills}`), and `update.sh`
  would 404 on the old name.
- `project-intelligence/` and `project/` are where users keep their own files, and `core/config/paths.json`
  is named in the CLI's navigation spine (`registry.ts:26-30`) and in agent `@` references.

Prerequisites for the move, in order: (1) context `supersedes`/`previousPaths` in the registry, honoured by
`install.sh`, `update.sh`, `oac init/update/doctor` (same containment as retired files); (2) a reference
rewriter with a dead-link gate (this step's lint is the gate); (3) profile wildcards and `components.json`
rewritten in the same change; (4) one release of redirect stubs or aliases for `core/config/paths.json`
and the three legacy symlinks.

### Proposed mapping (file counts include the 3 symlinks; the total is 278)

| From | To | Files |
| --- | --- | ---: |
| `core/standards/**` | `standards/**` | 14 |
| `core/essential-patterns.md` | `standards/essential-patterns.md` | 1 |
| `development/principles/**` | `standards/principles/**` | 3 |
| `CODEBASE_STANDARDS.md` | `standards/codebase-standards.md` | 1 |
| `core/workflows/**` | `workflows/**` | 29 |
| `core/task-management/**` | `workflows/task-management/**` | 9 |
| `core/guides/**` | `workflows/guides/**` | 2 |
| `core/visual-development.md` | `workflows/visual-development.md` | 1 |
| `core/system/**` | `system/**` | 3 |
| `core/config/**` (incl. `paths.json`) | `system/config/**` (keep a stub at the old path for one release) | 2 |
| `core/context-system/**`, `core/context-system.md` | `system/context-system/**` | 26 |
| `system-builder-templates/**` | `system/builder-templates/**` | 4 |
| `core/navigation.md` | folded into the new root `navigation.md` | 1 |
| `development/**` (the rest) | `domains/development/**` | 31 |
| `ui/**` | `domains/ui/**` | 30 |
| `content-creation/**` | `domains/content-creation/**` | 17 |
| `data/**`, `learning/**`, `product/**` | `domains/{data,learning,product}/**` | 6 |
| `openagents-repo/**` | unchanged (repo-specific, 88) | 88 |
| `project/**`, `project-intelligence/**` | unchanged (user-owned slots) | 8 |
| `index.md`, `navigation.md` | unchanged (root of discovery) | 2 |

Result: seven top-level folders (`standards`, `workflows`, `system`, `domains`, `openagents-repo`, `project*`)
instead of eleven, the largest at about 90 files, and no folder that mixes kinds.
