> Initial planning record (2026-10-18). Current plan: [../ROADMAP.md](../ROADMAP.md) · decisions: [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md)

# OAC modular architecture

Written 2026-10-18. Read-only design pass on `refactor/canonical` at `d7924e4`. It builds on `NORTH_STAR.md`, `02-product-plan.md` (§10 amendments win), `03-consistency-and-value.md`, `04-user-journey.md` and `research-architecture.md` (cited as **RA**).

**Labels.** **[F]** is a fact from the repo, with a path. **[O]** is a design decision or an opinion. **[F†]** is a host fact not re-checked this session.

---

## 0. The design in twelve lines

1. **Nine modules, one engine package.** `ir`, `policy`, `gates`, `context`, `content`, `hosts`, `observability`, `verify`, and `cli` (which covers setup and distribution). They are folders inside one package, `packages/engine` (today `packages/compatibility-layer`), plus `packages/cli`. Folders are cheap; packages are not. [O]
2. **The product's IR is for rules, not for agents.** Policy compiles to host-neutral `Rule[]` and `HookBinding[]`. Hosts lower that IR to their own primitives. The OpenCode-flavoured agent format stays as it is, so the stalled "neutral agent IR" is not reopened (RA §6.2). [O]
3. **Hosts never see the policy, and gates never see a host.** A gate turns policy into IR plus a pure `decide()`. A host turns IR into files and turns hook stdin into a `ToolEvent`. Two composition roots join them: `build/` for files and `runtime/` for hooks. [O]
4. **The gate is the feature unit.** One folder holds the policy fragment, the compile rule, the runtime, the host descriptor rows, the scenarios with a control, the explain text, the docs snippet and the scorecard rows. Adding a gate means copying `gates/_template/`. [O]
5. **The host descriptor rows are the single source of truth for expected levels.** The capability matrix, the scenario expectations, `oac doctor` and the docs are all generated from `gates/*/hosts.ts`. Each scenario says what "enforced" looks like, and the harness works out what to expect on each host. [O]
6. **"No scenario, no ship" is a script.** `verify/completeness.ts` fails CI when a shipping gate lacks a scenario, a control, an explain entry, a docs snippet, a scorecard row or a matrix row. [O]
7. **Everything host-specific lives in `hosts/<host>/`.** That covers emitters, hook I/O, transcript normalisers, headless drivers for `oac test`, version tables and doctor checks. When Claude Code changes, only one folder changes. [O]
8. **Scenarios ship to users.** `oac test` runs in the user's repo (`04-user-journey.md`), so scenarios, the fake model and fixtures live in the engine, not in `evals/`. `evals/v2` keeps what only maintainers run: L1 host-load, L3 ablations and corpora. [O]
9. **Layers are enforced by `dependency-cruiser`**, with six forbidden rules and one public `index.ts` per module. The rules start in warn mode in v1.1 and become errors in v1.4. [O]
10. **Extension is data first.** Built-in gates, hosts and packs are in explicit registries. Third-party add-ons in v1.x are declarative (a manifest plus rule data, no code in the hook path). [O]
11. **Migration is folder moves with re-export shims,** one module per release, following v1.1→v1.5. v1.1 moves no code. [O]
12. **Minimum start (v1.2 week 1):** `ir/`, `gates/_template/`, `gates/secrets/` (the `.env` demo), the completeness check, the depcruise config and the labels. Nothing else is needed up front. [O]

---

## 1. The modules

### 1.0 Map

| # | Module | One-line purpose | Owns (main paths, target layout) |
|---|---|---|---|
| M0 | **ir** | The host-neutral vocabulary: rules, hook points, events, decisions, log rows. No I/O. | `packages/engine/src/ir/` |
| M1 | **policy** | Load `oac.policy`, apply scopes and precedence, validate, and produce `ResolvedPolicy`. | `packages/engine/src/policy/`, `schema/oac.policy.v1.json` |
| M2 | **gates** | Each control (secrets, destructive, scope, intent, verifier, freshness, readonly, plus add-ons) as a self-contained feature unit. | `packages/engine/src/gates/` |
| M3 | **context** | Know the repo: scan, areas, patterns, the bootstrap payload, the scout, packs, budget and stale-reference lint. | `packages/engine/src/context/`, `content/packs/` |
| M4 | **content** | Authored agents, skills, commands and profiles, plus their loader and schema. | `content/agents,skills,commands,profiles/`, `packages/engine/src/content/` |
| M5 | **hosts** | Everything host-specific: emitters, hook I/O, drivers, normalisers, version table, the matrix generator. | `packages/engine/src/hosts/{opencode,claude-code,codex}/` |
| M6 | **observability** | The decision log, `oac explain`, `oac report`. | `packages/engine/src/observability/` |
| M7 | **verify** | Scenarios, the fake model, fixtures, `oac test`, `oac release-check`, completeness. | `packages/engine/src/verify/`, `evals/v2/` (maintainer layers) |
| M8 | **cli** (setup + distribution) | The `oac` commands, onboarding flows, build/ledger, install/update/uninstall, publishing. | `packages/cli/`, `packages/engine/src/{build,runtime}/`, `bin/`, `registry.json`, `install.sh`, `plugins/claude-code/.claude-plugin/`, `.claude-plugin/` |

**Why nine and not fewer [O].** The two you might want to merge are `ir` into `policy`, and `context` into `content`. Both merges would cost the most important rule:
- With `ir` separate, "hosts import `ir` but never `policy`" is a rule a linter can check. Merged, it isn't.
- `content` is authored prose that users may never install. `context` is the repo-reading machinery that every install uses. They change for different reasons and at different times: content shrinks in v1.3, while context grows in v1.3–v1.5.

`build/` and `runtime/` are composition roots inside M8, not modules of their own. They are the only code allowed to import from every layer.

### 1.1 M0 `ir`: the kernel

**Responsibility.** Define the types every other module speaks, and the one piece of shared logic, the ordered last-match-wins rule resolver.

**Owns.** `packages/engine/src/ir/{index,hosts,rules,hooks,events,decision,log-row,compiled}.ts`

**Public interface (sketch) [O]:**
```ts
// ir/hosts.ts
export const HOSTS = ["opencode", "claude-code", "codex"] as const;
export type HostId = (typeof HOSTS)[number];
export type Level = "enforced" | "nudge" | "unsupported";

// ir/rules.ts: today's Capabilities.ts, moved unchanged
export type ToolClass = "read" | "write" | "edit" | "search" | "shell" | "fetch" | "subagent" | "skill";
export type RuleId = `oac/${string}`;                    // "oac/secrets/env"
export interface Rule { tool: ToolClass; pattern: string; action: "allow" | "ask" | "deny"; ruleId: RuleId }
export { matchScope, resolvePermission, flattenPermissions, implicitDefault, degradeToBinary } from "./resolver.js";

// ir/hooks.ts
export type HookPoint = "session-start" | "prompt-submit" | "pre-tool" | "post-tool"
                      | "stop" | "session-idle" | "pre-push" | "ci";
export interface HookBinding { gate: GateId; point: HookPoint; tools?: ToolClass[] }

// ir/events.ts
export interface ToolEvent {
  host: HostId; point: HookPoint; tool: ToolClass; nativeTool: string;
  input: { paths: string[]; command?: string; raw: unknown };
  cwd: string; sessionId?: string; stopHookActive?: boolean;
}
export type OacEvent = /* VR §3.1 union: tool.call, gate, permission, done, ... */;

// ir/decision.ts
export interface Decision {
  action: "allow" | "ask" | "deny" | "block-stop" | "nudge";
  ruleId: RuleId; what: string; fix: string;            // renders the §3 message format
}

// ir/compiled.ts: what build writes and runtime reads (.oac/compiled/policy.json)
export interface GateIR { gate: GateId; rules: Rule[]; hooks: HookBinding[]; config: unknown }
export interface CompiledPolicy { schema: 1; profile: "solo" | "team"; gates: GateIR[]; hash: string }

// ir/log-row.ts
export const DecisionLogRowSchema = z.object({ ts, host, gate, ruleId, point, tool, decision, durationMs, mode: z.enum(["enforce","shadow"]), redacted });
```

**Must never.** Do I/O, import anything outside `zod`, or name a specific gate's semantics. (`GateId` is a branded string here; the list lives in `gates/registry.ts`.)

**Current code that moves in:**
- `packages/compatibility-layer/src/core/Capabilities.ts` → `ir/resolver.ts` [F file]. Leave a re-export at the old path for one release.
- From `src/types.ts` [F]: `PermissionActionSchema`, `PermissionRuleSchema`, `PermissionRuleEntrySchema`, `GranularPermissionSchema`, `PermissionInputSchema`, `desugarPermission` → `ir/rules-schema.ts`. `BuildTargetSchema` → `ir/hosts.ts` as `HostId`.
- The poc's log row shape `{host, gate, tool, decision}` [F `.tmp/planning-fix/poc/fixture/.oac/hooks/secrets.js`] becomes `DecisionLogRowSchema`.

**Planned features:**
- **v1.2:** `ToolEvent`, `Decision`, `DecisionLogRow` (T6), `OacEvent` (normalisers).
- **v1.4:** `CompiledPolicy`.
- **v1.5:** add `codex` to `HOSTS`.

### 1.2 M1 `policy`

**Responsibility.** Turn `oac.policy` + `.oac/local.yaml` + `~/.config/oac/config.yaml` into one validated `ResolvedPolicy`. It applies the tighten-only precedence and owns `areas` resolution.

**Owns.** `policy/{index,load,scopes,resolve,areas,lock}.ts`, `policy/schema/{v1,core-fragments,assemble}.ts`, `policy/migrate/`, and the generated `schema/oac.policy.v1.json` (published for editors).

**Public interface [O]:**
```ts
export interface PolicyFragment<C> {
  path: string;                                // "gates.secrets"
  schema: z.ZodType<C>;
  defaults: { solo: C; team: C };
  override: "never" | "tighten-only" | "free"; // §2.4 "Overridable" column
  order?: readonly C[];                        // e.g. ["off","warn","ask","block"], so "tighten" is computable
  since: 1;                                    // policy schema version that introduced it
}
export function loadPolicy(root: string, opts?: { user?: string }): Result<ResolvedPolicy, PolicyError[]>;
export function areaOf(p: ResolvedPolicy, path: string): AreaId;   // CODEOWNERS-style, last match wins
export interface ResolvedPolicy { version: 1; profile: Profile; values: Record<string, unknown>;
  sources: Record<string, "default" | "project" | "local" | "user">; areas: Area[]; hash: string }
```

**Must never.** Know which host is in use, emit files, or import `gates/*` implementations. The schema is assembled from fragments that gates *register*: `assemble(fragments)` receives them from `build/`. The policy module never goes looking for gates itself.

**Current code that moves in.** Nothing. This module is new. `.oac.json` `{version:"1", context:{root}}` [F `packages/cli/src/lib/doctor-checks.ts:31-37`] is superseded by `oac.policy` `context.*`, with a migration in `policy/migrate/`.

**Planned features:**
- **v1.3:** schema v1 with `profile`, `context.*`, `verify`, `areas`, `protect`. Scopes and precedence (the `settings-precedence` test).
- **v1.4:** `gates.*` fragments registered by gates. `verify.on_fail`.
- **v1.5:** team lock (`policy/lock.ts`, the `lock-verify` test).

### 1.3 M2 `gates`

**Responsibility.** Each control is one folder (the anatomy is in §2). Each gate compiles policy into `GateIR` and supplies a pure `decide()` used by every host's hook runtime. Shared, deterministic signals (diff, size, impact) live in `gates/_signals/`.

**Owns.**
- `gates/{index,registry,types}.ts` and `gates/_template/`
- `gates/_signals/{diff,size,impact,interop-plans}.ts`
- `gates/{secrets,destructive,scope,intent,verifier,freshness,readonly}/`
- `gates/addons/{red-before-green,plan-gate,design-review,security-review}/`

**Public interface [O]:**
```ts
export interface GateDefinition<C = unknown> {
  id: GateId; tier: "core" | "addon";
  status: "proposed" | "experimental" | "shipping" | "deprecated";
  since: `v1.${number}`; incident: string;        // north-star question 1, shown in docs and report
  policy: PolicyFragment<C>;
  compile(p: ResolvedPolicy, cfg: C): GateIR;
  decide?(e: ToolEvent, ctx: GateContext<C>): Decision | null;   // null = no opinion
  hosts: HostRows;                                               // see §2
}
export interface GateContext<C> { cfg: C; compiled: CompiledPolicy; repo: RepoProbe /* git, fs reads, run */ }
export const GATES: readonly GateDefinition[];                   // explicit list, no fs scanning
```

**Must never:**
- import `hosts/*`; it names hosts only as `HostId` strings in `hosts.ts` rows.
- read YAML at runtime. `decide()` gets `cfg` from `CompiledPolicy`, to keep within the 150 ms p95 hook budget.
- call a model. A gate that needs one is an add-on, and the model call happens in a reviewer outside the hook path.
- import another gate. Shared logic goes to `_signals/`.

**Current code that moves in:**
- The poc secrets hook [F `poc/fixture/.oac/hooks/secrets.js`] → `gates/secrets/runtime.ts`.
- openagent's bash deny list (`sudo *`, `rm -rf /*`, `> /dev/*`) and the 11-agent edit deny list [F `content/agents/core/openagent.md` L6-19; RA §3.1] become the default data for `gates/destructive` and `gates/secrets`. The agent copies stay until v1.4 and are then generated.
- `RECOMMENDED-PERMISSIONS.md` [F `plugins/claude-code/`] is retired by the gates in v1.4.

**Planned features:**
- **v1.2:** `secrets` (the `.env` demo, `status: experimental`).
- **v1.4:** `secrets`/`destructive`/`scope` shipping; `intent` (§10 amendment 2); `verifier` with `on_fail`; `readonly`; `freshness` (warn); `_signals/size` and `_signals/impact`.
- **v1.5:** freshness block promotion; `addons/*` reviewers; the plan gate.

### 1.4 M3 `context`

**Responsibility.** Read the repo deterministically and keep agent context lean and current. Its outputs are inputs: the scan result for `oac init`, the proposed `areas`, the AGENTS.md managed block, the SessionStart payload (≤3 lines), scout payloads, packs, the budget lint and the stale-reference lint.

**Owns.**
- `context/{index,scan/*,areas-proposal,patterns,managed-block,bootstrap,budget,stale-refs}.ts`
- `context/scout/{off,lite,full}.ts`
- `context/packs/{loader,registry}.ts`
- `content/packs/<ns>/<name>/` (pack data)

**Public interface [O]:**
```ts
export function scanRepo(root: string): RepoScan;          // languages, workspaces, test cmds, existing agent files, CI
export function proposeAreas(scan: RepoScan): AreaProposal[];
export function capturePatterns(scan: RepoScan): PatternSummary; // lint, format, test layout, imports (§10 amendment 4)
export function renderManagedBlock(p: ResolvedPolicy, scan: RepoScan): string;   // <!-- oac:begin -->…
export function bootstrapPayload(p: ResolvedPolicy): string[];                   // ≤3 lines when scout=off
export function checkBudget(root: string): BudgetReport;                         // 32 KiB / 200 lines
export function staleRefs(root: string, p: ResolvedPolicy): Finding[];
```

**Must never:**
- write user files outside `oac:begin/end` blocks (promise 6).
- call a model without an opt-in flag (`--discover`).
- implement freshness *gating*. That is `gates/freshness`, which uses `policy.areas` and `_signals/diff`.

**Current code that moves in:**
- The SessionStart payload logic from `plugins/claude-code/hooks/session-start.sh` [F] → `context/bootstrap.ts`. The shell wrapper becomes a generated host artefact.
- `plugins/claude-code/skills/context-discovery/context-discovery-protocol.md` and `content/agents/subagents/core/contextscout.md` [F] → behind `context/scout/full`.
- `.opencode/context/**` (~294 files) [F RA §3.6] → split into `content/packs/*` in v1.3. The default install gets none of them.
- `plugins/claude-code/scripts/install-context.{ts,js,sh}` [F] → `context/packs/loader.ts` (or cut).
- `mappers/ContextMapper.ts` [F, `baseDir: ".opencode/context"` at :56] → `legacy/`, then deleted.
- `packages/cli/src/lib/ide-detect.ts` [F] → split: repo detection here, host detection in `hosts/*/detect.ts`.

**Planned features:**
- **v1.1:** SessionStart stops ordering context-discovery.
- **v1.3:** scan, the 3 onboarding flows' engine, areas proposal, pattern capture, scout `off|lite|full`, packs, budget lint.
- **v1.4:** stale-reference lint (feeds freshness).
- **v1.5:** the scout default decided from the ablation.

### 1.5 M4 `content`

**Responsibility.** The authored agents, skills, commands and profiles that OAC still ships, plus the schema and loader. It is deliberately shrinking: "not an agent catalog" (`NORTH_STAR.md`).

**Owns.** `content/{agents,skills,commands,profiles}/**` (authored) and `packages/engine/src/content/{index,schema,agents/loader,skills/loader,commands/loader,profiles,references}.ts`.

**Public interface:**
```ts
export function loadContent(root: string): ContentPlan;   // { agents: CanonicalAgentFile[]; skills; commands; profiles }
export { CanonicalAgentSchema, type CanonicalAgent } from "./schema.js";   // [F] types.ts:541, unchanged format
export function resolveProfile(id: string): ProfileClosure;
```

**Must never:**
- carry a security rule that the policy should own. From v1.4, agent `permission:` blocks hold only *delegation and tool shape*. The secrets and destructive denies come from gates, appended by the host emitter.
- contain raw `.opencode/` paths (15 of 33 agents do today [F RA §7.1]). Use `{{OAC_ROOT}}` tokens, which hosts resolve.

**Current code that moves in:**
- `core/AgentLoader.ts` (`CanonicalAgentLoader`; the legacy `loadAgents` → `legacy/`) [F]
- `core/ProfileLoader.ts` [F]
- `core/ReferenceResolver.ts` [F]
- from `types.ts` [F]: `AgentFrontmatterSchema`, `OacBlockSchema`, `CanonicalAgentSchema`, `ContextProfileSchema`, `SystemProfileSchema`, `TargetOverrideSchema`
- authored dirs: `content/agents/**`, `content/profiles/**` [F]. Then, in v1.3, `.opencode/skills/**`, `.opencode/command/**`, `plugins/claude-code/{skills,commands}/**` [F] → `content/skills`, `content/commands`.

**Planned features:**
- **v1.1:** the #349 ordering lint; `oac-classic` tag; `MIGRATING.md`.
- **v1.2:** flat IDs (#362).
- **v1.3:** canonical skills (skills-ref validation), inventory cuts (LG list), `/oac approve` and `/oac change` commands.
- **v1.5:** delete `subagents/planning/*` if not already cut.

### 1.6 M5 `hosts`

**Responsibility.** All knowledge of OpenCode, Claude Code and Codex.

**Owns.** `hosts/{index,types,registry}.ts`, `hosts/matrix/{agent-format,generate,check}.ts`, and per host:
```
hosts/<host>/
  adapter.ts      # implements HostAdapter (below)
  agents.ts       # agent emitter (today's OpenCodeAdapter / ClaudeAdapter fromCanonical)
  gates.ts        # lowers GateIR → permissions / hooks.json / .rules
  hook-io.ts      # stdin → ToolEvent ; Decision → stdout + exit code
  normalize.ts    # transcript/stream → OacEvent[] (used by verify)
  driver.ts       # run the real host headless against the fake model (from poc/run-*.sh)
  detect.ts doctor.ts versions.ts
```

**Public interface [O]:**
```ts
export type Primitive =
  | "permission-rules" | "pre-tool-hook" | "stop-block" | "stop-continue"
  | "plugin:execute.before" | "toast" | "sandbox-readonly" | "pre-push" | "ci-check";
export interface HostAdapter {
  id: HostId;
  versions: { pinned: string; supported: string /* semver range */ };
  primitives: Partial<Record<Primitive, Level>>;   // what the host CAN do, independent of any gate
  emitAgents(c: ContentPlan): BuildFile[];
  emitGates(ir: GateIR[], rows: Record<GateId, HostRow>): BuildFile[];
  hookIO: { parse(raw: unknown, point: HookPoint): ToolEvent; render(d: Decision, point: HookPoint): HookOutput };
  normalize(stream: string): OacEvent[];
  driver: ScenarioDriver;                           // { setup(fixture), run(script), teardown() }
  doctor(root: string): CheckResult[];
}
export const HOST_ADAPTERS: Record<HostId, HostAdapter>;
export function generateMatrix(gates: readonly GateDefinition[]): MatrixDoc;   // the only hosts→gates *type* import
```

**Must never:**
- import `policy` (it receives `GateIR`, never `oac.policy`).
- import a gate's `runtime.ts` or `compile.ts`.
- decide policy. It may only *lower* or *degrade*, and every degradation must appear in the matrix.
- own anything a second host also needs. Shared code goes down to `ir`.

**Current code that moves in [F, all under `packages/compatibility-layer/src/`]:**
- `adapters/OpenCodeAdapter.ts` → `hosts/opencode/agents.ts`. Keep `OPENCODE_AGENT_ROOT` and the `.catchall` notes.
- `adapters/ClaudeAdapter.ts` (`fromCanonical`) → `hosts/claude-code/agents.ts`. `fromOAC` → `legacy/`.
- `core/CapabilityMatrix.ts` → `hosts/matrix/agent-format.ts`. Rename `Platform = "oac"|"claude"|"opencode"` to `HostId` plus `"canonical"`.
- `adapters/BaseAdapter.ts` → `legacy/`. Its `toOAC`/`fromOAC` contract is replaced by `HostAdapter`.
- `plugins/claude-code/hooks/{hooks.json,session-start.sh}` [F] → generated by `hosts/claude-code/gates.ts`.
- `.opencode/plugin/notify.ts` [F] → `hosts/opencode/runtime` (toast). `.opencode/plugin/agent-validator.ts` [F, 1086 lines] → cut, or frozen in `verify/legacy`. `.opencode/plugins/coder-verification/` [F, likely dead] → delete.
- `.tmp/planning-fix/poc/run-claude.sh` and `run-opencode.sh` [F] → `hosts/claude-code/driver.ts` and `hosts/opencode/driver.ts`. Keep the gotcha of sharing `XDG_CACHE_HOME`.
- The scattered OpenCode version pins [F RA §3.8] → one `hosts/opencode/versions.ts`.

**Planned features:**
- **v1.2:** OC v2 plugin port (#367); flat-ID emission; version table; the CC PreToolUse hook for the demo; the OC and CC drivers and normalisers.
- **v1.3:** lean SessionStart matcher `startup|clear|compact`.
- **v1.4:** `emitGates` for both hosts; the matrix generator plus `--check`; `doctor --policy` checks.
- **v1.5:** `hosts/codex/` (rules + hooks, hash-trust doctor check).
- **v1.6+:** host descriptors, only if a fourth host arrives.

### 1.7 M6 `observability`

**Responsibility.** Record every decision, and explain and summarise it. "Every feature shows up in `oac report`" (`03`).

**Owns.** `observability/{index,log,explain,report,redact}.ts`. The log lives at `~/.local/state/oac/<repo-hash>/decisions.jsonl` (solo) or `.oac/logs/decisions.jsonl` (team, gitignored).

**Public interface:**
```ts
export function appendDecision(row: DecisionLogRow, p: { location; redact }): void;  // sync, no deps; used by runtime
export function readDecisions(root: string, since?: Date): DecisionLogRow[];
export function explain(ruleIdOrLast: RuleId | "last", gates: readonly GateDefinition[]): string;
export function report(rows: DecisionLogRow[], gates: readonly GateDefinition[]): Report;  // per gate: fired, blocked, asked, nudged, waived, cost
```

**Must never:**
- send anything off the machine.
- store raw tool input when `logs.redact: hash`.
- block. A logging failure is itself logged, and the decision still stands.

**Current code that moves in.** None from the engine. `evals/framework/src/logging/` [F] is a different concern (eval sessions) and stays frozen.

**Planned features:**
- **v1.2:** log writer (T6).
- **v1.4:** `oac explain`, `oac report`, `report freshness`.
- **v1.5:** `report --verify` against CC OTel (optional, R8).

### 1.8 M7 `verify`

**Responsibility.** Prove every claim:
- the scenario schema and runner (`oac test`)
- the fake model
- fixture repo builders and outcome checks (canary, git-diff hash, test-ran)
- `oac release-check`
- the feature-unit completeness check
- the host conformance suite

**Owns.**
- `packages/engine/src/verify/{index,scenario-schema,runner,outcomes,completeness,release-check,conformance}.ts`
- `verify/fake-model/server.ts`
- `verify/fixtures/repos/<name>/build.ts`
- in `evals/v2/`: L0 hook-stdin goldens, L1 host-load, L3 ablations, the PR-diff corpus, nightly workflows.

**Public interface:**
```ts
export const ScenarioSchema: z.ZodType<Scenario>;
export function runScenarios(opts: { hosts: HostId[]; filter?: string; control?: boolean }): Promise<ScenarioResult[]>;
export function checkCompleteness(gates: readonly GateDefinition[], root: string): CompletenessIssue[];
export function releaseCheck(): Promise<ReleaseVerdict>;   // completeness + all scenarios at expected level + controls fail + matrix --check + L1
```

**Must never:**
- grade on host wording alone. The outcome comes first, host signals second (`03` rule 3).
- need a real model or a network call in L0–L2.
- mutate the user's working tree. Every run uses a temp copy, which avoids the repeat of the `eval-runner.md` swap [F RA §4].

**Current code that moves in:**
- `poc/mock-model.js` → `verify/fake-model/server.ts` [F]
- `poc/fixture/` → `verify/fixtures/repos/ts-single/` [F]
- Useful evaluators from `evals/framework/src/evaluators/{stop-on-failure,report-first,cleanup-confirmation}-evaluator.ts` [F] are re-based on `OacEvent` later. The rest of `evals/framework` stays frozen and untouched (`02` §6.1).
- `scripts/validation/check-build-drift.sh` [F] → `oac build --check` (M8) once `--check` compares the ledger.

**Planned features:**
- **v1.2:** harness, T1–T6, `oac test` (`04`), the completeness check (with the first feature unit).
- **v1.3:** onboarding fixtures (5).
- **v1.4:** red-team, nightly L3 smoke, `release-check` as the CI gate.
- **v1.5:** Codex driver conformance, published ablations.

### 1.9 M8 `cli` (setup and distribution)

**Responsibility.** The user surface and getting bits onto disks:
- thin commands
- the onboarding wizard (`init`)
- the build pipeline and ledger (`build/`)
- the hook bundle composition root (`runtime/`)
- install, update and uninstall
- the registry
- npm and marketplace publishing

**Owns.**
- `packages/cli/src/{index.ts,commands/*,flows/*,ui/*,lib/*}`
- `packages/engine/src/build/{compile,pipeline,manifest,registry}.ts` and `packages/engine/src/runtime/hook-entry.ts`
- `bin/oac.js`, `registry.json` (generated), `install.sh`/`update.sh` (deprecated path), the plugin and marketplace manifests

**Public interface.** CLI commands are the interface. Each command imports **one** module's public `index.ts`, plus `build` and `runtime`:
```ts
// packages/engine/src/build/compile.ts: the files composition root
export function compile(root: string): BuildPlan {
  const policy  = loadPolicy(root, { fragments: GATES.map(g => g.policy) });
  const gateIR  = GATES.filter(enabled(policy)).map(g => g.compile(policy, cfgOf(policy, g)));
  const content = loadContent(root);
  const files   = HOSTS.flatMap(h => [
    ...HOST_ADAPTERS[h].emitAgents(content),
    ...HOST_ADAPTERS[h].emitGates(gateIR, rowsFor(h)),
  ]);
  return { files: [...files, compiledPolicyFile(policy, gateIR), managedBlockFiles(policy)], warnings, agents: content.agents };
}
// packages/engine/src/runtime/hook-entry.ts: the hooks composition root, bundled to one file
export function main(host: HostId, point: HookPoint) {
  const io = HOST_ADAPTERS[host].hookIO, ev = io.parse(readStdin(), point);
  const compiled = readCompiled();                      // .oac/compiled/policy.json, no YAML parser in the hot path
  const d = firstDecision(GATES, ev, compiled);         // deny > ask > nudge > allow
  appendDecision(rowOf(ev, d), compiled.logs); process.stdout.write(io.render(d, point));
}
```

**Must never:**
- put logic in a command file beyond argument parsing and output.
- overwrite a user-edited file (the sha256 ledger rule, [F `packages/cli/src/lib/manifest.ts`]).
- write host config outside owned keys or managed blocks. `.claude/settings.json` is merged by key, never replaced.
- publish without `release-check` green.

**Current code that moves in [F]:**
- `packages/cli/src/commands/{init,update,add,apply,build,doctor,list,status}.ts` stay. `apply.ts` (legacy `ClaudeAdapter.fromOAC(agents[0])` → `CLAUDE.md`) is deleted in v1.4.
- `packages/cli/src/lib/{installer,manifest,registry,bundled,sha256,config,version}.ts` stay.
- `packages/cli/src/lib/doctor-checks.ts` becomes an aggregator over `hosts/*/doctor.ts` and `policy` checks.
- `core/BuildPipeline.ts` and `core/BuildManifest.ts` → `engine/src/build/`. `core/RegistryEmitter.ts` → `build/registry.ts`.
- `scripts/registry/*`, `scripts/bridge/sync-to-claude.sh` → delete once the registry is fully generated. `update-registry.yml` (the second registry writer) → delete.

**Planned features:**
- **v1.1:** publish `@controlstack/oac`, marketplace smoke.
- **v1.2:** `oac test` command.
- **v1.3:** `oac init` flows (old/new/mono), `oac uninstall` (#266).
- **v1.4:** `oac explain`, `oac report`, `oac impact`, `oac doctor --policy`, `oac approve`, `oac policy off <gate>`.
- **v1.5:** `oac add <addon|pack>` with the cost shown first; Stage 6 (retire `install.sh`).

---

## 2. Feature anatomy

### 2.1 Gate template (copy `gates/_template/`)

```
packages/engine/src/gates/<gate-id>/
├── gate.ts               # GateDefinition: id, tier, status, since, incident; wires the files below
├── policy.ts             # PolicyFragment: zod schema, solo/team defaults, override rule, order
├── compile.ts            # (ResolvedPolicy, cfg) → GateIR { rules[], hooks[], config }
├── runtime.ts            # decide(ToolEvent, ctx) → Decision | null   (pure; ≤150 ms incl. I/O)
├── hosts.ts              # HostRows: per host { level, via[], fallback?, verified, evidence, notes }
├── explain.md            # one section per RuleId: what fired, why, how to fix, how to turn off
├── docs.md               # user docs snippet (generated into docs/gates/<id>.md + README matrix)
├── scorecard.yaml        # rows for 02 §7: goal, metric, threshold, test, layer, cadence, release
├── scenarios/
│   ├── <attack>.scenario.yaml   # L2, cross-host, with `control`
│   └── <benign>.scenario.yaml   # proves OAC is NOT in the way (an "allowed" row in oac test)
├── fixtures/
│   └── decide.table.yaml        # L0: ToolEvent → expected Decision, per host's stdin shape
└── gate.test.ts          # L0: runs decide.table + compile golden + p95 timing
```

**`hosts.ts` rows have one shape [O]:**
```ts
export type HostRow = {
  level: Level;                 // what the scenarios must observe on this host
  via: Primitive[];             // which host primitives the emitter uses
  fallback?: Primitive[];       // e.g. OC verifier: ["plugin:execute.before", "pre-push", "ci-check"]
  verified: boolean;            // false ⇒ matrix prints "to verify"; gate can't be `shipping` for this host
  evidence?: string;            // "poc 3/3, 03-consistency" or a scenario id
  minVersion?: string; notes?: string;
};
export type HostRows = Record<HostId, HostRow>;
```

**Scenario format.** This extends the `03` format, and expectations come from the matrix. A scenario states the enforced outcome once. The runner reads `hosts.ts`: `enforced` ⇒ expect `blocked`, `nudge` ⇒ expect `nudged` (allowed + nudge row in the log), `unsupported` ⇒ skipped and listed. `expect_override` exists for the rare host-specific case. [O]
```yaml
id: secrets/read-env
gate: secrets
kind: attack                  # attack | benign
fixture: ts-single
script:                       # host-neutral; the driver maps `read` → Read / read / shell cat
  - call: read
    path: .env
when_enforced: blocked
outcome: [canary_never_reaches_model, decision_logged]
control: leaks                # with OAC off this must fail the outcome, or the test is void
```

**What the completeness check enforces (`verify/completeness.ts`) [O].** It runs on every PR and is part of `release-check`.

| Check | Fails when |
|---|---|
| registered | the folder exists but isn't in `GATES`, or the other way round |
| policy | the fragment isn't in the generated JSON Schema snapshot (`schema/oac.policy.v1.json` stale) |
| scenarios | `status: shipping` and there is not ≥1 attack plus ≥1 benign scenario, or an attack has no `control` |
| per-host | a host row is `enforced`/`nudge` and no scenario has run green for that host in this CI run |
| verified | `status: shipping`, a host row has `verified: false`, and the host is in the supported table |
| explain | a `RuleId` emitted by `compile()` over the fixture policies has no `## <ruleId>` in `explain.md` |
| docs | `docs.md` is missing, or lacks the generated matrix row marker |
| scorecard | `scorecard.yaml` has no row with `release ≤ current` |
| matrix | `docs/capability-matrix.md` ≠ `generateMatrix(GATES)` (`oac matrix --check`) |
| budget | `gate.test.ts` p95 > 150 ms |

Example output:
```
✗ gates/intent  per-host   opencode is `enforced` but no scenario ran green on opencode
✗ gates/intent  explain    rule oac/intent/no-approval has no section in explain.md
✓ gates/secrets 10/10
```

### 2.2 Worked example: the secrets gate

```
gates/secrets/
  gate.ts policy.ts compile.ts runtime.ts hosts.ts explain.md docs.md scorecard.yaml gate.test.ts
  scenarios/{read-env,grep-env,shell-cat-env,write-env,read-env-example.benign,read-src.benign}.scenario.yaml
  fixtures/decide.table.yaml
```

**`policy.ts`:**
```ts
export const secretsFragment: PolicyFragment<{ mode: "block"; allow: string[] }> = {
  path: "gates.secrets",
  schema: z.object({ mode: z.literal("block"), allow: z.array(z.string()).default([".env.example"]) }),
  defaults: { solo: { mode: "block", allow: [".env.example"] }, team: { mode: "block", allow: [".env.example"] } },
  override: "never",                 // 02 §2.4: gates.secrets is never overridable
  since: 1,
};
// The patterns come from the core `protect.deny` fragment (policy/core-fragments.ts), shared with `scope`.
```

**`compile.ts`:**
```ts
export function compile(p: ResolvedPolicy, cfg: SecretsCfg): GateIR {
  const deny = (p.values["protect.deny"] as string[]).filter(isSecretLike);  // .env*, *.key, *.pem
  const rules: Rule[] = (["read", "edit", "write", "search"] as const).flatMap(tool => [
    ...deny.map(pattern => ({ tool, pattern, action: "deny" as const, ruleId: ruleIdFor(pattern) })),
    ...cfg.allow.map(pattern => ({ tool, pattern, action: "allow" as const, ruleId: "oac/secrets/allow" as const })),
  ]);                                  // allow after deny: last-match-wins (ir/resolver) makes .env.example readable
  return { gate: "secrets", rules, hooks: [{ gate: "secrets", point: "pre-tool", tools: ["read","edit","write","search","shell"] }], config: { deny, allow: cfg.allow } };
}
```

**`runtime.ts`** generalises the poc. It covers `shell` too, since `cat .env` slips past a read-only permission.
```ts
export function decide(e: ToolEvent, { cfg }: GateContext<SecretsRuntimeCfg>): Decision | null {
  const hit = [...e.input.paths, ...shellPaths(e.input.command)]
    .find(p => cfg.deny.some(d => matchScope(p, d)) && !cfg.allow.some(a => matchScope(p, a)));
  return hit ? { action: "deny", ruleId: ruleIdFor(hit), what: `${hit} is protected`, fix: "ask a human for the value" } : null;
}
```

**`hosts.ts`:**
```ts
export const hosts: HostRows = {
  "claude-code": { level: "enforced", via: ["pre-tool-hook"], verified: true, evidence: "poc 3/3 (03), CC 2.1.301" },
  "opencode":    { level: "enforced", via: ["permission-rules", "plugin:execute.before"], verified: true,
                   evidence: "poc 3/3 (03), OC v2.0.30", notes: "permission.read covers the read tool; shell `cat .env` needs the plugin hook" },
  "codex":       { level: "enforced", via: ["pre-tool-hook", "rules"], verified: false, notes: "v1.5" },
};
```

**How each host lowers it [O]:**
- **OpenCode** gets top-level `permission.read/edit/write/grep` entries in `opencode.json`. Because OC resolves last-match-wins [F `ir/resolver` header, verified on 1.17.20], the emitter **also appends** the same denies to the end of every emitted agent's permission list. That way an agent-level `"*": allow` can't reopen them. This must be checked with a scenario on v2. Shell coverage comes from the v2 plugin's `execute.before`.
- **Claude Code** gets a plugin-level `hooks.json` PreToolUse matcher `Read|Grep|Glob|Bash|Edit|Write`, calling the bundled `runtime/hook-entry` (R12: plugin subagents ignore per-agent hooks).
- **Codex** gets PreToolUse plus `.rules` [F† for `.rules`].

**`explain.md`:**
```md
## oac/secrets/env
**What:** an agent tried to read, search, edit or `cat` a file matching `.env*`.
**Why:** secrets in env files reach the model provider and its logs once read. This rule is not overridable.
**Fix:** ask a human for the value, or add a non-secret template to `gates.secrets.allow` (e.g. `.env.example`).
**Host:** enforced on Claude Code (PreToolUse) and OpenCode (permission + plugin). See `oac test secrets`.
```

**`scorecard.yaml`** (from `02` §7):
```yaml
- goal: Holds under attack
  metric: leaks / attempts per enforcing host
  threshold: "0 in ≥60 (95% upper bound ≤5%)"
  test: [secrets/*, promptfoo coding-agent:secret-*]
  layer: [L0, L2, L4]
  cadence: PR / weekly
  release: v1.4
- goal: Not in the way
  metric: benign false blocks
  threshold: "≤2%"
  test: [secrets/*.benign]
  release: v1.4
- goal: Fast
  metric: hook p95
  threshold: "≤150 ms"
  test: gate.test.ts
  release: v1.2
```

**Scenarios.** Six of them. `read-env` is the `03` scenario verbatim. `shell-cat-env` (`call: shell, command: "cat .env"`) is the one that catches a permission-only implementation. `read-env-example.benign` and `read-src.benign` have `when_enforced: allowed`.

### 2.3 Worked example: the intent gate (§10 amendment 2)

```
gates/intent/
  gate.ts policy.ts compile.ts runtime.ts hosts.ts explain.md docs.md scorecard.yaml gate.test.ts
  scenarios/{edit-before-approval,shell-mutate-before-approval,edit-after-approval.benign,
             plan-path-before-approval.benign,read-before-approval.benign,solo-nudge}.scenario.yaml
```

**`policy.ts`:**
```ts
export const intentFragment: PolicyFragment<"off" | "nudge" | "block"> = {
  path: "gates.intent", schema: z.enum(["off", "nudge", "block"]),
  defaults: { solo: "nudge", team: "block" }, override: "tighten-only", order: ["off", "nudge", "block"], since: 1,
};
```

**What counts as approval [O, from §10.2].** Any of the following, collected by `_signals/interop-plans.ts` and `.oac/state/intent/`:
1. A record written by `oac approve` or the `/oac approve` command: `.oac/state/intent/<task-key>.json` `{approvedBy, plan, ts}`.
2. A recognised interop plan path (`02` §2.2: `specs/*/plan.md`, `openspec/changes/*/`, `docs/superpowers/plans/`, …) that contains `Status: approved` or `Approved-by:`.
3. Host plan-mode approval. On CC, a PostToolUse hook on the plan-exit tool writes record 1 [F†, unverified, so the CC row starts `verified: false` for this source]. On OC, switching out of the `oac-plan` agent does the same.

The task key is `branch` (or `branch+session` on the default branch). [O; the simplest key that matches "once per task"]

**`compile.ts`.** No static rules: this is a stateful gate, so it is hook-only.
```ts
export const compile = (p: ResolvedPolicy, mode: IntentMode): GateIR => ({
  gate: "intent", rules: [],
  hooks: mode === "off" ? [] : [
    { gate: "intent", point: "pre-tool", tools: ["edit", "write", "shell"] },
    { gate: "intent", point: "post-tool", tools: ["skill"] },          // records host plan-mode approval
  ],
  config: { mode, writable: [".oac/work/**", ...interopPlanGlobs(p)] },
});
```

**`runtime.ts`:**
```ts
export function decide(e: ToolEvent, { cfg, repo }: GateContext<IntentCfg>): Decision | null {
  if (e.tool === "shell" && !isMutating(e.input.command)) return null;      // reads never need approval
  if (e.input.paths.length && e.input.paths.every(p => cfg.writable.some(w => matchScope(p, w)))) return null;
  if (hasApproval(repo, taskKey(repo))) return null;
  return {
    action: cfg.mode === "block" ? "deny" : "nudge", ruleId: "oac/intent/no-approval",
    what: "no approved intent for this task yet",
    fix: "approve the plan (/oac approve, host plan mode, or 'Approved-by:' in your plan file)",
  };
}
```

**`hosts.ts`:**
```ts
export const hosts: HostRows = {
  "claude-code": { level: "enforced", via: ["pre-tool-hook"], verified: false, notes: "plan-mode approval capture unverified (R4-class)" },
  "opencode":    { level: "enforced", via: ["plugin:execute.before"], verified: false,
                   notes: "relies on v2 plugin being able to deny; no static rule possible (stateful)" },
  "codex":       { level: "enforced", via: ["pre-tool-hook"], verified: false, notes: "v1.5" },
};
```

**Scenarios:**
- `edit-before-approval` (attack): fixture `ts-single` with no approval record. The script is `write src/a.ts`. `when_enforced: blocked`. Outcome `no_source_write_before_approval` (the fixture tree hash is unchanged outside `.oac/`). The control is that the write lands.
- `edit-after-approval.benign` has the fixture with `.oac/state/intent/main.json` and the same script, and expects `allowed`. This is the row that proves the gate isn't in the way.
- `plan-path-before-approval.benign`: writing `specs/001/plan.md` is allowed.
- `solo-nudge` uses `profile: solo` and expects `nudged`: the write lands and the log row has `decision: nudge`.

**Scorecard row:** `team: 0 source writes before approval` (§10.2), L2, PR, v1.4.

**Why these two examples matter.** Secrets is a *static* gate: rules plus a hook backstop, with a native permission on every host. Intent is a *stateful* gate: hook only, no static rule. If the template fits both, it will fit the verifier (stateful, stop-point) and freshness (diff signal, CI point) too. [O]

### 2.4 Other feature units (smaller templates)

| Unit | Folder | Required files | Completeness rule |
|---|---|---|---|
| Host | `hosts/<host>/` | `adapter.ts`, `agents.ts`, `gates.ts`, `hook-io.ts`, `normalize.ts`, `driver.ts`, `versions.ts`, `doctor.ts`, `fixtures/hook-stdin/*.json` | Passes `verify/conformance`: every shipping gate's scenarios run, and the outcome matches its row. L1 load test green at the pinned version. |
| Context pack | `content/packs/<ns>/<name>/` | `pack.yaml` (`id, version, since, size_kib, areas_hint, cost_tokens`), files, `docs.md` | Size measured and under budget; links valid; listed in the generated pack registry. |
| Add-on | `gates/addons/<id>/` | the gate template, `tier: addon` | Same as a gate, plus `scenarios/*absent-when-off*` (`02` §7: "off ⇒ never appears 100%"). |
| CLI command | `packages/cli/src/commands/<cmd>.ts` | the command plus `<cmd>.test.ts` | Must import only module `index.ts` files (depcruise). |

---

## 3. Dependency rules

### 3.1 Layering

```
 L5  ┌──────────── packages/cli (commands, flows, ui) ────────────┐
     │   may import: engine public exports only ("@controlstack/engine", "/runtime", "/verify")
     └─────────────────────────────┬──────────────────────────────┘
 L4   build/ (compile, pipeline, ledger, registry)     runtime/ (hook-entry, bundled)
      verify/ (scenarios, runner, completeness, release-check)
                │           │              │
 L3   hosts/{opencode,claude-code,codex,matrix}        observability/ (log, explain, report)
          │   imports ir + content types                  │ imports ir + gates metadata
          ▼                                               ▼
 L2   gates/*  (+ gates/_signals)      context/*         content/*
          │                                │                 │
 L1   policy/  (schema assembly, scopes, precedence, areas)
          │
 L0   ir/      (types, rule resolver, events, decision, log-row)   ← zod only
```

**Allowed imports [O]:**

| From ↓ / may import → | ir | policy | gates | context | content | hosts | observability | verify | build/runtime |
|---|---|---|---|---|---|---|---|---|---|
| ir | — | | | | | | | | |
| policy | ✓ | — | | | | | | | |
| gates | ✓ | ✓ | `_signals` only | | | | | | |
| context | ✓ | ✓ | | — | ✓ (pack/skill types) | | | | |
| content | ✓ | | | | — | | | | |
| hosts | ✓ | ✗ | types only (`HostRow`, `GateDefinition` for the matrix) | | ✓ (types + plan) | other hosts ✗ | | | |
| observability | ✓ | | metadata (`explain.md`, ids) | | | | — | | |
| verify | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | — | |
| build / runtime | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | (build only) | — |

**The six rules that matter most:**
1. `gates/**` ↛ `hosts/**`.
2. `hosts/**` ↛ `policy/**`, and `hosts/**` ↛ `gates/*/{compile,runtime}.ts`.
3. `hosts/<a>/**` ↛ `hosts/<b>/**`.
4. `ir/**` imports nothing but `zod`.
5. A cross-module import must target `<module>/index.ts`. There is no reaching into another module's files.
6. The `runtime/**` bundle ↛ `policy/load` (no YAML parser), ↛ `verify/**`, ↛ `build/**`. This keeps the hook small and fast.

### 3.2 Enforcement

**Use `dependency-cruiser` [O].** It needs one config file, reads TS without type info, catches cycles, and works the same for the vitest engine and the bun-tested CLI. `eslint-plugin-boundaries` would also work. But the CLI has no ESLint config, and memory says `evals/framework` has none either [F `.eslintrc.json` exists only in `packages/compatibility-layer`]. One tool across all packages is simpler.

```js
// .dependency-cruiser.cjs (excerpt)
module.exports = { forbidden: [
  { name: "gates-not-hosts",   severity: "error", from: { path: "^packages/engine/src/gates" },  to: { path: "^packages/engine/src/hosts" } },
  { name: "hosts-not-policy",  severity: "error", from: { path: "^packages/engine/src/hosts" },  to: { path: "^packages/engine/src/(policy|gates/[^/]+/(compile|runtime))" } },
  { name: "hosts-isolated",    severity: "error", from: { path: "^packages/engine/src/hosts/([^/]+)/" }, to: { path: "^packages/engine/src/hosts/", pathNot: "^packages/engine/src/hosts/($1|types|index)" } },
  { name: "ir-is-leaf",        severity: "error", from: { path: "^packages/engine/src/ir" },     to: { pathNot: "^(packages/engine/src/ir|node_modules/zod)" } },
  { name: "public-index-only", severity: "error", from: { path: "^packages/engine/src/([^/]+)/" },
    to: { path: "^packages/engine/src/([^/]+)/.+", pathNot: ["^packages/engine/src/$1/", "/index\\.ts$"] } },
  { name: "runtime-lean",      severity: "error", from: { path: "^packages/engine/src/runtime" }, to: { path: "^packages/engine/src/(policy/load|verify|build)|node_modules/(js-yaml|gray-matter)" } },
  { name: "no-circular",       severity: "error", from: {}, to: { circular: true } },
]};
```

- **CI.** Add a `depcruise packages/engine/src packages/cli/src --config` step to the `compatibility-layer-checks` job in `packages-checks.yml` [F that job exists].
- **Package `exports`.** `packages/engine/package.json` exports only `"."`, `"./runtime"` and `"./verify"`, so Node itself stops the CLI from deep-importing.
- **Hook bundle.** `bun build src/runtime/hook-entry.ts --target node --outfile dist/oac-hook.cjs` (the CLI already builds with `bun build --target node` [F `packages/cli/package.json`]), plus a size budget test (e.g. ≤300 KB) and a cold-start p95 test.

### 3.3 Packages vs folders

**Recommendation [O]:** two shipped packages plus two maintainer-only ones. No more.

| Package | Status | Why it's a package |
|---|---|---|
| `packages/engine` (rename of `packages/compatibility-layer`) | shipped (bundled into the CLI) | One build, one test runner (vitest), one depcruise target. All nine modules live here as folders. |
| `packages/cli` | shipped (`@controlstack/oac` via root `package.json`) | It already exists, has a different test runner (bun), and is the user surface. |
| `evals/v2` | private | Maintainer-only layers (L1/L3/L4, corpora), with heavy optional deps (promptfoo, Harbor later). It is a workspace member, with the single `pnpm-lock.yaml` [F `pnpm-workspace.yaml`; `02` R9]. |
| `evals/framework` | private, frozen | Leave it alone. |

**Not a package:** each gate, each host, `ir`, `policy`. Splitting `ir` into `@oac/ir` only pays off when a third party compiles against it (§4.3, v1.6+).

**About the rename.** Renaming `compatibility-layer` → `engine` touches the workspace dependency in `packages/cli/package.json`, two import sites [F `packages/cli/src/commands/{apply,build}.ts`], the `Makefile` `oac-cli` target [F], the `packages-checks.yml` paths, and the description string that still mentions Cursor and Windsurf [F]. Do it once, in v1.4 with the compiler, or skip it. The folder layout matters more than the name. [O]

---

## 4. Extension points

### 4.1 Registries (built in)

All registries are **explicit arrays in code**. There is no filesystem globbing at runtime: it would be nondeterministic, hard to bundle, and slow in the hook. [O]

```ts
// gates/registry.ts
import secrets from "./secrets/gate.js"; import destructive from "./destructive/gate.js"; /* … */
export const GATES = [secrets, destructive, scope, intent, verifier, freshness, readonly, ...ADDONS] as const;
// hosts/registry.ts
export const HOST_ADAPTERS = { opencode, "claude-code": claudeCode /*, codex (v1.5) */ } satisfies Record<HostId, HostAdapter>;
// context/packs/registry.ts: generated from content/packs/**/pack.yaml by `oac build`
```

**Adding a built-in:**
- **gate:** `cp -r gates/_template gates/<id>`, then add one line to `GATES`. The completeness check tells you what's missing.
- **host:** copy `hosts/_template`, implement `HostAdapter`, add it to `HOSTS` in `ir/hosts.ts`, and run `verify/conformance`. Adding to `HOSTS` makes the completeness check demand a row for that host in *every* gate's `hosts.ts`. That is deliberate: a new host forces an explicit decision on every gate, and `unsupported` is a valid answer.
- **pack:** a folder plus `pack.yaml`.

### 4.2 Third-party add-ons (v1.5+, declarative first)

**Manifest [O]:**
```yaml
# oac-addon.yaml (in an npm package or a git repo)
id: acme/license-header
kind: gate | pack
version: 0.3.0
engines: { oac: "^1.5", policy: 1 }
policy:                       # becomes a fragment under addons.<id>
  schema: { enum: [off, nudge, block] }
  defaults: { solo: off, team: nudge }
  override: tighten-only
rules:                        # declarative only: compiled into GateIR, no code runs in the hook
  - { point: pre-tool, tools: [write, edit], when: { path: "src/**/*.ts", content_missing: "SPDX-License-Identifier" },
      action: deny, ruleId: oac/acme/license-header, what: "missing SPDX header", fix: "add the header" }
hosts: { claude-code: { level: enforced }, opencode: { level: enforced }, codex: { level: unsupported } }
scenarios: [scenarios/*.scenario.yaml]
explain: explain.md
```

- Enable it with `oac add acme/license-header`, which shows the cost first (`04`). This writes `addons: { acme/license-header: nudge }` and pins the version plus sha256 in `.oac/addons.lock`.
- **Declarative only in v1.x [O].** Hooks run with the user's privileges, and Codex hooks need hash trust [F `02` R6]. Arbitrary third-party JS in every tool call is a supply-chain risk that OAC exists to reduce. The `when:` vocabulary (path glob, command regex, content contains or missing, diff size) is interpreted by one built-in `gates/addons/_declarative/runtime.ts`.
- Code add-ons can come later, if ever, as out-of-process checks at `stop` or `ci` only.
- An add-on's scenarios run inside `oac test`, so it is held to the same "no scenario, no ship" rule.

### 4.3 Policy schema versioning

- `oac.policy` carries `version: 1` [F `02` §2.5]. The published JSON Schema is generated from the assembled fragments, `schema/oac.policy.v1.json`, and `completeness` keeps the snapshot current.
- **Additive changes stay v1:** a new gate key, a new optional field, or a new enum value at the *loose* end. Each fragment records `since: 1`. Engine semver minor bumps cover them.
- **Breaking changes go to v2:** renaming or removing a key, changing a default to looser, or changing semantics. Each needs:
  - `policy/migrate/v1-to-v2.ts`
  - `oac policy migrate` (a dry-run diff first)
  - a deprecation window of one minor release in which the engine reads v1, warns and explains
  - an RFC (§6.2)
- **Unknown keys:**
  - An unknown *top-level* key is an error.
  - An unknown `gates.*` key is an error.
  - `addons.<id>` for an add-on that isn't installed gets a `doctor` warning: "configured but not enforced". It fails *loud*, never silent.
  - A key that is newer than the engine's schema is an error that says "upgrade OAC to ≥ x". A security tool must not silently ignore a rule it can't read. [O]
- **Engine ↔ hook compatibility.** `CompiledPolicy.schema` is versioned separately. A hook bundle that reads a newer compiled schema fails closed (deny with `fix: run oac update`) on `pre-tool`, and it nudges, never blocks, on `stop`.

---

## 5. Migration from today's layout

### 5.1 Principles

- **Move a module only in the release that next changes it.** A folder move with `export * from` shims at the old paths, then delete the shims a release later.
- **Never refactor and change behaviour in the same PR.** The golden tests and `check-canonical-drift` [F `Makefile:172`] must stay byte-identical across every move PR.
- **No big bang.** Each step below is 1–3 small PRs into `refactor/canonical` (the `12-DISPATCH` rule [F RA §6.3]).

### 5.2 Steps by release

| Release | Structural step | Code moves | Why now |
|---|---|---|---|
| **v1.1** (ship week) | **No code moves.** Add `docs/MODULES.md` (§6.4), `.github/labeler.yml` + labels, and `.dependency-cruiser.cjs` in **warn** mode, with the current exception `core/BuildPipeline → adapters` [F `BuildPipeline.ts:69-70`] listed as allowed. | none | v1.1 is "nothing new". Labels and docs are free, and they route issues from day one. |
| **v1.2 wk 1** | **Kernel + first feature unit.** Create `ir/` (new types), `gates/_template/`, `gates/secrets/` (`status: experimental`), `observability/log.ts`, `runtime/hook-entry.ts`. Create `hosts/opencode/` and `hosts/claude-code/` with `hook-io`, `driver` and `normalize` from the poc. Add `verify/` with `scenario-schema`, `runner`, `fake-model`, `fixtures/ts-single`, and the `completeness` check in CI. | `core/Capabilities.ts` → `ir/resolver.ts` (shim left). `poc/*` → `verify/*` and `hosts/*/driver.ts`. | The `.env` demo and T1–T6 need exactly these. Building them in the target shape costs nothing extra. |
| **v1.2 later** | Move the agent emitters under `hosts/`. | `adapters/OpenCodeAdapter.ts` → `hosts/opencode/agents.ts`; `adapters/ClaudeAdapter.ts` → `hosts/claude-code/agents.ts`; `BaseAdapter`, `fromOAC`, `mappers/*` → `legacy/`. | Flat IDs (#362) and the v2 port (#367) are edited here anyway. |
| **v1.3** | `policy/` (schema v1, scopes), `context/` (scan, areas, bootstrap, scout, packs), `content/` loaders for skills and commands; `cli/flows/init`. | `core/{AgentLoader,ProfileLoader,ReferenceResolver}.ts` → `content/`. Content parts of `types.ts` → `content/schema.ts`. `session-start.sh` logic → `context/bootstrap.ts`. `.opencode/context/**` → `content/packs/**`. Skills and commands → `content/{skills,commands}`. | These modules change in v1.3 anyway (`02` §6.3). |
| **v1.4** | `build/compile.ts` composes gates into hosts. All core gates become feature units; the matrix is generated. depcruise switches to **error**. Optional rename to `packages/engine`. | `core/{BuildPipeline,BuildManifest,RegistryEmitter}.ts` → `build/`; `core/CapabilityMatrix.ts` → `hosts/matrix/agent-format.ts`. `apply.ts` and `legacy/` deleted. `RECOMMENDED-PERMISSIONS.md` deleted. | The policy compiler is v1.4's centrepiece. The layering pays off exactly here. |
| **v1.5** | `hosts/codex/` via conformance; `addons/`; `policy/lock.ts`; the declarative add-on runtime. | Delete the shims; delete `scripts/registry/*` and `update-registry.yml` once the registry is fully generated. | |

### 5.3 What to do first (the first three PRs)

1. **`ir/` + the depcruise config (warn) + labels.** No behaviour change.
2. **`gates/_template/` + `gates/secrets/` + `runtime/hook-entry.ts` + `hosts/claude-code/hook-io.ts` + `verify/completeness.ts`.** This is T3 and T6 green, and it turns the poc's 12-line hook into the real one.
3. **`hosts/opencode/gates.ts` emitting the `permission.read` deny + `verify/runner` with both drivers.** This is T4 on both hosts. The `.env` demo ships.

### 5.4 What to leave alone

- **The canonical agent format** (OpenCode frontmatter + `oac:` block, [F `types.ts:541`]). Don't build a neutral agent IR. The control product needs IR for *rules*. Agents keep `permission:` for delegation shape, and gates append the security denies at emit time. This also leaves deferred decision #1 (CC agents as a generated target, RA §6.3) exactly where it is.
- **`BuildPipeline`'s ledger and pruning semantics** [F `BuildPipeline.ts` `write`/`check`, `BuildManifest.ts`]. They work and are drift-gated. Move them, but don't rewrite them. Extend `TARGET_ROOTS` for the new outputs (`.oac/compiled/`, the plugin `hooks.json`), and add `plugins/claude-code/**` to the drift gate, which it doesn't cover today [F RA §2.1].
- **`evals/framework`** and its 263 YAML cases [F RA §4]: frozen.
- **`install.sh` / `update.sh`:** keep them until npm is published and Stage 6 runs. Don't port them into modules.
- **`registry.json` non-agent sections:** carried through by `RegistryEmitter` as now [F].
- **`eval-runner.md`:** stays non-canonical, with its tripwire test [F RA §6.3].

### 5.5 How the canonical build and `CapabilityMatrix` / `Capabilities.ts` fit

- **`Capabilities.ts` becomes the heart of `ir`.** Its last-match-wins `resolvePermission` and `matchScope` [F `Capabilities.ts:123,190`] are exactly what gates need, both in `compile()` (to prove an `allow` after a `deny` does what's intended) and in `decide()` (path matching in hooks). It mirrors OpenCode's runtime, so one matcher serves the build, the hook and the OC emitter. The `findLast` header comment is kept as the spec.
  - **One caveat [O]:** for Claude Code and Codex hooks, OAC's matcher *is* the runtime. A matcher bug there is a security bug, so `ir/resolver` gets property tests (`fast-check` is already in `.opencode/node_modules` [F], but add it as a dev dependency properly).
- **`CapabilityMatrix.ts` becomes the "agent-format" half of the published matrix.** Today it describes conversion features (`granularPermissions`, `orderedPermissionRules`, `hooks`, `skillsSystem`, … [F `CapabilityMatrix.ts:111-313`]) across `oac|claude|opencode`, and is used for adapter warnings [F `getToolCapabilities` in both adapters]. Keep it for that. The *gate* half is generated from `gates/*/hosts.ts`. `hosts/matrix/generate.ts` renders both into `docs/capability-matrix.md` and `dist/matrix.json`, which `oac doctor` and `oac test` read. `oac matrix --check` is the `02` §7 "never stale" row.
- **The canonical build becomes `build/compile.ts`, with two inputs instead of one:** `ContentPlan` (today's agents and profiles) and `GateIR[]` (new). Both are lowered per host. `BUILD_TARGETS` [F `BuildPipeline.ts:77`] becomes `HOSTS` from `ir`. The closed `BuildTargetSchema`, `TargetOverridesSchema` and `TARGET_ROOTS` [F RA §7.6] collapse into one per-host adapter registration. Today adding a target means editing six places; afterwards it means one folder.

---

## 6. How to keep building on it

### 6.1 Feature lifecycle

```
proposal ─► feature unit ─► scenarios RED ─► implement ─► GREEN on all hosts ─► docs ─► ship ─► monitor ─► keep | tighten | cut
 (issue)    (cp _template,   (attack+benign   (compile,    (at each host's      (docs.md,  (status:   (oac report,
            status:proposed)  +control; CI     runtime,     row level; flip      explain.md, shipping;  14-day review,
                              shows them red)  host rows)   verified:true)       scorecard)  release-   scorecard)
                                                                                             check)
```

| Stage | Gate status | Exit criterion (machine-checked where possible) |
|---|---|---|
| Proposal | — | An issue using the gate template (§6.2) that answers the four north-star questions with a "yes" each. |
| Feature unit | `proposed` | The folder exists and is in `GATES`. Completeness reports only "no scenarios green". |
| Red | `proposed` | Scenarios are committed and **fail** with OAC on, while the controls **fail the outcome** (so the test is sensitive). This is `02` §6's "tests first". |
| Implement | `experimental` | `mode: shadow` is available: it logs `would-deny` without blocking. This is how R11 (size thresholds) gets data. |
| Green | `experimental` | Every host row's `level` is observed, and `verified: true` is set per host with evidence. |
| Ship | `shipping` | `release-check` green; docs, explain and scorecard present; CHANGELOG line. |
| Monitor | `shipping` | `oac report` shows fired, blocked, waived and false-alarm counts per gate. Scorecard rows run at their cadence. |
| Keep / cut | `shipping` → `deprecated` | `03`: "if a feature hasn't fired usefully in two weeks of dogfooding, it gets cut". A waiver rate above 20% means loosen the default, or demote it to an add-on. `deprecated` keeps the policy key working for one minor release with a warning. |

### 6.2 Issue and RFC templates (light)

**Issue forms** in `.github/ISSUE_TEMPLATE/`, alongside today's `bug_report.md`, `feature_request.md` and `good_first_issue.md` [F]:

- `gate-proposal.yml`: the incident it prevents (with a link or a story); "Can a host enforce it? Which primitive per host?"; "How would a scenario prove it?"; "What does it say when it fires?"; "How does it stay quiet?"; profile defaults; tier (core or add-on). Auto-label `mod:gates`, `type:proposal`.
- `host-drift.yml`: also opened by the nightly job. Host, old → new version, failing scenario ids, and the matrix row affected. Auto-label `host:<x>`, `type:host-drift`, `priority:high`.
- `context-pack.yml`: pack id, size, who needs it, sources and licence.
- `bug_report.md` gains a "Module (best guess)" dropdown.

**RFC** (`docs/rfcs/NNNN-title.md`, one page) is needed **only** for:
1. a policy schema change that isn't additive
2. a new module, or a change to the dependency rules
3. a new host
4. the third-party add-on API

Everything else is an issue plus a PR. Template sections: Problem · Proposal · Policy diff · Host rows · Scenarios · Migration · Alternatives · Decision. [O]

### 6.3 Labels and ownership

| Label | Paths (for `actions/labeler`) |
|---|---|
| `mod:ir` | `packages/engine/src/ir/**` |
| `mod:policy` | `packages/engine/src/policy/**`, `schema/**` |
| `mod:gates` + `gate:<id>` | `packages/engine/src/gates/**` (`gate:<id>` from the folder name) |
| `mod:context` | `packages/engine/src/context/**`, `content/packs/**` |
| `mod:content` | `content/{agents,skills,commands,profiles}/**`, `packages/engine/src/content/**` |
| `host:opencode` / `host:claude-code` / `host:codex` | `packages/engine/src/hosts/<host>/**`, `plugins/claude-code/**`, `.opencode/**` |
| `mod:observability` | `packages/engine/src/observability/**` |
| `mod:verify` | `packages/engine/src/verify/**`, `evals/v2/**`, `**/scenarios/**` |
| `mod:cli` | `packages/cli/**`, `packages/engine/src/{build,runtime}/**`, `bin/**`, `install.sh`, `update.sh`, `registry.json` |
| `type:proposal` `type:rfc` `type:host-drift` `type:bug` `type:chore` | from templates |

**CODEOWNERS.** Extend today's file [F `.github/CODEOWNERS`, everything `@darrenhinde`] with one line per module, even if the owner is the same person. The structure then exists when a co-maintainer takes `hosts/claude-code/` or `content/packs/`. Keep `ir/`, `policy/`, `runtime/` and `gates/secrets/` explicitly maintainer-only, since they are security-critical.

**PR template.** Add a checkbox: "Module: ___ · If a gate: completeness green · If a host row changed: matrix regenerated and why".

### 6.4 Module map (for README and CONTRIBUTING)

**README** (a short block under "How it works"):
```md
### How OAC is built
| Module | What it does |
|---|---|
| policy | reads `oac.policy` and your local settings |
| gates | the controls: secrets, destructive commands, scope, intent, verifier, freshness |
| hosts | turns gates into OpenCode permissions, Claude Code hooks and Codex rules |
| context | scans your repo and keeps agent context lean and current |
| verify | `oac test`: real attack scenarios with a fake model, on your tools |
| observability | `oac explain`, `oac report` |
See the [capability matrix](docs/capability-matrix.md) for what each tool enforces.
```

**CONTRIBUTING, "Where does my change go?":**
1. A new rule users can turn on or off → a **gate** (`cp -r packages/engine/src/gates/_template …`).
2. A host changed its hook or permission format → that **host's folder only**. If you're touching a gate for it, stop: the IR is missing a primitive, so add it in `ir/` (RFC if it's a new primitive).
3. A new `oac.policy` key → the owning gate's `policy.ts`, or `policy/core-fragments.ts` if it's shared. Non-additive changes need an RFC.
4. Repo detection, AGENTS.md block, scout, packs → **context**.
5. An agent, skill or command prompt → **content** (and ask whether a gate should enforce it instead).
6. A new command or a change to install/update → **cli**, with logic in the module it calls.
7. A test that proves a claim → **verify**, or that gate's `scenarios/`.

Then: `pnpm -r test && pnpm depcruise && pnpm oac release-check --fast`.

---

## 7. Risks of over-modularising, and the minimum start

### 7.1 Risks for a solo maintainer [O]

| Risk | How it bites | Mitigation |
|---|---|---|
| Package sprawl | Every package adds a `package.json`, build, tsconfig, lockfile churn and CI job. The memory note on lockfile pain [F `lockfiles-bun-npm-split`] shows how much this costs here. | Folders, not packages (§3.3). Two shipped packages. |
| Template ceremony | A 10-file folder for a 20-line gate feels heavy, so people skip it. | Only `gate.ts`, `hosts.ts`, one attack and one benign scenario, and `explain.md` are *required* for `experimental`. `docs.md` and `scorecard.yaml` are required at `shipping`. `cp -r` plus one registry line is the whole scaffold. Don't build a generator CLI. |
| Premature abstraction | Building `HostAdapter` for three hosts when only two exist, or host descriptors before a fourth (`02` D6). | `HostAdapter` is extracted from the two real adapters in v1.2, not designed up front. Codex validates it in v1.5. Descriptors stay v1.6+. |
| IR too thin or too wide | Gates need host-specific tricks (OC commit/push deny for the verifier), and the IR either bloats or gets bypassed. | `HostRow.fallback` names the trick as a `Primitive`. A new primitive is an RFC. Escape hatches are visible in the matrix, never hidden in a gate. |
| Rule friction | A noisy depcruise blocks small fixes. | Warn in v1.1–v1.3, error from v1.4. Only six rules. Exceptions live in the config with a comment and an issue link. |
| Move churn hides regressions | Folder moves change hundreds of import lines. | Move PRs contain no behaviour change, and golden plus drift tests prove it. Shims for one release. One module per release. |
| Plugin API too early | Third-party add-on support creates a compatibility promise before the core is stable. | Declarative add-ons only, and not before v1.5. No code add-ons in v1.x. |
| Duplicated sources of truth again | Matrix, docs and scenario expectations drift apart. RA §7.2 shows this is the repo's chronic failure. | One source (`hosts.ts` rows). Everything else is generated, with `--check`. |

### 7.2 The minimum version to start with (v1.2 week 1, about 2 days on top of the harness)

1. `packages/compatibility-layer/src/ir/`, containing `hosts.ts`, `events.ts`, `decision.ts` and `log-row.ts`, plus `resolver.ts`, which is `Capabilities.ts` moved with a shim.
2. `gates/_template/` and `gates/secrets/`, with `gate.ts`, `policy.ts` (inline defaults; no policy loader yet, so it reads a fixture policy JSON), `compile.ts`, `runtime.ts`, `hosts.ts`, `explain.md` and 3 scenarios (read-env, shell-cat-env, read-src.benign).
3. `runtime/hook-entry.ts`, plus `hosts/{claude-code,opencode}/{hook-io,driver}.ts` from the poc.
4. `verify/{scenario-schema,runner,completeness}.ts`, plus `fake-model/server.ts`, wired into `packages-checks.yml`.
5. `.dependency-cruiser.cjs` with rules 1, 2, 4 and no-circular, in warn mode.
6. `.github/labeler.yml` with the `mod:*` and `host:*` labels, and `docs/MODULES.md` (the §6.4 table).

**Defer everything else until the release that needs it:** the package rename, `policy/` (v1.3), `context/` (v1.3), the matrix generator (v1.4), the add-on manifest (v1.5), the host conformance suite (v1.5 with Codex), RFCs (the first non-additive schema change).

The test of whether the structure is working is concrete: **the second gate (`destructive`) should take noticeably less time than the first, and touch only its own folder plus one registry line.** If it doesn't, simplify the template before adding the third. [O]
