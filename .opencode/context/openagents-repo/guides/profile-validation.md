# Guide: Profile Validation

**Purpose**: Ensure installation profiles include all appropriate components  
**Priority**: HIGH - Check this when adding new agents or updating registry

---

## What Are Profiles?

Profiles are pre-configured component bundles in `registry.json` that users install:
- **essential** - Minimal setup (openagent + core subagents)
- **developer** - Full dev environment (all dev agents + tools)
- **business** - Content/product focus (content agents + tools)
- **full** - Everything (all agents, subagents, tools)
- **advanced** - Full + meta-level (system-builder, repo-manager)

---

## The Problem

**Issue**: New agents added to `components.agents[]` but NOT added to profiles

**Result**: Users install a profile but don't get the new agents

**Example** (v0.5.0 bug):
```json
// ✅ Agent exists in components
{
  "id": "devops-specialist",
  "path": ".opencode/agent/development/devops-specialist.md"
}

// ❌ But NOT in developer profile
"developer": {
  "components": [
    "agent:openagent",
    "agent:opencoder"
    // Missing: "agent:devops-specialist"
  ]
}
```

---

## Validation Checklist

When adding a new agent, **ALWAYS** check:

### 1. Agent Added to Components
```bash
# Check agent exists in registry
cat registry.json | jq '.components.agents[] | select(.id == "your-agent")'
```

### 2. Agent Added to Appropriate Profiles

**Development agents** → Add to:
- ✅ `developer` profile
- ✅ `full` profile
- ✅ `advanced` profile

**Content agents** → Add to:
- ✅ `business` profile
- ✅ `full` profile
- ✅ `advanced` profile

**Data agents** → Add to:
- ✅ `business` profile (if business-focused)
- ✅ `full` profile
- ✅ `advanced` profile

**Meta agents** → Add to:
- ✅ `advanced` profile only

**Core agents** → Add to:
- ✅ `essential` profile
- ✅ All other profiles

### 3. Verify Profile Includes Agent

```bash
# Check if agent is in developer profile
cat registry.json | jq '.profiles.developer.components[] | select(. == "agent:your-agent")'

# Check if agent is in business profile
cat registry.json | jq '.profiles.business.components[] | select(. == "agent:your-agent")'

# Check if agent is in full profile
cat registry.json | jq '.profiles.full.components[] | select(. == "agent:your-agent")'
```

---

## Profile Assignment Rules

### Developer Profile
**Include**:
- Core agents (openagent, opencoder)
- Development specialists (frontend, backend, devops, codebase)
- All code subagents (tester, reviewer, coder-agent, build-agent)
- Dev commands (commit, test, validate-repo)
- Dev context (standards/code, standards/tests, workflows/*)

**Exclude**:
- Content agents (copywriter, technical-writer)
- Data agents (data-analyst)
- Meta agents (system-builder, repo-manager)

### Business Profile
**Include**:
- Core agent (openagent)
- Content specialists (copywriter, technical-writer)
- Data specialists (data-analyst)
- Image tools (gemini, image-specialist)
- Notification tools (telegram, notify)

**Exclude**:
- Development specialists
- Code subagents
- Meta agents

### Full Profile
**Include**:
- Everything from developer profile
- Everything from business profile
- All agents except meta agents

**Exclude**:
- Meta agents (system-builder, repo-manager)

### Advanced Profile
**Include**:
- Everything from full profile
- Meta agents (system-builder, repo-manager)
- Meta subagents (domain-analyzer, agent-generator, etc.)
- Meta commands (build-context-system)

---

## Quick Reference

| Agent Category | Essential | Developer | Business | Full | Advanced |
|---------------|-----------|-----------|----------|------|----------|
| core          | ✅        | ✅        | ✅       | ✅   | ✅       |
| development   | ❌        | ✅        | ❌       | ✅   | ✅       |
| content       | ❌        | ❌        | ✅       | ✅   | ✅       |
| data          | ❌        | ❌        | ✅       | ✅   | ✅       |
| meta          | ❌        | ❌        | ❌       | ❌   | ✅       |

---

## Related Files

- **Registry concepts**: `core-concepts/registry.md`
- **Updating registry**: `guides/updating-registry.md`
- **Adding agents**: `guides/adding-agent.md`

---

**Last Updated**: 2025-12-29  
**Version**: 0.5.1
