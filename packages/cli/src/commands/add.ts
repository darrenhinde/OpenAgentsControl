import path from 'node:path';
import { rm, stat } from 'node:fs/promises';
import { type Command } from 'commander';
import {
  loadRegistry,
  resolveComponent,
  listComponents,
  filesForComponent,
  isInstallablePath,
  ComponentTypeSchema,
  type ComponentType,
} from '../lib/registry.js';
import { getPackageRoot } from '../lib/bundled.js';
import { backupFile, syncFiles } from '../lib/installer.js';
import {
  readManifest,
  writeManifest,
  removeFileFromManifest,
  createEmptyManifest,
  type ManifestFile,
} from '../lib/manifest.js';
import { log, info, warn, error, success, verbose } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { computeFileHash, hashesMatch } from '../lib/sha256.js';
import { readCliVersion } from '../lib/version.js';
import type { RegistryComponent } from '../lib/registry.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AddOptions = {
  yolo: boolean;
  dryRun: boolean;
  verbose: boolean;
  force: boolean;
};

export type RemoveOptions = {
  yolo: boolean;
  dryRun: boolean;
  verbose: boolean;
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Returns true if the file is already tracked in the manifest. */
const isAlreadyInstalled = (
  manifest: ManifestFile | null,
  destRelativePath: string,
): boolean => manifest?.files[destRelativePath] !== undefined;

/** The directory a component's primary file lands in, for messages. */
const destDirOf = (component: RegistryComponent): string => path.dirname(component.path);

// ── List display ──────────────────────────────────────────────────────────────

/** Component kinds shown by a bare `oac add`, in display order. */
const LISTED_TYPES: ComponentType[] = ['agent', 'subagent', 'context', 'skill', 'command', 'tool'];

/** Prints all available components grouped by type. */
const printAvailableComponents = async (): Promise<void> => {
  const packageRoot = getPackageRoot();
  const registry = await loadRegistry(packageRoot);

  log('');
  log('Available components:');
  log('');

  for (const type of LISTED_TYPES) {
    const components = listComponents(registry, type);
    if (components.length === 0) continue;
    log(`  ${type.toUpperCase()}S`);
    for (const c of components) {
      log(`    oac add ${type}:${c.id}  — ${c.description}`);
    }
    log('');
  }

  log(`Run 'oac add <type>:<name>' to install a component.`);
  log(`Example: oac add context:react-patterns`);
};

// ── Core install logic ────────────────────────────────────────────────────────

/** Resolves the component from the registry or exits with a clear error. */
const resolveOrFail = async (
  ref: string,
): Promise<{ component: RegistryComponent; packageRoot: string }> => {
  const packageRoot = getPackageRoot();
  const registry = await loadRegistry(packageRoot);
  const component = resolveComponent(registry, ref);

  if (component === null) {
    const kinds = ComponentTypeSchema.options.join(', ');
    error(`Component '${ref}' not found. Run 'oac add' to see available components (kinds: ${kinds}).`);
    process.exit(1);
  }

  return { component, packageRoot };
};

/** Checks if the component is already installed and handles --force / warning. */
const checkAlreadyInstalled = (
  manifest: ManifestFile | null,
  destRelativePath: string,
  force: boolean,
): boolean => {
  if (!isAlreadyInstalled(manifest, destRelativePath)) return false;

  if (!force) {
    warn(`Already installed. Use --force to reinstall.`);
    return true; // signal: abort
  }

  info('Reinstalling (--force).');
  return false; // signal: proceed
};

/** Synchronizes every component file using the same safety path as init and update. */
const performInstall = async (
  component: RegistryComponent,
  packageRoot: string,
  projectRoot: string,
  manifest: ManifestFile,
  opts: AddOptions,
): Promise<void> => {
  const files = filesForComponent(component);
  const destDir = destDirOf(component);

  info(`Installing ${component.type}:${component.id} → ${destDir}/ (${files.length} file${files.length !== 1 ? 's' : ''})`);

  const installOpts = {
    projectRoot,
    packageRoot,
    dryRun: opts.dryRun,
    yolo: opts.yolo,
    verbose: opts.verbose,
  };

  const { result, updatedManifest } = await syncFiles(files, manifest, {
    ...installOpts,
    source: 'registry',
  });

  if (result.errors.length > 0) throw new Error(result.errors.join('; '));

  if (opts.dryRun) {
    info(`[dry-run] Would install ${component.type}:${component.id} to ${destDir}/`);
    return;
  }

  await writeManifest(projectRoot, updatedManifest);
  success(`Added ${component.id} to ${destDir}/`);
};

// ── Public command functions ──────────────────────────────────────────────────

/**
 * Implements `oac add [ref]`.
 * With no ref: lists available components grouped by type.
 * With ref (e.g. `context:react-patterns`): installs the component and every file it lists.
 */
export async function addCommand(
  ref: string | undefined,
  options: AddOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  if (ref === undefined) {
    await printAvailableComponents();
    return;
  }

  const spinner = createSpinner(`Resolving ${ref}…`, { dryRun: options.dryRun });
  spinner.start();

  try {
    const { component, packageRoot } = await resolveOrFail(ref);
    spinner.stop();

    if (!filesForComponent(component).every(isInstallablePath)) {
      error(`'${ref}' would write outside .opencode/ (${component.path}) — refusing to overwrite a project file.`);
      process.exit(1);
    }

    const manifest = (await readManifest(projectRoot)) ?? createEmptyManifest(readCliVersion());

    const shouldAbort = checkAlreadyInstalled(manifest, component.path, options.force);
    if (shouldAbort) return;

    await performInstall(component, packageRoot, projectRoot, manifest, options);
  } catch (err: unknown) {
    spinner.fail();
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to add '${ref}': ${msg}`);
    process.exit(1);
  }
}

/**
 * Implements `oac remove [ref]`.
 * Removes every file the component installed and updates the manifest.
 */
export async function removeCommand(
  ref: string | undefined,
  options: RemoveOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  if (ref === undefined) {
    error('Please specify a component to remove. Example: oac remove context:react-patterns');
    process.exit(1);
  }

  const spinner = createSpinner(`Resolving ${ref}…`, { dryRun: options.dryRun });
  spinner.start();

  try {
    const { component } = await resolveOrFail(ref);
    spinner.stop();

    const manifest = await readManifest(projectRoot);

    if (!isAlreadyInstalled(manifest, component.path)) {
      warn(`'${ref}' is not installed — nothing to remove.`);
      return;
    }

    const files = filesForComponent(component);
    if (!files.every(isInstallablePath)) {
      error(`'${ref}' would delete outside .opencode/ (${component.path}) — refusing to remove a project file.`);
      process.exit(1);
    }
    info(`Removing ${component.type}:${component.id} from ${destDirOf(component)}/ (${files.length} file${files.length !== 1 ? 's' : ''})`);

    let updatedManifest = manifest!;
    for (const relativePath of files) {
      const destPath = path.join(projectRoot, relativePath);
      const entry = updatedManifest.files[relativePath];
      if (options.verbose) verbose(`Removing: ${destPath}`);

      if (options.dryRun) {
        info(`[dry-run] Would remove ${destPath}`);
        continue;
      }
      if (entry === undefined) {
        warn(`Skipping untracked file '${relativePath}'.`);
        continue;
      }

      const exists = await stat(destPath).then((file) => file.isFile()).catch(() => false);
      const modified = exists && !hashesMatch(await computeFileHash(destPath), entry.sha256);
      const protectedFile = entry.protected === true;
      if ((protectedFile || modified) && !options.yolo) {
        warn(`Skipping ${protectedFile ? 'protected' : 'modified'} file '${relativePath}' (use --yolo to remove).`);
        continue;
      }

      if (options.yolo && exists && (protectedFile || modified)) {
        const backupPath = await backupFile(destPath, projectRoot);
        info(`Backed up ${relativePath} to ${backupPath}`);
      }

      await rm(destPath, { force: true });
      updatedManifest = removeFileFromManifest(updatedManifest, relativePath);
    }

    if (!options.dryRun) {
      await writeManifest(projectRoot, updatedManifest);
      success(`Removed ${component.id}`);
    }
  } catch (err: unknown) {
    spinner.fail();
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to remove '${ref}': ${msg}`);
    process.exit(1);
  }
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `add` and `remove` subcommands on the given Commander program.
 */
export function registerAddCommand(program: Command): void {
  program
    .command('add [ref]')
    .description('Add a component (agent, context, skill, command, tool). Example: oac add context:react-patterns')
    .option('--force', 'Reinstall even if already installed', false)
    .option('--dry-run', 'Show what would happen without making changes', false)
    .option('--yolo', 'Skip safety checks and overwrite user-modified files', false)
    .option('--verbose', 'Show source and destination paths', false)
    .action(async (ref: string | undefined, opts: { force?: boolean; dryRun?: boolean; yolo?: boolean; verbose?: boolean }) => {
      await addCommand(ref, {
        force: opts.force ?? false,
        dryRun: opts.dryRun ?? false,
        yolo: opts.yolo ?? false,
        verbose: opts.verbose ?? false,
      });
    });

  program
    .command('remove [ref]')
    .description('Remove an installed component. Example: oac remove context:react-patterns')
    .option('--dry-run', 'Show what would happen without making changes', false)
    .option('--yolo', 'Skip safety checks', false)
    .option('--verbose', 'Show file paths', false)
    .action(async (ref: string | undefined, opts: { dryRun?: boolean; yolo?: boolean; verbose?: boolean }) => {
      await removeCommand(ref, {
        dryRun: opts.dryRun ?? false,
        yolo: opts.yolo ?? false,
        verbose: opts.verbose ?? false,
      });
    });
}
