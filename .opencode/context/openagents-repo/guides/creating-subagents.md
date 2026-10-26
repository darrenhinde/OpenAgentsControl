<!-- Context: openagents-repo/guides | Priority: high | Version: 2.0 | Updated: 2026-10-25 -->

# Creating Subagents

**Purpose**: Create a subagent that ships to every AI tool this repo supports — from ONE canonical file.

---

## The OAC Way (canonical authoring)

A subagent is authored once in `content/agents/**` and emitted to every host by `oac build`.
Full step-by-step in `adding-agent-basics.md`; the subagent-specific notes are here.

### File shape

`content/agents/subagents/<group>/<agent-id>.md`:

```markdown
---
name: MyAgent
description: One-line summary (OpenCode shows this to humans picking an agent)
mode: subagent
permission:
  bash:
    "*": "deny"
    "bash npm test *": "allow"     # ordered rules, LAST MATCH WINS
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"

oac:
  id: my-agent
  name: MyAgent
  category: subagents/<group>
  type: subagent
  version: "1.0.0"
  author: opencode
  tags: []
  dependencies: []
  # Omit `targets:` to ship to every host. Opt out per host with exclude.
  exclude:
    - claude-code
  # overrides:
  #   claude-code: { name, model, description with <example> blocks, tools }
---

# MyAgent

> **Mission**: One line.

Body. Per-host variants:

<!-- oac:only opencode -->
Body text only OpenCode gets (e.g. "call ContextScout first").
<!-- /oac:only -->

<!-- oac:only claude-code -->
Body text only Claude Code gets (e.g. "context is pre-loaded").
<!-- /oac:only -->
```

### Subagent-specific rules

- **`mode: subagent`** — required to be delegatable; `primary` agents are the main loop.
- **Permission globs are enforced only on OpenCode.** Claude Code carries flat
  `tools:`/`disallowedTools:` via an authored override, or nothing. The build refuses a
  claude-code agent with no override — author one or `exclude: [claude-code]`.
- **Delegation references are per-target.** Write `task(other-agent)` using canonical ids;
  `AgentIdResolver` + `DelegationRewriter` rewrite them per host (e.g. `contextscout` →
  `context-scout` on Claude Code).
- **Body split**: OpenCode text says "call ContextScout"; Claude text says "context is
  pre-loaded" — one file, host blocks decide.
- **Temperature**: honored on OpenCode, dropped with a warning on Claude Code.

### Build and validate

```bash
make build-canonical && make check-canonical-drift
```

Your subagent appears in `hosts/README.md`'s matrix and in `registry.json`.

---

## NOT the OAC way: Claude Code's own `/agents`

Claude Code has a local mechanism — `/agents` in the UI, or a Markdown file in
`~/.claude/agents/` / `.claude/agents/`:

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---
You are a code reviewer...
```

That creates an agent **only for Claude Code, on that machine** — it is not in the
canonical corpus, not shipped by `registry.json`, and not this repo's management path.
Use it for private/local experiments only; anything this repo ships goes through
`content/agents/**`.

---

## Key Points

- `oac.id` is the one true name; per-host names come from overrides (and may differ from the filename, e.g. `test-engineer.md` ↔ id `tester`).
- Description drives routing: one line for OpenCode, `<example>` blocks for Claude Code.
- Body becomes the system prompt on every host.
- Subagents only get their system prompt, not the full main-loop prompt.

---

## Related

- `adding-agent-basics.md` — the full 4-step flow (categories, build, validate)
- `standards/agent-frontmatter.md` — frontmatter standard
- `standards/subagent-structure.md` — body structure
- `standards/permission-patterns.md` — ordered-rule permission patterns
- `subagent-invocation.md` — how agents delegate to subagents
- `docs/features/conversion-engine.md` — the conversion engine overview
