# Mission-alignment review of the new OAC plan

Reviewer: independent, read-only. Written 2026-10-18.
Scope: `NORTH_STAR.md`, `01-strategy-synthesis.md`, `02-product-plan.md`, `03-consistency-and-value.md`, `04-user-journey.md`, `research-landscape-gaps.md` §1, `research_notes/OAC strategy review/2_approach_and_niche.md`. Judged against the project's own history.

Labels: **[F]** is a fact, with its source. **[O]** is my opinion.

---

## Verdict in one paragraph

[O] The plan keeps the project's **values**: control, teams, repeatability, token thrift, editable files, any language. It changes the **promise**. The old OAC promised that a human approves the plan before the agent acts and that the agent writes code in your patterns. The new OAC promises that the host blocks dangerous actions and that you can prove it. That is a real pivot, but a defensible one, and the maintainer's own statements foreshadowed most of it. Two parts go further than the evidence supports. The first is demoting human approval of intent, which the maintainer called "a quality gate must-have", to an off-by-default add-on. The second is pushing "learns YOUR patterns", the headline of today's README, out to v1.6+. Both can come back in a lighter, host-enforced form without breaking any of the five promises. Do that, and the plan reads as an evolution rather than an abandonment.

---

## Step 1. The original mission, from primary sources

### How the framing evolved

| Date | Framing | Source |
|---|---|---|
| 2025-08-14 | "A set of opencode configurations, prompts and agents" | [F] `git show 9b95828:README.md` |
| 2025-08-15 | "Task-focused agents for planning, implementation, review, and testing"; "Security-first approach with configurable permissions" | [F] `0119898:README.md` |
| 2025-11-16 | Tagline "AI agent framework for plan-first development workflows with approval-based execution" first appears | [F] `88b3445` (first README containing "plan-first") |
| 2025-11-18 | OpenAgent created: "Plan → **ALWAYS request approval** → Execute → Validate → Summary". The README adds: "Currently optimized for OpenCode CLI. Support for other AI coding tools (Cursor, Claude Code, etc.) will be added after stabilizing" | [F] `5f2cec1:.opencode/agent/openagent.md`; `ca32328:README.md` |
| 2026-01 | "Why I built this": agents write generic code that "doesn't follow your patterns". The pitch rests on two pillars: "**Your time** - Agents propose plans, you approve before execution" and "**Your patterns** - Agents follow your standards automatically". The context system is called "the secret weapon" | [F] `1932710:README.md` |
| 2026-01-23 | Maintainer's six principles: repeatable behaviour is paramount; made for teams; "we care about context very much"; complex workspaces; token efficiency; "**Have approval gates before iteration** - results should be human guided. AI messes up intention, this is a quality gate must-have". Also: "having access to the prompts is important", and "you have control on what you do… you can choose which files to update" | [F] Discussion #116, maintainer comment |
| 2026-01-29/30 | "the full system is exposed than hiding behind a plugin setup"; "I do think will be moving towards the plugin architecture for future versions to enable certain behaviours with more accuracy" | [F] #135, maintainer comments |
| 2026-01-30 | Tagline becomes "**Control your AI patterns. Get repeatable results.**" Pillars: Pattern Control, Approval Gates, Repeatable Results, Editable Agents, Team-Ready. "Agents ALWAYS request approval before execution" | [F] `d7a4cb8` (#143); still the README on `main` and on the branch |
| Roadmap | "Next: Support for additional AI coding tools (Claude Code)" | [F] `ROADMAP.md` |

### The core promises, as the maintainer framed them

1. **Plan-first.** The agent proposes a plan before it implements anything. [F] README since `88b3445`; openagent stage 2 "Approve… required=true".
2. **Approval-based execution.** A human approves before any write, edit or bash. On failure the agent stops, reports and asks; it never auto-fixes. [F] `content/agents/core/openagent.md` L84-92; opencoder L80-90; #116.
3. **Context-aware: your patterns.** Agents load your standards before writing code. [F] README "secret weapon"; #116 "we care about context very much".
4. **Control and editability.** Plain markdown agents, no baked-in plugin, choose what to update. [F] #116, #135.
5. **Repeatable behaviour.** [F] #116, principle 1; README tagline.
6. **Teams.** Shared, committed standards. [F] #116; README.
7. **Token efficiency.** [F] #116; README "MVI".
8. **Multi-language.** [F] GitHub description; README.
9. **Built for OpenCode.** Always framed as "currently optimized for" with other hosts planned. [F] `ca32328:README.md`; `ROADMAP.md`.
10. **Quality built in.** Testing, code review, validation. [F] GitHub description.

[O] The deepest of these is #2. The maintainer's own words give the reason: "AI messes up **intention**." In the original design, the approval gate exists to catch misunderstood intent before code is written, not to stop `rm -rf`.

---

## Step 3.1 Alignment table

| Original promise | New plan | Status | Evidence |
|---|---|---|---|
| Plan-first | "Not a workflow method" (NORTH_STAR). The plan gate is an add-on, `off` in both profiles and L-size only (02 §2.1). Plan mode is left to the host (03 benefit table). | **Dropped as a default; kept as an option** | [F] NORTH_STAR "What OAC is not"; 02 §2.1 "Plan gate… Add-on… off/off" |
| Approval-based execution | Approval becomes risk-based: `gates.destructive: ask` (solo) and `scope: ask` (team). Promise 4 is "Quiet by default". The words "approval", "approve" and "plan-first" never appear in NORTH_STAR, 01, 03 or 04. | **Reinterpreted.** Human approval of intent becomes machine enforcement of risk. | [F] `grep -i approval` over those four files returns nothing; 02 §2.4 settings table |
| Stop on failure, never auto-fix | The verifier's block message says "Fix the tests; no 'done' yet" (02 §3.2), so the agent is pushed to keep fixing on its own. | **Inverted** | [F] 02 §3.2 row "Verify before done"; openagent L92 "never auto-fix" |
| Context-aware, your patterns | Lean, project-specific context plus freshness checks. The scout is `off`. Convention discovery is an add-on at v1.6+. The 297-file library is cut. | **Reinterpreted.** Freshness is strengthened; pattern capture is deferred. | [F] 02 §0 item 6, §2.1, §6.3 v1.6+ row; LG §1f |
| Control | Control by policy file and host enforcement | **Strengthened, but redefined** (human control becomes policy control) | [F] NORTH_STAR promise 1 |
| Editable, your files | "Your method, your files. Never overwrites your text." The policy is editable, but the agents are no longer the product. | **Kept** for files, **reduced** for agent prompts | [F] NORTH_STAR promise 5; "Not an agent catalog" |
| Repeatable behaviour | "Provable": a test for every gate, scenario tests on every host, a capability matrix | **Strengthened** for guardrails; not addressed for output quality | [F] 03 "How OAC stays consistent" |
| Teams | A team profile, CI checks, team lock, local overrides that can only tighten | **Strengthened** | [F] 02 §2.4; 04 "Teammate joins" |
| Token efficiency | "Almost no extra tokens"; SessionStart limited to 3 lines or fewer; no claims until measured | **Strengthened, and made honest** | [F] NORTH_STAR promise 4; 02 §7 "SessionStart payload" |
| Multi-language | The `oac init` scan covers old, new and multi-language repos, with per-language verifiers; "any language" is withheld until proven | **Strengthened** | [F] 02 §5.3; §1.4 copy rules |
| Built for OpenCode | Three hosts. NORTH_STAR lists Claude Code first. The OpenCode v2-native release is the v1.2 wedge. | **Reinterpreted**, as pre-announced | [F] NORTH_STAR §3; 01 "Wedge"; ROADMAP "Next" |
| Quality built in (testing, review) | Verifier before "done" is core. Reviewers are opt-in add-ons. | **Testing strengthened; review demoted** | [F] 02 §2.1 |
| Complex workspaces | Monorepo onboarding, areas, impact, size router | **Strengthened** | [F] 02 §2.3, §3.5, §5.3 |

---

## Step 3.2 What's genuinely preserved

- **Approval survives, narrowed to risk.** [F] `ask` is a real host-enforced approval prompt on OpenCode (`bash "*": ask` in `content/agents/core/openagent.md` L8-9) and on Claude Code (PreToolUse `ask`). [O] This is approval that the model cannot skip. That answers a real complaint: #236 reports models skipping prompt-based gates. [F] #236 "Gate-skipping behaviour with certain models like Kimi K2.5". So for safety, the new plan delivers the old promise better than the old prompts did.
- **Plan-first survives only in fragments.** There is a host-enforced read-only mode (02 §3.1, §3.4), artifact recognition across spec-kit, OpenSpec and Superpowers, and an L-only plan gate that is off by default. [O] Nothing in the default experience asks the user "is this what you meant?" before code is written. In practice the plan-first promise is gone from the default; what remains is "if you plan, OAC will respect your plan".
- **Context-aware survives as "context that stays true",** not as "context that is loaded". [F] Freshness is a core feature for teams (02 §4). [O] That is a good evolution of "we care about context very much": it keeps context correct, which the old system never did. But with the scout off and discovery deferred, the agent's knowledge of your patterns now depends on whatever the user has already written in AGENTS.md.
- **Repeatability and teams are better served.** [O] A committed `oac.policy`, the same rules on every tool, and tests you can rerun make this the most repeatable OAC has ever been.

### Internal inconsistency to fix

[F] 03 says of read-only mode: "Duplicates host plan mode… **Use the host's plan mode.** Test it with a scenario instead of rebuilding it." 02 §2.1 lists read-only mode as **Core**, and §3.1 builds `.oac/state/mode=research`, an `oac-research` agent and PreToolUse denies. LG §1c argues for one mechanical "no writes in plan state" gate. [O] Pick one. I'd keep the 02 version: plan mode is reported to edit files (LG §1c, paddo.dev), and a mechanical read-only gate is the plan-first promise in its new, enforced form.

[F] Two north stars also disagree. 01 says "OAC compiles one set of agents, skills and guardrails… The build is the product". NORTH_STAR says "makes AI coding agents safe… Not an agent catalog". 02 §0 says "the easy way to set a repo up". [O] Three framings across three files need to become one.

---

## Step 3.3 What's lost, and whether that's justified

| Loss | Evidence the plan uses | Is it justified? |
|---|---|---|
| **Plan-first + approval as the default** | One promotional blog post that "frames [approval] as added latency" (CS §1, Bright Coding); CS also says gates "appeal to teams but read as latency to individuals"; plan mode is native everywhere (NF Q1) | **Over-corrected.** [F] The latency evidence is one secondary source; no issue in the tracker complains about approvals. [F] The same note says approval gates are why users chose OAC ("controlled and token-efficient") and that they appeal to teams, the plan's own primary persona. [O] The evidence supports *fewer* approvals (one per task, not one per step) and *enforced* approvals. It does not support removing the intent check from the default. |
| **Approval at every step** | Same as above | **Justified.** [O] Per-step approval is the friction; host-enforced `ask` on risk plus one approval per task keeps the value at a fraction of the cost. |
| **Stop on failure, never auto-fix** | Not discussed | **Lost by accident.** [O] The verifier text tells the agent to go and fix the tests, which is the "auto-fix loop" #116 contrasted OAC against. Make the post-failure behaviour a setting, and keep "stop and report" as the default in team. |
| **Specialist agent catalog** | Hosts ship scouts, planners and parallel agents (NF Q1/Q3); many cut verdicts are "[no evidence, opinion] Off-mission" (LG §1a/§1b) | **Mostly justified for orchestration** (task-manager, batch-executor, stage-orchestrator, worktrees, externalscout). **Weakly justified for the business agents** (copywriter, data-analyst, technical-writer), which are shipped profiles (`business` in the README tier table) and are cut on opinion alone. [O] Archive them as an unsupported community pack with a pinned last version, rather than deleting them. Keep openagent and opencoder as the reference primary agents that ship the new policy. |
| **Context library (297 files)** | [F] 61,241 lines, 108 internal files (verified on branch: 297 `.md`, 61,241 lines, 108 `openagents-repo`); arXiv 2602.11988; #258 (10-minute discovery) | **Justified as a default.** [O] But the paper concerns generic or LLM-written context, while OAC's promise was *your* patterns. Pattern capture should be cheap and early, not v1.6+. |
| **"Built for OpenCode"** | Multi-host demand (#361, #346, #36); OpenCode v2 broke v1 plugins | **Justified, and pre-announced** (`ca32328` README; ROADMAP). [O] The messaging risk is the ordering: NORTH_STAR lists Claude Code first, and 01 drops Claude prompt generation, so OpenCode users may read that as "they moved on". Keep OpenCode first in every list, and treat v1.2 OpenCode v2-native as the headline release it is. |

### What to restore, in a lighter form

1. **A one-approval-per-task "intent gate" as the default for primary agents.** Before the first source write in change mode, the agent shows a short plan (5 lines or fewer). A PreToolUse / `execute.before` check denies writes until the user approves; on OpenCode the approval can be the native `ask`. Approval covers the whole task; low-risk edits after that are silent. Default: `on` for team, `nudge` for solo, `off` available. [O] This passes all five promises: it is enforced, the same on every tool, testable with an L2 scenario, quiet after one prompt, and works with any method (a Superpowers or spec-kit plan counts as the plan).
2. **Stop-and-report on a failed verifier as the team default.** A `verify.on_fail: report | fix` key, set to `report` for team.
3. **Pattern capture in v1.3, not v1.6.** `oac init` offers "capture 5–10 conventions from this repo" (deterministic where possible: lint config, formatter, test layout, import style), opt-in and shown first. This keeps "Control your AI patterns" true.
4. **openagent and opencoder stay as the shipped reference agents.** The policy compiler is the product, but the "editable agents" promise needs at least one agent that demonstrates it.

---

## Step 3.4 Evolution or pivot?

[O] **A pivot in what is promised, an evolution in what is valued.** The through-line is real:
- "Control" was always the brand.
- [F] The maintainer said in #135 he would move "towards the plugin architecture… to enable certain behaviours with more accuracy", which is exactly what hooks are.
- Repeatability, teams and token thrift all get stronger.

But the headline has moved three times: "plan-first with approval" (Nov 2025), then "Control your AI patterns" (Jan 2026), and now "safe to use on real projects" (this plan). The plan's §1.4 README hero contains neither "approval" nor "patterns". [F] 02 §1.4. Existing users came for those two words.

### How to communicate it

- **Naming.** Keep "OpenAgentsControl". "Control" carries the bridge: control of your patterns, then control of what agents may do.
- **README framing.** Open with continuity: "Same idea since 2025: agents act only with your approval and inside your rules. What changed: those rules are now enforced by the tool, not requested in a prompt." Keep "Approval gates" as a named pillar, redefined as host-enforced.
- **Migration path.**
  - A `MIGRATING.md` for v1.x users, with a table: old component → new home (kept / became a gate / moved to an archive pack / replaced by host feature X).
  - `oac update` detects old installs and offers `oac migrate`, which preserves edited agents and context files and writes an `oac.policy` derived from openagent's permissions.
  - An "OAC classic" tag or branch that keeps the v1 agent catalog installable, frozen.
- **Announcement.** A Discussion post, linked from #116, that answers "is OAC still plan-first and approval-based?" directly: "yes for risky actions and for each task's intent, enforced; no longer for every step."

---

## Step 3.5 The branch basis

[F] `refactor/canonical` at `d7924e4` is 48 commits ahead of `main` and 0 behind (`git rev-list --count`), so everything on `main` is also on the branch. 02's header states that repo facts were checked on `refactor/canonical` at `d7924e4`.

| Claim | Check on branch | Branch-only? |
|---|---|---|
| `content/agents/core/openagent.md` L6-19: `bash "*": ask`, deny `sudo`, `rm -rf /*`, `> /dev/*`, edit-deny `.env*`, `.key`, `.secret`, `.git/**` (02 §1.2) | **True** (L6-19 exactly) | Yes: `content/` does not exist on `main` |
| `Makefile:172` `check-canonical-drift` is the CI gate (02 §1.2) | **True** (L172) | Yes |
| `plugins/claude-code/hooks/hooks.json` has one SessionStart hook, no matcher, no PreToolUse or Stop (02 §1.2; 01) | **True** | — |
| `README.md:125` advertises `@controlstack/oac` (02 §1.2) | **True** (L125, `npm i -g @controlstack/oac`) | Yes: `main`'s README has no `controlstack` |
| R9: `pnpm-lock.yaml` is the only lockfile; the bun/npm split is only on `main` | **True.** Branch: `pnpm-lock.yaml` only. `main`: `bun.lock`, `package-lock.json`, `evals/framework/package-lock.json` and others | Yes, correctly flagged |
| Context library is 297 files / 61,241 lines / 108 internal (LG §1f) | **True** on branch (`main` has 296) | Branch figure |
| Claude plugin agents have 43 `.opencode/` references; `main`'s code-reviewer had 0 (01) | **True** (43; `main` 0). code-reviewer has `disallowedTools: …, Task` and "ALWAYS call ContextScout" (L5, L14) | Explicitly labelled as a `main` comparison |
| opencoder has no `"*"` bash rule (02 §1.2) | **True** (`content/agents/core/opencoder.md` L8-15) | — |
| `doctor --json` (02 §1.2, `doctor.ts:352`) | **True** (L352) | `doctor.ts` also exists on `main` |
| Eval workflow sits in a directory Actions doesn't load | **True**: `.github/workflows/evals/` is a subdirectory | — |

[F] I found no claim that is really about `main` but presented as the branch. The one area where this happened before (lockfiles) was already corrected in R9. One caution: my own memory note "lockfiles-bun-npm-split" describes `main`, and per R9 it doesn't apply to v1.2 work on the branch. [O] The "12 agents hide tools behind a trailing `"*": deny`" count (#349) was not re-derived here; treat it as unverified.

---

## Step 3.6 Recommendations (7)

1. **Rewrite the north-star sentence** (NORTH_STAR line 3; also align 01 "Direction" and 02 §0 item 1 to it). Suggested wording:
   > **OpenAgentsControl keeps you in control of the coding agents on your real projects. You approve what they set out to do, and the tool, not a prompt, enforces your rules on every agent you use: your secrets, your boundaries, your tests, your patterns. OAC sets your repo up with lean context that stays current, applies the same policy on OpenCode, Claude Code and Codex, and proves with tests you can run that those rules hold.**
2. **Add a sixth promise, or amend promise 4:** "You approve the intent, once per task. The tool enforces the rest." (NORTH_STAR "The five promises"). Without it, "Quiet by default" silently contradicts the README's "Agents ALWAYS request approval".
3. **Make the intent gate core** (02 §2.1 and §2.4): add `gates.intent: off | nudge | block`, team `block` and solo `nudge`, firing once per task before the first source write, and accepting any interop plan from §2.2. Keep the L-size `plan_gate` as the stricter add-on. Add an L2 scenario and a §7 row.
4. **Restore stop-on-failure** (02 §3.2 verifier row and §2.4): `verify.on_fail: report | fix`, team default `report`. Change the block message so it does not tell the agent to auto-fix when `report` is set.
5. **Move pattern capture to v1.3** (02 §2.1 "Convention discovery", §6.3 v1.6+ row): a deterministic `oac init` step that captures lint, format, test-layout and import conventions, with the LLM version still opt-in. This keeps today's headline promise.
6. **Resolve the read-only contradiction and keep it core** (03 benefit table "Read-only mode" vs 02 §2.1/§3.1). State that OAC's read-only mode is the enforced form of plan-first, and that host plan mode is accepted as an entry point.
7. **Add a migration section** (new 02 §10, and the 01 "Do not" list): `MIGRATING.md`, `oac migrate`, an "OAC classic" frozen tag for the agent catalog and business profile, a Discussion post answering #116's framing, and OpenCode listed first in NORTH_STAR and the README hero (02 §1.4) to keep "built for OpenCode" visibly true.
