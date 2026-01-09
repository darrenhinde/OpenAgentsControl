# Guide: Adding a New Agent

**Prerequisites**: Load `core-concepts/agents.md` first  
**Purpose**: Step-by-step workflow for adding a new agent

---

## Overview

Adding a new agent involves:
1. Creating the agent file
2. Creating test structure
3. Updating the registry
4. Validating everything works

**Time**: ~15-20 minutes

---

## Step 1: Create Agent File

### Choose Category

```bash
# Available categories:
# - core/          (system agents)
# - development/   (dev specialists)
# - content/       (content creators)
# - data/          (data analysts)
# - product/       (product managers)
# - learning/      (educators)
```

### Create File

```bash
# Create agent file
touch .opencode/agent/{category}/{agent-name}.md
```

### Add Frontmatter and Content

```markdown
---
description: "Brief description of what this agent does"
category: "{category}"
type: "agent"
tags: ["tag1", "tag2"]
dependencies: []
---

# Agent Name

**Purpose**: What this agent does

## Focus

- Key responsibility 1
- Key responsibility 2
- Key responsibility 3

## Workflow

1. Step 1
2. Step 2
3. Step 3

## Constraints

- Constraint 1
- Constraint 2
```

---

## Step 2: Create Test Structure

### Create Directories

```bash
mkdir -p evals/agents/{category}/{agent-name}/{config,tests}
```

### Create Config File

```bash
cat > evals/agents/{category}/{agent-name}/config/config.yaml << 'EOF'
agent: {category}/{agent-name}
model: anthropic/claude-sonnet-4-5
timeout: 60000
suites:
  - smoke
EOF
```

### Create Smoke Test

```bash
cat > evals/agents/{category}/{agent-name}/tests/smoke-test.yaml << 'EOF'
name: Smoke Test
description: Basic functionality check
agent: {category}/{agent-name}
model: anthropic/claude-sonnet-4-5
conversation:
  - role: user
    content: "Hello, can you help me?"
expectations:
  - type: no_violations
EOF
```

---

## Step 3: Update Registry

### Auto-Detect

```bash
# Dry run first (see what would be added)
./scripts/registry/auto-detect-components.sh --dry-run

# Actually add to registry
./scripts/registry/auto-detect-components.sh --auto-add
```

### Verify Registry Entry

```bash
# Check registry
cat registry.json | jq '.components.agents[] | select(.id == "{agent-name}")'
```

---

## Step 4: Validate

### Validate Registry

```bash
./scripts/registry/validate-registry.sh
```

### Run Smoke Test

```bash
cd evals/framework
npm run eval:sdk -- --agent={category}/{agent-name} --pattern="smoke-test.yaml"
```

### Test Installation

```bash
# Test with local registry
REGISTRY_URL="file://$(pwd)/registry.json" ./install.sh --list
```

---

## Step 5: Add Additional Tests (Optional)

### Approval Gate Test

```bash
cat > evals/agents/{category}/{agent-name}/tests/approval-gate.yaml << 'EOF'
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
EOF
```

### Context Loading Test

```bash
cat > evals/agents/{category}/{agent-name}/tests/context-loading.yaml << 'EOF'
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
EOF
```

---

## Complete Example

### Example: Adding `api-specialist`

```bash
# 1. Create agent file
cat > .opencode/agent/development/api-specialist.md << 'EOF'
---
description: "Expert in REST and GraphQL API design"
category: "development"
type: "agent"
tags: ["api", "rest", "graphql"]
dependencies: ["subagent:tester"]
---

# API Specialist

**Purpose**: Design and implement robust APIs

## Focus
- REST API design
- GraphQL schemas
- API documentation
- Authentication/authorization

## Workflow
1. Analyze requirements
2. Design API structure
3. Implement endpoints
4. Add tests
5. Document API

## Constraints
- Follow REST best practices
- Use proper HTTP methods
- Include error handling
- Add comprehensive tests
EOF

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

# 3. Update registry
./scripts/registry/auto-detect-components.sh --auto-add

# 4. Validate
./scripts/registry/validate-registry.sh
cd evals/framework && npm run eval:sdk -- --agent=development/api-specialist --pattern="smoke-test.yaml"
```

---

## Checklist

Before considering the agent complete:

- [ ] Agent file created with proper frontmatter
- [ ] Test structure created (config + smoke test)
- [ ] Registry updated via auto-detect
- [ ] Registry validation passes
- [ ] Smoke test passes
- [ ] Agent appears in `./install.sh --list`
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG updated (if releasing)

---

## Common Issues

### Auto-Detect Doesn't Find Agent

**Problem**: Agent not added to registry  
**Solution**: Check frontmatter is valid YAML

### Registry Validation Fails

**Problem**: Path doesn't exist  
**Solution**: Verify file path is correct

### Test Fails

**Problem**: Agent doesn't behave as expected  
**Solution**: Load `guides/debugging.md` for troubleshooting

---

## Next Steps

After adding agent:
1. **Test thoroughly** → Load `guides/testing-agent.md`
2. **Add more tests** → Approval gate, context loading, etc.
3. **Update docs** → Add to README or docs/
4. **Create PR** → Submit for review

---

## Related Files

- **Agent concepts**: `core-concepts/agents.md`
- **Testing guide**: `guides/testing-agent.md`
- **Registry guide**: `guides/updating-registry.md`
- **Debugging**: `guides/debugging.md`

---

**Last Updated**: 2025-12-10  
**Version**: 0.5.0
