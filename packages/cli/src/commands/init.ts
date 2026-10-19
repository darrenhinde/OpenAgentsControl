import { type Command } from 'commander';
import { lstat, writeFile } from 'node:fs/promises';

import { readCliVersion } from '../lib/version.js';
import { isProjectRoot, installFiles, syncFiles, type InstallResult } from '../lib/installer.js';
import { getPackageRoot, listBundledFiles, classifyBundledFile } from '../lib/bundled.js';
import { readManifest, writeManifest, type ManifestFile } from '../lib/manifest.js';
import { readConfig, writeConfig, createDefaultConfig, withOpenCodeFlavor, type OacInstallationScope } from '../lib/config.js';
import { parseFlavor, resolveInitFlavor, type OpenCodeFlavor } from '../lib/flavor.js';
import { detectOpenCodeMajor } from '../lib/opencode-host.js';
import { readProjectFlavor } from '../lib/project-flavor.js';
import { detectIdes } from '../lib/ide-detect.js';
import {
  loadRegistry,
  listProfiles,
  getProfile,
  resolveProfile,
  DEFAULT_PROFILE_ID,
  FULL_PROFILE_ID,
  type Registry,
} from '../lib/registry.js';
import { log, info, warn, error, success, setVerbose, verbose, dim } from '../ui/logger.js';
import { createSpinner } from '../ui/spinner.js';
import { CLAUDE_CONTEXT_ROOT, getClaudeDiscoveryConfigPath } from '../lib/doctor-checks.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InitOptions = {
  yolo: boolean;
  dryRun: boolean;
  verbose: boolean;
  /** Install tier from registry.json `profiles`. Defaults to `essential`. */
  profile: string;
  /** Keep only the profile's context files. */
  contextOnly: boolean;
  /** Print the available profiles and exit. */
  listProfiles: boolean;
  /** Which OpenCode major to install for. Unset means: the recorded flavor, else v2. */
  opencode?: string;
};

/** The files `oac init` will copy, plus anything worth telling the user about the choice. */
export type InstallPlan = {
  profileId: string;
  profileName: string;
  files: string[];
  unresolved: string[];
  refused: string[];
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

const CONTEXT_PREFIX = '.opencode/context/';

/** Counts files by bundled kind. Pure function. */
export const countByType = (files: string[]): Record<string, number> =>
  files.reduce<Record<string, number>>((acc, file) => {
    const kind = classifyBundledFile(file);
    return { ...acc, [kind]: (acc[kind] ?? 0) + 1 };
  }, {});

const LABELS: Record<string, [string, string]> = {
  agent: ['agent', 'agents'],
  context: ['context file', 'context files'],
  skill: ['skill file', 'skill files'],
  command: ['command', 'commands'],
  tool: ['tool file', 'tool files'],
  plugin: ['plugin', 'plugins'],
  config: ['config file', 'config files'],
};

/** Formats a file-count summary string. Pure function. */
export const formatFileSummary = (counts: Record<string, number>): string => {
  const parts = Object.keys(LABELS)
    .filter((kind) => (counts[kind] ?? 0) > 0)
    .map((kind) => {
      const n = counts[kind]!;
      const [one, many] = LABELS[kind]!;
      return `${n} ${n === 1 ? one : many}`;
    });
  return parts.join(', ') || '0 files';
};

/**
 * Decides which bundled files a profile installs.
 *
 * `full` is the bundle itself (every agent, context and skill file), so it needs no registry
 * resolution. Every other profile is the closure of its `type:id` refs.
 *
 * Pure apart from reading the bundle listing, which the caller supplies.
 */
export const planInstall = (
  registry: Registry,
  bundledFiles: string[],
  options: Pick<InitOptions, 'profile' | 'contextOnly'>,
): InstallPlan | null => {
  const profile = getProfile(registry, options.profile);
  if (profile === null) return null;

  if (options.profile === FULL_PROFILE_ID) {
    const files = options.contextOnly
      ? bundledFiles.filter((f) => f.startsWith(CONTEXT_PREFIX))
      : bundledFiles;
    return { profileId: options.profile, profileName: profile.name, files: [...files].sort(), unresolved: [], refused: [] };
  }

  const resolved = resolveProfile(registry, profile, { contextOnly: options.contextOnly });
  return {
    profileId: options.profile,
    profileName: profile.name,
    files: resolved.files,
    unresolved: resolved.unresolved,
    refused: resolved.refused,
  };
};

// ── Output ────────────────────────────────────────────────────────────────────

/** Prints every profile the bundle offers. Side-effect only. */
const printProfiles = (registry: Registry): void => {
  log('');
  log('Available profiles (oac init --profile <id>):');
  log('');
  for (const p of listProfiles(registry)) {
    const marker = p.id === DEFAULT_PROFILE_ID ? ' (default)' : '';
    log(`  ${p.id}${marker} — ${p.name}, ${p.components.length} components`);
    if (p.description) dim(`      ${p.description}`);
  }
  log('');
};

/** Prints the pre-install plan. Side-effect only. */
const printPlan = (
  plan: InstallPlan,
  ides: Awaited<ReturnType<typeof detectIdes>>,
  options: InitOptions,
  flavor: OpenCodeFlavor,
): void => {
  const detectedIdes = ides.filter((i) => i.detected).map((i) => i.type);

  log('');
  log(options.dryRun ? '  [dry-run] oac init — no files will be written' : '  oac init');
  log('');
  info(`OpenCode:     ${flavor === 'v1' ? 'v1 (opt-in)' : 'v2'}`);
  info(`Profile:      ${plan.profileId} (${plan.profileName})${options.contextOnly ? ', context files only' : ''}`);
  info(`Will install: ${formatFileSummary(countByType(plan.files))}`);
  info(`Destination:  .opencode/ (relative to project root)`);

  for (const ref of plan.unresolved) warn(`Profile lists '${ref}', which this bundle does not have — skipping.`);
  for (const ref of plan.refused) warn(`Profile lists '${ref}', which lives outside .opencode/ — skipping.`);

  if (detectedIdes.length > 0) {
    info(`IDEs detected: ${detectedIdes.join(', ')} — run \`oac apply\` after init`);
  } else {
    info('No IDEs detected — run `oac apply claude` to generate Claude Code files');
  }

  log('');
};

/** Prints the post-install summary. Side-effect only. */
const printSummary = (result: InstallResult, reinstall: boolean, dryRun: boolean): void => {
  const written = result.installed.length + result.updated.length;
  log('');
  if (dryRun) {
    info(`[dry-run] Would install ${written} file${written !== 1 ? 's' : ''}.`);
    if (result.skipped.length > 0) {
      info(`[dry-run] Would skip ${result.skipped.length} (modified since install — use --yolo to overwrite).`);
    }
    info('No changes were made. Remove --dry-run to apply.');
    return;
  }
  if (result.errors.length > 0) {
    warn(`Completed with ${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}.`);
  }
  if (reinstall && result.skipped.length > 0) {
    warn(`Skipped ${result.skipped.length} file${result.skipped.length !== 1 ? 's' : ''} you have modified (use --yolo to back up and overwrite):`);
    for (const f of result.skipped) dim(`    ${f}`);
  }
  if (result.backed_up.length > 0) {
    info(`Backed up ${result.backed_up.length} file${result.backed_up.length !== 1 ? 's' : ''} to .oac/backups/.`);
  }
  success(`Done! ${written} file${written !== 1 ? 's' : ''} installed. Run \`oac doctor\` to verify.`);
  log('');
};

// ── Validation ────────────────────────────────────────────────────────────────

/** Validates we are in a project root. Exits with code 1 if not. */
const assertProjectRoot = async (cwd: string): Promise<void> => {
  const isRoot = await isProjectRoot(cwd);
  if (!isRoot) {
    error('Not a project root — no package.json or .git found in the current directory.');
    error('Fix: run `oac init` from your project root (where package.json lives).');
    process.exit(1);
  }
};

// ── Config guard ──────────────────────────────────────────────────────────────

/**
 * Writes the default config only if one does not already exist.
 * Idempotent — never overwrites an existing config.
 */
const ensureConfig = async (
  projectRoot: string,
  dryRun: boolean,
  selection: Pick<OacInstallationScope, 'profile' | 'contextOnly'>,
  flavor: OpenCodeFlavor,
): Promise<void> => {
  const existing = await readConfig(projectRoot);
  if (dryRun) {
    info('[dry-run] Would write .oac/config.json with installation scope.');
    return;
  }
  const base = existing ?? createDefaultConfig();
  const profiles = [...new Set([...base.installationScope.profiles, selection.profile])];
  await writeConfig(projectRoot, withOpenCodeFlavor({
    ...base,
    installationScope: { ...selection, profiles },
  }, flavor));
  verbose(existing === null ? 'Wrote .oac/config.json with installation scope.' : 'Updated installation scope.');
};

/**
 * Adds Claude Code's verified project-local context pointer without taking ownership of an
 * existing user configuration. The protocol requires a project-relative root.
 */
export const ensureClaudeDiscoveryConfig = async (projectRoot: string, dryRun: boolean): Promise<void> => {
  const configPath = getClaudeDiscoveryConfigPath(projectRoot);
  const exists = await lstat(configPath).then(() => true).catch(() => false);
  if (exists) {
    verbose('.oac.json already exists — skipping user-owned Claude discovery configuration.');
    return;
  }
  if (dryRun) {
    info(`[dry-run] Would write .oac.json with context.root "${CLAUDE_CONTEXT_ROOT}".`);
    return;
  }
  await writeFile(
    configPath,
    JSON.stringify({ version: '1', context: { root: CLAUDE_CONTEXT_ROOT } }, null, 2),
    'utf8',
  );
  verbose(`Wrote .oac.json with context.root "${CLAUDE_CONTEXT_ROOT}".`);
};

// ── Install step ──────────────────────────────────────────────────────────────

type InstallOutcome = { result: InstallResult; updatedManifest: ManifestFile; reinstall: boolean };

/**
 * Fresh project: copy everything. Existing manifest: reconcile against it so a file the
 * user edited is skipped, not clobbered, and `oac add` entries survive.
 */
const runInstall = async (
  files: string[],
  existing: ManifestFile | null,
  projectRoot: string,
  packageRoot: string,
  options: InitOptions,
): Promise<InstallOutcome> => {
  const installOpts = {
    projectRoot,
    packageRoot,
    dryRun: options.dryRun,
    yolo: options.yolo,
    verbose: options.verbose,
  };

  if (existing === null) {
    const { result, updatedManifest } = await installFiles(files, installOpts);
    return { result, updatedManifest, reinstall: false };
  }

  const { result, updatedManifest } = await syncFiles(files, existing, installOpts);
  return { result, updatedManifest, reinstall: true };
};

// ── Main command ──────────────────────────────────────────────────────────────

/**
 * Implements `oac init`:
 *  1. Validates we are in a project root
 *  2. Loads the bundled registry and resolves the chosen profile
 *  3. Detects IDEs and prints the install plan
 *  4. Copies the profile's files (reconciling against an existing manifest)
 *  5. Writes .oac/manifest.json
 *  6. Writes .oac/config.json (only if absent)
 *  7. Prints a completion summary
 */
export async function initCommand(options: InitOptions): Promise<void> {
  // Respect CI=true as implicit --yolo
  const effectiveOptions: InitOptions = { ...options, yolo: options.yolo || process.env['CI'] === 'true' };

  if (effectiveOptions.verbose) setVerbose(true);

  const projectRoot = process.cwd();

  // Step 0: which OpenCode major. v2 unless v1 is explicitly requested; never inferred from the host.
  const requested = effectiveOptions.opencode === undefined ? undefined : parseFlavor(effectiveOptions.opencode);
  if (effectiveOptions.opencode !== undefined && requested === null) {
    error(`Unknown OpenCode version '${effectiveOptions.opencode}'. Use v1 or v2.`);
    process.exit(1);
  }
  const project = await readProjectFlavor(projectRoot);
  const hasInstall = (await readManifest(projectRoot).catch(() => null)) !== null;
  const decision = resolveInitFlavor({
    requested: requested ?? undefined,
    recorded: project.recorded,
    current: project.flavor,
    hasInstall,
  });
  if (!decision.ok) {
    error(decision.message);
    process.exit(1);
  }
  const flavor = decision.flavor;
  const hostMajor = await detectOpenCodeMajor();
  if (flavor === 'v2' && hostMajor === 1) {
    warn('OpenCode v1 is installed, but OAC installs for OpenCode v2 by default. For v1, run: oac init --opencode v1');
  } else if (flavor === 'v1' && hostMajor !== null && hostMajor >= 2) {
    warn(`Installing for OpenCode v1, but OpenCode ${hostMajor} is installed; v1 agents, tools and plugins do not load there.`);
  }

  // Step 1: locate the bundle and its registry
  let packageRoot: string;
  let registry: Registry;
  let bundledFiles: string[];
  try {
    packageRoot = getPackageRoot();
    registry = await loadRegistry(packageRoot, flavor);
    bundledFiles = await listBundledFiles(packageRoot, flavor);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Could not locate bundled files: ${msg}`);
    error('Fix: ensure @controlstack/oac is installed correctly (try reinstalling).');
    process.exit(1);
  }

  if (effectiveOptions.listProfiles) {
    printProfiles(registry);
    process.exit(0);
  }

  // Step 2: validate project root
  await assertProjectRoot(projectRoot);

  // Step 3: resolve the profile
  const plan = planInstall(registry, bundledFiles, effectiveOptions);
  if (plan === null) {
    const known = listProfiles(registry).map((p) => p.id).join(', ');
    error(`Unknown profile '${effectiveOptions.profile}'. Available: ${known}.`);
    error('Fix: run `oac init --list-profiles` to see what each one installs.');
    process.exit(1);
  }

  if (plan.files.length === 0) {
    warn(`Profile '${plan.profileId}' resolves to no files — nothing to install.`);
    process.exit(1);
  }

  // Step 4: detect IDEs and print plan
  const ides = await detectIdes(projectRoot);
  printPlan(plan, ides, effectiveOptions, flavor);

  // Step 5: install files
  const existing = await readManifest(projectRoot).catch((err: unknown): never => {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Could not read .oac/manifest.json: ${msg}`);
    error('Fix: repair the JSON, or delete .oac/manifest.json to start fresh.');
    return process.exit(1);
  });
  if (existing !== null) {
    info('Existing install found — files you have modified will be kept.');
  }

  const spinner = createSpinner('Installing files…', { dryRun: effectiveOptions.dryRun });
  spinner.start();

  let outcome: InstallOutcome;
  try {
    outcome = await runInstall(plan.files, existing, projectRoot, packageRoot, effectiveOptions);
  } catch (err) {
    spinner.fail('Installation failed.');
    const msg = err instanceof Error ? err.message : String(err);
    error(`Installation failed: ${msg}`);
    error('Fix: check file permissions in your project directory.');
    process.exit(1);
  }
  const { result, updatedManifest, reinstall } = outcome;

  // Report per-file errors (non-fatal — partial installs are still useful)
  for (const fileError of result.errors) {
    warn(`Error: ${fileError}`);
  }

  const written = result.installed.length + result.updated.length;
  spinner.succeed(`Installed ${written} file${written !== 1 ? 's' : ''}.`);

  // Step 6: write manifest (skip in dry-run)
  if (effectiveOptions.dryRun) {
    info('[dry-run] Would write .oac/manifest.json');
  } else {
    const finalManifest = { ...updatedManifest, oacVersion: readCliVersion() };

    await writeManifest(projectRoot, finalManifest).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      error(`Failed to write manifest: ${msg}`);
      error('Fix: check write permissions for the .oac/ directory.');
      process.exit(1) as never;
    });
    verbose('Wrote .oac/manifest.json');
  }

  // Step 7: persist config and the cumulative installation scope
  await ensureConfig(projectRoot, effectiveOptions.dryRun, {
    profile: plan.profileId,
    contextOnly: effectiveOptions.contextOnly,
  }, flavor).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to write config: ${msg}`);
    error('Fix: check write permissions for the .oac/ directory.');
    process.exit(1) as never;
  });

  // Step 8: write Claude Code's verified discovery configuration (only if absent)
  await ensureClaudeDiscoveryConfig(projectRoot, effectiveOptions.dryRun).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Failed to write .oac.json: ${msg}`);
    error('Fix: check write permissions for the project root.');
    process.exit(1) as never;
  });

  // Step 9: print summary
  printSummary(result, reinstall, effectiveOptions.dryRun);

  // Exit 0 on success (explicit for clarity)
  process.exit(0);
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `init` subcommand on the given Commander program.
 * Called by the CLI entry point (index.ts).
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Set up OAC agents and context files in the current project')
    .option('-p, --profile <id>', `Install tier: essential, developer, business, advanced or full`, DEFAULT_PROFILE_ID)
    .option('--context-only', "Install only the profile's context files (no agents, skills or commands)", false)
    .option('--opencode <version>', 'OpenCode major to install for: v2 (default) or v1 (opt-in)')
    .option('--list-profiles', 'Show the available profiles and exit', false)
    .option('--yolo', 'Back up and overwrite files you have modified (re-runs only)', false)
    .option('--dry-run', 'Print what would happen without making any changes', false)
    .option('--verbose', 'Show each file being copied', false)
    .action(
      async (opts: {
        profile: string;
        contextOnly: boolean;
        listProfiles: boolean;
        opencode?: string;
        yolo: boolean;
        dryRun: boolean;
        verbose: boolean;
      }) => {
        await initCommand({
          profile: opts.profile,
          contextOnly: opts.contextOnly,
          listProfiles: opts.listProfiles,
          opencode: opts.opencode,
          yolo: opts.yolo,
          dryRun: opts.dryRun,
          verbose: opts.verbose,
        });
      },
    );
}
