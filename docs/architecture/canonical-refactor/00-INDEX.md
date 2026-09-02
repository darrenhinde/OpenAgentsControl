# OAC Canonical Refactor — Master Spec Index

> **Current state (2026-09-02):** This is historical refactor documentation. The active metadata workflow is canonical `content/agents/**` `oac:` blocks emitted by RegistryEmitter; sidecar metadata and sidecar merging are superseded.

> **Status:** Specification — v2 (post spec-pass reconciliation). No implementation yet.
> **Goal:** Re-architect OAC from an OpenCode-specific project into a tool-agnostic,
> npm-distributed system with a single neutral source of truth that generates
> per-tool outputs (OpenCode, Claude Code, Cursor, Windsurf).
> **2026-09-02:** Cursor and Windsurf were dropped as targets. Only OpenCode and Claude Code are built; references to the other two below are historical.

This index is the **authoritative shared context** for all spec workstreams. Read it first.
Where a spec document conflicts with this index, **this index wins**.

---

## Locked Decisions (do not relitigate)

1. **Single source of truth = a new tool-neutral `/content/` directory.**
   OpenCode, Claude Code, Cursor, Windsurf are all **generated build targets** via
   `oac build --target <tool>`. `.opencode/` stops being source and becomes build
   output. **No tool is privileged** — OpenCode is just another adapter.

2. **No hardcoded models.** Canonical `model` defaults to `null` = "use the tool's
   default model." Content never bakes in a model. Supersedes PRs **#311** and **#324**
   (both rejected). *Open:* whether `model` should be authorable in `/content/` at all,
   or exist only in the IR as always-null (see 02 Open Questions).

   ⚠️ **v2.2 — GAP: `model: null` destroys deliberate cost tiering.** The shipped CC agents
   are **5 `sonnet` + 2 `haiku`** — and the two haiku agents are `context-scout` and
   `external-scout`. That is not an arbitrary model choice; it is an intentional **cost tier**
   (cheap/fast models for retrieval-shaped work). Flattening both to `null` silently discards
   that intent with **no replacement**, and would push the scouts onto an expensive default.
   **Proposed resolution:** add a neutral **semantic tier** — `inference.tier: fast | balanced | deep`
   (default `balanced`) — expressing *intent* rather than a model name. Adapters map tier →
   whatever that tool's fast/deep model is; tools without tiers drop it with a warning. This
   preserves the optimization while keeping content model-agnostic, satisfying decision #2 in
   spirit rather than merely in letter. **Needs ratification** — it adds a field to the IR.

3. **Minimal-tests-first.** Ship the smallest test proving the pipeline (golden snapshot
   + parse/manifest check on ONE worked agent). Write the full layered test spec now;
   implement later layers at the stages defined in `05`. Priority is core functionality
   working end to end.

4. **Incremental, each-stage-shippable.** Avoid another stalled mega-PR (cf. #298,
   +19k lines, now conflicting). Every stage delivers standalone value.

5. **Permissions = ordered rule list + scalar sugar (Option A).** ← *decided v2*
   The neutral `capabilities` model is an **ordered list** of `{scope, decision}` rules
   per capability, with scalar sugar for the simple case. Rationale: the previously
   specified flat model (`edit: deny`) is **provably lossy** — verified against real
   agents, it cannot express `coder-agent`'s deny-all-then-allowlist (which would break
   its ability to run its own `router.sh`), loses per-agent security globs
   (`**/*.env*`, `**/*.key`), and erases the deliberate distinction between
   `coder-agent` (deny-by-default) and `openagent` (ask-by-default).
   **Consequence:** safety globs live naturally in content — no separate `guards` hint
   and no adapter-injected policy needed.

6. **Context metadata stays MVI HTML-comment on disk.** ← *decided v2*
   296 context `.md` files use a single compact line:
   `<!-- Context: standards/code | Priority: critical | Version: 2.0 | Updated: … -->`
   (verified: **286** HTML-comment, 3 YAML `---`, 7 neither). This is **deliberate** —
   it is far more token-efficient than multi-line YAML and is read by the model on every
   load. **Do NOT migrate to YAML frontmatter.** The IR parser normalizes this format
   in-memory. **The authored on-disk format and the IR shape do not have to match.**

   **Two parser traps — both verified. This is the highest-risk parser requirement in the project:**
   - ⚠️ **Trap 1 (silent data loss):** a generic parser (`gray-matter`) finds **no frontmatter**
     here and silently drops **all** priority data — and priority drives context ordering.
   - ⚠️ **Trap 2 (false positives):** "grep the first marker anywhere" is *also* wrong.
     `openagents-repo/core-concepts/agents.md` has a marker at **line 232** and
     `categories.md` at **line 301** — both are *prose about the format*. A naive parser
     assigns `standards/code | critical` as those files' real metadata.
     **The parser MUST only honor a leading window** (line 1, or the first line after a
     closing YAML `---`) and treat every later marker as body text.
   - The 3 "YAML" files also carry an MVI marker at line 11 — they are **dual-format**, not YAML-only.

   **Enum must not be strict:** `Priority: reference` exists in real content
   (`core/workflows/lightweight-context-handoff-example.md`) outside the documented
   `critical|high|medium|low` set. A strict `z.enum` rejects a real file. Also, 4 markers
   omit `Version`/`Updated` — so only `Context` and `Priority` may be required.

   **Verified distribution (v2.2 correction):** high **112**, critical **111**, low **34**,
   medium **29**, reference **1** — counted over the *leading window only*.
   ⚠️ *An earlier count of 116/113/34/31/1 was wrong: it grepped for the marker **anywhere**
   in the file and swept in the line-232/301 prose-about-the-format markers — i.e. it
   committed Trap 2 while attempting to verify Trap 2.* **Any script counting or parsing
   these markers must apply the leading-window rule, including the "first line after a
   closing YAML `---`" case (3 dual-format files carry their marker at line 11).**

## Corrected Census (verified — earlier numbers were wrong)

| Item | Correct | Previously claimed |
|---|---|---|
| Agents | **34** `.md` | 39 (= 34 + 5 `0-category.json`); one spec said 160 — false |
| Commands | **20** `.md` | 29 (= 20 + 9 `.yaml` eval templates) |
| Context | **296** `.md` (286 HTML-comment / 3 YAML / 7 neither) | 297 |
| Skills (OpenCode) | **6** across **two** dirs (v2.2 correction) | 2 — wrong |
| Skills (Claude Code plugin) | **12** (v2.2 correction) | ~11 — wrong |

⚠️ **v2.2 — OpenCode skills live in TWO differently-named directories:**
`.opencode/skill/` (2: `project-orchestration`, `task-management`) **and** `.opencode/skills/`
(4: `context-manager`, `context7`, `smart-router-skill`, `task-management`) — with
**`task-management` duplicated across both**. The earlier "2" was wrong and propagated into
`02` and `03`. Which of the two `task-management` copies is authoritative is **unresolved**.

⚠️ **v2.2 — 3 SYMLINKS in the context tree, previously unmentioned by every doc:**
`core/standards/code.md → code-quality.md`, `docs.md → documentation.md`,
`tests.md → test-coverage.md`. They (a) **break Windows checkouts** — git materializes them
as text files containing the target path unless `core.symlinks=true`, which `04`'s Windows
section does not cover; (b) break build determinism; and (c) are **the same three files** as
`01`'s duplicate-id finding — so the proposed "collapse to `aliases[]`" would delete them and
break the files referencing the alias paths directly. Needs an explicit decision.

**Non-finding (corrected):** an earlier claim of *"committed `.env` files needing
rotation"* is **false**. Verified: **0 tracked `.env` files**; `.env` is gitignored
(`.gitignore:9-13`). No security incident. The only real point is build hygiene — a
filesystem-globbing build must not sweep local `.env` files into `/content/`.

## Verified Critical Findings

1. **Bun defeats the npm goal (Stage 0 blocker).** `bin/oac.js` does
   `execFileSync('bun', …)` → *"Bun is required."* **15 files** use Bun-only APIs
   (`Bun.file`/`Bun.write` across `installer.ts`, `sha256.ts`, `ide-detect.ts`;
   `import.meta.dir` in `bundled.ts`). `npm i -g` without Bun **fails outright** —
   defeating the entire reason for npm distribution and likely explaining Windows
   install bugs (#304, #312). Fix is mechanical: `node:fs/promises`, `node:crypto`,
   `fileURLToPath(import.meta.url)`.

2. **Dependency resolution is broken — 4 converging signals.** `add.ts` never walks
   `dependencies[]`; `install.sh`'s recursive resolver swallows `jq` errors via
   `|| echo ""` (unknown refs → **zero deps, no error**); issue **#310**'s reporter
   independently diagnosed *"broken dependency chains from incomplete installation."*
   Likely consequence: `/add-context` installs **none** of the three standards it tells
   agents to follow. Fixing this will surface currently-hidden breakage.

3. **Seeding `/content/` is a MERGE, not a copy.** Drift is **bidirectional** — Claude
   Code is *ahead* in places: ~11 skills vs OpenCode's 2 (**disjoint sets**);
   hand-authored `<example>` blocks existing nowhere in `.opencode/`; and
   **`session-start.sh`** (skill catalogue, first-run onboarding, context-discovery
   bootstrap, injection defense) has **no OpenCode equivalent** — arguably the most
   important runtime feature, living in a file currently slated for deletion.
   **Seeding from `.opencode/` alone destroys all of it.**

4. **`ClaudeAdapter.ts` targets the wrong layout.** It writes the *project* layout
   (`.claude/agents/*.md`, `.claude/config.json`); the authoritative format is the
   *plugin* layout (`.claude-plugin/plugin.json`, flat `agents/`, `hooks/hooks.json`,
   bundled `context/`). As written it produces something CC cannot load as a plugin.

5. **`CapabilityMatrix.ts` lies in two rows.** `agentModes: claude = full` → should be
   **partial** (plugin format has no per-agent `mode:`; every `agents/` file is a
   subagent, so `role: primary` flattens). `agentCategories: claude` → likely **none**
   (survives only as `plugin.json` keywords).

6. **Version mismatch: 5 numbers across 7 files** (verified): `VERSION`/root `package.json`
   = 0.7.1, `packages/cli` = 1.0.0, `compatibility-layer` = 0.1.0, `evals/framework` = 0.1.1,
   marketplace = 1.0.0, **CC plugin cache = 1.0.2**. The cache is **ahead of the
   marketplace entry it's built from**, which would *suppress* the `/plugin update` that
   delivers any fix. Must be reconciled before any CC release.

7. **`bundled.ts` breaks post-refactor.** It identifies the package root by the *absence*
   of `registry.json` — but `registry.json` will ship *inside* the package.

8. **`oac apply` is already ~80% of `oac build`** (`loadAgents → adapter.fromOAC → write`).
   `build` is that pipeline promoted, re-rooted at `/content`, with OpenCode as a peer target.

9. **The CLI is already safer than the bash scripts** — sha256 manifest gating means user
   edits survive updates, whereas `update.sh` blind-curl-overwrites everything. Migration
   selling point, not just parity.

10. 🔴 **LIVE SECURITY GAP — `coder-agent` on Claude Code (exists in production today).**
    `coder-agent.edit` lists only denies with no `*` rule ⇒ implicit default **allow** ⇒ CC
    grants `Edit` and **all five security globs vanish** (`**/*.env*`, `**/*.key`,
    `**/*.secret`, `node_modules/**`, `.git/**`). Verified: the shipped plugin declares
    `tools: Read, Write, Edit, Glob, Grep`. **The live CC `coder-agent` can edit `.env`/`.key`/
    `.secret` files that OpenCode's `coder-agent` is explicitly denied.** This is a defect in
    the current product, not a refactor risk. No adapter-side fix exists (CC cannot express
    path-scoped denies per-agent). **Open (03 Q3): should this BLOCK the build rather than warn?**

11. **`coder-agent` bash → OMIT `Bash`, fail-closed.** Including it grants unrestricted shell
    to an agent authored as "no shell except two exact commands" — a silent escalation from a
    build step nobody inspects. Omitting it is a *loud, visible, recoverable* functional break.
    The asymmetry decides: a wrong deny yields a broken agent; a wrong allow yields `rm -rf` in
    a repo the owner believed sandboxed. Corroborated — the hand-authored plugin already ships
    exactly this (no `Bash`).

12. **`WindsurfAdapter.ts:511-516` is broken, but fails CLOSED** *(corrected — an earlier claim
    that it escalates to unrestricted shell was wrong)*. It does
    `const hasAllow = permObj.allow !== undefined` — but OpenCode permissions are **glob-keyed**
    (`{"*": "deny", "cmd*": "allow"}`), so no key named `allow` ever exists and `hasAllow` is
    *always* false. Every granular permission collapses to deny: over-restrictive, **not** a
    privilege escalation. Real bug; needs replacing, not re-pointing.

13. **The shipped CC agents hardcode `model: sonnet`** — violates locked decision #2. Must
    become null/omitted when `/content/` is seeded from the CC side (see finding #3: seeding
    is a merge, so CC-side content carries this in).
    *Unverified:* `settings.json {"model": "opusplan"}` (#264, `40dd267`) is plausibly a
    **no-op** — `model` may not be a supported plugin-settings key. Worth an issue; flagged,
    not asserted.

## Target Repo Shape

```
/content              ← THE source of truth (neutral; context keeps MVI HTML-comment metadata)
    /agents /skills /commands /context
    registry.json     ← component catalog
/packages
    /core             ← Zod IR schema + parser + registry loader   (from compatibility-layer/{types,core})
    /adapters         ← opencode | claude | cursor | windsurf       (from compatibility-layer/adapters)
    /cli              ← oac init|add|update|build|doctor            (from packages/cli, absorbs install.sh)
/evals                ← behavioral tests (unchanged; a free end-to-end gate — see 05)
```

**To be deleted (only after the minimal golden test is green):** `install.sh`, `update.sh`,
`scripts/bridge/sync-to-claude.sh`, `plugins/claude-code/` (generated), `.opencode/` as *source*.
⚠️ `session-start.sh` must be **preserved into `/content/`** before `plugins/claude-code/` is deleted.

## Existing Assets to Build On (extend, do NOT reinvent)

- `packages/compatibility-layer/src/types.ts` — Zod `OpenAgentSchema` (the IR).
  ⚠️ Known defects: `ModelIdentifierSchema = z.union([z.string(), z.string()])` is a
  **no-op union** (line 116) with no null default — cannot enforce decision #2; three
  overlapping identity carriers (frontmatter + metadata + `OpenAgentSchema.metadata` +
  sidecar) → collapse to one flat schema; `category` is **conflated** — *domain*
  (`core`/`development`) in agent metadata vs *distribution tier* (`essential`/`standard`)
  in `registry.json` → split into `category` + `profiles`.
- `packages/compatibility-layer/src/core/` — `TranslationEngine`, `AdapterRegistry`,
  `AgentLoader`, `CapabilityMatrix`
- `packages/compatibility-layer/src/adapters/` — `Base`, `Claude`, `Cursor`, `Windsurf`.
  Warning templates already exist at `BaseAdapter.ts:187-208` — **reuse their exact output**.
- `packages/compatibility-layer/src/mappers/` — `Context`, `Model`, `Permission`, `Tool`.
  ⚠️ `ContextMapper` anchors `.opencode/context` as privileged base → must become `/content/`.
- `packages/cli/src/**` — `init/add/update/doctor/status/list/apply` + `ide-detect` + `registry` + `installer`
- `registry.json` — 107KB component catalog

---

## Worked Example (the alignment reference)

Everyone must align to this. **Revised in v2 for the Option A capabilities model.**

### Capabilities model

```
capability: <scalar>                    # sugar → [{ scope: "*", decision: <scalar> }]
capability: [ { scope, decision }, … ]  # full ordered form
delegate:   { name: decision, … }       # map sugar → [{ scope: name, decision }, … ]
```
`decision ∈ allow | deny | ask`. Simple agents use sugar and stay simple; the nested form
appears **only** when scoping actually matters. Map sugar is accepted for **any** capability
— which is OpenCode's exact on-disk shape, making the OpenCode importer a lossless desugar.
`delegate` is not a special case: it is simply the capability whose scopes are agent ids
rather than globs.

#### Precedence — **last-match-wins** ⚠️ *STRONGLY INDICATED (v2.2) — NOT independently confirmed*

⚠️ **Epistemic correction (v2.2).** v2.1 called this "CONFIRMED via three independent
sources." That was an **overclaim** — all three are documents *this project wrote about
itself*, not primary evidence of OpenCode's resolver. Worse, the primary citation
(`12-MASTER-SYNTHESIS.md:432`) describes a **JSON array** permission format
(`[{ "deny": "bash(**)" }, …]`) that **does not exist** in any agent — they all use YAML
maps (`bash: { "*": "deny" }`). It is aspirational planning prose, not a description of
reality. The conclusion is still probably right (first-match-wins is *provably* wrong
against the corpus, and the authored order only makes sense under last-match), but
**primary verification against OpenCode's actual resolver is still REQUIRED before Stage 1.**

**In-repo sources (self-authored — corroborating, not probative):**
- `docs/archive/planning/12-MASTER-SYNTHESIS.md:432` — *"The `permission:` field uses **last-match-wins**
  evaluation (same as OpenCode's native system)"*
- `.opencode/context/openagents-repo/standards/permission-patterns.md:11` — *"OpenCode v1.1.1+
  uses `permission:` … Rules follow **last-matching-wins** evaluation order."*
- `.opencode/context/openagents-repo/standards/agent-frontmatter.md:45` — `"*": "ask"  # Catch-all (last-match-wins)`

No further verification against OpenCode's resolver is required. Two agents reached this
conclusion independently before the documentation was found.

⚠️ **v2 correction — the earlier "first-match-wins" was wrong and security-regressing.**
Real agents author **broad-first, specific-after**:
```yaml
coder-agent  bash: { "*": deny,  "…router.sh complete*": allow, … }
openagent    bash: { "*": ask,   "rm -rf /*": deny, "sudo *": deny, … }
```
Under first-match-wins, `"*"` matches everything first and every later rule is unreachable:
coder-agent's `router.sh` would be **denied** (breaking the exact behavior decision #5 exists
to protect) and openagent's `sudo *` would degrade **deny → ask** (a security regression).
**Last-match-wins** makes the authored content correct as written and maps 1:1 to OpenCode
key order. *Most-specific-wins* also produces correct results and agrees with last-match-wins
on all 34 agents, but requires defining a glob-specificity ranking.

Last-match-wins needs **zero reordering transform** and requires no migration of the 34
agents. First-match-wins would force order-reversal on both serialize *and* parse, plus an
order-reversing migration of every agent file.

⚠️ **Residual risk — order-as-semantics is an implicit contract.** YAML mappings are
*unordered per spec*, so OpenCode's key order is a convention its parser honors, not a
guarantee. Two concrete failure modes the IR MUST validate against:
- **integer-like scopes** (e.g. `"8080"`) silently jump to the front under ECMAScript
  integer-key ordering;
- **duplicate scopes** silently collapse.

Both are cheap to validate at parse time. See `02` Q2.

#### Default semantics — **restriction list, not allowlist**

⚠️ **v2 correction.** An absent capability does **not** mean `deny`. OpenCode's `permission`
block is a *restriction list*: `openagent` declares **no `write:` key at all** yet relies on
write being allowed (verified). Therefore:
- absent capability → `[]` → **tool default**
- no rule matched → **allow**

Defaulting `write`/`edit`/`bash` to `deny` (as v1 did) would silently break real agents.

### Neutral source — `/content/agents/code-reviewer.md`

```yaml
---
id: code-reviewer
name: Code Reviewer            # adapters slugify per tool
role: subagent                 # primary | subagent
category: development          # domain (distribution tier lives in registry `profiles`)
description: Review code for security, correctness, and quality before commit.
tags: [review, security, quality]
capabilities:                  # INTENT, not any tool's syntax
  read: allow                  # sugar
  grep: allow
  glob: allow
  edit: deny
  write: deny
  bash: deny
  delegate: { contextscout: allow }
inference:
  temperature: 0.1
  model: null                  # null ⇒ tool default (no hardcoded models)
context:
  - { path: core/standards/security.md, priority: high }
dependencies: [subagent:contextscout]
examples:
  - { context: "coder finished an auth service", user: "check it?", assistant: "Running code-review before commit." }
---
<system prompt / instructions — authored once>
```

### A scoping-heavy agent — `/content/agents/coder-agent.md` (why Option A exists)

```yaml
capabilities:
  bash:                                          # deny-all-then-allowlist: flat CANNOT express this
    - { scope: "*",                          decision: deny }
    - { scope: "bash …/router.sh complete*", decision: allow }
    - { scope: "bash …/router.sh status*",   decision: allow }
  edit:
    - { scope: "**/*.env*",     decision: deny }   # real security controls
    - { scope: "**/*.key",      decision: deny }
    - { scope: "**/*.secret",   decision: deny }
    - { scope: "node_modules/**", decision: deny }
    - { scope: ".git/**",       decision: deny }
  delegate: { contextscout: allow, externalscout: allow, TestEngineer: allow }
```

### `oac build --target opencode` → `.opencode/agent/subagents/code/reviewer.md`

```yaml
---
name: CodeReviewer                          # id → PascalCase
description: Review code for security, correctness, and quality before commit.
mode: subagent                              # role → mode
temperature: 0.1                            # supported → preserved
permission:                                 # capabilities → OpenCode granular block
  bash:  { "*":     "deny" }
  edit:  { "**/*":  "deny" }
  write: { "**/*":  "deny" }
  task:  { contextscout: "allow" }
---
```
Metadata → `agent-metadata.json` sidecar; no `model:` line (null → OpenCode default).
**OpenCode round-trips Option A exactly** — same expressive power, reserialized.

### `oac build --target claude` → `agents/code-reviewer.md`

```yaml
---
name: code-reviewer                         # id → kebab-case
description: |
  Review code for security, correctness, and quality before commit.
  Examples:
  <example>Context: coder finished an auth service. user: "check it?" …</example>
tools: Read, Glob, Grep                     # capabilities allow-set → tools allowlist
---
```
`context[]` → bundled into plugin `context/`, injected via SessionStart hook; contributes
to `.claude-plugin/plugin.json`.
⚠️ **2 warnings** *(corrected in v2.1 — was "1")*: (a) `temperature` dropped — CC has no
per-agent temperature; (b) `delegate: {contextscout: allow}` is map sugar for a **scoped**
rule, so dropping `Task` is a real loss and "never silent" demands a warning. The emitted
file is identical either way; only the count changes. This is an expected consequence of
Option A — under the old flat model, `delegate` carried no scope. **`coder-agent` = 4 warnings.**

✅ **CC `settings.json` — question CLOSED, negative (v2.1).** Plugins **cannot ship
permissions at all**: plugin `settings.json` supports only the `agent` and
`subagentStatusLine` keys, and our CC target *is* a plugin — anything the adapter wrote
would be ignored. Even via user settings it fails: rules are project-scoped (restoring
coder-agent's intent needs `deny: ["Bash(*)"]` project-wide, breaking every other agent),
and the agent's `tools:` allowlist gates the tool regardless.
**Resolution: emit documentation, not configuration** — a `RECOMMENDED-PERMISSIONS.md` with
an opt-in snippet, **deny rules only** (they over-apply in the *safe* direction; hoisting an
`allow` would re-create the escalation one layer up).

---

## Spec Documents

| File | Scope | Status |
|------|-------|--------|
| `01-feature-inventory.md` | Feature inventory; universal vs OpenCode-specific; ~150-item preservation checklist | ✅ v1 |
| `02-canonical-schema.md` | Neutral Zod IR for all 7 content types | ✅ v2 (Option A + MVI parser) |
| `03-adapter-specs.md` | Per-tool transforms, layouts, capability matrix, warnings | ✅ v2 (Option A) |
| `04-cli-build-distribution.md` | CLI commands, build pipeline, npm distribution, install.sh parity | ✅ v1 |
| `05-impact-migration-tests.md` | Impact, staged migration, minimal + deferred test spec | ✅ v1 |

### Conventions
- Ground every claim in real files (cite paths). Verify counts before asserting them.
- End each doc with `## Open Questions` for anything needing a human decision.
- Spec only — **no implementation code**.
