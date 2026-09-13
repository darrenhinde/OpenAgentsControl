# 09 — Stage 4 Merge Rules: Ownership, Conflicts, Symlinks

> **Status:** Decided — written BEFORE Stage 4 executes (per `06-REVIEW.md` recommendation #3
> and `07-EXECUTION-PLAN.md` Stage 4 feature 1).
> **Date:** 2026-07-15 · Companion to `07-EXECUTION-PLAN.md` and `08-STRUCTURE-AND-PACKAGING.md`.
> **Sign-off:** Approved as the Stage 4 merge contract by canonical-refactor subtask 08;
> reaffirmed at the Stage 1 gate in subtask 10 on 2026-07-15.
> Every path, count, and line number below was re-verified on disk on 2026-07-15
> (branch `refactor/canonical`). Where disk disagrees with earlier docs, disk wins and the
> discrepancy is recorded in §9.

---

## 1. Scope and how to use this document

Stage 4 seeds `/content/` from **both** drifted trees — `.opencode/` and
`plugins/claude-code/` — and this document is the per-content-type rulebook for that merge.
It answers, for every conflict class: **which copy wins, what gets grafted from the loser,
and what happens to the loser's identity** (ids, paths, symlinks).

Rules of engagement:

1. A Stage-4 subtask that hits a conflict not covered here **stops and reports**
   (`12-DISPATCH.md` §Execution protocol); it does not improvise.
2. "Wins" means *seeds the `/content/` copy*. The losing copy is never silently discarded:
   losing-side-only sections/fields are either grafted (rule says how) or dispositioned in
   the merge commit message.
3. Precedence if this doc conflicts with a spec doc: per `12-DISPATCH.md`,
   **06-REVIEW dispositions > 08 > 07 > 00-INDEX > 01–05**. This doc implements those
   dispositions; if an implementer finds a contradiction, that is a stop-and-report.

---

## 2. Ownership table — content type → source of truth → conflict resolution

| Content type | Source of truth (seeds `/content/`) | Other copy | Conflict resolution |
|---|---|---|---|
| **Agents** (7 dual-home) | `plugins/claude-code/agents/*.md` (body + description + `<example>` blocks) | `.opencode/agent/subagents/**` | CC body wins; OpenCode-only frontmatter fields grafted into the neutral IR (`mode`, `temperature`, `permission` incl. `task:` allowlists). Canonical id = CC kebab-case filename; OpenCode PascalCase name → `aliases[]`. §3. |
| **Agents** (OpenCode-only, 27 files) | `.opencode/agent/**` (sole copy) | — | No conflict; harvest as-is, subject to the Q7 disposition for the 6 unregistered `subagents/planning/` agents (delete, per `06-REVIEW.md:788`). |
| **Skills** | **Union of 16**: 12 from `plugins/claude-code/skills/`, 4 from `.opencode/skills/` | `.opencode/skill/` (singular — orphan dir) | Sets are disjoint by name, so no body conflicts. Applicability via `targets:[]`. `task-management` split-across-dirs resolved in §4.2; `project-orchestration` excluded per Q7. §4. |
| **Commands** | Union: 20 `.md` under `.opencode/command/` + 6 CC-only under `plugins/claude-code/commands/` | — | Sets are disjoint by name (verified §5) — pure union, no conflict rule needed. |
| **Context** | `.opencode/context/` (293 `.md` files + 3 symlinks + `core/config/paths.json`) | `plugins/claude-code/context` | **No drift exists**: `plugins/claude-code/context` is a directory symlink → `../../.opencode/context` (git mode 120000). One physical tree; harvest it once. The 3 file-level symlinks become `aliases[]` (§7). |
| **Hooks** | `plugins/claude-code/hooks/` (`session-start.sh` + `hooks.json`) — CC-side only, no OpenCode equivalent | — | Verbatim harvest into `/content/hooks/` with `targets: ["claude"]`; all six capabilities and the `escape_for_json()` security control preserved byte-comparable until golden parity. §6. |
| **Registry** | **Generated** from `/content/**` frontmatter (Stage 4 feature 5) | Root `registry.json` (hand-maintained, 2742 lines) | Root file stops being source of truth; it becomes build output at `/content/registry.json` with a root copy for one release (`05` §risk table). Hand-maintained facts that survive: `aliases[]` (3 entries, `registry.json:1563,1576,1589`), `files[]` (skills), profiles/categories. Duplicate-id pairs collapse per §7.3. |

---

## 3. Agents — the 7 dual-home pairs

### 3.1 The pairs, verified on disk

Both trees were enumerated (`plugins/claude-code/agents/`: 7 files;
`.opencode/agent/**`: 34 files). Exactly these 7 exist on both sides:

| # | Canonical id (CC filename) | CC source (wins body) | Lines | OpenCode source (grafts fields) | Lines | OpenCode `name:` → `aliases[]` | CC `model:` |
|---|---|---|---|---|---|---|---|
| 1 | `coder-agent` | `plugins/claude-code/agents/coder-agent.md` | 213 | `.opencode/agent/subagents/code/coder-agent.md` | 253 | `CoderAgent` | `sonnet` |
| 2 | `code-reviewer` | `plugins/claude-code/agents/code-reviewer.md` | 269 | `.opencode/agent/subagents/code/reviewer.md` | 108 | `CodeReviewer` | `sonnet` |
| 3 | `test-engineer` | `plugins/claude-code/agents/test-engineer.md` | 280 | `.opencode/agent/subagents/code/test-engineer.md` | 126 | `TestEngineer` | `sonnet` |
| 4 | `context-manager` | `plugins/claude-code/agents/context-manager.md` | 745 | `.opencode/agent/subagents/core/context-manager.md` | 475 | `ContextManager` | `sonnet` |
| 5 | `context-scout` | `plugins/claude-code/agents/context-scout.md` | 341 | `.opencode/agent/subagents/core/contextscout.md` | 116 | `ContextScout` | `haiku` |
| 6 | `external-scout` | `plugins/claude-code/agents/external-scout.md` | 374 | `.opencode/agent/subagents/core/externalscout.md` | 320 | `ExternalScout` | `haiku` |
| 7 | `task-manager` | `plugins/claude-code/agents/task-manager.md` | 378 | `.opencode/agent/subagents/core/task-manager.md` | 666 | `TaskManager` | `sonnet` |

(5 `sonnet`, 2 `haiku` — matches `12-DISPATCH.md`'s runtime facts.)

### 3.2 Rule: CC body wins, OpenCode-only fields grafted

**CC wins the body and the `description`** (including all 6 `<example>` blocks — 2 each in
`code-reviewer`, `context-scout`, `coder-agent`; verified `grep -o '<example>' | wc -l` = 6).
Grounds, verified:

- **Newer on every pair.** Last-commit dates (git, this branch): CC copies 2026-02-16 to
  2026-02-23; OpenCode copies 2026-02-02 to 2026-02-15. CC is strictly newer for all 7.
  `scripts/bridge/sync-to-claude.sh` last changed 2026-02-06 — the CC tree has been edited
  directly since, i.e. the drift is real and CC is where the recent work landed.
- **Richer for 5 of 7** by body size and structure (e.g. `code-reviewer` 269 vs 108 lines,
  with different descriptions — the exact case `06-REVIEW.md:948-951` flags).
- **`<example>` blocks are CC-runtime UX** and exist nowhere on the OpenCode side.

**Grafted from the OpenCode copy** (fields absent from CC frontmatter, verified on
`coder-agent` pair and spot-checked across the other six):

| OpenCode-only field | Graft rule |
|---|---|
| `mode: subagent` | → IR dispatch/mode field, verbatim. |
| `temperature` | → IR inference params, verbatim (e.g. `coder-agent: 0`, `reviewer: 0.1`). |
| `permission:` (bash/edit/task maps) | → IR rules. Path-bearing scopes (e.g. `"bash .opencode/skills/task-management/router.sh complete*"`, `coder-agent.md:8-9`) are **tokenized** (`{{SKILL_ROOT}}` etc.) per Stage 4 feature 2 — raw `.opencode/` paths are lint-forbidden in `/content/`. |
| `task:` allowlists (`contextscout`, `externalscout`, `TestEngineer`, …) | → IR delegate rules; referenced agent names resolve via canonical id **or** `aliases[]` (so `TestEngineer` keeps resolving). |

CC-only `tools:` and `disallowedTools:` map to capabilities. Legacy `model:` values are migration
inputs only: the two scout agents become `inference.tier: fast`; the other five become
`inference.tier: balanced` (or omit the default). Concrete model names are discarded and never
enter canonical content. OpenCode copies have no `model:` (verified across both subagent trees).

### 3.3 Mandatory exception — two pairs where OpenCode is longer

"CC is richer" is **false by line count for 2 of 7**: `coder-agent` (CC 213 vs OpenCode 253)
and `task-manager` (CC 378 vs OpenCode **666**). CC still wins the body (it is newer and its
structure is the shipped one), **but** for these two pairs the merge is not a blind copy:

- Run a section-level diff of the OpenCode body against the CC body.
- Every OpenCode-only section is either **merged into** the `/content/` body or **dropped
  with a one-line reason in the merge commit**. Silent loss of ~288 lines of `task-manager`
  prompt material is not an acceptable outcome of a "CC wins" rule.

### 3.4 Identity

Canonical id = CC kebab-case filename (`01` Q1 disposition, `06-REVIEW.md:778`: *filename ==
id*, `aliases[]` for back-compat). Canonical ids remain kebab-case; the deliberately loose legacy
alias schema in `02` §0.3 retains OpenCode names such as `TestEngineer`, so existing dependency
edges and `task:` permission keys keep resolving without making those names canonical.

---

## 4. Skills — the union of 16 via `targets:[]`

### 4.1 The union, verified on disk

Three skill locations exist (the `skill`/`skills` duplication is itself a merge subject):

- `plugins/claude-code/skills/` — **12** skills (each a dir with `SKILL.md`):
  `code-execution`, `code-review`, `context-discovery` (+`context-discovery-protocol.md`),
  `context-setup`, `debugger`, `external-research`, `oac-approach`, `parallel-execution`,
  `task-breakdown`, `test-generation`, `using-oac`, `verification-before-completion`.
- `.opencode/skills/` (plural) — **4** skills: `context-manager`, `context7`,
  `smart-router-skill`, `task-management` (multi-file: `SKILL.md`, `router.sh`,
  `scripts/task-cli.ts` — the only content type using registry `files[]`).
- `.opencode/skill/` (singular) — **2 directories, 0 skills for the union**:
  `project-orchestration/` (full skill, but **unregistered orphan**, `01` §4.3) and
  `task-management/tests/` (**tests only — no `SKILL.md`**; verified: the dir contains just
  `enhanced-schema.test.ts` and `line-number-validation.test.ts`).

The two contributing sets are **disjoint by name** (verified: none of the 4 OpenCode names
appear among the 12 CC names), so the union is exactly **12 + 4 = 16** — confirming
`06-REVIEW.md:775` (Q16 disposition) with no forced arithmetic.

`/content/skills/` is seeded with all 16. Applicability is expressed with the `targets:[]`
field 06 fix #1 adds to every content schema (`06-REVIEW.md:922`):

| Group | `targets:` | Why (verified) |
|---|---|---|
| The 12 CC skills | `["claude"]` | CC-only frontmatter (`context: fork`, `agent:` — `03:441-443`); advertised as `oac:` entries by `session-start.sh:36-49`. Inert on OpenCode today. |
| The 4 OpenCode skills | `["opencode"]` | Their `router.sh` files shell out to Bun-run TypeScript (`01` §4.4 / Q15); a CC user has no Bun. Widen `targets` only when Stage 5 makes the runtime portable. |

### 4.2 The duplicated `task-management`: which copy is authoritative

**Authoritative: `.opencode/skills/task-management/`** (plural dir). Grounds, all verified:

1. It is the **only copy the registry knows**: `registry.json:703-720` — entry
   `id: task-management`, `path: .opencode/skills/task-management/SKILL.md`, with `files[]`
   listing `SKILL.md`, `router.sh`, `scripts/task-cli.ts`. The registry has **no** entry for
   anything under `.opencode/skill/` (singular) — `01` §4.3 confirms the singular dir is an
   orphan.
2. It is the **only copy that is a skill at all**: `.opencode/skill/task-management/`
   contains **no `SKILL.md`, no `router.sh`** — only `tests/` with two vitest files that
   test the enhanced task-JSON schema implemented by the plural copy's `task-cli.ts`.

**Merge action:** seed `/content/skills/task-management/` from
`.opencode/skills/task-management/` and **reunite the split tests** by moving
`.opencode/skill/task-management/tests/{enhanced-schema,line-number-validation}.test.ts`
into `/content/skills/task-management/tests/`. Nothing is lost; the singular dir's
task-management content is 100% preserved.

**`project-orchestration`:** excluded from the 16 per the Q7 disposition
(`06-REVIEW.md:788` — delete the dark orchestration feature together with the 6 unregistered
`subagents/planning/` agents; reversible via git). If Q7 is re-decided to "ship", it enters
`/content/skills/` as a 17th skill with `targets: ["opencode"]` — that is the only change.

---

## 5. Commands — disjoint union, no conflicts

Verified by enumeration:

- `.opencode/command/` — **20 `.md` files**: 12 top-level (`add-context`, `analyze-patterns`,
  `build-context-system`, `clean`, `commit-openagents`, `commit`, `context`, `optimize`,
  `test-new-command`, `test`, `validate-repo`, `worktrees`) + `openagents/` (5, incl.
  `new-agents/` templates) + `prompt-engineering/` (2).
- `plugins/claude-code/commands/` — **6 CC-only**: `brainstorm`, `debug`, `install-context`,
  `oac-cleanup`, `oac-help`, `oac-status`.

No name appears in both trees, so command merge is a pure union into `/content/commands/`
(the "6 CC-only commands: mechanical harvest" of `06-REVIEW.md:954` and `07` Stage 4
feature 1). CC-only commands carry `targets: ["claude"]` where they depend on CC skills.

---

## 6. Hooks — `session-start.sh`'s six capabilities and their preservation path

`plugins/claude-code/hooks/` contains exactly two files: `hooks.json` (registers a
`SessionStart` command hook, `timeout: 30`, `${CLAUDE_PLUGIN_ROOT}` token) and
`session-start.sh` (92 lines). There is no OpenCode-side equivalent (`06-REVIEW.md:510`).
`00-INDEX.md:212` is binding: the hook **must be preserved into `/content/` before
`plugins/claude-code/` is deleted.**

### 6.1 The six capabilities (line numbers verified against the file on disk)

| # | Capability | Where in `session-start.sh` | Preservation requirement in `/content/hooks/` |
|---|---|---|---|
| 1 | Inlines the **full `using-oac` SKILL.md text** into session context | Lines 9-12 (reads `skills/using-oac/SKILL.md`), injected at line 76 | Script keeps reading the *installed* skill file at runtime — the reference becomes a tokenized path (`{{PLUGIN_ROOT}}/skills/using-oac/SKILL.md`), never an inlined snapshot (would freeze the skill at build time). |
| 2 | Builds the **skill catalogue** (`- oac:<name> — <description>`) by globbing `skills/*/SKILL.md` and grepping `^description:` frontmatter | Lines 32-49 | Runtime glob preserved as-is. This is load-bearing coupling: skill `description:` frontmatter is part of the hook's contract (`01:730`). The corpus test must keep a skill-with-description fixture. |
| 3 | **First-run warning** when no context manifest exists — checks project `$(pwd)/.claude/.context-manifest.json` **and** global `~/.claude/.context-manifest.json`; emits the `<important-reminder>` onboarding block | Lines 51-61 | Both manifest locations and the exact reminder wrapper preserved (`01` checklist: "#3 first-run warning… project **or** global"). |
| 4 | **OAC system paths block** — plugin root + `context-discovery-protocol.md` path | Lines 64-68 | Paths derive from `PLUGIN_ROOT` at runtime; the protocol file (`skills/context-discovery/context-discovery-protocol.md`) must ship in the same build output or the emitted path dangles — add to the Layer-4 structural test. |
| 5 | **Context-discovery instruction** — tells the session to run `oac:context-discovery` once before any coding request | Lines 70-73 | Verbatim text preserved, including the "once per session" guard. |
| 6 | **Dual-format JSON output** — `additional_context` (Cursor/OpenCode/other) *and* `hookSpecificOutput.additionalContext` (Claude Code) | Lines 78-89 | Both keys preserved; this is the cross-tool compatibility surface. |

**Security control (not a "capability" but non-negotiable):** `escape_for_json()`
(lines 15-28) with its **backslash-first escaping order** — the injection defense
`06-REVIEW.md` U4 calls out. Preserved byte-identical; the corpus gets a
malicious-SKILL.md fixture asserting the JSON survives.

### 6.2 Preservation path

Per `08-STRUCTURE-AND-PACKAGING.md` §1, hooks live at `/content/hooks/` ("session-start
etc. (harvested from CC plugin)"):

```
content/hooks/session-start/
├── hook.md            # frontmatter: id, event: SessionStart, timeout: 30,
│                      # targets: ["claude"], script: session-start.sh
└── session-start.sh   # verbatim harvest (paths tokenized, behavior unchanged)
```

The claude adapter generates `plugins/claude-code/hooks/hooks.json` (same shape as today's
file: `SessionStart` → `command` → `bash "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"`,
`timeout: 30`) and copies the script. The `02` §6 `HookSchema` must be exercised against
this real file — the never-tested-against-reality gap `06-REVIEW.md:951` flags. Rule:
**verbatim harvest first, golden-parity proof, then improvements** — any "generate the
catalogue at build time instead" idea is post-Stage-4 work, because Stage 4's gate is parity
with today's behavior, and `sync-to-claude.sh` retirement (Stage 4 feature 4) is blocked on
that parity.

---

## 7. The symlink decision

### 7.1 Decision: convert the 3 context symlinks to `aliases[]`, delete the links

Verified on disk (`find .opencode/context ! -type f -name '*.md'`), git mode 120000 (real
committed symlinks):

| Symlink (deleted) | Target (canonical file, stays) | Registry entry gaining `aliases[]` |
|---|---|---|
| `.opencode/context/core/standards/code.md` | `code-quality.md` | `code-quality` gains `aliases: ["code", "standards-code"]` |
| `.opencode/context/core/standards/docs.md` | `documentation.md` | `documentation` gains `aliases: ["docs", "standards-docs"]` |
| `.opencode/context/core/standards/tests.md` | `test-coverage.md` | `test-coverage` gains `aliases: ["tests", "standards-tests"]` |

Rationale (00-INDEX v2.2 warning + `06-REVIEW.md` U1, all four consequences): Windows
checkouts materialize these as 15-16-byte text files containing the target name (breaking
every agent told to read `standards/code.md`); npm tarball symlink handling is inconsistent;
a copying build dereferences them into non-deterministic duplicate diffs; and they are the
filesystem's third mechanism for the alias concept the registry already expresses twice.
**One mechanism survives: `aliases[]`** — which exists and works today
(`registry.json:1563,1576,1589`; resolution `.id == id or (.aliases // []) | index(id)`,
`01:893`).

### 7.2 The 3 in-content files referencing the alias paths, and their fix

`06-REVIEW.md` U1 names three referencing files; all three verified present on disk with the
references at these locations. All three ship into `/content/`, so the fix happens on the
`/content/` copies during the merge (**rewrite alias path → canonical path**; `aliases[]`
resolves ids, not filesystem reads, so references must point at real files):

| File | Verified reference lines | Fix |
|---|---|---|
| `.opencode/agent/subagents/core/context-retriever.md` | 403 (`standards/code.md` full path), 475-476 (`code.md`, `tests.md`) | `standards/code.md` → `standards/code-quality.md`; `standards/tests.md` → `standards/test-coverage.md` |
| `.opencode/context/openagents-repo/templates/context-bundle-template.md` | 34-36 (full paths), 70-72 (partial paths) | `code.md`/`tests.md`/`docs.md` → `code-quality.md`/`test-coverage.md`/`documentation.md` |
| `plugins/claude-code/skills/test-generation/SKILL.md` | 142 (`.opencode/context/core/standards/tests.md`) | → `standards/test-coverage.md` (and tokenize the `.opencode/` prefix per Stage 4 feature 2) |

**Verified addendum — the reference surface is wider than U1's three.** A full-tree grep for
`standards/(code|docs|tests).md` (excluding this spec set) finds additional referencing
files. They are not `/content/` sources, but two are **runtime/test code that will fail the
Stage-4 gates** if not updated in the same change:

| File | Lines | Disposition |
|---|---|---|
| `.opencode/plugin/agent-validator.ts` | 429, 829, 834, 849 (`requiredFile: "standards/code.md"` etc.) | Update to canonical filenames **in the same PR** — otherwise the validator demands reads of files that no longer exist. |
| `evals/framework/src/evaluators/context-loading-evaluator.ts` | 60-73 (`CONTEXT_FILE_MAP` expects `standards/code.md`, `docs.md`, `tests.md`) | **Add** canonical paths (`code-quality.md`, `documentation.md`, `test-coverage.md`) to each expected list **before** agents are migrated (evals are the Stage-4 behavior gate); drop the alias strings after parity. |
| Docs/tests/fixtures: `evals/{README,CREATING_TESTS,EVAL_FRAMEWORK_GUIDE}.md`, `evals/framework/src/**/__tests__/*` (4 files), `evals/agents/**` test plans, `docs/agents/{openagent,repo-manager}.md`, `dev/ai-tools/opencode/context/how-context-works.md`, `.opencode/plugin/tests/validator/test-validation.sh:32`, `scripts/tests/test-e2e-install.sh:101`, `scripts/registry/validate-registry.sh:317`, `CHANGELOG.md` (historical — do not edit) | — | Follow-up sweep in the same Stage-4 subtask, gated by the same grep returning zero non-historical hits. |

A fourth symlink exists and is **resolved by this merge, not converted**:
`plugins/claude-code/context -> ../../.opencode/context` (git mode 120000). It exists only
to make the plugin ship the context tree without duplication; once both trees are generated
from `/content/context/`, the claude adapter emits a real directory and the symlink
disappears with the generated-tree flip. No `aliases[]` involvement.

### 7.3 Registry duplicate-id collapse (same three files, second mechanism)

The registry today has **two ids per target file** (verified): `standards-code` **and**
`code-quality` → `core/standards/code-quality.md`; `standards-tests` **and**
`test-coverage` → `test-coverage.md`; `standards-docs` **and** `documentation` →
`documentation.md`. Per `01` §3.6 / checklist `01:1218`: the filename-matching id
(`code-quality`, `test-coverage`, `documentation`) is canonical; the `standards-*` id folds
into that entry's `aliases[]` (as shown in §7.1's table). Build-time validation fails on any
duplicate `path` with two ids (`01:950`).

---

## 8. Registry — regenerated, not merged

The root `registry.json` is not a merge *source*; it is the thing Stage 4 feature 5
replaces. Rules:

1. `/content/registry.json` is **generated** from `/content/**` frontmatter after the
   merges above land (this mechanically closes the unregistered-file gap — e.g. the orphan
   `.opencode/skill/` dir and the planning agents were invisible precisely because the root
   registry is hand-maintained).
2. Hand-maintained facts that must survive into frontmatter before generation:
   the 3 existing `aliases[]` entries (`feature-breakdown`, `session-management`,
   `component-planning` — `registry.json:1563-1589`), skill `files[]` (regenerated by
   globbing the skill dir, per `01` §4.2), profiles, categories.
3. Root `registry.json` remains as a **copy of the generated file for one release**
   (transition rule, `05` §1 risk table) so the 4 workflows and the live installer keep
   working; then it is deleted.

---

## 9. Discrepancies found while verifying (disk vs prior docs)

Recorded per `12-DISPATCH.md` ("recount from disk before asserting"):

1. **Context census:** disk shows **293** regular `.md` files + **3** symlinks (= 296 `.md`
   path entries) + **1** non-`.md` file (`core/config/paths.json`). `06-REVIEW.md:282` says
   "294 real files + 3 symlinks + 3 JSON"; `00-INDEX` says 296. The symlink count (3) and
   total-entries figure (296) hold; the regular-file count is **293, not 294**, and there is
   **1 JSON, not 3**. Stage-4 gates must assert against a fresh count, not these constants.
2. **"CC is richer":** true for 5 of 7 dual-home agents; **false by size for `coder-agent`
   (213 vs 253) and `task-manager` (378 vs 666)**. "CC is newer" is true for all 7 (git
   dates, §3.1-3.2). Hence the mandatory diff-disposition exception in §3.3.
3. **Skills union = 16** holds exactly (12 + 4, disjoint), but only because
   `.opencode/skill/` (singular) contributes zero: `project-orchestration` is dispositioned
   by Q7 and `skill/task-management/` is a tests-only fragment (§4.2). Any doc that derives
   16 as "12 + 4 across *three* directories" is glossing over this.
4. **Alias-path referencing files = 3** holds for in-`/content/` sources, but the total
   reference surface is larger (§7.2 addendum) — two runtime/test files must move in
   lockstep or Stage-4 gates fail.
5. **A 4th symlink** (`plugins/claude-code/context` → `.opencode/context`, dir-level) is
   absent from U1's census; it means the "two drifted context trees" risk does **not** exist
   for context (one physical tree), and it resolves via the generated-tree flip (§7.2).

---

## 10. Verification appendix

All evidence gathered 2026-07-15 in this worktree:

```
find .opencode/agent -name '*.md'                       # 34 files (7 pair with CC)
ls plugins/claude-code/agents/                          # 7 files
grep '^model:' plugins/claude-code/agents/*.md          # 5 sonnet, 2 haiku
grep -o '<example>' plugins/claude-code/agents/*.md     # 6 blocks (3 agents x 2)
ls plugins/claude-code/skills/                          # 12 skill dirs
ls .opencode/skills/                                    # 4 skill dirs
find .opencode/skill -type f                            # project-orchestration (8 files)
                                                        # + task-management/tests (2 files)
find .opencode/context -name '*.md' -type f | wc -l     # 293
find .opencode/context -type l                          # code.md, docs.md, tests.md
git ls-files -s <3 symlinks> plugins/claude-code/context  # all mode 120000
readlink plugins/claude-code/context                    # ../../.opencode/context
find .opencode/command -name '*.md' | wc -l             # 20
ls plugins/claude-code/commands/                        # 6 files
grep -rn 'standards/(code|docs|tests)\.md'              # §7.2 reference table
python3: registry components with aliases[]             # 3 (contexts), lines 1563-1589
python3: registry standards duplicate ids               # standards-code+code-quality, etc.
git log -1 per dual-home pair                           # CC newer on all 7
```
