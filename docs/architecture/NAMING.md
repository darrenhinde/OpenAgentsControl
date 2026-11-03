# Naming and layout

Rules for ids and folders in `agent-library/`. Enforced by a **report-only** lint: `oac build`
prints violations after its summary under "naming lint" (`naming: <path> [rule] message`). They are
not counted in the degradation-warning baseline, are not affected by `--strict`, and never change
the exit code. The lint is promoted to failing once the tree has stayed clean.
Code: `packages/agent-compiler/src/verify/lint/naming.ts`.

## Rules in force

1. **Id is kebab-case and equals the file name.** Lowercase words joined by single hyphens; the
   file is named exactly the id. The id never repeats the type: it does not end in `-agent`
   (two [legacy exceptions](#allow-lists-and-exceptions) below).
2. **One id on every host.** Display names derive from the id: `PascalCase(id)` on OpenCode
   (`context-scout` becomes `ContextScout`; `adr-manager` becomes `ADRManager`, see acronyms);
   Claude Code uses the id as is. A per-host `name` in `oac.overrides` is discouraged and
   flagged unless it equals the id. An `Open` prefix on a display name is allowed
   (`OpenDevopsSpecialist`).
3. **Run-together words are hyphenated.** `contextscout` is `context-scout`. The lint knows a small
   explicit dictionary (`contextscout`, `externalscout`); extend `KNOWN_COMPOUNDS` when another
   shows up.
4. **Role suffix vocabulary.** `-scout` (finds), `-manager` (owns a lifecycle), `-specialist`
   (domain task), `-reviewer`, `-writer`, `-analyzer`, `-executor`, `-orchestrator`, `-generator`,
   `-creator`, `-designer`, `-engineer`, `-retriever`, `-organizer`, `-mapper`, `-responder`,
   `-runner`, `-engine`. Any other suffix is allowed and yields an info note only.
5. **One folder axis: category, one level.** `agent-library/agents/<category>/<id>.md`, and
   `oac.category` equals the folder. Categories: `core`, `code`, `planning`, `content`, `data`,
   `meta`, `system-builder`, `dev`. No nesting. There is no `subagents/` folder: primary vs
   subagent is the `type` field, which is independent of category (`core/` holds both `openagent`
   and `context-scout`), so the lint does not compare `type` with the folder.
   `subagents`, `subagents/<x>`, `testing` and `development` are still accepted as **deprecated**
   categories so a tree mid-migration builds; the lint warns on each.
6. **Renames keep working through aliases (implemented).** `oac.aliases: [old-id, ...]` on the
   renamed agent. Every delegation reference by an alias resolves to the current id: `permission.task`
   keys, structured body calls (`subagent_type="old"`, `task(old, ...)`), `oac.dependencies`, and
   profile `agents` lists. Each use prints `deprecated alias "old" -> use "new"` at build time
   (counted, and failing under `--strict`); declaring the alias is not a use. An alias that equals a
   real id, another agent's alias, or normalises onto a different agent fails the build. The
   registry entry gains an additive `aliases` field, which `install.sh` and the CLI already match
   on, so `oac add old-id` and `install.sh` keep working. Prose that merely mentions an agent is
   never rewritten.
7. **Skills and commands** follow the same id rules (a skill is a noun or verb-first phrase, a
   command is a verb) but are not linted: they are not canonical source types today. (Planned.)

| Good | Bad | Rule |
| --- | --- | --- |
| `context-scout.md`, `id: context-scout` | `contextscout.md`, `id: contextscout` | 1, 3 |
| `test-engineer.md`, `id: test-engineer` | `test-engineer.md`, `id: tester` | 1 file name = id |
| `reviewer` renamed: `id: code-reviewer`, `aliases: [reviewer]` | deleting `reviewer` outright | 6 |
| no override, or `name: context-scout` | `overrides.claude-code.name: code-reviewer` on id `reviewer` | 2 |
| `agents/code/code-reviewer.md`, `category: code` | `agents/subagents/code/code-reviewer.md` | 5 |
| `release-manager`, `doc-writer` | `release-helper` (info note) | 4 |

## Lint rules

| Rule | Level | Checks |
| --- | --- | --- |
| `id-kebab-case` | warn | `oac.id` is kebab-case |
| `filename-is-id` | warn | file name equals `oac.id` |
| `id-agent-suffix` | warn | id does not end in `-agent` (unless a legacy exception) |
| `id-compound-word` | warn | id contains a known run-together word |
| `display-name` | warn | OpenCode `name` (frontmatter, else `oac.name`) is `PascalCase(id)` or `Open` + that; brand ids exempt |
| `host-name-override` | warn | `overrides.claude-code.name` differs from the id |
| `category-folder` | warn | the folder under `agents/` is not the category |
| `category-deprecated` | warn | category is `subagents[/x]`, `testing` or `development` |
| `subagents-folder` | warn | a `subagents/` path segment exists |
| `role-suffix` | info | last word is in the vocabulary |

Display-name derivation: split the id on `-`, capitalise each part, join. Parts in `ACRONYMS`
(`adr`) are upper-cased instead.

## Allow-lists and exceptions

Kept in the lint source, so each is visible and testable.

| Exception | Where | Why |
| --- | --- | --- |
| Brand ids `openagent` (`OpenAgent`), `opencoder` (`OpenCoder`) | `BRAND_IDS` | Product names. They are not hyphenated and their display name is the product spelling. |
| `Open` prefix on a display name | `display-name` rule | `OpenDevopsSpecialist`, `OpenFrontendSpecialist` predate the rule. |
| `coder-agent`, `build-agent` keep the `-agent` suffix | `LEGACY_AGENT_SUFFIX_IDS` | **Legacy exceptions, revisit.** They are plugin-facing names (`oac:coder-agent`); renaming them changes what Claude Code users type. |
| `adr` is upper-case in `ADRManager` | `ACRONYMS` | Established acronym. |

## Target layout

```
agent-library/
  agents/<category>/<id>.md     category only: core, code, planning, content, data, meta, system-builder, dev
  profiles/                     install tiers and context sets
```

Planned, not present: `skills/<id>/SKILL.md`, `commands/<id>.md`, `context/` (shared context docs).
