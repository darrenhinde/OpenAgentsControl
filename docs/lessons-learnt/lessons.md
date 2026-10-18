# Lessons learnt

Format: **What happened** · **Lesson** · **Rule now**. Newest last.

---

## L-001 A regeneration silently regressed the Claude Code plugin

- **What happened:** commit `104356a` overwrote all 7 hand-written Claude plugin agents with output generated from OpenCode-shaped source. Their `<example>` dispatch blocks disappeared, 43 `.opencode/` paths leaked in, and `code-reviewer` was told to call ContextScout while `Task` was disallowed. The drift gate didn't cover `plugins/claude-code/`, and the golden test was skipped.
- **Lesson:** a "parity" check that passes because the output was copied over the source proves nothing.
- **Rule now:** every shipped tree is covered by a drift or golden test. Claude agents are hand-written and compare-only (D-001). A skipped test needs an issue link and an owner.

## L-002 A host release can break everything at once

- **What happened:** OpenCode v2 (2026-09-11) made agent IDs path-derived and ignored `name:`, which broke delegation by name (#362). It also stopped loading `.opencode/tool/` and v1 plugins (#367). OAC declared no supported OpenCode version, and five different pins were scattered across the repo.
- **Lesson:** a framework on top of agent tools absorbs every breaking change they ship.
- **Rule now:** one supported-version table; pinned versions on PRs and the latest versions nightly (D-008); `oac doctor` warns outside the range.

## L-003 A trailing catch-all deny hides the tool entirely

- **What happened:** 12 agents listed `allow` rules and then a final `"*": "deny"`. With last-match-wins, every call was denied and OpenCode hid the tool from the model (#349). The same bug class appeared in another framework (wshobson).
- **Lesson:** permission order is semantic, and a list that looks right can be useless.
- **Rule now:** a build lint rejects a trailing catch-all deny after allows, and a host-load test asserts the visible tool set on real OpenCode.

## L-004 Count-based test floors break on deliberate changes

- **What happened:** `reference-resolution.test.ts` asserted more than 200 profile references. Deliberate removals (the agent-metadata sidecar, maintainer-only context) took it to 197 and turned CI red on a correct change.
- **Lesson:** assert the property you care about, not an incidental count.
- **Rule now:** floors carry a comment saying what they guard, or get replaced by a property assertion.

## L-005 Branch-specific facts drift in notes and memory

- **What happened:** a planning risk assumed the old bun/npm three-lockfile setup. On `refactor/canonical`, `pnpm-lock.yaml` is the only lockfile; the trio still exists on `main`.
- **Lesson:** a fact about the repo is true for a branch at a commit, not forever.
- **Rule now:** verify on disk before building on a remembered fact, and state which branch a fact applies to.

## L-006 Agent test isolation has non-obvious leaks

- **What happened:** OpenCode walks parent directories for `.opencode/`, so a fixture inside the repo or home folder picked up real config. Commands without `--standalone` reached the user's running OpenCode service. The first run in a fresh HOME downloads the provider package and can time out. Claude Code's `--bare` skips plugin hooks, so it can't be used for gate tests.
- **Lesson:** a throwaway HOME is necessary but not sufficient.
- **Rule now:** temp repos live under `$TMPDIR`, outside `$HOME` and the repo. Use `--standalone` and a shared package cache. A self-test checks config sources before any scenario. Run under a sandbox profile, then check for leaks afterwards (D-013).

## L-007 Research claims need labels and spot-checks

- **What happened:** research agents produced useful reports, but several claims were wrong or unverifiable until checked against real source or tools. Examples: the lockfile risk, an unverifiable Discussion quote, and the eval harness facts marked [F†].
- **Lesson:** model-written research is a lead, not a fact.
- **Rule now:** label claims [F], [F†] or [O]. Verify by hand every claim a decision or build step depends on, and record it in the findings log.

## L-008 Misleading script names

- **What happened:** root `pnpm test` and `pnpm test:ci` run a live model on the removed v1 OpenCode SDK. They aren't the deterministic suite their names suggest.
- **Lesson:** names are an interface.
- **Rule now:** `pnpm test:local` is the safe entry point. Live-model scripts carry `live` in their name.

## L-009 Unmeasured claims hurt trust

- **What happened:** the README claimed "80% reduction", "context files <200 lines" (false for 82 of 297), commands that don't exist (`/oac:setup`, `/oac:plan`) and an npm install that returns 404. Issue #281 had no reply for months.
- **Lesson:** every false claim costs more trust than the true ones earn.
- **Rule now:** no number in the README without a published run behind it. Every README claim maps to a scorecard row or gets removed.

## L-010 Shell gotchas in quick scripts

- **What happened:** zsh treated `=====` as a command lookup and `$c:r` as a path modifier, breaking ad-hoc commands mid-run.
- **Rule now:** suite scripts are `bash` with `set -u`. Quote and brace variables (`"${c}:path"`), and don't use bare `=` separators.

## L-011 Building the local suite: what the sandbox work turned up

- **What happened:** building `pnpm test:local` (evals/v2) on this Mac hit five surprises.
  - A content-hash snapshot of `~/.claude` would itself read the maintainer's config. The live Claude Code session also rewrites `~/.claude.json` every few seconds, so any snapshot including it reports a false breach.
  - `opencode debug config` has no `--standalone`. It works only through a managed service, so the self-test starts a private service on a free port inside the throwaway HOME and stops it in a `finally`. A service left by an earlier planning probe (port 49999) was still running over an hour later.
  - OpenCode v2.0.30 needed no provider download: `@ai-sdk/openai-compatible` resolved with an empty per-run cache and no network, so no shared package cache is needed.
  - The plan's counts were slightly off once measured: 33/34 agent IDs are path-derived, because `eval-runner.md` sits at the top level, and there are 107 unresolved subagent references, because task keys count as well as prompt strings.
  - `pnpm --filter <pkg> exec` prints `undefined` and `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` whenever the suite exits non-zero, which buries the table. `pnpm --dir evals/v2 exec` doesn't.
- **Lesson:** isolation checks must not become the leak. Measured numbers beat planned ones.
- **Rule now:** outside-file snapshots use `lstat` only and skip files live sessions churn. Every service a test starts is stopped in a `finally` and checked afterwards. Known-red rows quote the measured count, never the plan's.
