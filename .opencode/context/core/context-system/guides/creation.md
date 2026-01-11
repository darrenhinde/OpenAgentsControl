# Context File Creation Standards

**Purpose**: Ensure all context files follow the same format and structure

**Last Updated**: 2026-01-06

---

## Critical Rules

<critical_rules priority="absolute" enforcement="strict">
  <rule id="size_limit">
    Files MUST be <200 lines. No exceptions.
  </rule>
  
  <rule id="mvi_required">
    All files MUST follow MVI: 1-3 sentence core, 3-5 key points, minimal example, reference link.
  </rule>
  
  <rule id="function_placement">
    Files MUST be in correct function folder: concepts/, examples/, guides/, lookup/, or errors/.
  </rule>
  
  <rule id="readme_update">
    MUST update category README.md navigation when creating files.
  </rule>
</critical_rules>

---

## Creation Workflow

<workflow id="create_context_file">
  <stage id="1" name="Determine Function">
    Ask: Is this a concept, example, guide, lookup, or error?
    → Place in correct folder
  </stage>
  
  <stage id="2" name="Apply Template">
    Use standard template for file type (see templates.md)
  </stage>
  
  <stage id="3" name="Apply MVI">
    - Core: 1-3 sentences
    - Key points: 3-5 bullets
    - Example: <10 lines
    - Reference: Link to docs
  </stage>
  
  <stage id="4" name="Validate Size">
    Ensure file <200 lines. If not, split or reference external.
  </stage>
  
  <stage id="5" name="Add Cross-References">
    Link to related concepts/, examples/, guides/, errors/
  </stage>
  
  <stage id="6" name="Update README">
    Add entry to category README.md navigation table
  </stage>
  
  <stage id="7" name="Verify">
    - [ ] <200 lines?
    - [ ] MVI format?
    - [ ] Correct folder?
    - [ ] README updated?
    - [ ] Cross-refs added?
  </stage>
</workflow>

---

## File Naming Conventions

### Concepts
**Format**: `{topic}.md`
**Examples**:
- `authentication.md`
- `state-management.md`
- `mvi-principle.md`

**Rule**: Lowercase, hyphenated, describes the concept

---

### Examples
**Format**: `{what-it-demonstrates}.md`
**Examples**:
- `jwt-auth-example.md`
- `react-hooks-example.md`
- `api-call-example.md`

**Rule**: End with `-example.md`, describes what it shows

---

### Guides
**Format**: `{action-being-done}.md`
**Examples**:
- `setting-up-auth.md`
- `deploying-api.md`
- `migrating-to-v2.md`

**Rule**: Gerund form (verbs ending in -ing), describes the task

---

### Lookup
**Format**: `{what-is-referenced}.md`
**Examples**:
- `cli-commands.md`
- `file-locations.md`
- `api-endpoints.md`

**Rule**: Plural noun, describes the reference type

---

### Errors
**Format**: `{framework-or-topic}-errors.md`
**Examples**:
- `react-errors.md`
- `nextjs-build-errors.md`
- `auth-errors.md`

**Rule**: End with `-errors.md`, group by framework/topic (NOT one file per error)

---

## Standard Metadata

Every context file MUST start with:

```markdown
# {Type}: {Name}

**Purpose**: [1 sentence describing what this file contains]

**Last Updated**: {YYYY-MM-DD}

---
```

**Example**:
```markdown
# Concept: JWT Authentication

**Purpose**: Stateless authentication using signed JSON Web Tokens

**Last Updated**: 2026-01-06

---
```

---

## Priority Assignment

When adding files to README.md, assign priority:

| Priority | When to Use |
|----------|-------------|
| **critical** | Must understand to work on project. Core concepts. |
| **high** | Commonly used. Important patterns. |
| **medium** | Occasionally needed. Reference material. |
| **low** | Rarely used. Edge cases. |

**Example**:
```markdown
### Concepts
| File | Description | Priority |
|------|-------------|----------|
| [auth.md](concepts/auth.md) | Authentication system | critical |
| [caching.md](concepts/caching.md) | Cache strategy | high |
| [logging.md](concepts/logging.md) | Logging patterns | medium |
```

---

## Cross-Reference Guidelines

### When to Link

Link to related files when:
- Concept uses another concept
- Example demonstrates a concept
- Guide references concepts/examples
- Error relates to specific concept

### How to Link

**Format**: `**Related**: type/file.md`

**Example**:
```markdown
**Related**:
- concepts/authentication.md
- examples/jwt-auth-example.md
- errors/auth-errors.md
```

**Rule**: Use relative paths from current location

---

## README.md Update Process

When creating a new file:

1. **Open category README.md**
2. **Find correct section** (Concepts/Examples/Guides/Lookup/Errors)
3. **Add table row**:
   ```markdown
   | [file.md](folder/file.md) | Description | priority |
   ```
4. **Sort by priority** (critical → high → medium → low)
5. **Update "Last Updated"** date at top

---

## Validation Before Commit

<validation>
  <checklist>
    - [ ] File is <200 lines?
    - [ ] Follows MVI format (1-3 sentences, 3-5 points, example, reference)?
    - [ ] In correct function folder (concepts/examples/guides/lookup/errors)?
    - [ ] Has standard metadata (Purpose, Last Updated)?
    - [ ] Added to README.md navigation?
    - [ ] Priority assigned (critical/high/medium/low)?
    - [ ] Cross-references added?
    - [ ] Scannable in <30 seconds?
    - [ ] No duplication of existing content?
  </checklist>
</validation>

**If any checkbox is unchecked, fix before committing.**

---

## Common Creation Mistakes

### ❌ Mistake 1: Wrong Folder
```
development/authentication.md  ❌ (flat structure)

development/concepts/authentication.md  ✅ (function-based)
```

### ❌ Mistake 2: Too Verbose
```markdown
# Concept: JWT

[500 lines of explanation, examples, edge cases...]  ❌

# Concept: JWT

**Core Idea**: Stateless auth with signed tokens (1-3 sentences)  ✅
```

### ❌ Mistake 3: Missing README Update
```
Created: concepts/new-topic.md
README.md: Not updated  ❌

Created: concepts/new-topic.md
README.md: Updated with navigation entry  ✅
```

### ❌ Mistake 4: One Error Per File
```
errors/jwt-expired-error.md
errors/jwt-invalid-error.md
errors/jwt-missing-error.md  ❌ (too granular)

errors/auth-errors.md  ✅ (grouped by topic)
```

---

## File Size Enforcement

<rule id="size_enforcement" enforcement="strict">
  If file exceeds line limit:
  
  1. First: Apply more compression (see compact.md)
  2. If still too large: Split into multiple files
  3. If logically can't split: Move details to external docs, keep summary
  
  DO NOT exceed 200 lines under any circumstance.
</rule>

**Example**:
```markdown
If concepts/authentication.md hits 250 lines:

Option 1: Compress (apply MVI more strictly)
Option 2: Split:
  - concepts/authentication.md (core)
  - concepts/jwt-tokens.md (specific type)
  - concepts/oauth.md (another type)
Option 3: Reference external:
  - Keep 100-line summary in concepts/authentication.md
  - Link to https://docs.company.com/auth (full details)
```

---

## Template Selection

| File Type | Template | Max Lines |
|-----------|----------|-----------|
| Concept | templates.md → Concept Template | 100 |
| Example | templates.md → Example Template | 80 |
| Guide | templates.md → Guide Template | 150 |
| Lookup | templates.md → Lookup Template | 100 |
| Error | templates.md → Error Template | 150 |
| README | templates.md → README Template | 100 |

---

## Quality Standards

Every context file must be:

1. **Minimal** - <200 lines, no bloat
2. **Scannable** - Can grasp in <30 seconds
3. **Functional** - In correct function folder
4. **Referenced** - Cross-links to related files
5. **Discoverable** - Listed in README.md
6. **Accurate** - Facts only, no speculation
7. **Current** - Last Updated date maintained

---

## Related

- templates.md - Standard file formats
- mvi-principle.md - What to include
- compact.md - How to minimize
- structure.md - Where files go
