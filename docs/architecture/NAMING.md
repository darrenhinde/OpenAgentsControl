# Naming and layout

Rules for ids and folders in `agent-library/`. Enforced by a **report-only** lint: `oac build`
prints violations in a separate "naming" section (`naming: <path> [rule] message`). They are not
counted in the degradation-warning baseline, are not affected by `--strict`, and never change the
exit code. Existing agents break several rules and are renamed in a later step; the lint is
promoted to failing once the tree is clean. Code: `packages/agent-compiler/src/verify/lint/naming.ts`.

## Rules

1. **Id is kebab-case and equals the file name.** Agent, skill and command ids are lowercase words
   joined by single hyphens; the file (or skill directory) is named exactly the id. The id never
   repeats the type: it must not end in `-agent`.
2. **One id on every host.** Display names derive from the id (`context-scout` becomes
   `ContextScout` on OpenCode; Claude Code uses the id as is). A per-host `name` in
   `oac.overrides` is discouraged and flagged unless it equals the derived default.
3. **Role suffix vocabulary.** `-scout` (finds), `-manager` (owns a lifecycle), `-specialist`
   (domain task), `-reviewer`, `-writer`, `-analyzer`, `-executor`, `-orchestrator`, `-generator`,
   `-creator`, `-designer`, `-engineer`, `-retriever`, `-organizer`, `-mapper`, `-responder`,
   `-runner`, `-engine`. Any other suffix is allowed and yields an info note only.
4. **Skills and commands follow the same id rules.** A skill is a noun or verb-first phrase
   (`code-review`); a command is a verb (`build`, `install-context`).
5. **One folder axis: category.** Under `agent-library/agents/` the only subfolders are
   categories: `core`, `code`, `planning`, `content`, `data`, `meta`, `system-builder`, `dev`.
   `subagents/` goes away; primary vs subagent is the existing `type` field.
6. **Renames keep working through aliases** (SPEC, not yet implemented). The `oac:` block gains
   `aliases: [old-id, ...]`. Each alias resolves to the current id and emits a deprecation
   warning naming the new id. The compiler implements this in step 2.

| Good | Bad | Rule |
| --- | --- | --- |
| `context-scout.md`, `id: context-scout` | `ContextScout.md`, `id: contextScout` | 1 kebab-case |
| `test-engineer.md`, `id: test-engineer` | `test-engineer.md`, `id: tester` | 1 file name = id |
| `coder`, `build` | `coder-agent`, `build-agent` | 1 no `-agent` |
| no override, or `name: context-scout` | `overrides.claude-code.name: code-reviewer` on id `reviewer` | 2 |
| `agents/code/code-reviewer.md` | `agents/subagents/code/code-reviewer.md` | 5 one folder axis |
| `release-manager`, `docs-writer` | `release-helper` (info note) | 3 |

## Lint rules

| Rule | Level | Checks |
| --- | --- | --- |
| `id-kebab-case` | warn | `oac.id` is kebab-case |
| `filename-is-id` | warn | file name equals `oac.id` |
| `id-agent-suffix` | warn | id does not end in `-agent` |
| `subagents-folder` | warn | no `subagents/` path segment |
| `host-name-override` | warn | `overrides.claude-code.name` differs from the id |
| `role-suffix` | info | last word is in the vocabulary |

Skills and commands are not linted yet; they are not canonical source types today.

## Target layout (planned)

```
agent-library/
  agents/<category>/<id>.md     category only: core, code, planning, content, data, meta, system-builder, dev
  skills/<id>/SKILL.md
  commands/<id>.md
  context/                      shared context docs
  profiles/                     install tiers and context sets
```

Today only `agents/` and `profiles/` exist there, and agents still sit partly under `subagents/`.
