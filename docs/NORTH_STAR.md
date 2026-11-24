# OpenAgentsControl: north star

**OAC keeps you in control of the coding agents on your real projects. You approve what an agent sets out to do, and the tool, not a prompt, enforces your rules on OpenCode, Claude Code and Codex alike. It sets your repo up with lean context that stays current, and proves with tests you can run that your rules hold.**

This is the original mission (plan-first, approval-based execution, code in your patterns, built for OpenCode) made enforceable and portable. It isn't a new product.

## Why it matters

Agents now write code in real repos, and the failures are real: they read `.env` files, run `rm -rf` or `git push --force`, say "done" while tests fail, and work from context that went stale months ago.

Rules written in prompts don't hold. Agents follow them less as a session goes on, and every tool has its own controls. Teams that use Claude Code and OpenCode side by side end up wiring hooks by hand for each one, with nothing to show they work.

## What OAC does about it

You approve what an agent sets out to do, once per task, and describe your rules once. OAC turns them into the controls each tool actually enforces: hooks in Claude Code, permissions in OpenCode, rules in Codex. When a tool can't enforce something, OAC says so instead of pretending.

It also sets the repo up so agents get lean, current context, and keeps that context current as the code changes. And it gives you a test and a report so you can see it working.

## How it works

1. **Set up.** `oac init` scans any repo (old, new or multi-language). It writes lean context and keeps your existing files.
2. **Approve and set rules.** You approve each task's plan once. `oac.policy` protects secrets and paths, gates destructive commands, and stops and reports on red tests.
3. **Enforce natively.** The policy becomes OpenCode permissions, Claude Code hooks, and Codex rules and hooks. Anything a tool can't enforce is listed.
4. **Prove it.**
   - `oac test` runs real attack scenarios with a fake model, in seconds, for free.
   - `oac report` shows what OAC caught and what it cost.
   - PR checks keep each area's context current.

## The six promises

Every feature is held to these. If a change breaks one, it doesn't ship.

1. **You approve the intent.** Once per task, before the first edit, you approve what the agent will do. After that it works inside what you approved, without asking at every step.
2. **Enforced, not asked.** If a rule matters, the tool enforces it. Prompts are hints, never the guardrail.
3. **Stop and report on failure.** When tests fail, the agent stops, explains why and proposes a fix. It never quietly patches things unless you've chosen that.
4. **Same rules, every tool.** One policy for OpenCode, Claude Code and Codex. Where a tool falls short, OAC says exactly how.
5. **Provable.** Every gate has a test users can run on their own machine. Every claim has data behind it. No made-up percentages.
6. **Quiet, and yours.** Silent unless there's an approval or a risk. Zero config works, with almost no extra tokens. Works with your method and your coding patterns, and never overwrites your text.

## What OAC is not

- **Not a workflow method.** You approve the intent; OAC doesn't dictate how you plan.
- **Not an agent catalog.** Hosts ship scouts, planners and parallel agents now.
- **Not another coding tool.** It sits on top of the ones you use.
- **Not a big context library.** Only lean, project-specific context that's kept current.

## Before building anything, ask

- Does it prevent a real incident, or keep context true?
- Can a tool enforce it, or is it only a prompt?
- Can we test it automatically on every supported tool?
- Does it stay quiet when nothing is wrong?

Any "no" means it doesn't get built, or it becomes an opt-in add-on.

## Success looks like this

A tech lead can say: "Our agents only do what we approved. They can't touch secrets, and they stop and report instead of claiming done on red tests, on any tool our team uses. Here's the report that proves it."

## For existing users

Nothing you relied on goes away without a path:
- Today's agent catalog is frozen as the `oac-classic` tag.
- `MIGRATING.md` (planned for v1.1) maps every old agent, command and profile to its new home.
- What changes is that approval and your rules are now enforced by the tool, not just asked for in a prompt.
