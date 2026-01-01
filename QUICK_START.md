# 🚀 OpenCode Agents - Quick Start

![Version](https://img.shields.io/badge/version-0.1.0--alpha.1-blue)

## 📋 Available Agents

- **openagent** - Full-featured development agent (22+ tests)
  - Developer tests: Code, docs, tests, delegation
  - Context loading tests: Standards, patterns, workflows
  - Business tests: Conversations, data analysis
  - Edge cases: Approval gates, negative tests

- **opencoder** - Specialized coding agent (4+ tests)
  - Developer tests: Bash execution, file operations
  - Multi-tool workflows

---

## 🧪 Running Tests

### Test All Agents
```bash
npm test                              # All agents, all tests (default)
npm run test:all                      # Explicit all agents
```

### Test Specific Agent
```bash
npm run test:openagent                # OpenAgent only
npm run test:opencoder                # OpenCoder only
```

### Test with Different Models

#### OpenAgent
```bash
npm run test:openagent:grok           # Grok (free tier, fast)
npm run test:openagent:claude         # Claude Sonnet 4.5 (best quality)
npm run test:openagent:gpt4           # GPT-4 Turbo (OpenAI)
```

#### OpenCoder
```bash
npm run test:opencoder:grok           # Grok (free tier, fast)
npm run test:opencoder:claude         # Claude Sonnet 4.5 (best quality)
npm run test:opencoder:gpt4           # GPT-4 Turbo (OpenAI)
```

#### All Agents
```bash
npm run test:all:grok                 # All agents with Grok
npm run test:all:claude               # All agents with Claude
npm run test:all:gpt4                 # All agents with GPT-4
```

---

## 🎯 Test Specific Categories

### OpenAgent Categories
```bash
npm run test:openagent:developer      # Developer tests (code, docs, tests)
npm run test:openagent:context        # Context loading tests
npm run test:openagent:business       # Business/conversation tests
```

### OpenCoder Categories
```bash
npm run test:opencoder:developer      # Developer tests
npm run test:opencoder:bash           # Bash execution tests
```

### Custom Patterns
```bash
npm run test:pattern -- "developer/*.yaml"              # All developer tests
npm run test:pattern -- "context-loading/*.yaml"        # Context tests
npm run test:pattern -- "edge-case/*.yaml"              # Edge cases
npm run test:openagent -- --pattern="developer/ctx-*"   # OpenAgent context tests
```

---

## 📊 View Results

### Dashboard (Recommended)
```bash
npm run dashboard                     # Launch interactive dashboard
npm run dashboard:open                # Launch and auto-open browser
```

The dashboard provides:
- ✅ Real-time test results visualization
- ✅ Filter by agent, category, status
- ✅ Detailed violation tracking
- ✅ CSV export functionality
- ✅ Historical results tracking

### Command Line
```bash
npm run results:openagent             # Recent OpenAgent results
npm run results:opencoder             # Recent OpenCoder results
npm run results:latest                # Latest test summary (JSON)
```

---

## 🐛 Debug Mode

```bash
npm run test:debug                    # Run with debug output
npm run test:openagent -- --debug     # Debug OpenAgent tests
npm run test:opencoder -- --debug     # Debug OpenCoder tests
```

Debug mode shows:
- Detailed event logging
- Tool call details
- Session information
- Evaluation progress

---

## 🔧 Development

```bash
npm run dev:setup                     # Install dependencies
npm run dev:build                     # Build framework
npm run dev:test                      # Run unit tests
npm run dev:clean                     # Clean and reinstall
```

---

## 📈 Version Management

```bash
npm run version                       # Show current version
npm run version:bump alpha            # Bump alpha version
npm run version:bump beta             # Bump to beta
npm run version:bump rc               # Bump to release candidate
```

---

## 📁 Test Structure

```
evals/agents/
├── openagent/tests/
│   ├── developer/          # Code, docs, tests (12 tests)
│   │   ├── ctx-code-001.yaml
│   │   ├── ctx-docs-001.yaml
│   │   ├── ctx-tests-001.yaml
│   │   ├── ctx-delegation-001.yaml
│   │   └── ...
│   ├── context-loading/    # Context loading (5 tests)
│   │   ├── ctx-simple-coding-standards.yaml
│   │   ├── ctx-simple-documentation-format.yaml
│   │   └── ...
│   ├── business/           # Conversations (2 tests)
│   │   ├── conv-simple-001.yaml
│   │   └── data-analysis.yaml
│   └── edge-case/          # Edge cases (3 tests)
│       ├── just-do-it.yaml
│       ├── missing-approval-negative.yaml
│       └── no-approval-negative.yaml
│
└── opencoder/tests/
    └── developer/          # Bash, file ops (4 tests)
        ├── bash-execution-001.yaml
        ├── file-read-001.yaml
        ├── multi-tool-001.yaml
        └── simple-bash-test.yaml
```

---

## 💡 Common Workflows

### Quick Test (Free Tier)
```bash
npm run test:openagent:grok           # Fast, free
npm run test:opencoder:grok           # Fast, free
```

### Quality Test (Best Model)
```bash
npm run test:openagent:claude         # Best quality
npm run test:opencoder:claude         # Best quality
```

### Full Test Suite
```bash
npm run test:all:claude               # All agents, best model
```

### Continuous Development
```bash
# 1. Run tests in debug mode
npm run test:openagent:developer -- --debug

# 2. View results in dashboard
npm run dashboard:open

# 3. Iterate on agent prompts
# Edit .opencode/agent/core/openagent.md

# 4. Re-run tests
npm run test:openagent:developer
```

### CI/CD Smoke Tests
```bash
npm run test:ci                       # Fast smoke tests for both agents
npm run test:ci:openagent             # OpenAgent smoke test
npm run test:ci:opencoder             # OpenCoder smoke test
```

---

## 🎯 Test Results

After running tests, results are saved to:
- `evals/results/latest.json` - Latest test run
- `evals/results/history/YYYY-MM/DD-HHMMSS-{agent}.json` - Historical results

View in dashboard: `npm run dashboard:open`

---

## 🔍 Understanding Test Results

### Test Status
- ✅ **PASSED** - All checks passed, no violations
- ❌ **FAILED** - Test failed (execution error or violations)

### Evaluators
Tests are evaluated by multiple evaluators:
- **approval-gate** - Checks if agent requested approval when required
- **context-loading** - Validates context files were loaded before execution
- **delegation** - Checks if agent delegated to subagents appropriately
- **tool-usage** - Validates correct tool usage
- **behavior** - Checks if agent performed expected actions

### Violations
- **Error** - Critical issues that cause test failure
- **Warning** - Non-critical issues
- **Info** - Informational messages

---

## 📚 Additional Resources

- [README.md](README.md) - Project overview
- [evals/framework/SDK_EVAL_README.md](evals/framework/SDK_EVAL_README.md) - SDK documentation
- [CHANGELOG.md](CHANGELOG.md) - Version history

---

## 🆘 Troubleshooting

### Tests not running?
```bash
# Ensure dependencies are installed
npm run dev:setup

# Build the framework
npm run dev:build
```

### Dashboard not loading?
```bash
# Check if results exist
ls -la evals/results/

# Try launching manually
cd evals/results && ./serve.sh
```

### Version mismatch?
```bash
# Check current version
npm run version

# Sync VERSION file with package.json
npm run version > VERSION
```

---

## 🎉 Getting Help

- Review test examples in `evals/agents/*/tests/`
- Run tests in debug mode: `npm run test:debug`
- View results dashboard: `npm run dashboard:open`

---

**Current Version:** 0.1.0-alpha.1  
**Last Updated:** 2025-11-26
