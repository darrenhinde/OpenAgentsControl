# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
## [0.3.2] - 2025-12-09

### Changes
- refactor(ci): rename workflow to clarify it only handles version bumps (#48)

## [0.3.1] - 2025-12-09

### Changes
- fix(ci): check only commit title for skip patterns (#46)


_No unreleased changes yet._

## [0.0.2] - 2025-11-29

### Added
- New `ExecutionBalanceEvaluator` in `evals/framework` to assess read vs execution ordering and ratio.
- Contributor guide: `docs/contributing/ADDING_EVALUATOR.md` (English) describing evaluator design principles.
- Test cases under `evals/agents/openagent/tests/10-execution-balance/` (positive & negative scenarios).

### Changed
- Framework README updated with section documenting `ExecutionBalanceEvaluator` and violation codes.

---

## Version Format

```
v0.0.X
│ │ │
│ │ └─ Patch version (increments with each release)
│ └─── Minor version (feature additions)
└───── Major version (breaking changes)
```
