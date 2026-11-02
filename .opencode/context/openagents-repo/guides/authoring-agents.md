<!-- Context: openagents-repo/guides | Priority: critical | Version: 1.0 | Updated: 2026-11-02 -->

# Guide: Authoring an Agent

**Purpose**: Add or change an agent in this repo. One file in `agent-library/agents/**`; the build does the rest.
**Prerequisite**: `core-concepts/canonical-build.md`. Permission patterns: `standards/permission-patterns.md`.

## Steps

```bash
# 1. create/edit the one source file
$EDITOR agent-library/agents/subagents/<group>/<agent-id>.md
# 2. build (builds the compiler + CLI first, then runs `oac build`)
make build-canonical
# 3. verify: a fresh build must change nothing
make check-canonical-drift
# 4. registry check, then commit source AND generated output together
bash scripts/registry/validate-registry.sh
```

Add the agent id to a system profile in `agent-library/profiles/system/<profile>.json` (`agents` list; subagents
go in the same list) or users cannot install it. Order matters today: build first so the id is registered, then add it to
the profile, then build again (a profile that lists an unregistered id fails the build). `profiles.<id>.components` in the
registries is generated from it.
<!-- TODO-after-code: (2) adding a new agent and listing it in a system profile will work in ONE build; replace the order sentence above. -->

Directories under `agent-library/agents/`: `core/`, `content/`, `data/`, `meta/`,
`subagents/{code,core,development,planning,system-builder,test,utils}/`. The source directory decides the
OpenCode v1 output folder; `oac.category` is metadata and moves nothing (verified by building). v2 and Claude Code
name the output file after `oac.id`; v1 keeps the source file name.

## File shape

```markdown
---
name: MyAgent
description: One-line summary (shown to humans on OpenCode)
mode: subagent                      # primary | subagent | all
permission:                         # OpenCode rules, ordered, LAST MATCH WINS
  bash: { "*": "deny", "npm test *": "allow" }
  edit: { "**/*.env*": "deny" }
oac:
  id: my-agent                      # kebab-case, unique across the corpus
  name: MyAgent
  category: subagents/code
  type: subagent                    # agent | subagent
  exclude: [claude-code]            # see "Shipping"
---

# MyAgent
Body = the system prompt on every host.
```

`description` and `mode` are required frontmatter (`name:` is optional; the emitters set it per host). The file must have exactly one `oac:` block.

## `oac:` fields (schema: `OacBlockFieldsSchema` in `packages/agent-compiler/src/types.ts`)

| Field | Required | Rule |
|---|---|---|
| `id` | yes | `^[a-z0-9]+(-[a-z0-9]+)*$`; duplicate ids fail the build |
| `name` | yes | display name; v1 uses it as the registered agent name |
| `category` | yes | `<root>` or `<root>/<segment>`; roots: core, development, content, data, product, learning, meta, specialist, subagents, testing |
| `type` | yes | `agent` or `subagent` |
| `version` | no | SemVer, default `1.0.0` |
| `author` | no | default `opencode` |
| `tags` | no | string list |
| `dependencies` | no | `type:id` strings; type is subagent, context, command, skill or tool. Unknown ids are dead-reference warnings (fail only with `--strict`) |
| `targets` | no | explicit ship list; omit to ship to every host |
| `exclude` | no | hosts to skip: `opencode`, `opencode-v1`, `claude-code` |
| `overrides` | no | per-host replacements, `claude-code` only (see below) |

The block is strict: an unknown key is an error. `permission:` keys in `task:` may use oac ids; the build rewrites
them per host.

## Shipping

- Omit `targets:` and the agent ships to all hosts minus `exclude`. `opencode-v1` follows `opencode`.
- `targets: [opencode-v1]` alone makes a v1-only agent (today: `image-specialist`).
- An agent that ships to `claude-code` needs `oac.overrides.claude-code.tools`; otherwise `exclude: [claude-code]`.

## Claude Code overrides

```yaml
oac:
  overrides:
    claude-code:        # keys allowed: name, model, description, tools (strict)
      name: my-agent-claude   # default: oac.id
      model: sonnet
      tools: [Read, Grep, Glob]   # authored, not derived from permission:
      description: |
        When to use this agent.
        <example>
        user: "..." / assistant: "..." / <commentary>...</commentary>
        </example>
```

A Claude description without an `<example>` block is a build lint error. Say why in a YAML comment next to the grant.

## Host-specific body text

```markdown
<!-- oac:only claude-code -->
Claude-only text.
<!-- /oac:only -->
```

Markers go alone on their own line; targets are comma-separated; blocks do not nest. Delegation examples
(`task(subagent_type="ContextScout", ...)`) are rewritten per host from any oac id or display name.

## Common build errors

Reproduced with a scratch agent; `oac build` exits 1 on each.

| Message (abridged) | Cause and fix |
|---|---|
| `No oac: block ... must declare an oac: block` | add the block |
| `description: Required` / `mode: Required` / `mode: Invalid enum value` | fix the OpenCode frontmatter |
| `oac.id: id must be kebab-case` | lowercase words joined by `-` |
| `oac.category: category must be "<root>" or ...` | use a root from the table |
| `oac: Unrecognized key(s) in object: 'x'` | remove the key; only the fields above exist |
| `oac.targets.0: Invalid enum value ... received 'cursor'` | targets are opencode, opencode-v1, claude-code |
| `override declared for target "claude-code", which is not in the effective targets` | remove the override or the `exclude` entry |
| `Duplicate oac.id "x": declared by both ...` | rename one |
| `ClaudeAdapter: agent "x" targets claude-code but declares no oac.overrides.claude-code.tools` | add tools, or `exclude: [claude-code]` |
| `[description-no-example] description has no <example> block` | add `<example>` blocks to the Claude description |
| `"oac:only" block is never closed` / `malformed oac:only marker` | close the block; marker alone on its line |
| `"X" names no canonical agent emitted for this target` | bad `task:` key, `subagent_type` or `subagent:` dependency; use an oac id of an agent that ships to that host |
| `[unknown-key] frontmatter key "foo" is outside the v1 Agent schema` | v1 lint: remove non-schema keys such as `foo` |

After deleting an agent, the next `make build-canonical` removes its generated files ("orphan - source is gone").
`oac build --check` reports drift and writes nothing; `--dry-run` previews; `--strict` also fails on warnings.

## Checklist

- [ ] Source only under `agent-library/agents/**`; nothing hand-created in generated trees
- [ ] `make build-canonical` clean; `make check-canonical-drift` passes
- [ ] In a system profile; `bash scripts/registry/validate-registry.sh` passes
- [ ] Output committed with the source
- [ ] `make check-core` passes

## Related

`standards/agent-frontmatter.md`, `standards/subagent-structure.md`, `guides/updating-registry.md`, `guides/testing-agent.md`
