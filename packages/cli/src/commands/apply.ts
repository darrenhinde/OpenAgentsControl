/**
 * oac apply — Generate IDE-specific config files from .opencode/agent/ definitions.
 *
 * Usage:
 *   oac apply claude    → writes CLAUDE.md
 *   oac apply --all     → detects present IDEs and generates for each
 *
 * Only Claude Code is a write target. OpenCode is the source tree, never a target.
 */

import type { Command } from 'commander'
import { dirname, join } from 'node:path'
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { loadAgents, ClaudeAdapter } from '@controlstack/compatibility-layer'
import type { OpenAgent, ConversionResult } from '@controlstack/compatibility-layer'
import {
  detectIdes,
  getIdeOutputFile,
  getIdeDisplayName,
} from '../lib/ide-detect.js'
import type { IdeType } from '../lib/ide-detect.js'
import { log, info, warn, error, success, dim, verbose, setVerbose } from '../ui/logger.js'
import { createSpinner } from '../ui/spinner.js'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Supported apply targets (opencode is the read-only source, not a write target). */
const APPLY_TARGETS: IdeType[] = ['claude']

// ─── Size helpers ─────────────────────────────────────────────────────────────

/** Format bytes as a human-readable KB string. */
function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(0)}KB`
}

// ─── Backup helper ────────────────────────────────────────────────────────────

/** Backs up an existing file to `{file}.bak` before overwriting. */
async function backupIfExists(filePath: string): Promise<void> {
  const exists = await stat(filePath).then((s) => s.isFile()).catch(() => false)
  if (exists) {
    const backupPath = `${filePath}.bak`
    await copyFile(filePath, backupPath)
    dim(`  Backed up existing file → ${backupPath}`)
  }
}

// ─── Dry-run preview ──────────────────────────────────────────────────────────

/** Prints a dry-run preview of what would be written. */
function printDryRunPreview(outputPath: string, content: string): void {
  info(`[dry-run] Would write: ${outputPath} (${formatKb(Buffer.byteLength(content, 'utf-8'))})`)
  dim('─'.repeat(60))
  const lines = content.split('\n')
  dim(lines.slice(0, 10).join('\n'))
  if (lines.length > 10) {
    dim(`  … (${lines.length - 10} more lines)`)
  }
  dim('─'.repeat(60))
}

// ─── Conversion warnings ──────────────────────────────────────────────────────

/** Prints adapter warnings to the user. */
function reportWarnings(result: ConversionResult, isVerbose: boolean): void {
  if (!result.warnings || result.warnings.length === 0) return

  if (isVerbose) {
    result.warnings.forEach((w: string) => warn(w))
    return
  }
  warn(`${result.warnings.length} conversion warning(s) — use --verbose to see details`)
}

// ─── Single IDE apply ─────────────────────────────────────────────────────────

/** Applies agents to a single IDE target. Returns true on success. */
async function applyToIde(
  ide: IdeType,
  agents: OpenAgent[],
  projectRoot: string,
  options: { dryRun: boolean; verbose: boolean }
): Promise<boolean> {
  const displayName = getIdeDisplayName(ide)
  const outputRelPath = getIdeOutputFile(ide)
  const outputPath = join(projectRoot, outputRelPath)

  if (agents.length === 0) {
    warn(`No agents found in .opencode/agent/ — nothing to apply for ${displayName}`)
    return false
  }

  const spinner = createSpinner(`Generating ${outputRelPath} for ${displayName}…`, {
    dryRun: options.dryRun,
  })
  spinner.start()

  try {
    // Claude uses the first (primary) agent — multiple agents are not merged.
    const adapter = new ClaudeAdapter()
    const result: ConversionResult = await adapter.fromOAC(agents[0]!)

    if (!result.success || result.configs.length === 0) {
      spinner.fail(`Failed to generate ${outputRelPath}`)
      const errs = result.errors ?? ['Unknown conversion error']
      errs.forEach((e: string) => error(e))
      return false
    }

    const content = result.configs.map((c: { content: string }) => c.content).join('\n')
    const sizeBytes = Buffer.byteLength(content, 'utf-8')

    spinner.stop()

    if (options.dryRun) {
      printDryRunPreview(outputPath, content)
    } else {
      await backupIfExists(outputPath)
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, content)
    }

    reportWarnings(result, options.verbose)

    const label = options.dryRun ? '[dry-run] Would write' : 'Wrote'
    success(`${label}: ${outputRelPath} (${formatKb(sizeBytes)})`)
    dim(`  ${displayName}: ${outputPath} is ${formatKb(sizeBytes)}`)

    return true
  } catch (err) {
    spinner.fail(`Error generating ${outputRelPath}`)
    error(`${displayName} adapter failed: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }
}

// ─── Resolve target IDEs ──────────────────────────────────────────────────────

/** Resolves which IDE targets to apply based on CLI args and --all flag. */
async function resolveTargets(
  ide: string | undefined,
  all: boolean,
  projectRoot: string
): Promise<IdeType[]> {
  if (all) {
    const detected = await detectIdes(projectRoot)
    const present = detected
      .filter((d) => d.detected && APPLY_TARGETS.includes(d.type))
      .map((d) => d.type)

    if (present.length === 0) {
      warn('No supported IDEs detected. Create a .claude/ directory or CLAUDE.md first.')
      info('Tip: Run `oac apply claude` to generate CLAUDE.md regardless.')
    } else {
      info(`Detected IDEs: ${present.map(getIdeDisplayName).join(', ')}`)
    }

    return present
  }

  if (!ide) {
    error('Specify an IDE target: claude, or use --all')
    return []
  }

  if (!APPLY_TARGETS.includes(ide as IdeType)) {
    error(`Unknown IDE: "${ide}". Valid targets: ${APPLY_TARGETS.join(', ')}`)
    return []
  }

  return [ide as IdeType]
}

// ─── Main command function ────────────────────────────────────────────────────

/**
 * Core logic for `oac apply`.
 *
 * @param ide     - Optional IDE target (claude)
 * @param options - CLI flags
 */
export async function applyCommand(
  ide: string | undefined,
  options: { yolo: boolean; dryRun: boolean; verbose: boolean; all: boolean }
): Promise<void> {
  const projectRoot = process.cwd()
  const agentDir = join(projectRoot, '.opencode', 'agent')

  setVerbose(options.verbose)

  if (options.dryRun) {
    info('Dry-run mode — no files will be written')
  }

  const targets = await resolveTargets(ide, options.all, projectRoot)
  if (targets.length === 0) {
    process.exitCode = 1
    return
  }

  verbose(`Loading agents from ${agentDir}`)
  const agentDirExists = await stat(agentDir).then((s) => s.isDirectory()).catch(() => false)
  if (!agentDirExists) {
    error(`Agent directory not found: ${agentDir}`)
    error('Run `oac init` first to set up your project.')
    process.exitCode = 1
    return
  }

  let agents: OpenAgent[]
  try {
    agents = await loadAgents(agentDir)
    verbose(`Loaded ${agents.length} agent(s)`)
  } catch (err) {
    error(`Failed to load agents from ${agentDir}: ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
    return
  }

  if (agents.length === 0) {
    warn(`No agents found in ${agentDir}`)
    info('Add agent files (*.md) to .opencode/agent/ and try again.')
    process.exitCode = 1
    return
  }

  log('')
  info(`Applying ${agents.length} agent(s) to: ${targets.map(getIdeDisplayName).join(', ')}`)
  log('')

  let allSucceeded = true
  for (const target of targets) {
    const ok = await applyToIde(target, agents, projectRoot, {
      dryRun: options.dryRun,
      verbose: options.verbose,
    })
    if (!ok) allSucceeded = false
    log('')
  }

  if (!allSucceeded) {
    process.exitCode = 1
  }
}

// ─── Commander registration ───────────────────────────────────────────────────

/**
 * Registers the `oac apply [ide]` command with the Commander program.
 *
 * @param program - The root Commander instance
 */
export function registerApplyCommand(program: Command): void {
  program
    .command('apply [ide]')
    .description('Generate IDE config files from .opencode/agent/ definitions')
    .option('--all', 'Apply to all detected IDEs', false)
    .option('--dry-run', 'Show what would be generated without writing', false)
    .option('--verbose', 'Show adapter warnings and transformation details', false)
    .option('--yolo', 'Skip confirmation prompts', false)
    .addHelpText(
      'after',
      `
Examples:
  oac apply claude             Generate CLAUDE.md
  oac apply --all              Generate for all detected IDEs
  oac apply claude --dry-run   Preview without writing
`
    )
    .action(async (ide: string | undefined, opts: Record<string, unknown>) => {
      await applyCommand(ide, {
        yolo: Boolean(opts['yolo']),
        dryRun: Boolean(opts['dryRun']),
        verbose: Boolean(opts['verbose']),
        all: Boolean(opts['all']),
      })
    })
}
