# Recommended Permissions (Opt-In, Deny-Only)

**Status: strongly recommended for every project that uses this plugin.**

## Why this file exists

The OpenCode `coder-agent` is authored with five path-scoped edit denies that protect
secrets and repository internals:

- `**/*.env*`
- `**/*.key`
- `**/*.secret`
- `node_modules/**`
- `.git/**`

Claude Code cannot express these per-agent: subagent frontmatter `tools:` /
`disallowedTools:` accept **tool names only** (no path patterns), and plugin-shipped
`settings.json` files support only the `enabledPlugins` and `extraKnownMarketplaces`
keys — a plugin **cannot ship permission rules** on your behalf. So the shipped
`coder-agent` grants `Write`/`Edit` without those path guards enforced.

The plugin mitigates this two ways, but neither is a hard guarantee:

1. `coder-agent` omits `Bash` and explicitly declares `disallowedTools: Bash, Task`
   (fail-closed — do not re-add these).
2. `coder-agent`'s prompt contains a hard protected-paths rule — but prompt rules are
   instructions, **not enforcement**.

Real enforcement requires a one-time opt-in from you: copy the deny rules below into
your project or user settings.

## Where to put the rules

- Project-wide (recommended, shareable): `.claude/settings.json`
- Just for you, all projects: `~/.claude/settings.json`

Permission precedence is **deny → ask → allow, first match wins; specificity does not
reorder** — so these denies cannot be overridden by any allow rule, and they apply to
every agent in the project, which only over-applies in the safe direction.

## Recommended deny rules

`Edit(...)` rules apply to **all built-in tools that edit files** (including `Write`),
so these five rules restore the full authored protection:

```json
{
  "permissions": {
    "deny": [
      "Edit(**/*.env*)",
      "Edit(**/*.key)",
      "Edit(**/*.secret)",
      "Edit(node_modules/**)",
      "Edit(.git/**)"
    ]
  }
}
```

If your settings file already has a `permissions.deny` array, append these entries to it.

## Optional extra hardening (also deny-only)

Shell-safety denies that mirror the OpenCode `openagent` policy. Bash prefix matching is
best-effort (it cannot catch every obfuscation), but a deny here still only removes
capability:

```json
{
  "permissions": {
    "deny": [
      "Bash(sudo:*)",
      "Bash(rm -rf:*)"
    ]
  }
}
```

## Never add allow rules from this plugin's docs

Do **not** hoist per-agent allow rules (for example
`Bash(bash .opencode/skills/task-management/router.sh complete:*)`) into project or
user settings. Project-level allows apply to **every** agent — including agents authored
with no shell access at all — which silently re-creates the exact privilege escalation
these denies exist to prevent, one layer up. This document intentionally contains deny
rules only.

## Verifying

After adding the rules, run `/permissions` in Claude Code and confirm the five `Edit(...)`
denies are listed. Then ask any agent to modify a `.env` file — it must be denied.
