# Research-landscape gaps: what the summaries left out

Date: 2026-10-16. Read-only review.

**Notes read in full** (in `research_notes/Coding agent harness landscape/`):
- `community_sentiment.md` (abbreviated **CS** below)
- `context_and_evals.md` (**CE**)
- `native_cli_features.md` (**NF**)
- `oac_internal_audit.md` (**IA**)
- `workflow_frameworks.md` (**WF**)

**Summaries checked against them:**
- `reports/Coding agent harness landscape.md` (**R**)
- `research_notes/OAC strategy review/1_direction_and_refactor.md` (**S1**)
- `research_notes/OAC strategy review/2_approach_and_niche.md` (**S2**)
- `research_notes/OAC strategy review/3_peer_lessons.md` (**S3**)

The verdicts below are judged against the new position: the enforced-guardrails layer, one `oac.policy`, three hosts (Claude Code, OpenCode v2, Codex), a capability matrix, and evals. OAC stops competing on workflow methodology and stops maintaining features hosts now ship.

**Labels used in this report:**
- **[evidence]**: the verdict rests on something a note says.
- **[no evidence, opinion]**: the notes say nothing specific about the component. The lean is my judgement.

---

## 1. Keep / Change / Cut per component

### 1a. Primary agents

| Component | Verdict | Strongest evidence |
|---|---|---|
| **openagent** | **Keep, and Change** | [evidence] This is the only agent with real host enforcement: `bash: "*": "ask"`, deny rules for `sudo *` and `rm -rf /*`, and edit-deny for `**/*.env*`, `**/*.key` and `.git/**` (IA §3). That makes it the natural reference policy to lift into `oac.policy`. **Change:** the body rule "Request approval before ANY execution (bash, write, edit, task)" (IA §3) is the latency the community objects to: "requires explicit approval at every execution step… framed as added latency" (CS §1, Bright Coding). Make gates risk-based. Its evals exist (approval-gate, context-loading, stop-on-failure; IA §4), so keep them as the regression suite. |
| **opencoder** | **Change** | [evidence] It has "no `"*"` bash rule. Only specific commands are set to `ask`… `sudo` is denied" (IA §3). The README's "ALWAYS request approval" is false for it (IA §3 inference). The only stored eval result is opencoder failing 0/1 with "missing-approval" and "execution-before-read" (IA §4). It should get its permissions from the compiled policy and stop carrying its own. |
| **copywriter** | **Cut from core** (archive, or a separate optional pack) | [evidence, weak] It has live eval tests (IA §4). Nothing links it to guardrails, and #283 shows users already find the scope confusing (CS §1). [opinion] It is off-mission for a guardrails product. |
| **technical-writer** | **Cut from core** | [no evidence, opinion] Not mentioned beyond the registry. Off-mission. |
| **data-analyst** | **Cut from core** | [no evidence, opinion] Not mentioned beyond the registry. Off-mission. |
| **repo-manager** | **Change: internal-only** (do not ship) | [evidence] It manages this repo and pairs with the 108 `openagents-repo` context files, which are "internal docs about this repo" (IA §2). R/S already say to stop shipping those files. It has evals (IA §4), so keep it for maintainers. |
| **system-builder** | **Cut** (archive) | [evidence] It has evals (IA §4), but generating agents and commands is the methodology/catalog business that S2 says not to compete in. Hosts ship agent creation, and "Custom Prompts" and commands are being folded into skills (NF Q2). [opinion] If anything survives, it could become a narrow "author an `oac.policy`" skill. |

### 1b. Subagents

| Component | Verdict | Strongest evidence |
|---|---|---|
| **build-agent** | **Change: becomes the verifier gate** | [no evidence on the agent itself] The notes support the role, not the agent. Claude Code has an `agent` hook handler ("a tool-using verifier subagent, experimental") and a `Stop` event (NF Q1). S2 flagship #2: "done" without a passing verifier. [opinion] Turn build-agent (typecheck/build/test) into the generated Stop/verifier hook body. Do not keep it as a delegated prompt agent. |
| **coder-agent** | **Keep (Claude form), Change (enforcement)** | [evidence] On Claude Code its edit scope is widened by design, and the deny globs are "only advisory unless the user copies the settings by hand" (IA §6). The branch removed its `<example>` dispatch blocks (S1). Keep it as the default writer. Move the protection into generated PreToolUse hooks. |
| **reviewer** (Claude: code-reviewer) | **Change: narrow to a policy/security verifier** | [evidence] Generic review is native in Copilot ("Code review" agent) and Codex ("Code review… Security Review") (NF Q3). The NF gap says "Whether Claude Code ships a built-in code-review agent… Not verified". The branch version says "ALWAYS call ContextScout" while `disallowedTools` includes Task (S1). |
| **test-engineer** | **Change: optional, not core** | [evidence] TDD discipline is owned by Superpowers ("Deletes code written before tests") and cc-sdd (WF). S2 says do not compete on TDD. [opinion] Keep it only as the thing a "tests must pass before done" gate can call. |
| **batch-executor** | **Cut** | [evidence] Parallel and background execution is native: CC `background: true`, Codex `max_concurrent_threads_per_session`, Cursor parallel subagents (NF Q3). One critique: "if a feature doesn't actually need parallel coordination, an agent team is just a more expensive way…" (WF, Towards AI). |
| **context-manager** | **Change: fold into one context skill, off the default path** | [evidence] Users report path confusion: #321 (`/add-context` writes to the global path by default) and #310 (ContextScout finds no `.opencode/context/`) (CS §1). |
| **context-retriever** | **Cut** (it overlaps contextscout) | [evidence, weak] It has evals (IA §4). [opinion] Two retrieval agents add to the "repeatedly searched" complaint in #258 (CS §1). |
| **contextscout** | **Change: standards-only scout, optional** | [evidence] #258 reports "upwards of 10 minutes to find OpenAgentsControl context". The studies say generic context "do[es] not generally improve task success" (CE Q1, arXiv 2602.11988). CE inference: "ablate context-discovery on vs off vs single always-on file". It has the most evals (17; IA §4), which makes it good ablation material. |
| **documentation** | **Cut** | [evidence, weak] It has evals (IA §4). [opinion] Off-mission. |
| **externalscout** | **Cut** (keep the context7 skill as optional) | [evidence] OpenCode ships "Scout (read-only external docs/dependency research)" (NF Q1). R already notes it "is close to OAC's `externalscout`". |
| **stage-orchestrator** | **Cut** | [evidence] Claude Code natively provides "agent teams, `TaskCreated/TaskCompleted` hooks, and plugin `workflows/` (.js)", and Kilo has Orchestrator mode (NF Q3). |
| **task-manager** | **Cut** (archive) | [evidence] It has evals (IA §4). Task breakdown is native (NF Q3), and the dedicated task-manager peer stalled: Task Master's last release was 2026-03-31, its last push 2026-04-28, and attention shifted to its commercial product (WF). WF inference names "generic task-breakdown subagents" as the most redundant part. |
| **devops-specialist** | **Cut from core** | [no evidence, opinion] Off-mission. |
| **frontend-specialist** | **Cut from core** | [evidence] #283: "it's not disclosed that this framework is tied to JS frontend development… UI workflows don't apply to native or mobile apps" (CS §1). It has evals (IA §4). |
| **5 planning agents** (adr-manager, architecture-analyzer, contract-manager, prioritization-engine, story-mapper) | **Cut** (archive) | [evidence] They "are not part of the Claude Code plugin and have no evals" (IA §2). The only demand signal is #165 "ADR-style decisions" (CS §1), and that is methodology. |
| **5 system-builder subagents** (agent-generator, command-creator, context-organizer, domain-analyzer, workflow-designer) | **Cut** (archive) | [evidence] Same IA §2 finding: no evals, not in the Claude plugin. command-creator is doubly dead because commands are being folded into skills (NF Q2). |
| **simple-responder** | **Cut from the registry; move it to eval fixtures** | [evidence] IA §2 describes it as "a test fixture", yet it sits in the shipped registry. |
| **image-specialist** | **Cut** | [no evidence, opinion] Off-mission. It depends on the gemini tool, which has an untracked `.opencode/tool/.env` (IA §6). |

### 1c. Claude plugin skills (12)

**Cross-cutting finding the summaries missed:** several OAC skills have the same name as a Superpowers skill or overlap with one. `verification-before-completion` is an identical name. `debugger` overlaps `systematic-debugging`, `parallel-execution` overlaps `dispatching-parallel-agents`, and `/brainstorm` overlaps `brainstorming` (WF, the Superpowers profile). S2 wants "Use Superpowers *with* OAC guardrails" as a feature. If both plugins are installed, duplicate triggering and name collisions follow. OAC should own none of these method skills.

| Skill | Verdict | Evidence |
|---|---|---|
| code-execution | **Cut** (fold into coder-agent dispatch) | [no evidence, opinion] It only makes sense with the subtask-JSON methodology, which is being dropped. |
| code-review | **Change:** a "policy/security review before done" trigger for the verifier | [evidence] See reviewer above (NF Q3). |
| context-discovery | **Change: optional, measured** | [evidence] It uses the Claude-only `context: fork` and `agent:` keys, which are not spec-compliant (IA §6). #258 is the slowness report (CS §1). |
| context-setup | **Change: merge into the one CLI** | [evidence] #281: after install it is an "unknown skill", with no replies (CS §1). It uses a third profile vocabulary (IA §3). |
| debugger | **Cut** | [evidence] Superpowers ships systematic-debugging (WF). This is methodology. |
| external-research | **Cut / optional** | [evidence] OpenCode Scout is native (NF Q1). |
| oac-approach | **Change: becomes a guardrail, not a ceremony** | [evidence] Plan mode is native everywhere (NF Q1 inference). **Not carried forward:** paddo.dev "notes reports of Plan Mode editing files while active" (WF, stalled section). That justifies one *mechanical* gate, "no writes while in plan state", in place of a prompt flow. |
| parallel-execution | **Cut** | [evidence] Native (NF Q3). |
| task-breakdown | **Cut** | [evidence] Native, and methodology (NF Q3; WF). |
| test-generation | **Cut** (or optional) | [evidence] Methodology owned by Superpowers and cc-sdd (WF). |
| using-oac | **Change: rewrite** | [evidence] It is the "shouting, coercive pattern that Anthropic says over-triggers" (CE Q3). The injected payload should shrink to descriptions only. S3 adds the matcher and the subagent carve-out. |
| verification-before-completion | **Keep the intent; Change the mechanism** to a Stop/`agent` hook | [evidence] "Without hooks, linters or CI, missed instructions go unnoticed" (CE Q1, arXiv 2605.10039). Note the name collision with Superpowers above. |

### 1d. OpenCode skills (5)

| Skill | Verdict | Evidence |
|---|---|---|
| context-manager | **Change:** merge with the Claude context skill into one canonical skill | [evidence] It carries non-standard `version`, `author` and `type` keys (IA §6). |
| context7 | **Keep as optional** | [evidence] It is the external-docs path (IA §3). It is not core to guardrails, and its frontmatter needs spec cleanup. |
| smart-router-skill | **Cut** | [evidence] It is a "movie character personality" demo (IA §2). S3 #12 says the same. |
| task-management | **Cut** (archive along with the task CLI) | [evidence] Task Master stalled, and task lists are native (WF; NF Q3). |
| project-orchestration | **Cut** | [evidence] It sits in a singular `.opencode/skill/` directory "neither in `registry.json` nor in the npm `files` list" (IA §2), so it already ships to nobody. |

### 1e. Commands

**General [evidence]:** "Prefer `skills/` for new plugins", and Codex "Custom Prompts" are deprecated (NF Q2). Every survivor below becomes a skill.

| Command | Verdict | Evidence |
|---|---|---|
| add-context | **Change**, or merge into the CLI | [evidence] #321: it writes to the global path by default (CS §1). |
| analyze-patterns | **Change: seed of "discover project conventions"** (later, not core) | [no direct evidence] Agent OS's "Discover Standards" is the analogue (WF). [opinion] This is the only context command that fits the research ("non-standard, non-inferable conventions", CE Q1). |
| build-context-system | **Cut** | [no evidence, opinion] It belongs to the generic-library business. |
| clean | **Cut** (fold into `oac doctor`) | [no evidence, opinion] |
| commit | **Cut**, or later reframe as a pre-commit policy check | [no evidence, opinion] |
| commit-openagents | **Cut from shipped** (internal) | [no evidence, opinion] |
| context | **Change: fold into the one context skill** | [no evidence beyond the context complaints in CS §1] |
| optimize | **Cut** | [no evidence, opinion] |
| prompt-engineering (prompt-enhancer, prompt-optimizer) | **Cut** | [no evidence, opinion] OAC's own prompts break the Anthropic guidance CE Q3 cites, so prompt advice from OAC is not a credible product. |
| test | **Cut** | [no evidence, opinion] |
| validate-repo | **Cut from shipped** (internal) | [no evidence, opinion] |
| worktrees | **Cut** | [evidence] Native: CC `isolation: worktree` "auto-removed if unchanged", Codex Worktrees, Cursor per-subagent worktree (NF Q1/Q3). |
| test-new-command, openagents/check-context-deps, openagents/new-agents/* | **Cut from shipped** | [evidence, weak] These are in the registry (IA §2) but are maintainer tooling. |
| Claude `/brainstorm` | **Cut** | [evidence] Superpowers brainstorming, now rebuilt in v7 to "size the work" (WF). |
| Claude `/debug` | **Cut** | [evidence] Same as the debugger skill. |
| Claude `/install-context` | **Change: merge into the one CLI/profile set** | [evidence] Three installers with three vocabularies (IA §6). |
| Claude `/oac-cleanup` | **Cut** (fold into doctor) | [no evidence, opinion] |
| Claude `/oac-help` | **Keep, fix** | [evidence] The README advertises a dead `/oac:setup` and `/oac:plan` (IA §2), so help must match reality. |
| Claude `/oac-status` | **Keep → front-end for `oac doctor --policy`** | [no evidence on the command, opinion] It maps cleanly onto S2 flagship #3. |

### 1f. Platform pieces

| Component | Verdict | Evidence |
|---|---|---|
| **Context library (297 files)** | **Change: off by default, slimmed, treated as untrusted input** | [evidence] 61,241 lines. 108 files are internal. 82 exceed 200 lines, contradicting the README (IA §2/§3). The studies say generic standards do not help (CE Q1). **Not carried forward:** "context files installed from a registry are injected into the model's instructions, which makes them a prompt-injection channel just like skills" (CE Q4). Under a guardrails brand, shipping 61k lines of unsigned instruction text is a liability. Keep the security-pattern files only if they feed policy rules. |
| **task-management CLI** (`task-cli.ts`) | **Cut** (archive) | [no direct evidence] The notes do not discuss it. The peer analogue (Task Master) stalled (WF), and CC has native `TaskCreated/TaskCompleted` (NF Q1). [opinion] The recent fix commits (#305, #301) show it still costs maintenance. |
| **Eval framework** | **Change: rebuild as proof plus red-team; keep the deterministic parts** | [evidence] It is OpenCode-only and dormant. The workflow is in a subdirectory Actions never loads, and the last result is a January failure (IA §4). The SDK session-creation TODO blocks CI (IA §4). See section 2 for the red-team tooling the summaries skipped. |
| **gemini / image tools** (plus the notify Telegram plugin) | **Cut** | [no evidence, opinion] Off-mission. They hold untracked `.env` files on disk (IA §6), which is bad optics for a security product. |
| **install.sh** (1,510 lines) and update.sh | **Cut** (Stage 6) | [evidence] It is OpenCode-only and `jq`-driven (IA §1). Install failures #237 and #304 dominate issues (CS §1). **Qualifier:** installer-checks CI (ShellCheck, e2e on two OSes, five profile smokes) currently passes (IA §4). Port those smoke tests to the CLI before deleting it. |
| **oac CLI** | **Keep: it becomes the policy compiler, plus doctor and verify** | [evidence] 226 tests pass. It has sha256 tracking, `doctor`, and an `update` that preserves local edits (IA §4; S3). The blockers are `@controlstack/oac` returning npm 404 and apply targets being `claude` only (IA §1/§5). |
| *(not asked, but load-bearing)* **compatibility-layer `Capabilities.ts`** | **Keep** | [evidence] "ordered permission rules, last-match-wins, fail-closed degradation", 553 tests (IA §1/§4). |
| *(not asked)* **`.opencode/prompts/` model variants** (gemini/gpt/grok/llama/minimax/openrouter) | **Cut, or keep only if evals justify them** | [evidence] They exist (IA §2). Harness fit is model-specific (CE Q3), but there are no evals for these variants. |
| *(not asked)* **`coder-verification` and `agent-validator` OpenCode plugins** | **Change: these are the seed of OpenCode-side enforcement** | [evidence] They exist under `.opencode/plugins/` (one has a `.disabled` twin) (IA §2). They are v1 plugins, and "V1 plugins do not run in V2" (CS §2). **No summary mentions these as existing guardrail code.** |

---

## 2. Ideas and features the summaries did not carry forward

### Guardrails and policy (highest value)

1. **Claude Code plugin subagents ignore `hooks`, `mcpServers` and `permissionMode`.** The source is NF Q1: "Plugin subagents ignore `hooks`, `mcpServers`, and `permissionMode`." S1 says to "verify that hook input identifies the calling subagent, or use subagent-scoped hooks if the host supports them". The note already answers half of that: per-subagent hooks and permission modes **cannot** be shipped through the plugin.
   - Policy has to be plugin-level `hooks/hooks.json` keyed on tool and path.
   - Alternatively, it has to be emitted into project `.claude/agents/` or settings rather than the plugin.
   - This is a capability-matrix row and a design constraint for `oac.policy`.
2. **Codex cannot take per-agent policy.** The source is NF Q1: an agent file "cannot set `sandbox_mode, approval_policy, model_provider, mcp_servers`", and subagents "inherit the parent's sandbox and approval policy".
   - On Codex, `oac.policy` compiles to session-level config.toml, Rules, or Hooks only.
   - Per-agent scope degrades, and the matrix should say so. S2's "Codex rules/TOML" glosses over this.
3. **Codex has Hooks, Permissions/Sandbox/Rules, Auto-review, and enterprise Plugin management.** NF Q1 lists them all. Codex Hooks are the obvious enforcement emitter for the Codex target. No summary names them; R mentions only Auto-review.
4. **More Claude Code hook surface that maps to policy** (NF Q1):
   - `Stop` (the "done" gate)
   - `SubagentStart/Stop`
   - `InstructionsLoaded` (could audit what context got injected)
   - `PreCompact/PostCompact` (re-assert policy after compaction)
   - `WorktreeCreate`
   - `Pre/PostModelSwitch`
   - an **`http` handler type**, which lets a team point hooks at a central policy endpoint
   - an `mcp_tool` handler type

   The summaries mention only PreToolUse, PermissionRequest, `prompt` and `agent`.
5. **Plugin components the summaries skipped** (NF Q1):
   - **`bin/` (on PATH)**: the plugin could ship the `oac` CLI itself, which sidesteps the npm 404 for Claude users.
   - **`monitors/`**
   - **`userConfig` with sensitive values in the keychain**
   - **`dependencies`**: an OAC guardrails plugin could depend on, or interop with, Superpowers.
   - **`experimental.evals`**
   - **marketplace `strict` mode**
   - **managed settings as a subagent source**: the enterprise/team channel.
   - "A CLAUDE.md at the plugin root is NOT loaded as context; put them in a skill."
6. **OpenCode permission keys beyond tools** (NF Q1):
   - `permission.task` globs control which subagents an agent may invoke. That is a policy primitive: delegation allowlists.
   - `permission.skill` allow/deny/ask gates skills.
   - `tools` is deprecated in favour of `permission`, and `maxSteps` is replaced by `steps`.

   None of this is in the summaries, and all of it belongs in `oac.policy`.
7. **OpenCode passes unknown frontmatter keys to the provider as model options.** NF Q1/Q2 flags it as a "hazard for cross-tool files carrying stray keys". The memory note says OpenCode tolerates unknown frontmatter; this qualifies that. Tolerated is not the same as inert. Verify that the build strips the `oac:` block from emitted OpenCode agents. The audit says canonical files carry `oac:` (IA §1).
8. **#349's lesson for the compiler: `"*": "deny"` hides the tool entirely** (CS §1). wshobson hit the same class of bug: "OpenCode permission blocks denied everything when tools were MCP-only or empty" (S3 §D). The summaries list #349 as a v2 bug. They do not frame it as a rule for the policy compiler: never emit a naive catch-all deny, and test the visible tool set.
9. **Agent Skills `allowed-tools` (experimental) is a spec-level carrier for per-skill tool policy** (S3 §A, from the spec). S3 mentions it only in passing, not as a guardrail emission target.
10. **Competing guardrail and policy products the summaries missed.** S2's risk list names handrail, devleaps, Endor Labs and Rulebricks. The notes add three more:
    - **ruflo-mods**: "in-process prompt routing and **policy enforcement**" as a Claude Code plugin (WF, ruflo). Ruflo has 75k stars.
    - **ECC's `ecc-agentshield` security package** (WF). ECC has 281k stars and paid seats.
    - **Copilot `/sandbox enable`** and **Amp's enterprise MCP Registry Allowlist** (NF Q1). These are native host guardrails that shrink the gap.

    This raises the risk to S2's position A. The "nobody does this" framing is weaker than S2 says.
11. **OmO "Kibitzer"**: "a small cheap model watches the main agent and nudges it before it repeats a mistake" (WF). This is a monitor-style guardrail pattern. CC `monitors/` and `prompt` hooks could host it, and it is softer than deny.
12. **Superpowers `diagnosing-superpowers`**: it reads the session transcript and packages a scrubbed bug-report bundle (WF). The guardrail analogue is "why was I blocked?" plus an `oac explain` transcript report. That would cut the support load from false positives.
13. **Plan-mode leakage** ("reports of Plan Mode editing files while active", WF via paddo.dev). Native plan gates are not airtight, which justifies a mechanical write-block. It was not carried forward.

### OpenCode v2

14. **v2 renames config keys: `task` → `subagent` and `agent` → `agents`** (CS §2, migration guide). The summaries say "key renames" without naming them, and `permission.task` (item 6) is affected.
15. **The v2 release date is disputed** (09-11 vs 09-24), and the upgrade-path date comes from a secondary source, AICoder (CS §2).
16. **The apilot fork already claims the v2 wedge.** It "advertises OpenCode v2 plugin support, an `oac` CLI, machine-verified task completion and 345 tests" (CS §1). The summaries treat the fork only as a reputational risk. It is also a direct competitor for the v2-native position, using OAC's own name.
17. **#353 "opencode 2.0 codemode"** (CS §1), with OmO's "CodeMode" batched tool calls (WF). That is a v2 feature request the port plan does not mention.
18. **#367 asks to port the *AbilitiesPlugin* to v2** (CS §1), and #33 Skills/Abilities is "the most-discussed issue" (20 comments). The branch **deleted `packages/plugin-abilities`** (IA §1), and S1 calls the deletions correct. The most-requested feature and the deletion need reconciling.
19. **Kilo Code is rebuilt on the OpenCode server** (NF Q1). That makes Kilo's community a distribution channel for an OpenCode v2 policy. S2 mentions Kilo once.

### Evals

20. **Red-team tooling.** promptfoo is "config-driven and CI-first, and includes red-teaming", and Inspect AI "suits agentic and safety evals" (CE Q2). S2 wants a red-team suite but names only Harbor, which is a capability benchmark runner.
21. **Host-native skill evals:** `claude plugin eval` / `/skill-doctor`, plus plugin `experimental.evals` (CE Q2; NF Q1). This is a cheap first eval channel for the Claude target, and the summaries never mention it.
22. **Trial isolation pitfall:** "in one case Claude read git history from earlier trials" (CE Q2). Guardrail evals that test "blocked .env read" must reset the repo and its history every trial.
23. **Harness failure handling decides outcomes** ("timeouts on hung commands, early stops, resuming cut-off turns", CE Q2). A guardrail that blocks can *cause* failures. Evals must also measure **false-positive blocks and task-success cost**, not only the block rate. S2's metrics include latency but not success-rate cost.
24. **Context can hurt.** "On borderline Codex tasks, *no context* scored 58% vs 42%" (CE Q1, Khatri). A search summary also says "LLM-generated files *reduced* resolve rates" (CE Q1, snippet). The summaries say context does not help; the notes say it can make results worse.
25. **Model-version drift:** "The eval suite should rerun on every model release" (CE Q3). Also: Kimi "needed a harness that catches malformed tool calls" (CE Q3), and OAC's #236 reports gate-skipping with Kimi K2.5 (CS §1). Policy enforcement has to be model-independent, which is an argument for hooks.
26. **Task identity matters more than file structure** (a 26.2pp gap between two tasks; CE Q1). Eval task selection dominates results, so 20–50 tasks should be stratified.

### Distribution and team use

27. **Hooks adoption is low.** One repo-mining study finds 13.3% of repos use hooks (CS §4). The guardrails product brings hooks to the roughly 87% who don't write them. That is a market-size argument the summaries missed. They quoted only the 5.5% skills figure.
28. **Team distribution channels native to hosts** (NF Q1):
    - Copilot org/enterprise `.github-private/agents`
    - Codex enterprise "Plugin management (GitHub import/sync)"
    - Claude Code managed settings

    These deliver "team lock" without a SaaS.
29. **spec-kit governance features beyond presets** (WF):
    - "air-gapped installs"
    - "community and private catalogs with auth"
    - an **"artifact inventory" showing which layer supplies each file**

    The inventory is directly reusable as `oac explain`/provenance output.
30. **Goose recipes run in CI, and Cline ships a headless CLI for CI** (NF Q1). These are runtime targets for an `oac verify` that exercises the policy, not just lints it.
31. **Skill supply-chain defensive scanners**: SkillSieve, MalSkills, SkillSecurer and Cisco's open-source skill scanner (CE Q4). Metadata-only attacks "skew skill discovery and selection", and MCP tool poisoning has a CVE (CVE-2025-54136). `oac verify` could wrap a scanner. S2 cites ClawHavoc but no defences.
32. **The OpenClaw adapter PR #347** (CS §1) targets the very marketplace that hosted ClawHavoc (CE Q4). Merging it under a security brand needs a provenance story.
33. **Codex's 8 KB skill budget** (WF, wshobson) and the CC skill-listing cap of about 1,536 chars per entry, about 1% of context (CE Q1, unverified). S3 cites the 8 KB figure. The summaries never connect it to the size of `using-oac`.
34. **Antigravity has no session-start hook** (WF, Superpowers v7), and Gemini/Antigravity is closed source and drew pushback (NF Q1). Hook-based enforcement will not port there. That validates leaving it out of the three-host scope and is worth a matrix row.
35. **Third-party skill directories already index OAC skills** (verified-skill.com; CS §1). Distribution OAC does not control means it needs canonical, signed skills.

---

## 3. Facts in the summaries that the notes contradict or qualify

| Summary claim | What the notes say |
|---|---|
| R intro: a "'controlled and token-efficient' reputation that users **explicitly** chose over oh-my-opencode" | The phrase is the **researcher's inference** (CS §1 Inferences: "Its pitch is 'controlled and token-efficient'"). The two users in #116 said only that oh-my-opencode burned tokens and hit limits. Neither said OAC was controlled or efficient. The maintainer supplied "repeatable behaviour" and "made for teams". Downgrade the claim to "users left oh-my-opencode over token burn". |
| R/S2: #258 shows "OAC is currently *slower*" / "making [latency] worse" | #258 is GPT-specific ("GPT (any GPT model)"), and the maintainer attributed it to GPT's strict instruction-following (CS §1). The issue is real, but it is a model-specific report, not a general benchmark. |
| R: "One repo-mining study of 2,853 repos found only 5.5% use a skill and 4.6% a custom subagent" | That figure came "via search summary". The other study of 2,500 repos found **28.1% skills, 24.6% subagents, 13.3% hooks**, and the two "differ about 5x" (CS §4). R picked the low figure without the caveat. |
| R/S1/S2: Claude Code is "the host for 65.5% of agent users" | SO's figure is the share of AI-agent users who **use** Claude Code. It is multi-select: 65.5% + 58.7% + 29.5% is more than 100%. Only 26.2% of respondents use "AI agents or automated workflows" (CS §4). It is not exclusive host share. |
| S2: "wshobson … translates permissions by template, and only OAC has fail-closed degradation" | WF/S3 show wshobson publishing a *degradation* table per harness (e.g. "`tools:` dropped; heuristic `sandbox_mode = "read-only"`") and real-CLI round-trip tests. Whether its degradation is fail-closed is not established either way. "Only OAC" is unsupported. |
| S2 "Explicitly NOT do": generic code-review agents are "native everywhere" | NF: code review is native in **Copilot and Codex**. For Claude Code it is "Not verified in this pass" (NF Q3 Gaps), and no OpenCode built-in reviewer is listed. "Everywhere" is overstated. |
| S1: "use subagent-scoped hooks if the host supports them" | For plugins the host does not: "Plugin subagents ignore `hooks`, `mcpServers`, and `permissionMode`" (NF Q1). See §2 item 1. |
| S1/S2: deleting plugin-abilities, Cursor and Windsurf was correct | Partly qualified. #367 (2026-10-14) asks to port AbilitiesPlugin to v2, and #33 (abilities) is the most-discussed issue. #361 asks for a Cursor adapter (CS §1). Cursor reading `.claude/agents` covers subagents only (NF Q2), so it may not cover what #361 wants. |
| R: OpenCode v2 "opened its upgrade path on 2026-10-12" | That date comes from one secondary source (AICoder), and v2's own release date is disputed (09-11 vs 09-24) (CS §2). |
| R: "Claude models from 4.5 onward over-trigger on 'CRITICAL: You MUST'" | R does flag this as secondary. CE adds that "the official passage was not seen directly" (CE Q3). It should not appear as a quoted Anthropic claim in public docs. |
| R: "OAC's existing evaluators ('did it call context-scout first') are the brittle path-grading Anthropic warns against" | The quoted check is a CE *inference* (CE Q2 Inferences). Several OAC evaluators (stop-on-failure, report-first, cleanup-confirmation, approval-gate; IA §4) are outcome-like behavioural checks that matter for guardrails. Do not throw them all out. |
| R/S2: approval gates are "mostly prompt text" | This is accurate for Claude Code and OpenCoder. For OpenAgent on OpenCode, bash `"*": "ask"` and the secret edit-deny **are** host enforcement (IA §3). There is more working enforcement code than the framing suggests, including the `coder-verification` plugin (IA §2). |
| R: "every major harness except Aider ships custom subagents, Agent Skills, hooks…" | NF Gaps: Amp subagents, hooks and plan mode are "unverified". Cline's rules, skills, hooks and subagents are not covered, and Cline is absent from the Agent Skills client list (NF Q1/Q2). The claim is broadly right, with holes. |
| R: Superpowers is "listed in both Anthropic's official Claude marketplace and OpenAI's Codex marketplace" | The source is Superpowers' own README. CS §3 Gaps: "No authoritative account of superpowers' acceptance into Anthropic's official marketplace". The 941K installs figure is "Unverified aggregator claim". |
| S3: "34 canonical agents" | IA §1/§2 says **33** canonical plus the hand-placed `eval-runner` (34 on the OpenCode side). |
| S3: skills live in "`.opencode/skills` (4) and `.opencode/skill` (2)" | IA §2: `.opencode/skill/` holds one skill (project-orchestration). That makes 5 directories, 4 of them registered. |
| R: OAC is "below every significant competitor except cc-sdd and Agent OS" | The WF table also lists conductor (3,770) and spec-kitty (1,687) below or near OAC, and spec-workflow-mcp (4,302) is also below OAC. This is minor. |

---

## 4. User and community voices

### About OAC

- **Left oh-my-opencode over token burn** ([Discussion #116](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)):
  - ramonskie: "i just removed 'oh my opencode'. as with every release it seems to burn more and more tokens"
  - ret1: "after just a few minutes i hit my 4 hour limit with Claude Pro"
  - The maintainer positioned OAC as "repeatable behaviour" and "made for teams".
- **Scope** ([#283](https://github.com/darrenhinde/OpenAgentsControl/issues/283)):
  - "it's not disclosed that this framework is tied to JS frontend development"
  - A reply: "Yes, that's disappointing. It still works though - but not for UI."
- **Speed** ([#258](https://github.com/darrenhinde/OpenAgentsControl/issues/258)): "It takes GPT (any GPT model) upwards of 10 minutes to find OpenAgentsControl context", while vanilla plan/build is fast. Another user asked why context is "repeatedly searched" and pointed to Kilocode's approach.
- **Install** ([#237](https://github.com/darrenhinde/OpenAgentsControl/issues/237)): "Could not find path for context:core/config/paths.json". At least 5 users said "same problem", and a community member posted a workaround.
- **Claude plugin** ([#281](https://github.com/darrenhinde/OpenAgentsControl/issues/281)): `/oac:context-setup` and `/oac:setup` are "unknown skills". There have been no replies.
- **Fork** ([apilot/OpenAgentsControl](https://github.com/apilot/OpenAgentsControl)): "Community fork (active development). Upstream is unmaintained."
- **HN** ([item 47586562](https://news.ycombinator.com/item?id=47586562)): someone asked why an author built their own skills "instead of using an existing one like get-shit-done or OpenAgent Control?" This is the only HN mention.
- **Reviewer framing** ([Bright Coding, 2026-08-01](https://www.blog.brightcoding.dev/2026/08/01/darrenhindeopenagents-ai-code-generation-that-learns-your-patterns)): OAC "requires explicit approval at every execution step (Propose → Approve → Execute)", which it frames as latency.
- **Maintainer to a user** ([#121](https://github.com/darrenhinde/OpenAgentsControl/issues/121)): "might be over engineering".
- **Demand signals from issue counts** ([OAC issues](https://github.com/darrenhinde/OpenAgentsControl/issues)):
  - #33 Skills/Abilities, 20 comments (the most discussed)
  - #135 per-agent model selection, 8 comments
  - #142 npm/marketplace distribution
  - #266 clean uninstall
  - #361 Cursor and #346 OpenClaw adapters

### About competitors

- **oh-my-opencode** (summarised via [jeongil.dev](https://jeongil.dev/en/blog/trends/claude-code-agent-teams/) and [OpenCode #6930](https://github.com/anomalyco/opencode/issues/6930)): "switching to API burns $15–20 in 30 minutes", and one query hit the Max 20x limit.
- **oh-my-opencode, positive** ([HN 47645188](https://news.ycombinator.com/item?id=47645188)): a good report using it with Opus 4.6 and GPT-5.4.
- **oh-my-opencode rename** ([#2823](https://github.com/code-yeongyu/oh-my-openagent/issues/2823)): the old package stopped loading "without any error message or warning". This is a host-churn lesson.
- **Superpowers, praise** ([joanmedia](https://www.joanmedia.dev/ai-blog/superpowers-explained-the-plugin-that-turned-a-development-methodology-into-markdown)): skills "trigger automatically", and the startup script is "clear and compact".
- **Superpowers, endorsement** ([Simon Willison](https://simonwillison.net/2025/Oct/10/superpowers/)): he calls Jesse Vincent "one of the most creative users of coding agents… that I know".
- **Superpowers, critique** ([mcp.directory](https://mcp.directory/blog/superpowers-skill-worth-it-2026)): "bloated rather than wrong", and one always-on harness is "no longer the obvious default".
- **Spec-kit**:
  - Böckeler ([martinfowler.com](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)): "a LOT of markdown files", "overkill for the size of the problem", seen through secondhand summaries.
  - [Scott Logic](https://blog.scottlogic.com/2025/11/26/putting-spec-kit-through-its-paces-radical-idea-or-reinvented-waterfall.html): 2,577 lines of markdown for 689 lines of code, and the bug shipped anyway.
  - [Marmelab](https://marmelab.com/blog/2025/11/12/spec-driven-development-waterfall-strikes-back.html): "Waterfall strikes back".
- **BMAD**:
  - [#446](https://github.com/bmad-code-org/BMAD-METHOD/issues/446): the analyst "created 500+ page brief from 440+ page summary".
  - [dev.to bspann](https://dev.to/bspann/bmad-method-claude-code-how-i-actually-ship-projects-with-spec-driven-ai-development-1eei): even advocates call it "overkill" for small changes.
- **SuperClaude**:
  - [#286](https://github.com/SuperClaude-Org/SuperClaude_Framework/issues/286): its prompts take most of the context, about 8K tokens, roughly 60% trimmable.
  - [vibecodinghub](https://vibecodinghub.org/blog/superclaude-review): "I'm not going to validate those numbers".
- **ruflo**:
  - [awesome-claude-code #1338](https://github.com/hesreallyhim/awesome-claude-code/issues/1338): the "30-50% token reduction" claim is called fabricated, with 15–25K tokens added per session.
  - Its own audit ([ruflo audit](https://github.com/ruvnet/ruflo/blob/main/docs/reviews/intelligence-system-audit-2026-05-29.md)): "hardcoded doc strings with no benchmark".
  - Praise ([sublimecoding](https://sublimecoding.com/blog/ruflo-claude-flow-multi-agent-deep-dive)): "the most serious open-source attempt I've used at making multi-agent coding actually coordinate".
- **gstack** ([developersdigest](https://www.developersdigest.tech/blog/spec-driven-agent-workflows-github-spec-kit-gstack)): HN skepticism of it as "influencer-shaped ceremony", reported second-hand.
- **Agent teams** ([Towards AI](https://pub.towardsai.net/claude-code-extensions-explained-skills-mcp-hooks-subagents-agent-teams-plugins-9294907e84ff)): "if a feature doesn't actually need parallel coordination, an agent team is just a more expensive way to do what one focused session would've done anyway."
- **Native plan mode** ([paddo.dev](https://paddo.dev/blog/external-scaffolding-era-ending)): hosts absorb "about 80%". It leaves "compliance deliverables, domain templates, tool-agnostic workflows and per-action approval", plus reports of Plan Mode editing files while active.

**The pattern across these voices:** users value low token cost, automatic triggering, a compact footprint and things that just work. They hate token burn, ceremony on small tasks, unbenchmarked claims, and silent breakage on host or package changes. A guardrails product must therefore be **near-zero idle tokens, silent on low-risk work, loud and explainable when it blocks, and measured**.

Gaps in this section:
- No Reddit or YouTube data exists in the notes (CS §1 Gaps).
- No user quote anywhere asks for guardrails or policy enforcement directly. The closest are the maintainer's "made for teams" and the "repeatable behaviour" framing. Demand for the new position is inferred, not voiced.
