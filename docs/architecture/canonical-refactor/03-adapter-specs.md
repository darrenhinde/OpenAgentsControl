# 03 — Adapter & Transform Specs (Agent C) — **v2**

> **Current state (2026-09-02):** This adapter specification is historical. The active metadata workflow is canonical `content/agents/**` `oac:` blocks emitted by RegistryEmitter; sidecar metadata and sidecar merging are superseded. `eval-runner.md` remains an intentionally registry-carried, non-canonical evaluation harness—not a sidecar replacement.

> **Status:** Specification only — no implementation code. **v2** (realigned to Option A
> permissions + MVI context metadata, per `00-INDEX.md` v2).
> **Scope:** For each of the 4 build targets (OpenCode, Claude Code, Cursor, Windsurf), the
> complete transform from the neutral IR to the tool's on-disk format, plus a consolidated
> capability matrix and the exact warning text emitted on any lossy transform.
>
> **Read first:** `00-INDEX.md` v2 (locked decisions). Where this doc conflicts with the
> index, **the index wins** — except where this doc raises a *verified contradiction*, which
> is escalated in §0.5 and Open Questions rather than silently resolved.

**v2 changes:** Option A (ordered rule list) replaces the flat `capabilities` model in every
mapping table · new §0.4 (capabilities model) and §0.5 (**ordering-direction contradiction —
blocking**) · OpenCode serialization + ordering analysis (§1.3) · CC collapse rule, the
`coder-agent` bash case, and a **verified negative** on the `settings.json` escape hatch
(§2.6) · new matrix rows for scoped permissions, ask tri-state, rule ordering · census
corrected (34 agents / 20 commands / 296 context) · context bundling corrected to MVI
HTML-comment · worked example re-verified (§2.8).

---

## 0. Shared Conventions (apply to all adapters)

### 0.1 Neutral IR fields (the input every adapter consumes)

Per `00-INDEX.md` v2 worked example and `packages/compatibility-layer/src/types.ts`:

| Neutral field | Type | Meaning |
|---|---|---|
| `id` | string (kebab) | Stable identity; adapters slugify per tool. |
| `name` | string | Human display name. |
| `role` | `primary` \| `subagent` | Operational mode. |
| `category` | enum (`core`,`development`,…) | **Domain** only; distribution tier lives in registry `profiles`. |
| `description` | string | One-line summary. |
| `tags[]` | string[] | Free-form labels. |
| `capabilities` | see §0.4 | Ordered rule lists + scalar sugar. **INTENT, not any tool's syntax.** |
| `inference.temperature` | number \| absent | Sampling temperature. |
| `inference.tier` | `fast` \| `balanced` \| `deep` | Semantic cost/latency intent; adapters resolve it to target defaults. Raw model ids are not authorable. |
| `inference.maxSteps` | number \| absent | Step cap. |
| `context[]` | `{ path, priority?, description? }` | External context refs. See §0.6. |
| `dependencies[]` | typed refs from `02` §0.2 (`agent` through `config`, including path/wildcard refs) | Declared deps. |
| `examples[]` | `{ context, user, assistant }` | Few-shot delegation examples. |
| `hooks[]` | `{ event, command, … }` | Lifecycle hooks. |
| body | markdown | System prompt authored once. |

Verified census (Stage 1 closure): **34** agents and **20** OpenCode commands. Context composition
and the **12 + 4 = 16** canonical skill union are recorded from disk in `09-MERGE-RULES.md` §§4,9;
those measurements supersede the stale index-v2 counts previously printed here.

### 0.2 Warning contract

`BaseAdapter.ts:187-208` already defines both templates. **Reuse their exact output** — every
lossy transform below cites the literal string:

```
unsupportedFeatureWarning(feature, value?):
  ⚠️  Feature '<feature>'( (<value>))? is not supported by <displayName>

degradedFeatureWarning(feature, from, to):
  ⚠️  Feature '<feature>' will be degraded: <from> → <to>
```

`<displayName>` ∈ `OpenCode` / `Claude Code` / `Cursor IDE` / `Windsurf`.

### 0.3 Warnings are never silent

A transform that drops or degrades any field MUST emit a warning AND `analyzeCompatibility()`
MUST predict it. Builds fail only on `blockers`; warnings are reported and counted.
**Security-relevant losses (§2.3) are build blockers unless the user supplies the explicit
`--allow-unsafe-degradation` opt-in** (`07-EXECUTION-PLAN.md` Stage 3).

### 0.4 The capabilities model (Option A — locked decision #5)

```
capability: <scalar>                    # sugar → [{ scope: "*", decision: <scalar> }]
capability: [ { scope, decision }, … ]  # full ordered form
delegate:   { name: decision, … }       # map sugar → [{ scope: name, decision }, … ]
```
`decision ∈ allow | deny | ask`. Every adapter normalizes sugar → ordered list *first*, then
transforms. Adapters never see the sugar forms.

**Derived concepts every adapter needs:**

- **Default-scope decision** — the decision of the rule whose scope is `*`, if present. This is
  what coarse targets (CC/Cursor/Windsurf) collapse to.
- **Exceptions** — every rule whose scope ≠ `*`. These are what coarse targets lose.
- **Implicit default** — when no `*` rule exists, infer the opposite of the one decision present:
  deny-only exceptions imply `allow`; allow-only exceptions imply `deny`; mixed decisions without
  `*` are a parse error. This is ratified in `02` §1.2.5 and adapters consume that resolved value.

### 0.5 Resolved precedence — last-match-wins

Every real agent is authored last-match-wins. `10-PRECEDENCE-EXPERIMENT.md` confirmed that behavior
against OpenCode 1.17.20 through live probes and the resolver's `.findLast()` implementation.

Verified evidence — `.opencode/agent/subagents/code/coder-agent.md` as authored on disk:

```yaml
permission:
  bash:
    "*": "deny"                                                        # ← broad rule FIRST
    "bash .opencode/skills/task-management/router.sh complete*": "allow"
    "bash .opencode/skills/task-management/router.sh status*": "allow"
```

and `.opencode/agent/core/openagent.md`:

```yaml
  bash:
    "*": "ask"          # ← broad rule FIRST
    "rm -rf /*": "deny"
    "sudo *": "deny"
```

Under **first-match-wins**, `"*": deny` matches every command and the two `router.sh`
exceptions **never fire** → `coder-agent` cannot run `router.sh` → it cannot complete or
report task status. That is precisely the breakage the index cites as Option A's rationale
(*"which would break its ability to run its own router.sh"*). Likewise `openagent`'s
`sudo *: deny` would never fire — `sudo` would resolve to `ask`, a **security regression**.

Under **last-match-wins**, both files behave exactly as authored and intended.

The repo's archived planning doc also states the intended rule at
`docs/archive/planning/12-MASTER-SYNTHESIS.md:432`:

> "The `permission:` field uses **last-match-wins** evaluation (same as OpenCode's native
> system) … Rules are evaluated in order; the LAST matching rule wins. This matches OpenCode's
> permission semantics exactly, ensuring IDE-native compatibility."

**Decision:** the IR and all adapters use last-match-wins. Rule order is preserved; adapters do not
reverse it. Integer-like and duplicate scopes are rejected at parse time because the live probes
showed they can change or erase authored precedence before the resolver runs.

### 0.6 Context on disk (MVI HTML-comment — locked decision #6)

Context `.md` files carry a single compact metadata line, **not** YAML frontmatter:

```
<!-- Context: standards/code | Priority: critical | Version: 2.0 | Updated: … -->
```

286 of 296 files use this. It is **deliberate** (token efficiency; the model reads it on every
load) and **must not be migrated to YAML**. Consequences for adapters:

- Adapters **copy context files byte-for-byte** — the MVI comment travels with the file and is
  never rewritten into YAML on any target.
- `context[].priority` in the IR is **parsed from this comment** in-memory by the core parser,
  not from frontmatter. Adapters consume the normalized IR value and never re-parse.
- ⚠️ A generic parser (`gray-matter`) finds **no frontmatter** here and silently yields
  `priority: undefined` — which would degrade every priority-ordering claim in this doc to a
  no-op. This is the core parser's contract (`02`), but adapters depending on `priority`
  (OpenCode sidecar, Windsurf `contexts[].priority`) inherit the risk.

---

## 1. OpenCode Adapter

`.opencode/` is build **output**, not source (locked #1). Real formats inspected:
`.opencode/agent/**`, `.opencode/config/agent-metadata.json`, `.opencode/agent/**/0-category.json`,
`.opencode/skill/<name>/SKILL.md`, `.opencode/command/*.md`, `.opencode/opencode.json`,
`.opencode/config.json`.

**Highest-fidelity target** — the only one with per-scope allow/deny/ask, temperature,
delegation, external context refs, and skills.

### 1.1 File / directory layout

```
.opencode/
  agent/
    <category>/<id>.md                    # role: primary      e.g. core/opencoder.md
    subagents/<category>/<id>.md          # role: subagent     e.g. subagents/code/reviewer.md
    <category>/0-category.json            # category descriptor
  config/agent-metadata.json              # sidecar: metadata outside the OpenCode schema
  skill/<skill-id>/SKILL.md
  command/<command-id>.md
  context/<category>/<...>.md             # copied verbatim (MVI comment intact) — referenced, not inlined
  opencode.json                           # { "$schema": "https://opencode.ai/config.json" }
  config.json                             # { "agent": "<default primary id>" }
```

File name = `id` (kebab); `name:` frontmatter = PascalCase. Verified against
`agent/core/opencoder.md` (`name: OpenCoder`) and `agent/subagents/code/reviewer.md`
(`name: CodeReviewer`).

### 1.2 Field mapping table

| Neutral field | OpenCode target | Transform rule |
|---|---|---|
| `id` | file path stem + `agent-metadata.json` key | kebab, unchanged; drives location |
| `name` | `name:` | **id → PascalCase** (`code-reviewer` → `CodeReviewer`) |
| `role` | `mode:` | 1:1 (`primary`/`subagent`) |
| `category` | dir segment + sidecar + `0-category.json` | 1:1 (domain only) |
| `description` | `description:` | verbatim |
| `tags[]` | sidecar `tags` | not in OpenCode agent schema |
| `capabilities` | `permission:` map | **ordered list → map, order preserved** (§1.3) |
| `capabilities.delegate` | `permission.task` | `[{scope:X,decision:D}] → task: { X: "D" }` |
| `inference.temperature` | `temperature:` | verbatim |
| `inference.tier` | target model selection | resolve through project/adapter tier configuration; if no mapping exists, omit and use the tool default |
| `inference.maxSteps` | sidecar (advisory) | no native field |
| `context[]` | `@`-ref / `paths.json` + sidecar `context:<id>` dep | referenced, not inlined |
| `dependencies[]` | sidecar `dependencies[]` | verbatim |
| `examples[]` | body prose / sidecar | no native `<example>` convention |
| `hooks[]` | `.opencode/plugin/` registration | full support |
| body | markdown | verbatim |

### 1.3 Capabilities → `permission:` — exact serialization & ordering

**Answer to the coordinator's question: OpenCode round-trips Option A exactly *in expressive
power*, but its map form preserves ordering only *by convention, not by specification*.**

Serialization is a direct 1:1 emission — for each capability, emit each rule in IR list order
as a `"<scope>": "<decision>"` entry:

```
IR                                                   →  OpenCode
bash: [ {scope:"*",decision:deny},                      permission:
        {scope:"…/router.sh complete*",decision:allow},   bash:
        {scope:"…/router.sh status*",decision:allow} ]       "*": "deny"
                                                             "bash …/router.sh complete*": "allow"
                                                             "bash …/router.sh status*": "allow"
```

Capability→key map: `bash→bash`, `edit→edit`, `write→write`, `delegate→task`. Emit every explicit
rule, including a plain `*: allow`; omission is reserved for an absent capability. This keeps
explicit author intent distinct from the tool default and makes parse→serialize round trips exact.
Scalar sugar round-trips as a single `"*"` entry. `ask` is preserved natively —
**OpenCode is the only target that can express it.**

**Ordering preservation — three caveats, in decreasing severity:**

1. **YAML mappings are unordered *by spec*.** The YAML spec defines a mapping as an unordered
   set of key/value pairs. Emitting in list order preserves order *textually*, and the common
   parsers (`js-yaml`, `yaml`) preserve document order into JS object insertion order — so it
   works in practice, and OpenCode's own files rely on it (`"*": deny` first). But
   **order-as-semantics in a map is an implicit contract with OpenCode's parser**, not a
   guarantee. If OpenCode ever normalizes, sorts, or round-trips permission keys through an
   unordered dict, every deny-all-then-allowlist agent silently inverts. This is a real
   fragility in the *target format*, inherited by us — worth stating plainly rather than
   assuming.
2. **Integer-like keys silently jump position.** Per ECMAScript, integer-index-like string
   keys (`"2"`, `"8080"`) are ordered numerically *ahead of* all other string keys regardless
   of insertion order. Real scopes are globs (`*`, `**/*.env*`, `sudo *`) and are never
   integer-like, so this is currently theoretical — but it is a silent, order-inverting failure
   if a scope like `"8080"` ever appears. **Mitigation:** the IR should reject integer-like
   scopes at parse time (cheap validation).
3. **Duplicate scopes collapse.** The IR list can hold the same scope twice with different
   decisions; a map cannot (the later key silently overwrites). **Mitigation:** enforce
   scope-uniqueness-per-capability in the IR schema. Duplicate scopes are meaningless under
   either match direction anyway.

**Conclusion:** with those two cheap IR validations (no integer-like scopes; unique scopes per
capability), OpenCode **round-trips Option A exactly and deterministically**. Without them,
ordering is preserved in practice but is not deterministic-by-spec. Both validations belong in
`02` — Open Question #Q2.

### 1.4 Content-type mapping

**Agents.** Frontmatter per the index worked example (`name`/`description`/`mode`/`temperature`/
`permission`). Because Option A carries scoping in content, **no adapter-injected safety
preset is needed** (locked #5: "safety globs live naturally in content"). This removes the v1
"default safety pattern set" proposal — v1's Open Question on that is **closed**.

**Skills.** → `.opencode/skill/<id>/SKILL.md`, frontmatter `name/description/version/author/
type: skill/category/tags` (verified: `skill/project-orchestration/SKILL.md`).

**Commands.** → `.opencode/command/<id>.md`, frontmatter `description:` only (verified across
the 20 real command files).

**Context.** Referenced, not copied-and-rewritten: files land at `.opencode/context/<path>`
**byte-for-byte (MVI comment intact — §0.6)**; loading is via `@`-import + `paths.json`
(verified in `opencoder.md`: *"paths.json is loaded via @ reference in frontmatter"*);
`context:<id>` recorded in sidecar `dependencies`.

**Hooks.** → `.opencode/plugin/` registration. Full support.

### 1.5 Manifest generation

- `.opencode/opencode.json` — static `{ "$schema": "https://opencode.ai/config.json" }`.
- `.opencode/config.json` — `{ "agent": "<default primary id>" }` (observed: `eval-runner`).
- `.opencode/config/agent-metadata.json` — sidecar: `id/name/category/type/version/author/
  tags/dependencies[]` + `maxSteps` + `context[].priority` + folded `examples`.
- `.opencode/agent/<category>/0-category.json` — `name/description/icon/agents{}` with
  `commonSubagents/commonTools/commonContext`.

### 1.6 Lossy transforms (OpenCode)

| Field | Disposition | Warning |
|---|---|---|
| `inference.maxSteps` | sidecar (advisory; unenforced) | `⚠️  Feature 'maxSteps' (<n>) is not supported by OpenCode` |
| `context[].priority` | sidecar; not enforced at load | `⚠️  Feature 'context priority' will be degraded: ordered load → sidecar metadata only` |
| `examples[]` | folded into body/sidecar | *(none — content preserved)* |

**Capabilities: zero loss** — scopes, ordering, and `ask` all survive (subject to §1.3).
Temperature, delegation, skills, hooks, external context: **full fidelity**.

---

## 2. Claude Code Adapter

**Authoritative target = the plugin layout**, verified at
`~/.claude/plugins/cache/oac-marketplace/oac/1.0.2/`.

> ### ⚠️ Locked finding (index v2 #4): `ClaudeAdapter.ts` targets the wrong layout
> It writes the **project** layout (`.claude/agents/*.md`, `.claude/config.json`,
> `.claude/skills/<name>/SKILL.md` — see `ClaudeAdapter.ts:95-124`). The authoritative format
> is the **plugin** layout (`.claude-plugin/plugin.json`, flat `agents/`, `hooks/hooks.json`,
> bundled `context/`). **As written it produces something CC cannot load as a plugin.** The
> adapter must be retargeted to §2.1 before any CC output is trustworthy.

### 2.1 File / directory layout

```
<plugin-root>/                       # e.g. dist/claude/ → plugins/cache/oac/<ver>/
  .claude-plugin/plugin.json         # plugin manifest
  agents/<id>.md                     # FLAT dir, kebab id — no category nesting
  skills/<skill-id>/SKILL.md         # directory-per-skill
  skills/<skill-id>/<supporting>.md  # e.g. context-discovery-protocol.md
  commands/<command-id>.md
  hooks/hooks.json                   # event → command wiring
  hooks/session-start.sh             # ⚠️ preserve — no OpenCode equivalent (index v2 #3)
  context/<category>/<...>.md        # BUNDLED, copied byte-for-byte (MVI comment intact)
  .context-manifest.json
  settings.json                      # ⚠️ see §2.5 — `model` key may be a no-op
  README.md
```

### 2.2 Field mapping table

| Neutral field | CC target | Transform rule |
|---|---|---|
| `id` | `name:` + `agents/<id>.md` | **id → kebab-case** |
| `name` | H1 in body | PascalCase, prose only |
| `role` | *(none)* | every `agents/` file is a subagent; `primary` flattens → warn |
| `category` | `plugin.json` keywords | no per-agent field → warn |
| `description` | `description:` `\|` block | folded with `examples[]` as `<example>` blocks |
| `tags[]` | `plugin.json` keywords | merged at manifest level |
| `capabilities` | `tools:` / `disallowedTools:` | **ordered list → coarse allowlist** (§2.3) — lossy |
| `capabilities.delegate` | `Task` in `tools:` | collapse per §2.3 |
| `inference.temperature` | **dropped** | warn |
| `inference.tier` | `model:` or omit | resolve through project/adapter tier configuration; omit when no mapping is configured |
| `inference.maxSteps` | dropped | warn |
| `context[]` | copied → `context/` + SessionStart hook | **bundled**, not referenced (§2.4) |
| `dependencies[]` | resolved & bundled | `subagent:` deps force-emit that agent file |
| `examples[]` | `<example>` blocks in `description` | verified format (§2.3) |
| `hooks[]` (agent-level) | **dropped** | ⚠️ plugin subagents ignore `hooks` frontmatter (§2.5) |
| `hooks[]` (plugin-level) | `hooks/hooks.json` | full support |
| body | markdown | verbatim |

Capability→tool name (`ToolMapper.ts` `claude.fromOAC`, PascalCased): `read→Read, write→Write,
edit→Edit, bash→Bash, glob→Glob, grep→Grep, delegate→Task`.

### 2.3 The collapse rule — ordered rule list → coarse allowlist

> **SUPERSEDED (2026-07-17).** §2.3 and §2.5's permission rows describe the derive-and-degrade
> behaviour as specified before implementation. The shipped adapter replaced it twice over:
> first refuse-on-loss (`d643b4a`), then no derivation at all (`9b4e807`) — on the build path
> every agent targeting claude-code must author `oac.overrides.claude-code.tools`, taken
> verbatim, and its absence is a build error. The collapse rule below survives only on the
> `fromOAC` import path, where there is no source file to author an override in. Kept as
> history; do not implement from it.

**Verified constraint (CC docs, `sub-agents.md`):** `tools:` and `disallowedTools:` are
allowlists/denylists of **tool NAMES only**. A pattern like `Bash(foo:*)` is **not valid** in
agent frontmatter — argument scoping exists *only* in `settings.json`. So **every scope ≠ `*`
is unrepresentable per-agent in CC.** The only question is which way each capability rounds.

**Rule — round to the default-scope decision (fail-closed on ambiguity):**

1. Normalize sugar → ordered list. Determine the **default-scope decision** (the `*` rule; if
   absent, the implicit default per §0.4 — Open Question #Q2).
2. `default = allow` → tool goes in `tools:`. Any `deny` exceptions are **dropped** → warn.
3. `default = deny` → tool goes in `disallowedTools:`, **omitted** from `tools:`. Any `allow`
   exceptions are **dropped** → warn.
4. `default = ask` → **round to deny** (CC has no per-agent interactive gate) → warn.
5. Exceptions are *never* used to flip the default.

**The `coder-agent` bash case** — `"*": deny` + two `router.sh` allows. The coordinator is
right that neither answer is correct; here is the choice and the justification:

> **Omit `Bash` (fail-closed).** Including `Bash` would grant **unrestricted shell** to an
> agent whose authored intent is "no shell except two exact `router.sh` invocations" — a
> silent privilege **escalation** of the widest possible blast radius, produced by a build
> step the user never inspects. Omitting `Bash` is a **functional regression** (`coder-agent`
> cannot update task status) that is **loud, visible at first use, and recoverable**.
> Asymmetry decides it: a wrong `deny` yields a broken agent; a wrong `allow` yields an agent
> that can `rm -rf` in a repo whose owner believed it was sandboxed. Escalation-by-default is
> never an acceptable build artifact. This also matches what the real plugin already ships —
> `agents/coder-agent.md` has `tools: Read, Write, Edit, Glob, Grep` (no `Bash`, no `Task`).

**Warnings** (both fire for this case):

```
⚠️  Feature 'scoped bash permissions' will be degraded: 1 default rule + 2 scoped exceptions → coarse tool allowlist
⚠️  Feature 'scoped bash allow-exceptions' (2 rules) is not supported by Claude Code
```

The second warning MUST enumerate the dropped scopes verbatim (`bash …/router.sh complete*`,
`bash …/router.sh status*`) so the loss is auditable, and point at the manual remedy in §2.6.

**The `edit` case is the more dangerous one and is easy to miss.** `coder-agent.edit` lists
*only* denies (`**/*.env*`, `**/*.key`, `**/*.secret`, `node_modules/**`, `.git/**`) with no
`*` rule ⇒ implicit default **allow** ⇒ `Edit` lands in `tools:` and **all five security globs
are dropped**. The CC agent can then edit `.env` and `.key` files that the authored agent was
explicitly forbidden from touching. This is a **silent security downgrade** produced by a
faithful application of the rule, so it must warn loudest:

```
⚠️  Feature 'scoped edit permissions' will be degraded: 5 deny-globs → unrestricted Edit
⚠️  Feature 'edit deny-globs' (**/*.env*, **/*.key, **/*.secret, node_modules/**, .git/**) is not supported by Claude Code
```

See Open Question #Q3: security-glob loss is arguably a **blocker**, not a warning.

**Agents.** Verified frontmatter (`agents/code-reviewer.md`):

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

### 2.4 Content-type mapping

**Skills.** → `skills/<id>/SKILL.md`. Verified frontmatter (`skills/code-review/SKILL.md`):
`name / description / context: fork / agent: code-reviewer`. The `context: fork` + `agent:`
keys (isolated forked execution) are CC-specific; the neutral skill IR needs optional
`execution: { isolate?, agent? }` to round-trip them (Open Question #Q5). Supporting `.md`
files copied alongside.

**Commands.** → `commands/<id>.md`, frontmatter `name / description`, body verbatim
(`commands/oac-status.md`). `${CLAUDE_PLUGIN_ROOT}` bash blocks preserved verbatim.

**Context — bundled, not referenced.** Unlike OpenCode:
1. every `context[]` entry and every transitive `context:` dependency is **copied byte-for-byte**
   into `context/<category>/…` — **the MVI HTML-comment line travels with the file and is never
   rewritten to YAML** (§0.6);
2. `.context-manifest.json` is generated: `version / profile / source{repository,branch,commit,
   downloaded_at} / categories[] / files{<cat>: <count>}` (verified against the shipped manifest);
3. at runtime `hooks/session-start.sh` (SessionStart) injects the skill catalogue + `using-oac`
   via dual-format JSON — `hookSpecificOutput.additionalContext` for CC, `additional_context`
   for other tools. `context[].priority` is **not** representable in that payload → dropped.

⚠️ `session-start.sh` has **no OpenCode equivalent** and lives in a directory slated for
deletion (index v2 #3) — it must be preserved into `/content/` first.

**Hooks.** Plugin-level `hooks/hooks.json` → full support; baseline always emits
`SessionStart → bash "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"` (timeout 30).
**Agent-level `hooks[]` are dropped** — see §2.5.

### 2.5 Lossy transforms (Claude Code)

| Field / feature | Disposition | Exact warning |
|---|---|---|
| `inference.temperature` | **dropped** (no per-agent temperature) | `⚠️  Feature 'temperature' (<value>) is not supported by Claude Code` |
| scoped rules (scope ≠ `*`) | dropped; default-scope decision wins | `⚠️  Feature 'scoped <cap> permissions' will be degraded: <n> rules → coarse tool allowlist` + an enumerating `is not supported` line |
| `decision: ask` | rounded to deny | `⚠️  Feature 'ask permission' for '<cap>' will be degraded: ask → deny (Claude Code has no per-agent interactive ask)` |
| rule **ordering** | meaningless after collapse | `⚠️  Feature 'permission rule ordering' is not supported by Claude Code` (emit once per agent with any multi-rule capability) |
| `context[].priority` | dropped (hook payload unordered) | `⚠️  Feature 'context priority' (<level>) is not supported by Claude Code` |
| `inference.maxSteps` | dropped | `⚠️  Feature 'maxSteps' (<n>) is not supported by Claude Code` |
| `category` | → keywords/prose | `⚠️  Feature 'agent category' will be degraded: typed category → plugin keywords` |
| `role: primary` | flattened | `⚠️  Feature 'agent mode' will be degraded: primary/subagent → subagent (Claude Code agents/ are all subagents)` |
| **agent-level `hooks[]`** | **dropped — verified** | `⚠️  Feature 'agent hooks' (<n> hooks) is not supported by Claude Code` |

**Verified (CC docs, `sub-agents.md`):** *"For security reasons, plugin subagents don't support
the `hooks`, `mcpServers`, or `permissionMode` frontmatter fields. These fields are ignored when
loading agents from a plugin."* So agent-level hooks are **silently ignored by CC** — the
adapter must warn rather than emit them. `permissionMode` being unavailable also closes off a
possible per-agent scoping route.

**⚠️ Related finding — `settings.json: {"model": "opusplan"}` is probably a no-op.** CC docs
(`plugins.md`, "Ship default settings with your plugin") state that in a plugin-shipped
`settings.json` *"only the `agent` and `subagentStatusLine` keys are supported."* `model` is
not in that list, so the value shipped by the plugin (added in **#264**, commit `40dd267`) is
likely **ignored by CC**. Confidence: **high** on the doc statement, **medium** on it applying
to this exact file (not runtime-verified). If true this is both (a) a live bug worth an issue,
and (b) the answer to v1's Q4 — the question is moot because the key has no effect. Flagged as
Open Question #Q6.

### 2.6 `settings.json` scoped permissions — investigated; **recommend AGAINST**

The coordinator asked whether the adapter can preserve scoping via CC `settings.json`. I
investigated, and the answer is a **verified negative** — it is not available to us at all.

**What's real and confirmed.** `settings.json` genuinely supports scoped rules with
`allow`/`deny`/`ask` arrays. Real examples from this very repo (`.claude/settings.local.json`)
include `Bash(git log:*)`, `Bash(npm test:*)`, and — strikingly — `Bash(bash
.opencode/skills/worktree/router.sh create fix/…)`, i.e. **exactly the `router.sh` scoping
shape `coder-agent` needs**. Syntax: `Tool(pattern)`, gitignore-style globs for path tools,
`:*` a trailing-wildcard form equivalent to ` *`. Precedence is **deny → ask → allow,
first match in that order; specificity does not reorder** — so a broad deny beats a narrow
allow. (Source: `code.claude.com/docs/en/permissions.md`.)

So the shape fits. **Three independent blockers kill it anyway:**

1. **Plugins cannot ship permissions — decisive.** Plugin-shipped `settings.json` supports
   *"only the `agent` and `subagentStatusLine` keys"* (`plugins.md`). OAC's CC target **is a
   plugin**. The adapter therefore **cannot emit permission rules at all** — anything it wrote
   would be ignored. This alone ends the option.
2. **Project scope ≠ agent scope.** Even via the user's own settings, rules are
   managed/local/project/user-scoped — never per-subagent. Restoring `coder-agent`'s intent
   ("deny all bash except two `router.sh` commands") would require `deny: ["Bash(*)"]`
   **project-wide**, breaking every other agent and the user's own shell. The one construct
   that would make it safe — per-agent scoping — is exactly what CC lacks.
3. **The agent allowlist wins anyway.** If `Bash` is omitted from an agent's `tools:`, a
   `settings.json` `Bash(...)` allow **cannot re-enable it** — the frontmatter allowlist is
   what gates the tool. So the escape hatch cannot rescue a fail-closed agent without *also*
   hand-editing its `tools:`. (Confidence: **medium** — CC docs describe subagents as having
   "independent permissions" but do not spell out the interaction; flagged in #Q4.)

**Recommendation — emit documentation, not configuration.** The adapter should generate a
**`RECOMMENDED-PERMISSIONS.md`** (or a README section) containing a copy-pasteable
`settings.json` snippet for the rules that were dropped, and reference it from the warnings.
Constrain it to the **safe direction only**:

- **Hoist `deny` rules that are universal across all agents.** The security globs are already
  near-universal in content (`**/*.env*`, `**/*.key`, `**/*.secret`, `node_modules/**`,
  `.git/**` appear on `coder-agent` *and* `openagent`; `sudo *`, `rm -rf /*` recur too). As
  project-level denies — `Edit(**/*.env*)`, `Bash(sudo *)` — they over-apply in the **safe**
  direction, and CC's deny-first precedence makes them robust. This genuinely recovers the
  §2.3 `edit` security downgrade, *if the user opts in*.
- **Never suggest hoisting `allow` rules.** A project-level `Bash(bash …/router.sh complete:*)`
  would grant that command to **every** agent, including ones authored with no shell at all —
  re-introducing the escalation §2.3 exists to prevent, just one layer up.

Net: **scoping cannot be preserved mechanically for CC.** Fail-closed per-agent (§2.3) plus an
opt-in, deny-only documented snippet is the honest ceiling. Recording this as a closed question
rather than an open one is itself a deliverable — the index currently lists it as open.

### 2.7 Manifest generation

- `.claude-plugin/plugin.json` — `name / description / version / author{name,url} / license /
  repository / homepage / keywords[]` (keywords aggregated from agent `tags` + `category`).
  Verified against the shipped 1.0.2 manifest. ⚠️ Version must be reconciled first — the cache
  is at **1.0.2**, *ahead* of the marketplace entry it builds from (index v2 #6), which would
  suppress the `/plugin update` delivering any fix.
- `hooks/hooks.json` — event→command map; always includes the SessionStart baseline.
- `.context-manifest.json` — see §2.4.
- `settings.json` — see the §2.5 no-op finding.

### 2.8 Worked-example re-verification under Option A

**`code-reviewer` → the index predicts exactly 1 warning (temperature). Under Option A as
specified here it produces 2, and the extra one is load-bearing.**

Walking it: `read/grep/glob: allow` and `edit/write/bash: deny` are all **scalar sugar** ⇒ each
is a single `*` rule ⇒ **no scoping, no ordering, no `ask`** ⇒ they collapse cleanly to
`tools: Read, Glob, Grep` + `disallowedTools: Write, Edit, Bash` with **zero warnings**. That
part confirms the index exactly, and confirms Option A costs nothing for simple agents —
sugar-only agents are warning-free apart from unsupported scalars. `temperature: 0.1` →
**warning 1**.

But `delegate: { contextscout: allow }` is **map sugar for a scoped rule** —
`[{scope: "contextscout", decision: allow}]`, scope ≠ `*`. Its intent is "may delegate to
contextscout **and nothing else**". CC's `Task` is coarse: granting it permits delegation to
**any** agent. So per §2.3 (implicit default = deny, since only allows are listed) `Task` is
**omitted** — which is exactly what the index's `tools: Read, Glob, Grep` shows, and exactly
what the shipped `agents/code-reviewer.md` does (`disallowedTools: … Task`). The output is
right; but dropping a delegation the agent was granted **is** a scoped-rule degradation, and
§0.3 forbids silent loss → **warning 2**:

```
⚠️  Feature 'scoped delegate permissions' (contextscout) is not supported by Claude Code
```

Reconciliation options: **(a) accept 2 warnings** and correct the index — recommended, because
the alternative is either a silent capability drop or (worse) granting unrestricted `Task`; or
**(b)** define delegate→Task collapse as an expected non-warning narrowing — which contradicts
"warnings are never silent" and hides a real loss. **The output artifact is identical either
way; only the count changes.** Open Question #Q7. Note the count is 1 *only* under the v1 flat
model, where `delegate` carried no scope — so this is a genuine, expected consequence of
Option A, not a regression.

**`coder-agent` → 4 warnings**, all from §2.3/§2.5:

| # | Cause | Warning |
|---|---|---|
| 1 | `temperature: 0` | `⚠️  Feature 'temperature' (0) is not supported by Claude Code` |
| 2 | `bash` `*: deny` + 2 `router.sh` allows → `Bash` omitted (fail-closed) | `⚠️  Feature 'scoped bash permissions' will be degraded: 1 default rule + 2 scoped exceptions → coarse tool allowlist` |
| 3 | `edit` 5 security deny-globs → unrestricted `Edit` | `⚠️  Feature 'scoped edit permissions' will be degraded: 5 deny-globs → unrestricted Edit` |
| 4 | `delegate` allowlist (contextscout, externalscout, TestEngineer) → `Task` omitted | `⚠️  Feature 'scoped delegate permissions' (3 rules) is not supported by Claude Code` |

Resulting file matches the shipped `agents/coder-agent.md` (`tools: Read, Write, Edit, Glob,
Grep`) — i.e. **the hand-authored CC plugin already made every one of these choices**, which is
independent corroboration that fail-closed is the right rule. **Warning 3 is the one to act on:**
`coder-agent` on CC is strictly less safe than on OpenCode, and no adapter-side fix exists
(§2.6).

---

## 3. Cursor Adapter

Described from `adapters/CursorAdapter.ts`, `fixtures/sample-cursorrules`, and `ToolMapper.ts`
`cursor`. **Format carries real uncertainty — see Open Questions.**

Lowest-fidelity target: effectively single-agent, no skills, no hooks, no delegation, no
external context refs, no permission model to speak of.

### 3.1 Layout

- **Legacy (stub's output):** single `.cursorrules` at project root.
- **Modern (likely correct):** `.cursor/rules/*.mdc` — MDC files with `description` / `globs` /
  `alwaysApply` frontmatter.

Multiple neutral agents are **merged into one** (`CursorAdapter.mergeAgents()`): prompts joined
under `# Agent N: <name>`, union of tools, **max** temperature, first non-null model.

### 3.2 Field mapping table

| Neutral field | Cursor target | Transform rule |
|---|---|---|
| `id` / `name` | `name:` | verbatim (merged agent) |
| `role` | *(none)* | dropped |
| `category` | *(none)* | dropped |
| `description` | `description:` | verbatim |
| `capabilities` | prose "# Tool Access" list | **default-scope decision only**; all scoping dropped (§3.3) |
| `capabilities.delegate` | dropped | `task` unsupported (`ToolMapper` marks it so) |
| `inference.temperature` | `temperature:` | verbatim; limited range |
| `inference.tier` | omit + warn | Cursor is experimental in v1; do not invent a concrete model mapping |
| `context[]` | **inlined** into rules body | copied as prose; MVI comment travels inline verbatim |
| `dependencies[]` | dropped | no dependency system |
| `examples[]` | prose | no native support |
| `hooks[]` | dropped | no hooks |
| body | rules body | verbatim |

Tool names (`ToolMapper.ts` `cursor.fromOAC`): `bash→terminal, read→file_read, write→file_write,
edit→file_edit, glob→file_search, grep→content_search, task→(unsupported)`.

### 3.3 Capabilities under Option A

Cursor has **no enforced permission model** in `.cursorrules` — tools are listed as *prose*, so
even the default-scope decision is advisory. Collapse rule: same as CC §2.3 (fail-closed;
default-scope decision wins; `ask` → deny), then render the resulting allow-set as a prose
list. Every scope ≠ `*` is dropped, and ordering is meaningless. **Cursor is the weakest target
for security intent** — `coder-agent`'s deny-globs become, at best, a suggestion in a rules
file. Open Question #Q8 asks whether `.mdc` `globs:` can carry any of this (it scopes *rule
activation by file*, which is not the same as *permission*, but is the nearest construct).

### 3.4 Content types

- **Agents:** merged; frontmatter `name / description / model? / temperature?` (per fixture).
- **Skills:** none → inlined (warn).
- **Commands:** no native system (Open Question #Q8).
- **Context:** **inlined** under `# Context Files` with `## <path>`, optional `*description*`,
  `**Priority**`, and a "load this file" note. Priority is written as text, never enforced.
- **Hooks / dependencies:** dropped.

### 3.5 Manifest

**None.** `getConfigPath()` → `.cursorrules` (legacy) or `.cursor/`. The rules file *is* the
configuration.

### 3.6 Lossy transforms (Cursor)

| Field / feature | Disposition | Exact warning |
|---|---|---|
| multiple agents | merged | `⚠️  Cursor IDE does not distinguish between primary and subagent modes` (per subagent) |
| scoped rules | dropped | `⚠️  Feature 'scoped <cap> permissions' (<n> rules) is not supported by Cursor IDE` |
| `decision: ask` | → deny | `⚠️  Feature 'ask permission' for '<cap>' will be degraded: ask → deny (Cursor IDE has no interactive ask)` |
| rule ordering | meaningless | `⚠️  Feature 'permission rule ordering' is not supported by Cursor IDE` |
| permissions generally | advisory prose only | `⚠️  Feature 'permissions' will be degraded: enforced allow/deny/ask → advisory prose in rules file` |
| `skills[]` | inlined | `⚠️  Feature 'skills' (<n> skills) is not supported by Cursor IDE` + `💡 Consider inlining skill content into the main prompt for Cursor` |
| `hooks[]` | dropped | `⚠️  Feature 'hooks' (<n> hooks) is not supported by Cursor IDE` |
| `inference.maxSteps` | dropped | `⚠️  Feature 'maxSteps' (<n>) is not supported by Cursor IDE` |
| `capabilities.delegate` | dropped | `Tool 'task' is not supported by cursor` (`ToolMapper`) |
| `context[]` | inlined | `💡 <n> context file(s) referenced - consider loading them manually in Cursor` |

---

## 4. Windsurf Adapter

From `adapters/WindsurfAdapter.ts` + `ToolMapper.ts` `windsurf`. **Inferred, not verified
against a live install — see Open Questions.**

Mid-fidelity: multiple agents ✅, external context refs ✅; binary permissions,
temperature→creativity, partial skills, no hooks.

### 4.1 Layout

```
.windsurf/
  config.json                    # role: primary
  agents/<id>.json               # role: subagent
  context/<...>.md               # copied byte-for-byte (MVI comment intact)
```
The ecosystem also uses root `.windsurfrules` and `.windsurf/rules/*.md`; the stub commits to
JSON (Open Question #Q9).

### 4.2 Field mapping table

| Neutral field | Windsurf target | Transform rule |
|---|---|---|
| `id` / `name` | `name` | verbatim |
| `role` | `type` | `primary`/`subagent` (partial) |
| `category` | `category` | verbatim (enum-validated) |
| `description` | `description` | verbatim |
| `capabilities` | `tools` + `permissions` (binary) | **default-scope decision → boolean**; scoping dropped (§4.3) |
| `capabilities.delegate` | `delegate` tool | partial (`task→delegate`) |
| `inference.temperature` | `creativity` | `≤0.4→low`, `≤0.8→medium`, `>0.8→high` |
| `inference.tier` | omit + warn | Windsurf is outside v1 until its live format is verified |
| `context[]` | `contexts[]` path refs | referenced under `.windsurf/context/` |
| `context[].priority` | `priority` | `critical/high→high`, `medium/low→low` (4→2) |
| `dependencies[]` | partial | subagent deps → separate JSONs; others dropped |
| `examples[]` | dropped | no support |
| `hooks[]` | dropped | no hooks |
| `skills[]` | `contexts[]` refs | → `.windsurf/context/<skill>.md` |
| body | `systemPrompt` | verbatim |

Tool names (`ToolMapper.ts` `windsurf.fromOAC`): `bash→shell, read→read_file, write→write_file,
edit→edit_file, glob→find_files, grep→search_content, task→delegate`.

### 4.3 Capabilities under Option A

`mapOACPermissionsToWindsurf` produces `Record<string, boolean>` — **binary, unscoped,
unordered**. Collapse: default-scope decision → `allow→true`, `deny→false`, `ask→false`
(bespoke warning below, matching the stub's existing literal). All scope ≠ `*` rules dropped;
ordering meaningless. Same fail-closed asymmetry as CC §2.3: `coder-agent.bash` (`*: deny`)
→ `shell: false`; its `edit` deny-globs (implicit default allow) → `edit_file: true` with the
globs lost.

⚠️ The stub's current granular branch does the **opposite** of fail-closed —
`WindsurfAdapter.ts:511-516` sets `windsurfPerms[tool] = hasAllow` for object-valued
permissions, i.e. **any** `allow` key flips the tool **on**. Under Option A that turns
`coder-agent`'s deny-all-plus-two-exceptions into **unrestricted shell** — the exact
escalation §2.3 rejects. **This branch must be replaced by the default-scope rule**, not
merely re-pointed at the new shape.

### 4.4 Content types

- **Agents:** JSON (`name/description/type/systemPrompt/model?/tools/creativity?/category/
  contexts[]/permissions`).
- **Skills:** degraded → `contexts[]` refs at `.windsurf/context/<skill>.md`.
- **Commands:** no clear equivalent (Open Question #Q9).
- **Context:** referenced, copied byte-for-byte; priority collapsed 4→2.
- **Hooks:** dropped.

### 4.5 Manifest

`.windsurf/config.json` doubles as primary-agent file and de-facto manifest. No dedicated
plugin manifest (Open Question #Q9).

### 4.6 Lossy transforms (Windsurf)

| Field / feature | Disposition | Exact warning |
|---|---|---|
| `hooks[]` | dropped | `⚠️  Feature 'hooks' (<n> hooks) is not supported by Windsurf` + `❌ Windsurf does not support hooks - behavioral rules will be lost` |
| scoped rules | dropped | `⚠️  Feature 'scoped <cap> permissions' (<n> rules) is not supported by Windsurf` |
| `decision: ask` | → false | `⚠️  Permission "ask" for <tool> degraded to false (deny). Windsurf only supports binary on/off.` *(stub literal — preserve verbatim)* |
| rule ordering | meaningless | `⚠️  Feature 'permission rule ordering' is not supported by Windsurf` |
| granular permissions | binary | `⚠️  Feature 'granular permissions' will be degraded: ordered scope rules → binary on/off per tool` |
| `skills[]` | context refs | `⚠️  Feature 'skills' will be degraded: full Skills system → basic context references` |
| `inference.temperature` | → creativity | `⚠️  Feature 'temperature' will be degraded: numeric temperature → creativity (low/medium/high)` |
| `context[].priority` | 4→2 | `⚠️  Feature 'context priority' will be degraded: critical/high/medium/low → high/low` |
| `inference.maxSteps` | dropped | `⚠️  Feature 'maxSteps' (<n>) is not supported by Windsurf` |
| `context[]` | reminder | `💡 <n> context file(s) referenced - ensure they exist in .windsurf/context/` |

---

## 5. Consolidated Capability Matrix

Extends `CAPABILITY_MATRIX` in `core/CapabilityMatrix.ts`. Cells: **full** / **partial** /
**none**. `oac` = the OpenCode adapter target.

| Feature (category) | oac | claude | cursor | windsurf | Notes |
|---|:--:|:--:|:--:|:--:|---|
| multipleAgents (agents) | full | full | none | full | cursor: single/merged rules file |
| agentModes (agents) | full | **partial** ✏️ | none | partial | ✏️ **corrected** (index v2 #5): plugin has no per-agent `mode:`; every `agents/` file is a subagent → `primary` flattens |
| agentCategories (agents) | full | **none** ✏️ | none | partial | ✏️ **corrected** (index v2 #5): survives only as `plugin.json` keywords |
| granularPermissions (permissions) | full | none | none | none | only oac has per-scope allow/deny/ask |
| **scopedPermissions** (permissions) † | full | none | none | none | **NEW** — glob/argument scoping *within* a capability (`**/*.env*`, `router.sh …*`). CC `tools:` is tool-NAME-only (verified, `sub-agents.md`); `Bash(x:*)` is settings.json-only and **plugins cannot ship permissions** (§2.6) |
| **askTriState** (permissions) † | full | none | none | none | **NEW** — CC *platform* has a settings.json `ask` array, but it is **unreachable from a plugin** (§2.6) ⇒ adapter-reachable support is none; rounds to deny |
| **permissionRuleOrdering** (permissions) † | full | none | none | none | **NEW** — ordered last-match-wins lists, confirmed by `10`; OpenCode preserves textual insertion order (§1.3) |
| pathPatterns (permissions) | full | none | none | **none** ✏️ | ✏️ windsurf downgraded partial→none: `Record<string,boolean>` cannot hold a path pattern |
| taskDelegation (tools) | full | **partial** ✏️ | none | partial | ✏️ claude downgraded full→partial: `Task` is coarse — a scoped delegate allowlist cannot be expressed (§2.8) |
| bashExecution (tools) | full | full | full | full | name remap only |
| fileOperations (tools) | full | full | full | full | name remap only |
| searchOperations (tools) | full | full | full | full | name remap only |
| externalContext (context) | full | full | none | full | cursor: refs unsupported, content inlined (see contextBundling) |
| contextPriority (context) | full | none | none | partial | windsurf 4→2; claude drops; oac sidecar-only. ⚠️ all depend on the MVI parser (§0.6) |
| contextSubdirs (context) | full | full | none | full | cursor single-file |
| skillsSystem (context) | full | full | none | partial | claude dir-per-skill; windsurf → context refs; cursor inline |
| inferenceTier (model) | full | partial | none | none | semantic tier only; concrete model mapping is project/adapter config, never canonical content |
| temperatureControl (model) | full | none | partial | partial | claude drops; cursor limited; windsurf → creativity |
| maxSteps (model) | full | none | none | none | oac sidecar advisory |
| hooks — plugin/project-level (advanced) | full | full | none | none | claude: `hooks.json` + `session-start.sh` |
| **hooks — agent-level (advanced)** † | full | none | none | none | **NEW** — verified: plugin subagents **ignore** `hooks`/`mcpServers`/`permissionMode` frontmatter (`sub-agents.md`) |
| dependencies (advanced) | full | full | none | partial | cursor none; windsurf subagent deps only |
| priorityLevels (advanced) | full | partial | none | partial | oac 4 levels; claude/windsurf 2 |
| **commands** (advanced) † | full | full | none | none | **NEW** — claude `commands/*.md`; cursor/windsurf have no command system |
| **manifest/packaging** (advanced) † | full | full | none | partial | **NEW** — claude `.claude-plugin/plugin.json`; oac `opencode.json` + sidecar; windsurf `config.json` only |
| **contextBundling** (context) † | *reference* | *bundle+hook* | *inline* | *reference* | **NEW** — descriptive, not a support level: *how* externalContext is realized |

† = new row (beyond current `CapabilityMatrix.ts`). ✏️ = corrects a value that is **wrong in
the current file**.

**Corrections to land in `CapabilityMatrix.ts`** (4 value fixes, all verified):
`agentModes: claude` full→partial · `agentCategories: claude` partial→none ·
`pathPatterns: windsurf` partial→none · `taskDelegation: claude` full→partial.
`externalContext: cursor` stays **none** (referencing is unsupported; inlining is captured by
`contextBundling`, not by upgrading this cell — Open Question #Q10).

---

## 6. Adapter selection & pipeline notes

- `oac build --target <tool>` selects via `AdapterRegistry`; each adapter implements
  `fromOAC(agent) → ConversionResult` (`{ files: ToolConfig[], warnings: string[] }`).
- `analyzeCompatibility(agent, target)` runs first: `blockers` fail the build; `warnings` are
  printed and counted. It must be extended to predict the new rows above — today it has no
  concept of scoped rules and would under-report every Option A agent.
- Whole-repo builds run manifest generation once after per-agent conversion.
- `oac apply` is already ~80% of this pipeline (index v2 #8).

---

## Stage 1 question dispositions

1. **Q1 precedence:** last-match-wins, confirmed by `10-PRECEDENCE-EXPERIMENT.md`.
2. **Q2 implicit default and scope validation:** ratified in `02` §§1.2.5–1.2.6.
3. **Q3 security-glob loss:** build blocker with explicit `--allow-unsafe-degradation` opt-in.
4. **Q4 CC `tools:` interaction:** accepted uncertainty; fail-closed output omits `Bash`, and
   `oac doctor --verify` tests the loaded result before release.
5. **Q5 skill execution metadata:** represented by the neutral skill execution/target fields in
   `02`; unsupported targets report degradation.
6. **Q6 plugin `settings.json` model:** accepted as non-authoritative and omitted from v1 output.
7. **Q7 warning count:** two warnings for `code-reviewer`, four for `coder-agent`; `05` and `07`
   assert the exact counts.
8. **Q8 Cursor format:** experimental, not a first-class v1 target; no fidelity promise.
9. **Q9 Windsurf format:** cut from v1 until verified against a live install.
10. **Q10 Cursor cell semantics:** `none` for v1; loss is explicit, never silently upgraded.

**Closed in v2:** v1's Q1 (ClaudeAdapter wrong layout — **confirmed**, now index v2 #4 and
§2 header) · v1's Q9 (OpenCode safety-pattern preset — **moot**: Option A puts safety globs in
content, per locked #5) · the index's open CC-`settings.json`-scoping question (**closed
negative**, §2.6: plugins cannot ship permissions).
