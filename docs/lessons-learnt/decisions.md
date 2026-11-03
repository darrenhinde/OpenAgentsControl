# Product decisions

Format: **Decision** · **Why** · **Rules out** · **Revisit when**. Newest last. All entries below were made by the maintainer on 2026-10-18 unless noted.

---

## D-001 Keep the canonical refactor; ship it before building more

- **Decision:** `refactor/canonical` is the base: one canonical source, a deterministic build, an ordered last-match-wins permission model that denies when unsure, a drift gate, a Node-only CLI and one version. It ships as v1.1.0 after the blocking fixes, before any new features.
- **Why:** the core idea is right, and an 8.5-month release gap plus an "upstream is unmaintained" fork cost more than any missing feature.
- **Rules out:** another long-lived mega-branch; new spec documents before v1.1.0 is tagged.
- **Revisit when:** never for the base. The scope of v1.1 is fixed in the roadmap.
- **Superseded by D-017 (2026-10-21):** the compare-only rule for Claude Code agents (hand-written, only compared against the build; see L-001). The rest of D-001 stands.

## D-002 North star: control

- **Decision:** "OAC keeps you in control of the coding agents on your real projects. You approve what an agent sets out to do, and the tool, not a prompt, enforces your rules on OpenCode, Claude Code and Codex alike. It sets your repo up with lean context that stays current, and proves with tests you can run that your rules hold." See [NORTH_STAR.md](../NORTH_STAR.md).
- **Why:** it is the original mission (plan-first, approval-based execution, code in your patterns, built for OpenCode) made enforceable and portable. Prompts alone don't hold.
- **Rules out:** features that don't serve control, enforcement, context or proof (the four questions in the north star).
- **Revisit when:** the week-8 demand check (D-012) says otherwise.

## D-003 Plan-first and approval stay core

- **Decision:** the user approves the intent once per task, before the first edit (`gates.intent`: block for teams, nudge for solo). On test failure the agent stops, reports and proposes a fix (`verify.on_fail: report` for teams, `fix` available for solo). Host plan mode, a spec from the user's method, or `/oac approve` all count as approval.
- **Why:** an independent mission review found the plan had dropped plan-first and reversed "never auto-fix". Approval asked once and enforced by the tool keeps the promise without per-step latency.
- **Rules out:** approval prompts at every step; silent auto-fixing by default for teams.
- **Revisit when:** `oac report` shows intent approval is mostly rubber-stamped or skipped.

## D-004 Patterns and migration

- **Decision:** `oac init` captures lint, format, test-layout and import conventions without a model (v1.3). v1.1 ships a migration path: `MIGRATING.md`, a frozen `oac-classic` tag of today's agent catalog, and a Discussion post.
- **Why:** "code in your patterns" is today's headline promise, and existing users must not feel abandoned when the catalog shrinks.
- **Rules out:** deleting catalog items without a tagged, documented path.

## D-005 Overlap with other frameworks is fine

- **Decision:** overlapping with Superpowers, spec-kit, BMAD or others is acceptable. Items cut earlier only for overlap move to an optional extras pack instead of being dropped.
- **Why:** the priority is staying structured and shipping steadily, not differentiation for its own sake.
- **Supersedes:** the earlier "don't compete with workflow frameworks" rule from the strategy review.

## D-006 Stay open source under MIT

- **Decision:** keep OAC fully open under MIT. Everything that enforces or proves things on a developer's machine or in their CI stays open forever: the compiler, the gates, `oac init/test/report/verify`, the conformance suite. Paid features, if ever, are limited to multi-repo aggregation (hosted report dashboard, org-wide drift alerts, audit retention, SSO), and not before about 150 public repos use `oac.policy`. Protect the name with a trademark notice, not the code.
- **Why:** it serves both goals, building a community and showing engineering skill. Relicensing moves (HashiCorp, Elastic, Redis) caused forks and lost trust.
- **Rules out:** relicensing, source-available terms, a paid tier in the next 6–12 months.

## D-007 Test first: no scenario, no ship

- **Decision:** the test harness is built before features (v1.2 week 1). Every gate has an attack scenario with a control arm and a benign scenario, and is graded on outcomes (did the secret reach the model?), not host wording. The same scenario runs on every supported host. A gate can't ship until its scenarios pass on every host it claims.
- **Why:** a working proof of concept (fake model + real Claude Code 2.1.301 + OpenCode v2.0.30) blocked a `.env` read 3/3 on both hosts at $0, while the unguarded control leaked. Automatic cross-host testing is cheap and real.
- **Rules out:** claims, README numbers or shipped gates without a test that proves them.

## D-008 Hosts and versions

- **Decision:** OpenCode v2 and Claude Code first, with Codex in v1.5. Support OpenCode v1 and v2 side by side for one release cycle. Pinned host versions on PRs, the latest versions nightly.
- **Why:** v2 broke most of OAC in one release, and v1 is still being released. Nightly tests against the latest hosts catch the next break on day one.
- **Rules out:** chasing host count beyond these three.

## D-009 Keep it simple

- **Decision:** v1.4 ships intent approval, the policy (secrets, destructive commands, scope), the verifier and freshness (warn) only. Size router, impact graph, plan gate and reviewers move to v1.5 as add-ons. Host descriptors move to v1.6+, only for a fourth host. Read-only work uses each host's own plan mode, and the intent gate enforces "no edits before approval".
- **Why:** most users need four things: setup, blocking real risk, no "done" on red tests, and seeing what happened.
- **Rules out:** any feature that hasn't fired usefully in two weeks of dogfooding.

## D-010 Context scout is a setting, off by default

- **Decision:** `context.scout: off | lite | full`, `off` in both profiles until an ablation shows `lite` does no harm at ≤ +15% tokens. The startup hook injects at most 3 lines.
- **Why:** token burn is the top user complaint, and research shows generic context can lower success.

## D-011 Modular structure

- **Decision:** nine modules (`ir`, `policy`, `gates`, `context`, `content`, `hosts`, `observability`, `verify`, `cli`) as folders in one engine package plus the CLI. The gate is the feature unit: one folder copied from `gates/_template/`. Gates never import hosts, and hosts never read the policy, enforced by dependency-cruiser.
- **Why:** it makes it obvious where every feature goes, and adding a host or gate touches one folder.
- **Revisit when:** the second gate doesn't take noticeably less effort than the first.

## D-012 A bounded bet, decided at week 8

- **Decision:** commit to v1.1 and v1.2 (about 8 weeks at about 10 h/week). At week 8, after the `.env` demo ships, continue to v1.3+ only if at least two of these hold: the demo is shared or people ask to use the policy; monthly stars recover towards 400 or npm downloads reach a few hundred a week; 3+ new contributors are merged; teams ask for policy features. Otherwise stop at a well-maintained v1.2 portfolio piece.
- **Why:** demand for enforced guardrails is inferred, not voiced by users.

## D-013 A local test suite with sandboxing

- **Decision:** `pnpm test:local quick | hosts | live | all` runs the whole branch locally and prints a per-area table. Known failures stay visible and tracked. Agent runs use a scrubbed env, a throwaway HOME under `$TMPDIR`, OpenCode `--standalone`, a macOS `sandbox-exec` profile, and fake secrets checked after every run. Strict mode is a container with no network.
- **Why:** test agents must never touch the maintainer's real files, settings, keychain or keys. Two isolation leaks were already found (OpenCode's parent-dir config walk, and the managed background service).

## D-014 `install.sh` can install from a local tree

- **Decision:** add an `OAC_RAW_URL` override to `install.sh` so installer tests can run against the local branch instead of the pushed GitHub branch.
- **Why:** installer e2e tests only ever tested what was already pushed.

## D-015 Guarded, not locked: protecting OAC's own controls

- **Decision:** OAC defends its own flow without making itself hard to work with.
  - **OAC's control files** (`oac.policy`, `.claude/settings.json`, `opencode.json`, `.oac/**`) are *guarded, not locked*. An agent editing them triggers an **ask** with a plain explanation, not a hard deny. Agents can update config through a path the user grants: a dedicated config agent, or a one-time permission. Every change is logged and shown in `oac report`. A hard lock applies only if the user sets it in their policy.
  - **Approval only from a human.** An agent writing `Approved-by:` into its own plan doesn't count. Approval comes from host plan-mode approval or `/oac approve` typed by the user.
  - **Re-approve after a failed test.** In `verify.on_fail: report` mode, a red verifier re-arms the intent gate: report, then approval, then the fix.
  - **Tests can't vanish.** The verifier records how many tests ran. A drop in that count (deleted or skipped tests) counts as a failure unless the user approves it.
- **Why:** the scenario catalogue found that an agent could switch off its own gates, approve itself, auto-fix in report mode, or delete tests to go green. The maintainer wants these limited as far as practical, not made impossible at the cost of usability: "We can't fully guard against it but we should limit it as much as possible… lets not get too strict with permissions, unless stated by the user."
- **Focus:** the main goal is the coding harness and its controlled flow (approve, work in scope, verify, report). Extra permissions serve that flow; they don't replace it.
- **Rules out:** hard-denying config edits by default; anything that blocks normal config work without a clear way for the user to allow it.
- **Revisit when:** `oac report` shows config-edit asks are being rubber-stamped, or a real bypass is reported.

## D-016 OpenCode v2 by default, v1 only on request

- **Decision:** `oac build` compiles the canonical source for both OpenCode versions.
  - **v2 is the default.** The repo's own `.opencode/` and every default install are v2.
  - **v1 is an explicit opt-in.** When a user selects it, the installer writes the full v1 build (agents, context, tools, plugins and everything else v1 needs) into that user's project `.opencode/`. The user's choice is recorded, so later updates keep it.
  - **The in-repo `v1-opencode/` folder is for display only.** It shows what the v1 compile produces and is never installed under that name.
    - *Superseded by D-018 (2026-10-21):* the folder is now `built-ai-configs/opencode-v1/`. It is still never installed under that name.
  - **v1 must be verifiable**, with a concrete check that a v1 install works, not just that it compiles.
- **Why:** v2 broke delegation by name, custom tools and v1 plugins (#362, #367), and v1 users still exist. The maintainer: "if user wants opencode v1 it should be not the default but if they select it then should build the .opencode folder with everything and we should have a way to make sure it works."
- **Rules out:** auto-selecting v1; maintaining v1 beyond the one release cycle set in D-008. The v1 target is built so it can be deleted as one unit.
- **Revisit when:** the v1 support window ends, or v1 usage is negligible.

## D-017 The canonical build generates the Claude Code agents too

Made by the maintainer on 2026-10-20 and 2026-10-21.

- **Decision:** Claude Code agents are generated from `agent-library/agents/**` like every other target. One merged prompt per agent, host-neutral by default.
  - **Per-host frontmatter** goes in `oac.overrides.<host>`: `name`, `model`, `tools` and `description`, including `overrides.claude-code.description` with its `<example>` dispatch blocks.
  - **Per-host body text** goes in `<!-- oac:only <targets> -->` blocks (`src/core/HostBlocks.ts`). An unknown target, an unbalanced marker or a nested block fails the build.
  - **`plugins/claude-code/agents/` is emitted in place**, covered by the drift gate and golden-tested.
  - **A capability lint** (`src/verify/lint/capability.ts`) fails `--strict` on instructions an agent can't carry out: delegation without `Task`, bash without `Bash`, a missing `<example>`, stray `.opencode/` paths.
  - **Approved behaviour differences:** `coder-agent` on Claude marks subtasks done by editing the subtask JSON. `external-scout` on Claude gets `Read`, `Write`, `Glob`, `WebFetch` and no shell, since it fetches untrusted content. OpenCode code agents call ContextScout when standards are missing, not always (consistent with D-010).
- **Why:** the maintainer wanted to "make the most of what we're building" from one source, accepting that behaviour differs per tool. The two prompt sets had diverged too far to keep in sync by hand (L-015).
- **Rules out:** hand-maintained copies of Claude agents; per-host sidecar body files.
- **Revisit when:** a third host (Codex, v1.5 per D-008) needs body differences the block grammar can't express.
- **Amended by D-018 (2026-10-21):** the Claude agents now build into `built-ai-configs/claude-code/agents/`. `plugins/claude-code/agents/` is a byte-identical mirror of that folder, still covered by the drift gate.

## D-018 One committed `built-ai-configs/` folder holds every build output

Made by the maintainer on 2026-10-20 and 2026-10-21.

- **Decision:** `built-ai-configs/<target>/` is the single, committed, browsable build output for every AI tool: `built-ai-configs/opencode/agent/`, `built-ai-configs/opencode-v1/` (agents plus the v1-only commands, plugins, skills and tools) and `built-ai-configs/claude-code/agents/`. A generated `built-ai-configs/README.md` indexes it.
  - **The live paths are mirrors.** `oac build` copies `.opencode/agent/**` and `plugins/claude-code/agents/**` byte for byte from `built-ai-configs/`. They stay because installers already in use read the `built-ai-configs/registry/registry.json` paths (`.opencode/agent/...`), and the Claude marketplace reads `./plugins/claude-code`. `built-ai-configs/registry/registry.v1.json` points into `built-ai-configs/opencode-v1/`.
  - **The drift gate covers `built-ai-configs/` and both mirrors.** A hand edit to a mirror counts as drift, the same as a hand edit to `built-ai-configs/`.
  - **The folder is called `built-ai-configs/`, not `dist/`.** `dist` and `build` are gitignored across the repo, and `dist/` already means throwaway compiled package code.
- **Why:** the maintainer wants people to "quickly look at one folder to look at how it all works": every tool's output side by side, comparable without a build.
- **Rules out:** hand-editing a mirror; a gitignored `dist/` as the build output.
- **Revisit when:** installers read `built-ai-configs/` directly (Stage 6). Then drop the mirrors.

## D-019 Agent naming rules, aliases, category-only folders

Made by the maintainer on 2026-11-03.

- **Decision:** ids follow `docs/architecture/NAMING.md`. An id is kebab-case, equals the file name, is the same on every host, hyphenates run-together words (`context-scout`) and does not repeat the type as a `-agent` suffix. Agents live in `agent-library/agents/<category>/<id>.md`, one folder level, with no `subagents/` folder: primary vs subagent is the `type` field. A rename keeps the old id as `oac.aliases` and a folder move keeps the old path as `oac.previousPaths`; the registry records both as `aliases` / `supersedes`, and installers use them to retire the stale installed file. Retirement is deliberately narrow: only an `.md` file under `.opencode/agent/`, never through a symlink; an untouched OAC-tracked file is removed, an edited/untracked/custom one only if its `description` still equals the bundled one (backed up first), anything else is left with a warning. Five agents were renamed this way: `context-scout`, `external-scout`, `code-reviewer`, `test-engineer`, `doc-writer`.
  - **Legacy exceptions:** `coder-agent` and `build-agent` keep their `-agent` suffix. Their ids are referenced by users' own agents, evals and docs, and an alias cannot protect a name that is also used as free text. The lint reports them as info only.
  - **Aliases resolve** in `permission.task`, structured calls, dependencies and profile lists for OpenCode outputs, and in dependencies and profile lists for Claude Code (its bodies are not rewritten).
- **Why:** three spellings of one agent (`contextscout`, `ContextScout`, `Context Scout`) and a `subagents/` folder that duplicated the `type` field made delegation and installs error-prone. A rename must not break existing installs or leave two copies of an agent in a project.
- **Rules out:** renaming or moving an agent without an alias or `previousPaths`; a `subagents/` folder; renaming `coder-agent` or `build-agent` without a deliberate migration.
- **Revisit when:** the naming lint is promoted to failing, or a second host needs a per-host display name (rule 2).

## D-020 Skills and commands are canonical, compiled content

Made by the maintainer on 2026-11-03.

- **Decision:** skills (`agent-library/skills/<id>/SKILL.md` plus supporting files) and commands (`agent-library/commands/[<group>/]<id>.md`) are source types like agents. Each carries an `oac:` block; `oac build` cuts it out, resolves `oac:only` blocks, rewrites OpenCode delegation examples per major, and writes every host's copy, the live mirrors (`.opencode/skills|command`, `plugins/claude-code/skills|commands`), the registry entries and the ledger. The 17 Claude plugin skills/commands are `targets: [claude-code]`; the OpenCode ones are `[opencode, opencode-v1]`. The two hand-maintained v1 variants (`task-management`, `check-context-deps`) are generated from one source. The singular `.opencode/skill/` folder is dropped; its only real skill, `project-orchestration`, became a canonical skill and its dead tests moved to `docs/history/`.
  - **Skills are flat; commands take at most one group folder** (the two grandfathered `openagents/new-agents` commands are two deep). The group is part of the command's name on OpenCode (`/openagents/check-context-deps`), so it is kept, not normalised.
  - **No `oac.previousPaths` for skills and commands.** The installers retire superseded files only under `agent/`, so a moved skill or command would leave a stale copy. Nothing moved: every installed path is unchanged.
  - **Same-named skills are not merged.** The Claude plugin's `code-review` forks into a plugin agent; no OpenCode skill matches it.
- **Why:** the user wants one set of files with three hosts working (Claude Code, OpenCode v1, OpenCode v2). Skills and commands were the last hand-copied content: `.opencode/skills`, a singular `skill/` with broken paths, a hand-kept v1 copy, and the plugin's own folders, each edited by hand with the registry entries maintained beside them.
- **Rules out:** hand-editing a skill or command under `.opencode/`, `plugins/claude-code/` or `built-ai-configs/`; a `skill/` folder; renaming or moving an installed skill or command without teaching the installers to retire non-agent files first.
- **Revisit when:** the installers learn to retire superseded files outside `agent/` (then `previousPaths` and folder moves become possible, and `openagents/new-agents` can flatten), or `oac apply claude` should also write skills and commands into `.claude/`.

## D-021 Retired files: a registry list, removed by hash

Implemented 2026-11-03 as the least invasive way to clean up the 12 agent-creation files that `oac init --profile full` once copied into `command/openagents/new-agents/`; maintainer to confirm.

- **Decision:** the registries gain an additive top-level `retired: [{path, sha256[], replacedBy?}]`, generated from the hand-maintained `agent-library/retired.json`. `oac update|init`, `install.sh` and `update.sh` remove a leftover file there under the superseded-file containment rules widened from `agent/*.md` to `.opencode/{agent,command,skills}/` (any extension): normalised path, no symlinks, jail check, backup unless the CLI manifest proves it untouched. The match is the SHA-256 of any version a release shipped, not a description. An edited file is left and reported, and `oac doctor` warns about it. `supersedes` is unchanged and stays `agent/*.md` only.
- **Why:** these files are not agents (no frontmatter to compare), 3 are `.md` that OpenCode loads as junk commands, and the old behaviour was to tell users to delete them by hand.
- **Known limits:** `update.sh` still overwrites a user-edited tracked file without a backup (it did before); without `jq` it removes nothing; `oac add` does not retire.
- **Rules out:** deleting an unrecognised file because the registry says so; a retired entry that points at a path a component still ships (the compiler rejects it).

## D-022 The context library is canonical source, copied verbatim

Implemented 2026-11-03 (step 4 of the canonical refactor); maintainer to confirm.

- **Decision:** the context library (275 files and 3 legacy symlinks) moved from `.opencode/context/` to `agent-library/context/`, layout unchanged. `oac build` **copies** it byte for byte to `.opencode/context/` (ledgered, pruned, drift-checked like skills; symlinks are emitted as symlinks) and generates `components.contexts` in both registries from `agent-library/context/components.json`, in that file's order, with no carry-through. There is no `built-ai-configs/<host>/context` copy: `.opencode/context` is the one installed location for OpenCode v1 and v2, and the Claude plugin keeps its directory symlink to it. New report-only lints: dead links, navigation entries pointing at missing files, files not reachable from navigation. `CONTEXT_SYSTEM_GUIDE.md` moved to `docs/guides/context-system.md`.
- **Why:** it was the last hand-edited tree beside the generated ones, and an edit to a context file could silently disagree with the registry. The repo path `.opencode/context/**` is also the distribution endpoint (raw URL for `update.sh`, sparse-clone source for the Claude install scripts, the npm bundle), and `install.sh` rewrites the literal text `.opencode/context` inside files at install time, so the output must be a verbatim copy at that path. See `docs/architecture/CONTEXT-MAP.md`.
- **Deferred on purpose:** the internal re-taxonomy (`core/` into `standards/`, `workflows/`, `system/`; `development/`, `ui/`, `content-creation/` and the stubs into `domains/`). About 1,100 hand-written references, the profile directory globs, user-owned slots (`project-intelligence/`) and the lack of a `supersedes`/`retired` mechanism for context files make a move break installed copies. The exact mapping is in `docs/architecture/CONTEXT.md`.
- **Rules out:** hand-editing `.opencode/context/**`; a registry `contexts` entry written by hand; moving or renaming an installed context file before the installers can retire it.
- **Revisit when:** installers learn to retire or supersede context files (then the re-taxonomy becomes a safe change), or the Claude marketplace is shown not to dereference the `plugins/claude-code/context` symlink (then the plugin needs a real generated copy).

---

## Open decisions

| Decision | Recommendation | Needed by |
|---|---|---|
| npm scope and brand: the GitHub org `controlstack` belongs to "Control Stack Ltd." (2016); ownership of the `@controlstack` npm scope is unconfirmed | Claim the scope if it's yours. Otherwise ship under `@nextsystems/oac` and choose a distinct brand. | v1.1 |
| Context re-taxonomy (D-022): do it after context `supersedes`/`retired` exist, or never | After the installers can retire non-agent files (needed by D-020 as well) | v1.2 |
| #349 permission reorder in v1.1 or v1.2 | v1.1: it's a live bug on v1, under a day of work | v1.1 |
