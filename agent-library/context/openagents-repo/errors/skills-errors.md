<!-- Context: openagents-repo/errors | Priority: medium | Version: 1.0 | Updated: 2026-02-15 -->

# Skills Troubleshooting

**Purpose**: Common skill issues and solutions

---

## Skill Not Triggering

**Symptom**: Claude doesn't use your skill when expected

**Cause**: Description doesn't match user requests

**Solution**: Write specific descriptions with trigger terms:
```yaml
# Bad
description: Helps with documents

# Good  
description: Extract text from PDF files, fill forms, merge documents. Use when working with PDFs, forms, or document extraction.
```

**Tip**: Include keywords users would naturally say

---

## Skill Doesn't Load

**Check file path**:
| Type | Correct Path |
|------|--------------|
| Personal | `~/.claude/skills/my-skill/SKILL.md` |
| Project | `.claude/skills/my-skill/SKILL.md` |
| Plugin | `skills/my-skill/SKILL.md` |

**Check YAML syntax**:
- First line must be `---` (no blank lines before)
- End frontmatter with `---`
- Use spaces, not tabs

**Debug**: Run `claude --debug` to see loading errors

---

## Skill Has Errors

**Dependencies not installed**: 
- List required packages in description
- User must install before skill works

**Script permissions**:
```bash
chmod +x scripts/*.py
```

**Path format**: Use forward slashes (Unix style)

---

## Multiple Skills Conflict

**Symptom**: Claude uses wrong skill

**Cause**: Similar descriptions

**Solution**: Make descriptions distinct:
```yaml
# Skill 1
description: Analyze sales data in Excel files and CRM exports

# Skill 2  
description: Analyze log files and system metrics
```

---

## Plugin Skills Not Appearing

**Solution**: Clear cache and reinstall
```bash
rm -rf ~/.claude/plugins/cache
# Restart Claude Code
/plugin install plugin-name@marketplace
```

**Verify structure**:
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── my-skill/
        └── SKILL.md
```

---

## Related

- `../concepts/agent-skills.md` - Skills overview
- `../guides/creating-skills.md` - Creation guide

**Reference**: https://docs.anthropic.com/en/docs/claude-code/skills
