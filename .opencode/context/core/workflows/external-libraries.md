<!-- Context: workflows/external-libraries | Priority: high | Version: 2.0 | Updated: 2026-01-28 -->
# Workflow: External Libraries

**Purpose**: Fetch current documentation for external packages before implementation

**Last Updated**: 2026-01-28

---

## Quick Start

**Golden Rule**: NEVER rely on training data for external libraries → ALWAYS fetch current docs

**Process**: Detect package → Check install scripts → Use ExternalScout → Implement

**When to use ExternalScout** (MANDATORY):
- New builds w/ external packages
- First-time package setup
- Package/dependency errors
- Version upgrades
- ANY external library work

---

## Core Principle

<rule id="external_docs_required" enforcement="strict">
  Training data is OUTDATED for external libraries.
  ALWAYS fetch current docs using ExternalScout before implementation.
</rule>

**Why**:
- APIs change (new methods, deprecated features)
- Configuration patterns evolve
- Breaking changes happen frequently
- Version-specific features differ

**Example**:
```
Training data (2023): Next.js 13 uses pages/ directory
Current (2025): Next.js 15 uses app/ directory (App Router)

Training data = broken code ❌
ExternalScout = working code ✅
```

---

## Workflow Stages

### 1. Detect External Package

**Triggers**: User mentions library | package.json deps | import statements | build errors | first-time setup

**Action**: Identify which external packages involved

---

### 2. Check Install Scripts (First-Time Builds)

**Check for**:
```bash
# Look for install scripts
ls scripts/install/ scripts/setup/ bin/install* setup.sh install.sh

# Check package-specific requirements
grep -r "postinstall\|preinstall" package.json
```

**Read scripts if found**:
- What does it do?
- Environment variables needed?
- Prerequisites (database, services)?

**Why**: Scripts may set up databases, generate files, configure services in specific order

---

### 3. Fetch Current Documentation (MANDATORY)

**Basic Pattern**:
```javascript
task(
  subagent_type="ExternalScout",
  description="Fetch [Library] docs for [topic]",
  prompt="Fetch current documentation for [Library]: [specific question]
  
  Focus on:
  - Installation and setup steps
  - [Specific feature/API needed]
  - [Integration requirements]
  - Required environment variables
  - Database/service setup
  
  Context: [What you're building]"
)
```

**Real Examples**:

**Drizzle ORM Setup**:
```javascript
task(
  subagent_type="ExternalScout",
  description="Fetch Drizzle PostgreSQL setup",
  prompt="Fetch Drizzle ORM docs: PostgreSQL setup w/ modular schemas
  
  Focus on: Installation | DB connection | Schema patterns | Migrations | TypeScript config
  Context: Next.js commerce site w/ PostgreSQL"
)
```

**Next.js App Router**:
```javascript
task(
  subagent_type="ExternalScout",
  description="Fetch Next.js App Router docs",
  prompt="Fetch Next.js docs: App Router w/ Server Actions
  
  Focus on: Installation | Directory structure | Server Actions | Data fetching | Route handlers
  Context: Commerce site w/ order processing"
)
```

**Better Auth Integration**:
```javascript
task(
  subagent_type="ExternalScout",
  description="Fetch Better Auth + Next.js integration",
  prompt="Fetch Better Auth docs: Next.js App Router integration w/ Drizzle
  
  Focus on: Installation | App Router setup | Drizzle adapter | Session mgmt | Route protection
  Context: Adding auth to Next.js commerce w/ Drizzle ORM"
)
```

**ExternalScout Returns**:
- Current, version-specific docs
- Installation steps + required packages
- Official API references
- Working code examples
- Current best practices
- Integration patterns
- Setup prerequisites
- Environment variables
- Common pitfalls + solutions

---

### 4. Verify Compatibility

**Check**: Version compatibility | Peer dependencies | Breaking changes | Platform requirements

**If version mismatch**: Note in plan → Request approval for upgrade → Fetch docs for specific version

---

### 5. Implement with Current Patterns

**Apply docs**:
- Use exact API signatures from docs
- Follow current best practices
- Use recommended config patterns
- Implement error handling as documented

**Don't**:
- ❌ Assume API based on training data
- ❌ Use deprecated patterns
- ❌ Skip version-specific requirements
- ❌ Ignore breaking changes

---

### 6. Test Integration

**Verify**: Package installs | Imports work | API calls match docs | Error handling | Integration w/ other packages

---

## Decision Flow: ContextScout + ExternalScout

```
User Request: "Build Next.js commerce w/ Drizzle"
                    ↓
┌──────────────────────────────────────────────────┐
│ STEP 1: ContextScout                             │
│ → Search internal context (.opencode/context/)  │
│ → Find project standards, patterns, workflows   │
└──────────────────────────────────────────────────┘
                    ↓
         Internal context found?
                    ↓
        ┌───────────┴───────────┐
       YES                      NO
        │                        │
        ↓                        ↓
   Use internal          Is it external library?
   context                       ↓
                        ┌────────┴────────┐
                       YES               NO
                        │                 │
                        ↓                 ↓
              ┌─────────────────┐  Report: No context
              │ STEP 2:         │  available
              │ ExternalScout   │
              │ (MANDATORY)     │
              └─────────────────┘
                        ↓
              Fetch: Next.js docs
                     Drizzle docs
                     Integration patterns
                        ↓
              ┌─────────────────────────┐
              │ STEP 3: Combine         │
              │ Internal: Standards     │
              │ External: Library docs  │
              │ → Implement w/ both     │
              └─────────────────────────┘
```

**When to Use Which**:

| Scenario | ContextScout | ExternalScout | Both |
|----------|--------------|---------------|------|
| Project coding standards | ✅ | ❌ | ❌ |
| External library setup | ❌ | ✅ MANDATORY | ❌ |
| Project-specific patterns | ✅ | ❌ | ❌ |
| External API usage | ❌ | ✅ MANDATORY | ❌ |
| Feature w/ external lib | ✅ standards | ✅ lib docs | ✅ |
| Package installation | ❌ | ✅ MANDATORY | ❌ |
| Security patterns | ✅ | ❌ | ❌ |
| External lib integration | ✅ project | ✅ lib docs | ✅ |

**Key Principle**: ContextScout + ExternalScout = Complete Context
- **ContextScout**: "How we do things in THIS project"
- **ExternalScout**: "How to use THIS library (current version)"
- **Combined**: "How to use THIS library following OUR standards"

---

## Common Scenarios

### Scenario 1: New Build w/ External Packages

**Example**: Next.js app w/ Drizzle + Better Auth

**Process**:
1. Check install scripts: `ls scripts/install/ scripts/setup/`
2. Identify packages: Next.js, Drizzle ORM, Better Auth
3. ExternalScout for each: Installation | Setup | Integration
4. Check requirements: PostgreSQL? Env vars? Services?
5. Verify version compatibility
6. Run install scripts (if exist) OR create setup from docs
7. Implement following current docs
8. Test integration points

---

### Scenario 2: Package Error During Build

**Example**: `Error: Cannot find module 'drizzle-orm/pg-core'`

**Process**:
1. Identify package: Drizzle ORM
2. ExternalScout: "Fetch Drizzle docs: PostgreSQL setup and imports"
3. Check current import patterns
4. Verify package.json has correct deps
5. Propose fix from current docs
6. Request approval → Apply fix

---

### Scenario 3: First-Time Package Setup

**Example**: Setting up TanStack Query in Next.js

**Process**:
1. Check install scripts: `ls scripts/install/` | `grep -r "tanstack\|react-query" scripts/`
2. ExternalScout: "Fetch TanStack Query docs: Installation, Next.js App Router setup w/ Server Components"
3. Get: Install steps | Peer deps | Config files | Current patterns | Best practices
4. If install script exists: Review → Run
5. If no script: Follow docs for manual setup
6. Implement → Test

---

### Scenario 4: Version Upgrade

**Example**: Next.js 14 → 15

**Process**:
1. ExternalScout: "Fetch Next.js 15 docs: Breaking changes and migration guide"
2. Review breaking changes
3. Identify affected code
4. Plan migration steps
5. Request approval → Implement → Test

---

## Real-World Example: Auth Implementation

**Task**: "Add authentication w/ Better Auth to Next.js commerce site"

```javascript
// 1. ContextScout: Project standards
task(
  subagent_type="ContextScout",
  description="Find auth and security standards",
  prompt="Find context files: Auth patterns | Security standards | Code quality | Project structure"
)
// Returns: security-patterns.md, code-quality.md

// 2. ExternalScout: Better Auth docs (MANDATORY)
task(
  subagent_type="ExternalScout",
  description="Fetch Better Auth + Next.js docs",
  prompt="Fetch Better Auth docs: Next.js App Router integration
  
  Focus on: Installation | App Router setup | Session mgmt | Route protection | Drizzle adapter
  Context: Adding auth to Next.js commerce w/ Drizzle ORM"
)
// Returns: Current installation | Integration patterns | Drizzle config | Working examples

// 3. Combine and implement
// - Better Auth patterns (from ExternalScout)
// - Security standards (from ContextScout)
// - Code quality standards (from ContextScout)
// = Secure, well-structured auth implementation ✅
```

---

## Error Handling

| Error Type | Process |
|------------|---------|
| **Package Installation** | ExternalScout: installation docs → Verify package name/version → Check peer deps → Propose fix w/ current steps |
| **Import/Module** | ExternalScout: import patterns → Check current API exports → Verify import paths → Propose fix w/ current imports |
| **API/Configuration** | ExternalScout: API docs → Check current signatures → Verify config format → Propose fix w/ current patterns |
| **Build Errors** | Identify package → ExternalScout: relevant docs → Check known issues/breaking changes → Propose fix from current docs |

---

## Best Practices

**Do** ✅:
- Check install scripts first on new builds
- Always fetch current docs before implementing
- Use ExternalScout proactively on new builds
- Verify versions match (package.json vs docs)
- Check breaking changes when upgrading
- Read install scripts before running
- Check prerequisites (databases, services, env vars)
- Test integrations between packages
- Cache useful docs in `.opencode/context/development/frameworks/` if frequently used

**Don't** ❌:
- Assume APIs based on training data
- Skip version checks (breaking changes are common)
- Ignore peer dependencies
- Mix patterns from different versions
- Run install scripts blindly
- Skip environment setup

---

## Troubleshooting FAQ

### "When exactly should I use ExternalScout?"

**ALWAYS use ExternalScout when working with external packages.**

**Triggers**: User mentions library | `import`/`require` statements | package.json deps | build errors | first-time setup | version upgrades

**Rule**: If it's not in `.opencode/context/`, use ExternalScout.

---

### "What if I already know the library?"

**DON'T rely on training data - it's outdated.**

Example: You think "I know Next.js, I'll use pages/" → Reality: Next.js 15 uses app/ → Result: Broken code ❌

**Always fetch current docs, even if you "know" the library.**

---

### "How do I know if something is external?"

**External libraries**: npm/pip/gem/cargo packages | Third-party frameworks | ORMs/databases | Auth libraries | UI libraries

**NOT external**: Your project's code | Project utilities | Internal modules

**Check**: Is it in `package.json` dependencies? → External → Use ExternalScout

---

### "Can I use both ContextScout and ExternalScout?"

**YES! Use both for most features.**

```javascript
// 1. ContextScout: Project standards
task(subagent_type="ContextScout", ...)
// Returns: code-quality.md, security-patterns.md

// 2. ExternalScout: Library docs
task(subagent_type="ExternalScout", ...)
// Returns: Current Next.js docs, Drizzle docs

// 3. Combine: Implement using both
```

---

### "What if ExternalScout doesn't have the library?"

**ExternalScout has two sources**:
1. **Context7 API** (primary): 50+ popular libraries
2. **Official docs** (fallback): Any library w/ public docs

**If library not in Context7**: Auto-fallback to official docs via webfetch

**You don't need to worry - ExternalScout handles it.**

---

### "How do I write a good ExternalScout prompt?"

**Template**:
```javascript
task(
  subagent_type="ExternalScout",
  description="Fetch [Library] docs for [specific topic]",
  prompt="Fetch current documentation for [Library]: [specific question]
  
  Focus on:
  - [What you need - be specific]
  - [Related features/APIs]
  - [Integration requirements]
  
  Context: [What you're building]"
)
```

**Good prompts**: ✅ Specific | ✅ Focused (3-5 things) | ✅ Contextual | ✅ Current

**Bad prompts**: ❌ Vague | ❌ Too broad | ❌ No context

---

### "What if I get an error after using ExternalScout?"

**Normal - errors happen. Process**:
1. Read error message carefully
2. ExternalScout again w/ specific error:
   ```javascript
   task(
     subagent_type="ExternalScout",
     description="Fetch docs for error resolution",
     prompt="Fetch [Library] docs: [error message]
     
     Error: [paste actual error]
     Focus on: Common causes | Solutions | Correct API usage"
   )
   ```
3. Check install scripts (maybe setup incomplete)
4. Verify versions (package.json vs docs)

---

### "Do I need approval to use ExternalScout?"

**NO - ExternalScout is read-only, no approval required.**

**Approval required**: ❌ Write code | ❌ Run commands | ❌ Install packages

**Approval NOT required**: ✅ ContextScout | ✅ ExternalScout | ✅ Read files | ✅ Search code

---

### "ContextScout vs ExternalScout?"

| Aspect | ContextScout | ExternalScout |
|--------|--------------|---------------|
| **Searches** | Internal project files | External documentation |
| **Location** | `.opencode/context/` | Internet (Context7, official docs) |
| **Returns** | Project standards, patterns | Library APIs, installation |
| **Use for** | "How we do things here" | "How this library works" |
| **Tools** | glob, read, grep | webfetch, Context7 API |
| **Speed** | Fast (local) | Slower (network) |
| **Currency** | Static (project docs) | Live (current docs) |

**Use both together for best results.**

---

### "Quick Checklist: Am I doing it right?"

Before implementing w/ external libraries:

- [ ] Used ContextScout for project standards?
- [ ] Checked for install scripts first?
- [ ] Used ExternalScout for EACH external library?
- [ ] Asked for installation steps in ExternalScout prompt?
- [ ] Asked for current API patterns and examples?
- [ ] Specified what I'm building (context)?
- [ ] Read returned docs before coding?
- [ ] Following both project standards AND library docs?

**All checked? → You're doing it right! ✅**

---

## Supported Libraries

**See**: `.opencode/skill/context7/library-registry.md`

**Categories**: Database/ORM (Drizzle, Prisma) | Auth (Better Auth, NextAuth, Clerk) | Frontend (Next.js, React, TanStack) | Infrastructure (Cloudflare, AWS, Vercel) | UI (Shadcn/ui, Radix, Tailwind) | State (Zustand, Jotai) | Validation (Zod, React Hook Form) | Testing (Vitest, Playwright)

**Not listed?** ExternalScout can still fetch from official docs via webfetch

---

## References

- **ExternalScout Agent**: `.opencode/agent/subagents/core/externalscout.md`
- **Library Registry**: `.opencode/skill/context7/library-registry.md`
- **ContextScout Agent**: `.opencode/agent/subagents/core/contextscout.md`
- **Code Standards**: `.opencode/context/core/standards/code-quality.md`
