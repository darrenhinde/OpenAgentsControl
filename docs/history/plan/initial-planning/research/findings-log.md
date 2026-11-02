> Initial planning record (2026-10-16..18), frozen. Current plan: [../../ROADMAP.md](../../ROADMAP.md) · decisions: [../../../lessons-learnt/decisions.md](../../../lessons-learnt/decisions.md)

# Planning-fix findings log

Research for fixing OAC after the OpenCode v2 upgrade. Branch `refactor/canonical` (draft PR #342).
Started 2026-10-16.

## Files in this folder

| File | What it is | Status |
|---|---|---|
| `00-findings-log.md` | This log: what was verified by hand, and decisions made | living |
| `research-issues.md` / `.json` | Triage of 125 issues (42 open) + 29 open PRs | done |
| `research-architecture.md` | How the repo works on refactor/canonical; refactor stages; weak points | done |
| `research-opencode-v2.md` | What OpenCode v2 changed, mapped to OAC files | done |
| `01-strategy-synthesis.md` | How the strategy review changed the repair plan | done |
| `research-landscape-gaps.md` | Keep/change/cut evidence, ideas the summaries missed, user quotes | done |
| `research-dev-pipelines.md` | Pipelines and gates, PR freshness, onboarding, settings, UX | done |
| `research-verification.md` | Host signals, test layers L0–L5, harness, decision log | done (19 [F†] host facts unverified) |
| `02-product-plan.md` | Product plan: pitch, core/add-ons, pipelines, freshness, onboarding, test-first order, scorecard | done (R9 corrected) |
| `03-consistency-and-value.md` | Cross-host scenarios, limits, ship gate, value/simplicity review | done |
| `poc/` | Working cross-host test: fake model + real Claude Code 2.1.301 + OpenCode v2.0.30 | passing |
| `07-test-suite-plan.md` + `scratch-testplan/` | Local test suite plan (tiers, sandbox, build order); probe scripts incl. `t2-probe.sh`, `agent.sb` | done |
| `oac-repair-plan.html` | Published page: https://claude.ai/artifact/SVYR8c5AEomxQPoSiCYbyP | v4 |
| `oac-plan.template.html`, `_product.html`, `_tests.html`, `_style.css`, `_fig-today.html`, `artifact-data.json`, `build-page.js` | Page source. Rebuild with `node build-page.js` | source |

Agent reports are model output. Claims marked "verified" below were checked by hand; everything else should be re-checked before acting on it.

## Branch state (verified 2026-10-16)

- `refactor/canonical`: 46 commits ahead of main, 0 behind, mergeable, draft.
- CI on 0b84561 had 2 real failures, both fixed locally in two commits (not pushed yet):
  - `a4c8ab3`: `reference-resolution.test.ts` floor `>200` was stale. Profile refs went 209 → 204 → 197 through deliberate removals (`config:agent-metadata` retired; `config:readme` and `context:openagents-repo/*` dropped from user profiles). Floor lowered to 150.
  - `d7924e4`: vitest 1.6.1 → 3.2.7 (GHSA-5xrq-8626-4rwp, critical, fixed in 3.2.6) in compatibility-layer and evals/framework. Failed Dependency Review.
- Local after the fixes: compat build/lint/test (553 pass), cli typecheck/build/test, `make check-canonical-drift`, evals build, `test:ci` (112), `validate:suites:all`: all pass.
- `feature/oac-package-refactor-v2` worktree: 7 months stale, 14 ahead / 11 behind main. Likely superseded by canonical (inferred).

## Spot-checks of agent claims

- **#349 permission ordering: VERIFIED.** `content/agents/subagents/code/build-agent.md` lists bash allows first, then `"*": "deny"` last. With last-match-wins, every command, `tsc` included, is denied. 21 canonical agents have a `"*": deny` rule somewhere; the triage says 12 put it last (not yet recounted).
- **Tool barrel `.opencode/tool/index.ts`: PLAUSIBLE.** It re-exports non-tool helpers (`loadEnvVariables`, `getApiKey`, ...) and a type alongside the gemini tools. Whether OpenCode ≥1.14.49 crashes on this is not reproduced yet (PR #316).

- **`@controlstack/oac` is not on npm: VERIFIED.** `npm view` gives E404, yet `README.md:125` tells users `npm i -g @controlstack/oac`. Merging the README before publishing would point users at a package that doesn't exist.
- **Claude agents lost their `<example>` dispatch blocks in 104356a: VERIFIED.** `plugins/claude-code/agents/coder-agent.md` had 2 `<example>` blocks before that commit and has 0 now. 104356a rewrote all 7 Claude agents, which contradicts the "Claude body wins" rule in 09-MERGE-RULES. Claude Code uses those examples to decide when to dispatch a subagent, so this is a probable behaviour regression for the plugin.

- **v2 agent IDs come from the file path; frontmatter `name:` is ignored: VERIFIED** in OpenCode v2.0.31 source, `packages/core/src/config/plugin/agent.ts` ~L180-208. The key is `relative(path)` minus the `agent/` prefix and `.md`. v1 (`config/agent.ts`) spread `...md.data` after `name`, so frontmatter overrode it. So `.opencode/agent/subagents/core/contextscout.md` becomes `subagents/core/contextscout`. This explains #362 and breaks `subagent_type="ContextScout"` delegation and `task: contextscout: allow` rules.
- **v2 doesn't scan `.opencode/tool/`: VERIFIED.** No `{tool,tools}` glob in v2 packages outside the `v1/` migration code. OAC's gemini/env/template tools vanish under v2.
- v2 source (v2.0.31) and v1 source (v1.19.3) are downloaded to the session scratchpad `src/` for re-checking citations; the folder is temporary.

- **apilot fork has v2 work: VERIFIED.** `apilot/OpenAgentsControl`, created 2026-10-01, last push 2026-10-07, 0 stars. Commits include "migrate agent frontmatter to OpenCode V2 permissions format" and a v2 API smoke run.

- **Product-plan spot-checks (2026-10-18): VERIFIED.** `Makefile:172` has the drift gate; `doctor` has `--json`; `init` has `--dry-run`. `coder-verification` only string-matches and shows toasts, so it never blocks. The SessionStart hook tells Claude to run context-discovery every session.
- **Claude Code 2.1.301 has `--output-format=stream-json` and `claude plugin eval`: VERIFIED** locally. The `permission_denials` result field was not checked; that would need a model call.
- **Product plan R9 was wrong; CORRECTED.** It assumed the bun/npm lockfile split. On `refactor/canonical`, `pnpm-lock.yaml` is the only lockfile; the old trio exists only on `main`. `evals/v2` should join the pnpm workspace.

- **Cross-host conformance PoC: PASSING (2026-10-18).** Scripted `.env` read through a fake model. Claude Code (PreToolUse hook) and OpenCode v2 (permission deny) each blocked 3/3 with 0 canary leaks; both unguarded controls leaked. 1–2 s per trial, $0. Confirms the mock base URL works on both hosts, `permission_denials` is in the CC stream, and the v2 tool names are `shell`/`subagent`/`execute`. Run with `poc/run-claude.sh` and `poc/run-opencode.sh` (`guarded` or `unguarded`).

- **OpenCode v2 load test (T2 prototype): REPRODUCED 2026-10-18.** `scratch-testplan/t2-probe.sh` boots all 34 generated agents under real opencode v2.0.30 (scrubbed env, throwaway HOME, `--standalone`) in 25 s. All 34 boot. 9 are offered no `shell` and 12 no `subagent`; the test plan's narrower count, tools lost despite allow rules, is shell 3 and subagent 10 (#349). The repo is unchanged afterwards.
- **Isolation leaks found by the test-suite agent:** OpenCode walks parent dirs for `.opencode/` (fixtures must live outside `$HOME` and the repo), and non-`--standalone` commands hit the user's real managed OpenCode service. Every run must use `--standalone` with a temp dir under `$TMPDIR`. `--bare` in Claude Code skips plugin hooks, so it's unusable for gate tests.
- **Naming trap:** root `pnpm test` / `pnpm test:ci` run a live model on the removed v1 SDK. They are not the deterministic evals `test:ci`.

## Decisions

- Newly discovered failures are reported first and fixed only after the maintainer approves.
