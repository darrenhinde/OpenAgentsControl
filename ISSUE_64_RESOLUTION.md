# Issue #64 Resolution: Missing Agents in v0.5.0 Install

**Issue**: https://github.com/darrenhinde/OpenAgents/issues/64  
**Status**: ✅ RESOLVED  
**Date**: 2025-12-29  
**Version**: 0.5.1

---

## Problem Summary

Users installing OpenAgents v0.5.0 with the `developer` profile were not getting the new agents (devops-specialist, frontend-specialist, backend-specialist, etc.) that were added in the release.

### Root Cause

New agents were added to `registry.json` in the `components.agents[]` array, but were **NOT added to the installation profiles**. The install script only copies components listed in the selected profile's `components` array.

---

## Fixes Applied

### Registry Profile Updates

**developer** profile - Added:
- agent:frontend-specialist
- agent:backend-specialist
- agent:devops-specialist
- agent:codebase-agent

**business** profile - Added:
- agent:copywriter
- agent:technical-writer
- agent:data-analyst

**full** profile - Added:
- agent:eval-runner
- All development agents
- All content agents
- All data agents

**advanced** profile - Added:
- agent:repo-manager
- agent:eval-runner
- subagent:context-retriever
- All development, content, and data agents

### Version Bump

- Updated VERSION: 0.5.0 → 0.5.1
- Updated package.json: 0.5.0 → 0.5.1

### New Documentation

1. **Profile Validation Guide** (`.opencode/context/openagents-repo/guides/profile-validation.md`)
2. **Subagent Invocation Guide** (`.opencode/context/openagents-repo/guides/subagent-invocation.md`)
3. **Profile Coverage Script** (`scripts/registry/validate-profile-coverage.sh`)

---

## Validation

✅ Profile coverage check: **PASSED**
✅ Registry validation: **PASSED**

---

**Resolution Date**: 2025-12-29  
**Fixed By**: repo-manager agent  
**Release**: v0.5.1
