import { type Command } from 'commander';
import { updateFiles } from '../lib/installer.js';
import { getPackageRoot, listBundledFiles } from '../lib/bundled.js';
import { readManifest, writeManifest } from '../lib/manifest.js';
import { readConfig, writeConfig, type OacConfig } from '../lib/config.js';
import { FULL_PROFILE_ID, getProfile, loadRegistry, resolveProfile, type Registry } from '../lib/registry.js';
import { log, info, warn, error, success, dim, bold, verbose, setVerbose } from '../ui/logger.js';
import { createSpinner, setDryRun } from '../ui/spinner.js';
import type { InstallResult } from '../lib/installer.js';
import type { ManifestFile } from '../lib/manifest.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type UpdateOptions = {
  yolo: boolean;
  dryRun: boolean;
  verbose: boolean;
  /** Alias for dryRun — shows what would change without changing anything. */
  check: boolean;
  /** Add a profile to the cumulative installation scope before synchronizing. */
  profile?: string;
};

export type UpdateScope = { files: string[]; config: OacConfig | null; originalTierUnknown: boolean };

/** Resolves only the profile files that this project has authorized OAC to manage. */
export const resolveUpdateScope = (
  registry: Registry,
  bundledFiles: readonly string[],
  manifest: ManifestFile,
  config: OacConfig | null,
  profile?: string,
): UpdateScope => {
  if (config === null && profile === undefined) {
    return { files: Object.keys(manifest.files).sort(), config: null, originalTierUnknown: true };
  }

  const baseScope = config?.installationScope;
  const profileIds = [...new Set([...(baseScope?.profiles ?? []), ...(profile === undefined ? [] : [profile])])];
  const contextOnly = baseScope?.contextOnly ?? false;
  const files = profileIds.flatMap((profileId) => {
    if (profileId === FULL_PROFILE_ID) {
      return bundledFiles.filter((file) => !contextOnly || file.startsWith('.opencode/context/'));
    }
    const resolved = getProfile(registry, profileId);
    if (resolved === null) throw new Error(`Unknown profile '${profileId}'.`);
    return resolveProfile(registry, resolved, { contextOnly }).files;
  });
  const nextConfig = config === null
    ? null
    : { ...config, installationScope: { profile: profile ?? baseScope!.profile, contextOnly, profiles: profileIds } };
  const legacyFiles = config === null ? Object.keys(manifest.files) : [];
  return {
    files: [...new Set([...legacyFiles, ...files])].sort(),
    config: nextConfig,
    originalTierUnknown: config === null,
  };
};

// ── Pre-flight checks ─────────────────────────────────────────────────────────

/**
 * Validates that a manifest exists before running the update.
 * Returns the project root (cwd) or exits with code 1.
 */
async function assertManifestExists(projectRoot: string): Promise<void> {
  const manifest = await readManifest(projectRoot);
  if (manifest === null) {
    error('No manifest found. Run \'oac init\' first.');
    process.exit(1);
  }
}

// ── Plan announcement ─────────────────────────────────────────────────────────

/** Prints what the command is about to do BEFORE making any changes. */
function printPlan(opts: UpdateOptions): void {
  const mode = opts.dryRun ? ' (dry-run — no changes will be made)' : '';
  bold(`\noac update${mode}`);
  info('Checking installed files against the latest OAC bundle...');
  if (opts.yolo) {
    warn('--yolo mode: user-modified files will be backed up and overwritten.');
  }
  if (opts.verbose) {
    dim('  Verbose mode: SHA256 comparison details will be shown per file.');
  }
  log('');
}

// ── Result summary ────────────────────────────────────────────────────────────

/** Prints the per-category file lists from the result. */
function printFileList(label: string, files: string[], printer: (msg: string) => void): void {
  if (files.length === 0) return;
  printer(`${label}:`);
  for (const f of files) {
    dim(`    ${f}`);
  }
}

/** Prints the full result summary AFTER the update completes. */
function printSummary(result: InstallResult, isDryRun: boolean): void {
  const prefix = isDryRun ? '[dry-run] Would have: ' : '';
  log('');
  bold('Summary:');

  printFileList(`  ${prefix}Updated`, result.updated, success);
  printFileList(`  ${prefix}New files installed`, result.installed, success);
  printFileList(`  ${prefix}Backed up (--yolo)`, result.backed_up, info);
  printFileList(`  Skipped (user-modified)`, result.skipped, warn);
  printFileList(`  Removed from manifest (no longer in bundle)`, result.removed_from_manifest, warn);
  printFileList(`  Errors`, result.errors, error);

  log('');
  const updatedCount = result.updated.length + result.installed.length;
  const skippedCount = result.skipped.length;
  const backedUpCount = result.backed_up.length;

  const parts: string[] = [];
  if (updatedCount > 0) parts.push(`${updatedCount} file(s) updated`);
  if (skippedCount > 0) parts.push(`${skippedCount} skipped (user-modified)`);
  if (backedUpCount > 0) parts.push(`${backedUpCount} backed up`);
  if (result.errors.length > 0) parts.push(`${result.errors.length} error(s)`);

  if (parts.length === 0) {
    info('Everything is already up to date.');
    return;
  }
  log(parts.join('. ') + '.');
}

// ── Core update logic ─────────────────────────────────────────────────────────

/** Resolves effective options: --check is an alias for --dry-run. */
const resolveOptions = (opts: UpdateOptions): UpdateOptions => ({
  ...opts,
  dryRun: opts.dryRun || opts.check,
});

/** Runs the update and writes the manifest (unless dry-run). */
async function runUpdate(projectRoot: string, opts: UpdateOptions, scope: UpdateScope): Promise<InstallResult> {
  const packageRoot = getPackageRoot();

  const spinner = createSpinner('Scanning files...', { dryRun: opts.dryRun });
  spinner.start();

  let result: InstallResult;
  let updatedManifest: ManifestFile;
  try {
    ({ result, updatedManifest } = await updateFiles({
      projectRoot,
      packageRoot,
      dryRun: opts.dryRun,
      yolo: opts.yolo,
      verbose: opts.verbose,
    }, scope.files));
  } catch (err: unknown) {
    spinner.fail('Update failed.');
    const msg = err instanceof Error ? err.message : String(err);
    error(`Update failed: ${msg}`);
    error('Check that @controlstack/oac is installed correctly and try again.');
    process.exit(1);
    return {} as InstallResult; // unreachable — satisfies TypeScript
  }

  spinner.succeed('Scan complete.');

  // Write updated manifest only when not in dry-run mode
  if (!opts.dryRun && result.errors.length === 0) {
    await writeManifest(projectRoot, updatedManifest);
    if (scope.config !== null) await writeConfig(projectRoot, scope.config);
    verbose('Manifest written.');
  } else if (!opts.dryRun && result.errors.length > 0) {
    warn('Manifest not written due to errors above. Fix the issues and re-run.');
  }

  return result;
}

// ── Command handler ───────────────────────────────────────────────────────────

/** Main handler for `oac update`. Orchestrates pre-flight, update, and summary. */
async function handleUpdate(opts: UpdateOptions): Promise<void> {
  const effective = resolveOptions(opts);
  const projectRoot = process.cwd();

  // Configure global flags
  setVerbose(effective.verbose);
  setDryRun(effective.dryRun);

  // Read config to pick up persisted yolo/autoBackup preferences
  const config = await readConfig(projectRoot);
  const yolo = effective.yolo || (config?.preferences.yoloMode ?? false);

  const finalOpts: UpdateOptions = { ...effective, yolo };

  // Pre-flight: manifest must exist
  await assertManifestExists(projectRoot);

  const manifest = await readManifest(projectRoot);
  if (manifest === null) return;
  const packageRoot = getPackageRoot();
  const [registry, bundledFiles] = await Promise.all([
    loadRegistry(packageRoot),
    listBundledFiles(packageRoot),
  ]);
  let scope: UpdateScope;
  try {
    scope = resolveUpdateScope(registry, bundledFiles, manifest, config, finalOpts.profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`${msg} Run \`oac init --list-profiles\` to see available profiles.`);
    process.exit(1);
    return;
  }
  if (scope.originalTierUnknown) {
    warn('Original installation tier is unknown; only manifest-tracked files will be synchronized.');
  }

  // Announce plan BEFORE doing anything
  printPlan(finalOpts);

  // Run the update
  const result = await runUpdate(projectRoot, finalOpts, scope);

  // Print summary AFTER
  printSummary(result, finalOpts.dryRun);

  // Exit non-zero only on hard errors (skipped files are not errors)
  if (result.errors.length > 0) {
    process.exit(1);
  }
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `oac update` command on the given Commander program.
 * Supports --dry-run, --check (alias), --yolo, --verbose.
 */
export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update installed OAC files, skipping any you have modified')
    .option('--dry-run', 'Show what would be updated without making changes')
    .option('--check', 'Alias for --dry-run: show what would change')
    .option('--yolo', 'Back up user-modified files and overwrite them anyway')
    .option('-p, --profile <id>', 'Add a profile to the installation scope before updating')
    .option('--verbose', 'Show SHA256 comparison details per file')
    .action(async (cmdOpts: { dryRun?: boolean; check?: boolean; yolo?: boolean; verbose?: boolean; profile?: string }) => {
      await handleUpdate({
        dryRun: cmdOpts.dryRun ?? false,
        check: cmdOpts.check ?? false,
        yolo: cmdOpts.yolo ?? false,
        verbose: cmdOpts.verbose ?? false,
        profile: cmdOpts.profile,
      });
    });
}
