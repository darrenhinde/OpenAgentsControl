<!-- Context: openagents-repo/concepts | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# Agent Skills

**Purpose**: Markdown files that teach Claude how to do specific tasks

---

## Core Concept

A Skill is a `SKILL.md` file that teaches Claude specialized knowledge. Skills are **model-invoked**: Claude automatically applies them based on task context matching the description field.

---

## Key Points

- Skills live in `~/.claude/skills/` (personal) or `.claude/skills/` (project)
- Each skill needs a directory with `SKILL.md` inside
- Name and description in YAML frontmatter are required
- Claude loads only name/description at startup (lazy loading)
- Full content loaded when skill is activated

---

## Skill File Format

```yaml
---
name: explaining-code
description: Explains code with diagrams and analogies. Use when explaining how code works.
---

When explaining code, always include:
1. **Start with an analogy**: Compare to everyday life
2. **Draw a diagram**: ASCII art for flow/structure
3. **Walk through the code**: Step-by-step
4. **Highlight a gotcha**: Common mistakes
```

---

## Where Skills Live

| Location | Path | Scope |
|----------|------|-------|
| Enterprise | Managed settings | All org users |
| Personal | `~/.claude/skills/` | You, all projects |
| Project | `.claude/skills/` | Anyone in repo |
| Plugin | Plugin's `skills/` | Plugin users |

Priority: Enterprise > Personal > Project > Plugin

---

## Related

- `../guides/creating-skills.md` - How to create skills
- `../lookup/skill-metadata.md` - Metadata fields
- `../lookup/skills-comparison.md` - Skills vs other options

**Reference**: https://docs.anthropic.com/en/docs/claude-code/skills
