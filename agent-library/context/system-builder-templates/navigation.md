<!-- Context: system-builder-templates/navigation | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

---
description: "Overview of available templates for generating context-aware AI systems"
---

# System Builder Templates

This directory contains reusable templates for generating context-aware AI systems.
---
## Template Categories

### Agent Templates
- `orchestrator-template.md` - Main coordinator agent pattern
- `subagent-template.md` - Specialized subagent pattern
- `research-agent-template.md` - Research/information gathering pattern
- `validation-agent-template.md` - Quality assurance pattern
- `processing-agent-template.md` - Data transformation pattern

### Context Templates
- `domain-knowledge-template.md` - Domain concept documentation
- `process-workflow-template.md` - Process/workflow documentation
- `standards-template.md` - Quality and validation standards
- `template-pattern-template.md` - Reusable output templates

### Workflow Templates
- `simple-workflow-template.md` - Linear 3-5 stage workflow
- `moderate-workflow-template.md` - Multi-step with decisions
- `complex-workflow-template.md` - Multi-agent coordination

### Command Templates
- `simple-command-template.md` - Single parameter command
- `parameterized-command-template.md` - Multi-parameter with flags

### Documentation Templates
- `readme-template.md` - System overview README
- `architecture-template.md` - Architecture documentation
- `testing-template.md` - Testing checklist
- `quickstart-template.md` - Quick start guide

## Usage

These templates are used by the system-builder subagents to generate consistent,
high-quality files following research-backed patterns.

Each template includes:
- XML structure with optimal component ordering
- Placeholder markers for customization
- Example content
- Validation criteria
- Best practices

## Template Variables

Templates use these variable patterns:
- `{domain}` - Domain name
- `{agent_name}` - Agent name
- `{purpose}` - Purpose description
- `{workflow_name}` - Workflow name
- `{context_file}` - Context file reference

## Quality Standards

All templates follow:
- Stanford/Anthropic XML research patterns
- Optimal component ordering (context→role→task→instructions)
- Hierarchical context structure
- @ symbol routing for subagents
- 3-level context allocation
- Validation gates and checkpoints
