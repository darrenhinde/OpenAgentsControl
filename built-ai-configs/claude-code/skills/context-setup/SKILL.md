---
name: context-setup
description: Install context files from registry. Use when user runs /install-context, says "install context", "setup context", or when context is missing and the user needs to get started.
---

# Install Context

**Announce:** "Let me set up your context files."

---

## Why Context Files Matter

Context files are project-specific standards that every AI agent loads before writing code. Without them:
- Code won't follow your team's naming conventions or architecture patterns
- Security and quality standards won't be applied automatically
- Every agent starts from scratch instead of building on established patterns

With context files, every agent — coder, reviewer, tester — follows the same standards without you repeating yourself.

---

## Quick Check

Run this single command to see everything relevant at once:

```bash
echo "=== Environment ===" && \
  { command -v git >/dev/null 2>&1 && echo "✓ git $(git --version | cut -d' ' -f3)" || echo "✗ git: not found — required"; } && \
  { command -v node >/dev/null 2>&1 && echo "✓ node $(node --version)" || echo "  node: not found (bash installer works without it)"; } && \
  echo "=== Context Status ===" && \
  { [ -f .claude/.context-manifest.json ] \
    && echo "Project: ✓ installed — $(grep -o '"profile": "[^"]*"' .claude/.context-manifest.json | head -1 | cut -d'"' -f4) profile" \
    || echo "Project: not installed"; } && \
  { [ -f ~/.claude/.context-manifest.json ] \
    && echo "Global:  ✓ installed — $(grep -o '"profile": "[^"]*"' ~/.claude/.context-manifest.json | head -1 | cut -d'"' -f4) profile" \
    || echo "Global:  not installed"; } && \
  { [ -f .oac.json ] && echo ".oac.json: ✓ exists" || echo ".oac.json: not found"; }
```

**If already installed:** show the status, ask if they want to reinstall (`--force`) or switch profiles.

**If git is missing:** stop and show the install instructions for git. Nothing else will work.

---

## Ask Two Questions (then install)

Present both together as one message:

```
Where do you want to install context?

  1. This project only  — .claude/context/ (just for this repo)
  2. Globally           — ~/.claude/context/ (shared by all your projects)

Which profile?

  standard  — Core coding standards, security patterns, dev workflows  (recommended, ~30s)
  extended  — Everything above + UI, data, content, product domains    (~1 min)
  all       — The full library                                         (~2 min)
```

**Wait for answers before running anything.**

---

## Run the Installer

Read the Plugin Root from **OAC System Paths** in your session context. Use that literal path.

**On Mac / Linux** — prefer the bash installer (git only, no node needed):
```bash
bash "{PLUGIN_ROOT}/scripts/install-context.sh" --profile={profile} [--global]
```

**On Windows** (or if bash fails) — use the node installer:
```bash
node "{PLUGIN_ROOT}/scripts/install-context.js" --profile={profile} [--global]
```

Both accept `--force` to reinstall over an existing install.

Show the installer output live as it runs.

---

## Verify

```bash
{ [ -f .claude/.context-manifest.json ] && echo "Project: ✓" || echo "Project: not found"; } && \
{ [ -f ~/.claude/.context-manifest.json ] && echo "Global: ✓" || echo "Global: not found"; } && \
{ [ -f .oac.json ] && echo ".oac.json: ✓" || echo ".oac.json: missing (project installs need this)"; }
```

For project installs: if `.oac.json` is missing, create it:
```bash
printf '{\n  "version": "1",\n  "context": {\n    "root": ".claude/context"\n  }\n}\n' > .oac.json
```

Confirm to the user: **"You're ready. Every agent will now load these standards automatically."**

---

## Error Handling

**`git: command not found`**
```
✗ Git is required.
  Mac:   brew install git
  Linux: sudo apt install git
  Windows: https://git-scm.com/download/win
```

**`Cannot find module '...install-context.js'` or script not found:**
Check with `ls "{PLUGIN_ROOT}/scripts/"` — use whichever script is present.

**Network failure:** Check internet connection and retry.

---

## Remember

- Read Plugin Root from **OAC System Paths** in session context — never use `$CLAUDE_PLUGIN_ROOT` as a shell variable
- Ask scope + profile together — don't ask them as separate conversations
- Show the quick check output before asking questions
- Wait for confirmation before running the installer
- Global installs don't need `.oac.json` — discovery chain finds `~/.claude/context/` automatically
