import path from 'node:path';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { z } from 'zod';

// ── Errors ────────────────────────────────────────────────────────────────────

export class ManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestError'
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MANIFEST_RELATIVE_PATH = '.oac/manifest.json';
const MANIFEST_VERSION = '1' as const;

// ── Schemas ───────────────────────────────────────────────────────────────────

export const ManifestFileTypeSchema = z.enum([
  'agent',
  'context',
  'skill',
  'config',
  'other',
]);

export const FileEntrySchema = z.object({
  sha256: z.string(),
  type: ManifestFileTypeSchema,
  source: z.enum(['bundled', 'registry', 'custom']),
  installedAt: z.string(),
  /** A pre-existing file observed by OAC but never installed or overwritten by it. */
  protected: z.boolean().default(false),
});

export const ManifestFileSchema = z.object({
  version: z.literal('1'),
  oacVersion: z.string(),
  installedAt: z.string(),
  updatedAt: z.string(),
  files: z.record(z.string(), FileEntrySchema),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type ManifestFileType = z.infer<typeof ManifestFileTypeSchema>;
/** `protected` remains optional in memory so existing callers can create legacy-compatible entries. */
export type FileEntry = Omit<z.infer<typeof FileEntrySchema>, 'protected'> & {
  protected?: boolean;
};
export type ManifestFile = Omit<z.infer<typeof ManifestFileSchema>, 'files'> & {
  files: Record<string, FileEntry>;
};

/**
 * The safe update scope for installs created before profiles were persisted.
 * The original tier is unknowable, so only already tracked paths are eligible.
 */
export type LegacyInstallationScope = {
  profile: null;
  contextOnly: boolean;
  profiles: [];
  files: string[];
};

// ── Path helpers ──────────────────────────────────────────────────────────────

/** Returns the absolute path to the manifest file for a given project root. */
export const getManifestPath = (projectRoot: string): string =>
  path.join(projectRoot, MANIFEST_RELATIVE_PATH);

// ── Pure constructors ─────────────────────────────────────────────────────────

/**
 * Creates a fresh empty manifest with no installed files.
 * Pure — no side effects.
 */
export const createEmptyManifest = (oacVersion: string): ManifestFile => {
  const now = new Date().toISOString();
  return {
    version: MANIFEST_VERSION,
    oacVersion,
    installedAt: now,
    updatedAt: now,
    files: {},
  };
};

/** Infers a non-expanding update scope from a legacy manifest. Pure. */
export const inferLegacyInstallationScope = (
  manifest: ManifestFile,
): LegacyInstallationScope => {
  const files = Object.keys(manifest.files).sort();
  return {
    profile: null,
    contextOnly: files.length > 0 && files.every((file) => file.startsWith('.opencode/context/')),
    profiles: [],
    files,
  };
};

// ── Pure transformers ─────────────────────────────────────────────────────────

/**
 * Returns a new manifest with the given file entry added or replaced.
 * Pure — does not mutate the input manifest.
 */
export const addFileToManifest = (
  manifest: ManifestFile,
  filePath: string,
  entry: FileEntry,
): ManifestFile => ({
  ...manifest,
  updatedAt: new Date().toISOString(),
  files: {
    ...manifest.files,
    [filePath]: entry,
  },
});

/**
 * Returns a new manifest with the given file entry removed.
 * Pure — does not mutate the input manifest.
 * No-op if the file is not present.
 */
export const removeFileFromManifest = (
  manifest: ManifestFile,
  filePath: string,
): ManifestFile => {
  const { [filePath]: _removed, ...remainingFiles } = manifest.files;
  return {
    ...manifest,
    updatedAt: new Date().toISOString(),
    files: remainingFiles,
  };
};

/**
 * Returns a new manifest with the SHA256 hash updated for an existing file.
 * Pure — does not mutate the input manifest.
 * Throws if the file is not tracked in the manifest.
 */
export const updateFileHash = (
  manifest: ManifestFile,
  filePath: string,
  sha256: string,
): ManifestFile => {
  const existing = manifest.files[filePath];
  if (existing === undefined) {
    throw new ManifestError(
      `Cannot update hash: "${filePath}" is not tracked in the manifest. ` +
        `Add it first with addFileToManifest.`,
    );
  }
  return {
    ...manifest,
    updatedAt: new Date().toISOString(),
    files: {
      ...manifest.files,
      [filePath]: { ...existing, sha256 },
    },
  };
};

// ── I/O ───────────────────────────────────────────────────────────────────────

/**
 * Reads and validates the manifest from {projectRoot}/.oac/manifest.json.
 * Returns null if the file does not exist.
 * Throws a ZodError with a clear message if the JSON is present but invalid.
 */
export const readManifest = async (
  projectRoot: string,
): Promise<ManifestFile | null> => {
  const manifestPath = getManifestPath(projectRoot);

  const exists = await stat(manifestPath).then((s) => s.isFile()).catch(() => false);
  if (!exists) {
    return null;
  }

  const raw: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));

  const result = ManifestFileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new ManifestError(
      `Invalid manifest at ${manifestPath}:\n${issues}\n` +
        `Run 'oac init' to reset your manifest, or fix the JSON manually.`,
    );
  }

  return result.data;
};

/**
 * Writes the manifest to {projectRoot}/.oac/manifest.json.
 * Creates the .oac/ directory if it does not exist.
 */
export const writeManifest = async (
  projectRoot: string,
  manifest: ManifestFile,
): Promise<void> => {
  const manifestPath = getManifestPath(projectRoot);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
};
