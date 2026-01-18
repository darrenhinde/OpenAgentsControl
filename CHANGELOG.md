# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
## [0.5.3] - 2026-01-18

### Changes
- fix: make admin bypass work properly for bot PRs (#113)

## [0.5.2] - 2026-01-13

### Changes
- docs(core): refine project intelligence system and deprecate legacy context (#93)

## [0.5.0] - 2025-12-18

### Changes
- refactor(evals): consolidate documentation and enhance test infrastructure (#56)


### Added
- **Explicit Context File Validation**: New `expectedContextFiles` field in test YAML files allows explicit specification of which context files the agent must read
  - Overrides auto-detection when specified
  - Uses flexible pattern matching (`includes()` or `endsWith()`)
  - Supports partial paths (e.g., `standards/code.md`) or full paths
  - See `evals/agents/shared/tests/EXPLICIT_CONTEXT_FILES.md` for detailed guide
  - Example test: `evals/agents/shared/tests/golden/02-context-loading-explicit.yaml`

### Changed
- **Context Loading Evaluator**: Now accepts optional `BehaviorExpectation` config to support explicit file validation
  - Shows detection mode in evidence: "Explicit (from YAML test)" or "Auto-detect (from user message)"
  - Backward compatible - existing tests work unchanged

### Documentation
- Added `evals/agents/shared/tests/EXPLICIT_CONTEXT_FILES.md` - Complete feature guide
- Added `evals/PATTERN_MATCHING_GUIDE.md` - Pattern matching reference
- Updated `evals/CREATING_TESTS.md` - Added `expectedContextFiles` documentation
- Updated `evals/README.md` - Added new feature section

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2025-12-10

### Added
- **Category-Based Agent Organization**: Agents now organized by domain in subdirectories
  - `core/` - Core system agents (openagent, opencoder)
  - `meta/` - Meta-level agents (system-builder)
  - `development/` - Development specialists (frontend-specialist, backend-specialist, devops-specialist, codebase-agent)
  - `content/` - Content creation agents (copywriter, technical-writer)
  - `data/` - Data and analysis agents (data-analyst)
  - `product/` - Product management agents (directory created, ready for agents)
  - `learning/` - Education and coaching agents (directory created, ready for agents)
- **Category Metadata Files**: Each category has `0-category.json` documenting common subagents, tools, and context
- **Subagent Organization**: 13 subagents organized into 4 categories (code, core, system-builder, utils)
- **Local Registry Fallback**: Install script now supports local `registry.json` for development/testing
- **Enhanced Registry Validation**: Added checks for duplicate IDs and category consistency
- **Comprehensive Test Suite**: 15 automated validation tests for category system
- **Audit Tools**: Scripts to verify migration completeness and system integrity

### Changed
- **Agent File Structure**: Agents moved from flat structure to category-based organization
  - Example: `.opencode/agent/openagent.md` → `.opencode/agent/core/openagent.md`
  - Example: `.opencode/agent/opencoder.md` → `.opencode/agent/core/opencoder.md`
- **Registry Schema**: Updated to include category-based paths for all agents
- **Eval Framework**: Enhanced with path resolution supporting both agent IDs and category paths
  - `--agent=openagent` resolves to `core/openagent` (backward compatible)
  - `--agent=core/openagent` works directly (new format)
- **Documentation**: Updated all docs to reference category-based structure
- **Install Script**: Enhanced with local registry fallback for offline/development use

### Fixed
- **Frontend Specialist**: Renamed `frontend-design-agent.md` to `frontend-specialist.md` for consistency
- **Eval Directory Structure**: Archived legacy flat eval structure to `_archive/` for clarity
- **Registry Validation**: Fixed validation script to handle category-based paths correctly

### Developer Experience
- **Backward Compatibility**: Agent IDs like `openagent` still work via path resolution
- **Local Testing**: No need to push to GitHub to test registry changes
- **Clear Organization**: Agents grouped by domain make discovery easier
- **Validation Tools**: Automated tests ensure system integrity

### Migration Notes
- **Agent Paths**: Update references from flat to category-based paths
  - Old: `.opencode/agent/openagent.md`
  - New: `.opencode/agent/core/openagent.md`
- **Eval Framework**: Both formats work due to path resolution
  - `--agent=openagent` (backward compatible)
  - `--agent=core/openagent` (new format)
- **No Breaking Changes**: Path resolution maintains backward compatibility

### Technical Details
- **Files Modified**: 14+ files updated for category structure
- **Agents Organized**: 23 total agents (10 category agents, 13 subagents)
- **Test Coverage**: 15/15 validation tests passing (100%)
- **Audit Status**: 8/8 checks passing (100%)

## [0.3.1] - 2025-12-09

### Fixed
- CI: Check only commit title for skip patterns (#46)

## [0.0.2] - 2025-11-29

### Added
- New `ExecutionBalanceEvaluator` in `evals/framework` to assess read vs execution ordering and ratio
- Contributor guide: `docs/contributing/ADDING_EVALUATOR.md` describing evaluator design principles
- Test cases under `evals/agents/openagent/tests/10-execution-balance/` (positive & negative scenarios)

### Changed
- Framework README updated with section documenting `ExecutionBalanceEvaluator` and violation codes

## [0.5.1] - 2025-12-31

### Fixed
- **Install Script Non-Interactive Bug**: Fixed critical bug where `curl | bash -s <profile>` would fail with "Installation cancelled by user" when existing files were present
  - Root cause: Collision handling prompted for user input even in non-interactive mode
  - Solution: Auto-detect non-interactive mode and use "skip" strategy by default

### Added
- **Installer CI Workflow**: New `.github/workflows/installer-checks.yml` runs on install.sh changes
  - ShellCheck static analysis
  - Bash syntax validation
  - Non-interactive mode tests
  - End-to-end installation tests
  - Profile smoke tests on Ubuntu and macOS
- **Non-Interactive Tests**: New `scripts/tests/test-non-interactive.sh` validates piped execution
- **E2E Installation Tests**: New `scripts/tests/test-e2e-install.sh` validates full installation workflow

### Changed
- Updated `scripts/tests/README.md` with new test documentation

## [0.5.0] - 2025-12-18

### Added
- **Explicit Context File Validation**: New `expectedContextFiles` field in test YAML files
  - Overrides auto-detection when specified
  - Uses flexible pattern matching (`includes()` or `endsWith()`)
  - Supports partial paths (e.g., `standards/code.md`) or full paths

### Changed
- **Context Loading Evaluator**: Now accepts optional `BehaviorExpectation` config
  - Shows detection mode in evidence: "Explicit (from YAML test)" or "Auto-detect (from user message)"
  - Backward compatible - existing tests work unchanged

### Documentation
- Added `evals/agents/shared/tests/EXPLICIT_CONTEXT_FILES.md` - Complete feature guide
- Added `evals/PATTERN_MATCHING_GUIDE.md` - Pattern matching reference
- Updated `evals/CREATING_TESTS.md` and `evals/README.md`

## [0.4.0] - 2025-12-10

### Added
- **Category-Based Agent Organization**: Agents now organized by domain in subdirectories
  - `core/` - Core system agents (openagent, opencoder)
  - `meta/` - Meta-level agents (system-builder)
  - `development/` - Development specialists (frontend-specialist, backend-specialist, devops-specialist, codebase-agent)
  - `content/` - Content creation agents (copywriter, technical-writer)
  - `data/` - Data and analysis agents (data-analyst)
  - `product/` - Product management agents (directory created, ready for agents)
  - `learning/` - Education and coaching agents (directory created, ready for agents)
- **Category Metadata Files**: Each category has `0-category.json` documenting common subagents, tools, and context
- **Subagent Organization**: 13 subagents organized into 4 categories (code, core, system-builder, utils)
- **Local Registry Fallback**: Install script now supports local `registry.json` for development/testing
- **Enhanced Registry Validation**: Added checks for duplicate IDs and category consistency
- **Comprehensive Test Suite**: 15 automated validation tests for category system
- **Audit Tools**: Scripts to verify migration completeness and system integrity

### Changed
- **Agent File Structure**: Agents moved from flat structure to category-based organization
  - Example: `.opencode/agent/openagent.md` → `.opencode/agent/core/openagent.md`
  - Example: `.opencode/agent/opencoder.md` → `.opencode/agent/core/opencoder.md`
- **Registry Schema**: Updated to include category-based paths for all agents
- **Eval Framework**: Enhanced with path resolution supporting both agent IDs and category paths
  - `--agent=openagent` resolves to `core/openagent` (backward compatible)
  - `--agent=core/openagent` works directly (new format)
- **Documentation**: Updated all docs to reference category-based structure
- **Install Script**: Enhanced with local registry fallback for offline/development use

### Fixed
- **Frontend Specialist**: Renamed `frontend-design-agent.md` to `frontend-specialist.md` for consistency
- **Eval Directory Structure**: Archived legacy flat eval structure to `_archive/` for clarity
- **Registry Validation**: Fixed validation script to handle category-based paths correctly

### Developer Experience
- **Backward Compatibility**: Agent IDs like `openagent` still work via path resolution
- **Local Testing**: No need to push to GitHub to test registry changes
- **Clear Organization**: Agents grouped by domain make discovery easier
- **Validation Tools**: Automated tests ensure system integrity

### Migration Notes
- **Agent Paths**: Update references from flat to category-based paths
  - Old: `.opencode/agent/openagent.md`
  - New: `.opencode/agent/core/openagent.md`
- **Eval Framework**: Both formats work due to path resolution
  - `--agent=openagent` (backward compatible)
  - `--agent=core/openagent` (new format)
- **No Breaking Changes**: Path resolution maintains backward compatibility

### Technical Details
- **Files Modified**: 14+ files updated for category structure
- **Agents Organized**: 23 total agents (10 category agents, 13 subagents)
- **Test Coverage**: 15/15 validation tests passing (100%)
- **Audit Status**: 8/8 checks passing (100%)

## [0.3.1] - 2025-12-09

### Fixed
- CI: Check only commit title for skip patterns (#46)

## [0.0.2] - 2025-11-29

### Added
- New `ExecutionBalanceEvaluator` in `evals/framework` to assess read vs execution ordering and ratio
- Contributor guide: `docs/contributing/ADDING_EVALUATOR.md` describing evaluator design principles
- Test cases under `evals/agents/openagent/tests/10-execution-balance/` (positive & negative scenarios)

### Changed
- Framework README updated with section documenting `ExecutionBalanceEvaluator` and violation codes

---

## Version Format

```
v0.X.Y
│ │ │
│ │ └─ Patch version (bug fixes, minor changes)
│ └─── Minor version (new features, non-breaking changes)
└───── Major version (breaking changes, major milestones)
```

### Version History
- **0.5.1** - Install script bug fix, CI improvements for installer
- **0.5.0** - Explicit context file validation in evals
- **0.4.0** - Category-based agent organization system
- **0.3.1** - CI improvements
- **0.0.2** - Execution balance evaluator
