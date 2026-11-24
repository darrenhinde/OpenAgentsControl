# OpenAgentsControl (OAC): Architecture Map for Planning

Researched 2026-10-16, read-only. Nothing in either checkout was modified, built or installed.

- **Primary subject:** worktree `refactor/canonical` (draft PR #342) at
  `/Users/darrenhinde/Documents/GitHub/MYBUSINESS/worktrees/OpenAgentsControl/refactor-canonical`.
  HEAD is `d7924e4`. It is 48 commits ahead of `main`, and 2 of those commits (`a4c8ab3`, `d7924e4`) exist only locally. They have not been pushed.
- **Comparison:** `main` at `/Users/darrenhinde/Documents/GitHub/MYBUSINESS/OpenAgentsControl` (HEAD `37ca233`).

Paths below are relative to the worktree unless stated otherwise. **(inferred)** marks anything I did not check directly against disk, a running tool or CI output.

---

## 0. TL;DR

- **What OAC is.** A pack of markdown agents, a context library, skills, commands and plugins, plus installers. **OpenCode** is the primary runtime. **Claude Code** is supported through a hand-curated plugin (`plugins/claude-code`) distributed via a marketplace (`.claude-plugin/marketplace.json`). Cursor and Windsurf were dropped on 2026-09-02 (`a23a297`).
- **What is canonical today.** On the branch, only **agents** (`content/agents/**`, 33 files) and **profiles** (`content/profiles/{system,context}/*.json`) are canonical. Context, skills, commands, tools, plugins and hooks are still hand-authored in `.opencode/` and `plugins/claude-code/`.
- **The canonical format is not neutral.** Each canonical agent is *OpenCode frontmatter plus an `oac:` block*. The OpenCode adapter just deletes the `oac:` block as text. The neutral IR described in `00-INDEX`/`02` (the `capabilities:` Option A model, `inference.tier`, `/content/skills|commands|context|hooks`, `packages/core`) was **not built**. It was superseded by a narrower plan, `.tmp/tasks/canonical-build-system/task.json`.
- **Drift gate.** `make check-canonical-drift` covers `.opencode/agent`, `registry.json` and `.oac/build-manifest.json`. It does **not** cover `plugins/claude-code/**`, which is only staged to `.tmp/oac-build/` and compared.
- **The biggest structural risk:** OpenCode's agent and permission format *is* the source of truth. Any OpenCode format change, or any target that differs from it, lands in authored content, not in an adapter.

---

## 1. What OAC is, who uses it, and how it installs

### 1.1 Product

- **README** (`README.md:115-160`): "plan-first development workflows with approval-based execution". The agents are markdown. A context system feeds them project standards, and ContextScout finds the relevant files.
- **Main-checkout planning docs:**
  - `docs/maintenance/REPOSITORY_MANAGEMENT_PLAN.md`: "OpenCode is the primary runtime today. Claude Code support is beta."
  - Primary users: solo developers and team leads.
- **Live users:** about 4.5k GitHub stars (per `07-EXECUTION-PLAN.md` Stage 6). npm `@nextsystems/oac` is at **0.7.0** (verified with `npm view`).

### 1.2 Supported targets

| Target | Status on branch | Where |
|---|---|---|
| OpenCode | First-class; the generated tree is committed | `.opencode/**` (project-local) or `~/.config/opencode` (global, `install.sh:188-198`) |
| Claude Code plugin | First-class in name only: the agents are staged, not emitted in place | `plugins/claude-code/` (manifest `plugins/claude-code/.claude-plugin/plugin.json`, marketplace `.claude-plugin/marketplace.json`) |
| Claude Code via `oac apply claude` | Legacy path. Writes **`CLAUDE.md`** from the *first* loaded agent | `packages/cli/src/commands/apply.ts:100-102` |
| Cursor, Windsurf | Dropped (`a23a297`; `00-INDEX.md` header note) | none |
| `agents-md` target | Planned (07 Stage 3); never built (out of scope per canonical-build-system notes) | none |

### 1.3 Install paths

1. **`install.sh`** (52 KB of bash, `install.sh:1-60`). This is still the shipping and documented path (`README.md:152`, `COMPATIBILITY.md`).
   - **Usage:** `curl … | bash -s <profile>`.
   - **Dependencies:** `curl` and `jq` (`install.sh:227-231`).
   - **What it does:** fetches `registry.json` (from `$REGISTRY_URL`, local `./registry.json`, or raw GitHub at `$OPENCODE_BRANCH`, default `main`), resolves the profile's components, and curls each file into `$OPENCODE_INSTALL_DIR` (default `.opencode`) or `~/.config/opencode`.
   - **Paths:** rewritten from `.opencode/...` to the install dir (`install.sh:352-358`).
   - **Backups:** `${INSTALL_DIR}.backup.<ts>` (`install.sh:1072`).
2. **`update.sh`** (10 KB of bash). Re-curls installed files from raw GitHub (`update.sh:217`). It has no sha256 gating, so user edits are overwritten (index finding #9).
3. **`oac` CLI** (`packages/cli`, private workspace package `@controlstack/oac-cli`, shipped through the root package).
   - **Shim:** `bin/oac.js` re-execs `packages/cli/dist/index.js` on the current Node binary. Bun is no longer needed at runtime (`8581a42`).
   - **Commands:** `init`, `update`, `add`/`remove`, `apply`, `build`, `doctor`, `list`, `status` (`packages/cli/src/index.ts`).
   - **`init`:** copies a profile's files from the package's bundled `.opencode/{agent,command,context,plugin,skills,tool}` (`packages/cli/src/lib/bundled.ts` `BUNDLED_SUBDIRS`) into the project's `.opencode/`. It writes `.oac/manifest.json` (sha256 ledger), `.oac/config.json`, and `.oac.json` `{version:"1", context:{root:".opencode/context"}}` for Claude context discovery (`init.ts:221-237`, `doctor-checks.ts:31`).
   - **`update`:** sha256-gated, so user edits survive unless `--yolo` is passed.
   - **Bun is still a dev dependency:** `"build": "bun build src/index.ts --target node"`, `"test": "bun test"` (`packages/cli/package.json`).
4. **npm package `@controlstack/oac`** (root `package.json`, version 1.1.0, `bin: oac`, `publishConfig.access: public`).
   - Its `files` list ships the **generated** `.opencode/**`, `registry.json`, `install.sh`, `scripts/` and `packages/cli/dist/`. It does not ship `content/`.
   - **Not published.** `npm view @controlstack/oac` returns 404, yet `README.md:125` already tells users to `npm i -g @controlstack/oac`.
   - Planned layout (08 §4): ship `content/` plus the CLI and drop `.opencode/`. Not yet done.
5. **Claude Code plugin**:
   - **Install:** `/plugin marketplace add darrenhinde/OpenAgentsControl`, then `/plugin install oac` (`README.md:197-202`). The marketplace `source: ./plugins/claude-code`.
   - **Contents:** 7 agents, 12 skills, 6 commands, `hooks/hooks.json` (SessionStart → `bash "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"`, timeout 30), and `settings.json` `{"model":"opusplan"}`, which is probably a no-op key (index finding #13, unverified).
   - **Context:** `context -> ../../.opencode/context` is a **directory symlink**. Plus `scripts/install-context.{ts,js,sh}`.

---

## 2. Canonical build pipeline

### 2.1 Authored vs generated (exact)

**Authored (sources of truth):**

| Path | What it holds |
|---|---|
| `content/agents/**/*.md` | 33 agents: 7 primary, 26 subagent. 26 target `opencode` only; 7 target `opencode` + `claude-code` |
| `content/profiles/system/*.json` | 5 system profiles: essential, developer, business, advanced, full |
| `content/profiles/context/*.json` | 5 context profiles: core, engineering, business, essentials, meta-authoring |
| `.opencode/context/**` | ~294 `.md` files, 3 file symlinks (`core/standards/{code,docs,tests}.md`), `core/config/paths.json`. **Not compiled.** Referenced by path |
| `.opencode/command/**` | 20 commands plus eval YAML templates |
| `.opencode/skills/**` | 4 skills: task-management, context7, context-manager, smart-router-skill |
| `.opencode/skill/**` | Orphans: project-orchestration, plus split task-management tests |
| `.opencode/plugin/*.ts`, `.opencode/plugins/coder-verification/`, `.opencode/tool/**`, `.opencode/scripts/task-cli.ts`, `.opencode/prompts/**`, `.opencode/profiles/*/profile.json`, `.opencode/opencode.json`, `.opencode/config.json` | Hand-authored runtime pieces and config |
| `.opencode/agent/eval-runner.md` | Deliberately non-canonical. Mutated by the eval harness |
| `.opencode/agent/*/0-category.json` | Hand-maintained files *inside* the generated dir. Not in the manifest |
| `plugins/claude-code/{skills,commands,hooks,scripts,settings.json,README.md,RECOMMENDED-PERMISSIONS.md,.claude-plugin/plugin.json}` | All of the plugin except `agents/` |
| `.claude-plugin/marketplace.json` | Marketplace entry |
| Non-agent sections of `registry.json` | contexts, commands, skills, tools, plugins, config, categories, profile presentation metadata. Carried through by the emitter, not generated |

**Generated by `oac build` and committed:**

- `.opencode/agent/**/*.md`: 33 files.
- `registry.json`: only the `components.agents`, `components.subagents` and `profiles.*.components` sections are re-derived.
- `.oac/build-manifest.json`: the ledger. 41 entries: 33 opencode, 7 claude-code, 1 registry.
- `plugins/claude-code/agents/*.md`: 7 files. Generated content, but **staged** to `.tmp/oac-build/plugins/claude-code/agents/`. They are committed by hand and are **not drift-gated**.
  - Commit `104356a` (2026-09-01) "regenerated both emitted trees". The 7 shipped files are now byte-identical to the staged output (verified with `diff`).
  - The committed ledger records them under the gitignored `.tmp/oac-build/...` root.

### 2.2 Data flow

```
  AUTHORED                         packages/compatibility-layer (vitest, Node)           OUTPUT
  ─────────                        ─────────────────────────────────────────            ──────
  content/agents/**/*.md ──► CanonicalAgentLoader (AgentLoader.ts)
   (OpenCode frontmatter        │  gray-matter + Zod CanonicalAgentSchema
    + `oac:` block)             │  (types.ts: AgentFrontmatterSchema ⊕ OacBlockSchema;
                                │   permission map ─desugar─► ordered rule list)
                                ▼
                         BuildPipeline.plan()  (sorted by oac.id, then path; no clock)
                          │            │                       │
           target=opencode│            │target=claude-code     │registry
                          ▼            ▼                       ▼
                 OpenCodeAdapter   ClaudeAdapter          RegistryEmitter ◄── content/profiles/**
                 (strip `oac:`     (name/model/tools        │  (ProfileLoader closure,
                  as TEXT, re-     from oac.overrides.      │   ReferenceResolver dead-ref
                  parse, warn on   claude-code; exhaustive  │   check, carries non-agent
                  unknown keys)    tools/disallowedTools)   │   sections of committed
                          │            │                    │   registry.json)
                          ▼            ▼                    ▼
                 .opencode/agent/  .tmp/oac-build/      registry.json
                   **/*.md         plugins/claude-code/       │
                          │        agents/*.md (STAGED;       │
                          │        compared, never in place)  │
                          └──────────────┬─────────────────────┘
                                         ▼
                           BuildPipeline.write() ─► .oac/build-manifest.json (sha256 ledger;
                                                    prunes only files it previously wrote)
  CI: make check-canonical-drift ─► scripts/validation/check-build-drift.sh
      = git status snapshot ─► `bun packages/cli/dist/index.js build` ─► snapshot ─► diff
        over (.opencode/agent, registry.json, .oac/build-manifest.json)   [NOT plugins/claude-code]
```

### 2.3 Components (`packages/compatibility-layer/src`)

**`types.ts` (728 lines)**
- `CanonicalAgentSchema = AgentFrontmatterSchema.extend({ oac: OacBlockSchema, permission: PermissionInputSchema })`.
- `OacBlockFieldsSchema` is strict and has these fields: `id` (kebab), `name`, `category` (`<root>[/<seg>]`, roots = AgentCategorySchema + `subagents` + `testing`), `type` (`agent|subagent`), `version` (semver), `author`, `tags`, `dependencies` (`"type:id"` strings or objects), `targets` (`opencode|claude-code`, default `["opencode"]`), `overrides`.
- `TargetOverrideSchema` is strict: `{ name?, model?, tools?: string[] }`, keyed by `opencode` or `claude-code`. An override for an undeclared target is a parse error.
- Leftovers:
  - `ModelIdentifierSchema = z.union([z.string(), z.string()])` is still the no-op union (`types.ts:251`).
  - `AgentCategorySchema` is a closed enum that no longer matches the corpus.

**`core/Capabilities.ts`: the permission resolver**
- Ordered rules, **last-match-wins** via `findLast`. Copied from OpenCode 1.17.20's resolver and verified live in `10-PRECEDENCE-EXPERIMENT.md`.
- Wildcard `*` crosses `/` and spaces.
- `implicitDefault`, `degradeToBinary` and `projectToFlatTools` exist. `projectToFlatTools` is now used only on the legacy `fromOAC` path.

**`core/CapabilityMatrix.ts` (671 lines)**
- Platforms `oac|claude|opencode`. Used for warnings and `getToolCapabilities`.

**Agent and profile loaders**
- **`CanonicalAgentLoader`** (`core/AgentLoader.ts`): loads `content/agents/**`, sorted by `oac.id`. The legacy `loadAgents` (OpenAgent IR from `.opencode/agent`) also lives here and is used by `oac apply`.
- **`ProfileLoader`** (`core/ProfileLoader.ts`): computes profile closures.
  - Its header still says profiles are authored in `.opencode/profiles/*/profile.json` and in `registry.json`.
  - Since `4c96328` and `5c7d4cc`, `content/profiles/**` own the component lists. The header is stale.
- **`ReferenceResolver`** (`core/ReferenceResolver.ts`): resolves `type:id` refs against `registry.json`, plus `.opencode/**` frontmatter `dependencies:`. It covers the *legacy* corpus and does not cover `content/`.

**Adapters**
- **`OpenCodeAdapter`** (`adapters/OpenCodeAdapter.ts`): textual excision of `oac:`, kept byte-identical on purpose. Its header documents what OpenCode accepts, verified against OpenCode source `config.ts` (v1.1.48+118) and the live 1.18.1 binary:
  - `name:` is legal and is the registration key.
  - Unknown keys are swept into `options` via `.catchall`.
  - The permission vocabulary is open.
  - Key order is preserved through `__originalKeys`.
  - Unknown top-level keys produce warnings against an `OPENCODE_KNOWN_KEYS` copy.
- **`ClaudeAdapter`** (`adapters/ClaudeAdapter.ts`, 749 lines):
  - `fromCanonical` **requires** `oac.overrides.claude-code.tools`. The tools are authored, not derived.
  - It emits `name` (override name or `oac.id`), `description`, exhaustive `tools` / `disallowedTools`, and `model`, in a fixed key order.
  - Legacy `fromOAC` survives for `oac apply`.

**Build machinery**
- **`RegistryEmitter`** (`core/RegistryEmitter.ts`): regenerates the agents, subagents and profile component sections. It withdraws entries whose path the **ledger** claims, and carries everything else (e.g. `agent:eval-runner`).
- **`BuildPipeline`** and **`BuildManifest`**: `plan` / `build` / `write` / `check`.
  - Pruning is manifest-gated and root-contained (`TARGET_ROOTS`, `assertContained`).
  - It refuses to prune hand-edited files.
- **Mappers** (`ContextMapper`, `ModelMapper`, `PermissionMapper`, `ToolMapper`): legacy translation helpers. `ContextMapper` still anchors `baseDir: ".opencode/context"` (`ContextMapper.ts:56`).

**CLI wiring and drift gate**
- **`packages/cli/src/commands/build.ts`:** flags `--target`, `--check`, `--dry-run`, `--strict`, `--no-prune`, `--stage` (default `.tmp/oac-build`), `--verbose`, `--json` (reserved). `IN_PLACE_TARGETS = ['opencode']`.
- The docblock (`build.ts:12-50`) explains why claude-code stays staged:
  - Prompt content is target-adapted: `<example>` dispatch blocks, and bodies written against each target's capabilities.
  - There is "deliberately no flag to emit it in place".
- **Drift gate** (`Makefile` → `scripts/validation/check-build-drift.sh`):
  - It is a write build, not `--check`, because `--check` never compares the manifest itself.
  - A before/after `git status --porcelain` snapshot is used so unrelated local dirt cancels out.
  - It requires `packages/cli/dist/index.js` and **Bun** (`bun packages/cli/dist/index.js build`).
  - CI runs it in `packages-checks.yml` job `canonical-drift`, on PRs touching `content/**`, `.opencode/agent/**`, `.oac/**`, `registry.json`, `Makefile` or the script.

### 2.4 Tests

- **`packages/compatibility-layer/tests/**`:** about 554 tests (CI log for 2026-09-13: 552 passed, 1 failed, 1 skipped).
  - Golden: fixtures `fixture-planner` and `fixture-reviewer` for both targets.
  - `it.skip("regenerates all 7 committed agents byte-for-byte [BLOCKED: permission + id/name decisions]")` (`golden-files.test.ts:230`).
  - Also: determinism, permission ordering, profile completeness/equivalence/resolution, reference resolution, registry profile emission, and capability agreement.
- **CLI:** `bun test` (`packages/cli/src/**/*.test.ts`), including `seamless-install.e2e.test.ts` and `package-contents.test.ts`.

---

## 3. Runtime pieces that ship to users, and their OpenCode API surface

### 3.1 Agents (what is actually emitted)

Frontmatter keys present across the 33 canonical/OpenCode agents (counted with js-yaml):

| Key | Count |
|---|---|
| `name` | 33 |
| `description` | 33 |
| `mode` | 33 (`primary` 7, `subagent` 26) |
| `temperature` | 32 |
| `permission` | 24 |
| `model` | 0, as locked decision #2 requires |
| `tools` | 0 (OpenCode's deprecated tools map is unused) |

**Permission capability keys**

| Key | Count |
|---|---|
| `edit` | 23 |
| `bash` | 21 |
| `task` | 20 |
| `write` | 6 |
| `skill` | 5 |
| `read` | 3 |
| `question` | 2 |
| `grep` | 2 |
| `glob` | 2 |

- **Shape:** 82 are glob maps and 2 are scalars (`question: "allow"`).
- **Scoped (non-`*`) patterns:** bash 70, edit 91, task 33, write 14, read 3, skill 2.

**Recurring patterns**
- Edit deny-list on 11 agents: `"**/*.env*"`, `"**/*.key"`, `"**/*.secret"`, `"node_modules/**"`, `".git/**"`, all `deny`.
- Bash on openagent-style agents: `"*": ask` then `"rm -rf /*": deny`, `"sudo *": deny`, `"> /dev/*": deny`.
- Bash on coder-agent: `"*": deny` then an allowlist of `"bash .opencode/skills/task-management/router.sh complete*"`.
- Other bash allowlists: `"npx ts-node*task-cli*"`, `"npm run test *"`, `"terraform plan *"`, `"mkdir -p .tmp/tasks*"`.
- Read scoping: `".opencode/context/**/*.md": allow`.
- Task allowlists name agents by OpenCode `name:` (`contextscout`, `externalscout`, `TestEngineer`).

**Example: canonical source** `content/agents/subagents/code/reviewer.md`:

```yaml
---
name: CodeReviewer
description: Code review, security, and quality assurance agent
mode: subagent
temperature: 0.1
permission:
  bash:  { "*": "deny" }      # (authored as block maps)
  edit:  { "**/*": "deny" }
  write: { "**/*": "deny" }
  task:  { contextscout: "allow" }
oac:
  id: reviewer
  name: CodeReviewer
  category: subagents/code
  type: subagent
  version: "1.0.0"
  author: opencode
  tags: [review, security, quality]
  dependencies: [context:standards-code, context:review-ref]
  targets: [opencode, claude-code]
  overrides:
    claude-code:
      name: code-reviewer
      model: sonnet
      tools: [Read, Glob, Grep]   # with a YAML comment explaining the trade-off
---
```

**Generated** `.opencode/agent/subagents/code/reviewer.md`: identical bytes minus the `oac:` block.

**Generated (staged and committed)** `plugins/claude-code/agents/code-reviewer.md`:

```yaml
---
name: code-reviewer
description: Code review, security, and quality assurance agent
tools: Read, Glob, Grep
disallowedTools: Write, Edit, Bash, WebFetch, Task
model: sonnet
---
```

### 3.2 Config shape

- **`.opencode/opencode.json`:** `{"$schema":"https://opencode.ai/config.json"}` only.
- **`.opencode/config.json`:** `{"agent":"eval-runner"}`. Tracked since #56.
  - In OpenCode's schema, `agent` is a map of agent configs and the default-agent key is `default_agent`.
  - So this is either legacy, read by something else, or ignored or invalid (inferred; not verified against OpenCode source).
- **`.opencode/package.json`:** untracked, `@opencode-ai/plugin: 1.18.25`. Likely auto-written by OpenCode when it installs plugin deps (inferred).
- **`.opencode/package-lock.json`:** untracked, also in main's git status. The 08 plan says to delete it.

### 3.3 Plugins (OpenCode plugin API)

- **`.opencode/plugin/agent-validator.ts`** (1086 lines). `Plugin` from `@opencode-ai/plugin`.
  - Hooks: `event` (`message.updated`), `"chat.message"`, `"tool.execute.before"`, `"tool.execute.after"`.
  - Defines tools with `tool({...})`: `validate_session`, `check_approval_gates`, `export_validation_report`, `analyze_delegation`, `analyze_context_reads`, `check_context_compliance`, `analyze_agent_usage`.
  - Still references `standards/code.md` (`09` §7.2).
  - A `.ts.disabled` copy sits beside it.
- **`.opencode/plugin/notify.ts`:** an `event` hook on `session.idle`, disabled by a constant. It is the only registry plugin (`registry.json` plugins = `notify`).
- **`.opencode/plugins/coder-verification/`:** plural dir with a `plugin.json` manifest. OpenCode plugins have no manifest file. It is not in the registry, and it uses `ctx as any` / `toast`. Likely dead (inferred).
- **`.opencode/plugin/package.json`:** `@opencode-ai/plugin: latest`, `@opencode-ai/sdk: latest`. Unpinned.
- `bundled.ts` includes `.opencode/plugin`, so `oac init --profile full` copies the validator plugin into user projects (inferred from `BUNDLED_SUBDIRS` plus the `full` profile semantics).

### 3.4 Tools

- **`.opencode/tool/gemini/index.ts`:** `tool` from `@opencode-ai/plugin/tool`. Defines `generate`, `edit`, `analyze`.
- **`.opencode/tool/env/index.ts`:** env loader.
- **`.opencode/tool/index.ts`:** a barrel that re-exports both. Open PR #316 is a "tool-barrel workaround" (OpenCode loads every file in `tool/` as tools, so the barrel duplicates them). Inferred from the PR title in `PR_AUDIT_2026-07.md`.
- **`.opencode/tool/package.json`:** `@opencode-ai/sdk ^0.10.0`, `@opencode-ai/plugin ^0.10.0`, `zod ^4`. This is a third, very old SDK major.

### 3.5 Task-management CLI

- **Router** (`.opencode/skills/task-management/router.sh`):
  - Finds the project root by walking up looking for `.git` (file or dir) or `package.json` (#301).
  - Runs `npx ts-node scripts/task-cli.ts …`, which needs ts-node and possibly a network fetch.
  - `migrate` routes to `scripts/migrate-schema.ts`, which **does not exist**.
- **Storage:** tasks live in `.tmp/tasks/{feature}/task.json` and `subtask_NN.json`.
- **Second divergent copy:** `.opencode/scripts/task-cli.ts` (489 lines vs 554). It documents `.tmp/tasks/active/{feature}/`, a different layout.
- **Orphan tests:** split into `.opencode/skill/task-management/tests/`.
- **Agent coupling:** agents reference the router through raw-path bash permission scopes, e.g. coder-agent's `"bash .opencode/skills/task-management/router.sh complete*": allow`.

### 3.6 Context system

- **Tree:** `.opencode/context/` holds about 294 `.md` files. Top-level domains: `core`, `development`, `ui`, `content-creation`, `data`, `learning`, `product`, `project`, `project-intelligence`, `openagents-repo`, `system-builder-templates`, plus `navigation.md` and `index.md`.
- **Metadata:** an MVI single-line HTML comment (`<!-- Context: standards/code | Priority: critical | Version: 2.0 | Updated: … -->`).
- **Registry coverage:** the registry lists 195 contexts, so about 100 files are unregistered.
- **OpenCode discovery (ContextScout):**
  - The prompt (`content/agents/subagents/core/contextscout.md:56-67`) reads `core/config/paths.json` (`{local:".opencode/context", global:"~/.config/opencode/context"}`) via an `@` reference.
  - It starts from `{root}/navigation.md`, then follows navigation files top-down.
  - It falls back to global `core/`.
  - Permissions: read/grep/glob allowed; bash/edit/write/task denied.
- **Claude Code discovery** (`plugins/claude-code/skills/context-discovery/context-discovery-protocol.md`): a different protocol.
  1. Read `.oac.json` `context.root`.
  2. Otherwise probe `.claude/context`, then `.opencode/context`, then `~/.claude/context`.
  3. Ask the main agent to write `.oac.json`.
  - The CLI writes `.oac.json` with root `.opencode/context` for Claude, so Claude reads OpenCode's tree (`doctor-checks.ts:31`).
- **Plugin context:** `plugins/claude-code/context` is a symlink to `../../.opencode/context`.
- **SessionStart hook** (`plugins/claude-code/hooks/session-start.sh`): injects the `using-oac` skill, a skill catalogue built by globbing `skills/*/SKILL.md`, a first-run warning based on `.context-manifest.json`, and a context-discovery instruction. It emits JSON for both `additional_context` and `hookSpecificOutput.additionalContext`. `escape_for_json` is the injection defence.

### 3.7 Skills and commands

- **OpenCode skills** (4, `.opencode/skills/*/SKILL.md`): frontmatter `name`, `description`, `version`, `author`, `type`, `category`, `tags`. They are gated in agents by the `skill:` permission (5 agents).
- **Claude Code skills** (12, `plugins/claude-code/skills/*`): `oac:*` names, CC-only frontmatter such as `context: fork` (per `09` §4.1). The two skill sets are disjoint.
- **Commands:** 20 OpenCode commands (`.opencode/command/**`) and 6 CC commands (`plugins/claude-code/commands`). Also disjoint.

### 3.8 OpenCode version references are scattered

| Location | Version |
|---|---|
| `evals/framework/package.json` | `@opencode-ai/sdk` **1.0.90** (pinned) |
| CI eval job | `opencode-ai@1.17.20` (`.github/workflows/evals/run-evaluations.yml`) |
| Precedence experiment | 1.17.20 (`10-PRECEDENCE-EXPERIMENT.md:27`) |
| OpenCodeAdapter verification | source 1.1.48+118, live binary 1.18.1 |
| `.opencode/package.json` | plugin 1.18.25 |
| `.opencode/plugin/package.json` | `latest` |
| `.opencode/tool/package.json` | ^0.10.0 |
| `.github/workflows/opencode.yml` | `sst/opencode/github@77fc88c…` |

There is no single declared supported OpenCode version.

---

## 4. Eval framework (`evals/framework`, `@controlstack/eval-framework`, private)

### What it tests
- Behavioural rules of OpenCode agents across 263 YAML cases (`evals/agents/**/tests/**/*.yaml`).
- Each case has: `agent` (e.g. `core/openagent`), `model`, `prompt`, `behavior` (`requiresApproval`, `minToolCalls` …), `expectedViolations` (rule, `shouldViolate`), `approvalStrategy`, `timeout`.
- **Evaluators** (`src/evaluators/*`): approval-gate, context-loading (hard-codes `standards/code.md`-style paths), delegation, tool-usage, stop-on-failure, report-first, execution-balance, cleanup-confirmation, behavior, error-handling, performance, agent-model.
- They are rule-based checks over a session timeline (`collector/*`). There is no LLM judge (inferred from the file set).

### How it drives OpenCode
- **Server:** `ServerManager` spawns the `opencode` CLI server (`spawn('opencode', args)`, `server-manager.ts:138`). SDK mode (`createOpencode`) is disabled: "SDK mode causes 'No data in response' errors during session creation" (`server-manager.ts:27-40`).
- **Client:** `ClientManager` uses `createOpencodeClient` from `@opencode-ai/sdk` 1.0.90: `session.create`, `session.prompt`, `session.messages`, and a permission-response endpoint.
- **Events:** the event stream handles `'permission.request'` with an `as string` cast (`event-stream-handler.ts:157`). The cast suggests the SDK's event union no longer contains that name, so auto-approval may silently not fire on current OpenCode (inferred).
- **Session storage:** `SessionReader` reads OpenCode's on-disk storage `~/.local/share/opencode/storage/session` directly (`collector/session-reader.ts:33-51`). This couples it to OpenCode's private storage format.
- **Agent selection:** `.opencode/config.json` `{"agent":"eval-runner"}`, plus `TestRunner` copying the target agent's prompt into `.opencode/agent/eval-runner.md` (`test-runner.ts:210-330`). `PromptManager` likewise swaps `.opencode/prompts/**` variants into place. Both mutate the working tree, and an unrestored swap was mistaken for user work once (memory note, 2026-07-17).

### Deterministic vs live

| Kind | What |
|---|---|
| Deterministic (CI) | `pnpm --dir evals/framework run build` (tsc) |
| | `test:ci`: a vitest allowlist of 7 files (error-handling, evaluator-reliability, context-loading-evaluator, tool-usage-enhanced, yaml-loader, suite-validator, validate-suites-cli) |
| | `validate:suites:all`: YAML schema validation |
| | No ESLint config exists |
| Live (needs the OpenCode binary and a model or provider key) | `eval:sdk` (`pnpm test` at root → `run-sdk-tests.ts`) |
| | Root `test:*` scripts hardcode models like `anthropic/claude-3-5-sonnet-20241022` and `opencode/grok-code-fast` |
| | The `run-evaluations.yml` workflow |

**`run-evaluations.yml` is deliberately inert.** It lives in `.github/workflows/evals/`, and GitHub does not load workflows from subdirectories. `gh run list --workflow run-evaluations.yml` returns 404. Commit `68a3bdc`: "keep evaluations inert". **No behavioural eval runs in CI at all.**

Evals only exercise OpenCode. Nothing tests the Claude Code plugin's behaviour.

---

## 5. CI (`.github/workflows`)

| Workflow | Trigger | Gates |
|---|---|---|
| `pr-checks.yml` | PR → main, dev | Conventional title. `check-changes` (outputs `has-evals/docs/workflows`, now consistent; the PR audit's output-name bug is fixed). `build-check`: eval build + `validate:suites:all` + `test:ci` |
| `packages-checks.yml` (**branch only**, absent on main) | PR touching `packages/**`, `content/**`, `.opencode/agent/**`, `.oac/**`, `registry.json`, `Makefile`, … | `check-changes` (bun test of `detect-pr-changes`). `cli-checks` (build compat, typecheck, build, `bun test`). `compatibility-layer-checks` (build, lint, vitest). `canonical-drift` (`make check-canonical-drift`, needs Bun). Summary job fails on any failure |
| `installer-checks.yml` | PR/push touching `install.sh`, `update.sh`, `registry.json`, `scripts/tests/test-*.sh` | shellcheck, `bash -n`, non-interactive and e2e install tests, compatibility tests, profile smoke tests (5 profiles). OS matrix **ubuntu + macOS only, no Windows** |
| `validate-registry.yml` | `pull_request` (no longer `pull_request_target`; comment at :4), `contents: read` | `validate-pr.sh`, `validate:context-links`, `validate:registry` (bun) |
| `validate-test-suites.yml` | push/PR on eval paths | `validate:suites:all` |
| `dependency-review.yml` | PR → main, dev | GitHub dependency review (vulnerable packages) |
| `update-registry.yml` | **dispatch only** (`68a3bdc`) | Runs `auto-detect-components.sh --auto-add`, which appends to `registry.json`. This is a second writer that fights `RegistryEmitter` |
| `create-release.yml`, `post-merge-pr.yml` | push to main | Version-bump PR, then tag and GitHub release (`WORKFLOW_AUDIT.md`). No npm publish anywhere |
| `sync-docs.yml` | push | Opens issues and branches for doc sync ("potentially overkill", WORKFLOW_AUDIT) |
| `opencode.yml` | issue comment `/oc` from OWNER or MEMBER | Runs the `sst/opencode/github` action with write perms |
| `evals/run-evaluations.yml` | inert (subdirectory) | none |

### Known failing or flaky

1. **PR #342's last pushed run (2026-09-13) is red.** Verified with `gh pr checks 342` and the failed logs.
   - **Compatibility Layer:** 1 failure, `reference-resolution.test.ts › validate-registry.sh blind spots › never validates profile component lists…: expected 197 to be greater than 200`.
   - **Dependency Review:** GHSA-5xrq-8626-4rwp, via vitest's `assertion-error` / `check-error`.
   - Local unpushed commits `a4c8ab3` (lowers the floor) and `d7924e4` (vitest 3.2.7) target exactly these two. **Not yet re-run in CI.**
2. **Upstream-PR branches** (`upstream-pr/*`, Oct 2–4) show failures and `action_required` (fork approval) across PR Checks, Installer, Validate Registry and Dependency Review. There is also a "Fresh Clone Green" workflow that is not present in this tree (from a fork branch).
3. **The eval SDK mode is known broken** (see §4). CLI spawn mode works but needs `opencode` on PATH.
4. **`main` has no package or drift gate.** Its runs list only shows `opencode` (skipped), Dependabot and Copilot. The refactor's CI improvements exist only on the branch.

---

## 6. Refactor plan status (`docs/architecture/canonical-refactor/*`)

The worktree has 00–12. `main` has only 00–06, older revisions, untracked.

### 6.1 The plan as written (`07-EXECUTION-PLAN.md`)

Stages:
- **0:** quick wins.
- **1:** spec repair and decisions.
- **2:** `packages/core` IR + MVI parser + corpus test.
- **3:** build + golden tests (opencode, claude, agents-md).
- **4:** content merge from both trees, path tokenization, symlinks to `aliases[]`, retire `sync-to-claude.sh`.
- **5:** Node-portable CLI, dependency resolution, `doctor --verify`, 3-OS e2e.
- **6:** flip the source of truth, delete bash installers, one-version release, rollback drill.

Kill criteria:
- **Stage 3:** if the adapters cannot express the real agents without security or delegation loss on a first-class target, fall back to OpenCode-as-source plus docs generation.
- **Stage 4:** if the two trees turn out to be different products, pick one.

### 6.2 What actually happened

The `.tmp/tasks/canonical-build-system/task.json` notes say it "SUPERSEDES subtasks 11-24 of canonical-refactor". It states that MVI (13), agents-md (19), tokenization and symlinks (22), and Stages 5–6 (25–30) are **out of scope**, and that "Context files stay at `.opencode/context/` … NOT compiled."

| Stage | Status on branch | Evidence |
|---|---|---|
| 0 Quick wins | **Done** | packages CI (`abeb154`); CC coder-agent hotfix plus `RECOMMENDED-PERMISSIONS.md` (`8e12c63`); single version 1.1.0 across VERSION, package.json, plugin.json and marketplace (`5881767`); pnpm workspace (`2dba195`); junk sweep (`a274eb6`); `plugin-abilities` deleted (`cce5255`) |
| 1 Spec & decisions | **Done** (docs) | `02` v3 (`3146bb5`); `01`/`05` v2; `09-MERGE-RULES` (`236ea23`); precedence experiment with last-match-wins confirmed live (`8d64bdd`); `11-ROLLBACK`; `06` disposition table |
| 2 IR + parsers | **Partially, differently.** No `packages/core`, no MVI parser, no corpus test over context/skills/commands. Instead the `oac:` block, ordered permissions and the last-match-wins resolver were added in compatibility-layer | `319bec0`, `6966b48`, `b77143c` |
| 3 Build + golden | **Mostly done for OpenCode.** Claude is staged. Golden byte-reproduction of the 7 CC agents is `it.skip`. No agents-md. No `--allow-unsafe-degradation` gate; replaced by authored `oac.overrides` (`d643b4a`) | `1a5f1f8`, `33eb6f4`, `627b9ce`, `d100ccd` |
| 4 Content merge | **Agents only, and seeded from OpenCode.** `content/agents` was seeded from `.opencode/agent` (`cf97d98`), not merged with the CC bodies. `09`'s "CC body wins" rule was **not applied**: `104356a` regenerated the CC agents from canonical, so the CC `<example>` blocks are gone (main's `code-reviewer.md` has 2, the branch has 0). Skills, commands, context and hooks are not in `content/`. Symlinks remain. No tokenization (15 of 33 canonical agents contain raw `.opencode/` paths). `sync-to-claude.sh` not retired | §2.1 |
| 5 CLI parity | **Partially.** Node runtime without Bun (`8581a42`); tiered install, safe re-init, `add` installs dependencies, honest doctor (`73400e2`); profile installs (`0b84561`). No `doctor --verify` real-tool loading, no Windows e2e, `install.sh` still primary | `packages/cli/src/**` |
| 6 Flip & release | **Not started.** Generated trees committed; `install.sh`/`update.sh` present; `@controlstack/oac` unpublished (404); no rollback drill; no `npm deprecate @nextsystems/oac` | root `package.json` `files` |

### 6.3 Explicitly deferred decisions

From memory `canonical-build-deferred-decisions.md` plus `build.ts` and the test skips:

1. **Whether Claude Code is viable as a generated agent target.**
   - Permissions are now settled by authored `oac.overrides.claude-code`, which carry documented WIDENING comments. For example, external-scout gets unrestricted `Bash` and full-repo `Read` on CC.
   - The remaining blocker is **prompt content**. CC `description:` carries `<example>` dispatch blocks, and the bodies are written against CC capabilities. Canonical has no per-target field for either.
   - Hence claude-code stays staged, and there is "deliberately no flag to emit it in place" (`build.ts:12-50`).
   - **Contradiction:** the committed CC agents were nonetheless overwritten with the canonical output in `104356a`. The deferred decision has de facto been taken in the "canonical wins, examples lost" direction, without a gate protecting it.
2. **`eval-runner.md` is not canonicalised.** It is protected by its absence from the ledger, and a tripwire test exists.
3. **Distribution under `@controlstack`** is DECIDED, but nothing is published. "Do not publish while the ClaudeAdapter override refactor is red."
4. **From `07` / `09` / `00`, decided on paper but not implemented:**
   - `inference.tier: fast|balanced|deep`. Not in the schema; the overrides carry `model: sonnet|haiku` instead.
   - Symlinks to `aliases[]`.
   - Path tokenization (`{{SKILL_ROOT}}`).
   - The `targets:[]` field on skills, commands and context.
   - Hooks into `content/hooks/`.
   - Registry generated for *all* component kinds.
   - `project-orchestration` plus the 6 planning agents to be deleted. They are still canonical under `content/agents/subagents/planning/`.
5. **Merge rules** (`09`): the CC body wins for the 7 dual-home agents (with an exception and section-diff for coder-agent and task-manager); skills are the union of 16; commands are the union of 26; context is harvested once (the CC tree is a symlink); hooks are a verbatim harvest; the registry is regenerated, with the root copy kept for one release. Per-branch rules: small PRs into `refactor/canonical`, merge to `main` per stage, no AI attribution (`12-DISPATCH.md`).

---

## 7. Weak points

### 7.1 OpenCode format hard-coded as the source of truth

1. **The canonical schema is literally OpenCode's.**
   - `CanonicalAgentSchema = AgentFrontmatterSchema(OpenCode) + oac` (`types.ts:541`), and OpenCodeAdapter is textual `oac:` excision.
   - Any OpenCode change lands directly in authored content and the IR: a rename of `mode`, a permission key such as `write` merging into `edit`, or a change to `task:` semantics.
   - The planned neutral `capabilities:` / `inference` model (`00-INDEX` worked example) does not exist.
2. **Permission semantics are OpenCode's resolver**, copied from v1.17.20 (`Capabilities.ts`). Last-match-wins, `*` crossing `/`, and key order are an implicit contract. YAML maps are unordered by spec, and integer-like keys reorder in JS (`00-INDEX` "residual risk").
3. **`OPENCODE_KNOWN_KEYS`** is a hand-copied list from one OpenCode `config.ts` revision (`OpenCodeAdapter.ts:83-100`). It is warning-only, so a drift is merely noisy.
4. **Raw `.opencode/` paths in content.** 15 of 33 canonical agents contain them, including permission scopes like `"bash .opencode/skills/task-management/router.sh complete*"` and `".opencode/context/**/*.md"`. Installing to `~/.config/opencode`, or to any non-`.opencode` dir, silently breaks these scoped allows.
   - `install.sh` rewrites paths textually on install (`install.sh:1150`) (inferred that the rewrite does not touch permission keys correctly).
   - The CLI copies files verbatim.
5. **The Claude side depends on OpenCode's tree:**
   - `.oac.json` root `.opencode/context` (`doctor-checks.ts:31`).
   - `plugins/claude-code/context -> ../../.opencode/context` symlink.
   - CC skills referencing `.opencode/context/core/standards/tests.md`.
6. **The evals couple to OpenCode internals:** on-disk session storage path and format, a `permission.request` event name cast, a pinned SDK 1.0.90 vs CLI 1.17.20, broken SDK mode, and `.opencode/config.json` `{"agent":"eval-runner"}`.

### 7.2 Duplicated sources of truth

1. **Profiles in three places:** `content/profiles/**` (authoritative now), `registry.json` `.profiles` (presentation metadata plus emitted components, read by `install.sh`), and `.opencode/profiles/*/profile.json` (stale; still read by `scripts/registry/check-dependencies.ts` per ProfileLoader).
2. **Two registry writers:** `RegistryEmitter` and `scripts/registry/auto-detect-components.sh --auto-add` (`update-registry.yml`, dispatch). Running the latter produces drift the gate will flag.
3. **Two Claude emission paths:** `oac build` (plugin agents, staged) and `oac apply claude` (legacy `loadAgents` → `ClaudeAdapter.fromOAC(agents[0])` → `CLAUDE.md`, `apply.ts:100-102`). The second converts an arbitrary first agent and ignores overrides. Plus `scripts/bridge/sync-to-claude.sh`, which the plan says to retire.
4. **Two task CLIs** (`.opencode/scripts/task-cli.ts` and `.opencode/skills/task-management/scripts/task-cli.ts`) with different storage layouts. Two skill dirs (`skill/` and `skills/`). Two plugin dirs (`plugin/` and `plugins/`).
5. **Two context-discovery protocols:** OpenCode `paths.json` vs Claude `.oac.json`. Plus the CLI's `.oac.json` and the plugin's `.context-manifest.json` first-run check.
6. **Two bundled-content models:** the npm `files` list ships generated `.opencode/**`, and the CLI's `BUNDLED_SUBDIRS` enumerates `.opencode/*`. The 08 plan says ship `content/`. Everything the CLI installs is the generated tree, so users can never "edit content/ then build".
7. **Two agent ids** per CC agent: `oac.id` (`reviewer`, `tester`, `contextscout`, `externalscout`) vs `overrides.claude-code.name` (`code-reviewer`, …). Plus OpenCode `name:` (`CodeReviewer`), which `task:` rules key on.

### 7.3 Dead or stale code

- `ModelIdentifierSchema` no-op union (`types.ts:251`).
- Legacy mappers, partly: `PermissionMapper` is "must never be used on this path".
- `CapabilityMatrix` rows.
- `migrate-schema.ts` is referenced by `router.sh` but missing.
- `.opencode/plugins/coder-verification/` (inferred dead).
- `.opencode/plugin/agent-validator.ts.disabled`.
- `.opencode/skill/project-orchestration` and the 6 `subagents/planning/*` agents (dispositioned "delete" in 06 Q7, yet still canonical).
- Commented "Bun-only" docs in `build.ts` ("packages/cli still runs on Bun", `build.ts:9-11`), now false at runtime.
- The `--json` flag, "reserved", does nothing.
- Package description mentions Cursor/Windsurf (`packages/compatibility-layer/package.json`).
- `registry.json` top-level `subagents` key duplicates `components.subagents`. `metadata.lastUpdated: 2026-03-21`.
- Task JSON statuses are stale. canonical-build-system subtasks 01, 03 and 09 say `pending` but commits exist. agent-metadata-retirement subtask 08 says `pending` but the sidecar is deleted.

### 7.4 Docs contradicting code

- **Spec index status line:** `00-INDEX.md` says "Specification … No implementation yet". Its target repo shape (`/content/{skills,commands,context}`, `packages/core|adapters`) does not match the branch.
- **The canonical-format worked example** (`capabilities:`, `inference.model: null`) does not match the real format (OpenCode `permission:` + `oac:`, with `model: sonnet` in overrides).
- **`build.ts` docblock vs the committed CC agents.**
  - The docblock says the CC agents are not emitted because they carry `<example>` blocks and target-adapted bodies.
  - The committed CC agents are already the canonical emission, with no examples (`104356a`).
  - The docblock also says "the staged comparison reports all 7 files as 'would change'". They are now identical.
- **`packages-checks.yml` comment** "dist … bundled `--target bun`" vs the build script `--target node`.
- **`ProfileLoader.ts` header** names `.opencode/profiles` and the registry as the profile sources. Canonical `content/profiles` own them now.
- **README:**
  - `npm i -g @controlstack/oac` (unpublished).
  - `oac apply claude # project into Claude Code` only writes `CLAUDE.md`.
  - Links to `plugins/claude-code/FIRST-TIME-SETUP.md` and `QUICK-START.md`, which do not exist.
- **The repo's own context docs:**
  - `.opencode/context/openagents-repo/core-concepts/agent-metadata.md` claimed OpenCode rejects unknown frontmatter. That is false per OpenCode source, and the doc has since been trimmed (`5c7d4cc`).
  - `PR_AUDIT` notes contradictory `permission` vs `permissions` guidance.
  - 34 stale `agent-metadata.json` mentions inside agent prompt bodies (memory note; not re-counted).
- **`09-MERGE-RULES` contradicted.** Its "CC body wins" rule and its `<example>` preservation requirement were contradicted by what shipped.
- **`registry.json` metadata.** It is now partly generated but still says it is hand-maintained in places.

### 7.5 Windows-hostile

- **Symlinks:** 3 context file symlinks plus the **directory symlink** `plugins/claude-code/context`. On Windows without `core.symlinks`, these become text files. The CC plugin's whole bundled context then breaks, and agents reading `standards/code.md` read a path string.
- **Bash everywhere on the critical path:**
  - The drift gate (`check-build-drift.sh`, needs Bun).
  - `Makefile`.
  - `install.sh` / `update.sh` (need `jq`, `curl`).
  - `router.sh` for the task skill. The agent permission scopes are literally `bash …router.sh`.
  - The CC `session-start.sh`, run as `bash "${CLAUDE_PLUGIN_ROOT}/…"`.
  - The CLI build `rm -rf dist`.
  - `scripts/**`.
- **No Windows CI job anywhere** (installer matrix is ubuntu and macOS). The 07 Stage 5 gate is unmet.
- **`npx ts-node`** at runtime (task skill) needs network and ts-node on any OS.

### 7.6 Where a target-format change breaks things

| Change | Breaks |
|---|---|
| OpenCode renames/merges permission keys (e.g. `write` into `edit`), changes glob or precedence semantics, or changes `mode` | All 33 authored agents (format is the source), `Capabilities.ts` resolver tests, golden fixtures |
| OpenCode tightens frontmatter (stops `.catchall`) | Only hygiene. `oac:` is already stripped |
| OpenCode moves agent discovery (e.g. `.opencode/agents/` plural) | `OPENCODE_AGENT_ROOT`, `TARGET_ROOTS`, `SHIPPED_ROOTS`, `bundled.ts`, `install.sh`, the registry `path`s, the drift-gate path list, the ledger roots: all hard-coded `.opencode/agent` (inferred that a plural dir is accepted by newer OpenCode; not verified) |
| OpenCode plugin/tool API change | `agent-validator.ts`, `notify.ts`, `gemini` tool, evals. Versions are unpinned or `latest` |
| OpenCode storage or event changes | Eval `SessionReader` and approval handler |
| Claude Code frontmatter change (e.g. per-agent permissions arrive) | Overrides model and `CLAUDE_TOOL_BINDINGS` (`ClaudeAdapter.ts`). Arguably an improvement |
| Claude Code plugin layout change | `hooks.json` shape, `${CLAUDE_PLUGIN_ROOT}`, the symlinked context. None of these is generated, so nothing would catch it |
| Any new target | Requires extending the closed `BuildTargetSchema`, `TargetOverridesSchema`, `BUILD_TARGETS`, `TARGET_ROOTS`, `SHIPPED_ROOTS`, and per-agent overrides on every agent (Claude-style targets need authored `tools` on all of them) |

### 7.7 Other risks

- **Security widenings accepted on CC** and documented only in YAML comments:
  - external-scout gets unrestricted Bash and full Read.
  - coder-agent loses all 5 path-glob denies on Edit.
  - context-manager, test-engineer (per memory).
  - Mitigated only by advisory prompt rules and an opt-in `RECOMMENDED-PERMISSIONS.md`.
- **The drift gate only runs on PRs** with matching paths. There is no push-to-main gate, and `main` has none at all.
- **Committed ledger records a gitignored root** (`.tmp/oac-build/...`). On a fresh clone the staged files do not exist, so `compareStaged` / prune reasoning depends on local state (inferred impact; low).
- **Hardcoded models** in root `package.json` test scripts (`claude-3-5-sonnet-20241022`, `gpt-4-turbo`) and in eval YAML (`model: anthropic/claude-sonnet-4-5`) contradict locked decision #2 in spirit.
- **Two unpushed commits** carry the fixes for PR #342's current red checks.

---

## 8. Key files index

- **Build:**
  - `packages/compatibility-layer/src/{types.ts,core/BuildPipeline.ts,core/BuildManifest.ts,core/AgentLoader.ts,core/Capabilities.ts,core/ProfileLoader.ts,core/ReferenceResolver.ts,core/RegistryEmitter.ts,adapters/OpenCodeAdapter.ts,adapters/ClaudeAdapter.ts}`
  - `packages/cli/src/commands/build.ts`, `scripts/validation/check-build-drift.sh`, `Makefile`
- **CLI:** `packages/cli/src/{index.ts,commands/*.ts,lib/bundled.ts,lib/doctor-checks.ts,lib/installer.ts}`, `bin/oac.js`
- **Install:** `install.sh`, `update.sh`, `registry.json`, `package.json` (`files`)
- **Content:** `content/agents/**`, `content/profiles/**`
- **Generated:** `.opencode/agent/**`, `registry.json`, `.oac/build-manifest.json`, `plugins/claude-code/agents/*` (staged)
- **Runtime:**
  - `.opencode/{plugin,plugins,tool,skills,skill,command,context,scripts,prompts,profiles}`, `.opencode/{opencode.json,config.json}`
  - `plugins/claude-code/{hooks,skills,commands,.claude-plugin}`, `.claude-plugin/marketplace.json`
- **Evals:** `evals/framework/src/sdk/{server-manager,client-manager,test-runner,prompt-manager,event-stream-handler}.ts`, `evals/framework/src/collector/session-reader.ts`, `evals/agents/**`
- **CI:** `.github/workflows/{packages-checks,pr-checks,installer-checks,validate-registry,update-registry,dependency-review,create-release,post-merge-pr,opencode}.yml`, `.github/workflows/evals/run-evaluations.yml` (inert)
- **Plans:**
  - `docs/architecture/canonical-refactor/{00-INDEX,07-EXECUTION-PLAN,08-STRUCTURE-AND-PACKAGING,09-MERGE-RULES,10-PRECEDENCE-EXPERIMENT,11-ROLLBACK,12-DISPATCH}.md`
  - `.tmp/tasks/{canonical-refactor,canonical-build-system,agent-metadata-retirement,seamless-install}/` (gitignored)
  - main: `docs/maintenance/{PR_AUDIT_2026-07,REPOSITORY_MANAGEMENT_PLAN}.md`
