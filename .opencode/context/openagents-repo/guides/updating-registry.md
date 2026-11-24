<!-- Context: openagents-repo/guides | Priority: high | Version: 2.0 | Updated: 2026-11-02 -->

# Guide: Updating the Registry

**Purpose**: Keep `built-ai-configs/registry/registry.json` (and `registry.v1.json`) correct when you change components.

## Decide by component type

| You changed | Registry action |
|---|---|
| An agent or subagent (`agent-library/agents/**`) | none by hand: `make build-canonical` regenerates the entries and profiles |
| A profile (`agent-library/profiles/**`) | none by hand: rebuild |
| A skill or command (`agent-library/skills/**`, `agent-library/commands/**`) | nothing: the entry is generated from its `oac:` block; run `make build-canonical` |
| A context file (`agent-library/context/**`) | a registry entry is optional: add or edit it in `agent-library/context/components.json`; `make build-canonical` writes `components.contexts` in BOTH registries (below) |
| A tool, plugin, config | hand-edit the matching `components.<type>` array (v1 file only for v1-only assets) |

## Adding, renaming or removing a context file

1. Add/remove/rename the markdown file under `agent-library/context/` (use `git mv` / `git rm`). Never edit
   `.opencode/context/`: it is a generated verbatim copy and the drift gate fails on a hand edit.
2. To make it installable by `install.sh` and by `oac init --profile <tier>`, give it an entry in
   `agent-library/context/components.json`: `id` (unique across the file), `name`, `file` (path inside the
   library), description, tags, optional `dependencies` (`context:<id>` strings) and `aliases`, `"category"`.
   A file with no entry still ships in `oac init --profile full` and in the Claude `install-context` scripts,
   but no `install.sh` profile installs it. Remove or repoint any entry or other component's `dependencies`
   that names a deleted id. The array order is the registry order.
3. To ship it in a profile, add its id or a directory glob to a file in `agent-library/profiles/context/`.
4. `make build-canonical` copies the file to `.opencode/context/`, writes `components.contexts` in both
   registries and regenerates profiles. It also prints a report-only context lint (dead links, navigation
   entries that point at missing files, files not reachable from navigation). Then validate:

```bash
bash scripts/registry/validate-registry.sh
bun run scripts/registry/check-dependencies.ts
```

Do not run `scripts/registry/auto-detect-components.sh --auto-add` for this: it appends by scanning `.opencode/`
and, in this tree, proposes 85 unrelated "new" components (measured with `--dry-run`) and repoints ids that collide across folders. The
`update-registry` workflow that wraps it is manual-dispatch only. Dry-run it only as a read-only report.

## Frontmatter of context files

Context files carry `<!-- Context: <area>/<category> | Priority: ... | Version: ... | Updated: ... -->` as their first line
(format: `core/context-system/standards/mvi.md`, `templates.md`). Registry metadata is not read from the file.

## Version bump

Use `scripts/versioning/bump-version.sh`; see `guides/creating-release.md`.

## Related

`core-concepts/registry.md`, `quality/registry-dependencies.md`, `scripts/registry/README.md`
