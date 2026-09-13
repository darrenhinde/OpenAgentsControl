import { type Command } from 'commander';
import { join } from 'node:path';

import { readCliVersion } from '../lib/version.js';
import { readManifest } from '../lib/manifest.js';
import { computeFileHash, hashesMatch } from '../lib/sha256.js';
import { detectIdes } from '../lib/ide-detect.js';
import { log, info, warn, bold, dim, success } from '../ui/logger.js';
import type { ManifestFile, ManifestFileType } from '../lib/manifest.js';
import type { DetectedIde } from '../lib/ide-detect.js';
import { countUnmanagedContextFiles } from './list.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StatusOptions = {
  verbose: boolean;
};

type ComponentCounts = {
  agents: number;
  context: number;
  skills: number;
  other: number;
  total: number;
};

type ModifiedResult = {
  count: number;
  paths: string[];
};

/** Formats the user-context report shown in the status summary. Pure. */
export const formatUnmanagedContextStatus = (count: number): string =>
  `${count} context files of your own (not managed by OAC)`;

// ── Pure counters ─────────────────────────────────────────────────────────────

/** Counts manifest entries by their file type. Pure function. */
const countComponents = (manifest: ManifestFile): ComponentCounts => {
  const entries = Object.values(manifest.files);
  const byType = (t: ManifestFileType): number =>
    entries.filter((e) => e.type === t).length;

  const agents = byType('agent');
  const context = byType('context');
  const skills = byType('skill');
  const other = entries.length - agents - context - skills;

  return { agents, context, skills, other, total: entries.length };
};

// ── SHA256 diff check ─────────────────────────────────────────────────────────

/**
 * Compares each manifest file's stored hash against the file on disk.
 * Returns the count and paths of files that have been locally modified.
 * Wraps computeFileHash in try/catch — deleted files are treated as modified.
 */
const findModifiedFiles = async (
  projectRoot: string,
  manifest: ManifestFile,
): Promise<ModifiedResult> => {
  const entries = Object.entries(manifest.files);

  const checks = await Promise.all(
    entries.map(async ([relPath, entry]) => {
      const absPath = join(projectRoot, relPath);
      try {
        const diskHash = await computeFileHash(absPath);
        return !hashesMatch(diskHash, entry.sha256) ? relPath : null;
      } catch {
        // File deleted or unreadable — counts as modified
        return relPath;
      }
    }),
  );

  const paths = checks.filter((p): p is string => p !== null);
  return { count: paths.length, paths };
};

// ── IDE formatter ─────────────────────────────────────────────────────────────

/** Formats the list of detected IDEs into a display string. Pure function. */
const formatIdeList = (ides: DetectedIde[]): string => {
  const detected = ides.filter((i) => i.detected);
  const notDetected = ides.filter((i) => !i.detected);

  if (detected.length === 0) {
    return 'None detected — run `oac apply <ide>` to set up';
  }

  const detectedNames = detected.map((i) => i.type).join(', ');
  if (notDetected.length === 0) return detectedNames;

  const notDetectedNames = notDetected.map((i) => i.type).join(', ');
  return `${detectedNames} (not detected: ${notDetectedNames})`;
};

// ── Update check ──────────────────────────────────────────────────────────────

/** Returns a human-readable update status line. Pure function. */
const formatUpdateStatus = (manifestVersion: string, cliVersion: string): string =>
  manifestVersion === cliVersion
    ? `Up to date (v${cliVersion})`
    : `Available — manifest has v${manifestVersion}, CLI is v${cliVersion} (run 'oac update')`;

// ── Timestamp formatter ───────────────────────────────────────────────────────

/** Formats an ISO timestamp into a readable local date string. Pure function. */
const formatTimestamp = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

// ── Display ───────────────────────────────────────────────────────────────────

/** Prints the one-screen status summary. Side-effect only. */
const printStatus = (
  cliVersion: string,
  projectRoot: string,
  manifest: ManifestFile,
  counts: ComponentCounts,
  unmanagedContextCount: number,
  modified: ModifiedResult,
  ides: DetectedIde[],
): void => {
  const homeDir = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
  const displayPath = projectRoot.startsWith(homeDir)
    ? `~${projectRoot.slice(homeDir.length)}`
    : projectRoot;

  log('');
  bold(`OAC v${cliVersion} — ${displayPath}`);
  log('');

  info(`Agents:   ${counts.agents} installed`);
  info(`Context:  ${counts.context} files`);
  info(formatUnmanagedContextStatus(unmanagedContextCount));
  info(`Skills:   ${counts.skills} installed`);

  if (modified.count > 0) {
    warn(`Modified: ${modified.count} file${modified.count !== 1 ? 's' : ''} have local changes`);
  } else {
    success(`Modified: No local changes`);
  }

  info(`Updates:  ${formatUpdateStatus(manifest.oacVersion, cliVersion)}`);
  info(`IDEs:     ${formatIdeList(ides)}`);
  info(`Last updated: ${formatTimestamp(manifest.updatedAt)}`);

  log('');
  dim(`  Run 'oac doctor' for full health check`);
  log('');
};

/** Prints verbose details about modified files. Side-effect only. */
const printVerboseModified = (modified: ModifiedResult): void => {
  if (modified.count === 0) return;
  dim('  Modified files:');
  for (const p of modified.paths) {
    dim(`    • ${p}`);
  }
  log('');
};

// ── Command handler ───────────────────────────────────────────────────────────

/**
 * Implements `oac status`:
 *  1. Reads manifest — exits early with helpful message if not initialized
 *  2. Counts components by type
 *  3. Checks for user-modified files via SHA256 comparison
 *  4. Detects IDEs
 *  5. Prints one-screen summary
 *  Always exits 0 (read-only command).
 */
export async function statusCommand(options: StatusOptions): Promise<void> {
  const projectRoot = process.cwd();
  const cliVersion = readCliVersion();

  // Step 1: read manifest — not initialized is a valid state, not an error
  let manifest: ManifestFile | null;
  try {
    manifest = await readManifest(projectRoot);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`  OAC manifest is invalid: ${msg}`);
    log(`  Run 'oac init' to reset, or fix .oac/manifest.json manually.`);
    process.exit(0);
    return; // unreachable — satisfies TypeScript
  }

  if (manifest === null) {
    const unmanagedContextCount = await countUnmanagedContextFiles(projectRoot, null);
    log('');
    log('  OAC not initialized. Run \'oac init\' to get started.');
    info(formatUnmanagedContextStatus(unmanagedContextCount));
    log('');
    process.exit(0);
  }

  // Step 2: count components
  const counts = countComponents(manifest);

  // Steps 3 & 4: inspect tracked files, user-owned context, and IDEs in parallel.
  const [modified, unmanagedContextCount, ides] = await Promise.all([
    findModifiedFiles(projectRoot, manifest),
    countUnmanagedContextFiles(projectRoot, manifest),
    detectIdes(projectRoot),
  ]);

  // Step 5: print summary
  printStatus(cliVersion, projectRoot, manifest, counts, unmanagedContextCount, modified, ides);

  if (options.verbose) {
    printVerboseModified(modified);
  }

  process.exit(0);
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `oac status` command on the given Commander program.
 * Called by the CLI entry point (index.ts).
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show a one-screen summary of your OAC installation')
    .option('--verbose', 'Show details about modified files', false)
    .action(async (opts: { verbose?: boolean }) => {
      await statusCommand({ verbose: opts.verbose ?? false });
    });
}
