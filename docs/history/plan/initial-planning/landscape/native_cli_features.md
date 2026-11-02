# Native extension & orchestration features of major AI coding harnesses (as of Oct 2026)

Research date: 2026-10-16. Scope: Claude Code, OpenCode, Codex CLI, Gemini CLI / Antigravity CLI, Cursor, Cline / Roo / Kilo, Amp, Goose, Aider, GitHub Copilot CLI, Factory Droid. About 20 tool calls; primary docs used where reachable. Several vendor doc pages only listed features in navigation, so some cells are "listed, format not verified". Those are flagged.

## Q1. Per-tool support for subagents, skills, plugins/marketplaces, hooks, slash commands, rules files, MCP, plan/approval modes, background/parallel agents, worktrees, memory

### Takeaway
By Oct 2026 every major harness except Aider ships custom subagents, Agent Skills (SKILL.md), hooks, MCP, and some plan or approval mode. Most of them also ship a plugin bundle plus marketplace that mirrors Claude Code's layout. What a markdown agent framework used to supply (subagent delegation, skills, approval gates, context files, plugins) is now table stakes in the hosts.

### Cited Findings

**Claude Code (Anthropic)**
- Subagents are Markdown files with YAML frontmatter in `.claude/agents/` (project), `~/.claude/agents/` (user), plugin `agents/`, managed settings, or the `--agents` flag. Only `name` and `description` are required, and "unrecognized fields are ignored without an error". [Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents)
- Subagent frontmatter fields: `name, description, tools, disallowedTools, model, permissionMode (default/acceptEdits/auto/dontAsk/bypassPermissions/plan), maxTurns, autoCompactWindow, skills (preloaded), mcpServers, hooks, memory (user/project/local), background, omitClaudeMd, effort, isolation: worktree, color, initialPrompt, experimental`. Plugin subagents ignore `hooks`, `mcpServers`, and `permissionMode`. [Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents)
- Worktree isolation: `isolation: worktree` creates a temp git worktree that is auto-removed if unchanged, and Bash commands are checked so they stay inside it. [Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents)
- Persistent per-agent memory lives in `~/.claude/agent-memory/<name>/`, `.claude/agent-memory/<name>/` (committable), or `.claude/agent-memory-local/<name>/`. The first 200 lines or 25KB of MEMORY.md load into the system prompt. [Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents)
- Background subagents (`background: true`) run concurrently, and their permission prompts surface in the main session. There are also separate "background agents" (independent sessions in an agent view) and "agent teams" (coordinated sessions Claude spawns and supervises, which can reuse subagent definitions as teammates). [Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents)
- Plugins: an optional `.claude-plugin/plugin.json` manifest. Components are `skills/`, `commands/` ("Prefer `skills/` for new plugins"), `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `output-styles/`, `workflows/` (.js), `themes/`, `monitors/`, `bin/` (on PATH), and `settings.json`. There is also `userConfig` (with sensitive values kept in the keychain), `dependencies`, `channels`, `experimental.evals`, `claude plugin validate`, and marketplace entries with a `strict` mode. A CLAUDE.md at the plugin root is NOT loaded as context; "put them in a skill". [Plugin manifest reference](https://code.claude.com/docs/en/plugins-reference)
- Hooks: 33 events, including `SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolBatch, SubagentStart/Stop, TaskCreated/Completed, TeammateIdle, InstructionsLoaded, PreCompact/PostCompact, WorktreeCreate/Remove, Pre/PostModelSwitch, Stop`. There are 5 handler types: `command, http, mcp_tool, prompt` (single-turn LLM check), and `agent` (a tool-using verifier subagent, experimental). [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- Agent Skills: Claude Code is listed as a supporting client of the open standard. [agentskills.io](https://agentskills.io)

**OpenCode (sst/opencode, now anomalyco)**
- Agents are defined in `opencode.json` under `agent`, or as Markdown in `.opencode/agents/` or `~/.config/opencode/agents/`. The filename becomes the agent name. [OpenCode agents](https://opencode.ai/docs/agents/)
- Frontmatter: `description` (required), `mode` (primary/subagent/all, default all), `model` (provider/model-id), `temperature, top_p, steps` (replaces deprecated `maxSteps`), `prompt, permission` (ask/allow/deny per tool; `tools` deprecated in favor of `permission`), `hidden, color, disable`. Unknown keys pass through to the provider as model options. [OpenCode agents](https://opencode.ai/docs/agents/)
- Built-in agents: primary Build and Plan (Plan sets edits and bash to `ask`), subagents General, Explore, and Scout (read-only external docs/dependency research), plus hidden compaction/title/summary agents. `permission.task` globs control which subagents an agent may invoke. [OpenCode agents](https://opencode.ai/docs/agents/)
- Skills are searched in `.opencode/skills/`, `.claude/skills/`, `.agents/skills/` (walking up to the git root) and in the global `~/.config/opencode/skills/`, `~/.claude/skills/`, `~/.agents/skills/`. Frontmatter is `name, description` (required) plus `license, compatibility, metadata`. OpenCode-specific keys go in `metadata`: `opencode/slash`, `opencode/autoinvoke`. Skill access is gated by `permission.skill` allow/deny/ask. [OpenCode skills](https://opencode.ai/docs/skills/)
- Kilo Code rebuilt its VS Code extension on the OpenCode server in April 2026. This comes from a vendor comparison page. [Kilo vs Cline (morphllm)](https://www.morphllm.com/comparisons/kilo-code-vs-cline)

**OpenAI Codex (CLI / IDE / app / cloud)**
- Codex docs moved: developers.openai.com/codex/* now 308-redirects to learn.chatgpt.com/docs/*. [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- Custom agents are TOML files, one per agent, in `~/.codex/agents/` or `.codex/agents/`. Required fields are `name, description, developer_instructions`. Optional: `model, model_reasoning_effort, model_reasoning_summary, model_verbosity`, and `features.*` toggles (shell_tool, apps, plugins, memories, request_permissions_tool). A global `[agents]` section in config.toml sets `max_concurrent_threads_per_session` and `default_subagent_model`. An agent named `explorer` overrides the built-in. [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- Subagents inherit the parent's sandbox and approval policy, and an agent file cannot set `sandbox_mode, approval_policy, model_provider, mcp_servers`. Docs recommend parallel agents for read-heavy work and caution against parallel writes. Skills are inherited and can be disabled per agent via `skills.config`. [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- The doc index contains pages for Hooks ("Run scripts or MCP tools during the Codex lifecycle"), Build skills, Skills & Plugins, Plugins/Build plugins, enterprise Plugin management (GitHub import/sync), AGENTS.md, Permissions/Sandbox/Rules, "Auto-review" (sandbox-boundary approvals routed through a reviewer agent), Worktrees, Memories, Slash commands, MCP, Codex Cloud, and Code review / Security Review. "Custom Prompts" is deprecated in favor of skills. [Codex docs index](https://learn.chatgpt.com/llms.txt)
- Codex plugins bundle skills, MCP servers (optionally with custom ChatGPT UI), and lifecycle hooks. ChatGPT and Codex share "one universal plugin directory". [Skills & Plugins](https://learn.chatgpt.com/docs/skills-and-plugins.md)

**Google Gemini CLI → Antigravity CLI**
- Gemini CLI subagents are Markdown with YAML frontmatter in `.gemini/agents/*.md` and `~/.gemini/agents/*.md`. Fields: `name, description` (required), `kind` (local/remote), `tools` (supports `*`, `mcp_*`), `mcpServers, model, temperature, max_turns` (30), `timeout_mins` (10). Subagents cannot call other subagents. They are enabled by default (`experimental.enableAgents`), and extensions can bundle them. [Gemini CLI subagents](https://geminicli.com/docs/core/subagents/)
- **Major change:** Antigravity CLI (`agy`, written in Go) was announced May 19, 2026. Gemini CLI and the Code Assist IDE extensions stopped serving AI Pro, Ultra, and free individual users on June 18, 2026. Enterprise/Standard licenses and paid API keys keep Gemini CLI. Agent Skills, Hooks, Subagents, and Extensions (renamed "Antigravity plugins") carry over, though not at 1:1 parity at launch. The CLI runs multi-agent tasks in the background and shares its harness with the Antigravity 2.0 desktop app. At the announcement Gemini CLI had 100k+ GitHub stars, 6,000 merged PRs, and "millions of users". [Google Developers Blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- Antigravity CLI is reportedly not open source, which drew developer pushback. This is secondary reporting and not verified against the license. [ostechnix](https://ostechnix.com/google-is-replacing-gemini-cli-with-google-antigravity/); [letsdatascience](https://letsdatascience.com/news/google-replaces-gemini-cli-with-antigravity-cli-574b2056)

**Cursor (editor, agent, CLI, cloud)**
- Custom subagents are read from `.cursor/agents/`, `.claude/agents/`, `.codex/agents/` and the user-level equivalents. `.cursor/` takes precedence over `.claude/` and `.codex/`. Fields: `name, description, model` (inherit, with bracket options like `effort=high`), `readonly`, `is_background`. [Cursor subagents](https://cursor.com/docs/context/subagents)
- Built-in subagents are Explore and Browser. Modes are foreground, background (output in `~/.cursor/subagents/`), and parallel. Isolation is optional, with a per-subagent git worktree or a cloud VM plus branch. `/in-cloud` and `/autopilot` (a cloud agent drives a PR toward merge) are available, and subagents can be resumed by agent ID. [Cursor subagents](https://cursor.com/docs/context/subagents)
- Cursor supports Agent Skills and AGENTS.md. [agentskills.io](https://agentskills.io); [agents.md](https://agents.md)

**GitHub Copilot CLI / coding agent**
- Custom agent profiles live in `~/.copilot/agents`, `.github/agents`, and org/enterprise `.github-private/agents`, invoked with `/agent`, by name, or `--agent=NAME`. Built-in agents: Explore, Task, General purpose, Code review, Research, Rubber duck. Skills, hooks, and MCP are supported (the GitHub MCP server comes preconfigured; config in `~/.copilot/mcp-config.json`). Instructions come from `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md`, and AGENTS.md. Plan mode is Shift+Tab. Autopilot mode exists. Work can be delegated to the cloud coding agent and resumed locally with `/resume`. Slash commands include `/every`, `/after`, `/sandbox enable`. [Copilot CLI docs](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)
- Copilot and VS Code are listed Agent Skills clients. [agentskills.io](https://agentskills.io)

**Amp (Sourcegraph / Amp Inc.)**
- The manual lists Customize pages for AGENTS.md, Skills, MCP (with an enterprise MCP Registry Allowlist), Plugins, "Global Plugins & Skills", a Plugin API reference, and "Modes & Models". Threads can be saved and shared. The manual page did not describe subagents, hooks, or plan mode, so those are unverified. [Amp manual](https://ampcode.com/manual)
- Amp is listed as an Agent Skills and AGENTS.md client. [agentskills.io](https://agentskills.io); [agents.md](https://agents.md)

**Factory Droid**
- Plugins use a manifest at `.factory-plugin/plugin.json`. Components: `skills/<name>/SKILL.md`, `commands/`, `droids/<name>.md` (subagents with their own prompt, tools, and model), `hooks/hooks.json` (using `${DROID_PLUGIN_ROOT}`), and `mcp.json`. Install with `droid plugin install plugin@marketplace` at user or project scope. The official marketplace is Factory-AI/factory-plugins, and internal marketplaces are supported. Hooks first appeared, experimental, in Factory 1.10. This comes from search snippets of docs.factory.ai, and full field lists were not verified. [Factory plugins](https://docs.factory.ai/cli/configuration/plugins); [Factory 1.10 changelog](https://docs.factory.ai/changelog/1-10.md)
- Factory supports Agent Skills and AGENTS.md. [agentskills.io](https://agentskills.io); [agents.md](https://agents.md)

**Cline / Roo Code / Kilo Code**
- Cline now ships a CLI (`npm i -g cline`, interactive or headless for CI), a desktop app with parallel sessions and scheduled tasks, an SDK (`@cline/sdk`), and "Kanban", which runs many agents in parallel from a task board with per-card worktrees, auto-commit, and dependency chains. It also offers ACP mode for Zed/Neovim, and ClinePass at $9.99/mo. The docs landing page did not cover rules, skills, hooks, or subagents. [Cline docs](https://docs.cline.bot/)
- Roo Code: a sunset was announced April 21, 2026, and the repo went read-only May 15, 2026. Roo recommends Kilo Code. This comes from Kilo's own pages and is vendor-framed. Roo still appears as an Agent Skills client. [Kilo vs Roo](https://kilo.ai/kilo-code/vs/roo-code); [agentskills.io](https://agentskills.io)
- Kilo Code: a Roo fork that auto-migrates `.roomodes` (slug, roleDefinition, customInstructions, groups). It has Orchestrator mode, which delegates subtasks to specialized modes, plus Agent Manager and built-in subagents. It is an AGENTS.md supporter. [morphllm Kilo vs Cline](https://www.morphllm.com/comparisons/kilo-code-vs-cline); [agents.md](https://agents.md)
- A third-party comparison describes Cline's model as a Plan/Act split without custom modes. [morphllm](https://www.morphllm.com/comparisons/kilo-code-vs-cline)

**Goose (Block → AAIF)**
- Goose has "recipes" (portable YAML workflows with parameters and sub-recipes, runnable in CI) and parallel subagents. It was donated to the Agentic AI Foundation, and the repo moved from block/goose to the aaif-goose org on April 7, 2026. This is secondary reporting. [dev.to review](https://dev.to/jangwook_kim_e31e7291ad98/goose-by-block-a-free-open-source-ai-agent-review-2026-fno); [rywalker research](https://rywalker.com/research/goose)
- Goose is an Agent Skills client (docs under "context-engineering/using-skills") and an AGENTS.md supporter. [agentskills.io](https://agentskills.io); [agents.md](https://agents.md)

**Aider**
- Aider is listed as an AGENTS.md supporter. [agents.md](https://agents.md)
- Aider is NOT in the agentskills.io client showcase. [agentskills.io](https://agentskills.io)

### Inferences
- Aider seems to remain a single-agent pair programmer with no native subagents, skills, or hooks. I found no 2026 source showing otherwise, but I did not fetch aider.chat docs (see Gaps).
- Claude Code has the richest primitive set: per-agent memory, worktree isolation, 33 hook events, agent/prompt hooks, plugin evals, workflows, monitors, and LSP. Most other hosts are converging on a subset of it.
- "Plan" is now a native primary mode (OpenCode Plan agent, Copilot Shift+Tab, Claude `permissionMode: plan`, Cline Plan/Act), so a separate plan-first approval gate is redundant as a mechanism. Its remaining value is as opinionated content.

### Gaps
- Exact Codex SKILL.md path (`.agents/skills`?) and the Codex plugin manifest filename. Pages were reachable but did not state them.
- Amp subagents (Oracle/Librarian), hooks, and plan mode. The manual index only listed page names.
- Copilot `.agent.md` frontmatter field list, Copilot plugins/marketplace, and `/fleet`. The CLI page did not include them.
- Cline rules/skills/hooks/subagent details. The landing page did not include them, and docs.cline.bot/llms.txt was not fetched.
- Antigravity CLI file formats (does it still read `.gemini/agents` and GEMINI.md?). Not stated in the announcement.
- Aider 2026 changelog not fetched.
- Dates for most individual feature launches. Vendor docs rarely state them.

## Q2. Formats and cross-compatibility: is there convergence?

### Takeaway
Two layers have converged hard: Agent Skills (SKILL.md, 40+ clients) and AGENTS.md (Linux Foundation / AAIF, 60k+ repos, 23 named tools). Subagent definitions and plugin manifests are converging de facto on Claude Code's shape (Markdown + YAML, a `.<vendor>-plugin/plugin.json` manifest with sibling component dirs), and hosts increasingly read `.claude/` paths directly. Codex (TOML agents) is the main outlier.

### Cited Findings
- Agent Skills spec: a folder with `SKILL.md` (`name` and `description` minimum) plus optional `scripts/`, `references/`, `assets/`. Progressive disclosure loads metadata first, then the body on activation, then resources. The format was originally developed by Anthropic and released as an open standard. [agentskills.io](https://agentskills.io)
- Agent Skills clients listed include Claude Code, Claude, ChatGPT & Codex, Gemini CLI, OpenCode, Cursor, Amp, Goose, GitHub Copilot, VS Code, Factory, Roo Code, Junie, OpenHands, Kiro, Letta, Mistral Vibe, TRAE, Tabnine, Snowflake Cortex Code, Databricks, Spring AI, Laravel Boost, pi, Emdash, Mux, and others. Aider and Cline are absent. [agentskills.io](https://agentskills.io)
- AGENTS.md is stewarded by the Agentic AI Foundation under the Linux Foundation and used by "over 60k open-source projects". The 23 tools named are Codex, Jules, Factory, Aider, goose, opencode, Zed, Warp, VS Code, Devin, UiPath, Junie, Amp, Cursor, RooCode, Gemini CLI, Kilo Code, Phoenix, Semgrep, Copilot coding agent, Ona, Windsurf, and Augment Code. Claude Code is NOT listed (it uses CLAUDE.md). [agents.md](https://agents.md)
- AAIF was formed Dec 2025 with Anthropic, Block, and OpenAI as founding contributors. Its founding projects are MCP, goose, AGENTS.md, and agentgateway. [rywalker research on goose](https://rywalker.com/research/goose); [Linux Foundation press](https://www.linuxfoundation.org/press/agentic-ai-foundation-announces-global-2026-events-program-anchored-by-agntcon-mcpcon-north-america-and-europe)
- OpenCode reads skills from `.claude/skills/` and `.agents/skills/` as well as its own dir. OpenCode-specific options go under `metadata` (`opencode/slash`, `opencode/autoinvoke`), which keeps the spec file portable. [OpenCode skills](https://opencode.ai/docs/skills/)
- Cursor reads subagents from `.claude/agents/` and `.codex/agents/` natively. [Cursor subagents](https://cursor.com/docs/context/subagents)
- Subagent frontmatter divergence:
  - Claude Code uses camelCase `tools/disallowedTools/permissionMode/maxTurns/isolation/memory/background`. [CC](https://code.claude.com/docs/en/sub-agents)
  - OpenCode uses `mode/permission/steps/temperature`, and its name comes from the filename. [OpenCode](https://opencode.ai/docs/agents/)
  - Gemini uses snake_case `max_turns/timeout_mins/kind`. [Gemini](https://geminicli.com/docs/core/subagents/)
  - Cursor uses `readonly/is_background`. [Cursor](https://cursor.com/docs/context/subagents)
  - Codex uses TOML `developer_instructions`. [Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- Unknown-field tolerance: Claude Code ignores unrecognized subagent fields silently. [CC](https://code.claude.com/docs/en/sub-agents) OpenCode passes unknown keys through as provider model options. [OpenCode](https://opencode.ai/docs/agents/) (Note: passing them through to the provider could be a hazard for cross-tool files carrying stray keys.)
- Plugin layout convergence: Claude Code uses `.claude-plugin/plugin.json` with `skills/ commands/ agents/ hooks/hooks.json .mcp.json` at the root. [CC plugins](https://code.claude.com/docs/en/plugins-reference) Factory uses `.factory-plugin/plugin.json` with `skills/ commands/ droids/ hooks/hooks.json mcp.json` at the root and `plugin@marketplace` IDs. [Factory](https://docs.factory.ai/cli/configuration/plugins) Codex plugins bundle skills, MCP, and hooks. [Codex](https://learn.chatgpt.com/docs/skills-and-plugins.md) Gemini extensions were renamed "Antigravity plugins". [Google blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- Custom slash-command files are being folded into skills. Claude Code says "Prefer `skills/` for new plugins" over `commands/`. [CC plugins](https://code.claude.com/docs/en/plugins-reference) Codex "Custom Prompts" is deprecated, with skills recommended instead. [Codex index](https://learn.chatgpt.com/llms.txt) OpenCode exposes skills as slash commands via `opencode/slash`. [OpenCode skills](https://opencode.ai/docs/skills/)

### Inferences
- The portable unit is now the SKILL.md folder. A cross-tool build should emit skills as the primary artifact and treat subagents and plugin manifests as thin per-host adapters.
- Subagent frontmatter is the remaining incompatibility (tool allowlists, permissions, model naming, step limits). That makes a translator or build step still valuable, but it is shrinking. Cursor reading `.claude/agents` lowers the need for a separate Cursor output.
- Rules files: AGENTS.md is the common denominator, with CLAUDE.md as the Claude-specific holdout. A framework should write AGENTS.md and bridge to CLAUDE.md (e.g. via import), not invent a separate context-root format for the basics.

### Gaps
- Whether Claude Code reads AGENTS.md natively in 2026. Not verified; agents.md does not list it.
- Agent Skills spec optional fields (`allowed-tools`, `license`, `compatibility`, `metadata`). Only OpenCode's subset was confirmed.

## Q3. Native features from 2025–2026 that overlap "workflow framework" add-ons (planning, task breakdown, code review, context discovery)

### Takeaway
Hosts now natively ship an explore/context-discovery subagent, a plan mode, a code-review agent, parallel/background subagents with worktree isolation, persistent memory, and LLM-based verification hooks. Those are the core of what frameworks like OpenAgentsControl provide via markdown agents (context-scout, task-manager, code-reviewer, approval gates, parallel execution).

### Cited Findings
- **Context discovery / exploration agents:** Claude Code has an Explore-style built-in (see CC docs). OpenCode ships Explore (read-only codebase search) and Scout (external docs/dependency research). [OpenCode agents](https://opencode.ai/docs/agents/) Cursor ships Explore (a faster model, run in parallel). [Cursor](https://cursor.com/docs/context/subagents) Copilot CLI ships Explore and Research. [Copilot CLI](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli) Codex has a built-in `explorer`. [Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- **Planning / approval gates:** OpenCode has the Plan primary agent with edit/bash set to ask. [OpenCode](https://opencode.ai/docs/agents/) Copilot CLI has plan mode (Shift+Tab) and autopilot. [Copilot](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli) Claude Code has `permissionMode: plan/auto/acceptEdits`, and the `PermissionRequest` hook plus `prompt`/`agent` hook handlers enable programmable gates. [CC sub-agents](https://code.claude.com/docs/en/sub-agents); [CC hooks](https://code.claude.com/docs/en/hooks) Codex has "Auto-review", which routes sandbox-boundary approvals through a reviewer agent. [Codex index](https://learn.chatgpt.com/llms.txt) Cline has a Plan/Act split. [morphllm](https://www.morphllm.com/comparisons/kilo-code-vs-cline)
- **Task breakdown / orchestration:** Kilo has Orchestrator mode, which splits tasks across specialized modes. [morphllm](https://www.morphllm.com/comparisons/kilo-code-vs-cline) Claude Code has agent teams, `TaskCreated/TaskCompleted` hooks, and plugin `workflows/` (.js). [CC sub-agents](https://code.claude.com/docs/en/sub-agents); [CC hooks](https://code.claude.com/docs/en/hooks); [CC plugins](https://code.claude.com/docs/en/plugins-reference) Cline Kanban offers dependency chains and per-card worktrees. [Cline docs](https://docs.cline.bot/) Goose recipes support sub-recipes. [dev.to](https://dev.to/jangwook_kim_e31e7291ad98/goose-by-block-a-free-open-source-ai-agent-review-2026-fno)
- **Code review:** Copilot CLI has a built-in "Code review" agent. [Copilot](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli) Codex has Code review (local changes plus GitHub/GitLab PRs, with review rules in AGENTS.md) and Security Review. [Codex index](https://learn.chatgpt.com/llms.txt)
- **Parallel execution:** Cursor runs parallel and background subagents with optional per-subagent worktree or cloud VM. [Cursor](https://cursor.com/docs/context/subagents) Claude Code has `background: true` and `isolation: worktree`. [CC](https://code.claude.com/docs/en/sub-agents) Codex has `max_concurrent_threads_per_session` and Worktrees. [Codex](https://learn.chatgpt.com/docs/agent-configuration/subagents) Antigravity CLI runs background multi-agent tasks. [Google](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- **Memory:** Claude Code has per-agent MEMORY.md (user/project/local). [CC](https://code.claude.com/docs/en/sub-agents) Codex has Memories. [Codex index](https://learn.chatgpt.com/llms.txt)
- **Cloud handoff:** Copilot delegates to the cloud agent and resumes with `/resume`. [Copilot](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli) Cursor has `/in-cloud` and `/autopilot`. [Cursor](https://cursor.com/docs/context/subagents) Codex has Codex Cloud. [Codex index](https://learn.chatgpt.com/llms.txt)
- **Quality testing of extensions:** Claude Code has `claude plugin validate --strict` and `experimental.evals` for plugin eval suites. [CC plugins](https://code.claude.com/docs/en/plugins-reference)

### Inferences
- **Stop doing (commoditized):** generic explore/context-scout agents, a generic code-reviewer, parallel-execution orchestration, worktree management, plan-then-approve gating as a mechanism, memory files, custom slash-command files, and hand-rolled plugin packaging.
- **Double down (gaps hosts leave):**
  - (a) Opinionated, curated content: project standards and context files, review rubrics, security patterns. Hosts provide containers, not content.
  - (b) A cross-host build and translator for subagent frontmatter, permissions, and plugin manifests (CC / OpenCode / Codex TOML / Factory / Antigravity). Frontmatter still diverges.
  - (c) Enforced gates via hooks (PreToolUse/PermissionRequest + agent/prompt hooks) rather than prompt-only instructions.
  - (d) Evals and verification of agent behavior across hosts.
  - (e) Structured context discovery tied to a project standards registry. Hosts' Explore agents search code, not curated standards.
  - (f) Governance of what gets installed (scoped, safe installs), since marketplaces are proliferating.

### Gaps
- Launch dates for most of these features. Docs are undated, so changelogs would need to be checked per feature.
- Whether Claude Code ships a built-in code-review agent or `/review` in 2026. Not verified in this pass, though the `/code-review` skill exists in this environment's skill list.

## Q4. Market share / popularity signals

### Takeaway
Claude Code leads self-reported usage in 2026 surveys. Codex is the fastest riser, Copilot is declining but has the broadest awareness, and Cursor is flat to declining in share. Gemini CLI's consumer base was forcibly migrated to the closed-source Antigravity CLI in June 2026, and Roo Code was sunset in April–May 2026.

### Cited Findings
- JetBrains survey (May–July 2026): Claude Code is most-used for 31% of developers. Copilot is at 21% (down from 29% a year earlier) with 79% mind share. Codex rose from 3% (Jan) to 16% (mid-2026). Cursor fell from 18% to 12%. The primary blog returned 403, so these figures come via search summaries and a 36Kr write-up, and they are not verified against the original. [JetBrains Research](https://blog.jetbrains.com/research/2026/08/18/ai-coding-agent-adoption-2026); [aiunderstanding/36Kr](https://aiunderstanding.org/news/36kr-reports-claude-code-led-github-copilot-in-jetbrains-2026-developer-survey)
- Pragmatic Engineer (Feb 2026, ~900 respondents): Claude Code is most-used, and Cursor mentions grew 35% over nine months. [Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/ai-tooling-2026)
- Stack Overflow 2025 (as cited secondarily): Copilot fell from 67% to 51% among professionals, and Claude Code debuted at 10%. [uvik](https://uvik.net/blog/claude-code-vs-cursor-vs-copilot-vs-codex-2026/)
- Gemini CLI had 100k+ GitHub stars and "millions of users" at its May 2026 retirement announcement. [Google Developers Blog](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/)
- Goose: about 48k GitHub stars as of June 2026 per one source; another says 27k, likely older. [dev.to](https://dev.to/jangwook_kim_e31e7291ad98/goose-by-block-a-free-open-source-ai-agent-review-2026-fno); [aitoolanalysis](https://aitoolanalysis.com/?p=2996)
- AGENTS.md is used by 60k+ OSS projects. Agent Skills has 40+ listed clients. [agents.md](https://agents.md); [agentskills.io](https://agentskills.io)

### Inferences
- For a cross-tool framework, Claude Code is the must-support host. Codex is the fastest-growing second target and uses TOML agents, which argues for adding a Codex emitter. OpenCode matters as the open-source base, since Kilo now builds on its server. Cursor reads `.claude/agents`, so it comes almost for free.

### Gaps
- No reliable numbers for OpenCode, Amp, Factory, Cline, Kilo, or Aider usage share. Star counts and ARR figures were not retrieved.
- JetBrains primary data (sample size, methodology) was not verified due to the 403.
