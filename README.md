<div align="center">

![OpenAgents Control Hero](docs/images/hero-image.png)

# OpenAgents Control (AOC)

### AI agent framework for plan-first development workflows with approval-based execution

**Multi-language support:** TypeScript • Python • Go • Rust  
**Features:** Automatic testing • Code review • Validation

[![GitHub stars](https://img.shields.io/github/stars/darrenhinde/OpenAgentsControl?style=flat-square&logo=github&labelColor=black&color=ffcb47)](https://github.com/darrenhinde/OpenAgentsControl/stargazers)
[![X Follow](https://img.shields.io/twitter/follow/DarrenBuildsAI?style=flat-square&logo=x&labelColor=black&color=1DA1F2)](https://x.com/DarrenBuildsAI)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb950?style=flat-square&labelColor=black)](https://opensource.org/licenses/MIT)
[![Last Commit](https://img.shields.io/github/last-commit/darrenhinde/OpenAgentsControl?style=flat-square&labelColor=black&color=8957e5)](https://github.com/darrenhinde/OpenAgentsControl/commits/main)

[🚀 Quick Start](#get-started-in-5-minutes) • [📖 Documentation](#how-it-works) • [🎥 Demo Video](https://youtu.be/EOIzFMdmox8) • [💬 Community](https://nextsystems.ai)

</div>

## Why I Built This

I've spent 14+ years shipping production software. I've watched AI agents burn through thousands of tokens generating code that doesn't match your project, doesn't follow your patterns, and doesn't actually work without heavy refactoring.

**The problem**: Most AI agents are like hiring a developer who doesn't know your codebase. They write generic code. You spend hours rewriting, refactoring, and fixing inconsistencies. Tokens burned. Time wasted. No actual work done.

**This system solves that**: AOC teaches agents your patterns upfront. They understand your coding standards, your architecture, your security requirements. They propose plans before implementing. They execute incrementally with validation. The result: **code that actually ships to production without heavy rework**.

This isn't a gimmick project. I use this every day to ship real production code. It works because it respects two things:
1. **Your time** - Agents propose plans, you approve before execution
2. **Your patterns** - Agents follow your standards automatically

**The result**: Production-ready code, not throwaway prototypes. No rework. No refactoring. Just ship.

**Full-stack development**: AOC handles both frontend and backend work. No need for separate developers—the agents coordinate to build complete features from UI to database.

---

## What Is AOC?

AOC is a **framework for AI-assisted development** that combines:
- **Plan-first workflows** - Agents propose plans before implementing
- **Context-aware execution** - Agents follow YOUR coding standards
- **Incremental validation** - Step-by-step implementation with quality checks

Think of it as having a senior developer who understands your project's patterns and asks for approval before making changes.

**Key insight**: The context system (your coding standards) is the secret weapon. Agents automatically load and follow your patterns, so code is consistent without manual configuration.

---

## Quick Navigation

- **New here?** → [What Is AOC?](#what-is-aoc) → [Get Started](#get-started-in-5-minutes)
- **Want to understand the system?** → [How It Works](#how-it-works) → [Context System](#-the-context-system-your-secret-weapon)
- **Ready to install?** → [Installation](#installation)
- **Building something?** → [Example Workflows](#example-workflows)

---

## Why Use AOC?

- ✅ **Multi-language support** - Works with TypeScript, Python, Go, Rust, and more
- ✅ **Plan-first workflow** - Agents propose plans before implementing
- ✅ **Incremental execution** - Step-by-step implementation with validation
- ✅ **Quality built-in** - Automatic testing, type checking, and code review
- ✅ **Your patterns** - Agents follow your coding standards from context files

---

## Get Started in 5 Minutes

**One command. That's it.**

```bash
# Quick install (developer profile)
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer
```

**Or use interactive installer:**
```bash
# Download the installer
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh -o install.sh

# Run interactively
bash install.sh
```

Then start building:
```bash
opencode --agent OpenAgent
> "Create a user authentication system"
```

**What happens:**
1. Analyzes your request
2. Proposes a plan (you approve)
3. Executes step-by-step with validation
4. Delegates to specialists when needed
5. Ships production-ready code

**That's the entire workflow.** No complex setup. No configuration. Just ship code.

---

## Recommended for New Users

**Start with `OpenAgent`** - a lightweight, versatile agent perfect for getting started. It handles multiple task types and is ideal for learning the system.

```bash
opencode --agent OpenAgent
> "Create a user authentication system"            # Building features
> "How do I implement authentication in Next.js?"  # Questions
> "Create a README for this project"               # Documentation
> "Explain the architecture of this codebase"      # Analysis
```

OpenAgent is a streamlined version that can handle most tasks while you learn the workflow. It automatically delegates to specialists when needed.

**Ready for advanced workflows?** Upgrade to `OpenCoder`:

```bash
opencode --agent OpenCoder
> "Create a user authentication system"                 # Full-stack features
> "Refactor this codebase to use dependency injection"  # Multi-file refactoring
> "Add real-time notifications with WebSockets"         # Complex implementations
```

OpenCoder is the full-featured development agent with rigorous workflows: Discover context → Propose plan → Get approval → Execute incrementally → Validate → Ship. It provides deeper context management, session tracking, and more sophisticated delegation to specialists (TaskManager, TestEngineer, CodeReviewer).

**Learn more:** 
- [OpenAgent Guide](docs/agents/openagent.md) - Lightweight, versatile agent for getting started
- [OpenCoder Guide](docs/agents/opencoder.md) - Advanced development workflows

---

## Installation

### Prerequisites
- **OpenCode CLI** - [Install here](https://opencode.ai/docs)
- **Bash 3.2+** (macOS default works)
- **Git** (for cloning)

### Install AOC

**Recommended: One-line install**
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer
```

**Alternative: Interactive installer**
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh -o install.sh
bash install.sh
```

**Manual install**
```bash
git clone https://github.com/darrenhinde/OpenAgentsControl.git
cd OpenAgentsControl
mkdir -p ~/.opencode
cp -r .opencode/agent ~/.opencode/
cp -r .opencode/command ~/.opencode/
cp -r .opencode/context ~/.opencode/
```

### Start Using It
```bash
opencode --agent OpenAgent
> "Create a user authentication system"
```

---

## 🌟 Liking This Project?

<div align="center">

**Join the community and stay updated with the latest AI development workflows!**

[![YouTube](https://img.shields.io/badge/YouTube-Darren_Builds_AI-red?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@DarrenBuildsAI)
[![Community](https://img.shields.io/badge/Community-NextSystems.ai-blue?style=for-the-badge&logo=discourse&logoColor=white)](https://nextsystems.ai)
[![X/Twitter](https://img.shields.io/badge/Follow-@DarrenBuildsAI-1DA1F2?style=for-the-badge&logo=x&logoColor=white)](https://x.com/DarrenBuildsAI)
[![Buy Me A Coffee](https://img.shields.io/badge/Support-Buy_Me_A_Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/darrenhinde)

**📺 Tutorials & Demos** • **💬 Join Waitlist** • **🐦 Latest Updates** • **☕ Support Development**

*Your support helps keep this project free and open-source!*

</div>

---

## Setup & Installation FAQ

**Q: Does this work on Windows?**  
A: Yes! Use Git Bash (recommended) or WSL. See [Platform Compatibility Guide](docs/getting-started/platform-compatibility.md) for details.

**Q: What bash version do I need?**  
A: Bash 3.2+ (works on macOS default bash). Run `bash scripts/tests/test-compatibility.sh` to check your system.

**Q: Do I need to install plugins/tools?**  
A: No, they're optional. Only install if you want Telegram notifications or Gemini AI features.

**Q: Where should I install - globally or per-project?**  
A: Global (`~/.opencode/`) works for most. Project-specific (`.opencode/`) if you need different configs per project.

**Q: How do I add my own coding patterns?**  
A: Edit `~/.opencode/context/project/project-context.md` - agents automatically load this file.

**Q: What languages are supported?**  
A: The agents work with any language (TypeScript, Python, Go, Rust, etc.) and adapt based on your project files.

---

## How It Works

```
User Request
    ↓
┌───────────────────────────────────────┐
│  Main Agents (User-Facing)           │
├───────────────────────────────────────┤
│  openagent     │ General tasks        │
│  opencoder     │ Complex coding       │
│  system-builder│ AI system generation │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  Specialized Subagents                │
├───────────────────────────────────────┤
│  Core:         task-manager, docs     │
│  Code:         coder, tester, reviewer│
│  Utils:        image-specialist       │
│  Meta:         domain-analyzer, etc.  │
└───────────────────────────────────────┘
```

**The workflow:**
1. **You describe** what you want to build
2. **Agent plans** the implementation steps
3. **You approve** the plan
4. **Agent implements** incrementally with validation
5. **Quality checks** run automatically (tests, types, linting)
6. **Subagents handle** specialized tasks (testing, review, docs)

**Context-aware:** Agents automatically load patterns from `.opencode/context/` to follow your coding standards.

**Smart discovery:** ContextScout finds relevant standards, ExternalScout fetches current library docs (preventing outdated training data issues). ExternalScout supports 18+ libraries including Drizzle, Better Auth, Next.js, TanStack, Cloudflare Workers, AWS Lambda, and more.

---

## 🧠 The Context System (Your Secret Weapon)

### What Is Context?

Context files are **your project's coding standards and patterns**. They tell agents how you write code, what libraries you use, your security requirements, and your design system.

**Think of it as a style guide for AI agents.**

### How It Works

```
Your Request
    ↓
Agent receives request
    ↓
ContextScout discovers relevant context files
    ↓
Agent loads context files
    ↓
Agent follows patterns from context
    ↓
Code matches your standards automatically
```

### Why It Matters

**Without context**: You ask for a component → Agent creates it in its own style → Doesn't match your project ❌

**With context**: You ask for a component → Agent loads your patterns → Creates component matching your style → Perfectly matches your project ✅

### Get Started

1. **Add your patterns** to `~/.opencode/context/project/project-context.md`
2. **Include examples** of your API endpoints, components, naming conventions
3. **Agents automatically use** these patterns in all code they generate

### Learn More

For a complete guide including real-world examples and best practices, see [The Context System Guide](CONTEXT_SYSTEM_GUIDE.md).

---

## What's Included

### 🤖 Main Agents (3 core agents)
- **OpenCoder** - Specialized development agent for production-ready code (start here for building)
- **OpenAgent** - Universal coordinator for general tasks, questions, and workflows
- **SystemBuilder** - Interactive tool for generating complete custom AI systems

### 🔧 Specialized Subagents (Auto-delegated)
- **task-manager** - Breaks complex features into atomic subtasks
- **coder-agent** - Focused code implementations
- **tester** - Test authoring and TDD
- **reviewer** - Code review and security analysis
- **build-agent** - Type checking and build validation
- **documentation** - Documentation generation
- Plus category specialists: frontend, devops, copywriter, technical-writer, data-analyst

### ⚡ Commands
- `/commit` - Smart git commits with conventional format
- `/test` - Testing workflows
- `/optimize` - Code optimization
- `/context` - Context management
- And 7+ more productivity commands

### 📚 Context System
Your coding standards automatically loaded by agents:
- Code quality and security patterns
- UI/design system standards
- Task management workflows
- External library integration guides
- Your project-specific patterns

---

## Example Workflows

### Build a Full-Stack Feature
```bash
opencode --agent OpenCoder
> "Create a user dashboard with authentication and profile settings"

# OpenCoder will:
# 1. Discover context (loads your auth patterns, code standards)
# 2. Propose detailed implementation plan
# 3. Wait for your approval
# 4. Initialize session and persist context
# 5. Delegate to task-manager (creates atomic task breakdown)
#    - task-manager identifies UI and backend tasks
#    - Suggests frontend-specialist for UI work
#    - Includes design standards in context
# 6. Frontend specialist executes 4-stage workflow:
#    - Stage 1: Layout (ASCII wireframe, responsive structure)
#    - Stage 2: Theme (design system, CSS theme file)
#    - Stage 3: Animation (micro-interactions, timing)
#    - Stage 4: Implementation (single HTML file, design_iterations/)
# 7. Execute full-stack implementation (frontend + backend)
# 8. Delegate to tester for tests and reviewer for security
# 9. Validate and handoff production-ready code
```

### Build a Backend Feature
```bash
opencode --agent OpenCoder
> "Create a user authentication system with email/password"

# OpenCoder will:
# 1. Discover context (loads auth-patterns.md, code-quality.md)
# 2. Propose implementation plan with component breakdown
# 3. Wait for your approval
# 4. Initialize session (.tmp/sessions/YYYY-MM-DD-auth-system/)
# 5. Delegate to task-manager for atomic task breakdown
# 6. Execute incrementally (one component at a time)
# 7. Validate after each step (type check, lint, test)
# 8. Delegate to tester and reviewer
# 9. Ship production-ready code
```

### Make a Commit
```bash
# Make your changes
git add .

# Use the commit command
/commit

# Auto-generates: ✨ feat: add user authentication system
```

### Add Your Patterns
```bash
# Edit your project context
nano ~/.opencode/context/project/project-context.md

# Add your patterns:
# **API Endpoint Pattern:**
# ```typescript
# export async function POST(request: Request) {
#   // Your standard pattern
# }
# ```

# Agents will automatically use these patterns!
```

---

## Feature Deep Dives

The following sections provide detailed information about advanced features. New users can skip to [Advanced Features FAQ](#advanced-features-faq) and return to these as needed.

---

## 🎨 Frontend Design Workflow

The **OpenFrontendSpecialist** follows a structured 4-stage design workflow for UI-heavy features:

**4-Stage Process:**
1. **Layout** - ASCII wireframe, responsive structure planning (mobile-first)
2. **Theme** - Design system selection (Tailwind + Flowbite), OKLCH colors, typography
3. **Animation** - Micro-interactions, timing (<400ms), accessibility (prefers-reduced-motion)
4. **Implementation** - Single HTML file, semantic markup, saved to `design_iterations/`

**Key Features:**
- Approval gates at each stage
- Design versioning (`design_1.html`, `design_1_1.html`, `design_2.html`)
- Mobile-first responsive design (375px, 768px, 1024px, 1440px)
- TaskManager auto-detects UI tasks and suggests OpenFrontendSpecialist

**Learn more:** [Frontend Design Workflow Guide](docs/features/frontend-design-workflow.md)

---

## 📋 Task Management & Breakdown

The **TaskManager** breaks complex features into atomic, verifiable subtasks with smart agent suggestions and parallel execution support.

**Key Capabilities:**
- **Atomic Decomposition** - Tasks completable in 1-2 hours
- **Dependency Tracking** - Explicit dependencies via `depends_on`
- **Parallel Execution** - Frontend and backend work simultaneously
- **Agent Suggestions** - Auto-recommends best agent (e.g., OpenFrontendSpecialist for UI)
- **Context Boundaries** - Separates standards from source material
- **CLI Integration** - Status tracking and validation

**Workflow:**
1. **Plan** - Analyzes feature and creates task breakdown
2. **Suggest** - Recommends best agent for each task
3. **Execute** - Agents work with clear context boundaries (parallel where possible)
4. **Verify** - Validates completion against acceptance criteria
5. **Track** - CLI shows progress and next available tasks

**Learn more:** [Task Management Guide](docs/features/task-management.md)

---

## 🏗️ System Builder (New!)

**Build complete custom AI systems tailored to your domain in minutes.**

The System Builder is an interactive tool that generates complete `.opencode` architectures customized to your needs.

### Quick Start
```bash
# Install advanced profile (includes system builder)
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s advanced

# Run the interactive builder
/build-context-system
```

### What It Does
- 🎯 **Interactive Interview** - Asks about your domain, use cases, and requirements
- 🤖 **Generates Complete System** - Creates orchestrator, subagents, context files, workflows, and commands
- 🔗 **Integrates with Existing** - Detects and reuses your existing agents
- 🛡️ **Safe Merging** - Won't overwrite your work, offers merge strategies
- 📚 **Production-Ready** - Includes documentation, testing guides, and examples

### Example
```bash
$ /build-context-system

Domain: E-commerce Operations
Purpose: Automate order processing and customer support

# After answering questions, generates:
# - ecommerce-orchestrator (main agent)
# - order-processor, ticket-router, report-generator (subagents)
# - 12 context files (domain knowledge, processes, standards)
# - 5 workflows (process-order, route-ticket, etc.)
# - 5 custom commands (/process-order, /route-ticket, etc.)
# - Complete documentation
```

**Learn more:** [System Builder Documentation](docs/features/system-builder/)

---

## Advanced Features FAQ

**Q: What's the main way to use this?**  
A: Use `opencode --agent OpenCoder` for building features and production code. For general questions, documentation, or simple tasks, use `opencode --agent OpenAgent`. Both coordinate with specialists as needed.

**Q: What's the Agent System Blueprint for?**  
A: It's a teaching document explaining architecture patterns and how to extend the system. See [docs/features/agent-system-blueprint.md](docs/features/agent-system-blueprint.md)

**Q: How does the frontend design workflow work?**  
A: The frontend-specialist agent follows a 4-stage workflow: Layout (wireframe) → Theme (design system) → Animation (micro-interactions) → Implementation (HTML). Each stage has approval gates. See the [Frontend Design Workflow](#-frontend-design-workflow) section above.

**Q: What's ExternalScout?**  
A: ExternalScout fetches current documentation for external libraries (Tailwind, React, etc.) to prevent outdated training data issues. ContextScout uses it automatically when needed.

**Q: How does task-manager suggest agents?**  
A: The task-manager analyzes each task and sets a `suggested_agent` field. For UI tasks, it suggests frontend-specialist and includes design context files automatically.

**Q: Can I use just one command or agent?**  
A: Yes! Use the installer's list feature to see all components:
```bash
./install.sh --list
```
Or cherry-pick individual files with curl:
```bash
# Create category directory first
mkdir -p ~/.opencode/agent/core

# Download specific agent
curl -o ~/.opencode/agent/core/opencoder.md \
  https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/.opencode/agent/core/opencoder.md
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/contributing/CONTRIBUTING.md) for details.

1. Follow the established naming conventions and coding standards
2. Write comprehensive tests for new features
3. Update documentation for any changes
4. Ensure security best practices are followed

See also: [Code of Conduct](docs/contributing/CODE_OF_CONDUCT.md)

---

## License

This project is licensed under the MIT License.

---

**Made with ❤️ by developers, for developers. Star the repo if this helped you ship better code!**

