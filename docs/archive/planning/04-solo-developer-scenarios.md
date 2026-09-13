# Solo Developer Scenarios - OAC User Analysis

**Date**: 2026-02-14  
**Perspective**: Solo developer, personal projects, values speed & simplicity  
**Context**: Based on 01-main-plan.md and 03-critical-feedback.md

---

## Who Am I?

**Profile**: Solo developer coding personal projects, experimenting with new tools

**Values**:
- ⚡ Speed over features
- 🎯 Simplicity over configuration
- 🔧 Quick fixes over perfect setups
- 🚀 Getting started > Reading docs
- 🧪 Experimenting > Committing

**Pain Points with Existing Tools**:
- Complex setup processes
- Too many configuration options
- Breaking on updates
- Unclear error messages
- Can't undo mistakes easily

**What I Want**:
- Install and start coding in < 2 minutes
- Try before I commit
- Easy to customize without breaking
- Updates that don't destroy my setup
- Clear feedback when things go wrong

---

## 1. Daily Workflows

### 1.1 Starting a New Project

#### Scenario: "Quick Weekend Hack"

**Context**: It's Saturday morning. I want to build a quick API using Node.js and Express. I need an agent setup fast.

**Current Reality (Without OAC)**:
```bash
mkdir my-api && cd my-api
npm init -y
# Manually create .cursorrules or .opencode setup
# Copy-paste agent configs from other projects
# Hope I didn't miss anything
# Start coding 15 minutes later
```

**With OAC (Ideal)**:
```bash
mkdir my-api && cd my-api
oac init

# Interactive wizard (< 30 seconds)
? Quick setup or custom?
  > Quick (recommended agents)
    Custom (choose components)

? What are you building?
  > Backend API
    Frontend App
    Full Stack
    Data Project
    Other

? Which IDE?
  > OpenCode
    Cursor
    Both

✓ Installed openagent + coder-agent + tester
✓ Added Node.js context
✓ Ready to code!

# Start coding 2 minutes later
```

**Must-Haves**:
- ✅ One command to start (`oac init`)
- ✅ Smart defaults (no analysis paralysis)
- ✅ Quick setup option (skip customization)
- ✅ Install to local project by default
- ✅ No asking "local or global?" for new projects

**Nice-to-Haves**:
- 💡 Auto-detect project type from package.json
- 💡 Suggest agents based on dependencies
- 💡 Create .gitignore entry for backups

---

### 1.2 Adding/Removing Agents

#### Scenario: "I Need a Specialist"

**Context**: Building a React app. Need help with component patterns. Want to add a frontend specialist agent.

**Frustrations**:
- Don't know what agents exist
- Don't want to read docs
- Just want "the React guy"

**Ideal Experience**:
```bash
# Quick search
oac search react

📦 Found 5 agents matching "react":

1. frontend-specialist ⭐ 4.8 (2.3k downloads) ✓ Verified
   Expert in React, Vue, Angular
   
2. react-native-specialist ⭐ 4.5 (1.1k downloads)
   React Native mobile development
   
3. testing-specialist ⭐ 4.9 (3.2k downloads) ✓ Verified
   Jest, React Testing Library, Cypress

? Add which agent?
  > frontend-specialist
    Preview first
    Show details
    Cancel

# Or just add directly if I know the name
oac add frontend-specialist

✓ Downloaded frontend-specialist v1.2.0
✓ Installed to .opencode/agent/
✓ Ready to use!

💡 Try: Ask your IDE about "React component patterns"
```

**Removing is Just as Easy**:
```bash
oac remove frontend-specialist

⚠ This will remove:
  - .opencode/agent/frontend-specialist.md
  - Related context files (2)

? Are you sure? (y/N) y

✓ Removed frontend-specialist
✓ Cleaned up 2 context files
```

**Must-Haves**:
- ✅ Easy discovery (`oac search`)
- ✅ One-command install (`oac add`)
- ✅ Show ratings/downloads (trust signal)
- ✅ Quick preview before installing
- ✅ Clean removal with dependency cleanup

**Deal-Breakers**:
- ❌ Having to visit a website to browse
- ❌ Complex dependency resolution
- ❌ No way to undo
- ❌ Cryptic error messages

---

### 1.3 Customizing Agents for Personal Style

#### Scenario: "Make It Mine"

**Context**: The openagent is good but too formal. I want a more casual tone. I also want it to skip certain checks I don't care about.

**Frustrations**:
- Afraid to edit files directly
- Updates will overwrite my changes
- Don't know what's safe to change

**Ideal Experience**:
```bash
# View agent first
oac show openagent

# Opens in pager/less
---
name: openagent
version: 0.7.1
[full agent prompt]
---

# Decide to customize
oac customize openagent

? What would you like to do?
  > Create personal preset (safe)
    Edit in place (will be overwritten on update)
    Fork to new agent

? Preset name: my-agent

✓ Created preset: my-agent
✓ Based on: openagent v0.7.1
✓ Location: ~/.config/oac/presets/agents/my-agent.md

? Open in editor? (Y/n) y

[Opens in $EDITOR]
# Edit tone, remove checks, etc.
# Save and close

✓ Preset saved!

# Use my preset instead of base
oac use my-agent

✓ Activated preset: my-agent
✓ Will use instead of openagent
```

**When Base Agent Updates**:
```bash
oac update

📦 Updates available:
  openagent: 0.7.1 → 0.8.0

⚠ You have preset "my-agent" based on openagent

? How to update?
  > Show me what changed first
    Update base, keep my customizations (safe)
    Merge my changes with new version
    Skip this update

# I choose "Show me what changed first"
oac diff openagent 0.7.1 0.8.0

[Shows diff]
- Added new delegation patterns
- Fixed approval gate bug
- Improved error messages

? Update now and keep my customizations? (Y/n) y

✓ Updated base agent: 0.8.0
✓ Your preset untouched
✓ Backup saved: ~/.config/oac/presets/.backups/
```

**Must-Haves**:
- ✅ Safe customization (presets, not in-place editing)
- ✅ Updates don't destroy customizations
- ✅ Easy to preview changes before updating
- ✅ Simple merge strategy (keep mine vs take theirs)
- ✅ Automatic backups

**Deal-Breakers**:
- ❌ Updates overwrite my changes without warning
- ❌ No way to see what changed
- ❌ Complex merge conflicts
- ❌ Lost work due to updates

---

### 1.4 Updating Components

#### Scenario: "Keep Things Fresh"

**Context**: Haven't updated in 2 months. Want to get latest agent improvements without breaking my setup.

**Ideal Experience**:
```bash
oac update --check

📦 3 updates available:

1. openagent: 0.7.1 → 0.8.0
   - Added delegation patterns
   - Fixed bugs
   ✓ Safe to update

2. frontend-specialist: 1.2.0 → 2.0.0 ⚠ BREAKING
   - New React 19 patterns
   - Removed old API
   ⚠ Breaking changes - review first

3. context:code-quality: 1.0.0 → 1.1.0
   - Added new rules
   ✓ Safe to update

? Update which?
  > All safe updates (openagent, code-quality)
    Review breaking changes first
    Update one by one
    Skip for now

# Choose "All safe updates"
oac update --safe

⚡ Updating 2 components...
✓ openagent: 0.7.1 → 0.8.0
✓ context:code-quality: 1.0.0 → 1.1.0

⚠ Skipped breaking update: frontend-specialist

📊 Summary:
  - 2 updated
  - 1 skipped (breaking)
  - Backups in .opencode/.backups/

💡 Review breaking changes: oac diff frontend-specialist
```

**Must-Haves**:
- ✅ Check for updates without installing
- ✅ Show what changed (changelog)
- ✅ Warn about breaking changes
- ✅ Selective updates (choose which to update)
- ✅ Automatic rollback if something breaks

**Deal-Breakers**:
- ❌ All-or-nothing updates
- ❌ Breaking changes without warning
- ❌ No rollback option
- ❌ Unclear what changed

---

### 1.5 Switching Between Projects

#### Scenario: "Context Switching"

**Context**: I have 5 projects. Each needs different agents. I switch between them multiple times per day.

**Frustrations**:
- Setting up each project from scratch
- Remembering which project has which agents
- Keeping configs in sync across similar projects

**Ideal Experience**:

**Option A: Project-Specific Setups (Default)**
```bash
# Each project has its own setup
cd ~/projects/api-project
oac list
  ✓ openagent
  ✓ coder-agent
  ✓ tester

cd ~/projects/frontend-project
oac list
  ✓ openagent
  ✓ frontend-specialist
  ✓ tester
```

**Option B: Global Agents + Project Overrides**
```bash
# Set up common agents globally
oac install --global
  ✓ openagent (global)
  ✓ tester (global)

# Add project-specific agents locally
cd ~/projects/frontend-project
oac add frontend-specialist
  ✓ frontend-specialist (local)

# Agent resolution:
# 1. Check local (.opencode/agent/)
# 2. Fall back to global (~/.config/oac/)
```

**Option C: Saved Profiles**
```bash
# Save current setup as profile
cd ~/projects/frontend-project
oac profile save frontend-stack

✓ Saved profile: frontend-stack
  - openagent
  - frontend-specialist
  - tester
  - react-context

# Use profile in new project
cd ~/projects/new-frontend
oac install --profile frontend-stack

✓ Installed frontend-stack profile
  - 3 agents
  - 1 context file
```

**Must-Haves**:
- ✅ Project-specific setups (isolation)
- ✅ Global defaults for common agents
- ✅ Save/load profiles
- ✅ Quick switching (no re-setup)
- ✅ Share profiles across machines (dotfiles)

**Nice-to-Haves**:
- 💡 Detect similar projects, suggest same setup
- 💡 Sync profiles via GitHub Gist
- 💡 Team profiles (share with collaborators)

---

## 2. Key Experiences

### 2.1 First-Time Setup (Onboarding)

#### Scenario: "I Just Heard About OAC"

**Context**: Friend recommended OAC. I want to try it. I know nothing about it.

**Ideal First Experience**:

```bash
npm install -g @nextsystems/oac

# First command
oac

┌─────────────────────────────────────────────────┐
│  Welcome to OpenAgents Control! 👋              │
│  Let's set up your AI agent environment.        │
└─────────────────────────────────────────────────┘

It looks like this is your first time using OAC.
Let's get you started quickly!

? What do you want to do?
  > Quick setup (2 minutes)
    Learn more first
    See examples

# Choose "Quick setup"

Great! A few quick questions:

? What's your primary use case?
  > Software Development
    Content Creation
    Data Analysis
    Just Exploring

? Which IDE(s) do you use?
  ✓ OpenCode
  ✓ Cursor
  ☐ Claude Code
  ☐ Windsurf

? Where to install agents by default?
  > Auto-detect (smart default)
    Always ask
    Always local (project-specific)
    Always global (all projects)

✓ Configuration saved!

Now let's set up your first project:

? Create new project or use existing?
  > Use existing (I'm in a project)
    Create new
    Skip for now

# Detects I'm in a Node.js project
✓ Detected: Node.js project

? Install recommended agents for Node.js?
  - openagent (core AI agent)
  - coder-agent (coding specialist)
  - tester (testing expert)
  (Y/n) y

⚡ Installing...
✓ openagent
✓ coder-agent  
✓ tester

✅ All set! Your project is ready.

🎯 Next steps:
  1. Open your IDE (OpenCode/Cursor)
  2. Start chatting with your agent
  3. Explore more: oac browse

💡 Tips:
  - Add more agents: oac add <agent>
  - Customize behavior: oac customize openagent
  - Get help: oac help

Happy coding! 🚀
```

**Must-Haves**:
- ✅ Friendly welcome message
- ✅ Quick setup path (< 2 minutes)
- ✅ Auto-detect project type
- ✅ Install immediately (no empty state)
- ✅ Clear next steps
- ✅ No overwhelming configuration

**Deal-Breakers**:
- ❌ Dumping to docs immediately
- ❌ Empty state after install ("now what?")
- ❌ Complex configuration wizard
- ❌ Technical jargon
- ❌ No examples or guidance

---

### 2.2 Discovering New Agents

#### Scenario: "What Else Can I Add?"

**Context**: Been using OAC for a week. Basic setup works. Want to explore what else is available.

**Ideal Experience**:

```bash
oac browse

┌─────────────────────────────────────────────────┐
│  OAC Component Browser                          │
│  ↑↓: Navigate  Enter: Details  /: Search       │
└─────────────────────────────────────────────────┘

📦 Popular Agents                    [Agents | Skills | Contexts]

  ✓ openagent                        ⭐ 4.9  (15.2k) ✓ Official
  ✓ coder-agent                      ⭐ 4.8  (12.1k) ✓ Official
  ✓ tester                           ⭐ 4.9  (11.8k) ✓ Official
  
  frontend-specialist                ⭐ 4.7  (8.3k)  ✓ Verified
  React, Vue, Angular expert
  
  rust-specialist                    ⭐ 4.6  (3.2k)
  Rust programming expert
  
  data-analyst                       ⭐ 4.5  (2.1k)
  Python, Pandas, data analysis
  
  devops-specialist                  ⭐ 4.8  (5.4k)  ✓ Verified
  Docker, K8s, CI/CD expert

[Tab: Trending] [Tab: New] [Tab: Verified]

# Press Enter on "frontend-specialist"

┌─────────────────────────────────────────────────┐
│  frontend-specialist v1.2.0                     │
└─────────────────────────────────────────────────┘

Expert in modern frontend development
React, Vue, Angular, TypeScript, CSS

📊 Stats:
  Downloads: 8,357
  Rating: ⭐ 4.7/5 (142 reviews)
  Updated: 5 days ago
  
👤 Author: @frontend-guru (verified)

📝 Description:
  Specialized agent for frontend development with
  deep knowledge of React patterns, Vue composition
  API, Angular best practices, and modern CSS.

🔧 Includes:
  - Component architecture guidance
  - State management patterns
  - Performance optimization
  - Accessibility best practices

💬 Reviews:
  "Best React agent I've used!" - @developer123
  "Knows Vue 3 composition API inside out" - @vue-fan

? What would you like to do?
  > Install
    Preview (try without installing)
    View source
    Read reviews
    Back
```

**Must-Haves**:
- ✅ Interactive TUI browser (not CLI list)
- ✅ Visual ratings and download counts
- ✅ Verified/official badges
- ✅ Quick preview before installing
- ✅ Search and filter
- ✅ Trending/popular sections

**Nice-to-Haves**:
- 💡 Recommendations based on current project
- 💡 "People also installed..." suggestions
- 💡 Category browsing (frontend, backend, data, etc.)
- 💡 Screenshots/examples of agent output

---

### 2.3 Trying Agents Before Committing

#### Scenario: "Test Drive"

**Context**: Found an interesting agent. Not sure if it's what I need. Don't want to pollute my project.

**Ideal Experience**:

```bash
oac try frontend-specialist

⚡ Starting preview mode...

📦 Downloading frontend-specialist v1.2.0 (temporary)
✓ Installed to temporary location
✓ Configured for preview (read-only)

🎯 Preview Mode Active
  - Agent will work in your IDE
  - No changes to your project
  - Expires in 1 hour or on exit

💡 Try asking about:
  - "Create a React component with hooks"
  - "Review this component for best practices"
  - "Optimize this component performance"

? When you're done:
  - Install permanently: oac add frontend-specialist
  - Remove preview: oac try --stop
  - Preview expires automatically in 1 hour

[Chat with agent in IDE for a while]

# If I like it
oac add frontend-specialist --from-preview

✓ Converted preview to permanent install
✓ Installed to .opencode/agent/
```

**Alternative: Sandbox Mode**:
```bash
oac sandbox

⚡ Starting sandbox environment...

✓ Created temporary project
✓ Installed recommended agents
✓ Configured IDE

🎯 Sandbox Active
  Location: /tmp/oac-sandbox-abc123
  All changes are isolated
  
💡 Experiment freely:
  - Try different agents
  - Test configurations
  - Break things without worry

? When done:
  - Export setup: oac sandbox export
  - Apply to real project: oac sandbox apply
  - Delete sandbox: oac sandbox clean
```

**Must-Haves**:
- ✅ Try before install
- ✅ Temporary/preview mode
- ✅ Easy conversion to permanent
- ✅ No pollution of real project
- ✅ Time-limited preview

**Deal-Breakers**:
- ❌ Must install to try
- ❌ No way to remove cleanly
- ❌ Preview leaves artifacts
- ❌ Can't convert preview to permanent easily

---

### 2.4 Customizing Without Breaking Things

#### Scenario: "Tweak Without Fear"

**Context**: Want to adjust agent behavior but afraid of breaking my setup.

**Ideal Experience**:

**Safe Customization Flow**:
```bash
# Step 1: Create safe copy
oac customize openagent --interactive

? What would you like to customize?
  ✓ Tone and style (casual vs formal)
  ✓ Tool permissions (auto-approve vs ask)
  ✓ Delegation behavior
  ☐ Context loading
  
# Interactive wizard
? Agent tone:
  > Professional (current)
    Casual
    Concise
    Verbose

? Tool permissions:
  Bash commands:
    > Always ask (current)
      Auto-approve read-only
      YOLO mode
      
  File writes:
    > Always ask (current)
      Auto-approve
      
? Delegation:
  Delegate to specialists when:
    > Task spans 4+ files (current)
      Task spans 3+ files
      Always ask first
      Never delegate

✓ Created preset: my-openagent
✓ Applied customizations
✓ Original unchanged (safe!)

# Test my changes
[Use agent in IDE]

# If something breaks
oac use openagent  # Switch back to base

# If I like my changes
oac use my-openagent  # Keep using custom
```

**Validation Before Applying**:
```bash
oac validate

⚡ Validating configuration...

✓ All agents valid
✓ All contexts found
✓ No circular dependencies
✓ IDE compatibility OK

📊 Configuration health: 100%
```

**Must-Haves**:
- ✅ Interactive customization wizard
- ✅ Validation before applying
- ✅ Easy rollback to base
- ✅ Test changes safely
- ✅ Clear indication of what's custom

**Deal-Breakers**:
- ❌ Manual YAML/JSON editing required
- ❌ No validation (breaks on load)
- ❌ Can't rollback easily
- ❌ One mistake breaks everything

---

### 2.5 Recovering from Mistakes

#### Scenario: "I Broke It, Fix It Fast"

**Context**: Edited something. Now agents don't load. IDE throws errors. I need to fix it NOW.

**Current Reality**:
```bash
# Agent broken, IDE errors
# Panic! 😱
# Delete .opencode folder
# Start over from scratch
# Lost all customizations
# Waste 30 minutes
```

**Ideal Experience**:

```bash
# Agent broken, IDE shows errors
oac doctor

🔍 Running diagnostics...

❌ Problems found:

1. CRITICAL: openagent.md - Syntax error (line 45)
   Invalid YAML frontmatter
   
2. WARNING: frontend-specialist - Missing dependency
   Requires context:react-patterns (not installed)
   
3. INFO: .opencode/config.json - Using old format
   Consider updating: oac migrate

? Fix automatically? (Y/n) y

⚡ Fixing issues...
✓ Restored openagent.md from backup
✓ Installed missing dependency: react-patterns
✓ Migrated config.json to new format

✅ All issues fixed!

📊 Status: Healthy
  - 3 agents loaded
  - 0 errors
  - 1 warning (non-critical)

💡 Test in IDE now
```

**Nuclear Option**:
```bash
oac reset

⚠ This will:
  - Remove all agents
  - Remove all customizations
  - Reset to default config
  - Backups will be saved

? Are you SURE? Type 'reset' to confirm: reset

⚡ Resetting OAC...
✓ Backed up to .opencode/.backups/reset-2026-02-14/
✓ Removed all agents
✓ Reset configuration
✓ Installed default agents

✅ Reset complete!

? Restore from backup?
  > No, start fresh
    Yes, restore specific agents
```

**Rollback Last Operation**:
```bash
oac rollback

📊 Last 5 operations:

1. Update: openagent (0.7.1 → 0.8.0) - 2 min ago
2. Add: frontend-specialist - 1 hour ago
3. Remove: data-analyst - 1 day ago
4. Customize: openagent → my-openagent - 2 days ago
5. Install: tester - 3 days ago

? Rollback which? (1-5) 1

⚡ Rolling back update...
✓ Restored openagent 0.7.1 from backup
✓ Removed openagent 0.8.0

✅ Rollback complete!
```

**Must-Haves**:
- ✅ Automatic diagnostics (`oac doctor`)
- ✅ Auto-fix common issues
- ✅ Rollback last operation
- ✅ Full reset option (nuclear)
- ✅ Automatic backups before changes

**Deal-Breakers**:
- ❌ No diagnostic tools
- ❌ Can't rollback
- ❌ Must start over from scratch
- ❌ Lose all customizations

---

## 3. Pain Points & Solutions

### 3.1 What Could Go Wrong?

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **Update breaks my setup** | 🔴 High | Auto-backup, rollback, validation |
| **Agent conflicts** | 🟡 Medium | Dependency checking, compatibility warnings |
| **Slow discovery** | 🟡 Medium | Fast TUI browser, caching, search |
| **Unclear errors** | 🟠 High | Better error messages, `oac doctor` |
| **Lost customizations** | 🔴 Critical | Presets, separate from base agents |
| **Can't undo changes** | 🟠 High | Rollback, backups, dry-run mode |
| **IDE not detected** | 🟡 Medium | Manual IDE selection, clear errors |
| **Large download times** | 🟢 Low | Progress bars, caching, compression |
| **Version conflicts** | 🟠 High | Lockfile, semver, conflict detection |
| **Offline work** | 🟢 Low | Local cache, offline mode |

---

### 3.2 What Would Be Frustrating?

**Frustration Level: 🔴 RAGE QUIT**

1. **Updates overwrite my customizations**
   - I spent time customizing
   - Update destroys my work
   - No warning, no backup
   - → Solution: Presets, auto-backup, merge prompts

2. **Can't figure out what's installed**
   - Which agents do I have?
   - What versions?
   - Where are they from?
   - → Solution: `oac list --detailed`, clear status

3. **Breaking changes with no warning**
   - Update looks minor
   - Breaks my workflow
   - No changelog visible
   - → Solution: BREAKING badge, show changes before update

4. **No way to undo mistakes**
   - Deleted wrong agent
   - Updated and broke things
   - Can't go back
   - → Solution: `oac rollback`, automatic backups

**Frustration Level: 🟡 ANNOYING**

5. **Asked "local or global?" every time**
   - Decision fatigue
   - Just pick for me!
   - → Solution: Auto-detection, remember preference

6. **Slow browsing**
   - List takes 10 seconds to load
   - Search is sluggish
   - → Solution: Caching, local registry mirror

7. **Cryptic error messages**
   - "Error: ENOENT"
   - What does that mean?
   - → Solution: Human-readable errors + fix suggestions

8. **Too many confirmation prompts**
   - Confirm install
   - Confirm overwrite
   - Confirm apply
   - → Solution: `--yolo` mode, smart batching

**Frustration Level: 🟢 MINOR ANNOYANCE**

9. **No IDE integration**
   - Have to leave IDE to run commands
   - → Solution: Nice-to-have, not critical

10. **Can't share my setup easily**
    - Want to sync across machines
    - → Solution: Export/import config, profiles

---

### 3.3 What Would Make Me Abandon the Tool?

**Deal-Breakers (Instant Uninstall)**:

1. **Breaks my existing setup on install**
   - Overwrites files without asking
   - Destroys my custom agents
   - No backup

2. **Locks me into OAC**
   - Can't use agents without OAC
   - Can't export/move agents
   - Vendor lock-in

3. **Requires cloud/account**
   - Must create account to use
   - Must be online
   - Sends telemetry without opt-in

4. **Too complex to use**
   - Need to read 20 pages of docs
   - Too many configuration options
   - Can't figure out basic tasks

5. **Updates break things constantly**
   - Every update breaks setup
   - No stability
   - Can't trust updates

6. **Poor performance**
   - Commands take >5 seconds
   - IDE lags with agents loaded
   - Massive file sizes

7. **No clear value**
   - Doesn't improve my workflow
   - Just adds complexity
   - Easier to manage manually

---

### 3.4 How Should OAC Handle These?

**Principles**:

1. **Safety First**
   - Always backup before changes
   - Easy rollback
   - Dry-run mode for risky operations
   - Clear warnings

2. **Speed Matters**
   - Fast commands (< 1 second for most)
   - Async operations with progress
   - Caching aggressively
   - Lazy loading

3. **Clear Communication**
   - Human-readable errors
   - Actionable fix suggestions
   - Progress indicators
   - Success confirmations

4. **Smart Defaults**
   - Auto-detect when possible
   - Remember user preferences
   - Sensible defaults
   - Easy to override

5. **Escape Hatches**
   - Can opt out of any feature
   - Can manage manually if needed
   - Export anytime
   - No lock-in

---

## 4. Edge Cases

### 4.1 Multiple Projects with Different Setups

**Scenario**: 
- Project A: React (frontend-specialist)
- Project B: Node API (backend-specialist)
- Project C: Data analysis (data-analyst)
- Project D: Rust (rust-specialist)
- Project E: Personal website (basic setup)

**Problems**:
- Each project needs different agents
- Some agents overlap (openagent, tester)
- Don't want to reinstall for each project
- Want consistency where possible

**Solution: Layered Setup**

```
Global (~/.config/oac/):
  ✓ openagent (all projects)
  ✓ tester (all projects)
  ✓ Basic contexts

Project A (~/projects/react-app/):
  ✓ frontend-specialist (local)
  ✓ react-contexts (local)
  → Uses global openagent + local frontend

Project B (~/projects/api/):
  ✓ backend-specialist (local)
  ✓ node-contexts (local)
  → Uses global openagent + local backend

Project C (~/projects/data/):
  ✓ data-analyst (local)
  ✓ python-contexts (local)
  → Uses global openagent + local data

Project D (~/projects/rust/):
  ✓ rust-specialist (local)
  ✓ rust-contexts (local)
  → Uses global openagent + local rust

Project E (~/personal-site/):
  → Uses only global agents (minimal)
```

**Commands**:
```bash
# Set up global once
oac install --global
  ✓ openagent
  ✓ tester

# Add project-specific agents
cd ~/projects/react-app
oac add frontend-specialist
  ✓ Installed locally
  ✓ Will merge with global agents

# Check what's active
oac list --all
  Global:
    ✓ openagent
    ✓ tester
  Local:
    ✓ frontend-specialist
  Active: 3 agents (2 global + 1 local)
```

**Must-Haves**:
- ✅ Global + local layering
- ✅ Clear indication of source (global vs local)
- ✅ No duplicate installs
- ✅ Easy to see what's active

---

### 4.2 Experimenting with Beta/Unstable Agents

**Scenario**: Want to try new agent that's marked beta. Might be buggy. Don't want to risk my main setup.

**Solution: Channels + Isolation**

```bash
# Install from beta channel
oac add rust-specialist@beta

⚠ Beta Channel Warning
  
  Package: rust-specialist v2.0.0-beta.1
  Status: Beta (unstable)
  
  This is a pre-release version and may be unstable.
  
? Install anyway? (y/N) y
? Where?
  > Sandbox (isolated, temporary)
    Local (current project)
    Global (all projects)

# Choose sandbox
✓ Created sandbox: /tmp/oac-sandbox-rust-abc123
✓ Installed rust-specialist@beta
✓ Configured for testing

🎯 Sandbox active
  Test in IDE, then:
  - Keep: oac sandbox keep
  - Discard: oac sandbox clean

# Test agent in IDE
[Works well!]

# Keep it
oac sandbox keep

? Apply to:
  > Current project (local)
    All projects (global)
    Save as preset

✓ Applied to current project
✓ Installed rust-specialist v2.0.0-beta.1
```

**Update Channels**:
```bash
# Configure update channel
oac configure set updateChannel beta

? Update channel:
  > stable (recommended)
    beta (pre-releases)
    nightly (cutting edge)

# Only get beta updates
oac update --check
  rust-specialist: 2.0.0-beta.1 → 2.0.0-beta.2 (beta)
  
# Switch back to stable
oac configure set updateChannel stable
```

**Must-Haves**:
- ✅ Beta/channel support
- ✅ Isolation for risky installs
- ✅ Clear warnings
- ✅ Easy rollback

---

### 4.3 Working Offline

**Scenario**: On a plane, no internet. Want to add an agent I previously downloaded.

**Solution: Local Cache**

```bash
# OAC caches all downloaded components
~/.config/oac/cache/
  agents/
    openagent-0.7.1.md
    frontend-specialist-1.2.0.md
    rust-specialist-1.0.0.md
  registry.json (last sync)

# Offline: Install from cache
oac add frontend-specialist

⚠ Offline Mode
  Using cached version: frontend-specialist v1.2.0
  Last updated: 2 days ago
  
? Install cached version? (Y/n) y

✓ Installed from cache
⚠ Run 'oac update' when online to check for updates
```

**Must-Haves**:
- ✅ Local cache of downloads
- ✅ Offline mode (automatic)
- ✅ Clear indication of cache age
- ✅ Update reminder when back online

**Nice-to-Haves**:
- 💡 Pre-download for offline use
- 💡 Sync cache across machines
- 💡 Pack/unpack offline bundles

---

### 4.4 Low Disk Space

**Scenario**: Laptop has limited space. OAC + agents taking too much room.

**Solution: Size Management**

```bash
# Check disk usage
oac disk

📊 OAC Disk Usage

Components:
  Agents:     45 MB (12 agents)
  Skills:     18 MB (5 skills)
  Contexts:   12 MB (22 contexts)
  Backups:    120 MB (45 backups) ⚠
  Cache:      230 MB (cached downloads) ⚠
  
Total: 425 MB

Recommendations:
  ⚠ Clear old backups (save 100 MB)
  ⚠ Clear cache (save 200 MB)
  ☐ Remove unused agents

? Clean up now? (Y/n) y

? What to clean?
  ✓ Backups older than 30 days
  ✓ Cache (keep last 7 days)
  ☐ Unused agents (interactive)

⚡ Cleaning...
✓ Removed 42 old backups (saved 100 MB)
✓ Cleared old cache (saved 180 MB)

📊 New total: 145 MB (saved 280 MB)
```

**Automatic Cleanup**:
```bash
# Configure automatic cleanup
oac configure set cleanup.auto true
oac configure set cleanup.maxBackups 10
oac configure set cleanup.cacheDays 7

✓ Auto-cleanup enabled
  - Max 10 backups per component
  - Cache entries older than 7 days auto-deleted
```

**Must-Haves**:
- ✅ Disk usage report
- ✅ Clean old backups
- ✅ Clear cache
- ✅ Remove unused components
- ✅ Automatic cleanup

---

### 4.5 Conflicting Agent Versions

**Scenario**: Two agents require different versions of the same dependency.

**Example**:
```
frontend-specialist v1.2.0
  requires: context:react-patterns ^2.0.0

legacy-react-agent v1.0.0
  requires: context:react-patterns ^1.0.0
```

**Solution: Conflict Detection + Resolution**

```bash
oac add legacy-react-agent

⚠ Version Conflict Detected

Agent: legacy-react-agent v1.0.0
  requires: context:react-patterns ^1.0.0

Currently installed:
  context:react-patterns v2.1.0
  (required by frontend-specialist)

? How to resolve?
  > Skip (don't install legacy-react-agent)
    Install both versions (side-by-side)
    Update legacy-react-agent to use v2
    Downgrade context:react-patterns to v1 (⚠ may break frontend-specialist)

# Choose "Skip"
⚠ Installation cancelled
  
💡 Alternatives:
  - Check for updated legacy-react-agent that supports v2
  - Contact author about compatibility
  - Use in separate project (isolation)
```

**If Side-by-Side Supported**:
```bash
# Install both versions
oac add legacy-react-agent --allow-conflicts

⚡ Installing with side-by-side dependencies...

✓ Installed context:react-patterns@1.0.0 (for legacy-react-agent)
✓ Installed context:react-patterns@2.1.0 (for frontend-specialist)
✓ Installed legacy-react-agent

⚠ Warning: 2 versions of react-patterns installed
  - Disk usage: +5 MB
  - May cause confusion

📊 Dependency tree:
  frontend-specialist → react-patterns@2.1.0
  legacy-react-agent  → react-patterns@1.0.0
```

**Must-Haves**:
- ✅ Conflict detection before install
- ✅ Clear explanation of conflict
- ✅ Resolution options
- ✅ Dependency tree visualization

**Deal-Breakers**:
- ❌ Silent failures
- ❌ Breaking existing agents
- ❌ Cryptic "dependency error" messages

---

## 5. Must-Have Features

### 5.1 Non-Negotiable Features

**These would make me NOT use OAC if missing**:

1. **Fast installation (< 2 minutes from zero)**
   - One command: `oac init`
   - Smart defaults
   - No required configuration

2. **Easy discovery**
   - Browse available agents
   - Search functionality
   - Ratings/reviews visible

3. **Safe customization**
   - Edit without breaking
   - Rollback on mistakes
   - Updates preserve customizations

4. **No lock-in**
   - Works without OAC after install
   - Can export/move agents
   - Plain markdown files

5. **Works offline**
   - Local cache
   - No required cloud
   - No telemetry (opt-in only)

6. **Clear errors & fixes**
   - Human-readable errors
   - Suggested fixes
   - Auto-repair (`oac doctor`)

7. **Automatic backups**
   - Before every change
   - Easy rollback
   - Configurable retention

8. **Preview before install**
   - Try agents temporarily
   - See what you're getting
   - No commitment

---

### 5.2 Features That Would Make Life Easier

**These would be great additions**:

1. **IDE integration**
   - Run oac commands from IDE
   - Visual component browser
   - Status in IDE status bar

2. **Team collaboration**
   - Share profiles
   - Lock dependencies (lockfile)
   - Team registry

3. **Automatic updates**
   - Check on startup
   - Auto-update (opt-in)
   - Update notifications

4. **Context-aware suggestions**
   - "You might like..."
   - Based on current project
   - Based on other users

5. **Profiles/presets**
   - Save current setup
   - Quick switching
   - Share with others

6. **Performance monitoring**
   - Agent response time
   - IDE performance impact
   - Size optimization

7. **Smart defaults everywhere**
   - Auto-detect project type
   - Suggest agents
   - Remember preferences

8. **Visual feedback**
   - Progress bars
   - Spinners
   - Color-coded output
   - Success animations

---

### 5.3 Features That Would Delight Me

**These would make me love OAC**:

1. **AI-powered setup**
   - "Analyze my project, set up agents"
   - Intelligent recommendations
   - Automatic optimization

2. **One-click sharing**
   - Share my setup via URL
   - Teammate clicks, gets same setup
   - Version-locked for reproducibility

3. **Visual agent builder**
   - Drag-drop prompt sections
   - Visual permission config
   - Preview in real-time

4. **Community showcase**
   - See what others built
   - Clone their setups
   - Rate and review

5. **Automatic documentation**
   - Generate docs from agents
   - Explain what each does
   - Show examples

6. **Integration marketplace**
   - Connect to GitHub
   - Connect to Linear
   - Connect to Slack
   - Automated workflows

7. **Agent analytics**
   - Which agents I use most
   - Success rate
   - Time saved

8. **Mobile companion app**
   - Browse agents on phone
   - Sync setups
   - Get notifications

---

## 6. Example Scenarios (Detailed Walkthroughs)

### Scenario 1: "Weekend Hackathon - Quick React App"

**Context**: Saturday morning, 9 AM. Want to build a quick React dashboard for fun. Need to set up fast and start coding.

**Timeline: 0-10 minutes**

```bash
# 9:00 AM - Start
mkdir react-dashboard && cd react-dashboard
npm create vite@latest . -- --template react-ts

# 9:02 AM - Set up OAC
oac init

┌─────────────────────────────────────────────────┐
│  Welcome to OAC! 👋                             │
└─────────────────────────────────────────────────┘

✓ Detected: React + TypeScript project

? Install recommended agents?
  - openagent (core)
  - frontend-specialist (React expert)
  - tester (testing)
  (Y/n) y

⚡ Installing...
✓ openagent
✓ frontend-specialist
✓ tester
✓ context:react-patterns
✓ context:typescript-best-practices

✅ Ready! Open in OpenCode and start coding.

# 9:04 AM - Start coding
code .

# In IDE, start chatting
"Help me build a dashboard with charts and tables"

[Agent suggests component structure, provides code examples]

# 9:10 AM - Coding at full speed
# Agent helps with:
# - Component architecture
# - State management
# - TypeScript types
# - Testing setup
```

**Total setup time**: 4 minutes  
**Key success factors**:
- Auto-detected React project
- Suggested relevant agents
- One-click install
- Immediate productivity

---

### Scenario 2: "Learning Rust - Beta Agent Testing"

**Context**: Want to learn Rust. Heard there's a new beta Rust agent. Want to try it safely.

```bash
# See what's available
oac search rust

📦 Found 3 agents matching "rust":

1. rust-specialist v1.0.0         ⭐ 4.6 (3.2k) 
   Rust programming expert
   
2. rust-specialist v2.0.0-beta.3  🔬 BETA
   New version with improved error handling
   
3. rust-embedded v1.1.0          ⭐ 4.4 (891)
   Embedded Rust specialist

? Try which?
  > rust-specialist v2.0.0-beta.3 (preview)
    rust-specialist v1.0.0 (stable)
    Show more details

# Choose beta preview
oac try rust-specialist@beta

⚠ Beta Software
  Version: v2.0.0-beta.3
  Status: Pre-release
  
? Preview in sandbox? (Y/n) y

⚡ Creating sandbox...
✓ Temporary project: /tmp/oac-sandbox-rust-xyz
✓ Installed rust-specialist@beta
✓ Configured IDE

🎯 Sandbox ready!
  Location: /tmp/oac-sandbox-rust-xyz
  Open in IDE: code /tmp/oac-sandbox-rust-xyz
  
  Try asking:
  - "Create a basic HTTP server"
  - "Explain ownership in Rust"
  - "Help me fix this borrow checker error"

# Test in sandbox
[Works great! Love the new error explanations]

# Keep it
oac sandbox apply

? Apply to:
  > Current project (local)
    All projects (global)
    Create new project

? Channel:
  > Beta (get beta updates)
    Stable (wait for stable release)

✓ Applied rust-specialist v2.0.0-beta.3 to current project
✓ Configured for beta updates
✓ Cleaned up sandbox

💡 Tip: Report issues at github.com/author/rust-specialist
```

**Key success factors**:
- Easy to find beta versions
- Safe preview (sandbox)
- No risk to main setup
- Easy to adopt if good

---

### Scenario 3: "Team Onboarding - Consistent Setup"

**Context**: Working solo, but collaborating with a friend on a project. Want them to have the same agent setup.

```bash
# My setup
cd ~/projects/shared-project

oac list --detailed
  ✓ openagent v0.7.1
  ✓ frontend-specialist v1.2.0
  ✓ tester v2.3.0
  ✓ context:react-patterns v2.1.0

# Export my setup
oac profile save team-setup

✓ Saved profile: team-setup

? Share with team?
  > Export to file
    Generate shareable link
    Commit to repo

# Choose "Commit to repo"
oac profile export team-setup --git

✓ Created .oac/team-setup.profile.json
✓ Created .oac/oac.lock (lockfile)

? Commit to git? (Y/n) y

⚡ Committing...
✓ git add .oac/
✓ git commit -m "Add OAC team setup"
✓ git push

📨 Send to teammate:
  1. Clone repo
  2. Run: oac install --profile team-setup
  3. Done!
```

**Teammate's experience**:
```bash
# Clone repo
git clone <repo> && cd <repo>

# See OAC setup
cat .oac/team-setup.profile.json

# Install exact same setup
oac install --profile team-setup --frozen

📦 Installing team setup (locked versions)
  Using lockfile: .oac/oac.lock
  
⚡ Installing...
✓ openagent v0.7.1
✓ frontend-specialist v1.2.0
✓ tester v2.3.0
✓ context:react-patterns v2.1.0

✅ Team setup installed!
  4 components (exact versions)
  
🔒 Locked: Changes will be synced via git

💡 Update setup: Ask teammate to update profile + lockfile
```

**Key success factors**:
- Export exact setup (lockfile)
- Git-based sharing (no cloud)
- One-command install
- Version locked for consistency

---

### Scenario 4: "Oops, Broke It - Quick Recovery"

**Context**: Customized openagent. Edited the file directly. Now it won't load. IDE shows errors.

```bash
# IDE shows error
# "Failed to load agent: openagent"
# "Syntax error in agent file"

# Run diagnostics
oac doctor

🔍 Running diagnostics...

❌ CRITICAL: openagent.md
   Line 45: Invalid YAML frontmatter
   Expected 'permissions:', found 'permisions:'
   
   Location: .opencode/agent/core/openagent.md:45
   
? Fix automatically? (Y/n) y

⚡ Fixing...

? Restore from backup?
  > Yes, restore last working version (2 hours ago)
    No, just fix the typo
    Show me the diff

# Choose "restore last working version"

✓ Restored from backup
  .opencode/agent/core/openagent.md
  ← .opencode/.backups/openagent.md.2026-02-14-07-00
  
✅ Fixed!

📊 Validation:
  ✓ All agents loaded
  ✓ No syntax errors
  ✓ IDE ready

💡 Tip: Use 'oac customize' instead of editing files directly
```

**Alternative: Manual fix**:
```bash
# I want to fix the typo myself
oac doctor

❌ CRITICAL: openagent.md - Syntax error (line 45)

? Fix automatically?
  > No, show me the error

Error location:
  File: .opencode/agent/core/openagent.md
  Line 45: permisions:
           ^^^^^^^^^^
  Expected: permissions:
  
? What to do?
  > Open in editor ($EDITOR)
    Auto-fix typo
    Restore from backup
    Show diff

# Open in editor
[Fix typo, save]

# Validate
oac validate

✓ All agents valid
✅ Ready to use!
```

**Key success factors**:
- Automatic diagnostics
- Clear error location
- Multiple fix options
- Easy rollback
- No data loss

---

### Scenario 5: "Multi-Project Juggling"

**Context**: Working on 5 different projects. Each needs different agents. Constantly switching.

**Setup once**:
```bash
# Global defaults (used by all projects)
oac install --global
  ✓ openagent
  ✓ tester

# Project-specific agents
cd ~/projects/react-app
oac add frontend-specialist

cd ~/projects/api
oac add backend-specialist

cd ~/projects/data-analysis
oac add data-analyst

cd ~/projects/rust-cli
oac add rust-specialist

cd ~/projects/personal-site
# No additional agents (just use global)
```

**Daily usage**:
```bash
# Monday: Work on React app
cd ~/projects/react-app
oac list
  Global:
    ✓ openagent
    ✓ tester
  Local:
    ✓ frontend-specialist
  Active: 3 agents

code .
# Agent knows React patterns, helps with components

# Tuesday: Switch to API work
cd ~/projects/api
oac list
  Global:
    ✓ openagent
    ✓ tester
  Local:
    ✓ backend-specialist
  Active: 3 agents

code .
# Agent knows Node.js patterns, helps with endpoints

# Wednesday: Data analysis
cd ~/projects/data-analysis
oac list
  Global:
    ✓ openagent
    ✓ tester
  Local:
    ✓ data-analyst
  Active: 3 agents

code .
# Agent knows Python, pandas, helps with data

# No mental overhead!
# Just cd to project, agents auto-configured
```

**Quick status across all projects**:
```bash
oac status --all

📊 OAC Status (All Projects)

Global (~/.config/oac/):
  ✓ openagent v0.7.1
  ✓ tester v2.3.0

~/projects/react-app:
  ✓ frontend-specialist v1.2.0
  → 3 agents active

~/projects/api:
  ✓ backend-specialist v1.0.0
  → 3 agents active

~/projects/data-analysis:
  ✓ data-analyst v0.9.0
  ⚠ Update available: v1.0.0
  → 3 agents active

~/projects/rust-cli:
  ✓ rust-specialist v2.0.0-beta.3 (beta)
  → 3 agents active

~/projects/personal-site:
  → 2 agents active (global only)

💡 Update available in data-analysis
  Run: cd ~/projects/data-analysis && oac update
```

**Key success factors**:
- Global + local layering (no duplication)
- Auto-detected per project
- No manual switching
- Clear visibility across projects

---

### Scenario 6: "Update Day - Stay Safe"

**Context**: Haven't updated in 2 months. Want latest features but don't want to break my setup.

```bash
oac update --check

📦 5 updates available:

1. openagent: 0.7.1 → 0.8.0 ✓ SAFE
   - Improved delegation
   - Fixed bugs
   - Added new patterns
   
2. frontend-specialist: 1.2.0 → 2.0.0 ⚠ BREAKING
   - React 19 support
   - Removed legacy APIs
   - New component patterns
   
3. tester: 2.3.0 → 2.4.1 ✓ SAFE
   - Added Vitest support
   - Better coverage reports
   
4. context:react-patterns: 2.1.0 → 2.2.0 ✓ SAFE
   - New hook patterns
   - Updated best practices
   
5. rust-specialist: 2.0.0-beta.3 → 2.0.0 🎉 STABLE
   - Beta → Stable release!

📊 Summary:
  - 3 safe updates
  - 1 breaking change (review first)
  - 1 stable release

? What to do?
  > Update safe only (3 components)
    Review breaking changes first
    Update all (risky)
    Pick manually
    Skip for now

# Choose "Update safe only"
oac update --safe

⚡ Updating 3 components...

✓ openagent: 0.7.1 → 0.8.0
✓ tester: 2.3.0 → 2.4.1
✓ context:react-patterns: 2.1.0 → 2.2.0

📊 Success! All updates applied.

⚠ Skipped breaking update:
  frontend-specialist: 1.2.0 → 2.0.0
  
  Review changes: oac diff frontend-specialist
  Update when ready: oac update frontend-specialist

# Review breaking changes
oac diff frontend-specialist 1.2.0 2.0.0

📄 Changes: frontend-specialist (1.2.0 → 2.0.0)

🔴 BREAKING CHANGES:
  - Removed: React 17 class component patterns
  - Removed: Legacy prop-types support
  - Changed: Hook naming convention

✅ NEW FEATURES:
  - Added: React 19 server components
  - Added: Better TypeScript integration
  - Added: Suspense patterns

📝 Migration Guide:
  1. Update React to v19
  2. Convert class components to hooks
  3. Replace prop-types with TypeScript
  
  Full guide: https://...

? Update now? (y/N) n

# Not ready yet, skip for now
✅ Skipped frontend-specialist update

💡 Update later: oac update frontend-specialist
```

**A week later, ready to update**:
```bash
# Ready for breaking update
oac update frontend-specialist

⚠ Breaking Update: frontend-specialist (1.2.0 → 2.0.0)

? You have customizations (preset: my-frontend-agent)

? How to handle?
  > Review changes, merge manually
    Keep old version (don't update)
    Update base, keep my preset unchanged
    
# Choose "Update base, keep my preset unchanged"

✓ Updated frontend-specialist base: 2.0.0
✓ Your preset preserved
✓ Backup saved

⚠ Your preset based on old version (1.2.0)
  
💡 Consider updating preset to use new features:
  oac customize my-frontend-agent --merge-base
```

**Key success factors**:
- Check before updating
- Safe vs breaking clearly marked
- Selective updates
- Review changes before applying
- Preserve customizations

---

## 7. Summary: What Makes OAC a Daily Driver

**As a solo developer, I'll use OAC daily if**:

### ✅ It's Fast
- Install in < 2 minutes
- Commands respond in < 1 second
- No waiting, no lag

### ✅ It's Simple
- One command to start
- Smart defaults everywhere
- No complex configuration needed

### ✅ It's Safe
- Can't break my setup
- Easy rollback
- Automatic backups

### ✅ It's Flexible
- Easy to customize
- Updates preserve my changes
- Works my way

### ✅ It's Discoverable
- Easy to find agents
- Preview before install
- Clear descriptions

### ✅ It's Reliable
- Updates don't break things
- Clear errors with fixes
- No surprises

### ✅ It Respects My Time
- No decision fatigue
- No reading docs for basics
- Just works

---

**Bottom Line**: If OAC can get out of my way and let me code faster, I'll use it. If it adds friction, I'll manage agents manually.

**The bar is high, but the reward is worth it**: A tool that becomes invisible because it just works.
