# OpenAgentsControl: issue and PR triage (2026-10-16)

Scope: all 125 issues (42 open, 83 closed) and all 29 open PRs in `darrenhinde/OpenAgentsControl`, pulled read-only with `gh`. I compared each item against `refactor/canonical` (draft PR #342, 47 commits ahead of main, 341 files changed, +41k/-51k). Nothing on GitHub or in either checkout was modified.

Labels used in the "vs refactor" column:
- **fixed by refactor**: the refactor removes the cause. Example: the npm CLI does no path rewriting and has no jq dependency.
- **made obsolete**: the refactor deletes the thing the issue is about.
- **still applies**: the bug or request is unaffected by the refactor.
- **unknown**: can't be decided without a repro.

"Fixed by refactor" only counts for users who install through `@controlstack/oac`. `install.sh` and `update.sh` are **unchanged** on the refactor branch, and the README still sends people to them.

## Headline findings

1. **#349 is a live blocker, and the refactor carries it forward.** Twelve canonical agents in `content/agents/**` still put `"*": "deny"` last. Affected: build-agent (bash and task), test-engineer, context-manager, task-manager, documentation, context-organizer, workflow-designer, and five planning agents (adr-manager, architecture-analyzer, contract-manager, prioritization-engine, story-mapper). The refactor's own spec (`03-adapter-specs.md` §0.5, `10-PRECEDENCE-EXPERIMENT.md`) confirms OpenCode uses last-match-wins, so under that rule these blocks deny everything, and OpenCode also hides the tool from the model. PR #354 fixes only 7 files, misses the 5 planning agents, and edits generated files that `oac build` would overwrite.
2. **OpenCode v2 is the new top-level risk (#362, #367, #353; #349 and #316 get worse on newer versions).** Neither main nor the refactor declares a supported OpenCode version. `.opencode/plugin/*.ts` still uses `@opencode-ai/plugin` v1. The nested `.opencode/agent/<category>/` layout is the likely cause of the wrong names in the v2 Shift+Tab agent switcher (#362). `.opencode/tool/index.ts` still re-exports gemini/env helpers, which crashes `ToolRegistry` on OpenCode 1.14.49 and later (PR #316). That bug is still on the refactor.
3. **Installer drift is the most frequent closed-issue pattern, with 14 closed and 6 open.** The "Could not find path" family keeps returning: #23, #64, #90, #103, #157, #251, #257, #322, and #237 (still open). The refactor's generated `registry.json` and its drift gate address the cause structurally. But the legacy `install.sh` stays the documented install path until the README changes.
4. **The local-vs-global context confusion is a long-running regression (#96, #175, #177, #255, then #321 and #310 open).** Root cause of #321: `install.sh:1196-1201` runs `sed` over every installed file and rewrites `.opencode/context` to the install directory. On a global install this turns `/add-context`'s *local default* line into the global path. The new CLI does no rewriting (no `.replace` in `packages/cli/src/lib`), so CLI installs are fixed. `install.sh` installs are not.
5. **Bot noise.** 31 closed issues plus #289 and #293 come from the auto-sync docs workflow. Three identical version-bump PRs (#333, #335, #337) target v0.7.2, while the refactor reconciles every manifest to 1.1.0. `sync-docs.yml` and `post-merge-pr.yml` still exist on the refactor branch.

## Changes since the July audit (`docs/maintenance/PR_AUDIT_2026-07.md`)

- **Merged since the audit:** #301, #302, #305, #309, #325 (visible in main's log). Two audit blockers are also fixed on main: `validate-registry.yml` no longer uses `pull_request_target` and now warns against it, and the `pr-checks.yml` `has-evals` output mismatch is corrected. `SECURITY.md` now documents private advisories, which answers #327.
- **Audited PRs still open (13), status unchanged:** #195, #295, #296, #297, #298, #300, #311, #312, #314, #316, #324, #326, #328. The refactor makes most of them worse to rebase. #296 targets the deleted `packages/plugin-abilities`. #297 and #298 are superseded by the generated registry and the new CLI.
- **New since the audit (16 PRs):** #333, #335, #337 (bot bumps), #338 (Dependabot), #342 (the refactor), #343, #345, #347, #348, #354, #357, #358, #359, #363, #364, #365.
- **New issues since the audit:** #346, #349, #350, #353, #361, #362, #367. Three of these concern OpenCode v2 and one is a user asking for Cursor back.
- **Audit point now resolved in a different way:** #324 (MiniMax M3) has a newer duplicate, #345, from the same author with corrected parameters.

## 1. Theme taxonomy (all 125 issues)

| Theme | Open | Closed | Open issues | Closed issues |
|---|---|---|---|---|
| CI / bot noise | 2 | 31 | #289, #293 | #43, #58, #60, #63, #69, #72 … (31 total, all auto-sync) |
| Installer / setup | 6 | 14 | #65, #237, #266, #277, #304, #350 | #17, #18, #23, #64, #70, #90, #103, #157, #224, #251, #257, #287, #308, #322 |
| Framework roadmap (skills/abilities/plugins) | 7 | 4 | #29, #33, #53, #137, #138, #139, #142 | #37, #270, #271, #272 |
| Context system | 5 | 5 | #120, #165, #199, #310, #321 | #12, #96, #175, #177, #255 |
| Docs / positioning / questions | 3 | 7 | #54, #121, #283 | #2, #11, #14, #15, #84, #115, #352 |
| Model / provider errors | 4 | 3 | #135, #236, #258, #317 | #16, #166, #234 |
| New adapters / targets | 4 | 3 | #36, #206, #346, #361 | #34, #35, #141 |
| Spam / off-topic | 3 | 2 | #273, #278, #282 | #276, #315 |
| OpenCode v2 compatibility | 3 | 0 | #353, #362, #367 | - |
| Evals | 2 | 1 | #32, #222 | #31 |
| OpenCode upstream breakage | 0 | 6 | - | #39, #78, #204, #285, #299, #307 |
| Permissions | 1 | 3 | #349 | #140, #164, #268 |
| Agent definitions / delegation | 0 | 4 | - | #19, #38, #80, #192 |
| Claude Code plugin | 1 | 0 | #281 | - |
| Security | 1 | 0 | #327 | - |

Notes on the themes:
- **OpenCode v2-related open issues: #349, #353, #362, #367.** #349 is about current OpenCode permission semantics rather than v2 specifically, but it gets worse on v2. Upstream OpenCode breakage was a theme before v2 too: 6 closed issues, plus PR #316's 1.14.49 crash.
- **Severity counts across the 42 open issues:** 1 blocker (#349), 5 high (#237, #321, #327, #362, #367), 13 med, 23 low. About half of the open issues are roadmap epics or questions rather than bugs. The tool-barrel crash fixed by PR #316 has no issue of its own and should get one.
- **Status vs refactor:** 22 still apply, 9 made obsolete, 8 fixed by refactor, 3 unknown.

## 2. Per open issue (42)

| # | Title | Theme | Sev | User impact | Likely root-cause area | vs refactor | v2 |
|---|---|---|---|---|---|---|---|
| #29 | feat: Skills | Framework roadmap (skills/abilities/plugins) | low | Feature request: skills-as-tools; largely overtaken by OpenCode-native skills and the CLI. | concept / packages/plugin-abilities (deleted on refactor) | made obsolete | no |
| #32 | Improve eval framework with multi-prompt support | Evals | low | Maintainer tracking item for multi-prompt evals; PR #52 created long ago. | evals/framework | unknown | no |
| #33 | Add Skills/Abilities system to OpenCode | Framework roadmap (skills/abilities/plugins) | med | Abilities plugin is the most-requested feature (7+ participants); prototype deleted on refactor, moving to its own repo. | packages/plugin-abilities (deleted by cce5255) | made obsolete | yes |
| #36 | General AI coding tool compatibility layer | New adapters / targets | low | Umbrella vision for multi-tool support; now partly delivered by compatibility layer. | packages/compatibility-layer | fixed by refactor | no |
| #53 | [FEATURE] Integrate PocketFlow (TypeScript) for Enhanced Multi-Agent Workflows | Framework roadmap (skills/abilities/plugins) | low | PocketFlow integration idea; maintainer said 'plugin'. | concept | still applies | no |
| #54 | [FEATURE] Add Documentation for Integrating Spec-Kit with OpenAgents | Docs / positioning / questions | low | Docs request for Spec-Kit/OpenSpec workflow. | docs/ | still applies | no |
| #65 | Recommended way to include a custom system folder? | Installer / setup | low | How to scope a generated system to one project; custom-install target confusion. | install.sh custom dir / system-builder | still applies | no |
| #120 | Clarify .opencode/context/ runtime discovery and per‑agent skill permission handling in /build-context-system | Context system | low | Question: is .opencode/context auto-injected? Answered (no; ContextScout). | docs / context-system | still applies | no |
| #121 | Just a question about opencode + OAC while using plugins. | Docs / positioning / questions | low | Question about third-party plugin compatibility; answered. | n/a | still applies | no |
| #135 | how to choose models for each agent and subagent? | Model / provider errors | med | Users can't figure out per-agent model config; weaker models (DeepSeek) don't delegate. | agent frontmatter `model:` docs | still applies | no |
| #137 | Build configurable plugin system for custom behaviors and efficiency | Framework roadmap (skills/abilities/plugins) | low | Maintainer epic for plugin architecture; largely superseded by the canonical build + Claude plugin. | plugins/, packages/ | made obsolete | no |
| #138 | Create system for integrating with external tools to save/load context | Framework roadmap (skills/abilities/plugins) | low | Epic: external context adapters (Notion, Confluence...). | concept | still applies | no |
| #139 | Improve task management system with plugin support and concurrent execution | Framework roadmap (skills/abilities/plugins) | low | Epic: task-management concurrency/CLI. | .opencode/skills/task-management | still applies | no |
| #142 | Enhance distribution system with npm packages and marketplace | Framework roadmap (skills/abilities/plugins) | low | Epic: npm distribution + marketplace; npm half delivered by @controlstack/oac. | packages/cli | fixed by refactor | no |
| #165 | [FEATURE] Transition from Single decisions-log.md to ADR-style Index + Individual Records | Context system | low | Proposal: ADR index instead of single decisions-log.md. | .opencode/context/project-intelligence, adr-manager | still applies | no |
| #199 | [FEATURE]  | Context system | low | Proposal: long-context memory package (ai-books MCP). | concept | still applies | no |
| #206 | OAC Package Refactor: Multi-IDE CLI with Community Registry | New adapters / targets | med | Epic for the npm CLI + multi-IDE refactor; this IS refactor/canonical (minus Cursor/Windsurf). | packages/cli, packages/compatibility-layer | fixed by refactor | no |
| #222 | [BUG] Default eval model does not exist but the eval suite still runs in full. | Evals | med | Default eval model `opencode/grok-code` no longer exists and the suite reports success anyway. | evals/framework/src/sdk/test-runner.ts:174 (default model) + no unavailable-model fail-fast | still applies | no |
| #236 | [BUG] Gate-skipping behaviour with certain models like Kimi K2.5 | Model / provider errors | med | Approval gates skipped by fast/no-thinking models (Kimi K2.5); safety promise broken. | prompt-only gates in agents/commands (e.g. /add-context) | still applies | no |
| #237 | [BUG] Install fails (CachyOS, fish) | Installer / setup | high | Fresh installs report 'Could not find path' (8 agents in custom mode; paths.json). 6+ users hit it. | install.sh resolve_component_path / registry drift | fixed by refactor | no |
| #258 | GPT is incredibly slow when searching/finding OpenAgentsControl context | Model / provider errors | med | GPT models take 10+ min in ContextScout discovery; OAC slower than plain plan/build. | contextscout.md prompt + context navigation tree | still applies | no |
| #266 | Ask For Help: Clean uninstallation guide | Installer / setup | med | No uninstall path or install manifest; users afraid to try it. | install.sh (no manifest); CLI has manifest | fixed by refactor | no |
| #273 | GNAP: git-native task coordination for OpenAgents Control's multi-language agent workflows | Spam / off-topic | low | Unsolicited GNAP protocol promotion. | n/a | made obsolete | no |
| #277 | [BUG] missing ~/.config/opencode/config/agent-metadata.json | Installer / setup | low | Docs reference ~/.config/opencode/config/agent-metadata.json that global installs never create. | agent-metadata sidecar (retired on refactor by 5c7d4cc) | made obsolete | no |
| #278 | 🤖 Connect your agent to MEEET STATE — earn $MEEET on Solana | Spam / off-topic | low | Crypto token spam (MEEET). | n/a | made obsolete | no |
| #281 | [BUG] Claude Code plugin not working | Claude Code plugin | med | README tells Claude Code users to run /oac:setup which doesn't exist; first-run fails. | README.md:207 `/oac:setup --core`; plugins/claude-code | still applies | no |
| #282 | Integration: Control 707+ MEEET World agents via OpenAgentsControl | Spam / off-topic | low | Crypto spam (MEEET), duplicate of #278. | n/a | made obsolete | no |
| #283 | [BUG] it's not disclosed that this framework is tied to JS frontend development | Docs / positioning / questions | low | README says 'any language' but bundled UI/workflow context is JS/web-centric. | README.md; context/ui, development/frontend | still applies | no |
| #289 | 🤖 Auto-sync documentation with registry | CI / bot noise | low | Auto-sync docs bot issue; no action needed. | .github/workflows/sync-docs.yml | made obsolete | no |
| #293 | 🤖 Auto-sync documentation with registry | CI / bot noise | low | Auto-sync docs bot issue; duplicate of #289. | .github/workflows/sync-docs.yml | made obsolete | no |
| #304 | [BUG] Windows installation failed. | Installer / setup | med | Windows (no jq) install fails immediately. | install.sh check_dependencies (jq hard dep) | fixed by refactor | no |
| #310 | ContextScout No .opencode/context/ directory exists | Context system | med | ContextScout reports 'No .opencode/context/ directory exists' in monorepos / partial installs. | contextscout.md discovery + incomplete dependency install + path rewrite (see #321) | unknown | no |
| #317 | [BUG] Error when using cerebras models | Model / provider errors | med | Cerebras rejects `reasoning_content` in replayed assistant messages when ContextScout runs. | OpenCode provider transform (upstream), not OAC | still applies | no |
| #321 | /add-context writes to global path instead of project-local by default | Context system | high | /add-context writes project intelligence to the global dir; --global is a no-op on global installs. | install.sh:1196-1201 sed rewrites `.opencode/context` → install dir in every installed file | fixed by refactor | no |
| #327 | Security contact request for CI/CD workflow report | Security | high | Researcher has an undisclosed CI/CD vulnerability report and wants a private channel. | .github/workflows (privileged workflow already fixed on main); SECURITY.md exists | unknown | no |
| #346 | Proposal: OpenClaw adapter for the compatibility layer | New adapters / targets | low | Proposal for OpenClaw adapter (PR #347). | packages/compatibility-layer | still applies | no |
| #349 | permission rules ending in "*": "deny" hide the tool entirely under current opencode | Permissions | blocker | Subagents with trailing `"*": "deny"` have bash/task silently removed: BuildAgent, TestEngineer, TaskManager etc. cannot do their job. | permission blocks in 12 agents (content/agents/** on refactor, .opencode/agent/** on main) | still applies | yes |
| #350 | [BUG] not documentation .Building location | Installer / setup | low | Advanced profile prints '.Building/ (manual download required)' with no docs. | registry.json profiles.advanced.additionalPaths; install.sh | fixed by refactor | no |
| #353 | opencode 2.0 codemode | OpenCode v2 compatibility | med | Asks whether OAC will adopt OpenCode 2.0 codemode; signals project inactivity concerns. | roadmap | still applies | yes |
| #361 | [FEATURE] Cursor Adapter Support | New adapters / targets | med | Cursor support was dropped on the refactor; a user asks for it back. | packages/compatibility-layer (Cursor adapter removed by a23a297) | still applies | no |
| #362 | bug: OpenCode v2 profile names are displayed in the wrong order and include directory names | OpenCode v2 compatibility | high | On OpenCode v2 the Shift+Tab agent switcher shows directory names and wrong order for primary agents. | nested .opencode/agent/<category>/ layout; v2 derives agent ids from path | still applies | yes |
| #367 | [FEATURE] OpenCode v2 compatibility: port AbilitiesPlugin to the v2 plugin API | OpenCode v2 compatibility | high | v1 plugins don't load on OpenCode v2; OAC declares no supported OpenCode version. | .opencode/plugin/*.ts (@opencode-ai/plugin v1), plugin-abilities; no COMPATIBILITY matrix | still applies | yes |

## 3. Duplicates, clusters and closable noise

**Close now (no information lost):**

| Issue(s) | Why |
|---|---|
| #289, #293 | Auto-sync docs bot issues, identical to the 31 already closed. Also disable or retarget `sync-docs.yml`: with a generated `registry.json`, component counts should come from `oac build`, not from an LLM-driven issue. |
| #278, #282 | Crypto spam from the same account (MEEET). |
| #273 | Unsolicited protocol promotion (GNAP). |
| #277 | Asks about the `agent-metadata.json` sidecar, which the refactor retires (5c7d4cc). Close with a pointer to the canonical `oac:` frontmatter block. |
| #327 | Point the reporter to `SECURITY.md` and GitHub private advisories. The likely finding, the privileged `pull_request_target` workflow, is already fixed on main. Close once a private advisory is opened. |
| #120, #121 | Questions already answered by the maintainer. |
| #29, #137 | Superseded by #33 (abilities, now moving to a separate repo), OpenCode-native skills, and the canonical build. |

**Duplicate clusters (keep one canonical issue):**

| Cluster | Keep | Fold in |
|---|---|---|
| Local vs global context paths | #321 | #310 (partly), #65; historical #96, #175, #177, #255 |
| OpenCode v2 compatibility | #367 (rename it to an umbrella "Support OpenCode v2") | #362, #353; PR #316's crash (needs an issue) |
| Install "Could not find path" | #237 | historical #23, #64, #90, #103, #157, #251, #257, #322 |
| Multi-tool or new targets | #206 (the refactor epic; close it when #342 lands) | #36, #142 (npm half), #346 (OpenClaw), #361 (Cursor) |
| Model capability and behaviour | #236 | #258 (GPT slowness), #135 (weak models don't delegate), #317 (Cerebras, upstream) |
| Evals default model | #222 | PR #311 |
| MiniMax | PR #345 | PR #324 (close) |
| Version bump bot | none | PRs #333, #335, #337 (close all three) |
| Roadmap epics | #33, #139, #138 | #53, #54, #165, #199 (convert to Discussions) |

## 4. Per open PR (29)

Conflict risk compares each PR's files with `git diff --name-status main...refactor/canonical`. The refactor rewrites, generates or deletes `.opencode/agent/**`, `registry.json`, `packages/compatibility-layer/**`, `packages/cli/**`, `packages/plugin-abilities/**` (deleted), version manifests and four workflows. It leaves `install.sh`, `update.sh`, `evals/framework/src/sdk/*` and `.opencode/tool/**` alone.

Recommendation counts: close 17, rebase onto refactor 7, supersede 3, merge 2 (#342 itself, and #354 on main with a follow-up port).

| PR | Title | What it does | Age | CI | Conflict risk w/ refactor | Recommendation | Why |
|---|---|---|---|---|---|---|---|
| #195 | Auto-migration to Cloud | Mixed bag: a Django project, CI edits, eval server tweaks, stray files. | 8 mo | FAILURE (3 fail/1 pass) | high (CONFLICTING; deletes/edits files refactor rewrites) | **close** | Unrelated Django scaffold, stray files, eval tweaks; failing CI; not an OAC feature (audit agreed). |
| #295 | feat(skills): add git worktree management skill | Adds a git-worktree skill (create/remove/list/ports, Zellij). | 7 mo | SUCCESS | low (new .opencode/skills/ dir only, but skills must be registered via canonical build) | **close** | Audit flagged forced worktree deletion, Docker volume removal, hidden script execution; resubmit as a content/ skill after the refactor if wanted. |
| #296 | fix(plugin): register skills/commands in plugin.json and harden plugin-abilities | Registers skills/commands in plugin.json, hardens plugin-abilities executor, renames external-scout. | 7 mo | SUCCESS | high (7 of 12 files deleted on refactor) | **supersede** | Its plugin-abilities half targets a package the refactor deletes; plugin.json skills/commands arrays unnecessary (Claude Code auto-discovers). Salvage only the README command-name fix for #281. |
| #297 | fix(install): resolve custom install failures and missing agent-metadata | install.sh custom-mode fixes + hand registry edits + agent-metadata entry. | 7 mo | SUCCESS (registry only) | high (registry.json is generated on refactor) | **close** | Superseded: registry.json is now generated, agent-metadata sidecar retired, custom-install plural fix already on main; CONFLICTING. |
| #298 | feat(cli): OAC CLI package — npm-based install, update, and management | Earlier npm CLI branch (@nextsystems/oac) with 8 commands + planning docs. | updated 2 mo ago; created 7 mo | SUCCESS (1 check) | high | **close** | Superseded by refactor/canonical's @controlstack/oac CLI (tiered installs, manifest, doctor). 34 of 67 files are rewritten/deleted by the refactor; CONFLICTING. |
| #300 | 🚀 TDD Enhancement: Comprehensive Test-Driven Development for OAC | Mandatory TDD rules in coder/opencoder + model-router skill. | 6 mo | SUCCESS (1 check) | high (22 files rewritten/generated on refactor) | **close** | Edits 20+ generated agent files directly; audit flagged unsafe registry-driven writes and language-specific TDD as universal. Ask author to resubmit language-neutral TDD guidance as content/ changes. |
| #311 | fix: default SDK eval model fallback to grok-code-fast | Changes eval default model fallback to grok-code-fast. | 6 mo | SUCCESS (1 check) | low (evals/ untouched by refactor) | **supersede** | Right problem (#222) but swaps one stale free model for another and leaves the false-success behaviour; fix both in one maintainer PR. |
| #312 | fix: auto-install installer deps on Windows | Windows auto-install of jq/curl in install.sh. | 6 mo | SUCCESS (1 check) | low (install.sh unchanged on refactor) | **close** | Silently installs host software via winget/scoop/choco from an installer; install.sh is legacy and the Node CLI removes the jq dependency (fixes #304 differently). |
| #314 | feat(nix): add native flake support with automated lock updates | Nix flake, home-manager module, flake.lock auto-update workflow. | 5 mo (rebased Oct 12) | none reported | low (README only) | **close** | Nix flake + home-manager module duplicates installer logic and adds an auto-commit workflow; high maintenance; revisit as community package after @controlstack/oac ships. |
| #316 | fix(tool): empty .opencode/tool/index.ts barrel to unblock opencode 1.14.49 | Empties tool barrel to fix ToolRegistry crash; also rewrites agents, profiles, evals. | 5 mo | SUCCESS (1 check) | high for agent files; none for tool/index.ts | **supersede** | Keep only the .opencode/tool/index.ts barrel removal (real crash on OpenCode >=1.14.49, still present on refactor); drop the 40+ agent/eval edits. |
| #324 | feat: upgrade MiniMax default model to M3 | Adds MiniMax-M3 to model-behaviors + prompt variant. | 4.5 mo | SUCCESS | low | **close** | Duplicate of #345 (same author, same M3 change); #345 is the newer, more accurate version. |
| #326 | fix: prevent path transformation for standard global install location | Skips sed path transform for ~/.config/opencode installs. | 3.5 mo | SUCCESS (1 check) | low (install.sh unchanged on refactor) but legacy target | **rebase onto refactor** | Correct diagnosis of #321 but audit found it breaks global dependency paths; better fix is to stop rewriting the local-default lines (or retire install.sh in favour of the CLI, which doesn't rewrite). |
| #328 | fix(update): skip unmanaged local files silently, consolidate find loops | update.sh rewrite: silent skip on 404, single find. | 3.5 mo | SUCCESS (1 check) | med (CONFLICTING with #309 already merged) | **close** | Treats network failures as 'local-only' and removes safe restore (audit); CONFLICTING; update.sh is legacy vs `oac update`. |
| #333 | chore: bump version to v0.7.2 | Automated version bump. | 3 mo | none | high (VERSION/package.json/CHANGELOG all changed on refactor) | **close** | Bot version-bump to v0.7.2; three identical PRs; refactor reconciled all manifests to 1.1.0. |
| #335 | chore: bump version to v0.7.2 | Automated version bump. | 3 mo | none | high | **close** | Duplicate of #333. |
| #337 | chore: bump version to v0.7.2 | Automated version bump. | 3 mo | none | high | **close** | Duplicate of #333. |
| #338 | ci: bump the github-actions group across 1 directory with 5 updates | Bumps checkout v7, setup-node v7, github-script v9, upload-artifact v7, dependency-review v5. | 3 mo (Dependabot-refreshed Oct 6) | SUCCESS (73 pass) | med (4 workflow files modified on refactor) | **rebase onto refactor** | Useful (actions major bumps), CI green, but touches 4 workflows the refactor rewrites; let Dependabot regenerate after #342 lands. |
| #342 | feat: canonical component build system — one file per component, generated outputs, drift gate | Canonical content/ → generated .opencode/ + registry.json, pnpm, @controlstack/oac. | draft; updated 1 mo | FAILURE (3 fail/24 pass) | n/a | **merge** | This is the refactor itself; fix the 3 failing checks, then land it before processing the rest. |
| #343 | fix(ClaudeAdapter): strip surrounding quotes from scalar frontmatter values | Strip quotes from scalar frontmatter values in ClaudeAdapter. | 3 mo | none reported | med (ClaudeAdapter.ts + test modified on refactor) | **rebase onto refactor** | Bug is real and still present on refactor (ClaudeAdapter.parseFrontmatter line ~539 strips quotes only in arrays); ClaudeAdapter was retargeted so re-apply on refactor. |
| #345 | feat(minimax): add M3 and correct M2.7 parameters | MiniMax-M3 + corrected M2.7 params, extends ModelBehavior. | 2.5 mo | FAILURE (4 fail/6 pass) | low | **rebase onto refactor** | Keep this one of the MiniMax pair; fix its 4 failing checks and verify vendor numbers; evals/ and prompts are untouched by refactor so rebase is easy. |
| #347 | feat(compatibility-layer): add OpenClaw adapter with non-degrading permission mapping | OpenClaw adapter with non-degrading permission index. | 2 mo | none reported | high (5 deleted + 9 modified files) | **rebase onto refactor** | Targets files the refactor deletes (TranslationEngine, AdapterRegistry, cli/*); product decision needed first (refactor just dropped Cursor/Windsurf). If accepted, re-implement against the new column-based adapters. |
| #348 | feat(tools): add MiniMax image generation | MiniMax text-to-image tool. | 2 mo | FAILURE (1 fail, 1 cancelled) | med (registry.json generated) | **close** | Adds exports to the tool barrel that already crashes OpenCode (#316) and hand-edits generated registry.json; low demand. |
| #354 | fix: keep wildcard permission denies as fallbacks | Moves `"*": "deny"` before specific allows in 7 subagents. | 1.5 mo | none reported | high (6 of 7 files are generated on refactor; must be ported to content/) | **merge** | Fixes blocker #349 on main today (ordering-only). Follow up: it misses 5 planning agents (adr-manager, architecture-analyzer, contract-manager, prioritization-engine, story-mapper), and the same fix must go into content/agents on refactor or the build regenerates the bug. |
| #357 | feat: Adding local repo override to install.sh | Install from a local clone. | 1 mo | none reported | low | **close** | install.sh --local/--fromlocal is useful for contributors, but the refactor's `oac` CLI/`oac build` is the dev loop now; legacy installer investment. |
| #358 | Fix installer: bash 3.2 compat, arg handling, cycle detection, cleanu… | install.sh bash 3.2 compat, arg handling, cycle detection, traps. | 1 mo | none reported | low | **close** | Empty PR description, unreviewed broad install.sh changes; legacy installer. |
| #359 | fix(registry): add dependencies key to 6 components and break self-dependency cycle | Adds missing dependencies keys, removes a self-cycle. | 1 mo | none reported | high (registry.json generated) | **close** | Hand-edits registry.json, which is generated on refactor (canonical build already backfilled dependency edges, 02fe35b). |
| #363 | fix(installer): harden branch/sed handling and extend package-manager hints | OPENCODE_BRANCH validation, sed escaping, more distro hints. | 2 wk | none reported | low | **rebase onto refactor** | Small, sane install.sh hardening (branch validation, sed escaping); only worth merging if install.sh stays as a supported fallback. |
| #364 | feat(task-cli): machine-verified completion gate (verification blocks + verify command) | Machine-verified task completion (verification blocks + verify command). | 2 wk | none reported | low-med | **rebase onto refactor** | Interesting verification gate for task-cli; touches .opencode/skills and context not owned by the build, but registry entries are generated. Review after #342; also adds a test under the stray .opencode/skill/ dir. |
| #365 | feat(dev-tools): repo-map — ranked code symbol map (ctags/fzf/grep) | ctags/grep ranked symbol map script. | 2 wk | none reported | low | **close** | Standalone repo-map dev script with no agent wiring; out of scope unless tied to ContextScout. |

**Suggested processing order:**
1. Close the noise PRs: #195, #333, #335, #337, #324.
2. Merge #354, then add the 5 missing planning agents on main.
3. Ship a one-file PR that empties `.opencode/tool/index.ts`, salvaged from #316.
4. Port both of those fixes into `content/agents/**` and `.opencode/tool` on `refactor/canonical`.
5. Fix #342's 3 failing checks and land it.
6. Ask Dependabot to rebase #338. Ask the authors of #343, #345, #347 and #364 to rebase onto the new main.
7. Close the legacy-installer PRs (#312, #328, #357, #358) and the PRs superseded by the generated registry (#297, #298, #359), each with a short explanation.

## 5. Closed-issue patterns (83 closed)

| Pattern | Closed issues | Still coming back? | Structural fix |
|---|---|---|---|
| **Registry and installer drift: "Could not find path" / 404 on install.** Registry entries point at files that were renamed or never added. | #23, #64, #90, #103, #157, #251, #257, #322 (8) | Yes: #237 open, and #350 is a cousin (`.Building/` additionalPaths) | Canonical build plus drift gate (refactor commits 33eb6f4, 9ca012e). Deprecate `install.sh`. |
| **Local vs global context location.** Context lands globally, ContextScout can't find it, or `/add-context` writes to the wrong place. | #96, #175, #177, #255 | Yes: #321 and #310 open. #177's fix ("save local first") was undone by the installer's `sed` rewrite. | Remove the path rewrite. Resolve paths at runtime in the agent prompt, not at install time. |
| **OpenCode upstream breaking changes.** Plugins crash on start, config invalid, slash-dispatch crashes, empty stop turns, aborted subagents hang. | #39, #78, #204, #285, #299, #307 | Yes, now at scale with v2 (#362, #367, #353) and the 1.14.49 tool barrel (PR #316) | Declare a supported OpenCode range in `COMPATIBILITY.md`. Add a CI smoke test that boots `opencode` against the generated `.opencode/` for the pinned and latest versions. |
| **OpenCode permission and schema semantics.** `permissions` became `permission`, the `question` tool was hidden, and catch-all ordering is wrong. | #164, #268, #140 | Yes: #349 open (blocker) | Lint in `oac build`: fail when a rule list ends in a `*` rule that contradicts earlier specific rules. |
| **Subagents not delegated or not callable.** | #19, #38, #80, #192 (`skill/` vs `skills/`) | Partly: #135 comment (DeepSeek), and both `skill/` and `skills/` still exist under `.opencode/` on the refactor | Single `skills/` dir. Delegation evals per model family. |
| **Model compatibility.** Unknown frontmatter rejected (Kimi), responses API, hard-coded models. | #16, #166, #234 | Yes: #236, #258, #317, #222 open | Model-family prompt variants plus eval gates. Document per-agent `model:` overrides (#135). |
| **Agent name case-sensitivity and confusing docs.** | #103, #115 | Partly: #362 (names on v2), #281 (`/oac:setup` doc) | Generate README command and agent tables from the build. |
| **Bot and spam noise.** | 31 auto-sync issues, #276, #315 | Yes: #289, #293, #278, #282, #273, and 3 version-bump PRs | Turn off `sync-docs` issue creation and dedupe `post-merge-pr`. |
| **Duplicate issue filing.** | #270, #271, #272 (same request filed three times) | n/a | Issue-form guidance. |

## 6. Top 10 fixes, ranked by user impact × frequency

| Rank | Fix | Issues / PRs | Why it ranks here |
|---|---|---|---|
| 1 | **Reorder catch-all permissions** in all 12 affected agents, in `content/agents/**` on refactor and in `.opencode/agent/**` on main. Add an `oac build` lint that rejects a trailing `"*": "deny"` after allows. | #349, PR #354 | Silent loss of bash/task for every user of BuildAgent, TestEngineer, TaskManager and the planning agents. It hides in plain sight. |
| 2 | **OpenCode v2 support pass.** Declare a supported range. Port or drop the v1 `.opencode/plugin/*.ts`. Fix agent naming and ordering, either by flattening `.opencode/agent/<cat>/` or by checking how v2 derives ids. Add a boot smoke test in CI. | #367, #362, #353 | The whole user base is moving to v2. Today, compatibility is only discovered when something breaks. |
| 3 | **Remove the `.opencode/tool/index.ts` barrel re-exports.** The fix is one file. | PR #316 (split), PR #348 (close) | Crashes the first prompt on OpenCode 1.14.49 and later ("Unexpected server error"). Still present on the refactor. |
| 4 | **Land refactor/canonical and switch the README to `npm i -g @controlstack/oac`.** Deprecate or freeze `install.sh` and `update.sh`. | #342, #206, #237, #304, #266, #350, #321 (CLI path) | The single highest-frequency complaint category (20 issues), fixed structurally by a generated registry, a manifest and no jq dependency. |
| 5 | **Fix the local/global context path.** Remove the `sed` rewrite in `install.sh:1196-1201`, or at least skip the add-context and context-paths lines, for anyone still on the script. Verify ContextScout's local-first lookup in monorepos. | #321, #310, PR #326 | Project intelligence silently lands in the user's global config, which breaks team sharing. Reported repeatedly since January. |
| 6 | **Fix the Claude Code onboarding docs.** README line 207 says `/oac:setup --core`, but the real skill is `oac:context-setup`. Generate the command list from `plugins/claude-code`. | #281 | Every Claude Code first-run hits it. Cheap to fix. |
| 7 | **Make approval gates robust to fast models.** Use OpenCode `permission: ask` on edit/bash for primaries instead of relying on the prompt alone, and add gate evals for Kimi/GPT/DeepSeek. | #236, #135, #258 | Safety is OAC's core promise, and fast models skip the gates. |
| 8 | **Fix evals false success.** Fail fast when the model is unavailable and pick a current default model. | #222, PR #311 | CI and evals results can't be trusted while an unavailable model still produces a passing run. |
| 9 | **Cut bot noise.** Disable sync-docs issue creation, dedupe the version-bump PR workflow, and close #289, #293, #333, #335 and #337. | #289, #293, PRs #333, #335, #337 | 36+ noise items so far. They bury real reports. |
| 10 | **Decide the targets policy and say it publicly.** Cursor was dropped, OpenClaw is proposed. Publish which adapters are supported and how contributors add one against the new column-based adapters. Rebase #343 (still a real ClaudeAdapter bug). | #361, #346, PRs #347, #343 | Contributors are actively building against APIs the refactor deleted. |

## Caveats

- I didn't run anything. OpenCode v2 behaviour (#362 naming, plugin loading) is inferred from the issue reports plus the repo layout, not reproduced.
- The "fixed by refactor" status assumes users install through `@controlstack/oac`. The legacy scripts are untouched on the refactor branch.
- The PR CI column reflects `statusCheckRollup` at fetch time. Many fork PRs show "none reported" because workflows didn't run for them.
- Machine-readable data is in `research-issues.json`, alongside this file. Closed issues have a theme only; their severity, impact and status fields are null.
