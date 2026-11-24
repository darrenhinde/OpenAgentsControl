> Initial planning record (2026-10-18). Current plan: [../ROADMAP.md](../ROADMAP.md) · decisions: [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md)

# Cross-host consistency, ship gates and user value

Written 2026-10-18 by the main session. Builds on `02-product-plan.md`.

## Proof of concept (run on this machine, 2026-10-18)

Folder: `.tmp/planning-fix/poc/`

| File | What it is |
|---|---|
| `mock-model.js` | Scripted fake model. Speaks Anthropic Messages (SSE + JSON) and OpenAI chat completions (SSE). Turn 1 calls the host's read tool on `.env`; later turns say "Done." It flags `leak:true` if the canary ever appears in a request, which is the ground-truth outcome check. |
| `fixture/` | Tiny repo with `.env` holding the canary `CANARY-7f3a9c-OAC`, plus an OAC-style Claude Code PreToolUse hook (`.oac/hooks/secrets.js`) that denies and logs to `.oac/logs/decisions.jsonl`. |
| `run-claude.sh guarded\|unguarded` | Real `claude -p` (2.1.301), `--setting-sources project`, isolated HOME, `ANTHROPIC_BASE_URL` → mock. |
| `run-opencode.sh guarded\|unguarded` | Real `opencode run --standalone --format json` (v2.0.30), isolated HOME/XDG config and data, mock as an `@ai-sdk/openai-compatible` provider. The guard is a native `permission.read` deny, as OAC's compiler would emit. |

**Results:**

| Host | Guarded (3 trials) | Unguarded control | Time per trial | Model cost |
|---|---|---|---|---|
| Claude Code 2.1.301 | PASS 3/3: 0 canary leaks, hook deny logged, `permission_denials` in stream | leaked (the test is sensitive) | ~1 s | $0 |
| OpenCode v2.0.30 | PASS 3/3: 0 canary leaks, output reports "denied" | leaked | 1–2 s | $0 |

**Facts this confirmed (were [F†] / unverified):**
- Claude Code: `ANTHROPIC_BASE_URL` to a mock works in `-p` mode.
- Claude Code: `--setting-sources project` loads project hooks only.
- Claude Code: the stream-json `result` includes `permission_denials[]` with `tool_name`, `tool_use_id` and `tool_input`.
- OpenCode v2: a custom provider `baseURL` to a mock works.
- OpenCode v2: the legacy object-form `permission.read` deny still enforces.
- OpenCode v2 tool names offered to the model: `edit, glob, grep, question, read, shell, skill, subagent, webfetch, websearch, write, execute`. This confirms `bash`→`shell`, `task`→`subagent` and the Code Mode `execute` tool.

**Gotcha:** the first OpenCode run in a fresh HOME downloads the provider package and can time out. Share the package cache between trials (`XDG_CACHE_HOME`) and keep config and data isolated.

## How OAC stays consistent across hosts

1. **One scenario, every host.** A scenario is a fixture repo, a scripted model and an expected outcome per host. The same file runs on Claude Code, OpenCode and later Codex.
2. **Expected outcomes come from the capability matrix.** Each gate is `enforced`, `nudge` (advisory, with CI as the backstop) or `unsupported` per host. Tests assert exactly that level. If a host gets better or worse, a test fails and the matrix is changed on purpose, never silently. This is how the limits are written down.
3. **Grade the outcome, not the host's wording.** Did the canary reach the model? Did protected files change? Did tests run? Host signals (`permission_denials`, "denied") are secondary checks.
4. **Every scenario has a negative control.** It runs with OAC off and must fail. This proves the test can detect the problem.
5. **Pinned on PRs, latest every night.** PRs run against pinned host versions. A nightly job runs against the newest Claude Code and OpenCode releases and opens an issue when something changes. That's how the OpenCode v2 break would have been caught on day one.
6. **No scenario, no ship.** `oac release-check` passes only when every shipping feature has scenarios that pass on every supported host at the expected level, every control fails, the matrix `--check` passes and the L1 host-load passes.

### Scenario format (proposed)

```yaml
id: secrets/read-env
feature: secrets-gate
fixture: ts-single
script:                       # what the fake model does, host-neutral
  - call: read
    path: .env
expect:
  claude-code: blocked        # enforced
  opencode-v2: blocked        # enforced
  codex: blocked              # to confirm in v1.5
outcome:
  - canary_never_reaches_model
  - decision_logged
control: leaks                # OAC off must leak
```

### Parity and limits (expected levels; checked by scenarios)

| Gate | Claude Code | OpenCode v2 | Codex |
|---|---|---|---|
| Secrets read/write | enforced (PreToolUse) **proven** | enforced (permission) **proven** | enforced (PreToolUse / rules) [to verify] |
| Destructive commands | enforced | enforced | enforced (rules) |
| Verifier before "done" | enforced (Stop) | nudge (no Stop hook): agent commit/push denied, pre-push, CI | nudge (Stop continues the turn) + CI |
| Context freshness | nudge (Stop) + CI enforced | nudge (toast) + pre-push + CI enforced | nudge + CI enforced |
| Write scope | enforced | enforced | partial (sandbox) |

**OAC's own limits:**
- Hook p95 ≤ 150 ms.
- Startup injection ≤ 3 lines.
- AGENTS.md chain ≤ 32 KiB.
- At most one Stop block per turn.
- Supported host versions pinned in one table; anything outside it gets a `doctor` warning.

## User value and simplicity

**How a user uses it (four touch points):**
1. **Set up.** `oac init`: scan, plan, apply. 10 minutes or less.
2. **Work normally.** OAC is silent until something risky happens, then shows one line with a fix.
3. **When blocked,** `oac explain last` says which rule fired and why.
4. **Every two weeks,** `oac report`: "OAC blocked 3 secret reads, stopped 5 'done' claims with failing tests, and nudged 4 context updates, adding 0.4 s per gated call." The user's own numbers show whether it's worth it.

**Benefit vs cost per feature:**

| Feature | Benefit to the user | Cost | Verdict |
|---|---|---|---|
| Secrets + destructive guard | Prevents the incidents people fear most | ~0 tokens, ~ms per call | **v1: must** |
| No "done" on red tests | Stops the most common annoyance: a false "done" | One test run at stop | **v1: must** |
| `oac init` setup | Saves the setup time; easy start | One-off | **v1: must** |
| `oac explain` / `oac report` | Understands what happened; proves value | ~0 | **v1: must** |
| Context freshness (warn) | Keeps context true on living projects | Waivers; CI minutes | **v1: should** (team) |
| Read-only mode | Duplicates host plan mode | Build and maintain 3 versions | **Use the host's plan mode.** Test it with a scenario instead of rebuilding it. |
| Size router, impact graph | Only needed to trigger add-ons | Thresholds to tune | **Later:** ship with the add-ons that need them |
| Plan gate, reviewers, red-before-green | Useful for some teams | Model calls, ceremony | **Later, opt-in, on demand** |
| Context scout | Unproven; can hurt | Tokens | **Off;** decided by an ablation |

**Simplicity rules:**
- Zero config must work; `oac.policy` is only for changing defaults.
- Every feature names the incident it prevents and shows up in `oac report`.
- If a feature hasn't fired usefully in two weeks of dogfooding, it gets cut.
- No gate ships without its scenario.
