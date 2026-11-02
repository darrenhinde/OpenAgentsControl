import path from "node:path";
import { copyFile, mkdir, readdir, rmdir, rm, stat } from "node:fs/promises";
import { DEFAULT_FLAVOR, toDestPath, type OpenCodeFlavor } from "./flavor.js";
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
import { isInstallablePath } from "./registry.js";

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
  /** Ownership recorded for files copied through this synchronization path. */
  source?: FileEntry["source"];
  /** Which OpenCode build the bundle is read as (default v2). `updateFiles` only. */
  flavor?: OpenCodeFlavor;
  /**
   * Remove OAC-owned files that belong to the other layout (nested v1 agents, tools, plugins).
   * Set only when an install is deliberately moved between flavors. `updateFiles` only.
   */
  pruneStale?: boolean;
  /**
   * With `pruneStale`: the flavor being left. Files its bundle ships that sit in a flavor-sensitive
   * directory, are absent from the new bundle and are not in the manifest (for example agents an
   * `install.sh` run placed that the CLI's profile does not know) are pruned too. `updateFiles` only.
   */
  previousFlavor?: OpenCodeFlavor;
};

export type InstallResult = {
  /** Relative paths of files newly installed (not previously in manifest). */
  installed: string[];
  /** Relative paths of files updated (were untouched by user). */
  updated: string[];
  /** Relative paths of managed files whose content already matches the bundle (nothing written). */
  unchanged: string[];
  /** Relative paths of files skipped because user modified them. */
  skipped: string[];
  /** Relative paths of files backed up before yolo overwrite. */
  backed_up: string[];
  /** Relative paths removed from manifest (no longer in bundle). */
  removed_from_manifest: string[];
  /** Relative paths of OAC-owned files removed because they belong to the other layout. */
  pruned: string[];
  /** Human-readable error messages for any failures. */
  errors: string[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_RESULT: InstallResult = {
  installed: [],
  updated: [],
  unchanged: [],
  skipped: [],
  backed_up: [],
  removed_from_manifest: [],
  pruned: [],
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
  unchanged: [...base.unchanged, ...(patch.unchanged ?? [])],
  skipped: [...base.skipped, ...(patch.skipped ?? [])],
  backed_up: [...base.backed_up, ...(patch.backed_up ?? [])],
  removed_from_manifest: [
    ...base.removed_from_manifest,
    ...(patch.removed_from_manifest ?? []),
  ],
  pruned: [...base.pruned, ...(patch.pruned ?? [])],
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
  | { action: "protect"; observedHash: string }
  | { action: "adopt"; hash: string }
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
  sourcePath: string,
): Promise<FileDecision> {
  const manifestEntry = manifest?.files[relativePath];
  const diskExists = await stat(destPath).then((s) => s.isFile()).catch(() => false);

  // An unmanaged tree belongs to the user. Record, but never overwrite, its files.
  if (manifestEntry === undefined) {
    if (!diskExists) return { action: "install" };
    // Byte-identical to the bundle (for example placed by install.sh): OAC's own file, not the user's.
    const observedHash = await computeFileHash(destPath);
    if (hashesMatch(observedHash, await computeFileHash(sourcePath))) return { action: "adopt", hash: observedHash };
    if (options.yolo) return { action: "yolo-overwrite", backupNeeded: true };
    return { action: "protect", observedHash };
  }

  if (manifestEntry.protected === true) {
    // Heals a manifest written before adoption existed: identical to the bundle means not custom.
    if (diskExists) {
      const observedHash = await computeFileHash(destPath);
      if (hashesMatch(observedHash, await computeFileHash(sourcePath))) return { action: "adopt", hash: observedHash };
    }
    if (options.yolo && diskExists) return { action: "yolo-overwrite", backupNeeded: true };
    return {
      action: "skip",
      reason: `${relativePath} existed before OAC managed it — skipping (use --yolo to overwrite)`,
    };
  }

  // File is in the manifest and was installed by OAC.
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
      return { ok: true as const, value: await decideFileAction(relativePath, manifest, destPath, options, sourcePath) };
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
  const managedSource = options.source ?? "bundled";

  try {
    if (decision.action === "install") {
      log(options, `install: ${relativePath}`);
      await installFile(sourcePath, destPath, options);
      const sha256 = options.dryRun ? "" : await computeFileHash(destPath);
      const entry: FileEntry = {
        sha256,
        type: fileType,
        source: managedSource,
        installedAt: now,
      };
      return { patch: { installed: [relativePath] }, entry };
    }

    if (decision.action === "adopt") {
      log(options, `adopt: ${relativePath} already matches the bundle`);
      const existingEntry = manifest?.files[relativePath];
      const entry: FileEntry = {
        ...(existingEntry ?? {}),
        sha256: decision.hash,
        type: fileType,
        source: managedSource,
        installedAt: existingEntry?.installedAt ?? now,
        protected: false,
      };
      return { patch: { unchanged: [relativePath] }, entry };
    }

    if (decision.action === "protect") {
      log(options, `skip: ${relativePath} existed before OAC managed it`);
      const entry: FileEntry = {
        sha256: decision.observedHash,
        type: fileType,
        source: "custom",
        installedAt: now,
        protected: true,
      };
      return { patch: { skipped: [relativePath] }, entry };
    }

    if (decision.action === "update") {
      // Untouched by the user and already identical to the bundle: nothing to write or report.
      if (hashesMatch(await computeFileHash(sourcePath), await computeFileHash(destPath))) {
        return { patch: { unchanged: [relativePath] }, entry: manifest?.files[relativePath] ?? null };
      }
      log(options, `update: ${relativePath}`);
      await installFile(sourcePath, destPath, options);
      const sha256 = options.dryRun ? "" : await computeFileHash(destPath);
      const existingEntry = manifest?.files[relativePath];
      const entry: FileEntry = existingEntry === undefined
        ? { sha256, type: fileType, source: managedSource, installedAt: now }
        : { ...existingEntry, sha256, protected: false };
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
      const existingEntry = manifest?.files[relativePath];
      const entry: FileEntry = existingEntry === undefined
        ? { sha256, type: fileType, source: managedSource, installedAt: now, protected: false }
        : { ...existingEntry, sha256, source: managedSource, protected: false };
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
 * Used by `oac init` for a fresh install. Existing destination files are treated as
 * user-owned and recorded as protected unless --yolo is explicitly requested.
 *
 * Does NOT write the manifest — caller is responsible.
 */
export async function installFiles(
  files: string[],
  options: InstallOptions,
): Promise<{ result: InstallResult; updatedManifest: ManifestFile }> {
  return syncFiles(files, null, options);
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
  const rejectedPaths = files.filter((relativePath) => !isInstallablePath(relativePath));
  const installableFiles = files.filter(isInstallablePath);

  const outcomes = await Promise.all(
    installableFiles.map(async (sourceRelative) => {
      // The manifest, backups and user-facing messages all speak in DESTINATION paths: a file
      // from the v1 source folder is recorded where it lands, so the folder name never leaks.
      const relativePath = toDestPath(sourceRelative);
      const sourcePath = getBundledFilePath(options.packageRoot, sourceRelative);
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
      result: {
        ...EMPTY_RESULT,
        errors: rejectedPaths.map((relativePath) => `Refusing unsafe destination path: ${relativePath}`),
      } as InstallResult,
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
  eligibleFiles?: readonly string[],
): Promise<{ result: InstallResult; updatedManifest: ManifestFile }> {
  const manifest = await readManifest(options.projectRoot);
  const bundledFiles = await listBundledFiles(options.packageRoot, options.flavor ?? DEFAULT_FLAVOR);
  const isScopeRestricted = eligibleFiles !== undefined;
  const eligibleSet = new Set(eligibleFiles ?? bundledFiles);
  const filesToSync = bundledFiles.filter((file) => eligibleSet.has(file));

  // Phase 1: reconcile only the caller-authorized portion of the bundle.
  const phase1 = await syncFiles(filesToSync, manifest, options).then(
    ({ result, updatedManifest }) => ({ result, workingManifest: updatedManifest }),
  );

  // Phase 2: handle files in manifest that are no longer in the bundle. The manifest is keyed by
  // destination path, so the bundle is compared as destinations too.
  const bundledSet = new Set(filesToSync.map(toDestPath));
  const wholeBundle = new Set(bundledFiles.map(toDestPath));
  const eligibleDest = new Set([...eligibleSet].map(toDestPath));
  const timestamp = buildTimestamp();
  let acc = { result: phase1.result, updatedManifest: phase1.workingManifest };
  // Hashes of the bundle being left, so a file tracked as custom that is still byte-identical to it
  // (not an edit of the user's) can be pruned like any other previous-flavor file.
  const previousHashes = new Map<string, string>();
  if (options.pruneStale === true && options.previousFlavor !== undefined && options.previousFlavor !== (options.flavor ?? DEFAULT_FLAVOR)) {
    for (const source of await listBundledFiles(options.packageRoot, options.previousFlavor)) {
      previousHashes.set(toDestPath(source), await computeFileHash(getBundledFilePath(options.packageRoot, source)));
    }
  }

  for (const trackedPath of Object.keys(phase1.workingManifest.files)) {
    if (bundledSet.has(trackedPath)) continue;

    let entry = phase1.workingManifest.files[trackedPath]!;
    if (options.pruneStale === true && (entry.source === "custom" || entry.protected === true)) {
      const previous = previousHashes.get(trackedPath);
      const absolute = path.join(options.projectRoot, trackedPath);
      if (previous !== undefined && (await stat(absolute).then((s) => s.isFile()).catch(() => false)) &&
          hashesMatch(await computeFileHash(absolute), previous)) {
        entry = { ...entry, source: "bundled", protected: false, sha256: previous };
      }
    }
    if (options.pruneStale === true && isPrunable(trackedPath, entry, wholeBundle)) {
      const patch = await pruneFile(trackedPath, entry, options, timestamp);
      acc = {
        result: mergeResult(acc.result, patch),
        updatedManifest: removeFileFromManifest(acc.updatedManifest, trackedPath),
      };
      continue;
    }

    // An unscoped update owns every bundled path, so it retains the historic removal behavior.
    // A profile-scoped update must retain entries belonging to another selected (or previously
    // selected) profile.
    if (!isScopeRestricted || eligibleDest.has(trackedPath)) {
      process.stdout.write(
        `[oac] warn: "${trackedPath}" is no longer maintained by OAC — your copy is untouched\n`,
      );
      acc = {
        result: mergeResult(acc.result, { removed_from_manifest: [trackedPath] }),
        updatedManifest: removeFileFromManifest(acc.updatedManifest, trackedPath),
      };
    }
  }

  if (options.pruneStale === true && options.previousFlavor !== undefined && options.previousFlavor !== (options.flavor ?? DEFAULT_FLAVOR)) {
    const tracked = new Set(Object.keys(manifest?.files ?? {}));
    const previous = await listBundledFiles(options.packageRoot, options.previousFlavor);
    for (const source of previous) {
      const dest = toDestPath(source);
      if (wholeBundle.has(dest) || tracked.has(dest) || !isInstallablePath(source)) continue;
      if (!FLAVOR_SENSITIVE_PREFIXES.some((prefix) => dest.startsWith(prefix))) continue;
      const absolute = path.join(options.projectRoot, dest);
      if (!(await stat(absolute).then((s) => s.isFile()).catch(() => false))) continue;
      // Not tracked, so there is no recorded hash: compare with the previous bundle's own copy.
      // Identical -> removed; edited -> backed up first (same rule as a tracked file).
      const sha256 = await computeFileHash(getBundledFilePath(options.packageRoot, source));
      const patch = await pruneFile(dest, { sha256 } as FileEntry, options, timestamp);
      acc = { ...acc, result: mergeResult(acc.result, patch) };
    }
  }

  return acc;
}

// ── Pruning (moving an install between OpenCode layouts) ──────────────────────

/** The directories whose contents differ by flavor, and so the only ones a migration may prune. */
const FLAVOR_SENSITIVE_PREFIXES = [
  ".opencode/agent/",
  ".opencode/tool/",
  ".opencode/plugin/",
  ".opencode/plugins/",
] as const;

/**
 * True when a tracked file may be removed during a flavor move: OAC installed it (not custom,
 * not a pre-existing file OAC merely observed), it sits in a flavor-sensitive directory, and
 * the target flavor's bundle no longer ships that destination. Pure.
 */
const isPrunable = (trackedPath: string, entry: FileEntry, targetBundle: ReadonlySet<string>): boolean =>
  entry.source !== "custom" &&
  entry.protected !== true &&
  FLAVOR_SENSITIVE_PREFIXES.some((prefix) => trackedPath.startsWith(prefix)) &&
  !targetBundle.has(trackedPath);

/**
 * Removes one stale OAC-owned file. A file the user edited is copied to `.oac/backups/` first, so
 * nothing is lost and no stale agent is left next to its replacement (OpenCode v2 would load both).
 */
async function pruneFile(
  trackedPath: string,
  entry: FileEntry,
  options: InstallOptions,
  timestamp: string,
): Promise<Partial<InstallResult>> {
  const absolute = path.join(options.projectRoot, trackedPath);
  const onDisk = await stat(absolute).then((s) => s.isFile()).catch(() => false);
  if (!onDisk) return { pruned: [trackedPath] };

  try {
    const untouched = hashesMatch(await computeFileHash(absolute), entry.sha256);
    if (options.dryRun) {
      log(options, `[dry-run] would remove: ${trackedPath}${untouched ? "" : " (after backing it up)"}`);
      return { pruned: [trackedPath] };
    }
    const backed_up: string[] = [];
    if (!untouched) {
      const backupPath = buildBackupPath(options.projectRoot, timestamp, trackedPath);
      await copyFileCreatingDirs(absolute, backupPath);
      backed_up.push(backupPath);
    }
    await rm(absolute);
    await removeEmptyParents(options.projectRoot, absolute);
    log(options, `remove: ${trackedPath}`);
    return { pruned: [trackedPath], backed_up };
  } catch (err) {
    return { errors: [`${trackedPath}: ${err instanceof Error ? err.message : String(err)}`] };
  }
}

/** Removes now-empty directories above `file`, stopping at (and never removing) `.opencode`. */
async function removeEmptyParents(projectRoot: string, file: string): Promise<void> {
  const stop = path.join(projectRoot, ".opencode");
  let dir = path.dirname(file);
  while (dir.startsWith(stop + path.sep)) {
    const entries = await readdir(dir).catch(() => null);
    if (entries === null || entries.length > 0) return;
    await rmdir(dir);
    dir = path.dirname(dir);
  }
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
