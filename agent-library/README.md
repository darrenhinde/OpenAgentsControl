# agent-library

The one place agents are written. One markdown file per agent; `oac build` turns it into the
format each tool needs: Claude Code, OpenCode v2 (default) and OpenCode v1.

```
agent-library/
  agents/<dir>/<file>.md           one canonical file per agent (nesting: agents/subagents/utils/x.md)
  profiles/system/*.json           install tiers (essential, developer, business, advanced, full)
  profiles/context/*.json          named sets of context files that tiers subscribe to
```

**This page is the one you need.** [CORE.md](../docs/architecture/CORE.md),
[CONTRIBUTING](../docs/contributing/CONTRIBUTING.md) and [DEVELOPMENT](../docs/contributing/DEVELOPMENT.md) are optional depth.

Before the first build, once: `pnpm install --frozen-lockfile` (see [DEVELOPMENT.md](../docs/contributing/DEVELOPMENT.md#prerequisites) for the tool versions).

Big picture: [docs/architecture/CORE.md](../docs/architecture/CORE.md). What each tool
gets: [built-ai-configs/README.md](../built-ai-configs/README.md) (generated).

## Anatomy of an agent file

OpenCode frontmatter on top (`description`, `mode`, `permission`, ...), plus one `oac:` block.

The worked example below is a real, building agent. To try it, save it as
`agent-library/agents/subagents/utils/changelog-writer.md` and follow [the workflow](#the-workflow).

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
  category: subagents/utils
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
| `category` | yes | `<root>` or `<root>/<segment>`. Roots: core, development, content, data, product, learning, meta, specialist, subagents, testing. Metadata only: it does not choose any output folder (the source directory does, see below). |
| `type` | yes | `agent` or `subagent`. |
| `version`, `author`, `tags` | no | Metadata (defaults `1.0.0`, `opencode`, none). |
| `dependencies` | no | `<type>:<id>` strings; type is subagent, context, command, skill or tool. Feeds the registry. |
| `targets` | no | Omit it: the agent ships to every host. List hosts only for exceptions (`opencode`, `opencode-v1`, `claude-code`). |
| `exclude` | no | Hosts to skip, e.g. `[claude-code]`. A filter on `targets`. |
| `overrides.claude-code` | Claude only | `tools` (required), `description`, `name`, `model`. `overrides.opencode` is rejected. Give it a `description` with an `<example>` block (see Common build errors). |

`tools` uses Claude names: Read, Write, Edit, Glob, Grep, Bash, WebFetch, Task. Claude cannot
enforce OpenCode's per-glob `permission:` rules, so you state the tool list by hand; say why in a YAML comment.

### Where the output goes

- The source **directory** decides the OpenCode v1 folder: `agent-library/agents/subagents/utils/x.md` becomes
  `built-ai-configs/opencode-v1/agent/subagents/utils/<file name>.md`. `oac.category` does not move it
  (verified: category `subagents/code` in the `utils/` directory still built into `.../subagents/utils/`).
- v2 and Claude Code name their file after `oac.id`; v1 keeps the **source file name**. Name the file after the id and the three agree.

Declaring `opencode` also builds the v1 copy. Declaring only `opencode-v1` makes the agent v1-only.

### `oac:only` blocks

`<!-- oac:only <host>[,<host>] -->` ... `<!-- /oac:only -->` keeps the text for the named hosts
only. Hosts: `opencode`, `opencode-v1`, `claude-code`. Blocks do not nest. Use them for text that is
true on one tool only (Claude has no "call ContextScout").

## The workflow

```bash
# 1. edit or add agent-library/agents/<dir>/<file>.md
make build-canonical        # 2. builds the CLI, then runs `oac build`
git status                  # 3. look at what changed under built-ai-configs/ (and the mirrors)
make check-core             # 4. drift gate + compiler/CLI tests + typecheck + installer tests
git add -A && git commit    # 5. commit the source AND the generated files together
```

`make check-core` also runs on every PR. <!-- TODO-after-code: (1) once check-core no longer hard-codes agent counts, state that adding an agent keeps it green; today it fails after adding an agent (see "Add an agent: the true order" below). (4) add `pnpm run lint` in packages/agent-compiler to the list of what check-core runs. -->

Quick loops while editing (after `make oac-cli` once): `bun packages/cli/dist/index.js build --dry-run`
previews, `... build --check` exits 1 if committed output is stale, `... build --target claude-code`
builds one host, `... build --verbose` lists degradation warnings.

What the example above produced (built in a scratch copy of this repo):

| Host | File written |
| --- | --- |
| OpenCode v2 | `built-ai-configs/opencode/agent/changelog-writer.md` (no `oac:` block, no `name:`), mirrored to `.opencode/agent/changelog-writer.md` |
| OpenCode v1 | `built-ai-configs/opencode-v1/agent/subagents/utils/changelog-writer.md` (keeps `name: ChangelogWriter`) |
| Claude Code | `built-ai-configs/claude-code/agents/changelog-writer.md` (your `description` and `tools`, plus a generated `disallowedTools`), mirrored to `plugins/claude-code/agents/changelog-writer.md` |

Also updated: `built-ai-configs/registry/registry.json` and `registry.v1.json`, `built-ai-configs/README.md`
and `.oac/build-manifest.json`. Deleting the source file and rebuilding removes all its outputs.

## Add an agent: the true order

A new agent is built and registered, but `oac init` / `install.sh` only install it if a system
profile lists it. Profiles are `agent-library/profiles/system/<tier>.json` (essential, developer,
business, advanced, full); a subagent goes in the same `agents` list as a primary agent (for example
`developer.json` lists `contextscout` and `coder-agent` next to `openagent`).

<!-- TODO-after-code: (2) adding a new agent AND listing it in a system profile will work in ONE build. When that lands, replace the three steps below with: save the file, add its id to `agents` in the profile, run `make build-canonical`. -->
Today it takes two builds, in this order (run in a scratch clone):

1. Save the agent file and run `make build-canonical` (this registers the id).
2. Add its `id` to `agents` in `agent-library/profiles/system/<tier>.json`.
3. Run `make build-canonical` again.

Listing the id in a profile before step 1 fails the build with
`System profile "developer" cannot be installed: agent:changelog-writer does not resolve: no registry component has id "changelog-writer" of type "agent"`,
and a second build does not recover until the id is registered some other way: undo the profile edit, build, then re-add it.

## Check it on each host

After the build, look at the three outputs, then try the ones you care about.

| Host | Where the output is | Try it from this repo |
| --- | --- | --- |
| OpenCode v2 (default) | `built-ai-configs/opencode/agent/<id>.md`, mirrored to `.opencode/agent/<id>.md` | In the repo root, `opencode debug agents` lists the id (verified with OpenCode 2.1.4). Run it: `opencode run --agent <id> "<message>"` (flag confirmed in `opencode run --help`; not run here because it calls a model). |
| OpenCode v1 | `built-ai-configs/opencode-v1/agent/<dir>/<file>.md` | A v1 install is made by `oac init --opencode v1 --profile <tier>` in a project (add `--dry-run` to preview); it only installs agents that a system profile lists. You need an OpenCode 1.x to load them: v2 does not load v1 agents. Running v1 end to end was not verified here. |
| Claude Code | `built-ai-configs/claude-code/agents/<id>.md`, mirrored to `plugins/claude-code/agents/<id>.md` | `claude --plugin-dir ./plugins/claude-code` loads the plugin for that session only (flag confirmed in `claude --help`; the plugin README gives the same command). Loading the agent inside a session was not verified here. |

`git diff` on the three paths for your agent is the fastest review: the OpenCode v2 copy has no
`oac:` block, v1 keeps `name:`, and the Claude copy carries your `description` and `tools`.

## What NOT to edit

| Path | Status |
| --- | --- |
| `built-ai-configs/{opencode,claude-code}/**`, `built-ai-configs/opencode-v1/agent/**/*.md`, `built-ai-configs/registry/*.json`, `built-ai-configs/README.md` | generated |
| `.opencode/agent/*.md`, `plugins/claude-code/agents/*.md` | generated mirrors |
| `.oac/build-manifest.json` | generated ledger |
| `built-ai-configs/opencode-v1/{tool,plugin,plugins,skills,command}/**`, `.../agent/**/0-category.json` | hand-maintained v1 assets; the build never touches them |

A hand edit to a generated file fails `make check-core` (and CI).

## Common build errors

Messages are from real runs of `oac build`.

| Message | Fix |
| --- | --- |
| `targets claude-code but declares no oac.overrides.claude-code.tools` | Add `tools: [Read, Glob, Grep]` under `oac.overrides.claude-code`, or add `exclude: [claude-code]`. |
| `overrides claude-code tools with "Reed", which Claude Code has no such tool for. Valid tools: ...` | Use one of the listed names. |
| `[description-no-example] description has no <example> block; Claude Code selects a subagent from its description examples` | Required for every agent that ships to Claude Code, and it fails the build (exit 1) even though the files are written. Add `oac.overrides.claude-code.description` with at least one `<example>` block, as in the example above. Verified: an agent with only `tools:` fails; adding the `description` fixes it. |
| `oac.id: id must be kebab-case` | Lowercase words joined by single hyphens. |
| `Duplicate oac.id "reviewer"` | Ids are unique across the library; rename one. |
| `oac.category: category must be "<root>" or "<root>/<segment>" where root is one of: ...` | Use a listed root, at most one sub-segment. |
| `oac.type: Required` / `Invalid enum value. Expected 'agent' \| 'subagent'` | Set `type: agent` or `type: subagent`. |
| `oac: Unrecognized key(s) in object: 'colour'` | The `oac:` block is strict; remove or fix the key. |
| `oac.overrides.opencode is not supported` | Only `claude-code` takes overrides. Use `permission:` or `oac:only` for OpenCode. |
| `leaves nothing to emit to` / `override declared for target ... not in the effective targets` | `targets` minus `exclude` is empty, or you override a host you excluded. Fix the lists. |
| `unknown target "claudecode" in oac:only marker (known: opencode, opencode-v1, claude-code)` | Fix the host name. |
| `nested "oac:only" block (the block opened on line N is still open)` | Close each block with `<!-- /oac:only -->` before opening the next. |
| `"Ghost" names no canonical agent emitted for this target` | A `task(subagent_type=...)` or `permission.task` reference points at no agent for that host. Fix the name or the `oac.id`. |
| `build --check` prints `modified <path>` and exits 1 | A generated file was edited or the source changed without a rebuild. Run `make build-canonical`. |
