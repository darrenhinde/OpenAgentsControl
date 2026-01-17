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

## 📊 Example Session

```bash
$ /build-context-system

## Building Your Context-Aware AI System

I'll guide you through creating a complete .opencode system tailored to your needs.

**Process Overview**:
- Phase 1: Domain & Purpose (2-3 questions)
- Phase 2: Use Cases & Workflows (3-4 questions)
- Phase 3: Complexity & Scale (2-3 questions)
- Phase 4: Integration & Tools (2-3 questions)
- Phase 5: Review & Confirmation

Let's begin! 🚀

---

**Question 1:** What is your primary domain or industry?

> E-commerce and online retail

**Question 2:** What is the primary purpose of your AI system?

> Automate order processing and customer support workflows

**Question 3:** Who are the primary users?

> Customer support teams and operations managers

---

## Domain Type Detected: business

Your domain is **business-focused**.

I'll adapt questions to cover:
- Business processes to automate
- Reports and documents to generate
- Customer touchpoints and workflows
- Compliance and quality requirements

---

**Question 4:** What are your top 3-5 use cases?

> 1. Process customer orders from multiple channels
> 2. Triage and route support tickets
> 3. Generate daily sales reports
> 4. Handle returns and refunds
> 5. Send order status notifications

**Question 5:** For each use case, what is the typical complexity?

> 1. Moderate - multi-step with some decision points
> 2. Moderate - requires categorization and routing
> 3. Simple - straightforward data aggregation
> 4. Complex - multiple approvals and state tracking
> 5. Simple - template-based notifications

---

[... more questions ...]

---

## System Architecture Summary

**Domain**: E-commerce Operations
**Purpose**: Automate order processing and customer support
**Users**: Support teams, operations managers

**System Components**:

### Agents (5)
1. **ecommerce-orchestrator** - Main coordinator
2. **order-processor** - Handles order workflows
3. **ticket-router** - Triages support tickets
4. **report-generator** - Creates sales reports
5. **notification-sender** - Sends customer updates

### Context Files (12)
- Domain: order-types, customer-data, product-catalog
- Processes: order-workflow, ticket-routing, refund-process
- Standards: quality-criteria, validation-rules
- Templates: email-templates, report-formats

### Workflows (5)
- process-order
- route-ticket
- generate-report
- handle-refund
- send-notification

### Custom Commands (5)
- /process-order {order_id}
- /route-ticket {ticket_id}
- /generate-report {type} {date}
- /handle-refund {order_id}
- /notify-customer {order_id} {status}

---

**Does this architecture meet your needs?**

Options:
- ✅ Proceed - Generate the complete system
- 🔄 Revise - Adjust specific components
- ❌ Cancel - Start over

> ✅ Proceed

---

▶ Generating system...

✓ Generated ecommerce-orchestrator
✓ Generated 4 specialized agents
✓ Generated 12 context files
✓ Generated 5 workflows
✓ Generated 5 custom commands
✓ Generated documentation

## ✅ Your Context-Aware AI System is Ready!

**System**: E-commerce Operations AI System
**Location**: `.opencode/`
**Files Created**: 32

### 🚀 Quick Start

**Test your main command:**
/process-order "ORD-12345"

**Review your orchestrator:**
cat .opencode/agent/ecommerce-orchestrator.md

**Your system is production-ready!** 🎉
```

---

## 🎯 What Gets Generated

### 1. Main Orchestrator
- Analyzes request complexity
- Routes to specialized agents
- Manages context allocation
- Coordinates workflows

### 2. Specialized Agents
- Domain-specific expertise
- Clear triggers and responsibilities
- Optimized for your use cases

### 3. Context Files
- **Domain**: Core concepts, terminology, business rules
- **Processes**: Step-by-step workflows
- **Standards**: Quality criteria, validation rules
- **Templates**: Reusable output formats

### 4. Workflows
- Multi-stage processes
- Context dependencies mapped
- Success criteria defined
- Checkpoints included

### 5. Custom Commands
- Slash command syntax
- Clear descriptions
- Usage examples
- Expected outputs

### 6. Documentation
- System overview
- Architecture guide
- Testing checklist
- Quick start guide

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

- **Full Documentation**: `SYSTEM_BUILDER_REGISTRATION.md`
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
