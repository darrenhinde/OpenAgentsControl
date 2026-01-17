# Quick Start: System Builder

## 🎯 What is System Builder?

An **interactive AI system generator** that creates complete `.opencode` architectures tailored to your domain.

**Input:** Your requirements (via interview)  
**Output:** Complete AI system with agents, context, workflows, and commands

---

## 📦 Installation

### For Developers Who Want System Builder

```bash
# Install Advanced profile (includes system builder)
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s advanced
```

**What you get:**
- ✅ All development tools (19 components)
- ✅ Business tools (5 components)
- ✅ System builder (7 components)
- ✅ Additional tools (1 component)
- ✅ **Total: 32 components**

---

### Add to Existing Installation

Already have `developer` or `full` profile? Add system builder:

```bash
# Run advanced profile
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s advanced

# When prompted about collisions:
# Choose: 1) Skip existing

# Result: Only system-builder components added
```

---

## 🚀 Usage

### Step 1: Run the Command
```bash
/build-context-system
```

### Step 2: Answer Interview Questions

**Phase 1: Domain & Purpose**
- What's your domain? (e-commerce, data engineering, etc.)
- What's the purpose? (automate tasks, coordinate workflows, etc.)
- Who are the users? (developers, business users, etc.)

**Phase 2: Use Cases**
- What are your top 3-5 use cases?
- What's the complexity? (simple/moderate/complex)
- Any dependencies between tasks?

**Phase 3: Complexity & Scale**
- How many specialized agents needed?
- What types of knowledge? (domain/process/standards/templates)
- State management needs?

**Phase 4: Integrations**
- External tools/APIs?
- File operations?
- Custom commands needed?

**Phase 5: Review & Confirm**
- Review architecture summary
- Confirm or revise
- Generate system

### Step 3: Get Your Custom System

**Generated structure:**
```
.opencode/
├── agent/
│   ├── {your-domain}-orchestrator.md    # Main coordinator
│   └── subagents/
│       ├── {specialist-1}.md
│       ├── {specialist-2}.md
│       └── {specialist-3}.md
├── context/
│   ├── domain/                          # Your domain knowledge
│   ├── processes/                       # Your workflows
│   ├── standards/                       # Quality rules
│   └── templates/                       # Reusable patterns
├── workflows/
│   ├── {workflow-1}.md
│   └── {workflow-2}.md
├── command/
│   ├── /{custom-command-1}.md
│   └── /{custom-command-2}.md
└── README.md                            # Usage guide
```

---

## 💡 Use Cases

### For Developers
```bash
/build-context-system

Domain: Software Development
Purpose: Automate code review and testing
Result: Custom dev workflow system
```

### For Business Users
```bash
/build-context-system

Domain: Customer Support
Purpose: Automate ticket routing and responses
Result: Custom support automation system
```

### For Data Teams
```bash
/build-context-system

Domain: Data Engineering
Purpose: Automate ETL pipelines and validation
Result: Custom data pipeline system
```

### For Content Teams
```bash
/build-context-system

Domain: Content Marketing
Purpose: Generate and schedule content
Result: Custom content workflow system
```

---

## 🔧 Components Installed

When you install **advanced** profile, you get:

**System Builder Components:**
1. `system-builder` (agent) - Main orchestrator
2. `domain-analyzer` (subagent) - Analyzes domains
3. `agent-generator` (subagent) - Creates agents
4. `context-organizer` (subagent) - Organizes context
5. `workflow-designer` (subagent) - Designs workflows
6. `command-creator` (subagent) - Creates commands
7. `build-context-system` (command) - Interactive interface

**Plus all development tools:**
- openagent, task-manager, opencoder
- All core subagents (reviewer, tester, etc.)
- All development commands
- Tools and plugins

---

## 📚 Learn More

- **Full Documentation**: [README.md](README.md)
- **Detailed Guide**: [guide.md](guide.md)
- **Architecture Details**: `.opencode/agent/system-builder.md`
- **Command Reference**: `.opencode/command/build-context-system.md`

---

## ✅ Summary

**Installation:**
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s advanced
```

**Usage:**
```bash
/build-context-system
```

**Result:**
Complete custom AI system tailored to your domain! 🎉

---

**Ready to build your own AI system?** Install advanced profile and run `/build-context-system`!
