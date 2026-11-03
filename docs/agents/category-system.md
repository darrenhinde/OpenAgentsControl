# Agent categories

**Status**: Active. Rewritten for the canonical layout; the old `.opencode/agent/<category>/` and
`subagents/` tree described here before no longer exists.

Agents are written once, in `agent-library/agents/<category>/<id>.md`, and built into every tool's format
(`oac build`). The folder is the **category**, one level deep, and `oac.category` must equal it.

| Category | Holds |
| --- | --- |
| `core` | The coordinators users talk to (`openagent`, `opencoder`) and the workflow helpers they delegate to (`context-scout`, `task-manager`, `doc-writer`, ...) |
| `code` | Implementation and review (`coder-agent`, `code-reviewer`, `test-engineer`, `build-agent`) |
| `planning` | Architecture, ADRs, prioritisation, story mapping |
| `content` | Writing and images (`copywriter`, `technical-writer`, `image-specialist`) |
| `data` | Data analysis |
| `meta` | Agents that build OAC itself (`system-builder`, `repo-manager`) |
| `system-builder` | The generators `system-builder` delegates to |
| `dev` | Development specialists and test fixtures (`frontend-specialist`, `devops-specialist`, `eval-runner`) |

Whether an agent is primary or a subagent is the `type:` field (`agent` or `subagent`), independent of category.
There is no `subagents/` folder. The old categories `subagents`, `development` and `testing` still build but are
deprecated and lint-warned.

## Using an agent

Agents are addressed by their `id` (`oac.id`), not by a category path:

```bash
./install.sh developer                    # or: oac init --profile developer
opencode run --agent frontend-specialist "..."   # OpenCode v2
```

A subagent is reached by delegation from another agent, never run directly.

## Adding one

See [agent-library/README.md](../../agent-library/README.md) ("Adding a thing") for the exact steps, and
[NAMING.md](../architecture/NAMING.md) for the id and folder rules. A new category is a change to the schema
(`packages/agent-compiler/src/types.ts`) and to NAMING.md, not something a contributor invents in a folder name.
