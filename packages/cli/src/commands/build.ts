/**
 * `oac build` — generate every target's tree from the canonical `content/agents/**` source.
 *
 * ## This file is wiring, not logic
 *
 * The pipeline itself lives in `@controlstack/compatibility-layer`
 * (`src/core/BuildPipeline.ts`): loading, adapting, orphan pruning and drift detection are all
 * there, under vitest, Node-clean. This module parses flags, chooses roots, and prints. That
 * split is deliberate — `packages/cli` still runs on Bun (12-DISPATCH, Stage 5 owns the
 * removal), and the build must not acquire a Bun dependency on its way to the user. Nothing
 * here uses a Bun API.
 *
 * ## Why Claude Code is staged rather than emitted
 *
 * `.opencode/agent/**` and `registry.json` are emitted IN PLACE: they are build output, and
 * the subtask-11 CI gate rebuilds them and diffs.
 *
 * `plugins/claude-code/agents/**` is NOT — and the original reason for that is now GONE, so
 * do not remove this staging on the strength of the old comment. What used to block it was
 * permissions: the canonical sources scope `Bash`/`Edit`, the shipped files granted them
 * unscoped, and the adapter had to guess. `oac.overrides.claude-code` fixed exactly that.
 * Every override reproduces its agent's shipped `tools:` list byte-for-byte; permissions no
 * longer block anything.
 *
 * What blocks it now is PROMPT CONTENT, found 2026-07-15 by running the emission and reading
 * the diff. The shipped Claude files are not stale copies of the canonical ones — they are
 * target-adapted, in two ways a rebuild would silently destroy:
 *
 * 1. **`description:` carries agent-dispatch examples.** 4 of the 7 (`code-reviewer`,
 *    `coder-agent`, `context-scout`, plus `context-manager`'s body) embed `<example>` blocks
 *    that are how Claude Code SELECTS an agent. Canonical's `description` is OpenCode's — a
 *    single line, with no examples anywhere in the corpus. Emitting would replace a dispatch
 *    spec with a summary.
 * 2. **The body is written against the target's capabilities.** Claude's `code-reviewer` has
 *    `disallowedTools: Task`, so its prompt says context is "pre-loaded by the main agent".
 *    The canonical body says "ALWAYS call ContextScout BEFORE reviewing any code" — an
 *    instruction that agent cannot follow, because it cannot delegate.
 *
 * Both are the same shape as the permission problem: content that is a function of the target,
 * with no canonical field to carry the variance. The fix is the same shape too — extend
 * `oac.overrides` to the prompt — but it is a real design decision, not a default a build
 * command should pick. So this target keeps staging to {@link CLAUDE_STAGING_ROOT} and
 * REPORTING the comparison, and there is deliberately no flag to emit it in place.
 *
 * A third difference is mechanical, added 2026-07-17 (9b4e807): the adapter now emits
 * EXHAUSTIVE tools/disallowedTools pairs — every bound tool lands in one list or the other —
 * while the shipped files list only some denials (four list none, and none mention WebFetch).
 * So the staged comparison reports all 7 files as "would change" even where the `tools:` line
 * matches byte-for-byte. Converging the trees means accepting the exhaustive lists too, not
 * just resolving the prompt variance. No security impact either way: the shipped `tools:`
 * whitelist already confines each agent; the exhaustive deny list only makes it explicit.
 */

import { type Command } from 'commander'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  BUILD_TARGETS,
  check as checkPlan,
  plan as planBuild,
  ReferenceResolver,
  write as writePlan,
  type BuildPlan,
  type BuildTarget,
  type Drift,
  type OutputRoots,
} from '@controlstack/compatibility-layer'

import { bold, dim, error, info, log, setVerbose, success, verbose, warn } from '../ui/logger.js'

// ── Constants ────────────────────────────────────────────────────────────────

/**
 * Where `claude-code` output is staged. Gitignored (`.tmp/*`), so a build never dirties the
 * tree with output nobody has agreed to ship yet.
 */
export const CLAUDE_STAGING_ROOT = '.tmp/oac-build'

/** Targets emitted in place. Everything else stages. */
const IN_PLACE_TARGETS: readonly BuildTarget[] = ['opencode']

// ── Types ────────────────────────────────────────────────────────────────────

export type BuildOptions = {
  target?: string[]
  check: boolean
  dryRun: boolean
  strict: boolean
  prune: boolean
  stage: string
  verbose: boolean
  json: boolean
}

/** How one staged target compares to the tree it is not allowed to overwrite. */
type StagedComparison = {
  target: BuildTarget
  identical: string[]
  differing: string[]
  /** The build would emit these; the committed tree has no such file. */
  onlyStaged: string[]
  /** The committed tree ships these; the build claims no source for them. */
  onlyShipped: string[]
}

/** The in-place tree each staged target is being compared AGAINST. */
const SHIPPED_ROOTS: Readonly<Record<BuildTarget, string>> = {
  opencode: '.opencode/agent',
  'claude-code': 'plugins/claude-code/agents',
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

/** The staging map: every selected target that is not emitted in place. Pure. */
export const outputRootsFor = (targets: readonly BuildTarget[], stage: string): OutputRoots => {
  const roots: OutputRoots = {}
  for (const target of targets) {
    if (!IN_PLACE_TARGETS.includes(target)) roots[target] = stage
  }
  return roots
}

// ── Staged comparison ────────────────────────────────────────────────────────

/** Every `.md` under `dir`, as repo-relative POSIX paths, sorted. `[]` when absent. */
const listShipped = (root: string, dir: string): string[] => {
  const absolute = join(root, dir)
  if (!existsSync(absolute)) return []

  return readdirSync(absolute, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `${dir}/${entry.name}`)
    .sort()
}

/**
 * Compare what a staged target WOULD emit against what is committed today.
 *
 * Read-only on both sides. This is the whole point of staging: the reviewer sees the change
 * the build wants to make, and nothing on disk moves until someone agrees to it.
 *
 * `onlyShipped` matters as much as the other three. A committed file the build claims no
 * source for is not noise — it means the canonical tree and the shipped tree disagree about
 * an agent's identity (`oac.id: reviewer` emits `reviewer.md`, but `code-reviewer.md` is what
 * ships). Reporting only what the build would write would hide exactly half of that.
 */
const compareStaged = (built: BuildPlan, root: string, target: BuildTarget): StagedComparison => {
  const comparison: StagedComparison = {
    target,
    identical: [],
    differing: [],
    onlyStaged: [],
    onlyShipped: [],
  }

  const emitted = built.files.filter((file) => file.target === target)
  const claimed = new Set(emitted.map((file) => file.path))

  for (const file of emitted) {
    const shipped = join(root, file.path)
    if (!existsSync(shipped)) {
      comparison.onlyStaged.push(file.path)
    } else if (readFileSync(shipped, 'utf-8') === file.content) {
      comparison.identical.push(file.path)
    } else {
      comparison.differing.push(file.path)
    }
  }

  comparison.onlyShipped = listShipped(root, SHIPPED_ROOTS[target]).filter(
    (path) => !claimed.has(path),
  )

  return comparison
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

const reportDrift = (drift: readonly Drift[]): void => {
  for (const entry of drift) error(`${entry.status.padEnd(8)} ${entry.path}`)
}

const reportComparison = (comparison: StagedComparison, stage: string): void => {
  log('')
  bold(`  ${comparison.target} — staged to ${stage}/ (NOT emitted in place)`)
  info(`${comparison.identical.length} identical to the committed tree`)

  for (const path of comparison.differing) warn(`would change: ${path}`)
  for (const path of comparison.onlyStaged) warn(`would add:    ${path}`)
  for (const path of comparison.onlyShipped) warn(`unclaimed:    ${path}`)

  if (comparison.differing.length + comparison.onlyStaged.length > 0) {
    dim(
      `    Review with: diff -ru plugins/claude-code/agents ` +
        `${stage}/plugins/claude-code/agents`,
    )
  }
}

// ── Command ──────────────────────────────────────────────────────────────────

export const runBuild = async (options: BuildOptions, root: string): Promise<number> => {
  setVerbose(options.verbose)

  const targets = selectTargets(options.target)
  const stage = options.stage
  const outputRoots = outputRootsFor(targets, stage)

  const built = await planBuild({ root, targets })
  reportWarnings(built)

  const deadCount = await reportDeadReferences(root)
  const warningCount = built.warnings.length

  bold('\n  oac build')
  info(`${built.agents.length} canonical agents -> ${built.files.length} files`)

  // --check and --dry-run share the plan above; neither writes. A check that re-derived the
  // build would eventually disagree with the build, and CI would trust the wrong one.
  if (options.check || options.dryRun) {
    const drift = checkPlan(built, { root, outputRoots })

    if (drift.length === 0) info('no drift — generated trees match the canonical source')
    else reportDrift(drift)

    for (const target of targets) {
      if (outputRoots[target] !== undefined) reportComparison(compareStaged(built, root, target), stage)
    }

    summarize(warningCount, deadCount)

    if (options.check && drift.length > 0) return 1
    return options.strict && warningCount + deadCount > 0 ? 1 : 0
  }

  const result = writePlan(built, { root, outputRoots, prune: options.prune })

  for (const path of result.changed) success(`wrote   ${path}`)
  for (const path of result.removed) success(`removed ${path} (orphan — source is gone)`)
  for (const { path, reason } of result.kept) warn(`kept    ${path}: ${reason}`)

  info(
    `${result.changed.length} written, ${result.unchanged.length} unchanged, ` +
      `${result.removed.length} removed`,
  )

  for (const target of targets) {
    if (outputRoots[target] !== undefined) reportComparison(compareStaged(built, root, target), stage)
  }

  summarize(warningCount, deadCount)

  return options.strict && warningCount + deadCount > 0 ? 1 : 0
}

const summarize = (warningCount: number, deadCount: number): void => {
  log('')
  if (warningCount === 0 && deadCount === 0) {
    success('0 warnings')
    return
  }
  warn(`${warningCount} degradation warning(s), ${deadCount} dead reference(s)`)
  dim('    Re-run with --verbose to list every warning, or --strict to fail on them.')
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
    .option('--strict', 'exit 1 if there is any warning or dead reference', false)
    .option('--no-prune', 'keep generated files whose canonical source is gone')
    .option('--stage <dir>', 'where staged targets are written', CLAUDE_STAGING_ROOT)
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
