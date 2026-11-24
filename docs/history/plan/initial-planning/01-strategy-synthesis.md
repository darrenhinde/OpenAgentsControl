> Initial planning record (2026-10-18). Current plan: [../ROADMAP.md](../ROADMAP.md) · decisions: [../../lessons-learnt/decisions.md](../../lessons-learnt/decisions.md)

# Strategy synthesis

Combines this session's repair research (`research-*.md`) with the maintainer's strategy review (`research_notes/OAC strategy review/1-3`) and the landscape report (`reports/Coding agent harness landscape.md`). Written 2026-10-16.

## Direction (adopted from the strategy review)

> **Superseded framing:** the north star is now `NORTH_STAR.md` (control-first: you approve the intent, the tool enforces the rules). See `02-product-plan.md` §10.

**North star:** OAC compiles one set of agents, skills and guardrails into whatever each host can actually enforce, and publishes what it couldn't. The build is the product; no single host is.

**Position:** the enforced-guardrails layer for coding agents. One `oac.policy` file becomes:
- Claude Code hooks and permissions
- OpenCode v2 ordered permission arrays
- Codex rules

Anything a host can't enforce is denied and listed. Scored 17/20, against 14 for OpenCode-v2-native alone, 12 for a team standards engine, 11 for a cross-host translator and 10 for eval-first.

**Wedge:** be the first framework to call itself "OpenCode v2-native" (v1.2). oh-my-opencode has left OpenCode, and the v2 upgrade path opened 2026-10-12.

**For:** tech leads on teams of 3–30 who've been burned by an agent touching `.env`, running a destructive command, or saying "done" while tests fail.

## Where the strategy review changes this session's repair plan

| Repair plan said | Strategy says | Resolution |
|---|---|---|
| Phase 3: add per-target description overrides so Claude agents are generated | Claude agents are a different product. Restore main's hand-written ones and keep Claude output compare-only. Don't generate Claude prompts. | **Adopt the strategy.** Restore before merge. Hooks, not prompts, are where generated Claude output adds value. |
| Merge #342 after content fixes, then v2 work | Ship v1.1.0 within about a week, then v2-native as v1.2 | **Adopt.** A release fixes the "unmaintained" impression. |
| #349 reorder in Phase 1 | #349 listed under the v1.2 v2 emitter | **Keep #349 in v1.1** (my call): it's a live bug on v1, it takes under a day, and it lives in `content/`. Flagged as a decision. |
| Flat agent IDs to fix #362 | Not covered | Keep for v1.2 |
| Port plugins/tools to v2 | Covered by #367 in v1.2 | Same |
| Eval harness on v2 SDK | Rebuild evals as outcome-graded trials (Harbor-compatible), off vs on, plus red-team | **Merge them.** The v2 harness port should target outcome evals, not the old path-grading. |
| Not covered | Stop committing generated trees (commit only what the marketplace reads) | Add to the Stage 6 cleanup |
| Not covered | Host descriptors as data (gstack/spec-kit style); drop the two-way `toOAC` | After v1.1 (agent 1 vs agent 3 tension: defer until tagged) |

## Verified by hand (this session)

- Claude plugin agents contain 43 `.opencode/` references (the review said 42). main's code-reviewer had 0.
- `plugins/claude-code/agents/code-reviewer.md` has `disallowedTools: …, Task` yet says "ALWAYS call ContextScout BEFORE reviewing", which it can't do.
- `plugins/claude-code/hooks/hooks.json` SessionStart has no `matcher`, so it doesn't re-fire after compaction.
- Already verified earlier: the npm 404, the `<example>` loss in 104356a, #349 ordering, and v2 path-derived IDs.

## Do not (from the strategy review)

- Compete with Superpowers, spec-kit or BMAD on workflow method. Interoperate with them instead.
- Keep building scouts, worktree orchestration or plan-mode clones (native everywhere).
- Chase host count for its own sake.
- Publish a percentage claim without an ablation.
- Write new spec documents before v1.1.0 is tagged.
