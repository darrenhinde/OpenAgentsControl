# Agent workflow layers / harness add-ons on top of AI coding CLIs (competitors to OpenAgentsControl), as of 2026-10-16

Method note: star counts, push dates, release tags and created dates were pulled live from the GitHub REST API (`gh api repos/<owner>/<repo>`) on 2026-10-16, so they are primary data. "Releases in last 90 days" = releases published after 2026-07-16; a value of 100 means "100 or more" because only one page was fetched. README claims are the projects' own descriptions, not independent verification.

## Which projects are the leading competitors, and what does each do?

### Takeaway
The field has split into roughly five archetypes: (1) skills-based methodology plugins (Superpowers, Compound Engineering, ECC, gstack), (2) spec-driven-development (SDD) toolkits (spec-kit, OpenSpec, BMAD, GSD Core, cc-sdd, Agent OS, Kiro), (3) multi-agent orchestration / swarm harnesses (ruflo, oh-my-claudecode/oh-my-codex, OmO), (4) catalogs/marketplaces of agents (wshobson/agents, claude-code-templates), and (5) task managers (Task Master). By stars, OAC (4,910) sits in the bottom tier. The leaders are Superpowers (~300k), ECC (~281k), spec-kit (~142k) and gstack (~137k), and every leader now ships to several tools through native plugin marketplaces.

### Adoption snapshot (GitHub API, 2026-10-16)

| Project | Stars | Created | Last push | Latest release (date) | Releases since 2026-07-16 |
|---|---|---|---|---|---|
| obra/superpowers | 300,412 | 2025-10-09 | 2026-10-10 | v7.0.0 (2026-10-10) | 5 |
| affaan-m/ECC (formerly "everything-claude-code") | 280,966 | 2026-01-18 | 2026-10-15 | v2.2.3 (2026-10-01) | 5 |
| github/spec-kit | 141,507 | 2025-08-21 | 2026-10-15 | v1.2.0 (2026-10-13) | 40 |
| garrytan/gstack | 136,640 | 2026-03-11 | 2026-10-16 | no GitHub releases | n/a |
| ruvnet/ruflo (formerly claude-flow; the old URL redirects) | 75,446 | 2025-06-02 | 2026-10-16 | v3.56.10 (2026-10-14) | ≥100 |
| Fission-AI/OpenSpec | 72,129 | 2025-08-05 | 2026-10-15 | v1.14.2 (2026-10-15) | 12 |
| code-yeongyu/oh-my-openagent (formerly oh-my-opencode, now "OmO") | 70,103 | 2025-12-03 | 2026-10-16 | v5.1.34 (2026-10-16) | ≥100 |
| gsd-build/get-shit-done (ARCHIVED) | 64,284 | — | 2026-05-31 | v1.42.3 (2026-05-16) | 0 |
| bmad-code-org/BMAD-METHOD | 54,220 | 2025-04-13 | 2026-10-16 | v6.12.4 (2026-10-14) | 6 |
| wshobson/agents | 40,898 | — | 2026-10-15 | no GitHub releases | n/a |
| Yeachan-Heo/oh-my-claudecode (OMC) | 39,959 | 2026-01-09 | 2026-10-16 | v5.7.3 (2026-10-14) | 20 |
| Yeachan-Heo/oh-my-codex (OmX) | 33,555 | 2026-02-02 | 2026-10-16 | — | — |
| davila7/claude-code-templates | 32,679 | — | 2026-10-16 | v1.29.7 (2026-10-09) | — |
| eyaltoledano/claude-task-master | 28,233 | 2025-03-04 | 2026-04-28 | task-master-ai@0.43.1 (2026-03-31) | 0 |
| EveryInc/compound-engineering-plugin | 25,551 | 2025-10-09 | 2026-10-15 | v3.30.5 (2026-10-11) | 33 |
| SuperClaude-Org/SuperClaude_Framework | 23,910 | 2025-06-22 | 2026-09-27 | v4.3.0 (2026-03-22) | 0 |
| humanlayer/humanlayer | 11,703 | — | 2026-10-15 | pro-0.20.0 (2025-12-23) | — |
| open-gsd/gsd-core (successor to GSD) | 10,577 | 2026-05-22 | 2026-10-16 | v1.17.0 (2026-10-14) | — |
| buildermethods/agent-os | 5,508 | 2025-07-16 | 2026-10-07 | v3.0.0 (2026-01-20) | 0 |
| **darrenhinde/OpenAgentsControl (OAC)** | **4,910** (406 forks) | 2025-08-14 | 2026-09-13 | v0.7.1 (2026-01-30) | 0 |
| gotalab/cc-sdd | 3,718 | 2025-07-17 | 2026-10-13 | v3.1.0 (2026-09-23) | 1 |
| gemini-cli-extensions/conductor | 3,770 | — | 2026-09-01 | — | — |
| Pimzino/spec-workflow-mcp | 4,302 | — | 2026-07-03 | — | — |
| spec-kitty/spec-kitty | 1,687 | — | 2026-10-16 | — | — |

Reference ecosystem repos: anthropics/skills 181,520; earendil-works/pi (pi-mono coding agent) 115,657; hesreallyhim/awesome-claude-code 55,815; anthropics/claude-plugins-official 39,924; vercel-labs/skills (`npx skills`) 35,197. All from the GitHub API on 2026-10-16.

Source for every row: GitHub REST API, e.g. [obra/superpowers](https://github.com/obra/superpowers), [affaan-m/ECC](https://github.com/affaan-m/ECC), [github/spec-kit](https://github.com/github/spec-kit), [garrytan/gstack](https://github.com/garrytan/gstack), [ruvnet/ruflo](https://github.com/ruvnet/ruflo), [Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec), [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent), [gsd-build/get-shit-done](https://github.com/gsd-build/get-shit-done), [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD), [wshobson/agents](https://github.com/wshobson/agents), [Yeachan-Heo/oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode), [eyaltoledano/claude-task-master](https://github.com/eyaltoledano/claude-task-master), [EveryInc/compound-engineering-plugin](https://github.com/EveryInc/compound-engineering-plugin), [SuperClaude-Org/SuperClaude_Framework](https://github.com/SuperClaude-Org/SuperClaude_Framework), [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core), [buildermethods/agent-os](https://github.com/buildermethods/agent-os), [darrenhinde/OpenAgentsControl](https://github.com/darrenhinde/OpenAgentsControl), [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd).

### Cited Findings: per-project profiles

**obra/superpowers (Jesse Vincent / Prime Radiant)**
- Concept: "a complete software development methodology for your coding agents, built on top of a set of composable skills" plus bootstrap instructions so the agent uses them. Skills trigger automatically ("Mandatory workflows, not suggestions"). — [README](https://github.com/obra/superpowers)
- Workflow: brainstorming → using-git-worktrees (isolated branch, verifies a clean test baseline) → writing-plans (tasks of 2-5 minutes, each with exact paths, complete code and verification steps) → subagent-driven-development (a fresh subagent per task, two-stage review: spec compliance, then code quality) or executing-plans (inline, one final review) → test-driven-development (RED-GREEN-REFACTOR; "Deletes code written before tests") → requesting-code-review (critical issues block progress) → finishing-a-development-branch (merge/PR/keep/discard, worktree cleanup). — [README](https://github.com/obra/superpowers)
- Other skills: systematic-debugging, verification-before-completion, dispatching-parallel-agents, receiving-code-review, writing-skills (includes a testing methodology for skills), and diagnosing-superpowers (reads the session transcript, reports with line-level evidence, packages a scrubbed bug-report bundle). — [README](https://github.com/obra/superpowers)
- Supported hosts (16 listed): Claude Code, Antigravity, Codex App, Codex CLI, Cursor, Devin CLI, Factory Droid, Gemini CLI, GitHub Copilot CLI, Grok Build CLI, Kimi Code, OpenCode, Pi, Qwen Code, Hermes Agent, Muse. — [README](https://github.com/obra/superpowers)
- Install: listed in Anthropic's official marketplace (`/plugin install superpowers@claude-plugins-official`) and in OpenAI's official Codex plugin marketplace, plus Cursor `/add-plugin superpowers` and `agy plugin install`. — [README](https://github.com/obra/superpowers)
- v7.0.0 (2026-10-10): brainstorming rebuilt to "size the work" (do it now / agree in chat / write a design doc); a "builder check" subagent replaced the spec-document reviewer, reading the design as the builder and listing open questions; native Antigravity plugin manifest; it bootstraps on Antigravity through skill-description discovery because Antigravity has no session-start hook; SessionStart hook hardening on Windows. — [v7.0.0 release notes](https://github.com/obra/superpowers/releases/tag/v7.0.0)
- Commercial support is offered via Prime Radiant (sales@primeradiant.com). — [README](https://github.com/obra/superpowers)
- An older third-party figure of "124K stars" is out of date against the API's 300,412. — [andrew.ooo](https://andrew.ooo/answers/superpowers-vs-gsd-claude-code-2026/)

**oh-my-opencode → oh-my-openagent / "OmO" (code-yeongyu, Sisyphus Labs)**
- The repo was renamed from oh-my-opencode (the API now resolves it to `code-yeongyu/oh-my-openagent`). OmO 5.x is no longer an OpenCode plugin: it is a standalone `omo` binary that "runs on senpi, our fork of pi" (badlogic/pi-mono). Install: `curl -fsSL https://get.omo.dev/install.sh | bash` or `npm i -g omo-ai`. OpenCode-edition users migrate with `omo setup`. — [README](https://github.com/code-yeongyu/oh-my-openagent)
- Features: the `ultrawork`/`ulw` keyword (read the codebase, plan, prove each step, verify on the real surface); `mass ulw` turns a job into a parallel graph of agents, with per-part model routing; "Kibitzer" memory, where memory lives in a git repo of markdown files and a small cheap model watches the main agent and nudges it before it repeats a mistake; multi-subscription login (Claude, ChatGPT, Kimi, GLM) with per-model tuned system prompts; batched tool calls ("CodeMode"); live reload of config, skills and prompts. — [README](https://github.com/code-yeongyu/oh-my-openagent)
- Release cadence is extreme: ≥100 releases since 2026-07-16; v5.1.34 shipped 2026-10-16. The README says it is "maintained by Jobdori, the AI assistant", and it promotes a commercial Sisyphus Labs waitlist. — GitHub API; [README](https://github.com/code-yeongyu/oh-my-openagent)

**BMAD Method (bmad-code-org)**
- Concept: "Agile AI Driven Development". It covers the whole effort (what to build, architecture, change) with persona agents (product, architecture, UX, dev, test), "right-sized process" (small changes go straight to build) and "durable context" carried forward. — [README](https://github.com/bmad-code-org/BMAD-METHOD)
- Two release lines. Stable v6.12 (`npx bmad-method install`, needs Node 20.12+ and Python 3.10+/uv) is frozen apart from bug fixes. V7 is a preview alpha distributed as skills (`npx skills add bmad-code-org/BMAD-METHOD`) and via Claude Code and Codex plugin marketplaces (`bmad-code-org/bmad-plugins`). The README gives a "v7 release ETA October 16, 2026". — [README](https://github.com/bmad-code-org/BMAD-METHOD)
- Ecosystem modules: BMad Builder (skill/workflow/agent builder), Creative Intelligence Suite, Test Architect, **BMad Loop** ("builds, verifies, and retros a whole epic unattended"), Game Dev Studio. — [README](https://github.com/bmad-code-org/BMAD-METHOD)

**SuperClaude Framework**
- A "meta-programming configuration framework" for Claude Code only: 30 `/sc:*` slash commands, 20 agents, 7 behavioral modes, 8 MCP server integrations. Install via `pipx install superclaude` (also on npm). — [README](https://github.com/SuperClaude-Org/SuperClaude_Framework)
- The README says the TypeScript plugin system "is not yet available (planned for v5.0)". The last release is v4.3.0 (2026-03-22), with 0 releases since July 2026. — [README](https://github.com/SuperClaude-Org/SuperClaude_Framework); GitHub API

**claude-flow → Ruflo (ruvnet)**
- Rebranded: "Claude Flow is now Ruflo". It calls itself "An agent meta-harness for Claude Code and Codex" ("Agent = Model + Harness"), with 100+ specialized agents, swarms, "self-learning memory", federation across machines, vector RAG, and a Rust engine (Cognitum.One). — [README](https://github.com/ruvnet/ruflo)
- Two install paths. A Claude Code plugin marketplace (`ruflo-core`, `ruflo-console` cockpit, `ruflo-mods` for in-process prompt routing and policy enforcement, `ruflo-swarm` pane; needs Claude Code 2.1.287+) puts zero files in the workspace. `npx ruflo init` installs 98 agents, 60+ commands, 30 skills, an MCP server (314 MCP tools), hooks and a daemon. — [README](https://github.com/ruvnet/ruflo)
- ≥100 releases since 2026-07-16 (v3.56.10 on 2026-10-14). — GitHub API

**GitHub spec-kit**
- Now framed as a general process toolkit ("Build with a spec, fix a bug, or assess an idea"), not only SDD. Core SDD flow: `/speckit-constitution` once per project, then `/speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement → /speckit-converge`, repeating implement→converge until it reports "Converged". Optional clarification, checklist and consistency-analysis gates. Bug-fixing and idea-assessment ship as bundled extensions. — [README](https://github.com/github/spec-kit)
- Extensibility primitives: integrations (switch coding agents), extensions (commands, quality gates, lifecycle event hooks), presets (enforce org or regulatory standards), project-local overrides, workflows plus workflow overlays (modify without forking), custom step packages, bundles (role or team setups), community and private catalogs with auth, air-gapped installs, and an "artifact inventory" showing which layer supplies each file. — [README](https://github.com/github/spec-kit)
- Install: `uv tool install specify-cli` then `specify init my-project --integration copilot`. Commands are agent skills. 40 releases since 2026-07-16 (v1.2.0 on 2026-10-13). — [README](https://github.com/github/spec-kit); GitHub API

**Fission-AI/OpenSpec**
- Lightweight, brownfield-first SDD ("fluid not rigid, iterative not waterfall"). Flow: `/opsx:explore → /opsx:propose <change>` creates `openspec/changes/<change>/{proposal.md, specs/, design.md, tasks.md}`, then `/opsx:apply`, then `/opsx:archive` (archives the change and merges the spec deltas). Specs are plain markdown with `## ADDED Requirements` / SHALL statements / WHEN-THEN scenarios. — [README](https://github.com/Fission-AI/OpenSpec)
- OpenSpec has a Y Combinator company page, i.e. it is VC-backed. — [YC](https://www.ycombinator.com/companies/openspec)
- 12 releases since 2026-07-16 (v1.14.2 on 2026-10-15). — GitHub API

**GSD ("Get Shit Done", TÂCHES) → GSD Core (open-gsd)**
- The original `gsd-build/get-shit-done` (64k stars) and `gsd-build/gsd-2` (7.8k) are both archived. The last release was v1.42.3 on 2026-05-16. The README: "GSD Has Moved… continues as GSD Core" at open-gsd/gsd-core. — [archived README](https://github.com/gsd-build/get-shit-done); GitHub API
- GSD Core (10.6k stars, created 2026-05-22, v1.17.0 on 2026-10-14) is a "meta-prompting, context engineering, and spec-driven development system" for Claude Code, OpenCode, Antigravity CLI, Kimi CLI, Kilo, Codex, Copilot, Cursor, Windsurf and others. Per-milestone loop: Discuss → Plan (verify the plan fits a fresh context window) → Execute (parallel waves; "each executor starts with a clean 200k-token context") → Verify → Ship (PR, archive the phase). It targets "context rot". Install: `npx @opengsd/gsd-core@latest`, an interactive runtime picker. — [README](https://github.com/open-gsd/gsd-core)
- A Pi-specific sibling, open-gsd/gsd-pi, also exists (1,321 stars). — GitHub search

**Agent OS (Brian Casel / Builder Methods)**
- It now focuses narrowly on standards: Discover Standards (extract conventions from the codebase), Deploy Standards (inject the relevant ones per task), Shape Spec, Index Standards. It works alongside Claude Code, Cursor and Antigravity. Docs live off-GitHub at buildermethods.com; paid "Builder Methods Pro" community. — [README](https://github.com/buildermethods/agent-os)
- The last release is v3.0.0 (2026-01-20), with 0 releases since July, although the repo was pushed 2026-10-07. — GitHub API
- This is the closest conceptual match to OAC's context/standards system, and it has about 5.5k stars to OAC's 4.9k.

**wshobson/agents**
- A "multi-harness agentic plugin marketplace". The catalog has 94 plugins (92 local) containing 202 agents, 185 skills and 105 commands. "The components share a Markdown source, with installation and capabilities adapted to each harness." — [README](https://github.com/wshobson/agents)
- Targets: Claude Code (plugin marketplace), Codex CLI (native marketplace or generated TOML agents, with oversized skill bodies split to fit Codex's 8 KB budget), Cursor (marketplace), and OpenCode, Antigravity CLI, GitHub Copilot and Pi via `make install-<tool>` generators with translated tool permissions. A published "capability matrix" (docs/harnesses.md) covers model mappings, permissions and hooks. Skills-only install via `gh skill install` (GitHub CLI 2.90+) or `npx skills add`. — [README](https://github.com/wshobson/agents)
- This is the most direct analogue to OAC's canonical cross-tool build (one markdown source emitting per-tool agents). It covers 7 harnesses; OAC covers 2.

**Kiro-style spec workflows**
- Kiro (AWS) specs are three markdown files (requirements.md in EARS notation, design.md, tasks.md) under `.kiro/specs/`. Third-party reports say Kiro went GA in March 2026, reached GovCloud in February 2026, and runs one agent harness across CLI, IDE and web, with the web version opening PRs from a sandbox. These come from secondary sources and should be verified against AWS docs. — [pasqualepillitteri.it review](https://pasqualepillitteri.it/en/news/6370/amazon-kiro-ide-spec-driven-review); [morphllm](https://www.morphllm.com/comparisons/kiro-vs-cursor); [issoh.co.jp](https://www.issoh.co.jp/tech/details/7963/)
- gotalab/cc-sdd (3.7k stars, v3.1.0 on 2026-09-23) is the main open-source "Kiro-inspired" port. It installs 17 Agent Skills across 8 agents (Claude Code and Codex stable; Cursor, Copilot, Devin, OpenCode, Gemini CLI and Antigravity in beta), and existing Kiro specs "remain compatible". v3 features: `/kiro-discovery` routing (extend a spec / no spec / new spec / decompose), `/kiro-impl` (a fresh implementer subagent per task running TDD behind a feature flag, an independent reviewer, auto-debug after repeated rejection), "boundary-first" design.md with a File Structure Plan, `_Boundary:_`/`_Depends:_` task annotations, and `/kiro-spec-batch` (multi-spec waves with cross-spec contradiction review). — [README](https://github.com/gotalab/cc-sdd)
- Others: Pimzino/spec-workflow-mcp (4.3k, last push 2026-07-03), gemini-cli-extensions/conductor (3.8k; "A plugin for AI coding agents (Antigravity, Claude Code) enabling Spec-Driven Development"), spec-kitty (1.7k). — GitHub API/search

**Task Master (eyaltoledano/claude-task-master)**
- An AI task-management system (PRD → tasks with dependencies, tags/workstreams, a research command, a "loop" command), shipped as an MCP server plus CLI for Cursor, Lovable, Windsurf, Roo, Claude Code and others. It needs its own API keys. Docs have moved to tryhamster.com, alongside Hamster's commercial products (Studio, pricing). — [README](https://github.com/eyaltoledano/claude-task-master)
- Last release task-master-ai@0.43.1 (2026-03-31); last push 2026-04-28; 0 releases since July. — GitHub API

**Newer 2026 entrants with large adoption**
- **gstack (Garry Tan, YC; created 2026-03-11, 136.6k stars):** "23 opinionated tools that serve as CEO, Designer, Eng Manager, Release Manager, Doc Engineer, and QA". Flow: `/office-hours → /plan-ceo-review → /review → /qa` (QA in a real browser), plus a security officer running OWASP and STRIDE. Install by git clone into `~/.claude/skills/gstack` and `./setup` (Bun). **Team mode** bootstraps a repo so teammates get gstack automatically, with a throttled auto-update check at session start and a "required/optional" switch. — [README](https://github.com/garrytan/gstack)
- **ECC (affaan-m; created 2026-01-18, 281k stars):** "agent harness performance optimization system: skills, instincts, memory, security, and research-first development for Claude Code, Codex, OpenCode, Cursor and beyond". Loop: plan → test → implement → review → verify → remember → improve. It turns "repeated wins into reusable skills". It is commercialised through ECC Pro and a GitHub App ("Private repos from $19/seat/mo") and ships the `ecc-agentshield` security package. — [README](https://github.com/affaan-m/ECC)
- **oh-my-claudecode (OMC; created 2026-01-09, 40k stars) and oh-my-codex (33.6k):** "Teams-first multi-agent orchestration for Claude Code". `/team N:executor` runs a staged pipeline team-plan → team-prd → team-exec → team-verify → team-fix (loop) on Claude Code's native teams. `omc team 2:codex|gemini|antigravity` spawns real tmux CLI worker panes of other vendors' CLIs. `/autopilot` has named stage profiles (ralplan, execution, ralph, qa), and there are `/ralph` and `/deep-interview` skills. — [README](https://github.com/Yeachan-Heo/oh-my-claudecode)
- **Compound Engineering (Every Inc; 25.6k stars, 33 releases since July):** 36 skills on "14 agent hosts". Loop: brainstorm, plan, build, review, then "**capture what you learned** — so the knowledge from each change is written down where the next change can read it". `ce-pov` with "oracle this" asks other models for independent opinions. — [README](https://github.com/EveryInc/compound-engineering-plugin)

### Inferences
- OAC (4,910 stars, last tagged release 2026-01-30, no releases in the past 90 days) is about 1/60th the size of Superpowers and below every major competitor except cc-sdd and Agent OS. Its public release cadence also looks stalled next to competitors shipping weekly, even though the refactor/canonical branch work is unreleased.
- OAC's original niche was "OpenCode-native agent framework". That niche has thinned. oh-my-opencode, the biggest OpenCode-native rival, left OpenCode for its own pi fork, and every major framework now lists OpenCode as just one of many targets (Superpowers, wshobson, GSD Core, cc-sdd, ECC).
- OAC's cross-tool build (OpenCode + Claude Code) is now table stakes. wshobson/agents does the same "shared markdown source → per-harness artifacts" with 7 targets and a published capability matrix, and Superpowers and Compound Engineering claim 14-16 hosts.

### Gaps
- Release cadence for wshobson/agents and gstack can't be measured from GitHub Releases because neither tags releases.
- HumanLayer's current open-source scope was not examined in depth. Its last tagged release is pro-0.20.0 (2025-12-23), but the repo is still active.
- Exact 2026 dates for Kiro's GA and features come from third-party sources. I did not reach AWS primary docs.

## Workflow, subagents/skills/hooks, tools and install: how do they compare structurally?

### Takeaway
Nearly all leaders have converged on the same building blocks: Agent Skills as the unit of distribution, native plugin marketplaces (Claude Code, Codex, Cursor, Antigravity) as the install path, a fresh subagent per task with an independent reviewer, and a SessionStart hook or skill-description trick to bootstrap. They differ mainly in how much ceremony they impose and whether they add a runtime (MCP server, daemon, tmux, a separate binary).

### Cited Findings
- **Superpowers**: skills plus a SessionStart hook bootstrap. Where a host has no session-start hook (Antigravity), the `using-superpowers` skill description ("Use when starting any conversation") does the bootstrapping instead, verified on 12 runs. — [v7.0.0 notes](https://github.com/obra/superpowers/releases/tag/v7.0.0)
- **spec-kit**: CLI scaffolder (Python/uv) that writes agent skills per integration; extension event hooks react to agent lifecycle events. — [README](https://github.com/github/spec-kit)
- **BMAD v7**: moving from its own npx installer to `npx skills add` and Claude Code/Codex marketplaces. — [README](https://github.com/bmad-code-org/BMAD-METHOD)
- **GSD Core**: npx installer required "for cross-runtime compatibility — do not copy files from agents/ or commands/ directly", which implies per-runtime transformation like OAC's build. — [README](https://github.com/open-gsd/gsd-core)
- **ruflo**: plugin path (zero workspace files) vs CLI path (writes `.claude/`, `.claude-flow/`, CLAUDE.md, hooks, daemon, MCP). — [README](https://github.com/ruvnet/ruflo)
- **OMC**: Claude Code plugin or npm runtime (`oh-my-claude-sisyphus`, which uses better-sqlite3); tmux for cross-vendor workers. — [README](https://github.com/Yeachan-Heo/oh-my-claudecode)
- **OmO**: standalone binary (pi fork), so no longer a layer on someone else's CLI. — [README](https://github.com/code-yeongyu/oh-my-openagent)
- **Task Master**: MCP server plus CLI with its own LLM API keys, outside the host's model. — [README](https://github.com/eyaltoledano/claude-task-master)
- **gstack**: git clone into the skills directory plus a Bun-built binary and a Chromium download for browser QA. — [README](https://github.com/garrytan/gstack)
- Claude Code plugins can bundle skills, subagents, hooks, MCP servers, LSP servers and monitors. A marketplace is a git repo with `.claude-plugin/marketplace.json`, and `claude-plugins-official` loads automatically. — [Claude Code plugins reference](https://docs.claude.com/en/docs/claude-code/plugins-reference); [morphllm guide](https://www.morphllm.com/claude-code-marketplace)

Workflow shapes:
- **spec → plan → tasks → implement (+ converge/verify):** spec-kit, OpenSpec (propose → apply → archive), cc-sdd/Kiro (requirements → design → tasks → impl), GSD Core (discuss → plan → execute → verify → ship), BMAD (clarify → plan → build/verify → learn).
- **brainstorm → plan → subagent execution with TDD and review:** Superpowers, Compound Engineering (adds "capture learnings"), ECC (adds remember/improve).
- **Role/persona review gates:** gstack (CEO, eng manager, designer, QA, CSO), BMAD personas, SuperClaude personas.
- **Orchestration / swarms:** ruflo, OMC team pipeline, OmO `mass ulw` agent graphs.

### Inferences
- OAC's structure (markdown agents, a context/standards system, approval gates, task-breakdown subagents, skills) matches the mainstream pattern. Its approval-gate concept overlaps with cc-sdd's "humans approve the contract at phase gates" and Superpowers' "sign off on the design". It is no longer a differentiator on its own.
- OAC's distribution (its own CLI installer) differs from the leaders, who prioritise official marketplace listings. Superpowers is in both Anthropic's and OpenAI's official marketplaces.

### Gaps
- I did not verify each project's actual hook usage beyond README claims (for example, whether gstack or ECC register PreToolUse/SessionStart hooks).

## Which ideas are gaining traction, and which distinctive ideas does OAC lack?

### Takeaway
The momentum is behind: right-sized process instead of fixed ceremony; skills and marketplaces across many hosts; fresh-context subagent-per-task with an independent reviewer and TDD; spec deltas and convergence loops; learning or memory loops that write lessons back into the repo; parallel execution through worktrees, tmux or waves; and team-wide enforced installs. Several of these are concrete features OAC lacks.

### Cited Findings
- **Right-sizing the process:** BMAD sends small changes "straight to build" while complex work "gets the depth it needs". Superpowers v7 brainstorming "sizes the work" (just do it / agree in chat / write a design doc). cc-sdd's `/kiro-discovery` routes to "implement directly with no spec" when warranted. — [BMAD README](https://github.com/bmad-code-org/BMAD-METHOD); [Superpowers v7](https://github.com/obra/superpowers/releases/tag/v7.0.0); [cc-sdd README](https://github.com/gotalab/cc-sdd)
- **TDD enforcement:** Superpowers deletes code written before tests. cc-sdd `/kiro-impl` runs RED→GREEN per task behind a feature flag with an independent reviewer and auto-debug. — [Superpowers README](https://github.com/obra/superpowers); [cc-sdd README](https://github.com/gotalab/cc-sdd)
- **Parallel worktrees / workers:** Superpowers' using-git-worktrees skill (isolated branch plus clean test baseline). OMC tmux panes running Codex, Gemini and Antigravity CLIs side by side. GSD Core parallel "waves" with a clean 200k context per executor. Cursor 2.0 (Oct 2025) shipped parallel agents in worktrees natively. — [Superpowers](https://github.com/obra/superpowers); [OMC](https://github.com/Yeachan-Heo/oh-my-claudecode); [GSD Core](https://github.com/open-gsd/gsd-core); [paddo.dev, 2025-12-07](https://paddo.dev/blog/external-scaffolding-era-ending)
- **Plugin marketplaces and skill installers as distribution:** `npx skills` (vercel-labs/skills, 35k stars), `gh skill install` in GitHub CLI 2.90+, Codex `codex plugin marketplace add`, Cursor `/add-plugin`, Antigravity `agy plugin install`. — [wshobson README](https://github.com/wshobson/agents); [BMAD README](https://github.com/bmad-code-org/BMAD-METHOD)
- **Persistent memory / learning loops:** OmO Kibitzer (a git repo of markdown memory plus a cheap watcher model). Compound Engineering "capture what you learned". ECC "remember → improve", turning repeated wins into skills. ruflo "self-learning memory" that feeds routing. — [OmO](https://github.com/code-yeongyu/oh-my-openagent); [Compound Engineering](https://github.com/EveryInc/compound-engineering-plugin); [ECC](https://github.com/affaan-m/ECC); [ruflo](https://github.com/ruvnet/ruflo)
- **Spec as living, delta-based artifact:** OpenSpec ADDED/MODIFIED requirement deltas merged on archive. spec-kit's `converge` loop. cc-sdd boundary annotations and cross-spec contradiction review. — [OpenSpec](https://github.com/Fission-AI/OpenSpec); [spec-kit](https://github.com/github/spec-kit); [cc-sdd](https://github.com/gotalab/cc-sdd)
- **Multi-model second opinions:** Compound Engineering "oracle this". OmO per-task model routing across Claude, ChatGPT, Kimi and GLM subscriptions. — [CE](https://github.com/EveryInc/compound-engineering-plugin); [OmO](https://github.com/code-yeongyu/oh-my-openagent)
- **Org governance / customisation layering:** spec-kit presets ("Enforce organizational or regulatory standards"), workflow overlays, private catalogs, air-gapped installs. gstack team mode makes the framework "required" for a repo. — [spec-kit](https://github.com/github/spec-kit); [gstack](https://github.com/garrytan/gstack)
- **Self-diagnosis:** Superpowers' diagnosing-superpowers skill analyses session transcripts when the workflow misfires. — [Superpowers](https://github.com/obra/superpowers)
- **Commercialisation:** ECC Pro/GitHub App ($19/seat/mo), Prime Radiant enterprise support, Builder Methods Pro, Hamster (Task Master), Sisyphus Labs (OmO), OpenSpec (YC). — respective READMEs; [YC](https://www.ycombinator.com/companies/openspec)

### Inferences: distinctive ideas OAC lacks (based on the README feature sets above)
1. Official marketplace listings (Anthropic and OpenAI official marketplaces) and `npx skills` / `gh skill` compatibility.
2. Breadth of hosts: Codex, Cursor, Gemini CLI/Antigravity, Copilot and Pi are missing; OAC emits only OpenCode and Claude Code.
3. A published per-harness capability matrix (wshobson).
4. Right-sized/adaptive process routing, as opposed to always-on approval gates.
5. Worktree isolation and finishing-branch workflows.
6. Hard TDD enforcement.
7. A learning loop that writes lessons back into context (OAC's context system is a natural home for this; Compound Engineering, ECC and OmO show the pattern).
8. Spec delta/convergence artifacts.
9. Cross-vendor parallel workers (tmux) and fresh-context waves.
10. Team-mode "required" installs with auto-update.
11. Session-transcript self-diagnosis.
12. Org presets and overlays for standards (OAC's context system could position against spec-kit presets and Agent OS standards).

### Gaps
- No quantitative data (surveys, download counts) was found on which practices users actually keep. Traction is inferred from stars and release activity.

## Which projects have stalled, pivoted, or been made redundant by native CLI features?

### Takeaway
Several first-wave projects have stalled or pivoted. SuperClaude, Task Master and Agent OS have had no releases since July 2026; GSD was archived and relaunched under a new org; oh-my-opencode left OpenCode; claude-flow rebranded to Ruflo. Commentators argue native Plan Mode, subagents and worktree-parallel agents absorbed about 80% of the heavy SDD frameworks' value. Even so, the heavy frameworks (spec-kit, BMAD) are still growing and shipping often.

### Cited Findings
- **SuperClaude:** last release v4.3.0 on 2026-03-22, none since. The promised v5 plugin system is still "planned". — GitHub API; [README](https://github.com/SuperClaude-Org/SuperClaude_Framework)
- **Task Master:** last release 2026-03-31, last push 2026-04-28. Docs and attention have shifted to the commercial Hamster product. — GitHub API; [README](https://github.com/eyaltoledano/claude-task-master)
- **Agent OS:** last release v3.0.0 on 2026-01-20. Repo still pushed (2026-10-07). It narrowed its scope to standards and spec shaping. — GitHub API; [README](https://github.com/buildermethods/agent-os)
- **GSD:** original repo and gsd-2 archived in May 2026; development continues as open-gsd/gsd-core (10.6k stars vs 64k for the original). — [archived README](https://github.com/gsd-build/get-shit-done); GitHub API
- **oh-my-opencode:** renamed and re-platformed onto its own pi fork ("senpi") as the `omo` binary, with a migration path away from OpenCode. — [README](https://github.com/code-yeongyu/oh-my-openagent)
- **claude-flow:** renamed Ruflo and repositioned as a Claude Code + Codex "meta-harness" with plugin mods. — [README](https://github.com/ruvnet/ruflo)
- **Pimzino/claude-code-spec-workflow:** last push 2025-09-07, effectively superseded by the same author's spec-workflow-mcp (last push 2026-07-03). — GitHub search
- **"External scaffolding era ending" (paddo.dev, 2025-12-07):** argues Claude Code Plan Mode (system-level write blocking, Haiku explore subagents, clarifying questions, plans saved to `~/.claude/plans/`), Cursor 2.0 (Oct 2025, parallel worktree agents) and Google Antigravity (Nov 2025, multi-agent manager, task-list and plan artifacts) absorb BMAD, Spec-Kit and Cline patterns. It estimates "about 80%" coverage, with frameworks still useful for compliance deliverables, domain templates, tool-agnostic workflows and per-action approval. It also notes reports of Plan Mode editing files while active. — [paddo.dev](https://paddo.dev/blog/external-scaffolding-era-ending)
- Critiques of SDD overhead: heavy documentation, review overhead and token cost; "Big Design Up Front" risk; HN skepticism of gstack as "influencer-shaped ceremony" (reported second-hand). — [HackerNoon](https://sia.hackernoon.com/spec-driven-development-my-first-impressions-and-opinions); [developersdigest](https://www.developersdigest.tech/blog/spec-driven-agent-workflows-github-spec-kit-gstack)
- Agent teams critique: "if a feature doesn't actually need parallel coordination, an agent team is just a more expensive way to do what one focused session would've done anyway." — [Towards AI](https://pub.towardsai.net/claude-code-extensions-explained-skills-mcp-hooks-subagents-agent-teams-plugins-9294907e84ff)
- Counter-evidence to "redundant": spec-kit shipped 40 releases and OpenSpec 12 in the last 90 days, and both are still gaining stars (142k and 72k). — GitHub API

### Inferences
- The projects that stalled were mostly Claude-Code-only or slash-command-era (SuperClaude) or depended on separate API keys and an MCP runtime (Task Master). The survivors re-platformed onto skills and marketplaces and went multi-host. Projects that duplicated native features (task lists, plan files, simple personas) lost relevance. Those that encode an opinionated methodology or governance layer (TDD discipline, spec deltas, org presets, learning loops) kept growing.
- For OAC, the parts most at risk of redundancy are approval gates (native Plan Mode, permission modes) and generic task-breakdown subagents (native subagents, agent teams). The parts with the most defensible value are the context/standards system (compare Agent OS and spec-kit presets) and the canonical cross-tool build (compare wshobson and GSD Core installers), provided the build extends to more hosts.

### Gaps
- I found no primary Hacker News or Reddit thread URLs. The HN sentiment above is reported second-hand by blogs.
- I did not find official Anthropic release-note dates for Claude Code "agent teams" or the plugin marketplace launch in this pass, only third-party guides.
- Whether Superpowers' and ECC's very high star counts (300k and 281k, both reached within about 12 months) reflect organic use or star inflation was not investigated.
