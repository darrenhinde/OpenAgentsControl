> Initial planning record (2026-10-18). Current plan: [../ROADMAP.md](../ROADMAP.md) · decisions: [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md)

# OAC product plan

Written 2026-10-18. This plan supersedes the feature map and roadmap in `oac-plan.template.html` where the two disagree. §6.3 lists every change.

**Labels**
- **[F]** is a fact, with its source.
- **[F†]** is a host fact taken from docs that were not re-fetched this session. Check it before you build on it.
- **[O]** is a decision or an opinion.
- **[unverified]** means nobody could confirm it.

**Inputs**
- `research-dev-pipelines.md` (cited as **DP**)
- `research-verification.md` (**VR**)
- `01-strategy-synthesis.md` (**SS**)
- `research-landscape-gaps.md` (**LG**)
- the published plan (**PP**)
- `research_notes/OAC strategy review/2_approach_and_niche.md` (**S2**)

**Re-checked this session**
- Repo facts were checked with `git`, `grep` and `ls` on `refactor/canonical` at `d7924e4`.
- Codex hooks were re-fetched from https://learn.chatgpt.com/docs/hooks. VR had marked them UNVERIFIED. They are now [F].

---

## 0. The plan in ten lines

1. **What OAC is.** OAC is the easy way to set a repo up for coding agents. It scans the repo, writes lean context, and compiles one policy into guardrails the host enforces. [O]
2. **What OAC does not do.** It never imposes a workflow method. Pipelines are bundles of gates that read whatever artifacts your method produces, whether that is Superpowers, spec-kit, OpenSpec or plain prompts. [O]
3. **When gates fire.** Gates fire on risk measured from the diff (size, risk paths, contracts). They never fire on ceremony. Low-risk work sees nothing. [O]
4. **The default core.** Policy (secrets, destructive commands, scope), a verifier before "done", a read-only mode, impact path math, and context freshness for teams. [O]
5. **Everything else is opt-in.** That covers add-ons (reviewers, red-before-green, plan gate) and context packs. [O]
6. **Context scout ships `off` in both profiles.** It turns on only after an ablation shows that `lite` does no harm. Context can lower success and raise cost (arXiv 2602.11988 [F]). [O]
7. **Tests come before features.** `evals/v2/` (L0 deterministic, L1 host-load, L2 scripted fake model) is built at the start of v1.2. Every gate gets a failing L0 test and a failing L2 test before any code. [O]
8. **Roadmap changes** (details in §6.3):
   - The harness and the `.env` demo move into v1.2.
   - Onboarding, settings and `context.scout` move into v1.3.
   - Freshness warn mode lands in v1.4, and block mode in v1.5.
   - Reviewers become v1.5 add-ons.
   - Host descriptors leave v1.5.
9. **Selling today.** Only three claims are honest today (§1.2). The pitch below is what becomes true release by release. [O]
10. **Numbers.** No number goes in the README until an ablation produces it. [F] SS "Do not".

---

## 1. Positioning and pitch

### 1.1 Pitch

**One line [O]:** *OAC sets up any repo for coding agents: lean context they actually use, and guardrails the host enforces, not just asks for.*

**Three supporting claims [O]:**
1. **Set up in one pass, any repo.** `oac init` reads old, new and multi-language repos alike. It keeps your existing CLAUDE.md or AGENTS.md, adds a small managed block, and installs no generic standards library.
2. **Guardrails that hold.** One `oac.policy` compiles to Claude Code hooks, OpenCode v2 permission arrays and Codex rules and hooks. OAC publishes what each host cannot enforce.
3. **Context that stays current.** A PR check maps changed code to the context file that describes it. It asks for an update or a reasoned waiver, and it gets stricter only where the data says it is accurate.

**Target persona [O, from SS]:**
- **Primary:** a tech lead on a team of 3–30 whose agents work on real repos and who has been burned by an agent touching `.env`, running a destructive command, or saying "done" while tests fail.
- **Secondary (the on-ramp):** a solo developer in private mode who wants the same setup without team ceremony.

**What the persona does not get:** a methodology. They keep Superpowers, spec-kit or nothing at all.

### 1.2 What is honest to sell today

| Claim | True today? | Evidence |
|---|---|---|
| One canonical source compiles deterministically to OpenCode and Claude Code, and CI fails on drift | **Yes**, for agents and profiles only | [F] `Makefile:172` `check-canonical-drift` is the CI gate. Skills, context and commands are still hand-written (PP §03). |
| The permission resolver is ordered, last-match-wins and fail-closed | **Yes**, as an internal library | [F] `packages/compatibility-layer/src/core/Capabilities.ts`, 553 passing tests (`00-findings-log.md`). Users cannot see it yet. |
| The OpenCode primary agent has real host-enforced rules | **Yes on OpenCode v1.** Not verified on v2 | [F] `content/agents/core/openagent.md` L6-19: `bash "*": ask`, deny for `sudo *`, `rm -rf /*` and `> /dev/*`, and edit-deny for `**/*.env*`, `**/*.key`, `**/*.secret` and `.git/**`. |
| Installs and updates track sha256 and never overwrite your edits | **Code yes, distribution no** | [F] `packages/cli/src/commands/init.ts` has `--dry-run` and skips modified files. [F] `@controlstack/oac` returns npm E404 while `README.md:125` advertises it (`00-findings-log.md`). |
| `oac doctor --json` works for CI | **Yes**, for install health only | [F] `packages/cli/src/commands/doctor.ts:352`. It does not check policy yet. |
| Guardrails on Claude Code | **No** | [F] `plugins/claude-code/hooks/hooks.json` has a single SessionStart hook, no matcher and no PreToolUse or Stop hook. Protection is a copy-paste `RECOMMENDED-PERMISSIONS.md` (PP §10). |
| "Requests approval before execution" | **Only for openagent on OpenCode** | [F] opencoder has no `"*"` bash rule (LG §1a). [F] 12 agents hide tools behind a trailing `"*": deny` (#349). |
| Token-efficient | **No, and claiming it is risky** | [F] The SessionStart hook tells Claude to run context-discovery every session (DP §7). [F] #258 reports about 10 minutes to find context on GPT models. |
| Works with OpenCode v2 | **No** | [F] Path-derived IDs break delegation (#362), and v1 plugins don't load (#367) (`00-findings-log.md`). |
| Evals prove it works | **No** | [F] The eval framework is OpenCode-v1-only, path-graded and dormant, and its workflow sits in a directory GitHub doesn't load (VR §1). |

**Sell today, if asked [O]:** "A deterministic build for agent configs with a fail-closed permission model, and a careful installer." Say nothing about guardrails on Claude Code, v2 support, token savings or proof until the release in §1.3 makes each one true.

### 1.3 What must be fixed before each pitch claim is true

| Pitch claim | Must be fixed first | Release |
|---|---|---|
| "Install with one command" | Publish `@controlstack/oac` with provenance. Fix #281 (unknown skills). Add a CI smoke test of a fresh marketplace install. | v1.1 |
| "Works on OpenCode v2" | Flat IDs (#362), the #349 ordering lint, a v2 plugin port, and L1 host-load in CI | v1.2 |
| "Set up in one pass, any repo" | `oac init` repo-type scan, managed block, 4 onboarding fixtures passing L0, L1 and L2 | v1.3 |
| "Lean context" | SessionStart no longer orders context-discovery (moved to v1.1). `context.scout` defaults to `off`. The generic library is no longer installed by default. | v1.1 / v1.3 |
| "Guardrails that hold" (CC + OC v2) | Policy compiler, plugin-level CC hooks, OC v2 permissions plus plugin, and the red-team pass in §7 | v1.4 |
| "Publishes what it cannot enforce" | A generated capability matrix with a `--check` drift test | v1.4 |
| "Context that stays current" | `oac check freshness` in CI (warn), the Stop-hook nudge, and the labelled corpus passing at the thresholds in §7 | v1.4 (warn), v1.5 (block) |
| "…and Codex" | Codex emitter (rules + hooks) and an L1 load | v1.5 |
| Any measured number | A pre-registered L3 ablation with raw JSONL published | v1.5 |

### 1.4 README hero (usable at v1.4; trim the claims for earlier releases)

```markdown
# OpenAgentsControl

**Set your repo up for coding agents: lean context they actually use, and guardrails the host enforces.**

`oac init` reads your project (old, new or monorepo), keeps the agent files you already have,
and compiles one `oac.policy` into Claude Code hooks, OpenCode permissions and Codex rules.
When a host can't enforce a rule, OAC says so instead of pretending.

Use it with Superpowers, spec-kit or no method at all. OAC checks the work, not the ceremony.
```

**What you get (5 bullets):**
- **Setup that reads your repo.** It detects languages, test commands and workspaces, then writes a short AGENTS.md block, with no 300-file library.
- **Hard stops on real risk.** Secrets, destructive commands and writes outside scope are blocked by the host, not by a prompt.
- **No "done" without green tests.** The verifier runs your test and typecheck commands before the agent can finish.
- **Context that keeps up.** A PR check asks for a context update when code in an area changes, or a one-line waiver.
- **An honest map.** `oac explain` shows which rule fired and why. A published matrix shows what each host can and cannot enforce.

**Copy rules [O]:** no percentages, no "token-efficient", no "any language" until §7 rows pass. Anything that is only true for some hosts carries a host footnote.

---

## 2. Product model

### 2.1 Core, add-ons and context packs

**Rule [O]:** core is what has a mechanical signal, near-zero idle tokens and a pass in §7. Anything that costs a model call, a second test run or a document is an add-on.

| Item | Kind | Solo default | Team default | Why it sits here |
|---|---|---|---|---|
| Policy gate: secrets read/write deny | **Core** | block | block (not overridable) | The flagship. Cheap on all three hosts [F DP §1] |
| Policy gate: destructive commands | **Core** | ask | block | [F] openagent already does this on OC |
| Policy gate: protected paths and write scope | **Core** | warn | ask | Lifts openagent's edit-deny list |
| Verifier before done | **Core** | block | block (+ CI) | DP calls it the flagship. Prompts alone decay [F arXiv 2605.10039 via S2] |
| Read-only mode (investigation, planning) | **Core** | on when entered | on when entered | One mechanical gate, the same idea as plan mode |
| Size router (S/M/L from the diff) | **Core** | auto | auto (size-down needs a label) | Pure path math. Drives every other escalation |
| Impact (areas touched, dependents, contracts) | **Core** | on | on | Pure path math, no LLM |
| Context freshness | **Core** | off | warn → block per area | The maintainer's "PR hook-like" ask |
| Decision log + `oac report` + `oac explain` | **Core** | on (log outside the repo) | on (`.oac/logs`, gitignored, hashed) | How gates prove themselves and how users see why |
| Context scout | **Setting** | off | off (may flip to lite at v1.5 if the ablation passes) | Token cost, plus evidence it can hurt [F arXiv 2602.11988] |
| Red-before-green (bug fix) | Add-on | off | off | Costs a second test run |
| Plan gate (L-size work needs an approved plan) | Add-on | off | off | Ceremony unless the team wants it |
| Design reviewer | Add-on | off | off | Model call. Fires only on L or tagged areas |
| Security reviewer | Add-on | off | off | Model call plus checklist. Tagged areas only |
| Convention discovery (`oac init --discover`) | Add-on | off | off | About 30k tokens per run [O estimate, DP §4.1] |
| `context-update` patch skill | Add-on | off | off | Model call. Proposes a patch of 10 lines or fewer |
| ADR check (planning `decision: true`) | Add-on | off | off | Method-adjacent |
| Context packs (`lang/*`, `security/asvs-l1`, `framework/*`) | Pack | none | none | They replace the default 297-file library [F LG §1f] |

**Cut, not deferred [O].** These are Stop-hook regex checks that DP proposed. Each is ceremony, not risk:
- "every finding cited"
- the "Root cause:" line
- "≥2 alternatives"
- "all tasks ticked"
- "source changed ⇒ tests changed"

Re-add any of them only if a user files an issue with a real failure.

**Cut from shipped content [F LG §1, adopted]:**
- task-manager, batch-executor, stage-orchestrator
- the 5 planning agents and 5 system-builder agents
- the debugger, parallel-execution and task-breakdown skills
- the worktrees command
- the gemini and image tools

Their prose survives only where a gate needs it.

### 2.2 How pipelines map onto core [O]

There are two runtime modes and no pipeline engine:
- **Read-only mode** covers investigation, planning and design impact before code.
- **Change mode** is the default and covers bug fixes and features.

Size and area tags decide which gates fire in change mode. "Pipelines" in §3 are named recipes over these gates for the docs and `oac explain`. They do not drive a state machine. This keeps OAC out of the method business. [O]

**Interop paths the plan gate and reviewer gates recognise:**

| Path | Source |
|---|---|
| `specs/*/plan.md` | spec-kit |
| `openspec/changes/*/` | OpenSpec |
| `docs/superpowers/{specs,plans}/` | Superpowers |
| `docs/plans/` | compound-engineering |
| `.kiro/specs/*/` | Kiro / cc-sdd |
| `agent-os/specs/` | Agent OS |
| `.oac/work/<id>/` | OAC's own fallback |

These paths are [F DP §1b]. CC plans in `~/.claude/plans/` are user-local, so CI cannot see them. Accepted verdict vocabularies: `pass|changes`, `GO|CONDITIONAL|NO-GO` (cc-sdd) and `PASS|CONCERNS|FAIL|WAIVED` (BMAD) [F DP §1b].

### 2.3 Size router (deterministic) [O; thresholds untested, calibrated by L5]

| Size | Trigger (any one) | Gates that fire |
|---|---|---|
| S | ≤3 files, no risk path, no new dependency | policy + verifier |
| M | 4–15 files, or ≥2 areas | S + scope warning + freshness |
| L | >15 files, or a path matching `contracts` (migrations, `*.proto`, `openapi*`, auth, crypto, infra), or a new dependency, or a new package | M + plan gate (if the add-on is on) + reviewers for matching tags (if on) |

The router guesses at UserPromptSubmit and announces the size in one line. It recomputes from the real diff at Stop and in CI, and **CI wins**. Sizing up is always allowed. Sizing down on team needs the `oac:size-override` label.

### 2.4 Settings

**Scopes [O, modelled on CC precedence, F DP §5]:**

| Scope | File | Committed? |
|---|---|---|
| project | `oac.policy` | committed |
| local | `.oac/local.yaml` | gitignored |
| user | `~/.config/oac/config.yaml` | personal |
| managed | the host's own managed settings | OAC never invents this |

**Precedence rule:** local and user can always tighten a setting. They can loosen only keys listed in `overridable:`.

**Format [O, decision D2]:** YAML content, a JSON Schema published for editors, and `version: 1`.

| Key | Values | Solo | Team | Overridable by local/user? |
|---|---|---|---|---|
| `profile` | `solo \| team` | solo | team | no |
| `context.scout` | `off \| lite \| full` | **off** | **off** | yes, up to `context.scout_max` |
| `context.scout_max` | `off \| lite \| full` | full | lite | no |
| `context.location` | `agents-md \| oac-dir` | agents-md | agents-md | no |
| `context.budget` | `{agents_md_kib: 32, claude_md_lines: 200}` | as shown | as shown | no |
| `context.packs` | list | [] | [] | add only |
| `verify.commands` | map of name → command, per area | from scan | from scan | no |
| `gates.secrets` | `block` | block | block | **never** |
| `gates.destructive` | `ask \| block` | ask | block | tighten only |
| `gates.scope` | `off \| warn \| ask \| block` | warn | ask | tighten only |
| `gates.verifier` | `off \| nudge \| block` | block | block | no |
| `gates.size_router` | `auto \| off` | auto | auto | no |
| `gates.freshness` | `off \| warn \| block` (per area in `areas`) | off | warn | tighten only |
| `addons.red_before_green` | `off \| nudge \| block` | off | off | tighten only |
| `addons.plan_gate` | `off \| nudge \| block` (L only) | off | off | tighten only |
| `addons.design_review` | `off \| L \| tagged` | off | off | tighten only |
| `addons.security_review` | `off \| tagged \| L` | off | off | tighten only |
| `ci.required_checks` | list | [] | [`oac/verify`, `oac/freshness`] | no |
| `install.required` | bool | false | true (doctor fails on missing or untrusted hooks) | no |
| `logs.location` | `user \| repo` | user | repo (gitignored) | no |
| `logs.redact` | `none \| hash` | none | hash | tighten only |
| `ux.verbosity` | `quiet \| normal \| explain` | normal | normal | yes |
| `ux.statusline` | `on \| off` | on | on | yes |

**Scout levels [O]:**

| Level | What it does | Token cap |
|---|---|---|
| `off` | No scout. SessionStart injects at most 3 lines (profile, active gates, area context pointers). Agents read AGENTS.md natively. | none |
| `lite` | The index plus the context files of the touched areas, one hop. | 4k tokens [O; measured in the v1.3 ablation] |
| `full` | Today's ContextScout subagent | none |

### 2.5 Sample `oac.policy`

**Solo:**
```yaml
version: 1
profile: solo
context:
  scout: off
verify:
  commands: { test: "npm test", typecheck: "npx tsc --noEmit" }
gates:
  destructive: ask
  scope: warn
protect:
  deny:  [".env*", "**/*.key", "**/*.pem", ".git/**"]
  ask:   ["migrations/**"]
areas:
  "*": { context: ["AGENTS.md"] }
```

**Team (monorepo):**
```yaml
version: 1
profile: team
overridable: [context.scout, ux.verbosity]
context:
  scout: off
  scout_max: lite
  packs: [security/asvs-l1]
verify:
  commands:
    "packages/api": { test: "pnpm -F api test", typecheck: "pnpm -F api tsc --noEmit" }
    "services/billing": { test: "go test ./..." }
    "tools/ml": { test: "uv run pytest" }
gates:
  destructive: block
  scope: ask
  freshness: warn
addons:
  security_review: tagged
  plan_gate: nudge
interop:
  plans: auto            # recognise spec-kit / OpenSpec / Superpowers paths
protect:
  deny: [".env*", "**/*.key", "**/*.pem", ".git/**", "infra/prod/**"]
  ask:  ["**/migrations/**", ".github/workflows/**"]
areas:
  api:
    paths: ["packages/api/**", "!**/*.test.ts"]
    context: ["packages/api/AGENTS.md"]
    tags: [security]
    freshness: block       # promoted after its waiver rate stayed low
  billing:
    paths: ["services/billing/**"]
    context: ["services/billing/AGENTS.md"]
    tags: [security, contracts]
  ml:
    paths: ["tools/ml/**"]
    context: ["tools/ml/AGENTS.md"]
  "*":
    context: ["AGENTS.md"]
freshness:
  ignore: ["**/*.md", "**/__snapshots__/**", "*lock*"]
  min_changed_files: 3
  waiver_label: "oac:context-ok"
  waiver_trailer: "Context-Waiver:"
ci:
  required_checks: [oac/verify, oac/freshness]
install:
  required: true
```

---

## 3. Pipelines

**Key**
- **M** = mechanical: the host or CI enforces it.
- **A** = advisory: a reason, toast or comment.

**Host primitives [F DP §1, unless marked]:**

| Host | Primitives |
|---|---|
| CC | PreToolUse `permissionDecision`. Stop/SubagentStop `decision: block`, which respects `stop_hook_active` and has a cap of 8. |
| OC v2 | ordered `permissions`. `ctx.tool.hook("execute.before")` and `ctx.permission.hook("evaluate")` [F `research-opencode-v2.md` L163-164]. **There is no Stop-block** [F, none listed in the v2 hook map]. |
| Codex | PreToolUse deny, `.rules` and `--sandbox read-only`. Stop `decision: block` **continues the turn with the reason as a new prompt** rather than rejecting it, and hooks run only once trusted by hash [F learn.chatgpt.com/docs/hooks, fetched 2026-10-18]. |
| CI | required status check plus label waivers |

**The OC "done" gate [O].** OC has no Stop hook, so the verifier on OC is an `execute.before` deny on the agent's own `git commit` and `git push` calls until the verifier passes. A `pre-push` hook covers humans, and CI covers everyone.

**Every block message uses one format [O, DP §6]:**
`OAC blocked [oac/<gate>/<area>]: <what>. Fix: <action>. Why: oac explain <rule>`

### 3.1 Investigation (read-only mode)

| Step | Gate | CC | OC v2 | Codex | User sees |
|---|---|---|---|---|---|
| Enter (`/oac research`, or the host plan mode) | — | skill writes `.oac/state/mode=research` | `oac-research` agent | `--sandbox read-only` | `OAC research mode: edits blocked except .oac/work/**` |
| Explore | **M**: write lock outside `.oac/work/**` | PreToolUse deny on Edit/Write/MultiEdit + mutating Bash | agent `edit: deny` except the scratch glob | sandbox read-only [F DP §1b] | `OAC blocked [oac/readonly]: research mode. Fix: /oac change` |
| Scout (if `context.scout ≠ off`) | A: token cap | SessionStart / skill | plugin | SessionStart hook | statusline `scout:lite 3.1k` |
| Findings → hand-off | none | — | — | — | `.oac/work/<id>/research.md` (optional) |

- **Goal:** 0 source writes in research mode. In L3, ≥80% of reports name the correct root-cause file.
- **Test:** L0 hook fixtures (deny/allow table). L2 scripted "edit during research" denied on CC and OC. L3 weekly from v1.5.

### 3.2 Bug fix (change mode)

| Step | Gate | CC | OC v2 | Codex | User sees |
|---|---|---|---|---|---|
| Size from the diff | — (routes) | UserPromptSubmit line; Stop recompute | plugin on `session.idle` (toast) | UserPromptSubmit | `OAC · size S · gates: verify` |
| Reproduce: failing test first | **A** by default; **M** with add-on `red_before_green: block` | Stop runs `oac check repro` on the base commit | pre-push | Stop (continuation) | `Add a test that fails on the pre-fix code, or set size S` |
| Fix in scope | M (policy) + A (scope warn) | PreToolUse deny/ask | permissions + `execute.before` | PreToolUse / rules | `OAC asks [oac/scope/api]: write outside declared area` |
| Verify before done | **M** | Stop block until test + typecheck exit 0 | deny agent `git commit/push` until green; pre-push | Stop continuation | `OAC blocked [oac/verify]: npm test failed (3). Fix the tests; no "done" yet` |
| Context write-back | §4 freshness | Stop nudge once | toast + pre-push | Stop continuation | see §4 |

- **Goal:** pass^3 ≥90% for "tests green after the last source edit and before done" on L3 regression tasks. Task success no lower than off by more than the MDE.
- **Test:** L0 Stop fixtures. L2 `done-without-tests` is blocked, then passes after a green run. L3 nightly smoke from v1.4.

### 3.3 Feature update (change mode)

| Step | Gate | CC | OC v2 | Codex | User sees |
|---|---|---|---|---|---|
| Size | routes | as in §3.2 | as in §3.2 | as in §3.2 | `size L: contracts path packages/api/openapi.yaml` |
| Plan exists (L only, add-on `plan_gate`) | A (`nudge`) or M (`block`) | PreToolUse on the first source edit checks any interop path in §2.2 | `execute.before` | PreToolUse | `L-size change, no plan found in specs/, docs/plans/, openspec/… Write one, or label oac:size-override` |
| Implement in scope | M | PreToolUse | permissions | rules / PreToolUse | as in §3.2 |
| Verify | M | Stop | commit/push deny + pre-push | Stop | as in §3.2 |
| Reviewers (add-ons, L or tagged) | §3.6 / §3.7 | | | | |
| Freshness | §4 | | | | |

- **Goal:** with the plan gate on, 100% of L2 runs have no source write before a recognised plan artifact. With it off, the gate never fires (100%). Tokens on vs off ≤1.3×.
- **Test:** L2 stage-order and gate-absence tests. L3/L5 weekly from v1.5.

### 3.4 Planning (read-only mode + artifact check)

| Step | Gate | CC | OC v2 | Codex | User sees |
|---|---|---|---|---|---|
| Write the plan in your method's location | M: read-only outside the plan paths | PreToolUse; native plan mode also works | `oac-plan` agent, edit allowed only on plan globs | sandbox + rules | `OAC plan mode: only plan paths writable` |
| Approval (team, add-on `plan_gate: block`, L only) | M | PreToolUse checks for a `Status: approved` / `Approved-by:` line | `execute.before` | PreToolUse | `Plan not approved. Add 'Approved-by: <name>' to <plan path>` |
| Leave → change mode | — | `/oac change` | switch agent | new session | — |

- **Goal:** 0 source writes in plan mode. Plans from spec-kit, OpenSpec and Superpowers fixtures are recognised 100% of the time.
- **Test:** L0 artifact-detector fixtures (one per interop path). L2 write-during-plan denied.

### 3.5 Design impact (core, no LLM)

| Step | Gate | Host | User sees |
|---|---|---|---|
| Areas touched = `git diff` × `oac.areas` | — | CLI `oac impact`; CI check summary | `Touches: api (6 files), web (1). Dependents: web, admin` |
| Dependents from the workspace graph (pnpm/nx/turbo, go.work, Cargo) | — | CLI / CI | dependents list |
| Contracts touched (migrations, `*.proto`, `openapi*`, env/config schema) | escalates to L | Stop line (CC/Codex), toast (OC), CI comment | `Contract change: services/billing/migrations/0042.sql → size L` |

- **Goal:** recall ≥0.9 and precision ≥0.9 for contract flags on a seeded fixture diff set. Correct dependents on 100% of monorepo fixtures.
- **Test:** L0 `impact.test.ts` over `fixtures/pr-diffs/`, every PR.

### 3.6 Add-on: design reviewer

| Step | Gate | Host | User sees |
|---|---|---|---|
| Trigger: size L, or an area tagged `design-review` | — | Stop / CI | `Design review required for area api (size L)` |
| Review by any reviewer (OAC prompt, gstack `/plan-design-review`, a human) | — | writes `review-design.md` with a `Verdict:` line | — |
| Resolve | M in CI (team) / A (solo) | CI required check parses the verdict; waiver label | `oac/design: changes-requested open` |

- **Goal:** off ⇒ never appears (100%). On ⇒ appears on 100% of qualifying L2 runs. All three verdict vocabularies parse.
- **Test:** L0 verdict-parser fixtures. L2 presence/absence. L3 later.

### 3.7 Add-on: security reviewer

| Step | Gate | Host | User sees |
|---|---|---|---|
| Trigger: a touched area is tagged `security`, or a dependency manifest changed | — | Stop / CI | `Security review: area billing (auth/**)` |
| Shostack's four questions + STRIDE per changed boundary | A | the reviewer writes `review-security.md` | — |
| ASVS L1 rows for the touched chapters (pack `security/asvs-l1`) | M in CI: no `fail` without an issue link | CI | `ASVS v5.0.0-6.2.1 fail without issue link` |
| SARIF from existing scanners | M in CI: no new high findings | CI | check summary |

The four questions, STRIDE and ASVS are [F DP §2.8]. OAC ships the checklist selection and the parser, not a security brain. Always-on secrets and destructive-command policy stays in core. [O]

- **Goal:** ≥70% of seeded vulnerabilities caught, with ≤20% false findings.
- **Test:** L3 seeded set, weekly, from v1.5. L0 parser fixtures every PR.

---

## 4. PR context freshness (final design)

**Map.** The `areas` section of `oac.policy` (§2.5), CODEOWNERS-style, last match wins. `oac init` generates it: one area per package in a monorepo, one per top-level source folder otherwise. Users edit it; they never author it from scratch. [O]

**Detection (deterministic, no LLM) [O]:**
1. For each area whose `paths` match changed files (after `ignore`, and with at least `min_changed_files` changed), the check passes if any of the area's `context` files is added, modified **or deleted** in the same PR. Deleting a stale line counts as an update.
2. **Stale-reference lint:** context files that name paths or scripts that no longer exist get a warning. This mirrors CC `/doctor prompt-audit` [F DP §3].
3. **Budget:** the root-to-leaf AGENTS.md chain must stay ≤32 KiB (Codex `project_doc_max_bytes` [F DP §3]), and CLAUDE.md ≤200 lines [F DP §3].

**Waivers.** Either the `oac:context-ok` label or a `Context-Waiver: <reason>` trailer, and the reason is required. The check echoes the reason into its summary. The workflow listens on `opened, synchronize, reopened, labeled, unlabeled` so a label re-runs it [F changelog-enforcer pattern, DP §3].

**One engine, four places** (`oac check freshness`):

| Place | Behaviour |
|---|---|
| CC Stop hook | Blocks **once** per turn with a specific reason and respects `stop_hook_active`. For example: `You changed 6 files in api; packages/api/AGENTS.md unchanged. Update it (add/remove/correct lines) or add 'Context-Waiver: <reason>' to the PR body.` |
| Codex Stop hook | The same text as a continuation prompt [F learn.chatgpt.com/docs/hooks]. `oac doctor` reports untrusted hooks as degraded. |
| OpenCode v2 | A toast on `session.idle` plus a pre-push non-zero exit in block mode. There is no Stop-block. [F] |
| CI (team) | An in-repo script run by a SHA-pinned composite action. No third-party changed-files action (tj-actions CVE-2025-30066 [F DP §3]). |

**Prompting before the gate fails [O].** At most one injected line per mentioned area at SessionStart, for example `Area api → keep packages/api/AGENTS.md current.` The `context-update` add-on can propose a patch of 10 lines or fewer, never a rewrite.

**Rollout [O]:**
- Install in `warn`.
- After 14 days, `oac report freshness` shows per-area fire, waive and fix rates.
- Promote an area to `block` when, over at least 10 firings, its waiver rate is ≤20%. Waivers are the false-positive proxy.
- Never block repo-wide by default.

**Goals:**
- precision ≥0.8 and recall ≥0.9 on a labelled corpus of ≥100 real PR diffs
- live waiver rate ≤20% on promoted areas
- Stop-hook nudge resolved in the same session ≥60% of the time (L2 scripted; L3 observed)

**Tests:**
- L0 `context-freshness.test.ts` over `fixtures/pr-diffs/*.json`. Start with 20 labelled diffs at v1.2 and grow to 100 by v1.4.
- L0 waiver parsing.
- L2 Stop nudge fires once, and not again when `stop_hook_active` is set.
- A monthly relabel of the corpus.

---

## 5. Onboarding

**Shared engine [O, DP §4]:**
- `oac init` runs a deterministic scan with no LLM. It reads manifests, workspace files, CI config and existing agent files, picks the repo type, and prints a terraform-style dry-run plan before writing anything.
- LLM steps are opt-in and always show a proposal first.
- No step overwrites a user file. OAC writes only inside `<!-- oac:begin -->…<!-- oac:end -->` or in its own files.

### 5.1 Old project (brownfield, single package)

1. **Scan.** `Detected: TypeScript (package.json), Vitest, GitHub Actions. Existing: CLAUDE.md (142 lines), no AGENTS.md.`
2. **Keep, don't overwrite.** `CLAUDE.md kept. OAC adds a managed block (+6 lines) and AGENTS.md pointing to it.`
3. **Verifier commands.** `test=npm test, typecheck=tsc --noEmit (from package.json + CI). [Enter / edit]`
4. **Policy, one screen.** `Protect .env*, *.key, .git/** (deny); migrations/** (ask). rm -rf, push --force → ask.`
5. **Areas.** `Proposed: src/api, src/ui, scripts. Write areas? [Y/n]`
6. **Profile.** `Solo or team? (team adds CI checks and freshness warn)`
7. **Dry-run plan, then apply.** `+ .claude/settings.json hooks(3) + opencode.json permissions(7) ~ CLAUDE.md block ! OpenCode: no Stop gate → pre-push offered. Apply? [Y/n]`
8. **Doctor.** Green, amber or red per host, e.g. `Codex hooks untrusted → run /hooks`.
9. **Try it.** `Ask your agent to read .env, or to finish without tests. Then: oac explain last.`

- **Goal:** time to first gate fire ≤10 min in a human-timed dogfood run [O target]. 0 user lines changed outside managed blocks. Detected commands correct on 100% of fixtures.
- **Test:** L0 `onboarding.e2e` on the `legacy-python-no-tests` and `ts-single` fixtures (snapshots + sizes + `git diff` outside blocks = ∅). L2 one scripted gated action after init. A timed manual run per release.

### 5.2 New project (greenfield)

1. **Scan.** `No manifests. New project.`
2. **Three questions, the first being "recommended defaults?"** Language, test runner and package manager (create-next-app pattern [F DP §4.2]).
3. **Seed.** A root AGENTS.md of ≤40 lines (commands, layout, "conventions: TBD"). CLAUDE.md points at it. No library.
4. **Policy.** The defaults from §5.1. The verifier is set to the chosen runner and warns until a test exists.
5. **Method interop.** `Using a spec method? none / spec-kit / OpenSpec / Superpowers` sets `interop.plans`.
6. **Apply + doctor + try it,** as in §5.1, steps 7–9.

- **Goal:** ≤3 questions before the plan is shown. Root AGENTS.md ≤40 lines. First gate fire ≤5 min [O target].
- **Test:** L0 snapshot on the `empty` fixture. L2 gated action.

### 5.3 Monorepo / multi-language

1. **Scan the workspace.** `pnpm (12 packages) + go.work (3 modules) + pyproject (tools/ml). Nx detected.`
2. **Defer to native tools.** `Nx found: 'nx configure-ai-agents' covers Nx MCP/skills; OAC won't duplicate it. turbo agentGuidance on: OAC won't touch Turbo's block.` [F DP §4]
3. **Per-package plan, as a table.** package → language → existing AGENTS.md → action (stub / keep / skip). Stubs are ≤30 lines with local commands only.
4. **Budget check.** `packages/api chain 9.1 / 32 KiB; CLAUDE.md 120 / 200 lines.`
5. **Areas = packages,** each with its own AGENTS.md as context.
6. **Per-language verifiers.** `pnpm -F api test`, `go test ./...`, `uv run pytest`. These run only for touched areas (impact).
7. **Apply + doctor.** It also prints the host loading note: `CC loads subdirectory CLAUDE.md on demand; Codex merges root→cwd; OpenCode reads nearest AGENTS.md` [F DP §4].

- **Goal:** every package gets the right language and test command (100% of fixtures). Every chain is within budget. The verifier runs only touched areas (L2). Time to first gate fire ≤15 min [O target].
- **Test:** L0 on the `ts-go-py-monorepo` and `csharp-sln` fixtures. L2 a change in `services/billing` runs `go test` only.

---

## 6. Test-first build order

### 6.1 The harness, built before any feature (start of v1.2)

This is trimmed from VR §7 [O]. Harbor, promptfoo and Inspect wait until they are needed (v1.4 and v1.5).

```
evals/v2/
  package.json            # vitest + zod only; a pnpm workspace member (see risk R9)
  schema/oac-event.ts     # OacEvent union (VR §3.1) + decision-log row schema (VR §8.1)
  normalize/
    opencode-v2.ts        # {type,data} events -> OacEvent[]     (v1.2)
    claude-stream.ts      # stream-json + OAC hook log -> OacEvent[] (v1.2)
    codex-exec.ts         # exec --json -> OacEvent[]            (v1.5)
  assert/{gates,order,done,tools,noleak}.ts
  fake-model/server.ts    # ~100-line Anthropic Messages + OpenAI-compat mock replaying *.turns.yaml
  fake-model/scripts/     # read-env, rm-rf, write-out-of-scope, done-no-tests, edit-in-research
  fixtures/
    repos/<name>/build.sh # fresh repo, synthetic git history, unique canary .env
                          # names: empty, ts-single, legacy-python-no-tests, ts-go-py-monorepo, csharp-sln
    hook-stdin/*.json     # PreToolUse/Stop payloads per host
    policies/*.policy     # compiler inputs
    golden/<policy>/<host>/...
    pr-diffs/*.json       # labelled for freshness + impact
  tests/l0  tests/l1  tests/l2
  results/                # gitignored raw JSONL; per-release summary committed
```

**CI [O]:**
- Add `evals-v2-l0-l2` to `pr-checks.yml` with host CLIs pinned.
- Put the nightly and weekly workflows at the **top level** of `.github/workflows/`, because GitHub ignores subdirectories [F VR §1].
- The legacy `evals/framework` stays untouched until its useful evaluators (stop-on-failure, report-first, cleanup-confirmation) are re-based on `OacEvent`.

**The first tests, written in week 1 of v1.2 and failing until their feature exists:**

| # | Test | Layer | Fails until |
|---|---|---|---|
| T1 | `l0/no-hidden-tools.lint`: no permission block ends in `{"*": deny}` for an available tool, and every `subagent`/`task` key names an emitted ID | L0 | #349 lint (v1.1 fix gets a test here) + #362 flat IDs |
| T2 | `l1/opencode-v2-loads`: in-process `@opencode/sdk` boots the generated tree, lists agents, asserts flat IDs and visible tools | L1 | v1.2 emitter |
| T3 | `l0/hook-pretooluse-secrets`: pipe fixture stdin → deny ×3, allow ×2. One decision-log row per call. p95 <150 ms | L0 | v1.2 demo hook |
| T4 | `l2/gate-blocks-env-read` (OC v2 first, then CC): scripted `Read(.env)` → `gate{deny}`. Canary absent everywhere. Log row present | L2 | v1.2 demo |
| T5 | `l0/context-freshness`: 20 labelled diffs; prints the confusion matrix; thresholds are reporting-only until v1.4 | L0 | v1.4 engine |
| T6 | `l0/decision-log-schema`: every row written by any OAC hook validates against zod | L0 | v1.2 demo hook |

### 6.2 Per feature: tests that must exist and fail first

| Feature | Tests written first (all red at start) | Release |
|---|---|---|
| Flat IDs + v2 permissions | T1, T2 | v1.2 |
| `.env` demo (OC v2 permissions; one hand-written CC plugin PreToolUse hook) | T3, T4, T6 | v1.2 |
| Lean bootstrap / SessionStart | `l0/sessionstart-payload`: ≤3 lines when `scout: off`; matcher `startup\|clear\|compact`; no "MUST" | v1.1 (the payload fix), v1.3 (the matcher) |
| Canonical skills | `l0/skills-validate` (skills-ref), `l1/skills-listed` per host | v1.3 |
| `oac init` scan + onboarding | `l0/onboarding.e2e` on 5 fixtures (detection, snapshots, size budgets, no edits outside blocks) | v1.3 |
| Settings + precedence | `l0/settings-precedence`: a matrix where "local tries to loosen" ⇒ resolves to the project value (100%); `git check-ignore .oac/local.yaml` | v1.3 |
| `context.scout` levels | `l0/scout-payload-size` per level; L3 three-arm ablation plan committed (`ablations/scout/PLAN.md`) before running | v1.3 |
| Policy compiler | `l0/policy-compile.snap` (3 hosts, goldens, matrix lists every unenforceable rule) | v1.4 |
| Secrets/destructive/scope gates | T3 extended; `l0/destructive-corpus` (deny 100%, 200 benign = 0 deny); L2 scripted per host; L4 promptfoo `coding-agent:secret-*`, `sandbox-*` | v1.4 |
| Verifier before done | `l0/stop-verifier` fixtures; `l2/done-requires-tests` (CC Stop; OC commit-deny) | v1.4 |
| Read-only mode | `l2/edit-in-research-denied` (CC, OC) | v1.4 |
| Size router + impact | `l0/size-router` (fixture diffs → S/M/L); `l0/impact` precision/recall | v1.4 |
| Freshness (warn) | T5 at thresholds; `l0/waiver-parse`; `l2/stop-nudge-once` | v1.4 |
| `oac explain` / `oac report` | `l2/report-matches-log` (totals = hand count; 1:1 with host events) | v1.4 |
| Capability matrix | `l0/matrix-check` (`--check` fails if stale) | v1.4 |
| Codex target | `l0/codex-rules` via `codex execpolicy check` [F†]; `l1/codex-loads`; `l2` with `codex exec --json` + mock `base_url` [F†] | v1.5 |
| Freshness block | the promotion rule tested on synthetic report data | v1.5 |
| Reviewer add-ons | `l0/verdict-parser` (3 vocabularies); `l2/addon-absent-when-off`, `addon-present-when-on` | v1.5 |
| Team lock | `l0/lock-verify` (tampered policy ⇒ fail) | v1.5 |
| Published proof | L3 pre-registered plans for verifier on/off and scout off/lite/full; L4 ≥60 attempts per host | v1.5 |

### 6.3 Roadmap, adjusted

| Release | Scope (new or moved items in **bold**) | Ready when |
|---|---|---|
| **v1.1** ship (~1 wk) | As PP: restore the hand-written Claude agents, CI green, #349 reorder + lint, PR #316, publish npm, README truth pass, marketplace smoke, tag. **Plus:** the SessionStart hook stops telling Claude to run context-discovery every session (S). | As PP, plus no README line claims guardrails on CC or token efficiency |
| **v1.2** OpenCode v2-native (4–6 wk) | **Week 1: `evals/v2` harness + T1–T6 red.** Then, as PP: flat IDs (#362), v2 plugin port (#367), safe defaults, version table. "Start real OpenCode in CI" becomes T2. **Plus:** the `.env` demo on OC v2 and CC (one hand-written plugin PreToolUse hook), shipped as the demand test. **Plus:** start labelling the freshness corpus (20 diffs). | T1–T4 and T6 green on pinned OC v1.19 + v2.0. The demo works on both hosts. |
| **v1.3** skills, context, onboarding (~4–5 wk, was ~3) | As PP: canonical skills, inventory cuts, lean bootstrap, generated docs. **Plus:** `oac init` scan and the three onboarding flows. **`oac.policy` schema v1 with `profile`, `context.*`, `verify`, `areas`** (no gates yet). Settings scopes + precedence. **`context.scout` off/lite/full**, with the generic library moved into opt-in packs. | Onboarding L0 on 5 fixtures green. Precedence matrix 100%. The scout ablation plan is committed. |
| **v1.4** guardrails (~5–6 wk) | As PP: compiler, CC plugin-level hooks, OC v2 permissions + plugin, matrix, `oac explain`, `oac doctor --policy`, red-team. **Plus:** verifier-before-done, read-only mode, size router, `oac impact`. **Freshness in warn** (CI + CC Stop + OC toast/pre-push). Decision log + `oac report`. **Nightly L3 smoke** (10 tasks × K=3). | Every §7 row tagged v1.4 passes. |
| **v1.5** Codex + proof | As PP: Codex (rules + hooks; hooks now [F]), published ablations, team lock, cleanup. **Plus:** freshness block promotion, design/security reviewer add-ons, the scout default decision from data. **Minus:** host descriptors (moved out). | Every §7 row tagged v1.5 passes. Numbers in the README come only from published runs. |
| v1.6+ (only on demand) | **Host descriptors**, convention discovery add-on, `context-update` skill, ADR check | — |

**What moved and why [O]:**
- **Harness → start of v1.2.** The maintainer asked for tests first, and T1–T2 already cover v1.2's own "ready when". It costs about a week, and every later release reuses it.
- **`.env` demo → v1.2** (it was a PP decision). It is the cheapest test of demand, which LG §4 says has never been voiced, before v1.4's large spend. The test (T4) exists anyway.
- **SessionStart payload fix → v1.1.** Running context-discovery every session is the token burn users leave over [F #116, #258]. It is a fix, not a feature, so it respects "nothing new in v1.1".
- **Onboarding, settings and `oac.policy` schema v1 → v1.3.** The context system changes in v1.3, and onboarding writes `areas`, which v1.4's freshness and impact need. Landing the file format before the compiler keeps v1.4 smaller.
- **Freshness split warn (v1.4) / block (v1.5).** Block mode needs field waiver data that only exists after warn has run (DP §3.6).
- **Reviewers → v1.5 add-ons.** They cost model calls, need the verdict gate from v1.4, and are not the wedge.
- **Host descriptors → v1.6+.** The Codex emitter can be written as a plain emitter. Descriptors pay off only at a fourth host, and SS says not to chase host count.

---

## 7. Scorecard: how we know we're getting there

All thresholds are [O] starting points, tightened once a baseline exists. "Release" is the first release where the row must pass and stay green.

| Feature / pipeline | Goal | Metric | Threshold | Test | Layer | Cadence | Release |
|---|---|---|---|---|---|---|---|
| No hidden tools (#349 class) | Every expected tool is visible | agents with listed ⊉ expected | 0 | T1, T2 | L0/L1 | PR | v1.2 |
| v2 load | Generated tree boots on v2 | agents listed with flat IDs | 100% | T2 | L1 | PR | v1.2 |
| Install truth | The documented install works | fresh marketplace + `npm i -g` smoke | pass | marketplace smoke | L1 | PR | v1.1 |
| SessionStart payload | Near-zero idle tokens | lines injected with `scout: off` | ≤3 | sessionstart-payload | L0 | PR | v1.1 |
| `.env` demo | Read blocked on OC v2 + CC | canary leaks in scripted runs | 0 | T4 | L2 | PR | v1.2 |
| Decision log | Every decision recorded | rows matched 1:1 with host events | 100% | T6, report-matches-log | L0/L2 | PR | v1.2 / v1.4 |
| Onboarding (old/new/mono) | Correct, non-destructive setup | detection accuracy; user lines changed outside blocks | 100%; 0 | onboarding.e2e (5 fixtures) | L0/L2 | PR | v1.3 |
| Onboarding time | Feels easy | human-timed init → first gate fire | ≤10 min (≤15 mono) | manual dogfood | — | per release | v1.3 |
| Context budget | Context stays small | AGENTS.md chain / CLAUDE.md lines | ≤32 KiB / ≤200 | budget lint | L0 | PR | v1.3 |
| Private vs team | Private can't loosen team | precedence matrix → project value | 100% | settings-precedence | L0 | PR | v1.3 |
| Context scout | No harm, known cost | success delta vs off; tokens | lite ≥ off − MDE; lite ≤ +15%, full ≤ +40% tokens; p95 ≤60s | 3-arm + no-context ablation, 30–50 tasks, K=3 | L3/L5 | per release | v1.5 (decides the default) |
| Policy compiler | Exact, honest output | golden match; unenforceable rules listed | 100%; 100% | policy-compile.snap | L0 | PR | v1.4 |
| Capability matrix | Never stale | `--check` | pass | matrix-check | L0 | PR | v1.4 |
| Secrets gate | Holds under attack | leaks / attempts per enforcing host; benign false blocks; hook p95 | 0 in ≥60 (95% upper bound ≤5%); ≤2%; ≤150 ms | T3, L2 per host, promptfoo secret-* | L0/L2/L4/L5 | PR / weekly | v1.4 |
| Destructive gate | Blocks the corpus, not normal work | corpus denied; benign denied | 100%; 0 of 200 | destructive-corpus | L0/L2 | PR | v1.4 |
| Scope escape | No writes outside the workspace | writes outside, across L4 trials | 0 | sandbox-* + hash diff | L2/L4 | PR / weekly | v1.4 |
| Investigation | Read-only holds | source writes in research mode | 0 (100% of L2) | edit-in-research-denied | L2 | PR | v1.4 |
| Investigation quality | Finds the cause | correct root-cause file named | ≥80% | L3 tasks | L3 | weekly | v1.5 |
| Bug fix / feature: verifier | No "done" on red | pass^3 tests-green-before-done | ≥90% | done-requires-tests + L3 | L2/L3 | PR / nightly | v1.4 (L2), v1.5 (L3) |
| Verifier cost | Doesn't break normal work | success delta on vs off; added wall-clock | ≥ −MDE; median <10% | paired ablation | L3/L5 | per release | v1.5 |
| Feature: plan gate (add-on) | Fires only when on and L | presence when on; absence when off | 100%; 100% | stage/gate assertions | L2 | PR | v1.4 |
| Planning | Plans from any method recognised | interop fixtures detected | 100% | artifact-detector | L0 | PR | v1.4 |
| Design impact | Flags contract changes | precision / recall on seeded diffs | ≥0.9 / ≥0.9 | impact.test | L0 | PR | v1.4 |
| Size router | Right-sizes from the diff | fixture diffs sized correctly; L-routing false positives on benign set | 100%; ≤10% | size-router + L5 | L0/L5 | PR / release | v1.4 |
| Freshness (warn) | Accurate nudges | precision / recall on ≥100 labelled PRs | ≥0.8 / ≥0.9 | T5 | L0 | PR + monthly relabel | v1.4 |
| Freshness (block) | Low friction where blocking | waiver rate on promoted areas | ≤20% over ≥10 firings | `oac report freshness` | field | 14-day review | v1.5 |
| Stop-hook nudge | Fixed before the PR | nudges resolved in-session | ≥60% | stop-nudge-once (L2); field | L2/field | PR | v1.4 |
| Design reviewer (add-on) | Present only when due | presence / absence; verdicts parsed | 100% / 100% / 3 vocabularies | verdict-parser, addon-present/absent | L0/L2 | PR | v1.5 |
| Security reviewer (add-on) | Catches seeded vulns | catch rate; false findings | ≥70%; ≤20% | seeded-vuln set | L3 | weekly | v1.5 |
| Codex target | Rules + hooks load and enforce | execpolicy check; L1 load; L2 env read | pass; pass; 0 leaks | codex-* | L0/L1/L2 | PR | v1.5 |
| Team lock | Drift fails CI | tampered policy detected | 100% | lock-verify | L0 | PR | v1.5 |
| Published proof | Numbers are real | every README number has a pre-registered plan + raw JSONL | 100% | review checklist | — | per release | v1.5 |

**Statistics note [O, VR §4.3]:**
- With 30 tasks, the minimum detectable effect is about 23pp, and with 50 tasks about 18pp. Report paired differences with a standard error. Use McNemar for binary outcomes.
- Red-team claims need ≥60 attempts per host for a "≤5% upper bound".
- Product-level adoption targets (stars, downloads, repos with `oac.policy`) stay as in PP §07 and are not repeated here.

---

## 8. Decisions open for the maintainer

1. **D1. Default `context.scout`.** Should it be `off` for both profiles, or `lite` for team as DP proposed?
   - **Recommendation:** `off` for both until the v1.3 ablation shows lite ≥ off − MDE at ≤ +15% tokens. Then flip team to `lite` in v1.5.
   - **Why:** the evidence says context can hurt [F arXiv 2602.11988], and token burn is the top complaint [F #116].
2. **D2. Policy file name and timing.**
   - **Recommendation:** keep the public name `oac.policy` with YAML content and a published JSON Schema. Land schema v1 (profile, context, verify, areas) in v1.3 and add gates in v1.4.
   - **Alternative:** `oac.yaml`, which gives better editor highlighting at the cost of losing the name already in the published plan.
3. **D3. Pipelines as gate recipes, not an engine.**
   - **Recommendation:** two modes (read-only, change), with size and tags deciding which gates fire. No stage state machine, and no OAC planning or debugging method.
   - **Cost:** "pipeline stage order" tests become gate-order tests.
4. **D4. Reviewers.**
   - **Recommendation:** ship one verdict gate plus checklists (ASVS pack, design checklist) in v1.5. Do not ship OAC-authored reviewer agents. Users plug in gstack `/cso`, CC `/security-review`, BMAD reviewers or a human.
   - **Effect:** narrows the existing `code-reviewer` to an optional default reviewer.
5. **D5. Freshness rollout.**
   - **Recommendation:** team installs default to `warn`. Promote to `block` per area, by the maintainer of that repo, when the waiver rate is ≤20% over ≥10 firings. OAC never auto-promotes. Solo stays `off`.
6. **D6. Host descriptors.**
   - **Recommendation:** move them from v1.5 to v1.6+, and only on demand for a fourth host. Write the Codex emitter directly.

---

## 9. Risks, including unverified facts

| # | Risk | Status | Blocks | Mitigation |
|---|---|---|---|---|
| R1 | Nobody has asked for guardrails. Demand is inferred [F LG §4] | open | scaling v1.4 spend | The v1.2 `.env` demo is the demand test. Watch the response before committing v1.4's full scope. |
| R2 | OC v2 event envelopes: which are native and which v1-compat [unverified, `research-opencode-v2.md` L212] | open | v1.2 (OC normaliser, T2, T4) | Assert only on `permission.asked/replied` and `session.tool.*`. Check against v2.0.31 source in week 1. |
| R3 | CC `claude -p` against a mock via `ANTHROPIC_BASE_URL` [F†]; `--setting-sources project` [F†]; stream-json `permission_denials` and init `tools` [F†] | open | v1.2 (CC half of T4), v1.4 (CC L2 suite) | Fallback is the OAC hook log + canary outcome check, which needs no stream fields. Re-fetch the headless and settings docs before writing the normaliser. |
| R4 | Whether a CC PreToolUse `deny` reason is shown to the user [unverified, DP §8] | open | v1.4 UX (the §3 message format) | Also emit `systemMessage`. Verify by hand in the v1.2 demo. |
| R5 | OC v2 has no Stop-block | [F] for the v2 hook map | v1.4 parity | Commit/push deny + pre-push + CI. Listed in the capability matrix. |
| R6 | Codex Stop "block" continues the turn rather than rejecting it, and hooks need hash trust [F learn.chatgpt.com/docs/hooks] | resolved as a fact, design impact open | v1.5 | Treat the Codex verifier as a nudge plus CI. Doctor reports "untrusted" as degraded. |
| R7 | Codex `exec --json` event names, `codex execpolicy check`, mock `base_url` [F†] | open | v1.5 (Codex normaliser, L0/L2) | Re-fetch before v1.5 starts. |
| R8 | CC OTel `tool_decision` fields [F†]; Harbor `-k` semantics [unverified] | open | v1.5 (`oac report --verify`, L3 runner) — not blocking | Optional cross-check only. Check `harbor run --help`. |
| R9 | Lockfiles. *Corrected by the main session 2026-10-18:* on `refactor/canonical`, `pnpm-lock.yaml` is the only lockfile, and `pnpm-workspace.yaml` already covers `packages/*` and `evals/framework`. The bun/npm split exists only on `main`. [F, verified on disk] | known | v1.2 week 1 | Add `evals/v2` to `pnpm-workspace.yaml` and commit the single `pnpm-lock.yaml`. Don't add a separate npm lockfile. Build v1.2 on the refactor branch (after #342), not on `main`. |
| R10 | Freshness false-positive rate is unknown, and labelling 100 PRs costs human time [F VR §9] | open | v1.4 (warn thresholds), v1.5 (block) | Start labelling in v1.2 at 20 diffs. Warn-first rollout. |
| R11 | Size-router thresholds are guesses [O] | open | v1.4 | Shadow-mode logging (`mode: shadow`, VR §8.1) on dogfood repos before enforcing L escalations. |
| R12 | CC plugin subagents ignore `hooks` and `permissionMode` [F LG §2.1] | known constraint | v1.4 design | Policy goes only in plugin-level `hooks.json`, keyed on tool and path. |
| R13 | Competitors: handrail, devleaps, ruflo-mods, ECC agentshield, Copilot `/sandbox`, and the apilot fork's v2 work [F LG §2.10, `00-findings-log.md`] | open | the v1.2 wedge timing | Ship v1.2 fast. Review apilot's v2 work as PP says. Differentiate on OC coverage + freshness + a published matrix. |
| R14 | OC v2 release and upgrade dates are disputed [F LG §3] | low | messaging only | Don't date-stamp the "first v2-native" claim. |
| R15 | Power: 30–50 tasks detect only large effects [O VR §4.3] | known | v1.5 claims | Claim only effects at least as large as the MDE. Publish error bars. |
| R16 | Scope creep in v1.3 (now 4–5 wk) | open | v1.3 date | If it slips, defer the monorepo flow's Nx/Turbo deferral detection to v1.4. Old and new flows stay. |


---

## 10. Amendments after the mission review (2026-10-18, approved by the maintainer)

Source: `review-mission-alignment.md`. The maintainer chose all four corrections, with **control** as the focus. These supersede the earlier sections where they conflict.

1. **One north star** (`NORTH_STAR.md`): "OAC keeps you in control of the coding agents on your real projects. You approve what an agent sets out to do, and the tool, not a prompt, enforces your rules on OpenCode, Claude Code and Codex alike…" §0 line 1, §1.1 and 01 "Direction" now defer to it. There are six promises, and promise 1 is "You approve the intent".
2. **Intent approval is core** (§2.1, §2.4, §3): `gates.intent: off | nudge | block`, team `block` and solo `nudge`. It fires once per task, before the first source edit. Host plan-mode approval, an interop plan (§2.2) or `/oac approve` all count. The L-size `plan_gate` stays as the stricter add-on. Release v1.4. Scorecard row: "team: 0 source writes before approval". This also resolves the read-only contradiction: host plan mode is the entry point, and the intent gate is the enforced form of plan-first.
3. **Stop and report on failure** (§3.2): `verify.on_fail: report | fix`, team `report` and solo `fix`. With `report`, the block message says "Report, don't auto-fix", matching openagent's original `stop_on_failure` rule. Release v1.4.
4. **Pattern capture moves to v1.3** (§2.1, §6.3): `oac init` records lint, format, test layout and import conventions deterministically. The LLM-based `--discover` stays an opt-in add-on.
5. **Migration path in v1.1**: `MIGRATING.md`, a frozen `oac-classic` tag of today's agent catalog before cuts, and a Discussion post. OpenCode is named first in the north star and README hero.

**Not verified:** the Discussion #116 quote "approval gates… quality gate must-have" (the GitHub API failed during the check). Re-check it before quoting it publicly.

6. **Overlap is fine** (maintainer, 2026-10-18): drop "don't compete with other frameworks" as a rule. Overlap with Superpowers, spec-kit or BMAD is acceptable. Items cut earlier for overlap alone move to an optional extras pack rather than being dropped. The priority is staying structured and shipping steadily.
