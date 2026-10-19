import { DEFAULT_FLAVOR, toDestPath, V1_SOURCE_ROOT, type OpenCodeFlavor } from "./flavor.js";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
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

/**
 * Subdirectories under the package root that contain bundled OAC files for OpenCode v2.
 * There is no `tool/` or `plugin/` here on purpose: v2 never scans `.opencode/tool/` and does not
 * run v1 plugins (#367), so those ship only in the v1 build (`V1_BUNDLED_SUBDIRS`).
 */
const BUNDLED_SUBDIRS = [
  ".opencode/agent",
  ".opencode/command",
  ".opencode/context",
  ".opencode/skills",
] as const;

/** Root files that are deliberately safe to install into a user's project. */
/** The v1 build's counterparts: same layout, under the v1 source folder (see `./flavor.ts`). */
const V1_BUNDLED_SUBDIRS = [
  `${V1_SOURCE_ROOT}/agent`,
  `${V1_SOURCE_ROOT}/command`,
  `${V1_SOURCE_ROOT}/plugin`,
  `${V1_SOURCE_ROOT}/plugins`,
  `${V1_SOURCE_ROOT}/skills`,
  `${V1_SOURCE_ROOT}/tool`,
] as const;

const BUNDLED_ROOT_FILES = ["env.example"] as const;

/**
 * Local secrets and VCS ignore rules are neither installable OAC assets nor publishable files.
 * npm excludes them from tarballs, so excluding them at enumeration time keeps `full` aligned
 * with what an installed package can actually copy.
 */
const isNonInstallableBundleFile = (file: string): boolean => {
  const name = file.split("/").pop()!;
  return (
    name === ".gitignore" ||
    name === ".env" ||
    name.startsWith(".env.") ||
    name === "package.json"
  );
};

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
 * Recursively collects all file paths under `dir`, returning absolute paths.
 * `node_modules` is never part of an OAC bundle, even when nested in a tool.
 */
async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  const nested = await Promise.all(
    entries.filter((entry) => entry.name !== "node_modules").map((entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isSymbolicLink()) return Promise.resolve([]);
      if (entry.isDirectory()) return collectFiles(fullPath);
      return entry.isFile() ? Promise.resolve([fullPath]) : Promise.resolve([]);
    }),
  );

  return nested.flat().filter((file) => !isNonInstallableBundleFile(file));
}

/** Every installable file under `subdirs`, as package-relative paths. Missing dirs are skipped. */
async function collectSubdirs(packageRoot: string, subdirs: readonly string[]): Promise<string[]> {
  const results = await Promise.all(
    subdirs.map(async (subdir) => {
      const absSubdir = join(packageRoot, subdir);
      const exists = await stat(absSubdir).then((s) => s.isDirectory()).catch(() => false);
      if (!exists) return [];

      const absFiles = await collectFiles(absSubdir);
      return absFiles.map((absFile) => relative(packageRoot, absFile));
    }),
  );
  return results.flat();
}

/** Every `path` and `files[]` entry of a registry file, or an empty set when it cannot be read. */
async function registryPaths(packageRoot: string, file: string): Promise<Set<string>> {
  try {
    const raw = JSON.parse(await readFile(join(packageRoot, file), "utf8")) as {
      components?: Record<string, Array<{ path?: unknown; files?: unknown }>>;
    };
    const paths = Object.values(raw.components ?? {}).flatMap((entries) =>
      entries.flatMap((e) => [e.path, ...(Array.isArray(e.files) ? e.files : [])]),
    );
    return new Set(paths.filter((p): p is string => typeof p === "string"));
  } catch {
    return new Set();
  }
}

/**
 * Files that exist only for v2: registered by the v2 registry and not by the v1 one. These are
 * the flat generated agents; they must not be installed next to the v1 build's nested agents.
 */
async function v2OnlyPaths(packageRoot: string): Promise<Set<string>> {
  const [v2, v1] = await Promise.all([
    registryPaths(packageRoot, "registry.json"),
    registryPaths(packageRoot, "registry.v1.json"),
  ]);
  return new Set([...v2].filter((p) => !v1.has(p)));
}

/**
 * Lists every installable bundled file as package-relative SOURCE paths (installers map them to
 * their destination with `toDestPath`).
 *
 * v2 (the default) is the `.opencode/` tree. v1 is that tree minus the files only v2 uses, plus
 * everything under `v1-opencode/`; where both provide the same destination, v1 wins.
 * Allowlisted root files are included for both. Missing directories are silently skipped.
 */
export async function listBundledFiles(
  packageRoot: string,
  flavor: OpenCodeFlavor = DEFAULT_FLAVOR,
): Promise<string[]> {
  const rootFiles = await Promise.all(
    BUNDLED_ROOT_FILES.map(async (file) => {
      const filePath = join(packageRoot, file);
      return (await stat(filePath).then((s) => s.isFile()).catch(() => false)) ? [file] : [];
    }),
  );

  const shared = await collectSubdirs(packageRoot, BUNDLED_SUBDIRS);
  if (flavor === "v2") return [...shared, ...rootFiles.flat()].sort();

  const [v1Files, excluded] = await Promise.all([
    collectSubdirs(packageRoot, V1_BUNDLED_SUBDIRS),
    v2OnlyPaths(packageRoot),
  ]);
  const overridden = new Set(v1Files.map(toDestPath));
  const kept = shared.filter((file) => !excluded.has(file) && !overridden.has(file));
  return [...kept, ...v1Files, ...rootFiles.flat()].sort();
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
export const classifyBundledFile = (sourcePath: string): BundledFileType => {
  const relativePath = toDestPath(sourcePath);
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
