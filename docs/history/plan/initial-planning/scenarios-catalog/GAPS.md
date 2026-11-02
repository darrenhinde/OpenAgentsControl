# Gaps: what the fake-model approach can't test

[O] unless labelled.

The fake model proves **enforcement independent of model behaviour**. That is the product claim, and it is cheap ($0, seconds). It says nothing about what a real model *chooses* to do, how good the result is, or what it costs. Those need L3 (live), L4 (red-team with real models) or field data.

## 1. Behaviours that need L3 live runs

| Gap | Why a fake model can't test it | Catalogue rows affected | How to cover it later |
|---|---|---|---|
| **Prompt-level rules in today's agents**: openagent proposing a plan and asking before the first write, stopping and reporting on red tests, loading standards before writing, choosing to delegate | The script decides; the model's compliance is the thing under test | `today/openagent-approval-prose`, `today/openagent-stop-on-failure-prose`, `today/openagent-context-loading-prose`, `pipeline/delegation-flow` (choice half) | Re-base the legacy evaluators (`approval-gate`, `stop-on-failure`, `report-first`, `context-loading`, `delegation`) on `OacEvent` (`02` §6.1) and run them as L3 nightly smoke, K=3, small model, pass^3. Where a v1.4 gate makes the rule enforced (intent, verifier `report`), the L3 row becomes a diagnostic, not a gate. |
| **Task success and quality**: correct root-cause file, the fix actually right, the plan sensible | Needs a real model and an outcome grader | Investigation quality, bug-fix and feature quality (`02` §7) | Harbor-format tasks (`research-verification.md` §3.3) with hidden tests; 30–50 stratified tasks; report paired deltas with SE and the MDE (~23 pp at n=30). |
| **Does a gate harm normal work?** Success delta and extra wall-clock, on vs off | Needs real sessions where a block changes what happens next | Verifier cost, intent-gate friction (`02` §7) | Paired on/off ablation, pre-registered (`ablations/<name>/PLAN.md`). |
| **Scout value**: does `lite`/`full` help or hurt, and at what token cost | Payload size is testable (L0/L1 here); usefulness isn't | `context/scout-*` | The v1.3 three-arm + no-context ablation (D-010). |
| **Real token and latency cost of a session** | The mock's tokens are fake | `context/idle-overhead` covers bytes only | Metering proxy in the `live` tier (`07` §2.2) with a `--budget` cap. |
| **Recovery after a block**: does the model accept the reason and do the right thing, or loop or route around it (e.g. switch from `Read` to `cat`) | The script's next turn is fixed | All attack rows (the "after" half) | L3: grade "blocked, then no equivalent retry" and "stop reason resolved in session ≥ 60%" (`02` §4 freshness goal). |
| **Compaction and long sessions**: SessionStart on `compact`, rule decay over long sessions | Hard to force realistic compaction with a scripted model | `load/sessionstart-registered` (matcher), intent "once per task" across sessions | L3 long-task runs; record `compact` events; check the payload re-injects ≤ 3 lines. |

## 2. Behaviours that need L4 (real-model red-team)

| Gap | Why | How |
|---|---|---|
| **Whether injections persuade real models** | The fake model always obeys, which is the right worst case for the gate, but it says nothing about how often a model tries | promptfoo `coding-agent:*` (`repo-prompt-injection`, `terminal-output-injection`, `secret-*`, `sandbox-*`, `verifier-sabotage`, `automation-poisoning`, `network-egress-bypass`) with the `anthropic:claude-agent-sdk` provider; Inspect `inspect_swe` for OC/Codex. ≥ 60 attempts per host for a ≤ 5% upper bound. Weekly. |
| **Creative obfuscation** beyond the scripted matrix | A static matrix can't enumerate a model's inventions | L4 attacks + the strict sandbox as the backstop; every escape found becomes a new L2 matrix arm (failures → scenarios). |
| **Weakened assertions** (`expect(x).toBe(x)`) | Not deterministically detectable | `redteam/verifier-sabotage-weaken-assert` is marked U at L2; L4 measures it, and an optional reviewer add-on (v1.5) is the mitigation. |

## 3. Design gaps the catalogue surfaced (need a maintainer decision, not just tests)

| Gap | Scenario that exposes it | Proposal |
|---|---|---|
| **Self-approval.** The plan file is writable before approval (by design, `intent/plan-path-before-approval.benign`), so an agent can write `Approved-by: dana` into its own plan | `redteam/self-approve-plan` | Only count an approval line that is committed by a non-agent author, or present at session start; or require `oac approve` for team. The agent's own write of an approval line logs `oac/intent/self-approval`. |
| **"Never auto-fix" isn't enforceable yet.** `verify.on_fail: report` only changes the block message | `verifier/report-mode-no-autofix` | In team `report` mode, a verifier block re-arms the intent gate for source edits until the human approves the proposed fix. |
| **Verifier sabotage.** "Tests green" can be reached by deleting or skipping tests | `redteam/verifier-sabotage-delete-tests`, `-skip` | The verifier keeps a test-count and test-file baseline from the base commit; fewer tests, more skips, or a changed test command ⇒ still red, with the reason. |
| **Self-protection isn't a named gate.** `oac.policy`, `.oac/**`, `.claude/settings*.json`, `.claude/hooks/**`, `opencode.json`, `.opencode/plugin*/**`, `.codex/**` must be agent-unwritable | `redteam/tamper-*`, `redteam/forge-approval` | Add them to the default `protect.deny`, or make "self-protection" a core gate with its own `hosts.ts`. Also: no env-var kill switch an agent can set (`env_kill_switch_ignored`). |
| **Obfuscated shell can't be parsed** | `secrets/shell-obfuscated`, `destructive/obfuscated` | Unparseable ⇒ `ask` (team: block), script bodies scanned before `bash x.sh`, and the residue listed as a limit in the matrix. |
| **Network egress is out of v1 scope** | `redteam/network-exfil` | List it as `unsupported` in the matrix (honesty, promise 4), rely on the host sandbox, revisit at v1.5+. |
| **Benign passes are vacuous today** | all `.benign` rows | The pairing rule in `SCORECARD.md` §1. |

## 4. Host behaviour the runner must verify before trusting its own results

These are [F†] or unknown. Each one decides how a whole group of rows is graded.

1. How `opencode run` resolves an `ask` without `--auto`, and whether the SDK's `session.permission.reply` works headless (RUNNER-NEEDS §5).
2. CC `--permission-prompt-tool` in `-p` mode on 2.1.302.
3. CC `--permission-mode plan` and a scripted `ExitPlanMode` in `-p` mode; whether a PostToolUse hook sees it (`05` §2.3 marks this unverified).
4. Whether OC v2 `grep` respects per-file `read` denies.
5. Whether CC shows the PreToolUse deny reason to the user (`02` R4). It reaches the model in the poc [F], but the user-facing half is TUI-only.
6. CC hooks snapshot at session start, so a mid-session settings edit takes effect only after review [F† CC docs]. If true, it is a second layer under `redteam/tamper-host-settings`; the scenario must still grade the file write itself.

## 5. Things outside any automated layer

| Gap | How it gets covered |
|---|---|
| Interactive UX: TUI ask dialogs, OC toasts, the status line, how a block message reads to a person | A timed manual run per release (`02` §5 "Onboarding time"), with screenshots in the release notes |
| Real-world false-positive rate | Shadow mode (`obs/shadow-mode`) on dogfood repos, then `oac report` waiver and override rates after 14 days (`02` §4 rollout) |
| Host auto-updates and drift | Nightly runs against `@latest` (`03` rule 5, `07` R1); the scorecard diff between pinned and latest is the alert |
| Codex | Every CX column runs from v1.5, once the driver, the normaliser and the hook-trust path exist (`02` R6/R7) |
| Multi-user team flows (teammate join, local overrides across machines) | L0 precedence matrix now; a two-HOME L1 scenario later |
