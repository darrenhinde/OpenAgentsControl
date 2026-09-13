# Scripts

This directory contains utility scripts for the OpenAgents Control system, organized by function.

## Directory Structure

```
scripts/
├── registry/              # Component registry management
│   ├── auto-detect-components.sh
│   ├── register-component.sh
│   ├── validate-component.sh
│   └── validate-registry.sh
├── validation/            # Context and validation scripts
│   └── validate-context-refs.sh
├── versioning/            # Version management
│   └── bump-version.sh
├── maintenance/           # Cleanup and maintenance
│   ├── cleanup-stale-sessions.sh
│   └── uninstall.sh
├── development/           # Development utilities
│   ├── dashboard.sh
│   └── demo.sh
├── testing/               # Test runner
│   └── test.sh
├── check-context-logs/    # Context logging utilities
├── prompts/               # Prompt management
└── tests/                 # Installer test scripts
```

## Available Scripts

### Testing

- **`testing/test.sh`** - Main test runner with multi-agent support
  - Run all tests: `./scripts/testing/test.sh openagent`
  - Run core tests: `./scripts/testing/test.sh openagent --core` (7 tests, ~5-8 min)
  - Run with specific model: `./scripts/testing/test.sh openagent opencode/grok-code-fast`
  - Debug mode: `./scripts/testing/test.sh openagent --core --debug`

See `tests/` subdirectory for installer test scripts.

### Registry Management

- `registry/auto-detect-components.sh` - Legacy scanner for non-canonical `.opencode/` components; canonical agents are emitted from `content/agents/**` by `oac build`
- `registry/register-component.sh` - Register a new component in the registry
- `registry/validate-component.sh` - Validate component structure and metadata
- `registry/validate-registry.sh` - Validate all registry paths

### Validation

- `validation/validate-context-refs.sh` - Validate context references in markdown files

### Versioning

- `versioning/bump-version.sh` - Bump version (alpha, beta, rc, patch, minor, major)

### Maintenance

- `maintenance/cleanup-stale-sessions.sh` - Remove stale agent sessions older than 24 hours
- `maintenance/uninstall.sh` - Uninstall OpenCode agents

### Development

- `development/demo.sh` - Interactive demo of repository structure
- `development/dashboard.sh` - Launch test results dashboard

## Session Cleanup

Agent instances create temporary context files in `.tmp/sessions/{session-id}/` for subagent delegation. These sessions are automatically cleaned up, but you can manually remove stale sessions:

```bash
# Clean up sessions older than 24 hours
./scripts/maintenance/cleanup-stale-sessions.sh

# Or manually delete all sessions
rm -rf .tmp/sessions/
```

Sessions are safe to delete anytime - they only contain temporary context files for agent coordination.

## Usage Examples

### Run Tests

```bash
# Run core test suite (fast, 7 tests, ~5-8 min)
./scripts/testing/test.sh openagent --core

# Run all tests for OpenAgent
./scripts/testing/test.sh openagent

# Run tests with specific model
./scripts/testing/test.sh openagent anthropic/claude-sonnet-4-5

# Run core tests with debug mode
./scripts/testing/test.sh openagent --core --debug
```

### Registry Management

```bash
# Inspect non-canonical .opencode components (does not generate canonical agents)
./scripts/registry/auto-detect-components.sh --dry-run

# Update residual non-canonical components only
./scripts/registry/auto-detect-components.sh --auto-add

# Validate registry
./scripts/registry/validate-registry.sh -v

# Register a specific component
./scripts/registry/register-component.sh path/to/component

# Validate a component
./scripts/registry/validate-component.sh path/to/component
```

### Maintenance

```bash
# Clean stale sessions
./scripts/maintenance/cleanup-stale-sessions.sh

# Uninstall OpenCode agents
./scripts/maintenance/uninstall.sh
```

### Development

```bash
# Run interactive demo
./scripts/development/demo.sh

# Launch test results dashboard
./scripts/development/dashboard.sh
```

### Versioning

```bash
# Bump version
./scripts/versioning/bump-version.sh patch
./scripts/versioning/bump-version.sh minor
./scripts/versioning/bump-version.sh major
./scripts/versioning/bump-version.sh alpha
```

---

## Core Test Suite

The **core test suite** is a subset of 7 carefully selected tests that provide ~85% coverage of critical OpenAgent functionality in just 5-8 minutes.

### Why Use Core Tests?

- ✅ **Fast feedback** - 5-8 minutes vs 40-80 minutes for full suite
- ✅ **Prompt iteration** - Quick validation when updating agent prompts
- ✅ **Development** - Fast validation during development cycles
- ✅ **Pre-commit** - Quick checks before committing changes

### What's Covered?

1. **Approval Gate** - Critical safety rule
2. **Context Loading (Simple)** - Most common use case
3. **Context Loading (Multi-Turn)** - Complex scenarios
4. **Stop on Failure** - Error handling
5. **Simple Task** - No unnecessary delegation
6. **Subagent Delegation** - Proper delegation when needed
7. **Tool Usage** - Best practices

### When to Use Full Suite?

Use the full test suite (71 tests) for:
- 🔬 Release validation
- 🔬 Comprehensive testing
- 🔬 Edge case coverage
- 🔬 Regression testing

See `evals/agents/openagent/CORE_TESTS.md` for detailed documentation.
