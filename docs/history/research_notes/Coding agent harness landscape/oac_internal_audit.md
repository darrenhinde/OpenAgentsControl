# OAC (OpenAgentsControl) Internal Audit — what it is and does today (branch `refactor/canonical`, audited 2026-10-16)

Method: local read-only code audit of `/Users/darrenhinde/Documents/GitHub/MYBUSINESS/worktrees/OpenAgentsControl/refactor-canonical` (HEAD `d7924e4`, 48 commits ahead of `main`, 2 commits not yet pushed to `origin/refactor/canonical`). "Sources" below are repo-relative file paths or commands I ran; nothing was edited. Opinions are marked **(opinion)**.

## 1. Architecture: what the pieces are and what gets generated for which tool

### Takeaway
OAC is an OpenCode-first prompt/config pack (markdown agents, commands, skills and ~300 context files) plus a Node CLI (`oac`) that installs it. The new canonical build (`content/` → `oac build`) generates only the OpenCode agent files and `registry.json`; the Claude Code plugin is a separate, largely hand-maintained tree. OpenCode and Claude Code are the only two targets in code. Cursor and Windsurf adapters were deleted on this branch.

### Cited Findings
- The canonical source is `content/agents/**`: 33 agent markdown files (7 primary under core/meta/content/data and 26 subagents), plus `content/profiles/system/*.json` (5 system profiles: essential, developer, business, advanced, full) and `content/profiles/context/*.json` (5 context profiles: core, essentials, engineering, business, meta-authoring) — `find content -name '*.md'`; `content/profiles/`.
- The canonical agent format is OpenCode frontmatter plus an `oac:` block (id, category, version, dependencies, targets, and per-target `overrides`) — `content/agents/core/openagent.md` lines 1–43; `content/agents/subagents/code/coder-agent.md` (`overrides: claude-code:` block at line ~37).
- `oac build` writes `.opencode/agent/**` and `registry.json` in place and records hashes in `.oac/build-manifest.json`. The Claude Code target is staged to `.tmp/oac-build/` and only compared, "deliberately there is no flag to emit it in place" — `packages/cli/src/commands/build.ts` (header comment and `CLAUDE_STAGING_ROOT = '.tmp/oac-build'`); `packages/compatibility-layer/src/core/BuildPipeline.ts:77` (`BUILD_TARGETS = ["opencode", "claude-code"]`), `:179` (`"claude-code": "plugins/claude-code/agents"`).
- Running `node bin/oac.js build --check` gives: "33 canonical agents -> 41 files", "no drift", "claude-code — staged to .tmp/oac-build/ (NOT emitted in place)", "7 identical to the committed tree", "8 degradation warning(s)". I ran `diff -rq .tmp/oac-build/plugins/claude-code/agents plugins/claude-code/agents` and it returned no differences — command run 2026-10-16.
- The comment in `build.ts` still says the staged comparison "reports all 7 files as 'would change'". The golden test `it.skip("regenerates all 7 committed agents byte-for-byte [BLOCKED: permission + id/name decisions]")` is still skipped — `packages/cli/src/commands/build.ts`; `packages/compatibility-layer/tests/golden/golden-files.test.ts:230`. Both conflict with the build output above, which reports the 7 files as identical.
- The build covers only agents and registry. Claude Code plugin commands (6), skills (12), hooks and scripts are hand-authored, and so are OpenCode commands, skills, tools and plugins. None of them come from `content/` — `content/` contains only `agents/` and `profiles/`; `plugins/claude-code/{commands,skills,hooks}`.
- `packages/compatibility-layer` contains AgentLoader, ProfileLoader, ReferenceResolver, RegistryEmitter, BuildPipeline, Capabilities ("ordered permission rules, last-match-wins, fail-closed degradation"), CapabilityMatrix, OpenCodeAdapter, ClaudeAdapter, and Tool/Permission/Model/Context mappers. Its README says: "Targets are OpenCode and Claude Code only. Cursor and Windsurf support was removed on 2026-09-02" — `packages/compatibility-layer/README.md`; commit `a23a297 chore(compat): drop Cursor, Windsurf and the oac-compat conversion CLI`.
- On `main`, `packages/compatibility-layer/src/adapters/` still contains `CursorAdapter.ts` and `WindsurfAdapter.ts`, and `packages/plugin-abilities` still exists. This branch deleted both (`cce5255`) — `git ls-tree main packages/compatibility-layer/src/adapters/`.
- `packages/cli` (`@controlstack/oac-cli`, private) has the commands `init`, `update`, `add`/`remove`, `apply`, `build`, `doctor`, `list` and `status`. It is built with `bun build --target node` and runs on plain Node ≥20. Its tests use `bun test` — `packages/cli/src/index.ts`; `packages/cli/package.json`; commit `8581a42`.
- `oac init` installs into `.opencode/` only, records a manifest in `.oac/manifest.json`, and writes `.oac.json` with `context.root = ".opencode/context"` so the Claude Code plugin can find context — `packages/cli/src/commands/init.ts:140,221-237`; `packages/cli/src/lib/doctor-checks.ts:31`; README "Step 1".
- `oac apply claude` writes a single `CLAUDE.md` from the first loaded agent only: "Claude uses the first (primary) agent — multiple agents are not merged". The only apply target is `claude` — `packages/cli/src/commands/apply.ts:27,100-101`; `packages/cli/src/lib/ide-detect.ts:6` (`IdeType = "opencode" | "claude"`).
- The Claude Code plugin is distributed through a marketplace manifest. The plugin is named `oac`, version 1.1.0, and its source is `./plugins/claude-code` — `.claude-plugin/marketplace.json`; `plugins/claude-code/.claude-plugin/plugin.json`. The plugin's `settings.json` sets `"model": "opusplan"` — `plugins/claude-code/settings.json`.
- `integrations/claude-code/` is a legacy converter (`converter/src/convert-agents.js`, `install-claude.sh`). Its README describes `generated/`, `plugin/` and `bootstrap-install.sh`, which are not in the directory — `ls -R integrations/claude-code`; `integrations/claude-code/README.md`.
- `install.sh` (1,510 lines) and `update.sh` (344 lines) are bash installers driven by `jq` over `registry.json`. They install to `.opencode` or to the global `~/.config/opencode`, so they target OpenCode only — `install.sh:64,183-198,231`.
- `registry.json` (schema 2.0.0) lists 8 agents, 26 subagents, 17 commands, 2 tools (gemini, env), 1 plugin (notify), 4 skills, 195 contexts, 2 config entries and 5 profiles — parsed `registry.json`.

### Inferences
- Output by tool, as of today: **OpenCode** gets generated agents plus hand-written commands, skills, tools, plugins and context. **Claude Code** gets a hand-maintained plugin (7 agents, 12 skills, 6 commands, 1 SessionStart hook), whose agents happen to be reproducible by the build, plus an optional single-agent `CLAUDE.md` from `oac apply`. **Any other tool** gets nothing.
- **(opinion)** The canonical build is mature for agents: 553 compat tests, a drift gate in CI, and deterministic output. But it does not yet cover skills or commands, which are the parts that matter most for portability across hosts.

### Gaps
- I could not confirm whether the staged Claude agents matching the committed ones is intentional convergence or an accident of recent override edits. The code comments and the skipped test are stale either way.

## 2. Inventory: agents, subagents, skills, commands, context, profiles; supported vs. claimed hosts

### Takeaway
The OpenCode side has 34 agents (33 canonical plus the hand-placed `eval-runner`), 17 registered commands, 4 registered skills (5 skill directories on disk) and 297 context markdown files. The Claude Code plugin has 7 subagents, 12 skills and 6 commands. The README's "model-agnostic" claim is true only in the sense that OpenCode routes to any provider. Host support is limited to OpenCode (first-class) and Claude Code (beta). The Cursor/Copilot comparison table compares products rather than claiming support.

### Cited Findings
- **Primary agents (registry):** openagent, opencoder, system-builder, repo-manager, copywriter, technical-writer, data-analyst, eval-runner. `eval-runner` has no canonical source and is deliberately left out of the build manifest — `registry.json`; `packages/compatibility-layer/src/core/BuildPipeline.ts:33,405`.
- **Subagents (26):** adr-manager, agent-generator, architecture-analyzer, batch-executor, build-agent, coder-agent, command-creator, context-manager, context-organizer, context-retriever, contextscout, contract-manager, devops-specialist, documentation, domain-analyzer, externalscout, frontend-specialist, image-specialist, prioritization-engine, reviewer, simple-responder (a test fixture), stage-orchestrator, story-mapper, task-manager, tester (file `test-engineer.md`), workflow-designer — `registry.json`; `content/agents/subagents/**`.
- **OpenCode commands (17 registered):** test, commit, context, add-context, clean, optimize, prompt-enhancer, worktrees, build-context-system, validate-repo, test-new-command, commit-openagents, prompt-optimizer, create-tests, create-agent, check-context-deps, analyze-patterns — `registry.json`; `.opencode/command/**`.
- **OpenCode skills:** `.opencode/skills/` holds context-manager, context7, smart-router-skill (a "movie character personality" demo) and task-management. A fifth skill, `project-orchestration`, is in a separate singular `.opencode/skill/` directory. That directory is neither in `registry.json` nor in the npm `files` list, which includes `.opencode/skills/` only — `.opencode/skill/project-orchestration/SKILL.md`; `package.json` `files`.
- **OpenCode tools and plugins:** tools `gemini` and `env` (`.opencode/tool/`). Plugins `notify` (Telegram), `agent-validator` (with a `.disabled` twin) and `coder-verification` (under a separate `.opencode/plugins/` directory) — `.opencode/plugin/`; `.opencode/plugins/coder-verification/`.
- **Model-specific prompt variants:** `.opencode/prompts/core/openagent/{gemini,gpt,grok,llama,minimax,openrouter}.md` and `.opencode/prompts/core/opencoder/{gemini,gpt,grok,llama}.md`, with some stored result JSONs.
- **Context:** 297 `.md` files under `.opencode/context/`, 61,241 lines in total. By folder: openagents-repo 108 (internal docs about this repo), core 87, development 34, ui 30, content-creation 17, project-intelligence 6, and the remaining folders 2–4 each — `find .opencode/context`.
- **Claude Code plugin:** agents code-reviewer, coder-agent, context-manager, context-scout, external-scout, task-manager, test-engineer. Skills code-execution, code-review, context-discovery, context-setup, debugger, external-research, oac-approach, parallel-execution, task-breakdown, test-generation, using-oac, verification-before-completion (12). Commands brainstorm, debug, install-context, oac-cleanup, oac-help, oac-status. Hook: SessionStart only. The plugin's `context/` directory is empty (0 files) — `plugins/claude-code/**`.
- The README's Claude Code section claims "9 workflow skills" (there are 12). It tells users to run `/oac:setup --core` and advertises `/oac:plan`, but neither command exists in `plugins/claude-code/commands/`. It links `plugins/claude-code/FIRST-TIME-SETUP.md` and `QUICK-START.md`, which do not exist — `README.md:189-226`; `ls plugins/claude-code`.
- The README claims "**Model Agnostic:** Claude • GPT • Gemini • MiniMax • Local models" and states "Built on OpenCode". Its comparison table has columns for "Cursor/Copilot", "Aider" and "Oh My OpenCode" and does not mention Codex, Gemini CLI or Claude Code as competitors — `README.md:18,33,89-99`.
- `docs/getting-started/platform-compatibility.md` and `COMPATIBILITY.md` cover OS/bash compatibility of `install.sh`, not AI host tools — `COMPATIBILITY.md`.

### Inferences
- **(opinion)** "Model agnostic" is a property OAC inherits from OpenCode, not something it implements. On Claude Code it is Claude-only, and the plugin pins `opusplan`.
- **(opinion)** The agent catalog is broad but shallow in places. About 10 planning and system-builder subagents (story-mapper, contract-manager, prioritization-engine and others) are not part of the Claude Code plugin and have no evals (see section 4).

### Gaps
- I did not verify per-agent quality or whether each subagent is reachable from a primary agent's delegation logic.

## 3. How the context system and approval gates work in practice

### Takeaway
"Context" means curated markdown standards. A read-only scout subagent (ContextScout or context-scout) navigates them through `navigation.md` indexes, and the primary agent then reads them. In OpenCode, approval gates are partly enforced by OpenCode permissions: OpenAgent's bash is set to `"*": "ask"` and secret paths are set to edit-deny. Everything beyond that, including all approval before edits, is prompt instruction. In Claude Code, the plugin ships no permission rules at all.

### Cited Findings
- OpenAgent's frontmatter sets `bash: "*": "ask"` with deny rules for `sudo *`, `rm -rf /*` and `> /dev/*`. For edits it denies `**/*.env*`, `**/*.key`, `**/*.secret`, `node_modules/**` and `.git/**`, and other edits are allowed. The body rule `approval_gate` says "Request approval before ANY execution (bash, write, edit, task)", and the stage flow is Analyze → Approve ("Approval needed before proceeding") → Execute → on failure, report first and never auto-fix — `content/agents/core/openagent.md:6-19,84-92,259-266,446`.
- OpenCoder has no `"*"` bash rule. Only specific commands are set to `ask` (rm -rf, chmod, curl, wget, docker, kubectl) and `sudo` is denied — `content/agents/core/opencoder.md:6-23`.
- In the canonical-build docs, a Claude Code plugin "cannot ship permission rules". The shipped `coder-agent` granted Write/Edit without the five deny globs. The mitigation is prompt text, `disallowedTools: Bash, Task`, and a copy-paste `RECOMMENDED-PERMISSIONS.md` that users apply by hand — `CHANGELOG.md` [Unreleased] Security; `plugins/claude-code/RECOMMENDED-PERMISSIONS.md`; the comment in `content/agents/subagents/code/coder-agent.md` overrides block ("WIDENING — Edit…Accepted because a coding agent that cannot edit is not an agent").
- In Claude Code, approval is a skill. The `oac-approach` skill ("proposes a concise plan for user approval before writing any code") and the `using-oac` skill are injected on every session by a SessionStart hook. The hook also tells the model to push `context-setup` when no `.context-manifest.json` exists — `plugins/claude-code/hooks/hooks.json`; `plugins/claude-code/hooks/session-start.sh`.
- Context root resolution for the Claude plugin works in two steps. First it uses `.oac.json` `context.root` if present (the fast path). Otherwise it checks `.claude/context`, then `context/`, then `.opencode/context`, then `~/.claude/context`, then `{PLUGIN_ROOT}/context`, and signals the main agent to write `.oac.json` — `plugins/claude-code/skills/context-discovery/context-discovery-protocol.md:8-128`. The `context-discovery` skill runs with `context: fork` and `agent: context-scout`, and returns Critical, High and Medium priority file lists that the caller must read — `plugins/claude-code/skills/context-discovery/SKILL.md`.
- Context installation for Claude Code (`install-context.ts`) fetches `registry.json` from GitHub and sparse-clones the matching paths. It uses its own profile names, `essential | standard | extended | specialized | all`, mapped to categories. These are a third profile vocabulary, alongside the system profiles (essential, developer, business, advanced, full) and the context profiles (core, essentials, engineering, business, meta-authoring) — `plugins/claude-code/scripts/install-context.ts:6-7`; `plugins/claude-code/scripts/types/registry.ts:46`; `plugins/claude-code/scripts/utils/registry-fetcher.ts:61-73`; `content/profiles/`.
- MVI ("Minimal Viable Information") claim: the README says "Context files <200 lines, lazy loading" and "MVI principle (80% reduction)". Measured, 82 of the 297 context files exceed 200 lines — `README.md:77,95`; `find .opencode/context -name '*.md' -exec wc -l`.
- External docs come through `externalscout` and the `context7` skill, which use the Context7 API — `CHANGELOG.md` [0.6.0]; `.opencode/skills/context7/SKILL.md`.

### Inferences
- **(opinion)** In practice, OAC's approval gates are mostly prompt-level conventions, with real enforcement only where the host's permission system is configured (OpenCode `ask` rules). The README's "Agents ALWAYS request approval before execution" overstates this for OpenCoder (bash mostly unrestricted) and for Claude Code (no shipped rules).
- **(opinion)** I found no number or benchmark in the repo behind the "80% reduction" token claim.

### Gaps
- I did not measure actual token use or check how much context the scouts really load at runtime.

## 4. Eval framework: what it tests, how runnable, CI status

### Takeaway
`evals/framework` is a TypeScript harness that drives agents through an OpenCode server (via `@opencode-ai/sdk` or a spawned `opencode` CLI) and scores the event stream with rule-based evaluators: approval gate, context loading, delegation, stop-on-failure and others. It cannot test Claude Code. CI runs only its unit tests and suite-schema validation. The live-eval workflow is placed so that it never runs, and the last stored result is a failing run from January 2026.

### Cited Findings
- Evaluators: approval-gate, context-loading, delegation, behavior, cleanup-confirmation, error-handling, execution-balance, performance-metrics, report-first, stop-on-failure, tool-usage and agent-model. `content-evaluator` and `subagent-evaluator` are disabled as `.skip` — `ls evals/framework/src/evaluators`.
- The harness uses `createOpencode` from `@opencode-ai/sdk`. A comment reads "TODO: Investigate and fix SDK mode session creation issue… Once fixed, use SDK mode in CI" — `evals/framework/src/sdk/server-manager.ts:2,33-39`. Another reads "TODO: Implement file attachment support" — `evals/framework/src/sdk/client-manager.ts:112`.
- There are 263 YAML test cases, 170 of them outside `_archive/` directories. Archives are nested (`_archive/_archive/`). Live tests cover openagent (critical rules: context-loading, approval-gate, stop-on-failure; negative; behavior; delegation; integration; openrouter), opencoder, contextscout (17), task-manager, context-retriever, documentation, repo-manager, system-builder, copywriter and frontend-specialist, plus shared golden and edge-case tests — `find evals/agents -name '*.yaml'`.
- Root `package.json` scripts call `eval:sdk` with hard-coded models such as `anthropic/claude-3-5-sonnet-20241022`, `openai/gpt-4-turbo` and `opencode/grok-code-fast` — `package.json` scripts `test:*:claude|gpt4|grok`.
- `evals/results/latest.json`, dated 2026-01-17 (agent core/opencoder, model grok-code-fast), records 1 test with 0 passed. Its violations include "missing-approval" and "execution-before-read", and its paths point at a different checkout (`/Users/darrenhinde/Documents/GitHub/Claude-agents/...`) — `evals/results/latest.json`.
- The workflow `run-evaluations.yml` (workflow_dispatch, daily cron, push to main) lives in `.github/workflows/evals/`. GitHub Actions only loads workflow files from the top level of `.github/workflows`, so it does not run. The branch commit `68a3bdc` title says "keep evaluations inert" — `.github/workflows/evals/run-evaluations.yml`; `git log`.
- In CI, `pr-checks.yml` runs the eval framework build, `validate:suites:all` and `test:ci`, an allowlist of 7 vitest files. `validate-test-suites.yml` runs suite validation — `.github/workflows/pr-checks.yml`; `evals/framework/package.json:14`.
- Other workflows: packages-checks (CLI build, typecheck and test; compat-layer build, lint and test; canonical-build drift gate), installer-checks (bash -n, ShellCheck, e2e install on ubuntu and macOS, profile smoke tests for all 5 profiles), validate-registry, dependency-review, create-release, post-merge-pr (version bump), sync-docs, update-registry (manual only), opencode, and `post-merge.yml.disabled` — `.github/workflows/`.
- Checks on PR #342 (this branch, last pushed 2026-09-13): "Compatibility Layer (build + test + lint)" **fail** (`reference-resolution.test.ts`: "expected 197 to be greater than 200") and "Dependency Review" **fail**; everything else passes, including e2e install on two OSes and five profile smoke tests — `gh pr checks 342`; `gh run view 34788286521 --log-failed`. The two local unpushed commits target exactly these failures: `a4c8ab3` lowers the profile-reference floor, `d7924e4` upgrades vitest for GHSA-5xrq-8626-4rwp.
- Local runs on 2026-10-16: compat layer 553 passed and 1 skipped (554 total, 22 files); CLI `bun test` 226 passed and 0 failed (17 files); `oac build --check` reports no drift — commands run.
- Memory notes say evals/framework has no ESLint config, so lint is not part of its baseline — user auto-memory `eval-framework-lint-unconfigured`.

### Inferences
- **(opinion)** The packaging and build layers have solid deterministic tests. Behavioral evals of the agents are effectively dormant: no scheduled runs, a single stale failing result, OpenCode-only. That weakens the README's quality claims when comparing OAC against competitors.

### Gaps
- I did not run any live LLM eval (it needs OpenCode and API keys), so current pass rates are unknown.

## 5. Docs accuracy, version and release cadence

### Takeaway
The docs have drifted from the code. ROADMAP.md was last updated December 4, 2025, and still lists Claude Code as "Next". The CHANGELOG stops at 0.7.1 while VERSION and the manifests say 1.1.0 with no 1.x tag. The README's recommended install (`npm i -g @controlstack/oac`) points to a package that is not published.

### Cited Findings
- ROADMAP.md: "Last Updated: December 4, 2025". "Now" still lists "Stabilize OpenCode CLI integration" and "Improve evaluation framework reliability asd" (typo). "Next" lists "Support for additional AI coding tools (Claude Code)" even though the Claude plugin ships — `ROADMAP.md`.
- Version: `VERSION` = 1.1.0 and `package.json` `@controlstack/oac` 1.1.0 on the branch. `main` has `VERSION` 0.7.1 and package `@nextsystems/oac` 0.7.1. Commit `5881767` is titled "reconcile all manifests to single version 1.1.0" — `VERSION`; `git show main:VERSION`; `git show main:package.json`.
- CHANGELOG has `[Unreleased]` (a security advisory only), then `[0.7.1] - 2026-01-30`. It has no 1.0 or 1.1 entries — `CHANGELOG.md`.
- Tags and dates: v0.0.1 2025-11-26, v0.1.0 2025-12-08, v0.3.1–v0.3.2 2025-12-09, v0.3.3 2025-12-14, v0.5.0 2025-12-18, v0.5.2 2026-01-17, v0.5.5 2026-01-27, v0.7.0 2026-01-29, v0.7.1 2026-01-30. There are no tags after that — `git tag` with dates. The first commit is 2025-08-14, and the repo has 272 commits on the current history. The last commit on `main` is 2026-07-15 (#305) — `git log`.
- Three automated "chore: bump version to v0.7.2" PRs (#333, #335, #337) are open and unmerged — `gh pr list`.
- npm: `npm view @controlstack/oac` returns 404. `@nextsystems/oac` is at 0.7.0 (modified 2026-01-29) — commands run 2026-10-16. The README Quick Start's "recommended" path is `npm i -g @controlstack/oac` — `README.md` Step 1.
- Repo stats: 4,910 stars, 406 forks, 42 open issues, 29 open PRs. Many are community PRs: an OpenClaw adapter (#347), MiniMax M3 (#345, #324), a Nix flake (#314), a Windows installer fix (#312) and a TDD enhancement (#300) — `gh repo view`; `gh pr list`.
- README dead or incorrect references: `/oac:setup`, `/oac:plan`, `FIRST-TIME-SETUP.md`, `QUICK-START.md`, and "9 workflow skills" — see section 2. `integrations/claude-code/README.md` describes directories that do not exist.
- The memory note says the repo's `agent-metadata.md` wrongly claims OpenCode rejects unknown frontmatter, and that 34 stale `agent-metadata.json` mentions remain in shipped agent prompt bodies — user auto-memory `opencode-tolerates-unknown-frontmatter`, `canonical-build-deferred-decisions`.

### Inferences
- **(opinion)** Release cadence was rapid from November 2025 to January 2026 (10 tags in about 9 weeks). It has paused since, with work moved to a long-running refactor branch (PR #342 open since around July 2026). Outsiders see a project whose last release is about 8.5 months old.

### Gaps
- I could not see the GitHub Project board referenced by ROADMAP.

## 6. Gaps, rough edges, tech debt

### Takeaway
The biggest competitive gaps are no Codex, Gemini CLI or Cursor target, no AGENTS.md output, and skills that are neither canonical nor portable across hosts. Approval enforcement is prompt-level only, behavioral evals are dormant, and the npm package is unpublished.

### Cited Findings
- **Missing tool targets:** only `opencode` and `claude-code` exist in `BUILD_TARGETS`, and only `claude` exists in `APPLY_TARGETS`. There is no Codex CLI, Gemini CLI, Cursor (removed), Windsurf (removed), Copilot or Aider target — `BuildPipeline.ts:77`; `apply.ts:27`. A community OpenClaw adapter is an open, unmerged PR (#347).
- **AGENTS.md:** the repo root has no `AGENTS.md` or `CLAUDE.md`, and no code emits AGENTS.md. `oac apply` emits only `CLAUDE.md`, from one agent — `find . -name AGENTS.md`; `apply.ts`.
- **Agent Skills (SKILL.md) compatibility:** the Claude plugin skills use `name`/`description` frontmatter plus Claude-specific `context: fork` and `agent:` keys. The OpenCode skills add non-standard `version`, `author` and `type` keys. Skills sit in three places (`plugins/claude-code/skills`, `.opencode/skills`, `.opencode/skill`), and the 12 Claude skills have no OpenCode counterparts — the files cited in section 2.
- **Partial canonicalisation:** commands, skills, tools, plugins and context are outside `content/`. `eval-runner` is hand-placed. The Claude target is staged rather than emitted, with stale comments and a skipped golden test even though the output is now identical — sections 1–2.
- **FIXMEs and TODOs in code:** `CapabilityMatrix.ts:319` ("FIXME(2026-07-15): this row describes a concept that does not exist"); `server-manager.ts:38-39` and `client-manager.ts:112` (eval SDK TODOs). There were no other TODO, FIXME or HACK hits in the CLI, compat-layer src, scripts, installers or bin — grep run.
- **Install friction:** OAC requires OpenCode CLI, Node 20+, Git, and `jq` for the shell installer — `README.md` Prerequisites; `install.sh:231`. It has two parallel install systems (the bash `install.sh`/`update.sh` and the `oac` CLI), plus a third for Claude context (`install-context.ts`, sparse git clone), each with its own profile vocabulary — sections 3 and 5. Removing `install.sh` and the committed generated trees is planned as "Stage 6" and has not happened — user memory `canonical-build-deferred-decisions`.
- **Repo hygiene:** `.env` files exist on disk at the repo root, `.opencode/plugin/.env` and `.opencode/tool/.env`. None are git-tracked (`git ls-files` returns nothing). `.tmp/` artifacts; `agent-validator.ts.disabled`; `post-merge.yml.disabled`; nested `_archive/_archive` eval folders; many status-style markdown files in `evals/` (e.g. `GROK_TEST_RESULTS.md`, `PRODUCTION_READINESS_ASSESSMENT.md`) — `ls -la`; `find .opencode`; `ls evals`.
- **Security posture on Claude Code:** the coder-agent edit scope is widened by design, and its deny globs are only advisory unless the user copies the settings by hand — `CHANGELOG.md` [Unreleased]; `RECOMMENDED-PERMISSIONS.md`.
- **Hard-coded, dated model IDs** in npm scripts (`claude-3-5-sonnet-20241022`, `gpt-4-turbo`) — `package.json`.
- **Test coverage (positive):** 553 compat-layer and 226 CLI unit tests pass locally. Installer e2e and five profile smoke tests pass in CI on ubuntu and macOS — section 4.

### Inferences
- **(opinion)** Versus 2026 competitors that target several hosts (AGENTS.md, Agent Skills, multiple CLIs), OAC's distinctive assets are its curated context library, its scout-based discovery pattern and its permission-aware canonical build with fail-closed degradation. Its weak points are host breadth, portability of skills and commands, verified behavioral quality, and the gap between README claims and the code.
- **(opinion)** The capability-matrix and last-match-wins permission model in `packages/compatibility-layer/src/core/Capabilities.ts` is a reasonable base for adding Codex or Gemini CLI targets. The documented blocker is that binary-permission hosts cannot express scoped rules ("There is no correct emission"), and that will recur on any host without glob permissions — user memory `canonical-build-deferred-decisions`.

### Gaps
- The `.env` files are untracked. I deliberately did not read their contents.
- I did not audit `docs/architecture/canonical-refactor/*` (13 spec documents) line by line against the code.
