<!-- Context: workflows/external-libraries | Priority: high | Version: 2.1 | Updated: 2026-02-05 -->
# Workflow: External Libraries

**Purpose**: Fetch current documentation for external packages before implementation

---

## Quick Start

**Golden Rule**: NEVER rely on training data for external libraries → ALWAYS fetch current docs

**Process**: Detect package → Check install scripts → Use ExternalScout → Implement

**When to use ExternalScout** (MANDATORY):
- New builds with external packages
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

**Why:**
- APIs change (new methods, deprecated features)
- Configuration patterns evolve
- Breaking changes happen frequently

**Example:**
```
Training data (2023): Next.js 13 uses pages/ directory
Current (2025): Next.js 15 uses app/ directory

Training data = broken code ❌
ExternalScout = working code ✅
```

---

## Workflow Stages

### 1. Detect External Package

**Triggers**: User mentions library | package.json deps | import statements | build errors

### 2. Check Install Scripts

```bash
ls scripts/install/ scripts/setup/ bin/install* setup.sh
grep -r "postinstall\|preinstall" package.json
```

Read scripts if found: What does it do? Environment variables? Prerequisites?

### 3. Fetch Current Documentation (MANDATORY)

```javascript
task(
  subagent_type="ExternalScout",
  description="Fetch [Library] docs for [topic]",
  prompt="Fetch current documentation for [Library]: [specific question]
  
  Focus on:
  - Installation and setup steps
  - [Specific feature/API needed]
  - Required environment variables
  
  Context: [What you're building]"
)
```

### 4. Verify Compatibility

Check: Version compatibility | Peer dependencies | Breaking changes

### 5. Implement with Current Patterns

- Use exact API signatures from docs
- Follow current best practices
- Use recommended config patterns

### 6. Test Integration

Verify: Package installs | Imports work | API calls match docs

---

## Decision Flow: ContextScout + ExternalScout

```
User Request: "Build Next.js commerce w/ Drizzle"
                    ↓
STEP 1: ContextScout → Search internal context
                    ↓
         Internal context found?
                    ↓
        YES → Use internal     NO → Is it external library?
                                        ↓
                               YES → STEP 2: ExternalScout (MANDATORY)
                                        ↓
                               STEP 3: Combine internal + external → Implement
```

| Scenario | ContextScout | ExternalScout |
|----------|--------------|---------------|
| Project coding standards | ✅ | ❌ |
| External library setup | ❌ | ✅ MANDATORY |
| Feature with external lib | ✅ standards | ✅ lib docs |

---

## Best Practices

**Do ✅:**
- Check install scripts first
- Always fetch current docs
- Verify versions match
- Test integrations

**Don't ❌:**
- Assume APIs based on training data
- Skip version checks
- Ignore peer dependencies
- Run install scripts blindly

---

## Related

- `external-libraries-scenarios.md` - Common scenarios and examples
- `external-libraries-faq.md` - Troubleshooting FAQ
- `.opencode/agent/externalscout.md` (OpenCode v2; v1 nests it under `agent/subagents/core/`) - ExternalScout agent
