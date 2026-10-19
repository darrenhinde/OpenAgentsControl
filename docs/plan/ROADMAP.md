# OAC roadmap

**Last updated:** 2026-10-18, at `d74b370` on `refactor/canonical`.

This is the living plan: where OAC is, what's next, and what each release must prove. Detail lives in [initial-planning/](initial-planning/README.md) and the reasons in [decisions.md](../lessons-learnt/decisions.md). Where those differ from this file, this file and the decisions win.

Effort: **XS** under 1 h · **S** under 1 day · **M** 1–3 days · **L** about 1 week or more. Owner: **maintainer** (needs a human: GitHub, npm, approvals, public posts) or **agent** (a coding agent does it, the maintainer reviews).

---

## 1. North star

OAC keeps you in control of the coding agents on your real projects: you approve what an agent sets out to do, and the tool, not a prompt, enforces your rules on OpenCode, Claude Code and Codex alike. It keeps context lean and current, and proves with tests you can run that your rules hold. Full text and the six promises: [../NORTH_STAR.md](../NORTH_STAR.md) (D-002).

---

## 2. Status now (2026-10-18)

### Branch

| Item | State |
|---|---|
| Branch | `refactor/canonical`, draft PR #342. 56 commits ahead of `main`, 0 behind. |
| Pushed | `origin/refactor/canonical` is 10 code-and-docs commits behind local (see below), plus the `docs/plan/` commits. CI on the pushed head had 2 real failures, both fixed in the unpushed commits. |
| Canonical build | Done: one source in `content/`, `oac build` emits `.opencode/` and `registry.json`, drift gate in CI, Node-only CLI, one version (1.1.0). Claude output is meant to be hand-written and compare-only, but `104356a` regenerated it (L-001); restoring it is v1.1 work. |
| Local test suite | `evals/v2`, run with `pnpm test:local quick` (L0, ~40 s) or `pnpm test:local hosts` (+ real OpenCode v2.0.30 and Claude Code 2.1.302 against a fake model, sandboxed, $0). Build steps 1–4 of [07 §6](initial-planning/07-test-suite-plan.md) are done. |
| Latest run | `hosts` at `d74b370`: **28 pass / 8 known-red / 0 unexpected**, exit 0, 1m17s. Canary 0/24 leaks, 43 sandboxed host runs, outside files unchanged. |

Per area in that run: Build 8/8, Context 3/3, Installer 4/4, Evals 5/5 all green. Policy/gates 0 pass + 2 known. OpenCode v2 load 2 + 3 known. Claude Code load 1 + 2 known. Cross-host scenarios 5 + 1 known.

### Commits not yet pushed

| sha | Commit |
|---|---|
| `a4c8ab3` | test(build): lower the profile-reference floor to match deliberate removals |
| `d7924e4` | fix(deps): upgrade vitest to 3.2.7 to clear GHSA-5xrq-8626-4rwp |
| `833d342` | docs: record north star, product decisions and lessons learnt |
| `ecd495b` | feat(install): add OAC_RAW_URL override for local-tree installs (D-014) |
| `ce14548` | test(local): add pnpm test:local runner and wrap existing checks |
| `4e6a922` | test(local): add L0 lints for hidden tools, subagent IDs, v1 artifacts and CC examples |
| `5720ccb` | test(local): run the .env scenario on both hosts under the sandbox |
| `9fac36e` | test(local): add T2 OpenCode v2 agent load test and delegation scenarios |
| `57fc523` | docs(lessons): add L-011 from building the local suite |
| `d74b370` | docs(decisions): add D-015 guarded-not-locked control protection |

### Known-red checks ([`known-red.yaml`](../../evals/v2/src/checks/known-red.yaml))

A known-red row shows ✗ but doesn't fail the run. If it starts passing, the run fails until the row is removed (strict xfail). Counts are as measured on 2026-10-18.

| Check | Ref | Green by | What's wrong today |
|---|---|---|---|
| `gates/subagent-keys-exist` | #362 | v1.2 | 107/107 subagent refs name display names (ContextScout), not v2 path IDs |
| `oc/flat-ids` | #362 | v1.2 | 33/34 agent IDs are path-derived (`core/openagent`); flat names don't resolve |
| `scn/delegate-by-name@opencode-v2` | #362 | v1.2 | Delegating with `agent:"ContextScout"` fails: Unknown agent |
| `oc/no-v1-artifacts` | #367 | v1.2 | `.opencode/tool/**` (4 modules) and 3 v1 plugins never load on OpenCode v2 |

Expected to join the list as steps 5–7 land: `cc/sessionstart-payload` (v1.1; 158 lines / 18.9 KB injected, limit 3), `scn/destructive@claude-code` (v1.4), `inst/doctor-flags-v2` (v1.2).

---

## 3. Now / Next / Later

### Now (in flight)

| Item | Owner | State |
|---|---|---|
| Test-suite steps 5–7 (Next 1–3) | agent (builder) | in progress on this branch, under `evals/v2/` and `packages/compatibility-layer/src/{verify,hosts}` |

### Next (in order)

| # | Step | Owner | Effort | Done when |
|---|---|---|---|---|
| 1 | **Test step 5:** Claude Code load area: `cc/plugin-validate`, `cc/marketplace-validate`, `cc/plugin-load`, `cc/sessionstart-payload` | agent | S | `hosts` shows the CC load area; `cc/sessionstart-payload` is known-red with the measured line count |
| 2 | **Test step 6:** YAML scenario schema + runner reading [scenarios-catalog](initial-planning/scenarios-catalog/RUNNER-NEEDS.md); `scn/secrets-shell-cat`, `scn/destructive-rm` (known-red), `scn/benign-read-src`, `scn/write-outside` | agent | M | 6 scenarios × 2 hosts × (guarded + control) run in `hosts`; every control arm fails |
| 3 | **Test step 7:** `inst/oac-init-doctor`, `inst/init-boots-on-v2`, `inst/doctor-flags-v2` (known-red), `inst/install-sh-local` via `OAC_RAW_URL` | agent | S | The installer area covers the real user path offline |
| 4 | **Restore the 7 hand-written Claude agents** from `main`. Keep only the protected-paths advisory (`8e12c63`) and re-apply the sidecar-text removal (`5c7d4cc`). Fix the stale `build.ts` header; turn the skipped golden test into an explicit "hand-written; staged diff is informational" check | agent | M | `cc/agent-dispatch-examples` passes and leaves `known-red.yaml`; no `.opencode/` paths in `plugins/claude-code/agents/` (L-001) |
| 5 | **#349 reorder in `content/`:** catch-all rules first, allows after; keep the build lint | agent | S | `gates/no-hidden-tools` and `oc/agents-tools-visible` pass and leave `known-red.yaml` |
| 6 | **Trim the SessionStart payload** to at most 3 lines; stop telling Claude to run context-discovery every session (D-010) | agent | S | `cc/sessionstart-payload` passes (≤ 3 lines) |
| 7 | **Marketplace `categories` field:** remove it, or move it where the schema allows | agent | XS | `cc/marketplace-validate` passes |
| 8 | **PR #316:** drop the helper re-exports from `.opencode/tool/index.ts` | agent | XS | Barrel exports tools only; OpenCode 1.14.49+ first prompt doesn't crash |
| 9 | **README truth pass:** remove `/oac:setup`, `/oac:plan`, dead links, "80% reduction", "<200 lines"; fix skill count; qualify "ALWAYS request approval", "Any language", "Model agnostic"; no CC guardrail or token-efficiency claims (L-009) | agent drafts, maintainer approves | S | Every README claim maps to a scorecard row or a passing check, or is gone |
| 10 | **Migration path** (D-004): `MIGRATING.md` mapping every old agent, command and profile; frozen `oac-classic` tag of today's catalog; Discussion post | agent drafts `MIGRATING.md`; maintainer tags and posts | S | Tag exists on GitHub, `MIGRATING.md` linked from README, Discussion live |
| 11 | **npm scope decision** (open decision 1 below), then publish with `--provenance` and deprecate the other name | maintainer | XS decide, S publish | `npm org ls controlstack` result recorded as a new decision; README install line resolves on npm |
| 12 | **Reply to security issue #327** and point at private vulnerability reporting | maintainer | XS | Reply posted (can be done today; it has waited since 2026-06-27) |
| 13 | **Push, get #342 green, merge** | maintainer | S | CI green on PR #342; merged to `main` |
| 14 | **Tag v1.1.0:** CHANGELOG 1.0/1.1, close bump PRs #333/#335/#337 and spam, release notes crediting contributors | maintainer | S | v1.1 "ready when" (§4) holds and the tag is published |

### Later (queued, in rough order)

| Step | Owner | Effort | Done when |
|---|---|---|---|
| Community 14-day trust plan (§8): pinned "OAC is maintained" Discussion, PR sweep, reply to silent issues | maintainer | M | §8 checklist done |
| Test step 8: container, `--strict-sandbox`, `.github/workflows/local-suite.yml` (PR: quick + pinned hosts; nightly: latest hosts) | agent | M | The same command runs in CI; nightly opens a "host drift" issue on a diff |
| Test step 9: metering proxy + `live` tier with `--budget` | agent | M | Optional real-model smoke at a known $ cap |
| Test step 10: `gates/_template`, `gates/secrets` → T3, T6; scenarios move into gate folders | agent | M | The Policy/gates area shows real gate rows |
| v1.2 scope (§4) | agent + maintainer | L (4–6 wk) | v1.2 "ready when" |
| Week-8 go/no-go (§6) | maintainer | XS | Decision recorded as a new D-NNN |

---

## 4. Releases

Scorecard rows are from [02 §7](initial-planning/02-product-plan.md) plus the two rows [SCORECARD.md §2](initial-planning/scenarios-catalog/SCORECARD.md) adds (regression baseline, self-protection). Scenario IDs are from the [catalogue](initial-planning/scenarios-catalog/CATALOG.md). D-009 moved the size router, impact graph and plan gate from v1.4 to v1.5; 02 §7 still tags them v1.4, and D-009 wins.

### v1.1: ship what exists, truthfully (~1 week of work; target within 2–3 weeks)

- **Scope:** Next 4–14 above. Nothing new gets built (D-001). #349 is in v1.1 (open decision 2).
- **Known-reds that must turn green:** `gates/no-hidden-tools`, `oc/agents-tools-visible`, `cc/marketplace-validate`, `cc/agent-dispatch-examples`, and `cc/sessionstart-payload` once step 5 adds it.
- **Scenarios:** `load/no-hidden-tools-lint`, `load/oc-tools-visible`, `load/cc-agent-dispatch-examples`, `context/sessionstart-payload`, `load/cc-plugin-validate`, `load/cc-plugin-load`.
- **Scorecard rows:** Install truth; SessionStart payload (≤ 3 lines); No hidden tools (pulled forward from v1.2).
- **Ready when:** a fresh Claude marketplace install and `npm i -g` both work; PR #342 CI is green; every README claim is true; `pnpm test:local hosts` shows no v1.1 known-reds.

### v1.2: OpenCode v2-native, plus the `.env` demo (4–6 weeks)

- **Scope:** flat agent IDs and generated delegation references (#362); port the enforcement plugins to the v2 API and cut the gemini/image tools (#367); safe v2 defaults (`external_directory: ask`); supported-version table and `oac doctor` check; OpenCode v1.19 and v2 side by side for one cycle (D-008); `oac test` (the user-run self-check, `04`); the `.env` demo on OC v2 and CC with one hand-written plugin PreToolUse hook, shipped as the demand test; decision log rows; review the apilot fork's v2 work; publish a v2 permissions migration guide; start labelling 20 freshness diffs.
- **Known-reds that must turn green:** `gates/subagent-keys-exist`, `oc/flat-ids`, `scn/delegate-by-name@opencode-v2`, `oc/no-v1-artifacts`, `inst/doctor-flags-v2`.
- **Scenarios:** `load/oc-flat-ids`, `load/delegate-by-name`, `load/delegate-by-id`, `load/subagent-keys-exist`, `load/oc-no-v1-artifacts`, `load/init-boots-on-v2`, `load/doctor-flags-v2`, `secrets/read-env`, `secrets/shell-cat`, `secrets/read-env-example.benign`, `secrets/read-src.benign`, `obs/decision-log-schema`.
- **Scorecard rows:** v2 load (100% flat IDs); `.env` demo (0 canary leaks, both hosts); Decision log (T6 schema).
- **Ready when:** T1–T4 and T6 are green on pinned OpenCode v1.19 and v2.0; delegation resolves by ID on v2; the `.env` demo works on both hosts.

### v1.3: skills, context, onboarding (~4–5 weeks)

- **Scope:** `oac init` scan and the three onboarding flows (old, new, monorepo; dry-run first; writes only inside managed blocks); **pattern capture** without a model (lint, format, test layout, imports; D-004, 02 §10.4); `oac uninstall` (#266); `oac.policy` schema v1 (`profile`, `context.*`, `verify`, `areas`; no gates yet) and settings scopes; `context.scout: off | lite | full`, `off` by default (D-010), with the scout ablation plan committed before running; canonical skills in the build (#33); move cut catalog items to an optional extras pack (D-005); lean bootstrap (`startup|clear|compact` matcher); generated README counts and manifests.
- **Scenarios:** `onboarding/*` on 5 fixture repos (incl. `onboarding/legacy-python-no-tests`), `onboarding/settings-precedence`, `context/budgets`, `context/scout-*` (payload size only), `redteam/tamper-local-override`.
- **Scorecard rows:** Onboarding (100% detection; 0 user lines changed outside blocks); Onboarding time (≤ 10 min, ≤ 15 mono, manual); Context budget (≤ 32 KiB / ≤ 200 lines); Private vs team (precedence 100%).
- **Ready when:** onboarding passes on all 5 fixtures; the precedence matrix is 100%; one skill tree; the default install is visibly smaller; the scout ablation plan is committed.

### v1.4: guardrails, `oac.policy` (~5–6 weeks)

- **Scope (D-009 keeps it to these):**
  - **Intent approval** (D-003, 02 §10.2): `gates.intent` team `block`, solo `nudge`. Once per task, before the first source edit. Host plan mode, an interop plan, or `/oac approve` typed by the user count.
  - **Verifier, stop and report** (D-003, 02 §10.3): `verify.on_fail` team `report`, solo `fix`. Enforced on CC (Stop); a nudge plus commit-deny and CI on OpenCode.
  - **Guarded, not locked** (D-015): edits to `oac.policy`, `.claude/settings.json`, `opencode.json`, `.oac/**` trigger an **ask** with an explanation, never a default hard deny; every change is logged and shown in `oac report`. Approval only from a human (an agent-written `Approved-by:` doesn't count). A red verifier in `report` mode re-arms the intent gate. A drop in test count counts as a failure unless approved.
  - The policy compiler (secrets, destructive commands, scope) to CC plugin-level hooks and OC v2 permissions + plugin; never a trailing catch-all deny.
  - Generated capability matrix, `oac explain`, `oac doctor --policy`.
  - Freshness in **warn** (CI, CC Stop nudge, OC toast / pre-push).
  - Decision log + `oac report`; nightly L3 smoke (10 tasks × K=3); red-team suite.
- **Known-reds that must turn green:** `scn/destructive@claude-code`.
- **Scenarios** (PRIORITY 19–25 plus the follow-on list): `secrets/path-tricks`, `secrets/read-env-symlink`, `secrets/env-dump`, `secrets/grep-repo-wide`, `destructive/rm-rf-sentinel`, `destructive/git-push-force`, `destructive/git-reset-hard`, `destructive/obfuscated`, `scope/write-outside-repo`, `scope/write-git-dir`, `intent/edit-before-approval`, `intent/approved-then-in-scope.benign`, `intent/approved-then-out-of-scope`, `intent/approved-via-plan-mode`, `verifier/done-on-red`, `verifier/commit-on-red`, `verifier/done-on-green.benign`, `verifier/report-mode-no-autofix`, `redteam/tamper-host-settings`, `redteam/tamper-oac-policy`, `redteam/forge-approval`, `redteam/verifier-sabotage-delete-tests`, `redteam/tool-output-disable-hooks`, `redteam/readme-injection-env`, `pipeline/investigation-readonly`, `pipeline/bugfix-report-before-fix`, `freshness/stop-nudge-once`, `obs/report-totals`, `today/openagent-shell-asks`, `today/contextscout-readonly`, `benign/ts-feature-session`.
- **Scorecard rows:** Policy compiler; Capability matrix; Secrets gate (0 leaks in ≥ 60 attempts per enforcing host, ≤ 2% benign false blocks, hook p95 ≤ 150 ms); Destructive gate (100% corpus, 0/200 benign); Scope escape (0); Investigation read-only (0 writes); Verifier (100% of L2); intent "team: 0 source writes before approval"; stop-and-report "0 unapproved fix edits after a red block"; Freshness warn (precision ≥ 0.8, recall ≥ 0.9); Stop-hook nudge; Self-protection (0 tamper attempts change the effective policy without an ask); Regression baseline (`today/*` 100%).
- **Ready when:** every scorecard row tagged v1.4 passes on both hosts at the level the matrix declares.

### v1.5: Codex and proof

- **Scope:** Codex target (rules + hooks; Codex Stop is a nudge plus CI, 02 R6); published off/on ablations, pre-registered; team lock (`oac.lock`, `oac verify`); supply chain (sha256 in the registry, marketplace submissions); freshness **block** promotion per area (waiver rate ≤ 20% over ≥ 10 firings, never automatic); design and security reviewers as one verdict gate plus checklists; **size router, impact graph and plan gate** (moved here by D-009); scout default decided from data; finish the cleanup (delete `install.sh`/`update.sh` after porting smoke tests, Windows CI, #304, #321).
- **Scenarios:** every catalogue CX (Codex) column; `pipeline/plan-gate-L-addon`, `pipeline/interop-plan-detected`; freshness block; reviewer present/absent; L4 red-team (≥ 60 attempts per host).
- **Scorecard rows:** Codex target; Team lock; Freshness block; Design and security reviewers; Size router; Design impact; Planning; Feature plan gate; Context scout; Verifier cost; Investigation quality; Published proof.
- **Ready when:** every scorecard row tagged v1.5 passes, and every number in the README comes from a published run.

### v1.6+: only on demand

Host descriptors (only for a fourth host), the convention-discovery add-on, the `context-update` skill, an ADR check. Nothing here starts without a user asking (D-009).

---

## 5. Test and scenario plan

Detail: [07-test-suite-plan.md](initial-planning/07-test-suite-plan.md) and [scenarios-catalog/](initial-planning/scenarios-catalog/CATALOG.md). Rule: no scenario, no ship (D-007).

### Tiers

| Tier | Contents | Time | Cost | State |
|---|---|---|---|---|
| `quick` | L0: every existing deterministic check plus the static lints | < 1 min | $0 | built |
| `hosts` | `quick` + L1 host load + L2 fake-model scenarios on real OC v2 and CC, sandboxed | ~1.5 min | $0 | built (steps 3–4), growing in steps 5–7 |
| `live` | `hosts` + L3 smoke with a real small model through a metering proxy | 5–10 min | ≤ `--budget` (default $2) | step 9 |
| `all` | `live` + network checks (installer e2e, marketplace install) | ~10 min | as live | step 9 |

Sandboxing (D-013): scrubbed env, throwaway HOME under `$TMPDIR`, OpenCode `--standalone`, a macOS `sandbox-exec` profile, canary secrets checked after every run, outside-file snapshots. Strict mode is a container with no network (step 8). Isolation leaks found so far: L-006, L-011.

### How known-red works

- Each entry in `known-red.yaml` has `ref` (issue or release), `until` (the release it must be green by) and a one-line `note` with the measured count.
- A known-red row shows ✗ but exits 0. `--strict` makes it fail.
- A known-red row that passes **fails** the run with "fixed? remove it from here". That forces this table and the YAML to stay in step.
- `release-check` (planned) refuses any entry whose `until` is at or below the version being released.

### Scenario build order

The first 10 ([PRIORITY.md](initial-planning/scenarios-catalog/PRIORITY.md)) are today's known-reds, so they define "the refactor works on v2 and CC". The next 15 build the gates on both hosts:

| # | Scenario | Why now | Release |
|---|---|---|---|
| 11 | `secrets/shell-cat` | Catches a permission-only implementation; completes the demo on OC | v1.2 |
| 12 | `secrets/read-env-example.benign` | First "allowed" row; proves the demo isn't in the way | v1.2 |
| 13 | `secrets/read-src.benign` | Pairing partner that makes benign rows count | v1.2 |
| 14 | `obs/decision-log-schema` | T6; later scenarios rely on decision rows | v1.2 |
| 15 | `scope/write-outside-repo` | Makes OC's `external_directory: allow` default visible | v1.2 |
| 16 | `today/openagent-shell-asks` | Settles how asks resolve headless (open decision 3) | v1.2 |
| 17 | `today/contextscout-readonly` | Regression for read-only subagents on both hosts | v1.2 |
| 18 | `load/init-boots-on-v2` | The real user path: what `oac init` writes must boot | v1.2 |
| 19 | `secrets/path-tricks` | First matrix scenario; hardens the demo hook | v1.4 |
| 20 | `intent/edit-before-approval` | Promise 1; the first stateful gate | v1.4 |
| 21 | `intent/approved-then-in-scope.benign` | Once approved, no asks per step | v1.4 |
| 22 | `verifier/done-on-red` | Promise 3 on CC (Stop), nudge on OC | v1.4 |
| 23 | `verifier/commit-on-red` | The OC "done" gate (no Stop on v2) | v1.4 |
| 24 | `redteam/tamper-host-settings` | Self-protection (D-015) | v1.4 |
| 25 | `benign/ts-feature-session` | Realistic false-positive guard; runs on every PR after this | v1.4 |

What a fake model can't test (L3 live, L4 red-team, field data): [GAPS.md](initial-planning/scenarios-catalog/GAPS.md).

### CI mapping (step 8)

| Trigger | Tier | Hosts |
|---|---|---|
| Every PR | `quick` | none |
| PR touching `content/**`, `.opencode/**`, `plugins/**`, `packages/**`, `evals/v2/**` | `hosts` | pinned (`evals/v2/versions.json`) |
| Nightly | `hosts` | latest; opens a "host drift" issue on a diff (D-008, L-002) |
| Weekly + release tag | `all` with `live --budget 5` | pinned + latest; macOS runner for Seatbelt |
| Release gate | `release-check` = `all` + completeness + matrix `--check` | pinned |

Until step 8 lands, the existing `packages-checks` and `pr-checks` workflows are the CI gate.

---

## 6. Week-8 go/no-go (D-012)

**When:** week 8 of the 90-day plan, around 2026-12-14, after v1.2 and the `.env` demo ship.

**Continue to v1.3+ only if at least two of these hold:**

| # | Criterion | How to measure |
|---|---|---|
| 1 | The demo is shared, or people ask to use the policy | Third-party shares, Discussion and issue requests |
| 2 | Monthly stars recover towards 400, or npm downloads reach a few hundred a week | Stargazer timestamps (49 so far in October); npm weekly downloads |
| 3 | 3+ new outside contributors merged | `gh pr list --state merged` since v1.1 |
| 4 | Teams ask for policy features | Issues and Discussions asking for team policy, lock, report |

**Otherwise:** stop at a well-maintained v1.2 as a portfolio piece, and say so publicly with a date (06 §4.4). Record the outcome as a new decision either way.

---

## 7. Open decisions

| # | Decision | Recommendation | Needed by | Owner |
|---|---|---|---|---|
| 1 | **npm scope and brand.** The GitHub org `controlstack` belongs to Control Stack Ltd. (2016); the `@controlstack` npm org exists and ownership is unconfirmed. `@nextsystems/oac@0.7.0` is already yours. | Run `npm org ls controlstack` while logged in. If it's yours, publish `@controlstack/oac` with provenance. If not, ship v1.1 as `@nextsystems/oac` and choose a distinct brand before promoting anything. Add a `TRADEMARK.md` either way. | v1.1 (Next 11) | maintainer |
| 2 | **#349 permission reorder in v1.1 or v1.2.** | v1.1. It's a live bug on v1, under a day of work, and lives in `content/`. `known-red.yaml` already sets `until: v1.1`. Confirm and record as a decision. | v1.1 (Next 5) | maintainer |
| 3 | **How asks are handled in headless runs** ([RUNNER-NEEDS §5](initial-planning/scenarios-catalog/RUNNER-NEEDS.md), [GAPS §4](initial-planning/scenarios-catalog/GAPS.md)). An ask only guards if a human says no. The poc used `opencode run --auto`, which approves asks. | Grade attacks with `asks: reject` and the host's own ask event as "asked"; run a second `asks: approve` arm that is reported, not graded. OpenCode: use the in-process SDK and `session.permission.reply`. Claude Code: a small stdio MCP stub for `--permission-prompt-tool` that logs to `asks.jsonl`. Verify both on the pinned versions before any **ask** row is trusted (scenario 16). Needed before D-015's asks can be tested. | v1.2 (before scenario 16) | agent verifies, maintainer approves |
| 4 | **Obfuscated shell** (`destructive/obfuscated`, GAPS §3) | Unparseable command ⇒ `ask` (team: block); scan script bodies before `bash x.sh`; list the residue as a limit in the matrix. | v1.4 | maintainer |
| 5 | **Network egress** (`redteam/network-exfil`) | Out of v1 scope: list as `unsupported` in the matrix, rely on the host sandbox, revisit at v1.5+. | v1.4 | maintainer |

GAPS §3's other design gaps (self-approval, unenforced "never auto-fix", verifier sabotage, self-protection) are settled by D-015.

---

## 8. Community and open source

Stay fully open under MIT; protect the name, not the code; paid features, if ever, only for multi-repo aggregation and not before about 150 public repos use `oac.policy` (D-006). Detail: [06-open-source-strategy.md](initial-planning/06-open-source-strategy.md).

### First 14 days: trust recovery

| Step | Owner |
|---|---|
| Reply to #327 (security) today; point at private vulnerability reporting | maintainer |
| Pinned "OAC is maintained, here's the plan" Discussion and README banner, linking the north star and this roadmap | maintainer |
| Sweep the 20 outside PRs: merge, "superseded by canonical, thank you", needs-rebase, or out of scope (point to the extras pack). Close the 3 stale bot bump PRs | maintainer, agent drafts replies |
| Reply to every unanswered issue (about 21), even "confirmed, tracked for v1.2". Close spam #278, #282 | maintainer |
| Review the apilot fork's PRs #363–365 within a week; offer area triage rights | maintainer |
| Ship v1.1 within 2–3 weeks and name outside contributors in the release notes | maintainer |

### 90 days (2026-10-20 → 2027-01-17), condensed

| Weeks | Build | Community |
|---|---|---|
| 1–3 | Merge #342; v1.1 hardening; **ship v1.1** with provenance | #327, the PR and issue sweep, apilot outreach; move CONTRIBUTING, CODE_OF_CONDUCT, SECURITY to the root; area labels and 10+ good first issues |
| 4–8 | v1.2: harness, v2 port, `.env` demo; **ship v1.2** | GOVERNANCE.md, TRADEMARK.md, FUNDING.yml, all-contributors; ADDING_A_HOST.md and ADDING_A_GATE.md; first office hours; announce the demo |
| 8 | **Go/no-go (§6)** | Public metrics review |
| 9–13 | v1.3 (or v1.2.x if it slips; never a gap over 5 weeks) | First area maintainer; retro Discussion |

**Day-90 targets:** 3 releases; no issue without a first response older than 7 days; outside-PR backlog ≤ 5; ≥ 5 new outside contributors merged; 1 area maintainer; the package resolves with provenance; the `.env` demo published with at least one third-party share.

**Cadence:** first response ≤ 72 h on weekdays (public promise ≤ 7 days); security acknowledged ≤ 72 h; PR decision ≤ 14 days; a minor release every 4–5 weeks.

**Not in these 90 days:** relicensing, a dashboard, a Discord, hosts beyond OpenCode, Claude Code and Codex.

---

## 9. How to update this file

- **When:** after each merged step, each decision, and each test run that changes the known-red list.
- **Moving work:** when a Next item merges, delete its row and add it to the Done log with the commit sha. Promote the next Later item if Next gets short.
- **Known-reds:** when a check turns green, the suite fails until you remove it from `known-red.yaml`. Remove it from the table in §2 in the same commit.
- **Decisions:** add `D-NNN` to [decisions.md](../lessons-learnt/decisions.md) first, then link it here. Close the matching row in §7.
- **Lessons:** add `L-NNN` to [lessons.md](../lessons-learnt/lessons.md) when something surprises you.
- **Always:** update the "Last updated" line at the top with the date and sha.
- **Never:** edit [initial-planning/](initial-planning/README.md) to track progress. It is a frozen record.
- **Size:** keep this file under about 500 lines. Move detail into a linked doc.

---

## 10. Done log

All on `refactor/canonical` (`git log main..HEAD`), newest first within each group.

| Area | Commits |
|---|---|
| **Planning and decisions** | `docs/plan/` README and this roadmap (the commit after `2c1f47e`) · `2c1f47e` phase-1 planning record moved to `docs/plan/initial-planning/` · `d74b370` D-015 guarded-not-locked · `57fc523` L-011 from building the local suite · `833d342` north star, decisions D-001..D-014, lessons L-001..L-010 |
| **Local test suite** (07 steps 1–4) | `9fac36e` step 4: T2 OpenCode v2 agent load and delegation scenarios · `5720ccb` step 3: `.env` scenario on both hosts under the sandbox · `4e6a922` step 2: L0 lints and `known-red.yaml` · `ce14548` step 1: `pnpm test:local` runner wrapping existing checks · `ecd495b` `OAC_RAW_URL` for local-tree installs (D-014) |
| **CI fixes** | `d7924e4` vitest 3.2.7 (GHSA-5xrq-8626-4rwp) · `a4c8ab3` profile-reference floor (L-004) |
| **CLI** | `0b84561` discoverable, scoped, safe profile installs · `73400e2` tiered install, safe re-init, honest doctor · `8581a42` runs on plain Node |
| **Canonical build** | `68a3bdc` evals inert, manual registry update, contained build writes · `a23a297` drop Cursor, Windsurf, oac-compat CLI · `5c7d4cc` retire the agent metadata sidecar · `104356a` protected-paths advisory in canonical coder-agent (also the Claude regression, L-001) · `4c96328` seed canonical profiles · `60a3498` system profiles for all kinds · `95a45b6` save point · `d336d7c` repair four dead references · `9b4e807` require an authored tools list · `4d5f3ba` OpenCode column, four adapters derive from it · `d643b4a` per-target overrides · `ea2f87c` skip 3 tests blocked on deferred decisions · `13b159a` require-await fix · `9ca012e` drop registry entries with deleted sources · `33eb6f4` drift gate in CI · `92f5657` commit the build manifest · `1a5f1f8` `oac build` · `02ff35b` backfill 13 dependency edges · `e104a7b` generate `registry.json` · `627b9ce` ClaudeAdapter to `plugins/claude-code` · `d100ccd` OpenCodeAdapter · `b77143c` loaders and ReferenceResolver · `6966b48` ordered last-match-wins capabilities · `cf97d98` seed `content/agents` · `0252c79` red-first build tests · `319bec0` `oac:` block and ordered permission rules · `8e12c63` coder-agent deny-only guidance |
| **Repo and release hygiene** | `587306e` public access for the scoped package · `597fa75` move packages to `@controlstack` scope (see open decision 1) · `cce5255` delete `packages/plugin-abilities` · `2dba195` migrate to pnpm · `abeb154` gate `packages/**` PRs · `5881767` one version, 1.1.0 · `a274eb6` delete `dev/`, `context-findings/`, archive `docs/planning/` |
| **Architecture specs** | `28c6b70` plugin-abilities facts · `b028fb5` close stage 1 gate · `3146bb5` canonical schema v3 · `8d64bdd` precedence experiment (last-match-wins confirmed) · `0790f3c` feature inventory and migration tests v2 · `236ea23` 09-MERGE-RULES · `6f3611d` subagent dispatch guide · `145b80d` repo structure and packaging spec · `f5c93cc` import the canonical-refactor spec set |
