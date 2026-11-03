# Context library: who reads what

Step 4 of the canonical refactor moves the hand-edited context library out of `.opencode/context/`
and into `agent-library/context/`. This page is the inventory that decided how. Every claim carries
file:line evidence from the tree at `7220a37`. The design is at the end; the implemented result is
described in [CONTEXT.md](CONTEXT.md).

## What the library is today

| Fact | Evidence |
| --- | --- |
| 275 regular files plus 3 symlinks under `.opencode/context/`; 274 are Markdown, one is `core/config/paths.json` | `git ls-files .opencode/context` is 278; `find -type f` is 275 |
| Hand-edited, no generator | `.oac/build-manifest.json` has no `context` entry; `docs/architecture/CORE.md` lists context under "Supporting" |
| Files carry no frontmatter (2 of 274 do); the header is an HTML comment `<!-- Context: core/navigation \| Priority: critical \| Version: 1.0 \| Updated: ... -->` | `.opencode/context/navigation.md:1` |
| The 3 symlinks are legacy aliases: `core/standards/code.md -> code-quality.md`, `docs.md -> documentation.md`, `tests.md -> test-coverage.md` | `ls -la .opencode/context/core/standards/` |
| `plugins/claude-code/context` is a directory symlink to `../../.opencode/context` (git mode 120000), **not a copy and not a subset** | `git ls-files -s plugins/claude-code/context`; `docs/architecture/canonical-refactor/09-MERGE-RULES.md:283` |
| Only 189 of the 275 files are registered (192 registry entries; `code-quality`/`standards-code`, `test-coverage`/`standards-tests`, `documentation`/`standards-docs` share a path). 86 are unregistered: 41 sub-folder `navigation.md` files and 45 content files (`index.md`, `CODEBASE_STANDARDS.md`, `openagents-repo/lookup/*`, ...) | `built-ai-configs/registry/registry.json` `components.contexts` against the file list |
| Registry metadata (id, name, description, tags, dependencies, category, aliases) is hand-written and not derivable from the file | `registry.json` contexts, e.g. id `essential-patterns` for `core/essential-patterns.md` |

## 1. Installers and CLI

| Reader | What it does with context | Evidence |
| --- | --- | --- |
| `install.sh` | Installs only **registered** contexts. A profile lists `context:<id>` or `context:<dir>/*`; wildcards match registry `path` prefixes `.opencode/context/<prefix>`. Each file is fetched from `${RAW_URL}/<registry path>` and written to `<install dir>/<path minus .opencode/>`. | `install.sh:652-676` (id and path-form lookup), `:715-725` (wildcard), `:704-713` (`get_install_path`), `:1553` (fetch) |
| `install.sh`, non-local install dirs | Rewrites the literal string `.opencode/context` (and `@.opencode/context/`) inside every downloaded file to the real install path. The source files must therefore keep the literal `.opencode/context` text; a build that rewrites paths would break this. | `install.sh:1513-1514`, `:1565-1567` |
| `update.sh` | Does not read the registry for content. It scans the installed tree for `*.md`, `*.ts`, `*.sh` and re-fetches each from `${REPO_URL}/.opencode/<relative path>` (v1 first tries `built-ai-configs/opencode-v1/<relative path>`). **The committed `.opencode/context/**` is the upgrade source for every existing install.** | `update.sh:326`, `:617`, `:626`, `:635` |
| `oac init` (CLI) | `full` installs the bundle itself: every file under `.opencode/{agent,command,context,skills}` (symlinks skipped). Other profiles resolve `context:` refs against the registry, then add the navigation spine (root `index.md`, `navigation.md`, `core/config/paths.json` and every `navigation.md` between a file and the root). | `packages/cli/src/lib/bundled.ts:30-37` (subdirs), `:170` (symlinks skipped); `commands/init.ts:94-115`; `lib/registry.ts:24-30`, `:161-187` |
| CLI v1 flavor | Context is shared with v2: `listBundledFiles` takes `.opencode/context` for both and only overlays `built-ai-configs/opencode-v1/{agent,command,plugin,plugins,skills,tool}`. **There is no per-flavor context.** | `bundled.ts:229-246`; v1 registry contexts equal the v2 ones |
| CLI `update`, `list`, `status`, `doctor` | `update` re-resolves the same file lists. `list` and `status` count context files on disk that OAC does not own. `doctor` requires `.opencode/context/navigation.md` and, for Claude discovery, `.oac.json` with `context.root` exactly `.opencode/context`. | `commands/update.ts:50-57`; `commands/list.ts:29-90`; `lib/doctor-checks.ts:33-37`, `:74-132` |
| `oac init` Claude pointer | Writes `.oac.json` `{"version":"1","context":{"root":".opencode/context"}}`. | `commands/init.ts:235-254` |
| npm package | Root `package.json` `files` ships `.opencode/context/` and `docs/guides/context-system.md` (the end-user guide, formerly `CONTEXT_SYSTEM_GUIDE.md` at the repo root); `packages/cli/package.json` `files` is only `dist` (the bundle is resolved from the root package). `.npmignore` excludes `evals/` etc. and nothing under context. | `package.json` `files`; `packages/cli/package.json:12`; `.npmignore`; `__tests__/package-contents.test.ts:66-69` |

## 2. Registries and profiles

- `components.contexts` is **hand-maintained and carried through** by `RegistryEmitter` (every category the canonical tree does not own is copied from the committed file). Both registries hold the identical 192 entries, all with `.opencode/context/...` paths. `RegistryEmitter.ts:20-26, 95-110`, `:438-447`.
- Profile refs are by **id or directory wildcard**, never by file list: `agent-library/profiles/context/{core,engineering,essentials,business,meta-authoring}.json`, composed by `agent-library/profiles/system/*.json` through `contextProfiles`. Wildcards used: `core/*`, `development/*`, `ui/*`, `project-intelligence/*`. `ProfileLoader.ts:108-109, 328-352`; `ReferenceResolver.ts:54-55, 220-277`.
- Because wildcards are directory prefixes over registry paths, **moving a top-level folder changes what a profile installs** unless the registry and profiles are rewritten in the same step.
- The registry also carries `retired` (hash-based removal) but only for `.opencode/{agent,command,skills}/**`; there is no context equivalent, and `supersedes` is `agent/*.md` only. A context file that moves leaves its old installed copy behind. `docs/architecture/SKILLS-AND-COMMANDS.md` (Upgrades), `RetiredFiles.ts`.
- `scripts/registry/auto-detect-components.sh:147,478,626` can append contexts to the registry by hand-dispatched workflow (`.github/workflows/update-registry.yml`, manual only).

## 3. The runtime path: how agents and skills find context

Installed destination per host:

| Host / install route | Context lands at | Evidence |
| --- | --- | --- |
| OpenCode, `install.sh` or `oac init` (project) | `.opencode/context/` | `get_install_path`; `CONTEXT_PREFIX` in `init.ts:53` |
| OpenCode, global install | `<install dir>/context/` (default `~/.config/opencode/context`); `.opencode/context` strings are rewritten at install | `install.sh:1513`; `.opencode/context/core/config/paths.json` |
| Claude Code plugin, `/oac:install-context` (`install-context.sh/.js/.ts`) | **`.claude/context/`** (project) or `~/.claude/context/` (global), copied from a sparse clone of GitHub `main` at `.opencode/context/<category>` plus `navigation.md`; writes `.oac.json` `context.root=".claude/context"` and `.claude/.context-manifest.json` | `plugins/claude-code/scripts/install-context.sh:13, 90-110, 188-198, 234-237`; `install-context.js:20, 95-113`; `install-context.ts:20, 129, 168` |
| Claude Code via `oac init` + `oac apply claude` | `.opencode/context/`, with `.oac.json` pointing at it | `init.ts:235-254`; `doctor-checks.ts:33` |
| Claude plugin fallback (no project context) | `{PLUGIN_ROOT}/context`, which is the symlink into the repo's `.opencode/context` | `agent-library/skills/context-discovery/context-discovery-protocol.md:44-55`; `plugins/claude-code/context` |

Discovery order the context-scout and `context-discovery` skill use: `.oac.json` `context.root`, then
`.claude/context`, `context`, `.opencode/context`, `~/.claude/context`, `{PLUGIN_ROOT}/context`
(`agent-library/agents/core/context-scout.md:95`, `context-discovery-protocol.md:11-71`).
`plugins/claude-code/hooks/session-start.sh:26-30` only checks for `.claude/.context-manifest.json`.
The hooks never read a context file.

Hardcoded `.opencode/context/...` text in canonical sources (all copied verbatim into every host):

| Source | Files | Occurrences |
| --- | --- | --- |
| `agent-library/agents/**` | 11 | 109 |
| `agent-library/skills/**` | 14 | 55 |
| `agent-library/commands/**` | 9 | 61 |
| `agent-library/profiles/**` | 0 | 0 |

`.claude/context` appears 14 times in `agent-library` (context-setup, context-discovery, context-scout,
context-manager, parallel-execution, task-breakdown, code-review, code-execution, test-generation).
Path-existence check (a throwaway script over those references; see [CONTEXT.md](CONTEXT.md) for the
permanent lint): 45 distinct paths resolve; 14 do not. Of the 14, all but five are documentation
placeholders (`{category}/{file}.md`, `security/auth-patterns.md`, `core/story-mapping/guide.md`,
`legacy/old-patterns.md`) already whitelisted in `scripts/validation/markdown-link-skip-patterns.txt:17-24`.
The real dangling ones, present before this step, are in the `prompt-enhancer`/`prompt-optimizer`
commands: `core/context-discovery.md`, `core/examples.md`, `core/session-management.md`,
`core/specifications.md`, `core/prompt-optimization-report.md`.

**Conclusion for the runtime question: `.opencode/context/**` must stay the installed destination
and the repository's committed copy.** Four independent consumers depend on that exact repo path and
install path: `update.sh:326` (raw fetch), the Claude `install-context.*` scripts (sparse clone of
`main`), `install.sh` global rewriting, and ~225 hardcoded references in canonical sources.

## 4. `plugins/claude-code/context` and `.context-manifest.json`

- `plugins/claude-code/context` is a **symlink**, not a copy. It is the same 275 files plus 3
  symlinks, so it is neither a subset nor divergent. No per-file `targets` is needed today.
- Whether a marketplace install (`source: ./plugins/claude-code`, `.claude-plugin/marketplace.json`)
  dereferences a symlink that points above the plugin folder is **not verified**. It is the reason the
  discovery protocol has the `{PLUGIN_ROOT}/context` fallback at the end of the chain rather than the
  start. Left unchanged by this step.
- `plugins/claude-code/.context-manifest.json` (profile `standard`, commit `1442740`, 2026-02-23) and
  `plugins/claude-code/scripts/.context-manifest.json` (profile `essential`, commit `5f49916`,
  2026-02-16, absolute local paths) are **install records accidentally committed**. Nothing reads them:
  the hook reads `.claude/.context-manifest.json` in the user's project. Candidates for deletion by the
  maintainer; not touched here (they are not context content and the plugin tree is held byte-stable).

## 5. CI, scripts and validation that scan the library

| Item | What it does | Evidence |
| --- | --- | --- |
| `scripts/validation/validate-markdown-links.ts` (`pnpm validate:context-links`, `validate-registry.yml:79-80`) | Scans `.opencode/{agent,skills,command,context}` for dead links and paths. Baseline: exits 1 with 10 broken references in `.opencode/agent/system-builder.md`, `architecture-analyzer.md`, `repo-manager.md`; **0 in context**. Pre-existing and outside `make check-core`. | `validate-markdown-links.ts:9-14`; run at `7220a37` |
| `scripts/validation/validate-context-refs.sh` | Requires `@.opencode/context/{category}/{file}.md` form; scans `.opencode/context`. | `:33-129` |
| `scripts/registry/validate-registry.{ts,sh}`, `check-dependencies.ts`, `validate-profile-coverage.sh` | Check registry paths exist and `context:` dependency refs resolve. `check-dependencies.ts:84-86` hardcodes three context paths. Baseline passes (249/249). | `validate-registry.ts:252-260` |
| `scripts/tests/test-{flavor-install,e2e-install,installer-files,collision-detection}.sh` | Offline install tests; they read registry context paths and seed `.opencode/context/index.md` fixtures. `test-flavor-install.sh` is part of `make check-core`. | `test-flavor-install.sh:297-413` |
| `.github/workflows/sync-docs.yml:9-11,70` | Triggers on `.opencode/{agent,command,context}/**`. | |
| `.github/workflows/packages-checks.yml:14-30`, `scripts/validation/detect-pr-changes.ts:43-55` | Decide whether the drift gate runs. Cover `agent-library/**` and `.opencode/{agent,skills,command}` but **not `.opencode/context/**`**. | |
| `scripts/validation/check-build-drift.sh` | `GENERATED=(...)` list does not include context. | `:41` |
| `Makefile` `check-core` | No context-specific step. | `Makefile:178-197` |
| `.oac/build-manifest.json` | Ledger; 275 entries today (agents, skills, commands, registries, README), none for context. | |

## 6. Evals and docs

- `evals/` has 271 references to `.opencode/context/...` (198 under `core/`, 50 under `openagents-repo/`);
  `evals/framework/src/evaluators/context-loading-evaluator.ts:60-73` expects the three symlink names
  (`standards/code.md`, `docs.md`, `tests.md`), which is why the symlinks must survive.
- `docs/` (outside `docs/history/`) has 65 references; `README.md` documents the discovery order and
  `.opencode/context/project*` as the team-owned slot (`README.md:222, 291-300, 499-519, 724`).
- `docs/guides/context-system.md` (formerly `CONTEXT_SYSTEM_GUIDE.md` at the repo root, 700+ lines) is the end-user guide, listed in the npm `files` (re-included in `.npmignore`).
- User-owned content lives **inside** the shipped tree: `project-intelligence/` and `project/` are
  where users put their own files (`README.md:510-519`). The CLI treats files it does not own as the
  user's (`list.ts:74-90`), and `oac update`/`install.sh` skip-or-backup on edited files.

## Findings that shaped the design

1. The repository's `.opencode/context/**` is not just a mirror target, it is the **distribution
   endpoint** (raw URL for `update.sh`, sparse-clone source for the Claude scripts, npm bundle root).
2. The installed destination is already `.opencode/context` for every OpenCode route and the CLI
   Claude route; only the Claude plugin script uses `.claude/context`, and it fetches the same repo path.
3. Registry metadata is separate from file content, so the registry cannot be derived from the files.
4. `install.sh` and `oac init` install **different** context sets for one profile (the CLI adds the
   navigation spine; `install.sh` does not). Pre-existing, preserved by this step.
5. A folder rename is a breaking change for installed copies (no context `supersedes`/`retired`) and
   for ~1,100 hand-written references (197 inside the library, 393 in scripts, tests and root files,
   174 in canonical sources, 65 in docs, 271 in evals; `core/` alone is 119 + 276 + 133 + 28 + 198).

## Recommended design

Your expected design holds. The evidence does not argue for anything different, only for two
additions.

1. **Source of truth: `agent-library/context/`**, mirroring today's layout 1:1, with
   `agent-library/context/components.json` carrying the registry metadata of the 192 registered entries
   (keyed by the file's path inside the library). Files are copied **verbatim**: they have their own
   headers, and `install.sh` rewrites their paths at install time.
2. **Build copies, never rewrites**, to `.opencode/context/**` through the same ledger, drift and prune
   machinery as skills. One output root, no `built-ai-configs/<host>/context` (installers use
   `.opencode/context` for v1 and v2, so a per-flavor copy would be dead weight). The Claude plugin keeps
   its directory symlink, so the plugin tree is byte-identical without a second copy.
3. **Symlinks are first-class in the build** (the three aliases): emitted as symlinks, ledgered by
   target, drift-checked with `readlink`. Writing "content" through a symlink would overwrite its
   target, so the writer must treat them explicitly.
4. **RegistryEmitter generates `components.contexts`** from `components.json` with the identical shape
   and order, and the build reports registry entries whose file is missing, and files neither registered
   nor reachable from a `navigation.md` (report-only).
5. **No re-taxonomy in this step.** Moving `core/` or `openagents-repo/` would change profile
   wildcards, break `update.sh` for installed files (no context `supersedes`), orphan user installs and
   invalidate ~1,100 references. The proposed taxonomy and an exact mapping table are in
   [CONTEXT.md](CONTEXT.md#recommended-follow-up-re-taxonomy), gated on a context `previousPaths`
   mechanism that does not exist yet.
