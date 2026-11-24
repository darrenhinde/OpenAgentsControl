# 1. Direction, and whether `refactor/canonical` is the right approach

Reviewed 2026-10-16 against HEAD `d7924e4` (48 commits ahead of `main`, PR #342). This was a read-only review, and nothing in the repo was changed. Statements tagged **[fact]** were checked against the repo. Statements tagged **[opinion]** are my judgement.

## Verdict: ADJUST. Keep the architecture, shrink the merge, and fix one regression before landing

**North star [opinion]:** *OAC compiles one set of agents, skills and guardrails into whatever each host can actually enforce, and publishes what it could not enforce.* The build is the product, and no single host is. "Control" should mean host permissions and hooks that the build generates, plus evals that show the result. Prompt text alone does not count.

Canonical source with per-host emitters is the right bet. The branch built the hardest part well. It aimed that part at the layer where translation adds the least value, it quietly regressed the Claude Code plugin to make its own gate pass, and it has grown into the mega-PR its own spec said to avoid.

## What the branch actually changes [fact]

- 341 files, +41.0k / −51.1k. `docs/` is +7.8k across 13 spec files in `docs/architecture/canonical-refactor/`. `packages/` is +13.5k / −27.0k (Cursor/Windsurf adapters and `plugin-abilities` deleted in `a23a297` and `cce5255`). `content/`, `.opencode/` and `plugins/` together are +14.7k / −4.0k.
- `content/agents/**` (33 agents) and `content/profiles/**` are the canonical source. `oac build` emits `.opencode/agent/**` and `registry.json` in place, with a hash ledger in `.oac/build-manifest.json` and a CI drift gate (`1a5f1f8`, `33eb6f4`, `scripts/validation/check-build-drift.sh`).
- The permission model is ordered rules, last-match-wins, fail-closed (`packages/compatibility-layer/src/core/Capabilities.ts`, `6966b48`), and the precedence was confirmed against a live host (`10-PRECEDENCE-EXPERIMENT.md`).
- `BUILD_TARGETS = ["opencode", "claude-code"]` (`BuildPipeline.ts:77`). The Claude target is staged to `.tmp/oac-build/` and only compared (`packages/cli/src/commands/build.ts`).
- Other changes: pnpm migration (`2dba195`), `@controlstack` scope (`597fa75`), Node-only runtime (`8581a42`), version reconciled to 1.1.0 (`5881767`), tiered/profile installs and doctor (`73400e2`, `0b84561`).
- `main` has **0 commits** since the merge base (2026-07-15), and GitHub reports the PR as `MERGEABLE`. Textual merge risk is nil. The risk is behavioural.

## A finding the audit missed: the Claude "parity" was reached by regressing the shipped agents [fact]

The audit notes that the staged Claude output is "identical" to the committed tree and could not tell whether that was intended. The cause is commit `104356a` ("fix(content): carry the protected-paths advisory in the canonical coder-agent"). That commit also rewrote **all 7** `plugins/claude-code/agents/*.md` files (+1,558 / −2,204) into canonical-derived, OpenCode-shaped bodies. The diff against `main` shows what was lost:

- **Dispatch examples are gone.** `main:plugins/claude-code/agents/coder-agent.md` has 2 `<example>` blocks, and code-reviewer has 2. On the branch, 6 of the 7 agents have none. Claude Code uses those examples to *select* an agent.
- **Some instructions now can't be followed.** The branch's `code-reviewer.md` has `disallowedTools: …, Task` but says "ALWAYS call ContextScout BEFORE reviewing any code". `main` said context was "pre-loaded by the main agent".
- **OpenCode paths leaked into the Claude plugin.** The 7 Claude agents now contain 42 `.opencode/` references, and code-reviewer had 0 on `main`.

This is exactly the outcome the `build.ts` header warns against ("a rebuild would silently destroy" them). The emitter was never switched on. The emitter's output was copied in by hand instead. The marketplace plugin is served from `./plugins/claude-code` on the default branch, so merging as-is ships this regression straight to Claude Code users, who are 65.5% of agent users according to the report. **This blocks the merge.**

It also bears on the memory note's deferred decision #1 and on Stage 4's kill criterion in `07-EXECUTION-PLAN.md`: "if the two agent sets are different *products*… pick one tool". **[opinion]** The evidence says the Claude agents are a different product. They have different dispatch descriptions, different delegation abilities and different permission semantics. Trying to generate them from OpenCode-shaped bodies is the wrong goal.

## Judged against the market (report findings)

**What the branch gets right [opinion, grounded in the report]**
- **The bet is right.** Subagent frontmatter and permissions are the one layer hosts have *not* converged on: Claude camelCase, OpenCode `permission`, Codex TOML, Gemini snake_case, Cursor `readonly`. A translator with explicit, fail-closed degradation is defensible. wshobson/agents shows people want it (7 harnesses).
- **The model is ready for OpenCode v2.** v2 turns permissions into an ordered array, and `Capabilities.ts` is already an ordered rule list. Of everything in the report's "Now" list, the v2 port (#349, #362, #367) is cheapest on this branch, and the timing is good because oh-my-opencode has left OpenCode.
- **Determinism, ledger-gated pruning, the drift gate, the Node-only CLI and one version number** are the hygiene a credible release needs. Deleting Cursor and Windsurf was correct, because Cursor reads `.claude/agents/` anyway.

**What it's missing**
- **Skills and commands aren't canonical [fact].** `content/` holds only `agents/` and `profiles/`. The 12 Claude skills and the OpenCode skills are hand-maintained across three directories. Skills are the portable unit (40+ clients), and hosts are folding commands into skills. **[opinion]** Skills need little *translation*, since the spec is shared. They do need *placement* (`.agents/skills`, plugin layout), keeping host-specific keys under `metadata`, and deduplication. That is cheap and has high value, and the branch hasn't done it.
- **No AGENTS.md target [fact].** `07-EXECUTION-PLAN.md` lists a "cheap `agents-md` target" as v1 first-class. It was never built, and `oac apply` still writes a single-agent `CLAUDE.md`.
- **No enforcement emission.** The memory note says "there is no correct emission" for scoped rules on Claude, which is true for `tools:` frontmatter. **[opinion]** The answer the report points to is to compile scoped rules into **plugin PreToolUse hooks** (path-glob deny for `.env`, keys, `.git` and out-of-scope edits). That would replace `RECOMMENDED-PERMISSIONS.md`. *Verify* that hook input identifies the calling subagent, or use subagent-scoped hooks if the host supports them, before relying on per-agent scoping.
- **Two hosts, and only one is actually generated.** No Codex TOML target. Codex is the fastest-rising host.

**What is over-engineered or premature [opinion]**
- **13 spec documents (+7.8k lines) and a 671-line `CapabilityMatrix.ts`** with a FIXME for "a concept that does not exist" (`:319`). That is a lot of process for a solo maintainer with 8.5 months of no releases.
- **Per-target `oac.overrides.claude-code` for agent bodies.** Extending overrides to prompts and descriptions would make canonical files carry two products in one file. It is better to let Claude agents be hand-authored, thin and skill-first, and to generate only what translates mechanically.
- **Scope creep inside one PR.** Locked decision #4 in `00-INDEX.md` says "Avoid another stalled mega-PR (cf. #298, +19k lines)". This PR is +41k, mixes a toolchain migration, a package rename, a version jump, content rewrites and the build system, and includes a commit titled " save point" (`95a45b6`).

## Sequence to land it

**Before merge (blocking, about a week):**
1. **Restore the 7 Claude agents to `main`'s hand-authored versions.** Keep only the protected-paths advisory from `8e12c63`, then re-apply the `5c7d4cc` sidecar-text removal. Leave Claude staged and compare-only, and say so honestly: correct the stale `build.ts` header (it says "all 7 would change"), and turn the skipped golden test into an explicit "Claude agents are hand-authored; staged diff is informational" assertion.
2. **Push `a4c8ab3` and `d7924e4`, and get every PR #342 check green.**
3. **Make the install story true at merge time.** Either publish `@controlstack/oac` in the same release or point the README at a path that works. Remove `/oac:setup`, `/oac:plan`, the dead doc links and the unmeasured "80%" and "<200 lines" claims.
4. **Smoke-test a fresh Claude marketplace install** (`claude plugin validate`, plus loading one agent and one skill), because #281 is the cheapest channel and the one this merge touches.
5. **Write CHANGELOG 1.0/1.1 entries, merge, tag v1.1.0, deprecate `@nextsystems/oac`, and close the v0.7.2 bump PRs #333, #335 and #337.**

**Follow-ups (each as its own small PR, in order):**
1. **OpenCode v2 emitter** (ordered arrays, #349, #362, #367). Release it as v1.2, "v2-native".
2. **Canonical skills.** Move them to `content/skills/`, emit spec-compliant SKILL.md to `.agents/skills` and the plugin, collapse the three skill directories, and convert commands to skills.
3. **Enforcement-as-hooks emitter for Claude.** It replaces `RECOMMENDED-PERMISSIONS.md` and gates on risk, not on every step.
4. **AGENTS.md emitter**, then **Codex TOML**, with a published per-host capability/degradation matrix.
5. **Stage 6**: delete `install.sh`, `update.sh`, `integrations/claude-code` and the third profile vocabulary, and stop committing generated trees.
6. **Outcome-graded evals** across both hosts before any number goes in the README.

**Stop doing [opinion]:** no more spec documents until v1.1.0 is tagged, no attempt to generate Claude agent prompts, and no new adapter without user demand. That last point is the plan's own "done line" in `07-EXECUTION-PLAN.md`: "After that: content, DX, and users — not more infrastructure."
