# Open Pull Request Audit — July 2026

## Purpose

This audit reviews all 18 pull requests open on 2026-07-14. It explains what each PR contributes, whether it fits OpenAgents Control, and what should happen next. No PR was merged, closed, approved, or modified during the audit.

## Decision Summary

| PR | Purpose | Recommendation | Main reason |
|---|---|---|---|
| #195 | “Auto-migration to Cloud” bundle | **Close** | Unrelated Django, CI, eval, and package changes; failed checks; no coherent OAC feature |
| #295 | Worktree management skill | **Needs redesign** | Forced worktree deletion, Docker volume deletion, hidden package-script execution, unstable ports |
| #296 | Claude plugin registration and ability executor | **Needs redesign** | Invalid manifest shape, shell injection risk, permission bypasses, fake approvals, incomplete execution |
| #297 | Installer and registry corrections | **Needs redesign** | Root-level files can escape the selected install directory; conflicts; metadata fix already merged elsewhere |
| #298 | npm/Bun OAC package manager | **Needs redesign** | Valuable direction, but duplicates merged work and can overwrite or recursively delete user-owned files |
| #300 | TDD enforcement and model router | **Needs redesign** | Unsafe registry-driven writes, impossible permission flow, language-specific policy presented as universal |
| #301 | Task router worktree detection | **Merge after minor revisions** | Correct `.git` file support, but fallback wrongly accepts arbitrary directories as project roots |
| #302 | Allow OpenCode `question` tool | **Merge** | Valid two-line permission change that improves clarification without granting execution authority |
| #305 | Task CLI Node/ESM imports | **Merge after minor revisions** | Correct narrow fix; runtime and CI typecheck/smoke-test requirements are still undeclared |
| #309 | Skip `node_modules` in updater | **Merge after minor revisions** | Focused valid fix; add a durable updater regression test |
| #311 | Eval fallback model change | **Needs redesign** | Replacement model is stale and the underlying unavailable-model false-success behavior remains |
| #312 | Auto-install Windows dependencies | **Needs redesign** | Read-only commands may silently install host software without approval |
| #314 | Nix flake and Home Manager support | **Needs redesign** | Supply-chain and approval problems; duplicates installer/resolver logic; high maintenance burden |
| #316 | OpenCode tool-barrel workaround | **Needs redesign** | Useful one-file fix bundled with unsafe approval-evaluator and unrelated behavior changes |
| #324 | MiniMax M3 support | **Merge after minor revisions** | Strong product fit; vendor capability claims and behavior values need correction and real test evidence |
| #325 | Register missing TypeScript/C# contexts | **Merge after minor revisions** | Correct registry repair; changed Bash validator needs focused tests |
| #326 | Preserve local context paths | **Needs redesign** | Fixes one path case by broadly breaking globally installed context dependencies |
| #328 | Legacy updater rewrite | **Needs redesign** | Treats network failures as local-only files and removes safe recovery from failed overwrites |

## Immediate Repository Blockers

### 1. Privileged PR workflow

`.github/workflows/validate-registry.yml` uses `pull_request_target`, grants repository write permissions, checks out contributor-controlled code, installs its dependencies, and executes its scripts. A malicious fork could execute code in a privileged workflow context.

Required direction:

- Run contributor code under `pull_request` with read-only permissions and no secrets.
- Keep any `pull_request_target` job metadata-only; never check out or execute the contributor head there.
- Move registry updates to a separate maintainer-approved workflow.
- Pin third-party actions to reviewed commit SHAs where practical.

### 2. PR checks do not trigger correctly

`.github/workflows/pr-checks.yml` declares outputs from `steps.filter.outputs.evals`, but the script writes `has-evals`. As a result, relevant TypeScript build validation can be skipped. The workflow also does not run Vitest.

Required direction:

- Make output names consistent.
- Run compilation, unit tests, and targeted validation based on changed areas.
- Ensure summary jobs fail when any required matrix job fails.

### 3. Green CI is not sufficient evidence

Most open PRs only passed registry validation. Shell installers, updater behavior, worktree cleanup, plugin loading, task CLI execution, eval behavior, Nix modules, and model tests were usually not exercised.

## Safe Processing Order

1. Fix PR workflow security and CI change detection.
2. Merge #302 after a final diff check.
3. Revise, validate, and process #309 and #325.
4. Revise and validate #305, then #301.
5. Correct model facts and run real tests for #324.
6. Close #195 after preserving any useful isolated ideas as issues.
7. Ask authors of redesign PRs to split or replace them with focused PRs based on current `main`.
8. Do not merge #295, #296, #297, #298, #300, #311, #312, #314, #316, #326, or #328 as submitted.

## Required Splits and Replacements

### #316

Create a clean PR containing only the `.opencode/tool/index.ts` workaround. Review approval-evaluator changes separately.

### #297

Recreate useful custom-selection fixes on current `main`. Exclude the unsafe root destination behavior and agent metadata already handled by merged #280.

### #296

Split into:

1. A narrow Claude Code plugin discovery/manifest correction.
2. A later permission-aware ability executor with structured arguments, real approval responses, worktree containment, and cancellation.

### #300

Split into:

1. Language-neutral TDD guidance.
2. Read-before-write agent policy.
3. Model-routing architecture proposal.
4. Optional model-specific defaults.

### #298

Treat as a v1 architecture program rather than a mergeable feature branch. Rebase against the CLI work already merged through #259 and deliver file ownership, collision safety, rollback, and migration semantics first.

## Merge Candidate Validation

| PR | Required evidence before merge |
|---|---|
| #302 | Agent configuration validation and a small runtime/eval check for question availability |
| #309 | Updater fixture covering Markdown, TypeScript, shell files, and `node_modules` exclusion |
| #325 | Bash validator fixtures for valid/missing skills and non-verbose success; profile install verification |
| #305 | Pinned runtime decision plus task CLI typecheck and smoke test |
| #301 | Real linked-worktree test; fail clearly outside a repository |
| #324 | Correct vendor capability data; TypeScript compile; Vitest; real MiniMax behavior verification |

## Audit Limitations

- Tests were intentionally not run during the read-only review phase.
- Existing checks were treated as evidence, not proof.
- Repository documentation contains contradictory standards, especially `permission` versus `permissions` and registry metadata placement.
- Package-refactor documents are proposals, not adopted architecture decisions.
