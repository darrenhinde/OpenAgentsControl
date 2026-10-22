<div align="center">

![OpenAgents Control Hero](docs/images/hero-image.png)

# OpenAgents Control (OAC)

### Control your AI patterns. Get repeatable results.

**AI agents that learn YOUR coding patterns and generate matching code every time.**

🎯 **Pattern Control** - Define your patterns once, AI uses them forever  
✋ **Approval Gates** - Review and approve before execution  
🔁 **Repeatable Results** - Same patterns = Same quality code  
📝 **Editable Agents** - Full control over AI behavior  
👥 **Team-Ready** - Everyone uses the same patterns

**Multi-language:** TypeScript • Python • Go • Rust  • C# • Any language*  
**Model Agnostic:** Claude • GPT • Gemini • MiniMax • Local models


[![GitHub stars](https://img.shields.io/github/stars/darrenhinde/OpenAgentsControl?style=flat-square&logo=github&labelColor=black&color=ffcb47)](https://github.com/darrenhinde/OpenAgentsControl/stargazers)
[![X Follow](https://img.shields.io/twitter/follow/DarrenBuildsAI?style=flat-square&logo=x&labelColor=black&color=1DA1F2)](https://x.com/DarrenBuildsAI)
[![License: MIT](https://img.shields.io/badge/License-MIT-3fb950?style=flat-square&labelColor=black)](https://opensource.org/licenses/MIT)
[![Last Commit](https://img.shields.io/github/last-commit/darrenhinde/OpenAgentsControl?style=flat-square&labelColor=black&color=8957e5)](https://github.com/darrenhinde/OpenAgentsControl/commits/main)

[🚀 Quick Start](#-quick-start) • [💻 Show Me Code](#-example-workflow) • [🗺️ Roadmap](https://github.com/darrenhinde/OpenAgentsControl/projects) • [💬 Community](https://nextsystems.ai)

</div>

---

> **Built on [OpenCode](https://opencode.ai)** - An open-source AI coding framework. OAC extends OpenCode with specialized agents, context management, and team workflows.

---

## The Problem

Most AI agents are like hiring a developer who doesn't know your codebase. They write generic code. You spend hours rewriting, refactoring, and fixing inconsistencies. Tokens burned. Time wasted. No actual work done.

**Example:**
```typescript
// What AI gives you (generic)
export async function POST(request: Request) {
  const data = await request.json();
  return Response.json({ success: true });
}

// What you actually need (your patterns)
export async function POST(request: Request) {
  const body = await request.json();
  const validated = UserSchema.parse(body);  // Your Zod validation
  const result = await db.users.create(validated);  // Your Drizzle ORM
  return Response.json(result, { status: 201 });  // Your response format
}
```

## The Solution

**OpenAgentsControl teaches agents your patterns upfront.** They understand your coding standards, your architecture, your security requirements. They propose plans before implementing. They execute incrementally with validation.

**The result:** Production-ready code that ships without heavy rework.

### What Makes OAC Different

**🎯 Context-Aware (Your Secret Weapon)**  
Agents load YOUR patterns before generating code. Code matches your project from the start. No refactoring needed.

**📝 Editable Agents (Not Baked-In Plugins)**  
Full control over agent behavior. Edit markdown files directly—no compilation, no vendor lock-in. Change workflows, add constraints, customize for your team.

**✋ Approval Gates (Human-Guided AI)**  
Agents ALWAYS request approval before execution. Propose → Approve → Execute. You stay in control. No "oh no, what did the AI just do?" moments.

**⚡ Token Efficient (MVI Principle)**  
Minimal Viable Information design. Only load what's needed, when it's needed. Context files <200 lines, lazy loading, faster responses.

**👥 Team-Ready (Repeatable Patterns)**  
Store YOUR coding patterns once. Entire team uses same standards. Commit context to repo. New developers inherit team patterns automatically.

**🔄 Model Agnostic**  
Use any AI model (Claude, GPT, Gemini, local). No vendor lock-in.

**Full-stack development:** OAC handles both frontend and backend work. The agents coordinate to build complete features from UI to database.

---

## 🆚 Quick Comparison

| Feature | OpenAgentsControl | Cursor/Copilot | Aider | Oh My OpenCode |
|---------|-------------------|----------------|-------|----------------|
| **Learn Your Patterns** | ✅ Built-in context system | ❌ No pattern learning | ❌ No pattern learning | ⚠️ Manual setup |
| **Approval Gates** | ✅ Always required | ⚠️ Optional (default off) | ❌ Auto-executes | ❌ Fully autonomous |
| **Token Efficiency** | ✅ MVI principle (80% reduction) | ❌ Full context loaded | ❌ Full context loaded | ❌ High token usage |
| **Team Standards** | ✅ Shared context files | ❌ Per-user settings | ❌ No team support | ⚠️ Manual config per user |
| **Edit Agent Behavior** | ✅ Markdown files you edit | ❌ Proprietary/baked-in | ⚠️ Limited prompts | ✅ Config files |
| **Model Choice** | ✅ Any model, any provider | ⚠️ Limited options | ⚠️ OpenAI/Claude only | ✅ Multiple models |
| **Execution Speed** | ⚠️ Sequential with approval | Fast | Fast | ✅ Parallel agents |
| **Error Recovery** | ✅ Human-guided validation | ⚠️ Auto-retry (can loop) | ⚠️ Auto-retry | ✅ Self-correcting |
| **Best For** | Production code, teams | Quick prototypes | Solo developers | Power users, complex projects |

**Use OAC when:**
- ✅ You have established coding patterns
- ✅ You want code that ships without refactoring
- ✅ You need approval gates for quality control
- ✅ You care about token efficiency and costs

**Use others when:**
- **Cursor/Copilot:** Quick prototypes, don't care about patterns
- **Aider:** Simple file edits, no team coordination
- **Oh My OpenCode:** Need autonomous execution with parallel agents (speed over control)

> **Full comparison:** [Read detailed analysis →](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)

---

## 🚀 Quick Start

**Prerequisites:** [OpenCode CLI](https://opencode.ai/docs) (free, open-source) • Bash 3.2+ • Git

### Step 1: Install

**One command:**

```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer
```

<sub>The installer will set up OpenCode CLI if you don't have it yet.</sub>

**Or interactive:**
```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh -o install.sh
bash install.sh
```

### Keep Updated

```bash
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/update.sh | bash
```

> Use `--install-dir PATH` if you installed to a custom location (e.g. `~/.config/opencode`).

### Step 2: Start Building

```bash
opencode --agent OpenAgent
> "Create a user authentication system"
```

### Step 3: Approve & Ship

**What happens:**
1. Agent analyzes your request
2. Proposes a plan (you approve)
3. Executes step-by-step with validation
4. Delegates to specialists when needed
5. Ships production-ready code

**That's it.** Works immediately with your default model. No configuration required.

---

### Alternative: Claude Code Plugin (BETA)

**Prefer Claude Code?** OpenAgents Control is also available as a Claude Code plugin!

**Installation:**

1. Register the marketplace:
```bash
/plugin marketplace add darrenhinde/OpenAgentsControl
```

2. Install the plugin:
```bash
/plugin install oac
```

3. Download context files:
```bash
/oac:setup --core
```

4. Start building:
```
Add a login endpoint
```

**Features:**
- ✅ 6-stage workflow with approval gates
- ✅ Context-aware code generation
- ✅ 7 specialized subagents (task-manager, context-scout, context-manager, coder-agent, test-engineer, code-reviewer, external-scout)
- ✅ 9 workflow skills + 6 user commands
- ✅ Flexible context discovery (.oac config, .claude/context, context, .opencode/context)
- ✅ Add context from GitHub, worktrees, local files, or URLs
- ✅ Easy feature planning with `/oac:plan`

**Documentation:**
- [Plugin README](./plugins/claude-code/README.md) - Complete plugin documentation
- [First-Time Setup](./plugins/claude-code/FIRST-TIME-SETUP.md) - Step-by-step guide
- [Quick Start](./plugins/claude-code/QUICK-START.md) - Quick reference

**Status:** BETA - Actively tested and ready for early adopters

---

## 💡 The Context System: Your Secret Weapon

**The problem with AI code:** It doesn't match your patterns. You spend hours refactoring.

**The OAC solution:** Teach your patterns once. Agents load them automatically. Code matches from the start.

### How It Works

```
Your Request
    ↓
ContextScout discovers relevant patterns
    ↓
Agent loads YOUR standards
    ↓
Code generated using YOUR patterns
    ↓
Ships without refactoring ✅
```

### Add Your Patterns (10-15 Minutes)

```bash
/add-context
```

**Answer 6 simple questions:**
1. What's your tech stack? (Next.js + TypeScript + PostgreSQL + Tailwind)
2. Show an API endpoint example (paste your code)
3. Show a component example (paste your code)
4. What naming conventions? (kebab-case, PascalCase, camelCase)
5. Any code standards? (TypeScript strict, Zod validation, etc.)
6. Any security requirements? (validate input, parameterized queries, etc.)

**Result:** Agents now generate code matching your exact patterns. No refactoring needed.

### The MVI Advantage: Token Efficiency

**MVI (Minimal Viable Information)** = Only load what's needed, when it's needed.

**Traditional approach:**
- Loads entire codebase context
- Large token overhead per request
- Slow responses, high costs

**OAC approach:**
- Loads only relevant patterns
- Context files <200 lines (quick to load)
- Lazy loading (agents load what they need)
- 80% of tasks use isolation context (minimal overhead)

**Real benefits:**
- **Efficiency:** Lower token usage vs loading entire codebase
- **Speed:** Faster responses with smaller context
- **Quality:** Code matches your patterns (no refactoring)

### For Teams: Repeatable Patterns

**The team problem:** Every developer writes code differently. Inconsistent patterns. Hard to maintain.

**The OAC solution:** Store team patterns in `.opencode/context/project/`. Commit to repo. Everyone uses same standards.

**Example workflow:**
```bash
# Team lead adds patterns once
/add-context
# Answers questions with team standards

# Commit to repo
git add .opencode/context/
git commit -m "Add team coding standards"
git push

# All team members now use same patterns automatically
# New developers inherit standards on day 1
```

**Result:** Consistent code across entire team. No style debates. No refactoring PRs.

---

## 📖 How It Works

### The Core Idea

**Most AI tools:** Generic code → You refactor  
**OpenAgentsControl:** Your patterns → AI generates matching code  

### The Workflow

```
1. Add Your Context (one time)
   ↓
2. ContextScout discovers relevant patterns
   ↓
3. Agent loads YOUR standards
   ↓
4. Agent proposes plan (using your patterns)
   ↓
5. You approve
   ↓
6. Agent implements (matches your project)
   ↓
7. Code ships (no refactoring needed)
```

### Key Benefits

**🎯 Context-Aware**  
ContextScout discovers relevant patterns. Agents load YOUR standards before generating code. Code matches your project from the start.

**🔁 Repeatable**  
Same patterns → Same results. Configure once, use forever. Perfect for teams.

**⚡ Token Efficient (80% Reduction)**  
MVI principle: Only load what's needed. 8,000 tokens → 750 tokens. Massive cost savings.

**✋ Human-Guided**  
Agents propose plans, you approve before execution. Quality gates prevent mistakes. No auto-execution surprises.

**📝 Transparent & Editable**  
Agents are markdown files you can edit. Change workflows, add constraints, customize behavior. No vendor lock-in.

### What Makes This Special

**1. ContextScout - Smart Pattern Discovery**  
Before generating code, ContextScout discovers relevant patterns from your context files. Ranks by priority (Critical → High → Medium). Prevents wasted work.

**2. Editable Agents - Full Control**  
Unlike Cursor/Copilot where behavior is baked into plugins, OAC agents are markdown files. Edit them directly:
```bash
nano .opencode/agent/core/opencoder.md  # local project install
# Or: nano ~/.config/opencode/agent/core/opencoder.md  # global install
# Add project rules, change workflows, customize behavior
```

**3. ExternalScout - Live Documentation** 🆕  
Working with external libraries? ExternalScout fetches current documentation:
- Gets live docs from official sources (npm, GitHub, docs sites)
- No outdated training data - always current
- Automatically triggered when agents detect external dependencies
- Supports frameworks, APIs, libraries, and more

**4. Approval Gates - No Surprises**  
Agents ALWAYS request approval before:
- Writing/editing files
- Running bash commands
- Delegating to subagents
- Making any changes

You stay in control. Review plans before execution.

**5. MVI Principle - Token Efficiency**  
Files designed for quick loading:
- Concepts: <100 lines
- Guides: <150 lines
- Examples: <80 lines

Result: Lower token usage vs loading entire codebase.

**6. Team Patterns - Repeatable Results**  
Store patterns in `.opencode/context/project/`. Commit to repo. Entire team uses same standards. New developers inherit patterns automatically.

---

## 🎯 Which Agent Should I Use?

### OpenAgent (Start Here)

**Best for:** Learning the system, general tasks, quick implementations

```bash
opencode --agent OpenAgent
> "Create a user authentication system"            # Building features
> "How do I implement authentication in Next.js?"  # Questions
> "Create a README for this project"               # Documentation
> "Explain the architecture of this codebase"      # Analysis
```

**What it does:**
- Loads your patterns via ContextScout
- Proposes plan (you approve)
- Executes with validation
- Delegates to specialists when needed

**Perfect for:** First-time users, simple features, learning the workflow

### OpenCoder (Production Development)

**Best for:** Complex features, multi-file refactoring, production systems

```bash
opencode --agent OpenCoder
> "Create a user authentication system"                 # Full-stack features
> "Refactor this codebase to use dependency injection"  # Multi-file refactoring
> "Add real-time notifications with WebSockets"         # Complex implementations
```

**What it does:**
- **Discover:** ContextScout finds relevant patterns
- **Propose:** Detailed implementation plan
- **Approve:** You review and approve
- **Execute:** Incremental implementation with validation
- **Validate:** Tests, type checking, code review
- **Ship:** Production-ready code

**Perfect for:** Production code, complex features, team development

### SystemBuilder (Custom AI Systems)

**Best for:** Building complete custom AI systems tailored to your domain

```bash
opencode --agent SystemBuilder
> "Create a customer support AI system"
```

Interactive wizard generates orchestrators, subagents, context files, workflows, and commands.

**Perfect for:** Creating domain-specific AI systems

---

## 🛠️ What's Included

### 🤖 Main Agents
- **OpenAgent** - General tasks, questions, learning (start here)
- **OpenCoder** - Production development, complex features
- **SystemBuilder** - Generate custom AI systems

### 🔧 Specialized Subagents (Auto-delegated)
- **ContextScout** - Smart pattern discovery (your secret weapon)
- **TaskManager** - Breaks complex features into atomic subtasks
- **CoderAgent** - Focused code implementations
- **TestEngineer** - Test authoring and TDD
- **CodeReviewer** - Code review and security analysis
- **BuildAgent** - Type checking and build validation
- **DocWriter** - Documentation generation
- **ExternalScout** - Fetches live docs for external libraries (no outdated training data) **NEW!**
- Plus category specialists: frontend, devops, copywriter, technical-writer, data-analyst

### ⚡ Productivity Commands
- `/add-context` - Interactive wizard to add your patterns
- `/commit` - Smart git commits with conventional format
- `/test` - Testing workflows
- `/optimize` - Code optimization
- `/context` - Context management
- And 7+ more productivity commands

### 📚 Context System (MVI Principle)
Your coding standards automatically loaded by agents:
- **Code quality** - Your patterns, security, standards
- **UI/design** - Design system, component patterns
- **Task management** - Workflow definitions
- **External libraries** - Integration guides (18+ libraries supported)
- **Project-specific** - Your team's patterns

**Key features:**
- 80% token reduction via MVI
- Smart discovery via ContextScout
- Lazy loading (only what's needed)
- Team-ready (commit to repo)
- Version controlled (track changes)

### How Context Resolution Works

ContextScout discovers context files using a **local-first** approach:

```
1. Check local: .opencode/context/core/navigation.md
   ↓ Found? → Use local for everything. Done.
   ↓ Not found?
2. Check global: ~/.config/opencode/context/core/navigation.md
   ↓ Found? → Use global for core/ files only.
   ↓ Not found? → Proceed without core context.
```

**Key rules:**
- **Local always wins** — if you installed locally, global is never checked
- **Global fallback is only for `core/`** (standards, workflows, guides) — universal files that are the same across projects
- **Project intelligence is always local** — your tech stack, patterns, and naming conventions live in `.opencode/context/project-intelligence/` and are never loaded from global
- **One-time check** — ContextScout resolves the core location once at startup (max 2 glob checks), not per-file

**Common setups:**

| Setup | Core files from | Project intelligence from |
|-------|----------------|--------------------------|
| Local install (`bash install.sh developer`) | `.opencode/context/core/` | `.opencode/context/project-intelligence/` |
| Global install + `/add-context` | `~/.config/opencode/context/core/` | `.opencode/context/project-intelligence/` |
| Both local and global | `.opencode/context/core/` (local wins) | `.opencode/context/project-intelligence/` |

---



## 💻 Example Workflow

```bash
opencode --agent OpenCoder
> "Create a user dashboard with authentication and profile settings"
```

**What happens:**

**1. Discover (~1-2 min)** - ContextScout finds relevant patterns
- Your tech stack (Next.js + TypeScript + PostgreSQL)
- Your API pattern (Zod validation, error handling)
- Your component pattern (functional, TypeScript, Tailwind)
- Your naming conventions (kebab-case files, PascalCase components)

**2. Propose (~2-3 min)** - Agent creates detailed implementation plan
```
## Proposed Implementation

**Components:**
- user-dashboard.tsx (main page)
- profile-settings.tsx (settings component)
- auth-guard.tsx (authentication wrapper)

**API Endpoints:**
- /api/user/profile (GET, POST)
- /api/auth/session (GET)

**Database:**
- users table (Drizzle schema)
- sessions table (Drizzle schema)

All code will follow YOUR patterns from context.

Approve? [y/n]
```

**3. Approve** - You review and approve the plan (human-guided)

**4. Execute (~10-15 min)** - Incremental implementation with validation
- Implements one component at a time
- Uses YOUR patterns for every file
- Validates after each step (type check, lint)
- *This is the longest step - generating quality code takes time*

**5. Validate (~2-3 min)** - Tests, type checking, code review
- Delegates to TestEngineer for tests
- Delegates to CodeReviewer for security check
- Ensures production quality

**6. Ship** - Production-ready code
- Code matches your project exactly
- No refactoring needed
- Ready to commit and deploy

**Total time: ~15-25 minutes** for a complete feature (guided, with approval gates)

### 💡 Pro Tips

**After finishing a feature:**
- Run `/add-context --update` to add new patterns you discovered
- Update your context with new libraries, conventions, or standards
- Keep your patterns fresh as your project evolves

**Working with external libraries?**
- **ExternalScout** automatically fetches current documentation
- No more outdated training data - gets live docs from official sources
- Works with npm packages, APIs, frameworks, and more

---

## ⚙️ Advanced Configuration

### Model Configuration (Optional)

**By default, all agents use your OpenCode default model.** Configure models per agent only if you want different agents to use different models.

**When to configure:**
- You want faster agents to use cheaper models (e.g., Haiku/Flash)
- You want complex agents to use smarter models (e.g., Opus/GPT-5)
- You want to test different models for different tasks

**How to configure:**

Edit agent files directly:
```bash
nano .opencode/agent/core/opencoder.md  # local project install
# Or: nano ~/.config/opencode/agent/core/opencoder.md  # global install
```

Change the model in the frontmatter:
```yaml
---
description: "Development specialist"
model: anthropic/claude-sonnet-4-5  # Change this line
---
```

Browse available models at [models.dev](https://models.dev/?search=open) or run `opencode models`.

### Update Context as You Go

Your project evolves. Your context should too.

```bash
/add-context --update
```

**What gets updated:**
- Tech stack, patterns, standards
- Version incremented (1.0 → 1.1)
- Updated date refreshed

**Example updates:**
- Add new library (Stripe, Twilio, etc.)
- Change patterns (new API format, component structure)
- Migrate tech stack (Prisma → Drizzle)
- Update security requirements

Agents automatically use updated patterns.

---



## 🎯 Is This For You?

### ✅ Use OAC if you:
- Build production code that ships without heavy rework
- Work in a team with established coding standards
- Want control over agent behavior (not black-box plugins)
- Care about token efficiency and cost savings
- Need approval gates for quality assurance
- Want repeatable, consistent results
- Use multiple AI models (no vendor lock-in)

### ⚠️ Skip OAC if you:
- Want fully autonomous execution without approval gates
- Prefer "just do it" mode over human-guided workflows
- Don't have established coding patterns yet
- Need multi-agent parallelization (use Oh My OpenCode instead)
- Want plug-and-play with zero configuration

### 🤔 Not Sure?

**Try this test:**
1. Ask your current AI tool to generate an API endpoint
2. Count how many minutes you spend refactoring it to match your patterns
3. If you're spending time on refactoring, OAC will save you that time

**Or ask yourself:**
- Do you have coding standards your team follows?
- Do you spend time refactoring AI-generated code?
- Do you want AI to follow YOUR patterns, not generic ones?

If you answered "yes" to any of these, OAC is for you.

---

## 🚀 Advanced Features

### Frontend Design Workflow
The **OpenFrontendSpecialist** follows a structured 4-stage design workflow:
1. **Layout** - ASCII wireframe, responsive structure planning
2. **Theme** - Design system selection, OKLCH colors, typography
3. **Animation** - Micro-interactions, timing, accessibility
4. **Implementation** - Single HTML file, semantic markup

### Task Management & Breakdown
The **TaskManager** breaks complex features into atomic, verifiable subtasks with smart agent suggestions and parallel execution support.

### System Builder
Build complete custom AI systems tailored to your domain in minutes. Interactive wizard generates orchestrators, subagents, context files, workflows, and commands.

---

## ❓ FAQ

### Getting Started

**Q: Does this work on Windows?**  
A: Yes! Use Git Bash (recommended) or WSL.

**Q: What languages are supported?**  
A: Agents are language-agnostic and adapt based on your project files. Primarily tested with TypeScript/Node.js. C# / .NET is now supported with dedicated context files. Python, Go, Rust, and other languages are supported but less battle-tested. The context system works with any language.

**Q: Do I need to add context?**  
A: No, but it's highly recommended. Without context, agents write generic code. With context, they write YOUR code.

**Q: Can I use this without customization?**  
A: Yes, it works out of the box. But you'll get the most value after adding your patterns (10-15 minutes with `/add-context`).

**Q: What models are supported?**
A: Any model from any provider (Claude, GPT, Gemini, MiniMax, local models). No vendor lock-in.

### For Teams

**Q: How do I share context with my team?**  
A: Commit `.opencode/context/project/` to your repo. Team members automatically use same patterns.

**Q: How do we ensure everyone follows the same standards?**  
A: Add team patterns to context once. All agents load them automatically. Consistent code across entire team.

**Q: Can different projects have different patterns?**  
A: Yes! Use project-specific context (`.opencode/` in project root) to override global patterns.

### Technical

**Q: How does token efficiency work?**  
A: MVI principle: Only load what's needed, when it's needed. Context files <200 lines (scannable in 30s). ContextScout discovers relevant patterns. Lazy loading prevents context bloat. 80% of tasks use isolation context (minimal overhead).

**Q: What's ContextScout?**  
A: Smart pattern discovery agent. Finds relevant context files before code generation. Ranks by priority. Prevents wasted work.

**Q: Can I edit agent behavior?**  
A: Yes! Agents are markdown files. Edit them directly: `nano .opencode/agent/core/opencoder.md` (local) or `nano ~/.config/opencode/agent/core/opencoder.md` (global)

**Q: How do approval gates work?**  
A: Agents ALWAYS request approval before execution (write/edit/bash). You review plans before implementation. No surprises.

**Q: How do I update my context?**  
A: Run `/add-context --update` anytime your patterns change. Agents automatically use updated patterns.

### Comparison

**Q: How is this different from Cursor/Copilot?**  
A: OAC has editable agents (not baked-in), approval gates (not auto-execute), context system (YOUR patterns), and MVI token efficiency.

**Q: How is this different from Aider?**  
A: OAC has team patterns, context system, approval workflow, and smart pattern discovery. Aider is file-based only.

**Q: How does this compare to Oh My OpenCode?**  
A: Both are built on OpenCode. OAC focuses on **control & repeatability** (approval gates, pattern control, team standards). Oh My OpenCode focuses on **autonomy & speed** (parallel agents, auto-execution). [Read detailed comparison →](https://github.com/darrenhinde/OpenAgentsControl/discussions/116)

**Q: When should I NOT use OAC?**  
A: If you want fully autonomous execution without approval gates, or if you don't have established coding patterns yet.

### Setup

**Q: What bash version do I need?**  
A: Bash 3.2+ (macOS default works). Run `bash scripts/tests/test-compatibility.sh` to check.

**Q: Do I need to install plugins/tools?**  
A: No, they're optional. Only install if you want Telegram notifications or Gemini AI features.

**Q: Where should I install - globally or per-project?**  
A: Local (`.opencode/` in your project) is recommended — patterns are committed to git and shared with your team. Global (`~/.config/opencode/`) is good for personal defaults across all projects. The installer asks you to choose. See [OpenCode Config Docs](https://opencode.ai/docs/config/) for how configs merge.

---

## 🗺️ Roadmap & What's Coming

**This is only the beginning!** We're actively developing new features and improvements every day.

### 🚀 See What's Coming Next

Check out our [**Project Board**](https://github.com/darrenhinde/OpenAgentsControl/projects) to see:
- 🔨 **In Progress** - Features being built right now
- 📋 **Planned** - What's coming soon
- 💡 **Ideas** - Future enhancements under consideration
- ✅ **Recently Shipped** - Latest improvements

### 🎯 Current Focus Areas

- **Plugin System** - npm-based plugin architecture for easy distribution
- **Performance Improvements** - Faster agent execution and context loading
- **Enhanced Context Discovery** - Smarter pattern recognition
- **Multi-language Support** - Better Python, Go, Rust, C# / .NET support
- **Team Collaboration** - Shared context and team workflows
- **Documentation** - More examples, tutorials, and guides

### 💬 Have Ideas?

We'd love to hear from you! 
- 💡 [**Submit Feature Requests**](https://github.com/darrenhinde/OpenAgentsControl/issues/new?labels=enhancement)
- 🐛 [**Report Bugs**](https://github.com/darrenhinde/OpenAgentsControl/issues/new?labels=bug)
- 💬 [**Join Discussions**](https://github.com/darrenhinde/OpenAgentsControl/discussions)

**Star the repo** ⭐ to stay updated with new releases!

---

## 🤝 Contributing

We welcome contributions!

1. Follow the established naming conventions and coding standards
2. Write comprehensive tests for new features
3. Update documentation for any changes
4. Ensure security best practices are followed

See: [Contributing Guide](docs/contributing/CONTRIBUTING.md) • [Code of Conduct](docs/contributing/CODE_OF_CONDUCT.md)

---

## 💬 Community & Support

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

## License

This project is licensed under the MIT License.

---

**Made with ❤️ by developers, for developers. Star the repo if this saves you refactoring time!**
