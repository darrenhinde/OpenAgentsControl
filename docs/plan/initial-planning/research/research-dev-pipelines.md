# Developer-activity pipelines, gates, onboarding and settings: research for the OAC product plan

Written 2026-10-18. Labels: **[F]** = fact with a source (URL or repo file). **[O]** = my opinion or inference. **[F?]** = a pointer written before the framework pass came back. Each one is checked against primary sources in **§1b**, and where §1b disagrees, §1b is right. **[unverified]** = could not be confirmed from a primary source.

Inputs: the strategy files in `.tmp/planning-fix/01-strategy-synthesis.md`, `research_notes/OAC strategy review/2_approach_and_niche.md` and the Keep/Change/Cut section of `research-landscape-gaps.md`. Four web-research passes covered agent frameworks, host primitives and human practice, context freshness, and onboarding/settings/UX.

---

## 0. Design principles that come out of the research

1. **Gate on artifacts and signals, not on the model's promises.** [F] Claude Code memory is "context, not enforced configuration", and the docs say to use hooks for enforcement (https://code.claude.com/docs/en/memory). [F] "Permission rules are enforced by Claude Code, not by the model" (https://code.claude.com/docs/en/permissions). [O] Every OAC gate should therefore check something a script can see: whether a file exists, a test exit code, the diff's paths, a verdict line in a review file, or a label.
2. **Three host primitives cover almost every gate:**
   - **PreToolUse deny/ask.** Claude Code returns `permissionDecision`. Codex uses the same JSON. OpenCode throws in `tool.execute.before`, or uses v2 ordered `permissions`.
   - **Stop/SubagentStop block-with-reason**, available on both CC and Codex.
   - **A CI required status check**, plus labels for waivers.

   [F] CC: https://code.claude.com/docs/en/hooks. Codex: https://learn.chatgpt.com/docs/hooks.md. OpenCode: https://opencode.ai/docs/plugins and https://opencode.ai/v2/docs/permissions. GitHub: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches.
3. **The Stop hook is a nudge with a loop guard. CI is the real gate.** [F] A CC Stop block feeds `reason` back to Claude. The input carries `stop_hook_active`, and the cap is 8 consecutive continuations (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`) (https://code.claude.com/docs/en/hooks). [F] OpenCode has no Stop-block equivalent documented. `session.idle` is an event only (https://opencode.ai/docs/plugins). [O] On OpenCode the end-of-turn gate degrades to a pre-commit/pre-push check plus CI. List it in the capability matrix.
4. **Right-size by risk signals, not by asking the model how big the task is.** [F] Design docs at Google are skipped when "the solution is unambiguous", and 1–3 page "mini docs" exist for small changes (https://www.industrialempathy.com/posts/design-docs-at-google/). [F] Users call spec-kit and BMAD "overkill" on small changes (Scott Logic: 2,577 lines of markdown for 689 lines of code; quotes in `research-landscape-gaps.md` §4). [O] OAC should compute size from the diff and the paths (file count, touched risk paths, new dependency, migration, public API) and escalate gates only when one of those trips.
5. **More context is not better.** [F] Context files tended to *reduce* task success and raised cost by more than 20% (arXiv 2602.11988, https://arxiv.org/abs/2602.11988v1). [F] Chroma "Context Rot": reliability drops with input length (https://trychroma.com/research/context-rot). [O] So context scout ships **off or lite** by default, and the freshness gate counts deleting a stale line as a valid update.

---

## 1. Host primitives OAC can compile gates into (reference)

| Primitive | Claude Code | OpenCode | Codex | Git/CI |
|---|---|---|---|---|
| Block a tool call | PreToolUse `permissionDecision: deny\|ask` + reason; exit 2 [F hooks doc] | v1: `permission` (last match wins); v2: ordered `permissions` array `{action, resource, effect}`, last match wins; plugin `tool.execute.before` throw [F opencode.ai/docs/permissions, /v2/docs/permissions, /docs/plugins] | PreToolUse with the same JSON; `.rules` `prefix_rule(... decision=forbidden\|prompt\|allow)` [F learn.chatgpt.com/docs/hooks.md, /agent-configuration/rules] | n/a |
| Refuse "done" | Stop / SubagentStop `decision: block` + reason [F] | none documented; use pre-commit + CI [O] | Stop `decision: block` [F] | required status check [F GitHub docs] |
| LLM verifier | `prompt` handler (30s) and `agent` handler (60s, experimental) [F] | plugin can call the client [O, unverified] | `prompt`/`agent` parsed but **skipped** [F] | a CI job runs a headless agent [O] |
| Inject context | SessionStart / UserPromptSubmit `additionalContext`; InstructionsLoaded event [F] | `instructions` globs; `experimental.session.compacting` [F opencode.ai/docs/config, /plugins] | SessionStart hook; AGENTS.md chain [F] | n/a |
| Show the user | `systemMessage`; `ask` reason shown with source label; `/hooks` read-only browser; statusLine [F hooks, statusline docs] | `tui.toast.show` [F plugins] | `/hooks` trust UI [F] | PR comment / check summary [F] |
| Waiver | n/a | n/a | n/a | `pull_request: types: [labeled, unlabeled]` [F GitHub events doc]; changelog-enforcer `skipLabels` pattern [F https://github.com/dangoslen/changelog-enforcer] |
| Local gate | n/a | n/a | n/a | `pre-push` non-zero exit aborts; bypass `--no-verify` [F https://git-scm.com/docs/githooks] |

Two caveats. [F] Codex skips project hooks until the repo is trusted, and records trust per hook hash, so a changed hook is skipped until it is trusted again (learn.chatgpt.com/docs/hooks.md). [O] `oac doctor` must report "hooks installed but untrusted" as a degraded state.

---

## 1b. Agent frameworks: steps, artifacts, gates, sizing (verified 2026-10-18)

**Headline [F/O]:** in all ten frameworks almost every gate is a prompt or a human approval. The mechanical gates I found are:
- Claude Code plan mode, which blocks edits until the plan is approved.
- Kiro PreToolUse hooks, which can block.
- spec-kit `check-prerequisites --require-tasks` and its mandatory extension hooks.
- OpenSpec `openspec validate`, which runs automatically before archive.
- compound-engineering's `review-scope.py` `hard_block_full`.
- Codex's sandbox and approval policy.

[O] That is the space OAC fills. No framework compiles gates into hooks or CI, and none checks context freshness.

| Framework | Steps → artifacts | Gate type | Small vs large routing | Design / security reviewer |
|---|---|---|---|---|
| Superpowers v7.0.0 (2026-10-10) | brainstorming → `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`; writing-plans → `docs/superpowers/plans/…`; subagent-driven-dev → `.superpowers/sdd/` (briefs, review packages); TDD; systematic-debugging; verification-before-completion | Human "nothing gets built until your human partner approves". The scripts `task-brief` and `review-package` generate inputs. Verification is **prompt-only**. The only hook is SessionStart. [F https://github.com/obra/superpowers, /releases, skills/*/SKILL.md] | v7 "sizes the work": quick → just do it, small → agree in chat, project → design doc. Moves up a tier if the work grows. [F releases] | none explicit; a per-task spec+quality reviewer |
| spec-kit | constitution (`.specify/memory/constitution.md`) → specify (`specs/NNN-name/spec.md`, ≤3 `[NEEDS CLARIFICATION]`) → clarify (≤5 Qs) → plan (`plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`) → tasks → analyze (read-only) → implement (ticks `tasks.md`) → converge | Semi-mechanical: prerequisite scripts check that files exist. Unchecked `checklists/` items stop implement. `before_/after_implement` hooks in `.specify/extensions.yml`. The Constitution Check is enforced only by the LLM. [F https://github.com/github/spec-kit, templates/commands/*.md] | No tiers. Separate extensions: `bug` (assess→fix→test, verdict verified/partial/failed) and `assess` (go/needs-clarification/kill) | `analyze` + checklists |
| BMAD v6.12 (v7 alpha [unverified]) | `bmad-deep-recon` → `research-<topic>.md`; `bmad-prd` → `prd-<slug>.md`; `bmad-ux` → `DESIGN.md`; `bmad-architecture` → `architecture-<slug>.md`; `bmad-build` → `plan-<slug>.md` → 3 reviewers (Blind Hunter, Edge Cases, Verification Gap) → local commit | Human approval of the full plan on flagged builds; readiness check is a prompt. The v4 QA gate YAML (PASS/CONCERNS/FAIL/WAIVED) is legacy [unverified in v6]. [F https://docs.bmad-method.org/plan/choose-a-planning-path/, /build/build-a-change/] | Trivial → none; one session (~500 lines) → bmad-build; epic → PO slices stories; project (~20+ sessions) → PRD/arch first. Risk, ambiguity and reach push work up a tier | 3-lens build review |
| OpenSpec | explore → propose (`openspec/changes/<id>/proposal.md`, `specs/` deltas ADDED/MODIFIED/REMOVED, optional `design.md`, `tasks.md`) → apply → archive (merges into `openspec/specs/`) | **Mechanical:** `openspec validate --strict`. Zero deltas fail unless `skip_specs`. Archive validates first. [F https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md] | "Lite spec (default)… most changes"; Full for cross-team, API, migrations, security/privacy [F docs/concepts.md] | none |
| compound-engineering | ce-brainstorm → ce-plan (`docs/plans/`) → ce-work → ce-simplify-code → ce-code-review → ce-compound (`docs/solutions/`, `CONCEPTS.md`); ce-debug | Review-depth gate with a **mechanical floor**: `review-scope.py` `hard_block_full` for large or hard-block classes; CI-workflow paths never get lite. Report-only by default. Writes to AGENTS.md/CLAUDE.md only with a one-line pointer and consent. [F https://github.com/EveryInc/compound-engineering-plugin, skills/ce-*/] | ce-work Trivial (1–2 files, no behaviour change) skips tasks; plan depth Lightweight/Standard/Deep; review lite/focused/full, routed on "loud vs silent" failure | `security-reviewer`, `api-contract-reviewer`, `data-migration-reviewer` personas |
| gstack | /office-hours (design doc) → /plan-ceo-review → /plan-eng-review (test plan) → /plan-design-review (0–10) → build → /review → /qa (regression tests) → /ship (PR) → /document-release, /retro; /investigate; /cso; /autoplan | Review Readiness Dashboard; /ship grades review freshness CURRENT/STALE/UNVERIFIED; a failed doc audit blocks /ship unless the risk is accepted. Skill-enforced; whether these are hooks is [unverified]. [F https://github.com/garrytan/gstack] | No tiers; "smart review routing" skips reviews that don't apply (no design review for backend-only work) | **explicit:** `/design-review`, `/plan-design-review`, `/cso` (security) |
| cc-sdd | steering (`.kiro/steering/*.md`) → spec-init (`spec.json`) → spec-requirements (EARS) → validate-gap → spec-design → **validate-design GO/CONDITIONAL/NO-GO** → spec-tasks → spec-impl → validate-impl | Approvals recorded in `spec.json` and checked by the LLM; `-y` auto-approves [F https://github.com/gotalab/cc-sdd, docs/guides/command-reference.md] | small → discovery → implement directly; large → discovery → spec batch | validate-design is an explicit design gate |
| Agent OS v3 | discover-standards → inject-standards → plan-product → shape-spec (inside plan mode; `agent-os/specs/YYYY-MM-DD-HHMM-{slug}/`) | Plan-mode approval; implement/orchestrate phases are "retired" and handed to the host [F https://github.com/buildermethods/agent-os/blob/main/CHANGELOG.md, https://buildermethods.com/agent-os/shape-spec] | "Quick implementation: /inject-standards, then proceed" vs plan mode + shape-spec | none |
| Kiro | requirements.md (EARS) → design.md → tasks.md (or Design-First); bugfix.md (current/expected/unchanged); steering; hooks `.kiro/hooks/*` (PostFileSave, PreToolUse, PostToolUse, Stop; shell or agent prompt) | Review button; **PreToolUse hook can block** [F https://kiro.dev/docs/specs/, /docs/hooks/] | **Quick Spec** produces all three files "without approval gates" | none explicit |
| Claude Code / Codex | Plan mode (plans in `~/.claude/plans/` or `plansDirectory`); `/code-review`, `/security-review`; Codex `/review` (report-only), sandbox read-only/workspace-write/full + approval policy | Plan mode **mechanically** blocks edits; Codex sandbox [F https://code.claude.com/docs/en/permission-modes, /commands; https://learn.chatgpt.com/docs/codex/cli] | skip plan mode | CC `/security-review` |

Implications [O]:
- **Superpowers v7, BMAD, OpenSpec, CE and Kiro have all converged on "size first; most work is small".** OAC should not invent a sizing ritual. It should *measure* size from the diff (§2.6) and let whichever method is in use decide how much ceremony to apply.
- **Use the reviewer verdict contracts that already exist:** cc-sdd GO/NO-GO, BMAD PASS/CONCERNS/FAIL/WAIVED, gstack CURRENT/STALE. OAC's add-on gate should parse a `Verdict:` line and accept those vocabularies.
- **gstack's "review freshness STALE" is the closest analogue to OAC's freshness gate,** but gstack applies it to reviews, not to context.
- **Interop paths for the planning gate to recognise:** `specs/*/plan.md` (spec-kit), `openspec/changes/*/` (OpenSpec), `docs/superpowers/plans/` (Superpowers), `docs/plans/` (CE), `.kiro/specs/*/` (cc-sdd/Kiro), `agent-os/specs/` (Agent OS), and `~/.claude/plans/` (CC; user-local, so not CI-visible).

---

## 2. Pipelines

Columns are as requested. **Default** means a fresh install. **Solo/Team** gives the strictness default per profile: `nudge` = Stop-hook reason or warning only; `block` = CI required check fails; `off`.

### 2.1 Investigation / research (read-only)

Prior art:
- [F] Incident response "first stop the impact… then find the root cause" (https://sre.google/workbook/incident-response/).
- [F] CC plan mode reads and explores but cannot edit until the plan is approved (https://code.claude.com/docs/en/permission-modes).
- [F?] spec-kit `/clarify` and BMAD analyst briefs are framework research steps (https://github.com/github/spec-kit, https://github.com/bmad-code-org/BMAD-METHOD).
- [F] Agent OS `/discover-standards` reads 5–10 representative files and asks 1–2 "why" questions per pattern (https://buildermethods.com/agent-os/discover-standards).

| Step | Artifact | Gate | Signal | Host primitive | Default | Solo / Team |
|---|---|---|---|---|---|---|
| 1. Frame the question | first lines of `.oac/work/<id>/research.md` (question, scope, out of scope) | none | n/a | n/a | on | off / off |
| 2. Read-only exploration | none | **write lock**: no edits outside `.oac/work/**` during research mode | tool name + path | CC PreToolUse deny on Edit/Write outside the scratch path; OC v2 `permissions` edit deny; Codex PreToolUse | on (when research mode is entered) | block / block |
| 3. Optional context scout | cited files list | token budget | scout level setting | SessionStart/skill | **off** | off / lite |
| 4. Findings with citations | `research.md` with file:line refs | "cited" check: every finding has a path or URL | regex over the file | Stop hook (CC/Codex) | off | off / nudge |
| 5. Hand-off | a "next pipeline" line (bugfix/feature/plan) | none | n/a | n/a | on | — |

[O] Research needs exactly one mechanical gate: read-only. It is cheap, it is enforceable on all three hosts, and it is what plan mode already teaches users.

### 2.2 Bug fix

Prior art:
- [F] Mozilla's definition of "triaged" is concrete: type, component and severity are set (https://firefox-source-docs.mozilla.org/bug-mgmt/policies/triage-bugzilla.html).
- [F] SRE postmortems need root cause plus follow-ups, and must be reviewed (https://sre.google/sre-book/postmortem-culture/).
- [F] OAC's own `debugger` skill has the "NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST" iron law, but only as prompt text (`plugins/claude-code/skills/debugger/SKILL.md`).
- [F?] Superpowers `systematic-debugging` + TDD (https://github.com/obra/superpowers).
- [F] "Reproduce → isolate → root cause → fix → regression test" is standard, but I found no single canonical source for it.

| Step | Artifact | Gate | Signal | Host primitive | Default | Solo / Team |
|---|---|---|---|---|---|---|
| 1. Triage | `bug.md` header: severity, area, repro steps | none | n/a | n/a | on | — |
| 2. Reproduce | a failing test (or a repro script) | **red-before-green**: the new or changed test fails on the pre-fix code | test runner exit code on a stash or base commit | CC/Codex Stop hook runs `oac check repro`; CI job | off | nudge / nudge |
| 3. Root cause | `bug.md` "Root cause:" line | field present | grep | Stop hook | off | off / nudge |
| 4. Fix, in scope | diff | **diff scope**: changed files inside the declared area (+ tests) | `git diff --name-only` against area globs | PreToolUse (warn or ask on an out-of-area write); CI | on (warn) | nudge / block |
| 5. Verify | test output | **verifier before done**: tests and typecheck pass | exit codes | Stop hook (CC/Codex); pre-push (OC); CI required check | **on** | block / block |
| 6. Context write-back | context/AGENTS.md diff or a waiver | freshness gate (§3) | path map | CI + Stop nudge | on for team | nudge / block |

[O] The verifier-before-done gate is the flagship and should be the one gate that is on by default everywhere. It matches the positioning in `2_approach_and_niche.md` §3. Red-before-green is valuable but costs a second test run, so it is opt-in.

### 2.3 Feature update (change to existing behaviour)

Prior art:
- [F?] spec-kit `specify → clarify → plan → tasks → analyze → implement`. spec-kit's brownfield guide confirms this order and adds "converge" (https://github.github.com/spec-kit/guides/existing-projects.html).
- [F?] OpenSpec proposal → spec delta → tasks → archive (https://github.com/Fission-AI/OpenSpec).
- [F] Compound Engineering's loop ends in `/ce-compound`, which writes a learning to `docs/solutions/` (https://raw.githubusercontent.com/EveryInc/compound-engineering-plugin/main/README.md).
- [F?] Kiro: requirements (EARS) → design → tasks (https://kiro.dev/docs/specs/).

| Step | Artifact | Gate | Signal | Host primitive | Default | Solo / Team |
|---|---|---|---|---|---|---|
| 0. Size the work | `size: S\|M\|L` in `.oac/work/<id>/brief.md`, computed | none; this step routes the work (§2.6) | file count, risk paths, new dependency, migration, public API | UserPromptSubmit or skill; recomputed from the diff in CI | on | — |
| 1. Brief / acceptance criteria | `brief.md` (goal, non-goals, acceptance checks) | **L only**: brief exists before the first source edit | file exists | CC PreToolUse on the first Edit; OC plugin; Codex PreToolUse | on for L | off / nudge |
| 2. Plan | `plan.md` (or the host's plan mode) | L only: plan approved | `Approved-by:` line or the plan-mode exit | CC plan mode is native; CI checks the line exists | off | off / nudge |
| 3. Implement within scope | diff | diff scope + protected paths (`oac.policy`) | paths | PreToolUse / OC permissions / Codex rules | **on** | block / block |
| 4. Tests | tests changed alongside source | "source changed ⇒ tests changed" | path pairs from the map | CI (warn) | off | off / nudge |
| 5. Verify | exit codes | verifier before done | test/build/typecheck | Stop + CI | **on** | block / block |
| 6. Add-on reviews (§2.7–2.8) | `review-design.md`, `review-security.md` | verdict line `Verdict: pass\|changes` | regex | SubagentStop / CI | **off** (opt-in) | off / per area |
| 7. Context freshness | context diff or a waiver label | §3 | path map | CI + Stop nudge | on for team | nudge / block |

### 2.4 Planning (multi-step or new capability)

Prior art:
- [F] Google design docs cover context and scope, goals and non-goals, the design, alternatives, and cross-cutting concerns (security, privacy, observability) (https://www.industrialempathy.com/posts/design-docs-at-google/).
- [F] Rust RFC sections run from Summary to Future possibilities, and the final comment period lasts 10 days with sign-off (https://rust-lang.github.io/rfcs/).
- [F] Oxide RFD states run from prediscussion to committed (https://rfd.shared.oxide.computer/rfd/0001).
- [F?] cc-sdd requirements → design → tasks with approval between phases (https://github.com/gotalab/cc-sdd).
- [F?] BMAD PRD → architecture → epics/stories (https://github.com/bmad-code-org/BMAD-METHOD).

| Step | Artifact | Gate | Signal | Host primitive | Default | Solo / Team |
|---|---|---|---|---|---|---|
| 1. Problem + goals/non-goals | `plan.md` §1 | required sections present | heading lint | CI markdown check | on when the pipeline is used | off / nudge |
| 2. Alternatives considered | `plan.md` §Alternatives (≥2) | section non-empty | heading lint | CI | on | off / nudge |
| 3. Task breakdown | `tasks.md` checklist with file globs per task | none | n/a | n/a | on | — |
| 4. Approval | `Status: approved` + approver | **no source edits until approved**, L only | front-matter field | CC PreToolUse; OC permission edit=ask until the flag flips; Codex PreToolUse | off | off / block (L only) |
| 5. Execution tracking | `tasks.md` ticks | "all tasks ticked or deferred" before done | regex | Stop hook | off | off / nudge |
| 6. Decision record | ADR in `docs/decisions/NNNN-*.md` (MADR) | an ADR exists when a plan sets `decision: true` | file exists | CI | off | off / nudge |

[F] MADR uses `docs/decisions/NNNN-title.md` with `status/date/decision-makers` front matter (https://adr.github.io/madr/). Nygard ADR statuses are proposed/accepted/deprecated/superseded (https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions). [O] OAC should not write its own planning method. It should check that whichever method's artifact exists has the required headings. That lets spec-kit, OpenSpec or Superpowers plans pass the same gate (interop, per strategy "do not compete on method").

### 2.5 Design-impact analysis (what else does this change touch?)

Prior art:
- [F] Google's "cross-cutting concerns" section (link above).
- [F] CODEOWNERS path→owner, last match wins (https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners).
- [F] Rust triagebot `[mentions."path"]` posts a message when a PR touches a path (https://forge.rust-lang.org/triagebot/mentions.html).
- [F] Nx / Turborepo know the package graph (https://nx.dev/docs/getting-started/ai-setup, https://turborepo.dev/docs/guides/ai).

| Step | Artifact | Gate | Signal | Host primitive | Default | Solo / Team |
|---|---|---|---|---|---|---|
| 1. Areas touched | `impact.md` auto-section: the areas from the path map that the diff hits | none (computed) | `git diff` × `oac.areas` | CLI `oac impact`; CI comment | on (cheap, no LLM) | on / on |
| 2. Dependents | the list of packages that depend on the changed packages | none | workspace graph (pnpm/nx/turbo, go.mod, Cargo) | CLI | on in a monorepo | on / on |
| 3. Contracts touched | flag: public API, schema, migration, config, env | escalates the size to L | path globs (`**/migrations/**`, `openapi*.yaml`, `*.proto`) | CI + UserPromptSubmit reminder | on | nudge / block (needs a plan or ADR) |
| 4. Impact notes | `impact.md` free text: risks, rollback | section present when step 3 tripped | heading lint | Stop/CI | off | off / nudge |

[O] This is the most mechanical pipeline and the best fit for OAC. It is pure path math with no LLM and no ceremony, and it feeds the size router and the freshness gate.

### 2.6 Right-sizing (router)

[F?] BMAD offers a "quick flow" next to full planning tracks (scale-adaptive). Superpowers v7 is reported to add a "size the work" step. cc-sdd and Kiro offer spec-light versus full spec paths. All of this needs verification against current READMEs (https://github.com/bmad-code-org/BMAD-METHOD, https://github.com/obra/superpowers, https://github.com/gotalab/cc-sdd). [F] Google mini docs vs full docs (link above). [F] The complaint data: 500+ page BMAD briefs (BMAD #446) and spec-kit "overkill" (Böckeler, Scott Logic). Both are cited in `research-landscape-gaps.md` §4.

Proposed OAC router [O]. The rules are deterministic and computed from the diff, not from model self-report:

| Size | Trigger (any) | Gates that fire |
|---|---|---|
| **S** | ≤3 files, no risk path, no new dependency | policy (protected paths, destructive commands) + verifier-before-done |
| **M** | 4–15 files, or ≥2 areas | S + diff-scope warning + freshness gate |
| **L** | >15 files, or a contract/migration/auth/crypto/infra path, or a new dependency, or a new package | M + brief/plan approval + add-on reviewers if enabled for that area |

The user can override the size upward. Overriding it downward is allowed on solo; on team it needs the `oac:size-override` label. The router runs at UserPromptSubmit, where it guesses from the prompt and announces the size. It is recomputed in CI from the real diff, and CI wins.

### 2.7 Add-on: design reviewer (opt-in)

[F] A design doc review in Google is a review stage after rapid iteration (link above). [F] RFC final comment periods require sign-off (Rust).

| Step | Artifact | Gate | Signal | Host primitive | Default | Solo / Team |
|---|---|---|---|---|---|---|
| 1. Trigger | n/a | fires on size L or on areas tagged `design-review: true` | path map | CI / Stop | **off** | off / opt-in |
| 2. Review | `.oac/work/<id>/review-design.md` with checklist (goals met, alternatives, cross-cutting, simpler option?) | verdict line present | `Verdict: pass\|changes-requested` | CC SubagentStop or `agent` hook; CI headless run | off | — |
| 3. Resolve | review file updated, or a waiver label | no `changes-requested` left open | regex + label | CI required check | off | — / block |

### 2.8 Add-on: security reviewer (opt-in)

Prior art:
- [F] Shostack's four questions (https://github.com/adamshostack/4QuestionFrame).
- [F] STRIDE categories map to authentication, integrity, non-repudiation, confidentiality, availability and authorization (https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats).
- [F] ASVS 5.0: L1 is about 20% of requirements, L2 is "what most applications should strive for", about 70% cumulative. Requirement IDs should be cited as `v5.0.0-x.y.z`. The lists are available as CSV and JSON (https://owasp.org/www-project-application-security-verification-standard/, https://github.com/OWASP/ASVS).

| Step | Artifact | Gate | Signal | Host primitive | Default | Solo / Team |
|---|---|---|---|---|---|---|
| 1. Trigger | n/a | the diff touches areas tagged `security: true` (auth, crypto, input parsing, secrets, IAM, deps) | path map + dependency-manifest change | CI / Stop | **off** | off / opt-in |
| 2. Four questions on the change | `review-security.md`: what changed, STRIDE per changed boundary, mitigations, checked? | sections present | heading lint | Stop / CI | off | — |
| 3. ASVS checklist subset | rows of ASVS L1 (or L2) IDs for the touched chapters, marked pass/n.a./fail | no `fail` without an issue link | parse the table | CI | off | — / block |
| 4. Mechanical scanners | SARIF from existing tools (secret scan, dependency audit) | no new high findings | SARIF | CI | off | — / block |

[O] OAC ships the *checklist selection* (area tag → ASVS chapters) and the verdict parser, not a security brain. Always-on policy (secrets/.env deny, destructive commands) stays in core and is separate from this add-on.

---

## 3. PR context-freshness design

### Prior art

| Tool | Detection | Waiver | Runs |
|---|---|---|---|
| Danger.js/ruby: `git.modified_files` rules, `fail` vs `warn` [F https://danger.systems/js/, https://danger.systems/ruby/] | rule code over the diff | `#trivial` in title/body; phrase switches fail→warn | CI |
| changelog-enforcer [F https://github.com/dangoslen/changelog-enforcer] | target file A/M in PR | `skipLabels` (default `Skip-Changelog`); needs `labeled`/`unlabeled` triggers | Actions |
| dorny/paths-filter [F https://github.com/dorny/paths-filter] | named glob filters, change-type selectors, `some-with-excludes` | build-your-own | Actions |
| tj-actions/changed-files [F] | glob groups | n/a | **supply-chain compromise CVE-2025-30066** (https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-github-action-cve-2025-30066) |
| CODEOWNERS [F GitHub docs] | path → owner, last match wins | none | GitHub |
| Rust triagebot mentions [F https://forge.rust-lang.org/triagebot/mentions.html] | path → message | advisory | bot |
| Swimm [F https://docs.swimm.io/features/keep-docs-updated-with-auto-sync/] | doc-embedded snippet/token/path anchors that no longer match | ticket mode | CI |
| Mintlify workflows [F https://www.mintlify.com/docs/workflows/reference] | LLM reads merged PRs, opens docs PR | close PR | SaaS |
| DeepWiki [F https://docs.devin.ai/work-with-devin/deepwiki] | none; regenerates | n/a | SaaS |
| CC `/doctor prompt-audit` [F https://code.claude.com/docs/en/memory] | stale refs to files/commands that don't exist (proposals only) | n/a | agent |
| Compound Eng `/ce-compound` [F README above] | voluntary lesson → `docs/solutions/` | n/a | agent |
| ECC continuous-learning-v2 [F https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/continuous-learning-v2/SKILL.md] | tool-call observations → "instincts" stored outside the repo | n/a | agent |
| Kiro agent hooks [F https://kiro.dev/docs/hooks/examples/] | file-save glob → NL instruction (e.g. refresh README) | n/a | IDE |

[F] agents.md calls AGENTS.md "living documentation" but sets no same-PR rule (https://agents.md/). [F] Claude auto memory is machine-local under `~/.claude/projects/...` (memory doc). [O] Auto memory, ECC instincts and similar features cannot substitute for repo-visible context in a team.

### Proposed OAC design [O]

**1. Map (one declarative file, `oac.areas` section in `oac.policy`, CODEOWNERS-style, last match wins):**
```yaml
areas:
  api:
    paths: ["services/api/**", "!**/*.test.ts"]
    context: ["services/api/AGENTS.md", ".oac/context/api/*.md"]
    tags: [security]           # turns on security add-on for this area if enabled
  web:
    paths: ["apps/web/**"]
    context: ["apps/web/AGENTS.md"]
  "*":                          # fallback
    context: ["AGENTS.md"]
freshness:
  mode: warn                    # off | warn | block   (per area override allowed)
  ignore: ["**/*.md", "**/__snapshots__/**", "package-lock.json", "pnpm-lock.yaml"]
  min_changed_files: 3          # trivial PRs skip
  waiver_label: "oac:context-ok"
  waiver_trailer: "Context-Waiver:"   # in PR body, reason required
```
`oac init` generates this map from the workspace layout (§4), so users edit it rather than write it.

**2. Detection (deterministic, no LLM):** for each area whose `paths` matched the diff (excluding `ignore`), the check passes if any of that area's `context` files are added, modified or deleted in the same PR. A deletion counts, in line with lesson 5 in the research. A second, cheap check, **stale-reference lint**, flags context files that mention paths or scripts that no longer exist. That mirrors CC `/doctor prompt-audit`. A third check enforces a **size budget**: fail if combined root-to-leaf AGENTS.md exceeds 32 KiB (Codex `project_doc_max_bytes`, [F] https://learn.chatgpt.com/docs/agent-configuration/agents-md), or a CLAUDE.md exceeds about 200 lines ([F] memory doc).

**3. Waiver:** either the `oac:context-ok` label or a `Context-Waiver: <reason>` trailer. The check echoes the reason into its summary for an audit trail. The workflow listens on `pull_request: [opened, synchronize, reopened, labeled, unlabeled]` so adding the label re-runs it ([F] changelog-enforcer README; GitHub events doc).

**4. Where it runs (three layers, same engine `oac check freshness`):**

| Layer | When | Behaviour | Why |
|---|---|---|---|
| Agent Stop hook (CC, Codex) | end of an agent turn that edited files | **block once** with a reason that lists the area, the files changed and the context file to update; respects `stop_hook_active` | fixes it before the PR exists; cheapest moment |
| OpenCode | `session.idle` toast + pre-push | toast plus a pre-push non-zero exit when in block mode | OC has no Stop block [F plugins doc] |
| pre-push git hook (opt-in) | `git push` | same check; `--no-verify` bypass | covers humans and hosts with no hooks |
| CI required check (team) | PR | posts a check summary, `fail` in block mode | the only gate that cannot be skipped locally |

Ship it as a small in-repo script invoked by a SHA-pinned composite action, not built on third-party changed-files actions. The tj-actions compromise is the cautionary example.

**5. Prompting the agent before the gate fails:**
- (a) At SessionStart or UserPromptSubmit, inject only the *one line* for the areas the task mentions: "Area `api` → keep `services/api/AGENTS.md` current; record new commands, conventions, gotchas."
- (b) At the Stop hook, the reason text is specific and actionable: "You changed 6 files in `api` (services/api/src/auth/*). `services/api/AGENTS.md` is unchanged. Update it (add/remove/correct lines, ≤32 KiB total) or, if nothing an agent needs changed, add `Context-Waiver: <reason>` to the PR body."
- (c) Optionally, a `context-update` skill that diffs the change and proposes a ≤10-line patch. It must be a patch, never a rewrite.

**6. Rollout:** start in `warn` for 2 weeks, then `oac report freshness` shows the per-area false-positive (waiver) rate. Promote an area to `block` when its waiver rate is low. This follows Danger's warn→fail practice and the research lesson that path coupling is coarse.

---

## 4. Onboarding flows

### Prior art (onboarding)
- [F] CC `/init` writes CLAUDE.md with build/test/conventions and suggests improvements if one exists. `CLAUDE_CODE_NEW_INIT=1` gives an interactive multi-phase flow: choose artifacts, explore with a subagent, ask follow-ups, show a reviewable proposal before writing (https://code.claude.com/docs/en/memory).
- [F] CC concatenates ancestor CLAUDE.md files and loads subdirectory ones on demand. `@` imports go at most 4 hops deep. CC reads AGENTS.md when no CLAUDE.md exists (same doc).
- [F] Codex merges root→cwd, one file per directory, capped at 32 KiB. agents.md says "closest AGENTS.md wins", and OpenAI's own repo had 88 of them (https://agents.md/).
- [F] OpenCode `/init` writes AGENTS.md. AGENTS.md beats CLAUDE.md, and global falls back to `~/.claude/CLAUDE.md` (https://opencode.ai/docs/rules/).
- [F] Agent OS `/discover-standards` targets existing projects: propose 3–5 areas, ask why, confirm/edit/skip each, then write `agent-os/standards/` + `index.yml` (https://buildermethods.com/agent-os/discover-standards).
- [F] The spec-kit brownfield guide says: branch, `specify init --here --force`, review the diff, then write a constitution from principles "already true or explicitly agreed", using README/ADRs/CI as evidence, and "Do not invent standards merely to fill the constitution template" (https://github.github.com/spec-kit/guides/existing-projects.html).
- [F] Kiro generates `.kiro/steering/{product,tech,structure}.md` (https://kiro.dev/docs/steering/). [F] Cursor rules live in `.cursor/rules/*.mdc` and are capped at 500 lines. "Generate Cursor Rules" was removed in 2.0 (https://cursor.com/docs/context/rules, forum link in research).
- [F] Nx `configure-ai-agents` writes AGENTS.md/CLAUDE.md + MCP + skills (https://nx.dev/docs/getting-started/ai-setup). Turborepo `agentGuidance: true` maintains a managed block in the root AGENTS.md and touches only its own block (https://turborepo.dev/docs/guides/ai).
- [F] Linguist detection order: modeline → filename → shebang → extension → heuristics → classifier (https://github.com/github-linguist/linguist/blob/main/docs/how-linguist-works.md). Manifest-based detection (package.json, pyproject.toml, go.mod, Cargo.toml) is common, but I found no single spec for it.

Shared engine [O]: `oac init` runs a deterministic **scan** with no LLM: manifests, workspace files (`pnpm-workspace.yaml`, `nx.json`, `turbo.json`, `go.work`, Cargo `[workspace]`), CI config, existing CLAUDE.md/AGENTS.md/.cursor/rules/.kiro. It decides which of the three types the repo is, prints what it found, and then branches. LLM steps are opt-in and always show a proposal before writing, as CC's new `/init` does.

### 4.1 Brownfield (existing, single package)

| # | Step | What the user sees |
|---|---|---|
| 1 | Scan | `Detected: TypeScript (package.json), Vitest, ESLint, GitHub Actions. Existing: CLAUDE.md (142 lines), no AGENTS.md.` |
| 2 | Import, don't overwrite | `Found CLAUDE.md. OAC will keep it and add a managed block <!-- oac:begin -->…<!-- oac:end --> (Turborepo-style).` |
| 3 | Commands | `Verifier commands (from package.json/CI): test=npm test, typecheck=tsc --noEmit. [Enter to accept / edit]` These feed the verifier gate. |
| 4 | Policy | `Protect: .env*, *.key, .git/**, migrations/** (ask). Destructive bash: rm -rf, git push --force → ask.` One screen, defaults pre-ticked. |
| 5 | Areas | `Proposed areas from folders: src/api, src/ui, scripts. Generate oac.areas? [Y/n]` |
| 6 | Optional: discover conventions | `Run convention discovery? Reads ~10 files, ~30k tokens, proposes ≤5 standards for you to accept/skip. [y/N]` (Agent OS pattern; spec-kit "don't invent" rule) |
| 7 | Compile + doctor | `Wrote: .claude/settings.json hooks (3), opencode.json permissions (7 rules), .codex/rules/oac.rules. Not enforceable on OpenCode: Stop gate → using pre-push instead.` |
| 8 | Next | `Try it: ask your agent to make a change, then run 'oac explain' to see which gates fired.` |

### 4.2 Greenfield (empty or near-empty repo)

| # | Step | What the user sees |
|---|---|---|
| 1 | Scan | `No manifests found. New project.` |
| 2 | Stack (3 questions, create-next-app style; first is "use recommended defaults?") | `Language? Test runner? Package manager?` ([F] create-next-app's first prompt is "use recommended defaults" with a customize path: https://nextjs.org/docs/app/api-reference/cli/create-next-app) |
| 3 | Seed context | Writes a **short** root AGENTS.md skeleton (≤40 lines: commands, layout, conventions TBD) and points CLAUDE.md at it. No generic 297-file library ([F] strategy "don't ship the generic standards library by default"). |
| 4 | Policy | Same defaults as brownfield. The verifier command is set to the chosen test runner, even before any tests exist (warns until a test exists). |
| 5 | Freshness | `mode: warn` with only the root area. New areas get proposed automatically when a new top-level folder or package appears (the CI check suggests a map entry). |
| 6 | Optional method interop | `Using a spec method? [none / spec-kit / OpenSpec / Superpowers]` sets which plan artifact paths the planning gate recognises. |

### 4.3 Monorepo / multi-language

| # | Step | What the user sees |
|---|---|---|
| 1 | Scan workspace | `Workspace: pnpm (12 packages), plus go.work (3 modules), Python (pyproject in tools/ml). Nx detected.` |
| 2 | Defer to the native tool where present | `Nx found: run 'nx configure-ai-agents' for Nx MCP/skills? OAC will not duplicate it.` / `turbo agentGuidance is on: OAC will not edit Turbo's block.` |
| 3 | Per-package context plan | A table: package → language → existing AGENTS.md? → proposed action (create stub / keep / skip). Stubs are ≤30 lines with package-local commands only. |
| 4 | Budget check | `Root→leaf AGENTS.md chain for packages/api: 9.1 KiB / 32 KiB (Codex limit). CLAUDE.md lines: 120/200.` |
| 5 | Areas = packages | `oac.areas` is generated one area per package, with globs plus that package's AGENTS.md as its context file. |
| 6 | Per-language verifiers | `verify: {packages/api: "pnpm -F api test", services/billing: "go test ./...", tools/ml: "uv run pytest"}`. The verifier runs only for touched areas (the impact pipeline). |
| 7 | Compile + doctor | Same as brownfield, plus `CC loads subdirectory CLAUDE.md on demand; Codex merges root→cwd; OpenCode reads nearest AGENTS.md` printed as a one-line capability note. |

---

## 5. Settings model

### Prior art (settings)
- [F] Claude Code precedence: managed > CLI > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`. List settings merge across scopes. A deny at any level wins. `settings.local.json` is auto-gitignored when CC writes it (https://code.claude.com/docs/en/settings, /permissions).
- [F] OpenCode merges remote `.well-known` → global → project → `.opencode` → managed/MDM, and later wins per key (https://opencode.ai/docs/config/).
- [F] spec-kit says presets "adapt existing behavior" and "can enforce organizational standards", and that catalogs "are not audits or endorsements" (https://github.com/github/spec-kit).
- [F] gstack `./setup --team` with `gstack-team-init required|optional`: `required` blocks teammates until they install; `optional` only nudges (https://github.com/garrytan/gstack).
- [F] The current OAC config is `.oac/config.json` with only `yoloMode`, `autoBackup` and a profile (`packages/cli/src/lib/config.ts`).

### Proposed OAC model [O]

Scopes mirror CC: **user** `~/.config/oac/config.yaml` (personal prefs, never committed), **project** `oac.policy` (committed, shared), **local** `.oac/local.yaml` (gitignored personal overrides), and **managed**, which comes from the host's managed settings and is never invented by OAC. Rule: a local or user scope can *tighten* any setting, but can loosen only settings the project marks `overridable: true`. This mirrors CC's "deny anywhere wins".

| Setting | Values | Solo default | Team default | Scope |
|---|---|---|---|---|
| `profile` | solo \| team | solo | team | project |
| `context.scout` | off \| lite (index + 1 hop, ≤N tokens) \| full | **off** | **lite** | user/local can raise; project sets max |
| `context.location` | agents-md (AGENTS.md + CLAUDE.md pointer) \| oac-dir (`.oac/context/`) \| both | agents-md | agents-md | project |
| `context.budget` | KiB per chain / lines per file | 32 KiB / 200 | 32 KiB / 200 | project |
| `pipelines.{research,bugfix,feature,planning,impact}` | on \| off | research on, bugfix on, feature on, planning off, impact on | all on | project |
| `addons.design_review` | off \| L-only \| tagged areas | off | off (opt-in) | project |
| `addons.security_review` | off \| tagged areas \| all-L | off | off (opt-in) | project |
| `gates.verifier` | off \| nudge \| block | block (Stop hook) | block (Stop + CI) | project |
| `gates.scope` | off \| warn \| ask \| block | warn | ask | project |
| `gates.freshness` | off \| warn \| block | off | warn → block per area | project |
| `gates.size_router` | auto \| always-S \| always-L | auto | auto | project; size-down needs a label on team |
| `ci.required_checks` | list | none | `oac/verify`, `oac/freshness` | project |
| `install.required` | true \| false (gstack-style) | false | true (doctor fails if hooks are absent or untrusted) | project |
| `ux.statusline` | on \| off | on | on | user |
| `ux.verbosity` | quiet \| normal \| explain | normal | normal | user/local |
| `context_packs` | list of opt-in packs (e.g. `lang/go`, `security/asvs-l1`) | [] | [] | project |

Defaults reflect the feedback that users hate token burn and ceremony, citing #258, #116 and the competitor critiques (`research-landscape-gaps.md` §4). Solo gets one hard gate (verifier) plus policy. Team adds CI and freshness in warn mode.

---

## 6. UX journey (install → first gated PR)

### Prior art (UX)
- [F] CC `systemMessage` is shown to the user. A PreToolUse `ask` reason is shown in the prompt with a source label (`[plugin:x]`). An exit-2 block appears as e.g. `PreToolUse:Bash hook error: … Blocked: rm commands are not allowed`. `/hooks` is a read-only browser showing each hook's source (https://code.claude.com/docs/en/hooks). It is not documented whether a `deny` reason is also shown to the user.
- [F] statusLine runs a command that gets session JSON on stdin, debounced at 300 ms (https://code.claude.com/docs/en/statusline).
- [F] `terraform plan -detailed-exitcode` (0/1/2) uses +/-/~ symbols (https://developer.hashicorp.com/terraform/cli/commands/plan). [F] `kubectl apply --dry-run=client|server` (https://kubernetes.io/docs/reference/kubectl/generated/kubectl_apply/).
- [F] Conftest output is `FAIL - file - message` with a summary line (https://www.conftest.dev/). [F] ESLint `meta.docs.url` links each violation to its rule doc (https://eslint.org/docs/latest/extend/custom-rules).
- [F] spec-kit's "artifact inventory" shows which layer supplies each file, per `research-landscape-gaps.md` item 29.

### Recommended journey [O]

1. **Install** (one command per host: `npx oac init`, CC marketplace, OC plugin). It prints the plan before writing anything, terraform-style:
   ```
   oac init (dry run)   + .claude/settings.json  hooks: PreToolUse(policy), Stop(verifier)
                        + opencode.json          permissions: 7 rules
                        ~ CLAUDE.md              managed block (+6 lines)
                        ! OpenCode: no Stop gate → pre-push hook offered
   Apply? [Y/n]
   ```
2. **Wizard** (≤6 screens; first is "use recommended defaults for solo/team?"). This is the §4 flow for the detected repo type.
3. **`oac doctor`**: green/amber/red per host, including "Codex hooks untrusted → run /hooks".
4. **First session.** The statusline shows `OAC team · size M · gates: verify✓ scope! fresh· · scout:lite`. One SessionStart line names the active pipeline and gates (≤3 lines; never "MUST invoke" prompts, per strategy).
5. **When blocked**, every message uses one format (conftest/ESLint style) with a rule ID and a fix:
   `OAC blocked [oac/fresh/api]: services/api changed, services/api/AGENTS.md unchanged. Fix: update it, or add 'Context-Waiver: <reason>'. Why: oac explain oac/fresh/api`
   The same text goes to `reason` (for the agent) and to `systemMessage` (for the user).
6. **`oac explain [rule|last]`** shows which rule fired, which file in `oac.policy` defined it, which host primitive enforced it, and how to waive it. It reuses the provenance-inventory idea.
7. **First PR.** The CI check summary is a table: area → changed files → context updated? → verdict. Waiver reasons are echoed. A link goes to `oac explain`.
8. **After two weeks**, `oac report` shows the gates that fired, waivers per area, and minutes added. The suggestion "promote `api` freshness to block" comes from the data.

---

## 7. What OAC already has that maps to this

| Need | Existing asset | Fit |
|---|---|---|
| Policy deny/ask reference | `content/agents/core/openagent.md` permission block (`bash "*": ask`, `sudo *` deny, `**/*.env*`, `**/*.key`, `.git/**` edit-deny) [F file] | Lift into `oac.policy` defaults |
| Verifier-before-done | `plugins/claude-code/skills/verification-before-completion/` (prompt only) [F]; `content/agents/subagents/code/build-agent.md` [F]; `.opencode/plugins/coder-verification/index.ts` (string-matching "Self-Review" in output, toast only; not a gate) [F file] | Turn into the Stop hook + pre-push; drop string matching |
| Bug-fix method | `plugins/claude-code/skills/debugger/SKILL.md` ("NO FIXES WITHOUT ROOT CAUSE") [F] | Keep as optional prose; the gates come from §2.2 |
| Planning / task breakdown | `oac-approach`, `task-breakdown` skills; `task-manager` agent; `.opencode/skill/task-management` [F] | Strategy says cut or archive; replace with heading-lint gates that accept any method's artifact |
| Planning agents | `content/agents/subagents/planning/adr-manager.md`, `architecture-analyzer.md` [F] | ADR template idea → planning step 6 (MADR); agents archived per Keep/Change/Cut |
| Code/security review | `code-review` skill; `reviewer.md` agent; Claude `code-reviewer` [F] | Becomes the opt-in security/design add-on, with a verdict-line contract |
| Context scout | `contextscout.md`, `context-discovery` skill, SessionStart hook in `plugins/claude-code/hooks/session-start.sh` that tells Claude to run context-discovery every session [F] | Gate behind `context.scout: off\|lite\|full`; the SessionStart message must respect it |
| Context onboarding | `.opencode/command/add-context.md` (interactive "Project Intelligence" wizard), `.opencode/context/project-intelligence/` (technical-domain, decisions-log, living-notes) [F] | Reuse the wizard questions for brownfield step 6; output goes to AGENTS.md, not a parallel tree |
| Context maintenance | `.opencode/command/context.md` ("harvest summaries, extract knowledge") [F] | Becomes the optional `context-update` patch skill (§3.5c) |
| CLI | `packages/cli/src/commands/{init,doctor,apply,build,status}.ts`; `init` already has `--dry-run`, `--profile`; `doctor --json` "for CI"; `ide-detect.ts` [F files] | Extend: repo-type scan, `oac.policy` compile, `oac check freshness`, `oac explain`; doctor gains hook/trust checks |
| Settings | `.oac/config.json` with `yoloMode`, `autoBackup`, profile (`packages/cli/src/lib/config.ts`) [F] | Replace with the §5 scoped model |
| Cross-host compile | `packages/compatibility-layer/` (adapters, mappers) [F dir] | The policy compiler target |
| Worktree support | `.opencode/command/worktrees.md`; router worktree fix (#301) [F git log] | Native everywhere; keep only what the gates need |

---

## 8. Gaps and what to verify next

- §1b verified the framework claims. Still [unverified]:
  - whether BMAD v7 has shipped, and whether BMAD's QA gate file still exists in v6/v7
  - whether gstack's gates are hooks or skills
  - the exact keys cc-sdd writes to `spec.json`
  - the Kiro spec path
  - whether Codex has a plan mode
  
  Where a §2 **[F?]** pointer disagrees with §1b, use §1b. For example, BMAD now tiers trivial/build/epic/project rather than using "quick flow" track names.
- OpenCode v2 plugin events (are there Stop-like hooks?) were not checked. This decides whether OC needs the pre-push fallback.
- It is unverified whether a CC PreToolUse `deny` reason is displayed to the user, which affects the §6 step 5 dual-message design.
- No benchmark exists yet for the freshness gate's false-positive rate. The warn-first rollout is how to get one.
