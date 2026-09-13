import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import { type Command } from 'commander';
import semver from 'semver';

import { readCliVersion } from '../lib/version.js';
import { readConfig } from '../lib/config.js';
import { computeFileHash, hashesMatch } from '../lib/sha256.js';
import { detectIdes } from '../lib/ide-detect.js';
import {
  ideCheckResults,
  checkClaudeDiscoveryConfig,
  checkContextRootNavigation,
  manifestUnavailable,
  overallStatus,
  safeReadManifest,
  summariseResults,
  type CheckResult,
  type DoctorSummary,
} from '../lib/doctor-checks.js';
import { log, info, warn, error, success, dim, bold, setVerbose } from '../ui/logger.js';

export type { CheckResult, CheckStatus } from '../lib/doctor-checks.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DoctorOptions = {
  verbose: boolean;
  json: boolean;
};

// ── Version helpers ───────────────────────────────────────────────────────────

/** Fetches the latest version from the npm registry. Returns null if offline. */
const fetchLatestNpmVersion = async (packageName: string): Promise<string | null> => {
  try {
    const url = `https://registry.npmjs.org/${packageName}/latest`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    // Network unavailable or timeout — non-blocking
    return null;
  }
};

// ── Individual check functions ────────────────────────────────────────────────

/** Check 1: OAC version vs npm registry (non-blocking, skipped if offline). */
const checkOacVersion = async (): Promise<CheckResult> => {
  const current = readCliVersion();
  const latest = await fetchLatestNpmVersion('@controlstack/oac');

  if (latest === null) {
    return {
      name: 'OAC version',
      status: 'info',
      message: `${current} (registry check skipped — offline or unreachable)`,
    };
  }

  const isOutdated = semver.lt(current, latest);
  if (isOutdated) {
    return {
      name: 'OAC version',
      status: 'warn',
      message: `${current} (latest: ${latest}) — run 'npm install -g @controlstack/oac' to update`,
    };
  }

  return {
    name: 'OAC version',
    status: 'ok',
    message: `${current} (latest)`,
  };
};

/** Check 2: Node runtime version >= 20.0.0. */
const checkNodeVersion = (): CheckResult => {
  const nodeVersion = process.versions.node; // e.g. "20.11.0"
  const MIN_NODE = '20.0.0';
  const isValid = semver.gte(nodeVersion, MIN_NODE);

  return {
    name: 'Node runtime',
    status: isValid ? 'ok' : 'error',
    message: isValid
      ? `${nodeVersion} (>= ${MIN_NODE} required)`
      : `${nodeVersion} is below minimum required ${MIN_NODE} — upgrade Node`,
  };
};

/** Check 3: .oac/config.json exists and is valid JSON. */
const checkConfig = async (projectRoot: string): Promise<CheckResult> => {
  try {
    const config = await readConfig(projectRoot);
    if (config === null) {
      return {
        name: 'Config',
        status: 'warn',
        message: '.oac/config.json not found — run \'oac init\' to create it',
      };
    }
    return {
      name: 'Config',
      status: 'ok',
      message: '.oac/config.json valid',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'Config',
      status: 'error',
      message: `.oac/config.json invalid — ${msg}`,
    };
  }
};

/** Check 4: .oac/manifest.json exists and is valid JSON. */
const checkManifest = async (projectRoot: string): Promise<CheckResult> => {
  const read = await safeReadManifest(projectRoot);
  if (!read.ok) {
    return {
      name: 'Manifest',
      status: 'error',
      message: `.oac/manifest.json invalid — ${read.error}`,
    };
  }
  if (read.manifest === null) {
    return {
      name: 'Manifest',
      status: 'error',
      message: '.oac/manifest.json not found — run \'oac init\' to create it',
    };
  }
  const fileCount = Object.keys(read.manifest.files).length;
  return {
    name: 'Manifest',
    status: 'ok',
    message: `.oac/manifest.json valid (${fileCount} file${fileCount !== 1 ? 's' : ''} tracked)`,
  };
};

/** Check 5: Every file listed in manifest exists on disk. */
const checkFilesOnDisk = async (projectRoot: string): Promise<CheckResult> => {
  const name = 'Files on disk';
  const read = await safeReadManifest(projectRoot);
  if (!read.ok || read.manifest === null) {
    return manifestUnavailable(name, read) ?? { name, status: 'error', message: 'Cannot check — manifest is missing' };
  }

  const trackedFiles = Object.keys(read.manifest.files);
  if (trackedFiles.length === 0) {
    return { name, status: 'ok', message: 'No files tracked in manifest' };
  }

  const missingFiles: string[] = [];
  for (const filePath of trackedFiles) {
    const absPath = join(projectRoot, filePath);
    const exists = await stat(absPath).then((s) => s.isFile()).catch(() => false);
    if (!exists) missingFiles.push(filePath);
  }

  if (missingFiles.length > 0) {
    return {
      name,
      status: 'error',
      message: `${missingFiles.length} file${missingFiles.length !== 1 ? 's' : ''} missing from disk`,
      detail: missingFiles,
    };
  }

  return {
    name,
    status: 'ok',
    message: `All ${trackedFiles.length} tracked file${trackedFiles.length !== 1 ? 's' : ''} present`,
  };
};

/** Check 6: SHA256 mismatch detection — warn for user-modified files. */
const checkModifiedFiles = async (projectRoot: string): Promise<CheckResult> => {
  const name = 'Modified files';
  const read = await safeReadManifest(projectRoot);
  if (!read.ok || read.manifest === null) {
    return manifestUnavailable(name, read) ?? { name, status: 'error', message: 'Cannot check — manifest is missing' };
  }

  const manifest = read.manifest;
  const trackedFiles = Object.keys(manifest.files);
  if (trackedFiles.length === 0) {
    return { name, status: 'ok', message: 'No files tracked' };
  }

  const modifiedFiles: string[] = [];
  for (const filePath of trackedFiles) {
    const absPath = join(projectRoot, filePath);
    const exists = await stat(absPath).then((s) => s.isFile()).catch(() => false);
    if (!exists) continue; // Already reported by checkFilesOnDisk

    try {
      const currentHash = await computeFileHash(absPath);
      const manifestHash = manifest.files[filePath]!.sha256;
      if (!hashesMatch(currentHash, manifestHash)) {
        modifiedFiles.push(filePath);
      }
    } catch {
      // If we can't hash it, skip — checkFilesOnDisk will catch missing files
    }
  }

  if (modifiedFiles.length > 0) {
    return {
      name,
      status: 'warn',
      message: `${modifiedFiles.length} file${modifiedFiles.length !== 1 ? 's' : ''} modified since install`,
      detail: modifiedFiles,
    };
  }

  return { name, status: 'ok', message: 'No files modified since install' };
};

/** Check 7: which tools are present. OpenCode present is the healthy state; Claude is informational. */
const checkIdes = async (projectRoot: string): Promise<CheckResult[]> =>
  ideCheckResults(await detectIdes(projectRoot));

// ── Result rendering ──────────────────────────────────────────────────────────

/** Prints a single check result with colored status indicator. */
const printCheckResult = (result: CheckResult): void => {
  switch (result.status) {
    case 'ok':
      success(`${result.name}: ${result.message}`);
      break;
    case 'warn':
      warn(`${result.name}: ${result.message}`);
      break;
    case 'error':
      error(`${result.name}: ${result.message}`);
      break;
    case 'info':
      info(`${result.name}: ${result.message}`);
      break;
  }

  if (result.detail && result.detail.length > 0) {
    for (const line of result.detail) {
      dim(`      - ${line}`);
    }
  }
};

/** Prints the final result line. Side-effect only. */
const printFinalResult = (summary: DoctorSummary): void => {
  log('');
  const status = overallStatus(summary);
  const parts: string[] = [];
  if (summary.warnings > 0) parts.push(`${summary.warnings} warning${summary.warnings !== 1 ? 's' : ''}`);
  if (summary.errors > 0) parts.push(`${summary.errors} error${summary.errors !== 1 ? 's' : ''}`);
  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';

  if (status === 'healthy') {
    success(`Result: HEALTHY${detail}`);
  } else if (status === 'warning') {
    warn(`Result: WARNING${detail}`);
  } else {
    error(`Result: UNHEALTHY${detail}`);
  }
  log('');
};

// ── Main command ──────────────────────────────────────────────────────────────

/**
 * Implements `oac doctor`:
 *  Runs all 7 health checks, prints results, and exits with code 0 (healthy/warnings)
 *  or 1 (errors found). Supports --json for machine-readable output.
 *
 *  Every check returns a value; a corrupt manifest is reported as a failed check rather
 *  than crashing the one tool whose job is to report it.
 */
export async function doctorCommand(options: DoctorOptions): Promise<void> {
  if (options.verbose) setVerbose(true);

  const projectRoot = process.cwd();

  // Run all independent async checks in parallel for speed
  const [configResult, manifestResult, filesResult, modifiedResult, contextNavigationResult, claudeDiscoveryResult, ideResults, versionResult] =
    await Promise.all([
      checkConfig(projectRoot),
      checkManifest(projectRoot),
      checkFilesOnDisk(projectRoot),
      checkModifiedFiles(projectRoot),
      checkContextRootNavigation(projectRoot),
      checkClaudeDiscoveryConfig(projectRoot),
      checkIdes(projectRoot),
      checkOacVersion(),
    ]);

  const allResults: CheckResult[] = [
    checkNodeVersion(), // synchronous — call directly
    configResult,
    manifestResult,
    filesResult,
    modifiedResult,
    contextNavigationResult,
    claudeDiscoveryResult,
    ...ideResults,    // checkIdes returns CheckResult[]
    versionResult,
  ];

  const summary = summariseResults(allResults);
  const status = overallStatus(summary);

  // JSON output mode (for CI)
  if (options.json) {
    const output = {
      status,
      checks: allResults,
      summary,
    };
    log(JSON.stringify(output, null, 2));
    process.exit(summary.errors > 0 ? 1 : 0);
  }

  // Human-readable output
  log('');
  bold('OAC Doctor — Checking your setup...');
  log('');

  for (const result of allResults) {
    printCheckResult(result);
  }

  printFinalResult(summary);

  process.exit(summary.errors > 0 ? 1 : 0);
}

// ── Commander registration ────────────────────────────────────────────────────

/**
 * Registers the `doctor` subcommand on the given Commander program.
 * Called by the CLI entry point (index.ts).
 */
export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check your OAC setup and report any issues')
    .option('--verbose', 'Show additional diagnostic detail', false)
    .option('--json', 'Output results as machine-readable JSON (for CI)', false)
    .action(async (opts: { verbose: boolean; json: boolean }) => {
      await doctorCommand({ verbose: opts.verbose, json: opts.json });
    });
}
