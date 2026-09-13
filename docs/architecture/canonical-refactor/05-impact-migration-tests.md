# 05 — Impact Analysis, Migration Staging & Test Spec

> **Current state (2026-09-02):** This migration plan is historical. The active metadata workflow is canonical `content/agents/**` `oac:` blocks emitted by RegistryEmitter; sidecar metadata and sidecar merging are superseded.

> **Owner:** Agent E
> **Status:** Spec only — no implementation code. **v2** (2026-07-15): the false "160 agents"
> figure purged (real count: **34**, disk-verified — see `06-REVIEW` F1); Stage 3 rewritten as
> a **merge from both trees** (`.opencode/` AND `plugins/claude-code/`), not a copy from
> `.opencode/` (`06-REVIEW` C2); the "or diff-explained" escape hatch deleted from the Stage-2
> gate (`06-REVIEW` G7); golden-test warning count corrected to 2 (`06-REVIEW` C4).
> **Read first:** [`00-INDEX.md`](./00-INDEX.md) (locked decisions). This doc depends on the
> canonical schema (02), adapter specs (03), and CLI/build/distribution (04).

**Prime directive for this workstream (from the user):** *understand how the change
affects everything before moving anything*, then *ship the smallest test that proves the
pipeline* and *write the full test spec now but defer most of it*. This document is the
"blast-radius map + safe route + proof harness." It does not move code; it tells the other
workstreams what will break and in what order to change it.

---

## 0. Ground Truth (measured, not assumed)

Facts below are pulled from the current tree and anchor every claim in this doc.

| Fact | Value | Source |
|------|-------|--------|
| Source of truth today (OpenCode side) | `.opencode/` (**34** agent `.md` files under `agent/`) | `find .opencode/agent -name '*.md' \| wc -l` → 34. *(v1 claimed 160 via `-path '*agent*'`, which also matched `context/openagents-repo/**` and `prompts/core/openagent/**` — falsified in `06-REVIEW` F1.)* |
| Claude Code side today | `plugins/claude-code/` — **7** agents, **12** skills, **6** CC-only commands, `hooks/session-start.sh` | drift is **bidirectional**: behind on agents, *ahead* on skills/commands/hooks (`00-INDEX` finding #3) |
| What syncs them | `scripts/bridge/sync-to-claude.sh` — a **39-line naive `cp`** | file `wc -l` |
| OpenCode install path | `curl … install.sh \| bash -s <profile>` (52 KB bash) | `README.md:125` |
| OpenCode update path | `curl … update.sh \| bash` (10 KB bash) | `README.md:139` |
| Claude Code install path | `/plugin marketplace add darrenhinde/OpenAgentsControl` → `/plugin install oac` | `README.md:170-177` |
| Marketplace plugin source | `./plugins/claude-code` | `.claude-plugin/marketplace.json` |
| npm publish payload | `files[]` ships `.opencode/**`, `scripts/`, `bin/`, `registry.json`, `install.sh`, `VERSION` | root `package.json` |
| npm workspaces | `evals/framework`, `packages/cli`, `packages/compatibility-layer` | root `package.json` |
| Adapters already built | `Base`, `Claude`, `Cursor`, `Windsurf` | `packages/compatibility-layer/src/adapters/` |
| Core already built | `AdapterRegistry`, `AgentLoader`, `CapabilityMatrix`, `TranslationEngine` | `packages/compatibility-layer/src/core/` |
| Test runners in use | **vitest** (compat-layer, evals) **and** `bun:test` (cli) — split | test files below |
| Golden/snapshot tests | **none exist** in first-party code today | grep `toMatchSnapshot` → only `node_modules` |

### 0.1 The version mismatch (must be reconciled — see §2.7)

| Artifact | Declared version | File |
|----------|------------------|------|
| `VERSION` | **0.7.1** | `/VERSION` |
| root `package.json` | **0.7.1** | `/package.json` |
| `packages/cli` | **1.0.0** | `packages/cli/package.json` |
| `packages/compatibility-layer` | **0.1.0** | `packages/compatibility-layer/package.json` |
| `evals/framework` | **0.1.1** | `evals/framework/package.json` |
| marketplace entry `oac` | **1.0.0** | `.claude-plugin/marketplace.json` |
| CC plugin manifest | **1.0.2** | `plugins/claude-code/.claude-plugin/plugin.json` |

Five different version numbers for one product across seven files. The CC plugin cache
(1.0.2) is ahead of the marketplace declaration (1.0.0) it's supposedly built from, and both
are ahead of the "real" `VERSION` (0.7.1) that the installer advertises. **No single source
of truth for the version exists today** — this is itself a symptom the refactor must fix.

---

## 1. Impact Analysis

### 1.1 Blast radius by area

Ripple = what silently breaks if the change lands without care. Mitigation = the guardrail
this refactor must put in place first.

| Area | Change | Ripple effect | Mitigation |
|------|--------|---------------|------------|
| `.opencode/` (source→output) | Demoted from source of truth to a **generated** build target | Every doc/link/PR that edits `.opencode/*` directly is now editing generated output; contributor muscle-memory breaks; git churn if generated files are committed | Keep `.opencode/` generated **and committed** during transition (dual-write) so nothing 404s; add a `// GENERATED — edit /content` banner; CODEOWNERS/CI warns on hand-edits to `.opencode/**` |
| `install.sh` (52 KB) | Deleted; absorbed into `oac` CLI | `curl\|bash` URL in README + every blog/gist/star breaks; `installer-checks.yml` (shellcheck/syntax/e2e) references it; `package.json files[]` ships it; issues #308/#304/#237/#277/#321/#310 are all against it | **Do not delete until §2 Stage where CLI reaches parity.** Replace `install.sh` with a thin shim that `exec`s `npx oac init` (keeps the URL alive); retire `installer-checks.yml` jobs in the same PR that deletes the script |
| `update.sh` (10 KB) | Deleted; absorbed into `oac update` | README update URL breaks; `installer-checks.yml` syntax-checks it | Same shim strategy → `npx oac update`; already have `packages/cli/src/lib/installer-update.ts` + tests to build on |
| `scripts/bridge/sync-to-claude.sh` | Deleted | The **only thing that actually produces CC output today**; `plugins/claude-code/` stops updating | Delete **only after** `oac build --target claude` provably reproduces (and improves on) its output — golden test in §3.1 is the gate |
| `plugins/claude-code/` | Deleted; becomes `oac build --target claude` output | Marketplace `source: ./plugins/claude-code` points at a path that will no longer be hand-maintained; installed CC users pull from here | Keep the path populated by the **build** (committed output) so the marketplace keeps resolving; see §1.3 for the CC-user migration |
| `.claude-plugin/marketplace.json` | `source` still `./plugins/claude-code`, but content now generated; `version` (1.0.0) must track real version | Version drift worsens if marketplace and `plugin.json` are bumped by different hands | Generate `plugin.json` **and** sync `marketplace.json.version` from the single `VERSION` during `oac build --target claude`; CI asserts they match |
| `registry.json` (107 KB, root) | Moves to `/content/registry.json`; becomes generated from `/content/*` frontmatter | `update-registry.yml`, `validate-registry.yml`, `sync-docs.yml`, `post-merge-pr.yml` all reference root `registry.json`; the CLI installer reads it | Introduce generated registry at new path with a **root symlink/copy** for one release; migrate the 4 workflows in lockstep; `oac build` emits registry, `validate-registry` validates the emitted one |
| `.github/workflows/installer-checks.yml` | Retire (bash installer gone) | Loses shellcheck/e2e coverage of the install path | Replace with a **CLI e2e job**: `npx oac init` into a temp dir on macOS+Linux+Windows runners; reuse the intent of `scripts/tests/test-non-interactive.sh` |
| `.github/workflows/update-registry.yml` + `validate-registry.yml` | Repoint to `/content/registry.json`; validation becomes "registry == build output" | Stale registry / drift re-introduced if generation and validation disagree | Single generator; `validate` runs the generator and `git diff --exit-code` |
| `.github/workflows/pr-checks.yml` + `post-merge-pr.yml` | Version-bump semantics must key off the **new single `VERSION`** | Conventional-commit → semver bump logic currently bumps root `package.json`/`VERSION`; with monorepo publish it must bump the published packages too | Define release topology in §2.7; keep conventional-commit title check (it's good) |
| npm `package.json files[]` | Rewritten: ship `dist/` of `packages/*` + `/content` bundle, **not** `.opencode/**` + `install.sh` | Anyone doing `npm i -g` today gets `.opencode/`; changing payload changes what `oac` finds at runtime | Version the payload change as a **major** bump of the CLI; `oac doctor` detects legacy layout |
| `evals/` (448 files) + `evals/framework` (workspace) | Should stay behavioral tests, but it loads agents from `.opencode/` via `@opencode-ai/sdk` | If `.opencode/` layout/paths shift, `test:ci` smoke test and all `eval:sdk` runs break; root `npm test` = `cd evals/framework && npm run eval:sdk` | Evals keep pointing at **generated** `.opencode/` output (the build target), so they validate the pipeline end-to-end for free; pin the smoke-test agent path; see §1.4 |
| Two test runners (`vitest` + `bun:test`) | New `/packages/core` + `/packages/adapters` need a runner | Fragmentation: contributors unsure which to use; CI must run both | **Decision needed** (Open Q1). Recommend standardizing new packages on **vitest** (already used by compat-layer + evals; richer snapshot API for §3.1 golden tests) |
| Root docs (`README.md`, `CONTEXT_SYSTEM_GUIDE.md`, `COMPATIBILITY.md`, `ROADMAP.md`, `plugins/claude-code/*.md`) | Install/edit instructions change | Users follow stale curl/`/plugin` docs; contributors edit wrong tree | Docs updated **in the same stage** that changes the user-facing command; `sync-docs.yml` already exists to propagate |

### 1.2 Dependency ordering (what must change before what)

```
/content authored ──► packages/core (schema+loader) ──► packages/adapters ──► oac build
                                                                                  │
              golden test (§3.1) gates ─────────────────────────────────────────┤
                                                                                  ▼
   sync-to-claude.sh delete ◄── plugins/claude-code generated ◄── build --target claude
   install.sh → shim ◄────────── oac init parity ◄────────────── build --target opencode
   registry workflows repoint ◄─ /content/registry.json generated
   installer-checks retire ◄──── CLI e2e job green
```
Nothing on the right may happen before the thing on its left is proven. The golden test in
§3.1 is the single most important gate — it is the "left" of both delete arrows.

### 1.3 Migrating already-installed users without breakage

Two populations, two mechanisms, both must keep working through the whole migration.

**A. `curl | bash install.sh` users (OpenCode)**
- They have a `.opencode/` tree written by the bash installer and (maybe) a global `oac` bin.
- **Break risk:** deleting `install.sh` 404s the curl URL; changing the npm `files[]` payload
  changes what a reinstall produces.
- **Migration path:**
  1. Keep the `install.sh` URL live as a **shim** that `exec`s `npx oac init` (or prints a
     one-line upgrade notice). The bookmark/README curl command never breaks.
  2. `oac doctor` (exists: `packages/cli/src/**`) detects a legacy hand-installed `.opencode/`
     and offers `oac migrate` to reconcile it with the manifest-tracked layout.
  3. Reuse the existing **manifest** (`packages/cli/src/lib/manifest.ts` + `manifest.test.ts`)
     so updates are diff-based, not clobbering — this already exists and must be preserved.

**B. `/plugin install oac` users (Claude Code)**
- They installed from marketplace `source: ./plugins/claude-code` at some cached version
  (observed 1.0.2). CC re-resolves the marketplace ref on update.
- **Break risk:** if `plugins/claude-code/` stops being maintained (or its layout changes) but
  the marketplace still points there, CC users get a stale or malformed plugin.
- **Migration path:**
  1. `plugins/claude-code/` stays at the **same path**, now populated by `oac build --target
     claude` and committed — so `/plugin update` keeps resolving with no user action.
  2. The generated `plugin.json` fixes the drift (7 → full agent set) — this is a **visible
     upgrade** for CC users, delivered transparently through the existing marketplace channel.
  3. `marketplace.json.version` is stamped from the single `VERSION` so the update actually
     registers as a new version (today's 1.0.0-vs-1.0.2 drift would suppress the update).

> **Non-negotiable:** neither install URL nor the marketplace ref changes identity during the
> refactor. Users migrate by *doing nothing*; the payload behind the same entry point improves.

### 1.4 Evals impact (the free end-to-end check)

`evals/framework` (`@controlstack/eval-framework`, v0.1.1) is an npm workspace that loads
agents through `@opencode-ai/sdk` and runs behavioral suites; root `npm test` delegates to it
(`test:all` → `cd evals/framework && npm run eval:sdk`). Because it reads the **`.opencode/`
tree**, and `.opencode/` becomes **build output**, the evals automatically become an
integration test of the build pipeline: if `oac build --target opencode` produces a broken
agent, `test:ci` (the `smoke-test.yaml`, `--no-evaluators`) fails. **Do not rewire evals to
read `/content` directly** — keeping them on the generated output is what makes them prove the
build. Only pin: the smoke-test agent id and its path so a layout change is a loud failure.

### 1.5 PR & issue triage (18 open PRs, 37 open issues)

Classified into four buckets. **Land quick-wins first** (before touching architecture) to
shrink the conflict surface; **port** the good ideas into the new design; **close obsolete**
ones with a pointer to #206; **reject** what the locked decisions forbid.

#### OBSOLETE — superseded by the refactor (close with pointer to #206)
| Item | Why obsolete |
|------|-------------|
| **#298** (stalled CLI mega-PR, +19k, conflicting) | This refactor *is* the replacement, delivered incrementally. Salvage ideas, don't merge the blob — its size is the anti-pattern the locked decisions call out. |
| **#316** (opencode compat) | Compat is subsumed by the adapter architecture (`/packages/adapters`); re-express any specific fix as an adapter rule. |
| **#237 / #277 / #321** (installer bugs, if they're `install.sh` internals) | The bash installer is being deleted; fixing its internals is throwaway work. Verify each isn't a UX requirement that must be **ported** to `oac init` (see below). |

#### REJECTED — violate locked decision #2 (no hardcoded models)
| Item | Reason |
|------|--------|
| **#311**, **#324** | Hardcode model defaults. Canonical `model` field is `null` ⇒ tool default. Close with the locked-decision link. |

#### PORT — good change that must be re-expressed in the new design
| Item | Port target |
|------|-------------|
| **#326 / #328 / #309 / #312** (install.sh patches) | Each patch encodes a real install requirement (flags, platform handling, non-interactive mode). Extract the *requirement* and re-implement in `oac init`/`oac update`. Treat these PRs as the **spec for installer parity** (§2 Stage 4), then close. |
| **#325** (typescript.md, née #322) | Content change → lands in `/content/context/` once that dir exists; trivially re-homed. Can also land **now** in `.opencode/` and be swept into `/content` by the migration script (quick-win-friendly). |
| **#308 / #304 / #310** (installer bugs, if UX/behavior) | Any that describe *what the installer should do* (not *how the bash does it*) become acceptance criteria / test cases for the CLI installer and its e2e job. |

#### QUICK-WINS — independent, land before the refactor to de-risk
| Item | Note |
|------|------|
| **#325** (typescript.md) | Pure content; no architectural coupling. Merge now. |
| Any doc-only / registry-data PRs among the 18 | `validate-registry.yml` already gates them; low conflict risk. |
| **The version reconciliation itself** | Not a PR yet — do it as the very first chore (§2 Stage 0). |

> **Rule of thumb applied:** an item is *obsolete* if it edits a file slated for deletion in a
> way the new design already covers; *port* if it edits such a file but encodes a real
> requirement; *quick-win* if it touches neither the deleted files nor the schema.

---

## 2. Migration Staging Plan

Design constraint (locked decision #4): **every stage ships and is independently valuable.**
Explicitly *not* the #298 pattern (one +19k PR). Each stage is a handful of PRs and a release.

### Stage 0 — Reconcile versions & freeze the map *(chore; no behavior change)*
- **Goal:** one version number; agree the release topology; land pure quick-wins.
- **Deliverable:** single `VERSION` (or root `package.json.version`) becomes the source; a
  short `VERSIONING.md` (extends existing `.github/workflows/VERSION_BUMP_GUIDE.md`); merge
  #325 and any doc-only PRs; close #311/#324 (rejected) with rationale.
- **Ships to users:** nothing user-visible except the typescript.md content; a clean version.
- **Independently valuable:** stops the drift bleeding; unblocks honest release notes.
- **Exit criteria:** all seven version sites resolve from one number in CI; `git grep` for
  hardcoded versions is clean; rejected PRs closed.
- **Release:** patch bump (e.g. → 0.7.2) purely to prove the reconciled pipeline.

### Stage 1 — Stand up `/content` + `packages/core` (schema & loader) *(additive)*
- **Goal:** neutral source of truth exists and parses; **one** agent authored canonically.
- **Deliverable:** `/content/agents/code-reviewer.md` (the worked example from `00-INDEX.md`);
  `packages/core` = Zod `OpenAgentSchema` (moved/extended from
  `packages/compatibility-layer/src/types.ts`) + registry loader (from `core/AgentLoader.ts`).
  Nothing deleted; `.opencode/` still authoritative for everything else.
- **Ships to users:** nothing (internal). Optionally publish `@oac/core` as a library.
- **Independently valuable:** the schema + loader are usable/testable in isolation; contributors
  can start authoring in `/content` without any build wired.
- **Exit criteria:** `packages/core` builds; **schema-validation test** (§3, Layer 1) green for
  the one agent; CI runs the new package's tests.

### Stage 2 — Build pipeline + the minimal golden test *(the pipeline proof)*
- **Goal:** `oac build --target <opencode|claude>` produces output for the one agent, proven
  byte-stable by a golden snapshot.
- **Deliverable:** `packages/adapters` (adopt existing `Base/Claude/Cursor/Windsurf`); `oac
  build` command; **the minimal test in §3.1**: golden snapshot of `code-reviewer` → opencode
  + claude, plus a parse/manifest check that the CC output loads. `.opencode/` and
  `plugins/claude-code/` outputs are **generated and committed** but the legacy
  `sync-to-claude.sh` still runs in parallel (dual-write, not yet deleted).
- **Ships to users:** nothing visible yet; internally the CC plugin can already be regenerated.
- **Independently valuable:** this is the "does the whole idea work?" proof; unblocks every
  later delete.
- **Exit criteria:** §3.1 golden + manifest tests green in CI; generated `.opencode/`
  `code-reviewer` is **byte-identical** to the committed golden — **no escape hatch**. (The
  v1 wording "byte-identical *or diff-explained*" made the gate unfalsifiable — `06-REVIEW`
  G7 — and was deleted. Any difference between generated output and the hand-maintained file
  is resolved as an explicit, written merge decision in `09-MERGE-RULES.md` *before* the
  golden is committed; the gate itself only accepts byte-identity.) **Evals smoke-test still
  passes** against generated output.
- **Release:** minor bump; `oac build` is a real new capability.

### Stage 3 — MERGE both trees into `/content`; retire the bridge *(the big sweep, staged)*

> ⚠️ **This is a MERGE, not a copy** (`00-INDEX` finding #3; `06-REVIEW` C2/L1). Drift is
> **bidirectional**. `.opencode/` has 34 agents to CC's 7 — but `plugins/claude-code/` is
> *ahead* everywhere else: **12 skills** vs OpenCode's 4+2 (disjoint sets), hand-authored
> `<example>` blocks that exist nowhere in `.opencode/`, **6 CC-only commands**, and
> `hooks/session-start.sh` — the context-injection hook with no OpenCode equivalent.
> Seeding `/content/` from `.opencode/` alone destroys all of it.

- **Goal:** merge **both** source trees — `.opencode/` (34 agents, 20 commands, 4+2 skills,
  297 context entries) **and** `plugins/claude-code/` (7 agents, 12 skills, 6 commands,
  hooks) — into `/content` per the written conflict rules in `09-MERGE-RULES.md`; `oac build`
  then reproduces the full `.opencode/` **and** the full CC plugin from one source.
- **Deliverable:** a migration script driven by `09-MERGE-RULES.md` — **not** a blind copy of
  `.opencode/*`. Per the Stage-1 conflict rules: for the **7 dual-home agents**, the CC body
  wins (newer, richer, carries the `<example>` blocks) with OpenCode-only fields grafted;
  skills = **union of 16**, gated by `targets: []`; harvest the CC `<example>` blocks into
  `examples[]`, the 6 CC-only commands into `/content/commands/`, and `session-start.sh`'s
  six capabilities into `/content/hooks/`; every conflict resolved by a written rule and
  recorded in the PR. Then: delete `scripts/bridge/sync-to-claude.sh`;
  `plugins/claude-code/` now 100% generated (fixes the 7-vs-34 agent drift — a visible
  CC-user upgrade); `registry.json` generated to `/content/registry.json` with a root copy
  for compat; repoint `update-registry.yml` / `validate-registry.yml` / `sync-docs.yml` /
  `post-merge-pr.yml`.
- **Ships to users:** **CC users get the full agent set**; OpenCode users gain the merged
  CC-side content where applicable — via the existing channels.
- **Independently valuable:** kills the single worst bug in the repo (the naive-`cp` drift).
- **Exit criteria:** structural/manifest tests (§3, Layer 4) green for the whole set; evals full
  suite unaffected; `validate-registry` = "registry matches build output"; no hand-edits
  remain in `.opencode/` (CI guard); **no CC-only asset lost** — the 12 skills, 6 commands,
  all `<example>` blocks, and `session-start.sh`'s six capabilities are present in `/content`
  (checked against `01` §11's preservation checklist).
- **Release:** minor/major; announce CC plugin parity.

### Stage 4 — Absorb `install.sh` / `update.sh` into the CLI *(installer parity)*
- **Goal:** `oac init` / `oac update` reach parity with the bash installers; the ported
  requirements from #326/#328/#309/#312 and issues #308/#304/#310 are satisfied.
- **Deliverable:** parity feature-matrix (derived from those PRs/issues) implemented in
  `packages/cli` (build on existing `installer.ts` + `installer-update.ts` + `manifest.ts` +
  tests); replace `install.sh`/`update.sh` with thin shims that `exec npx oac`; **new CLI e2e
  workflow** (macOS+Linux+Windows `oac init` into temp dir) replacing `installer-checks.yml`.
- **Ships to users:** the curl URL now bootstraps the CLI; identical entry point, better guts.
- **Independently valuable:** closes the long tail of installer bug issues in one supported path.
- **Exit criteria:** CLI e2e job green on 3 OSes; real-tool headless-load test (§3, Layer 5)
  green; the ported PRs closed with "delivered by `oac init`."
- **Release:** **major** bump of the CLI/product (npm `files[]` payload changes — breaking).

### Stage 5 — Flip source-of-truth signals; finalize *(cleanup)*
- **Goal:** `/content` is unambiguously the source; `.opencode/` is unambiguously output.
- **Deliverable:** `// GENERATED` banners on all `.opencode/**` + `plugins/claude-code/**`;
  CODEOWNERS/CI hard-fail on hand-edits; README/docs rewritten to author-in-`/content`; retire
  `installer-checks.yml`; optional: stop committing generated trees and build on publish.
- **Ships to users:** documentation clarity; no functional change.
- **Independently valuable:** prevents regression to the old dual-source mess.
- **Exit criteria:** round-trip/idempotence + capability-matrix conformance tests (§3, Layers
  2–3) green; docs link-checked; a fresh clone → `oac build` → clean `git diff`.

### 2.7 Version bumps & release topology (resolving §0.1)

- **Single version source:** root `VERSION` (kept in sync with root `package.json.version` by
  the existing `post-merge-pr.yml` conventional-commit bump). Everything else *derives* from it.
- **Derived at build time:** `oac build --target claude` stamps
  `plugins/claude-code/.claude-plugin/plugin.json.version` **and**
  `.claude-plugin/marketplace.json` plugin `version` from `VERSION`. CI asserts equality
  (kills the 1.0.0-vs-1.0.2 drift permanently).
- **Package versions:** `packages/*` may retain independent semver *iff* published separately;
  simplest is **lockstep** (all publish at product `VERSION`). Decide in Open Q2.
- **Where bumps happen:** Stage 0 patch (reconcile); Stage 2 minor (`oac build`); Stage 4
  **major** (payload/CLI breaking change). `pr-checks.yml`'s conventional-commit title gate
  already maps type→bump — reuse it; no new mechanism.

---

## 3. Test Spec

Reuse the two patterns already in the tree:
- **vitest + `__tests__/` + `fixtures/`** (from `packages/compatibility-layer/src/**/__tests__/`;
  `convert.test.ts` already does temp-dir + roundtrip integration and is the template).
- **`bun:test` + `src/lib/*.test.ts`** (from `packages/cli`; `manifest.test.ts` is the template
  for manifest/parse checks).

Recommendation (Open Q1): author the **new** `core`/`adapters` tests in **vitest** — it already
backs compat-layer and evals and has first-class `toMatchSnapshot`/`toMatchFileSnapshot`, which
the golden layer needs.

### 3.1 MINIMAL FIRST — the pipeline-proof test (build at Stage 2, blocks everything)

The smallest test that proves the whole idea. **This is the only test that must exist before
any deletion.** Two assertions on **one** agent (`code-reviewer`):

1. **Golden snapshot — opencode target**
   `oac build --target opencode` on `/content/agents/code-reviewer.md` ⇒ compare emitted
   `.opencode/agent/subagents/code/reviewer.md` (+ `agent-metadata.json` sidecar) against a
   committed golden file. Asserts: `name` PascalCased, `mode: subagent`, `temperature: 0.1`
   preserved, `permission` granular block correct, **no `model:` line** (null → default).

2. **Golden snapshot — claude target**
   `oac build --target claude` ⇒ compare emitted `agents/code-reviewer.md` + generated
   `plugin.json` fragment against golden. Asserts: `name` kebab-cased, `tools: Read, Glob, Grep`
   allowlist, examples folded into `description`, and **exactly 2 warnings** emitted (from
   `CapabilityMatrix`), never silent: (a) `temperature` dropped — CC has no per-agent
   temperature; (b) the scoped `delegate` rule dropped with `Task`. *(v1 asserted one warning
   — corrected per `00-INDEX` worked example and `03` §2.8; `06-REVIEW` C4. `coder-agent` =
   4 warnings.)*

3. **Parse/manifest load check (CC output actually loads)**
   Parse the generated CC `plugin.json` + agent front-matter (reuse the `manifest.ts` reader
   pattern from `packages/cli/src/lib/manifest.test.ts`): valid JSON, required keys present,
   `version` matches `VERSION`, every referenced agent file exists on disk. Proves the output
   isn't just byte-stable but *loadable*.

Fixtures: one input (`/content/agents/code-reviewer.md`) + two golden outputs + two expected
warning strings. Golden files are regenerated with an `--update` flag (vitest snapshot update),
reviewed in PR — the human-diff of a golden change is a feature, not a chore.

### 3.2 DEFERRED — the layered spec (write now, build at the marked stage)

| # | Layer | Proves | Build at | Template to reuse |
|---|-------|--------|----------|-------------------|
| 0 | **Golden snapshot** (the §3.1 minimal) | Build output is byte-stable & loadable | **Stage 2** | new vitest `toMatchFileSnapshot` |
| 1 | **Schema validation** | Every `/content/*` file parses against the Zod IR | **Stage 1** | `compatibility-layer` `validate.test.ts` |
| 2 | **Round-trip / idempotence** | `build` is deterministic; re-import→re-build is stable | **Stage 5** | `convert.test.ts` roundtrip block |
| 3 | **Capability-matrix conformance** | Every unsupported-capability drop is *reported*, never silent | **Stage 2→3** | `core/CapabilityMatrix.ts` + a matrix test |
| 4 | **Structural / manifest** | Full generated tree has all files, valid manifest, versions synced | **Stage 3** | `cli` `manifest.test.ts` |
| 5 | **Real-tool headless load** | OpenCode/CC actually load the built output without error | **Stage 4** | evals `@opencode-ai/sdk` smoke pattern |
| 6 | **Behavioral evals** | Built agents still *behave* correctly | **already exists** | `evals/framework` `eval:sdk` suites |

Initial concrete cases per layer (2–3 each), to be authored when its stage arrives:

- **Layer 1 — Schema validation**
  1. `code-reviewer.md` validates; all required IR fields present.
  2. `model:` set to a string (not `null`) → **rejected** (enforces locked decision #2;
     ratified in `07-EXECUTION-PLAN` Stage 1: `model` is **not authorable** — cost intent
     moves to `inference.tier`, resolving `06-REVIEW` C3).
  3. Unknown capability key → validation error with the offending path.

- **Layer 2 — Round-trip / idempotence**
  1. `build → build` yields identical bytes (no timestamp/order nondeterminism).
  2. `.opencode` output → re-parse to IR → re-build → equals first build (semantic round-trip).
  3. Reordering `capabilities:` keys in source does not change output (canonical ordering).

- **Layer 3 — Capability-matrix conformance**
  1. `temperature` on claude target → exactly one warning, emitted and collected.
  2. `delegate:` on a target without task-delegation → warned, not dropped silently.
  3. A fully-supported agent → **zero** warnings (no false positives).

- **Layer 4 — Structural / manifest**
  1. Full build emits the same **count** of agents as `/content/agents/*` (guards the 7-vs-34
     drift regression directly).
  2. Manifest `sha256` per file matches on-disk content (reuse `sha256.test.ts`).
  3. `plugin.json.version` == `marketplace.json` version == `VERSION`.

- **Layer 5 — Real-tool headless load**
  1. `@opencode-ai/sdk` loads the built `code-reviewer` without error.
  2. CC plugin manifest passes whatever `/plugin` validation is scriptable (or a JSON-schema
     stand-in) in a temp `oac init`'d dir.
  3. `oac doctor` on a fresh `oac init` reports zero problems (3-OS e2e job).

- **Layer 6 — Behavioral evals** (unchanged)
  1. Existing `smoke-test.yaml` (`test:ci`) passes against **generated** `.opencode/`.
  2. `code-reviewer` denies write/edit/bash at runtime (matches its `capabilities`).
  3. Delegation to `contextscout` still fires.

### 3.3 CI wiring for tests

- New `packages/core` + `packages/adapters` join the root `test` script (add to the vitest
  projects); they run on `pr-checks.yml`.
- Golden layer runs on every PR; a golden diff requires an explicit `--update` commit (visible).
- `validate-registry.yml` becomes "run generator, `git diff --exit-code`" (registry == output).
- Replace `installer-checks.yml` bash jobs with the 3-OS `oac init` e2e job at Stage 4.
- Evals `test:ci` smoke test stays as the always-on end-to-end guard against the built output.

---

## Open Questions

1. **Test runner unification.** New `core`/`adapters` on **vitest** (matches compat-layer +
   evals, better snapshot API) while `packages/cli` stays on `bun:test`? Or migrate cli to
   vitest for one runner? Split runners mean two CI invocations and contributor confusion.
2. **Package version topology.** Lockstep-publish all `packages/*` at the single product
   `VERSION`, or keep independent semver per package (requires per-package release plumbing)?
   §2.7 assumes lockstep unless decided otherwise.
3. **Commit generated output, or build-on-publish?** Committing `.opencode/` +
   `plugins/claude-code/` keeps the curl/marketplace paths trivially resolvable during
   migration but adds git churn and invites hand-edits. Building only on `npm publish` is
   cleaner long-term but needs the marketplace to resolve a built artifact. Recommend commit
   through Stage 4, flip in Stage 5 — confirm.
4. **`install.sh` shim vs. hard cutover.** Keep the curl URL alive as a shim that `exec`s
   `npx oac init` indefinitely (max compatibility), or announce a deprecation window then 404
   it? Affects how long we maintain the shim.
5. **Registry location transition.** Root `registry.json` → `/content/registry.json`: symlink,
   copy, or hard move with a redirect? Four workflows + the CLI installer read the root path;
   pick the least-surprising transition.
6. **Which installer-bug issues are UX vs. bash-internal?** #308/#304/#237/#277/#321/#310 must
   each be read to decide *port* (becomes a CLI acceptance test) vs. *obsolete* (bash-internal,
   discarded). This triage needs a human pass before Stage 4.
7. **Evals coupling to `@opencode-ai/sdk`.** Evals validating the built OpenCode output is a
   feature, but it hard-couples the test suite to one tool's SDK. Acceptable, or do we want a
   tool-neutral behavioral harness eventually? (Out of scope for this refactor; flag it.)
