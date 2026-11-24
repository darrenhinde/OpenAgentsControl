import { type Command } from 'commander';
import path from 'node:path';
import { readdir } from 'node:fs/promises';

import { readManifest, type ManifestFile, type ManifestFileType } from '../lib/manifest.js';
import { computeFileHash, hashesMatch } from '../lib/sha256.js';
import { log, info, warn, bold, dim, setVerbose } from '../ui/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ListOptions = {
  type?: string;
  context: boolean;
  agents: boolean;
  skills: boolean;
  verbose: boolean;
};

/** A single display row derived from a manifest file entry. */
type FileRow = {
  filePath: string;
  displayPath: string;
  type: ManifestFileType;
  installedAt: string;
  sha256: string;
  userModified: boolean;
};

const CONTEXT_ROOT = '.opencode/context';

// ── Path helpers (pure) ───────────────────────────────────────────────────────

/** Strips the well-known .opencode/ prefix for a cleaner display path. Pure. */
const toDisplayPath = (filePath: string, type: ManifestFileType): string => {
  const prefixes: Record<ManifestFileType, string> = {
    agent:   '.opencode/agent/',
    context: '.opencode/context/',
    skill:   '.opencode/skills/',
    config:  '.oac/',
    other:   '',
  };
  const prefix = prefixes[type];
  return prefix && filePath.startsWith(prefix)
    ? filePath.slice(prefix.length)
    : filePath;
};

/** Formats an ISO timestamp as a short date string. Pure. */
const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
};

/** Returns whether an entry is managed by OAC rather than merely recorded as user-owned. Pure. */
const isOacManaged = (entry: ManifestFile['files'][string] | undefined): boolean =>
  entry !== undefined && entry.source !== 'custom' && entry.protected !== true;

/** Recursively collects regular files below a context directory. */
const collectContextFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectContextFiles(filePath);
    return Promise.resolve(entry.isFile() ? [filePath] : []);
  }));
  return nested.flat();
};

/** Counts on-disk context files that OAC does not own or manage. */
export const countUnmanagedContextFiles = async (
  projectRoot: string,
  manifest: ManifestFile | null,
): Promise<number> => {
  const contextRoot = path.join(projectRoot, CONTEXT_ROOT);
  const files = await collectContextFiles(contextRoot);
  return files.filter((filePath) => {
    const relativePath = path.relative(projectRoot, filePath);
    return !isOacManaged(manifest?.files[relativePath]);
  }).length;
};

/** Formats the user-context report shared by list and status output. Pure. */
export const formatUnmanagedContextSummary = (count: number): string =>
  `${count} context files of your own (not managed by OAC)`;

// ── Grouping / filtering (pure) ───────────────────────────────────────────────

/** Resolves which types to display based on CLI flags. Pure. */
const resolveActiveTypes = (options: ListOptions): ManifestFileType[] | null => {
  // --type flag takes precedence
  if (options.type) {
    const t = options.type as ManifestFileType;
    return ['agent', 'context', 'skill', 'config', 'other'].includes(t) ? [t] : null;
  }
  // Individual shorthand flags
  const selected: ManifestFileType[] = [];
  if (options.agents)  selected.push('agent');
  if (options.context) selected.push('context');
  if (options.skills)  selected.push('skill');
  // No flags → show all
  return selected.length > 0 ? selected : null;
};

/** Groups file rows by their ManifestFileType. Pure. */
const groupByType = (rows: FileRow[]): Map<ManifestFileType, FileRow[]> => {
  const groups = new Map<ManifestFileType, FileRow[]>();
  for (const row of rows) {
    const existing = groups.get(row.type) ?? [];
    groups.set(row.type, [...existing, row]);
  }
  return groups;
};

// ── SHA256 check ──────────────────────────────────────────────────────────────

/** Checks whether a file on disk differs from its manifest hash. */
const isUserModified = async (
  projectRoot: string,
  filePath: string,
  manifestHash: string,
): Promise<boolean> => {
  try {
    const diskHash = await computeFileHash(path.join(projectRoot, filePath));
    return !hashesMatch(diskHash, manifestHash);
  } catch {
    // File missing from disk — treat as modified (doctor will catch this)
    return false;
  }
};

// ── Row builder ───────────────────────────────────────────────────────────────

/** Builds display rows from the manifest, checking SHA256 when verbose. */
const buildRows = async (
  manifest: ManifestFile,
  projectRoot: string,
  checkHashes: boolean,
): Promise<FileRow[]> => {
  const entries = Object.entries(manifest.files);
  const rows = await Promise.all(
    entries.map(async ([filePath, entry]) => {
      const userModified = checkHashes
        ? await isUserModified(projectRoot, filePath, entry.sha256)
        : false;
      return {
        filePath,
        displayPath: toDisplayPath(filePath, entry.type),
        type: entry.type,
        installedAt: entry.installedAt,
        sha256: entry.sha256,
        userModified,
      } satisfies FileRow;
    }),
  );
  return rows.sort((a, b) => a.displayPath.localeCompare(b.displayPath));
};

// ── Rendering (side-effects only) ─────────────────────────────────────────────

/** Prints a single group section. */
const printGroup = (
  label: string,
  rows: FileRow[],
  verbose: boolean,
): void => {
  log('');
  bold(`  ${label} (${rows.length}):`);
  for (const row of rows) {
    const modifiedTag = row.userModified ? ' ⚠ modified' : '';
    const line = `    ${row.displayPath}${modifiedTag}`;
    if (row.userModified) {
      warn(line.trimStart());
    } else {
      log(line);
    }
    if (verbose) {
      dim(`      sha256:      ${row.sha256}`);
      dim(`      installedAt: ${formatDate(row.installedAt)}`);
    }
  }
};

/** Prints the full list output. */
const printList = (
  groups: Map<ManifestFileType, FileRow[]>,
  activeTypes: ManifestFileType[] | null,
  verbose: boolean,
  unmanagedContextCount: number,
): void => {
  const TYPE_LABELS: Record<ManifestFileType, string> = {
    agent:   'Agents',
    context: 'Context',
    skill:   'Skills',
    config:  'Config',
    other:   'Other',
  };
  // Display order
  const ORDER: ManifestFileType[] = ['agent', 'context', 'skill', 'config', 'other'];
  const typesToShow = activeTypes ?? ORDER;

  log('');
  bold('OAC Installed Components');

  let totalShown = 0;
  for (const type of typesToShow) {
    const rows = groups.get(type);
    if (!rows || rows.length === 0) continue;
    printGroup(TYPE_LABELS[type], rows, verbose);
    totalShown += rows.length;
  }

  log('');
  if (totalShown === 0) {
    info('No components match the selected filter.');
  } else {
    dim(`  Total: ${totalShown} file${totalShown !== 1 ? 's' : ''}`);
  }
  info(formatUnmanagedContextSummary(unmanagedContextCount));
  log('');
};

// ── Main command ──────────────────────────────────────────────────────────────

/**
 * Implements `oac list`:
 *  1. Reads manifest from project root
 *  2. Builds display rows (with optional SHA256 check in verbose mode)
 *  3. Groups by type and applies any active filter
 *  4. Prints human-readable output
 *
 * Always exits 0 — this is a read-only command.
 */
export async function listCommand(options: ListOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  const projectRoot = process.cwd();

  // Read manifest — null means not initialised
  let manifest: ManifestFile | null;
  try {
    manifest = await readManifest(projectRoot);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warn(`Could not read manifest: ${msg}`);
    warn('Fix: run `oac doctor` to diagnose, or `oac init` to reset.');
    process.exit(0);
    return; // unreachable — satisfies TypeScript
  }

  if (manifest === null) {
    const unmanagedContextCount = await countUnmanagedContextFiles(projectRoot, null);
    log('');
    info('No components installed. Run `oac init` to get started.');
    info(formatUnmanagedContextSummary(unmanagedContextCount));
    log('');
    process.exit(0);
    return;
  }

  if (Object.keys(manifest.files).length === 0) {
    const unmanagedContextCount = await countUnmanagedContextFiles(projectRoot, manifest);
    log('');
    info('No components installed.');
    info(formatUnmanagedContextSummary(unmanagedContextCount));
    log('');
    process.exit(0);
    return;
  }

  // Always check hashes so modified-file warnings appear; verbose adds hash/date detail
  const rows = await buildRows(manifest, projectRoot, true);
  const groups = groupByType(rows);
  const activeTypes = resolveActiveTypes(options);
  const unmanagedContextCount = await countUnmanagedContextFiles(projectRoot, manifest);

  printList(groups, activeTypes, options.verbose, unmanagedContextCount);

  process.exit(0);
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `list` subcommand on the given Commander program.
 * Called by the CLI entry point (index.ts).
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('Show all installed OAC components')
    .option('--type <type>', 'Filter by type: agent | context | skill | config | other')
    .option('--agents',  'Show agents only',  false)
    .option('--context', 'Show context files only', false)
    .option('--skills',  'Show skills only',  false)
    .option('--verbose', 'Show SHA256 hash and install date for each file', false)
    .action(async (opts: {
      type?: string;
      agents: boolean;
      context: boolean;
      skills: boolean;
      verbose: boolean;
    }) => {
      await listCommand({
        type:    opts.type,
        agents:  opts.agents,
        context: opts.context,
        skills:  opts.skills,
        verbose: opts.verbose,
      });
    });
}
