# OAC Package Refactor - Critical Feedback & Recommendations

**Date**: 2026-02-14  
**Source**: Parallel review by CodeReviewer + User Research Agent  
**Status**: Action Required Before Phase 1

---

## Executive Summary

**Overall Assessment**: The OAC refactor plan is **80% solid** but needs critical additions before implementation.

**Key Findings**:
- ✅ Core architecture is sound (approval system, context resolution, multi-IDE)
- ⚠️ Missing critical features (discovery, lockfile, security)
- ❌ Some approaches need rethinking (context merging, local/global UX)
- 💡 Repository structure needs optimization for extensibility

---

## 🚨 CRITICAL Issues to Address Before Phase 1

### 1. Security & Verification (BLOCKER)

**Problem**: Community components have no security layer

**Required Additions**:
```typescript
interface ComponentSecurity {
  signature: string;           // GPG signature
  checksum: string;            // SHA-256 hash
  scanResults: {
    malware: boolean;
    secrets: boolean;
    externalCalls: string[];
  };
  permissions: {
    fileSystem: 'read' | 'write' | 'none';
    network: 'allowed' | 'denied';
    shell: 'allowed' | 'denied';
  };
}
```

**Add to Phase 1**:
- Component signing mechanism
- Checksum verification
- Basic malware scanning (ClamAV)
- Secret detection (gitleaks)

**CLI Commands**:
```bash
oac verify <component>        # Verify signature
oac audit                     # Security scan
oac trust @author             # Trust publisher
```

---

### 2. Discovery & Browse Experience (CRITICAL GAP)

**Problem**: Users can't discover what's available

**Current Plan**: Only `oac add` (assumes you know what exists)

**Required Additions**:
```bash
oac browse                    # Interactive TUI browser
oac search "rust" --verified  # Search registry
oac trending                  # Popular components
oac info agent:rust-specialist # Detailed info
oac preview agent:rust        # Show what it does
```

**Implementation**:
- Interactive TUI using `ink` or `blessed`
- Web registry at https://registry.openagents.dev
- Component ratings and reviews
- Download counts and trending

**Add to Phase 1**: Basic `oac browse` and `oac search`

---

### 3. Lockfile for Reproducibility (CRITICAL GAP)

**Problem**: No way to guarantee reproducible installs (teams need this)

**Required Addition**:
```json
// oac.lock
{
  "version": "1.0.0",
  "lockfileVersion": 1,
  "components": {
    "agent:openagent": {
      "version": "0.7.1",
      "resolved": "https://github.com/.../openagent.md",
      "integrity": "sha256-abc123...",
      "dependencies": {
        "context:code-quality": "^1.0.0"
      }
    }
  }
}
```

**CLI Commands**:
```bash
oac lock                      # Generate lock file
oac install --frozen          # Use exact locked versions
oac lock verify               # Verify integrity
```

**Add to Phase 2**: Lockfile generation and frozen installs

---

### 4. Version Conflict Management (CRITICAL GAP)

**Problem**: No strategy for handling version conflicts

**Required Additions**:
```json
{
  "dependencies": {
    "agents": {
      "tester": "^1.0.0",     // Semver range
      "reviewer": "~2.1.0"    // Patch updates only
    }
  },
  "peerDependencies": {
    "openagent": "^0.5.0"     // Required version
  }
}
```

**CLI Commands**:
```bash
oac outdated                  # Show outdated components
oac update --check-breaking   # Warn about breaking changes
oac pin <component> <version> # Pin to specific version
oac deps tree                 # Show dependency tree
oac deps conflicts            # Show conflicts
```

**Add to Phase 2**: Semver support and conflict detection

---

### 5. Interactive Onboarding (HIGH PRIORITY)

**Problem**: First-time users need guidance

**Required Addition**:
```bash
oac init

┌─────────────────────────────────────────────────┐
│  Welcome to OpenAgents Control! 👋              │
│  Let's set up your AI agent environment.        │
└─────────────────────────────────────────────────┘

? What's your primary use case?
  > Software Development
    Content Creation
    Data Analysis

? Which IDE do you use?
  ✓ OpenCode
  ✓ Cursor

? Install location preference?
  > Ask each time (recommended)
    Always local
    Always global

✓ Configuration saved!
📦 Installing recommended agents...
✓ Done! Try: oac browse
```

**Add to Phase 1**: Interactive wizard for `oac init`

---

### 6. Visual Feedback & Progress (HIGH PRIORITY)

**Problem**: Long operations feel unresponsive

**Required Addition**:
```bash
📦 Installing OpenCode Developer Profile
⠋ Downloading components... [████████████░░░░░░░░] 60% (12/20)
✓ openagent.md (15KB)
✓ opencoder.md (18KB)
⠋ Installing contexts...
```

**Implementation**:
- Use `ora` for spinners
- Use `cli-progress` for progress bars
- Color-coded output with `chalk`
- Clear success/error states

**Add to Phase 1**: Progress indicators for all long operations

---

## ⚠️ Approaches That Need Rethinking

### 1. Context Merging is Dangerous

**Current Plan**: Merge context files from multiple sources

**Problem**:
- Conflicts between sections
- Unclear merge strategy
- Hard to debug

**Better Approach**: Use composition instead
```typescript
interface ContextComposition {
  base: string;                // Base context
  overrides: string[];         // Override files (applied in order)
  strategy: 'override' | 'append' | 'prepend';
}
```

**Action**: Replace merging with composition in Phase 5

---

### 2. Local vs Global UX is Confusing

**Current Plan**: Ask "local or global?" on every command

**Problem**:
- Decision fatigue
- Most users want one or the other
- No clear guidance

**Better Approach**: Auto-detection with smart defaults
```bash
# Set default once
oac configure set preferences.installLocation auto

# Auto-detect based on context:
# - In git repo? → local
# - Has .opencode/? → local
# - In home dir? → global

# Override when needed
oac install --global
oac install --local
```

**Action**: Implement auto-detection in Phase 1

---

### 3. Cursor Agent Merging is Problematic

**Current Plan**: Merge all agents into single .cursorrules

**Problem**:
- Loss of modularity
- Hard to debug
- 100KB limit is restrictive
- Merge conflicts on updates

**Better Approach**: Router agent pattern
```markdown
# Cursor Router Agent
When user asks about testing → delegate to tester patterns
When user asks about frontend → delegate to frontend patterns
Default → delegate to openagent patterns

[Embedded agent patterns as sections, not full agents]
```

**Action**: Implement router pattern in Phase 3

---

## 💡 Recommended Additions

### 1. Plugin Architecture for Extensibility

**Why**: Keep core lean, allow community extensions

```typescript
interface OACPlugin {
  name: string;
  version: string;
  hooks: {
    beforeInstall?: (context: InstallContext) => void;
    afterInstall?: (context: InstallContext) => void;
  };
  commands?: Command[];
  adapters?: IDEAdapter[];
}
```

**Add to Phase 6**: Plugin system

---

### 2. Workspace Support for Monorepos

**Why**: Teams use monorepos, need first-class support

```json
// oac-workspace.json
{
  "version": "1.0.0",
  "packages": ["packages/*", "apps/*"],
  "shared": {
    "context": ".oac/shared/context",
    "config": ".oac/shared/config.json"
  }
}
```

**Add to v1.1**: Workspace support

---

### 3. Component Marketplace with Ratings

**Why**: Discovery and trust

```typescript
interface ComponentMarketplace {
  downloads: number;
  rating: number;           // 1-5 stars
  reviews: Review[];
  verified: boolean;
  maintainer: string;
  lastUpdated: Date;
}
```

**Add to v1.1**: Marketplace features

---

## 🏗️ Repository Structure Recommendation

### Use Monorepo (pnpm workspaces)

```
@nextsystems/oac/
├── packages/
│   ├── core/                  # Core CLI package
│   │   ├── src/
│   │   │   ├── cli/
│   │   │   ├── config/
│   │   │   ├── approval/
│   │   │   └── context/
│   │   ├── tests/
│   │   └── package.json
│   ├── adapters/              # IDE adapters package
│   │   ├── src/
│   │   │   ├── opencode/
│   │   │   ├── cursor/
│   │   │   ├── claude/
│   │   │   └── windsurf/
│   │   └── package.json
│   ├── registry/              # Registry package
│   │   ├── src/
│   │   └── package.json
│   ├── security/              # Security scanning
│   │   ├── src/
│   │   └── package.json
│   └── cli/                   # CLI entry point
│       ├── bin/
│       └── package.json
├── .opencode/                 # Official components
├── registry.json              # Official registry
├── community-registry.json    # Community registry
├── pnpm-workspace.yaml        # Monorepo config
└── package.json               # Root package
```

**Why Monorepo**:
- ✅ Shared dependencies
- ✅ Atomic commits across packages
- ✅ Easier to maintain consistency
- ✅ Easier to test integrations
- ✅ Single version for all packages

**Tools**: pnpm workspaces + Turborepo

---

## 🤝 Community Contribution Workflow

### Recommended Process

```bash
# 1. Create component locally
oac create agent my-specialist

# 2. Test locally
oac test agent:my-specialist

# 3. Package for submission
oac package agent:my-specialist
# Creates: my-specialist.oac.tar.gz

# 4. Submit to registry
oac submit my-specialist.oac.tar.gz
# Uploads to GitHub, creates PR

# 5. Automated checks run
# - Security scan (ClamAV)
# - Secret scan (gitleaks)
# - Dependency check
# - Test execution
# - Size check

# 6. Manual review (for verification badge)
# - Code quality review
# - Documentation review
# - Test coverage review

# 7. Approval and publish
# - Merged to community-registry.json
# - Available via `oac add`
```

### Security Scanning Pipeline

```yaml
# .github/workflows/component-scan.yml
name: Component Security Scan

on:
  pull_request:
    paths:
      - 'community-registry.json'

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Malware scan
        run: clamav scan component/
      
      - name: Secret scan
        run: gitleaks detect --source component/
      
      - name: Dependency audit
        run: npm audit
      
      - name: Test execution
        run: oac test component/
```

---

## 📋 Updated Feature Prioritization

### MVP (v1.0.0 - Must Ship)

| Feature | Priority | Status | Action |
|---------|----------|--------|--------|
| Core CLI | P0 | ✅ Planned | Keep |
| Multi-IDE support | P0 | ✅ Planned | Keep |
| Approval gates | P0 | ✅ Planned | Keep |
| Configuration system | P0 | ✅ Planned | Keep |
| Context resolution | P0 | ✅ Planned | Fix merging |
| **Discovery** (`browse`, `search`) | P0 | 🚨 **ADD** | Phase 1 |
| **Lockfile** (`oac.lock`) | P0 | 🚨 **ADD** | Phase 2 |
| **Security** (verify, audit) | P0 | 🚨 **ADD** | Phase 1 |
| **Onboarding** (interactive init) | P0 | 🚨 **ADD** | Phase 1 |
| **Progress UI** (spinners, bars) | P0 | 🚨 **ADD** | Phase 1 |
| **Auto-detection** (local/global) | P0 | 🚨 **ADD** | Phase 1 |

### Post-MVP (v1.1.0)

| Feature | Priority | Impact |
|---------|----------|--------|
| Preview/try mode | P1 | High |
| Dependency management | P1 | High |
| Plugin system | P1 | Medium |
| Workspace support | P1 | Medium |
| Marketplace features | P1 | High |

---

## 📚 Documentation Requirements

### Critical Docs (Before Launch)

1. **Quick Start (5-Minute Guide)**
   - Install → Init → Add Agent → Start Coding

2. **CLI Reference** (Auto-Generated)
   - Every command documented
   - Examples for each flag
   - Common use cases

3. **Recipes / Cookbook**
   - Set up React project
   - Share config with team
   - Create custom agent
   - Troubleshooting

4. **Component Creation Guide**
   - Step-by-step agent creation
   - Testing guide
   - Publishing checklist

5. **Migration Guide**
   - From current OAC to v1.0
   - Breaking changes
   - Upgrade path

---

## ✅ Action Items (Before Phase 1)

### Immediate (This Week)

1. ✅ **Update context file** with critical additions
2. ✅ **Update Phase 1 tasks** to include:
   - Discovery (browse, search)
   - Security (verify, checksum)
   - Onboarding (interactive init)
   - Progress UI (spinners, bars)
   - Auto-detection (local/global)
3. ✅ **Update Phase 2 tasks** to include:
   - Lockfile generation
   - Version conflict detection
   - Semver support

### Before Implementation

4. ⬜ **Set up monorepo structure** (pnpm workspaces)
5. ⬜ **Create security scanning workflow**
6. ⬜ **Design TUI for browse command**
7. ⬜ **Write Quick Start docs**

---

## 🎯 Key Takeaways

### What's Good (Keep)

1. ✅ User approval system with YOLO mode
2. ✅ Layered context resolution (fix merging)
3. ✅ Multi-IDE support via adapters
4. ✅ Community registry concept
5. ✅ Backward compatibility

### What's Missing (Add)

1. 🚨 Discovery (browse, search, trending)
2. 🚨 Lockfile (reproducibility)
3. 🚨 Security (verification, scanning)
4. 🚨 Onboarding (interactive wizard)
5. 🚨 Progress UI (spinners, bars)
6. 🚨 Auto-detection (local/global)

### What Needs Fixing (Rethink)

1. ⚠️ Context merging → Use composition
2. ⚠️ Always asking local/global → Auto-detect
3. ⚠️ Cursor agent merging → Router pattern
4. ⚠️ No version management → Add semver + lockfile

---

## 📊 Success Metrics (Post-Launch)

| Metric | Target (6 months) |
|--------|-------------------|
| GitHub stars | 1,000+ |
| npm downloads/month | 10,000+ |
| Community components | 50+ |
| Active contributors | 20+ |
| Docs page views | 5,000+/month |

---

## 🚀 Next Steps

1. **Update OAC refactor plan** with critical additions
2. **Update Phase 1 tasks** to include new features
3. **Set up monorepo structure**
4. **Start Phase 1 implementation**

---

**Status**: Ready to proceed with updated plan  
**Confidence**: High (80% → 95% with additions)  
**Risk**: Low (critical gaps identified and addressed)
