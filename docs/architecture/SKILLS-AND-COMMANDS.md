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
in. Today there are two groups, `openagents` and `prompt-engineering`, plus the grandfathered
`openagents/new-agents` (two folders deep, two commands). The loader accepts at most two levels;
the `command-group-depth` lint reports anything beyond one except that grandfathered group, which is
listed in `LEGACY_COMMAND_GROUPS` and should go the next time those two commands move. Claude Code
commands are flat (a group would namespace them as `/group:name`).

Everything under `commands/` must be a command. Templates and READMEs that sat next to commands
(`command/openagents/new-agents/{README.md,templates/}`) are documentation and moved to
`docs/guides/new-agents/`.

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
not Markdown are copied verbatim, with their executable bit.

When nothing is left of the frontmatter after the `oac:` block is cut, the output has none.

## Per-host output

| Host | Skills | Commands | Live mirror (generated, byte-identical) |
| --- | --- | --- | --- |
| OpenCode v2 | `built-ai-configs/opencode/skills/<id>/` | `built-ai-configs/opencode/command/[<group>/]<id>.md` | `.opencode/skills/`, `.opencode/command/` |
| OpenCode v1 | `built-ai-configs/opencode-v1/skills/<id>/` | `built-ai-configs/opencode-v1/command/...` | none (installs read the built-ai-configs folder) |
| Claude Code | `built-ai-configs/claude-code/skills/<id>/` | `built-ai-configs/claude-code/commands/<id>.md` | `plugins/claude-code/skills/`, `plugins/claude-code/commands/` |

The mirrors are produced the way agent mirrors are: `place()` in `BuildPipeline.ts` writes the
primary, then one copy per mirror root. They are ledgered, pruned and drift-checked like every other
generated file. `.opencode/skills/` is the folder OpenCode reads, so v2 uses the plural name, as
installers always shipped it. OpenCode's loader also reads a singular `skill/` folder (v1 does; the
v2.1.4 binary on this machine has no command to list skills, so v2 was not checked), which is how
`.opencode/skill/` could exist unnoticed next to `.opencode/skills/`. The singular folder is dropped:
one name, no duplicates, nothing for a loader to find twice.

### Which skills go where

- The 11 skills in `plugins/claude-code/skills/` and the 6 commands in `plugins/claude-code/commands/`
  are Claude-plugin specific (they call the Skill tool, fork into plugin agents with `context: fork` /
  `agent:`, and point at plugin paths): `targets: [claude-code]`.
- The OpenCode skills (`context-manager`, `context7`, `smart-router-skill`, `task-management`,
  `project-orchestration`) and the 17 OpenCode commands: `targets: [opencode, opencode-v1]`.
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

`oac.previousPaths` is not offered for skills and commands: the installers remove superseded files
only under `agent/`, and a rename or move of a skill or command would leave the old copy installed.
Rename by adding the old id to `aliases` and shipping both until the installers learn to retire
other kinds. Plan that change with the installers (`install.sh`, `update.sh`,
`packages/cli/src/lib/superseded.ts`) in the same release.
