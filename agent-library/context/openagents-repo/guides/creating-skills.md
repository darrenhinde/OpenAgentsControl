<!-- Context: openagents-repo/guides | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Creating Skills

**Purpose**: Step-by-step guide to create Agent Skills

**In this repository** the Claude Code plugin's skills are canonical source too: write
`agent-library/skills/{skill}/SKILL.md` with `targets: [claude-code]` in its `oac:` block and run
`make build-canonical`; the build writes `plugins/claude-code/skills/` (never edit that folder). The
steps below are for a skill in your own `~/.claude/skills/`.

---

## Quickstart

1. **Create directory**:
   ```bash
   mkdir -p ~/.claude/skills/my-skill
   ```

2. **Create SKILL.md** with frontmatter:
   ```yaml
   ---
   name: my-skill
   description: What it does and when to use it
   ---
   
   Instructions for Claude...
   ```

3. **Verify**: Ask Claude "What Skills are available?"

4. **Test**: Ask Claude something matching the description

---

## Writing Good Descriptions

The description determines when Claude uses the skill. Include:
- **What it does**: List specific capabilities
- **When to use**: Include trigger terms users would say

```yaml
# Bad
description: Helps with documents

# Good
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

---

## Progressive Disclosure

Keep `SKILL.md` under 500 lines. Use supporting files for details:

```
my-skill/
├── SKILL.md         # Overview (required)
├── reference.md     # Detailed docs (loaded when needed)
├── examples.md      # Usage examples
└── scripts/
    └── helper.py    # Utility script (executed, not loaded)
```

Reference in SKILL.md:
```markdown
For complete API details, see reference.md (example file)
```

---

## Key Points

- Skills are loaded automatically (no restart needed)
- Use `claude --debug` to see loading errors
- Skills cannot spawn subagents
- Use allowed-tools to restrict capabilities

---

## Related

- `../concepts/agent-skills.md` - Skills overview
- `../lookup/skill-metadata.md` - All metadata fields
- `../examples/skills/` - Example skills

**Reference**: https://docs.anthropic.com/en/docs/claude-code/skills
