import path from "node:path";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { computeFileHash, hashesMatch } from "./sha256.js";
import {
  type ManifestFile,
  type FileEntry,
  addFileToManifest,
  removeFileFromManifest,
  readManifest,
  createEmptyManifest,
} from "./manifest.js";
import { listBundledFiles, getBundledFilePath, classifyBundledFile, toManifestType } from "./bundled.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InstallOptions = {
  /** Absolute path to the user's project root (where .oac/ lives). */
  projectRoot: string;
  /** Absolute path to the OAC npm package root (where bundled files live). */
  packageRoot: string;
  /** When true: log what would happen but make no filesystem changes. */
  dryRun: boolean;
  /** When true: backup user-modified files and overwrite them. */
  yolo: boolean;
  /** When true: emit verbose log lines. */
  verbose: boolean;
};

export type InstallResult = {
  /** Relative paths of files newly installed (not previously in manifest). */
  installed: string[];
  /** Relative paths of files updated (were untouched by user). */
  updated: string[];
  /** Relative paths of files skipped because user modified them. */
  skipped: string[];
  /** Relative paths of files backed up before yolo overwrite. */
  backed_up: string[];
  /** Relative paths removed from manifest (no longer in bundle). */
  removed_from_manifest: string[];
  /** Human-readable error messages for any failures. */
  errors: string[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_RESULT: InstallResult = {
  installed: [],
  updated: [],
  skipped: [],
  backed_up: [],
  removed_from_manifest: [],
  errors: [],
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Builds the ISO timestamp string used in backup directory names. */
const buildTimestamp = (): string =>
  new Date().toISOString().replace(/[:.]/g, "-");

/** Returns the absolute backup path for a file. */
const buildBackupPath = (
  projectRoot: string,
  timestamp: string,
  relativePath: string,
): string => path.join(projectRoot, ".oac", "backups", timestamp, relativePath);

/** Merges a partial result into an existing result (immutable). */
const mergeResult = (
  base: InstallResult,
  patch: Partial<InstallResult>,
): InstallResult => ({
  installed: [...base.installed, ...(patch.installed ?? [])],
  updated: [...base.updated, ...(patch.updated ?? [])],
  skipped: [...base.skipped, ...(patch.skipped ?? [])],
  backed_up: [...base.backed_up, ...(patch.backed_up ?? [])],
  removed_from_manifest: [
    ...base.removed_from_manifest,
    ...(patch.removed_from_manifest ?? []),
  ],
  errors: [...base.errors, ...(patch.errors ?? [])],
});

/** Logs a message when verbose mode is on. Pure side-effect wrapper. */
const log = (options: InstallOptions, message: string): void => {
  if (options.verbose || options.dryRun) {
    process.stdout.write(`[oac] ${message}\n`);
  }
};

// ── Single-file I/O operations ────────────────────────────────────────────────

/**
 * Copies a single file from `sourcePath` to `destPath`, creating parent
 * directories as needed. In dry-run mode, logs the action and skips the copy.
 */
export async function installFile(
  sourcePath: string,
  destPath: string,
  options: InstallOptions,
): Promise<void> {
  if (options.dryRun) {
    log(options, `[dry-run] would copy: ${sourcePath} → ${destPath}`);
    return;
  }
  await copyFileCreatingDirs(sourcePath, destPath);
}

/**
 * Copies `src` to `dest`, creating `dest`'s parent directories first.
 *
 * `fs.copyFile` fails when the destination directory does not exist, so the
 * mkdir is required — every caller here writes into a tree that may not exist yet.
 */
async function copyFileCreatingDirs(src: string, dest: string): Promise<void> {
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

/**
 * Backs up `filePath` to `.oac/backups/{timestamp}/{original-relative-path}`.
 * Returns the absolute backup path. Creates the backup directory if needed.
 */
export async function backupFile(
  filePath: string,
  projectRoot: string,
): Promise<string> {
  const timestamp = buildTimestamp();
  const relativePath = path.relative(projectRoot, filePath);
  const backupPath = buildBackupPath(projectRoot, timestamp, relativePath);
  await copyFileCreatingDirs(filePath, backupPath);
  return backupPath;
}

// ── Decision logic (pure) ─────────────────────────────────────────────────────

type FileDecision =
  | { action: "install" }
  | { action: "update" }
  | { action: "skip"; reason: string }
  | { action: "yolo-overwrite"; backupNeeded: true };

/**
 * Determines what action to take for a single bundled file.
 * Pure — reads from disk but makes no writes.
 */
async function decideFileAction(
  relativePath: string,
  manifest: ManifestFile | null,
  destPath: string,
  options: InstallOptions,
): Promise<FileDecision> {
  const manifestEntry = manifest?.files[relativePath];

  // File not in manifest → brand new, always install
  if (manifestEntry === undefined) {
    return { action: "install" };
  }

  // File is in manifest — check if user modified it
  const diskExists = await stat(destPath).then((s) => s.isFile()).catch(() => false);
  if (!diskExists) {
    // File was deleted by user — treat as new install
    return { action: "install" };
  }

  const currentHash = await computeFileHash(destPath);
  const isUntouched = hashesMatch(currentHash, manifestEntry.sha256);

  if (isUntouched) {
    return { action: "update" };
  }

  // User modified the file
  if (options.yolo) {
    return { action: "yolo-overwrite", backupNeeded: true };
  }

  return {
    action: "skip",
    reason: `${relativePath} was modified by user — skipping (use --yolo to overwrite)`,
  };
}

// ── Per-file processor ────────────────────────────────────────────────────────

type ProcessFileArgs = {
  relativePath: string;
  sourcePath: string;
  destPath: string;
  manifest: ManifestFile | null;
  options: InstallOptions;
  timestamp: string;
};

/**
 * Processes a single bundled file: decides the action, performs I/O,
 * and returns a partial result + updated manifest entry.
 */
async function processOneFile(
  args: ProcessFileArgs,
): Promise<{ patch: Partial<InstallResult>; entry: FileEntry | null }> {
  const { relativePath, sourcePath, destPath, manifest, options, timestamp } =
    args;

  const decisionResult = await (async () => {
    try {
      return { ok: true as const, value: await decideFileAction(relativePath, manifest, destPath, options) };
    } catch (err) {
      return { ok: false as const, msg: err instanceof Error ? err.message : String(err) };
    }
  })();
  if (!decisionResult.ok) {
    return {
      patch: { errors: [`${relativePath}: decision failed — ${decisionResult.msg}`] },
      entry: null,
    };
  }
  const decision = decisionResult.value;

  const now = new Date().toISOString();
  const fileType = toManifestType(classifyBundledFile(relativePath));

  try {
    if (decision.action === "install") {
      log(options, `install: ${relativePath}`);
      await installFile(sourcePath, destPath, options);
      const sha256 = options.dryRun ? "" : await computeFileHash(destPath);
      const entry: FileEntry = {
        sha256,
        type: fileType,
        source: "bundled",
        installedAt: now,
      };
      return { patch: { installed: [relativePath] }, entry };
    }

    if (decision.action === "update") {
      log(options, `update: ${relativePath}`);
      await installFile(sourcePath, destPath, options);
      const sha256 = options.dryRun ? "" : await computeFileHash(destPath);
      const existingEntry = manifest!.files[relativePath]!;
      const entry: FileEntry = { ...existingEntry, sha256 };
      return { patch: { updated: [relativePath] }, entry };
    }

    if (decision.action === "yolo-overwrite") {
      log(options, `yolo: backing up and overwriting ${relativePath}`);
      const backupPath = buildBackupPath(options.projectRoot, timestamp, relativePath);
      if (!options.dryRun) {
        await copyFileCreatingDirs(destPath, backupPath);
      } else {
        log(options, `[dry-run] would backup: ${destPath} → ${backupPath}`);
      }
      await installFile(sourcePath, destPath, options);
      const sha256 = options.dryRun ? "" : await computeFileHash(destPath);
      const existingEntry = manifest!.files[relativePath]!;
      const entry: FileEntry = { ...existingEntry, sha256 };
      return {
        patch: { backed_up: [backupPath], updated: [relativePath] },
        entry,
      };
    }

    // action === "skip" — TypeScript narrows decision.reason inside this block
    if (decision.action === "skip") {
      log(options, `skip: ${decision.reason}`);
    }
    return { patch: { skipped: [relativePath] }, entry: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      patch: { errors: [`${relativePath}: ${msg}`] },
      entry: null,
    };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Installs a list of files from the bundle into the project root.
 * Does NOT consult the manifest — treats every file as new.
 * Used by `oac init` for a fresh install.
 *
 * Does NOT write the manifest — caller is responsible.
 */
export async function installFiles(
  files: string[],
  options: InstallOptions,
): Promise<{ result: InstallResult; updatedManifest: ManifestFile }> {
  const now = new Date().toISOString();

  type FileOutcome =
    | { ok: true; relativePath: string; entry: FileEntry }
    | { ok: false; relativePath: string; msg: string };

  const outcomes = await Promise.all(
    files.map(async (relativePath): Promise<FileOutcome> => {
      const sourcePath = getBundledFilePath(options.packageRoot, relativePath);
      const destPath = path.join(options.projectRoot, relativePath);
      log(options, `install: ${relativePath}`);
      try {
        await installFile(sourcePath, destPath, options);
        const sha256 = options.dryRun ? "" : await computeFileHash(destPath);
        const entry: FileEntry = {
          sha256,
          type: toManifestType(classifyBundledFile(relativePath)),
          source: "bundled",
          installedAt: now,
        };
        return { ok: true, relativePath, entry };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, relativePath, msg };
      }
    }),
  );

  const { result, updatedManifest } = outcomes.reduce(
    (acc, outcome) => {
      if (outcome.ok) {
        return {
          result: mergeResult(acc.result, { installed: [outcome.relativePath] }),
          updatedManifest: addFileToManifest(acc.updatedManifest, outcome.relativePath, outcome.entry),
        };
      }
      return {
        result: mergeResult(acc.result, { errors: [`${outcome.relativePath}: ${outcome.msg}`] }),
        updatedManifest: acc.updatedManifest,
      };
    },
    { result: { ...EMPTY_RESULT }, updatedManifest: createEmptyManifest("0.0.0") },
  );

  return { result, updatedManifest };
}

/**
 * Reconciles an explicit list of bundled files against the manifest: new files are
 * installed, untouched files are refreshed, user-modified files are skipped (or backed up
 * and overwritten with --yolo). Entries already in the manifest but not in `files` are left
 * alone — this is the merge step `oac init` re-runs and `oac update` share.
 *
 * Does NOT write the manifest — caller is responsible.
 */
export async function syncFiles(
  files: string[],
  manifest: ManifestFile | null,
  options: InstallOptions,
): Promise<{ result: InstallResult; updatedManifest: ManifestFile }> {
  const timestamp = buildTimestamp();

  const outcomes = await Promise.all(
    files.map(async (relativePath) => {
      const sourcePath = getBundledFilePath(options.packageRoot, relativePath);
      const destPath = path.join(options.projectRoot, relativePath);
      const { patch, entry } = await processOneFile({
        relativePath,
        sourcePath,
        destPath,
        manifest,
        options,
        timestamp,
      });
      return { relativePath, patch, entry };
    }),
  );

  return outcomes.reduce(
    (acc, { relativePath, patch, entry }) => ({
      result: mergeResult(acc.result, patch),
      updatedManifest:
        entry !== null
          ? addFileToManifest(acc.updatedManifest, relativePath, entry)
          : acc.updatedManifest,
    }),
    {
      result: { ...EMPTY_RESULT } as InstallResult,
      updatedManifest: manifest ?? createEmptyManifest("0.0.0"),
    },
  );
}

/**
 * Implements the full OAC update algorithm:
 *
 * FOR each file in new bundle:
 *   - In manifest + hash matches disk → safe update
 *   - In manifest + hash differs → skip (or --yolo: backup + overwrite)
 *   - Not in manifest → install as new
 *
 * FOR each file in manifest NOT in new bundle:
 *   - Leave user's copy, remove from manifest, warn
 *
 * Does NOT write the manifest — caller is responsible.
 */
export async function updateFiles(
  options: InstallOptions,
): Promise<{ result: InstallResult; updatedManifest: ManifestFile }> {
  const manifest = await readManifest(options.projectRoot);
  const bundledFiles = await listBundledFiles(options.packageRoot);

  // Phase 1: reconcile every file in the new bundle
  const phase1 = await syncFiles(bundledFiles, manifest, options).then(
    ({ result, updatedManifest }) => ({ result, workingManifest: updatedManifest }),
  );

  // Phase 2: handle files in manifest that are no longer in the bundle
  const bundledSet = new Set(bundledFiles);
  const manifestPaths = Object.keys(phase1.workingManifest.files);

  const { result, updatedManifest } = manifestPaths.reduce(
    (acc, trackedPath) => {
      if (!bundledSet.has(trackedPath)) {
        process.stdout.write(
          `[oac] warn: "${trackedPath}" is no longer maintained by OAC — your copy is untouched\n`,
        );
        return {
          result: mergeResult(acc.result, { removed_from_manifest: [trackedPath] }),
          updatedManifest: removeFileFromManifest(acc.updatedManifest, trackedPath),
        };
      }
      return acc;
    },
    { result: phase1.result, updatedManifest: phase1.workingManifest },
  );

  return { result, updatedManifest };
}

/**
 * Returns true if `dir` contains a `package.json` or `.git` entry.
 * Used by `oac init` to validate we're operating in a project root.
 */
export async function isProjectRoot(dir: string): Promise<boolean> {
  const [hasPackageJson, hasGit] = await Promise.all([
    stat(path.join(dir, "package.json")).then((s) => s.isFile()).catch(() => false),
    // stat() works for both files (.git in worktrees) and directories (.git in normal repos)
    stat(path.join(dir, ".git")).then(() => true).catch(() => false),
  ]);
  return hasPackageJson || hasGit;
}
