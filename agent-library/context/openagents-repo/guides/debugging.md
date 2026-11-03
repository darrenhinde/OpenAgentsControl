<!-- Context: openagents-repo/guides | Priority: high | Version: 2.0 | Updated: 2026-11-02 -->

# Guide: Debugging Common Issues

**Purpose**: Triage for the failures you hit in this repo. Start with the quick diagnostics.

## Quick diagnostics

```bash
bun packages/cli/dist/index.js build --check --verbose   # drift and every degradation warning (run `make oac-cli` first)
bash scripts/registry/validate-registry.sh -v            # registry paths and dependencies
bun run scripts/registry/check-dependencies.ts
make check-core                                          # everything CI gates on
```

## Triage

| Symptom | Cause | Fix |
|---|---|---|
| Drift gate fails, lists `modified`/`missing` files | generated tree out of date, or a generated file was hand-edited | `make build-canonical`, commit the output; put the intended change in `agent-library/agents/**` |
| `oac build` validation error naming an agent file | frontmatter or `oac:` block invalid | table in `guides/authoring-agents.md` |
| `ClaudeAdapter: ... declares no oac.overrides.claude-code.tools` | agent ships to Claude without tools | add the override or `exclude: [claude-code]` |
| Lint error `[description-no-example]` and similar | capability lint on emitted Claude/OpenCode files | fix the source; lints are in `packages/agent-compiler/src/verify/lint/` |
| "names no canonical agent emitted for this target" | `task:` key, `subagent_type` or `subagent:` dependency points at an unknown or non-shipping agent | use an `oac.id` of an agent that ships to that host |
| Orphan removed on build | source deleted; expected | commit the removal |
| Registry: path does not exist | context/command entry points at a moved or deleted file | `guides/updating-registry.md` |
| Registry: dependency missing | `dependencies` names an id with no entry | add the entry or fix the id; `quality/registry-dependencies.md` |
| New agent not installable | not listed in any `agent-library/profiles/system/*.json` | add it and rebuild |
| Installed project loads both nested and flat agents | v1 files from an earlier install on OpenCode v2 | `oac update --opencode v2` migrates; `docs/features/opencode-v1-and-v2.md` |
| `oac doctor` version mismatch | recorded OpenCode major differs from `opencode --version` | `oac update --opencode v1|v2` |
| Tool permission denied during an eval | agent `permission:` lacks the tool | `errors/tool-permission-errors.md`, `standards/permission-patterns.md` |
| Install script fails | missing `curl` or `jq`, or unreachable registry URL | `which curl jq`; test locally with `REGISTRY_URL="file://$(pwd)/built-ai-configs/registry/registry.json" ./install.sh --list` |

## Eval failures

Run one test with debug output: `cd evals/framework && npm run eval:sdk -- --agent=<id> --pattern="smoke-test.yaml" --debug`.
Suites live under `evals/agents/`; see `core-concepts/evals.md` and `guides/testing-agent.md`.

## Related

`core-concepts/canonical-build.md`, `lookup/commands.md`
