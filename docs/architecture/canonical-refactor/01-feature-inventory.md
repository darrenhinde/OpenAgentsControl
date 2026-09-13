# 01 — Feature & Content Inventory

> **Current state (2026-09-02):** This inventory records the pre-migration architecture. The active metadata workflow is canonical `content/agents/**` `oac:` blocks emitted by RegistryEmitter; sidecar metadata and sidecar merging are superseded.

> **Owner:** Agent A
> **Status:** Spec only — no implementation. **v2** (2026-07-15): census re-verified from
> disk; `{pattern, effect}` terminology aligned to Locked Decision #5's `{scope, decision}`;
> the `.env` security alarm retracted as a non-finding (Q17 closed — only the build-hygiene
> point survives); navigation/registry counts corrected per `06-REVIEW` disposition #2.
> **Read first:** [`00-INDEX.md`](./00-INDEX.md) for locked decisions.
>
> **Purpose:** Exhaustive inventory of every feature and capability that exists today in
> `.opencode/` (source), `registry.json`, and `plugins/claude-code/`. Each item is classified
> **UNIVERSAL** (belongs in the neutral `/content/` schema) vs **OPENCODE-SPECIFIC**
> (needs adapter handling) vs **AT RISK** (no obvious home — will be silently lost unless
> a decision is made).
>
> The user's #1 requirement: **nothing gets lost.** Every row below must land somewhere.

---

## Legend

| Tag | Meaning |
|-----|---------|
| 🟢 **UNIVERSAL** | Belongs in the neutral IR. All/most target tools express this concept. |
| 🟡 **OPENCODE-SPECIFIC** | Real capability, but expressed in OpenCode syntax. Adapter must render it; other adapters may degrade it (with a warning). |
| 🔵 **REGISTRY/BUILD** | Not agent-facing content — belongs to the catalog or build pipeline. |
| 🔴 **AT RISK** | Currently has no home in the target architecture. **Needs a human decision** (see Open Questions). |

---

## 0. Census — what is actually on disk

Counts verified by enumeration, not by trusting the docs.

| Area | Path | Count | Notes |
|------|------|-------|-------|
| Agents (markdown) | `.opencode/agent/**/*.md` | **34** | Task brief said 39; 39 = 34 `.md` + 5 `0-category.json`. |
| Category descriptors | `.opencode/agent/**/0-category.json` | **5** | `content`, `core`, `data`, `meta`, `subagents/development`. |
| Agent metadata entries | `.opencode/config/agent-metadata.json` | **28** | 8 `type: agent`, 20 `type: subagent`. **6 disk agents have no entry.** |
| Commands | `.opencode/command/**/*.md` | **20** | Task brief said 29; 29 = 20 `.md` + 9 `.yaml` eval templates. |
| Context files | `.opencode/context/**/*` | **297 entries** | = **294 regular files** (293 `.md` + `paths.json`) + **3 `.md` symlinks** — i.e. **296 `.md`** counting symlinks (the `00-INDEX` figure) and 294 files + 3 symlinks (the `07-EXECUTION-PLAN` figure; both reconcile). 75 are `navigation.md`. v1's "+2 task JSON schemas" matches nothing on disk (and nothing in git history) — dropped. |
| Context symlinks | `.opencode/context/core/standards/{code,docs,tests}.md` | **3** | → `code-quality.md` / `documentation.md` / `test-coverage.md`. Same trio as the duplicate-id finding (§3.6); break Windows checkouts — see `00-INDEX` v2.2. |
| Skills (plural dir) | `.opencode/skills/*/SKILL.md` | **4** | `task-management`, `context-manager`, `context7`, `smart-router-skill`. |
| Skills (singular dir) | `.opencode/skill/*/` | **2** | `project-orchestration`, `task-management` — **not in registry** (see §4.3). |
| Tools | `.opencode/tool/*/index.ts` | **3** | `env`, `gemini`, `template`. |
| Plugins | `.opencode/plugin/*.ts` | **2** | `notify.ts`, `agent-validator.ts` (+ `.disabled` twin). |
| Plugins (plural dir) | `.opencode/plugins/*/` | **1** | `coder-verification`. |
| Profiles | `.opencode/profiles/*/profile.json` | **5** | **Stale duplicates** of `registry.json#profiles` (see §8.2). |
| Prompts | `.opencode/prompts/**` | **6 agents × N models** | Per-model prompt variants + eval results. |
| Registry components | `registry.json#components` | **8 types / 248 entries** | agents 8, subagents 19, commands 17, tools 2, plugins 1, skills 4, contexts 194, config 3. |
| CC plugin agents | `plugins/claude-code/agents/` | **7** | vs 34 in `.opencode/` — **the drift**. |
| CC plugin skills | `plugins/claude-code/skills/` | **12** | vs 4 in `.opencode/skills/` — **CC is ahead here**. |

> **Drift is bidirectional.** The common framing is "CC has 7 agents vs OpenCode's 34, CC is
> behind." That is only half true: **CC has 12 skills vs OpenCode's 4**, and CC's session-start
> context-injection has no OpenCode equivalent at all. The migration must merge *both*
> directions, not just replay `.opencode/` into CC.

---

## 1. Agents & Subagents

### 1.1 Frontmatter fields actually in use

Measured across all 34 agent `.md` files (`awk` over the YAML block):

| Field | Occurrences | What it does | Class | Post-migration home |
|-------|-------------|--------------|-------|---------------------|
| `name` | 34 | Display/invocation name. PascalCase in OpenCode (`CodeReviewer`). | 🟢 UNIVERSAL | `id` (canonical, kebab) + `name` (human). Adapters slugify: OpenCode→PascalCase, Claude→kebab. |
| `description` | 34 | One-line purpose; drives delegation routing. | 🟢 UNIVERSAL | `description`. Claude adapter **appends `examples[]`** into this field (see §1.5). |
| `mode` | 34 | `primary` \| `subagent`. | 🟢 UNIVERSAL | `role: primary \| subagent`. OpenCode adapter renames `role`→`mode`. |
| `temperature` | 33 | Sampling temperature (`0`–`0.2` in practice). | 🟡 OPENCODE-SPECIFIC | `inference.temperature`. **Claude Code has no per-agent temperature → degradation warning** (already predicted in `00-INDEX.md`). |
| `permission` | 24 | Granular per-tool, per-glob allow/ask/deny. | 🟡 OPENCODE-SPECIFIC | `capabilities` (intent). This is the **hardest transform** — see §1.3. |
| `model` | **0** | — | 🟢 UNIVERSAL | No concrete model is authored. Optional `inference.tier` carries only semantic cost/latency intent. |
| `tools` | **0** | — | 🟢 UNIVERSAL | OpenCode expresses tool access via `permission`, not `tools`. Claude adapter derives `tools:` allowlist from `capabilities`. |
| `hooks` | **0** | — | n/a | No agent declares hooks in frontmatter. Hooks exist only as *plugins* (§6) and CC `hooks.json` (§9.2). |
| `id`,`category`,`type`,`version`,`author` | **1** | Only `eval-runner.md` inlines these. | 🔵 REGISTRY | Everywhere else these live in the `agent-metadata.json` sidecar. `eval-runner` is the **inconsistent outlier**. |

**Representative — `.opencode/agent/subagents/code/reviewer.md`** (the `00-INDEX.md` worked example, verified verbatim):

```yaml
---
name: CodeReviewer
description: Code review, security, and quality assurance agent
mode: subagent
temperature: 0.1
permission:
  bash:  { "*": "deny" }
  edit:  { "**/*": "deny" }
  write: { "**/*": "deny" }
  task:  { contextscout: "allow" }
---
```

**Representative — `.opencode/agent/core/openagent.md`** (primary agent, security-critical denies):

```yaml
---
name: OpenAgent
description: "Universal agent for answering queries, executing tasks, and coordinating workflows across any domain"
mode: primary
temperature: 0.2
permission:
  bash:
    "*": "ask"
    "rm -rf *": "ask"
    "rm -rf /*": "deny"
    "sudo *": "deny"
    "> /dev/*": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
---
```

**Representative — `.opencode/agent/subagents/code/coder-agent.md`** (the `allow`-listed-command pattern):

```yaml
permission:
  bash:
    "*": "deny"
    "bash .opencode/skills/task-management/router.sh complete*": "allow"
    "bash .opencode/skills/task-management/router.sh status*": "allow"
  task:
    contextscout: "allow"
    externalscout: "allow"
    TestEngineer: "allow"
```

> ⚠️ Two failure modes visible in this one block:
> 1. The allowed bash commands **hardcode `.opencode/skills/...`** — a build-output path baked into
>    neutral content. See §3.4.
> 2. `task:` mixes **id-style** (`contextscout`) and **name-style** (`TestEngineer`) references in the
>    same map. The neutral `delegate:` map must pick one (canonical `id`) and the OpenCode adapter
>    must re-render to whatever OpenCode matches on. See §1.4.

### 1.2 The three-way naming problem (highest-risk aliasing)

For a single agent there are up to **four** distinct identifiers:

| Surface | Value | Source |
|---------|-------|--------|
| Registry / dependency id | `tester` | `registry.json#components.subagents[].id` |
| Filename | `test-engineer.md` | `.opencode/agent/subagents/code/test-engineer.md` |
| Frontmatter `name` | `TestEngineer` | the agent file |
| CC plugin name | `test-engineer` | `plugins/claude-code/agents/test-engineer.md` |

`agent-metadata.json` confirms the split:

```json
"tester": {
  "id": "tester", "name": "TestEngineer",
  "category": "subagents/code", "type": "subagent",
  "dependencies": ["context:standards-tests"]
}
```

…while `registry.json` maps that same id to a *differently named file*:

```json
{ "id": "tester", "name": "TestEngineer",
  "path": ".opencode/agent/subagents/code/test-engineer.md" }
```

**Class: 🔴 AT RISK.** A naive "filename = id" migration silently breaks every
`subagent:tester` dependency edge and every `task: { TestEngineer: allow }` permission entry.
The neutral schema needs an explicit `id` **plus** an `aliases[]` field, and the build must
emit an id→name→path map per target. See Open Question **Q1**.

### 1.3 `permission` → `capabilities` transform (the crown-jewel transform for agents)

OpenCode's `permission` is a **three-valued, glob-scoped, per-tool matrix**:

```
permission.<tool>.<glob-pattern> = "allow" | "ask" | "deny"
```

The neutral `capabilities` shape in `00-INDEX.md` is **flatter**:

```yaml
capabilities:
  read: allow
  edit: deny
  delegate: { contextscout: allow }
```

Concrete losses if the flat shape is adopted as-is:

| OpenCode construct | Example | Survives flat `capabilities`? |
|---|---|---|
| Tri-state `ask` | `bash: { "*": "ask" }` | ⚠️ Only if the enum is `allow\|ask\|deny`, **not** `allow\|deny`. Claude has no `ask` → maps to prompt-on-use or `deny`. |
| Glob scoping | `edit: { "**/*.env*": "deny" }` | ❌ **Lost.** Flat `edit: deny` cannot express "deny only secrets, allow the rest". |
| Deny-by-default + narrow allow | `bash: {"*":"deny", "bash .../router.sh complete*":"allow"}` | ❌ **Lost.** This is a *security control* on `coder-agent`. |
| Ordered precedence | `"*": "ask"` then `"rm -rf /*": "deny"` | ❌ **Lost.** Specificity/ordering semantics disappear. |

**Class: 🟡 OPENCODE-SPECIFIC, but 🔴 AT RISK of silent loss.**

**Adopted — Locked Decision #5 (v2, "Option A"):** `capabilities.<tool>` accepts **either** a
scalar (`allow|ask|deny`) **or** an ordered **rule list** of `{scope, decision}`:

```yaml
capabilities:
  bash:
    - { scope: "*",          decision: ask }
    - { scope: "sudo *",     decision: deny }
  edit:
    - { scope: "**/*.env*",  decision: deny }
    - { scope: "**/*",       decision: allow }
```

The scalar form is sugar for `[{scope: "*", decision: <v>}]`. The OpenCode adapter renders
this back losslessly; the Claude adapter collapses to a `tools:`/`disallowedTools:` allowlist
**and emits a warning naming each dropped glob rule**. This makes the loss *known and reported*,
per the `00-INDEX.md` principle. Q2 is **closed** by Locked Decision #5 (see `00-INDEX.md`,
which also fixes precedence as last-match-wins and absent-capability = tool default).

### 1.4 `permission.task` → `delegate`

`permission.task` is the **delegation graph** — which subagents an agent may call.

| Aspect | Detail | Class | Home |
|---|---|---|---|
| Delegation allowlist | `task: { contextscout: "allow" }` | 🟢 UNIVERSAL | `capabilities.delegate` |
| Delegation denylist | `task: { "*": "deny" }` (contextscout) | 🟢 UNIVERSAL | `capabilities.delegate` with `"*"` rule |
| Mixed id/name refs | `contextscout` vs `TestEngineer` | 🔴 AT RISK | Canonicalize to `id`; adapter re-renders. |
| Claude Code equivalent | CC has no per-agent delegation allowlist; it has `disallowedTools: Task` (all-or-nothing) | 🟡 | Claude adapter: any `delegate` entry ⇒ `Task` in `tools`; a `delegate` denylist ⇒ `Task` in `disallowedTools` **+ warning** that per-target granularity was dropped. |

### 1.5 Claude Code agent frontmatter (what the neutral schema must *also* feed)

`plugins/claude-code/agents/code-reviewer.md` uses a **different field set** that the neutral
schema must be able to produce:

```yaml
---
name: code-reviewer
description: |
  Review code for security vulnerabilities, correctness, and quality. Use after implementation is complete and before committing.
  Examples:
  <example>
  Context: coder-agent has finished implementing a new auth service.
  user: "The auth service is done, can you check it?"
  assistant: "I'll run the code-review skill to have code-reviewer validate it before we commit."
  <commentary>Implementation is complete — code-reviewer validates before commit.</commentary>
  </example>
tools: Read, Glob, Grep
disallowedTools: Write, Edit, Bash, Task
model: sonnet
---
```

| CC field | Neutral source | Class | Notes |
|---|---|---|---|
| `name` (kebab) | `id` | 🟢 | Adapter slugifies. |
| `description` (multiline + `<example>` blocks) | `description` + `examples[]` | 🟢 | **`examples[]` is a first-class neutral field** — CC folds it into `description`; OpenCode drops it. Today these examples exist **only** in the CC files and would be lost if `.opencode/` is treated as the sole migration source. |
| `tools` (allowlist) | `capabilities` allow-set | 🟢 | Derived. |
| `disallowedTools` | `capabilities` deny-set | 🟢 | Derived. |
| legacy `model:` | migration input → `inference.tier` | 🟡 MIGRATION ONLY | Scouts map to `fast`; other shipped agents map to `balanced`/default. Concrete names are discarded and never enter canonical content. |

> 🔴 **Preservation alert:** the `<example>` blocks in all 7 CC agents are hand-authored content
> that exists **nowhere in `.opencode/`**. If `/content/` is seeded only from `.opencode/`,
> **these are lost.** They must be harvested from `plugins/claude-code/agents/` into `examples[]`.

### 1.6 `0-category.json` — category descriptors

5 files, e.g. `.opencode/agent/core/0-category.json`:

```json
{
  "name": "Core Agents",
  "description": "System-level agents with Open branding - the Operating System",
  "icon": "⚙️",
  "agents": {
    "openagent": {
      "description": "Universal task coordinator",
      "commonSubagents": ["subagents/core/task-manager", "subagents/code/*"],
      "commonTools": ["gemini", "env"],
      "commonContext": ["core/essential-patterns", "core/workflows/*", "core/standards/*"]
    }
  }
}
```

| Field | What it does | Class | Home |
|---|---|---|---|
| `name`, `description`, `icon` | Category display metadata for install UX | 🔵 REGISTRY | `registry.json#categories[]` — **must gain `icon` + `order` + `status`**, which it lacks today. |
| `order` | Display sort (only in `subagents/development`) | 🔵 REGISTRY | `registry.json#categories[].order` |
| `status` | `active` (only in `subagents/development`) | 🔵 REGISTRY | `registry.json#categories[].status` |
| `agents.<id>.description` | Per-agent blurb — **duplicates** the agent's own `description` | 🔴 DUPLICATE | Delete; single-source from the agent file. |
| `agents.<id>.commonSubagents` | Suggested delegation targets, **supports `*` globs** | 🔴 AT RISK | Overlaps `dependencies` + `capabilities.delegate` but is **advisory, not enforced**. No consumer found. See **Q4**. |
| `agents.<id>.commonTools` | Suggested tools | 🔴 AT RISK | Same — no consumer found. |
| `agents.<id>.commonContext` | Suggested context, **supports `*` globs** | 🔴 AT RISK | Overlaps `context[]`. No consumer found. |

> **Finding:** `0-category.json` is **read by nothing** — no reference in `install.sh`,
> `registry.json`, or `scripts/`. It is *latent documentation*. Its category metadata
> (`icon`/`order`/`status`) is genuinely useful and **richer than `registry.json#categories`**
> (which is a flat `id: "description string"` map). Decision needed: promote or delete. See **Q4**.

### 1.7 `agent-metadata.json` sidecar

`.opencode/config/agent-metadata.json` — 28 entries + a `defaults` block.

```json
{
  "$schema": "https://opencode.ai/schemas/agent-metadata.json",
  "schema_version": "1.0.0",
  "agents": { "openagent": { "id": "openagent", "name": "OpenAgent", "category": "core",
    "type": "agent", "version": "1.0.0", "author": "opencode",
    "tags": ["universal", "coordination", "primary"],
    "dependencies": ["subagent:task-manager", "context:standards-code", ...] } },
  "defaults": {
    "agent":    { "version": "1.0.0", "author": "opencode", "type": "agent",    "tags": [] },
    "subagent": { "version": "1.0.0", "author": "opencode", "type": "subagent", "tags": [] }
  }
}
```

| Field | What it does | Class | Home |
|---|---|---|---|
| `id` | Canonical id (dependency-graph key) | 🟢 UNIVERSAL | Neutral `id` — **promote into the agent's own frontmatter**. |
| `name` | Display name | 🟢 UNIVERSAL | Neutral `name`. |
| `category` | Grouping. **Two incompatible formats:** `"core"` (flat) vs `"subagents/core"` (path) | 🔴 AT RISK | Neutral `category`. **Must normalize** — see **Q5**. |
| `type` | `agent` \| `subagent` | 🟢 UNIVERSAL | Redundant with `role`/`mode`. Collapse into `role`. |
| `version` | SemVer per agent (`1.0.0`, `task-manager` is `2.0.0`) | 🔵 REGISTRY | Neutral `version`; flows to registry. |
| `author` | Attribution (`opencode` for all 28) | 🔵 REGISTRY | Neutral `author`. Note: value `"opencode"` is a **tool name used as an author name** — rename to `oac`? **Q6**. |
| `tags` | Search/filter | 🟢 UNIVERSAL | Neutral `tags[]`. |
| `dependencies` | `subagent:x` / `context:y` edges | 🟢 UNIVERSAL | Neutral `dependencies[]`. **The crown jewel — see §7.** |
| `defaults.*` | Fallbacks when an entry omits fields | 🔵 REGISTRY | Build-time defaults in the Zod schema (`.default()`). |

> **The sidecar exists only because OpenCode's agent schema rejects unknown frontmatter keys.**
> That is an *OpenCode adapter constraint*, not a content constraint. In `/content/`, all of this
> belongs **in the agent's own frontmatter** (single file, single source). The OpenCode adapter
> then **splits** it back out into `agent-metadata.json` at build time — exactly as
> `00-INDEX.md` states ("Plus metadata split into `agent-metadata.json` sidecar").
>
> **This inverts today's authoring model** and is the single biggest ergonomic win of the refactor.

### 1.8 🔴 Agents with NO metadata and NO registry entry

Verified by set-difference between disk, `agent-metadata.json`, and `registry.json`:

| Agent | File | In metadata? | In registry? |
|---|---|---|---|
| `adr-manager` | `.opencode/agent/subagents/planning/adr-manager.md` | ❌ | ❌ |
| `architecture-analyzer` | `.opencode/agent/subagents/planning/architecture-analyzer.md` | ❌ | ❌ |
| `contract-manager` | `.opencode/agent/subagents/planning/contract-manager.md` | ❌ | ❌ |
| `prioritization-engine` | `.opencode/agent/subagents/planning/prioritization-engine.md` | ❌ | ❌ |
| `story-mapper` | `.opencode/agent/subagents/planning/story-mapper.md` | ❌ | ❌ |
| `stage-orchestrator` | `.opencode/agent/subagents/core/stage-orchestrator.md` | ❌ | ❌ |
| `test-engineer` | `.opencode/agent/subagents/code/test-engineer.md` | ⚠️ as `tester` | ⚠️ as `tester` |
| `batch-executor` | `.opencode/agent/subagents/core/batch-executor.md` | ✅ | ❌ **registry only** |

**6 agents are entirely invisible to the installer** — they ship in the repo but no profile can
install them. The whole `subagents/planning/` category (5 agents) plus `stage-orchestrator` are
orphans, despite `.opencode/docs/agents/planning-agents-guide.md` and
`.opencode/skill/project-orchestration/workflows/planning-agents.md` documenting them as a
feature.

**Migration decision required:** are these (a) real features to be registered, or (b) dead code
to be deleted? Silently carrying them into `/content/` re-creates the mess. See **Q7**.

---

## 2. Commands

20 markdown commands under `.opencode/command/` (+9 `.yaml` eval templates counted in the "29").

### 2.1 Frontmatter fields in use

| Field | Occurrences | What it does | Class | Home |
|---|---|---|---|---|
| `description` | 18 | Command purpose; shown in the picker | 🟢 UNIVERSAL | `description` |
| `tags` | 3 | Search/filter | 🟢 UNIVERSAL | `tags[]` |
| `dependencies` | 3 | `subagent:` / `context:` edges | 🟢 UNIVERSAL | `dependencies[]` |
| `id`,`name`,`type`,`category`,`version` | 1 | Only `analyze-patterns.md` inlines these | 🔵 REGISTRY | Neutral frontmatter (same inversion as agents). |
| `mode`,`temperature`,`tools`,`permissions` | 2 | **Only in `new-agents/README.md` and `templates/agent-template.md`** | 🔵 NOT COMMANDS | These are *agent templates* misfiled under `command/`. See §2.3. |

**Two commands carry no frontmatter at all** beyond `description` — the minimum viable command
is literally `description:` + a markdown body.

**Representative — `.opencode/command/context.md`** (block-style deps):

```yaml
---
description: Context system manager - harvest summaries, extract knowledge, organize context
tags:
  - context
  - knowledge-management
  - harvest
dependencies:
  - subagent:context-organizer
  - subagent:contextscout
---
```

**Representative — `.opencode/command/add-context.md`** (flow-style tags + **path-style deps**):

```yaml
---
description: Interactive wizard to add project patterns using Project Intelligence standard
tags: [context, onboarding, project-intelligence, wizard]
dependencies:
  - subagent:context-organizer
  - context:core/context-system/standards/mvi.md
  - context:core/context-system/standards/frontmatter.md
  - context:core/standards/project-intelligence.md
---
```

> 🔴 **Critical inconsistency.** `add-context.md` uses **full-path** context refs
> (`context:core/context-system/standards/mvi.md`, with `.md`), while `agent-metadata.json`
> uses **short-id** refs (`context:standards-code`). Both are fed to the same
> `resolve_dependencies()`. See §7.3 — this is a **live bug**, not just a style nit.

### 2.2 Command body structure

Bodies are **prompt templates** using a house XML-ish DSL. From `.opencode/command/context.md`:

```markdown
<critical_rules priority="absolute" enforcement="strict">
  <rule id="mvi_strict">
    Files MUST be <200 lines. Extract core concepts only ...
  </rule>
  <rule id="lazy_load">
    ALWAYS read required context files from .opencode/context/core/context-system/ BEFORE executing operations.
  </rule>
</critical_rules>

<execution_priority>
  <tier level="1" desc="Safety & MVI"> ... </tier>
  <tier level="2" desc="Core Operations"> ... </tier>
</execution_priority>
```

| Feature | Class | Home |
|---|---|---|
| Markdown body as prompt | 🟢 UNIVERSAL | Neutral body (verbatim). |
| `<critical_rules>` / `<rule id=… enforcement=…>` DSL | 🟢 UNIVERSAL | Body prose — **passes through untouched**. Not schema. |
| `<execution_priority>` / `<tier>` DSL | 🟢 UNIVERSAL | Body prose — passes through. |
| `@rule.id` cross-references (e.g. `@critical_rules.mvi_strict`) | 🟢 UNIVERSAL | Body prose. |
| Hardcoded `.opencode/context/...` inside bodies | 🔴 **AT RISK** | **11 command files** embed `.opencode/` paths in prose. See §3.4. |

> The body DSL is **tool-agnostic prose** — it works because LLMs read it, not because
> OpenCode parses it. It needs **zero** adapter work. Good news: the highest-value content
> (the actual prompt engineering) is already portable.

### 2.3 🔴 Misfiled agent templates

`.opencode/command/openagents/new-agents/` is **not commands**. It contains:

- `templates/agent-template.md` — an *agent* scaffold with `mode`/`temperature`/`tools`/`permissions`
- `templates/context-template.md` — a *context* scaffold
- `templates/test-{1..8}-*.yaml` + `test-config-template.yaml` — **9 eval scenario templates**
  (planning-approval, context-loading, incremental, tool-usage, error-handling,
  extended-thinking, compaction, completion)
- `create-agent.md`, `create-tests.md`, `README.md` — the actual commands

The 8 numbered YAML tests encode **OAC's agent quality bar** (every new agent should pass these
8 scenarios). This is real IP filed in the wrong place and **not in the registry**.

| Item | Class | Home |
|---|---|---|
| `create-agent.md`, `create-tests.md` | 🟢 UNIVERSAL | `/content/commands/` |
| `agent-template.md`, `context-template.md` | 🔵 BUILD | Scaffolding templates → `/packages/cli` templates (used by `oac add`). |
| `test-{1..8}-*.yaml` | 🔴 AT RISK | Belongs with `/evals`. Not registered, not run by CI as far as can be seen. See **Q8**. |

---

## 3. Context System — **DEEP DIVE** 🏆

> This is OAC's crown jewel and the most at-risk asset: **297 entries (294 files + 3
> symlinks), 75 navigation hubs, 194 registry entries, and a metadata convention that is
> not YAML frontmatter.**

### 3.1 Context metadata is an HTML comment, not frontmatter

Standard defined in `.opencode/context/core/context-system/standards/frontmatter.md`:

```markdown
<rule id="frontmatter_required" enforcement="strict">
  ALL context files MUST start with:

  <!-- Context: {category}/{function} | Priority: {level} | Version: X.Y | Updated: YYYY-MM-DD -->
</rule>
```

Live example — `.opencode/context/core/standards/code-quality.md` line 1:

```markdown
<!-- Context: standards/code | Priority: critical | Version: 2.0 | Updated: 2025-01-21 -->
```

| Component | Values | What it does | Class | Home |
|---|---|---|---|---|
| `Context: {category}/{function}` | `standards/code`, `core/mvi`, … | Dual taxonomy: **category** = domain, **function** = file type (`concepts`/`examples`/`guides`/`lookup`/`errors`) | 🟢 UNIVERSAL | Neutral `category` + `function`. |
| `Priority` | `critical` \| `high` \| `medium` \| `low` | **Load-ordering + budget signal.** Documented distribution: critical=80% of use cases, high=15%, medium=4%, low=1%. | 🟢 UNIVERSAL | Neutral `priority` — **already in the `00-INDEX.md` worked example** (`context: [{path, priority}]`). |
| `Version` | `X.Y` | Change tracking | 🟢 UNIVERSAL | Neutral `version`. ⚠️ **`X.Y`, not SemVer `X.Y.Z`** — conflicts with agent `version: 1.0.0`. See **Q9**. |
| `Updated` | `YYYY-MM-DD` | Staleness signal; "must match metadata section" | 🟢 UNIVERSAL | Neutral `updated`. |

> **Why an HTML comment and not YAML?** Because context files are **read as prose by agents**.
> A `<!-- -->` header renders invisibly in every markdown viewer while staying machine-parseable.
> YAML frontmatter would display as a table or raw text in some renderers.
>
> **Migration risk 🔴:** a generic markdown/frontmatter parser (e.g. `gray-matter`) will find
> **no frontmatter** on 286 of the 296 context `.md` files (leading-window count, symlinks
> included; 3 are dual-format YAML+MVI, 7 carry neither — see `00-INDEX` decision #6) and
> treat `Priority`/`Version`/`Updated` as body text.
> **All priority information silently vanishes**, and priority is what drives context ordering.
> The neutral parser **must** implement a dedicated HTML-comment reader. This is the single
> most likely way the refactor silently destroys the crown jewel. See **Q10**.

**Compliance is not universal.** The frontmatter-key census over non-navigation context files
shows only ~16 files with a `description:` key and a long tail of *false positives* — lines like
`Agent:`, `User:`, `Voice:`, `--text-muted:`, `curl:` matched as "frontmatter keys" because they
are **body content** (dialogue transcripts, CSS variables, code samples). Real finding:
**most context files carry only the HTML-comment header**, and exactly 3 files
(`core/standards/csharp.md`, `core/standards/csharp-project-structure.md`,
`openagents-repo/quality/registry-dependencies.md`) additionally open with YAML frontmatter —
**dual-format**, since each still carries an MVI marker at line 11 (see `00-INDEX` decision #6).
**Two metadata conventions coexist in one tree.** See **Q10**.

### 3.2 `navigation.md` — the discovery backbone

**75 `navigation.md` files** — one per directory, at every level. This is a **hand-maintained
routing tree**, not an index generated from the filesystem.

Root — `.opencode/context/navigation.md`:

```markdown
<!-- Context: core/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->
# Context Navigation

**New here?** → `openagents-repo/quick-start.md`

## Structure
.opencode/context/
├── core/                   # Universal standards & workflows
├── openagents-repo/        # OpenAgents Control repository work
...

## Quick Routes
| Task | Path |
|------|------|
| **Write code** | `core/standards/code-quality.md` |
| **Review code** | `core/workflows/code-review.md` |
| **Delegate task** | `core/workflows/task-delegation-basics.md` |
```

| Feature | What it does | Class | Home |
|---|---|---|---|
| Per-directory `navigation.md` | Human+agent routing hub | 🟢 UNIVERSAL | Neutral content, verbatim. |
| **Task→path "Quick Routes" table** | **Intent-based routing** — the actual discovery mechanism | 🟢 UNIVERSAL | Verbatim. This is *the* feature. |
| Registry id `root-navigation` | Makes the root hub installable | 🔵 REGISTRY | Registry entry. |
| Directory-tree ASCII diagram | Orientation | 🔴 AT RISK | **Hardcodes `.opencode/context/`** — wrong after any rename. |
| Relative path links (`core/navigation.md`) | Chain traversal | 🟢 UNIVERSAL | Portable **because relative**. |

> **Design insight worth preserving explicitly:** navigation uses **relative** links between
> hubs (`core/navigation.md`) but the *root* hub hardcodes the absolute tree
> (`.opencode/context/`). So the **chain is portable; only the entry point is not.** The adapter
> only needs to rewrite the root, not all 75. This is a much smaller job than it first appears —
> and worth stating so nobody "fixes" all 75 files.

### 3.3 Context discovery / loading — the runtime chain

Two *different* discovery systems exist today.

**(a) OpenCode: `paths.json` + `@`-reference.** `.opencode/context/core/config/paths.json`:

```json
{
  "description": "Additional context file paths - agents load this via @ reference for dynamic pathing",
  "paths": { "local": ".opencode/context", "global": "~/.config/opencode/context" }
}
```

| Feature | Class | Home |
|---|---|---|
| local + global context roots | 🟢 UNIVERSAL | Neutral config; adapter rewrites values per tool. |
| Registry id `context-paths-config` | 🔵 REGISTRY | Registry entry — **the only non-`.md` context component** (fixed by PR #252 per git log; the `expand_context_wildcard` `sub("\\.md$";"")` strips `.md`, so a `.json` context is a special case). |
| `@`-reference loading | 🟡 OPENCODE-SPECIFIC | OpenCode's `@file` syntax. Claude uses the session-start hook instead (§9.2). |

**(b) Claude Code: `.oac.json` + a documented protocol.**
`plugins/claude-code/skills/context-discovery/context-discovery-protocol.md`:

```
.oac.json exists?  YES → read context.root → done (fast path)
                   NO  → run discovery chain
                          Found?  YES → signal main agent to write .oac.json (if project-local)
                                  NO  → return setup tips
```

```json
{ "version": "1", "context": { "root": ".claude/context" } }
```

| Feature | What it does | Class | Home |
|---|---|---|---|
| `.oac.json` fast path | Cache the resolved context root | 🟢 UNIVERSAL | **Should be the neutral, cross-tool mechanism.** |
| Discovery chain fallback | Find context root heuristically | 🟢 UNIVERSAL | Neutral. |
| `navigation.md` presence = validity check | "if `context.root` has no `navigation.md`, warn and fall through" | 🟢 UNIVERSAL | Neutral. Ties (a) and (b) together. |
| Self-healing (write `.oac.json` on discovery) | Fast path next session | 🟢 UNIVERSAL | Neutral. |
| "Single source of truth for all context root discovery" | Referenced by `context-scout` agent, `context-discovery` skill | 🟢 UNIVERSAL | Neutral doc. |

> 🔴 **These two systems are unaware of each other.** `paths.json` says the root is
> `.opencode/context`; `.oac.json` says `.claude/context`. There is no shared abstraction.
> The refactor should **unify on the `.oac.json` protocol** (it is strictly better: fast path,
> fallback chain, validity check, self-healing) and have `paths.json` become an
> OpenCode-adapter-generated artifact. **The CC protocol is the more mature design and must not
> be discarded just because it lives in the "drifted" plugin.** See **Q11**.

### 3.4 🔴 Hardcoded `.opencode/` paths in content bodies — the migration's biggest mechanical risk

Counted by `grep -rl '\.opencode/'`:

| Area | Files containing `.opencode/` in body | Worst offenders |
|---|---|---|
| Agents | **31 / 34** | `openagent.md` (31 refs), `task-manager.md` (23), `context-retriever.md` (23), `repo-manager.md` (19) |
| Context docs | **73** | across the tree |
| Skills | **14** | routers + SKILL.md |
| Commands | **11** | `context.md` et al. |
| **Total** | **~129 files** | |

Example — `.opencode/agent/core/openagent.md`:

```
- Code tasks → .opencode/context/core/standards/code-quality.md
- Docs tasks → .opencode/context/core/standards/documentation.md
...
- code (write/edit code) → Read .opencode/context/core/standards/code-quality.md NOW
```

**Why this matters:** `00-INDEX.md` says bodies are "authored once" in `/content/`. But a body
containing `.opencode/context/...` is **not neutral** — it instructs the agent to read a path
that only exists in the OpenCode build output. On the Claude target, context lives at
`.claude/context/`, so **every one of those instructions points at a non-existent file.**

This is almost certainly *already broken* in `plugins/claude-code/` today and is a strong
candidate for why the CC plugin was hand-rewritten rather than generated.

| Option | Approach | Trade-off |
|---|---|---|
| **A. Token substitution** | Author `{{CONTEXT_ROOT}}/core/standards/code-quality.md`; adapters substitute. | Explicit, greppable, verifiable. Requires touching ~129 files once. |
| **B. Adapter rewrite** | Adapters regex-replace `.opencode/context/` → target root. | Zero content churn; brittle, silent when it misses a variant. |
| **C. Runtime indirection** | Bodies reference *ids* (`context:standards-code`); agent resolves via the discovery protocol. | Cleanest, most portable; largest rewrite; adds runtime lookup. |

**Recommendation:** **A** for paths + **C** long-term for dependencies. A is mechanical,
one-time, and testable with a lint rule (`no raw .opencode/ in /content/`). See **Q12**.

### 3.5 🔴 Context registry coverage gaps

Computed by set-difference between disk and `registry.json#components.contexts`:

| Metric | Count |
|---|---|
| Context entries on disk (files + symlinks) | **297** |
| Registry context entries | **194** (191 unique paths) |
| On disk but **NOT** in registry | **106** |
| In registry but **NOT** on disk (broken) | **0** ✅ |
| `navigation.md` on disk | **75** |
| `navigation.md` in registry (unique paths) | **33** |

**42 of 75 navigation hubs are unregistered** ⇒ installing a context subtree can produce a
directory whose `navigation.md` was never installed ⇒ **the discovery chain dead-ends**, and the
`.oac.json` protocol's "no `navigation.md` ⇒ invalid root" check then rejects a root that *is*
correct. This is a **silent, in-the-field breakage of the crown jewel**.

Unregistered examples: `.opencode/context/CODEBASE_STANDARDS.md`,
`.opencode/context/content-creation/**/navigation.md` (all 5),
`.opencode/context/core/context-system/{examples,guides,operations,standards}/navigation.md`,
`.opencode/context/core/context-system/standards/typescript-coding.md`.

**Migration requirement:** the build must **generate** registry context entries from disk, not
hand-maintain them. A `navigation.md` must be **auto-included** whenever any file in its
directory is installed (a structural dependency, not a declared one). See **Q13**.

### 3.6 🔴 Registry context duplicates (live bugs)

**Three files have two ids each** (alias-by-duplication instead of the `aliases[]` field):

| Path | ids |
|---|---|
| `core/standards/code-quality.md` | `standards-code` **and** `code-quality` |
| `core/standards/test-coverage.md` | `standards-tests` **and** `test-coverage` |
| `core/standards/documentation.md` | `standards-docs` **and** `documentation` |

⇒ `resolve_dependencies` can add **both** ids for the same file, and `install.sh` will copy it
twice. These are also **the same three files targeted by the 3 context symlinks**
(`core/standards/{code,docs,tests}.md` — see `00-INDEX` v2.2): collapsing to `aliases[]` must
also convert the symlinks and fix the 3 files that reference the alias paths directly.
Meanwhile a proper `aliases[]` field **does exist** and is used by exactly 3 entries
(`feature-breakdown → workflows-task-breakdown`, `session-management → workflows-sessions`,
`component-planning → workflows-component-planning`). **Two mechanisms for one concept.**

**Three duplicate ids** also exist within `components.contexts`: **`agents`**, **`ui-navigation`**,
**`context-bundle-template`**. Since `resolve_dependencies` matches with
`select(.id == "…")` and jq returns **all** matches, a dependency on any of these emits
**multiple paths** — nondeterministic install behavior.

**Requirement:** neutral schema enforces **unique `id`**, aliases go in `aliases[]` only, and the
build **fails** on duplicates. This is a test the minimal-test-first slice should include.

### 3.7 Context sub-features worth naming explicitly

| Feature | Where | Class | Home |
|---|---|---|---|
| **MVI principle** | `core/context-system/standards/mvi.md` | 🟢 UNIVERSAL | Neutral content. Formula: Core Concept (1-3 sentences) → Key Points (3-5 bullets) → Quick Example (5-10 lines) → Reference Link → Related Files. "Scannable in <30 seconds." |
| **<200-line rule** | enforced in `command/context.md` `<rule id="mvi_strict">` | 🟢 UNIVERSAL | Neutral + **lintable**. Candidate `oac doctor` check. |
| **Function-based structure** | `concepts/ examples/ guides/ lookup/ errors/` | 🟢 UNIVERSAL | Neutral convention; visible across `mastra-ai/`, `openagents-repo/`, `ui/web/design/`. |
| Structure/templates/codebase-reference standards | `core/context-system/standards/{structure,templates,codebase-references}.md` | 🟢 UNIVERSAL | Neutral. |
| Context **operations** | `core/context-system/operations/{harvest,extract,organize,update,migrate,error}.md` | 🟢 UNIVERSAL | Neutral. The verbs behind `/context`. |
| Context **guides** | `.../guides/{compact,creation,organizing-context,workflows,navigation-design-basics,navigation-templates}.md` | 🟢 UNIVERSAL | Neutral. |
| Context-system **CHANGELOG** | `core/context-system/CHANGELOG.md` | 🟢 UNIVERSAL | Neutral. |
| Task JSON schemas | `context/tasks/schemas/{task,subtask}-schema.json` | ⚠️ **NOT ON DISK** | Cited by v1's census; **no such files exist on disk** (and none appear in git history). `paths.json` is the **only** non-`.md` context file. Dropped from the census — retained here so the discrepancy stays visible. |
| `index.md` (root) | `.opencode/context/index.md` | 🟢 UNIVERSAL | Neutral. Note: **`index.md` AND `navigation.md` both at root** — overlapping entry points. **Q14**. |
| Project Intelligence standard | `core/standards/project-intelligence.md`, `context/project-intelligence/` | 🟢 UNIVERSAL | Neutral. Driven by `/add-context`. |
| `CONTEXT_SYSTEM_GUIDE.md` (16KB, repo root) | root | 🟢 UNIVERSAL | **Outside `.opencode/`** — easily missed by a `.opencode/`-only migration. |

---

## 4. Skills

### 4.1 Format

A skill = `SKILL.md` (frontmatter + body) + optional `router.sh` + `scripts/` + `workflows/` + `tests/`.

```yaml
---
name: task-management
description: Task management CLI for tracking and managing feature subtasks with status, dependencies, and validation
version: 1.0.0
author: opencode
type: skill
category: development
tags: [tasks, management, tracking, dependencies, cli]
---
```

| Field | Class | Home |
|---|---|---|
| `name` | 🟢 UNIVERSAL | `id`/`name`. **Already kebab-case in both OpenCode and CC** — skills need no slugify transform. |
| `description` | 🟢 UNIVERSAL | `description`. **Load-bearing at runtime:** CC's `session-start.sh` greps `^description:` to build the skill catalogue. |
| `version`, `author`, `type`, `category`, `tags` | 🔵 REGISTRY | Neutral frontmatter → registry. **Skills already inline their metadata** — no sidecar. **This is the model agents should follow** (§1.7). |
| `router.sh` | 🟡 | Bash entrypoint; adapter must preserve the executable bit + `files[]`. |
| `scripts/*.ts` | 🟡 | Bun/TS runtime. See §4.4. |
| `workflows/*.md` | 🟢 UNIVERSAL | Prose. |
| `tests/*.test.ts` | 🔵 BUILD | Should move to `/evals` or a package test dir. |

> **Skills are the most portable content type in the repo**: kebab ids, self-contained metadata,
> `SKILL.md` convention identical across OpenCode and Claude Code. The skill adapter is mostly
> `cp` + `files[]` bookkeeping.

### 4.2 Multi-file skills need `files[]`

Skills are the **only** component type using the registry `files[]` field:

```json
{ "id": "task-management", "path": ".opencode/skills/task-management/SKILL.md",
  "files": [".opencode/skills/task-management/SKILL.md",
            ".opencode/skills/task-management/router.sh",
            ".opencode/skills/task-management/scripts/task-cli.ts"] }
```

| Registry `files[]` count | Actual disk files | |
|---|---|---|
| `task-management` | 3 | 3 ✅ |
| `context-manager` | 2 | 2 ✅ |
| `context7` | 4 | 4 ✅ |
| `smart-router-skill` | 6 | 6 ✅ |

Hand-maintained but currently **accurate**. Should be **generated** (glob the skill dir) so it
cannot drift. 🔵 BUILD.

### 4.3 🔴 `skill/` vs `skills/` — an orphaned directory

**Two sibling directories exist.** The registry only knows `.opencode/skills/` (plural).

| Path | In registry? | Contents |
|---|---|---|
| `.opencode/skills/` (plural) | ✅ 4 skills | task-management, context-manager, context7, smart-router-skill |
| `.opencode/skill/project-orchestration/` | ❌ **orphan** | `SKILL.md`, `router.sh`, 3 scripts (`context-index.ts`, `session-context-manager.ts`, `stage-cli.ts`), 3 workflows (`8-stage-delivery.md`, `context-handoff.md`, `planning-agents.md`) |
| `.opencode/skill/task-management/tests/` | ❌ **orphan** | `enhanced-schema.test.ts`, `line-number-validation.test.ts` — tests **split from** the skill in `skills/` |

`project-orchestration` is a **fully-built, uninstallable skill** — with an 8-stage delivery
workflow and a stage CLI. It pairs with the 6 unregistered planning agents (§1.8): the
`planning-agents.md` workflow references exactly the `subagents/planning/` agents that have no
registry entry. **An entire orchestration feature is dark.**

Likewise `.opencode/skill/task-management/tests/` are the tests for
`.opencode/skills/task-management/` — the same skill, split across two directory names.

**Decision required:** ship `project-orchestration` + planning agents as a feature, or delete
both. They are coupled — decide together. See **Q7**.

### 4.4 🔴 Runtime dependency: Bun/TypeScript

`.opencode/skills/task-management/scripts/task-cli.ts`, `.opencode/scripts/task-cli.ts`,
`.opencode/skill/project-orchestration/scripts/*.ts`, and every `router.sh` shell out to a
TypeScript runtime. `.opencode/{package.json,bun.lock,node_modules}` and
`.opencode/tool/{package.json,tsconfig.json,bun.lock}` confirm **Bun**.

For npm distribution (`04-cli-build-distribution.md`), this is a real constraint: an installed
OAC skill requires Bun on the user's machine. Cross-platform (Windows) `router.sh` is a further
problem. Flagging for Agent D. See **Q15**.

### 4.5 🔴 CC has 12 skills; OpenCode has 4

`plugins/claude-code/skills/`: `code-execution`, `code-review`, `context-discovery`,
`context-setup`, `debugger`, `external-research`, `oac-approach`, `parallel-execution`,
`task-breakdown`, `test-generation`, `using-oac`, `verification-before-completion`.

**Only `context-manager`/`context7`/`task-management`/`smart-router-skill` exist on the OpenCode
side, and none of those 4 names appear in CC.** The two skill sets are **disjoint**.

These 12 CC skills are the **primary UX of the shipped plugin** (they are what the
`session-start.sh` catalogue advertises, and what this very repo's tooling exposes as
`oac:code-review`, `oac:task-breakdown`, …). They are **not derivable from `.opencode/`**.

🔴 **If `/content/` is seeded only from `.opencode/`, all 12 are lost.** They must be harvested
from `plugins/claude-code/skills/` — and arguably they, not the OpenCode 4, are the better
starting point. See **Q16**.

---

## 5. Tools

`.opencode/tool/` — TypeScript modules.

| Item | Path | Registry | Class | Home |
|---|---|---|---|---|
| `env` | `.opencode/tool/env/index.ts` | ✅ `tool:env` | 🟡 | Loads `.env` from a search-path list (`./.env`, `../.env`, `../../.env`, `../plugin/.env`, …). Exports `loadEnvVariables(config)`. |
| `gemini` | `.opencode/tool/gemini/index.ts` | ✅ `tool:gemini`, `dependencies: ["tool:env"]` | 🟡 | Image gen/edit/analysis. **The only tool→tool dependency in the registry.** |
| `template` | `.opencode/tool/template/index.ts` + `README.md` | ❌ | 🔵 BUILD | Scaffold for new tools → CLI template. |
| `index.ts` | `.opencode/tool/index.ts` | ❌ | 🟡 | Barrel export. |
| `.opencode/tool/.env` | — | 🔵 BUILD HYGIENE | **Untracked local file, gitignored** (`.gitignore:9-13`; `git ls-files` matches no `.env`). Q17 **closed** — not a security incident. Only rule: a globbing build must never sweep local `.env` files into `/content/` or any output. |
| `package.json`/`tsconfig.json`/`bun.lock` | — | 🔵 BUILD | Tool workspace config. |

**Class overall: 🟡 OPENCODE-SPECIFIC.** Tools implement the OpenCode plugin/tool API. Claude
Code has no equivalent user-defined "tool" primitive (its analogue is an MCP server). The tool
adapter is either (a) OpenCode-only with a "not supported" warning for other targets, or
(b) tools get re-expressed as MCP servers. Big scope call — see **Q18**.

---

## 6. Plugins & Hooks

Two directories again (`plugin/` singular, `plugins/` plural).

| Item | Path | Registry | Class | Notes |
|---|---|---|---|---|
| `notify` | `.opencode/plugin/notify.ts` | ✅ `plugin:notify` | 🟡 | Hooks OpenCode's `event` with `session.idle` → `say "Your code is done!"`. **Ships disabled** (`const ENABLED = false`). |
| `agent-validator` | `.opencode/plugin/agent-validator.ts` | ❌ | 🔴 | **Also present as `agent-validator.ts.disabled`** — two copies, neither registered. Has `docs/VALIDATOR_GUIDE.md` + `tests/validator/{test-validation.sh,test-validator.sh,interactive.md}`. |
| `coder-verification` | `.opencode/plugins/coder-verification/` | ❌ | 🔴 | Own `plugin.json` (name/description/version/author), `index.ts`, `README.md`, `IMPLEMENTATION_SUMMARY.md`. "Reminds about checks and auto-completes tasks" for CoderAgent. **Unregistered.** |
| `.opencode/plugin/.env` | — | 🔵 BUILD HYGIENE | Second **untracked, gitignored** local `.env` — not a security issue (Q17 closed). Same build-hygiene rule as `.opencode/tool/.env` (§5). |

**Findings:**
- **Hooks exist only as plugins in OpenCode** — there is no `hooks:` frontmatter field anywhere
  (§1.1 confirmed 0 occurrences). OpenCode hooks = a plugin exporting an `event` handler.
  Claude Code hooks = declarative `hooks.json` (§9.2). **These models are fundamentally different**
  (imperative TS callback vs declarative JSON→shell command).
- `plugin.json` (in `plugins/coder-verification/`) has **the same shape** as
  `plugins/claude-code/.claude-plugin/plugin.json` — name/description/version/author. A neutral
  plugin-manifest schema could cover both.
- The registry knows about **1 of 3** plugins.

**Class: 🟡 OPENCODE-SPECIFIC**, and the **hook model is 🔴 AT RISK** — there is no neutral
abstraction that covers both an OpenCode TS `event` callback and a CC `SessionStart` shell hook.
Agent C must decide whether `hooks` is a neutral content type at all, or purely per-adapter.
See **Q19**.

---

## 7. Dependency Resolution — **DEEP DIVE** 🏆

> The second crown jewel. This is what makes `oac add code-reviewer` pull in the right context
> and subagents. It drives installation.

### 7.1 The reference grammar

Dependencies are strings of the form `<type>:<id>`:

```
subagent:contextscout
context:standards-code
tool:env
context:core/*                                        ← wildcard
context:core/context-system/standards/mvi.md          ← full path with extension
```

Declared in **three** places:
1. `registry.json#components.<type>[].dependencies[]` — **what `install.sh` actually reads**
2. `.opencode/config/agent-metadata.json#agents.<id>.dependencies[]` — parallel copy
3. Command frontmatter `dependencies:` — e.g. `add-context.md`, `context.md`

### 7.2 The algorithm (`install.sh:420-481`)

```bash
resolve_dependencies() {
    local component=$1
    local type="${component%%:*}"        # left of first ':'
    local id="${component##*:}"          # right of last ':'
    registry_key=$(get_registry_key "$type")     # singular → plural

    deps=$(jq_exec ".components.${registry_key}[] \
      | select(.id == \"${id}\" or (.aliases // [] | index(\"${id}\"))) \
      | .dependencies[]?" "$TEMP_DIR/registry.json")

    for dep in $deps; do
        if [[ "$dep" == *"*"* ]] && [ "$dep_type" = "context" ]; then
            matched=$(expand_context_wildcard "$dep_id")
            # add each match if not already selected, then recurse
        fi
        # add dep if not already in SELECTED_COMPONENTS, then recurse
    done
}
```

| Property | Behavior | Class |
|---|---|---|
| **Recursive transitive closure** | Yes — recurses into each newly added dep | 🟢 UNIVERSAL |
| **Cycle safety** | **Implicit** — recursion only fires when the dep was *not* already in `SELECTED_COMPONENTS`, so a cycle terminates. Never *detected* or reported. | 🟡 Fragile |
| **Dedupe** | Linear scan of `SELECTED_COMPONENTS` before add (O(n²), fine at this scale) | 🔵 BUILD |
| **Alias resolution** | `.id == id or (.aliases // []) | index(id)` | 🟢 UNIVERSAL |
| **Wildcard expansion** | **`context:` only**; `expand_selected_components` prints `"Wildcard only supported for context components"` otherwise | 🟢 UNIVERSAL |
| **Missing dep handling** | `jq … || echo ""` ⇒ an **unknown id resolves to zero deps, silently**. No "unknown component" error. | 🔴 **AT RISK** |
| **Type↔registry-key mapping** | `get_registry_key()`: `agent→agents`, `context→contexts`, `skill→skills`, `config→config` (special: stays singular), `*s→as-is`, default `+s` | 🟡 |
| **Install path mapping** | `get_install_path()`: strips `.opencode/` prefix, prepends `$INSTALL_DIR` | 🟡 → adapter |

**Wildcard expansion (`install.sh:361-371`):**

```bash
expand_context_wildcard() {
    prefix="${pattern%%\**}"; prefix="${prefix%/}"; [ -n "$prefix" ] && prefix="${prefix}/"
    jq_exec ".components.contexts[]? | select(.path | startswith(\".opencode/context/${prefix}\"))
             | .path | sub(\"^\\\\.opencode/context/\"; \"\") | sub(\"\\\\.md$\"; \"\")"
}
```

| Detail | Consequence |
|---|---|
| `*` is a **prefix match**, not a glob | `core/*` matches `core/**` recursively too. `ui/web/a*` would match anything starting `ui/web/a`. **Not real glob semantics.** |
| `sub("\\.md$"; "")` strips the extension | A **non-`.md` context** (`paths.json` — the only one on disk) survives wildcard expansion **with its extension intact**, producing id `core/config/paths.json` — which then must match a registry `id`. This is exactly the class of bug PR #252 ("resolve non-.md context paths like paths.json") fixed. 🔴 |
| Matches on **`path`**, emits a **path-derived id** | So wildcards produce **path-style** ids while hand-written deps use **short-style** ids. Two id namespaces in one list. 🔴 |

### 7.3 🔴 The dual-namespace bug

`resolve_dependencies` matches **`.id`**, but wildcards and some hand-written deps supply
**paths**:

| Reference | Form | Resolves? |
|---|---|---|
| `context:standards-code` | short id | ✅ matches `.id == "standards-code"` |
| `context:core/*` | wildcard → `core/standards/code-quality` … | ⚠️ produces **path-style** strings; the *next* recursion looks for `.id == "core/standards/code-quality"` — **no such id** ⇒ **its dependencies are silently skipped** |
| `context:core/context-system/standards/mvi.md` (`add-context.md`) | full path **with `.md`** | ❌ **no registry entry has that as `.id`** ⇒ **silently resolves to nothing** |

So `/add-context`'s three declared context dependencies — the MVI standard, the frontmatter
standard, and the project-intelligence standard, i.e. **exactly the docs the command tells the
agent to follow** — **almost certainly do not install today.** Because `jq` failure is swallowed
by `|| echo ""`, there is no error.

**Requirement for the neutral schema:** ONE reference form. Recommend canonical **`<type>:<id>`
with unique ids**, plus `aliases[]`, plus a build-time validation pass that **fails** on an
unresolvable reference. The "silently resolves to nothing" behavior is the single most dangerous
property of the current system and the easiest thing to lose *and not notice* during migration.
See **Q20**.

### 7.4 Structural (undeclared) dependencies

Not expressible today; must be **inferred** by the build:

| Implicit dependency | Why | Today |
|---|---|---|
| context file → its dir's `navigation.md` | Discovery chain dead-ends without it | ❌ **not declared** — 42 hubs unregistered (§3.5) |
| context file → parent `navigation.md` … → root `navigation.md` | Chain traversal from the root | ❌ not declared |
| agent → `agent-metadata.json` | The sidecar carries its metadata | ⚠️ `config:agent-metadata` in some profiles |
| skill → `files[]` | Multi-file skills | ✅ via `files[]` |
| agent → `context-paths-config` | `@`-reference loading | ⚠️ only in `.opencode/profiles/*/profile.json`, **not** in `registry.json#profiles` (§8.2) |
| tool `gemini` → `tool:env` | Reads API key | ✅ declared |
| CC agent → its plugin skills | `code-reviewer` says "I'll run the code-review skill" | ❌ not declared |

**Requirement:** the build **auto-includes the navigation chain** for every installed context
file. This is a structural rule, not a declared edge.

---

## 8. Registry (`registry.json`, 107KB) — **the installation driver**

### 8.1 Schema

```json
{
  "version": "2.0.0",
  "schema_version": "2.0.0",
  "repository": "https://github.com/darrenhinde/OpenAgentsControl",
  "categories": { "essential": "…", "standard": "…", "extended": "…",
                  "specialized": "…", "meta": "…" },
  "components": { "agents": [], "subagents": [], "commands": [], "tools": [],
                  "plugins": [], "skills": [], "contexts": [], "config": [] },
  "profiles":  { "essential": {}, "developer": {}, "business": {}, "full": {}, "advanced": {} },
  "metadata":  { "lastUpdated": "2026-03-21", "schemaVersion": "1.0.0" },
  "subagents": { "test": { "simple-responder": { … } } }
}
```

**Component entry — union of all keys observed across all 8 types:**
`id`, `name`, `type`, `path`, `description`, `tags[]`, `dependencies[]`, `category`,
`aliases[]` (3 contexts), `files[]` (4 skills), `version` (rare).

| Field | What it does | Class | Home |
|---|---|---|---|
| `id` | Dependency-graph key | 🟢 UNIVERSAL | Neutral `id`. **Must be unique — 3 dupes today (§3.6).** |
| `name` | Display name | 🟢 UNIVERSAL | Neutral `name`. |
| `type` | Component type | 🔵 REGISTRY | Derived from `/content/` subdir. |
| `path` | **Source** path (`.opencode/agent/...`) | 🔵 REGISTRY | **Becomes `/content/...`; per-target output path is adapter-computed.** This field is the load-bearing OpenCode assumption in the registry. |
| `description` | Install-UI text | 🟢 UNIVERSAL | Neutral `description`. |
| `tags[]` | Filter/search | 🟢 UNIVERSAL | Neutral `tags[]`. |
| `dependencies[]` | Resolution graph | 🟢 UNIVERSAL | Neutral `dependencies[]`. |
| `category` | `essential`\|`standard`\|`extended`\|`specialized`\|`meta` | 🔵 REGISTRY | ⚠️ **Collides with the agent's *domain* category** (`core`, `meta`, `content`). Registry `category` = **install tier**; metadata `category` = **domain**. **Same word, two meanings.** See **Q5**. |
| `aliases[]` | Alt ids | 🟢 UNIVERSAL | Neutral `aliases[]`. |
| `files[]` | Multi-file components | 🔵 REGISTRY | **Generate** by globbing. |
| `version` | SemVer | 🔵 REGISTRY | Neutral `version`. |
| `categories` (top) | id → description **string** | 🔵 REGISTRY | Should become an object (`{description, icon, order, status}`) to absorb `0-category.json` (§1.6). |
| `repository` | Source repo for fetches | 🔵 REGISTRY | Registry. |
| `version` vs `schema_version` vs `metadata.schemaVersion` | **Three** version fields; `metadata.schemaVersion` (`1.0.0`) **contradicts** top-level `schema_version` (`2.0.0`) | 🔴 | Collapse to one. **Q21**. |
| `subagents` (top-level) | 🔴 **Orphan key** — `{test: {simple-responder: {…}}}`, a *second* place subagents are described, with fields (`mode`, `status`) the components entries lack. `simple-responder` is **also** in `components.subagents`. | 🔴 | **Delete.** Dead schema wart. |

### 8.2 🔴 Profiles are duplicated AND drifted

Profiles exist in **two** places:
- `registry.json#profiles` — **what `install.sh` reads** (`jq '.profiles.developer.components[]'`, lines 294/636-688/1222)
- `.opencode/profiles/<name>/profile.json` — read **only** by `scripts/registry/check-dependencies.ts:159`

**All 5 profiles differ:**

| Profile | registry components | file components | Identical? |
|---|---|---|---|
| `essential` | 25 | 27 | ❌ |
| `developer` | 41 | 39 | ❌ |
| `business` | 25 | 26 | ❌ |
| `full` | 50 | 42 | ❌ |
| `advanced` | 68 | 51 | ❌ |

For `developer` alone:
- **registry-only (15):** `command:add-context`, `config:agent-metadata`, `context:quick-start`,
  `context:clean-code`, `context:api-design`, `context:development/*`, `context:openagents-repo/*`,
  `context:ui/*`, `context:react-patterns`, `context:design-systems`, `context:animation-{basics,components,advanced}`,
  `context:ui-styling-standards`, `context:adding-skill-basics`
- **file-only (13):** `subagent:image-specialist`, `tool:gemini`, `skill:context-manager`,
  `context:root-navigation`, `context:context-paths-config`, `context:context-system`,
  `context:workflows-external-context-{management,integration}`, `context:ui/web/*` (5 path-style variants)

Note the **id-vs-path drift** inside this diff: registry says `context:ui-styling-standards`
(short id), the file says `context:ui/web/ui-styling-standards` (path) — **the §7.3 dual-namespace
bug, frozen into the profiles.**

Also note `context:root-navigation` and `context:context-paths-config` are **file-only** ⇒ the
**authoritative** registry `developer` profile installs **neither the root navigation hub nor the
context paths config** — i.e. the context system's entry point and its path config are **missing
from the recommended profile**. 🔴

**Requirement:** ONE profile source. `registry.json#profiles` wins (it is what runs).
`.opencode/profiles/` must be **deleted** (and `check-dependencies.ts` repointed), or generated.
But **first reconcile the diffs** — the file versions contain fixes the registry lacks and vice
versa. See **Q22**.

**Profile fields:** `name`, `description`, `components[]`, `badge` (developer: `"RECOMMENDED"`),
`additionalPaths[]` (**advanced only**: `[".Building/", ".github/workflows/"]` — raw directory
copies outside the component model, read at `install.sh:1222`). 🔴 `additionalPaths` is an
escape hatch that bypasses the component/dependency system entirely.

---

## 9. `plugins/claude-code/` — the drifted, hand-maintained CC plugin

Per `00-INDEX.md` this becomes **generated output** and the directory is deleted. Everything of
value must therefore be captured **now**.

### 9.1 Inventory

| Item | Count | Class | Notes |
|---|---|---|---|
| `agents/` | 7 | 🟢 → regenerate | `code-reviewer`, `coder-agent`, `context-manager`, `context-scout`, `external-scout`, `task-manager`, `test-engineer` |
| `commands/` | 6 | 🔴 **CC-only** | `brainstorm`, `debug`, `install-context`, `oac-cleanup`, `oac-help`, `oac-status` — **none exist in `.opencode/command/`** |
| `skills/` | 12 | 🔴 **CC-only** | §4.5 — disjoint from OpenCode's 4 |
| `hooks/hooks.json` + `hooks/session-start.sh` | 2 | 🔴 **CC-only, critical** | §9.2 |
| `.claude-plugin/plugin.json` | 1 | 🔵 | name `oac`, version `1.0.2`, author, license, repo, homepage, keywords[] |
| `.context-manifest.json` | 1 (×2 copies) | 🔴 **CC-only, critical** | §9.3 — also duplicated at `scripts/.context-manifest.json` |
| `.oac.json.example` + `.oac.example` | 2 | 🔴 | **Two example files**, one presumably stale |
| `scripts/` | 12 files | 🔴 | `install-context.{js,sh,ts}` — **three implementations of the same thing** — plus `test-install.ts`, `cleanup-tmp.sh`, `types/{manifest,registry}.ts`, `utils/{git-sparse,registry-fetcher}.ts`, `tsconfig.json` |
| `settings.json` / `settings.local.json` | 2 | 🟡 | Per git log #264: "add settings.json with opusplan model" |
| `README.md` | 1 | 🔵 | |

### 9.2 🏆 `session-start.sh` — the highest-value CC-only feature

`plugins/claude-code/hooks/hooks.json`:

```json
{ "hooks": { "SessionStart": [ { "hooks": [
  { "type": "command",
    "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh\"",
    "timeout": 30 } ] } ] } }
```

`session-start.sh` does **six** distinct things — every one must survive:

| # | Capability | Detail | Class | Home |
|---|---|---|---|---|
| 1 | **Inline `using-oac` skill** | Reads `skills/using-oac/SKILL.md` **in full** into session context | 🟢 UNIVERSAL intent | Neutral: "bootstrap doc". Adapter renders per tool. |
| 2 | **Skill catalogue generation** | Loops `skills/*/SKILL.md`, greps `^description:`, emits `- oac:<name> — <description>` | 🔵 BUILD/adapter | **Could be build-time (static) instead of runtime (shell).** |
| 3 | **First-run context warning** | If neither `$(pwd)/.claude/.context-manifest.json` nor `~/.claude/.context-manifest.json` exists ⇒ inject an `<important-reminder>` telling the agent to run `context-setup` | 🟢 UNIVERSAL intent | Neutral onboarding rule. |
| 4 | **OAC system paths block** | Emits `Plugin Root:` + `Context Discovery Protocol:` absolute paths | 🟢 UNIVERSAL intent | Neutral; adapter computes paths. |
| 5 | **Context-discovery instruction** | "Before responding to any coding request this session, use `oac:context-discovery` … runs once per session" | 🟢 UNIVERSAL | **This is the runtime entry point to the whole context system.** |
| 6 | **Dual-format JSON output** | Emits **both** `additional_context` (Cursor/OpenCode/other) **and** `hookSpecificOutput.additionalContext` (Claude Code) | 🟡 | **Already a hand-rolled adapter!** Proof the cross-tool need is real. |

Plus a **security control** worth naming: `escape_for_json()` with the comment
*"SECURITY: Prevents command injection attacks from malicious SKILL.md files"*, escaping
backslash-first then quotes/newlines/CR/tabs. **If the build generates this hook, the generator
must preserve the escaping** — a naive template would reintroduce the injection vuln.

> 🔴 **Nothing in `.opencode/` does any of this.** OpenCode has no session-start context
> injection at all. This is the CC plugin being **ahead**, not behind. It is the mechanism by
> which OAC introduces itself, advertises its skills, and bootstraps context discovery — arguably
> **the most important runtime feature in the entire product**, and it exists in exactly one
> file that the refactor plans to delete.

### 9.3 `.context-manifest.json` — installed-state tracking

```json
{
  "version": "1.0.0",
  "profile": "standard",
  "source": { "repository": "darrenhinde/OpenAgentsControl", "branch": "main",
              "commit": "1442740b4a776a790754c9dbde64ab7f1aa9d4e8",
              "downloaded_at": "2026-02-23T11:37:10Z" },
  "categories": ["core", "openagents-repo"],
  "files": { "core": 86, "openagents-repo": 107 }
}
```

| Feature | What it does | Class | Home |
|---|---|---|---|
| Provenance (`repository`/`branch`/**`commit`**) | Pins the exact source commit | 🟢 UNIVERSAL | **`oac update`/`oac doctor` need this.** Agent D. |
| `downloaded_at` | Staleness | 🟢 UNIVERSAL | Same. |
| `profile` | Which profile was installed | 🟢 UNIVERSAL | Same. ⚠️ Value is **`"standard"` — not one of the 5 profile names** (essential/developer/business/full/advanced). `standard` is a *registry **category***, not a profile. Another id-namespace collision. 🔴 |
| `categories[]` + `files{}` | What/how much was installed | 🟢 UNIVERSAL | Same. |
| Dual location (project `.claude/` or global `~/.claude/`) | Local vs global install | 🟢 UNIVERSAL | Mirrors `paths.json`'s `local`/`global`. |
| Used as the first-run sentinel | `session-start.sh` §9.2 #3 | 🟢 UNIVERSAL | |

> `install.sh` (the OpenCode path) writes **no equivalent manifest**. So **OpenCode installs are
> not updatable or auditable** — you cannot tell what version is installed. The CC plugin solved
> a problem the "source of truth" side never did. **`oac update` depends on this existing.**

---

## 10. Other assets (easily missed)

| Asset | Path | Class | Notes |
|---|---|---|---|
| Per-model prompt variants | `.opencode/prompts/core/openagent/{gemini,gpt,grok,llama,minimax,openrouter}.md` | 🔴 AT RISK | **6 model-specific rewrites of the OpenAgent prompt.** Canonical content cannot select concrete models, so Stage 4 must explicitly merge, retain as target-specific optional assets, or retire them. Also `prompts/core/opencoder/{gemini,gpt,grok,llama}.md`. |
| Prompt templates | `.opencode/prompts/*/TEMPLATE.md`, `README.md` | 🔵 | |
| Eval results | `.opencode/prompts/core/openagent/results/*.json`, `default-output.log` | 🔵 | Build artifacts committed to git. |
| `.opencode/docs/` | `agents/planning-agents-guide.md`, `guides/task-schema-migration.md`, `workflows/full-project-workflow.md` | 🟢 | 3 docs. `planning-agents-guide.md` documents the **unregistered** planning agents (§1.8). |
| `.opencode/scripts/task-cli.ts` | | 🔴 | **Duplicate** of `.opencode/skills/task-management/scripts/task-cli.ts`? Unregistered. |
| `.opencode/opencode.json` | `{"$schema": "https://opencode.ai/config.json"}` | 🟡 | Empty but for the schema ref. |
| `.opencode/config.json` | `{"agent": "eval-runner"}` | 🟡 | Sets the default agent — **to the eval harness**, which is marked `DO NOT USE DIRECTLY`. Likely a committed local override. 🔴 |
| `CONTEXT_SYSTEM_GUIDE.md` | repo root, 16KB | 🟢 | Outside `.opencode/` — the main context-system doc. |
| `COMPATIBILITY.md` | repo root | 🔵 | |
| `registry:config` entries | `env.example`, `README.md`, `.opencode/config/agent-metadata.json` | 🔵 | **`config:readme` installs the repo README into the user's project.** Intentional? 🔴 |

---

## 11. FEATURE PRESERVATION CHECKLIST

> Flat list. Every capability that **must survive**. Each maps to its new home.
> `[ ]` = must be verified in the migrated system before `.opencode/` is demoted.

### Agents
- [ ] **34 agent bodies** preserved verbatim → `/content/agents/**/*.md` body
- [ ] `name` → neutral `name` + `id`; adapters slugify (OpenCode PascalCase, Claude kebab)
- [ ] `description` → neutral `description`
- [ ] `mode: primary|subagent` → neutral `role`
- [ ] `temperature` (33 agents) → `inference.temperature`; **Claude drops it → warning**
- [ ] Concrete model names stay absent; optional semantic `inference.tier` is preserved (Locked Decision #2)
- [ ] `permission.<tool>.<glob>` **tri-state** (`allow`/`ask`/`deny`) → `capabilities` **rule list** (§1.3)
- [ ] **Glob-scoped denies preserved** (`**/*.env*`, `**/*.key`, `**/*.secret`, `node_modules/**`, `.git/**`) — *security control*
- [ ] **Deny-by-default + narrow allow preserved** (`coder-agent` bash allowlist) — *security control*
- [ ] `permission.bash` destructive-command denies preserved (`sudo *`, `rm -rf /*`, `> /dev/*`) — *security control*
- [ ] `permission.task` → `capabilities.delegate`; **id vs name refs canonicalized**
- [ ] **`tester`/`test-engineer`/`TestEngineer` aliasing** resolved without breaking dep edges (§1.2)
- [ ] `eval-runner.md`'s inline `id`/`category`/`type`/`version`/`author` normalized
- [ ] **CC `<example>` blocks harvested** from `plugins/claude-code/agents/` → neutral `examples[]` (§1.5)
- [ ] CC `tools:` / `disallowedTools:` derivable from `capabilities`
- [ ] 6 unregistered planning/orchestration agents: **registered or deleted** (§1.8, Q7)
- [ ] `batch-executor` (in metadata, not registry) resolved

### Agent metadata
- [ ] `id`, `name`, `category`, `type`, `version`, `author`, `tags[]`, `dependencies[]` → **neutral frontmatter**
- [ ] `defaults.{agent,subagent}` → Zod `.default()`
- [ ] OpenCode adapter **re-splits** metadata into `agent-metadata.json` (OpenCode rejects unknown keys)
- [ ] `agent-metadata.json` `$schema` + `schema_version` emitted by the adapter
- [ ] `category` dual format (`core` vs `subagents/core`) normalized (Q5)

### Categories
- [ ] `0-category.json` `name`/`description`/`icon`/`order`/`status` → `registry.json#categories[]` (upgraded to objects)
- [ ] `commonSubagents`/`commonTools`/`commonContext` — **promoted or deleted** (Q4)

### Commands
- [ ] **20 command bodies** verbatim → `/content/commands/`
- [ ] `description`, `tags[]`, `dependencies[]` preserved
- [ ] `<critical_rules>`/`<rule id= enforcement=>`/`<execution_priority>`/`<tier>` DSL passes through untouched
- [ ] `@rule.id` cross-refs intact
- [ ] `analyze-patterns.md` inline metadata normalized
- [ ] Agent/context templates relocated out of `command/` → CLI scaffolds (§2.3)
- [ ] **8 numbered eval templates** (`test-1-planning-approval` … `test-8-completion`) relocated → `/evals` (Q8)
- [ ] **6 CC-only commands** (`brainstorm`, `debug`, `install-context`, `oac-cleanup`, `oac-help`, `oac-status`) harvested → `/content/commands/`

### Context system 🏆
- [ ] **All 297 context entries** migrated (293 regular `.md` + `paths.json` + 3 symlinks — symlinks convert to `aliases[]` per `00-INDEX` v2.2)
- [ ] **HTML-comment header parsed, not ignored**: `<!-- Context: {cat}/{fn} | Priority: … | Version: X.Y | Updated: … -->` (§3.1) — **the #1 silent-loss risk**
- [ ] `Priority` (`critical`/`high`/`medium`/`low`) → neutral `priority` — **drives load order**
- [ ] `Category`/`Function` dual taxonomy preserved
- [ ] `Version` `X.Y` form reconciled with SemVer (Q9)
- [ ] `Updated` date preserved
- [ ] **All 75 `navigation.md` hubs** migrated
- [ ] **Task→path "Quick Routes" tables** preserved verbatim — *the* discovery mechanism
- [ ] **Relative inter-hub links** stay relative (portable); only the **root** tree diagram is rewritten (§3.2)
- [ ] **42 unregistered `navigation.md`** registered / auto-included (§3.5)
- [ ] **106 unregistered context files** registered or consciously dropped (§3.5)
- [ ] **Navigation chain auto-included** as a structural dependency (§7.4)
- [ ] **3 duplicate-path context ids** collapsed to `aliases[]` (§3.6)
- [ ] **3 duplicate context ids** (`agents`, `ui-navigation`, `context-bundle-template`) made unique (§3.6)
- [ ] `paths.json` local/global roots → neutral config; adapter rewrites
- [ ] **`.oac.json` discovery protocol preserved** (fast path → chain → validity check → self-heal) (§3.3)
- [ ] `navigation.md`-presence validity check preserved
- [ ] Non-`.md` contexts (`paths.json` — the only one on disk) survive wildcard expansion (§7.2, PR #252)
- [ ] **MVI standard** preserved (formula, what-to-extract/skip, <30s scannable)
- [ ] **<200-line rule** preserved (candidate `oac doctor` lint)
- [ ] **Function-based structure** (`concepts/ examples/ guides/ lookup/ errors/`) preserved
- [ ] Context **operations** (harvest/extract/organize/update/migrate/error) preserved
- [ ] Context **guides** (compact/creation/organizing/workflows/navigation-design) preserved
- [ ] `structure.md`/`templates.md`/`codebase-references.md`/`typescript-coding.md` preserved
- [ ] `core/context-system/CHANGELOG.md` preserved
- [ ] ~~Task JSON schemas (`tasks/schemas/{task,subtask}-schema.json`) preserved~~ — v1 census artifact; **no such files on disk** (§3.7)
- [ ] Root `index.md` **and** `navigation.md` reconciled (Q14)
- [ ] `CODEBASE_STANDARDS.md` (unregistered) preserved
- [ ] **`CONTEXT_SYSTEM_GUIDE.md`** (repo root, outside `.opencode/`) preserved
- [ ] Project Intelligence standard + `context/project-intelligence/` preserved
- [ ] **~129 files with hardcoded `.opencode/` paths** de-hardcoded (§3.4, Q12)

### Dependency resolution 🏆
- [ ] `<type>:<id>` grammar preserved
- [ ] **Recursive transitive closure** preserved
- [ ] **Dedupe** preserved
- [ ] **Cycle termination** preserved — and now **detected + reported**
- [ ] `aliases[]` resolution preserved
- [ ] **`context:` wildcard expansion** preserved (note: **prefix match**, not true glob)
- [ ] Wildcard **restricted to `context:`** (or consciously widened)
- [ ] `get_registry_key` singular↔plural mapping preserved (incl. `config` staying singular)
- [ ] `get_install_path` (`.opencode/` → `$INSTALL_DIR`) → **adapter output-path logic**
- [ ] 🔴 **Unresolvable refs now FAIL** instead of silently resolving to nothing (§7.3)
- [ ] 🔴 **Dual-namespace (id vs path) refs unified** — fixes `/add-context`'s 3 dead deps
- [ ] Wildcard-produced path-ids resolve their own transitive deps

### Registry
- [ ] All **248 component entries** across 8 types preserved
- [ ] `id`/`name`/`type`/`path`/`description`/`tags[]`/`dependencies[]`/`category` preserved
- [ ] `aliases[]` (3) + `files[]` (4 skills) preserved
- [ ] `path` re-pointed `.opencode/…` → `/content/…`; **output paths adapter-computed**
- [ ] `categories` install tiers (essential/standard/extended/specialized/meta) preserved
- [ ] 🔴 **`category` name collision** (install tier vs domain) resolved (Q5)
- [ ] `repository` preserved
- [ ] 3 conflicting version fields collapsed (Q21)
- [ ] Orphan top-level `subagents.test.simple-responder` key deleted
- [ ] **`files[]` generated**, not hand-maintained

### Profiles
- [ ] All **5 profiles** preserved (essential/developer/business/full/advanced)
- [ ] `name`/`description`/`components[]` preserved
- [ ] `badge` (`RECOMMENDED`) preserved
- [ ] `additionalPaths[]` (advanced: `.Building/`, `.github/workflows/`) preserved or replaced (§8.2)
- [ ] 🔴 **registry-vs-file profile drift reconciled** before deleting `.opencode/profiles/` (§8.2, Q22)
- [ ] 🔴 `developer` profile regains `context:root-navigation` + `context:context-paths-config`
- [ ] `scripts/registry/check-dependencies.ts` repointed off `.opencode/profiles/`

### Skills
- [ ] **4 OpenCode skills** preserved (task-management, context-manager, context7, smart-router-skill)
- [ ] 🔴 **12 CC skills harvested** (§4.5, Q16) — `code-execution`, `code-review`, `context-discovery`, `context-setup`, `debugger`, `external-research`, `oac-approach`, `parallel-execution`, `task-breakdown`, `test-generation`, `using-oac`, `verification-before-completion`
- [ ] `SKILL.md` frontmatter (`name`/`description`/`version`/`author`/`type`/`category`/`tags[]`)
- [ ] `description` remains greppable by `^description:` (session-start catalogue depends on it)
- [ ] `router.sh` preserved **with the executable bit**
- [ ] `scripts/*.ts` preserved
- [ ] `workflows/*.md` preserved (incl. `8-stage-delivery.md`, `context-handoff.md`, `planning-agents.md`)
- [ ] `tests/*.test.ts` relocated
- [ ] `smart-router-skill` `config/personality-config.json` + `scripts/{sherlock,stark,yoda}-workflow.sh` preserved
- [ ] `context7` `library-registry.md` + `navigation.md` preserved
- [ ] 🔴 `.opencode/skill/project-orchestration` (orphan) registered or deleted (§4.3, Q7)
- [ ] 🔴 `.opencode/skill/task-management/tests/` reunited with its skill
- [ ] Bun/TS runtime dependency addressed for npm distribution (§4.4, Q15)

### Tools
- [ ] `tool:env` (`loadEnvVariables`, multi-path `.env` search) preserved
- [ ] `tool:gemini` (image gen/edit/analyze) preserved
- [ ] `tool:gemini → tool:env` dependency preserved
- [ ] `tool/template/` → CLI scaffold
- [ ] Non-OpenCode targets: tools unsupported → **explicit warning**, or MCP path (Q18)
- [ ] `.env` files (untracked, gitignored — Q17 closed) never swept into `/content/` or build output — build hygiene, not security remediation

### Plugins & hooks
- [ ] `plugin:notify` preserved (incl. `ENABLED = false` default)
- [ ] 🔴 `agent-validator.ts` + `.disabled` twin resolved; `VALIDATOR_GUIDE.md` + tests preserved
- [ ] 🔴 `plugins/coder-verification/` (index.ts, plugin.json, README, IMPLEMENTATION_SUMMARY) registered or deleted
- [ ] `plugin.json` manifest shape unified with `.claude-plugin/plugin.json`
- [ ] 🔴 OpenCode `event` callback vs CC `hooks.json` — hook model decided (§6, Q19)
- [ ] `.opencode/plugin/.env` (untracked, gitignored — Q17 closed) excluded by the same build-hygiene rule

### Claude Code plugin 🏆
- [ ] `.claude-plugin/plugin.json` generated (name/description/version/author/license/repo/homepage/keywords)
- [ ] `hooks/hooks.json` `SessionStart` (+ `timeout: 30`, `${CLAUDE_PLUGIN_ROOT}`) generated
- [ ] **`session-start.sh` #1** inline `using-oac` full text
- [ ] **#2** skill catalogue (`- oac:<name> — <description>`)
- [ ] **#3** first-run warning when no `.context-manifest.json` (project **or** global)
- [ ] **#4** OAC system paths block (plugin root + protocol path)
- [ ] **#5** context-discovery instruction ("once per session")
- [ ] **#6** dual-format JSON (`additional_context` **and** `hookSpecificOutput.additionalContext`)
- [ ] 🔴 **`escape_for_json()` injection defense preserved** (backslash-first ordering) — *security control*
- [ ] `<EXTREMELY_IMPORTANT>` / `<important-reminder>` wrappers preserved
- [ ] **`.context-manifest.json`** written on install: `version`/`profile`/`source.{repository,branch,commit}`/`downloaded_at`/`categories[]`/`files{}`
- [ ] 🔴 **OpenCode installs gain a manifest too** (today they have none ⇒ not updatable)
- [ ] `.oac.json` (`version`, `context.root`) supported; **`.oac.example` vs `.oac.json.example` deduped**
- [ ] Project-local **and** global manifest locations supported
- [ ] `scripts/install-context.{js,sh,ts}` → **one** implementation in `/packages/cli`
- [ ] `scripts/utils/{git-sparse,registry-fetcher}.ts` (sparse-checkout fetch) preserved → CLI
- [ ] `scripts/types/{manifest,registry}.ts` → `/packages/core` types
- [ ] `scripts/cleanup-tmp.sh` → CLI (`oac clean`)
- [ ] `settings.json` (opusplan model, PR #264) + `settings.local.json` decided (Q3)
- [ ] 🔴 `.context-manifest.json` `profile: "standard"` (not a real profile name) fixed

### Prompts / misc
- [ ] 🔴 **10 per-model prompt variants** (`openagent/{gemini,gpt,grok,llama,minimax,openrouter}.md`, `opencoder/{gemini,gpt,grok,llama}.md`) explicitly merged, retained as target-specific optional assets, or retired; they never select a concrete model from canonical content
- [ ] `prompts/*/TEMPLATE.md` + READMEs preserved
- [ ] Eval `results/*.json` — keep or gitignore
- [ ] `.opencode/docs/` (3 docs) relocated
- [ ] 🔴 `.opencode/scripts/task-cli.ts` duplicate resolved
- [ ] `.opencode/config.json` (`{"agent": "eval-runner"}`) — **almost certainly a bad committed default**
- [ ] `config:env-example`, `config:readme`, `config:agent-metadata` install-components decided (Q24)

---

## Open Questions

Ordered by blocking-ness. **Q1, Q2, Q10, Q12, Q16, Q20 block the schema (Agent B) and should be
answered first.**

**Q1 — Canonical id vs filename vs display name.** `tester` (id) / `test-engineer.md` (file) /
`TestEngineer` (frontmatter `name`) / `test-engineer` (CC) all denote one agent. Is `id`
independent of filename (needs `aliases[]` + an id→path map), or do we **rename files to match
ids** as a one-time migration and make `filename == id` an invariant? The latter is much simpler
but breaks any external reference to the old paths. **Recommendation: filename == id, with
`aliases[]` retained for dependency back-compat.**

**Q2 — CLOSED (v2): Locked Decision #5.** The ordered `{scope, decision}` rule-list with
scalar sugar (§1.3) was adopted, and `00-INDEX.md`'s worked example was revised to it. The
flat model was provably lossy against real agents (`coder-agent`'s deny-all-then-allowlist,
the `**/*.env*`/`**/*.key` security globs, `rm -rf /*: deny`). No longer open.

**Q3 — CLOSED (v2): no concrete model names in canonical content.** Legacy plugin values are
migration evidence only: scouts become `inference.tier: fast`, other agents use
`balanced`/default. Project or adapter configuration may map tiers to target models.

**Q4 — `0-category.json`: promote or delete?** It's read by nothing. Its `icon`/`order`/`status`
are richer than `registry.json#categories` (flat strings) and worth promoting. But
`commonSubagents`/`commonTools`/`commonContext` (with globs) overlap `dependencies` +
`capabilities.delegate` + `context[]` without being enforced. Promote the category display
metadata and **delete** the `common*` advisory fields?

**Q5 — `category` means two things.** Registry `category` = **install tier**
(`essential`/`standard`/`extended`/`specialized`/`meta`). Metadata `category` = **domain**
(`core`/`meta`/`content`/`subagents/core`). Same key, different value spaces, both on the same
component. Rename to `tier` + `category`? And normalize the flat-vs-path domain form
(`core` vs `subagents/core`)?

**Q6 — `author: "opencode"`.** All 28 metadata entries claim author `opencode` — a *tool name*
used as an author. Now that OpenCode is "just another adapter", should this become `oac`? Affects
every generated `agent-metadata.json`.

**Q7 — The dark orchestration feature.** 6 unregistered agents (`subagents/planning/*` +
`stage-orchestrator`) + the unregistered `.opencode/skill/project-orchestration` skill
(8-stage delivery workflow, stage CLI, context handoff) + `.opencode/docs/agents/planning-agents-guide.md`
form **one coherent, fully-built, uninstallable feature**. Ship it (register + profile it) or
delete it? Carrying it into `/content/` as-is just relocates the ambiguity.

**Q8 — The 8 eval templates.** `command/openagents/new-agents/templates/test-{1..8}-*.yaml`
encode OAC's agent quality bar (planning-approval, context-loading, incremental, tool-usage,
error-handling, extended-thinking, compaction, completion). Move to `/evals`? Wire into CI as the
acceptance gate for new agents? Coordinate with Agent E.

**Q9 — Version format.** Context files use `Version: X.Y`; agents/skills use SemVer `X.Y.Z`;
registry has `version` **and** `schema_version` **and** `metadata.schemaVersion`. One format
(SemVer) with a migration of ~290 context headers, or keep `X.Y` for context as a distinct field?

**Q10 — CLOSED (v2): Locked Decision #6 — option (a).** 286 of 296 `.md` files use
`<!-- Context: … | Priority: … -->`; 3 are dual-format (YAML + MVI marker at line 11); 7 have
neither. The HTML-comment format **stays on disk** (it is deliberate and token-efficient); the
IR parser normalizes it in memory, honoring the **leading-window rule** (line 1, or first line
after a closing YAML `---`) to avoid the two verified parser traps. **Never let a generic
frontmatter parser (`gray-matter`) near these files** — it silently returns nothing and all
priority data vanishes. See `00-INDEX` decision #6 for the full rationale.

**Q11 — Unify context discovery on `.oac.json`?** OpenCode has `paths.json` (static local/global);
CC has the `.oac.json` protocol (fast path → discovery chain → `navigation.md` validity check →
self-healing write). The CC design is strictly better. Make `.oac.json` the neutral mechanism and
demote `paths.json` to OpenCode-adapter output?

**Q12 — De-hardcoding `.opencode/` from ~129 content bodies.** Token substitution
(`{{CONTEXT_ROOT}}`, explicit + lintable, touches 129 files), adapter regex rewrite (zero churn,
brittle), or id-based indirection (cleanest, biggest rewrite)? **Recommendation: tokens now +
a `no raw .opencode/ in /content/` lint; ids later.** Without this, generated CC agents point at
paths that don't exist — likely why the CC plugin was hand-written in the first place.

**Q13 — Auto-generate registry context entries?** 106 of 297 context entries are unregistered
(incl. 42 of 75 `navigation.md`). Hand-maintenance has demonstrably failed. Generate all context
entries from disk at build time, with `navigation.md` auto-included whenever any sibling is
installed? What then determines a context's `category`/tier — the HTML `Priority`? Its directory?

**Q14 — Root `index.md` vs root `navigation.md`.** Both exist at `.opencode/context/`. Which is
the canonical entry point? (`navigation.md` is what `context-discovery-protocol.md` checks for.)
Merge or define the split.

**Q15 — Bun/TypeScript runtime for skills.** Every `router.sh` shells out to `.ts` under Bun.
For npm distribution, does OAC (a) require Bun, (b) precompile skills to JS, or (c) rewrite
routers in Node? Also: `router.sh` is bash — **what is the Windows story?** Blocks Agent D.

**Q16 — Which skill set seeds `/content/skills/`?** OpenCode has 4 skills; CC has 12; the sets
are **disjoint**. The CC 12 are the product's actual shipped UX (`oac:code-review`,
`oac:task-breakdown`, …). Seed from CC, from OpenCode, or the union of 16? **If `/content/` is
seeded only from `.opencode/`, the 12 CC skills are silently destroyed.**

**Q17 — CLOSED (v2): non-finding.** The v1 "committed `.env`" alarm was **false**. Verified:
**0 tracked `.env` files** — `git ls-files` matches none, and `.env` is gitignored
(`.gitignore:9-13`). `.opencode/tool/.env` and `.opencode/plugin/.env` exist on disk only as
**untracked local artifacts**. No rotation, no history purge, no security incident. The only
surviving requirement is **build hygiene**: a filesystem-globbing build must never sweep local
`.env` files into `/content/` or any build output.

**Q18 — Tools on non-OpenCode targets.** `.opencode/tool/*` implements the OpenCode tool API.
Claude Code has no equivalent primitive (nearest: MCP servers). Are tools (a) OpenCode-only with
an explicit "unsupported on target X" warning, or (b) re-expressed as MCP servers for CC? (b) is
a large scope increase. Agent C.

**Q19 — Is `hooks` a neutral content type?** OpenCode hooks = a TS plugin exporting an `event`
callback. CC hooks = declarative `hooks.json` → shell command. These are not the same shape and
don't obviously unify. Options: (a) `hooks` is per-adapter, not content; (b) a neutral
event→action schema that both render (constrains OpenCode plugins to declarative actions);
(c) declare only `SessionStart` neutrally (the one hook that matters) and leave the rest
per-adapter. **Recommendation: (c).**

**Q20 — Fail-fast on unresolvable dependencies?** Today `jq … || echo ""` means an unknown
component resolves to **zero dependencies, silently** — which is why `/add-context`'s three
path-style context deps (mvi, frontmatter, project-intelligence) almost certainly install
nothing today. Confirm the new resolver **errors** on unresolvable refs. This is a **behavior
change that will surface currently-hidden breakage** (probably a lot of it) — the migration
should expect a burst of newly-visible failures and budget for it. Coordinate with Agent E.

**Q21 — Registry version fields.** Top-level `version: "2.0.0"`, top-level
`schema_version: "2.0.0"`, and `metadata.schemaVersion: "1.0.0"` — the last **contradicts** the
second. Which is authoritative? Collapse to one `schemaVersion` + one `contentVersion`?

**Q22 — Reconciling profile drift before deletion.** All 5 profiles differ between
`registry.json#profiles` (authoritative — `install.sh` reads it) and `.opencode/profiles/*/profile.json`
(read only by `scripts/registry/check-dependencies.ts`). Each side has things the other lacks —
the file side has `root-navigation` + `context-paths-config` (which the recommended `developer`
profile is **missing**), the registry side has broader wildcards. This needs a **human to
reconcile 5 diffs**; it cannot be auto-merged. Blocks deleting `.opencode/profiles/`.

**Q23 — Per-model prompt variants.** `.opencode/prompts/core/{openagent,opencoder}/{gemini,gpt,grok,llama,minimax,openrouter}.md`
are 10 model-specific rewrites of two agents' system prompts, with committed eval results. Under
"no hardcoded models", do these (a) get deleted, (b) become an opt-in `prompts/` overlay keyed by
model family, or (c) move to `/evals` as prompt-engineering artifacts? Are they even current?

**Q24 — `config:` components.** `config:readme` installs **this repo's `README.md`** into the
user's project; `config:env-example` installs `env.example`; `config:agent-metadata` installs the
sidecar. `readme` looks like a bug (why would a user want OAC's README in their project?).
Keep, drop, or replace with a generated project README?

---

## Appendix — Sources

Every claim above is grounded in these files (all paths repo-relative):

- `.opencode/agent/**/*.md` (34), `.opencode/agent/**/0-category.json` (5)
- `.opencode/config/agent-metadata.json`
- `.opencode/command/**/*.md` (20), `.opencode/command/openagents/new-agents/templates/*.yaml` (9)
- `.opencode/context/**` (297 entries = 294 files + 3 symlinks), esp.
  `context/navigation.md`, `context/index.md`, `context/CODEBASE_STANDARDS.md`,
  `context/core/config/paths.json`,
  `context/core/context-system/standards/{frontmatter,mvi,structure,templates,codebase-references}.md`,
  `context/core/context-system/operations/*.md`, `context/core/standards/code-quality.md`
- `.opencode/skills/*/SKILL.md` (4), `.opencode/skill/{project-orchestration,task-management}/**`
- `.opencode/tool/{env,gemini,template}/index.ts`, `.opencode/tool/.env` (untracked)
- `.opencode/plugin/{notify.ts,agent-validator.ts,agent-validator.ts.disabled,.env}` (`.env` untracked),
  `.opencode/plugins/coder-verification/{index.ts,plugin.json}`
- `.opencode/profiles/*/profile.json` (5), `.opencode/prompts/**`, `.opencode/docs/**`,
  `.opencode/scripts/task-cli.ts`, `.opencode/{opencode.json,config.json}`
- `registry.json` (107KB) — `components` (8 types / 248 entries), `profiles` (5), `categories` (5)
- `install.sh` — `get_registry_key():331`, `get_install_path():353`,
  `expand_context_wildcard():361`, `expand_selected_components():373`,
  `resolve_dependencies():420-481`, profile reads `:294,:636-688`, `additionalPaths` `:1222`
- `scripts/registry/check-dependencies.ts:159`
- `plugins/claude-code/**` — `hooks/{hooks.json,session-start.sh}`,
  `.claude-plugin/plugin.json`, `.context-manifest.json`, `.oac.json.example`, `.oac.example`,
  `agents/*.md` (7), `commands/*.md` (6), `skills/*/SKILL.md` (12),
  `skills/context-discovery/context-discovery-protocol.md`, `scripts/**`, `settings.json`
- `CONTEXT_SYSTEM_GUIDE.md`, `COMPATIBILITY.md` (repo root)
