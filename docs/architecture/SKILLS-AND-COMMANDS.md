# Skills and commands

Skills and commands are canonical, compiled content, exactly like agents: author once in
`agent-library/`, run `oac build`, and every host gets its copy. This page is the spec. The code
is `packages/agent-compiler/src/core/{AssetLoader,AssetEmitter}.ts`, the registry part of
`RegistryEmitter.ts`, and `verify/lint/assets.ts`.

## Layout

```
agent-library/
  agents/<category>/<id>.md
  skills/<id>/SKILL.md            + supporting files, any depth (router.sh, scripts/, config/, *.md)
  commands/<id>.md                or one group folder: commands/<group>/<id>.md
```

**Skills are flat.** One folder per skill, named for the id. Both hosts resolve a skill by its folder
name, so there is no category axis. Supporting files are copied next to `SKILL.md` and listed in the
registry entry's `files` (the installers download exactly that list).

**Commands take at most one group folder.** The folder is not a category; it is part of the
command's name on the host. OpenCode names a command by its path under `command/`, so
`command/openagents/check-context-deps.md` is typed `/openagents/check-context-deps`. Moving a
command to another folder changes what users type and orphans the installed file (the installers'
`supersedes` handling covers `agent/*.md` only), so the group is the folder the file already ships
in. A group folder name must be kebab-case (lowercase letters, digits, single hyphens; the loader
rejects `Open Agents` or `open_agents`), because it becomes part of a command name and a path on
every host. Today there are two groups, `openagents` and `prompt-engineering`, plus the grandfathered
`openagents/new-agents` (two folders deep, two commands). The loader accepts at most two levels;
the `command-group-depth` lint reports anything beyond one except that grandfathered group, which is
listed in `LEGACY_COMMAND_GROUPS` and should go the next time those two commands move. Claude Code
commands are flat (a group would namespace them as `/group:name`).

Everything under `commands/` must be a command. Templates and READMEs that sat next to commands
(`command/openagents/new-agents/{README.md,templates/}`) are documentation and moved to
`docs/guides/new-agents/`; installs that still hold the old copies are cleaned up by the
[retired files](#retired-files) mechanism.

### What the loader ships from a skill folder

Every regular file under `skills/<id>/` is a supporting file, at any depth, with these rules:

- Symlinks (to a file or to a folder) are skipped, never followed, and not reported. A link inside a
  skill must not pull in content from outside `agent-library/`.
- `.git/` and `node_modules/` folders and `.DS_Store` files are skipped. Every other file, dotfiles
  included (`.env.example`), is shipped.
- File names may contain spaces and non-ASCII characters; they are copied as written.

## The `oac:` block

Same mechanism as agents: the block sits in the file's frontmatter, is validated strictly, and is
cut out of the output. The rest of the frontmatter is the host's own and is kept as authored.

```yaml
---
name: task-management            # host-native (skills: must equal the id)
description: Task management CLI ...
oac:
  id: task-management            # kebab-case; must equal the folder (skill) or file name (command)
  name: Task Management          # registry name
  description: ...               # optional: registry description; default is the frontmatter one
  category: essential            # optional: registry install tier (essential|standard|extended|specialized|meta)
  tags: [tasks, cli]
  dependencies:                  # subagent:, agent:, skill:, command:, context:, tool:
    - subagent:context-scout
  aliases: [old-id]              # optional: former ids; emitted as registry `aliases`
  targets: [opencode, opencode-v1]   # omit = every host; opencode-v1 follows opencode
  exclude: [claude-code]         # filter on targets, same rules as agents
  overrides:
    claude-code:                 # only claude-code reads overrides (same as agents)
      description: Use when ...  # name and description only
---
```

Reused from agents: the id rule, `targets` / `exclude` with the same opt-out default and the same
`opencode-v1`-follows-`opencode` rule (`emitsTo`), the dependency forms, the cross-field checks (an
`exclude` must narrow something, the effective set is not empty, an override needs a host in the
set). Not carried over: `type` (the folder says what it is), `version`, `author` (the registry
entries never had them), `previousPaths` (see Upgrades).

`category` here is the registry's install tier, which is what the carried entries already held. It
is not a folder axis, unlike an agent's `category`.

### Per-host content

In this order, on every `.md` file of the asset (including a skill's supporting Markdown):

1. `<!-- oac:only <host>[,<host>] -->` ... `<!-- /oac:only -->` keeps or drops a block, with the
   same grammar and errors as agents (`core/HostBlocks.ts`).
2. On OpenCode only, structured delegation calls are rewritten like agent bodies: author the v1 form
   `task(subagent_type="TaskManager", ...)` and v2 gets `subagent(agent="task-manager", ...)`. An
   agent name that matches nothing is left as written. Prose is never rewritten.

An `overrides.claude-code` name or description replaces that field in the Claude output; that file's
frontmatter is then re-serialised (a file with no override keeps its authored bytes). Files that are
not Markdown are copied byte for byte, with their executable bit: they are read as raw bytes and
never decoded, so a PNG or font survives the build intact (the ledger hash, the write, the drift
check and pruning all compare bytes). Only `.md` files go through the host-block and delegation
steps above.

When nothing is left of the frontmatter after the `oac:` block is cut, the output has none.

## Per-host output

| Host | Skills | Commands | Live mirror (generated, byte-identical) |
| --- | --- | --- | --- |
| OpenCode v2 | `built-ai-configs/opencode/skills/<id>/` | `built-ai-configs/opencode/command/[<group>/]<id>.md` | `.opencode/skills/`, `.opencode/command/` |
| OpenCode v1 | `built-ai-configs/opencode-v1/skills/<id>/` | `built-ai-configs/opencode-v1/command/...` | none (installs read the built-ai-configs folder) |
| Claude Code | `built-ai-configs/claude-code/skills/<id>/` | `built-ai-configs/claude-code/commands/<id>.md` | `plugins/claude-code/skills/`, `plugins/claude-code/commands/` |

The mirrors are produced the way agent mirrors are: `place()` in `BuildPipeline.ts` writes the
primary, then one copy per mirror root. They are ledgered, pruned and drift-checked like every other
generated file. `.opencode/skills/` is the folder we ship to and standardise on (plural).

What OpenCode itself reads, verified from its docs and source: the documentation lists
`.opencode/skills/<name>/SKILL.md`; v1.2.0 globs `{skill,skills}/**/SKILL.md`; v2.1.4 registers both a
`skill` and a `skills` directory, and commands from `{command,commands}/**/*.md`. So the singular
`skill/` folder is read by v1 AND v2, not only v1 (an earlier version of this page said v2 was not
checked). That is how `.opencode/skill/` could exist unnoticed next to `.opencode/skills/`, and why
a skill present in both would be defined twice. The singular folder is dropped from the repository:
one name, no duplicates, nothing for a loader to find twice. We keep writing the plural one.

### Which skills go where

- The 11 skills in `plugins/claude-code/skills/` and the 6 commands in `plugins/claude-code/commands/`
  are Claude-plugin specific (they call the Skill tool, fork into plugin agents with `context: fork` /
  `agent:`, and point at plugin paths): `targets: [claude-code]`.
- The OpenCode skills (`context-manager`, `context7`, `smart-router-skill`, `task-management`,
  `project-orchestration`) and the 17 OpenCode commands: `targets: [opencode, opencode-v1]`.
- **Profile placement.** Only `task-management` is listed in any system profile
  (`agent-library/profiles/system/*.json`, `skills`). The other OpenCode skills (`context-manager`,
  `context7`, `smart-router-skill`, `project-orchestration`) are registered but in no profile, so
  `oac init --profile <tier>` and `install.sh <tier>` do not install them; `oac init --profile full`
  copies the whole bundled tree, and `oac add skill:<id>` or install.sh's custom menu picks one. Because
  not every skill is in a profile, `project-orchestration` is deliberately left unlisted too: listing it
  alone in `full` would make it the one skill a profile carries by accident. Decide the placement of all
  of them together when profiles are next revised.
- A skill that is genuinely shared between hosts omits `targets:` and uses `oac:only` where the hosts
  differ. None qualifies today: names that look alike are different skills (the Claude `code-review`
  skill forks into a plugin agent; nothing like it exists for OpenCode). They are not merged.

## Registry

`RegistryEmitter` generates `components.skills` and `components.commands` for each registry (v2:
`.opencode/...` paths; v1: `built-ai-configs/opencode-v1/...` paths, which installers map to
`.opencode/`). An entry is `id, name, type, path, description, tags, dependencies, category`, plus
`files` for a skill (main file first, then the rest by path) and `aliases` when declared, the shape the
hand-carried entries had. An asset that does not ship to a registry's host has no entry there, so
Claude-only skills and commands never appear in either. Arrays are sorted by id. Hand-maintained
entries for ids the canonical tree does not claim are still carried through; an entry the ledger says
the build wrote is withdrawn when its source is deleted (the same rule as agents).

## Ledger, pruning, drift

Every output file, mirrors included, gets a `.oac/build-manifest.json` line with the target, its root
(a new `skills` / `command` / `commands` root per host) and `assetKind` / `assetId`. Pruning is
ledger-gated as for agents: only files a previous build wrote are removed, and only under a root their
target may write. A script's executable bit is part of the plan: the build sets it, and the drift check
fails when it is missing. `scripts/validation/check-build-drift.sh` watches the six mirror/primary roots.

## Lints

Loader errors (fail the build; the output path would be ambiguous): schema violations, id not equal to
the folder or file name, a skill's frontmatter `name` not equal to its id, no description (neither in
frontmatter nor `oac.description`), duplicate id or alias within a kind, a loose file in `skills/`, a
non-`.md` file in `commands/`, CRLF line endings, a malformed `oac:only` marker.

Counted lint warnings (fail `--strict`):

| Rule | Checks |
| --- | --- |
| `dead-dependency` | an `oac.dependencies` entry naming an agent, skill or command that does not exist in `agent-library/` |
| `skill-agent-unknown` | a Claude skill's `agent:` names neither a Claude Code agent nor a built-in (`Explore`, `Plan`, `general-purpose`) |

Dead references from agents to a skill or command (`oac.dependencies: [skill:x]`) and from profiles
are resolved against the planned registry by the existing `ReferenceResolver`, so they surface as dead
references in `oac build`.

Report-only naming lint (printed after the summary, never counted):

| Rule | Checks |
| --- | --- |
| `id-type-suffix` | id ends in `-skill` / `-command` (allow-list: `smart-router-skill`, legacy, revisit) |
| `id-compound-word` | a run-together word from the agent lint's dictionary |
| `command-group-depth` | a group folder more than one level deep (allow-list: `openagents/new-agents`) |
| `host-name-override` | a claude-code name override that differs from the id |

## Upgrades

Existing installs keep working with no migration: every registry `path` that was installable before is
installable at the same installed location. Moving the sources changes where the repository stores
them, not where installers write. The one entry that moves in the registry is the v1 registry's skill
and command paths (`.opencode/skills/...` becomes `built-ai-configs/opencode-v1/skills/...`, which
`install.sh` and the CLI already strip to the same destination).

`oac.previousPaths` is not offered for skills and commands: `supersedes` (rename or move of a live
component) is still `agent/*.md` only, so a rename of a skill or command would leave the old copy
installed. Rename by adding the old id to `aliases` and shipping both. Removing a shipped file with no
replacement is a different case and is supported: see below.

### Retired files

`task-management/tests/*.test.ts` moved to `docs/history/skill-task-management-tests/` (they tested a
validator module that does not exist; they were never registered, so no installer shipped them).

`command/openagents/new-agents/{README.md,templates/*}` (12 files, 3 of them `.md` that OpenCode loads
as junk commands) were shipped by `oac init --profile full` and are no longer shipped. To clean up old
installs, the registry has an additive top-level `retired` array:

```json
"retired": [
  { "path": ".opencode/command/openagents/new-agents/README.md",
    "sha256": ["30c08ef5...", "6004a9dc..."],
    "replacedBy": "docs/guides/new-agents/README.md" }
]
```

It is generated, in both registries, from the hand-maintained `agent-library/retired.json` (same
shape; the compiler validates it in `core/RetiredFiles.ts`: normalised path under
`.opencode/{agent,command,skills}/`, 64-hex hashes, no duplicates, and a path a component still ships is
an error). `sha256` lists every version of the file any release shipped at that path (a README that was
edited over time has several); compute them from git history, never from the working tree.

Add an entry when you delete a shipped file that no component replaces. Installers act on it with the
same containment as superseded agent files, widened from `agent/*.md` to any file under
`.opencode/agent/`, `.opencode/command/` or `.opencode/skills/`:

- the path must be normalised: no `..`, no backslash, no `//` or `./`; anything else is ignored whatever
  the registry says;
- a symlink, or a file behind a symlinked directory that resolves outside its folder, is never read or
  removed (warned and skipped);
- the file must still hash to one of the recorded versions. Description matching, used for agents, is
  not possible for a README or YAML template. A file that differs (edited, or the user's own) is left in
  place and reported, and `oac doctor` keeps warning about it;
- a pristine copy that the CLI manifest tracks is removed outright; any other match (installed by
  `install.sh`, or custom in the manifest) is first copied to `.oac/backups/<time>/` (CLI) or
  `<install dir>.backup.<time>/` (scripts);
- empty folders it leaves are removed; a manifest entry for a retired file that is already gone is
  dropped.

`oac update`, `oac init`, `install.sh` and `update.sh` apply it (`oac add` does not: it is scoped to one
component). `update.sh` needs `jq` for this; without it, it skips the retired names (no 404, no failure)
and removes nothing. `oac doctor` warns ("Retired files") while one is present.

## Claude Code users: plugin vs apply

Known gap, recorded as a decision for the maintainer.

- **Skills and commands reach Claude Code through the plugin only.** A Claude user gets the 12 skills
  (`code-execution`, `code-review`, `context-discovery`, `context-setup`, `debugger`, `external-research`,
  `oac-approach`, `parallel-execution`, `task-breakdown`, `test-generation`, `using-oac`,
  `verification-before-completion`) and the 6 commands (`brainstorm`, `debug`, `install-context`,
  `oac-cleanup`, `oac-help`, `oac-status`) by installing the plugin from this repository's marketplace:
  `/plugin marketplace add https://github.com/darrenhinde/OpenAgentsControl`, then `/plugin install oac`
  (for development: `claude --plugin-dir ./plugins/claude-code`). The plugin carries its agents too.
  These are `targets: [claude-code]` assets, generated into `built-ai-configs/claude-code/` and mirrored
  to `plugins/claude-code/{skills,commands}/`.
- **`oac apply claude` is agents-only.** It writes `.claude/agents/<name>.md` for the agents installed in
  `.opencode/agent/` (the compiled Claude agents where the package has them, a conversion otherwise), backing
  up an existing file, and nothing else: no `.claude/skills/`, no `.claude/commands/`, no settings.
  A project that runs `oac init` + `oac apply claude` without the plugin has Claude agents but none of the
  12 skills or 6 commands.
- OpenCode also scans `.claude/skills/`, so extending `apply` to write skills there would make them visible
  to OpenCode as well, which needs a decision on duplicates with `.opencode/skills/`. Not done in this round.

Options for the maintainer: (a) keep the plugin as the Claude path for skills and commands (this section),
(b) have `apply claude` also write the Claude skills and commands, or (c) leave the split as is. No code
change was made for (b).
