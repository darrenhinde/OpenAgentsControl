# Guide: Designing Navigation Files

**Purpose**: How to create token-efficient, scannable navigation files

**Last Updated**: 2026-01-08

---

## Prerequisites

- Understand MVI principle (context-system/standards/mvi.md)
- Know your category's organizational pattern (function-based or concern-based)
- Have content files already created

**Estimated time**: 15-20 min per navigation file

---

## Core Principles

### 1. Token Efficiency
**Goal**: 200-300 tokens per navigation file

**Why**: 
- Faster AI loading
- Lower costs
- Quicker decision-making

**How**:
- Use ASCII trees (not verbose descriptions)
- Use tables (not paragraphs)
- Be concise (not comprehensive)

---

### 2. Scannable Structure
**Goal**: AI can find what it needs in <5 seconds

**Format**:
1. **Structure** (ASCII tree) - See what exists
2. **Quick Routes** (table) - Jump to common tasks
3. **By Concern/Type** (sections) - Browse by category

---

### 3. Self-Contained
**Goal**: Navigation file answers "where do I go?"

**Include**:
- ✅ Paths to files
- ✅ Brief descriptions (3-5 words)
- ✅ When to use each file

**Exclude**:
- ❌ File contents (that's what the files are for)
- ❌ Detailed explanations
- ❌ Duplicate information

---

## Steps

### 1. Determine Navigation Type

**Category-level navigation** (`{category}/navigation.md`):
- Overview of entire category
- Points to subcategories
- Includes specialized navigation files

**Subcategory-level navigation** (`{category}/{subcategory}/navigation.md`):
- Overview of subcategory
- Lists files in this subcategory
- Points to related categories

**Specialized navigation** (`{category}/{domain}-navigation.md`):
- Cross-cutting concern (e.g., `ui-navigation.md`)
- Spans multiple subcategories
- Task-focused routes

---

### 2. Create Structure Section

**Format**: ASCII tree showing directory structure

**Example** (Function-based):
```markdown
## Structure

```
openagents-repo/
├── navigation.md
├── quick-start.md
│
├── concepts/
│   ├── navigation.md
│   └── subagent-testing-modes.md
│
├── guides/
│   ├── navigation.md
│   ├── adding-agent.md
│   └── testing-agent.md
│
└── lookup/
    ├── navigation.md
    └── commands.md
```
```

**Example** (Concern-based):
```markdown
## Structure

```
development/
├── navigation.md
├── ui-navigation.md           # Specialized
│
├── principles/
│   ├── clean-code.md
│   └── api-design.md
│
├── frontend/
│   ├── react/
│   │   ├── hooks-patterns.md
│   │   └── tanstack/
│   │       └── query-patterns.md
│   └── vue/
│
└── backend/
    ├── api-patterns/
    │   ├── rest-design.md
    │   └── graphql-design.md
    └── nodejs/
```
```

**Token count**: ~50-100 tokens

---

### 3. Create Quick Routes Table

**Format**: Task → Path mapping

**Example**:
```markdown
## Quick Routes

| Task | Path |
|------|------|
| **Add agent** | `guides/adding-agent.md` |
| **Test agent** | `guides/testing-agent.md` |
| **Debug issue** | `guides/debugging-issues.md` |
| **Find files** | `lookup/file-locations.md` |
```

**Guidelines**:
- Use **bold** for task names
- Use relative paths
- 5-10 most common tasks
- Order by frequency of use

**Token count**: ~50-100 tokens

---

### 4. Create By Concern/Type Sections

**Format**: Group files by concern or type

**Example** (Function-based):
```markdown
## By Type

**Concepts** → Core ideas and principles
**Guides** → Step-by-step workflows
**Lookup** → Quick reference tables
**Errors** → Troubleshooting
```

**Example** (Concern-based):
```markdown
## By Concern

**Principles** → Universal development practices
**Frontend** → React, Vue, state management
**Backend** → APIs, Node.js, Python, auth
**Data** → SQL, NoSQL, ORMs
```

**Token count**: ~50-100 tokens

---

### 5. Add Related Context (Optional)

**Format**: Links to related categories

**Example**:
```markdown
## Related Context

- **Core Standards** → `../core/standards/navigation.md`
- **UI Patterns** → `../ui/navigation.md`
```

**Token count**: ~20-50 tokens

---

### 6. Validate Token Count

**Target**: 200-300 tokens

**Check**:
```bash
# Count tokens (rough estimate: words * 1.3)
wc -w navigation.md
# Multiply by 1.3 for token estimate
```

**If over 300 tokens**:
- Remove verbose descriptions
- Shorten table entries
- Remove less-used routes

---

## Templates

### Category Navigation Template

```markdown
# {Category} Navigation

**Purpose**: [1 sentence]

---

## Structure

```
{category}/
├── navigation.md
├── {subcategory}/
│   ├── navigation.md
│   └── {files}.md
```

---

## Quick Routes

| Task | Path |
|------|------|
| **{Task 1}** | `{path}` |
| **{Task 2}** | `{path}` |
| **{Task 3}** | `{path}` |

---

## By {Concern/Type}

**{Section 1}** → {description}
**{Section 2}** → {description}
**{Section 3}** → {description}

---

## Related Context

- **{Category}** → `../{category}/navigation.md`
```

**Token count**: ~200-250 tokens

---

### Specialized Navigation Template

```markdown
# {Domain} Navigation

**Scope**: [What this covers]

---

## Structure

```
{Relevant directories across multiple categories}
```

---

## Quick Routes

| Task | Path |
|------|------|
| **{Task 1}** | `{path}` |
| **{Task 2}** | `{path}` |

---

## By {Framework/Approach}

**{Tech 1}** → `{path}`
**{Tech 2}** → `{path}`

---

## Common Workflows

**{Workflow 1}**:
1. `{file1}` ({purpose})
2. `{file2}` ({purpose})
```

**Token count**: ~250-300 tokens

---

## Examples

### Good Navigation (Token-Efficient)

```markdown
# Development Navigation

**Purpose**: Software development across all stacks

---

## Structure

```
development/
├── navigation.md
├── ui-navigation.md
├── principles/
├── frontend/
├── backend/
└── data/
```

---

## Quick Routes

| Task | Path |
|------|------|
| **UI/Frontend** | `ui-navigation.md` |
| **Backend/API** | `backend-navigation.md` |
| **Clean code** | `principles/clean-code.md` |

---

## By Concern

**Principles** → Universal practices
**Frontend** → React, Vue, state
**Backend** → APIs, Node, auth
**Data** → SQL, NoSQL, ORMs
```

**Token count**: ~180 tokens ✅

---

### Bad Navigation (Too Verbose)

```markdown
# Development Navigation

**Purpose**: This navigation file helps you find software development patterns, standards, and best practices across all technology stacks including frontend, backend, databases, and infrastructure.

---

## Introduction

The development category contains comprehensive guides and patterns for building modern applications. Whether you're working on frontend user interfaces, backend APIs, database integrations, or infrastructure setup, you'll find relevant context here.

---

## Directory Structure

The development category is organized into several subcategories:

- **principles/** - This directory contains universal development principles that apply regardless of the technology stack you're using. Files include clean code practices, API design principles, and more.

- **frontend/** - This directory contains frontend development patterns including React, Vue, and state management solutions.

[... continues for 500+ tokens]
```

**Token count**: 500+ tokens ❌

---

## Verification

After creating navigation file:

- [ ] Token count 200-300?
- [ ] ASCII tree included?
- [ ] Quick routes table included?
- [ ] By concern/type section included?
- [ ] Paths are relative?
- [ ] Descriptions are 3-5 words?
- [ ] No duplicate information?
- [ ] Links to related context?

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Too many tokens | Remove verbose descriptions, shorten table entries |
| Hard to scan | Use tables instead of paragraphs |
| Missing files | Add to structure section and quick routes |
| Unclear paths | Use relative paths, add brief descriptions |

---

## Related

- `../standards/mvi.md` - Minimal Viable Information principle
- `organizing-context.md` - How to choose organizational pattern
- `../examples/navigation-examples.md` - More examples
