> Initial planning record (2026-10-18). Current plan: [../ROADMAP.md](../ROADMAP.md) · decisions: [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md)

# OAC local test suite plan

Written 2026-10-18 on `refactor/canonical` @ `d7924e4`. This is a plan, not an implementation. It builds on `02` §6, `03` and `05` §1.8.

**Labels.** **[F]** means verified on this Mac in this session; the command or probe is named. **[O]** is a recommendation or opinion. **[F†]** means taken from docs or earlier notes and not re-run here.

**Machine.** [F] macOS 15.7.7, Node 24.5.0, pnpm 10.33.4, Bun 1.3.14, `opencode v2.0.30`, `claude 2.1.302`. Claude auto-updated from 2.1.301 at 16:15 today (see R1). Docker Desktop 27.4 is installed but its daemon was not running. podman, colima, orb, bwrap, firejail and the devcontainer CLI are absent. `sandbox-exec` is present. This session had no outbound internet: `curl raw.githubusercontent.com` timed out after 10 s.

Throwaway probes are in `.tmp/planning-fix/scratch-testplan/`: `baseline.sh`, `iso.sh`, `probe-mock.js`, `probe-anthropic.js`, `delegate-mock.js`, `bash-mock.js`, `t2-probe.sh`, `agent.sb`, plus `logs/`. `git status` was the same at the start and the end: `?? reports/ ?? research_notes/`.

---

## 0. TL;DR

1. **One command:** `pnpm test:local [quick|hosts|live|all]`, also available as `make test-local TIER=…`. It writes `.tmp/test-runs/<UTC-timestamp>/` containing `results.jsonl`, `summary.md` and per-check logs. [O]
2. **`quick` is about 40 s today.** All 17 existing deterministic checks were run. 16 pass. The one red, `scripts/validation/validate-test-suites.sh`, is vacuous: it fails without an argument and with `--all` checks 0 suites. [F]
3. **`hosts` takes about 1–1.5 min at $0,** using real `opencode` v2 and real `claude` against a fake model. Every host mechanism the plan needs was proven today [F]:
   - **T2 works through `opencode run --standalone --agent <id>`.** All 34 agents boot in 24 s. **12 agents lose a tool they have allow rules for** (`shell` 3, `subagent` 10). That is exactly #349.
   - **Display names fail on v2.** `--agent ContextScout` gives `Agent not found`, and delegating with `agent:"ContextScout"` gives `Unknown agent: ContextScout`. The path ID `subagents/core/contextscout` works. That is #362.
   - **The Claude plugin loads.** It loads via `--plugin-dir` in an isolated HOME, and the stream-json `init` lists 7 `oac:*` agents, 15 `oac:*` skills (the 12 in `skills/` plus 3 commands that also show up as skills) and 18 `oac:*` slash commands. `claude plugin validate --strict` passes. The SessionStart hook injects **158 lines / 18.9 KB**; the v1.1 target is ≤3 lines.
   - **The poc still passes,** guarded 1/1 on each host in about 1 s. It also passes **inside a Seatbelt profile** that blocks writes under `/Users`, reads of host config and credentials, the keychain daemon, and all non-loopback network.
4. **Sandboxing is layered. Docker is not needed by default** [O]:
   - **(a)** Scrubbed env, throwaway HOME/XDG, and temp repos *outside* `$HOME` and outside the repo.
   - **(b)** A macOS `sandbox-exec` profile, verified working.
   - **(c)** Host inner layers: Claude Code `sandbox.*` (verified to block an out-of-workdir write) and OpenCode permissions.
   - **(d)** Strict mode: a container with `--network none`. The fake model runs inside the container, so the hosts tier needs no network at all.
5. **Two new isolation hazards** were found and must be designed out [F]:
   - **OpenCode walks up parent directories for `.opencode/`.** A fixture inside the repo picked up the repo's `.opencode/` and the real `~/.opencode`.
   - **Non-`--standalone` OpenCode commands talk to the managed background service** on fixed port 49374. The user's real service is already running there.

---

## 1. Baseline: every existing test or check on the branch

Run with `scratch-testplan/baseline.sh` (sequential, warm `node_modules`). Results are in `scratch-testplan/logs/results.jsonl`.

| # | Check | Command | Result today | Time | Needs | In CI |
|---|---|---|---|---|---|---|
| 1 | compat build | `pnpm --dir packages/compatibility-layer run build` | ✓ [F] | 3 s | — | packages-checks |
| 2 | compat lint | `pnpm --dir packages/compatibility-layer run lint` | ✓ [F] | 5 s | — | packages-checks |
| 3 | compat vitest | `pnpm --dir packages/compatibility-layer test` | ✓ 553 pass, 1 skip, 22 files [F] | 3 s | — | packages-checks |
| 4 | cli typecheck | `pnpm --dir packages/cli run typecheck` | ✓ [F] | 1 s | compat `dist/` | packages-checks |
| 5 | cli build | `pnpm --dir packages/cli run build` | ✓ [F] | <1 s | **Bun** (`bun build`) | packages-checks |
| 6 | cli test | `pnpm --dir packages/cli run test` (`bun test`) | ✓ 226 pass [F] | 4 s | **Bun** | packages-checks |
| 7 | canonical drift | `make check-canonical-drift` | ✓ no drift, **8 degradation warnings** (`--strict` would fail) [F] | 3 s | **Bun** | packages-checks |
| 8 | evals build | `pnpm --dir evals/framework run build` | ✓ [F] | 2 s | — | pr-checks |
| 9 | evals test:ci | `pnpm --dir evals/framework run test:ci` (7-file vitest allowlist) | ✓ 112 pass [F] | 1 s | — | pr-checks |
| 10 | evals suites | `pnpm --dir evals/framework run validate:suites:all` | ✓ 1 suite valid [F] | 1 s | — | pr-checks, validate-test-suites |
| 11 | PR-change detector | `bun test scripts/validation/detect-pr-changes.test.ts` | ✓ 31 pass [F] | <1 s | **Bun** | packages-checks |
| 12 | markdown links | `pnpm run validate:context-links` | ✓ 235 files [F] | <1 s | **Bun** | validate-registry |
| 13 | registry | `pnpm run validate:registry` | ✓ [F] | 1 s | **Bun** | validate-registry |
| 14 | context refs | `bash scripts/validation/validate-context-refs.sh` | ✓ with **74 warnings** [F] | 3 s | — | (not in CI) |
| 15 | suites (shell) | `bash scripts/validation/validate-test-suites.sh` | **✗ exit 1**: "No test suites found for agent: openagent". With `--all`: ✓ but **0 suites checked** (vacuous) [F] | <1 s | ajv | (not in CI) |
| 16 | shell syntax | `bash -n install.sh update.sh scripts/tests/*.sh` | ✓ [F] | <1 s | — | installer-checks |
| 17 | shellcheck | `shellcheck -S error install.sh` | ✓ [F] | 2 s | shellcheck | installer-checks (action) |
| 18 | installer e2e | `bash scripts/tests/test-e2e-install.sh` | **inconclusive**: timed out at 300 s because this session has no network [F]. It downloads every file from `raw.githubusercontent.com/<OPENCODE_BRANCH>`, so it tests the **pushed** branch, never the local tree (`install.sh` L47-61; `RAW_URL` cannot be overridden) [F] | — | **network** | installer-checks (ubuntu+macOS) |
| 19 | installer non-interactive | `bash scripts/tests/test-non-interactive.sh` | inconclusive, same cause [F] | — | **network** | installer-checks |
| 20 | installer compatibility | `bash scripts/tests/test-compatibility.sh` | ✓ ("network test failed, may be offline", non-fatal) [F] | 18 s | — | installer-checks |
| 21 | profile smoke | `install.sh <profile> --install-dir=…` × 5 profiles | not run (network) | — | **network** | installer-checks |
| 22 | Claude plugin | `claude plugin validate --strict --json plugins/claude-code` | ✓, 0 warnings [F] | <1 s | claude | **not in CI** |
| 23 | Claude marketplace | `claude plugin validate --strict --json .` | **✗ exit 1**: unknown field `categories` (warning only; non-strict passes) [F] | <1 s | claude | not in CI |
| 24 | poc Claude | `poc/run-claude.sh guarded` | ✓ PASS, 0 leaks, 1 hook deny, `permission_denials` present [F] | 0.9 s | claude | no |
| 25 | poc OpenCode | `poc/run-opencode.sh guarded` | ✓ PASS, 0 leaks, "denied" [F] | 1.4 s | opencode | no |
| 26 | `oac init` + `doctor` | `oac init --profile essential` then `oac doctor --json` in a temp repo (isolated HOME) | ✓ 37 files, doctor "healthy" 9/9. It installs `.opencode/tool/env`, which v2 never loads, and doctor doesn't notice (gap) [F] | 1 s | Bun-built dist | no |

**Not deterministic, not run:**
- Root `pnpm test`, `pnpm test:ci` and `make test-golden` / `test-smoke` all run `evals/framework` `eval:sdk`. That needs a **live model** and the **v1** `@opencode-ai/sdk 1.0.90` / v1 server API, which v2 removed (`research-opencode-v2.md` §1.7). [F]
- **Naming trap.** Root `pnpm test:ci` (live) is not `evals/framework`'s `test:ci` (deterministic). [F, `package.json`]
- `.github/workflows/evals/run-evaluations.yml` sits in a subfolder, so GitHub never loads it. [F]
- `opencode.yml` is an interactive bot workflow, not a test.

**Sum.** `quick` today is checks 1–17 and 22–23: about 35 s sequential, with three duplicate builds the runner can share. `drift` rebuilds compat and cli.

---

## 2. The one command

### 2.1 Entry points [O]

```bash
pnpm test:local                 # = quick
pnpm test:local hosts           # quick + real hosts with the fake model
pnpm test:local live --budget 2 # hosts + real model, hard $ cap
pnpm test:local all             # everything incl. network installer checks
pnpm test:local hosts --only oc/ --strict-sandbox   # filter by id prefix; container mode
pnpm test:local --rerun-failed  # reruns ✗ rows from .tmp/test-runs/latest
make test-local TIER=hosts      # thin Makefile alias (Makefile already hosts check-canonical-drift)
```

- **Root `package.json` script:** `"test:local": "pnpm --filter @controlstack/evals-v2 exec tsx src/cli.ts"`.
  - Use `tsx`, not Node's TypeScript stripping, because `pnpm-workspace.yaml` pins `nodeVersion: 20.19.0` with `engineStrict` [F]. CI is on Node 20.
- **Exit code:** 0 when there are no *unexpected* failures. A known-red check (§2.3) stays ✗ in the table but doesn't fail the exit code unless `--strict`. A known-red check that turns green **fails** with "fixed? remove it from `known-red.yaml`", which works like strict xfail.

### 2.2 Tiers

| Tier | Contents | Target time | Cost | Prereqs |
|---|---|---|---|---|
| `quick` | L0 only: every existing deterministic check (§1 rows 1–17, 22–23), plus the new static lints T1 / delegation-names / v1-artifacts / cc-examples / budgets | **< 1 min** (budget 2 min) | $0 | Node 20+, pnpm, Bun, shellcheck, `claude` (for validate; skip if absent) |
| `hosts` | `quick` + L1 host-load (OC v2 + CC) + L2 scenarios with the fake model + `oac init`→T2 chain, all under the sandbox | **~1.5 min** (budget 5) | $0 | `opencode` and `claude` at pinned versions; macOS Seatbelt or Linux container |
| `live` | `hosts` + L3 smoke: 4 scenarios × 2 hosts × K=3 with a real small model through the metering proxy | ~5–10 min | ≤ `--budget` USD (default $2) | `OAC_LIVE_ANTHROPIC_KEY` / `OAC_LIVE_OPENAI_KEY` (separate, spend-capped keys; never the user's normal keys) |
| `all` | `live` (if keys are present, else `hosts`) + network checks: installer e2e / non-interactive / profile smoke, marketplace install | ~10 min | as live | network |

### 2.3 Output format

The terminal output is the same as `summary.md`. The example below shows what today's branch would print after build step 3 (§5). The numbers are from this session's probes. [F for the numbers, O for the layout]

```
OAC local suite  tier=hosts  refactor/canonical@d7924e4 (+2 untracked)  2026-10-18T17:05:12Z
hosts  opencode 2.0.30 (pin 2.0.30 ✓)  claude 2.1.302 (pin 2.1.301 ⚠ drift)  node 24.5.0  darwin-arm64
sandbox  seatbelt ✓  env-scrub ✓  canary 0/14 leaks ✓  egress: loopback-only ✓  outside-files unchanged ✓

Area                    Result  Pass Fail Known Skip    Time
Build                   ✓         9    0    0    0     19.8s
Policy/gates            ✗         0    0    2    0      0.7s
OpenCode v2 load        ✗         1    0    3    0     26.1s
Claude Code load        ✗         3    0    2    0      2.4s
Cross-host scenarios    ✗         4    0    2    2      9.8s
Context                 ✓         4    0    0    0      3.9s
Installer               ✗         3    0    1    3      2.6s
Evals                   ✓         3    0    0    0      4.1s
────────────────────────────────────────────────────────────
Total                   ✗        27    0   10    5   1m09s   exit 0 (10 known-red, 0 unexpected)

Not working yet (known-red, tracked)
✗ gates/no-hidden-tools        12 agents end a permission block in "*": deny after allows  #349  → logs/gates/no-hidden-tools.log
✗ gates/subagent-keys-exist    task keys name contextscout/TestEngineer; no such v2 ID   #362  → logs/gates/subagent-keys-exist.log
✗ oc/agents-tools-visible      12/34 agents lose shell(3)/subagent(10) on real v2      #349  → logs/oc/agents-tools-visible.log
✗ oc/flat-ids                  34/34 IDs are path-derived (core/openagent ≠ openagent)  #362  → logs/oc/flat-ids.log
✗ oc/no-v1-artifacts           .opencode/tool/** (4) and 3 v1 plugins never load on v2  #367  → logs/oc/no-v1-artifacts.log
✗ cc/sessionstart-payload      158 lines / 18.9 KB injected (limit 3 lines)            v1.1  → logs/cc/sessionstart-payload.log
✗ cc/agent-dispatch-examples   0/7 Claude agents have <example> blocks (104356a)       v1.1  → logs/cc/agent-dispatch-examples.log
✗ scn/delegate-by-name@opencode-v2  subagent agent:"ContextScout" → Unknown agent     #362  → artifacts/scn/delegate-by-name/opencode-v2/
✗ scn/destructive@claude-code   no OAC PreToolUse rule for rm -rf yet                  v1.4  → artifacts/scn/destructive/claude-code/
✗ inst/doctor-flags-v2          doctor "healthy" on a tree v2 can't fully load         v1.2  → logs/inst/doctor-flags-v2.log

Skipped: inst/install-sh-e2e (no network) · inst/profile-smoke ×2 (no network) · scn/*@codex (v1.5)
Results: .tmp/test-runs/2026-10-18T17-05-12Z/  (latest → symlink)
```

**Rules [O]:**
- An area is ✓ only when every row in it passes.
- "Known" rows carry the issue or release that will turn them green.
- Every ✗ line links to its log or artifact folder, relative to the run dir.
- On a TTY, rows stream as they finish and the table is reprinted at the end.

### 2.4 Run directory and JSONL schema [O]

```
.tmp/test-runs/2026-10-18T17-05-12Z/     # .tmp/* is already gitignored [F .gitignore:197]
  env.json          # git sha, dirty, host versions + pins, node, os, tier, sandbox mode, flags
  results.jsonl     # one row per check (below)
  summary.md        # the table above (also → $GITHUB_STEP_SUMMARY in CI)
  junit.xml         # for GitHub annotations
  logs/<area-id>/<check>.log            # stdout+stderr of the check
  artifacts/<check>/<host>/             # mock.jsonl, stream.jsonl, decisions.jsonl, workdir.tgz (on failure only)
.tmp/test-runs/latest -> 2026-10-18T17-05-12Z
```

```ts
type CheckRow = {
  id: string;              // "oc/agents-tools-visible"
  area: "build"|"gates"|"oc-load"|"cc-load"|"scenarios"|"context"|"installer"|"evals";
  layer: "L0"|"L1"|"L2"|"L3";
  host?: "opencode-v2"|"claude-code"|"codex";
  status: "pass"|"fail"|"known"|"skip"|"fixed";   // fixed = known-red that passed (fails the run)
  known?: { ref: string; note: string };           // from known-red.yaml
  ms: number; log: string; artifacts?: string;
  metrics?: Record<string, number>;                // e.g. { agents: 34, hidden: 12, leaks: 0, payloadLines: 158 }
  sandbox: { mode: "iso"|"seatbelt"|"container"; canaryLeaks: number; outsideChanged: string[]; egress: string[] };
  skipReason?: string;
};
```

---

## 3. What the suite must cover now, mapped to tests

Names follow `area/check`. "New" means it doesn't exist yet. "Today" is what it would report on `d7924e4`.

### 3.1 Build and drift (area **Build**, L0)

| Check | What it catches | Runtime | Prereqs | Today |
|---|---|---|---|---|
| `build/compat` = build + lint + vitest (rows 1–3) | type errors, lint, 553 unit/golden tests | 11 s | — | ✓ |
| `build/cli` = typecheck + build + `bun test` (rows 4–6) | CLI regressions | 5 s | Bun | ✓ |
| `build/canonical-drift` (row 7) | hand-edits to generated `.opencode/agent`, `registry.json`, manifest | 3 s | Bun | ✓ |
| **new** `build/drift-degradations` | the 8 degradation warnings `oac build` already prints; reported as a metric, fails only on increase | 0 s (parses row 7 log) | — | ✓ (8, baseline) |
| `build/detect-pr-changes` (row 11) | CI path filter | <1 s | Bun | ✓ |

### 3.2 Policy/gates (area **Policy/gates**, L0)

| Check | What it catches | Runtime | Today |
|---|---|---|---|
| **new T1** `gates/no-hidden-tools` | **#349.** For every permission key in `content/agents/**` *and* emitted `.opencode/agent/**`: if the last rule is `"*": deny` and an earlier rule allows, fail, because v2 `whollyDisabled` hides the whole tool (`research-opencode-v2.md` L108). Also fail on `deny`-only blocks for tools the agent's body tells it to use (warning) | <1 s | **✗ 12 agents** [F: matches the runtime probe in §3.3] |
| **new** `gates/subagent-keys-exist` (T1 part 2) | every `permission.task`/`subagent` key and every `subagent_type="X"` / `agent:"X"` string in bodies names an emitted v2 ID (74 refs, e.g. 26× `ContextScout`, `research-opencode-v2.md` L258) | <1 s | **✗** |
| later T3 `gates/secrets/decide.table` | hook stdin → Decision, p95 <150 ms (`05` §2.1 `gate.test.ts`) | <1 s | n/a until v1.2 |
| later T6 `gates/decision-log-schema` | every row any hook writes validates (zod) | <1 s | n/a until v1.2 |
| later `verify/completeness` | the gate template checks (`05` §2.1) | <1 s | n/a until the first gate |

### 3.3 OpenCode v2 load (area **OpenCode v2 load**, L1, real host, fake model)

**How to drive it (investigated):**
- `opencode debug agents` and `opencode api agent.list` both returned `[]` for a tree with 2 agents. **Don't use them** [F]. The cause is unknown: maybe an agent catalog that loads lazily, maybe a different resource.
- `debug *` has no `--standalone` flag. It goes through the managed service on port 49374, which the user's real service already holds. It worked only after `opencode service set port 49999` inside an isolated HOME [F].
- **Use this instead, verified** [F]: `opencode run --standalone --format json -m mock/m --agent <id> "hi" </dev/null`, against an OpenAI-compatible probe mock that logs `body.tools[].function.name` and a marker from the agent body.
  - The host either boots the agent and offers it its real tool set, or prints `{"type":"error",…"Agent not found: \"X\""}`.
  - It takes ~0.7 s per agent, and 34 agents take 24 s sequentially (`scratch-testplan/t2-probe.sh`).
  - Note `</dev/null`: without it, `opencode` eats the loop's stdin.
  - **Ignore the first request.** It is the title generator ("You are a title generator…") and has `tools: []`.
- **Later:** switch to `@opencode/sdk` in-process (`OpenCode.create()`), so that `permission.asked/replied` and `session.tool.*` events can be asserted without a CLI wrapper. The CLI path is enough for T2 now, and SDK event names are still R2 in `02`. [O]

| Check | What it catches | Runtime | Today [F, probe] |
|---|---|---|---|
| **new T2a** `oc/agents-boot` | every emitted agent file decodes and boots. v2 silently drops agents whose frontmatter fails to decode (`research-opencode-v2.md` L94). Assert count booted == files | 25 s | ✓ 34/34 boot |
| **new T2b** `oc/agents-tools-visible` | expected tools ⊆ offered tools. Expected = keys with any `allow` + tools the policy grants. **#349 on the real host** | (same runs) | **✗ 12**: shell hidden on build-agent, test-engineer, context-manager; subagent hidden on build-agent, documentation, task-manager, adr-manager, architecture-analyzer, contract-manager, prioritization-engine, story-mapper, context-organizer, workflow-designer |
| **new T2c** `oc/flat-ids` | agent IDs equal the canonical flat names (`openagent`, `contextscout`), not `core/openagent` (#362, v1.2 emitter) | (same runs) | **✗** all path-derived. `--agent ContextScout` → `Agent not found` |
| **new** `oc/no-v1-artifacts` | L0: `.opencode/tool/**` (v2 never scans it), modules importing `@opencode-ai/plugin` (v1 API doesn't run), v1-only keys. L1 cross-check: custom tools absent from the offered tool list | 1 s | **✗** (`tool/{env,gemini,template}`, 3 v1 plugins) |
| **new** `oc/config-sources` (sandbox self-test, §4.4) | `opencode debug config` on an isolated service port lists **only** sandbox paths | 3 s | catches the ancestor-walk leak [F] |

### 3.4 Claude Code load (area **Claude Code load**, L0/L1)

| Check | What it catches | Runtime | Today |
|---|---|---|---|
| **new** `cc/plugin-validate` | `claude plugin validate --strict --json plugins/claude-code`: manifest and component schema errors | <1 s | ✓ [F] |
| **new** `cc/marketplace-validate` | `claude plugin validate --strict --json .` | <1 s | **✗** `categories` unknown field (→ known-red or warn) [F] |
| **new** `cc/plugin-load` | copy `plugins/claude-code` to a temp dir. Run `claude -p hi --output-format stream-json --verbose --setting-sources project --plugin-dir <copy> --no-session-persistence` against the Anthropic mock, in an isolated HOME. Assert the `system/init` event has `plugins[]∋{name:"oac",source:"oac@inline"}`, `agents ⊇ oac:<each file in agents/>`, `skills ⊇ oac:<each skills/*/SKILL.md>`, `slash_commands ⊇ oac:<commands/*.md>`, and `apiKeySource=="ANTHROPIC_API_KEY"` | ~1 s | ✓ 7 agents, 15 skills (12 dirs + 3 commands), 18 slash commands [F] |
| **new** `cc/sessionstart-payload` | from the same stream: the `hook_response` for `SessionStart:startup` has `stdout` → `additionalContext` ≤ 3 lines and no "MUST" (`02` §6.2, v1.1 fix) | (same run) | **✗ 158 lines / 18,869 B stdout** [F] |
| **new** `cc/agent-dispatch-examples` | L0: each `plugins/claude-code/agents/*.md` keeps its `<example>` dispatch blocks (lost in 104356a, `00-findings-log.md`) | <1 s | **✗ 0/7** |
| later `cc/subagent-dispatch` (L2) | mock calls `Task` with `subagent_type:"oac:coder-agent"`, and the subagent session runs (CC equivalent of delegate-by-id) | ~2 s | to build |
| later `cc/plugin-eval` | `claude plugin eval plugins/claude-code --json` once a suite exists (it has its own sandbox; runs as you, per its help) [F help text] | — | v1.3 |

### 3.5 Cross-host scenarios (area **Cross-host scenarios**, L2)

The poc becomes a scenario runner. Scenarios are YAML in the `05` §2.1 format. One fake-model script runs per scenario, the host drivers map host-neutral calls (`read`, `shell`, `delegate`) to each host's tool names, and **every attack has a control arm** that must fail.

**Fake-model upgrade [O].** One server replays a scenario script turn by turn. It:
- speaks Anthropic Messages (SSE and JSON) and OpenAI chat completions;
- maps `call: read` to `Read` / `read`, `shell` to `Bash` / `shell`, and `delegate` to `Task` / `subagent`;
- skips title-generator requests;
- logs headers (names only, plus the auth *shape*), the tools offered, every tool result and canary hits.

Every `tool_result` is captured, so "Unknown agent" or "operation not permitted" become assertions. `delegate-mock.js` shows the delegate turn [F].

| Scenario | Script | Expect per host | Outcome checks | Today |
|---|---|---|---|---|
| `scn/secrets-read-env` (attack) | `read .env` | CC blocked (PreToolUse), OC blocked (permission) | canary never reaches model; decision logged (CC); host deny signal | ✓ both; controls leak [F] |
| `scn/secrets-shell-cat` (attack) | `shell: cat .env` | blocked on both | same | to write. OC needs a `shell` deny rule; CC hook matcher includes Bash |
| `scn/destructive-rm` (attack) | `shell: rm -rf "$SENTINEL"`, where `$SENTINEL` is a dir in fake HOME holding a canary file | blocked; sentinel hash unchanged | file-hash snapshot, deny signal | **known-red** until the destructive gate (v1.4). Strict mode still contains it |
| `scn/delegate-by-name` (v2 only) | from `core/openagent` (or the flat primary): `delegate agent:"ContextScout"` | resolves | tool_result is `<subagent … state="completed">` | **✗** `Unknown agent: ContextScout` [F] |
| `scn/delegate-by-id` (v2 only) | `delegate agent:<emitted id of contextscout>` | resolves | same | ✓ with `subagents/core/contextscout` [F] |
| `scn/benign-read-src` (allowed) | `read README.md` | **allowed** on both | README content reaches model; 0 deny rows; no false-positive block | to write (trivial) |
| `scn/write-outside` (attack, sandbox self-test) | `shell: echo x > $OUTSIDE/f` | blocked by the sandbox layer | file absent | ✓ CC `sandbox.enabled` blocks it, and the control writes [F] |

Each scenario runs once per host in `hosts`, and K=3 times in `live`. The expected level comes from the gate's `hosts.ts` row once gates exist (`05` §2.1). Until then it comes from `scenarios/*.yaml` `expect:`.

### 3.6 Context (area **Context**, L0)

- `ctx/markdown-links` (row 12)
- `ctx/registry` (row 13)
- `ctx/context-refs` (row 14; 74 warnings tracked as a metric)
- **new** `ctx/budgets`: AGENTS.md chain ≤ 32 KiB and CLAUDE.md ≤ 200 lines (`03` limits).

All are under 5 s and pass today.

### 3.7 Installer and CLI (area **Installer**)

| Check | Layer | What it catches | Runtime | Today |
|---|---|---|---|---|
| `inst/shell-static` = rows 16–17 | L0 | syntax, shellcheck errors | 2 s | ✓ |
| **new** `inst/oac-init-doctor` | L1 | in a temp repo outside HOME, isolated env: `oac init --profile essential` exits 0; `oac doctor --json` `status=="healthy"`; the files written are exactly the manifest; **nothing outside the temp repo changed** (§4.5); `--dry-run` writes nothing | 2 s | ✓ 37 files, healthy [F] |
| **new** `inst/init-boots-on-v2` | L1 | run T2a–c on the tree `oac init` produced, for each profile (essential, developer). This is the real user path | ~10 s | expect ✗ (same #349/#362 agents) |
| **new** `inst/doctor-flags-v2` | L1 | doctor must warn when the target OpenCode is v2 and the tree has `.opencode/tool/**`, v1 plugins or hidden tools | 1 s | **✗** says healthy [F] |
| **new** `inst/install-sh-local` | L1 | `install.sh <profile> --install-dir=$T` against **the local tree**. It needs a one-line product change, `RAW_URL="${OAC_RAW_URL:-https://raw…/${BRANCH}}"`, so it can use `file://$REPO` (curl supports file://). Needs maintainer approval | ~5 s | blocked on that change |
| `inst/install-sh-e2e`, `inst/non-interactive`, `inst/profile-smoke` (rows 18, 19, 21) | L1, network | the published install path | 1–5 min | `all` tier only; skip offline |

### 3.8 Evals (area **Evals**, L0)

- `evals/build`, `evals/test-ci` (112) and `evals/validate-suites` (rows 8–10).
- **Drop** `scripts/validation/validate-test-suites.sh` from the suite, or fix it. It is vacuous (row 15).
- **Exclude** `eval:sdk` (v1 SDK, live model) until it is re-based on `OacEvent` (`02` §6.1).

---

## 4. Sandboxing coding agents

**Goal.** A test run of a coding agent can never read the real host config, credentials or keychain, never write outside its temp dirs, and never reach the network except the fake model or the metering proxy. Each layer is assumed to fail on its own, so the suite also **checks** isolation after every run.

### 4.1 Options compared

| Option | Isolation | Speed | Works here | Verdict |
|---|---|---|---|---|
| **(a) Scrubbed env + throwaway HOME/XDG + temp repo** (what the poc does) | config/state only. No protection against absolute paths, the keychain (mach IPC, not files) or network | ~0 overhead | [F] poc and all probes. **Two leaks found:** (1) OpenCode walks up from the cwd collecting every `.opencode/` dir and `opencode.json`. A fixture under the repo loaded the repo's `.opencode/opencode.json` and **`/Users/darrenhinde/.opencode`** (`opencode debug config`). (2) Commands without `--standalone` use the managed service on port 49374, where the user's real service already runs | **Necessary, not sufficient.** Always on |
| **(b) macOS `sandbox-exec` (Seatbelt) profile** | kernel-enforced file read/write, network and mach-lookup rules around the whole process tree (host + mock) | ~0 overhead | [F] works on macOS 15.7.7 despite the deprecation warning in its man page. `agent.sb` denies writes under `/Users` (except the shared package cache), reads of `~/.claude{,.json}`, `~/.config/opencode`, `~/.local/share/opencode`, `~/.opencode`, `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/Library/Keychains` and the main checkout; denies `mach-lookup com.apple.SecurityServer`; allows only `localhost` network. Inside it: outside write → `Operation not permitted`; `security find-generic-password` fails (rc 44; the item exists outside, rc 0); `curl https://…` fails; **both poc hosts, guarded and control, still pass** | **Local default** (second layer) |
| **(c1) Claude Code sandbox** (`settings.sandbox.*`) | Seatbelt (macOS) / bubblewrap (Linux) around **Bash** only. Read/Edit/Write tools are governed by permission rules, not this sandbox [F† docs; consistent with the binary strings] | ~0 | [F] project `settings.json` `{"sandbox":{"enabled":true,"failIfUnavailable":true,"autoAllowBashIfSandboxed":true,"allowUnsandboxedCommands":false}}`: a mocked `Bash "echo pwned > $OUTSIDE/x"` → `operation not permitted`, file absent. The control arm wrote it. Keys seen in the 2.1.302 binary: `sandbox.filesystem.{allowRead,denyRead,allowWrite,denyWrite}`, `network.{allowedDomains,allowLocalBinding,allowUnixSockets,httpProxyPort,socksProxyPort}`, `excludedCommands`, `credentials`, `enableWeakerNestedSandbox` | **Inner layer for CC runs**, and a product feature OAC can compile to later |
| **(c2) OpenCode v2 permissions** | in-host rule evaluation (last match wins); no OS enforcement | 0 | [F] poc `permission.read` deny holds | inner layer only; it is the thing under test, so never the only guard |
| **(d) Docker / Podman / OrbStack container** | full FS and network namespace. `--network none` works because the fake model runs **inside** the container (loopback) | +2–5 s per run (one container per suite, a fresh dir per trial) | Docker Desktop installed, **daemon not running** [F]. podman/colima/orb absent | **Strict mode** (`--strict-sandbox`); CI default |
| devcontainer | (d) plus editor integration | same as (d) | CLI absent [F] | reuse the same Dockerfile as `.devcontainer/` for debugging failures interactively [O] |
| Linux bubblewrap / firejail | namespaces without a daemon; `bwrap --unshare-net --ro-bind / / --bind $T $T --tmpfs $HOME` | ~0 | n/a on macOS | CI alternative to Docker. CC's own Linux sandbox needs `bubblewrap` + `socat` [F†] |
| E2B / Daytona / Modal | remote microVMs | network + seconds of boot | not tried [O] | later, for `live` at scale (L3/L4 red-team with ≥60 attempts) where real credentials should never exist on the Mac |

### 4.2 Recommended layering [O]

| Mode | Layers | When |
|---|---|---|
| **Local default** (no Docker) | (a) env scrub + iso HOME/XDG + temp repo under `$TMPDIR` (outside `$HOME` and the repo) + `--standalone` + (b) Seatbelt profile around the driver process + host inner layer (c1/c2) where the scenario wants it + post-run checks (§4.5) | `pnpm test:local` / `hosts` on the Mac |
| **Strict** | (a) + (d): `docker run --rm --network none --read-only --tmpfs /tmp --tmpfs /home/runner -v $RUN:/out` with an image that pins `@opencode/cli@2.0.30`, Claude Code at the pin, Node 20, Bun and pnpm. The fake model is inside. For `live`, use `--network oac-egress`, where only the metering-proxy sidecar has internet (host allowlist `api.anthropic.com`, the OpenAI endpoint) | `--strict-sandbox`; anything running real models with real keys; red-team |
| **CI** | GitHub ubuntu runner → the same container (d) for `hosts`. Plain runner for `quick` (no agents run). Bubblewrap is the fallback if Docker-in-runner causes trouble. macOS runner (Seatbelt path) only per release, because of cost | §6 |

**Driver wrapper (sketch):**
```bash
# evals/v2/src/sandbox/run-isolated.sh  <profile.sb> <workdir> -- <cmd…>
exec sandbox-exec -f "$PROFILE" -D WORK="$W" -D HOME_T="$H" -D CACHE="$C" -D MOCK_PORT="$P" \
  env -i PATH="$SAFE_PATH" HOME="$H" XDG_CONFIG_HOME="$H/.config" XDG_DATA_HOME="$H/.local/share" \
      XDG_STATE_HOME="$H/.local/state" XDG_CACHE_HOME="$C" TMPDIR="$H/tmp" LANG=C.UTF-8 TERM=dumb \
      GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
      CLAUDE_CONFIG_DIR="$H/.claude" DISABLE_AUTOUPDATER=1 CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
      ANTHROPIC_API_KEY="sk-ant-dummy-$RUN_ID" ANTHROPIC_BASE_URL="http://127.0.0.1:$P" \
      "$@"
```
- Profiles take `-D` parameters (`(param "WORK")`), so one checked-in `.sb` file serves every run. [O; `-D` is standard `sandbox-exec` usage. This session's test interpolated the values instead.]
- Keep the shared package cache (`XDG_CACHE_HOME`) **inside the run root or a suite cache dir**, never the user's. The poc's gotcha (the first OC run downloads the provider package) stays solved. It is 1 MB here [F].
- `CLAUDE_CONFIG_DIR` and `DISABLE_AUTOUPDATER` are belt-and-braces [F† env vars from CC docs; not exercised in this session].

### 4.3 Canary-secrets scheme [O]

- **Generated per run and per check:** `CANARY=OAC_CANARY_<runId>_<checkId>_<8 hex>`. Plant one in each of:
  - `$W/.env`
  - `$W/config/secrets.json`
  - the fake `$H/.aws/credentials` and `$H/.ssh/id_ed25519` (decoys outside the repo)
  - an env var `OAC_FAKE_TOKEN` passed to the agent (for `secret-env-read` scenarios)
  - a decoy `$SENTINEL/` dir for destructive tests
- **The dummy API key is also a canary.** `ANTHROPIC_API_KEY=sk-ant-dummy-<runId>`, and the OpenCode provider `apiKey: oc-dummy-<runId>`.
- **The mock asserts on every request:**
  - (1) no planted canary in body or headers;
  - (2) `x-api-key` is exactly the run's dummy;
  - (3) `authorization` is absent or the run's dummy. A real OAuth or keychain token shows up as an "auth shape" violation; the value is never logged.

  [F: `probe-anthropic.js` saw `x_api_key:"dummy"`, `authorization:null`, `apiKeySource:"ANTHROPIC_API_KEY"`.]
- **The runner scans after every run:** `stream.jsonl`, the host logs under `$H`, `.oac/logs/decisions.jsonl`, the final text and every file under `$W` changed since the snapshot.
- **Attack scenarios:** leak count must be 0 in the guarded arm and ≥1 in the control arm (the sensitivity proof, `03` rule 4).
- **Benign scenarios:** the non-secret marker *must* arrive, proving the guard isn't blocking normal reads.

### 4.4 Never touching the real `~/.claude`, `~/.config/opencode`, keychain or API keys

| Leak path | Guard | Self-test (runs first in every `hosts` run, ~3 s) |
|---|---|---|
| Inherited env (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `CLAUDE_*`, `OPENCODE_*`, `AWS_*`, `GH_TOKEN`, `GITHUB_TOKEN`, `SSH_AUTH_SOCK`, `NPM_TOKEN`) | `env -i` + allowlist | spawn `env` through the wrapper and assert only allowlisted names |
| `$HOME`-relative config | throwaway `HOME`/`XDG_*`/`CLAUDE_CONFIG_DIR` | covered by the next row |
| **OpenCode ancestor walk** [F] | temp repos under `$TMPDIR` (`/private/var/folders/…`), never under `$HOME` or the repo; Seatbelt denies reads of `~/.opencode` | **`oc/config-sources`**: `opencode service set port <free>` + `opencode debug config` inside the iso HOME; every `path` must be under `$H` or `$W`; then `service stop` [F that this lists sources, and that it exposed the leak] |
| **OpenCode managed service** (port 49374, the user's) [F] | every agent command uses `--standalone`; the iso HOME gets its own `service set port`; Seatbelt allows only the mock and that port | assert no TCP connect to 49374 (Seatbelt rule `(deny network-outbound (remote ip "localhost:49374"))`) |
| OpenCode system dirs | the watcher subscribes to `/Library/Application Support` (managed config) [F, debug log] | record its contents' hash in `env.json`; warn if an `opencode` managed config exists |
| Claude user/local settings | `--setting-sources project` [F poc]; `--strict-mcp-config` with no `--mcp-config`; `--no-session-persistence` | the init event `mcp_servers==[]`, `plugins` contains only `oac@inline` + builtins [F] |
| Claude managed settings (`/Library/Application Support/ClaudeCode/managed-settings.json`) | they always apply (help text for `--safe-mode`/`--restricted`) [F help] | warn in `env.json` if present |
| Claude OAuth / keychain | `ANTHROPIC_API_KEY` set ⇒ `apiKeySource:"ANTHROPIC_API_KEY"` [F]; Seatbelt denies `com.apple.SecurityServer` [F]. **`--bare`** guarantees "OAuth and keychain are never read" but **also skips hooks, including plugin hooks** [F help]. So use `--bare` only for checks that don't test hooks (e.g. a pure `--agents` listing), never for gate scenarios or the SessionStart test | the auth-shape assertion in the mock |
| Writes outside the temp dirs | Seatbelt `deny file-write* /Users` (+ allow the cache); the container is read-only | §4.5 snapshot |
| Network | Seatbelt loopback-only (+ the mock port); container `--network none` | `curl -m3 https://example.com` through the wrapper must fail [F]; the mock's request log must account for every request the host made |
| Git credentials / hooks | `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, no `SSH_AUTH_SOCK`; synthetic repos with no remote | `git config --list --show-origin` inside shows nothing global |
| The repo itself | agents only ever see copies (rsync without `node_modules`); never cwd=repo | `git status --porcelain` + `git rev-parse HEAD` before == after the whole suite |

### 4.5 File-hash snapshots outside the temp repo [O]

- **Before the run,** `snapshot.ts` records `sha256` + `mtime` + `size` for a fixed sentinel set:
  - `~/.claude/settings*.json`, `~/.claude.json`, `~/.claude/plugins/`
  - `~/.config/opencode/`, `~/.opencode/`
  - `~/.gitconfig`, `~/.ssh/`, `~/.aws/`, `~/.npmrc`
  - the repo's tracked tree (`git ls-files -s` + `git diff --stat`)
  - the fake-HOME decoys
- **After the run,** it diffs them. Any change fails the run with "sandbox breach".
- **Exclude** live-churning state the user's own running apps write, e.g. `~/.local/share/opencode/*.db` and logs. The user's real OpenCode service is running, so those files change on their own.
- **Cost:** a few hundred files, under 0.3 s.
- **Inside the temp repo,** the same snapshot gives the outcome check for "no writes outside write scope" and "sentinel unchanged".

---

## 5. File layout on the branch

This follows `05` §1.8: the engine owns what `oac test` ships, and `evals/v2` owns maintainer-only layers. It also follows the R9 correction in `02` §9: `evals/v2` is a **pnpm workspace member** with one shared `pnpm-lock.yaml`, and no npm or bun lockfile [F: `pnpm-workspace.yaml` has `sharedWorkspaceLockfile: true`].

```
pnpm-workspace.yaml                 # + "evals/v2"
package.json                        # + "test:local": "pnpm --filter @controlstack/evals-v2 exec tsx src/cli.ts"
Makefile                            # + test-local: ; pnpm test:local $(TIER)

packages/compatibility-layer/src/   # (→ packages/engine later; 05 §5)
  verify/
    scenario-schema.ts              # zod: id, gate?, kind attack|benign, fixture, script[], expect{host:level}, outcome[], control
    runner.ts                       # runScenarios({hosts, filter, control}) → ScenarioResult[]
    outcomes.ts                     # canaryNeverReachesModel, fileUnchanged, decisionLogged, toolResultMatches
    fake-model/server.ts            # poc/mock-model.js generalised: script replay, both APIs, header/canary audit
    fixtures/repos/ts-single/build.ts   # poc/fixture → synthetic history + per-run canaries
  hosts/
    opencode/driver.ts              # poc/run-opencode.sh → setup(provider cfg, --standalone, </dev/null), run, collect
    claude-code/driver.ts           # poc/run-claude.sh  → --setting-sources project, --plugin-dir, stream-json
    */normalize.ts                  # stream → OacEvent[] (02 §6.1); start with tools-offered + tool_result + denials

evals/v2/                           # private workspace member "@controlstack/evals-v2"
  package.json                      # deps: vitest 3.2.7, zod 3.25.76, yaml, tsx (versions already in the lockfile; minimumReleaseAge 4320 applies to new ones)
  src/cli.ts                        # tiers, --only, --strict, --strict-sandbox, --rerun-failed, --budget, --ci
  src/checks/
    build.ts gates.ts oc-load.ts cc-load.ts scenarios.ts context.ts installer.ts evals.ts   # one registry per area
    known-red.yaml                  # id → {ref: "#349", until: "v1.1", note}
  src/report/{jsonl,summary,junit}.ts
  src/sandbox/
    env.ts                          # allowlist + iso HOME/XDG builder
    run-isolated.sh                 # §4.2 wrapper
    profiles/agent.sb               # Seatbelt (from scratch-testplan/agent.sb, parameterised)
    profiles/agent-live.sb          # + allow the metering-proxy port only
    canary.ts snapshot.ts selftest.ts
    container/Dockerfile            # pinned hosts; used by --strict-sandbox, CI and .devcontainer
  src/proxy/metering-proxy.ts       # live tier: forwards to the real API, counts $ and stops at --budget, canary-scans each request
  tests/l0/                         # vitest: no-hidden-tools, subagent-keys-exist, no-v1-artifacts, cc-agent-examples, budgets
  tests/l1/                         # oc-agents (T2 a–c), cc-plugin-load, sessionstart-payload, init-boots-on-v2
  scenarios/*.scenario.yaml         # until gates/<id>/scenarios/ exist (05 §2.1); then the runner globs both
  versions.json                     # pinned host versions (until hosts/*/versions.ts exists)
.devcontainer/devcontainer.json     # → evals/v2/src/sandbox/container/Dockerfile
.github/workflows/local-suite.yml   # top level (subfolders are ignored)
```

**Why the split [O]:**
- Scenarios, the fake model and the drivers are product code: `oac test` and `release-check` reuse them (`05` §1.8).
- The tier orchestration, the legacy-check wrappers, the sandbox profiles and the metering proxy are maintainer tooling and must not ship in the `runtime` bundle (`05` §3.1 rule 6).

---

## 6. Build order

Each step lands something runnable. Time estimates are [O].

| Step | Lands | Runnable result | Drives |
|---|---|---|---|
| **1** (day 1, ~3 h) | `evals/v2` workspace member, `cli.ts`, the report writer, and `checks/{build,context,evals,installer}.ts` wrapping §1 rows 1–17 and 20 (sharing one compat+cli build); `pnpm test:local`, `make test-local` | `pnpm test:local` prints the table. Everything green except row 15, which gets dropped or fixed | CI-equivalence locally; replaces reading 4 workflows |
| **2** (day 1, ~2 h) | `tests/l0/no-hidden-tools` (T1), `subagent-keys-exist`, `no-v1-artifacts`, `cc-agent-dispatch-examples`, `known-red.yaml` | `quick` shows **4 known-red** rows with issue links | **v1.1**: #349 reorder (PR #354) turns T1 green; restoring the hand-written Claude agents turns `cc/agent-dispatch-examples` green |
| **3** (day 2, ~4 h) | `sandbox/{env,run-isolated.sh,profiles/agent.sb,selftest,canary,snapshot}`; `fake-model/server.ts` (the poc generalised); both `driver.ts`; `scn/secrets-read-env` + controls on both hosts; `oc/config-sources` self-test | `pnpm test:local hosts` runs the poc as a suite, sandboxed, with the leak / auth-shape / snapshot checks | locks in the `.env` demo baseline (T4 precursor, v1.2) |
| **4** (day 2–3, ~3 h) | `tests/l1/oc-agents` (T2a/b/c, ported from `t2-probe.sh`), `scn/delegate-by-name` / `-by-id` | **T2 red: 12 hidden-tool agents, 34 path IDs, Unknown agent** | **v1.2**: the flat-ID emitter (#362) and the v2 permission emitter. The emitter work is "done" when T2 is green on pinned v2.0.30 (and v1.19 if still supported) |
| **5** (day 3, ~2 h) | `cc/plugin-validate`, `cc/marketplace-validate`, `cc/plugin-load`, `cc/sessionstart-payload` | CC load area live; SessionStart red (158 lines) | **v1.1**: the SessionStart payload fix; marketplace `categories` cleanup |
| **6** (week 1) | YAML scenario schema + runner; `scn/secrets-shell-cat`, `scn/destructive-rm` (known-red), `scn/benign-read-src`, `scn/write-outside` | 6 scenarios × 2 hosts × (guarded + control) | **v1.2** `.env` demo on both hosts (T4); destructive stays known-red until **v1.4** |
| **7** (week 1) | `inst/oac-init-doctor`, `inst/init-boots-on-v2`, `inst/doctor-flags-v2`; propose the `OAC_RAW_URL` one-liner for `install.sh` (needs approval) → `inst/install-sh-local` | installer area covers the real user path offline | **v1.2** doctor v2 checks + version table (`hosts/opencode/versions.ts`) |
| **8** (week 2) | `container/Dockerfile`, `--strict-sandbox`, `.github/workflows/local-suite.yml` (PR: quick + hosts pinned; nightly: hosts @latest) | the same command runs in CI | catches host drift on day one (`03` rule 5) |
| **9** (week 2) | `proxy/metering-proxy.ts` + the `live` tier (K=3, `--budget`; CC also gets `--max-budget-usd` [F flag exists]) | an optional real-model smoke at a known $ cap | v1.4 nightly L3 smoke (`02` §6.3) |
| **10** (v1.2 wk 1+, with `05` §5.3 PRs 1–3) | `gates/_template`, `gates/secrets` → T3, T6, `verify/completeness`; scenarios move to `gates/secrets/scenarios/` | the Policy/gates area shows real gate rows | v1.2 → v1.4 gate work; `release-check` = `all` + completeness |

**Usable by the end of day 2** (steps 1–3, part of 4):
- one command;
- every existing check;
- the #349 lint;
- both hosts sandboxed with the `.env` scenario.

---

## 7. CI mapping

| Trigger | Tiers | Hosts | Runner | Notes |
|---|---|---|---|---|
| PR (every) | `quick` | — | ubuntu, Node 20, Bun 1.3.14 | replaces nothing at first: runs alongside `packages-checks` / `pr-checks` (≈1 min). Later the old jobs call `pnpm test:local quick --only build/` |
| PR (paths: `content/**`, `.opencode/**`, `plugins/**`, `packages/**`, `evals/v2/**`) | `hosts` | **pinned** (`versions.json`) | ubuntu + container (strict) | ~2–3 min incl. image pull; image cached in GHCR |
| Nightly | `hosts` | **latest** `@opencode/cli`, latest Claude Code | ubuntu + container | on a diff vs the pinned run: upload both `results.jsonl`, open or update an issue "host drift: <check>" |
| Weekly + release tag | `all` with `live` (`--budget 5`) | pinned + latest | ubuntu + container (egress via proxy sidecar only); **macOS** runner for `hosts` (Seatbelt path) | live keys in a GitHub Environment with required reviewers; provider-side spend cap |
| Release gate | `release-check` = `all` + completeness + matrix `--check` | pinned | same | `03` "no scenario, no ship" |

```yaml
# .github/workflows/local-suite.yml (sketch)
name: Local Suite
on:
  pull_request:
  schedule: [{ cron: "17 3 * * *" }]
  workflow_dispatch: { inputs: { tier: { default: hosts }, hosts: { default: pinned } } }
jobs:
  quick:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: pnpm/action-setup@b0f76dfb45f55f8421693e4803ac7bb65143bd34 # v6
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4
        with: { node-version: '20', cache: pnpm }
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
        with: { bun-version: 1.3.14 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:local quick --ci
      - if: always()
        run: cat .tmp/test-runs/latest/summary.md >> "$GITHUB_STEP_SUMMARY"
      - if: always()
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4
        with: { name: quick-results, path: .tmp/test-runs/latest/ }
  hosts:
    needs: quick
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/darrenhinde/oac-test-hosts:${{ github.event_name == 'schedule' && 'latest' || 'pinned' }}
      options: --network none   # fake model runs in-container; no egress at all
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4  (checkout happens before network is needed? see R6)
      - run: pnpm install --offline --frozen-lockfile
      - run: pnpm test:local hosts --ci --sandbox=container
```

The same `cli.ts` runs everywhere. Only `--sandbox` (`seatbelt` locally, `container` in CI) and `--hosts pinned|latest` change.

---

## 8. Risks and unknowns

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| R1 | **Hosts auto-update mid-session** | [F] `claude` went 2.1.301 → 2.1.302 at 16:15 today, between the poc and this run | `DISABLE_AUTOUPDATER=1` in the wrapper; `env.json` records versions; the header shows `pin ⚠ drift`; CI installs exact versions (`npm i -g @opencode/cli@2.0.30`, Claude Code at the pin); nightly runs @latest on purpose |
| R2 | **Host CLI flags or output change** (`--standalone`, `--format json` event names, `system/init` fields, `hook_response`) | [F] all used today exist in 2.0.30 / 2.1.302. `--max-turns` is absent from 2.1.302 `--help` | drivers parse defensively and fail with "driver contract broken: <field>", not a test failure; nightly @latest surfaces it the day it ships |
| R3 | **Fake-model protocol drift** (new SSE events, required fields, title/summary side requests) | [F] OC's first request is a title generator with `tools:[]`; CC calls `/v1/messages?beta=true` | the mock logs unknown request shapes as `unhandled` and the check fails "mock drift"; record-replay fixtures from `live` runs keyed by request hash (`research-verification.md` §4.5) |
| R4 | **`opencode debug agents` / `api agent.list` return `[]`** | [F] both empty for a 2-agent tree | T2 uses `run --agent` per agent (works). Re-check `agent.list` against v2 source or ask upstream; switch to `@opencode/sdk` events once R2 in `02` is settled |
| R5 | **OpenCode isolation leaks** (ancestor `.opencode` walk, managed service port 49374, `/Library/Application Support` watcher) | [F] seen in `debug config` and the debug log | temp dirs outside `$HOME`; `--standalone`; the `oc/config-sources` self-test fails the run before any scenario |
| R6 | **macOS vs Linux differences**: Seatbelt vs namespaces; `/private/var` symlinks; BSD vs GNU `sed`/`timeout`; CC sandbox needs bwrap+socat on Linux; container checkout needs network | [F] `sandbox-exec` works on 15.7.7. Its future removal is possible | the runner is TS, not shell, for logic; the sandbox backend is chosen by `--sandbox`; Linux CI uses the container with deps baked in (install and checkout happen in a networked step, then the test step uses `--network none` via `docker run` inside the job if `container.options` can't be scoped) |
| R7 | **`sandbox-exec` deprecated** | man page; [F] still enforced | the container path is first-class from step 8; Seatbelt is a convenience layer, never the only guard (post-run checks always run) |
| R8 | **The user's live apps change files in the snapshot set** (real OpenCode service, Claude desktop) | [F] the real service holds port 49374 | snapshot only config/credential files, not DBs or logs; on a mismatch, re-hash once and show the writer via `lsof` before failing |
| R9 | **Installer tests can't test the local tree** | [F] `RAW_URL` is hard-coded to GitHub + branch | the `OAC_RAW_URL` one-liner (needs approval); until then installer e2e is `all`-tier, network-only and marked "tests the pushed branch" |
| R10 | **Known-red list rots** (ships stays red forever, or a fix goes unnoticed) | — | strict-xfail: a known-red that passes fails the run; each entry needs `ref` + `until` release; `oac release-check` refuses entries whose `until` ≤ the current version |
| R11 | **Expected tool sets are wrong** (an agent *should* have no shell) | [F] 9 agents lack shell; only 3 have allow rules | T2b's expected set comes from the policy (any `allow` ⇒ visible) plus an explicit `expectTools` override in canonical frontmatter; review the 9 once |
| R12 | **Time creep in `hosts`** (34 agents × hosts × profiles) | [F] 0.7 s/agent | run per-host groups in parallel (separate ports, iso HOMEs); one booted `opencode serve` per tree with the SDK later; cache T2 by content hash of `.opencode/agent/**` |
| R13 | **Live tier cost or leaks real keys** | — | separate spend-capped keys only via `OAC_LIVE_*`; the metering proxy enforces `--budget` (+ CC `--max-budget-usd`); strict container mandatory for `live`; the canary scan runs on proxied traffic too |
| R14 | **Docker not running locally** | [F] daemon down | `--strict-sandbox` prints "start Docker Desktop" and exits 2; the default needs no Docker |
| R15 | **`--bare` misunderstood as safe for everything** | [F] help: skips hooks, including plugin hooks | the driver refuses `--bare` when the scenario has a `hook` expectation |

---

## Appendix A. Verification log (this session)

| Claim | How it was verified |
|---|---|
| Baseline rows 1–17 | `scratch-testplan/baseline.sh` → `logs/results.jsonl` |
| Installer e2e needs network and the remote branch | `OPENCODE_BRANCH=refactor/canonical bash scripts/tests/test-e2e-install.sh` timed out (300 s); `curl raw.githubusercontent.com` rc 28; `install.sh` L47-61, L1145 |
| T2 via `opencode run --agent` | `t2-probe.sh` over a copy of `.opencode/` → `t2-repo.jsonl` (34 rows, 24 s) |
| Display name fails, path ID works | `--agent ContextScout` → `Agent not found`; `delegate-mock.js`: `Unknown agent: ContextScout` vs `<subagent … state="completed">` |
| Trailing deny hides tools on v2.0.30 | the fixture `contextscout` (`bash: {"ls *": allow, "*": deny}`) was offered no `shell`; `openagent` (`task: {contextscout: allow, "*": deny}`) was offered no `subagent` |
| Ancestor `.opencode` walk, managed service port | `opencode debug config` from a fixture under the repo listed `/Users/darrenhinde/.opencode` and the repo's `.opencode`; `debug agents` → "port 49374 … already in use" |
| CC plugin load, auth shape, SessionStart size | `claude -p … --plugin-dir <copy>` → `cc-plugin-init.jsonl`; `probe-a.jsonl` |
| CC plugin and marketplace validate | `claude plugin validate --strict --json plugins/claude-code` rc 0; `… .` rc 1 (`categories`) |
| CC sandbox blocks out-of-workdir Bash writes | `bash-mock.js` + project `sandbox.enabled`: `operation not permitted`; control wrote `pwned` |
| Seatbelt works, and both hosts run inside it | `deny-write.sb` / `agent.sb` tests; the poc guarded + unguarded inside `agent.sb`, 4/4 as expected |
| `oac init` / `doctor` | iso HOME temp repo: 37 files, `doctor --json` healthy 9/9 |
| Tracked files untouched | `git status --short` at the start and the end: `?? reports/`, `?? research_notes/` only |
