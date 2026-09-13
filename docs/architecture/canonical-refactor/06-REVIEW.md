# 06 — Adversarial Cold Review

> **Current state (2026-09-02):** This review records the prior architecture. The active metadata workflow is canonical `content/agents/**` `oac:` blocks emitted by RegistryEmitter; sidecar metadata and sidecar merging are superseded. `eval-runner.md` remains an intentionally registry-carried, non-canonical evaluation harness—not a sidecar replacement.

> **Reviewer:** independent; no involvement in the conversation that produced `00`–`05`.
> **Method:** every load-bearing claim re-derived from the working tree. Where I could not
> verify, I say "unverifiable" rather than guess.
> **Scope:** `00-INDEX.md` … `05-impact-migration-tests.md`, all read in full.

---

## Verdict

**Not implementable as written.** The architecture is sound and the analysis is unusually good
— `01` in particular is the most carefully verified document I have reviewed in this repo, and
Option A is the right call for the right reasons. But the spec set cannot be handed to an
implementer today, for three reasons that are structural rather than cosmetic. **First, the
centerpiece schema rejects the corpus it was written for:** `02`'s `DependencyKindSchema` omits
the `agent`, `plugin`, and `config` kinds that `registry.json` actually uses, and its
`DependencyInputSchema` regex rejects **19 real dependency refs** — including every wildcard
(`context:core/*`) that `01` calls a crown-jewel feature. `05`'s Layer-1 test ("every
`/content/*` file parses") would fail on day one. **Second, `01` and `05` were never revised
after the v2 decisions landed, and the index's table marks them "✅ v1" as though that were a
status rather than a defect.** `05` still says the repo has **160 agents** — four times, in its
ground-truth table, in its Stage 3 deliverable, and twice in its test spec — a number the index
itself explicitly flags as false. `01` still carries the committed-`.env` security alarm the
index retracted as a non-finding. **Third, the single hardest task in the migration — merging
`.opencode/` and `plugins/claude-code/` into `/content/` — is owned by nobody.** The index
declares it a merge; `05` Stage 3 specifies a "one-shot migration script (`content/*` from
current `.opencode/*`)", which is exactly the copy the index forbids. For `code-reviewer` the
two source bodies are **108 vs 269 lines with entirely different descriptions**, and no document
states which wins. Separately, the precedence decision the index calls "CONFIRMED — question
closed" rests on three in-repo documents this project wrote about itself, none of which is
OpenCode's resolver; that is an overclaim on the most load-bearing semantic in the design. Fix
the schema, revise `01`/`05`, and assign the merge an owner, and this becomes buildable — the
bones are good.

---

## Falsified or Unverifiable Claims

Ranked by severity. Every command below is reproducible from the repo root.

### F1 🔴 `05`'s "160 agents" — false, uncorrected, and load-bearing on a deliverable

`05:22` states the source of truth is `.opencode/` with **160** agent `.md` files, citing
`find .opencode -path '*agent*' -name '*.md'`.

```
$ find .opencode -path '*agent*' -name '*.md' | wc -l
160
$ find .opencode/agent -name '*.md' | wc -l
34
```

The command reproduces, but the **interpretation is wrong**: `-path '*agent*'` matches
`.opencode/context/open**agent**s-repo/**` (23 files in `guides/` alone), and
`.opencode/prompts/core/open**agent**/` (8 files). The real count is **34**, exactly as
`00-INDEX.md:73` says — and the index explicitly calls out *"one spec said 160 — false."*

This is not a stray typo. `160` propagates into work:
- `05:22` ground-truth table
- `05:220` Stage 3 goal — *"move all **160** agents + skills/commands/context into `/content`"*
- `05:222` — *"fixes the 7-vs-**160** drift"*
- `05:343` Layer 4 test case 1 — *"guards the 7-vs-**160** drift regression directly"*

A Stage-3 deliverable and a test assertion are both scoped to a number that is **4.7× reality**.
`05` is marked "✅ v1" in the index's spec table (`00:372`) and was never revised.

### F2 🔴 `02`'s dependency schema rejects 19 real refs — the schema does not fit the corpus

`02:369-383` defines:

```ts
export const DependencyKindSchema = z.enum(["subagent","context","command","skill","tool"]);
export const DependencyInputSchema = z.union([
  DependencyRefSchema,
  z.string().regex(/^(subagent|context|command|skill|tool):[a-z0-9-]+$/),
]);
```

and comments that this is *"the **REAL** on-disk format in both `.opencode/config/agent-metadata.json`
and `registry.json`."* It is not. Measured against `registry.json`:

```
refs REJECTED by 02 DependencyInputSchema regex: 19
context:core/context-system/*     context:core/*              context:ui/*
context:development/*             context:openagents-repo/*   context:project-intelligence/*
agent:openagent                   agent:opencoder             agent:system-builder
agent:copywriter                  agent:technical-writer      agent:data-analyst
agent:eval-runner                 agent:repo-manager          plugin:notify
config:env-example                config:agent-metadata       config:readme
```

Three independent defects:
1. **`agent:` is missing from the kind enum entirely.** The IR cannot express a dependency on a
   primary agent, though `registry.json` and all five profiles use it.
2. **`plugin:` and `config:` are missing**, though `plugin:notify`, `config:agent-metadata`, and
   `config:readme` are live registry refs (`01` §10 discusses `config:readme` at length).
3. **Wildcards are rejected by the regex.** `context:core/*` is the mechanism `01` §7.2 documents
   as `expand_context_wildcard` and the preservation checklist requires (`01:1244`: *"`context:`
   wildcard expansion preserved"*). `02`'s schema makes it unrepresentable.

`02` contradicts **itself** here: `02:799-801` `ComponentTypeSchema` has **nine** types
(`agent, subagent, command, skill, context, tool, hook, plugin, config`) while
`DependencyKindSchema` has **five**. The same document cannot agree on the type vocabulary.

Consequence: `05`'s Layer 1 ("Every `/content/*` file parses against the Zod IR", `05:317`) fails
at Stage 1 on real content.

### F3 🔴 The precedence decision is "confirmed" against sources that cannot confirm it

`00:219-229` declares last-match-wins **"✅ CONFIRMED (v2.1) — question closed"**, *"Verified
against three independent in-repo sources"*, concluding: *"**No further verification against
OpenCode's resolver is required.**"*

I verified all three citations. Two are accurate as quotes; one has a wrong line number; **and
the claim of independence does not hold.**

| Cited source | Verified? | What it actually is |
|---|---|---|
| `docs/archive/planning/12-MASTER-SYNTHESIS.md:432` | ✅ text at :432 | **This project's own planning doc**, describing a *different, rejected* format |
| `.opencode/context/openagents-repo/standards/permission-patterns.md:11` | ✅ verbatim | **This project's own context file** |
| `.opencode/context/openagents-repo/standards/agent-frontmatter.md:45` | ✅ verbatim | **This project's own context file** |

All three are documents **this repository wrote about itself**. None is OpenCode's resolver,
OpenCode's upstream documentation, or an executed test. Three in-repo files agreeing is one
belief written down three times — not three independent verifications.

Worse, the `12-MASTER-SYNTHESIS.md:432` source describes a **format that does not exist**:

```json
"permission": [
  { "deny": "bash(**)" },
  { "allow": "bash(git status)" }
]
```

That is a JSON array of `{decision: pattern}` objects — a *proposal* from a planning doc, not
OpenCode's real map form (`{"*": "deny", "git status*": "allow"}`). A doc asserting last-match-wins
about its own hypothetical schema is not evidence about OpenCode's behavior.

**I am not claiming last-match-wins is wrong.** The reasoning in `02` §1.2.4 and `03` §0.5 —
that first-match-wins provably breaks `coder-agent` and `openagent` as authored — is sound and
I verified both agent files reproduce exactly as quoted. Last-match-wins is almost certainly
right. **The defect is the epistemics:** the single most load-bearing semantic in the design is
marked "closed, no further verification required" on the strength of self-citation. The cost of
being wrong is every generated permission block on every target inverting. A ten-minute
experiment against a real OpenCode install would settle it. Do that before freezing.

Also: `03:129` cites this quote at **`:442`**; the index cites **`:432`**. `:432` is correct.

### F4 🟠 The index's priority distribution is wrong — and so is `02`'s

`00:66-67` asserts: *"Verified distribution: high 116, critical 113, low 34, medium 31,
reference 1."* Those sum to **295**, which matches no count in any document.

`02:640-648` asserts: high 113, critical 111, low 34, medium 29, reference 1 (**= 288**).

Measured over the leading-window markers:

```
$ for f in $(find .opencode/context -name '*.md'); do head -1 "$f" | grep -o 'Priority: *[a-z]*'; done \
    | sed 's/Priority: *//' | sort | uniq -c | sort -rn
 112 high
 111 critical
  34 low
  29 medium
   1 reference
```

**112 / 111 / 34 / 29 / 1 = 287** — which exactly matches the 287 line-1 markers `02` §4.1
independently derived. `02` is right on four of five values and wrong on `high`; the index is
wrong on three of five and its total is internally inconsistent. Since the index "wins on
conflict" (`00:9`), an implementer following the rules adopts the **more wrong** numbers.

The `Priority: reference` outlier is **real and verified** — that finding stands.

### F5 🟠 `01`'s navigation counts are inflated by a suffix-match bug

`01:518` — *"**79 `navigation.md` files** — one per directory, at every level"*, and `01:651-652`
tabulates 79 on disk / 36 in registry.

```
$ find .opencode/context -name 'navigation.md' | wc -l
76
$ find .opencode/context -name '*navigation.md' | wc -l
79
$ find .opencode/context -name '*navigation.md' ! -name 'navigation.md'
.opencode/context/development/fullstack-navigation.md
.opencode/context/development/ui-navigation.md
.opencode/context/development/backend-navigation.md
```

The methodology matched `*navigation.md` and swept in three files that are **not** navigation
hubs. Registry side is identically inflated: **33** exact-basename entries, 36 by suffix.

The derived claim *"43 of 79 navigation hubs are unregistered"* (`01:655`) survives only because
the errors cancel (76−33 = 79−36 = 43). The **conclusion is right; the evidence is wrong** — and
the "one per directory, at every level" characterization is built on the bad number. Note the
interaction: `ui-navigation` is *also* one of the three duplicate registry ids `01` §3.6 flags,
so the bug and the finding overlap.

### F6 🟠 `01` still asserts the committed-`.env` security alarm the index retracted

`00:80-82` — *"**Non-finding (corrected):** an earlier claim of 'committed `.env` files needing
rotation' is **false**. Verified: **0 tracked `.env` files**."* I confirm:

```
$ git ls-files | grep -E '\.env$|\.env\.'
(no output)
$ sed -n '9,13p' .gitignore
.env
.env.local
...
```

But `01` was never updated and still says:
- `01:823` — `` `.opencode/tool/.env` | 🔴 **SECURITY** | A committed `.env` inside the tool dir ``
- `01:842` — `` `.opencode/plugin/.env` | 🔴 **SECURITY** | Second committed `.env` ``
- `01:1429-1431` **Q17** — *"`.opencode/tool/.env` and `.opencode/plugin/.env` are **in the repo**. Are they real secrets (⇒ rotate + purge history)…? Needs a human to look."*

Both files exist **on disk** but are untracked and gitignored. Q17 asks a human to consider
history purging for a non-incident. The index wins, so **Q17 is dead** — but nothing in the doc
set says so, and a reader of `01` alone would open a security workstream.

### F7 🟡 Index skill counts are wrong, and the error propagated into `02` and `03`

`00:76-77` — *"Skills (OpenCode) | **2** dirs"* and *"Skills (Claude Code plugin) | **~11**"*.

```
$ ls -d .opencode/skills/*/     → 4  (context-manager, context7, smart-router-skill, task-management)
$ ls -d .opencode/skill/*/      → 2  (project-orchestration, task-management)
$ ls -d plugins/claude-code/skills/*/ | wc -l → 12
```

OpenCode has **4 + 2 = 6** skill directories across two sibling trees; CC has **12**, not ~11.
`01` §0 gets this exactly right. The index — which overrides `01` on conflict — gets it wrong,
and both downstream docs inherited it: `02:479` (*"OpenCode has **2** skill dirs, the CC plugin
has **~11**"*) and `03:48` (*"2 OpenCode skills, ~11 CC plugin skills"*). Three of five documents
now carry the wrong number because the authoritative one did.

### F8 🟡 "The shipped CC agents hardcode `model: sonnet`" — 2 of 7 are `haiku`

`00:158` and `01:255` both state the CC agents hardcode `model: sonnet`.

```
$ grep -H '^model:' plugins/claude-code/agents/*.md
code-reviewer.md:model: sonnet      coder-agent.md:model: sonnet
context-scout.md:model: haiku       external-scout.md:model: haiku
task-manager.md:model: sonnet       context-manager.md:model: sonnet
test-engineer.md:model: sonnet
```

Five `sonnet`, **two `haiku`**. This is not pedantry: the two `haiku` agents are the *scouts* —
cheap, high-frequency, read-only discovery agents. That is a deliberate **cost/latency tier**,
not an accidental hardcode. Locked decision #2 (`model: null`) deletes it and **no document
proposes a replacement**. `01`'s Q3 asks about "a per-adapter default", which cannot express
"this agent is cheap and that one isn't". Both docs characterize the finding as a uniform,
trivially-droppable constant, which understates what is being thrown away. See **L4**.

### F9 🟡 Context census: all three numbers are wrong about composition

- Index (`00:75`) + `03:47`: **296** `.md` (286 HTML-comment / 3 YAML / 7 neither)
- `02:40` + §4.1: **297** `.md` (287 line-1 / 7 elsewhere / 3 no-marker)
- `01:38`: **300** files (297 `.md` + `paths.json` + 2 JSON schemas)

Measured:

```
$ find .opencode/context -name '*.md' | wc -l           → 297
$ find .opencode/context -type f -name '*.md' | wc -l   → 294   ← note the delta
$ find .opencode/context -type f ! -name '*.md' | wc -l → 3
```

**297 `.md` path entries, but only 294 regular files.** The other three are **symlinks** (see
**U1**). `02`'s 297 and `01`'s 300 are right as path counts; the index's 296 is wrong and its
`286/3/7` bucket split is superseded by `02`'s verified `287/7/3`, which I reproduce exactly.
`02` §4.1's parser analysis — including the line-232 and line-301 prose-marker traps and the
dual-format files — is **correct and is the best analysis in the doc set**. `02`'s own Q4 flags
the delta as "no design impact"; that is right for the delta, wrong for the composition.

Also `01:1206`: *"All 300 context files migrated (297 `.md` + `paths.json` + 2 task schemas)"* —
arithmetically fine, but it means **294 real files + 3 symlinks + 3 JSON**.

### F10 🟡 `01`'s unregistered-context count is off by two

`01:649` claims **112** on-disk-but-unregistered. Measured: **110** (`.md` on disk, not matching
any registry `path`). `01`'s companion claims verify exactly: registry has **191** entries /
**188** unique paths ✅, and **0** registry entries point at a missing `.md` ✅ (the single
"missing" path is `paths.json`, which is the non-`.md` special case `01` correctly documents).

### Claims I verified as CORRECT (so they are not relitigated)

Both index-level and doc-level. This list matters as much as the falsifications:

| Claim | Status |
|---|---|
| 34 agents, 20 commands | ✅ exact |
| `coder-agent.md` / `reviewer.md` / `openagent.md` permission blocks quoted verbatim | ✅ byte-exact |
| `types.ts:116` `z.union([z.string(), z.string()])` no-op union | ✅ exact line |
| `BaseAdapter.ts:187-208` warning templates | ✅ exact strings |
| `WindsurfAdapter.ts:511-516` `hasAllow = permObj.allow !== undefined`, **fails closed** | ✅ — the v2 correction is right |
| `ClaudeAdapter.ts:95-124` writes `.claude/agents/*.md` + `.claude/config.json` (project, not plugin layout) | ✅ |
| `CapabilityMatrix.ts`: `agentModes: claude=full`, `agentCategories: claude=partial`, `pathPatterns: windsurf=partial`, `taskDelegation: claude=full` | ✅ all four; `03` §5's corrections are justified |
| `bin/oac.js` `execFileSync('bun', …)` → *"Bun is required"* | ✅ verbatim |
| 15 files using Bun-only APIs | ✅ exactly 15 |
| Version drift: 0.7.1 / 0.7.1 / 1.0.0 / 0.1.0 / 0.1.1 / 1.0.0 / **1.0.2** | ✅ all seven |
| `install.sh` 1510 lines, 35 functions; `get_registry_key():331`, `get_install_path():353`, `expand_context_wildcard():361`, `expand_selected_components():373`, `resolve_dependencies():420` | ✅ every line number |
| `add.ts` never resolves dependencies (zero references) | ✅ |
| `/add-context`'s 3 path-style context deps all resolve to **nothing** | ✅ verified dead |
| Registry: 245 entries (8/19/17/2/1/4/191/3); dupe ids `agents`, `ui-navigation`, `context-bundle-template`; orphan top-level `subagents` key; `version` 2.0.0 vs `metadata.schemaVersion` 1.0.0 | ✅ all |
| Profiles 25/41/25/50/68; `developer` badge `RECOMMENDED`; `advanced.additionalPaths = [".Building/", ".github/workflows/"]` | ✅ all |
| `agent-metadata.json`: 28 entries, 8 agent / 20 subagent | ✅ |
| CC `coder-agent` ships `tools: Read, Write, Edit, Glob, Grep` — **no `disallowedTools`** ⇒ live Edit grant, security globs gone | ✅ **the LIVE SECURITY GAP (index #10) is real** |
| `bundled.ts` uses `registry.json`-absence as the package-root heuristic | ✅ (and see **G4**) |
| `sync-to-claude.sh` = 39 lines | ✅ |
| `apply.ts` cursor guard `warn: 80*1024, limit: 100*1024` | ✅ |
| `session-start.sh` + `escape_for_json()` + *"SECURITY: Prevents command injection"* | ✅ exists, `hooks/` only |
| `.opencode/config.json` = `{"agent": "eval-runner"}` | ✅ |
| All `router.sh` are `0755` | ✅ |

### Unverifiable

- **`03` §2.3/§2.5/§2.6 CC-documentation quotes** (*"plugin subagents don't support `hooks`…"*,
  *"only the `agent` and `subagentStatusLine` keys are supported"*, `tools:` is names-only). These
  cite `sub-agents.md` / `plugins.md` / `permissions.md` — external docs not in this repo. I cannot
  verify them here. `03` correctly self-labels confidence (high on the doc statement, medium on
  applicability) — **that is the right way to write an unverified claim** and the rest of the set
  should copy it. But note the **entire CC adapter design rests on them**, and `00:352-360`
  promotes them to a locked "✅ question CLOSED, negative" without preserving that hedge.
- **`03` §4 Windsurf format** — explicitly self-labelled *"Inferred, not verified against a live
  install."* Honest, and correspondingly Q9 is a genuine blocker for that target.
- **`00:161-163`** — `settings.json {"model": "opusplan"}` no-op. Correctly flagged *"Unverified …
  flagged, not asserted."*

---

## Cross-Document Contradictions

### C1 🔴 Three documents argue a question the index has already closed

`00:219` marks precedence **"✅ CONFIRMED (v2.1) — question closed."** Yet:

- `02:881` Open Question 1 — *"**⚠️ Needs ratification.** The index says 'first-match-wins'…"*
- `03:96` §0.5 — *"**⚠️ BLOCKING CONTRADICTION** — first-match-wins vs last-match-wins"*
- `03:836` Q1 — *"**BLOCKING** … must be resolved before `02` or `03` freeze"*

`02` and `03` are arguing against an **index version that no longer exists**. They quote the
index as saying "first-match-wins"; the current index says the opposite, at length, and credits
*"Two agents reached this conclusion independently"* — i.e. it absorbed `02`'s and `03`'s
arguments and then never told them. An implementer reading `03` sees a **blocking** contradiction
that is resolved two files away. **Same pattern, same cause** for `03` Q7 (*"warning count: 1 or 2?
Recommend accepting 2 and correcting the index"*) — `00:346-350` already says 2. And `00:352`
already closes the `settings.json` question `03` §2.6 re-derives.

Three of the ~60 open questions are **not open**. They are stale citations. Not harmless: `03`
Q1 is labelled BLOCKING and would stop an implementer cold.

### C2 🔴 `05` Stage 3 specifies exactly the copy the index forbids

`00:102-107` finding #3 — *"**Seeding `/content/` is a MERGE, not a copy.** Drift is bidirectional
… **Seeding from `.opencode/` alone destroys all of it.**"*

`05:221` Stage 3 deliverable — *"a one-shot migration script (`content/*` from current
`.opencode/*`)"*.

That is the copy. `05` names no merge, no CC-side harvest, no conflict rule — and its Stage 3
goal (`05:220`) is *"move all 160 agents"* (F1), i.e. it is not even scoped to the right tree.
Under `05` as written, the 12 CC skills, the 6 CC-only commands, every `<example>` block, and
`session-start.sh` are **destroyed at Stage 3** — precisely the outcome the index's #1 finding
exists to prevent. See **L1**.

### C3 🔴 `05`'s minimal test contradicts `02`'s schema and `03`'s transform

`05:328` Layer 1 case 2: *"`model:` set to a string (not `null`) → **rejected** (enforces locked
decision #2)."*

But `02:330-332`: `model: z.string().nullable().default(null)` — **accepts strings**, and the
comment says *"When set, a neutral family id (e.g. `"claude-sonnet-4"`); ModelMapper resolves to
the tool's dated id."* And `03:210-211` / `03:352-353` both specify `inference.model` set →
emit `model:`.

So `05` tests for a rejection that `02` does not implement and `03` explicitly relies on. This
is `02`'s Q3 (*"Should `model` be authorable at all?"*) — **unresolved**, and `05` has already
assumed one answer while `02`/`03` assume the other. `00:22-23` admits the question is open.
Three documents, three positions, one field.

### C4 🟠 `05`'s golden test asserts the wrong warning count

`05:300` — *"the **known `temperature`-dropped warning** is emitted"* (singular).

`03` §2.8 and `00:346` both say `code-reviewer` on CC emits **2** warnings (temperature +
scoped-delegate). If the minimal test — *"the only test that must exist before any deletion"*
(`05:287`) — asserts one warning, it either fails on correct output or is written loosely
enough to prove nothing.

### C5 🟠 `04` conflates two different `/content` directories, and admits it in Q9

`00:168` puts `/content` at the **OAC repo root** — the source the maintainers author, which
ships inside the npm package.

`04:361-363` puts `content/` in the **user's project** (`<project>/content/`, `~/.config/oac/content/`),
tracked in the user's manifest, updated by `oac update`.

These are different artifacts with different lifecycles, and `04` uses one name for both. `04`'s
own Q9 (`04:509`) says the quiet part out loud: *"does the user keep an editable `content/` in
their project … or is `/content` purely internal to the package? **This is the biggest UX fork**
and affects `init`, `add`, `update`, and migration."* It is not a UX fork — it is a
**prerequisite**. It decides whether `oac build` runs on the user's machine at all, and therefore
whether the CLI ships a parser, the adapters, and the whole IR, or just pre-built outputs. §1.1,
§1.2, §1.4, §2, §4.2 and §5.1 are all written as though it were settled in opposite directions.

### C6 🟠 `01` §1.3 recommends a schema `02` did not adopt — with different field names

`01:200-208` recommends the rule list as `{ pattern, effect }`:

```yaml
capabilities:
  bash:
    - { pattern: "*", effect: ask }
```

`00:209-211` and `02:155-158` adopt `{ scope, decision }`. Same concept, different keys. `01` is
the preservation checklist an implementer will grep against; it is now describing a schema that
does not exist. `01:1172` (`permission.<tool>.<glob>` tri-state → `capabilities` rule list) is
still right; §1.3's worked YAML is not.

### C7 🟡 The index and `01` disagree on skill counts; `02`/`03` follow the index

Covered in **F7**. `01` is right (4+2 / 12); the authoritative index is wrong (2 / ~11); `02:479`
and `03:48` inherited the index's error. Since the index wins on conflict, the rule as written
propagates the falsehood.

### C8 🟡 `03` §0.4 escalates to `02` a question `02` never answers

`03:88-94` — *"**Implicit default** — when *no* `*` rule exists. ⚠️ **The IR does not currently
define this** … Escalated as Open Question #Q2. **Every collapse rule below depends on it.**"*

`02` does not define it. `02` §1.2.5 defines only two cases — *capability absent* → `[]` → tool
default; *rules present, none match* → `allow`. Neither covers "rules present, all match a subset,
no `*` rule" — which is `coder-agent.edit` (five denies, no `*`), the exact case that produces the
**live security gap** (index #10). `03` proposes the inference rule (*"opposite of the decisions
present; mixed-without-`*` is an error"*); `02` never adopts it; the index never rules. So the
highest-severity finding in the whole set (`00:135-142`) depends on a rule **no document owns**.

### C9 🟡 `02` §8 marks `hooks` a "blocking" hint; `03` treats it as a warning

`02:868` — `hooks | hint (**blocking**) | cursor/windsurf (none)`, and `02:870` says `delegate`
on Cursor is *"a hard drop → **blocker**, not a soft warning."*
`03:680` and `03:764` emit both as ordinary `⚠️` warnings; `03:68` says *"Builds fail only on
`blockers`."* So `oac build --target cursor` either fails on every delegating agent (`02`) or
warns and proceeds (`03`). Nobody reconciled it, and it changes whether Cursor is a supported
target at all.

### C10 🟡 `03`'s citation drift

`03:129` cites `docs/archive/planning/12-MASTER-SYNTHESIS.md:442`; the index cites `:432`; `:432` is
correct (verified). Minor on its own, but it is the same quote used to close the most important
question in the set (F3), and two of the docs citing it disagree on where it is.

---

## Feature Loss Risks

Testing `01` §11's checklist against `02`'s schema and `03`'s transforms. Items with **no home**:

### L1 🔴 The merge itself has no owner, no rule, and no spec

`01`'s checklist demands harvesting from the CC side:
- `01:1179` — *"**CC `<example>` blocks harvested** from `plugins/claude-code/agents/`"*
- `01:1275` — *"🔴 **12 CC skills harvested**"*
- `01:1203` — *"**6 CC-only commands** … harvested"*
- `01:1307-1313` — all six `session-start.sh` capabilities

`02` models the *result* (`examples[]`, `SkillSchema`) but explicitly disclaims the *process*
(`02:396` — *"a merge concern for **Agent E**"*). `03` says `session-start.sh` *"must be preserved
into `/content/`"* (`03:460`) and moves on. **Agent E's document (`05`) specifies a copy from
`.opencode/`** (C2). The merge is passed to Agent E, and Agent E did not receive it.

This is not a paperwork gap. The concrete unanswered question:

```
$ wc -l .opencode/agent/subagents/code/reviewer.md plugins/claude-code/agents/code-reviewer.md
     108 .opencode/agent/subagents/code/reviewer.md
     269 plugins/claude-code/agents/code-reviewer.md

OpenCode description: "Code review, security, and quality assurance agent"
CC description:       "Review code for security vulnerabilities, correctness, and quality.
                       Use after implementation is complete and before committing."
```

**Two source files, 108 vs 269 lines, entirely different descriptions, both claiming to be
`code-reviewer`.** Which body becomes `/content/agents/code-reviewer.md`? No document says.
Seven agents are in this position.

Tellingly, `00`'s worked example (`00:275`) uses the **CC description** — while `01:80` presents
the **OpenCode description** as *"verified verbatim"* for the same agent. The index has silently
already made a merge decision for one field of one agent, and did not record it as a decision.

### L2 🔴 There is no way to say "this component does not apply to this target"

No schema in `02` — Agent, Skill, Command, Context, Tool, Hook, Registry entry — has a `targets:`
or applicability field. Everything is implicitly universal. But `01` documents whole classes that
are structurally single-target:

- **Tools** (`01` §5) implement the OpenCode tool API; CC has no equivalent primitive (`01` Q18).
- **The 12 CC skills** carry CC-only frontmatter (`context: fork`, `agent:` — `03:441-443`) and
  advertise as `oac:` commands. On an OpenCode build they are inert.
- **The 4+2 OpenCode skills** shell out to Bun `.ts` via `router.sh` (`01` §4.4). On a CC build
  they need a Bun runtime the CC user never installed.
- **`session-start.sh`** is a CC hook with no OpenCode equivalent (`00:104`).

`01`'s Q16 asks *which set seeds `/content/skills/`* and offers "the union of 16". If the answer
is the union, then `oac build --target opencode` emits 12 skills OpenCode cannot use and
`--target claude` emits 6 that CC cannot run — and `03`'s only lever is a per-agent, per-target
warning, which turns "never silent" into unreadable noise. The union is the right answer **and it
requires a schema field that does not exist.**

### L3 🔴 Path-bearing permission scopes are neither tokenized nor rewritten

`coder-agent`'s bash allowlist (verified verbatim):

```yaml
"bash .opencode/skills/task-management/router.sh complete*": "allow"
```

The scope string **hardcodes a build-output path into neutral content**. `01` §3.4 catches this
class of problem (~129 files) and Q12 recommends `{{CONTEXT_ROOT}}`-style tokens + a
`no raw .opencode/ in /content/` lint. But:

- `02`'s `RuleSchema.scope = z.string().min(1)` — no token concept, no validation.
- `03` §1.3 serializes scopes **verbatim** (`"<scope>": "<decision>"`); `03` §2.3 drops them.
- `04` §2.4 specifies path rewriting for `@.opencode/context/` refs on `--global`/`--dir`
  installs — **and only for context refs.**

So on a global install, `coder-agent`'s allowlist still points at `.opencode/skills/...`, which is
not where the skill landed. The two `router.sh` commands are denied. The agent cannot complete or
report task status — **the exact breakage Option A exists to prevent** (`00:38-39`), reintroduced
by the install-location feature. `01` catches the path problem in *bodies*; nobody catches it in
*scopes*.

Compounding: the CC skill set is **disjoint** — there is no `task-management` skill in
`plugins/claude-code/skills/`. So on the CC target the scope references a skill that does not
exist in the output at all. It is invisible today only because `03` fail-closes and drops `Bash`.

### L4 🟠 Per-agent model *tiering* is destroyed with no replacement

Per F8: `context-scout` and `external-scout` ship `model: haiku`; the other five ship `sonnet`.
That encodes "scouts are cheap and fast; coders are capable." Under `model: null` (`00:20-23`),
**every agent gets the same default** and the tiering is gone. The user pays sonnet rates for
every discovery call.

`01`'s Q3 offers (a) never emit `model:` or (b) *"a **per-adapter** default in adapter config"*.
Neither expresses per-*agent* intent. `02`'s Q3 pushes the other way — *drop `model` from the
authored schema entirely*. Nobody has noticed that the thing being deleted is a **two-tier cost
policy**, not a hardcoded constant.

A `tier: fast | balanced | capable` field would preserve the intent without naming a model — and
would honor decision #2's actual spirit (no *hardcoded* models) rather than its letter. Not
proposed anywhere.

### L5 🟠 `oac build` cannot express `install.sh`'s `additionalPaths`

`registry.json#profiles.advanced.additionalPaths = [".Building/", ".github/workflows/"]`
(verified). `01:1268` requires it *"preserved or replaced"*; `04` §2.2 goes further and promises
a **parity improvement** (*"`install.sh` only printed these … the CLI must actually copy them"*).

But `02`'s `RegistrySchema` (`02:826-834`) has **no `profiles` object at all** — only
`components`. Profiles exist in `02` solely as a `ProfileSchema` enum *tag on each entry*
(`02:820`). Under that model there is nowhere to put `additionalPaths`, nowhere for a profile
`name`/`description`, and nowhere for `badge: "RECOMMENDED"` (`01:1267`). Three checklist items
have no home, and `04` §2.2 reads `profiles.*.components[]` — a shape `02` deleted.

### L6 🟠 `0-category.json` `icon`/`order`/`status` have no schema

`01` §1.6 recommends promoting these into `registry.json#categories[]` *"upgraded to objects"*,
and `01:1192` puts it on the checklist. `03` §1.5 keeps *emitting* `0-category.json` on the
OpenCode target. But `02`'s `RegistrySchema` has **no `categories` key at all** — the field is
simply absent. So the OpenCode adapter is specified to emit a file whose source data the IR
cannot hold.

### L7 🟡 `aliases[]` is required by `01`, absent from `02`

`01:167` — *"The neutral schema needs an explicit `id` **plus** an `aliases[]` field"*;
`01:1218` and `01:1255` both require it; `01` §7.2 documents `resolve_dependencies` matching
`.id == id or (.aliases // []) | index(id)`; three registry entries use it today.

`02`'s `RegistryEntrySchema` (`02:803-824`) has **no `aliases`**. `02` §1.8 `AgentSchema` has no
`aliases`. The `tester`/`test-engineer`/`TestEngineer` problem `01` §1.2 calls *"highest-risk
aliasing"* therefore has no representation, and `01`'s Q1 recommendation ("filename == id, with
`aliases[]` retained for dependency back-compat") is unimplementable against `02`.

### L8 🟡 Mixed-case delegate scopes round-trip broken

`coder-agent` declares `task: { TestEngineer: "allow" }` (verified). `02` §1.2.3 says the delegate
scope namespace is *"agent id (**kebab**)"* — but `RuleSchema.scope` is `z.string().min(1)`, which
happily accepts `TestEngineer`, and `IdSchema`'s kebab regex is never applied to scopes. `03:208`
maps `[{scope:X, decision:D}] → task: { X: "D" }` verbatim.

So the pipeline **preserves the bug**: `TestEngineer` goes in, `TestEngineer` comes out, and the
registry id is `tester`. `01` §1.4 flags it (*"The neutral `delegate:` map must pick one
(canonical `id`)"*); no document specifies the canonicalization step or where it runs.

### L9 🟡 `Version: X.Y` normalization is lossy on round-trip

`02` §4.3 normalizes context `X.Y` → `X.Y.0` for `VersionSchema` (verified real distribution:
`1.0`×271, `2.0`×10, `1.1`×4, plus `3.1`, `2.1`, `1.3`). `02:684` says adapters re-emit the MVI
one-liner. But nothing specifies re-emitting `2.0.0` **back to `2.0`**. A build that round-trips
context files rewrites 297 markers from `Version: 2.0` to `Version: 2.0.0` — churning every
context file on first build and breaking `01`'s *"byte-for-byte"* contract (`03:281`) and `04`'s
determinism requirement (`04:245`, *"`oac build && oac build` is a no-op"*).

### L10 🟡 The `.oac.json` discovery protocol is on the checklist and in no schema

`01:1221` — *"**`.oac.json` discovery protocol preserved** (fast path → chain → validity check →
self-heal)"*, which `01` §3.3 argues is *"strictly better"* than `paths.json` and should become
**the neutral, cross-tool mechanism** (Q11). `02` has no schema for it. `03` mentions
`.context-manifest.json` (§2.4) but never `.oac.json`. `04` never mentions it. The
`navigation.md`-presence validity check (`01:1222`) likewise has no home.

---

## Implementability Gaps

Where an implementer hits a wall. Walked end-to-end as instructed.

### G1 🔴 Walkthrough: `coder-agent.md` → `/content` → `oac build`. It stops at step 2.

**Step 1 — Author `/content/agents/coder-agent.md`.** Fine; `00:299-312` shows the target.

**Step 2 — Parse. FAIL.** The agent's real metadata (`agent-metadata.json`) carries
`dependencies: ["subagent:task-manager", "context:standards-code", …]`. Its registry entry and
the profiles carry `agent:openagent`, `config:agent-metadata`, `context:core/*`. Per **F2**,
`02`'s `DependencyInputSchema` rejects the `agent:`, `config:`, `plugin:` kinds and every
wildcard. Nineteen refs. The implementer must invent the vocabulary; `02` §7 gives nine types and
§1.5 gives five, and they disagree.

**Step 3 — Desugar capabilities.** `edit` has five denies and **no `*` rule**. `02` §1.2.5 covers
"absent" and "no rule matched", not this. `03` §0.4 says the IR must define it and escalates to
`02`; `02` doesn't. The implementer must guess — and guessing wrong here **is** the live security
gap (`00:135`). **Wall.** (See C8.)

**Step 4 — Resolve `delegate: {TestEngineer: allow}`.** Canonicalize to `tester`? To
`test-engineer`? Leave it? `01` says canonicalize to `id`; `02`/`03` pass it through. **Wall.** (L8.)

**Step 5 — Build `--target opencode`.** Emit `permission.bash` with the `router.sh` scopes. Are
they rewritten for `--global`? `04` §2.4 says only context refs. **Wall.** (L3.)

**Step 6 — Build `--target claude`.** Fail-closed on `Bash` — well specified and correct. But
`03` §2.8 predicts **4 warnings** for this agent, one of which is *"the one to act on"* because
it is a silent security downgrade with no remedy (`03:601`). Whether that blocks the build is
`03`'s Q3, unanswered. **Wall.**

**Six steps, four walls, on the agent the index nominates as the hardest case.** That is the
correct agent to have chosen — but the choosing was not followed by resolving.

### G2 🔴 Walkthrough: a real context file. The parser spec is good; the writer spec is missing.

Take `.opencode/context/core/standards/code-quality.md`:

```
<!-- Context: standards/code | Priority: critical | Version: 2.0 | Updated: 2025-01-21 -->
```

**Parse:** `02` §4.2's spec handles this correctly, including the leading-window rule that avoids
the line-232/line-301 prose traps. **This is the best-specified part of the whole set.** Two gaps:

1. **`description` is required and unobtainable.** `02:665` — `description: DescriptionSchema`
   (`z.string().min(1)`, **not** optional). The MVI marker has **no description field** — it is
   `Context | Priority | Version | Updated`. `02` §4.2 step 5 derives *"id/name from path,
   priority = medium"* on failure, but never says where `description` comes from. **Every one of
   the 294 context files fails `ContextSchema` validation.** Same for `name`.
2. **`category` from the marker is `standards/code`** — a `{category}/{function}` compound.
   `02:666` stores it whole in `CategorySchema` (open string). But `01:491` requires the dual
   taxonomy be **split** into *"Neutral `category` + `function`"*, and `01:1209` puts it on the
   checklist. `02` has no `function` field. The `concepts/examples/guides/lookup/errors` taxonomy
   (`01:697`, on the checklist at `01:1226`) is silently flattened into a string.

**Serialize:** per L9, `Version: 2.0` comes back as `2.0.0`. The file churns.

**Exclusion list:** `02` §4.2 step 6 hardcodes a two-path allowlist and `02`'s own Q5 admits
*"A path allowlist is brittle as content grows."* It is also already incomplete — `02` §4.1
identifies **four** marker-as-prose files (`agents.md:232`, `categories.md:301`, `templates.md:25`,
`frontmatter.md:43`) and excludes **two**. The other two (`agents.md`, `categories.md`) are handled
by the leading-window rule, which is correct — but then the allowlist is doing something different
from what its own §4.1 analysis implies, and nothing says which mechanism owns which file.

### G3 🟠 `02`'s registry schema cannot drive `04`'s pipeline

`04` §2.2 reads `profiles.*.components[]` and `additionalPaths`. `02` §7 has no `profiles` object
(L5), no `categories` (L6), no `aliases` (L7). `04` §3 row 14 maps `get_profile_components` →
`lib/registry.ts getProfileComponents()` *"Reads `profiles.*.components[]`"* — against a schema
that deleted the key.

Meanwhile `02:833` — `components: z.record(z.string(), z.array(RegistryEntrySchema))` — is a
**bare record**, so the singular/plural key mapping (`get_registry_key`, `01:914`, checklist at
`01:1246`) is unconstrained. `04` §3 row 17 says *"`ComponentTypeSchema` + plural section keys;
fold aliases in"* — but `ComponentTypeSchema` is **singular** (`"agent"`) and the registry keys are
**plural** (`"agents"`), with `config` staying singular as a documented special case. Nobody
specifies the mapping; three docs assume someone else did.

### G4 🟠 `bundled.ts` breaks on two anchors, not one

`00:126` finding #7 — *"It identifies the package root by the *absence* of `registry.json` — but
`registry.json` will ship *inside* the package."* Verified. But the function has **three**
conditions:

```ts
const hasOpencode   = existsSync(join(current, ".opencode"));
const hasPackageJson = existsSync(join(current, "package.json"));
// + NOT registry.json
```

and `BUNDLED_SUBDIRS = [".opencode/agent", ".opencode/context", ".opencode/skills"]`.

Post-refactor, `04` §5.1 explicitly **stops shipping `.opencode/`**. So `hasOpencode` is false at
every level and the walk throws before the `registry.json` heuristic is ever consulted. The index
names one bug; there are two, and the `.opencode/` anchor fails **first**. `04` §5.1 does say to
*"replace the heuristic with an explicit `package.json` `name` check"*, which would incidentally
fix both — but only if the implementer knows to look. Note also `BUNDLED_SUBDIRS` omits
`.opencode/command` today, so commands are **not currently bundled at all** — an existing bug
neither `01` nor `04` records, and `04`'s retarget list (`04:458`) would silently inherit it.

### G5 🟠 `03` §1.3's "emit a key only when a rule is not a plain `*: allow`" is unspecified for the round-trip

`03:236-239` — *"`read`/`grep`/`glob` are granted by default in OpenCode; emit a key only when a
rule is not a plain `*: allow`."*

So `read: allow` → **no `read:` key emitted**. But `02` §1.2.5 says an **absent** capability
parses back to `[]` → *"tool default"*, not to `[{scope:"*", decision:"allow"}]`. Therefore
`IR → OpenCode → IR` maps `read: [{*, allow}]` to `read: []`. **Not idempotent.** This directly
violates `04:245` (*"`oac build && oac build` is a no-op"*), `05` Layer 2 case 2 (*".opencode
output → re-parse → re-build → equals first build"*), and `00:330` (*"**OpenCode round-trips
Option A exactly**"*). The claim of exact round-trip is false for exactly the three capabilities
`03` optimizes.

### G6 🟡 Determinism vs. the sha256 write gate

`04` §2.1 requires byte-identical output; `04` Stage 6 routes writes through `installer.ts`, which
**skips user-modified files** unless `--yolo`. So `oac build` on a repo with one hand-edited
generated file produces output that is *not* a function of `/content` — and `--check`
(`04:116`, *"exit 1 if drift"*) will report drift that `build` then refuses to fix. Neither `04`
nor `05` addresses the interaction, and `05`'s Stage 5 exit criterion (*"a fresh clone → `oac
build` → clean `git diff`"*) only holds on a fresh clone — i.e. it tests the one case where the
conflict cannot arise.

### G7 🟡 `05`'s Stage 2 gate has an escape hatch that voids it

`05:215` — *"generated `.opencode/` `code-reviewer` is byte-identical **(or diff-explained)** to
hand-maintained."*

"Or diff-explained" makes the gate unfalsifiable. `05:91` calls this *"the single most important
gate — it is the 'left' of both delete arrows."* A gate that passes on a prose explanation is not
a gate. Given that the two `code-reviewer` sources differ by 161 lines (L1), the diff will be
enormous and "explaining" it will be the entire merge decision, made under deadline pressure at
the moment the deletion is blocked on it.

---

## Open Question Triage

**Count check:** the brief says ~25+. Actual: **60** (01: 24, 02: 10, 03: 10, 04: 9, 05: 7). The
volume is itself a finding — 60 open questions is not a spec, it is a research note. Below I
triage all that matter; unlisted ones are defaults.

| Question | Verdict | Recommendation |
|---|---|---|
| **03 Q1** — first/last-match-wins (self-labelled BLOCKING) | **already-answered** | `00:219` closed it (last-match-wins). Delete from `03`. **But** F3: re-verify against a real OpenCode install before freeze — the "confirmed" rests on self-citation. |
| **02 Q1** — same, "needs ratification" | **already-answered** | Same. Delete. |
| **03 Q7** — code-reviewer 1 or 2 warnings | **already-answered** | `00:346` says 2. Delete; fix `05:300` (C4). |
| **01 Q17** — committed `.env`, rotate history? | **already-answered** | `00:80` retracted it as false (F6). **Close now.** Retain only the build-hygiene rule: never glob `.env` into `/content`. |
| **01 Q2** — flat vs rule-list capabilities | **already-answered** | Locked decision #5. Delete. |
| **03 Q2 / 02 (missing)** — implicit default with no `*` rule | 🔴 **BLOCKER** | Nobody owns it (C8) and the live security gap depends on it. Adopt `03`'s rule: *opposite of decisions present; mixed-without-`*` is an error*. **Put it in `02` §1.2.5.** Nothing builds until this exists. |
| **02 Q3 / 01 Q3 / 05 L1-case-2** — is `model` authorable? | 🔴 **BLOCKER** | Three docs, three answers (C3). Decide: `model` **not authorable**; add `tier: fast\|balanced\|capable` to preserve the haiku/sonnet intent (L4). Then `05`'s test is right and `03` drops its `model set →` rows. |
| **04 Q9** — is `content/` in the user's project? | 🔴 **BLOCKER** | Mislabelled "UX fork" (C5). It decides whether the CLI ships the IR + adapters at all. **Recommend: yes, editable `content/` in-project** — otherwise `oac build` has no input and the whole "author once, build many" premise dies at the user boundary. |
| **01 Q16** — which skill set seeds `/content/skills/` | 🔴 **BLOCKER** | Answer is the **union of 16** — and that answer requires a `targets: []` schema field that does not exist (L2). Add the field, then the question is trivial. |
| **01 Q12** — de-hardcoding `.opencode/` from ~129 bodies | 🔴 **BLOCKER** | Take `01`'s recommendation (tokens + lint), **and extend it to permission scopes** (L3), which `01` did not consider. Without it, generated CC agents point at nonexistent paths — `01` correctly suspects this is why the CC plugin was hand-written. |
| **01 Q10** — HTML comment or YAML | **already-answered** | Locked decision #6. Close. `02` §4 is the implementation and is good. |
| **01 Q1** — canonical id vs filename | 🔴 **BLOCKER** | `02` has no `aliases[]` (L7), so `01`'s own recommendation is unimplementable. Adopt *filename == id* + add `aliases[]` to `02` §1.8 and §7. Blocks every dependency edge. |
| **01 Q20** — fail-fast on unresolvable deps | **default** | Yes, hard error. `02:812` already says so. `01` correctly warns this *"will surface currently-hidden breakage"* — budget for it (the three `/add-context` deps are verified dead **today**). |
| **02 Q2** — `Priority: reference` | **default** | Fix the one file → `low`. Keep the enum closed. Do it now; it is a one-line commit. |
| **03 Q3** — dropped security globs: warn or block? | 🟠 **blocker-ish** | This is the live gap (index #10) shipping in production. Recommend: **blocker with explicit `--allow-unsafe-degradation` opt-in.** A warning in a build nobody reads is how the gap got there. |
| **03 Q9** — Windsurf real format | 🟠 **blocker for that target only** | The whole adapter is *"inferred, never checked against a live install."* Either verify or **cut Windsurf from v1**. Do not ship an adapter written from a stub. |
| **04 Q1** — Node-portable vs compiled binaries | **default** | Option A (Node shim). `04` already recommends it; `00:88` calls it *"mechanical"*. Close it. |
| **05 Q1** — test runner | **default** | vitest for new packages. Close. |
| **05 Q3** — commit generated output? | **default** | Commit through Stage 4, flip at Stage 5, exactly as `05` recommends. Close. |
| **01 Q15** — Bun runtime for skills | 🟠 **blocker for skills** | `router.sh` is bash + Bun `.ts`. `04` §4.3 sells *"No shell scripts"* as the Windows fix while every skill ships one (all four verified `0755`). The contradiction is unaddressed. |
| **01 Q22** — profile drift, 5 diffs | **blocker, human-only** | Correctly identified as un-automatable. Assign it. Note `02` deleted the profiles object it needs (L5). |
| **01 Q7** — the dark orchestration feature | **default** | Delete or register; do not carry ambiguity into `/content`. Recommend **delete** (unregistered, uninstallable, undocumented outside itself) — reversible via git. |
| **01 Q4** (0-category), **Q6** (author), **Q9** (version format), **Q14** (index vs navigation), **Q21** (registry versions), **Q24** (config: components) | **bikeshedding** | Close all six with defaults: promote `icon/order/status` + delete `common*`; `author: oac`; SemVer everywhere with `X.Y`→`X.Y.0` **and a re-emit rule** (L9); `navigation.md` canonical; one `schemaVersion` + one `contentVersion`; drop `config:readme`. None blocks code. |
| **02 Q6** (`web` capability), **Q10** (`primary\|subagent` enough), **03 Q10** (cursor cell semantics), **04 Q5** (Windows global path), **04 Q8** (backup retention) | **bikeshedding** | Defaults: keep `web`; two roles; `none`; `%APPDATA%`; `oac clean`. |
| **02 Q4** — 296 vs 297 | **already-answered by measurement** | Neither. **297 path entries = 294 files + 3 symlinks** (F9, U1). Fix all four docs. |
| **02 Q5** — exclusion allowlist brittleness | **default** | Use `<!-- oac:no-parse -->`. The allowlist is already incomplete (G2). |

---

## Unasked Questions

The dangerous gaps — risks **no document mentions at all**.

### U1 🔴 The context tree contains symlinks. No document knows.

```
$ find .opencode/context -name '*.md' ! -type f -exec ls -la {} \;
core/standards/tests.md -> test-coverage.md
core/standards/docs.md  -> documentation.md
core/standards/code.md  -> code-quality.md
```

Zero mentions of symlinks across all six documents. Consequences, none considered:

1. **Windows.** Git on Windows without Developer Mode or `core.symlinks=true` checks out a symlink
   as a **plain text file containing the target path**. `code.md` becomes a ~16-byte file whose
   entire content is the string `code-quality.md`. Any agent instructed to read
   `.opencode/context/core/standards/code.md` gets garbage. `04` §4.3 is a dedicated Windows
   section (issues #304/#312) covering path separators, line endings, and case sensitivity — and
   misses the one thing that silently corrupts content.
2. **npm pack/publish.** Symlink handling in tarballs is inconsistent across npm versions and
   extraction paths. `04` §5 specifies `files: ["content/", …]` with no symlink policy.
3. **Build determinism.** A copying build dereferences them → three duplicate files. `04` §2.1
   demands byte-identical output and `05` Stage 5 demands `git diff` clean after build. A
   dereferenced symlink is a **new file** in the diff, every time.
4. **They are the same three files as the alias bug.** `01` §3.6 flags `code-quality.md`,
   `test-coverage.md`, `documentation.md` as having *"two registry ids each"* and requires
   collapsing to `aliases[]` (`01:1218`). It concludes *"**Two mechanisms for one concept**"*.
   There are **three** — and the third is the filesystem. Collapsing to `aliases[]` deletes the
   symlinks, and **three files reference the alias paths directly**:
   `.opencode/agent/subagents/core/context-retriever.md`,
   `.opencode/context/openagents-repo/templates/context-bundle-template.md`, and
   `plugins/claude-code/skills/test-generation/SKILL.md`. Deleting the symlinks breaks all three.

### U2 🔴 There is no rollback story, and the delivery channel is auto-updating

`05` §1.3 is proud that *"Users migrate by **doing nothing**; the payload behind the same entry
point improves"* (`05:124`). That is also the risk, and it is never named. CC users on
`/plugin install oac` receive whatever `oac build --target claude` commits — automatically. If a
build regression ships (say, `03` §2.3's fail-closed rule firing on an agent that needed `Bash`),
every CC user's plugin breaks **with no action on their part and no way to pin the old version**.

No document specifies: a rollback procedure, a canary/staged rollout, a `--pin` for the
marketplace, or an abort criterion. `05` §2 defines exit criteria for entering each stage and
none for **reversing** one. Stage 3 deletes `sync-to-claude.sh` — the only thing producing CC
output today — behind a gate whose escape hatch is "or diff-explained" (G7).

### U3 🟠 Nobody asked whether `oac build --target opencode` can reproduce today's `.opencode/`

The entire plan assumes it can. But `.opencode/` currently contains, verified: `prompts/` (10
per-model variants + committed eval results), `node_modules/`, `bun.lock`, `.env` ×2 (untracked),
`tool/` TypeScript workspaces with their own `package.json`/`tsconfig.json`, `plugin/*.ts` +
`.ts.disabled` twin, `docs/`, `scripts/task-cli.ts`, `profiles/`, `opencode.json`, `config.json`.

`03` §1.1's OpenCode layout emits **seven** things: `agent/`, `config/agent-metadata.json`,
`skill/`, `command/`, `context/`, `opencode.json`, `config.json`. Everything else in the real
`.opencode/` is **not generated by anything**. So after Stage 5's *"stop committing generated
trees"*, either those files vanish or `.opencode/` is a hybrid of generated and hand-maintained
content — which is the exact dual-source mess (`05:253`) Stage 5 exists to end. `01` inventories
these assets; nobody checks them against `03`'s output surface.

### U4 🟠 Content is a supply chain, and `session-start.sh` proves the threat is understood

`session-start.sh` carries `escape_for_json()` with the comment *"SECURITY: Prevents command
injection attacks from malicious SKILL.md files"* (verified) — i.e. **the project already knows
that content can be hostile**, and `01:1313` correctly requires the defense be preserved.

But the refactor **inverts the trust model** and nobody notices. Today `install.sh` copies inert
files. After the refactor, `oac build` **parses untrusted content and generates executable
artifacts** — permission blocks, `hooks.json` shell commands (`03:464`), `router.sh` invocations
baked into allowlists. A malicious or compromised `/content/agents/*.md` can inject an
`{scope: "*", decision: "allow"}` bash rule, or a `HookActionSchema.command` (`02:768` —
`command: z.string().min(1)`, **no validation whatsoever**) that runs at every SessionStart.

There is no content signing, no `checksum` verification path (`02:822` *adds* a `checksum` field
but nothing verifies it), no provenance check, and no threat model. `01` §9.2 preserves one
escaping function; nobody asks what the build itself is now trusted to do.

### U5 🟡 No performance or scale budget

`oac build --target opencode` must parse 294 context files + 34 agents + 20 commands + 6 skill
trees, resolve a 245-node dependency graph, and write hundreds of files — on every `add`,
`remove`, and `update` (`04` §1.9 marks all three "runs build pipeline: yes"). No document states
a budget, and `04` §2 specifies no incremental build or caching. If `oac add context:foo` takes
20 seconds, the UX regresses hard against `install.sh`. Unmeasurable today (nothing is built), but
unbudgeted is how it becomes unfixable.

### U6 🟡 The 3 dual-format context files have a merge rule nobody validated

`02` §4.2 step 4 — *"Merge precedence when both YAML and MVI are present: **MVI wins** for the
four MVI fields; YAML supplies any extra keys."* Sensible. But nobody checked whether the three
files (`csharp.md`, `csharp-project-structure.md`, `registry-dependencies.md` — all verified to
start with `---`) actually **agree** across the two blocks. If a file's YAML says
`priority: high` and its MVI marker says `Priority: critical`, MVI-wins silently discards an
authored value. Three files, five minutes to check, never checked.

### U7 🟡 `--strict` is specified into a corner

`04:116` — `--strict` *"treat adapter warnings as errors → exit 1"*. But `03` §2.8 predicts **2
warnings for the simplest agent** and **4 for `coder-agent`**, and 33 of 34 agents carry
`temperature` (verified) which always warns on the CC target. So `--strict` **can never pass** on
the CC target for any real agent. `05` §3.3 wires golden tests into CI without specifying whether
they run strict. A flag that cannot be satisfied is a flag nobody will use — and it is the only
mechanism `04` offers for "never ship a degradation."

---

## Top 5 Things To Fix Before Writing Code

Ranked by what unblocks the most work and what costs most if skipped.

### 1. 🔴 Fix `02`'s schema so it accepts the corpus it describes. *(F2, C8, L5, L6, L7, G2, G3)*

`02` is the centerpiece and it does not fit the data. Minimum:
- **`DependencyKindSchema`**: add `agent`, `plugin`, `config`; reconcile with `ComponentTypeSchema`'s
  nine types (one vocabulary, one place). Allow **wildcards** and **path-style refs** in
  `DependencyInputSchema`, or `01`'s crown-jewel wildcard expansion is unrepresentable.
- **Define the implicit default** (no `*` rule) in §1.2.5. Adopt `03` §0.4's rule. **The live
  security gap depends on this and nobody owns it today.**
- **`ContextSchema.description`/`name`** → optional or derived. As written, **all 294 context
  files fail validation** — the MVI marker has no description field.
- **Add `function`** to split the `{category}/{function}` taxonomy `01` requires.
- **Restore `profiles` (object, with `additionalPaths`/`badge`/`description`), `categories`, and
  `aliases[]`** to the registry schema — `01` requires all three, `04` reads two of them, `02`
  deleted them.
- **Add `targets: []`** to every content schema (L2). Without it there is no union skill set, no
  home for tools, and no way to say "OpenCode-only."

Nothing downstream is real until this is done. `05`'s Layer-1 test is the forcing function: write
it first and let it fail.

### 2. 🔴 Revise `01` and `05` to v2, or stop citing them as authoritative. *(F1, F6, C2, C3, C4, C6)*

The index marks both "✅ v1" as a status. They are **stale**, and they are the two documents an
implementer touches most — `01` is the preservation checklist, `05` is the build order.
- `05`: purge **160** (four sites); rewrite Stage 3's "copy from `.opencode/`" into the merge the
  index mandates; fix the Layer-1 `model` test and the Layer-0 warning count; **delete "or
  diff-explained"** from the Stage-2 gate.
- `01`: retract the `.env` security alarm and **close Q17**; fix `79`→`76` / `36`→`33` navigation
  counts; align §1.3's `{pattern, effect}` to `{scope, decision}`; fix `112`→`110`.
- Index: fix the priority distribution (112/111/34/29/1), the skill counts (4+2 / 12), the context
  census (297 entries = 294 files + 3 symlinks), and "model: sonnet" → "5 sonnet, 2 haiku."
- **Add a revision-status column that distinguishes "reviewed against v2" from "never revisited."**
  "✅ v1" hid two stale documents in plain sight and is the root cause of half this section.

### 3. 🔴 Assign the merge an owner and write the conflict rules. *(L1, C2, G7, U3)*

The index's finding #3 is correct and orphaned. Someone must decide, per content type and per
conflict:
- For the **7 agents in both trees**: which body wins? `code-reviewer` is **108 vs 269 lines with
  different descriptions**. The index's own worked example already silently picked the CC
  description while `01` presents the OpenCode one as verbatim — **an undocumented decision
  already made**. Make it explicit or it will be made again, differently, under deadline.
- **Skills**: union of 16, requiring `targets: []` (fix #1).
- **`session-start.sh`**: which schema holds it? `02` §6's `HookSchema` is *"load-bearing, not
  theoretical"* by its own admission but has never been tested against the real file's six
  capabilities.
- **The six `<example>` blocks / 6 CC-only commands**: mechanical harvest, but nobody scheduled it.

This is the highest-risk task in the project and currently the least specified. It is also the
gate on deleting `sync-to-claude.sh`, so it will be done in a hurry unless it is done first.

### 4. 🔴 Answer the three real blockers; close the other 55 with defaults. *(triage table)*

Sixty open questions is not a spec. Exactly three block code:
1. **Is `content/` in the user's project?** (`04` Q9 — decides whether the CLI ships the IR at all)
2. **Is `model` authorable?** (`02` Q3 / `01` Q3 / `05` — three docs, three answers; and see the
   `tier:` proposal in L4, which nobody raised)
3. **Implicit default with no `*` rule** (`03` Q2 → `02` — folded into fix #1)

Four more are already answered and just not reconciled (`03` Q1, `03` Q7, `02` Q1, `01` Q17, `01`
Q2, `01` Q10) — **delete them**; `03` Q1 is labelled BLOCKING and will stop an implementer for
nothing. The rest get defaults today. Then **re-verify last-match-wins against a real OpenCode
install** (F3) — ten minutes to retire the largest piece of unearned confidence in the set.

### 5. 🟠 Confront the three things nobody asked. *(U1, U2, U4)*

- **Symlinks** (U1). Three of them, invisible to all six documents, and they break Windows
  checkouts, build determinism, and the `aliases[]` plan simultaneously — while being *the same
  three files* as `01` §3.6's duplicate-id bug. Decide now: keep as symlinks (and specify Windows
  + pack + build behavior), or convert to `aliases[]` (and fix the **three files** that reference
  the alias paths).
- **Rollback** (U2). The marketplace auto-updates. `05` sells that as the migration's elegance and
  never asks what happens when a bad build ships to every CC user at once. Define the abort
  criterion and the pin/rollback path **before** Stage 3 deletes the only working CC producer.
- **Build-time trust** (U4). `oac build` turns content into executable artifacts —
  `HookActionSchema.command` is an unvalidated `z.string()` that runs at every SessionStart. The
  project already ships `escape_for_json()` because it knows SKILL.md can be hostile. The refactor
  widens that surface enormously and has no threat model.

---

### Closing note

The parts of this spec set that are good are **very** good: `02` §4's MVI parser spec (the
line-232/line-301 trap analysis is exactly right and I reproduced its bucket counts exactly),
`03` §2.3's fail-closed asymmetry argument, `03` §2.6's verified-negative on `settings.json`, and
`01`'s registry/dependency forensics — where I checked ~20 claims and found two counting errors
and one stale retraction. The live security gap (index #10) is real, correctly diagnosed, and
shipping in production today; that finding alone justifies the exercise.

The failure mode here is not sloppiness. It is that **five authors revised at different times
against a moving index, and the index recorded its conclusions without telling the documents that
supplied them.** Fixes #1–#4 are all versions of the same repair: make the documents agree with
each other and with the disk. Do that and this is buildable.

---

## Stage 1 disposition table

> **Gate closure:** 2026-07-15, canonical-refactor subtask 10.
> **Rule:** `fixed` means the governing specification now contains the required decision or
> correction. `accepted` means the limitation is intentionally outside the first-class v1 scope
> and has an explicit guardrail. These dispositions override the original review text where they
> conflict, per `12-DISPATCH.md`.

| Finding | Disposition | Resolution evidence |
|---|---|---|
| **F1** | **fixed** | `05-impact-migration-tests.md` v2 replaces the false 160-agent scope with the disk-verified inventory and merge stages. |
| **F2** | **fixed** | `02-canonical-schema.md` v3 §0.2 unifies all dependency kinds and accepts path/wildcard refs; Stage 2's corpus gate covers the 19 former rejects. |
| **F3** | **fixed** | `10-PRECEDENCE-EXPERIMENT.md` confirms last-match-wins through live OpenCode 1.17.20 probes and resolver `.findLast()` evidence. |
| **F4** | **fixed** | `00-INDEX.md` v2.2 and `02-canonical-schema.md` §4 use the corrected leading-window priority distribution. |
| **F5** | **fixed** | `01-feature-inventory.md` v2 uses exact-basename navigation counts and preserves the separate suffix-named files. |
| **F6** | **fixed** | `01-feature-inventory.md` v2 retracts the committed-secret claim; `.env` remains an untracked build-hygiene exclusion only. |
| **F7** | **fixed** | `00-INDEX.md` v2.2, `01` §4.5, `02` §2, `03` §0.1, and `09` §4 align on 12 CC skills plus 4 canonical OpenCode skills. |
| **F8** | **fixed** | `00-INDEX.md` v2.2 and `02`'s `inference.tier` preserve the five-sonnet/two-haiku semantic cost tiers without authoring model ids. |
| **F9** | **fixed** | `01-feature-inventory.md` v2 and `09-MERGE-RULES.md` §§7,9 distinguish regular files, symlinks, and JSON; later work must recount after tree changes. |
| **F10** | **fixed** | `01-feature-inventory.md` v2 corrects the unregistered-context result and separates path aliases from canonical files. |
| **C1** | **fixed** | `03-adapter-specs.md` §0.5 and its question dispositions now cite `10-PRECEDENCE-EXPERIMENT.md`; stale precedence blockers are removed. |
| **C2** | **fixed** | `05-impact-migration-tests.md` v2 defines a two-tree merge; `09-MERGE-RULES.md` owns the per-content-type decisions. |
| **C3** | **fixed** | `02-canonical-schema.md` v3 makes raw model ids non-authorable and uses `inference.tier`; `05` tests the same contract. |
| **C4** | **fixed** | `05-impact-migration-tests.md` and `07-EXECUTION-PLAN.md` assert exact CC warning counts: two for `code-reviewer`, four for `coder-agent`. |
| **C5** | **fixed** | `08-STRUCTURE-AND-PACKAGING.md` §§2.1–2.2 distinguishes bundled canonical content from each user's editable project `content/`. |
| **C6** | **fixed** | `01-feature-inventory.md` v2 aligns capability examples to `{scope, decision}`, matching `02`. |
| **C7** | **fixed** | The corrected skill census is aligned across `00`, `01`, `02`, `03` §0.1, and `09` §4. |
| **C8** | **fixed** | `02-canonical-schema.md` §1.2.5 owns the implicit-default rule; `03` §0.4 consumes it without escalation. |
| **C9** | **accepted** | `07-EXECUTION-PLAN.md` limits first-class v1 targets to OpenCode and Claude; Cursor is experimental and Windsurf is cut, so unsupported hooks/delegation remain explicit blockers outside the v1 promise. |
| **C10** | **fixed** | `03-adapter-specs.md` corrects the archived citation to line 432; live behavior is now sourced from `10`, not that citation. |
| **L1** | **fixed** | `09-MERGE-RULES.md` is the signed-off owner and conflict contract for every content type. |
| **L2** | **fixed** | `02-canonical-schema.md` v3 adds `targets:[]`; `09` uses it for the 16-skill union and target-specific hooks. |
| **L3** | **fixed** | `09-MERGE-RULES.md` §§3,6 tokenizes path-bearing bodies and permission scopes; `07` Stage 4 adds a no-raw-`.opencode/` lint. |
| **L4** | **fixed** | `02-canonical-schema.md` v3 adds `inference.tier: fast|balanced|deep`, retaining per-agent intent without hardcoded models. |
| **L5** | **fixed** | `02-canonical-schema.md` v3 restores profile objects including `additionalPaths`, badges, descriptions, and components. |
| **L6** | **fixed** | `02-canonical-schema.md` v3 models registry categories and the promoted `icon`/`order`/`status` metadata. |
| **L7** | **fixed** | `02-canonical-schema.md` v3 models aliases; `09` §7 defines symlink and duplicate-id collapse into `aliases[]`. |
| **L8** | **fixed** | `09-MERGE-RULES.md` §§3,7 resolves delegate names through canonical ids or aliases, preserving mixed-case legacy scopes such as `TestEngineer`. |
| **L9** | **fixed** | `02-canonical-schema.md`'s MVI serializer specifies SemVer normalization with compact `X.Y` re-emission; `05` requires byte-stable round trips. |
| **L10** | **fixed** | `08-STRUCTURE-AND-PACKAGING.md` §2 defines `.oac.json` as project discovery for editable `content/`; `04` owns CLI discovery/self-healing behavior. |
| **G1** | **fixed** | `02` resolves dependency vocabulary/defaults, `09` resolves aliases/path scopes, and `07` Stage 3 makes security loss a blocker with explicit opt-in. |
| **G2** | **fixed** | `02-canonical-schema.md` v3 defines path-derived context identity, optional metadata, split taxonomy, leading-window MVI parsing, and stable re-emission. |
| **G3** | **fixed** | `02` restores profiles/categories/aliases and plural registry sections; `04` §2.3 defines dependency and section-key normalization. |
| **G4** | **fixed** | `08-STRUCTURE-AND-PACKAGING.md` §4 replaces both brittle anchors with an explicit package-name check plus `OAC_PACKAGE_ROOT`. |
| **G5** | **fixed** | `02` §1.2.5 distinguishes absent/default capabilities from explicit `*: allow`; `05` requires OpenCode parse→build idempotence. |
| **G6** | **fixed** | `04-cli-build-distribution.md` separates deterministic build/check output from update-time sha256 user-edit protection; `07` Stage 5 tests preservation and `--yolo`. |
| **G7** | **fixed** | `05-impact-migration-tests.md` v2 removes the `diff-explained` escape hatch; `07` Stage 3 requires reviewed, byte-stable goldens and explicit merge decisions. |

All **37** F/C/L/G findings are dispositioned above: **36 fixed, 1 accepted**. U2 is closed by
`11-ROLLBACK.md`; U1 and U3 are closed by `09-MERGE-RULES.md`; remaining U-items are carried as
explicit implementation/test constraints in `02`, `05`, and `07` rather than open Stage 1 gates.
