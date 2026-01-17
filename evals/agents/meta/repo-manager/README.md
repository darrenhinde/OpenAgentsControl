# Repository Manager Agent - Eval Tests

**Agent**: `meta/repo-manager`  
**Version**: 1.0.0  
**Category**: Meta  
**Type**: Meta Agent

---

## Overview

Eval tests for the Repository Manager meta agent. This agent orchestrates OpenAgents Control repository development with context-aware planning, task breakdown, and automatic documentation.

## Test Suites

### Smoke Test (`smoke-test.yaml`)
Basic functionality verification:
- Context loading for informational queries
- Approval gate enforcement
- Context awareness for repo-specific questions

**Run**: 
```bash
cd evals/framework
npm run eval:sdk -- --agent=meta/repo-manager --pattern="smoke-test.yaml"
```

### Context Loading Test (`context-loading-test.yaml`)
Verifies appropriate context loading for different task types:
- Agent creation tasks
- Eval testing tasks
- Registry management tasks

**Run**:
```bash
cd evals/framework
npm run eval:sdk -- --agent=meta/repo-manager --pattern="context-loading-test.yaml"
```

### Delegation Test (`delegation-test.yaml`)
Verifies delegation decisions and context bundle creation:
- Complex features → delegate to task-manager
- Simple tasks → execute directly
- Documentation → delegate to documentation subagent

**Run**:
```bash
cd evals/framework
npm run eval:sdk -- --agent=meta/repo-manager --pattern="delegation-test.yaml"
```

## Running All Tests

```bash
cd evals/framework
npm run eval:sdk -- --agent=meta/repo-manager
```

## Test Coverage

**Context Loading**: ✅ Covered  
**Approval Gates**: ✅ Covered  
**Delegation Logic**: ✅ Covered  
**Context Bundles**: ✅ Covered  
**Validation**: ⚠️ Partial (needs integration tests)  
**Documentation Updates**: ⚠️ Partial (needs integration tests)

## Known Limitations

- Integration tests for full workflow not yet implemented
- Validation script execution not tested in isolation
- Documentation update detection needs more test cases

## Future Test Cases

- [ ] Full agent creation workflow (end-to-end)
- [ ] Validation failure handling
- [ ] Documentation update detection
- [ ] Session cleanup verification
- [ ] Multi-step task coordination
- [ ] Error recovery scenarios

---

**Last Updated**: 2025-01-21  
**Maintainer**: opencode
