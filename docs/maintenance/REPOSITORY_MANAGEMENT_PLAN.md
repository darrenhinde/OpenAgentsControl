# OpenAgents Control Repository Management Plan

## Product Definition

OpenAgents Control should be maintained as a **human-controlled orchestration and context layer for AI-assisted work**, initially focused on software development.

Its current product promise is:

1. **Project-aware output** — agents load version-controlled project and team patterns before acting.
2. **Human control** — agents propose plans and request approval before execution or destructive operations.
3. **Editable behavior** — agents and context remain inspectable Markdown/configuration rather than hidden proprietary behavior.
4. **Repeatability** — teams can share context, agents, and workflows through source control.
5. **Behavioral validation** — the eval framework checks approval gates, context loading, tool use, and failure handling.
6. **Distribution** — a registry, profiles, installer, and package tooling distribute supported components.
7. **Model flexibility** — users can choose providers and models without redesigning the workflow.

OpenCode is the primary runtime today. Claude Code support is beta. Cursor, Windsurf, a larger package manager, marketplace, lockfile, and broad multi-IDE management are strategic directions, not fully adopted current commitments.

## Primary Users

### Current priority

1. **Solo developers** who want safe setup, predictable behavior, and quick recovery.
2. **Team leads** who need shared standards, reproducible configuration, and controlled changes.

### Later users

- Open-source maintainers who publish and review community components.
- Content creators who would require simpler or graphical interfaces.
- Enterprise administrators, which should remain post-v1 rather than driving current complexity.

## Product Principles

Every feature should pass these tests:

- **Safe by default:** no silent package installs, destructive cleanup, overwrites, or remote execution.
- **Previewable:** risky operations show planned effects before execution.
- **Recoverable:** backups, atomic writes, rollback, and clear failure states.
- **Local-first:** project configuration wins when working in a repository.
- **User-owned customization:** updates must not destroy unmanaged or modified files.
- **One source of truth:** avoid independent installer, resolver, model, and metadata implementations.
- **Evidence-driven:** tests must exercise the behavior actually changed.
- **Focused changes:** large architectural ideas are split into reviewable vertical slices.

## Current Architecture

The implemented repository has four central systems:

1. **Agents and subagents** in `.opencode/agent/` define orchestrators and delegated specialists.
2. **Context** in `.opencode/context/` records standards, workflows, and project knowledge discovered lazily by ContextScout.
3. **Registry and profiles** in `registry.json` and `.opencode/profiles/` describe distributable components and dependencies.
4. **Evaluation and validation** in `evals/` and `scripts/` test agent behavior and repository structure.

Additional systems include the shell installer/updater, Claude Code plugin, compatibility package, task management, skills, and experimental ability enforcement.

## Strategic Decisions Required

Record these as ADRs before restarting the large v1 refactor:

1. **Installer authority:** Bash, Node/Bun CLI, or one shared resolver consumed by all frontends.
2. **File ownership:** define generated, OAC-owned, user-edited, and unmanaged files.
3. **Runtime:** supported Node versions and whether Bun is required, optional, or build-only.
4. **Registry versioning:** separate package version, registry data version, and schema version.
5. **Agent metadata:** decide between strict OpenCode frontmatter and centralized metadata.
6. **Permission syntax:** adopt singular `permission` and retire contradictory examples.
7. **Model configuration:** inherited runtime defaults, per-agent values, or a central optional router.
8. **Multi-IDE scope:** define what is native, converted, or intentionally unsupported.
9. **Editable versus declarative installs:** define how Nix/immutable modes coexist with editable agents.
10. **Release model:** version bump, npm publication, GitHub release, rollback, and support policy.

## Roadmap

### Phase 0 — Security and governance

- Fix privileged PR workflow execution.
- Fix broken PR change detection and add meaningful test jobs.
- Add `SECURITY.md` and enable private vulnerability reporting.
- Define required checks and branch protection.
- Establish the source-of-truth hierarchy for code, registry, docs, context, and planning proposals.

### Phase 1 — Stabilize 0.7.x

- Process the six focused merge candidates from the July PR audit.
- Fix installer, context-path, updater, and task-management regressions through focused replacements.
- Correct stale README, roadmap, changelog, version, and context documentation.
- Establish Linux, macOS, Windows/Git Bash, and worktree validation where relevant.
- Publish one stabilization release after installation and update smoke tests pass.

### Phase 2 — Decide the v1 architecture

- Write and approve the ten ADRs above.
- Define a shared file-ownership and installation contract.
- Reconcile the shell installer with the existing CLI work from #259.
- Define migration from current installations.
- Decide which package-refactor features are truly v1: onboarding, discovery, lockfile, rollback, security, and multi-IDE support.

### Phase 3 — Deliver v1 incrementally

- Build vertical slices, not one large branch.
- Start with safe initialization and ownership tracking.
- Add doctor/status and rollback before broad update automation.
- Add reproducible lockfiles before community distribution.
- Add marketplace/community features only after signing, verification, and contribution governance exist.

## PR Management Policy

### Intake

Every PR must have:

- A linked issue or a clear reason why one is unnecessary.
- One problem and one coherent outcome.
- Scope, risk, user impact, and test plan.
- Conventional title.
- Documentation and migration notes when behavior changes.

### Required review states

- **Needs triage** — metadata and ownership incomplete.
- **Ready for review** — checks pass and acceptance criteria are clear.
- **Changes requested** — actionable blockers recorded.
- **Approved** — no unresolved critical findings.
- **Deferred** — valid but not aligned with the current roadmap.
- **Superseded/close** — stale, duplicated, or replaced.

### Size policy

- Small fix: ideally fewer than 200 changed lines.
- Feature: one independently testable vertical slice.
- Architecture program: tracking issue plus multiple PRs; never a single 10k–20k-line merge.

### Review SLA

- Security: same day.
- User-blocking bug: 2 business days.
- Small maintenance PR: 5 business days.
- Feature or architecture PR: triage within 7 days; schedule separately.

## Issue Management Policy

- Triage new issues weekly.
- Label by type, area, priority, and status.
- Close answered questions after confirmation or a reasonable inactivity period.
- Merge duplicates into one canonical issue.
- Require reproduction details for bugs before implementation unless impact is urgent.
- Convert large features into an epic with explicit decisions and vertical slices.
- Add progress comments at least every two weeks for active work.

## Worktree and Branch Policy

- Use one worktree per active PR or focused issue.
- Keep worktrees outside the main checkout in a single managed parent directory.
- Never force-remove a dirty worktree by default.
- Never delete Docker volumes, environment files, or branches as an implicit cleanup step.
- Never run dependency lifecycle scripts automatically when checking out an untrusted PR.
- Remove worktrees only after verifying clean state and merged/abandoned status.
- Delete remote branches after merge unless retained for an active release or long-running program.
- Review stale branches monthly.

## Validation Matrix

| Changed area | Minimum validation |
|---|---|
| Agent/context | Frontmatter validation, registry validation, context links, focused eval |
| Registry/profile | TypeScript and Bash validator tests, dependency resolution, profile install smoke test |
| Installer/updater | Shell syntax, unit fixtures, clean install, upgrade, collision, rollback, platform matrix |
| Eval framework | TypeScript build, Vitest, suite validation, focused SDK test |
| Plugin | Manifest validation, installed-plugin discovery, command/skill smoke test |
| Task/worktree tooling | Shell tests, normal checkout, linked worktree, dirty-state and containment tests |
| Package/CLI | Typecheck, unit tests, `npm pack`, clean global/local install, migration test |
| Workflow | Least-privilege review, fork simulation, required-check behavior |
| Documentation | Link validation, version/current-command review |

## Release Management

Before release:

1. Confirm approved scope and semantic version.
2. Run the complete validation matrix for affected systems.
3. Reconcile `VERSION`, package versions, registry/schema versions, and lockfiles.
4. Update a chronological, user-focused changelog.
5. Verify package contents with `npm pack`.
6. Test fresh install and update from the previous supported version.
7. Publish npm artifacts and GitHub release through a documented, auditable runbook.
8. Verify installation from the published artifacts.
9. Record rollback instructions and known issues.

## Maintenance Cadence

### Weekly

- Triage new issues and PRs.
- Review security and user-blocking reports first.
- Keep no more than three implementation items actively in progress.
- Update owners, status, and blockers.

### Monthly

- Review stale PRs, issues, branches, and worktrees.
- Audit dependency and action updates.
- Check README, roadmap, changelog, and context drift.
- Review release readiness and health metrics.

### Quarterly

- Reconfirm product priorities and supported platforms.
- Review accepted ADRs and deprecations.
- Audit installer/resolver duplication and maintenance cost.
- Review contributor experience and security posture.

## Health Metrics

Track:

- Median time to first PR review.
- Open security and user-blocking issues.
- PRs older than 30 days without a decision.
- Percentage of PRs with meaningful behavioral tests.
- Install/update success by supported platform.
- Documentation pages known to be stale.
- Number of active versus stale branches and worktrees.
- Release frequency and rollback incidents.

## Source-of-Truth Order

Until formal ADRs are adopted, use:

1. Executable code, package manifests, registry, and active workflows.
2. Root README for current public positioning.
3. Package-level READMEs for implemented package behavior.
4. Current repository standards and context.
5. Contributor guides and historical audits.
6. `docs/archive/planning/` as archived historical proposals only.
