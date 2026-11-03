# agent-library

The one place agents, skills, commands and the context library are written. One markdown file per agent or command, one
folder per skill; `oac build` turns each into the format every tool needs: Claude Code, OpenCode v2
(default) and OpenCode v1.

```
agent-library/
  agents/<category>/<id>.md        one canonical file per agent; the folder is the category (no nesting)
  skills/<id>/SKILL.md             one folder per skill, plus scripts/config/docs it ships (flat, no category)
  commands/[<group>/]<id>.md       one file per command; at most one group folder (it is part of the command's name)
  profiles/system/*.json           install tiers (essential, developer, business, advanced, full)
  profiles/context/*.json          named sets of context files that tiers subscribe to
  context/**                       the context library (standards, workflows, guides); copied verbatim, not compiled
  context/components.json          registry metadata (id, name, tags, category) for the context files install.sh can install
```

## Adding a thing

Every row ends the same way: run `make build-canonical`, then commit your source file(s) and everything it
regenerated. Nothing else is needed: no test, count or list elsewhere in the repo pins how many agents, skills,
commands, context files or aliases exist, so a normal contribution does not turn `make check-core` red.

| To add a... | Create or edit | Extra step (only if you want it installable) | Then |
| --- | --- | --- | --- |
| agent or subagent | `agent-library/agents/<category>/<id>.md` (file name = `oac.id`; `type: agent` or `subagent`) | add the id to `agents` in `profiles/system/<tier>.json`; a Claude Code agent needs `oac.overrides.claude-code.tools` and a `description` with an `<example>` | `make build-canonical` |
| skill | `agent-library/skills/<id>/SKILL.md` (+ any supporting files in the folder) | add the plain id to `skills` in `profiles/system/<tier>.json` | `make build-canonical` |
| command | `agent-library/commands/[<group>/]<id>.md` | add the plain id to `commands` in `profiles/system/<tier>.json` | `make build-canonical` |
| context file | `agent-library/context/<path>.md` | add an entry (`id`, `name`, `file`, `description`, `category`) to `agent-library/context/components.json` to make it installable by `install.sh`; name its id (or a glob) in `profiles/context/*.json` to put it in a tier | `make build-canonical` |
| profile entry | `agent-library/profiles/system/<tier>.json` (tiers: essential, developer, business, advanced, full) or `profiles/context/<set>.json` | list ids as plain strings (no `skill:` prefixes) | `make build-canonical` |
| alias (rename an agent) | on the renamed agent, `oac.aliases: [old-id]`; if it also moved folder, `oac.previousPaths: [old/path.md]` | none: the registry gains `aliases` and `supersedes` automatically | `make build-canonical` |
| retired file (stop shipping one) | delete the source, then add `{ "path": ".opencode/...", "sha256": [every version ever shipped] }` to `agent-library/retired.json` (paths under `.opencode/{agent,command,skills}/` or `.opencode/context/openagents-repo/`) | the hashes decide what installers may delete: get them with `git log --all --format=%H -- <path>` and `git show <commit>:<path> \| shasum -a 256` | `make build-canonical` |

**This page is the one you need.** [CORE.md](../docs/architecture/CORE.md),
[CONTRIBUTING](../docs/contributing/CONTRIBUTING.md) and [DEVELOPMENT](../docs/contributing/DEVELOPMENT.md) are optional depth.

Before the first build, once: `pnpm install --frozen-lockfile` (see [DEVELOPMENT.md](../docs/contributing/DEVELOPMENT.md#prerequisites) for the tool versions).

Naming and folder rules: [docs/architecture/NAMING.md](../docs/architecture/NAMING.md) (`oac build` reports violations under "naming").
Big picture: [docs/architecture/CORE.md](../docs/architecture/CORE.md). What each tool
gets: [built-ai-configs/README.md](../built-ai-configs/README.md) (generated).

## Anatomy of an agent file

OpenCode frontmatter on top (`description`, `mode`, `permission`, ...), plus one `oac:` block.

The worked example below is a real, building agent. To try it, save it as
`agent-library/agents/content/changelog-writer.md` and follow [the workflow](#the-workflow).

```markdown
---
name: ChangelogWriter
description: Drafts a changelog entry from a list of changes
mode: subagent
permission:
  bash: { "*": "deny" }
  edit: { "**/*": "deny" }
oac:
  id: changelog-writer            # kebab-case, unique across the library
  name: ChangelogWriter
  category: content
  type: subagent
  overrides:
    claude-code:
      description: |              # Claude routes on this: include <example> blocks
        Drafts a changelog entry from a list of changes.
        <example>
        user: "Write the changelog for this release"
        assistant: "I'll use changelog-writer to draft it."
        </example>
      tools: [Read, Glob, Grep]   # required for any agent that ships to Claude Code
---

Body text shared by every tool.

<!-- oac:only opencode,opencode-v1 -->
Call ContextScout first to find the project's changelog style.
<!-- /oac:only -->
<!-- oac:only claude-code -->
The caller has already supplied the changelog style; do not look for it.
<!-- /oac:only -->
```

### `oac:` fields

Source of truth: `OacBlockFieldsSchema` in `packages/agent-compiler/src/types.ts`. Unknown keys are errors.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | yes | Kebab-case, unique. v2 and Claude Code name the output file `<id>.md`, and it is the Claude agent name (unless overridden). v1 keeps the source file name instead. |
| `name` | yes | Display name. v1 uses it as the agent id; v2 ignores it. |
| `category` | yes | One of core, code, planning, content, data, meta, system-builder, dev, and it equals the folder under `agents/` (no nesting). `subagents[/x]`, `testing` and `development` still build but are deprecated and lint-warned. |
| `type` | yes | `agent` or `subagent`. |
| `version`, `author`, `tags` | no | Metadata (defaults `1.0.0`, `opencode`, none). |
| `aliases` | no | Former ids of a renamed agent. Old references keep resolving to `id` with a build-time deprecation warning; the registry entry carries them as `aliases`. See [NAMING.md](../docs/architecture/NAMING.md). |
| `dependencies` | no | `<type>:<id>` strings; type is subagent, context, command, skill or tool. Feeds the registry. |
| `targets` | no | Omit it: the agent ships to every host. List hosts only for exceptions (`opencode`, `opencode-v1`, `claude-code`). |
| `exclude` | no | Hosts to skip, e.g. `[claude-code]`. A filter on `targets`. |
| `overrides.claude-code` | Claude only | `tools` (required), `description`, `name`, `model`. `overrides.opencode` is rejected. Give it a `description` with an `<example>` block (see Common build errors). |

`tools` uses Claude names: Read, Write, Edit, Glob, Grep, Bash, WebFetch, Task. Claude cannot
enforce OpenCode's per-glob `permission:` rules, so you state the tool list by hand; say why in a YAML comment.

### Where the output goes

- The source **directory** decides the OpenCode v1 folder: `agent-library/agents/content/x.md` becomes
  `built-ai-configs/opencode-v1/agent/content/<file name>.md`. The directory is the category, so the two agree.
- v2 names its file after `oac.id`; Claude Code uses `oac.overrides.claude-code.name` (default: the id); v1 keeps the **source file name**. Name the source file after the id and don't override the Claude name, and the three agree (the naming lint flags any agent where they differ).
- Write `permission.task` as a block mapping, one key per line. A flow-style `task: { "*": deny, x: allow }` fails the build ("permission.task is a flow-style mapping"), because the delegation ids in its keys are rewritten per host. Other permission keys may use either style.

Declaring `opencode` also builds the v1 copy. Declaring only `opencode-v1` makes the agent v1-only.

### `oac:only` blocks

`<!-- oac:only <host>[,<host>] -->` ... `<!-- /oac:only -->` keeps the text for the named hosts
only. Hosts: `opencode`, `opencode-v1`, `claude-code`. Blocks do not nest. Use them for text that is
true on one tool only (Claude has no "call ContextScout").

### Delegating on Claude Code

Claude Code has no `task(subagent_type=...)` call. It has the `Task` tool, and a subagent can only use it if
its `tools` list includes `Task`. The build does not rewrite delegation text for Claude, so a shared body
that says `task(subagent_type="changelog-writer", ...)` reaches Claude as that literal OpenCode-style snippet.
Write the call once per host with `oac:only`. Facts from the tree:

- The seven agents the plugin ships today (`code-reviewer`, `coder-agent`, `context-manager`, `context-scout`,
  `external-scout`, `task-manager`, `test-engineer`) all list `Task` under `disallowedTools`: none of them delegates.
  The Claude path delegates from the top: the main session, or a skill with `context: fork` and `agent: <id>`,
  starts the subagent and hands it its context (their Claude blocks say "context is supplied by the caller").
- The capability lint fails the build (`delegation-without-task`) when a Claude agent's body tells it to
  delegate and its `tools` has no `Task`.
- A plugin's agents are listed to Claude as `oac:<id>` (the plugin name, a colon, the id).

A coordinator that delegates on both hosts (builds as written, 0 lint findings; `changelog-writer` is the agent above):

```markdown
---
name: ReleaseCoordinator
description: Coordinates a release and delegates the changelog
mode: primary
permission:
  task:
    "*": deny
    changelog-writer: allow        # OpenCode's allow-list; Claude cannot enforce it
oac:
  id: release-coordinator
  name: ReleaseCoordinator
  category: core
  type: agent
  dependencies:
    - subagent:changelog-writer
  overrides:
    claude-code:
      description: |
        Coordinates a release and hands the changelog to changelog-writer.
        <example>
        user: "Prepare the release"
        assistant: "I'll use release-coordinator to run the release steps."
        </example>
      tools: [Read, Glob, Grep, Task]   # Task is what lets it delegate on Claude Code
---

Run the release steps, then get the changelog drafted.

<!-- oac:only opencode,opencode-v1 -->
task(subagent_type="changelog-writer", description="Draft the changelog", prompt="Changes: ...")
<!-- /oac:only -->
<!-- oac:only claude-code -->
Delegate the changelog with the Task tool: choose the `changelog-writer` agent (Claude lists a plugin's
agents as `oac:changelog-writer`), give a short description, and put the list of changes in the prompt.
<!-- /oac:only -->
```

Keep the Claude text as prose, as above. Writing `subagent_type: "oac:changelog-writer"` in a `claude-code`
block fails the build (`"oac:changelog-writer" names no canonical agent emitted for this target`), because
any structured delegation is checked against the agents that ship to that host by their plain `oac.id`.
Built in a scratch copy: the Claude file has `tools: Read, Glob, Grep, Task` and only the Claude paragraph; the
OpenCode files only the delegation call (v2 spells it `subagent(agent=...)`). Whether Claude resolves the `oac:` name at run time was not tested here.

## The workflow

```bash
# 1. edit or add agent-library/agents/<dir>/<file>.md
make build-canonical        # 2. builds the CLI, then runs `oac build`
git status                  # 3. look at what changed under built-ai-configs/ (and the mirrors)
make check-core             # 4. drift gate + compiler/CLI tests + typecheck + installer tests
git add -A && git commit    # 5. commit the source AND the generated files together
```

`make check-core` also runs on every PR (it also lints the compiler). Adding an agent, skill, command, context file or alias does not break it: the tests assert invariants (every library file is built and in the ledger, ids and aliases are unique, lints are clean) and use counts only as minimums.

Quick loops while editing (after `make oac-cli` once): `bun packages/cli/dist/index.js build --dry-run`
previews (it prints drift lines but **always exits 0**; use `--check` when you want a failing exit code),
`... build --check` exits 1 if committed output is stale or a generated folder holds a file no build produced,
`... build --target claude-code` builds one host, `... build --verbose` lists the degradation warnings and the
long report-only lint baseline (dead navigation entries, info naming notes), which are otherwise one count line.

What the example above produced (built in a scratch copy of this repo):

| Host | File written |
| --- | --- |
| OpenCode v2 | `built-ai-configs/opencode/agent/changelog-writer.md` (no `oac:` block, no `name:`), mirrored to `.opencode/agent/changelog-writer.md` |
| OpenCode v1 | `built-ai-configs/opencode-v1/agent/content/changelog-writer.md` (keeps `name: ChangelogWriter`) |
| Claude Code | `built-ai-configs/claude-code/agents/changelog-writer.md` (your `description` and `tools`, plus a generated `disallowedTools`), mirrored to `plugins/claude-code/agents/changelog-writer.md` |

Also updated: `built-ai-configs/registry/registry.json` and `registry.v1.json`, `built-ai-configs/README.md`
and `.oac/build-manifest.json`. Deleting the source file and rebuilding removes all its outputs.

## Skills and commands

Skills and commands work like agents: write the host-native file, add an `oac:` block to its
frontmatter, run the build. The build cuts the block out and leaves everything else as you wrote
it, so a file written for one host comes out byte for byte. The full spec is
[SKILLS-AND-COMMANDS.md](../docs/architecture/SKILLS-AND-COMMANDS.md).

Worked example (both build as written; save the files, run `make build-canonical`):

`agent-library/skills/changelog-style/SKILL.md`

```markdown
---
name: changelog-style              # a skill's name must equal its id (and its folder name)
description: Use when writing a changelog entry; gives the project's entry format.
oac:
  id: changelog-style              # kebab-case; equals the folder name
  name: Changelog Style            # registry name
  category: standard               # registry install tier; optional
  tags: [changelog, writing]
  dependencies:
    - subagent:context-scout       # agent:, subagent:, skill:, command:, context:, tool:
  targets: [opencode, opencode-v1] # omit to ship to every host
---

# Changelog style

Run `bash .opencode/skills/changelog-style/format.sh <file>` to check an entry.

<!-- oac:only opencode,opencode-v1 -->
Ask ContextScout for the project's entry format first.
<!-- /oac:only -->
```

Next to it, `agent-library/skills/changelog-style/format.sh` (any supporting file, at any depth, binary
or text; symlinks, `.git/` and `.DS_Store` are not shipped). Keep a script executable with `chmod +x`: the
build and `oac init` preserve the bit, but `install.sh` does not, so tell users to run it with `bash` as the
example does. The registry lists every file of a skill
in `files`, which is what the installers download.

`agent-library/commands/changelog.md`

```markdown
---
description: Draft a changelog entry for the staged changes
oac:
  id: changelog                    # equals the file name
  name: Changelog
  targets: [opencode, opencode-v1]
---

Draft a changelog entry for the staged changes.
```

A command in a group folder, `agent-library/commands/openagents/check.md`, installs as
`/openagents/check` on OpenCode. The folder is part of the name, so pick it once.

What the build wrote for the skill:

| Host | Files written |
| --- | --- |
| OpenCode v2 | `built-ai-configs/opencode/skills/changelog-style/`, mirrored to `.opencode/skills/changelog-style/` |
| OpenCode v1 | `built-ai-configs/opencode-v1/skills/changelog-style/` |
| Claude Code | nothing: `targets` omits `claude-code` |

A command's group folder must be kebab-case (`openagents`, not `Open Agents`).

Commands go to `.../command/` the same way (Claude Code: `built-ai-configs/claude-code/commands/`,
mirrored to `plugins/claude-code/commands/`). The registries (`registry.json` and `registry.v1.json`)
gain a `skills` and a `commands` entry with `files` for the skill. Skills and commands that ship only to
Claude Code (`targets: [claude-code]`, the plugin's workflow skills) are not in either registry.

A dependency's prefix must match the agent's `type`: `subagent:<id>` for a `type: subagent` agent,
`agent:<id>` for a `type: agent` one. A wrong prefix is not caught by the asset lint but shows up as a dead
reference in the build (`no registry component has id "changelog-writer" of type "agent"`).

`oac:` fields for a skill or command (`OacAssetBlockFieldsSchema` in `packages/agent-compiler/src/types.ts`; unknown keys are errors):
`id`, `name` (required); `description` (registry text; default is the frontmatter one), `category` (registry tier:
essential, standard, extended, specialized, meta), `tags`, `dependencies`, `aliases`, `targets`, `exclude`,
`overrides.claude-code.{name,description}`. There is no `type`, `version` or `author`.

Per-host content: `oac:only` blocks as for agents. On OpenCode, write delegation examples in the
v1 form (`task(subagent_type="TaskManager", ...)`); v2 gets `subagent(agent="task-manager", ...)`.

## Context files

The context library is the knowledge agents read at runtime (`core/standards/code-quality.md`, ...). It lives in
`agent-library/context/` and is **copied, never compiled**, to `.opencode/context/` (the one location every installer,
updater and agent reference uses). To change it: edit under `agent-library/context/`, run `make build-canonical`, commit
the source and the regenerated copy together. To make a new file installable by `install.sh` and the profiles, add an
entry to `agent-library/context/components.json`; to put it in a tier, name its id (or a glob such as `core/*`) in
`agent-library/profiles/context/*.json`. The build prints a report-only context lint (dead links, navigation entries
that point at missing files, files not reachable from navigation). Spec: [docs/architecture/CONTEXT.md](../docs/architecture/CONTEXT.md).

## Make the agent installable (profiles)

A new agent is built and registered, but `oac init` / `install.sh` only install it if a system
profile lists it. Profiles are `agent-library/profiles/system/<tier>.json` (essential, developer,
business, advanced, full); a subagent goes in the same `agents` list as a primary agent (for example
`developer.json` lists `context-scout` and `coder-agent` next to `openagent`).

`agent-library/profiles/**` is the only place profiles are written. The `profiles` section of
`built-ai-configs/registry/registry.json` (what `install.sh` reads) is generated from it. The old hand-kept
`.opencode/profiles/*/profile.json` files drifted from it, nothing installed them, and they were removed.

Save the file, add its `id` to `agents` in `agent-library/profiles/system/<tier>.json`, and run
`make build-canonical` once. The build resolves profiles against the registry it is about to write, so a new
agent and its profile entry go through in one build. A profile that names an id that does not exist still
fails with `System profile "developer" cannot be installed: agent:<id> does not resolve: no registry component has id "<id>" of type "agent"`.

A skill or command is installed the same way, but the lists hold plain ids: add `"changelog-style"` to `skills`
and `"changelog"` to `commands` in the profile that should carry it (`task-management` is the only skill in
any profile today). Do not write `skill:changelog-style`: the build prefixes the type itself and fails with
`skill:skill:changelog-style does not resolve`. Verified by building the worked example and running
`oac init --profile developer` (v2 and v1) and `install.sh developer`: both installed
`.opencode/skills/changelog-style/{SKILL.md,format.sh}` and `.opencode/command/changelog.md`.

Remember: an agent that ships to Claude Code needs `oac.overrides.claude-code.tools` (and a `description` with an
`<example>`), or give it `exclude: [claude-code]`; otherwise the build fails with a message naming the missing field.

## Check it on each host

After the build, look at the three outputs, then try the ones you care about.

| Host | Where the output is | Try it from this repo |
| --- | --- | --- |
| OpenCode v2 (default) | `built-ai-configs/opencode/agent/<id>.md`, mirrored to `.opencode/agent/<id>.md` | In the repo root, `opencode debug agents` lists the id (verified with OpenCode 2.1.4; once the first call returned no agents, a rerun listed them). Run it: `opencode run --agent <id> "<message>"` (flag confirmed in `opencode run --help`; not run here because it calls a model). |
| OpenCode v1 | `built-ai-configs/opencode-v1/agent/<dir>/<file>.md` | A v1 install is made by `oac init --opencode v1 --profile <tier>` in a project (add `--dry-run` to preview); it only installs agents that a system profile lists. You need an OpenCode 1.x to load them: v2 does not load v1 agents. Running v1 end to end was not verified here. |
| Claude Code | `built-ai-configs/claude-code/agents/<id>.md`, mirrored to `plugins/claude-code/agents/<id>.md` | `claude --plugin-dir ./plugins/claude-code` loads the plugin for that session only (flag confirmed in `claude --help`; the plugin README gives the same command). Loading the agent inside a session was not verified here. |

`git diff` on the three paths for your agent is the fastest review: the OpenCode v2 copy has no
`oac:` block, v1 keeps `name:`, and the Claude copy carries your `description` and `tools`.

## What NOT to edit

| Path | Status |
| --- | --- |
| `built-ai-configs/{opencode,claude-code}/**`, `built-ai-configs/opencode-v1/{agent/**/*.md,skills,command}/**`, `built-ai-configs/registry/*.json`, `built-ai-configs/README.md` | generated |
| `.opencode/{agent,skills,command}/**`, `plugins/claude-code/{agents,skills,commands}/**` | generated mirrors |
| `.opencode/context/**` | generated verbatim copy of `context/`; edit `agent-library/context/` |
| `.oac/build-manifest.json` | generated ledger |
| `built-ai-configs/opencode-v1/{tool,plugin,plugins}/**`, `.../agent/**/0-category.json` | hand-maintained v1 assets; the build never touches them |

A hand edit to a generated file fails `make check-core` (and CI), and so does a new file you drop into a generated folder (the gate lists it as a stray). Only the hand-maintained v1 assets in the last row are exempt.

## Common build errors

Messages are from real runs of `oac build`.

| Message | Fix |
| --- | --- |
| `targets claude-code but declares no oac.overrides.claude-code.tools` | Add `tools: [Read, Glob, Grep]` under `oac.overrides.claude-code`, or add `exclude: [claude-code]`. |
| `overrides claude-code tools with "Reed", which Claude Code has no such tool for. Valid tools: ...` | Use one of the listed names. |
| `[description-no-example] description has no <example> block; Claude Code selects a subagent from its description examples` | Required for every agent that ships to Claude Code, and it fails the build (exit 1) even though the files are written. Add `oac.overrides.claude-code.description` with at least one `<example>` block, as in the example above. Verified: an agent with only `tools:` fails; adding the `description` fixes it. |
| `oac.id: id must be kebab-case` | Lowercase words joined by single hyphens. |
| `Duplicate oac.id "code-reviewer"` | Ids are unique across the library; rename one. |
| `System profile "developer" cannot be installed: agent:x does not resolve` | The profile names an id no agent has. A bad id (not kebab-case) fails earlier, at load, with its own message; an id that differs from the file name is named in a `note:` under this one. Fix the id or the profile entry. |
| `oac.category: category must be one of: core, code, ...` | Use a listed category; it is also the folder name. |
| `deprecated alias "x" -> use "y"` (build output, not an error) | A reference still uses a former id. Switch it to the current id; under `--strict` this fails. |
| `alias "x" of "y" collides ...` / `alias "x" is declared by both ...` | An `oac.aliases` entry equals a real id or another agent's alias. Remove or fix it. |
| `oac.type: Required` / `Invalid enum value. Expected 'agent' \| 'subagent'` | Set `type: agent` or `type: subagent`. |
| `oac: Unrecognized key(s) in object: 'colour'` | The `oac:` block is strict; remove or fix the key. |
| `oac.overrides.opencode is not supported` | Only `claude-code` takes overrides. Use `permission:` or `oac:only` for OpenCode. |
| `leaves nothing to emit to` / `override declared for target ... not in the effective targets` | `targets` minus `exclude` is empty, or you override a host you excluded. Fix the lists. |
| `unknown target "claudecode" in oac:only marker (known: opencode, opencode-v1, claude-code)` | Fix the host name. |
| `nested "oac:only" block (the block opened on line N is still open)` | Close each block with `<!-- /oac:only -->` before opening the next. |
| `"Ghost" names no canonical agent emitted for this target` | A `task(subagent_type=...)` or `permission.task` reference points at no agent for that host. Fix the name or the `oac.id`. |
| `oac.id "x" must equal the folder name "y"` / `... the file name "y"` | A skill's id is its folder name, a command's is its file name. |
| `frontmatter name "X" must equal the skill id "y"` | Hosts find a skill by folder name; make `name:` equal the id (or drop it). |
| `no description. Give the frontmatter a description: or set oac.description` | The registry entry needs one. |
| `Duplicate skill id/alias "x"` | Ids and aliases are unique within skills and within commands. |
| `skills are folders (skills/<id>/SKILL.md); a loose file is not a skill` / `only .md files may live under commands/` | Every `.md` under `commands/` is a command and every entry under `skills/` is a skill folder. Keep templates and docs in `docs/`. |
| `[dead-dependency] oac.dependencies names skill:x, which does not exist` (a counted lint) | Fix the id, or add the skill, command or agent. |
| `[skill-agent-unknown] frontmatter agent "x" is not a Claude Code agent` | A forked Claude skill's `agent:` must be an agent that ships to claude-code (or `Explore`, `Plan`, `general-purpose`). |
| `naming: <path> [category-folder] folder "x" != category "y"` (report-only; **build still exits 0**) | Move the file to `agent-library/agents/<category>/` so the folder equals `oac.category`, or set `category` to the folder. |
| `naming: <path> [filename-is-id] file name "x" != id "y"` (report-only; **build still exits 0**) | Rename the file to `<oac.id>.md`, or change `oac.id`. If the agent is also in a profile and the id was a typo, the build fails with `profile ... cannot be installed`; the message then names the file whose id differs. |
| `context: <path> [dead-link] ... is not in agent-library/context/` (report-only; **build still exits 0**) | Point the link at a file that exists under `agent-library/context/`, or add the missing file. Dead navigation entries and unreachable/unregistered files are a baseline count line; `--verbose` lists them. |
| `unexpected file X not produced by the build — delete it or add it to agent-library/` (`build --check` and the drift gate exit 1; a plain build only warns) | A file sits in a generated folder (`built-ai-configs/**`, `.opencode/{agent,command,skills,context}`, `plugins/claude-code/{agents,skills,commands}`) that the build did not write. Delete it, or make it a real source under `agent-library/`. |
| `build --check` prints `modified <path>` and exits 1 | A generated file was edited or the source changed without a rebuild. Run `make build-canonical`. |
