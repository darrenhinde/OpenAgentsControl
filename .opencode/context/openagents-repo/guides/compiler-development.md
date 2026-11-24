<!-- Context: openagents-repo/guides | Priority: high | Version: 1.0 | Updated: 2026-11-02 -->

# Guide: Changing the Compiler (`oac build`)

**Purpose**: Work on `packages/agent-compiler` or `packages/cli` itself, including adding a host.
**Prerequisite**: `core-concepts/canonical-build.md`. To add an agent instead, see `guides/authoring-agents.md`.

## Loop

```bash
make oac-cli            # pnpm build of packages/agent-compiler, then packages/cli (bundles dist/index.js)
make build-canonical    # run the freshly built `oac build` on this repo
make check-core         # the full health check; must pass before merge
```

`make check-core` runs, in order: `make check-canonical-drift` (builds, then fails if the build changed any
generated file), compiler tests (`pnpm --dir packages/agent-compiler exec vitest run`), CLI tests
(`cd packages/cli && bun test`), typecheck of both packages, `bun test scripts/validation` (change-detection
for CI), and `/bin/bash scripts/tests/test-flavor-install.sh` (installer flavors).
Run one piece alone with the same commands. CI runs the same gates in `.github/workflows/packages-checks.yml`.

If a compiler change alters generated output, run `make build-canonical` and commit the output with the change.
Run the built CLI from the repo root; `oac build` resolves `agent-library/` against the cwd.

## Where things live

| Concern | Path |
|---|---|
| Schemas (`oac:` block, profiles, permissions) | `packages/agent-compiler/src/types.ts` |
| Load, resolve, ship rule, pipeline, registry | `packages/agent-compiler/src/core/` (`AgentLoader`, `AgentIdResolver`, `DelegationRewriter`, `HostBlocks`, `TargetPolicy`, `BuildPipeline`, `RegistryEmitter`, `RegistryTargets`, `ProfileLoader`, `BuildManifest`, `HostsReadme`) |
| One adapter per host | `src/adapters/` (`OpenCodeAdapter`, `v1/OpenCodeV1Adapter`, `ClaudeAdapter`; `opencode/OpenCodeBaseAdapter` shared by the two OpenCode majors) |
| Lints run on every build | `src/verify/lint/{run,opencode,capability}.ts` |
| Host drivers for conformance runs | `src/hosts/{opencode,claude-code}/driver.ts` |
| CLI wiring (flags, printing) | `packages/cli/src/commands/*.ts`; `build.ts` holds `IN_PLACE_TARGETS` |

`BuildPipeline.plan()` loads agents, emits each via `emitAgent` (only if `TargetPolicy.emitsTo`), emits the
registries and `built-ai-configs/README.md`, and `write()` / `check()` apply or compare the plan, pruning only
files the ledger (`.oac/build-manifest.json`) owns and only under a target's roots (`TARGET_LAYOUT`).

## Tests

| Kind | Location |
|---|---|
| Unit: adapters, core, schema, build, lints | `packages/agent-compiler/tests/unit/{adapters,core,schema,types,build,verify}/` |
| Golden: fixtures in, byte-exact expected out; also asserts the committed Claude tree equals a fresh build | `packages/agent-compiler/tests/golden/` |
| CLI commands and install e2e (offline, host version stubbed) | `packages/cli/src/__tests__/`, `packages/cli/src/{commands,lib}/*.test.ts` |
| CI change detection | `scripts/validation/detect-pr-changes.test.ts` |
| Installer flavors (bash) | `scripts/tests/test-flavor-install.sh` |
| Real-host harness (supporting tier, off the merge path) | `evals/v2/` |

Update a golden file deliberately and say why in the commit; never loosen an adapter to match a golden.

## Add a host

1. `types.ts`: add the name to `BuildTargetSchema`. Every agent then defaults onto it (opt-out model), so decide
   what the host cannot express; each gap must produce a degradation warning, not silent output.
2. Adapter in `src/adapters/`: expose `fromCanonical(source, options)` returning the file content, warnings and
   path (model it on `ClaudeAdapter` for a flat, authored-override host, `OpenCodeBaseAdapter` for a
   frontmatter-subset host). Host-specific overrides go in `TargetOverridesSchema` in `types.ts`.
3. `core/BuildPipeline.ts`: add a branch in `emitAgent`, an entry in `TARGET_LAYOUT` (output root under
   `built-ai-configs/<host>/`, plus any mirror), and check that the target is in the roots pruning may touch.
4. `core/HostsReadme.ts`: add the host's description so `built-ai-configs/README.md` documents it;
   `core/CapabilityMatrix.ts` if the host's feature support is tracked.
5. `verify/lint/run.ts`: add a `LINTS` entry for the host's emitted files.
6. `packages/cli/src/commands/build.ts`: add the host to `IN_PLACE_TARGETS` (an unlisted target is refused).
7. Tests: adapter unit test, golden fixtures, a `host-blocks-build` / pipeline case; then `make build-canonical`
   and review the diff in `built-ai-configs/` and the README matrix.

To add an OpenCode-style registry variant instead, see `core/RegistryTargets.ts` (`REGISTRY_TARGETS`).
Removing OpenCode v1 later is listed in `docs/features/opencode-v1-and-v2.md`.

## Registry code vs registry data

`RegistryEmitter` rewrites only the agent, subagent and profile sections and carries every other section
through from the committed registry file. Context, command, skill and tool entries are edited by hand or by
the scripts in `scripts/registry/`; see `guides/updating-registry.md`.

## Related

`docs/architecture/CORE.md`, `packages/agent-compiler/README.md`, `docs/features/opencode-v1-and-v2.md`
