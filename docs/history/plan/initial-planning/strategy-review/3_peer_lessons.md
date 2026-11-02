# 3. Peer lessons for the canonical build

**Question.** Given the `refactor/canonical` branch and how peer repos solve the same problem, what else should OAC do to get the most out of the canonical build?

**Labels.** **[F]** marks a fact checked in a peer's repo or docs, or in OAC code at `d7924e4`. **[O]** marks my opinion or recommendation. Effort is S (under 2 days), M (about 1 week) or L (2 weeks or more).

## Where the branch stands [F]

- **Source:** 34 canonical agents under `content/agents/**` and 10 profiles under `content/profiles/{system,context}`. Skills, commands, hooks and context are not canonical. Skills live in three trees: `plugins/claude-code/skills` (12), `.opencode/skills` (4) and `.opencode/skill` (2).
- **Build:** `BuildPipeline.plan/write/check` is pure and deterministic, and it prunes only what the manifest says it wrote (`packages/compatibility-layer/src/core/BuildPipeline.ts`).
  - It emits `.opencode/agent/**` and `registry.json`.
  - Claude output is only staged to `.tmp/oac-build/` and compared (`packages/cli/src/commands/build.ts:35-55`).
- **Targets:** `BuildTargetSchema` has two values, `opencode` and `claude-code` (`types.ts:385`). Each agent opts in through `oac.targets`, which defaults to `["opencode"]`.
- **Permissions:** the last-match-wins resolver with fail-closed projection is the real asset (`core/Capabilities.ts`). It mirrors OpenCode's `findLast` semantics and was confirmed by a live experiment (`docs/architecture/canonical-refactor/10-PRECEDENCE-EXPERIMENT.md`). Per-target `oac.overrides` make losses authored and auditable.
- **Capability matrix:** `core/CapabilityMatrix.ts` (671 lines) is a TypeScript table covering `oac | claude | opencode`. It is not published anywhere, and it still has the FIXME at line 319.
- **Adapters:** `BaseAdapter` is two-way (`toOAC` and `fromOAC`). `ClaudeAdapter.ts` alone is 749 lines, plus about 1,370 lines of mappers.
- **Install:** the CLI does tiered install, sha256-tracked files, `doctor`, and `update` that preserves local edits (`packages/cli/src/lib/manifest.ts`, `commands/doctor.ts`).

## What peers do, and how it maps onto OAC

### A. Canonical schema: make skills and commands first-class, and drop commands as an output type

- **Peers [F]:** every breakout repo treats skills as the portable unit.
  - The [Agent Skills spec](https://agentskills.io/specification) requires `name` (64 chars max, lowercase-hyphen, must match the directory) and `description` (1024 chars max). It allows `license`, `compatibility`, `metadata` (string→string) and `allowed-tools` (experimental). It recommends a body under 500 lines / 5k tokens, with `scripts/`, `references/` and `assets/` alongside.
  - spec-kit's `SkillsIntegration` writes `speckit-<name>/SKILL.md` and turns commands into skills. wshobson does the same for Copilot and Pi ([harnesses.md](https://github.com/wshobson/agents/blob/main/docs/harnesses.md)).
- **OAC mapping [O]:**
  - Add `content/skills/<name>/SKILL.md` as the canonical home, and put OAC-only keys under `metadata.oac-*` so the source itself passes the spec.
  - Add a `CanonicalSkillLoader` next to `core/AgentLoader.ts`, and add `skill` to the plan's `BuildFile.target` or kind.
  - Commands become skills (a `user-invocable` flag in metadata). Hooks become a canonical type, `content/hooks/*.yaml`. `HookEventSchema` already exists at `types.ts:282` but nothing emits it.
- **Effort:** M. **Impact:** very high. Skills are the format 40+ clients read, and the build currently skips them.

### B. Emitter architecture: host descriptors as data, adapters as thin code

- **Peers [F]:**
  - gstack: adding a host is "one TypeScript config file". `defineHost({name, displayName, …})` carries `frontmatter.descriptionLimit`, `renameFields`, `pathRewrites`, `toolRewrites`, `tier` and `capabilities`. Generator, setup, uninstall and tests all read the same configs, so "none needs per-host code" ([ADDING_A_HOST.md](https://github.com/garrytan/gstack/blob/main/docs/ADDING_A_HOST.md)).
  - spec-kit: a Markdown or TOML integration is "set three class attrs, done", with format base classes `MarkdownIntegration`, `TomlIntegration`, `YamlIntegration` and `SkillsIntegration` ([base.py](https://github.com/github/spec-kit/blob/main/src/specify_cli/integrations/base.py)). It supports 40+ agent directories.
  - wshobson: one `Capability` dataclass per harness (`skill_body_max_bytes`, `tool_name_case`, `context_file_name`, `hooks`, …) plus `TOOL_NAME_MAPS` and `MODEL_ALIASES`. Adapters, the docs generator and plugin-eval all consume it ([capabilities.py](https://github.com/wshobson/agents/blob/main/tools/adapters/capabilities.py)).
- **OAC mapping [O]:** split each adapter into two parts.
  - A `HostDescriptor` record in a new `packages/compatibility-layer/src/hosts/<host>.ts`, holding paths, tool-name map, model aliases, size caps, permission model (`ordered-globs | binary | sandbox-mode | none`) and tier.
  - A small set of format emitters (`markdown-frontmatter`, `toml`, `skill-dir`, `agents-md`) under `src/emitters/`.
  - `CapabilityMatrix.ts` should then be derived from the descriptors rather than hand-written. Keep `Capabilities.ts` as the one resolver.
  - Make `BuildTargetSchema` come from the descriptor registry.
  - Flip the per-agent `targets:` default to "all hosts in the profile, minus `oac.exclude`". Today every new host needs edits to 34 files.
- **Hosts to add, cheapest first [F/O]:**
  - `.agents/skills` (skills only, read by OpenCode, Codex, Cursor and others).
  - Codex TOML agents plus `.codex-plugin`.
  - AGENTS.md.
  - Cursor (it reads `.claude/agents`).
- **Effort:** M–L. **Impact:** high. This is what makes host #3 to #7 cost S each.

### C. Publish the capability and degradation matrix

- **Peers [F]:**
  - wshobson publishes three tables in `docs/harnesses.md`: harness status, capability × harness, and source pattern × harness degradation (for example "`tools:` dropped; heuristic `sandbox_mode = "read-only"`" for Codex).
  - gstack labels hosts `full`, `experimental` or `instruction-only`.
- **OAC mapping [O]:** generate `docs/compatibility/matrix.md` from the descriptors.
  - Add a per-agent loss report built from `BuildWarning[]`, for example "coder-agent on claude-code: edit globs widened (authored override)".
  - Have `oac build --check` fail if the doc is stale.
  - This replaces the hand-written root `COMPATIBILITY.md` and turns the Claude "no correct emission" blocker into a published, honest row.
- **Effort:** S once B exists. **Impact:** high for trust.

### D. Golden, snapshot and real-CLI round-trip tests per host

- **Peers [F]:**
  - wshobson's `round-trip-results.md` loads the generated output into each real CLI: all 191 subagents discovered by OpenCode 1.1.23, `codex doctor` clean, all 191 TOML files parsed, and `gh skill publish --dry-run` plus `npx skills` discovery run in CI via `make smoke-test`. The real-CLI runs caught three bugs that unit tests missed. One was "OpenCode permission blocks denied everything when tools were MCP-only or empty", the same class of bug as OAC's #349.
  - gstack's `test/host-conformance.test.ts` installs every host into a temp HOME. It checks discovery, cross-host leakage, duplicates and upgrade from the previous layout.
- **OAC mapping [O]:**
  - Un-skip `tests/golden/golden-files.test.ts`.
  - Add a snapshot per (fixture × host) under `tests/golden/expected/<host>/`.
  - Add a `host-smoke` CI job that installs real `opencode`, `claude` (`claude plugin validate --strict`), `codex` and `skills-ref validate`, then asserts discovery.
  - Add an "upgrade from v0.7.x layout" case to `packages/cli/src/__tests__/seamless-install.e2e.test.ts`.
- **Effort:** M. **Impact:** high. Byte-equality tests prove determinism. Only a host round-trip proves the output actually loads.

### E. Marketplace manifests and versioning

- **Peers [F]:**
  - Superpowers ships one `skills/` directory plus per-host manifest folders: `.claude-plugin`, `.codex-plugin`, `.cursor-plugin`, `.opencode`, `.agents/plugins`, `.pi/extensions` and `gemini-extension.json`.
  - Its `.version-bump.json` lists 12 `{path, field}` version sites that `scripts/bump-version.sh` keeps in sync, with an audit exclude list ([file](https://github.com/obra/superpowers/blob/main/.version-bump.json)).
  - wshobson generates `.agents/plugins/marketplace.json` and `.cursor-plugin/marketplace.json`, and pins external entries by `sha`.
  - Claude marketplaces support `ref`/`sha` pinning and `claude plugin validate` ([docs](https://code.claude.com/docs/en/plugin-marketplaces)).
  - BMAD keeps a frozen stable line (v6.12) beside a v7 preview channel.
- **OAC mapping [O]:**
  - Make every manifest a build output: `.claude-plugin/marketplace.json`, `plugins/claude-code/.claude-plugin/plugin.json`, and new `.codex-plugin/plugin.json` and `.agents/plugins/marketplace.json`.
  - Derive them all from `VERSION` in `RegistryEmitter`'s sibling. OAC already has 1.1.0 duplicated by hand in `marketplace.json` and `plugin.json`.
  - Add a `stable` and `next` marketplace split (two entries or two refs).
- **Effort:** S–M. **Impact:** high. Distribution is how every breakout grew.

### F. Bootstrap without coercion

- **Peers [F]:**
  - Superpowers' SessionStart hook uses `matcher: "startup|clear|compact"`, so it reinjects after compaction ([hooks.json](https://github.com/obra/superpowers/blob/main/hooks/hooks.json)). On hosts without hooks it falls back to skill descriptions.
  - Superpowers' own `using-superpowers` is still coercive ("you ABSOLUTELY MUST… not negotiable"), so OAC copied a pattern rather than a proven practice.
  - Superpowers does add a `<SUBAGENT-STOP>` carve-out so subagents ignore the bootstrap.
- **OAC mapping [O]:**
  - `plugins/claude-code/hooks/hooks.json` has no matcher. Add `startup|clear|compact`.
  - Add the subagent carve-out to `using-oac`.
  - Shrink the injected payload to a catalogue of skill descriptions. `session-start.sh` already builds one, so the full `using-oac` body should load on demand, phrased as "use X when Y".
  - Make the bootstrap a canonical hook, so emitters render it as a SessionStart hook, an OpenCode plugin, or AGENTS.md text depending on the host.
- **Effort:** S. **Impact:** medium-high. Fewer tokens and fewer over-triggers.

### G. Eval harness integration

- **Peers [F]:**
  - wshobson's `plugin-eval` scores skills statically and includes a `harness_portability` dimension fed by the same capability data. It labels its LLM-judge layer "not validated against human labels".
  - gstack only certifies a host as `full` after one real workflow run, recorded as a dated row with host and gstack versions.
  - Superpowers keeps behavior evals in a separate `superpowers-evals` repo.
- **OAC mapping [O]:**
  - Make `oac build` emit an eval fixture per host (agent plus permissions) that `evals/framework` consumes, so evals test the generated artifact and not a hand-swapped prompt. The `eval-runner.md` swap incident is a symptom of that.
  - Add a static `oac lint` (spec limits, body size per host cap, dead `@references` via `ReferenceResolver`) to `packages/cli/src/commands/`.
  - Gate a host's `tier: full` on a recorded eval run.
- **Effort:** M (lint), L (outcome evals). **Impact:** high. It is the "proven" claim.

### H. Registry integrity and signing

- **Peers [F]:**
  - spec-kit catalogs carry `sha256` per release and enforce HTTPS. Exact-version installs verify the archive's id and version before modifying anything, and catalogs default to discovery-only (`install_allowed`) ([presets.md](https://github.com/github/spec-kit/blob/main/docs/reference/presets.md)).
  - I found no standard skill-signing scheme. npm provenance (Sigstore) is the nearest mainstream mechanism, and smithmark is a third-party skill-attestation experiment ([smithmark](https://github.com/sns45/smithmark)).
- **OAC mapping [O]:**
  - `RegistryEmitter.ts` should write a `sha256` per component, and `oac add/update` should verify it. The CLI already hashes installed files in `lib/sha256.ts`, so it only needs to verify before writing.
  - Publish `@controlstack/oac` with `npm publish --provenance` from CI.
  - Pin `install-context.ts` sparse clones to a tag or commit.
- **Effort:** S–M. **Impact:** medium, and high for teams.

### I. Docs generated from the canonical source

- **Peers [F]:** wshobson renders `docs/harnesses.md` from `capabilities.py` notes, and CI fails on drift. gstack's `skill:check` validates freshness.
- **OAC mapping [O]:**
  - Generate `docs/agents/*.md`, the README component counts and the profile tables from `content/` and `content/profiles/`.
  - Add them to `scripts/validation/check-build-drift.sh`.
  - This directly prevents the stale README claims flagged in the landscape report ("9 skills" when there are 12, and commands that do not exist).
- **Effort:** S. **Impact:** medium-high.

### J. Contributor DX and team installs

- **Peers [F]:**
  - gstack has a six-step "add a host" doc with named tests, and `./setup --team` plus `gstack-team-init required|optional`, so teammates are blocked or nudged.
  - spec-kit has `specify preset resolve <name>` to show which layer wins.
  - BMAD's `bmad setup` removes skills that were renamed or deleted.
- **OAC mapping [O]:**
  - Add `docs/contributing/ADDING_A_HOST.md` and `ADDING_A_SKILL.md`.
  - Add `oac new skill|agent` scaffolds.
  - Add `oac explain <agent> --host <h>`, which prints the resolved permissions and losses using `Capabilities.ts`. That is a unique differentiator.
  - Add an `oac init --team required` that writes the profile to `.oac/config` and a doctor check for teammates.
  - `oac update` should remove renamed components. The manifest ledger already makes that safe.
- **Effort:** M. **Impact:** medium.

### K. Lessons write-back and presets (beyond the build) [F → O]

- **Peers [F]:**
  - Compound Engineering's `/ce-compound` writes learnings to `docs/solutions/`, which the next `/ce-plan` reads, with the location set by `docs_root` ([README](https://github.com/EveryInc/compound-engineering-plugin)).
  - spec-kit presets resolve in this order: project override, then presets by priority (lower number wins), then extensions, then core. Strategies are `replace`, `prepend`, `append` and `wrap`.
- **OAC mapping [O]:**
  - Model profiles as layered overlays with the same strategies over `content/`. An org preset could append a security rule to `coder-agent` without forking it.
  - Ship a canonical `capture-lessons` skill that writes to `.oac/context/project/lessons/`.
- **Effort:** M each. **Impact:** medium-high for the "made for teams" claim.

## Dead ends and simplifications

1. **Two-way adapters (`toOAC`) [F→O].**
   - Fact: `a23a297` removed the `oac-compat` conversion CLI, but `BaseAdapter` still requires `toOAC`, and parts of `mappers/*` (about 1,370 lines) serve imports.
   - Opinion: every peer here is one-way, from one source to many targets. Delete the import path and keep only `fromCanonical`.
2. **A hand-written `CapabilityMatrix.ts` beside `Capabilities.ts` [F].** Two sources of truth caused the drift recorded in its own header (OpenCode was missing until 2026-07-15). [O] Derive it from host descriptors, then delete the FIXME row.
3. **Per-agent `targets:` opt-in [O].** wshobson and gstack emit everything to every host and let the descriptor degrade it. Opt-in per agent does not scale past two hosts.
4. **Generating Claude subagents for agents that rely on scoped permissions [O].** wshobson simply drops `tools:` where a host cannot honor it, and documents that it does. For OAC, keep generation and make `oac.overrides` the only path. Move enforcement into generated PreToolUse hooks, emitted from the canonical deny globs, rather than prompt text or `RECOMMENDED-PERMISSIONS.md`. That turns the deferred blocker into a feature.
5. **Committing every generated tree [O].** gstack and wshobson gitignore per-host renders, except marketplace manifests that hosts must fetch from git. Commit only what a marketplace install reads (`plugins/claude-code/**` and the manifests), and generate `.opencode/` at install time. This cuts diff noise and drift-gate churn.
6. **The coercive `using-oac` copied from Superpowers [F].** The source pattern is itself coercive. Don't treat it as best practice.

## Top 10 to do, ranked

1. **Canonical skills.** Add `content/skills/` with spec-compliant SKILL.md, a skill loader, an emitter to `.agents/skills`, `.opencode/skills` and `plugins/claude-code/skills`, and `skills-ref validate` in CI. Collapse the three skill trees into one. (M; A)
2. **Host descriptors.** Refactor to `src/hosts/*.ts` descriptors plus format emitters, derive `BuildTargetSchema` and `CapabilityMatrix` from them, and drop `toOAC`. (M–L; B, dead ends 1–3)
3. **Real-CLI round-trip CI.** Run `host-smoke` with real `opencode`, `claude plugin validate`, `codex` and `skills-ref` discovery, un-skip the golden test, and add per-host snapshots. (M; D)
4. **Published matrix.** Generate `docs/compatibility/matrix.md` and per-agent loss reports from build warnings, and fail `--check` when they are stale. (S; C)
5. **Generated manifests.** Build every marketplace and plugin manifest from `VERSION`, add Codex `.codex-plugin` and `.agents/plugins/marketplace.json`, and add stable/next channels. (S–M; E)
6. **Enforcement hooks.** Turn the canonical deny globs into generated Claude PreToolUse hooks, which resolves the "no correct emission" blocker by mechanism. (M; dead end 4)
7. **Bootstrap fix.** Add the `startup|clear|compact` matcher, the subagent carve-out, and a description-only catalogue, and make bootstrap a canonical hook type. (S; F)
8. **Codex TOML and AGENTS.md emitters,** with byte-budget splitting into `references/` (8 KB for skills, 32 KiB for AGENTS.md). (M; B)
9. **Registry integrity.** Per-component `sha256` in `registry.json` verified by `oac add/update`, `npm publish --provenance`, and pinned context clones. (S–M; H)
10. **Generated docs and contributor DX.** Docs and README counts generated from `content/`, `oac explain <agent> --host`, `oac lint`, `ADDING_A_HOST.md`, and eval fixtures emitted by the build. (M; G, I, J)

Profiles as layered presets and lessons write-back (K) should come right after this list, once the build covers skills.
