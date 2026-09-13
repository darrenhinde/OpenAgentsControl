# 07 — Execution Plan (Staged, Test-Gated)

> **Status:** Approved direction — supersedes `05`'s staging where they conflict.
> **Date:** 2026-07-15 · **Branch:** `refactor/canonical`
> Incorporates the `06-REVIEW` verdict: architecture sound, spec not buildable as written.
> Every stage below states its **Why**, the **core features** it must achieve, and the
> **tests that gate it**. A stage is done when its tests pass in CI — not before, not "mostly."

---

## North Star

**OAC is the build system for AI agent configuration.**
Author agents, permissions, and team context **once** in a neutral TypeScript-parsed format
(`/content/`); compile to every tool a team uses (`oac build --target <tool>`); install and
update on user machines safely (`oac init|add|update`); and **verify** the result actually
loads in each real tool. Never degrade silently.

### Locked platform decisions (this plan)

| Decision | Choice | Why |
|---|---|---|
| Language | **TypeScript everywhere** — kill the 52KB `install.sh`/`update.sh` and the Bun-only APIs | One codebase, testable, cross-platform; bash installers are the root of the Windows bug class (#304, #312) |
| Runtime | **Node ≥ 20** (no Bun requirement) | `npm i -g` must work on a clean machine; Bun coupling defeats npm distribution (15 files to convert, mechanical) |
| Workspace manager | **pnpm** (workspaces + lockfile) | Security: strict non-flat `node_modules` (no phantom deps), `ignore-scripts` by default, single content-addressed store, better lockfile integrity. Replaces the current bun.lock + package-lock.json split |
| Distribution | **npm registry** (`npm i -g @controlstack/oac` / `npx @controlstack/oac`) | Users install with the tool they already have; the installed binary remains `oac`; pnpm is our dev tool, not a user requirement |
| First-class targets v1 | **OpenCode + Claude Code** (+ cheap `agents-md` target) | The two with real users and verified formats. Windsurf CUT from v1 (format never verified against a live install); Cursor = experimental |
| Core product | **Context management** — team standards versioned, installed, updated safely | This is the wedge: "bring your standards, we deploy them to every tool." The generic context library becomes optional starter profiles |
| Verification | **Install-verification matrix** as a product feature (`oac doctor --verify`) and a CI gate | "It installed" ≠ "the tool loads it." Headless real-tool load checks across OS × tool × profile |

---

## Stage Overview

| # | Stage | Ships | Gate (summary) |
|---|---|---|---|
| 0 | Quick wins — stop the bleeding | CI gates, security hotfix, version sync, junk sweep, pnpm workspace | packages-only PR triggers full CI; hotfix live |
| 1 | Spec repair & decisions | Fixed `02` schema, revised `01`/`05`, merge conflict rules, 3 blockers answered | Zero BLOCKING open questions; precedence experiment run |
| 2 | `packages/core` — IR schema + parsers | Zod IR, MVI parser, agent/skill/command/registry loaders | **Corpus test:** every real content file parses |
| 3 | Build pipeline + golden tests | `oac build --target opencode\|claude\|agents-md` for worked agents | Golden snapshots byte-stable; build idempotent; warning counts exact |
| 4 | Content merge & migration | `/content/` seeded from BOTH trees; bridge retired | Generated trees load in real tools; evals pass on generated output |
| 5 | CLI, installer parity & verification matrix | Node-portable `oac init/add/update/doctor`; dependency resolution fixed; 3-OS install e2e | `npm i -g` works on clean Windows/macOS/Linux, no Bun; verify matrix green |
| 6 | Flip source of truth & release | Generated trees uncommitted; bash installers deleted; rollback/pinning story; README rewrite | Fresh clone → `oac build` → clean `git diff`; one version number |

Dependency order is strict 0→1→2→3→4→5→6, but Stage 0 items are independently shippable
today and Stage 1 is documentation/decision work that can overlap Stage 0.

---

## Stage 0 — Quick wins: stop the bleeding

**Why:** The refactor will be built on the same ungated pipeline that produced the current
drift unless CI is fixed first. A live security gap is shipping to Claude Code users today.
Version drift would suppress the `/plugin update` that delivers any fix. None of this needs
the refactor — it needs a week.

**Core features:**
1. **CI gates for the core packages.** New workflow runs `packages/cli`,
   `packages/compatibility-layer`, `packages/plugin-abilities` tests + lint + typecheck on
   every PR. Add a `packages/` branch to `scripts/validation/detect-pr-changes.ts` (today a
   packages-only PR triggers **zero** checks).
2. **Security hotfix for the live CC `coder-agent` gap** (index finding #10): tighten the
   shipped plugin agent's `tools:`, ship `RECOMMENDED-PERMISSIONS.md` (deny-only snippets),
   changelog advisory. Independent of the refactor.
3. **Version reconciliation** — one version across `VERSION`, root + package manifests,
   marketplace, plugin (currently 5 numbers across 7 files; the plugin cache is *ahead* of
   the marketplace).
4. **pnpm workspace bootstrap.** `pnpm-workspace.yaml` covering `packages/*` +
   `evals/framework`; one `pnpm-lock.yaml`; remove root `package-lock.json`/`bun.lock`
   split. Dev scripts run via pnpm; nothing user-facing changes yet.
5. **Junk sweep:** delete/gitignore `dev/`, `context-findings/`, empty `claude-plugin/`
   stub; archive `docs/planning/` (16 stale synthesis docs) under `docs/archive/`.

**Tests / gate:**
- A PR touching only `packages/**` runs build + tests + lint + typecheck in CI (prove with a
  no-op PR).
- `pnpm install && pnpm -r test` green from a fresh clone.
- One grep proves one version string repo-wide.
- Hotfix verified: shipped CC agent no longer grants unscoped `Edit`, or the documented
  mitigation is published and linked from the README.

---

## Stage 1 — Spec repair & decisions (docs only, no code)

**Why:** `06-REVIEW`'s verdict is verified: the centerpiece schema rejects the corpus it
describes (19 real dependency refs and the full context corpus recorded in `09` §9), two docs were never revised
after v2 decisions, and the hardest migration task (the merge) has no owner. Writing code
against a self-contradicting spec reproduces the drift we're curing.

**Core features:**
1. **Fix `02`'s schema on paper:** dependency kinds `agent|plugin|config` + wildcard refs;
   `ContextSchema.description`/`name` optional/derived; `targets: []` applicability field on
   every content type; restore `profiles` (with `additionalPaths`/`badge`), `categories`,
   `aliases[]`; define the **implicit-default rule** (no `*` rule present → opposite of the
   decisions present; mixed-without-`*` = parse error).
2. **Revise `01` and `05` to v2:** purge the false "160 agents" (4 sites); rewrite `05`
   Stage 3 as a **merge**, not a copy; delete the "or diff-explained" escape hatch from the
   Stage-2 gate; retract `01`'s `.env` alarm (Q17 closed); align `{pattern,effect}` →
   `{scope,decision}`.
3. **Merge ownership + conflict rules** (per content type, written down): for the 7
   dual-home agents, **CC body wins** (newer, richer, has `<example>` blocks) with
   OpenCode-only fields grafted; skills = union of 16 via `targets:[]`;
   `session-start.sh` preserved into `/content/` hooks.
4. **Answer the 3 blockers:** user projects hold an **editable `content/`** (yes — else
   "author once" dies at the user boundary); `model` **not authorable** — add
   `inference.tier: fast|balanced|deep` preserving the haiku-scouts cost tiering; implicit
   default per item 1.
5. **Run the last-match-wins experiment** against a real OpenCode install (10 minutes;
   currently "confirmed" only by self-citation).
6. **Decide symlinks:** convert the 3 context symlinks to `aliases[]` and fix the 3 files
   referencing alias paths (symlinks silently corrupt Windows checkouts).
7. **Write the rollback story** (marketplace pinning, abort criterion) before anything is
   deleted.

**Tests / gate:** no code tests — the gate is editorial and explicit:
- Zero open questions labelled BLOCKING across `01`–`05` (each of `06`'s F/C/L/G findings
  marked *fixed* or *accepted* in a disposition table appended to `06`).
- The precedence experiment's transcript committed to this directory.
- Merge conflict rules signed off (the table in `09-MERGE-RULES.md`: content type → source of
  truth → conflict resolution).

---

## Stage 2 — `packages/core`: IR schema + parsers (test-first)

**Why:** Everything downstream consumes the IR. `06` proved the previous schema draft
rejected the real corpus — so the corpus test is written **first** and drives the
implementation. This is the forcing function that proves Stage 1 actually worked.

**Core features:**
1. New `packages/core` (pure TS, zero Bun, zero I/O beyond `node:fs`): Zod IR schemas for
   all content types (agent, skill, command, context, tool, hook, registry, profiles).
2. **MVI context parser** with the leading-window rule (line 1, or first line after a
   closing YAML `---`), dual-format merge (MVI wins for its 4 fields), non-strict priority
   enum, `X.Y` version normalization **with a re-emit rule** (`2.0.0` → `2.0` on serialize,
   no churn).
3. Agent/skill/command frontmatter loaders; registry + profiles loader with alias and
   wildcard dependency resolution (`context:core/*`).
4. Capabilities model: Option A ordered rules + scalar/map sugar desugaring; last-match-wins
   resolution; parse-time validation for integer-like scopes and duplicate scopes.

**Tests / gate (all in CI from this stage on):**
- **Corpus test (Layer 1):** every real file parses — 34 agents, the context corpus recorded in
  `09` §9, 20 commands, 16 skills, `registry.json` including all 19 previously-rejected dependency refs
  and all 5 profiles. Zero failures, zero skips.
- **Trap tests:** the line-232/line-301 prose-marker files parse with correct (path-derived)
  metadata, NOT the in-body marker; the 3 dual-format files resolve MVI-wins; the
  `Priority: reference` outlier is accepted.
- **Round-trip unit tests:** parse→serialize is byte-identical for a sample of each content
  type (catches the version-churn and `read: allow` omission classes).
- **Capability tests:** `coder-agent`'s deny-all-then-allowlist and `openagent`'s
  ask-with-denies resolve correctly under last-match-wins; implicit-default rule covered by
  explicit cases including the five-denies-no-`*` `edit` block.

---

## Stage 3 — Build pipeline + golden tests (the pipeline proof)

**Why:** `oac apply` is already ~80% of `oac build`. Proving the pipeline on the easiest
and hardest real agents — before migrating 900 files — is the cheapest possible point of
failure. If adapters can't express the real agents acceptably, we find out here for the
cost of a week (see kill criteria).

**Core features:**
1. `oac build --target opencode|claude` re-rooted at `/content/`, built on the existing
   adapters — with `ClaudeAdapter` rewritten to the **plugin layout**
   (`.claude-plugin/plugin.json`, flat `agents/`, `hooks/hooks.json`, bundled `context/`).
2. **`agents-md` target:** emit a well-formed `AGENTS.md` from the same IR — near-free
   adapter that makes OAC useful to every tool that reads the emerging standard.
3. Warning system: every capability/field drop reported, never silent; `--strict` semantics
   redefined so it is satisfiable (known-expected warnings baselined per target).
4. Fail-closed rules from `03`: omit `Bash` on scoped-bash agents for CC; security-glob
   drops are **build blockers** with explicit `--allow-unsafe-degradation` opt-in.

**Tests / gate:**
- **Golden snapshots (Layer 0):** `code-reviewer` (easy) and `coder-agent` (hard) build
  byte-stable for both targets; snapshots reviewed against the hand-maintained plugin files
  and every diff recorded as an explicit merge decision (no "diff-explained" hand-waving).
- **Warning-count exactness:** `code-reviewer` on CC = 2 warnings; `coder-agent` = 4 — the
  counts from `03`, asserted, not approximated.
- **Idempotence:** `oac build && oac build` = no-op; OpenCode output re-parsed → re-built =
  identical (Layer 2).
- **Security gate test:** building CC `coder-agent` without the opt-in flag **fails** on the
  dropped security globs.

---

## Stage 4 — Content merge & migration (the big sweep)

**Why:** The single highest-risk task (`06` L1/C2): `.opencode/` and `plugins/claude-code/`
have drifted bidirectionally (108 vs 269-line versions of the same agent; disjoint skill
sets; `session-start.sh` exists only on the CC side). It is executed here — against the
written Stage-1 rules — not improvised under deadline.

**Core features:**
1. Seed `/content/` from **both** trees per `09-MERGE-RULES.md`; harvest CC `<example>`
   blocks, the 12 CC skills, 6 CC-only commands, and `session-start.sh`'s six capabilities.
2. **Path tokenization** in bodies *and permission scopes* (`{{SKILL_ROOT}}` etc.) + a lint
   forbidding raw `.opencode/` paths in `/content/` (~129 files affected).
3. Symlinks → `aliases[]`; fix the 3 referencing files.
4. Retire `scripts/bridge/sync-to-claude.sh` — only after golden parity holds.
5. Registry regenerated from `/content/` (closing the 110 unregistered-file gap becomes
   mechanical).

**Tests / gate:**
- Corpus test still green over the merged `/content/` (now the only source).
- **Full-tree structural test (Layer 4):** generated `.opencode/` and plugin trees contain
  every expected file; manifests valid; tokenized paths resolve in both install layouts.
- **Real-tool load (Layer 5, first pass):** OpenCode headless (`@opencode-ai/sdk`) and
  Claude Code load the **generated** trees without error.
- **Evals as the behavior gate:** the existing eval suites run against generated (not
  hand-written) agents; pass rate ≥ current baseline on main.

---

## Stage 5 — CLI, installer parity & the install-verification matrix

**Why:** This is where the user-facing promise lands: `npm i -g @controlstack/oac` on a clean machine —
including Windows — with no Bun, no bash, safe updates, and working dependency resolution
(today `add.ts` installs a component and **none** of its dependencies; issue #310 is a user
discovering this). And "it installed" must be checkable per tool: your explicit requirement
for a system that tests installation across AI tools lives here as a feature, not a script.

**Core features:**
1. **Node-portability:** convert the 15 Bun-API files (`node:fs/promises`, `node:crypto`,
   `fileURLToPath`); `bin/oac.js` runs on plain Node; fix `bundled.ts`'s package-root
   heuristic (explicit `package.json` name check).
2. **Dependency resolution done right:** transitive walk with cycle detection, wildcard
   expansion, alias resolution; unresolvable ref = hard error (this will surface hidden
   breakage — budgeted).
3. `oac init|add|update|remove|status|doctor` at full `install.sh` parity — absorbing the
   requirements encoded in open PRs #326/#328/#309/#312, then closing them; sha256 manifest
   gating so user edits survive updates.
4. **Install-verification matrix (`oac doctor --verify`):** per detected tool, verify the
   installed output is *loadable* — OpenCode headless session; CC plugin manifest + agent
   frontmatter validation; agents-md well-formedness. Same checks exposed as a CI matrix.
5. Profile-aware context install (`oac init --profile standard`) — the "install the right
   context" UX, with `additionalPaths` actually copied (a parity *improvement* over
   `install.sh`, which only printed them).

**Tests / gate:**
- **3-OS e2e in CI:** `npm i -g` (packed tarball) → `oac init` → `oac doctor --verify` on
  ubuntu, macOS, **windows-latest** — no Bun present. This workflow replaces
  `installer-checks.yml`'s bash jobs.
- Dependency tests: known graph fixtures incl. wildcards, aliases, cycles, unknown refs
  (hard error), and the 3 previously-dead `/add-context` deps now resolving.
- Update-safety test: hand-edit an installed file → `oac update` preserves it; `--yolo`
  overwrites; `--check` reports drift honestly (the determinism/sha256 interaction from
  `06` G6, specified and tested).
- Uninstall test: `oac remove` leaves no orphans (closes the "clean uninstall" ask, #266).

---

## Stage 6 — Flip source of truth, release & rollback

**Why:** Only after everything upstream is green does deleting the old world become safe.
This stage makes the repo *become its own pitch* — and protects the 4.5k-star install base
from a bad auto-updating release.

**Core features:**
1. Stop committing generated trees; delete `install.sh`, `update.sh`, the bridge script;
   `.opencode/` in-repo becomes build output for dogfooding (and the OAC repo itself runs on
   OAC-installed context — the dogfooding gap closes here).
2. **Release topology:** one version; changesets-style release flow via pnpm; marketplace
   entry regenerated from build; **pinning + rollback documented and tested** before the
   first auto-updating release goes out.
3. README rewrite to the positioning: build-system framing, honest comparison, 5-minute
   quickstart per OS, eval badge.
4. PR/issue triage sweep: close the obsoleted installer PRs with pointers; convert the
   spec's QUICK-WINS list.

**Tests / gate:**
- Fresh clone → `pnpm install && pnpm build && oac build` → **clean `git diff`**.
- Release dry-run: pack → install from tarball → verify matrix green on 3 OSes.
- Rollback drill: publish `x.y.z-rc`, then verify a documented pin/rollback path actually
  restores `x.y.(z-1)` for a CC plugin user and an npm user.

---

## Kill / stop criteria (agreed up front)

- **Stage 3 kill:** if golden tests prove the adapters cannot express the real agents
  without unacceptable loss (security semantics or delegation gone on a first-class target),
  STOP — fall back to OpenCode-as-source + docs-generation. Sunk cost ≈ 1–2 weeks, not 2 months.
- **Stage 4 kill:** if the merge reveals the two agent sets are different *products* rather
  than drifted copies, STOP and pick one tool to be great at.
- **New adapters:** only on demonstrated user demand (N real requests), never because a tool
  exists. Windsurf stays cut until its format is verified against a live install.
- **Done line:** IR frozen at v1, two first-class targets + agents-md, one version number,
  boring releases. After that: content, DX, and users — not more infrastructure.

## Working agreements

- Each stage lands as a stack of small PRs into `refactor/canonical`; the branch merges to
  `main` per stage (each stage is shippable), not as a mega-PR (cf. #298, +19k lines, stalled).
- Tests are written before or with the feature they gate — never after the stage "works."
- Any claim about counts/behavior gets verified against disk before it enters a doc
  (the `06` discipline is now house style).
