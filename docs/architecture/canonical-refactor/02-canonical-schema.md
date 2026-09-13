# 02 — Canonical IR Schema — **v3**

> **Current state (2026-09-02):** This schema analysis is historical. The active metadata workflow is canonical `content/agents/**` `oac:` blocks emitted by RegistryEmitter; sidecar metadata and sidecar merging are superseded.

> **Status:** Specification only — v3 (post `06-REVIEW.md` repairs). No implementation.
> Zod blocks are *illustrative*: they define the target shape of `packages/core/src/schema/*.ts`,
> not code to ship as-is.
> **Read `00-INDEX.md` (v2) first.** Where this doc conflicts with the index, **the index wins**
> — except for the three blocker decisions ratified in §0.4, which follow the `06-REVIEW`
> dispositions (precedence: 06-REVIEW dispositions > 08 > 07 > 00-INDEX, per `12-DISPATCH.md`).
>
> **Changes from v2 (v3, 2026-07-15 — repairs per 06-REVIEW F2/C1/C8/L2/L4/L5/L6/L7/G2 and
> ratification of the three blockers; every count re-verified against disk on this date):**
> - **§0.4 NEW — the three blocking decisions are RATIFIED:** (a) user projects keep an
>   **editable `content/`** (04 Q9 = YES); (b) **`model` is NOT authorable** — deleted from the
>   authored schema and replaced by `inference.tier: fast | balanced | deep` (default `balanced`),
>   preserving the 5-sonnet/2-haiku scout cost tiering; (c) the **implicit-default permission
>   rule** is adopted into §1.2.5 (no `*` rule → opposite of the decisions present;
>   mixed-decisions-without-`*` = parse error).
> - **§1.5 Dependencies rewritten (fixes 06-REVIEW F2).** One nine-kind vocabulary shared with
>   `ComponentTypeSchema` (adds `agent`, `plugin`, `config`, `hook`); targets accept `/`-joined
>   path segments and a trailing `/*` wildcard. **All 94 unique dependency refs in
>   `registry.json` — including the 19 the v2 grammar rejected — now validate** (verified).
> - **§1.2.5 implicit-default rule added (fixes C8)**, with a full-corpus measurement: of the
>   33 no-`*` capability blocks across all 34 agents, 22 are homogeneous-deny (→ implicit
>   `allow`, covers `coder-agent`'s five-denies `edit` block), 3 homogeneous-allow (→ implicit
>   `deny`), and **8 are mixed → parse error, requiring a one-line migration** (enumerated).
> - **§1.3 `inference.model` deleted; `inference.tier` added** (fixes L4, closes v2 Q3).
> - **§4.4 `ContextSchema` fixed (fixes G2):** `name`/`description` optional/derived — under v2
>   every real context file failed validation; `function` split from the compound category.
> - **`targets: []` applicability added to every content type** (fixes L2).
> - **§7 Registry restored (fixes L5/L6/L7):** top-level `profiles` object (`badge`,
>   `additionalPaths`, `components[]`), `categories` (objects with `icon`/`order`/`status`),
>   and `aliases[]` on registry entries and `AgentSchema`.
> - **§1.2.4 precedence rewritten** to match the current index (last-match-wins, primary
>   verification still required before Stage 1) — v2 argued against index prose that no longer
>   exists (fixes C1); v2 Q1 closed.
> - **Census re-verified 2026-07-15 — the tree has moved since v2 and 06-REVIEW:** context is
>   now **296 `.md` path entries = 293 regular files + 3 symlinks** (v2 said 297 = 294 + 3);
>   priority distribution over the leading window is now **113/112/34/29/1**; registry now holds
>   **248 entries** (contexts 194). All counts below are as-of-date measurements, with methods.

## 0. What this document is

The canonical **Intermediate Representation (IR)** is the tool-neutral in-memory shape that
`oac build --target <tool>` consumes. Authors write neutral content in `/content/`; the parser
produces IR objects validated by these schemas; adapters (Agent C) transform IR → per-tool
output. This doc defines the IR for **all seven content types** — Agent, Skill, Command, Context,
Tool, Hook, Registry entry.

For every field: name, type, required/optional, default, and whether it is a **neutral invariant**
(all adapters honor it) or a **hint** (adapters may drop it, but must report the drop via
`CapabilityMatrix` — never silently, per the index's "known and reported" rule).

`packages/compatibility-layer/src/types.ts` is the starting point but is still OpenCode-shaped in
several places. Each section ends with a **"Too OpenCode-shaped — must change"** callout citing
concrete lines.

### 0.1 Corrected census (re-verified from disk **2026-07-15** for v3)

| Item | Count | Method |
|---|---|---|
| Agents | **34** `.md` | `find .opencode/agent -name '*.md'` |
| Commands | **20** `.md` | `find .opencode/command -name '*.md'` |
| Context | **296** `.md` path entries = **293** regular files + **3 symlinks** | `find .opencode/context -name '*.md'` (296) vs `… -type f` (293) |
| Skills (OpenCode) | **6** dirs across **two** trees: `.opencode/skill/` (2) + `.opencode/skills/` (4), `task-management` duplicated | `ls -d` both trees |
| Skills (CC plugin) | **12** dirs | `ls -d plugins/claude-code/skills/*/` |

⚠️ **The tree has moved since v2 and since `06-REVIEW`.** v2 counted 297 `.md` path entries
(294 files + 3 symlinks per 06-REVIEW F9/U1); the 2026-07-15 recount gives **296 = 293 + 3**
— one context file has since been removed. The three symlinks
(`core/standards/code.md → code-quality.md`, `docs.md → documentation.md`,
`tests.md → test-coverage.md`) are the index's v2.2 symlink finding and are counted as path
entries, not files. **Do not quote any census number without recounting with the
leading-window rule** (`12-DISPATCH.md` repeats this warning). The marker-position buckets are
re-derived in §4.1 as of the same date.

### 0.2 Design rules for neutrality

1. **Intent over syntax.** The IR encodes what the author wants, never a tool's serialization.
2. **Closed vocabularies for invariants, open strings for hints.** Anything an adapter must reason
   about is a Zod `enum`; free-form author intent stays `string`.
3. **Concrete model names are not authored.** `inference.tier` carries optional semantic intent;
   absent/default tier means the target's configured default. Per locked decision #2.
4. **Metadata is folded into frontmatter.** No sidecar in `/content/`. The OpenCode *adapter* may
   re-emit `agent-metadata.json`; the IR has no sidecar concept.
5. **The authored on-disk format and the IR shape do not have to match** (locked decision #6).
   This is load-bearing for Context (§4): MVI HTML-comment on disk → structured fields in memory.

### 0.3 Shared primitives

```ts
import { z } from "zod";

/** Stable machine identity. Slug form; adapters re-case per tool (kebab for Claude,
 *  PascalCase for OpenCode). NEUTRAL INVARIANT — the join key across registry + deps. */
export const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  "id must be kebab-case: lowercase alphanumeric words joined by single hyphens");

/** Backward-compatible imported name. Aliases are lookup keys, not canonical ids, so legacy
 * PascalCase and underscore names are allowed. New authored ids still use IdSchema. */
export const AliasSchema = z.string().min(1).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/,
  "alias must be a non-empty legacy identifier without path separators");

/** Human display name. HINT for casing — adapters slugify/re-case freely. */
export const NameSchema = z.string().min(1);

/** One-line purpose. NEUTRAL INVARIANT — every tool surfaces a description. */
export const DescriptionSchema = z.string().min(1);

/** Free-form discovery labels. NEUTRAL but non-semantic — adapters may ignore. */
export const TagsSchema = z.array(z.string()).default([]);

/** Semver of the authored component. NEUTRAL for the registry/update engine; most tools
 *  drop it (HINT at the tool layer). NOTE: context files use X.Y on disk → normalized (§4). */
export const VersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/).default("1.0.0");

/** Known build targets. */
export const TargetSchema = z.enum(["opencode", "claude", "cursor", "windsurf"]);

/** Applicability (NEW in v3 — fixes 06-REVIEW L2). Empty array (the default) = universal:
 *  the component applies to every target. Non-empty = the component is emitted ONLY for the
 *  listed targets; `oac build --target X` SKIPS a component whose non-empty `targets` lacks X
 *  — silently, BY DESIGN: being skipped is authored intent, not degradation, so it produces
 *  no warning (avoids the per-agent-per-target warning noise 06-REVIEW L2 predicts).
 *  This is what makes the union skill set (6 OpenCode + 12 CC, disjoint) representable:
 *  Bun-shelling OpenCode skills declare ["opencode"], CC-frontmatter skills ["claude"],
 *  OpenCode custom tools ["opencode"], session-start.sh's hook ["claude"], etc.
 *  NEUTRAL INVARIANT — every adapter must honor it. Appears on EVERY content type. */
export const TargetsSchema = z.array(TargetSchema).default([]);
```

### 0.4 Ratified blockers (v3 — binding; per 06-REVIEW "Top 5" fix #4)

`06-REVIEW` triaged the 60 open questions across the spec set down to **three that block
code**. All three are hereby **ratified** for the schema; downstream docs (`03`, `04`, `05`)
must align to these answers.

1. **Do user projects hold an editable `content/`? — YES** *(closes `04` Q9 / 06-REVIEW C5).*
   The user's project keeps an editable `content/` directory as the input to `oac build` run
   on the user's machine. Consequence for this doc: the CLI ships the full IR — parser, these
   schemas, and the adapters — not just pre-built outputs. The OAC repo's own `/content/` and
   a user project's `content/` are the **same artifact class** validated by the **same
   schemas**; `04` owns the lifecycle (init/add/update) distinctions.

2. **Is `model` authorable? — NO.** *(closes v2 Q3 / 01 Q3 / 06-REVIEW C3+L4).* `model` is
   **deleted from the authored schema and from the IR**. In its place, `inference.tier:
   fast | balanced | deep` (default `balanced`) expresses the *intent* the hardcoded models
   carried — verified: the shipped CC plugin is 5× `model: sonnet` + 2× `model: haiku`, and
   the two haiku agents are the scouts (`context-scout`, `external-scout`), a deliberate
   cost/latency tier that `model: null` alone would silently destroy. Adapters map tier → that
   tool's fast/balanced/deep model; tools without tiers drop it **with a warning**. Concrete
   model ids live only in a build-time user/project override layer (`04`), never in content.
   This makes `05`'s Layer-1 test ("`model:` set → rejected") correct as written.

3. **Implicit default when rules exist but no `*` rule matches — adopted.** *(closes
   06-REVIEW C8 / `03` Q2; the live security gap, index finding #10, depends on it.)* Full
   normative statement in **§1.2.5**: the implicit terminal default is the **opposite of the
   decisions present**; a mixed-decision list without an explicit `*` rule is a **parse
   error**. Verified against all 34 agents — corpus impact enumerated in §1.2.5.

---

## 1. Agent

Anchor of the refactor; must serialize to the three worked-example outputs in `00-INDEX.md` v2.
Real sources modelled against: `.opencode/agent/subagents/code/reviewer.md`,
`.opencode/agent/subagents/code/coder-agent.md`, `.opencode/agent/core/openagent.md`.

### 1.1 Role — `mode` → `role`

```ts
/** Whether the agent is user-facing or only reachable via delegation.
 *  NEUTRAL INVARIANT. Rationale: "who can invoke this" is universal (Claude: agent vs
 *  sub-agent; OpenCode: mode primary|subagent). We drop OpenCode's third value "all" —
 *  a tool quirk, not an authoring intent; no other tool models it. */
export const RoleSchema = z.enum(["primary", "subagent"]);
```

`types.ts:88` `AgentModeSchema` leaks `"all"`. On import, legacy `all` normalizes to `primary`
(widest reach) with a migration note; the IR never stores it.

⚠️ Per index v2 finding #5, `agentModes: claude` is **partial**, not full: the CC *plugin* layout
has no per-agent `mode:` — every file under `agents/` is a subagent, so `role: primary` flattens
and **must warn**. Reflected in §8.

### 1.2 Capabilities — **Option A: ordered rule list + scalar sugar** (locked)

#### 1.2.1 Why the v1 flat model is withdrawn (verified)

I re-verified the two agents the index cites. Both refute a flat scalar model:

```yaml
# .opencode/agent/subagents/code/coder-agent.md — deny-all-then-allowlist
permission:
  bash:
    "*": "deny"
    "bash .opencode/skills/task-management/router.sh complete*": "allow"
    "bash .opencode/skills/task-management/router.sh status*": "allow"
  edit:
    "**/*.env*": "deny"      # real per-agent security controls
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
```

```yaml
# .opencode/agent/core/openagent.md — ask-by-default with specific denies
permission:
  bash:
    "*": "ask"
    "rm -rf *": "ask"
    "rm -rf /*": "deny"
    "sudo *": "deny"
    "> /dev/*": "deny"
```

No flat scalar expresses either: `bash: deny` breaks coder-agent's own `router.sh`; `bash: allow`
defeats the deny-all; and `coder-agent` (deny-by-default) vs `openagent` (ask-by-default) is a
deliberate distinction a flat model erases. **Option A is required.**

#### 1.2.2 The rule model

```ts
/** A single permission decision. NEUTRAL across allow/deny. "ask" is neutral in intent but
 *  UNSUPPORTED by claude/cursor/windsurf (CapabilityMatrix askPermissions = none) — a HINT
 *  there: adapters degrade per a documented strategy and MUST warn. */
export const DecisionSchema = z.enum(["allow", "deny", "ask"]);

/** One scoped rule. `scope` is a glob whose namespace depends on the capability (§1.2.3).
 *  NEUTRAL INVARIANT — {scope, decision} is the irreducible unit of authored intent. */
export const RuleSchema = z.object({
  scope: z.string().min(1),
  decision: DecisionSchema,
});

/** The full ordered form. Order is SEMANTIC and must be preserved end-to-end (§1.2.4). */
export const RuleListSchema = z.array(RuleSchema);
```

#### 1.2.3 Scope namespaces (per capability)

The closed capability vocabulary is unchanged from v1; what changes is that each maps to a
`RuleList` rather than a scalar. **`delegate` is not a special case** — it is simply the capability
whose scope namespace is *agent ids* instead of path/command globs. That unification is the main
elegance of Option A:

| Capability | Scope namespace | Example scope |
|---|---|---|
| `read` `write` `edit` `glob` `grep` | path glob | `**/*.env*`, `node_modules/**` |
| `bash` | command glob | `sudo *`, `bash …/router.sh status*` |
| `web` | URL/domain glob | `https://internal.*` |
| `delegate` | agent id (kebab) or `*` | `contextscout` |

#### 1.2.4 Precedence — **last-match-wins** (aligned to index v2.2; v2's conflict note retired)

*(v3 note — fixes 06-REVIEW C1: v2 of this section argued against index prose that no longer
exists. The current index adopts last-match-wins, with the honest v2.2 caveat that it is
"STRONGLY INDICATED — NOT independently confirmed" and that primary verification against a
real OpenCode install is REQUIRED before Stage 1. This doc adopts the same position; v2's
Open Question 1 is closed as already-answered.)*

**Semantics: evaluate rules in authored order; the last matching rule wins.** All real scoped
agents author **broad-first, specific-after** (`coder-agent`: `"*": deny` first, allowlist
after; `openagent`: `"*": ask` first, specific denies after). Under naive first-match-wins the
leading `"*"` would make every later rule unreachable — denying `coder-agent`'s `router.sh`
and downgrading `openagent`'s `sudo *` from deny to ask. Last-match-wins makes the corpus
correct as written, needs zero reordering on either serialize or parse, and maps 1:1 to
OpenCode's YAML key order. The schema shape is identical under any candidate semantics — only
the resolver differs — so the shape is locked here while the Stage-1 primary verification
(index v2.2) remains outstanding.

Parse-time validations the order-as-semantics contract requires (index v2.2 residual risk):
**integer-like scopes** (e.g. `"8080"`) are rejected in map sugar (ECMAScript integer-key
reordering would silently move them), and **duplicate scopes** in one map are a parse error
(YAML would silently collapse them).

```ts
/** Resolve a request against a rule list. Illustrative signature only.
 *  Terminal fallback when NO rule matches = the implicit default of §1.2.5. */
declare function resolve(rules: Rule[], request: string): "allow" | "deny" | "ask";
```

#### 1.2.5 Defaults — absent capability, no-rule-matched, and the implicit default (RATIFIED v3)

*(v3 — this section now owns the rule 06-REVIEW C8 found ownerless: "the highest-severity
finding in the whole set depends on a rule no document owns." It adopts `03` §0.4's proposal
per the 06-REVIEW disposition, ratified in §0.4 blocker 3.)*

Three distinct "nothing said" cases:

1. **Capability absent** from `capabilities` → empty list `[]` → *no author constraint* → the
   tool's own default applies. Rationale: `openagent` declares no `write` key and OpenCode
   therefore **allows** write. If the IR defaulted `write: deny` (as v1 did), the build would
   silently strip a capability the agent relies on.

2. **Rules present, one of them is a `*` (or otherwise-terminal catch-all) rule** → the rule
   list is total; no implicit default is ever consulted. This is the recommended authoring
   style and what migration normalizes toward.

3. **Rules present, NO `*` rule, and no rule matches the request** → the **implicit default**
   applies, computed from the authored rules:

   | Authored decisions in the list | Implicit default for non-matching requests |
   |---|---|
   | all `deny` | **`allow`** — the list is a *restriction list* over an otherwise-permitted tool |
   | all `allow` | **`deny`** — the list is an *allowlist*; anything unlisted is out |
   | mixed (`allow`+`deny`, or any list containing `ask`) | **parse error** — the author's terminal intent is ambiguous; an explicit `{scope: "*", decision: …}` rule is required |

   The rule in one line: **no `*` rule present → the opposite of the decisions present;
   mixed decisions without `*` = parse error.** (`ask` has no defensible "opposite", so any
   `ask` in a no-`*` list falls in the parse-error row; zero corpus impact — verified below.)

**Why this is load-bearing:** `coder-agent.edit` is five `deny` globs (`**/*.env*`, `**/*.key`,
`**/*.secret`, `node_modules/**`, `.git/**`) with **no `*` rule** — verified verbatim on disk.
Under row 1 it resolves to implicit `allow` for everything else, exactly matching OpenCode's
live behavior. Critically, the **collapse for lossy targets (§1.2.8) consumes the implicit
default too**: on Claude the block collapses to an `Edit` grant *with the five security globs
gone* — the live security gap (index finding #10). The implicit default is what makes that
loss *computable*, so the adapter can warn (or block, per `03` Q3) instead of guessing.

**Full-corpus verification (2026-07-15, all 34 agents, frontmatter `permission` blocks):**
24 agents carry permission blocks containing **82** capability rule-maps; **33** of those maps
have no `*` rule. They split:

- **22 homogeneous-deny** (secret-glob restriction lists like `coder-agent.edit`) → implicit
  `allow` = today's OpenCode behavior. ✅ no migration.
- **3 homogeneous-allow** — all `task` (delegate) allowlists: `coder-agent`
  (`contextscout, externalscout, TestEngineer`), `reviewer` (`contextscout`), `test-engineer`
  (`contextscout, externalscout`) → implicit `deny` = the obvious authored intent (delegate
  only to the named agents), and consistent with the many corpus `task` maps that spell
  `"*": deny` explicitly. ✅ no migration.
- ⚠️ **8 mixed → parse error under this rule.** Verified list (file → capability):
  `core/opencoder.md` → `bash` (ask+deny); `meta/repo-manager.md` → `bash` (ask+deny);
  `subagents/core/context-manager.md` → `edit` **and** `write` (allow+deny);
  `subagents/core/documentation.md` → `edit` (allow+deny);
  `subagents/core/externalscout.md` → `read` (allow+deny);
  `subagents/development/frontend-specialist.md` → `edit` (allow+deny);
  `subagents/planning/adr-manager.md` → `edit` (allow+deny).
  **Consequence:** the Stage-3 seed migration must add one explicit terminal rule
  (`{scope: "*", decision: …}`) to each of these 8 blocks, choosing the decision that
  preserves the tool behavior the agent was authored against (for these, OpenCode's
  tool default). This is a deliberate, *loud* disambiguation of 7 agent files — the parse
  error exists precisely because these blocks' terminal intent is ambiguous today, and
  silently guessing is how index finding #10 happened. 06-REVIEW measured only
  `coder-agent`/`openagent`; this 8-block impact is new data recorded here so the migration
  (doc `09`/Stage 3) can budget for it.

> **v1 correction (retained):** the v1 `CapabilitiesSchema` defaulted `write/edit/bash/web` to
> `deny`. That was wrong on this evidence and is withdrawn along with the flat model.
> **v2 correction:** v2's blanket "no rule matched → `allow`" is superseded by the implicit
> default above — it was right for restriction lists and wrong for allowlists (it made every
> no-`*` delegate map meaningless).

#### 1.2.6 Sugar ↔ full desugaring

Authors use sugar for the simple case; the parser desugars to the canonical list form. **The IR
stores only the desugared full form** — one shape for adapters to consume.

```ts
/** Scalar sugar:  read: allow            → [{ scope: "*", decision: "allow" }] */
const ScalarSugar = DecisionSchema;

/** Map sugar (delegate): { contextscout: allow, externalscout: allow }
 *                        → [{ scope: "contextscout",  decision: "allow" },
 *                           { scope: "externalscout", decision: "allow" }]
 *  Map iteration order = authored key order (preserved by YAML→JS object key order).
 *  Map sugar is accepted for ANY capability, not just delegate — it is just a rule list
 *  whose keys are scopes. This is precisely OpenCode's on-disk shape, which makes the
 *  OpenCode importer a pure desugar with zero information loss. */
const MapSugar = z.record(z.string(), DecisionSchema);

/** What an author may write for one capability. */
export const CapabilityInputSchema = z.union([ScalarSugar, MapSugar, RuleListSchema]);

/** Desugaring (illustrative):
 *    "deny"                          → [{ scope: "*", decision: "deny" }]
 *    { "a": "allow", "b": "deny" }   → [{ scope: "a", decision: "allow" },
 *                                       { scope: "b", decision: "deny" }]
 *    [ {scope,decision}, … ]         → as authored (identity)
 *  Desugaring is total and order-preserving. Re-sugaring on output is an adapter
 *  concern: a single {scope:"*"} rule MAY re-emit as a scalar. */
declare function desugar(input: z.infer<typeof CapabilityInputSchema>): Rule[];
```

#### 1.2.7 The capability set

```ts
/** Authored form — sugar allowed per capability. */
export const CapabilitiesInputSchema = z.object({
  read:     CapabilityInputSchema.optional(),
  write:    CapabilityInputSchema.optional(),
  edit:     CapabilityInputSchema.optional(),
  bash:     CapabilityInputSchema.optional(),
  grep:     CapabilityInputSchema.optional(),
  glob:     CapabilityInputSchema.optional(),
  web:      CapabilityInputSchema.optional(),
  delegate: CapabilityInputSchema.optional(),
}).default({});

/** Canonical IR form — always desugared rule lists. Absent capability ⇒ [] ⇒ tool default.
 *  Verb rationale (unchanged from v1): each is an intent verb every target can express or
 *  be told to refuse. `delegate` replaces OpenCode's `task`; `patch` (an OpenCode alias of
 *  edit) and `question` are dropped as tool quirks. */
export const CapabilitiesSchema = z.object({
  read:     RuleListSchema.default([]),
  write:    RuleListSchema.default([]),
  edit:     RuleListSchema.default([]),
  bash:     RuleListSchema.default([]),
  grep:     RuleListSchema.default([]),
  glob:     RuleListSchema.default([]),
  web:      RuleListSchema.default([]),
  delegate: RuleListSchema.default([]),
}).default({});
```

Round-trip of the index's worked examples: `code-reviewer`'s all-sugar block desugars to eight
single-rule lists and re-emits as OpenCode's `{ "*": "deny" }` form; `coder-agent`'s bash list
survives intact in both directions. **OpenCode round-trips Option A exactly** (index v2).

#### 1.2.8 Collapsing for lossy targets

Claude/Cursor/Windsurf have no scoped permissions (`granularPermissions` + `pathPatterns` =
`none` everywhere but OAC). They need a **collapse** from `RuleList` → a single grant:

```ts
/** Collapse a rule list to a coarse grant for targets without scoping.
 *  Reuses the existing permissive strategy in PermissionMapper.resolvePermissionRule's
 *  record branch (hasAllow || !hasDeny) so behavior stays continuous with today's adapters.
 *  MUST warn whenever rules.length > 1 or any rule.scope !== "*" — per index v2:
 *  "Scoped rules degrade to a coarse allowlist and MUST warn."
 *  Reuse the existing warning templates at BaseAdapter.ts:187-208 verbatim. */
declare function collapse(
  rules: Rule[],
  strategy: "permissive" | "restrictive" | "ask-as-deny",
): { grant: "allow" | "deny" | "ask"; warnings: string[] };
```

Worked: `coder-agent.bash` collapses to `allow` under `permissive` (it has allows) — meaning
Claude gets `Bash` with **none of the deny-all scoping**. That is a genuine, material capability
loss and exactly why it must warn loudly rather than degrade quietly.

### 1.3 Inference block (tier, temperature, maxSteps — **`model` deleted, RATIFIED v3**)

```ts
/** Model tuning knobs, grouped so adapters process them as a unit and the degradation
 *  report is legible ("inference.temperature dropped; inference.tier → tool default"). */
export const InferenceSchema = z.object({
  /** Semantic cost/latency tier — NOT a model name (ratified §0.4 blocker 2; locked decision
   *  #2 means NO model is ever authorable in content). Adapters map tier → that tool's
   *  fast/balanced/deep model (e.g. CC: fast → haiku, balanced → sonnet); tools without
   *  tiers drop it WITH a warning. NEUTRAL intent; HINT where unmappable.
   *  Verified rationale: the shipped CC plugin is 5× sonnet + 2× haiku, and the haiku pair
   *  is exactly the scouts — a deliberate cost tier that `model: null` alone would destroy.
   *  Migration: model: haiku → tier: fast; model: sonnet → tier: balanced (or omitted). */
  tier: z.enum(["fast", "balanced", "deep"]).default("balanced"),
  /** 0.0–2.0. NEUTRAL intent; HINT at Claude (temperatureControl = none → dropped + warned),
   *  partial at cursor/windsurf. */
  temperature: z.number().min(0).max(2).optional(),
  /** HINT — only OAC/OpenCode honor it (maxSteps: claude/cursor/windsurf = none). */
  maxSteps: z.number().int().positive().optional(),
}).default({});
```

**There is no `model` field** — not in the authored form and not in the IR. A frontmatter
`model:` key is a **parse error** with a fix-it message pointing at `tier` and at the
build-time override layer (`04` owns it: user/project config may pin concrete models at build
time; content never does). This makes `05`'s Layer-1 test case 2 ("`model:` set → rejected")
correct as written and removes `03`'s "`inference.model` set → emit `model:`" rows (06-REVIEW C3).

`types.ts` puts these knobs as flat siblings (181–184) and — **confirmed defect, index v2** —
`ModelIdentifierSchema = z.union([z.string(), z.string()])` (line 116, re-verified 2026-07-15)
is a **no-op union** with no null default, so it cannot enforce decision #2. It is deleted,
not repaired.

### 1.4 Context references

```ts
/** Priority vocabulary. See §4.3 — real data contains a value outside this enum. */
export const PrioritySchema = z.enum(["critical", "high", "medium", "low"]);

/** Pointer to a Context document. NEUTRAL: the reference survives wherever externalContext
 *  is supported (Claude bundles + injects via SessionStart hook; OpenCode/Windsurf copy;
 *  Cursor inlines). priority/description are HINTS — dropped by claude/cursor/windsurf
 *  (contextPriority = none). */
export const ContextRefSchema = z.object({
  /** Registry id of a context OR a repo-relative path under /content/context. */
  path: z.string().min(1),
  priority: PrioritySchema.optional(),
  description: z.string().optional(),
});
```

Matches `types.ts:63-67` (already neutral). Only change: prefer `id` references over raw
`.opencode/...` paths, which bake in the source tool.

### 1.5 Dependencies (typed refs) — **rewritten v3 (fixes 06-REVIEW F2)**

The v2 grammar rejected **19 real refs in `registry.json`** — every `agent:`, `plugin:`, and
`config:` ref and every wildcard — and disagreed with §7's own `ComponentTypeSchema` about the
kind vocabulary. v3 fixes both defects: **one nine-kind vocabulary, defined once and shared**,
and a target grammar that admits path segments and wildcards.

```ts
/** THE component-kind vocabulary — single source, shared by dependencies (here) and by
 *  registry entries (§7 ComponentTypeSchema === this schema). Nine kinds. */
export const DependencyKindSchema = z.enum([
  "agent", "subagent", "command", "skill", "context", "tool", "hook", "plugin", "config",
]);

/** A dependency target: a kebab id, optionally namespaced by `/`-joined kebab segments,
 *  optionally ending in the wildcard segment `/*`.
 *    contextscout                      plain id
 *    core/context-system               path-style id (context namespace)
 *    core/*                            wildcard — expands at closure-resolution time
 *    core/context-system/*             nested wildcard */
export const DependencyTargetSchema = z.string().regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*(?:\/\*)?$/,
  "target must be kebab segments joined by '/', optionally ending in '/*'",
);

export const DependencyRefSchema = z.object({
  kind: DependencyKindSchema,
  target: DependencyTargetSchema,        // was `id` — widened; IdSchema still governs plain ids
});

/** Also accepts the compact "kind:target" string — the REAL on-disk format in both
 *  .opencode/config/agent-metadata.json and registry.json ("subagent:contextscout",
 *  "context:core/*", "config:agent-metadata"). */
export const DependencyInputSchema = z.union([
  DependencyRefSchema,
  z.string().regex(
    /^(agent|subagent|command|skill|context|tool|hook|plugin|config):[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*(?:\/\*)?$/,
  ),
]);
```

**Verified against the corpus (2026-07-15):** `registry.json` carries **94 unique refs**
across all `dependencies[]` arrays and all `profiles.*.components[]` lists. The grammar above
validates **94/94**, including the 19 the v2 regex rejected: 8 `agent:` refs (`openagent`,
`opencoder`, `system-builder`, `copywriter`, `technical-writer`, `data-analyst`, `eval-runner`,
`repo-manager`), 3 `config:` refs (`env-example`, `agent-metadata`, `readme`), `plugin:notify`,
and 7 wildcards (`context:core/*`, `context:core/context-system/*`, `context:context-system/*`,
`context:development/*`, `context:openagents-repo/*`, `context:project-intelligence/*`,
`context:ui/*`). *(06-REVIEW F2's inline listing shows 18 of the 19; the one it omitted is
`context:context-system/*`. Its count of 19 was correct.)*

**Semantics:**
- Rename `type` → `kind` (avoids collision with the codebase's several other `type` fields).
  Neutral because tools consume the resolved closure, not the notation.
- **Wildcard refs expand at closure-resolution time** to every registry entry of that kind
  whose id/path falls under the prefix — parity with `install.sh`'s
  `expand_context_wildcard()` (`01` §7.2, the preservation checklist's "crown-jewel"). Today
  every corpus wildcard is a `context:` ref; the grammar permits wildcards on any kind, and
  `doctor` warns on kinds where expansion has no defined base tree.
- **Resolution failure is a hard error** — an unresolvable ref or a wildcard expanding to
  zero components fails the build; never `|| echo ""` (index finding #2).
- Alias-aware: a plain-id target matches a registry entry when `entry.id === target` **or**
  `entry.aliases` contains it (§7; parity with `resolve_dependencies()`'s
  `.id == id or (.aliases // []) | index(id)`).

### 1.6 Examples (few-shot)

```ts
/** NEUTRAL as authored data; HINT at the tool layer. Claude BAKES these into the agent
 *  description as <example> blocks (index worked example → claude target); OpenCode has no
 *  field for them and drops them (an enhancement, not a capability loss → no warning).
 *  Index v2 finding #3: hand-authored <example> blocks exist in the CC plugin and NOWHERE
 *  in .opencode/ — so seeding /content/ must MERGE, or this data is destroyed. */
export const AgentExampleSchema = z.object({
  context: z.string(),
  user: z.string(),
  assistant: z.string(),
});
```

### 1.7 Category vs. profile (confirmed conflation)

Confirmed by index v2: `types.ts` `AgentCategorySchema` (line 93) means *domain*
(`core`/`development`) while `registry.json`'s `category` means *distribution tier*
(`essential`/`standard`). Two axes sharing one name → split:

```ts
/** Domain grouping. NEUTRAL but low-stakes (agentCategories: claude ≈ none per index v2
 *  finding #5 — survives only as plugin.json keywords). Open string, not enum: the
 *  types.ts list is arbitrary and real data already exceeds it ("subagents/core",
 *  "testing", "data"…). */
export const CategorySchema = z.string().optional();
```

*(v3 — the v2 `ProfileSchema` tier **enum** is withdrawn. Distribution profiles are now a
top-level registry **object** — `RegistrySchema.profiles`, §7 — owning `components[]`
membership lists, `badge`, and `additionalPaths`, matching `registry.json` on disk and what
`04` §2.2 reads. Membership lives in the profile, not as a tag on each entry; the registry is
the sole owner — closes v2 Q9.)*

### 1.8 Full Agent IR

```ts
export const AgentSchema = z.object({
  // ---- identity (folded-in metadata; NO sidecar) ----
  id: IdSchema,                              // filename == id (01 Q1, per 06-REVIEW triage)
  /** Alternate lookup names (NEW v3 — fixes 06-REVIEW L7/L8). Canonical ids stay kebab-case;
   *  aliases may retain legacy names such as TestEngineer during import. */
  aliases: z.array(AliasSchema).default([]),
  name: NameSchema,
  description: DescriptionSchema,
  role: RoleSchema,                          // was `mode`
  category: CategorySchema,                  // domain; tier lives in registry.profiles
  tags: TagsSchema,
  version: VersionSchema,
  author: z.string().default("oac"),
  dependencies: z.array(DependencyInputSchema).default([]),
  /** Applicability (NEW v3, §0.3). [] = all targets. */
  targets: TargetsSchema,

  // ---- behavior ----
  capabilities: CapabilitiesSchema,          // Option A; replaces tools + permission
  inference: InferenceSchema,                // tier-based; `model` is a parse error (§1.3)
  context: z.array(ContextRefSchema).default([]),
  examples: z.array(AgentExampleSchema).default([]),

  // ---- lifecycle flags (HINTS) ----
  disable: z.boolean().default(false),
  hidden:  z.boolean().default(false),

  // ---- authored prose ----
  /** System prompt / instructions. NEUTRAL INVARIANT. From the Markdown body,
   *  NOT frontmatter. */
  systemPrompt: z.string().min(1),
});
```

> **Too OpenCode-shaped — must change (Agent).**
> - **Three overlapping identity carriers** (index v2, confirmed): `AgentFrontmatterSchema`
>   (177–191) + `AgentMetadataSchema` (201–210) + `OpenAgentSchema.metadata` (225–234), plus a
>   sidecar → collapse to one flat `AgentSchema`.
> - `ToolAccessSchema` (11–21): booleans keyed by OpenCode tool names (`task`, `patch`,
>   `question`) → replaced by the Option A capability set (`delegate`, `web`).
> - `GranularPermissionSchema`/`PermissionRuleSchema` (33–49): the glob-record model is
>   OpenCode's *serialization*, but it is **not** discarded — under Option A it is exactly the
>   `MapSugar` input form (§1.2.6), making the OpenCode importer a lossless desugar. What must
>   change is that the IR stores the **ordered list**, not the record, because record key order
>   is a fragile carrier of semantic ordering.
> - `AgentModeSchema` "all" (88) → drop. `AgentTypeSchema` (107) duplicates `role` → delete.
> - `ModelIdentifierSchema` (116) no-op union, no null default → replaced by `InferenceSchema`.
> - `sections` grab-bag (237–242) → superseded by typed `dependencies` + structured `examples`.

---

## 2. Skill

Real source: `.opencode/skill/project-orchestration/SKILL.md` + `scripts/`/`workflows/` siblings;
registry `skills` entries carry a `files: [...]` array. A Skill is a **directory** rooted at
`SKILL.md` (lean YAML frontmatter: `name`, `description`, `version`, `type`, `category`, `tags`);
body = instructions; bundled files travel with it.

⚠️ Index v2.2 (corrected counts, re-verified from disk 2026-07-15): OpenCode has **6** skill
dirs across **two** trees (`.opencode/skill/` ×2 + `.opencode/skills/` ×4, with
`task-management` duplicated across both), the CC plugin has **12**, and the sets are
**disjoint**. Seeding `/content/` from `.opencode/` alone destroys the CC set — a merge
concern for Agent E (owner + conflict rules: doc `09`), but it means `SkillSchema` must model
both origins. The union set is representable because every skill carries `targets` (§0.3):
Bun-shelling OpenCode skills declare `["opencode"]`, CC-frontmatter skills `["claude"]`.

```ts
/** A file shipping alongside SKILL.md. NEUTRAL as a manifest entry; whether a target can
 *  EXECUTE it is a HINT (skillsSystem: cursor = none, windsurf = partial). */
export const SkillFileSchema = z.object({
  /** Path relative to the skill directory root, e.g. "scripts/stage-cli.ts". */
  path: z.string().min(1),
  role: z.enum(["script", "workflow", "reference", "test", "asset", "entry"]).default("reference"),
  description: z.string().optional(),
});

export const SkillSchema = z.object({
  id: IdSchema,
  aliases: z.array(AliasSchema).default([]), // NEW v3
  name: NameSchema,
  description: DescriptionSchema,
  category: CategorySchema,
  tags: TagsSchema,
  version: VersionSchema,
  author: z.string().default("oac"),
  dependencies: z.array(DependencyInputSchema).default([]),
  /** Applicability (NEW v3, §0.3). [] = all targets. The disjoint 6+12 skill union depends
   *  on this field. */
  targets: TargetsSchema,

  /** Directory basename rooting the skill (contains SKILL.md). NEUTRAL — every tool with
   *  skills is directory-based (.claude/skills/<dir>/SKILL.md, .opencode/skill/<dir>/SKILL.md). */
  directory: z.string().min(1),
  /** The OTHER bundled files (SKILL.md implicit). Mirrors the registry `files` array. */
  files: z.array(SkillFileSchema).default([]),

  /** SKILL.md body. NEUTRAL INVARIANT. */
  instructions: z.string().min(1),
});
```

> **Too OpenCode-shaped — must change (Skill).** `types.ts` has no first-class Skill — only
> `SkillReferenceSchema` (132–138), a *reference* permitting inline `config` that no target
> honors (`ContextMapper.mapSkillsToClaudeFormat` warns and drops it). Add `SkillSchema`;
> collapse `SkillReferenceSchema` into `DependencyRef{ kind:"skill" }`; drop inline config.

---

## 3. Command

Real source: `.opencode/command/add-context.md`, `context.md`. Verified frontmatter across the
**20** commands: `description` (18×), `tags` (3×), `dependencies` (3×), plus OpenCode extras
(`tools`, `temperature`, `mode`, `permissions` — ≤2× each). Body = prompt/template.

```ts
export const CommandSchema = z.object({
  id: IdSchema,
  aliases: z.array(AliasSchema).default([]), // NEW v3
  name: NameSchema.optional(),           // often absent; derive from id
  description: DescriptionSchema,        // NEUTRAL INVARIANT — the only universal field
  tags: TagsSchema,
  dependencies: z.array(DependencyInputSchema).default([]),
  /** Applicability (NEW v3, §0.3). [] = all targets — e.g. the 6 CC-only commands declare
   *  ["claude"]. */
  targets: TargetsSchema,

  /** OPTIONAL, HINT. OpenCode lets a slash-command pin an agent/inference/capabilities;
   *  Claude/Cursor slash-commands are plain prompt templates. Reuses Agent primitives
   *  (incl. Option A) rather than inventing parallel shapes. */
  agent: IdSchema.optional(),
  inference: InferenceSchema.partial().optional(),
  capabilities: CapabilitiesInputSchema.optional(),

  version: VersionSchema,

  /** Prompt/template body (may contain $ARGUMENTS-style placeholders). NEUTRAL. */
  body: z.string().min(1),
});
```

Commands are the most portable type — neutral core is `{ id, description, tags, dependencies,
body }`. `types.ts` has no Command schema; this is net-new from already-neutral primitives.

---

## 4. Context document — **MVI HTML-comment (locked decision #6)**

Locked: context metadata **stays** the compact MVI HTML-comment line on disk. **No YAML
migration.** It is deliberate token-efficiency — the model reads it on every context load — and
multi-line YAML would cost tokens on all ~296 files. The IR normalizes it in memory; **on-disk
format ≠ IR shape**.

### 4.1 ⚠️ Verified format census — the highest-risk parser requirement

Re-derived from disk **2026-07-15** by **marker position under the leading-window rule**
(line 1, or the first non-blank line after a closing YAML `---`). The tree has moved since v2
(one file removed):

| Bucket | Count | Detail |
|---|---|---|
| Marker on **line 1** (happy path) | **286** | `<!-- Context: … -->` first line |
| **Dual-format** — YAML block + marker in the leading window | **3** | marker at line 11, after the closing `---` |
| Marker present but **only outside** the leading window | **4** | prose about the format — must NOT parse |
| **No marker at all** | **3** | `index.md`, `core/workflows/task-delegation.md`, `core/context-system/standards/typescript-coding.md` |
| **Total** | **296** | = 293 regular files + 3 symlinks |

The non-happy-path files, by kind (handled **oppositely**):

1. **Dual-format (3)** — YAML frontmatter on line 1 *and* an MVI marker at line 11:
   `core/standards/csharp.md`, `core/standards/csharp-project-structure.md`,
   `openagents-repo/quality/registry-dependencies.md`. These are the index's "3 YAML" files —
   but note they carry **both**, so a YAML-only parser still loses nothing here while an
   MVI-only parser would need to look past the YAML block. Their markers ARE metadata (they
   sit in the leading window) and parse normally.
2. **Marker-as-prose (4)** — the marker appears *deep in the body as documentation*, not as
   metadata: `openagents-repo/core-concepts/agents.md` (**line 232**),
   `openagents-repo/core-concepts/categories.md` (**line 301**),
   `core/context-system/standards/templates.md` (line 25, placeholder literals),
   `core/context-system/standards/frontmatter.md` (line 43, the standard doc showing examples).

> ### 🚨 Two parser traps, both verified
>
> **Trap 1 — `gray-matter` silently drops everything.** A generic frontmatter parser finds **no
> frontmatter** in 293 of 296 files (all but the 3 dual-format), yielding `{}` metadata with **no error**. Priority drives
> context ordering, so this silently degrades every agent's context loading. This is the
> single highest-risk parser requirement in the project.
>
> **Trap 2 — "grep the first marker anywhere" is also wrong.** It would assign
> `standards/code | critical` to `openagents-repo/core-concepts/agents.md` from a marker at
> **line 232** that is prose *about* the format. The parser MUST only honor a marker in a
> **leading window** (line 1, or the first line after a closing YAML `---`), and treat every
> later occurrence as body text. `templates.md` additionally contains **placeholder literals**
> (`{category}/concepts`, `Priority: {critical|high|medium|low}`, `Updated: YYYY-MM-DD`) that
> would fail validation — template/standard files must be excluded from metadata parsing.

### 4.2 Parser specification

```
parseContext(file):
  0. If line 1 is exactly "<!-- oac:no-parse -->" → NO metadata parsing at all; whole file
     is body (explicit opt-out for exemplar/template files).       [0 files today]
  1. If line 1 starts with "---" → parse the YAML block; remember where it closes.
     Set cursor = first non-blank line after the closing "---".  [3 files]
     Else cursor = line 1.                                        [293 files]
  2. If the line at `cursor` matches /^<!--\s*Context:\s*(.*?)\s*-->$/ →
     parse it as MVI metadata (§4.3). Consume it; it is NOT body.  [286 + 3 files]
     Else → NO metadata in the leading window.                     [7 files]
  3. NEVER scan beyond the leading window for a marker. Later markers are body. [Trap 2]
  4. Merge precedence when both YAML and MVI are present: MVI wins for the four MVI
     fields (it is the maintained convention); YAML supplies any extra keys.
  5. No metadata found → derive: id/name from path, priority = "medium" (schema default),
     and record a `doctor` finding. NEVER silently succeed with {} metadata.  [Trap 1]
```

*(v3 — step 6's hardcoded path allowlist is deleted; 06-REVIEW G2 showed it was both brittle
and redundant: all 4 marker-as-prose files — `templates.md:25`, `frontmatter.md:43`,
`agents.md:232`, `categories.md:301` — carry their markers OUTSIDE the leading window, so
steps 2–3 already treat them as body. The `<!-- oac:no-parse -->` first-line opt-out (step 0,
per the 06-REVIEW Q5 disposition) is the forward mechanism for any future exemplar whose
example marker would land in the leading window.)*

The MVI line grammar is pipe-delimited `Key: Value`, tolerant of missing trailing fields:

```
<!-- Context: {category}/{function} | Priority: {level} | Version: X.Y | Updated: YYYY-MM-DD -->
```

**Verified tolerance requirements** (real deviations, all 4 found):

| File | Marker | Missing |
|---|---|---|
| `core/workflows/component-planning.md` | `Context: … \| Priority: high \| Version: 1.0` | `Updated` |
| `openagents-repo/core-concepts/categories.md` | `Context: … \| Priority: high` | `Version`, `Updated` |
| `openagents-repo/core-concepts/agents.md` | `Context: … \| Priority: critical` | `Version`, `Updated` |
| `core/context-system/standards/templates.md` | placeholder literals | — (exclude) |

So: **`Context` and `Priority` are required; `Version` and `Updated` are optional.** A grammar
demanding all four fails on real content.

### 4.3 ⚠️ Priority vocabulary — real data escapes the documented enum

`.opencode/context/core/context-system/standards/frontmatter.md` documents
`critical|high|medium|low`. Verified distribution across the **leading-window** markers
(re-counted 2026-07-15, including the 3 dual-format files; 289 markers total):

| Value | Count |
|---|---|
| `high` | 113 |
| `critical` | 112 |
| `low` | 34 |
| `medium` | 29 |
| **`reference`** | **1** ← outside the enum |

*(The index's v2.2 numbers — 112/111 — counted line-1 markers only; the two dual-format
`critical` files and one dual-format `high` file sit at line 11. Any future recount must state
which window it used.)*

The outlier is `core/workflows/lightweight-context-handoff-example.md`
(`Priority: reference` — still on disk as of 2026-07-15). A strict `z.enum` **rejects a real
file**. **Decided (06-REVIEW disposition, v2 Q2 closed):** fix the one file → `low` at
migration and keep the enum closed. Until that commit lands, the parser coerces `reference` →
`low` with a `doctor` warning rather than failing the corpus.

`Version` on disk is **X.Y**, not semver (re-verified 2026-07-15: `1.0` ×269, `2.0` ×13,
`1.1` ×4, plus `1.3`, `2.1`, `3.1` — one each) → normalize `X.Y` → `X.Y.0` for `VersionSchema`.
**Re-emit rule (v3 — fixes 06-REVIEW L9):** adapters serializing the MVI marker MUST re-emit
the version in its **original on-disk form** (`2.0`, not `2.0.0`) — the IR keeps the raw
string alongside the normalized semver — so a no-op build does not churn ~289 markers and
`oac build && oac build` stays a no-op.

### 4.4 The Context IR

```ts
export const ContextSchema = z.object({
  id: IdSchema,
  aliases: z.array(AliasSchema).default([]), // NEW v3 — the 3 symlink/dup-id files land here
  /** OPTIONAL/DERIVED (v3 — fixes 06-REVIEW G2 gap 1: v2 required both, but the MVI marker
   *  carries NEITHER a name NOR a description, so every real context file failed
   *  validation). When absent, derived: name = title-cased path basename; description =
   *  first H1 or first non-empty body paragraph (truncated), else "{category} context:
   *  {name}". Derivation happens at parse time so the IR object is always complete;
   *  the FRONTMATTER fields stay optional. */
  name: NameSchema.optional(),
  description: DescriptionSchema.optional(),
  /** SPLIT in v3 (fixes G2 gap 2, per 01 §"dual taxonomy" + checklist 01:1209): the marker's
   *  compound "{category}/{function}" — e.g. "core/standards", "standards/code" — parses
   *  into category = first segment, function = the rest. category stays an open string;
   *  function carries the concepts/examples/guides/lookup/errors-style taxonomy instead of
   *  being flattened into one string as v2 did. */
  category: CategorySchema,
  function: z.string().optional(),
  tags: TagsSchema,
  /** From the MVI marker. NEUTRAL intent; HINT at every non-OAC target
   *  (contextPriority = none for claude/cursor/windsurf). Drives context ORDERING —
   *  losing it is the Trap 1 failure mode. */
  priority: PrioritySchema.default("medium"),
  /** X.Y on disk → normalized to semver in memory; raw form retained for re-emit (§4.3). */
  version: VersionSchema,
  versionRaw: z.string().optional(),         // NEW v3 — original "X.Y" for the re-emit rule
  /** ISO date from "Updated:". Optional — real files omit it. HINT at tool layer. */
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dependencies: z.array(DependencyInputSchema).default([]),
  /** Applicability (NEW v3, §0.3). [] = all targets. */
  targets: TargetsSchema,

  /** Markdown body, marker consumed. NEUTRAL INVARIANT. */
  body: z.string().min(1),
});
```

**Serialization back to disk** is the inverse: the OpenCode/Claude adapters re-emit the MVI
one-liner (not YAML), preserving the token-efficiency the format exists for.

**MVI lint rules** (validated by `doctor`, not by Zod — Agent E's test spec): ≤200 lines, marker
in the leading window, priority in-enum, a "📂 Codebase References" section, `updated` matching
any in-body date stamp.

> **Too OpenCode-shaped — must change (Context).** `types.ts` has only
> `ContextReferenceSchema` (a pointer) — **no Context *document* schema**. And
> `ContextMapper.ts` anchors `.opencode/context` as the privileged **source** base
> (`CONTEXT_CONFIGS.oac`, 55–61); post-refactor the source is `/content/context` and OpenCode is
> just a target, so the `oac` key must be renamed (`content`/`ir`) and re-rooted (index v2).

---

## 5. Tool

Real source: `.opencode/tool/gemini/index.ts` + `README.md`; registry `tools` entries carry
`tool:env`-style deps. A Tool is an **executable module**; the IR describes and locates it, it
does not model the runtime.

```ts
export const ToolParamSchema = z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "object", "array"]),
  description: z.string().optional(),
  required: z.boolean().default(false),
});

export const ToolSchema = z.object({
  id: IdSchema,
  aliases: z.array(AliasSchema).default([]), // NEW v3
  name: NameSchema,
  description: DescriptionSchema,        // NEUTRAL — the model needs to know what it does
  tags: TagsSchema,
  version: VersionSchema,
  dependencies: z.array(DependencyInputSchema).default([]),  // e.g. tool:env
  /** Applicability (NEW v3, §0.3). Custom tools implement the OpenCode tool API and have no
   *  CC primitive (01 Q18) — real tools declare ["opencode"]. */
  targets: TargetsSchema,

  /** Entry module relative to the tool dir, e.g. "index.ts". NEUTRAL as a locator; whether a
   *  target can LOAD a custom tool is a HINT (OpenCode plugins vs Claude MCP). */
  entry: z.string().min(1),
  runtime: z.enum(["node", "bun", "deno", "shell", "mcp"]).default("node"),

  /** HINT — only targets with typed tool schemas use these. */
  parameters: z.array(ToolParamSchema).default([]),

  /** Env var NAMES only, never values. NEUTRAL doc + doctor check.
   *  Build hygiene (index v2): a filesystem-globbing build must not sweep local .env files
   *  into /content/. (There is NO committed-.env security issue — 0 tracked, gitignored.) */
  env: z.array(z.string()).default([]),
});
```

> **Too OpenCode-shaped — must change (Tool).** `types.ts` `ToolConfigSchema` (253–257) is not a
> tool description — it is the adapter *output envelope*. Rename to `EmittedFileSchema` and move
> to the adapter contract (Agent C). `ToolSchema` is net-new. Note the naming trap: capability
> verbs (§1.2) are unrelated to first-class custom `Tool`s despite both being called "tools".

---

## 6. Hook

No per-agent hooks are authored in the corpus today, but `types.ts` has `HookDefinitionSchema`
(158–167) and `CapabilityMatrix` tracks `hooks` (full on oac/claude; none on cursor/windsurf).

⚠️ Index v2 finding #3: **`session-start.sh`** (skill catalogue, first-run onboarding,
context-discovery bootstrap, injection defense) has **no OpenCode equivalent** and lives in a
directory slated for deletion. It is arguably the most important runtime feature and **must be
preserved into `/content/`**. It is a `session-start` hook in this model — which makes the Hook
schema load-bearing, not theoretical.

```ts
/** Neutral lifecycle events — named by the MOMENT, not a tool's callback id. The current
 *  enum (types.ts:147) is Claude-shaped. Adapters map to tool names (Claude:
 *  PreToolUse/PostToolUse/SessionStart; OpenCode plugin events). NEUTRAL vocabulary; the
 *  whole feature is a HINT for cursor/windsurf (hooks = none → drop + blocking warning). */
export const HookEventSchema = z.enum([
  "before-tool",     // was PreToolUse
  "after-tool",      // was PostToolUse
  "permission-ask",  // was PermissionRequest
  "session-start",   // was AgentStart  ← session-start.sh lands here
  "session-end",     // was AgentEnd
]);

/** A shell action. NEUTRAL — a command string is universal. */
export const HookActionSchema = z.object({
  type: z.literal("command"),
  command: z.string().min(1),
});

export const HookSchema = z.object({
  event: HookEventSchema,
  /** Optional filters (tool names/globs). HINT — matcher semantics vary; empty = always. */
  matchers: z.array(z.string()).default([]),
  actions: z.array(HookActionSchema).min(1),   // was `commands`
  /** Applicability (NEW v3, §0.3). session-start.sh has no OpenCode equivalent — its hook
   *  declares ["claude"] rather than emitting a warning on every other target. */
  targets: TargetsSchema,
});
```

> **Too OpenCode-shaped — must change (Hook).** Rename events off Claude's
> `PreToolUse`/`AgentStart` vocabulary; rename `commands` → `actions` (it holds actions, and
> "commands" collides with the Command content type). Otherwise structurally adoptable.

---

## 7. Registry entry — **rewritten v3 (fixes 06-REVIEW L5/L6/L7/G3)**

Real source: `registry.json` — re-verified from disk **2026-07-15**: top-level keys
`{ version: "2.0.0", schema_version: "2.0.0", repository, metadata, categories, components,
profiles, subagents }`; `components: { agents 8, subagents 19, commands 17, tools 2, plugins 1,
skills 4, contexts 194, config 3 }` = **248 entries** (the tree has moved since 06-REVIEW's
245/191); each entry `{ id, name, type, path, description, tags, dependencies, category,
files?, aliases? }` (3 context entries carry `aliases` today); `profiles` holds **5 named
objects** — `essential` (25 components), `developer` (41, `badge: "RECOMMENDED"`), `business`
(25), `full` (50), `advanced` (68, `additionalPaths: [".Building/", ".github/workflows/"]`).
This is the neutral catalog the CLI and build closure walk.

v2 deleted three things the corpus and `04` both depend on; v3 restores them:
**`profiles` as a top-level object** (v2 kept only a per-entry tier enum, leaving nowhere for
`additionalPaths`, `badge`, or a profile description — L5), **`categories`** (the OpenCode
adapter is specified to emit `0-category.json`, whose `icon`/`order`/`status` source data the
v2 IR could not hold — L6), and **`aliases[]`** (three live registry entries use it and
`resolve_dependencies()` matches on it — L7).

```ts
/** ONE kind vocabulary (fixes F2's five-vs-nine self-contradiction): the registry's component
 *  types ARE the dependency kinds. */
export const ComponentTypeSchema = DependencyKindSchema;   // §1.5 — nine kinds

/** Section-key mapping (fixes G3 — "three docs assume someone else did"): the `components`
 *  record is keyed by the PLURAL of the kind — agents, subagents, commands, skills, contexts,
 *  tools, hooks, plugins — with ONE special case: `config` stays singular (matches disk;
 *  parity with install.sh get_registry_key()). kind → section key is a total function:
 *  k === "config" ? "config" : k + "s". */

export const RegistryEntrySchema = z.object({
  id: IdSchema,
  /** Alternate ids resolvable in dependency refs (RESTORED v3 — 3 live entries use it;
   *  resolution rule in §1.5). Also the landing place for the 3 symlinked standards files
   *  if the symlink→alias collapse is chosen (index v2.2 symlink finding). */
  aliases: z.array(AliasSchema).default([]),
  name: NameSchema,
  type: ComponentTypeSchema,
  /** Source path under /content/ (NOT .opencode/). NEUTRAL INVARIANT — catalog→source join. */
  path: z.string().min(1),
  description: DescriptionSchema,
  tags: TagsSchema,
  category: CategorySchema,                                  // domain ONLY (see callout)
  /** Compact "kind:target" refs incl. wildcards (§1.5). Drives the build closure. An
   *  unresolvable ref MUST be a hard error — never `|| echo ""` (index v2 finding #2). */
  dependencies: z.array(DependencyInputSchema).default([]),
  files: z.array(z.string()).default([]),                    // multi-file components
  /** Applicability (NEW v3, §0.3). [] = all targets. */
  targets: TargetsSchema,

  // ---- new in the refactor ----
  /** Content hash at publish time — drift/update detection. */
  checksum: z.string().optional(),
  version: VersionSchema,
});
// NOTE: v2's per-entry `profiles: [tier]` tag is WITHDRAWN — membership lives in
// RegistrySchema.profiles.*.components[] (single owner; closes v2 Q9). The registry, not
// component frontmatter, owns distribution.

/** Distribution profile (RESTORED v3 as an object — matches registry.json on disk and the
 *  shape 04 §2.2 reads: profiles.*.components[] and additionalPaths). */
export const ProfileSchema = z.object({
  name: NameSchema,
  description: DescriptionSchema,
  /** e.g. "RECOMMENDED" on `developer` (verified). Free string; HINT (install-UX only). */
  badge: z.string().optional(),
  /** Compact refs incl. wildcards — e.g. "agent:openagent", "context:core/*",
   *  "config:agent-metadata" (all verified live in registry.json profiles). */
  components: z.array(DependencyInputSchema),
  /** Extra repo paths the profile installs. Verified: advanced = [".Building/",
   *  ".github/workflows/"]. install.sh only PRINTED these; the CLI must copy them (04 §2.2). */
  additionalPaths: z.array(z.string()).default([]),
});

/** Category descriptor (RESTORED v3, upgraded to objects per 01 §1.6 — the source data for
 *  the OpenCode adapter's 0-category.json emit and for the current registry `categories`
 *  tier descriptions). */
export const CategoryInfoSchema = z.object({
  name: NameSchema.optional(),           // absent → derive from key
  description: DescriptionSchema,
  icon: z.string().optional(),           // from 0-category.json (verified: "⚙️" etc.)
  order: z.number().int().optional(),
  status: z.string().optional(),
});

export const RegistrySchema = z.object({
  version: VersionSchema,
  schema_version: VersionSchema,
  repository: z.string().url().optional(),
  targets: z.array(TargetSchema).default(["opencode", "claude", "cursor", "windsurf"]),
  /** Keyed per the section-key mapping above (plural; `config` singular). */
  components: z.record(z.string(), z.array(RegistryEntrySchema)),
  /** RESTORED v3. Keyed by profile id (essential | developer | business | full | advanced
   *  today; open set). */
  profiles: z.record(IdSchema, ProfileSchema).default({}),
  /** RESTORED v3. Keyed by category id (open set — holds both today's tier descriptions and
   *  the promoted 0-category.json domain entries). */
  categories: z.record(z.string(), CategoryInfoSchema).default({}),
});
```

> **Too OpenCode-shaped — must change (Registry).**
> - Every `path` starts with `.opencode/...` → rewrite to `/content/...`. `.opencode/` is a build
>   target; it cannot also be the catalog's source of truth.
> - `category` overloaded as *tier* (`essential|standard|…` — the current on-disk `categories`
>   map documents exactly that tier vocabulary) vs agent metadata's *domain*
>   (`core|development|…`) → in v3 the entry `category` is **domain only**; tier membership is
>   expressed solely by `profiles.*.components[]`. Migration maps old tier categories into
>   profile membership.
> - The orphan top-level `subagents` key (1 object, verified) → dissolved into
>   `components.subagents` at migration.
> - Version triplet on disk: `version` 2.0.0, `schema_version` 2.0.0, `metadata.schemaVersion`
>   1.0.0 (re-verified) → one `schema_version` + one content `version` (01 Q21 default).
> - Add `checksum` — without it `oac update` cannot detect the drift the index calls out as the
>   core failure of the `cp`-based bridge.

---

## 8. Neutral-vs-hint summary (adapter contract)

Every droppable field must be reported via `CapabilityMatrix` — never silently.

| IR field | Status | Degrades on | Matrix feature |
|---|---|---|---|
| `role` | invariant | **claude = partial** ⚠️ (plugin layout has no per-agent mode; `primary` flattens → warn) | `agentModes` |
| `capabilities.<verb>` allow/deny | invariant | — | `fileOperations`, `bashExecution`, `searchOperations` |
| **rule `scope`** (any non-`*`) | **hint** | claude/cursor/windsurf — collapse to coarse grant, **MUST warn** | `granularPermissions`, `pathPatterns` |
| **rule ordering** | **hint** | all but OpenCode (collapse discards order) | `granularPermissions` |
| `decision: ask` | hint | claude/cursor/windsurf | `askPermissions` = none |
| `capabilities.delegate` | invariant\* | cursor (none) | `taskDelegation` |
| `inference.tier` (v3) | hint | any target without a fast/deep model mapping — drop + **warn** | `modelSelection` |
| `inference.temperature` | hint | claude (none); cursor/windsurf (partial) | `temperatureControl` |
| `targets` (v3) | **invariant** | — (skip-by-design produces no warning, §0.3) | — |
| `aliases` (v3) | invariant (registry/build-closure); dropped at every tool layer silently (resolution artifact, not content) | — | — |
| `inference.maxSteps` | hint | claude/cursor/windsurf | `maxSteps` |
| `context[].path` | invariant | cursor (inline-only) | `externalContext` |
| `context[].priority` | hint | claude/cursor/windsurf | `contextPriority` |
| `category` | hint | **claude ≈ none** ⚠️ (plugin.json keywords only) | `agentCategories` |
| `examples` | hint | OpenCode (no field; enhancement → no warning) | — |
| `dependencies` | invariant | cursor (none), windsurf (partial) | `dependencies` |
| `skill.files` executability | hint | cursor (none), windsurf (partial) | `skillsSystem` |
| `hooks` | hint (**blocking**) | cursor/windsurf (none) | `hooks` |

\* `delegate` is invariant wherever delegation exists; on Cursor it is a hard drop → **blocker**,
not a soft warning.

⚠️ Two rows marked above reflect index v2 finding #5: `CapabilityMatrix.ts` currently **lies** —
`agentModes: claude = full` should be **partial**, and `agentCategories: claude` should likely be
**none**. Both must be corrected before the matrix can be trusted as the degradation oracle.

---

## Resolved in v3 (was: Open Questions — dispositions per 06-REVIEW triage)

- ~~Q1 Precedence semantics~~ — **closed, already-answered** (06-REVIEW C1): the current index
  adopts **last-match-wins** (§1.2.4). The index's own v2.2 caveat stands: primary verification
  against a real OpenCode install is required before Stage 1 (an index/Stage-1 action item, not
  a schema question — the shape is identical either way).
- ~~Q2 `Priority: reference`~~ — **closed by default**: fix the one file → `low` at migration;
  enum stays closed; parser coerces with a `doctor` warning until then (§4.3).
- ~~Q3 `model` authorable?~~ — **RATIFIED: NO** (§0.4 blocker 2). `inference.tier` replaces it.
- ~~Q4 census 296 vs 297~~ — **closed by measurement**: as of 2026-07-15 the tree holds
  **296 `.md` path entries = 293 regular files + 3 symlinks** (§0.1; earlier 297 = 294 + 3 was
  true of an earlier tree — it has moved).
- ~~Q5 exemplar exclusion~~ — **closed by default**: the path allowlist is deleted; the
  leading-window rule already covers all 4 current prose-marker files, and
  `<!-- oac:no-parse -->` is the forward opt-out (§4.2).
- ~~Q6 `web` capability~~ — **closed by default**: keep it in the closed set.
- ~~Q8 emitted-file envelope~~ — **closed by default**: `ToolConfigSchema`/`ConversionResult`
  (types.ts 253–316) move wholesale into the adapter contract (`03`/Agent C), out of
  `packages/core`.
- ~~Q9 profiles source of truth~~ — **closed**: the registry's `profiles.*.components[]` is the
  sole owner (§7); no frontmatter self-declaration.
- ~~Q10 two roles~~ — **closed by default**: `primary | subagent` locks at two.

## Open Questions

1. **`id` vs `path` in `ContextRefSchema` and dependency joins.** *(was Q7 — still open.)*
   Require registry `id`s (fully neutral, but forces every one of ~296 contexts into the
   registry — 194 are registered today) or keep allowing relative paths (flexible, weaker
   neutral anchor)? Affects how strict the build closure can be — and interacts with index v2
   finding #2 (unresolvable refs must hard-error).

2. **Wildcard refs on non-`context` kinds (§1.5).** The grammar permits `agent:core/*` etc.;
   only `context:` wildcards exist in the corpus (7, all verified). Should `doctor` hard-limit
   wildcards to `context:` until another kind defines an expansion base tree, or is the
   general rule fine with a warning?

3. **Handoff — the 8 mixed-without-`*` permission blocks (§1.2.5).** Not a schema question
   (the rule is ratified), but the one-line-per-block disambiguation migration needs an owner
   in the Stage-3 seed/merge spec (doc `09`); recorded here so it is not lost.
