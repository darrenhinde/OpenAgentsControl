# OAC MVP — The 20% That Delivers 80% of the Value

**Date**: 2026-02-19
**Status**: ACTIVE — This is what we build first
**Branch**: `feature/oac-package-refactor`
**Issue**: #206

---

## The Aim

**One sentence**: Make it dead simple to install, manage, and keep updated a set of excellent AI agents and context files across any IDE — and get out of the user's way.

**What users actually want**:
1. "Set me up fast so I can code with AI" → `oac init`
2. "Keep my stuff updated without breaking my changes" → `oac update`
3. "Work with whatever IDE I'm in" → `oac apply`
4. "Let me grab the context/agents I need" → `oac add`
5. "Tell me if something's wrong" → `oac doctor`

**What users do NOT want**: Provider interfaces, 6-layer resolution theory, preset merge strategies, TUI browsers, community registries, plugin architectures. Those are our problems, not theirs.

---

## The Focus

### The Product is the CONTENT, Not the CLI

The agents, context files, and skills we ship are the product. The CLI is a delivery truck. If the agents are mediocre, the fanciest CLI won't save us. If the agents are excellent, even a basic CLI wins.

**Priority order**:
1. Excellent bundled content (agents + context)
2. Reliable install/update that respects user changes
3. Multi-IDE output generation
4. Everything else

### Context System is the Core Value

Context files are what make AI agents actually useful in a project. Without project-specific context (coding standards, architecture patterns, domain knowledge), agents give generic answers. With good context, they give great answers.

**The context system must**:
- Let users install curated context files easily
- Let users add/remove individual context files
- Let users override any context file with their own version
- Keep bundled context updated without touching user overrides
- Work offline (bundled in npm, no network fetch at runtime)

---

## 5 Commands. That's the MVP.

```
oac init          Set up agents + context in my project
oac update        Update everything, skip what I changed
oac apply         Generate files for Cursor/Claude/Windsurf
oac add <thing>   Add a specific agent, context file, or skill
oac doctor        Tell me what's broken and how to fix it
```

Plus these flags that work on any command:
```
--yolo            Skip all confirmations (auto-enabled when CI=true)
--dry-run         Show what would happen without doing it
--verbose         Show detailed output
```

And one bonus for discoverability:
```
oac list          Show what's installed
oac status        One-screen summary of everything
```

That's 7 commands total. Nothing else ships in v1.0.

---

## What "Done" Looks Like — The Passing State

### Gate 1: `oac init` Works (Week 2)

**User runs**: `npx @nextsystems/oac init`

**What happens**:
1. Detects current directory (must be a project root — has `package.json` or `.git`)
2. Auto-detects IDEs present (`.opencode/`, `.cursor/`, `.claude/`)
3. Asks ONE question: "Install standard agent pack? (Y/n)"
4. Copies bundled agents + context to `.opencode/`
5. Writes `.oac/manifest.json` (tracks what was installed + SHA256 of each file)
6. Writes `.oac/config.json` (minimal defaults)
7. Prints: "Done! X agents and Y context files installed. Run `oac doctor` to verify."

**Passing criteria**:
- [ ] Completes in < 30 seconds on a cold run
- [ ] `npx @nextsystems/oac init` works (no global install required)
- [ ] Idempotent — running twice doesn't duplicate or break anything
- [ ] Skips files that already exist (prints "skipped: already exists")
- [ ] Works on macOS, Linux, Windows
- [ ] Zero interactive prompts with `--yolo` flag
- [ ] `CI=true` environment auto-enables `--yolo`
- [ ] Exit code 0 on success, non-zero on failure

**What it installs by default**:
```
.opencode/
├── agent/
│   ├── core/
│   │   ├── openagent.md              # Primary orchestrator
│   │   └── opencoder.md              # Code implementation
│   ├── development/
│   │   ├── TestEngineer.md
│   │   ├── CodeReviewer.md
│   │   ├── CoderAgent.md
│   │   └── BuildAgent.md
│   └── discovery/
│       ├── ContextScout.md
│       └── ExternalScout.md
├── context/
│   ├── core/
│   │   └── standards/
│   │       ├── code-quality.md
│   │       ├── test-coverage.md
│   │       └── security-patterns.md
│   ├── development/
│   │   └── principles/
│   │       ├── clean-code.md
│   │       └── api-design.md
│   └── [project-intelligence templates]
├── skills/
│   ├── task-management/
│   └── context-manager/
├── config.json
└── opencode.json

.oac/
├── manifest.json                     # What OAC installed + SHA256 hashes
└── config.json                       # User preferences
```

---

### Gate 2: `oac update` Works (Week 3)

**User runs**: `oac update`

**What happens**:
1. Reads `.oac/manifest.json` (what's installed + original SHA256)
2. Compares each installed file's current SHA256 against the manifest
3. For each file:
   - SHA256 matches manifest → file is untouched → safe to update → update silently
   - SHA256 differs from manifest → user modified it → SKIP and report
4. Copies new versions of safe-to-update files from npm bundle
5. Updates `.oac/manifest.json` with new SHA256s
6. Prints summary: "Updated X files. Skipped Y files (user-modified)."

**Passing criteria**:
- [ ] Updates files the user hasn't touched
- [ ] NEVER overwrites a file the user modified (unless `--yolo`)
- [ ] `--yolo` creates `.oac/backups/{filename}.{timestamp}` before overwriting
- [ ] `oac update --check` shows what WOULD change without changing anything
- [ ] `oac update --dry-run` same as `--check` (alias)
- [ ] Works when npm package has been updated (`npm update @nextsystems/oac`)
- [ ] Handles new files (files in new version that didn't exist before → install them)
- [ ] Handles removed files (files removed from new version → leave user's copy, warn)
- [ ] Prints clear list: "Updated: file1, file2. Skipped (modified): file3. New: file4."

**The manifest format** (simple, not a full lockfile):
```json
{
  "version": "1",
  "oacVersion": "0.7.1",
  "installedAt": "2026-02-19T10:00:00Z",
  "updatedAt": "2026-02-19T10:00:00Z",
  "files": {
    ".opencode/agent/core/openagent.md": {
      "sha256": "a1b2c3d4...",
      "source": "bundled",
      "installedAt": "2026-02-19T10:00:00Z"
    },
    ".opencode/context/core/standards/code-quality.md": {
      "sha256": "e5f6a7b8...",
      "source": "bundled",
      "installedAt": "2026-02-19T10:00:00Z"
    }
  }
}
```

---

### Gate 3: `oac add` Works for Context (Week 4)

**User runs**: `oac add context:react-patterns`

**What happens**:
1. Looks up `react-patterns` in the bundled registry (`registry.json`)
2. Finds the file path in the npm package
3. Copies it to `.opencode/context/development/react-patterns.md`
4. Updates `.oac/manifest.json`
5. Prints: "Added react-patterns to .opencode/context/development/"

**Also supports**:
```bash
oac add agent:rust-specialist       # Add a specific agent
oac add skill:context-manager       # Add a specific skill
oac add context:typescript-patterns # Add a specific context file
oac remove context:react-patterns   # Remove something
```

**Passing criteria**:
- [ ] `oac add` with no args shows available components grouped by type
- [ ] `oac add context:X` installs the context file to the right location
- [ ] `oac add agent:X` installs the agent file to the right location
- [ ] Warns if component already exists: "Already installed. Use --force to reinstall."
- [ ] `oac remove X` removes the file and updates manifest
- [ ] `oac list` shows all installed components with type and path
- [ ] `oac list --context` filters to context files only
- [ ] `oac list --agents` filters to agents only

**Why context is the priority for `add`**:
Context files are the most granular, most frequently added/removed, and most project-specific. A Rust project needs different context than a React project. Users will `oac add context:rust-patterns` far more often than `oac add agent:X`.

---

### Gate 4: `oac apply` Works (Week 5)

**User runs**: `oac apply cursor`

**What happens**:
1. Reads all installed agents from `.opencode/agent/`
2. Uses the compatibility layer adapters (already built!) to convert
3. Generates `.cursorrules` with a router pattern
4. Prints: "Generated .cursorrules (45KB) with 6 agents."

**Also supports**:
```bash
oac apply claude          # Generate CLAUDE.md
oac apply windsurf        # Generate .windsurfrules
oac apply --all           # Generate for all detected IDEs
```

**Passing criteria**:
- [ ] `oac apply cursor` generates valid `.cursorrules`
- [ ] `oac apply claude` generates valid `CLAUDE.md`
- [ ] `oac apply windsurf` generates valid `.windsurfrules`
- [ ] `oac apply --all` detects which IDEs are present and generates for each
- [ ] Warns about feature limitations: "Cursor: skills not supported, skipping 3 skills"
- [ ] Warns about size: "Cursor: .cursorrules is 92KB (limit: 100KB) — consider removing agents"
- [ ] `--dry-run` shows what would be generated without writing
- [ ] Existing IDE files are backed up before overwriting (`.cursorrules.bak`)

**Key insight**: The compatibility layer adapters (`packages/compatibility-layer/`) already exist and work. This command is mostly wiring them to the CLI. Don't rewrite them.

---

### Gate 5: `oac doctor` Works (Week 5)

**User runs**: `oac doctor`

**What happens**:
```
OAC Doctor — Checking your setup...

  ✓ OAC version: 1.0.0 (latest)
  ✓ Node.js: v20.11.0 (>= 18 required)
  ✓ Config: .oac/config.json valid
  ✓ Manifest: .oac/manifest.json valid
  ✓ Agents: 8 installed, all files present
  ✓ Context: 15 files installed, all files present
  ✓ Skills: 3 installed, all files present
  ⚠ Modified: 2 files modified since install
    - .opencode/agent/core/openagent.md (modified 2 days ago)
    - .opencode/context/core/standards/code-quality.md (modified 5 hours ago)
  ✓ IDE: OpenCode detected (.opencode/)
  ⚠ IDE: Cursor detected (.cursor/) — run 'oac apply cursor' to sync

  Result: HEALTHY (2 warnings)
```

**Passing criteria**:
- [ ] Checks OAC version against npm registry (non-blocking, skip if offline)
- [ ] Checks Node.js version >= 18
- [ ] Validates `.oac/config.json` and `.oac/manifest.json` exist and are valid JSON
- [ ] Verifies every file in manifest exists on disk
- [ ] Reports which files have been modified (SHA256 mismatch)
- [ ] Detects installed IDEs and suggests `oac apply` if out of sync
- [ ] Exit code 0 if healthy, 1 if errors found
- [ ] `oac doctor --json` outputs machine-readable JSON (for CI)

---

### Gate 6: `oac status` Works (Week 5)

**User runs**: `oac status`

**What happens**:
```
OAC v1.0.0 — ~/my-project

  Agents:   8 installed (2 core, 6 subagents)
  Context:  15 files (12 bundled, 3 custom)
  Skills:   3 installed
  Modified: 2 files have local changes
  Updates:  Available (run 'oac update --check')
  IDE:      OpenCode (active), Cursor (needs sync)

  Run 'oac doctor' for full health check
```

---

## What We Build — Technical Breakdown

### Package: `packages/cli/`

New package. Commander.js CLI. This is the only new package for MVP.

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── init.ts           # oac init
│   │   ├── update.ts         # oac update
│   │   ├── add.ts            # oac add / oac remove
│   │   ├── apply.ts          # oac apply
│   │   ├── doctor.ts         # oac doctor
│   │   ├── list.ts           # oac list
│   │   └── status.ts         # oac status
│   ├── lib/
│   │   ├── manifest.ts       # Read/write .oac/manifest.json
│   │   ├── config.ts         # Read/write .oac/config.json
│   │   ├── bundled.ts        # Locate bundled files in npm package
│   │   ├── sha256.ts         # Compute file hashes
│   │   ├── installer.ts      # Copy files with conflict detection
│   │   ├── registry.ts       # Read registry.json, resolve components
│   │   └── ide-detect.ts     # Detect installed IDEs
│   ├── ui/
│   │   ├── logger.ts         # Colored output (chalk)
│   │   └── spinner.ts        # Progress indication (ora)
│   └── index.ts              # Commander.js entry point
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### Dependencies (minimal)

```json
{
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.0",
    "fs-extra": "^11.2.0",
    "semver": "^7.6.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.5.0"
  }
}
```

No `@inquirer/prompts` (no interactive wizards in MVP).
No `conf` (we write JSON directly).
No `update-notifier` (doctor checks version manually).
No `cli-progress` (ora spinner is enough).
No `diff` (we don't show diffs in MVP, just skip modified files).
No `gray-matter` (we don't parse frontmatter in the CLI).

### What We Reuse (Don't Rewrite)

| Existing Code | How We Use It |
|---------------|---------------|
| `packages/compatibility-layer/` | `oac apply` calls these adapters directly |
| `registry.json` | `oac add` reads this to find components |
| `.opencode/` bundled content | `oac init` copies from here |
| `install.sh` | Keep as legacy fallback, deprecation notice |
| `bin/oac.js` | Rewrite to: `require('../packages/cli/dist/index.js')` |

### What We Do NOT Build in MVP

| Feature | Why Not |
|---------|---------|
| `@nextsystems/oac-core` package | Provider interfaces are for v1.1 extensibility |
| `oac.config.ts` | TypeScript config is a power-user feature |
| `agent.json` + `prompt.md` split | Current `.md` format works fine, migrate later |
| `oac.lock` lockfile | Manifest is enough for single-user, lockfile is for teams |
| Preset system | Users can edit files directly for now |
| TUI browser | `oac list` is enough for discovery |
| Community publishing | No community yet |
| Security scanning | No community components to scan yet |
| OpenCode plugin (session.created) | Auto-update is nice-to-have, `oac update` is enough |
| `oac browse` / `oac search` | `oac list` covers this |
| `oac rollback` | `.oac/backups/` + git is enough |
| `oac customize` / `oac presets` | Edit files directly |
| `oac compat import` (toOAC) | One-way conversion is enough |
| Multi-registry support | One registry is enough |
| `oac publish` | No community yet |
| `oac session` / `oac task` | Task management stays as-is |

---

## The Manifest — Our Source of Truth

The manifest is the simplest possible tracking system. Not a lockfile (no dependency resolution, no version ranges, no history). Just: "what did OAC install, and what was the hash?"

### `.oac/manifest.json`

```json
{
  "version": "1",
  "oacVersion": "1.0.0",
  "installedAt": "2026-02-19T10:00:00Z",
  "updatedAt": "2026-02-19T10:00:00Z",
  "files": {
    ".opencode/agent/core/openagent.md": {
      "sha256": "a1b2c3d4e5f6...",
      "type": "agent",
      "source": "bundled",
      "installedAt": "2026-02-19T10:00:00Z"
    },
    ".opencode/context/core/standards/code-quality.md": {
      "sha256": "f7e8d9c0b1a2...",
      "type": "context",
      "source": "bundled",
      "installedAt": "2026-02-19T10:00:00Z"
    }
  }
}
```

### `.oac/config.json`

```json
{
  "version": "1",
  "preferences": {
    "yoloMode": false,
    "autoBackup": true
  }
}
```

That's it. No IDE config, no provider config, no registry config. Just user preferences.

---

## The Update Algorithm — The Core of the Whole System

This is the most important code in the entire project. Get this right and everything else follows.

```
FOR each file in NEW npm bundle:
  IF file exists in manifest:
    currentHash = SHA256(file on disk)
    manifestHash = manifest.files[file].sha256
    
    IF currentHash == manifestHash:
      → File is UNTOUCHED by user
      → SAFE to update
      → Copy new version, update manifest hash
    ELSE:
      → File was MODIFIED by user
      → SKIP (unless --yolo)
      → If --yolo: backup to .oac/backups/, then overwrite, update manifest
  ELSE:
    → File is NEW in this version
    → Install it, add to manifest

FOR each file in manifest NOT in new bundle:
  → File was REMOVED from OAC
  → Leave user's copy alone
  → Remove from manifest
  → Warn: "file.md is no longer maintained by OAC"
```

This algorithm is simple, predictable, and safe. Users can always understand what happened by reading the output.

---

## Timeline

| Week | What Ships | Gate |
|------|-----------|------|
| **Week 1** | `packages/cli/` skeleton, `bin/oac.js` rewrite, build pipeline, `oac --version` works | — |
| **Week 2** | `oac init` fully working, manifest system, bundled content copying | Gate 1 |
| **Week 3** | `oac update` fully working, SHA256 comparison, skip-if-modified | Gate 2 |
| **Week 4** | `oac add/remove`, `oac list`, registry.json reading | Gate 3 |
| **Week 5** | `oac apply` (wire compatibility layer), `oac doctor`, `oac status` | Gate 4, 5, 6 |
| **Week 6** | Testing, error messages, edge cases, documentation, npm publish prep | All gates pass |

**Total: 6 weeks to a shippable v1.0**

---

## What Comes After MVP (v1.1 Roadmap)

Once MVP ships and we have real users giving feedback:

| Feature | Trigger to Build |
|---------|-----------------|
| `oac.lock` lockfile | When teams ask for reproducible installs |
| `agent.json` + `prompt.md` split | When we need programmatic agent management |
| Provider interfaces (`oac-core`) | When someone wants to swap a subsystem |
| `oac.config.ts` | When enterprise users need custom providers |
| Preset system | When users complain about losing customizations on update |
| TUI browser (`oac browse`) | When we have 50+ components and `oac list` isn't enough |
| Community registry | When we have 1,000+ users and people want to share |
| Security scanning | When community components exist |
| OpenCode plugin (auto-update) | When users forget to run `oac update` |
| `oac rollback` | When users ask for it (git covers most cases) |
| GUI wrapper | When content creators are a real user segment |

**Rule: Don't build it until someone asks for it.**

---

## Non-Negotiable Quality Standards

### Every command must:
- Print what it's about to do BEFORE doing it
- Print what it did AFTER doing it
- Support `--dry-run` to preview without executing
- Support `--yolo` to skip confirmations
- Return exit code 0 on success, non-zero on failure
- Never silently fail — always print errors in plain English
- Never modify a user-edited file without explicit consent

### Error messages must:
- Say what went wrong
- Say why it went wrong (if known)
- Say how to fix it
- Example: "Error: .oac/manifest.json not found. Run 'oac init' to set up your project."

### The CLI must:
- Start in < 100ms (`oac --version` must be instant)
- Use lazy imports (don't load commander commands until needed)
- Work offline (all bundled content, no network required for core operations)
- Work without global install (`npx @nextsystems/oac` must work)

---

## How to Validate the MVP is Right

### User Test 1: Fresh Project Setup
```bash
mkdir my-project && cd my-project && git init
npx @nextsystems/oac init
# Expected: agents + context installed in < 30 seconds
# Expected: user can immediately start coding with AI
```

### User Test 2: Update After Customization
```bash
# User edits an agent file
vim .opencode/agent/core/openagent.md
# OAC updates
oac update
# Expected: edited file is SKIPPED, everything else updates
# Expected: clear message about what was skipped and why
```

### User Test 3: Add Context for a Specific Stack
```bash
oac add context:react-patterns
oac add context:typescript-patterns
oac list --context
# Expected: both files installed, listed correctly
```

### User Test 4: Multi-IDE Setup
```bash
oac apply cursor
oac apply claude
# Expected: .cursorrules and CLAUDE.md generated
# Expected: warnings about unsupported features
```

### User Test 5: Something Goes Wrong
```bash
rm .oac/manifest.json
oac doctor
# Expected: "manifest.json missing — run 'oac init' to repair"
oac init
# Expected: re-initializes without duplicating files
```

---

## Summary

**Build 5 commands. Ship in 6 weeks. Make the content excellent.**

The CLI is a delivery truck for great AI agents and context files. The update system that respects user changes is the killer feature. Everything else can wait until users tell us what they need.

```
oac init     → Get set up
oac update   → Stay current
oac add      → Get what you need
oac apply    → Work in any IDE
oac doctor   → Fix problems
```

That's the MVP. That's the 20% that delivers 80% of the value.
