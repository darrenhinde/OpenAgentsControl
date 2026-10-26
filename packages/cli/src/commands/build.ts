/**
 * `oac build` — generate every target's tree from the canonical `content/agents/**` source.
 *
 * ## This file is wiring, not logic
 *
 * The pipeline itself lives in `@controlstack/compatibility-layer`
 * (`src/core/BuildPipeline.ts`): loading, adapting, orphan pruning and drift detection are all
 * there, under vitest, Node-clean. This module parses flags, checks targets, and prints.
 * Nothing here uses a Bun API.
 *
 * ## Every target is emitted in place, under `hosts/`
 *
 * Each target's primary output is its folder under `hosts/`: `hosts/opencode/agent/**` (v2),
 * `hosts/opencode-v1/agent/**` and `hosts/claude-code/agents/**`, side by side. The live paths
 * are byte-identical generated MIRRORS of those: `.opencode/agent/**` (this repo's own
 * OpenCode, and the paths `registry.json` hands installers) and `plugins/claude-code/agents/**`
 * (the Claude Code marketplace source). Mirrors are ledgered, pruned and drift-checked like any
 * other output, so a hand-edited mirror is drift. With `registry.json` and `registry.v1.json`
 * these are all BUILD OUTPUT: committed, and rebuilt by the CI drift gate
 * (`scripts/validation/check-build-drift.sh`), which fails on any diff.
 *
 * `hosts/README.md` is generated too (`core/HostsReadme.ts`): an index of every host's folder,
 * live mirrors, the agent × host matrix and every degradation warning. It describes all hosts,
 * so only a full build (no `--target`, or every target) writes it; a targeted build carries it
 * forward untouched, and the next full build refreshes it.
 *
 * The Claude Code agents used to be the exception: hand-written, and only compared against a
 * staged copy under `.tmp/oac-build/`. That was because the shipped files were adapted to
 * Claude in ways canonical had no field for, and a rebuild destroyed them. `104356a` did
 * exactly that: it copied the staged output over the shipped tree and lost the `<example>`
 * dispatch blocks and the capability-adapted bodies (L-001).
 *
 * That gap is now closed in the canonical source itself (D-017):
 *
 * 1. **Frontmatter** comes from `oac.overrides.claude-code` in each `content/agents/**` file:
 *    the authored `tools`/`disallowedTools` and the Claude `description` with its `<example>`
 *    blocks, which are how Claude Code selects an agent.
 * 2. **Body** differences are `<!-- oac:only ... -->` host blocks (`core/HostBlocks.ts`): text
 *    that only one host's output keeps, such as "context is pre-loaded by the main agent" for
 *    a Claude agent that has no `Task` tool, in place of OpenCode's "call ContextScout".
 *
 * What stops L-001 from coming back is not the build but two guards. The capability lint
 * (`verify/lint/capability.ts`, run by {@link reportLints} on every build and fatal under
 * `--strict`) flags an emitted agent told to delegate without `Task`, to run bash without
 * `Bash`, a Claude description with no `<example>`, or a leaked `.opencode/` path. The golden
 * test (`tests/golden/golden-files.test.ts`) asserts the committed Claude tree equals fresh
 * build output byte-for-byte.
 */

import { type Command } from 'commander'
import {
  BUILD_TARGETS,
  check as checkPlan,
  lintBuild,
  plan as planBuild,
  ReferenceResolver,
  write as writePlan,
  type BuildPlan,
  type BuildTarget,
  type Drift,
} from '@controlstack/compatibility-layer'

import { bold, dim, error, info, log, setVerbose, success, verbose, warn } from '../ui/logger.js'

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Targets emitted in place: all of them. A target the pipeline gains later is refused here
 * until someone decides where its output goes, rather than silently written somewhere.
 */
export const IN_PLACE_TARGETS: readonly BuildTarget[] = ['opencode', 'opencode-v1', 'claude-code']

// ── Types ────────────────────────────────────────────────────────────────────

export type BuildOptions = {
  target?: string[]
  check: boolean
  dryRun: boolean
  strict: boolean
  prune: boolean
  verbose: boolean
  json: boolean
}

// ── Target selection (pure) ──────────────────────────────────────────────────

/** Validate `--target` against what the build actually wires up. Pure. */
export const selectTargets = (requested: readonly string[] | undefined): BuildTarget[] => {
  if (requested === undefined || requested.length === 0) return [...BUILD_TARGETS]

  const unknown = requested.filter((name) => !BUILD_TARGETS.includes(name as BuildTarget))
  if (unknown.length > 0) {
    throw new Error(
      `unknown target(s): ${unknown.join(', ')}. Known targets: ${BUILD_TARGETS.join(', ')}`,
    )
  }

  return requested as BuildTarget[]
}

/** Refuse any selected target that is not wired for in-place emission. Pure. */
export const assertInPlace = (targets: readonly BuildTarget[]): void => {
  const unwired = targets.filter((target) => !IN_PLACE_TARGETS.includes(target))
  if (unwired.length > 0) {
    throw new Error(`target(s) not wired for in-place emission: ${unwired.join(', ')}`)
  }
}

// ── Reporting ────────────────────────────────────────────────────────────────

const reportWarnings = (built: BuildPlan): void => {
  for (const warning of built.warnings) verbose(`${warning.source}: ${warning.reason}`)
}

/**
 * Dead `type:id` references in the tree, reported with their source.
 *
 * Read against the registry ON DISK, so this describes the tree as it stands. The tree
 * carries zero dead references (the four found 2026-07-15 were repaired 2026-07-17, gated in
 * `tests/unit/build/reference-resolution.test.ts`), so any reported here is new rot. Reported
 * rather than fatal by default so a broken ref cannot block an unrelated build; `--strict`
 * makes them fatal, and CI's test suite catches them regardless.
 */
const reportDeadReferences = async (root: string): Promise<number> => {
  const dead = await new ReferenceResolver(root).findDeadReferences()
  for (const resolution of dead) {
    warn(`${resolution.source}: ${resolution.ref} — ${resolution.reason ?? resolution.status}`)
  }
  return dead.length
}

/**
 * Static lints over what this build would emit: host-validity lints
 * for OpenCode v1/v2 and the capability lint (L-001: an agent told to delegate without `Task`,
 * to run bash without `Bash`, a Claude description with no `<example>`, a leaked `.opencode/`
 * path). Reported always; fatal only under `--strict`, like degradation warnings, so a prompt
 * still being converged cannot block an unrelated build.
 */
const reportLints = (built: BuildPlan): number => {
  let count = 0
  for (const { target, findings } of lintBuild(built.files)) {
    for (const finding of findings) {
      const line = `${target}: ${finding.path} [${finding.rule}] ${finding.message}`
      if (finding.severity === 'warning') warn(line)
      else error(line)
    }
    count += findings.length
  }
  return count
}

/** `--strict` fails on any warning, dead reference or lint finding. Pure. */
export const strictExitCode = (strict: boolean, ...counts: number[]): number =>
  strict && counts.some((count) => count > 0) ? 1 : 0

const reportDrift = (drift: readonly Drift[]): void => {
  for (const entry of drift) error(`${entry.status.padEnd(8)} ${entry.path}`)
}

// ── Command ──────────────────────────────────────────────────────────────────

export const runBuild = async (options: BuildOptions, root: string): Promise<number> => {
  setVerbose(options.verbose)

  const targets = selectTargets(options.target)
  assertInPlace(targets)

  const built = await planBuild({ root, targets })
  reportWarnings(built)

  const deadCount = await reportDeadReferences(root)
  const warningCount = built.warnings.length
  const lintCount = reportLints(built)

  bold('\n  oac build')
  info(`${built.agents.length} canonical agents -> ${built.files.length} files`)

  // --check and --dry-run share the plan above; neither writes. A check that re-derived the
  // build would eventually disagree with the build, and CI would trust the wrong one.
  if (options.check || options.dryRun) {
    const drift = checkPlan(built, { root })

    if (drift.length === 0) info('no drift — generated trees match the canonical source')
    else reportDrift(drift)

    summarize(warningCount, deadCount, lintCount, options.strict)

    if (options.check && drift.length > 0) return 1
    return strictExitCode(options.strict, warningCount, deadCount, lintCount)
  }

  const result = writePlan(built, { root, prune: options.prune })

  for (const path of result.changed) success(`wrote   ${path}`)
  for (const path of result.removed) success(`removed ${path} (orphan — source is gone)`)
  for (const { path, reason } of result.kept) warn(`kept    ${path}: ${reason}`)

  info(
    `${result.changed.length} written, ${result.unchanged.length} unchanged, ` +
      `${result.removed.length} removed`,
  )

  summarize(warningCount, deadCount, lintCount, options.strict)

  return strictExitCode(options.strict, warningCount, deadCount, lintCount)
}

const summarize = (
  warningCount: number,
  deadCount: number,
  lintCount: number,
  strict = false,
): void => {
  log('')
  if (warningCount === 0 && deadCount === 0 && lintCount === 0) {
    success('0 warnings')
    return
  }
  warn(
    `${warningCount} degradation warning(s), ${deadCount} dead reference(s), ` +
      `${lintCount} lint finding(s)`,
  )
  if (strict) {
    dim('    Strict mode: exiting 1 (use --verbose to list every warning).')
  } else {
    dim('    Re-run with --verbose to list every warning, or --strict to fail on them.')
  }
}

export const registerBuildCommand = (program: Command): void => {
  program
    .command('build')
    .description('Generate tool output from the canonical content/ source')
    .option(
      '--target <tool...>',
      `build only these targets (${BUILD_TARGETS.join(', ')})`,
    )
    .option('--check', 'report drift and write nothing; exit 1 if the tree is stale', false)
    .option('--dry-run', 'preview the build and write nothing', false)
    .option('--strict', 'exit 1 if there is any warning, dead reference or lint finding', false)
    .option('--no-prune', 'keep generated files whose canonical source is gone')
    .option('--verbose', 'list every degradation warning', false)
    .option('--json', 'reserved for machine-readable output', false)
    .action(async (options: BuildOptions) => {
      try {
        process.exitCode = await runBuild(options, process.cwd())
      } catch (cause) {
        error(cause instanceof Error ? cause.message : String(cause))
        process.exitCode = 1
      }
    })
}
