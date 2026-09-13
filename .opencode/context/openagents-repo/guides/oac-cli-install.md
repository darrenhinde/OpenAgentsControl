<!-- Context: openagents-repo/guides | Priority: high | Version: 1.0 | Updated: 2026-09-02 -->

# Guide: The `oac` CLI (install, profiles, update)

**Purpose**: How end users install and manage OAC with the npm CLI, and how that connects to the canonical `content/` build maintainers run.

---

## Commands (packages/cli/src/commands)

| Command | What it does | Key flags |
|---------|--------------|-----------|
| `oac init` | Install a profile into `./.opencode/`, write `.oac/manifest.json` and `.oac/config.json`. Requires a `package.json` or `.git` in cwd. | `--profile <id>` (default `essential`), `--context-only`, `--dry-run`, `--yolo`, `--verbose` |
| `oac add <type:id>` | Copy one registry component (and every file in its `files[]`) from the bundle and record it in the manifest. No argument lists what is available. | `--force`, `--dry-run` |
| `oac remove <type:id>` | Delete an installed component and drop it from the manifest. | `--dry-run` |
| `oac update` | Re-copy every OAC-owned file whose on-disk sha256 still matches the manifest; skip files the user changed. Files no longer shipped are left on disk and dropped from the manifest with a warning. | `--check`, `--dry-run`, `--yolo` (overwrite after backing up to `.oac/backups/<timestamp>/`) |
| `oac apply claude` | Generate a `CLAUDE.md` from `.opencode/agent/` (existing file backed up to `.bak`). Claude Code is the only apply target. | `--dry-run` |
| `oac doctor` | Health checks: Node ≥ 20, config, manifest, tracked files present, sha drift, detected tools, npm latest. Exit 0 with OK on a correct fresh install. | `--verbose`, `--json` |
| `oac list` / `oac status` | Manifest contents (flagging locally modified files) / one-screen summary. | `--type`, `--verbose` |
| `oac build` | **Maintainer only.** Regenerate the tool trees from `content/`. Needs the repo, not the npm package. | `--check`, `--dry-run`, `--strict`, `--target` |

All commands are offline except `doctor`'s npm-latest check. Runtime is plain Node; Bun is only used to bundle the CLI.

## Profiles

Two layers, both canonical under `content/profiles/`:

- **Context profiles** (`content/profiles/context/<id>.json`): `{ id, contexts[] }`. Each entry is a registry context id or a directory glob such as `core/*`. Examples: `core`, `essentials`, `engineering`, `business`, `meta-authoring`.
- **System profiles** (`content/profiles/system/<id>.json`): `{ id, agents[], contextProfiles[], commands[], skills[], tools[], plugins[], config[] }`. These are the installable tiers: `essential`, `developer`, `business`, `full`, `advanced`. They name context profiles, never raw context ids.

`oac build` resolves system → context profiles → registry components and emits the result as `registry.json → profiles.<id>.components`, a flat list of `type:id` references. **The CLI reads that generated map**; it never parses `content/` at install time (the npm package does not ship `content/`).

`oac init --profile <id>` resolves each `type:id` in the profile to its registry entry and copies `path` plus `files[]`. `--context-only` keeps only the `context:` references. `--profile full` is the previous "install everything" behaviour.

Adding an agent to a tier means editing the system profile JSON and rebuilding. Every new agent must land in at least one profile or users cannot install it (see `guides/profile-validation.md` for the coverage principle; ignore its registry-editing steps).

## Manifest: how local edits are protected

`.oac/manifest.json` records, per installed file, its sha256 at install time, its kind (agent / context / skill / command / tool / config), and source. `oac update` compares disk to manifest:

| Disk vs manifest | Action |
|------------------|--------|
| Same hash | Overwrite with the new bundled version |
| Different hash | Skip and report; `--yolo` backs up then overwrites |
| Not in bundle any more | Leave on disk, remove from manifest, warn |

`oac init` on a project that already has a manifest takes the same path, so re-running it never clobbers edited files. `oac add` and `oac remove` keep the manifest in sync; `oac list` shows which files differ from install.

## Maintainer loop (repo only)

1. Edit the canonical source: `content/agents/**` (agent markdown with the `oac:` block) or `content/profiles/**`.
2. `make build-canonical` (runs `oac build`). It rewrites `.opencode/agent/**`, the agent/subagent/profile sections of `registry.json`, and the ledger `.oac/build-manifest.json`. The Claude Code agents are staged to `.tmp/oac-build/` and compared, not written in place.
3. Commit the regenerated output together with the source change.
4. CI runs `scripts/validation/check-build-drift.sh`; a hand edit to any generated file turns the build red with instructions pointing back at `content/`.

Still hand-authored (no canonical source yet): `.opencode/context/**`, `.opencode/command/**`, `.opencode/skills/**`, `.opencode/tool/**`, and `.opencode/agent/eval-runner.md`. Register those categories by hand or with the manually dispatched `update-registry` workflow.

## Related

- `standards/agent-frontmatter.md` — what goes in the `oac:` block
- `core-concepts/agent-metadata.md` — build flow from `content/` to registry
- `guides/profile-validation.md` — profile coverage principle
- `docs/architecture/canonical-refactor/04-cli-build-distribution.md` — CLI and build spec
