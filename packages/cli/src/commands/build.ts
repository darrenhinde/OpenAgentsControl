/**
 * `oac build` — generate every target's tree from the canonical `agent-library/agents/**` source.
 *
 * ## This file is wiring, not logic
 *
 * The pipeline itself lives in `@controlstack/agent-compiler`
 * (`src/core/BuildPipeline.ts`): loading, adapting, orphan pruning and drift detection are all
 * there, under vitest, Node-clean. This module parses flags, checks targets, and prints.
 * Nothing here uses a Bun API.
 *
 * ## Every target is emitted in place, under `built-ai-configs/`
 *
 * Each target's primary output is its folder under `built-ai-configs/`: `built-ai-configs/opencode/agent/**` (v2),
 * `built-ai-configs/opencode-v1/agent/**` and `built-ai-configs/claude-code/agents/**`, side by side. The live paths
 * are byte-identical generated MIRRORS of those: `.opencode/agent/**` (this repo's own
 * OpenCode, and the paths `built-ai-configs/registry/registry.json` hands installers) and `plugins/claude-code/agents/**`
 * (the Claude Code marketplace source). Mirrors are ledgered, pruned and drift-checked like any
 * other output, so a hand-edited mirror is drift. With `built-ai-configs/registry/registry.json` and `built-ai-configs/registry/registry.v1.json`
 * these are all BUILD OUTPUT: committed, and rebuilt by the CI drift gate
 * (`scripts/validation/check-build-drift.sh`), which fails on any diff.
 *
 * `built-ai-configs/README.md` is generated too (`core/HostsReadme.ts`): an index of every host's folder,
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
 * 1. **Frontmatter** comes from `oac.overrides.claude-code` in each `agent-library/agents/**` file:
 *    the authored `tools`/`disallowedTools` and the Claude `description` with its `<example>`
 *    blocks, which are how Claude Code selects an agent.
 * 2. **Body** differences are `<!-- oac:only ... -->` host blocks (`core/HostBlocks.ts`): text
 *    that only one host's output keeps, such as "context is pre-loaded by the main agent" for
 *    a Claude agent that has no `Task` tool, in place of OpenCode's "call ContextScout".
 *
 * What stops L-001 from coming back is not the build but two guards. The capability lint
 * (`verify/lint/capability.ts`, run by {@link reportLints} on every build; a lint error always fails the build, and lint warnings fail under
 * `--strict`) flags an emitted agent told to delegate without `Task`, to run bash without
 * `Bash`, a Claude description with no `<example>`, or a leaked `.opencode/` path. The golden
 * test (`tests/golden/golden-files.test.ts`) asserts the committed Claude tree equals fresh
 * build output byte-for-byte.
 */

import { type Command } from 'commander'
import {
  BUILD_TARGETS,
  check as checkPlan,
  lintAssetNaming,
  lintAssetReferences,
  lintBuild,
  lintContext,
  lintNaming,
  plan as planBuild,
  ReferenceResolver,
  write as writePlan,
  type BuildPlan,
  type BuildTarget,
  type Drift,
} from '@controlstack/agent-compiler'

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
 * Read against the tree AS THIS BUILD WILL LEAVE IT (the planned registry and `.opencode/`
 * files shadow what is on disk), so a bad reference is reported by the build that introduces
 * it, not the next one. The tree
 * carries zero dead references (the four found 2026-07-15 were repaired 2026-07-17, gated in
 * `tests/unit/build/reference-resolution.test.ts`), so any reported here is new rot. Reported
 * rather than fatal by default so a broken ref cannot block an unrelated build; `--strict`
 * makes them fatal, and CI's test suite catches them regardless.
 */
const reportDeadReferences = async (root: string, built: BuildPlan): Promise<number> => {
  const pending = new Map(
    built.files.flatMap((file): Array<[string, string]> => (typeof file.content === 'string' ? [[file.path, file.content]] : [])),
  )
  const dead = await new ReferenceResolver(root, undefined, pending).findDeadReferences()
  for (const resolution of dead) {
    warn(`${resolution.source}: ${resolution.ref} — ${resolution.reason ?? resolution.status}`)
  }
  return dead.length
}

/**
 * Static lints over what this build would emit: host-validity lints
 * for OpenCode v1/v2 and the capability lint (L-001: an agent told to delegate without `Task`,
 * to run bash without `Bash`, a Claude description with no `<example>`, a leaked `.opencode/`
 * path). Error-severity findings fail every build; warning-severity ones (and degradation
 * warnings) fail only under `--strict`.
 */
const reportLints = (built: BuildPlan): { count: number; errors: number } => {
  let count = 0
  let errors = 0
  const assetFindings = lintAssetReferences(built)
  for (const finding of assetFindings) {
    warn(`assets: ${finding.path} [${finding.rule}] ${finding.message}`)
  }
  count += assetFindings.length
  for (const { target, findings } of lintBuild(built.files)) {
    for (const finding of findings) {
      const line = `${target}: ${finding.path} [${finding.rule}] ${finding.message}`
      if (finding.severity === 'warning') warn(line)
      else {
        error(line)
        errors += 1
      }
    }
    count += findings.length
  }
  return { count, errors }
}

/**
 * References that still name an agent by a deprecated `oac.aliases` entry. They resolve, so the
 * build works, but each is printed (not just under --verbose) and counted, so `--strict` fails
 * until the author switches to the current id.
 */
const reportDeprecations = (built: BuildPlan): number => {
  for (const { source, reason } of built.deprecations) warn(`${source}: ${reason}`)
  return built.deprecations.length
}

/**
 * Naming lint (docs/architecture/NAMING.md) over the canonical source. REPORT-ONLY: printed
 * under its own heading AFTER the summary, never counted in the summary, `--strict` or the exit
 * code, until the rule is promoted. Returns the number of `warn`-level findings.
 */
/**
 * What to do about a report-only finding, keyed by lint rule. Printed after the message so a
 * newcomer's own warning says how to clear it. Pure.
 */
export const fixHint = (rule: string): string | undefined => {
  switch (rule) {
    case 'category-folder':
      return 'fix: move the file to agent-library/agents/<category>/ (folder == category) or set oac.category to its folder'
    case 'filename-is-id':
      return 'fix: rename the file to <oac.id>.md, or change oac.id to match the file name'
    case 'dead-link':
      return 'fix: point the link at a file that exists under agent-library/context/, or add the missing file'
    case 'navigation-dead-entry':
      return 'fix: remove the entry from navigation.md, or add the file it names'
    case 'subagents-folder':
      return 'fix: move the file up into its category folder and set type: subagent'
    case 'id-kebab-case':
      return 'fix: use lowercase words joined by single hyphens'
    case 'category-deprecated':
      return 'fix: use one of the current categories (see docs/architecture/NAMING.md)'
    default:
      return undefined
  }
}

const withHint = (rule: string, text: string): string => {
  const hint = fixHint(rule)
  return hint === undefined ? text : `${text} (${hint})`
}

/**
 * Naming lint (docs/architecture/NAMING.md) over the canonical source. REPORT-ONLY: printed
 * under its own heading AFTER the summary, never counted in the summary, `--strict` or the exit
 * code, until the rule is promoted. Warnings are always listed, each with a fix hint; the info
 * notes (the long-standing role-suffix ones) collapse to a count unless `--verbose`.
 * Returns the number of `warn`-level findings.
 */
const reportNaming = (built: BuildPlan): number => {
  const findings = [
    ...lintNaming(built.agents),
    ...lintAssetNaming([...built.skills, ...built.commands]),
  ]
  const warns = findings.filter((f) => f.level === 'warn')
  if (findings.length === 0) return 0
  log('')
  dim('  naming lint (report-only; not counted above, never changes the exit code):')
  for (const f of warns) dim(`    naming: ${f.path} [${f.rule}] ${withHint(f.rule, f.message)}`)
  for (const f of findings.filter((x) => x.level === 'info')) verbose(`naming: ${f.path} [${f.rule}] ${f.message} (info)`)
  dim(`    ${warns.length} naming warning(s), ${findings.length - warns.length} info note(s) (--verbose lists the notes); not counted above`)
  return warns.length
}

/**
 * Context-library lint (`verify/lint/context.ts`) over `agent-library/context/`. REPORT-ONLY like
 * the naming lint, never counted, never changes the exit code. Dead links are listed with a fix
 * hint; the long baseline tail (dead navigation entries, unreachable and unregistered files) is a
 * count line unless `--verbose`, so a contributor's own new warning is not buried in it.
 */
const reportContext = (built: BuildPlan): void => {
  const findings = lintContext(built.context)
  if (findings.length === 0) return
  const actionable = findings.filter((f) => f.rule === 'dead-link')
  const counts = (rule: string): number => findings.filter((f) => f.rule === rule).length
  log('')
  dim('  context lint (report-only; not counted above, never changes the exit code):')
  for (const f of actionable) dim(`    context: ${f.path} [${f.rule}] ${withHint(f.rule, f.message)}`)
  for (const f of findings.filter((x) => !actionable.includes(x))) verbose(`context: ${f.path} [${f.rule}] ${withHint(f.rule, f.message)}`)
  dim(
    `    ${counts('navigation-dead-entry')} dead navigation entr(ies), ${counts('dead-link')} dead link(s), ` +
      `${counts('unreachable')} file(s) not reachable from navigation, ${counts('unregistered')} unregistered file(s) (--verbose lists them)`,
  )
}

/** `--strict` fails on any warning, dead reference or lint finding. Pure. */
export const strictExitCode = (strict: boolean, ...counts: number[]): number =>
  strict && counts.some((count) => count > 0) ? 1 : 0

/** The exit code of a build: a lint ERROR always fails; anything else fails only under `--strict`. Pure. */
export const buildExitCode = (strict: boolean, lintErrors: number, ...counts: number[]): number =>
  lintErrors > 0 ? 1 : strictExitCode(strict, ...counts)

/** The fix hint for a stray: a file in a generated root that no build produced. */
export const strayMessage = (path: string): string =>
  `unexpected file ${path} not produced by the build — delete it or add it to agent-library/`

const reportDrift = (drift: readonly Drift[]): void => {
  for (const entry of drift) {
    if (entry.status === 'stray') error(`stray    ${strayMessage(entry.path)}`)
    else error(`${entry.status.padEnd(8)} ${entry.path}`)
  }
}

// ── Command ──────────────────────────────────────────────────────────────────

export const runBuild = async (options: BuildOptions, root: string): Promise<number> => {
  setVerbose(options.verbose)

  const targets = selectTargets(options.target)
  assertInPlace(targets)

  const built = await planBuild({ root, targets })
  reportWarnings(built)

  const deadCount = await reportDeadReferences(root, built)
  const warningCount = built.warnings.length
  const { count: lintCount, errors: lintErrors } = reportLints(built)
  const deprecationCount = reportDeprecations(built)

  bold('\n  oac build')
  info(`${built.agents.length} canonical agents, ${built.skills.length} skills, ${built.commands.length} commands, ${built.context.files.length} context files -> ${built.files.length} files`)

  // --check and --dry-run share the plan above; neither writes. A check that re-derived the
  // build would eventually disagree with the build, and CI would trust the wrong one.
  if (options.check || options.dryRun) {
    const drift = checkPlan(built, { root })

    if (drift.length === 0) info('no drift — generated trees match the canonical source')
    else reportDrift(drift)

    summarize(warningCount, deadCount, lintCount, deprecationCount, options.strict)

    // Naming is report-only: printed after the summary, never an input to an exit code.
    reportNaming(built)
    reportContext(built)
    if (options.check && drift.length > 0) return 1
    return buildExitCode(options.strict, lintErrors, warningCount, deadCount, lintCount, deprecationCount)
  }

  const result = writePlan(built, { root, prune: options.prune })

  for (const path of result.changed) success(`wrote   ${path}`)
  for (const path of result.removed) success(`removed ${path} (orphan — source is gone)`)
  for (const { path, reason } of result.kept) warn(`kept    ${path}: ${reason}`)

  info(
    `${result.changed.length} written, ${result.unchanged.length} unchanged, ` +
      `${result.removed.length} removed`,
  )

  // A write build leaves strays alone (it cannot know whether they are precious); say so. The
  // `--check` mode (and so the CI drift gate) fails on them.
  for (const entry of checkPlan(built, { root }).filter((d) => d.status === 'stray')) {
    warn(`stray   ${strayMessage(entry.path)}`)
  }

  summarize(warningCount, deadCount, lintCount, deprecationCount, options.strict)
  reportNaming(built)
  reportContext(built)

  return buildExitCode(options.strict, lintErrors, warningCount, deadCount, lintCount, deprecationCount)
}

const summarize = (
  warningCount: number,
  deadCount: number,
  lintCount: number,
  deprecationCount: number,
  strict = false,
): void => {
  log('')
  if (warningCount === 0 && deadCount === 0 && lintCount === 0 && deprecationCount === 0) {
    success('0 warnings')
    return
  }
  warn(
    `${warningCount} degradation warning(s), ${deadCount} dead reference(s), ` +
      `${lintCount} lint finding(s), ${deprecationCount} deprecated alias use(s)`,
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
    .description('Generate every target tree from the canonical agent-library/agents/ source; exits 1 on a build error or lint error (--strict also fails on warnings)')
    .option(
      '--target <tool...>',
      `build only these targets (${BUILD_TARGETS.join(', ')})`,
    )
    .option('--check', 'report drift and write nothing; exit 1 if the tree is stale', false)
    .option('--dry-run', 'preview the build and write nothing (prints drift lines but exits 0; use --check to fail on drift)', false)
    .option('--strict', 'also exit 1 on any degradation warning, dead reference or lint warning (lint errors always fail)', false)
    .option('--no-prune', 'keep generated files whose canonical source is gone')
    .option('--verbose', 'list every degradation warning and every report-only lint note (the baseline context lint, info naming notes)', false)
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
