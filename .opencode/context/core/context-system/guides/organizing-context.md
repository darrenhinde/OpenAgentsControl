# Guide: Organizing Context by Concern

**Purpose**: How to choose and apply the right organizational pattern

**Last Updated**: 2026-01-08

---

## Prerequisites

- Understand context system principles (../context-system.md)
- Know your content domain
- Have content to organize

**Estimated time**: 30-45 min per category

---

## Two Organizational Patterns

### Pattern A: Function-Based
**Use for**: Repository-specific context

**Structure**: Organize by what the information does
- `concepts/` - What it is
- `examples/` - Working code
- `guides/` - How to do it
- `lookup/` - Quick reference
- `errors/` - Troubleshooting

**Example**: `openagents-repo/`

---

### Pattern B: Concern-Based
**Use for**: Multi-technology development context

**Structure**: Organize by what you're doing (concern), then how (approach/tech)
- `{concern}/` - What you're working on
  - `{approach}/` - How you're doing it
  - `{tech}/` - What you're using

**Example**: `development/`

---

## Decision Tree

### Step 1: Is this repository-specific?

**YES** → Use **Pattern A (Function-Based)**

Examples:
- `openagents-repo/` - OpenAgents Control repository work
- `myproject-repo/` - Your project's repository

**NO** → Continue to Step 2

---

### Step 2: Does content span multiple technologies?

**YES** → Use **Pattern B (Concern-Based)**

Examples:
- `development/` - Frontend, backend, data, infrastructure
- `ui/` - Web, terminal, mobile (future)

**NO** → Use **Pattern A (Function-Based)**

Examples:
- `content/` - Copywriting frameworks (single domain)
- `product/` - Product management (single domain)

---

### Step 3: Is there a natural hierarchy of concerns?

**YES** → Use **Pattern B (Concern-Based)**

Example hierarchy:
```
development/
├── frontend/           # Concern
│   ├── react/          # Tech
│   └── vue/            # Tech
├── backend/            # Concern
│   ├── api-patterns/   # Approach
│   └── nodejs/         # Tech
```

**NO** → Use **Pattern A (Function-Based)**

---

## Pattern A: Function-Based Organization

### When to Use

✅ Repository-specific context (e.g., `openagents-repo/`)
✅ Single-domain content (e.g., `content/`, `product/`)
✅ Content naturally groups by information type
✅ Users need to find "how to do X" quickly

### Structure

```
{category}/
├── navigation.md
├── quick-start.md              # Optional: orientation
│
├── core-concepts/              # Optional: foundational
│   ├── navigation.md
│   └── {concept}.md
│
├── concepts/                   # What it is
│   ├── navigation.md
│   └── {concept}.md
│
├── examples/                   # Working code
│   ├── navigation.md
│   └── {example}.md
│
├── guides/                     # How to do it
│   ├── navigation.md
│   └── {guide}.md
│
├── lookup/                     # Quick reference
│   ├── navigation.md
│   └── {lookup}.md
│
└── errors/                     # Troubleshooting
    ├── navigation.md
    └── {error}.md
```

### Example: openagents-repo/

```
openagents-repo/
├── navigation.md
├── quick-start.md
│
├── core-concepts/              # Foundational (agents, evals, registry)
├── concepts/                   # Additional concepts
├── guides/                     # How to add agent, test, etc.
├── lookup/                     # Commands, file locations
├── examples/                   # Context bundles, prompts
└── errors/                     # Tool permissions, validation
```

**Why this works**:
- Repository-specific (not general development)
- Users need "how to add agent" (guide)
- Users need "where is X file" (lookup)
- Users need "fix this error" (errors)

---

## Pattern B: Concern-Based Organization

### When to Use

✅ Multi-technology content (e.g., `development/`)
✅ Content organized by "what you're doing" (concern)
✅ Multiple approaches/technologies per concern
✅ Need to support full-stack workflows

### Structure

```
{category}/
├── navigation.md
├── {concern}-navigation.md     # Specialized (optional)
│
├── principles/                 # Universal (optional)
│   ├── navigation.md
│   └── {principle}.md
│
├── {concern}/                  # What you're doing
│   ├── navigation.md
│   │
│   ├── {approach}/             # How (approach-based)
│   │   ├── navigation.md
│   │   └── {pattern}.md
│   │
│   └── {tech}/                 # How (tech-specific)
│       ├── navigation.md
│       └── {pattern}.md
```

### Example: development/

```
development/
├── navigation.md
├── ui-navigation.md            # Specialized
├── backend-navigation.md       # Specialized
│
├── principles/                 # Universal
│   ├── clean-code.md
│   └── api-design.md
│
├── frontend/                   # Concern: client-side
│   ├── react/                  # Tech
│   │   ├── hooks-patterns.md
│   │   └── tanstack/           # Sub-tech
│   └── vue/                    # Tech
│
├── backend/                    # Concern: server-side
│   ├── api-patterns/           # Approach
│   │   ├── rest-design.md
│   │   └── graphql-design.md
│   ├── nodejs/                 # Tech
│   └── authentication/         # Functional concern
│
└── data/                       # Concern: data layer
    ├── sql-patterns/           # Approach
    └── orm-patterns/           # Approach
```

**Why this works**:
- Multi-technology (React, Vue, Node, Python, etc.)
- Organized by concern (frontend, backend, data)
- Then by approach (REST, GraphQL) or tech (Node.js, React)
- Supports full-stack workflows

---

## Hybrid Approach

### When to Use

✅ Category has both repository-specific AND multi-tech content
✅ Need flexibility for different subcategories

### Structure

```
{category}/
├── navigation.md
│
├── {subcategory-A}/            # Function-based
│   ├── concepts/
│   ├── guides/
│   └── examples/
│
└── {subcategory-B}/            # Concern-based
    ├── {concern}/
    │   ├── {approach}/
    │   └── {tech}/
```

### Example: ui/

```
ui/
├── navigation.md
│
├── web/                        # Platform (concern-based)
│   ├── navigation.md
│   ├── animation-patterns.md
│   ├── ui-styling-standards.md
│   └── design/
│       ├── concepts/           # Function-based within
│       └── examples/
│
└── terminal/                   # Platform (concern-based)
    └── navigation.md
```

**Why this works**:
- Top level: Platform-based (web, terminal, mobile)
- Within platform: Mix of flat files + function folders
- Flexible for different needs

---

## Organizing by Concern vs Tech

### Concern First, Then Tech

**Use when**: Multiple technologies solve the same concern

```
backend/
├── api-patterns/               # Concern: API design
│   ├── rest-design.md          # Approach
│   ├── graphql-design.md       # Approach
│   └── grpc-patterns.md        # Approach
├── nodejs/                     # Tech
└── python/                     # Tech
```

**Why**: Principles (REST, GraphQL) are more important than implementation (Node, Python)

---

### Tech First, Then Concern

**Use when**: Technology dictates the approach

```
frontend/
├── react/                      # Tech
│   ├── hooks-patterns.md       # Concern: state
│   ├── component-architecture.md # Concern: structure
│   └── tanstack/               # Sub-tech
│       ├── query-patterns.md   # Concern: data fetching
│       └── router-patterns.md  # Concern: routing
└── vue/                        # Tech
```

**Why**: React patterns differ significantly from Vue patterns

---

## Specialized Navigation Files

### When to Create

✅ Concern spans multiple subcategories
✅ Common workflows cross category boundaries
✅ Users need task-focused routes

### Examples

**ui-navigation.md** (in `development/`):
- Spans `development/frontend/` + `ui/web/`
- Task: "I need to build a UI"
- Routes to both code patterns and visual design

**backend-navigation.md** (in `development/`):
- Covers `backend/api-patterns/`, `backend/nodejs/`, `backend/authentication/`
- Task: "I need to build an API"
- Routes to approach, tech, and functional concerns

**fullstack-navigation.md** (in `development/`):
- Covers frontend + backend + data
- Task: "I need to build a full-stack app"
- Shows common tech stacks (MERN, T3, etc.)

---

## Steps to Organize

### 1. Audit Existing Content

List all files:
```bash
find .opencode/context/{category} -name "*.md" | sort
```

Categorize each file:
- What concern does it address?
- What approach/tech does it cover?
- What type of information? (concept, guide, example, etc.)

---

### 2. Choose Pattern

Use decision tree above to choose:
- Pattern A (Function-Based)
- Pattern B (Concern-Based)
- Hybrid

---

### 3. Create Directory Structure

**For Pattern A**:
```bash
mkdir -p {category}/{concepts,examples,guides,lookup,errors}
```

**For Pattern B**:
```bash
mkdir -p {category}/{concern}/{approach}
mkdir -p {category}/{concern}/{tech}
```

---

### 4. Move Files

Move files to appropriate locations:
```bash
mv {category}/old-file.md {category}/{concern}/{tech}/new-file.md
```

Rename for clarity:
```bash
mv code.md code-quality.md
mv tests.md test-coverage.md
```

---

### 5. Create Navigation Files

Create `navigation.md` at each level:
- Category level
- Subcategory level
- Specialized navigation (if needed)

Follow navigation design guide (navigation-design.md)

---

### 6. Update References

Find and update all cross-references:
```bash
grep -r "old-path" .opencode/context/
# Update to new paths
```

---

## Examples

### Example 1: Organizing development/

**Before** (flat):
```
development/
├── clean-code.md
├── api-design.md
├── react-patterns.md
├── animation-patterns.md
├── design-systems.md
```

**After** (concern-based):
```
development/
├── navigation.md
├── ui-navigation.md
│
├── principles/
│   ├── clean-code.md
│   └── api-design.md
│
└── frontend/
    └── react/
        └── react-patterns.md
```

**Moved to ui/**:
```
ui/web/
├── animation-patterns.md
└── design-systems.md
```

---

### Example 2: Organizing openagents-repo/

**Before** (mixed):
```
openagents-repo/
├── README.md
├── agents.md
├── evals.md
├── adding-agent.md
├── testing-agent.md
├── commands.md
```

**After** (function-based):
```
openagents-repo/
├── navigation.md
├── quick-start.md
│
├── core-concepts/
│   ├── agent-architecture.md
│   └── eval-framework.md
│
├── guides/
│   ├── adding-agent.md
│   └── testing-agent.md
│
└── lookup/
    └── commands.md
```

---

## Verification

After organizing:

- [ ] Pattern chosen (A, B, or Hybrid)?
- [ ] Directory structure created?
- [ ] Files moved to appropriate locations?
- [ ] Files renamed for clarity?
- [ ] Navigation files created at each level?
- [ ] Cross-references updated?
- [ ] Token count for navigation files 200-300?

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| File fits multiple concerns | Choose primary concern, add cross-reference |
| Too many subcategories | Group by higher-level concern |
| Unclear where file goes | Ask: "What task does this support?" |
| Navigation too complex | Create specialized navigation file |

---

## Related

- `../context-system.md` - Core principles
- `navigation-design.md` - How to create navigation files
- `../examples/navigation-examples.md` - Good examples
