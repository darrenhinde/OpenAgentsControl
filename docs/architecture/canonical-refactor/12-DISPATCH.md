# 12 — Dispatch Guide (for subagents executing the refactor)

> **Status:** Operational — read this BEFORE starting any subtask.
> **Date:** 2026-07-15 · Companion to `07-EXECUTION-PLAN.md` and `08-STRUCTURE-AND-PACKAGING.md`.
> Task briefs live at `.tmp/tasks/canonical-refactor/` (task.json + subtask_01–31).
> They are worktree-local (gitignored); this doc is the durable contract.

---

## Environment

- **Work here:** `/Users/darrenhinde/Documents/GitHub/MYBUSINESS/worktrees/OpenAgentsControl/refactor-canonical`
  on branch **`refactor/canonical`**. Never work in the main checkout.
- The main checkout is at `../../../OpenAgentsControl` — read-only reference (e.g. comparing
  live plugin state); never write there.
- `.env` files are present in this worktree (untracked); never commit, move, or glob them
  into any build output.
- **Never use bare `git stash`** — the stash stack is shared across all worktrees.

## Doc map (canonical numbering — do not create colliding numbers)

| Doc | Content | Exists? |
|---|---|---|
| 00–06 | Spec set + adversarial review | ✅ |
| 07 | Execution plan (stages, gates, kill criteria) | ✅ |
| 08 | Repo structure, build flow, packaging (`@controlstack/oac`) | ✅ |
| 09 | MERGE-RULES (created by subtask 08; signed off by subtask 10) | ✅ |
| 10 | PRECEDENCE-EXPERIMENT transcript (created by subtask 09) | ✅ |
| 11 | ROLLBACK story (created by subtask 10) | ✅ |
| 12 | This dispatch guide | ✅ |

Where a subtask brief and a spec doc conflict, precedence is:
**06-REVIEW dispositions > 08 > 07 > 00-INDEX > 01–05**. Anything still ambiguous:
STOP and report — do not guess.

## Current runtime facts (verified 2026-07-15 — so you don't guess)

- `packages/cli` — tests run under **`bun test`** today; **15 files use Bun-only APIs**
  (`Bun.file`/`Bun.write`/`Bun.version` in `lib/installer.ts`, `lib/config.ts`,
  `lib/registry.ts`, `lib/manifest.ts`, `lib/sha256.ts`, `lib/bundled.ts`,
  `lib/ide-detect.ts`, `commands/apply.ts`, `commands/doctor.ts`; `import.meta.dir` in
  `lib/bundled.ts:37`). Bun removal is **Stage 5 (subtask 25)** — until then, Stage-0 CI
  runs cli tests with Bun installed via setup action. Do NOT introduce new Bun APIs anywhere.
- `packages/compatibility-layer` — **vitest**, Node-clean (zero Bun usage). New packages
  (`packages/core`, `packages/adapters`) use **vitest** (locked, `05` Q1).
- `packages/plugin-abilities` — **deleted** (commit `cce5255`). It had zero consumers in its
  entire history, did not compile, and failed 23 of its own tests. `packages/` is now exactly
  `cli` and `compatibility-layer`. Do not re-add it or reference it.
- `evals/framework` — has NO ESLint config; its deterministic baseline = build + the
  `test:ci` vitest allowlist + `validate:suites:all`. Do not add lint gates to it in Stage 0.
- Context census is recorded from disk in `09-MERGE-RULES.md` §9. Recount before asserting it
  after any content-tree change; historical numbers in `00`–`07` are not runtime authority.
- CC plugin agents live in `plugins/claude-code/agents/` (7 agents: 5 `sonnet`, 2 `haiku`).
  `.claude-plugin/marketplace.json` is live production config — touch only when a brief says so.

## Build & code standards

- TypeScript strict; no `any` without a comment justifying it; Node ≥ 20 APIs only.
- Load the context standards listed in your brief's `context_files` before writing code
  (canonical names: `code-quality.md`, `documentation.md`, `test-coverage.md`,
  `typescript.md`, `security-patterns.md` under `.opencode/context/core/standards/`).
- **Tests ship with the feature, never after.** A subtask whose acceptance criteria mention
  a test is not done until that test runs in CI.
- Determinism rules for anything that writes files: stable input sort, no timestamps in
  content, fixed key order (07 Stage 3 / 04 §2.1).
- Match surrounding code style; do not reformat files you aren't changing.

## Commits & PRs

- Conventional commits (`feat:`/`fix:`/`docs:`/`chore:`/`test:`), one commit per coherent
  change, subtask id in the body (e.g. `Task: canonical-refactor-01`).
- **No Claude/AI co-author or generated-by lines in commits or PRs. Attribute to the user only.**
- Small PRs into `refactor/canonical`; the branch merges to `main` per completed stage.

## Execution protocol

1. Read your `subtask_NN.json` fully; read every `reference_files` entry (or the cited
   sections for large docs) and this guide.
2. Verify claims against disk before acting on them — counts, paths, and line numbers in
   briefs were verified at authoring time but the tree moves.
3. Implement; run the relevant tests locally; then run verification
   (oac:verification-before-completion — evidence before assertions, paste command output).
4. Commit. Update your subtask JSON: `status: "completed"` plus a `result` note
   (what changed, evidence, any deviations).
5. **Stop-and-report conditions** (do not improvise): a gate test fails in a way that
   suggests a spec error; you hit a kill criterion (07 §Kill); a brief contradicts disk
   reality; newly-discovered failures outside your scope (user requires stop-and-approve
   before fixing pre-existing breakage).

## Parallelism rules

- Only run subtasks marked `parallel: true` concurrently, and only when their
  `deliverables` touch disjoint files. Same worktree = shared working tree: overlapping
  edits are forbidden.
- Gate subtasks (10, 16, 20, 24, 28) run **alone** after their dependencies complete.
- Stage order is strict 0→1→2→3→4→5→6 (Stage 1 docs may overlap Stage 0).
