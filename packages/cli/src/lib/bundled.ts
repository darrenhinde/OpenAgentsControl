import { existsSync, readFileSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// --- Types ---

/** The category of a bundled file, inferred from its path prefix. */
export type BundledFileType =
  | "agent"
  | "context"
  | "skill"
  | "command"
  | "tool"
  | "plugin"
  | "config";

/**
 * What the manifest records for a bundled file. The manifest's vocabulary is narrower than
 * the bundle's (it predates commands, tools and plugins), so those fold into "other".
 */
export type ManifestType = "agent" | "context" | "skill" | "config" | "other";

// --- Constants ---

/** Subdirectories under the package root that contain bundled OAC files. */
const BUNDLED_SUBDIRS = [
  ".opencode/agent",
  ".opencode/context",
  ".opencode/skills",
] as const;

// --- Package root resolution ---

/**
 * Walks up the directory tree from `startDir` until it finds a directory
 * that contains both `.opencode/` and `package.json` — the npm package root.
 *
 * Works in both development (monorepo) and when installed via npm.
 */
export function getPackageRoot(): string {
  // Allow dev/monorepo override via environment variable.
  // In production (npm install), OAC_PACKAGE_ROOT is not set so the walk runs as before.
  // In dev, set OAC_PACKAGE_ROOT=/path/to/repo to bypass the walk entirely.
  const envOverride = process.env['OAC_PACKAGE_ROOT'];
  if (envOverride) {
    return envOverride;
  }
  // Resolves to packages/cli/dist/ at runtime — the ESM equivalent of __dirname.
  return findPackageRoot(dirname(fileURLToPath(import.meta.url)));
}

/** The published package whose root holds the bundled `.opencode/` tree. */
const PACKAGE_NAME = "@controlstack/oac";

/**
 * Returns true when `dir` is the root of the OAC package itself — i.e. it holds
 * a `package.json` whose `name` is exactly {@link PACKAGE_NAME}.
 *
 * The name is the only reliable anchor. Structural heuristics do not survive both
 * layouts: an earlier version required `.opencode/` + `package.json` and the ABSENCE
 * of `registry.json` (to skip the monorepo root in dev), but the published tarball
 * ships `registry.json` NEXT TO `.opencode/` at its root — so that rule rejected the
 * very directory it needed to find, and `oac init` could not locate its bundled files
 * on a real `npm i -g` install.
 */
function isPackageRoot(dir: string): boolean {
  const packageJsonPath = join(dir, "package.json");
  if (!existsSync(packageJsonPath)) return false;

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: unknown };
    return parsed.name === PACKAGE_NAME;
  } catch {
    // Unreadable or malformed package.json — not a match; keep walking.
    return false;
  }
}

/**
 * Synchronously walks up from `dir` until it finds the OAC package root, as
 * identified by {@link isPackageRoot}. Works identically in the monorepo (where
 * the repo root is the package) and in an installed tree.
 *
 * Throws if the filesystem root is reached without finding a match.
 *
 * Pure in intent — no side effects beyond filesystem reads.
 */
export function findPackageRoot(dir: string): string {
  let current = dir;

  while (true) {
    if (isPackageRoot(current)) {
      return current;
    }

    const parent = join(current, "..");
    // Reached filesystem root — no package root found
    if (parent === current) {
      throw new Error(
        `getPackageRoot: could not find the "${PACKAGE_NAME}" package root ` +
          `walking up from "${dir}". ` +
          `Is ${PACKAGE_NAME} installed correctly? ` +
          `In dev/monorepo mode, set OAC_PACKAGE_ROOT env var to the repo root.`,
      );
    }
    current = parent;
  }
}

// --- Path helpers ---

/**
 * Returns the absolute path to a bundled file given the package root and a
 * relative path (e.g. `.opencode/agent/core/openagent.md`).
 *
 * Pure function — no I/O.
 */
export const getBundledFilePath = (
  packageRoot: string,
  relativePath: string,
): string => join(packageRoot, relativePath);

// --- File enumeration ---

/**
 * Recursively collects all file paths under `dir`, returning them as
 * absolute paths. Directories are not included in the result.
 */
async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(dir, entry.name);
      return entry.isDirectory() ? collectFiles(fullPath) : Promise.resolve([fullPath]);
    }),
  );

  return nested.flat();
}

/**
 * Lists all files under `.opencode/agent/`, `.opencode/context/`, and
 * `.opencode/skills/` within the given package root.
 *
 * Returns relative paths like `.opencode/agent/core/openagent.md`.
 * Subdirectories that do not exist are silently skipped.
 */
export async function listBundledFiles(packageRoot: string): Promise<string[]> {
  const results = await Promise.all(
    BUNDLED_SUBDIRS.map(async (subdir) => {
      const absSubdir = join(packageRoot, subdir);
      const exists = await stat(absSubdir).then((s) => s.isDirectory()).catch(() => false);
      if (!exists) return [];

      const absFiles = await collectFiles(absSubdir);
      return absFiles.map((absFile) => relative(packageRoot, absFile));
    }),
  );

  return results.flat();
}

// --- Existence check ---

/**
 * Returns true if the bundled file at `relativePath` exists within the
 * given package root.
 */
export const bundledFileExists = async (
  packageRoot: string,
  relativePath: string,
): Promise<boolean> =>
  stat(getBundledFilePath(packageRoot, relativePath))
    .then((s) => s.isFile())
    .catch(() => false);

// --- Classification ---

/**
 * Infers the BundledFileType from a relative path prefix.
 *
 * - `.opencode/agent/...`   → "agent"
 * - `.opencode/context/...` → "context"
 * - `.opencode/skills/...`  → "skill"
 * - `.opencode/command/...` → "command"
 * - `.opencode/tool/...`    → "tool"
 * - `.opencode/plugin/...`  → "plugin"
 * - anything else           → "config"
 *
 * Pure function — no I/O.
 */
export const classifyBundledFile = (relativePath: string): BundledFileType => {
  if (relativePath.startsWith(".opencode/agent/")) return "agent";
  if (relativePath.startsWith(".opencode/context/")) return "context";
  if (relativePath.startsWith(".opencode/skills/")) return "skill";
  if (relativePath.startsWith(".opencode/command/")) return "command";
  if (relativePath.startsWith(".opencode/tool/")) return "tool";
  if (relativePath.startsWith(".opencode/plugin/")) return "plugin";
  return "config";
};

/**
 * Maps a bundled-file kind (or a registry component type) onto the manifest's vocabulary.
 * Pure function — no I/O.
 */
export const toManifestType = (kind: string): ManifestType => {
  switch (kind) {
    case "agent":
    case "subagent":
      return "agent";
    case "context":
      return "context";
    case "skill":
      return "skill";
    case "config":
      return "config";
    default:
      return "other";
  }
};
