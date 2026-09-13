# Team Lead Perspective: OAC User Scenarios

**Date**: 2026-02-14  
**Role**: Engineering Team Lead (5-10 developers)  
**Focus**: Standardization, reproducibility, collaboration, governance

---

## Executive Summary

As a team lead managing 5-10 developers, OAC needs to solve **team coordination problems**, not just individual developer productivity. This document outlines critical team workflows, pain points, and must-have features for successful team adoption.

**Key Requirements**:
- 🔒 **Reproducibility**: Same setup across all team members
- 📋 **Standardization**: Enforce coding standards and agent behavior
- 👥 **Collaboration**: Easy sharing of agents and configurations
- 🔍 **Visibility**: Track who has what installed
- 🚀 **Onboarding**: Get new hires productive in hours, not days
- 🛡️ **Governance**: Policy enforcement without micromanagement

---

## 1. Team Workflows

### 1.1 Onboarding New Team Members

**Scenario**: Sarah joins the team on Monday. She needs to be productive by Wednesday.

**Current Reality** (Without OAC):
```bash
# Day 1: Setup chaos
- Clone repo ✓
- Install dependencies (npm install) ✓
- Read README... wait, which version of Claude Code?
- Copy .cursorrules from teammate's Slack message
- Manually set up agents... which ones?
- Configure approval gates... how?
- Add custom team agents... where are they?
- Day 1 ends: 50% set up, confused about what's missing

# Day 2: Troubleshooting
- "My agent doesn't have the team's code quality standards"
- "Where do I get the React specialist agent?"
- "Why does my setup look different from John's?"
- Senior dev spends 2 hours helping

# Day 3: Finally productive (maybe)
```

**With OAC** (Team Standard Workflow):
```bash
# Day 1 Morning: 15 minutes to full setup
cd ~/Projects/company-frontend
oac install --frozen

# OAC reads oac.lock (committed to repo)
📦 Installing Team Configuration
  
  Reading lockfile: oac.lock
  Team: Frontend Team
  Last updated: 2026-02-10 by john@company.com
  
  Components (exact versions):
  ✓ agent:openagent@0.7.1
  ✓ agent:frontend-specialist@1.2.0
  ✓ agent:tester@2.0.1
  ✓ context:team-standards@1.0.0
  ✓ context:react-patterns@1.5.0
  ✓ skill:git-workflow@0.8.0
  
  Total: 6 components
  
? Install for which IDE?
  ✓ OpenCode
  > Cursor

? Install location?
  > Local (this project: ~/Projects/company-frontend/.opencode)
    Global (~/.config/oac)

⚡ Installing...
  ✓ All components installed
  ✓ Team standards applied
  ✓ Approval gates configured
  ✓ Git hooks installed

✅ Setup complete!

📊 Your setup matches team standard (100%)

🔍 Next steps:
  1. Review team standards: oac context show team-standards
  2. Test your setup: oac doctor
  3. Start coding!
  
💡 Questions? Ask in #engineering-setup
```

**Result**: Sarah is productive in 15 minutes. Zero configuration drift.

---

### 1.2 Standardizing Agent Configurations

**Scenario**: Team lead wants all developers using same agent behavior (approval gates, context loading, etc.)

**Challenge**: Different developers have different preferences, but team needs consistency

**Team Standard Configuration** (`oac-team.json`):
```json
{
  "version": "1.0.0",
  "team": {
    "name": "Frontend Team",
    "owner": "john@company.com",
    "enforced": true
  },
  "components": {
    "agents": [
      {
        "name": "openagent",
        "version": "0.7.1",
        "required": true,
        "config": {
          "behavior": {
            "approvalGates": true,
            "contextLoading": "lazy",
            "delegationThreshold": 4
          },
          "permissions": {
            "bash": "approve",
            "write": "approve",
            "edit": "approve",
            "task": "approve"
          }
        }
      },
      {
        "name": "frontend-specialist",
        "version": "1.2.0",
        "required": true,
        "config": {
          "frameworks": ["react", "nextjs"],
          "typescript": true,
          "testingLibrary": "vitest"
        }
      },
      {
        "name": "tester",
        "version": "2.0.1",
        "required": false,
        "recommendedFor": ["senior-devs"]
      }
    ],
    "contexts": [
      {
        "name": "team-standards",
        "version": "1.0.0",
        "required": true,
        "description": "Company coding standards and best practices"
      },
      {
        "name": "react-patterns",
        "version": "1.5.0",
        "required": true,
        "description": "Approved React patterns for this project"
      }
    ],
    "skills": [
      {
        "name": "git-workflow",
        "version": "0.8.0",
        "required": true,
        "description": "Company git workflow (branch naming, commit style)"
      }
    ]
  },
  "policies": {
    "allowCustomization": true,
    "allowAdditionalAgents": true,
    "enforceVersions": true,
    "requireLockfile": true,
    "auditChanges": true
  },
  "validation": {
    "frequency": "on-install",
    "strictMode": false,
    "warnOnDrift": true
  }
}
```

**Team Lead Workflow**:
```bash
# 1. Create team configuration
oac team init
? Team name: Frontend Team
? Owner email: john@company.com
? Enforce configuration? (Y/n) y

✓ Created: oac-team.json

# 2. Add required components
oac team add agent:openagent@0.7.1 --required
oac team add agent:frontend-specialist@1.2.0 --required
oac team add context:team-standards@1.0.0 --required

# 3. Configure policies
oac team policy set enforceVersions true
oac team policy set allowCustomization true

# 4. Generate lockfile
oac lock
✓ Created: oac.lock (based on team config)

# 5. Commit to repo
git add oac-team.json oac.lock
git commit -m "Add team OAC configuration"
git push

# 6. Announce to team
echo "Team: Please run 'oac install --frozen' to sync with team standard"
```

**Developer Experience**:
```bash
# Developer pulls latest
git pull

# OAC detects team config
⚠ Team configuration detected
  
  Your setup differs from team standard:
  - agent:openagent: 0.6.5 (team: 0.7.1) ⚠
  - context:team-standards: missing ❌
  - skill:git-workflow: missing ❌
  
? Update to team standard? (Y/n) y

⚡ Updating to team standard...
  ✓ agent:openagent: 0.6.5 → 0.7.1
  ✓ context:team-standards: installed
  ✓ skill:git-workflow: installed

✅ Your setup now matches team standard (100%)
```

---

### 1.3 Sharing Custom Agents/Presets

**Scenario**: Senior dev creates amazing custom agent, wants to share with team

**Without OAC**:
- Copy/paste agent file in Slack
- Everyone manually copies to their .opencode folder
- Updates? Manually notify everyone
- Who has it installed? No idea
- Version drift inevitable

**With OAC**:
```bash
# Senior dev creates custom agent
cd ~/Projects/company-frontend
oac create agent review-specialist

# ... edits agent prompt ...

# Package for team
oac team share agent:review-specialist
? Share with:
  > Current team (Frontend Team)
    Entire organization
    Specific team members

? Access level:
  > Recommended (team members can install)
    Required (auto-installed for everyone)
    Optional (discoverable in team registry)

✓ Shared: agent:review-specialist
✓ Added to team registry
✓ Slack notification sent to #frontend-team

📊 Analytics:
  - Available to: 8 team members
  - Auto-installed for: 0 (recommended only)
  
💡 Team members can install with:
    oac team install agent:review-specialist
```

**Team Member Experience**:
```bash
# Check team-shared components
oac team browse

┌─────────────────────────────────────────────────────┐
│  Team Components (Frontend Team)                    │
├─────────────────────────────────────────────────────┤
│  Agents:                                            │
│  ✓ review-specialist (recommended)                  │
│    By: john@company.com                             │
│    Downloads: 3/8 team members                      │
│    "Enhanced code review with team standards"       │
│                                                     │
│  Contexts:                                          │
│  ✓ team-standards (required)                        │
│    By: john@company.com                             │
│    Installed: 8/8 team members                      │
└─────────────────────────────────────────────────────┘

# Install recommended agent
oac team install agent:review-specialist
✓ Installed: agent:review-specialist@1.0.0
✓ Added to your local config
```

---

### 1.4 Enforcing Coding Standards

**Scenario**: Team lead wants to ensure all code follows team standards

**Team Standards Context** (`.oac/team/contexts/team-standards.md`):
```markdown
# Frontend Team Coding Standards

## React Patterns

### Component Structure
- Use functional components with hooks
- No class components (legacy only)
- Props interface above component
- Export at bottom of file

### State Management
- Use Zustand for global state
- No Redux (legacy projects only)
- Local state with useState for UI state

### Testing
- Vitest for unit tests
- Playwright for e2e tests
- Minimum 80% coverage for new code
- Test files: *.test.tsx

### File Structure
```
components/
  Button/
    Button.tsx
    Button.test.tsx
    Button.stories.tsx
    index.ts
```

## Git Workflow

### Branch Naming
- feature/JIRA-123-short-description
- fix/JIRA-123-short-description
- chore/JIRA-123-short-description

### Commit Messages
- feat: Add user authentication
- fix: Fix login button not working
- chore: Update dependencies

### PR Requirements
- Minimum 1 approval
- All checks must pass
- No merge conflicts
- Linked to Jira ticket
```

**Enforcement Workflow**:
```bash
# Team lead creates standards context
oac create context team-standards
# ... adds standards content ...

# Make it required
oac team add context:team-standards@1.0.0 --required

# Configure agent to enforce standards
oac team config set agents.openagent.context.required team-standards
oac team config set agents.openagent.strictMode true

# Commit to repo
git add .oac/team/
git commit -m "Add enforced team standards"
git push
```

**Developer Experience**:
```bash
# Agent automatically loads team standards
> create a new button component

Agent checks team-standards.md:
✓ Using functional component (required)
✓ Creating test file Button.test.tsx (required)
✓ Creating story file Button.stories.tsx (recommended)
✓ Props interface above component (required)

Creating:
  components/Button/
    Button.tsx
    Button.test.tsx
    Button.stories.tsx
    index.ts

✅ Follows team standards
```

---

### 1.5 Managing Updates Across Team

**Scenario**: New version of openagent released, team lead needs to coordinate update

**Without OAC**:
- Manual announcement: "Everyone update to openagent 0.8.0"
- Some update immediately, some forget
- Version drift across team
- Bugs appear on some machines, not others
- Hard to debug: "Works on my machine"

**With OAC**:
```bash
# Team lead checks for updates
oac team update --check

📦 Updates Available for Frontend Team

agent:openagent
  Current: 0.7.1 (team standard)
  Latest:  0.8.0
  
  Changes:
  - Improved delegation logic
  - Fixed approval gate bug
  - New context loading patterns
  
  Impact: 8/8 team members affected
  Breaking: No

? How would you like to proceed?
  > Review changes
    Update team standard
    Skip this update
    
# Review changes
oac diff agent:openagent 0.7.1 0.8.0
[Shows detailed diff]

# Update team standard
oac team update agent:openagent@0.8.0

⚡ Updating team standard...
  ✓ Updated: agent:openagent 0.7.1 → 0.8.0
  ✓ Updated: oac.lock
  ✓ Updated: oac-team.json

? Notify team?
  > Yes, send Slack notification
    No, silent update
    
✓ Slack notification sent to #frontend-team

📊 Update Status:
  - Team standard: 0.8.0
  - Team members on 0.8.0: 0/8
  - Team members on 0.7.1: 8/8
  
💡 Track adoption: oac team status
```

**Team Member Experience**:
```bash
# Pull latest code (next day)
git pull

⚠ Team standard updated
  
  agent:openagent: 0.7.1 → 0.8.0 (required)
  
  Changes:
  - Improved delegation logic
  - Fixed approval gate bug
  
? Update now? (Y/n) y

⚡ Updating...
  ✓ agent:openagent: 0.7.1 → 0.8.0
  ✓ Backup saved: .oac/backups/openagent-0.7.1.md

✅ Up to date with team standard

# Team lead checks adoption
oac team status

📊 Team Configuration Status
  Team: Frontend Team
  Members: 8
  
  agent:openagent@0.8.0 (required):
    ✓ john@company.com (you)
    ✓ sarah@company.com
    ✓ mike@company.com
    ⏳ jane@company.com (pending)
    ⏳ bob@company.com (pending)
    ❌ alice@company.com (offline)
    ❌ tom@company.com (on vacation)
    ❌ lisa@company.com (needs update)
  
  Adoption: 3/8 (37.5%)
  
💡 Send reminder: oac team remind agent:openagent
```

---

## 2. Key Experiences

### 2.1 Setting Up Team Standards (First Time)

**Persona**: John, Senior Frontend Lead, managing 8 developers

**Goal**: Establish team standards for new React project

**Workflow**:
```bash
# Week 1: Project kickoff
cd ~/Projects/new-frontend
git init
npm init

# Initialize OAC for team
oac team init

Welcome to OAC Team Setup! 👥

? Team name: Frontend Team
? Owner (your email): john@company.com
? Team size: 
  > Small (2-10 developers)
    Medium (11-50 developers)
    Large (50+ developers)

? Primary tech stack:
  ✓ React
  ✓ TypeScript
  ✓ Node.js
  ☐ Python

? Strictness level:
  > Balanced (enforce core standards, allow customization)
    Strict (enforce all standards, minimal customization)
    Flexible (recommend standards, full customization)

✓ Created team configuration

📦 Recommended setup for React + TypeScript team:
  
  Core Agents (required):
  - openagent@0.7.1
  - frontend-specialist@1.2.0
  
  Specialists (recommended):
  - tester@2.0.1
  - reviewer@1.8.0
  
  Contexts (required):
  - core/standards/code-quality
  - development/react-patterns
  
  Skills (recommended):
  - git-workflow
  - testing-workflow

? Install recommended setup? (Y/n) y

⚡ Installing team setup...
  ✓ Installed 4 agents
  ✓ Installed 2 contexts
  ✓ Installed 2 skills
  ✓ Generated oac.lock
  ✓ Generated oac-team.json

✅ Team setup complete!

🔍 Next steps:
  1. Review team config: oac team config show
  2. Customize standards: oac context edit team-standards
  3. Commit to repo: git add .oac/ oac* && git commit
  4. Invite team: Share repo URL
  
💡 Team members run: oac install --frozen
```

**Customization**:
```bash
# Customize team standards
oac context edit team-standards
[Opens in editor]

# Configure policies
oac team policy set enforceVersions true
oac team policy set allowCustomization true
oac team policy set auditChanges true

# Set up approval gates
oac team config set agents.openagent.permissions.bash approve
oac team config set agents.openagent.permissions.write approve

# Commit team configuration
git add .oac/ oac-team.json oac.lock
git commit -m "Add team OAC configuration

- Team: Frontend Team
- Core agents: openagent, frontend-specialist
- Required contexts: team-standards, react-patterns
- Policies: enforce versions, allow customization
"
git push origin main

# Announce to team
echo "Team setup complete! Clone repo and run 'oac install --frozen'"
```

---

### 2.2 Ensuring Everyone Has Same Setup

**Scenario**: New sprint starts, team lead wants to verify everyone is in sync

**Team Lead Workflow**:
```bash
# Check team configuration status
oac team status --detailed

📊 Frontend Team Configuration Status
  Updated: 2026-02-10 10:30 AM
  Members: 8
  
┌─────────────────────┬──────────┬────────────┬──────────┐
│ Component           │ Required │ Version    │ Adoption │
├─────────────────────┼──────────┼────────────┼──────────┤
│ openagent           │ Yes      │ 0.7.1      │ 8/8 ✓    │
│ frontend-specialist │ Yes      │ 1.2.0      │ 7/8 ⚠    │
│ tester              │ No       │ 2.0.1      │ 5/8      │
│ team-standards      │ Yes      │ 1.0.0      │ 8/8 ✓    │
│ react-patterns      │ Yes      │ 1.5.0      │ 7/8 ⚠    │
└─────────────────────┴──────────┴────────────┴──────────┘

⚠ Issues:
  - bob@company.com: Missing frontend-specialist@1.2.0
  - bob@company.com: Missing react-patterns@1.5.0

? Actions:
  > Send reminder to bob@company.com
    Generate compliance report
    View detailed per-member status
    
# View per-member status
oac team members

┌────────────────────┬──────────┬────────────┬────────────┐
│ Member             │ Status   │ Compliance │ Last Sync  │
├────────────────────┼──────────┼────────────┼────────────┤
│ john@company.com   │ ✓ Active │ 100%       │ Today      │
│ sarah@company.com  │ ✓ Active │ 100%       │ Today      │
│ mike@company.com   │ ✓ Active │ 100%       │ Yesterday  │
│ jane@company.com   │ ✓ Active │ 100%       │ Today      │
│ bob@company.com    │ ⚠ Drift  │ 75%        │ 3 days ago │
│ alice@company.com  │ ✓ Active │ 100%       │ Today      │
│ tom@company.com    │ ⏳ Away  │ 100%       │ Last week  │
│ lisa@company.com   │ ✓ Active │ 100%       │ Today      │
└────────────────────┴──────────┴────────────┴────────────┘

# Send reminder to specific member
oac team remind bob@company.com

📧 Reminder sent to bob@company.com

Subject: Update your OAC setup (Frontend Team)
  
Missing components:
- frontend-specialist@1.2.0 (required)
- react-patterns@1.5.0 (required)

Please run: oac install --frozen

# Generate compliance report
oac team report --export team-compliance.md

✓ Generated: team-compliance.md

📄 Team Compliance Report
  Date: 2026-02-14
  Team: Frontend Team
  
  Overall Compliance: 93.75% (7.5/8 members)
  
  Required Components:
  - All members have: openagent, team-standards
  - Missing from 1 member: frontend-specialist, react-patterns
  
  Recommended Actions:
  1. Follow up with bob@company.com
  2. Consider reminder automation
  
  Compliance Trend:
  - Last week: 87.5%
  - This week: 93.75%
  - Change: +6.25% ✓
```

**Developer Self-Check**:
```bash
# Developer checks their own compliance
oac team validate

📊 Validating your setup against team standard...

Team: Frontend Team
Your compliance: 100% ✓

Required components:
✓ openagent@0.7.1
✓ frontend-specialist@1.2.0
✓ team-standards@1.0.0
✓ react-patterns@1.5.0

Recommended components:
✓ tester@2.0.1
✓ git-workflow@0.8.0

✅ Your setup matches team standard

# Developer has drift
oac team validate

📊 Validating your setup against team standard...

Team: Frontend Team
Your compliance: 75% ⚠

Required components:
✓ openagent@0.7.1
❌ frontend-specialist: missing (required)
✓ team-standards@1.0.0
❌ react-patterns: missing (required)

? Fix issues now? (Y/n) y

⚡ Installing missing components...
  ✓ frontend-specialist@1.2.0
  ✓ react-patterns@1.5.0

✅ Your setup now matches team standard (100%)
```

---

### 2.3 Reviewing Team's Agent Usage

**Scenario**: Team lead wants insights into how team uses agents

**Analytics Dashboard**:
```bash
oac team analytics

📊 Frontend Team Analytics
  Period: Last 30 days
  Members: 8
  
Agent Usage:
┌────────────────────┬───────────┬──────────┬────────────┐
│ Agent              │ Users     │ Sessions │ Avg/Day    │
├────────────────────┼───────────┼──────────┼────────────┤
│ openagent          │ 8/8 (100%)│ 2,340    │ 9.75       │
│ frontend-specialist│ 7/8 (87%) │ 1,890    │ 7.88       │
│ tester             │ 5/8 (62%) │ 450      │ 1.88       │
│ reviewer           │ 3/8 (37%) │ 210      │ 0.88       │
└────────────────────┴───────────┴──────────┴────────────┘

Most Used Features:
1. Code generation (frontend-specialist): 890 sessions
2. Test writing (tester): 340 sessions
3. Code review (reviewer): 210 sessions
4. Refactoring (openagent): 180 sessions

Context Access:
- team-standards: 1,200 loads
- react-patterns: 980 loads
- api-docs: 450 loads

Insights:
💡 reviewer is underused (37% adoption)
   → Consider team training or review workflow update
   
💡 tester usage spiking (+40% this week)
   → Positive trend, sprint deadline approaching
   
💡 frontend-specialist high usage (87%)
   → Good adoption, consider advanced features

? Actions:
  > Export detailed report
    Schedule weekly digest
    View per-member analytics
```

**Per-Member Analytics**:
```bash
oac team analytics --member sarah@company.com

📊 Analytics: sarah@company.com
  Period: Last 30 days
  
Activity Summary:
- Total sessions: 342
- Agents used: 4
- Most active: Weekdays 9am-5pm
- Avg sessions/day: 11.4

Agent Breakdown:
1. frontend-specialist: 180 sessions (52%)
2. openagent: 120 sessions (35%)
3. tester: 30 sessions (9%)
4. reviewer: 12 sessions (4%)

Top Actions:
- Component creation: 45 times
- Test writing: 30 times
- Code refactoring: 25 times
- Bug fixing: 20 times

Productivity Metrics:
- Code commits: 87
- PRs created: 23
- Tests added: 156
- Reviews given: 18

Comparison to team average:
- Sessions: +15% above average
- Test coverage: +10% above average
- PR activity: Average
```

---

### 2.4 Handling Version Conflicts

**Scenario**: Project uses `openagent@0.7.1` but new dependency requires `openagent@0.8.0`

**Conflict Detection**:
```bash
# Developer tries to add new agent
oac add agent:new-specialist

⚠ Version Conflict Detected

Package: agent:new-specialist
Requires: agent:openagent@^0.8.0

Your setup:
  agent:openagent@0.7.1 (from team standard)

Team standard:
  agent:openagent@0.7.1 (locked)

? How would you like to resolve?
  > Request team update (contact team lead)
    Use compatible version (find alternative)
    Override locally (breaks team standard)
    Cancel installation

# Option 1: Request team update
? Request team update
  
📧 Request sent to team lead (john@company.com)

Subject: Version conflict resolution needed
  
Developer: sarah@company.com
Requested component: agent:new-specialist
Conflict: Requires openagent@0.8.0, team has 0.7.1

Details:
- new-specialist requires openagent@^0.8.0
- Team is on openagent@0.7.1
- Suggested action: Update team standard

# Team lead receives request
oac team requests

📬 Team Requests (1 pending)

1. Version Conflict: openagent@0.7.1 → @0.8.0
   Requested by: sarah@company.com
   Reason: Need agent:new-specialist
   Impact: All team members (8)
   Breaking: No
   
? Action:
  > Approve and update team standard
    Check for team impact first
    Request more info
    Reject (explain why)

# Approve update
oac team approve-request 1

⚡ Approving request...
  ✓ Updated team standard: openagent@0.8.0
  ✓ Updated oac.lock
  ✓ Sent notifications to team

📧 Notifications sent:
  - sarah@company.com: Approved, you can now install
  - Team members (7): Team standard updated, please sync

# Sarah gets notified
✓ Your request was approved!

agent:openagent@0.7.1 → 0.8.0 (team standard updated)

? Install now? (Y/n) y

⚡ Updating...
  ✓ openagent: 0.7.1 → 0.8.0
  ✓ new-specialist: installed

✅ Installation complete
```

---

### 2.5 Migrating to New Versions

**Scenario**: Team needs to migrate from v0.7.x to v1.0.0 (breaking changes)

**Migration Workflow**:
```bash
# Team lead checks migration path
oac team migrate --check

📦 Migration Available: v0.7.1 → v1.0.0

Breaking Changes:
⚠ Approval gates: Configuration format changed
⚠ Context resolution: New priority system
⚠ Preset system: New metadata format

Migration Steps:
1. Backup current setup
2. Update configuration files
3. Test with subset of team
4. Roll out to full team

Estimated time: 2-4 hours
Estimated effort: Medium

? View detailed migration guide? (Y/n) y

# View migration guide
📚 Migration Guide: v0.7.1 → v1.0.0

### Step 1: Backup
```bash
oac team backup
# Creates: .oac/backups/team-backup-2026-02-14.tar.gz
```

### Step 2: Create Migration Branch
```bash
git checkout -b oac-v1-migration
```

### Step 3: Run Migration Tool
```bash
oac team migrate --to v1.0.0

⚡ Running migration...
  ✓ Backed up current config
  ✓ Updated configuration format
  ✓ Migrated approval gates config
  ✓ Updated context resolution
  ✓ Migrated presets
  ✓ Generated new lockfile

⚠ Manual steps required:
  1. Review updated configs: .oac/team/
  2. Test locally: oac doctor
  3. Update README with new instructions

? Commit changes? (Y/n) y

✓ Changes committed
```

### Step 4: Test with Pilot Group
```bash
# Team lead designates pilot group
oac team pilot add sarah@company.com mike@company.com

📢 Announcement: Pilot Group
  
  Testing v1.0.0 migration
  Pilot members:
  - sarah@company.com
  - mike@company.com
  
  Please:
  1. git checkout oac-v1-migration
  2. oac install --frozen
  3. Test for 1 day
  4. Report issues: #oac-migration
  
? Send notifications? (Y/n) y

# Pilot members test
cd ~/Projects/company-frontend
git checkout oac-v1-migration
oac install --frozen

⚠ Migration Detected: v0.7.1 → v1.0.0

Breaking changes:
- Approval gates config updated
- Context resolution changed
- Presets migrated

? Install v1.0.0? (Y/n) y

⚡ Installing...
  ✓ All components migrated
  ✓ Configuration updated

⚠ Action required:
  - Test approval gates behavior
  - Verify context loading
  - Check presets

💡 Report issues: #oac-migration

# After 1 day of testing
oac team pilot report

📊 Pilot Test Results
  Duration: 1 day
  Participants: 2/2
  
  Feedback:
  ✓ sarah@company.com: No issues, works great
  ✓ mike@company.com: No issues, approval gates clearer
  
  Issues: 0
  Recommendation: Ready for full rollout

? Proceed with full team migration? (Y/n) y
```

### Step 5: Full Team Rollout
```bash
# Merge migration branch
git checkout main
git merge oac-v1-migration
git push origin main

# Announce to team
oac team announce

📢 Team Update: OAC v1.0.0 Migration

What: Upgrading to OAC v1.0.0
When: Now
Impact: All team members

Breaking changes:
- Approval gates config (automatically migrated)
- Context resolution (automatically migrated)
- Presets (automatically migrated)

Action required:
1. git pull
2. oac install --frozen
3. Test your workflow
4. Report issues: #oac-migration

Tested by: sarah@company.com, mike@company.com
Estimated time: 5 minutes

? Send to team? (Y/n) y

✓ Sent to #frontend-team
✓ Email sent to all members

# Track migration progress
oac team status

📊 Migration Status: v0.7.1 → v1.0.0
  
  Completed: 2/8 (25%)
  In Progress: 3/8 (37.5%)
  Pending: 3/8 (37.5%)
  
  Timeline:
  - Hour 1: 2 completed (sarah, mike)
  - Hour 2: 3 in progress (jane, bob, alice)
  - Pending: tom, lisa, you
  
  Issues: 0
  
💡 Migration going smoothly
```

---

## 3. Pain Points & Solutions

### 3.1 Developers Using Different Versions

**Pain Point**:
> "Half the team is on openagent 0.7.1, half on 0.8.0. Behavior is inconsistent. Hard to debug issues."

**Root Causes**:
- No enforcement mechanism
- Developers update independently
- No visibility into team versions
- Updates happen out of sync

**Solution 1: Version Locking**
```bash
# Team lead enables strict version enforcement
oac team policy set enforceVersions strict

# oac-team.json
{
  "policies": {
    "enforceVersions": "strict",  // "strict" | "warn" | "off"
    "allowOverrides": false
  }
}

# Developer tries to install different version
oac add agent:openagent@0.8.0

❌ Version Enforcement Error

Team standard requires: agent:openagent@0.7.1
You requested: agent:openagent@0.8.0

Policy: Strict (no overrides allowed)

? Actions:
  > Use team version (0.7.1)
    Request version update from team lead
    Cancel
```

**Solution 2: Automatic Drift Detection**
```bash
# Enable drift detection
oac team policy set driftDetection enabled

# Developer's setup drifts
# (git pull doesn't update oac)

# On next oac command:
⚠ Configuration Drift Detected

Your setup differs from team standard:
- agent:openagent: 0.6.5 (team: 0.7.1) ⚠

This may cause inconsistent behavior.

? Sync with team standard? (Y/n) y
```

**Solution 3: Pre-commit Hooks**
```bash
# Team lead enables git hooks
oac team hooks install

✓ Installed git hooks:
  - pre-commit: Check OAC compliance
  - pre-push: Validate team standard

# Developer commits code with drift
git commit -m "Add feature"

⚠ OAC Compliance Check

Your setup differs from team standard:
- agent:openagent: 0.6.5 (team: 0.7.1) ⚠

? How would you like to proceed?
  > Fix now (sync with team)
    Commit anyway (not recommended)
    Cancel commit
```

---

### 3.2 Customizations Breaking Team Standards

**Pain Point**:
> "Bob customized his agent and now he's getting different code suggestions. His PRs don't match team style."

**Root Causes**:
- No visibility into customizations
- Developer doesn't realize impact
- No enforcement of required contexts

**Solution 1: Customization Visibility**
```bash
# Team lead can see customizations
oac team members --show-customizations

┌────────────────────┬─────────────┬──────────────────────┐
│ Member             │ Compliance  │ Customizations       │
├────────────────────┼─────────────┼──────────────────────┤
│ john@company.com   │ 100%        │ None                 │
│ sarah@company.com  │ 100%        │ None                 │
│ bob@company.com    │ 90% ⚠       │ 2 presets, 1 override│
│ mike@company.com   │ 100%        │ 1 preset (approved)  │
└────────────────────┴─────────────┴──────────────────────┘

# View Bob's customizations
oac team member bob@company.com --customizations

📊 Customizations: bob@company.com

Presets:
- custom-openagent (overrides team agent)
- custom-tester (adds extra behavior)

Context Overrides:
- team-standards (local override)
  ⚠ Warning: Overrides required context

Impact:
- May generate code not matching team standards
- Test patterns may differ
- PR reviews may flag inconsistencies

? Actions:
  > Discuss with bob@company.com
    Request alignment with team standards
    Approve customizations (if beneficial)
```

**Solution 2: Required vs Optional Contexts**
```bash
# Team lead marks contexts as required (cannot be overridden)
oac team add context:team-standards@1.0.0 --required --locked

# Bob tries to override
cp team-standards.md .oac/context/override/team-standards.md

# Agent tries to load context
⚠ Required Context Override Blocked

Context: team-standards
Status: Required and locked by team lead

You cannot override this context.
Reason: Team consistency (enforced)

Using team version: .oac/team/context/team-standards.md

💡 To suggest changes:
    oac team context propose-change team-standards
```

**Solution 3: Preset Approval Workflow**
```bash
# Enable preset approval requirement
oac team policy set requirePresetApproval true

# Bob creates preset
oac customize agent:openagent --name my-openagent

✓ Created preset: my-openagent

⚠ Team Policy: Preset approval required

Your preset has been created locally but requires team lead approval to use.

? Submit for approval? (Y/n) y

📧 Approval request sent to john@company.com

# Team lead reviews
oac team approvals

📬 Pending Approvals (1)

1. Preset: my-openagent
   By: bob@company.com
   Base: agent:openagent
   Changes:
   - Modified approval gates (auto-approve reads)
   - Changed delegation threshold (4 → 6)
   
   Impact: Individual only (preset is personal)
   Risk: Low

? Action:
  > Approve for bob@company.com only
    Approve and recommend to team
    Request changes
    Reject

# Approved
✓ Approved preset: my-openagent (bob@company.com only)

📧 bob@company.com notified
```

---

### 3.3 Hard to Track What's Installed Where

**Pain Point**:
> "I have no idea what each team member has installed. Debugging is a nightmare."

**Solution: Team Dashboard**
```bash
# Team lead views comprehensive dashboard
oac team dashboard

╔════════════════════════════════════════════════════╗
║  Frontend Team Dashboard                           ║
║  Updated: 2026-02-14 3:45 PM                      ║
╚════════════════════════════════════════════════════╝

Team Health: 95% ✓

┌─────────────────────────────────────────────────────┐
│ Component Adoption                                  │
├─────────────────────────────────────────────────────┤
│ Required:                                           │
│ ████████████████████ 100%  openagent@0.7.1          │
│ ███████████████████░  95%  frontend-specialist      │
│ ████████████████████ 100%  team-standards           │
│                                                     │
│ Recommended:                                        │
│ ████████████░░░░░░░░  62%  tester                   │
│ ██████░░░░░░░░░░░░░░  37%  reviewer                 │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Member Status (8 total)                             │
├─────────────────────────────────────────────────────┤
│ ✓ Compliant (100%):     6 members                   │
│ ⚠ Minor drift (90-99%): 1 member (bob)              │
│ ❌ Major drift (<90%):  1 member (alice, offline)   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Recent Activity (24 hours)                          │
├─────────────────────────────────────────────────────┤
│ • sarah synced with team standard                   │
│ • mike installed reviewer@1.8.0                     │
│ • bob created custom preset (pending approval)      │
│ • jane updated to latest team config                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Alerts (2)                                          │
├─────────────────────────────────────────────────────┤
│ ⚠ bob@company.com has configuration drift          │
│ ⚠ alice@company.com offline 3+ days                │
└─────────────────────────────────────────────────────┘

? Actions:
  > View detailed member status
    Send reminders
    Generate report
    Schedule weekly digest
```

**Solution: Installation Registry**
```bash
# Automatic installation tracking
# Every install is logged to team registry

oac team registry

📊 Installation Registry (Last 30 days)

2026-02-14 10:30 AM
  sarah@company.com installed frontend-specialist@1.2.0
  Location: ~/Projects/company-frontend/.opencode
  
2026-02-14 09:15 AM
  mike@company.com updated openagent@0.7.0 → 0.7.1
  Location: ~/Projects/company-frontend/.opencode
  
2026-02-13 4:20 PM
  bob@company.com created preset:my-openagent
  Status: Pending approval
  
2026-02-13 2:10 PM
  jane@company.com installed team standard
  Components: 6 (all required)

# Filter by member
oac team registry --member bob@company.com

# Filter by component
oac team registry --component openagent

# Export audit log
oac team registry --export audit-log.csv
```

---

### 3.4 Updates Breaking Team Workflows

**Pain Point**:
> "We updated openagent and everyone's workflow broke. Spent 2 days debugging."

**Solution 1: Staged Rollouts**
```bash
# Team lead enables staged rollouts
oac team policy set rolloutStrategy staged

# Update available
oac team update agent:openagent@0.8.0

? Rollout strategy:
  > Staged (pilot → gradual → full)
    Immediate (all members now)
    Scheduled (pick date/time)

# Staged rollout
⚡ Starting staged rollout: openagent@0.8.0

Stage 1: Pilot (2 members)
  Pilot members:
  - sarah@company.com
  - mike@company.com
  
  Duration: 24 hours
  Start: Now
  
? Proceed? (Y/n) y

✓ Pilot stage started
📧 Notifications sent to pilot members

# 24 hours later: Check pilot results
oac team rollout status

📊 Rollout Status: openagent@0.8.0

Stage 1: Pilot (Complete) ✓
  Duration: 24 hours
  Success: 2/2 members
  Issues: 0
  Feedback: Positive
  
? Proceed to Stage 2 (Gradual)?
  > Yes, continue (50% of team)
    No, pause (investigate)
    Rollback (revert pilot)

# Stage 2: Gradual
Stage 2: Gradual (50% of team)
  Members: 4 more (sarah, mike already on 0.8.0)
  Duration: 48 hours
  
✓ Stage 2 started

# 48 hours later: Final stage
Stage 3: Full (remaining 2 members)
  Final members: bob, alice
  
✓ Rollout complete (100%)
```

**Solution 2: Automatic Rollback**
```bash
# Team lead enables automatic rollback
oac team policy set autoRollback true
oac team policy set rollbackThreshold 30  # 30% failure rate

# Update deployed
oac team update agent:openagent@0.8.0 --rollout staged

# Problems detected
⚠ Rollback Triggered

Component: agent:openagent@0.8.0
Reason: 40% failure rate (threshold: 30%)

Issues reported:
- sarah@company.com: Approval gates not working
- mike@company.com: Context loading errors
- jane@company.com: Delegation failed

⚡ Rolling back to openagent@0.7.1...

✓ Rollback complete (all members)
📧 Notifications sent
🔍 Issue report created: .oac/issues/rollback-2026-02-14.md

💡 Review issues before next update attempt
```

**Solution 3: Dry Run / Preview**
```bash
# Before updating team standard
oac team update --dry-run agent:openagent@0.8.0

🔍 Dry Run: Update Preview

Component: agent:openagent
Current: 0.7.1 (team standard)
Target: 0.8.0

Changes:
  ✓ Improved delegation logic
  ✓ Fixed approval gate bug
  ⚠ Breaking: Context loading API changed

Impact Analysis:
  Affected members: 8/8
  Estimated impact: Medium
  Breaking changes: Yes
  Migration required: Yes

Compatibility:
  ✓ Compatible with: frontend-specialist@1.2.0
  ✓ Compatible with: tester@2.0.1
  ⚠ May conflict with: custom-presets (1 member)

Risk Assessment: Medium
  - Breaking changes require testing
  - Bob's custom preset may need updates
  - Migration script available

Recommendations:
  1. Test in pilot first
  2. Review Bob's custom preset
  3. Schedule update during low-activity period
  4. Have rollback plan ready

? Proceed with actual update?
  > No, just previewing
    Yes, start pilot rollout
```

---

### 3.5 Onboarding Takes Too Long

**Pain Point**:
> "New developers spend half a day just setting up their environment. Then they still ask questions."

**Solution: One-Command Onboarding**
```bash
# New developer (Sarah) - Day 1, Hour 1
cd ~/Projects
git clone git@github.com:company/frontend-app.git
cd frontend-app

# Run single onboarding command
oac onboard

╔════════════════════════════════════════════════════╗
║  Welcome to Frontend Team! 👋                      ║
║  Let's get you set up in 5 minutes.               ║
╚════════════════════════════════════════════════════╝

🔍 Detecting configuration...
  ✓ Found team config: oac-team.json
  ✓ Found lockfile: oac.lock
  ✓ Team: Frontend Team
  ✓ Owner: john@company.com

📦 Team Configuration:
  - 4 agents (2 required, 2 recommended)
  - 2 contexts (required)
  - 2 skills (recommended)
  - Approval gates: Enabled
  - IDE: OpenCode (detected .opencode/)

? Confirm installation? (Y/n) y

⚡ Installing team configuration...
  ✓ agent:openagent@0.7.1
  ✓ agent:frontend-specialist@1.2.0
  ✓ agent:tester@2.0.1 (recommended)
  ✓ agent:reviewer@1.8.0 (recommended)
  ✓ context:team-standards@1.0.0
  ✓ context:react-patterns@1.5.0
  ✓ skill:git-workflow@0.8.0
  ✓ skill:testing-workflow@0.5.0
  
✅ Installation complete! (4 minutes 32 seconds)

📊 Setup verification...
  ✓ All required components installed
  ✓ Team standards loaded
  ✓ Approval gates configured
  ✓ Git hooks installed
  ✓ IDE configured

╔════════════════════════════════════════════════════╗
║  You're all set! 🎉                                ║
╚════════════════════════════════════════════════════╝

📚 Next Steps:
  1. Review team standards: oac context show team-standards
  2. Read React patterns: oac context show react-patterns
  3. Test your setup: oac doctor
  4. Start coding: Try creating a component!

💡 Resources:
  - Team wiki: https://wiki.company.com/frontend
  - Ask questions: #frontend-team
  - Team lead: john@company.com

🎯 Your First Task:
  Review this PR for practice:
  https://github.com/company/frontend-app/pull/123

# Setup is complete - Sarah is ready to code!
# Total time: 5 minutes (vs 4 hours previously)
```

**Solution: Interactive Tutorial**
```bash
# After onboarding, optional tutorial
oac tutorial

╔════════════════════════════════════════════════════╗
║  OAC Team Tutorial (5 minutes)                     ║
╚════════════════════════════════════════════════════╝

Let's learn the basics of working with OAC in a team.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lesson 1: Your Team Configuration

Your team has a shared configuration (oac-team.json).
This ensures everyone has the same agents and standards.

Try this:
  $ oac team validate

[User runs command]

✓ Great! You're 100% compliant with team standards.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lesson 2: Team Standards

Your team has coding standards in: team-standards

Try viewing them:
  $ oac context show team-standards

[Shows team standards]

💡 Agents automatically follow these standards when generating code.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lesson 3: Staying In Sync

Before each sprint, sync with team standard:
  $ oac team sync

Try it now:
  $ oac team sync

✓ Already in sync! You're good to go.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lesson 4: Getting Help

If you need help:
  - Team commands: oac team --help
  - Ask teammates: #frontend-team
  - Team lead: john@company.com

╔════════════════════════════════════════════════════╗
║  Tutorial Complete! 🎓                             ║
║  You're ready to work with the team.               ║
╚════════════════════════════════════════════════════╝
```

---

## 4. Edge Cases

### 4.1 Team Member Goes Rogue (Custom Setup)

**Scenario**: Bob decides to completely customize his setup, ignoring team standards

**Detection**:
```bash
# Bob's setup
oac list

Installed Components:
  ✓ custom-agent (personal, not from team)
  ✓ openagent@0.5.0 (old version, team: 0.7.1)
  ⚠ frontend-specialist: missing (required by team)
  ✓ react-patterns (overridden with custom version)

# Team lead notices in dashboard
oac team status

⚠ Compliance Alert: bob@company.com

Compliance: 40% ❌ (critical)

Issues:
- Using old version: openagent@0.5.0 (team: 0.7.1)
- Missing required: frontend-specialist
- Unauthorized override: react-patterns
- Unapproved custom agent: custom-agent

Impact:
- Code may not follow team standards
- PRs may fail review
- Potential bugs

? Actions:
  > Send compliance alert to bob@company.com
    Schedule 1-on-1 discussion
    Enforce team standard (reset bob's setup)
```

**Resolution Workflow**:
```bash
# Team lead sends alert
oac team alert bob@company.com

📧 Compliance Alert Sent

To: bob@company.com
Subject: OAC Setup Non-Compliant

Your OAC setup does not match team standards.

Issues:
- Old version: openagent@0.5.0 (team: 0.7.1)
- Missing: frontend-specialist (required)
- Unauthorized override: react-patterns

Impact: Your code may not match team standards

Please run: oac team sync

Questions? Contact john@company.com

# Bob receives alert and syncs
oac team sync

⚠ Configuration Compliance Issue

Your setup differs significantly from team standard.

Compliance: 40% ❌

Required actions:
  ✓ Update openagent: 0.5.0 → 0.7.1
  ✓ Install frontend-specialist@1.2.0
  ✓ Revert react-patterns override

Optional actions:
  ⚠ Remove custom-agent (not approved)

? Sync with team standard? (Y/n) y

⚡ Syncing...
  ✓ Backed up your custom setup
  ✓ Updated to team standard
  ✓ Removed unapproved customizations

✅ You're now compliant (100%)

💬 Your custom setup was backed up to:
    .oac/backups/custom-setup-2026-02-14/

💡 To use custom agents, request approval:
    oac team request-approval custom-agent
```

**Enforcement Options**:
```bash
# Team lead can enforce different levels
oac team policy set enforcementLevel flexible  # warn only
oac team policy set enforcementLevel balanced   # warn + block critical
oac team policy set enforcementLevel strict     # enforce all

# Strict mode example
# Bob tries to install old version
oac add agent:openagent@0.5.0

❌ Enforcement Policy Violation

Policy: Strict enforcement
Team requires: agent:openagent@0.7.1
You requested: agent:openagent@0.5.0

This action is blocked.

? Actions:
  > Use team version (0.7.1)
    Request exception from team lead
    Learn more about team policy
```

---

### 4.2 Monorepo with Multiple Projects

**Scenario**: Monorepo with 5 projects, each needs different agent setups

**Structure**:
```
company-monorepo/
├── apps/
│   ├── frontend/          # React frontend
│   ├── admin/             # React admin panel
│   ├── mobile/            # React Native
│   └── docs/              # Documentation site
├── packages/
│   ├── ui-components/     # Shared components
│   ├── api-client/        # API client
│   └── utils/             # Utilities
├── oac-workspace.json     # Workspace config
└── package.json
```

**Workspace Configuration** (`oac-workspace.json`):
```json
{
  "version": "1.0.0",
  "workspace": {
    "name": "Company Monorepo",
    "owner": "platform-team@company.com",
    "root": "."
  },
  "projects": {
    "apps/frontend": {
      "profile": "frontend-react",
      "team": "Frontend Team",
      "agents": ["openagent", "frontend-specialist", "tester"],
      "contexts": ["team-standards", "react-patterns"]
    },
    "apps/admin": {
      "profile": "frontend-react",
      "team": "Frontend Team",
      "agents": ["openagent", "frontend-specialist"],
      "contexts": ["team-standards", "react-patterns", "admin-patterns"]
    },
    "apps/mobile": {
      "profile": "react-native",
      "team": "Mobile Team",
      "agents": ["openagent", "mobile-specialist", "tester"],
      "contexts": ["team-standards", "mobile-patterns"]
    },
    "apps/docs": {
      "profile": "documentation",
      "team": "Platform Team",
      "agents": ["openagent", "technical-writer"],
      "contexts": ["team-standards", "docs-style"]
    },
    "packages/*": {
      "profile": "library",
      "team": "Platform Team",
      "agents": ["openagent", "library-specialist"],
      "contexts": ["team-standards", "library-patterns"]
    }
  },
  "shared": {
    "contexts": [".oac/shared/contexts"],
    "config": ".oac/shared/config.json"
  },
  "policies": {
    "inheritShared": true,
    "allowProjectOverrides": true,
    "enforceVersions": true
  }
}
```

**Developer Workflow**:
```bash
# Working on frontend app
cd apps/frontend
oac install

🏢 Workspace Detected: Company Monorepo

Project: apps/frontend
Profile: frontend-react
Team: Frontend Team

Shared configuration:
  ✓ Workspace config: ../../oac-workspace.json
  ✓ Shared contexts: ../../.oac/shared/contexts

Project configuration:
  ✓ Agents: openagent, frontend-specialist, tester
  ✓ Contexts: team-standards, react-patterns

? Install project configuration? (Y/n) y

⚡ Installing...
  ✓ Shared contexts (workspace)
  ✓ Project agents (apps/frontend)
  ✓ Project contexts (apps/frontend)

✅ Frontend project setup complete

# Move to mobile app
cd ../mobile
oac install

🏢 Workspace Detected: Company Monorepo

⚠ Different project detected

Current setup: apps/frontend (frontend-react)
New project: apps/mobile (react-native)

? Switch to mobile project configuration?
  > Yes, switch (keeps both configs)
    Yes, switch (remove frontend config)
    No, keep current

# Switch (keeps both)
⚡ Installing mobile configuration...
  ✓ Shared contexts (workspace) [already installed]
  ✓ Mobile agents (mobile-specialist)
  ✓ Mobile contexts (mobile-patterns)

✅ Multi-project setup active:
  - apps/frontend (frontend-react)
  - apps/mobile (react-native)

💡 OAC will auto-detect which config to use based on:
    - Current directory
    - File type
    - Context
```

**Workspace Management**:
```bash
# Team lead manages workspace
oac workspace status

🏢 Company Monorepo - Workspace Status

Projects: 5 active
Teams: 3 (Frontend, Mobile, Platform)
Members: 24

┌─────────────────┬──────────┬────────────┬────────────┐
│ Project         │ Team     │ Members    │ Compliance │
├─────────────────┼──────────┼────────────┼────────────┤
│ apps/frontend   │ Frontend │ 8          │ 95% ✓      │
│ apps/admin      │ Frontend │ 5          │ 100% ✓     │
│ apps/mobile     │ Mobile   │ 6          │ 90% ⚠      │
│ apps/docs       │ Platform │ 2          │ 100% ✓     │
│ packages/*      │ Platform │ 3          │ 100% ✓     │
└─────────────────┴──────────┴────────────┴────────────┘

Shared Components:
  ✓ team-standards: 24/24 (100%)
  ✓ workspace config: 24/24 (100%)

? Actions:
  > View project details
    Update shared configuration
    Sync all projects
```

---

### 4.3 Different Teams Need Different Setups

**Scenario**: Frontend team needs React specialists, Backend team needs API specialists

**Solution: Multi-Team Configuration**
```json
// oac-teams.json (workspace root)
{
  "version": "1.0.0",
  "teams": {
    "frontend": {
      "name": "Frontend Team",
      "owner": "john@company.com",
      "members": ["sarah@", "mike@", "jane@", "bob@"],
      "config": {
        "agents": ["openagent", "frontend-specialist", "tester"],
        "contexts": ["team-standards", "react-patterns"],
        "skills": ["git-workflow"]
      },
      "policies": {
        "enforceVersions": true,
        "allowCustomization": true
      }
    },
    "backend": {
      "name": "Backend Team",
      "owner": "alice@company.com",
      "members": ["tom@", "lisa@", "charlie@"],
      "config": {
        "agents": ["openagent", "api-specialist", "database-specialist"],
        "contexts": ["team-standards", "api-patterns", "database-patterns"],
        "skills": ["git-workflow", "api-testing"]
      },
      "policies": {
        "enforceVersions": true,
        "allowCustomization": false
      }
    },
    "mobile": {
      "name": "Mobile Team",
      "owner": "emma@company.com",
      "members": ["frank@", "grace@"],
      "config": {
        "agents": ["openagent", "mobile-specialist"],
        "contexts": ["team-standards", "mobile-patterns"],
        "skills": ["git-workflow", "mobile-testing"]
      }
    }
  },
  "shared": {
    "contexts": ["team-standards"],
    "skills": ["git-workflow"]
  }
}
```

**Cross-Team Developer**:
```bash
# Sarah works on both frontend and backend
cd ~/Projects/company-monorepo

# Auto-detect team based on project
cd apps/frontend
oac install

🏢 Team Detected: Frontend Team
✓ Installing frontend configuration...

cd ../../backend/api
oac install

🏢 Team Detected: Backend Team

⚠ You're switching teams:
  Current: Frontend Team
  New: Backend Team

Different configurations:
  - Frontend: react-focused agents
  - Backend: API-focused agents

? Install backend configuration?
  > Yes, add backend config (multi-team mode)
    Yes, replace frontend config
    No, keep frontend only

# Multi-team mode
✓ Multi-team mode enabled

Active configurations:
  ✓ Frontend Team (apps/frontend)
  ✓ Backend Team (backend/api)

💡 OAC auto-detects correct config based on directory
```

---

### 4.4 Legacy Projects with Old Agents

**Scenario**: Maintaining old project with agents from 2 years ago

**Challenge**:
- Old agents (v0.3.x) incompatible with new OAC (v1.0)
- Can't update (legacy dependencies)
- Need to support both old and new

**Solution: Version Pinning & Compatibility Mode**
```bash
# Legacy project setup
cd ~/Projects/legacy-app

oac install --legacy

⚠ Legacy Project Detected

Project uses old OAC configuration:
  - Agent format: v0.3.x (2 years old)
  - OAC version: 0.3.2 (current: 1.0.0)

? How would you like to proceed?
  > Compatibility mode (use old agents with new OAC)
    Migrate to v1.0 (may require changes)
    Keep old OAC version (not recommended)

# Compatibility mode
✓ Compatibility mode enabled

⚡ Installing with compatibility layer...
  ✓ Loaded legacy agents (v0.3.x format)
  ✓ Applied compatibility transforms
  ✓ Pinned to legacy versions

✅ Legacy project setup complete

⚠ Limitations in compatibility mode:
  - No new features (skills, plugins)
  - Limited context resolution
  - No team features

💡 Consider migration when possible:
    oac migrate --check
```

**Version Coexistence**:
```bash
# Developer works on both legacy and modern projects
cd ~/Projects/legacy-app
oac install --legacy
# Uses OAC v0.3.x compatibility mode

cd ~/Projects/modern-app
oac install
# Uses OAC v1.0.0 with all features

# OAC maintains separate configs
oac config list

Configurations:
  ✓ ~/Projects/modern-app: OAC v1.0.0 (standard)
  ✓ ~/Projects/legacy-app: OAC v0.3.x (legacy compat)

💡 Each project uses correct version automatically
```

---

### 4.5 Remote Team Across Timezones

**Scenario**: Team spread across US (PST), Europe (CET), and Asia (IST)

**Challenge**:
- Updates roll out during work hours for some, sleep hours for others
- Hard to coordinate synchronous changes
- Need async-friendly workflows

**Solution: Scheduled Rollouts & Async Notifications**
```bash
# Team lead schedules update
oac team update agent:openagent@0.8.0 --schedule

? Rollout strategy:
  > Timezone-aware (roll out during work hours)
    Scheduled (specific date/time)
    Immediate (all members now)

# Timezone-aware rollout
📅 Timezone-Aware Rollout

Team members by timezone:
  - PST (US West): 3 members
  - CET (Europe): 3 members
  - IST (Asia): 2 members

? Rollout window:
  > During work hours (9am-5pm local time)
    Weekdays only
    Custom schedule

# During work hours
✓ Scheduled rollout:
  
  PST (9am-5pm): Tue Feb 14, 9am PST
    - sarah@company.com
    - mike@company.com
    - bob@company.com
  
  CET (9am-5pm): Tue Feb 14, 9am CET (12am PST)
    - alice@company.com
    - tom@company.com
    - lisa@company.com
  
  IST (9am-5pm): Tue Feb 14, 9am IST (Sat 7:30pm PST)
    - frank@company.com
    - grace@company.com

📧 Notifications:
  - Email: Sent to all members (async)
  - Slack: Posted to #frontend-team (async)
  - Calendar: Added to team calendar

? Confirm schedule? (Y/n) y

✓ Rollout scheduled
```

**Async Update Process**:
```bash
# Sarah (PST) starts work Tuesday 9am
cd ~/Projects/company-frontend

⚠ Team Update Available

Component: agent:openagent@0.8.0
Scheduled: Today 9am PST (now)

? Install update now? (Y/n) y

# Alice (CET) starts work Tuesday 9am (CET time)
cd ~/Projects/company-frontend

⚠ Team Update Available

Component: agent:openagent@0.8.0
Scheduled: Today 9am CET (now)

? Install update now? (Y/n) y

# Both update during their local work hours
# Team lead sees progress across timezones

oac team rollout status

📊 Rollout Progress: openagent@0.8.0

┌──────────┬─────────┬──────────┬────────────┐
│ Timezone │ Members │ Updated  │ Status     │
├──────────┼─────────┼──────────┼────────────┤
│ PST      │ 3       │ 3/3 ✓    │ Complete   │
│ CET      │ 3       │ 2/3 ⏳   │ In progress│
│ IST      │ 2       │ 0/2      │ Scheduled  │
└──────────┴─────────┴──────────┴────────────┘

Overall: 5/8 (62.5%)
Expected completion: Wed Feb 15, 5pm IST

💡 All timezone windows respected
```

---

## 5. Must-Have Features

### 5.1 Lockfile for Reproducibility

**Feature**: `oac.lock` ensures exact same setup across all team members

**Format**:
```json
{
  "version": "1.0.0",
  "lockfileVersion": 1,
  "team": {
    "name": "Frontend Team",
    "owner": "john@company.com",
    "generated": "2026-02-14T10:30:00Z"
  },
  "components": {
    "agent:openagent": {
      "version": "0.7.1",
      "resolved": "https://registry.openagents.dev/agents/openagent-0.7.1.tar.gz",
      "integrity": "sha256-abc123...",
      "dependencies": {
        "context:core-standards": "^1.0.0"
      }
    },
    "agent:frontend-specialist": {
      "version": "1.2.0",
      "resolved": "https://registry.openagents.dev/agents/frontend-specialist-1.2.0.tar.gz",
      "integrity": "sha256-def456...",
      "dependencies": {
        "context:react-patterns": "^1.5.0"
      }
    }
  },
  "metadata": {
    "platform": "darwin",
    "oacVersion": "1.0.0",
    "node": "18.16.0"
  }
}
```

**Usage**:
```bash
# Generate lockfile
oac lock
✓ Generated: oac.lock

# Install from lockfile (exact versions)
oac install --frozen
✓ Installing exact versions from oac.lock

# Verify lockfile integrity
oac lock verify
✓ All components match lockfile

# Update lockfile after changes
oac lock update
✓ Updated: oac.lock
```

**Benefits**:
- ✅ Reproducible installs across team
- ✅ No version drift
- ✅ CI/CD friendly
- ✅ Audit trail

---

### 5.2 Shared Team Configurations

**Feature**: Team config repository for centralized management

**Setup**:
```bash
# Team lead creates shared config repo
git init oac-team-configs
cd oac-team-configs

# Initialize team configs
oac team init --repo

✓ Created team config repository

Structure:
  teams/
    frontend/
      config.json
      agents/
      contexts/
      skills/
    backend/
      config.json
      agents/
      contexts/

# Publish to GitHub
git remote add origin git@github.com:company/oac-team-configs.git
git push -u origin main

# Team members link to shared configs
cd ~/Projects/company-frontend
oac team link git@github.com:company/oac-team-configs.git

✓ Linked to shared team config
✓ Auto-sync enabled

💡 Changes to team config will auto-update on pull
```

**Auto-Sync**:
```bash
# Team lead updates shared config
cd oac-team-configs/teams/frontend
oac team add agent:new-specialist@1.0.0
git commit -m "Add new-specialist to team config"
git push

# Team members auto-sync
cd ~/Projects/company-frontend
git pull  # Pulls project code

⚠ Team Configuration Updated

Shared config has new changes:
  + agent:new-specialist@1.0.0

? Sync with team config? (Y/n) y

✓ Synced with team configuration
```

---

### 5.3 Audit Trail (Who Installed What)

**Feature**: Complete audit log of all team installations and changes

**Audit Log** (`.oac/team/audit.log`):
```json
{
  "version": "1.0.0",
  "team": "Frontend Team",
  "entries": [
    {
      "timestamp": "2026-02-14T10:30:00Z",
      "member": "sarah@company.com",
      "action": "install",
      "component": "agent:frontend-specialist",
      "version": "1.2.0",
      "location": "~/Projects/company-frontend/.opencode",
      "source": "team-standard",
      "success": true
    },
    {
      "timestamp": "2026-02-14T09:15:00Z",
      "member": "mike@company.com",
      "action": "update",
      "component": "agent:openagent",
      "versionFrom": "0.7.0",
      "versionTo": "0.7.1",
      "source": "team-update",
      "success": true
    },
    {
      "timestamp": "2026-02-13T16:20:00Z",
      "member": "bob@company.com",
      "action": "create-preset",
      "component": "preset:my-openagent",
      "base": "agent:openagent",
      "approved": false,
      "success": true
    }
  ]
}
```

**Query Audit Log**:
```bash
# View recent activity
oac team audit

📊 Team Audit Log (Last 7 days)

2026-02-14 10:30 AM - sarah@company.com
  Installed: agent:frontend-specialist@1.2.0
  Source: team-standard
  
2026-02-14 09:15 AM - mike@company.com
  Updated: agent:openagent 0.7.0 → 0.7.1
  Source: team-update
  
2026-02-13 4:20 PM - bob@company.com
  Created: preset:my-openagent
  Status: Pending approval

# Filter by member
oac team audit --member bob@company.com

# Filter by action
oac team audit --action install

# Filter by component
oac team audit --component openagent

# Export audit report
oac team audit --export audit-report-2026-02.csv
```

---

### 5.4 Policy Enforcement

**Feature**: Configurable policies for team governance

**Policy Configuration**:
```json
{
  "policies": {
    "versioning": {
      "enforceVersions": true,        // Require exact versions
      "allowBeta": false,             // Block beta versions
      "requireLockfile": true,        // Must use oac.lock
      "autoUpdate": false             // No auto-updates
    },
    "customization": {
      "allowPresets": true,           // Allow personal presets
      "requireApproval": true,        // Presets need approval
      "allowOverrides": false,        // No context overrides
      "allowCustomAgents": false      // No unauthorized agents
    },
    "compliance": {
      "enforceStandards": true,       // Enforce team standards
      "minimumCompliance": 90,        // 90% compliance required
      "blockOnDrift": true,           // Block commits if non-compliant
      "auditAll": true                // Audit all actions
    },
    "security": {
      "requireVerified": true,        // Only verified components
      "blockExternalSources": false,  // Allow GitHub sources
      "scanComponents": true,         // Scan for malware/secrets
      "requireSignatures": false      // GPG signatures required
    }
  }
}
```

**Enforcement**:
```bash
# Developer tries to install beta version
oac add agent:openagent@0.8.0-beta

❌ Policy Violation: Beta versions not allowed

Team policy: allowBeta = false
You requested: openagent@0.8.0-beta (beta)

? Actions:
  > Use stable version (0.7.1)
    Request policy exception
    Learn more about team policies

# Developer tries to commit with low compliance
git commit -m "Add feature"

❌ Pre-commit Check Failed

OAC Compliance: 85% (minimum: 90%)

Issues:
- Missing: frontend-specialist (required)
- Old version: openagent@0.6.5 (team: 0.7.1)

Policy: blockOnDrift = true

? Actions:
  > Fix compliance now (sync with team)
    Request exception
    Skip pre-commit check (not recommended)
```

---

### 5.5 Easy Onboarding for New Hires

**Feature**: One-command onboarding with guided setup

**Onboarding Command**:
```bash
oac onboard

╔════════════════════════════════════════════════════╗
║  Welcome to Frontend Team! 👋                      ║
║  Let's get you set up in 5 minutes.               ║
╚════════════════════════════════════════════════════╝

Step 1/5: Team Detection
  ✓ Detected team: Frontend Team
  ✓ Team lead: john@company.com
  ✓ Team size: 8 members

Step 2/5: Configuration
  ✓ Found lockfile: oac.lock
  ✓ Components: 6 (4 agents, 2 contexts)
  ✓ IDE: OpenCode

Step 3/5: Installation
  ⚡ Installing team configuration...
  ✓ agent:openagent@0.7.1
  ✓ agent:frontend-specialist@1.2.0
  ✓ context:team-standards@1.0.0
  ✓ context:react-patterns@1.5.0

Step 4/5: Verification
  ✓ All components installed
  ✓ Team standards loaded
  ✓ Compliance: 100%

Step 5/5: Resources
  📚 Team Wiki: https://wiki.company.com/frontend
  💬 Slack: #frontend-team
  👤 Team Lead: john@company.com

✅ Onboarding complete! (4m 32s)

? Start interactive tutorial? (Y/n)
```

---

## 6. Example Scenarios (Detailed)

### Scenario 1: Team Setup from Scratch

**Persona**: John, Engineering Manager  
**Goal**: Set up standardized development environment for new team  
**Team Size**: 8 developers  
**Tech Stack**: React, TypeScript, Node.js

**Timeline**: Week 1 - Project Kickoff

**Monday: Initial Setup**

```bash
# Create new project
mkdir company-frontend && cd company-frontend
git init
npm init -y

# Initialize OAC for team
oac team init

Welcome to OAC Team Setup! 👥

? Team name: Frontend Team
? Owner (your email): john@company.com
? Team size: Small (2-10 developers)
? Primary tech stack: React, TypeScript, Node.js
? Strictness level: Balanced

📦 Recommended setup for React + TypeScript:
  
  Core Agents:
  - openagent@0.7.1 (AI pair programmer)
  - frontend-specialist@1.2.0 (React/TS expert)
  
  Specialists:
  - tester@2.0.1 (Test generation)
  - reviewer@1.8.0 (Code review)
  
  Contexts:
  - team-standards (coding guidelines)
  - react-patterns (React best practices)

? Install recommended setup? (Y/n) y

⚡ Installing team setup...
  ✓ 4 agents installed
  ✓ 2 contexts installed
  ✓ Generated oac.lock
  ✓ Generated oac-team.json

✅ Team setup complete!

# Customize team standards
oac context edit team-standards

[Editor opens with template]
# Frontend Team Coding Standards

## React
- Functional components only
- TypeScript strict mode
- Props interfaces above components

## Testing
- Vitest for unit tests
- 80% coverage minimum
- Test files: *.test.tsx

## Git
- Branch naming: feature/JIRA-XXX-description
- Commit messages: Conventional Commits
- PR: Minimum 1 approval

[Save and close]

✓ Updated: team-standards

# Configure policies
oac team policy set enforceVersions true
oac team policy set allowCustomization true
oac team policy set minimumCompliance 90

# Commit team configuration
git add .
git commit -m "Initial team OAC setup

- Team: Frontend Team (8 developers)
- Agents: openagent, frontend-specialist, tester, reviewer
- Contexts: team-standards, react-patterns
- Policies: Enforce versions, allow customization, 90% compliance
"
git remote add origin git@github.com:company/frontend.git
git push -u origin main

# Announce to team
echo "Team setup complete! 📦

Clone the repo and run 'oac onboard' to get started.

Repo: git@github.com:company/frontend.git
" | slack-send #frontend-team

✓ Setup time: 30 minutes
```

**Tuesday: First Team Member Onboards (Sarah)**

```bash
# Sarah joins team
git clone git@github.com:company/frontend.git
cd frontend

# Run onboarding
oac onboard

╔════════════════════════════════════════════════════╗
║  Welcome to Frontend Team! 👋                      ║
╚════════════════════════════════════════════════════╝

🔍 Detecting configuration...
  ✓ Team: Frontend Team
  ✓ Lockfile: oac.lock
  ✓ Components: 6

⚡ Installing...
  [Progress bar: 100%]

✅ Setup complete! (3m 45s)

? Start tutorial? (Y/n) y

# Interactive tutorial
# ... (5 minutes) ...

# Sarah starts coding
> create a Button component

Agent (using team-standards):
  ✓ Functional component
  ✓ TypeScript
  ✓ Props interface above
  ✓ Test file included

Created:
  components/Button/
    Button.tsx
    Button.test.tsx
    index.ts

✅ Follows team standards

✓ Sarah productive in 15 minutes (vs 4 hours previously)
```

**Results**:
- Setup time: 30 minutes (one-time)
- Onboarding time: 15 minutes (per developer)
- Team compliance: 100% from day 1
- Zero configuration drift

---

### Scenario 2: New Developer Onboarding (First Day)

**Persona**: Sarah, Junior Developer (first dev job)  
**Goal**: Get productive on first day  
**Context**: Joining established team with existing OAC setup

**Hour 1: HR & Setup (9am - 10am)**
- Get laptop
- Create accounts
- Clone repos

**Hour 2: Development Environment (10am - 11am)**

```bash
# 10:00 AM - Clone project
cd ~/Projects
git clone git@github.com:company/frontend-app.git
cd frontend-app

# 10:05 AM - Install dependencies
npm install  # Takes 3 minutes

# 10:08 AM - Run OAC onboarding
oac onboard

╔════════════════════════════════════════════════════╗
║  Welcome to Frontend Team! 👋                      ║
║  Hi Sarah! Let's get you set up.                   ║
╚════════════════════════════════════════════════════╝

🔍 Detecting your setup...
  ✓ Git: Configured (sarah@company.com)
  ✓ Node: v18.16.0
  ✓ IDE: OpenCode detected
  ✓ Team: Frontend Team (8 members)
  ✓ Team lead: john@company.com

📦 Installing team configuration...
  
  Components (from oac.lock):
  ⠋ agent:openagent@0.7.1        [████████████░░] 80%
  ✓ agent:frontend-specialist@1.2.0
  ✓ agent:tester@2.0.1
  ✓ context:team-standards@1.0.0
  ✓ context:react-patterns@1.5.0
  ✓ skill:git-workflow@0.8.0

⚡ Configuring...
  ✓ Team standards applied
  ✓ Approval gates configured
  ✓ Git hooks installed

✅ Installation complete! (4m 12s)

📊 Verification...
  ✓ All components installed
  ✓ Team compliance: 100%
  ✓ IDE configured

╔════════════════════════════════════════════════════╗
║  You're all set! 🎉                                ║
╚════════════════════════════════════════════════════╝

📚 Resources for you:
  - Team wiki: https://wiki.company.com/frontend
  - Code standards: oac context show team-standards
  - React patterns: oac context show react-patterns
  - Slack: #frontend-team
  - Your buddy: mike@company.com

🎯 Your first task:
  Review this PR to learn our code style:
  https://github.com/company/frontend-app/pull/456

? Start 5-minute interactive tutorial? (Y/n) y

# 10:12 AM - Interactive tutorial
╔════════════════════════════════════════════════════╗
║  Quick Tutorial (5 minutes)                        ║
╚════════════════════════════════════════════════════╝

Lesson 1/4: Team Standards
  Your team has coding standards in: team-standards
  
  Let's view them:
  $ oac context show team-standards
  
  [Shows standards]
  
  ✓ These are automatically enforced by your agents

Lesson 2/4: Creating Components
  Let's create a simple Button component:
  
  > create a Button component with TypeScript
  
  Agent response:
  ✓ Created components/Button/Button.tsx (functional, TS)
  ✓ Created components/Button/Button.test.tsx (Vitest)
  ✓ Follows team standards
  
  💡 Try it yourself!

Lesson 3/4: Running Tests
  $ npm test
  ✓ All tests pass
  
  💡 Write tests for all new components

Lesson 4/4: Getting Help
  - Ask in #frontend-team
  - Your buddy: mike@company.com  
  - Team lead: john@company.com
  - OAC help: oac team --help

╔════════════════════════════════════════════════════╗
║  Tutorial Complete! 🎓                             ║
║  You're ready to code!                             ║
╚════════════════════════════════════════════════════╝

# 10:17 AM - Tutorial complete
✓ Onboarding time: 17 minutes total
```

**Hour 3: First Tasks (11am - 12pm)**

```bash
# 11:00 AM - Review PR (learning task)
# Sarah reviews PR #456, learns code style

# 11:30 AM - First commit
> create a simple Avatar component

Agent (using team-standards):
  Creating component following team standards...
  
  ✓ components/Avatar/Avatar.tsx
  ✓ components/Avatar/Avatar.test.tsx
  ✓ components/Avatar/Avatar.stories.tsx
  
  All files follow team standards ✓

# Commit
git add components/Avatar
git commit -m "feat: Add Avatar component"

# Pre-commit hook runs
✓ OAC compliance check: 100%
✓ Tests pass
✓ Linting pass

# Push
git push origin feature/JIRA-789-avatar

# Create PR
gh pr create --title "feat: Add Avatar component"

✓ PR created: #457
✓ CI checks running...
✓ All checks pass

# 11:45 AM - First PR merged!
✓ PR approved by mike@company.com
✓ Merged to main

# Sarah is fully productive by hour 3 of day 1!
```

**Results**:
- Time to setup: 17 minutes
- Time to first commit: 3 hours
- Time to first merged PR: 4 hours
- Team compliance: 100% from start
- Zero confusion about standards
- Zero questions about setup

**Comparison**:

| Metric | Before OAC | With OAC |
|--------|-----------|----------|
| Setup time | 4-8 hours | 17 minutes |
| First commit | 1-2 days | 3 hours |
| First PR merged | 2-3 days | 4 hours |
| Setup questions | 10-20 | 0-2 |
| Compliance issues | 5-10 | 0 |
| Onboarding buddy time | 4-6 hours | 30 minutes |

---

### Scenario 3: Handling Version Conflicts (Mid-Sprint)

**Persona**: Mike, Senior Developer  
**Goal**: Add new testing library that requires newer agent  
**Context**: Team on `openagent@0.7.1`, new library needs `@0.8.0`

**Wednesday Morning: Discovery**

```bash
# Mike wants to add Playwright specialist
oac add agent:playwright-specialist

⚠ Dependency Conflict

Component: agent:playwright-specialist@1.0.0
Requires: agent:openagent@^0.8.0

Your current setup:
  agent:openagent@0.7.1 (from team standard)

Team standard:
  agent:openagent@0.7.1 (locked in oac.lock)

Conflict: Cannot install without updating openagent

? How would you like to resolve?
  > Request team update (contact team lead)
    Find compatible version (alternative)
    Override locally (breaks team standard - not recommended)
    Cancel installation

# Mike requests team update
? Request team update

📝 Creating update request...

? Reason for update:
Need Playwright specialist for e2e testing.
Playwright specialist requires openagent@0.8.0.

? Priority:
  > Medium (this sprint)
    High (blocking)
    Low (nice to have)

? Impact:
  Will require all team members to update openagent.
  No breaking changes expected (checked changelog).

✓ Request sent to team lead (john@company.com)

📧 Request created:
  - ID: REQ-001
  - Component: agent:openagent 0.7.1 → 0.8.0
  - Requested by: mike@company.com
  - Status: Pending review
  
💡 Track status: oac team requests
💡 Team lead notified via Slack and email
```

**Wednesday Afternoon: Team Lead Review**

```bash
# John reviews request
oac team requests

📬 Pending Update Requests (1)

REQ-001: openagent@0.7.1 → 0.8.0
  Requested by: mike@company.com
  Reason: Need Playwright specialist for e2e testing
  Priority: Medium (this sprint)
  
  Impact Analysis:
    - Affects: 8/8 team members
    - Breaking changes: None
    - Dependencies: Compatible with all current agents
    - Team adoption: Will require sync
    
  Changelog (0.7.1 → 0.8.0):
    ✓ Improved delegation logic
    ✓ Fixed approval gate bug
    ✓ New context loading patterns
    ❌ No breaking changes

? Action:
  > Approve and schedule update
    Approve immediately
    Request more information
    Reject with reason
    Test in pilot first

# John approves with schedule
? Approve and schedule update

? Rollout strategy:
  > Staged (pilot → gradual → full)
    Immediate (all members now)
    Scheduled (specific date/time)

# Staged rollout
? Pilot members:
  ✓ mike@company.com (requester)
  ✓ sarah@company.com

? Pilot duration: 24 hours

? Full rollout: If pilot successful, roll out to full team

✓ Update approved!

📅 Rollout Schedule:
  
  Stage 1: Pilot (2 members)
    - mike@company.com
    - sarah@company.com
    Start: Now
    Duration: 24 hours
    
  Stage 2: Gradual (4 members)
    - jane@company.com
    - bob@company.com
    - alice@company.com
    - tom@company.com
    Start: If pilot successful
    Duration: 24 hours
    
  Stage 3: Full (remaining 2)
    - lisa@company.com
    - charlie@company.com
    Start: If gradual successful
    
📧 Notifications sent:
  - Pilot members: Update available now
  - Other members: Update scheduled
  - Slack: Posted to #frontend-team

? Proceed with pilot? (Y/n) y

✓ Pilot rollout started
```

**Wednesday Evening: Pilot Stage**

```bash
# Mike gets notification
⚠ Team Update Available (Pilot)

Component: agent:openagent@0.8.0
Your role: Pilot tester
Status: Approved by john@company.com

Changes:
  - Improved delegation logic
  - Fixed approval gate bug
  - New context loading patterns

? Install pilot update now? (Y/n) y

⚡ Installing openagent@0.8.0 (pilot)...
  ✓ Backed up current version (0.7.1)
  ✓ Installed openagent@0.8.0
  ✓ Updated dependencies

✅ Pilot update installed

⚠ You're now in pilot mode

Please test the update and report:
  - Any issues: oac team pilot report-issue
  - Works well: oac team pilot approve
  - Critical problems: oac team pilot reject

Testing period: 24 hours

# Mike tests for a few hours
# Everything works great

# Mike approves pilot
oac team pilot approve

✓ Pilot approved by mike@company.com

Feedback:
  ? Works as expected? ✓ Yes
  ? Any issues? ✗ None
  ? Comments: Delegation seems faster, no issues

✓ Feedback submitted

# Sarah also approves
# (similar process)

# Team lead sees pilot results
oac team rollout status

📊 Pilot Results: openagent@0.8.0

Status: ✓ Successful
Duration: 24 hours
Participants: 2/2

Feedback:
  ✓ mike@company.com: Approved, no issues
  ✓ sarah@company.com: Approved, works great

Issues: 0

? Proceed to Stage 2 (Gradual rollout)? (Y/n) y
```

**Thursday: Gradual Rollout**

```bash
# 4 team members get notification
⚠ Team Update Available

Component: agent:openagent@0.8.0
Status: Pilot successful, rolling out

Pilot results:
  ✓ 2/2 approved
  ✓ 0 issues reported
  ✓ Feedback: Positive

? Install update now? (Y/n) y

# All 4 members install successfully
# Team lead monitors

oac team rollout status

📊 Gradual Rollout Progress

Stage 2: Gradual (4 members)
  ✓ jane@company.com: Installed
  ✓ bob@company.com: Installed  
  ✓ alice@company.com: Installed
  ⏳ tom@company.com: Pending (on vacation)

Status: 3/4 completed (75%)

? Action:
  > Wait for tom@company.com
    Skip tom (complete stage 2)
    Pause rollout

# Skip tom (he's on vacation)
✓ Stage 2 complete (skipping tom)

? Proceed to Stage 3? (Y/n) y
```

**Friday: Full Rollout Complete**

```bash
# Final 2 members update
# Rollout complete

oac team status

📊 Team Update Complete: openagent@0.8.0

✅ Rollout successful!

Timeline:
  Wed 2pm: Pilot started (2 members)
  Thu 2pm: Gradual rollout (4 members)
  Fri 10am: Full team (8 members)
  
Adoption: 7/8 (87.5%)
  ✓ 7 members on 0.8.0
  ⏳ 1 member pending (tom - on vacation)

Issues: 0

Next:
  - Tom will auto-update on return
  - Mike can now install playwright-specialist

# Mike installs Playwright specialist
oac add agent:playwright-specialist

✓ Dependency check: openagent@0.8.0 (satisfied)
✓ Installing agent:playwright-specialist@1.0.0

✅ Installation complete!

# Team successfully updated, zero disruption
```

**Results**:
- Total time: 3 days (staged rollout)
- Issues: 0
- Team disruption: Minimal (staged approach)
- Pilot caught potential issues: N/A (clean update)
- Rollback needed: No

---

### Scenario 4: Enforcing Standards (Code Review Crisis)

**Persona**: John, Team Lead  
**Problem**: PRs have inconsistent code style, reviews taking too long  
**Goal**: Enforce team standards automatically

**Monday: Problem Recognition**

```bash
# John reviews recent PRs
# Notices issues:
# - Inconsistent component structure
# - Mixed class/functional components
# - No test files
# - Inconsistent file naming

# Current state: Standards documented but not enforced
# Solution: Create enforced team standards context
```

**Tuesday: Create Enforceable Standards**

```bash
# Create team standards context
oac create context team-standards --required

# Edit with enforceable rules
oac context edit team-standards

# Content:
---
version: 1.0.0
enforcement: strict
rules:
  - id: functional-components
    level: error
    description: Use functional components only
  - id: typescript
    level: error
    description: All components must use TypeScript
  - id: test-files
    level: error
    description: All components must have test files
  - id: file-naming
    level: error
    description: PascalCase for components, camelCase for utils
---

# Frontend Team Coding Standards

## React Components

### Structure (REQUIRED)
```typescript
// components/Button/Button.tsx

import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
}

export const Button: React.FC<ButtonProps> = ({ label, onClick }) => {
  return <button onClick={onClick}>{label}</button>;
};
```

### Testing (REQUIRED)
```typescript
// components/Button/Button.test.tsx

import { render, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    const { getByText } = render(<Button label="Click me" onClick={handleClick} />);
    fireEvent.click(getByText('Click me'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

### File Structure (REQUIRED)
```
components/
  Button/
    Button.tsx        # Component (required)
    Button.test.tsx   # Tests (required)
    Button.stories.tsx # Storybook (recommended)
    index.ts          # Barrel export (required)
```

## Enforcement

Agents will:
✓ Generate components following this structure
✓ Create test files automatically
✓ Use TypeScript with strict mode
✓ Follow file naming conventions
❌ Reject class components
❌ Reject components without tests
❌ Reject non-TypeScript files

[Save]

# Make context required and locked
oac team add context:team-standards@1.0.0 --required --locked

✓ Added as required (cannot be overridden)
✓ All team members must use this context

# Configure agents to enforce strictly
oac team config set agents.frontend-specialist.strictMode true
oac team config set agents.frontend-specialist.requireTests true

# Update lockfile and push
oac lock update
git add .oac/ oac.lock oac-team.json
git commit -m "feat: Add enforced team standards

- Created team-standards context (required, locked)
- Configured strict enforcement
- All components must:
  - Use functional components (TS)
  - Include test files
  - Follow file structure
"
git push origin main

# Announce to team
slack-send #frontend-team "📋 New Team Standards Enforced

We've added enforced coding standards to improve PR quality.

Changes:
- All components must be functional (TypeScript)
- Test files required for all components
- Strict file structure

Action: Pull latest and run 'oac team sync'

Agents will automatically follow these standards.
Old code is grandfathered in.
"

✓ Standards deployed
```

**Wednesday: Team Syncs**

```bash
# Team members pull and sync
git pull
oac team sync

⚠ Team Configuration Updated

New required component:
  + context:team-standards@1.0.0 (required, locked)

Agent configuration updated:
  - frontend-specialist: Strict mode enabled
  - frontend-specialist: Tests required

? Sync with team standard? (Y/n) y

⚡ Syncing...
  ✓ Installed: context:team-standards@1.0.0
  ✓ Updated: agent configuration

✅ Synced with team standard

💡 Try creating a component to see standards in action:
    > create a Card component
```

**Wednesday Afternoon: Standards in Action**

```bash
# Sarah creates a component
> create a Card component with title and description props

Agent (using team-standards):
  Creating component following team standards...
  
  ✓ Enforcing: Functional component (TypeScript)
  ✓ Enforcing: Test file required
  ✓ Enforcing: File structure

Created:
  components/Card/
    Card.tsx          # Functional component, TypeScript
    Card.test.tsx     # Vitest tests
    Card.stories.tsx  # Storybook stories
    index.ts          # Barrel export

All files follow team standards ✓

# Bob tries to create class component (bad habit)
> create a Modal component using class

Agent (using team-standards):
  ❌ Enforcement: Class components not allowed
  
  Team standard requires functional components.
  Creating functional component instead...

Created:
  components/Modal/
    Modal.tsx         # Functional (not class)
    Modal.test.tsx
    index.ts

✓ Converted to functional component (team standard)

# Mike forgets to add tests
> create a Dropdown component

Agent (using team-standards):
  Creating component...
  
  ✓ components/Dropdown/Dropdown.tsx
  ✓ components/Dropdown/Dropdown.test.tsx (auto-generated)
  ✓ components/Dropdown/index.ts

✓ Test file automatically created (required by team)
```

**Thursday: PR Quality Improves**

```bash
# John reviews PRs
# All PRs now:
# ✓ Functional components (TypeScript)
# ✓ Include test files
# ✓ Follow file structure
# ✓ Consistent style

# PR review time drops from 30min to 10min
# Style comments: Eliminated
# Focus shifts to logic and business requirements

# Team velocity increases
```

**Results**:
- PR review time: 30min → 10min (67% reduction)
- Style issues in PRs: ~15/PR → 0/PR (100% reduction)
- Test coverage: 60% → 95% (automatically enforced)
- Team consistency: 100% (enforced by agents)
- Developer happiness: Higher (less nitpicking in reviews)

---

### Scenario 5: Migration to New Version (Breaking Changes)

**Persona**: John, Team Lead  
**Challenge**: Migrate team from OAC v0.7.x to v1.0.0 (breaking changes)  
**Team Size**: 8 developers  
**Risk**: High (breaking changes)

**Week 1: Planning & Testing**

**Monday: Assessment**

```bash
# Check migration requirements
oac team migrate --check

📦 Migration Available: v0.7.1 → v1.0.0

⚠ Breaking Changes Detected:

1. Approval Gates Configuration
   - Old format: approval.gates = ["bash", "write"]
   - New format: permissions.bash = "approve"
   - Impact: All team members (auto-migrated)

2. Context Resolution
   - Old: Single context path
   - New: Layered resolution (project → global)
   - Impact: Custom context paths need update

3. Preset System
   - Old: No presets
   - New: Preset metadata required
   - Impact: Custom agents need migration

Migration Complexity: Medium
Estimated Time: 2-4 hours (full team)
Auto-Migration: 80% (manual review needed)

? View detailed migration guide? (Y/n) y
```

**Migration Guide**:
```bash
📚 Migration Guide: v0.7.1 → v1.0.0

## Step 1: Backup (5 minutes)
```bash
oac team backup
# Creates: .oac/backups/team-backup-2026-02-14.tar.gz
```

## Step 2: Create Migration Branch (2 minutes)
```bash
git checkout -b oac-v1-migration
```

## Step 3: Run Migration Tool (10-15 minutes)
```bash
oac team migrate --to v1.0.0
# Auto-migrates: configs, presets, contexts
# Outputs: migration-report.md
```

## Step 4: Manual Review (30-60 minutes)
- Review updated configs
- Test approval gates
- Verify context resolution

## Step 5: Pilot Test (1-2 days)
- Test with 2-3 developers
- Collect feedback
- Fix issues

## Step 6: Full Rollout (1-2 days)
- Roll out to full team
- Monitor for issues
- Provide support

Total Time: 3-5 days (cautious approach)

? Start migration planning? (Y/n) y
```

**Tuesday: Migration Execution**

```bash
# Create backup
oac team backup

✓ Backup created: .oac/backups/team-backup-2026-02-14.tar.gz
✓ Includes: all configs, agents, contexts, lockfile

# Create migration branch
git checkout -b oac-v1-migration

# Run migration tool
oac team migrate --to v1.0.0

⚡ Running Migration: v0.7.1 → v1.0.0

Phase 1: Analysis
  ✓ Scanning configurations...
  ✓ Detecting breaking changes...
  ✓ Planning migrations...

Phase 2: Backup
  ✓ Backed up all configs

Phase 3: Auto-Migration
  ⚡ Migrating approval gates config...
    ✓ Converted 8 configurations
    
  ⚡ Migrating context resolution...
    ✓ Updated context paths
    ⚠ 2 custom contexts need manual review
    
  ⚡ Migrating presets...
    ✓ Added metadata to 3 custom agents
    
  ⚡ Updating lockfile...
    ✓ Generated new oac.lock (v1.0.0 format)

Phase 4: Validation
  ✓ Validating configurations...
  ⚠ 2 warnings (see migration-report.md)
  ✓ No errors

✅ Migration Complete (80% automated)

📊 Migration Summary:
  - Configurations migrated: 8/8
  - Auto-migrated: 80%
  - Manual review needed: 2 items
  - Breaking changes handled: 3/3
  
⚠ Action Required:
  1. Review: migration-report.md
  2. Fix: 2 manual migration items
  3. Test: oac doctor
  4. Commit: git commit -m "Migrate to OAC v1.0.0"

? Open migration report? (Y/n) y
```

**Migration Report** (`migration-report.md`):
```markdown
# OAC Migration Report: v0.7.1 → v1.0.0

**Date**: 2026-02-14  
**Team**: Frontend Team  
**Status**: ⚠ Needs Manual Review

## Summary

✅ Auto-migrated: 80%  
⚠ Manual review: 2 items  
❌ Errors: 0

## Auto-Migrations Completed

### 1. Approval Gates Configuration
✅ Migrated all 8 team member configurations

Old format:
```json
"approval": {
  "gates": ["bash", "write", "edit"]
}
```

New format:
```json
"permissions": {
  "bash": "approve",
  "write": "approve",
  "edit": "approve"
}
```

### 2. Context Resolution
✅ Updated context paths for layered resolution

Changes:
- Updated project context paths
- Added context priority configuration
- Migrated global context references

### 3. Preset System
✅ Added metadata to 3 custom agents

Custom agents migrated:
- bob-custom-tester → preset:bob-custom-tester
- sarah-reviewer → preset:sarah-reviewer
- mike-debugger → preset:mike-debugger

## Manual Review Required

### 1. Custom Context Paths (bob@company.com)
⚠ Manual review needed

**Issue**: Bob has custom context override that conflicts with new layered resolution

**Location**: `/Users/bob/.opencode/context/custom-patterns.md`

**Action Required**:
1. Review custom context
2. Move to: `.oac/context/override/` (new override location)
3. OR: Integrate into team-standards

**Priority**: Medium (affects 1 member)

### 2. Legacy Agent Format (alice@company.com)
⚠ Manual review needed

**Issue**: Alice has very old custom agent (v0.3.x format)

**Location**: `/Users/alice/.opencode/agent/legacy-agent.md`

**Action Required**:
1. Update to v1.0.0 format
2. OR: Remove if no longer needed
3. Test after update

**Priority**: Low (custom agent, optional)

## Testing Checklist

Before pilot rollout:

- [ ] Test approval gates (new format)
- [ ] Test context resolution (layered)
- [ ] Test presets (new metadata)
- [ ] Verify all agents load correctly
- [ ] Run: `oac doctor`

## Rollback Plan

If issues occur:

```bash
oac team rollback --to backup-2026-02-14
```

This will restore all configurations to pre-migration state.

## Next Steps

1. Fix manual review items (Bob, Alice)
2. Run `oac doctor` to validate
3. Start pilot with 2 members
4. Full rollout after successful pilot
```

**Wednesday: Fix Manual Items**

```bash
# Contact Bob
slack-send @bob "Hey Bob, migration to OAC v1.0 needs your help.

You have a custom context that needs updating:
  /Users/bob/.opencode/context/custom-patterns.md

Options:
1. Move to new override location (5 min)
2. Integrate into team-standards (15 min)

Can you handle this today? Let me know if you need help.
"

# Bob fixes
# (moves custom context to new location)

# Contact Alice
slack-send @alice "Hey Alice, found an old custom agent during migration:
  /Users/alice/.opencode/agent/legacy-agent.md

Is this still needed? If not, we can remove it.
If yes, needs update to v1.0.0 format (I can help).
"

# Alice confirms not needed
# Removed

# Validate migration
oac doctor

✓ All configurations valid
✓ All agents load correctly
✓ Context resolution working
✓ Presets migrated successfully

✅ Migration ready for testing
```

**Thursday: Pilot Test**

```bash
# Designate pilot members
oac team pilot add sarah@company.com mike@company.com

? Pilot duration: 1 day

✓ Pilot group created (2 members)

📧 Sent to pilot members:
  "You've been selected for OAC v1.0 pilot test.
  
  Please:
  1. git checkout oac-v1-migration
  2. oac install --frozen
  3. Test for 1 day
  4. Report: oac team pilot feedback
  
  Questions? #oac-migration"

# Pilot members test
# Sarah tests, no issues
# Mike tests, no issues

# Collect feedback
oac team pilot report

📊 Pilot Test Results (1 day)

Participants: 2/2
Completion: 100%

Feedback:
✓ sarah@company.com:
  - No issues
  - Approval gates clearer
  - Likes new preset system
  
✓ mike@company.com:
  - No issues
  - Context resolution faster
  - No problems

Issues Reported: 0
Critical Bugs: 0

Recommendation: ✅ Ready for full rollout

? Proceed with full team rollout? (Y/n) y
```

**Friday: Full Rollout**

```bash
# Merge migration branch
git checkout main
git merge oac-v1-migration
git push origin main

# Announce rollout
oac team announce

📢 OAC v1.0 Migration - Ready to Roll Out

What: Upgrade to OAC v1.0.0
When: Now (pull latest from main)
Duration: 5 minutes per person

Breaking Changes (auto-migrated):
✓ Approval gates (new format)
✓ Context resolution (layered)
✓ Presets (new metadata)

Tested By:
✓ sarah@company.com (no issues)
✓ mike@company.com (no issues)

Action Required:
1. git pull
2. oac install --frozen
3. Test your workflow
4. Report issues: #oac-migration

Estimated time: 5 minutes

Rollback available if needed.

? Send to team? (Y/n) y

✓ Sent to #frontend-team
✓ Emails sent to all members

# Track rollout
oac team status

📊 Migration Progress: v1.0.0

Completed: 6/8 (75%)
In Progress: 2/8 (25%)
Issues: 0

Timeline:
- 10am: sarah ✓
- 10:15am: mike ✓
- 11am: jane ✓
- 11:30am: bob ✓
- 1pm: alice ✓
- 2pm: tom ✓
- Pending: lisa, charlie

✅ Migration going smoothly

# End of day: 8/8 complete
✓ Full team migrated
✓ Zero issues
✓ Total time: 3 days (cautious approach)
```

**Results**:
- Planning: 1 day
- Migration execution: 1 day
- Pilot test: 1 day
- Full rollout: 1 day (completed in hours)
- Total: 3 days (actual) vs 4 days (estimated)
- Issues: 0
- Rollbacks: 0
- Team disruption: Minimal

---

## Summary

### Key Insights for Team Leads

**What OAC Solves**:
1. ✅ **Onboarding**: 4 hours → 15 minutes
2. ✅ **Consistency**: 100% team alignment
3. ✅ **Standards**: Automatically enforced
4. ✅ **Updates**: Coordinated across team
5. ✅ **Visibility**: Full audit trail

**What OAC Needs**:
1. 🚨 **Lockfile**: For reproducibility
2. 🚨 **Team Dashboard**: Real-time compliance
3. 🚨 **Audit Trail**: Who installed what, when
4. 🚨 **Policy Enforcement**: Configurable governance
5. 🚨 **Rollout Management**: Staged updates with rollback

**Must-Have Commands**:
```bash
oac team init           # Set up team standards
oac team status         # Check team compliance
oac team sync           # Sync with team standard
oac team update         # Coordinate updates
oac team dashboard      # Team health overview
oac team audit          # Installation audit trail
oac team policy         # Configure policies
oac onboard             # One-command onboarding
oac team migrate        # Version migration
oac team rollout        # Staged rollout management
```

**Success Metrics**:
- Onboarding time: <30 minutes
- Team compliance: >95%
- PR review time: -50%
- Setup questions: -90%
- Version drift: 0%

---

**Next Steps**: Use these scenarios to validate OAC design and implementation priorities.
