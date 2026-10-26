# The conversion engine

One canonical source (`content/agents/**`), one engine (`packages/compatibility-layer`), one build command (`oac build`) — every AI tool's copy of the agents is generated from that single input. This page is the plain-English inventory of what the engine manages today: what an author writes, what the engine converts, what it refuses to lose silently, and what it does not manage (yet).

Verified 2026-10-23: drift gate clean (34 agents → 117 files, 0 written / 0 changed), 754 unit tests + 13 golden tests green.

## The one-sentence model

> You edit one file per agent; the engine derives every host's copy from it, records anything a host cannot express as a warning instead of losing it silently, and a git-diff gate proves the output never drifts from the source.

```
content/agents/**            ← the ONLY thing you edit
        │
        ▼
packages/compatibility-layer (oac build)
  AgentLoader → mappers (permission / tool / model / context) → one adapter per host
        │
        ▼
hosts/opencode/        hosts/opencode-v1/        hosts/claude-code/
  + byte-identical mirrors: .opencode/agent/ · plugins/claude-code/agents/
  + registry.json · registry.v1.json · hosts/README.md · .oac/build-manifest.json
```

## What an author writes (the canonical format)

One Markdown file per agent in `content/agents/**`, containing exactly three authoring layers:

| Layer | Syntax | Purpose |
|---|---|---|
| Base frontmatter | `description`, `mode`, `temperature`, `permission:` (ordered allow/deny rules per capability) | The agent itself, written against the neutral capability model |
| Neutral metadata | `oac:` block — `id`, `name`, `category`, `type`, `version`, `tags`, `dependencies`, and **shipping scope**: omit `targets:` to ship to *every* build target minus `exclude`, or list `targets:` explicitly (today's only exception: the v1-only agent) | Identity and shipping scope; never emitted to any host |
| Per-host adjustments | `oac.overrides.<host>` (frontmatter fields) and `<!-- oac:only <host> -->…<!-- /oac:only -->` (body text) | Host-specific differences live in the same file, visibly, not in a fork |

Key details:

- **`permission:` is an ordered rule list** (last match wins) per capability — this was decided in the spec (`00-INDEX.md`, decision #5) after the flat model was proven lossy: it cannot express `coder-agent`'s deny-all-then-allowlist or the `**/*.env*` / `**/*.key` security globs.
- **`oac.id` is the one true name.** Per-host file names and delegation references are resolved per target (`AgentIdResolver` + `DelegationRewriter`), e.g. `contextscout` → `context-scout.md` on Claude Code while every `task(contextscout)` reference in its body is rewritten to match.
- **Shipping is opt-out** (2026-10-23 flip). Omitted `targets:` = every build target minus `oac.exclude`; explicit `targets:` wins for exceptions; `exclude` is a *filter* on `targets` — an entry naming a host the list already omits is a parse error, as is an override for a host the agent doesn't effectively ship to. Adding host #4 therefore costs the corpus **zero edits** (absent a host whose agents each require authored overrides, as claude-code does) — the build degrades what the new host cannot express, and agents that must not ship there declare `exclude`. Validated: the 33-file migration to opt-out produced byte-identical build output.
- **The `oac:` block is authoring-only** — a golden test keeps it out of every emitted file.

## What the engine manages (targets × features)

| Target | Output layout | Frontmatter it emits | What carries over fully | Known degradations |
|---|---|---|---|---|
| `opencode` (v2, default) | flat `agent/<id>.md` | `description`, `mode`, `temperature`, `permission:` | everything — 0 warnings | none |
| `opencode-v1` (legacy, on request) | nested `agent/<category>/<file>.md` | adds back `name:` | everything — 0 warnings | none |
| `claude-code` | flat `agents/<name>.md` | `name`, `description` (with `<example>` dispatch blocks), authored `tools` / `disallowedTools` | body text via `oac:only`, tools via authored override | 8 warnings: per-glob `permission:` rules and `temperature` have no Claude Code equivalent |

The engine also emits, from the same input and under the same determinism rules: `registry.json` / `registry.v1.json` (what installers read), the generated `hosts/README.md` index, and `.oac/build-manifest.json` (the write ledger).

## What the engine refuses to lose silently

1. **Degradation warnings, fail-closed.** Anything a host cannot express is reported per agent (e.g. "Permission 'skill' has no Claude Code tool: 2 rule(s) dropped"). Never fatal unless `oac build --strict`.
2. **Dead references.** Delegation references to agents that don't exist on a target are resolved or reported (0 across the current corpus).
3. **Silent widening is called out in content.** Where a host cannot enforce a deny glob (Claude Code `edit` is on/off), the override in the canonical file documents the widening and the compensating controls — see the `coder-agent` override comment.

## The guarantees (why the output can be trusted)

- **Deterministic.** Everything ordered by content: agents sorted by `oac.id`, targets in a declared literal order, plan sorted by path. No clock, host path, or `readdir` order reaches output. `oac build && git diff --exit-code` is the drift gate (`make check-canonical-drift`), the same gate CI runs.
- **Honest `--check` / `--dry-run`.** Plan and write are separate; they run the identical code path and stop before writing — a check that re-implemented the build would eventually disagree with it.
- **Manifest-gated pruning.** The build deletes only files it previously wrote (ledger: `.oac/build-manifest.json`). Hand-maintained files (e.g. v1-only skills, tools, plugins) are never touched.
- **Golden corpus.** 13 tests pin adapter behaviour: fixture goldens per target, tool-list ordering, fail-closed deny semantics, and committed-output-equals-build-output byte-for-byte.

## What it does NOT manage (yet)

The engine canonicalises **agents only**. Skills, commands, hooks, and plugins are still hand-maintained per host (`hosts/opencode-v1/` and `plugins/claude-code/` hold hand-authored copies). Also not built: Codex, AGENTS.md, and Cursor emitters (Cursor/Windsurf were dropped as targets in 2026-09). The effort-ranked path for these — descriptor-based emitters, opt-out `targets:` default (done 2026-10-23), generated capability matrix, Codex TOML + AGENTS.md — is in `research_notes/OAC strategy review/3_peer_lessons.md`.

## Where to look

| Thing | File |
|---|---|
| Engine + build library | `packages/compatibility-layer/` (`README.md`, `src/core/BuildPipeline.ts`) |
| CLI entry | `packages/cli/src/commands/build.ts` |
| Canonical spec | `docs/architecture/canonical-refactor/02-canonical-schema.md` |
| Per-adapter spec | `docs/architecture/canonical-refactor/03-adapter-specs.md` |
| OpenCode v1 vs v2 | `docs/features/opencode-v1-and-v2.md` |
| Generated host index | `hosts/README.md` (never hand-edit) |
| Why this exists | D-017 in `docs/lessons-learnt/decisions.md` |
