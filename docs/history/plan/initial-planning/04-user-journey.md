> Initial planning record (2026-10-18). Current plan: [../ROADMAP.md](../ROADMAP.md) · decisions: [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md)

# User journey: how someone uses OAC and knows it works

Written 2026-10-18. The full walkthrough, with terminal mockups, is the "Using it" section of the published page (source: `_journey.html`). Output shown there is the planned design, not yet built.

## How a user knows it's working

| When | How | Release |
|---|---|---|
| On demand | `oac test`: runs the cross-host scenarios (proven in `poc/`) in the user's own repo, against their installed tools, with a fake model. Seconds, $0. Shows blocked, asked and **allowed** rows, so it proves OAC isn't in the way either. | v1.2 |
| Every day | One-line block message with a fix and a rule ID; status line; `oac explain last`. | v1.4 |
| Over time | `oac report`: blocked, stopped, asked, nudged, false alarms, cost, and suggestions such as "promote area api" or "allow .env.example". PR checks `oac/verify` and `oac/freshness`. | v1.4 |

## The two weeks

1. **Set up** (`oac init`): scan, plan showing every file, apply. Existing text is untouched; limits like OpenCode's missing stop hook are stated up front.
2. **Check** (`oac test`), e.g. 12/12 as expected in about 10 s.
3. **Work normally.** Silent until risk: a secrets block, or a "done" stopped by red tests, each with a fix.
4. **PR.** `oac/verify` passes; `oac/freshness` warns and suggests an update or a waiver.
5. **After 2 weeks** (`oac report`): the user's own numbers decide whether to keep, tighten or turn off gates.

## Moving forward

- `oac update`: keeps edited files, then reruns `oac test`.
- `oac doctor`: warns when an agent tool updates outside the supported range. OAC's nightly CI tests new host releases first.
- `oac add security-review` / `oac add pack lang/python`: cost shown first; checks added to `oac test`.
- **Teammate joins:** `oac init` sees the committed policy and installs hooks only. Team doctor and CI fail if skipped.
- **Change a rule:** edit `oac.policy`, run `oac test`, commit. Local overrides only tighten.
- **Switch tools:** the same policy builds for the new tool; `oac test` shows what it enforces there.
- `oac policy off <gate>`, with `oac report` showing what you'd lose. `oac uninstall` (#266) removes only OAC files.

## Plan changes this added

- **`oac test`:** a new core feature in v1.2 (scorecard row: all checks as expected in under 30 s, $0).
- **`oac uninstall`:** added to v1.3.
