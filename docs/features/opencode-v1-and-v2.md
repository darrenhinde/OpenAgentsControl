# OpenCode v2 by default, v1 on request

`oac build` compiles `content/agents/**` for two OpenCode majors (D-016). v2 is the default everywhere; v1 is an explicit opt-in and is deleted as one unit when its support window ends.

## What gets built

| Target | Output in this repo | Installed to a project as |
|---|---|---|
| `opencode` (v2, default) | `hosts/opencode/agent/<oac.id>.md`, mirrored to `.opencode/agent/<oac.id>.md`; `registry.json` | `.opencode/agent/<oac.id>.md` |
| `opencode-v1` | `hosts/opencode-v1/agent/<category>/<file>.md`, `registry.v1.json` | `.opencode/agent/<category>/<file>.md` |
| `claude-code` | `hosts/claude-code/agents/<name>.md`, mirrored to `plugins/claude-code/agents/<name>.md` | the Claude Code plugin (`plugins/claude-code`) |

`hosts/` holds every target's build side by side, so the formats can be compared (D-018; `hosts/README.md` is the generated index). The live paths `.opencode/agent/` (this repo's own OpenCode, and the paths in `registry.json`) and `plugins/claude-code/agents/` (the marketplace source) are byte-identical generated mirrors: the build writes, prunes and drift-checks them with their `hosts/` folder, and a hand edit to either is drift.

`hosts/opencode-v1/` (formerly `v1-opencode/`) is a **display and source folder only**. It has no live mirror; `registry.v1.json` points into it. An install writes its contents into the user's `.opencode/`; the name never appears in a project. It also holds everything v2 cannot load: `tool/`, `plugin/`, `plugins/`, and v1 variants of the two hand-authored files whose delegation examples differ (`command/openagents/check-context-deps.md`, `skills/task-management/SKILL.md`).

`opencode-v1` is a build-level sibling of `opencode`: an agent that declares `opencode` is emitted for both. Declaring `opencode-v1` alone makes an agent v1-only (`image-specialist`).

## Why the outputs differ

| | v1 | v2 |
|---|---|---|
| Agent id | frontmatter `name:` (config.ts:337-343) | the file name (V2SRC `config/plugin/agent.ts`); `name:` is ignored |
| `task:` permission key | the `subagent_type` string, matched case-sensitively | the agent id |
| Delegation call | `task(subagent_type="Name", ...)` | `subagent(agent="id", ...)` |
| Custom tools | `.opencode/tool/*.ts` | not scanned (no replacement short of a v2 plugin, #367) |
| Plugins | `@opencode-ai/plugin` | do not run (`@opencode/plugin` API) |

The build resolves every reference through one `AgentIdResolver` (oac id, display name or case variant) into the id space of the target:

- `permission.task` keys are written as `oac.id` in the canonical source. v1 gets the agent's `name:`, v2 gets its id.
- `subagent_type` values and `task(` examples are rewritten; plain prose that mentions an agent by name is left alone.
- An unresolvable reference fails the build.

**Behaviour change for v1.** 31 of the 33 canonical `task:` keys were lowercase (`contextscout`) while v1 matches against the registered `name:` (`ContextScout`) case-sensitively, so those allow rules likely never fired. The v1 output now writes the exact name. This is deliberate, and the v1 snapshot reflects it.

## Choosing a version

```bash
oac init                      # v2 (default)
oac init --opencode v1        # explicit v1 opt-in
oac update --opencode v1|v2   # switch, or record the choice on an older install
install.sh essential --opencode v1     # or OAC_OPENCODE=v1
```

- The choice is recorded in `.oac/config.json` (`"opencode": {"target": "v1"}`) by the CLI, and in `.opencode/.oac-opencode` by the shell scripts. `add` and `update` keep it.
- v1 is never inferred from the host. A v1 host without the flag gets v2 plus a warning.
- `oac doctor` errors when the recorded version does not match `opencode --version`, in both directions.
- Installs from before this release have no record. `oac update` on such an install:
  - with OpenCode v1 on PATH: refuses, changes nothing, and prints both ways forward (`--opencode v1` records the choice; upgrade OpenCode and `--opencode v2` migrates);
  - otherwise migrates to v2: OAC-owned v1-only files (nested agents, tools, plugins) are removed, files you edited are copied to `.oac/backups/` first, and files OAC did not install are never touched.
- `install.sh` never deletes files; over nested agents from an earlier install it warns that OpenCode v2 would load both.

## Known v2 gaps

These exist only on v1 until ported (#367). Nothing about v2 pretends otherwise.

- `image-specialist` and the `gemini` / `env` tools (no v2 equivalent without a plugin rewrite).
- The dev plugins `agent-validator`, `notify` and `coder-verification` (also no longer loaded when working in this repo, whose own `.opencode/` is v2).
- Context documents under `.opencode/context/` and `.opencode/prompts/` still show v1 delegation syntax in examples. They are documentation, not prompts the agents execute, and are not rewritten per target.
- `temperature` is preserved but not sent by v2.
- `check-context-deps` delegates to `PatternAnalyst`, which exists on neither host. Pre-existing; decision pending.
- `evals/framework` is a v1 SDK harness and still expects the nested layout.

## Verifying v1

The pinned host harness (`evals/v2`) can only run OpenCode v2.0.30, so v1 gets layered evidence. Be clear about what each layer proves.

| Check | Proves | Runs |
|---|---|---|
| Byte snapshots of `hosts/opencode-v1/**`, drift gate | the v1 build is what the source says | CI (`make check-canonical-drift`, compatibility-layer tests) |
| `lintV1Agents` / `lintV1Artifacts` (inverse of `no-v1-artifacts`) | every v1 agent has a unique `name:`, every `task:` key and `subagent_type` matches a name exactly, only v1 schema keys, no v2 vocabulary, tools and plugins use the v1 API, no trailing catch-all deny | CI, over the planned and the committed tree |
| Install tests: `oac init --opencode v1` into a temp dir (`flavor-install.e2e.test.ts`), `scripts/tests/test-flavor-install.sh` | a complete `.opencode/` lands (agents, tools, plugins, skills, commands, context), no `hosts/` folder, the choice is recorded, update keeps it, migration is safe, the installed tree passes the v1 lint | CI (offline, host version stubbed) |
| Doctor mismatch tests | the version check fires both ways | CI |
| Hosts-tier boot of every v1 agent on a real OpenCode v1 | v1 actually loads the files | **Manual / nightly with network only** |

The hosts-tier row is not wired into any workflow and nothing is downloaded by the repo. To run it: provision `opencode-ai@1.19.3` (the latest v1 at the time of writing) and record its checksum on first install with `npm view opencode-ai@1.19.3 dist.integrity`; verify it before every run, and pin it in `evals/v2/versions.json` once the runner reads a second host. The closest thing available offline is the static lint above plus the install tests; they prove the files are self-consistent for v1, not that a v1 binary accepts them. v1 behaviour was read from OpenCode v1.1.48 source; users run v1.19.x.

## Removing v1 later

Delete `packages/compatibility-layer/src/adapters/v1/`, the `opencode-v1` entries in `BuildPipeline.ts`, `TargetPolicy.ts` and `RegistryTargets.ts`, `hosts/opencode-v1/`, `registry.v1.json`, the v1 branches in `packages/cli/src/lib/flavor*.ts` and `bundled.ts`, and the `--opencode` option. Agents declared `opencode-v1` only (`image-specialist`) go with it.
