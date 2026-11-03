<!-- Context: openagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Multi-File Skill Structure

**Purpose**: Example of a skill with supporting files and scripts

---

## Directory Structure

```
pdf-processing/
├── SKILL.md              # Overview and quick start
├── FORMS.md              # Form field mappings
├── REFERENCE.md          # API details
└── scripts/
    ├── fill_form.py      # Utility to populate forms
    └── validate.py       # Check PDFs for required fields
```

---

## SKILL.md

```yaml
---
name: pdf-processing
description: Extract text, fill forms, merge PDFs. Use when working with PDF files.
allowed-tools: Read, Bash(python:*)
---

# PDF Processing

## Quick start

Extract text:
```python
import pdfplumber
with pdfplumber.open("doc.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

For form filling, see FORMS.md (example file).
For detailed API reference, see REFERENCE.md (example file).

## Requirements

```bash
pip install pypdf pdfplumber
```
```

---

## Key Patterns

1. **Keep SKILL.md concise** (<500 lines)
2. **Reference supporting files** with markdown links
3. **One level deep** - link directly, avoid nested references
4. **Scripts are executed, not loaded** - saves context tokens

---

## Script Usage

In SKILL.md, tell Claude to run (not read):
```markdown
Run the validation script:
python scripts/validate.py input.pdf
```

Output goes to Claude, script content stays out of context.

---

## Related

- `../../concepts/agent-skills.md` - Skills overview
- `../../lookup/skill-metadata.md` - Metadata fields

**Reference**: https://docs.anthropic.com/en/docs/claude-code/skills
