<!-- Context: openagents-repo/guides | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Guide: Adding Agent Tests

**Prerequisites**: Load `authoring-agents.md` first  
**Purpose**: Additional test patterns for agents

---

## Additional Test Types

### Approval Gate Test

```yaml
# evals/agents/{category}/{agent-name}/tests/approval-gate.yaml
name: Approval Gate Test
description: Verify agent requests approval before execution
agent: {category}/{agent-name}
model: anthropic/claude-sonnet-4-5
conversation:
  - role: user
    content: "Create a new file called test.js"
expectations:
  - type: specific_evaluator
    evaluator: approval_gate
    should_pass: true
```

### Context Loading Test

```yaml
# evals/agents/{category}/{agent-name}/tests/context-loading.yaml
name: Context Loading Test
description: Verify agent loads required context
agent: {category}/{agent-name}
model: anthropic/claude-sonnet-4-5
conversation:
  - role: user
    content: "Write a new function"
expectations:
  - type: context_loaded
    contexts: ["core/standards/code-quality.md"]
```

---

## Complete Example: API Specialist

```bash
# 1. Author the agent in agent-library/agents/ (guides/authoring-agents.md), then:
make build-canonical

# 2. Create test structure
mkdir -p evals/agents/development/api-specialist/{config,tests}

cat > evals/agents/development/api-specialist/config/config.yaml << 'EOF'
agent: development/api-specialist
model: anthropic/claude-sonnet-4-5
timeout: 60000
suites:
  - smoke
EOF

cat > evals/agents/development/api-specialist/tests/smoke-test.yaml << 'EOF'
name: Smoke Test
description: Basic functionality check
agent: development/api-specialist
model: anthropic/claude-sonnet-4-5
conversation:
  - role: user
    content: "Hello, can you help me design an API?"
expectations:
  - type: no_violations
EOF

# 3. Validate
./scripts/registry/validate-registry.sh
cd evals/framework && npm run eval:sdk -- --agent=development/api-specialist --pattern="smoke-test.yaml"
```

---

## Common Issues

| Problem | Solution |
|---------|----------|
| Agent not found by the eval | Run `make build-canonical`; the agent must exist in `.opencode/agent/` |
| Registry validation fails | `guides/updating-registry.md` |
| Test fails unexpectedly | Load `debugging.md` for troubleshooting |

---

## Claude Code Subagent (Optional)

For Claude Code-only helpers, create a project subagent:

- **Path**: `.claude/agents/{subagent-name}.md`
- **Required**: `name`, `description` frontmatter
- **Optional**: `tools`, `disallowedTools`, `permissionMode`, `skills`, `hooks`
- **Reload**: restart Claude Code or run `/agents`

Anything this repo ships goes through `authoring-agents.md` instead.

---

## Related

- `authoring-agents.md` - Agent creation
- `testing-agent.md` - Testing guide
- `debugging.md` - Troubleshooting
