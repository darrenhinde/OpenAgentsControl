# 04 — CLI, Build Pipeline & Distribution

> **Current state (2026-09-02):** This build/distribution analysis is historical. The active metadata workflow is canonical `content/agents/**` `oac:` blocks emitted by RegistryEmitter; sidecar metadata and sidecar merging are superseded.

> **Owner:** Agent D
> **Status:** Specification (no implementation)
> **Scope:** The `oac` npm CLI, the neutral-source → per-tool **build pipeline**, full
> `install.sh`/`update.sh` **parity**, and cross-platform npm **distribution**.
> **Reads-from:** `01-feature-inventory.md` (must-survive list), `02-canonical-schema.md`
> (the IR this CLI parses), `03-adapter-specs.md` (the transforms `oac build` invokes).

This document specifies the CLI that **replaces** `install.sh` (1510 lines, 35 functions)
and `update.sh` (344 lines). Both bash scripts are **deleted** per the locked decisions in
`00-INDEX.md`. Nothing they do may be lost — §3 is the line-by-line parity contract.

---

## 0. Context: what exists today vs. what must change

### 0.1 What is already built (extend, do not reinvent)

| Asset | Location | Reuse |
|-------|----------|-------|
| CLI entry | `packages/cli/src/index.ts` + `bin/oac.js` wrapper | Keep; add `build`, `remove` already exists |
| Commands | `commands/{init,add,update,apply,doctor,list,status}.ts` | Keep all; `apply` becomes an alias/subset of `build` |
| Install engine | `lib/installer.ts` (`installFiles`, `updateFiles`, sha256 decide-logic) | Keep — this is the collision/update strategy engine |
| Manifest | `lib/manifest.ts` → `.oac/manifest.json` (per-file sha256) | Keep — replaces install.sh collision detection |
| Config | `lib/config.ts` → `.oac/config.json` (yoloMode, autoBackup) | Keep |
| Bundled files | `lib/bundled.ts` (`getPackageRoot`, `listBundledFiles`) | **Rework** to bundle `/content` not `.opencode/` |
| Registry | `lib/registry.ts` (Zod-validated `registry.json`) | Keep; extend for profiles + dependency resolution |
| IDE detect | `lib/ide-detect.ts` | Keep; feeds `--target` auto-detection |
| Adapters | `packages/compatibility-layer/{adapters,core,mappers}` | The engine `oac build` drives |

### 0.2 The three structural changes this refactor forces on the CLI

1. **Source flips.** Today `installFiles`/`bundled.ts` copy `.opencode/**` verbatim into the
   user's project. After the refactor, the bundle is **`/content`** (tool-neutral), and
   `.opencode/` is a **generated build target** — so a plain copy is no longer enough for
   OpenCode users. `oac init` for a tool now means **install `/content` + build the target**.
2. **`apply` generalises into `build`.** `commands/apply.ts` already does
   `loadAgents → adapter.fromOAC → write` for Cursor/Claude/Windsurf. `oac build` is that
   pipeline, promoted to a first-class command, reading `/content` (not `.opencode/agent/`)
   and adding OpenCode as just another target (§1, §2).
3. **Runtime must be Node-portable.** `bin/oac.js` currently `execFileSync('bun', …)` and the
   whole CLI uses Bun-only APIs (`Bun.file`, `Bun.write`, `import.meta.dir`). A user running
    `npm i -g @controlstack/oac` will **not** have Bun. This is the single biggest cross-platform
   install blocker and is resolved in §4.1.

---

## 1. Command spec

Global conventions (all commands):

- **Flags:** `--dry-run` (plan only, no writes), `--verbose`, `--yolo` (backup + overwrite
  user-modified files), `--json` (machine output where meaningful), `-v/--version`, `-h/--help`.
- **Project root** = `process.cwd()`, validated by `isProjectRoot()` (has `package.json` or `.git`).
- **State files:** `.oac/manifest.json` (sha256 ledger), `.oac/config.json` (prefs),
  `.oac/backups/{ISO-timestamp}/…` (yolo/backup copies).
- **Exit codes:** `0` success (warnings allowed), `1` hard error. `--dry-run` never writes.

### 1.1 `oac init` — set up a project (EXTENDED)

Set up OAC in the current project: install neutral `/content` and generate the chosen target(s).

| Aspect | Spec |
|--------|------|
| **Args** | none |
| **Flags** | `--target <tool...>` (opencode\|claude\|cursor\|windsurf; repeatable; default = auto-detect via `ide-detect`, fallback `opencode`), `--profile <name>` (essential\|developer\|business\|full\|advanced; default `essential`), `--global` (install to user-global location, §4.2), `--dir <path>` (explicit install dir; replaces `install.sh --install-dir`), `--no-build` (install `/content` only, skip target generation), `--yolo`, `--dry-run`, `--verbose` |
| **Reads** | bundled `/content/**` + `registry.json` from package root; existing `.oac/manifest.json` (if re-init) |
| **Writes** | `content/**` (neutral source, tracked in manifest) + target output (e.g. `.opencode/**`, `CLAUDE.md`, `.cursorrules`) + `.oac/manifest.json` + `.oac/config.json` (only if absent) |
| **Behavior** | 1) assert project root; 2) resolve profile → component set + **dependency closure** (§2.3); 3) resolve install location (§4.2); 4) print plan (files, targets, location) + collision preview; 5) `installFiles(profileFiles)` into `content/`; 6) unless `--no-build`, run **build pipeline** (§2) for each `--target`; 7) write manifest + config; 8) summary. `CI=true` implies `--yolo` (already implemented). |

Replaces: `install.sh` interactive location menu + main menu + profile menu + preview + install.

### 1.2 `oac add <ref>` — add one component (EXTENDED with deps)

| Aspect | Spec |
|--------|------|
| **Args** | `ref` = `<type>:<id>` (e.g. `agent:code-reviewer`, `context:security`, `skill:task-management`). No arg → list available components grouped by type (current behavior). |
| **Flags** | `--target <tool...>` (rebuild these targets after add; default = targets already present per manifest), `--force` (reinstall if present), `--no-deps` (skip dependency resolution — **new**), `--dry-run`, `--yolo`, `--verbose` |
| **Reads** | `registry.json`, bundled `/content`, manifest |
| **Writes** | component file(s) into `content/**` (skills copy their `files[]` array — already supported by registry `files`), manifest entry per file, then re-build affected targets |
| **Behavior** | resolve ref → component; **resolve dependencies recursively** (§2.3) unless `--no-deps` (this is a parity gap — `install.sh resolve_dependencies` exists, current `add.ts` does not resolve); wildcard context refs (`context:core/*`) expand via registry (§2.3); copy files; update manifest; rebuild targets so the new component appears in generated output. |

Replaces: `install.sh` custom component selection + `resolve_dependencies` + `expand_context_wildcard`.

### 1.3 `oac remove <ref>` — remove a component (EXISTS)

| Aspect | Spec |
|--------|------|
| **Args** | `ref` = `<type>:<id>` (required) |
| **Flags** | `--target <tool...>` (rebuild after removal), `--dry-run`, `--verbose` |
| **Reads** | `registry.json`, manifest |
| **Writes** | deletes `content/**` file(s), removes manifest entry, rebuilds targets |
| **Behavior** | current impl already deletes file + updates manifest. **Add:** rebuild targets so generated output no longer references the removed component; warn if other installed components depend on it (reverse-dependency check via registry). |

### 1.4 `oac update` — update installed files (EXISTS, keep)

| Aspect | Spec |
|--------|------|
| **Args** | none |
| **Flags** | `--dry-run` / `--check` (alias), `--yolo`, `--verbose`, `--target <tool...>` (rebuild after content update) |
| **Reads** | manifest, bundled `/content`, config (picks up persisted `yoloMode`) |
| **Writes** | updated `content/**`, manifest, rebuilt targets |
| **Behavior** | `updateFiles()` algorithm (already built): per bundled file — in-manifest+hash-matches → safe update; in-manifest+hash-differs → skip (or `--yolo`: backup+overwrite); not-in-manifest → install. Files in manifest but no longer in bundle → drop from manifest, leave user copy, warn. **Add:** after content update, rebuild every target recorded in the manifest so generated output tracks the new source. |

Replaces: **all of `update.sh`** — and does it far better (sha256 protection of user edits vs. update.sh's blind curl-overwrite-with-backup).

### 1.5 `oac build` — generate tool output from neutral source (NEW)

The centerpiece of the refactor. Loads `/content`, parses to IR, runs the adapter, writes the
tool's file layout, validates the result.

| Aspect | Spec |
|--------|------|
| **Args** | `[target]` optional positional (e.g. `oac build opencode`) |
| **Flags** | `--target <tool...>` (repeatable; alternative to positional), `--all` (build every detected/known target), `--out <dir>` (override output root; default per-target convention), `--dry-run` (preview + diff, write nothing), `--verbose` (per-transform + degradation warnings), `--strict` (treat adapter warnings as errors → exit 1), `--check` (build to temp, diff against on-disk output, exit 1 if drift — for CI), `--json` |
| **Reads** | `content/**` (agents, skills, commands, context) + `registry.json` (dependency graph, ordering) + `.oac/config.json` |
| **Writes** | target-specific layout (from `03-adapter-specs.md`): opencode → `.opencode/agent/**` + `agent-metadata.json` sidecars + `.opencode/skills/**` + `.opencode/command/**` + `opencode.json`; claude → `agents/*.md` + `.claude-plugin/plugin.json` + wired `context/`; cursor → `.cursorrules`; windsurf → `.windsurfrules`. Each written file is added to the manifest with `source: "generated"` and its sha256. |
| **Behavior** | full pipeline in §2. Target selection: explicit `--target`/positional > `--all` > auto-detect via `ide-detect` > default `opencode`. Emits **degradation warnings** predicted by `CapabilityMatrix` (e.g. "temperature dropped for Claude") — never silent loss. |

`oac apply` (current) is retained as a **thin deprecated alias** → `oac build --target <ide>` for
Cursor/Claude/Windsurf, so existing muscle memory and docs keep working during migration
(migration detail owned by Agent E).

### 1.6 `oac doctor` — health check (EXISTS, extend)

Runs the 7 checks already implemented (Bun/Node runtime, config, manifest, files-on-disk,
sha256 modified-file detection, IDE detection, npm version vs latest). Extend with:
- **`/content` parse check** — every `content/**` agent/skill validates against the Zod IR (§2.1).
- **Build-drift check** — for each target in the manifest, is on-disk output in sync with a fresh
  build of current `/content`? (reuses `oac build --check`). Reports "run `oac build`".
- **Dependency check** — every installed component's `dependencies[]` are also present.
- Keep `--json` (CI) and exit `1` on errors.

Replaces: `install.sh check_dependencies` / `check_bash_version` (now a runtime check).

### 1.7 `oac status` — quick project summary (EXISTS)

Reads manifest + config + `ide-detect`. Prints component counts by type, modified-file count
(sha256 diff), detected IDEs, and installed targets. **Add:** show which targets are built and
whether they are stale relative to `/content`. Read-only, exit `0`.

### 1.8 `oac list` — list components (EXISTS, two modes)

- `oac list` (no manifest context) / `oac add` (no ref) → list **available** registry components
  grouped by type with `oac add <type>:<id>` hints.
- `oac list --installed` → list components tracked in the manifest (current `list.ts` behavior),
  filterable by `--type/--agents/--context/--skills`, showing install date + user-modified flag.

Replaces: `install.sh list_components`.

### 1.9 Command → target-selection summary

| Command | Touches `/content` | Runs build pipeline | Target selection |
|---------|:---:|:---:|------|
| `init` | install | yes (unless `--no-build`) | `--target` > auto-detect > `opencode` |
| `add` | install file | yes (affected targets) | manifest targets or `--target` |
| `remove` | delete file | yes (affected targets) | manifest targets or `--target` |
| `update` | update files | yes (all manifest targets) | manifest targets or `--target` |
| `build` | read only | **yes** | `--target`/positional > `--all` > auto-detect > `opencode` |
| `doctor`/`status`/`list` | read only | no (`--check` only) | — |

---

## 2. Build pipeline

`oac build` is a pure, deterministic function of `/content` + `registry.json` + target adapter.
Same inputs ⇒ byte-identical output (required for golden-snapshot tests and `--check` drift
detection). Stages:

```
/content/**                                                    packages/compatibility-layer
   │                                                                    │
   ▼                                                                    ▼
[1] LOAD ──► [2] PARSE→IR ──► [3] RESOLVE deps/order ──► [4] ADAPT ──► [5] BUNDLE context
                                                                          │
                                            [7] MANIFEST ◄── [6] WRITE ◄──┤
                                                    │                     │
                                                    └──► [8] VALIDATE ────┘
```

### Stage 1 — Load
Enumerate `content/{agents,skills,commands,context}/**`. Reuse the enumeration pattern from
`bundled.ts` (`collectFiles`), but rooted at `content/` and **skipping `node_modules/`** (issue
#308 — the current `listBundledFiles` already excludes it structurally; `oac build` must too, and
`update.sh`'s `-not -path "*/node_modules/*"` guard must survive here). Split frontmatter + body.

### Stage 2 — Parse to IR
Validate each file's frontmatter against the canonical Zod schema (`OpenAgentSchema` /
`02-canonical-schema.md`) via `compatibility-layer`'s `AgentLoader.loadAgents`. On invalid
frontmatter: collect a structured error with file path + Zod issue list, and **fail the file, not
the build** (partial builds are useful — mirrors `installer.ts` per-file error handling). `--strict`
promotes any parse warning to a build failure.

### Stage 3 — Resolve dependencies & order
Use `registry.json` `dependencies[]` to compute the transitive closure of what a target needs, and
a **stable topological order** so output is deterministic. This is where the neutral graph lives —
`resolve_dependencies` + `expand_context_wildcard` from `install.sh` move here as typed functions
(see §2.3). Cycles → reported error, not infinite recursion (the bash version could self-reference;
the TS version must guard with a visited-set).

### Stage 4 — Adapt (IR → tool)
Select the adapter from `AdapterRegistry` for the target and call `adapter.fromOAC(agent)` for each
agent (and the analogous skill/command transforms per `03-adapter-specs.md`). The adapter returns a
`ConversionResult` with `configs[]` (path + content) and `warnings[]`. `CapabilityMatrix` predicts
lossy transforms (temperature dropped for Claude, granular permissions flattened to a tool allowlist,
semantic tier resolved by project/adapter configuration or omitted for the tool default — **no
hardcoded models**, locked decision #2).
All warnings surface to the user; `--verbose` lists each, otherwise a count.

### Stage 5 — Bundle context
Context files referenced by an agent's `context[]` are copied/wired per target:
- **opencode** — context files copied under `.opencode/context/`, and path references rewritten.
  This is the home of `install.sh`'s global-path rewrite (`@.opencode/context/` →
  `@<install-dir>/context/`) — see §2.4. Metadata split into `agent-metadata.json` sidecars.
- **claude** — context copied into the plugin `context/`, wired via a session-start hook; contributes
  entries to `.claude-plugin/plugin.json`.
- **cursor/windsurf** — context inlined into the single rules file (size-limited; `apply.ts` already
  warns at 80KB / errors at 100KB for Cursor — that guard carries into `build`).

### Stage 6 — Write
`oac build` is a pure projection of canonical content and build configuration. It writes every
`config.path` under the target output root (or `--out`) through a temp directory followed by an
atomic replace. Existing generated files are replaced even when manually edited; generated output
is not an authoring surface. `--check` builds to a temp directory and fails on any diff, while
`--dry-run` prints that diff without writing.

The collision/update engine applies only when `init`, `add`, or `update` changes user-owned
canonical `content/` or custom files. Those commands skip user-modified source unless `--yolo`
(backup then overwrite). Keeping source-update safety outside `build` preserves both user edits and
the invariant that identical content/config always produces identical generated output.

### Stage 7 — Manifest generation
Every written file gets a deterministic manifest entry: `{ sha256, type, source: "generated", target }`.
The manifest becomes the single source of truth for "what OAC produced" — replacing `install.sh`'s
ad-hoc collision scan and `update.sh`'s find-everything approach. `source` distinguishes
`bundled` (neutral `/content` copied), `registry` (added component), `generated` (build output),
`custom` (user file — never touched).

### Stage 8 — Validate
After writing, re-load the generated output and assert it is well-formed for the target (e.g. parse
the generated OpenCode frontmatter; validate `plugin.json` against Claude's plugin schema; assert
Cursor file ≤ size limit). Validation failures in `--strict`/`--check` → exit 1. This is the
"golden snapshot + parse/manifest check on ONE worked agent" that the locked minimal-test decision
(#3) requires, run live.

### 2.1 Determinism requirements
- Stable sort of inputs (by id) before writing.
- No timestamps inside generated content or the deterministic manifest. Optional operational
  timestamps live in separate state/telemetry and are ignored by build/check comparisons.
- Frontmatter key order fixed by the adapter, not by object-iteration order.
- `oac build && oac build` is a no-op because both runs generate and compare the same temp tree.

### 2.2 Profiles
Profiles (`essential`, `developer`, `business`, `full`, `advanced`) live in `registry.json`
`profiles.*.components[]` (25/41/25/50/68 components; `advanced` adds `additionalPaths`
`.Building/`, `.github/workflows/`). `oac init --profile` selects the component set; the CLI
resolves it exactly as `install.sh get_profile_components` did, then runs dependency closure.
`additionalPaths` (advanced) — `install.sh` only *printed* these as "manual download required";
the CLI must actually copy them from the bundle (parity improvement, not just parity).

### 2.3 Dependency & wildcard resolution (moves from bash to `packages/core`)
`install.sh` did this in `resolve_dependencies` (recursive) + `expand_context_wildcard`
(`context:core/*` → all matching context ids) + `expand_selected_components` (dedupe). Reimplement
as typed, cycle-safe functions in `packages/core` (or `lib/registry.ts`), consumed by `init`, `add`,
and Stage 3. Must handle: singular/plural type keys (`get_registry_key`), aliases
(`.aliases[]` in registry), and non-`.md` context paths like `paths.json` (issue #251/#252 —
`resolve_component_path` already special-cases this; preserve it).

### 2.4 Path rewriting for non-local installs
`install.sh perform_installation` rewrote `@.opencode/context/` and `.opencode/context` references
to the absolute install dir whenever installing anywhere other than a local `.opencode/`. This must
survive as a **Stage-5 concern**: when the OpenCode target root is not the default project-local
`.opencode/` (i.e. `--global` or `--dir`), the adapter/bundler rewrites context path references to
the resolved absolute location. This is central to issues #321/#326 (global vs project-local paths).

### 2.5 Project discovery (`.oac.json`)

Use one discovery chain:

1. If `<cwd>/.oac.json` exists, parse `context.root`; resolve it relative to that file and require
   the directory plus its registry/root anchor. Invalid config is a hard error, not a silent scan.
2. Otherwise walk parent directories to the filesystem root looking for `.oac.json`.
3. If none exists, accept `<project>/content/` only when its registry/root anchor validates it.
4. After successful fallback discovery in a writable project, write `.oac.json` atomically with
   `{ "version": 1, "context": { "root": "content" } }` so the next run takes the fast path.
5. If discovery fails, stop with `oac init` guidance; never fall back to `.opencode/context` or a
   global directory implicitly.

`OAC_PACKAGE_ROOT` is separate: it locates OAC's bundled starter content, not the user's editable
project content. All commands call the same typed discovery function from `packages/core`.

---

## 3. `install.sh` → CLI parity checklist (all 35 functions)

Every function in `install.sh` maps to a CLI equivalent or is justified obsolete. Nothing lost.

| # | `install.sh` function | CLI equivalent | Notes |
|--:|------------------------|----------------|-------|
| 1 | `jq_exec` | `lib/registry.ts` (`readRegistry`, Zod) | Native JSON parse; no `jq` dependency. Also strips `\r` — Node parse is CRLF-safe. |
| 2 | `print_header` | `ui/logger.ts` + `ui/spinner.ts` | Banner via logger. |
| 3 | `print_success` | `ui/logger.ts` `success()` | |
| 4 | `print_error` | `ui/logger.ts` `error()` | |
| 5 | `print_info` | `ui/logger.ts` `info()` | |
| 6 | `print_warning` | `ui/logger.ts` `warn()` | |
| 7 | `print_step` | `ui/logger.ts` `bold()`/`info()` + spinner | |
| 8 | `normalize_and_validate_path` | `lib/paths.ts` `normalizeInstallPath()` **(new)** | Tilde expansion, `\`→`/`, trailing-slash strip, relative→absolute. Node `path`+`os.homedir()`. Cross-platform (#304/#312). |
| 9 | `validate_install_path` | `lib/paths.ts` `validateInstallPath()` **(new)** | Parent-exists + writable checks via `fs.access`. |
| 10 | `get_global_install_path` | `lib/paths.ts` `getGlobalInstallDir()` **(new)** | `~/.config/opencode` (all platforms today); §4.2 revisits Windows `%APPDATA%`. |
| 11 | `check_bash_version` | **obsolete** | No bash. Replaced by Node/Bun runtime check in `doctor` (`checkBunVersion` → generalized). |
| 12 | `check_dependencies` (curl, jq) | **obsolete** | No curl/jq — `fetch` + native JSON built into runtime. `doctor` checks the runtime instead. |
| 13 | `fetch_registry` (file:// or curl) | `lib/registry.ts` `readRegistry()` + §4.5 remote/cache | Registry is **bundled** in the package (offline by default); optional remote fetch + cache in §4.5. |
| 14 | `get_profile_components` | `lib/registry.ts` `getProfileComponents()` **(new)** | Reads `profiles.*.components[]`. §2.2. |
| 15 | `get_component_info` | `lib/registry.ts` `resolveComponent()` | Already exists; extend for context-path special case. |
| 16 | `resolve_component_path` | `lib/registry.ts` `getDestRelativePath()` / `getBundledSourcePath()` | Exists; preserve `.md`-then-raw fallback for `paths.json` (#251). |
| 17 | `get_registry_key` (singular/plural) | `lib/registry.ts` type normalization | `ComponentTypeSchema` + plural section keys; fold aliases in. |
| 18 | `get_install_path` (strip `.opencode/`) | `lib/registry.ts` `INSTALL_DIRS` + install-dir join | Post-refactor: source lands in `content/`, targets under their own roots. |
| 19 | `expand_context_wildcard` | `packages/core` `expandWildcard()` **(new)** | §2.3. Typed, cycle-safe. |
| 20 | `expand_selected_components` (dedupe) | `packages/core` `dedupeComponents()` **(new)** | Set-based dedupe. |
| 21 | `resolve_dependencies` (recursive) | `packages/core` `resolveDependencyClosure()` **(new)** | §2.3. **Current parity gap** — `add.ts` does not yet resolve deps; must add. |
| 22 | `check_interactive_mode` (TTY guard) | `commander` + `process.stdin.isTTY` | curl\|bash pipe → non-interactive; profile/flags drive it. `CI=true`→`--yolo`. |
| 23 | `show_install_location_menu` | `oac init` flags `--global`/`--dir` (+ optional prompt) | Non-interactive first; interactive prompt optional (Open Q). |
| 24 | `show_main_menu` | `oac init` / `oac add` command routing | Commander subcommands replace the menu. |
| 25 | `show_profile_menu` | `oac init --profile <name>` | Flag replaces menu; `oac list --profiles` to browse (Open Q). |
| 26 | `show_custom_menu` | `oac add <ref>` (repeatable) | Per-component add replaces category menu. |
| 27 | `show_component_selection` | `oac add` (no ref) lists; user picks refs | `printAvailableComponents()` exists. |
| 28 | `show_installation_preview` | `oac init/add --dry-run` + pre-write plan | `printPlan()` exists in `init.ts`; extend with collision preview. |
| 29 | `show_collision_report` | `lib/installer.ts` decide-logic + summary printers | sha256 manifest diff replaces filename-only collision scan; grouped report in summary. |
| 30 | `get_install_strategy` (skip/overwrite/backup/cancel) | `--yolo` flag + `config.autoBackup` + skip-default | Default = skip user-modified (safe); `--yolo` = backup+overwrite; cancel = don't run. Backups → `.oac/backups/{ts}/`. |
| 31 | `perform_installation` | `lib/installer.ts` `installFiles`/`updateFiles` + `oac build` | The core engine, already built + Stage 6 write. |
| 32 | `show_post_install` | `init.ts` `printSummary()` | Exists; add "run `oac build`/next steps". |
| 33 | `list_components` | `oac list` / `oac add` (no ref) | Exists (§1.8). |
| 34 | `cleanup_and_exit` | Node process exit + `try/finally` temp cleanup | No global temp dir needed (no downloads by default); §4.5 cache cleanup if remote used. |
| 35 | `main` (arg parse, profile shortcuts, env vars) | `index.ts` + `commander` | `OPENCODE_INSTALL_DIR`→`--dir`, `OPENCODE_BRANCH`→(obsolete; bundled), profile posit:onals→`--profile`. |

**Obsolete-and-why summary:** `check_bash_version`, `check_dependencies` (no bash/curl/jq —
Node runtime + `fetch` + native JSON), the interactive `show_*_menu` chain (Commander flags +
non-interactive-first design; optional prompts are a nice-to-have, see Open Questions). Everything
else has a living equivalent.

### 3.1 `update.sh` parity

| `update.sh` capability | CLI equivalent |
|------------------------|----------------|
| `get_global_install_path` / `normalize_path` / `resolve_install_dir` (CLI→env→local→global auto-detect) | `oac update` resolves target from manifest location; `--dir`/`--global`; `lib/paths.ts` |
| `update_component` (backup, curl, restore-on-fail) | `installer.ts` `updateFiles` — sha256-gated, atomic per file, `.oac/backups/` |
| `update_all_components` (find `*.md`/`*.ts`/`*.sh`, **skip node_modules**) | `listBundledFiles` (already excludes node_modules, #308) + manifest-driven set |
| Blind overwrite-with-backup | **Superseded** by user-edit protection: user-modified files skipped unless `--yolo` |
| `cleanup_backups` (trap) | `.oac/backups/{ts}/` retained (not auto-deleted) — user-recoverable; `oac` cleanup skill can prune |

`oac update` is strictly safer than `update.sh`: it never clobbers a user's local edits by default,
whereas `update.sh` overwrote every file and relied on a transient `.backup`.

---

## 4. Cross-platform distribution

Core goal (from the task): **better cross-platform install via npm**, one system exporting to
different AI tools.

### 4.1 Runtime portability (THE blocker) — Node-first, Bun-optional

**Problem:** `bin/oac.js` does `execFileSync('bun', …)` and the CLI uses `Bun.file`, `Bun.write`,
`Bun.version`, `import.meta.dir`. A `npm i -g` user on Windows/macOS/Linux without Bun gets
"Bun is required". That defeats npm distribution.

**Decision:** ship a **Node-compatible build**. Two viable paths (pick in Open Questions):
- **(A) Portability shim** — replace Bun APIs with a tiny `lib/fs.ts` abstraction over
  `node:fs/promises` (`readFile`/`writeFile`/`mkdir -p`), `node:crypto` (already used in
  `sha256.ts`), and `import.meta.url`→`fileURLToPath` for `__dirname`. Build with `tsc`/`esbuild`
  targeting Node ≥18. `bin/oac.js` runs `node dist/index.js` directly — no Bun. **Recommended:**
  smallest dependency surface, works everywhere npm works.
- **(B) Bundle a runtime** — compile a standalone binary per platform (Bun `--compile`) and publish
  via optional-deps or `postinstall`. Heavier, platform matrix to maintain, npm-global unfriendly.

Either way: keep Bun as the **dev/test** runtime (`bun test` is fast), but the **published artifact
must run on stock Node**. Root `package.json` already declares `engines.node >=18`.

### 4.2 Install locations — local vs global (issues #321, #326)

| Mode | Neutral source (`content/`) | Target output | State (`.oac/`) |
|------|------------------------------|---------------|-----------------|
| **Project-local** (default) | `<project>/content/` | `<project>/.opencode/`, `<project>/CLAUDE.md`, … | `<project>/.oac/` |
| **Global** (`--global`) | `~/.config/oac/content/` | `~/.config/opencode/` (OpenCode global), tool-global dirs | `~/.config/oac/` |
| **Custom** (`--dir <path>`) | `<path>/content/` | `<path>/…` | `<path>/.oac/` |

- Default is **project-local** — the safe, no-surprise default. `--global`/`--dir` are explicit
  opt-ins (mirrors `install.sh`'s location menu but flag-driven).
- **No accidental source overwrite (#321/#326):** `init`/`add`/`update` writes to canonical or
  custom files are gated by the sha256 manifest; generated targets are replaced by pure `build`.
  Path normalization (`lib/paths.ts`) rejects paths that
  escape the install root (`update.sh` already guarded `../` — preserve that: reject `..`/absolute
  escapes before any write).
- Global path today is `~/.config/opencode` on all platforms (from `get_global_install_path`).
  Windows should additionally honor `%APPDATA%`/`%LOCALAPPDATA%` — flagged in Open Questions.

### 4.3 Windows support (issues #304, #312)

- **No shell scripts:** deleting `install.sh`/`update.sh` removes the bash-3.2/Git-Bash dependency
  entirely — the #1 Windows friction. Pure Node CLI runs in PowerShell/CMD natively.
- **Path handling:** use `node:path` throughout (never string-concat `/`); `normalizeInstallPath`
  converts `\`→`/` internally and resolves drive-letter paths (`C:\…`). The bash version already
  handled `^[A-Za-z]:` — the TS port must match.
- **No color/emoji assumptions:** `ui/logger.ts` should degrade on terminals without color
  (install.sh gated on `WT_SESSION`/`ConEmuPID`; `chalk` auto-detects TTY/`NO_COLOR`).
- **Line endings:** JSON parsing is CRLF-safe natively (removes the `tr -d '\r'` hack in `jq_exec`).
- **Case-insensitive FS:** manifest keys are stored as authored (POSIX-style relative paths); do not
  assume case-sensitivity when checking existence.

### 4.4 npx vs global install

| Method | Command | Use case | Notes |
|--------|---------|----------|-------|
| **npx (no install)** | `npx @controlstack/oac init` | one-off / trial / CI | Downloads on demand; needs Node ≥20; the modern replacement for `curl \| bash`. |
| **Global** | `npm i -g @controlstack/oac && oac init` | frequent users | `oac` on PATH; `oac doctor` checks for updates vs npm registry. |
| **Dev/local** | `pnpm --dir packages/cli dev` | contributors | `OAC_PACKAGE_ROOT` lets the CLI find bundled `/content` in the monorepo. |

Registry is **bundled**, so `npx` and global both work **offline after download** — no network at
run time (unlike `install.sh`, which curled every file from `raw.githubusercontent.com`).

### 4.5 Registry fetching, caching, offline

- **Bundled + offline only in v1.** `registry.json` and `/content` ship inside the package
  (`readRegistry` reads from `getPackageRoot()`). No network is needed for `init/add/build/update`.
  A remote catalog without matching bundled source cannot install a component reliably, so v1 has
  no `--registry` flag or registry cache.
- **`doctor`** already does a non-blocking npm-latest check with a 5s timeout and offline fallback —
  the model for all network calls: **never block on the network**.

### 4.6 Checksum / collision / update strategy (from install.sh, upgraded)

| Concern | install.sh | CLI |
|---------|-----------|-----|
| Collision detect | filename existence scan (`perform_installation`) | **sha256 manifest** — knows if the existing file is OAC's unchanged copy or a user edit |
| Strategy choice | interactive menu (skip/overwrite/backup/cancel) | default **skip user-modified**; `--yolo`=backup+overwrite; `config.autoBackup` |
| Backup | `.opencode.backup.<timestamp>/` mirror | `.oac/backups/<ISO-timestamp>/<relpath>` |
| Update safety | blind curl overwrite + `.backup`/restore | user edits never lost without `--yolo` |
| Integrity | none | every tracked file has a sha256; `doctor` detects drift/corruption |

### 4.7 Migration for existing `curl | bash` users

Existing users have a project-local `.opencode/` installed by `install.sh` but **no `.oac/`
manifest**. Migration path (details owned by Agent E; CLI responsibilities here):
1. `oac init` (or a dedicated `oac migrate`) detects an OAC-shaped `.opencode/` without a manifest.
2. It **adopts** the existing files: sha256-hashes each known OAC file and writes a manifest marking
   files that match a bundled/known hash as `source: generated/bundled` and unknown ones as
   `custom` (never touched). No overwrite without `--yolo`.
3. Because the pre-refactor repo had `.opencode/` as *source*, migration also seeds `content/` from
   the bundled neutral source so future `oac build` works — offering a diff if the user hand-edited
   `.opencode/` agents.
4. README swaps `curl … | bash` for `npx @controlstack/oac init`; the old one-liner can print a
   deprecation notice pointing at npm (kept for one release).

---

## 5. npm packaging

### 5.1 What ships in the package

Post-refactor `files` (root `package.json`) replaces the `.opencode/**` enumeration with:

```jsonc
"files": [
  "content/",            // ← THE bundled neutral source of truth (agents, skills, commands, context)
  "registry.json",       // component + profile + dependency catalog
  "packages/cli/dist/",  // Node-runnable compiled CLI
  "packages/core/dist/", // IR schema + parser + registry loader
  "packages/adapters/dist/", // per-tool adapters used by `oac build`
  "bin/",                // oac entrypoint (node, not bun)
  "VERSION", "LICENSE", "README.md", "CHANGELOG.md"
]
// Explicitly NOT shipped: install.sh, update.sh, scripts/bridge/*, .opencode/ (now generated),
// **/node_modules/  (#308)
```

- The current `files` list bundles `.opencode/**` and `install.sh` — both **removed**. `/content`
  becomes the shipped asset.
- `bundled.ts` `getPackageRoot()`/`listBundledFiles()` **retarget** from `.opencode/{agent,context,
  skills}` to `content/{agents,skills,commands,context}`. The `registry.json`-absence heuristic used
  to distinguish CLI-package-root from monorepo-root needs revisiting since `registry.json` now
  ships **with** the package — replace the heuristic with an explicit `package.json` `name` check or
  an `OAC_PACKAGE_ROOT`-style anchor file.
- `node_modules` exclusion (#308) stays enforced both in `files` globs and in the runtime file
  walker.

### 5.2 Bundling pattern (`bundled.ts`)

Keep the proven pattern: **assets travel inside the published tarball**, resolved at runtime by
walking up from the CLI's own location to the package root, with `OAC_PACKAGE_ROOT` as the
dev/monorepo override. This is why the CLI works offline. The only change is the **root directory**
(`content/` not `.opencode/`) and the **root-detection anchor** (§5.1).

### 5.3 Versioning

- **Single version** for the whole product = root `package.json` `version`,
  surfaced by `readCliVersion()` and written into `.oac/manifest.json` `oacVersion` on init/update.
  `doctor` compares it to the npm-latest.
- Publish exactly one package, `@controlstack/oac`; core and adapters are private and bundled into
  its CLI output. Legacy package names remain installable only for rollback and are deprecated with
  a pointer to the canonical package. `/content`, adapters, and CLI ship as one coherent version so
  a manifest's `oacVersion` identifies the source that produced the output.
- **Manifest schema version** (`manifest.version: "1"`) and **registry schema version**
  (`registry.schema_version`) are independent of the product version and gate migrations.

---

## Stage 1 decisions

`08-STRUCTURE-AND-PACKAGING.md` closes the former questions: Node-portable CLI; one published
`@controlstack/oac` package; flags-first prompts with TTY guidance; `agents-md` as the non-interactive
fallback target; native per-OS config paths; bundled/offline registry; `apply` retained for one minor
release; 30-day backup retention through `oac clean`; and editable project `content/`.
