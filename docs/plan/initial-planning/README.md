# Initial planning record (phase 1, 2026-10-16..18)

This folder is the frozen record of the first planning phase after the OpenCode v2 break. It was written in `.tmp/planning-fix/` (machine-local, gitignored) and moved here on 2026-10-18 so nothing is lost.

**Where these files differ from [../ROADMAP.md](../ROADMAP.md) or [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md), the roadmap and the decisions win.** Don't edit these files to track progress. Edit the roadmap.

Claims are labelled **[F]** fact, **[F†]** host fact from docs not re-checked, **[O]** opinion. Model-written research is a lead, not a fact (L-007).

## Reading order

| # | File | What it is |
|---|---|---|
| 1 | [research/findings-log.md](research/findings-log.md) | Index of the phase and the hand-verified facts (was `00-findings-log.md`). Start here. |
| 2 | [01-strategy-synthesis.md](01-strategy-synthesis.md) | How the maintainer's strategy review changed the repair plan. |
| 3 | [02-product-plan.md](02-product-plan.md) | Product plan: pitch, core and add-ons, pipelines, freshness, onboarding, test-first order, scorecard (§7), risks. **§10 amendments supersede earlier sections.** |
| 4 | [03-consistency-and-value.md](03-consistency-and-value.md) | Cross-host proof of concept, the six ship-gate rules, parity limits, value review. |
| 5 | [04-user-journey.md](04-user-journey.md) | How a user sets OAC up and knows it works over two weeks. |
| 6 | [05-modular-architecture.md](05-modular-architecture.md) | The nine modules, gate template, dependency rules, migration from today's layout. |
| 7 | [06-open-source-strategy.md](06-open-source-strategy.md) | Stay MIT; 14-day trust recovery; 90-day plan; naming and supply-chain risks. |
| 8 | [07-test-suite-plan.md](07-test-suite-plan.md) | The local test suite (`pnpm test:local`): tiers, sandbox, build order (steps 1–10), CI mapping. |
| 9 | [scenarios-catalog/](scenarios-catalog/) | 182 scenario rows and 43 seed YAMLs. `CATALOG.md`, `PRIORITY.md` (build order), `SCORECARD.md`, `RUNNER-NEEDS.md`, `GAPS.md`. The next test-suite step reads it. |
| 10 | [poc/](poc/) | The working cross-host proof of concept: fake model + real Claude Code + OpenCode v2 blocking a `.env` read. |

## Supporting material

| Folder | Contents |
|---|---|
| [research/](research/) | `research-architecture.md`, `research-opencode-v2.md`, `research-issues.md` + `.json` (issue/PR triage), `research-landscape-gaps.md`, `research-dev-pipelines.md`, `research-verification.md`, `review-mission-alignment.md` (the review that restored plan-first and approval, D-003). |
| [strategy-review/](strategy-review/) | The maintainer's strategy review (was `research_notes/OAC strategy review/`): direction and refactor, approach and niche, peer lessons. |
| [landscape/](landscape/) | The maintainer's harness landscape research (was `research_notes/Coding agent harness landscape/`), plus the summary report `coding-agent-harness-landscape.md` (was `reports/Coding agent harness landscape.md`). |

## Old paths used inside these files

The documents cite their old locations. Map them like this:

| Cited as | Now at |
|---|---|
| `.tmp/planning-fix/0N-*.md` | `./0N-*.md` |
| `.tmp/planning-fix/00-findings-log.md` | `research/findings-log.md` |
| `.tmp/planning-fix/research-*.md`, `review-mission-alignment.md` | `research/` |
| `.tmp/planning-fix/poc/` | `poc/` |
| `research_notes/OAC strategy review/` | `strategy-review/` |
| `research_notes/Coding agent harness landscape/` | `landscape/` |
| `reports/Coding agent harness landscape.md` | `landscape/coding-agent-harness-landscape.md` |
| `scratch-testplan/*` | not kept: every probe was ported into `evals/v2` (see below) |
| `oac-repair-plan.html`, `oac-plan.template.html`, `_*.html` | not kept: built page and its source. Its content lives in `02` and the roadmap. Published copy: https://claude.ai/artifact/SVYR8c5AEomxQPoSiCYbyP |

## What was left out, and why

- **Built HTML, `_*.html` partials, `_style.css`, `artifact-data.json`, `build-page.js`:** page build output and source. The content is in `02`–`07` and the roadmap.
- **`scratch-testplan/`:** throwaway probes, run logs and JSONL. Each probe now has a home in `evals/v2`: `baseline.sh` → `evals/v2/src/checks/*`; `iso.sh` → `evals/v2/src/sandbox/run-isolated.sh`; `agent.sb` → `evals/v2/src/sandbox/profiles/agent.sb`; `t2-probe.sh` → `evals/v2/src/checks/oc-agents.ts`; `probe-mock.js`, `probe-anthropic.js`, `delegate-mock.js`, `bash-mock.js` → `packages/compatibility-layer/src/verify/fake-model/server.ts`. `deny-write.sb` held machine-specific temp paths and was an early variant of `agent.sb`.
- **`.cache/` dirs and run output:** machine-local.
- **`NORTH_STAR.md` draft:** [../../NORTH_STAR.md](../../NORTH_STAR.md) is canonical.

## Running the proof of concept

```bash
bash docs/plan/initial-planning/poc/run-claude.sh guarded     # expect PASS
bash docs/plan/initial-planning/poc/run-claude.sh unguarded   # expect "PASS (control leaked…)"
bash docs/plan/initial-planning/poc/run-opencode.sh guarded
bash docs/plan/initial-planning/poc/run-opencode.sh unguarded
```

Needs `claude` and `opencode` on `PATH`. The fixture secret ships as `fixture/env.fixture` (a canary, not a real key) because `.env` is gitignored; the scripts copy it to `.env` in a temp dir. The OpenCode package cache goes to `$TMPDIR/oac-poc-cache`. The maintained version of this test is `pnpm test:local hosts` (`scn/secrets-read-env`).
