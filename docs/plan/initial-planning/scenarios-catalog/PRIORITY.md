# Build order for the scenarios

[O] throughout. Goal: get the refactor working on OpenCode v2 and Claude Code first, then the gates.

## First 10: the `07` known-reds

These are exactly the 10 known-red rows in `07` §2.3's example output, under catalogue IDs. Each one already has a probe that showed the failure [F, `07` §3 and Appendix A]. Each turns green with a named fix, so together they are the definition of "the refactor works on v2 and CC".

| # | Catalogue ID | `07` check | Layer | Host | Turns green with | Seed YAML |
|---|---|---|---|---|---|---|
| 1 | `load/no-hidden-tools-lint` | `gates/no-hidden-tools` (T1) | L0 | OC | #349 reorder (PR #354), v1.1 | – (static lint) |
| 2 | `load/subagent-keys-exist` | `gates/subagent-keys-exist` | L0 | OC/CC | #362 flat IDs, v1.2 | – (static lint) |
| 3 | `load/oc-tools-visible` | `oc/agents-tools-visible` (T2b) | L1 | OC | #349 + the v2 permission emitter | ✓ |
| 4 | `load/oc-flat-ids` | `oc/flat-ids` (T2c) | L1 | OC | #362 | ✓ |
| 5 | `load/oc-no-v1-artifacts` | `oc/no-v1-artifacts` | L0/L1 | OC | #367 v2 plugin port | – |
| 6 | `load/delegate-by-name` | `scn/delegate-by-name@opencode-v2` | L2 | OC (+CC check) | #362 (emit IDs that match body references, or rewrite bodies) | ✓ |
| 7 | `context/sessionstart-payload` | `cc/sessionstart-payload` | L1 | CC | the v1.1 SessionStart fix | ✓ |
| 8 | `load/cc-agent-dispatch-examples` | `cc/agent-dispatch-examples` | L0 | CC | restoring the hand-written Claude agents, v1.1 | – |
| 9 | `destructive/rm-rf-sentinel` | `scn/destructive@claude-code` | L2 | CC (+OC) | the destructive gate, v1.4. Stays known-red until then; it exists now so the runner's sentinel/snapshot machinery is exercised | ✓ |
| 10 | `load/doctor-flags-v2` | `inst/doctor-flags-v2` | L1 | OC | doctor v2 checks + version table, v1.2 | – |

**Build alongside them (green anchors, not counted).** These pass today and stop the baseline sliding while the 10 are fixed: `secrets/read-env` (the poc, both hosts), `load/delegate-by-id`, `load/oc-agents-boot`, `load/cc-plugin-load`, `load/cc-plugin-validate`, `load/oc-config-sources` (the sandbox self-test). They match `07` build steps 3–5.

**Runner verbs needed for the first 10:** only `say`, `delegate`, `shell` and the `check:` block (`tools_offered_superset_of`, `init_event`, `sessionstart_payload`), plus the `sentinel` setup op. No ask handling yet.

## Next 15: the gates on both hosts (v1.2 → v1.4)

Ordered so each one unlocks the next. The first five finish the v1.2 `.env` demo (T3, T4, T6). The rest build the v1.4 core in the order of the north-star promises.

| # | Catalogue ID | Why now | Needs from the runner |
|---|---|---|---|
| 11 | `secrets/shell-cat` | catches a permission-only implementation; completes the v1.2 demo on OC (`07` §3.5) | — |
| 12 | `secrets/read-env-example.benign` | the first "allowed" row in `oac test` (`04`); proves the demo isn't in the way | `fp_arm` |
| 13 | `secrets/read-src.benign` | trivial, but it is the pairing partner that makes benign rows count | `marker_reaches_model` |
| 14 | `obs/decision-log-schema` | T6; every later scenario relies on decision rows | log reader + zod |
| 15 | `scope/write-outside-repo` | already a sandbox self-test in `07`; turning it into a gate row makes OC's `external_directory: allow` default visible | `outside` setup, snapshot |
| 16 | `today/openagent-shell-asks` | settles how asks resolve headless (RUNNER-NEEDS §5). Every **A** row depends on it, and it protects openagent's only host-enforced approval today | ask recorder (OC SDK reply; CC permission-prompt tool) |
| 17 | `today/contextscout-readonly` | regression for read-only subagents across both hosts | `tools_offered_disjoint_from`, `if_offered` |
| 18 | `load/init-boots-on-v2` | the real user path: what `oac init` writes must boot | CLI step then T2 |
| 19 | `secrets/path-tricks` | first matrix scenario; hardens the v1.2 hook before it becomes the v1.4 gate | `matrix` |
| 20 | `intent/edit-before-approval` | promise 1; the first stateful gate | `approve` setup op |
| 21 | `intent/approved-then-in-scope.benign` | promise 1's other half: once approved, no asks per step | `repeat`, `asks_count` |
| 22 | `verifier/done-on-red` | promise 3 on CC (Stop) and the nudge level on OC | `failing_test`, Stop-continuation handling, `stop_blocks` |
| 23 | `verifier/commit-on-red` | the OC "done" gate (no Stop on v2) | — |
| 24 | `redteam/tamper-host-settings` | self-protection: without it every "enforced" claim can be undone by the agent | `matrix` + `include` |
| 25 | `benign/ts-feature-session` | the realistic false-positive guard for everything above; run it on every PR from here on | `parallel`, `repeat` |

**After these 25:** `destructive/git-push-force`, `destructive/git-reset-hard`, `scope/write-git-dir`, `secrets/read-env-symlink`, `secrets/env-dump`, `redteam/readme-injection-env`, `redteam/tool-output-disable-hooks`, `redteam/tamper-oac-policy`, `redteam/forge-approval`, `verifier/report-mode-no-autofix`, `pipeline/bugfix-report-before-fix`, `obs/report-totals`, then the onboarding fixtures (v1.3) and freshness (v1.4).
