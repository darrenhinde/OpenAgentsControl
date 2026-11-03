---
name: external-research
description: Use when the task involves an external library or package and current API docs are needed before writing code.
context: fork
agent: external-scout
---

# External Scout

## Overview
Fetch and cache current documentation for external libraries and frameworks. Training data is outdated—this skill ensures you use current, correct API patterns.

**Announce at start:** "I'm using the external-scout skill to fetch current docs for [package]."

## The Process

### Step 1: Invoke External-Scout

Request documentation with package and topic:

```bash
/external-scout <package> <topic>
```

**Examples:**
```bash
/external-scout drizzle schemas
/external-scout react hooks
/external-scout express middleware
/external-scout zod validation
```

### Step 2: Check Response

External-scout returns JSON with cached file paths:

```json
{
  "status": "success",
  "package": "drizzle",
  "topic": "schemas",
  "cached": true,
  "files": [
    ".tmp/external-context/drizzle/schemas.md"
  ],
  "metadata": {
    "cachedAt": "2026-02-16T10:30:00Z",
    "source": "context7",
    "age": "fresh"
  }
}
```

**Cache status:**
- `"fresh"` — < 7 days old (use cached)
- `"stale"` — > 7 days old (re-fetches automatically)

### Step 3: Load Cached Documentation

Read the returned file:

```bash
Read: .tmp/external-context/drizzle/schemas.md
```

This file contains current API patterns, examples, and best practices.

### Step 4: Apply to Implementation

Use loaded documentation to:
- Verify API signatures are correct
- Follow current patterns (not training data)
- Check for deprecations
- Use new features introduced since training

### Step 5: Implement with Confidence

Now that you have current docs, implement following verified patterns.

## Example: Using Drizzle ORM

```markdown
1. Invoke: /external-scout drizzle schemas

2. Response:
   {
     "status": "success",
     "files": [".tmp/external-context/drizzle/schemas.md"]
   }

3. Load: Read .tmp/external-context/drizzle/schemas.md

4. Review: Current API for defining tables and relations

5. Implement: Use current patterns from loaded docs
```

## Cache Location

```
.tmp/external-context/
├── drizzle/
│   ├── .metadata.json
│   ├── schemas.md
│   └── queries.md
├── react/
│   ├── .metadata.json
│   └── hooks.md
└── express/
    ├── .metadata.json
    └── middleware.md
```

Cache files auto-refresh after 7 days.

## Error Handling

**"External documentation fetch failed":**
- Check internet connection
- Try again in a few minutes
- Fallback: Visit official docs manually

**"Cache is stale, re-fetching":**
- Normal behavior—external-scout auto-fetches fresh docs

**"Package not found in Context7":**
- Visit official package documentation
- Check npm/PyPI for package README
- Review GitHub repository for API docs

## Remember

- Training data is OUTDATED—always fetch current patterns
- Cache lasts 7 days before auto-refresh
- Load external docs BEFORE writing code
- Trust current docs over training data assumptions
- External docs prevent using deprecated APIs

## Related

- context-discovery
- code-execution

---

**Task**: Fetch external documentation for: **$ARGUMENTS**

Check cache first (< 7 days fresh), fetch from Context7 if needed, return file paths for loading.
