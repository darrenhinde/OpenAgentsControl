import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installFile, backupFile, installFiles } from './installer.js';
import { computeFileHash } from './sha256.js';
import type { InstallOptions } from './installer.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeOptions = (
  projectRoot: string,
  packageRoot: string,
  overrides: Partial<InstallOptions> = {},
): InstallOptions => ({
  projectRoot,
  packageRoot,
  dryRun: false,
  yolo: false,
  verbose: false,
  ...overrides,
});

// ── installFile ───────────────────────────────────────────────────────────────

describe('installFile', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-installer-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('copies source file to dest, creating parent dirs', async () => {
    const srcPath = join(tmpDir, 'source.txt');
    const destPath = join(tmpDir, 'nested', 'deep', 'dest.txt');
    await writeFile(srcPath, 'hello installer', 'utf8');

    const opts = makeOptions(tmpDir, tmpDir);
    await installFile(srcPath, destPath, opts);

    const destFile = Bun.file(destPath);
    expect(await destFile.exists()).toBe(true);
    expect(await destFile.text()).toBe('hello installer');
  });

  test('in dry-run mode, does NOT create the dest file', async () => {
    const srcPath = join(tmpDir, 'dry-source.txt');
    const destPath = join(tmpDir, 'dry-dest', 'file.txt');
    await writeFile(srcPath, 'dry run content', 'utf8');

    const opts = makeOptions(tmpDir, tmpDir, { dryRun: true });
    await installFile(srcPath, destPath, opts);

    expect(await Bun.file(destPath).exists()).toBe(false);
  });

  test('overwrites an existing dest file', async () => {
    const srcPath = join(tmpDir, 'overwrite-src.txt');
    const destPath = join(tmpDir, 'overwrite-dest.txt');
    await writeFile(srcPath, 'new content', 'utf8');
    await writeFile(destPath, 'old content', 'utf8');

    const opts = makeOptions(tmpDir, tmpDir);
    await installFile(srcPath, destPath, opts);

    expect(await Bun.file(destPath).text()).toBe('new content');
  });
});

// ── backupFile ────────────────────────────────────────────────────────────────

describe('backupFile', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-backup-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('creates a backup copy and returns its path', async () => {
    const filePath = join(tmpDir, 'original.txt');
    await writeFile(filePath, 'backup me', 'utf8');

    const backupPath = await backupFile(filePath, tmpDir);

    expect(await Bun.file(backupPath).exists()).toBe(true);
    expect(await Bun.file(backupPath).text()).toBe('backup me');
  });

  test('backup path is inside .oac/backups/', async () => {
    const filePath = join(tmpDir, 'another.txt');
    await writeFile(filePath, 'content', 'utf8');

    const backupPath = await backupFile(filePath, tmpDir);

    expect(backupPath).toContain('.oac/backups/');
  });

  test('original file is unchanged after backup', async () => {
    const filePath = join(tmpDir, 'unchanged.txt');
    await writeFile(filePath, 'original content', 'utf8');

    await backupFile(filePath, tmpDir);

    expect(await Bun.file(filePath).text()).toBe('original content');
  });
});

// ── installFiles (dry-run) ────────────────────────────────────────────────────

describe('installFiles (dry-run)', () => {
  let projectRoot: string;
  let packageRoot: string;

  beforeAll(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'oac-install-project-'));
    packageRoot = await mkdtemp(join(tmpdir(), 'oac-install-package-'));

    // Create a fake bundled files directory structure
    await mkdir(join(packageRoot, '.opencode', 'agent'), { recursive: true });
    await writeFile(
      join(packageRoot, '.opencode', 'agent', 'test-agent.md'),
      '# Test Agent',
      'utf8',
    );
  });

  afterAll(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(packageRoot, { recursive: true, force: true });
  });

  test('dry-run: returns installed list without writing files', async () => {
    const opts = makeOptions(projectRoot, packageRoot, { dryRun: true });
    const files = ['.opencode/agent/test-agent.md'];

    const { result } = await installFiles(files, opts);

    // In dry-run, files are "installed" in the result but not on disk
    expect(result.installed).toContain('.opencode/agent/test-agent.md');
    expect(result.errors).toHaveLength(0);
    expect(await Bun.file(join(projectRoot, '.opencode/agent/test-agent.md')).exists()).toBe(false);
  });
});

// ── installFiles (real write) ─────────────────────────────────────────────────

describe('installFiles (real write)', () => {
  let projectRoot: string;
  let packageRoot: string;

  beforeAll(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'oac-install-real-project-'));
    packageRoot = await mkdtemp(join(tmpdir(), 'oac-install-real-package-'));

    await mkdir(join(packageRoot, '.opencode', 'context'), { recursive: true });
    await writeFile(
      join(packageRoot, '.opencode', 'context', 'standards.md'),
      '# Standards',
      'utf8',
    );
  });

  afterAll(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(packageRoot, { recursive: true, force: true });
  });

  test('installs files to project root and records sha256', async () => {
    const opts = makeOptions(projectRoot, packageRoot);
    const files = ['.opencode/context/standards.md'];

    const { result, updatedManifest } = await installFiles(files, opts);

    expect(result.installed).toContain('.opencode/context/standards.md');
    expect(result.errors).toHaveLength(0);

    const destPath = join(projectRoot, '.opencode/context/standards.md');
    expect(await Bun.file(destPath).exists()).toBe(true);
    expect(await Bun.file(destPath).text()).toBe('# Standards');

    // Manifest entry should have a valid sha256
    const entry = updatedManifest.files['.opencode/context/standards.md'];
    expect(entry).toBeDefined();
    expect(entry?.sha256).toHaveLength(64);

    // sha256 in manifest should match actual file
    const actualHash = await computeFileHash(destPath);
    expect(entry?.sha256).toBe(actualHash);
  });
});

describe('installFiles destination boundary', () => {
  test('refuses traversal and absolute paths without writing outside the project', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'oac-boundary-project-'));
    const packageRoot = await mkdtemp(join(tmpdir(), 'oac-boundary-package-'));
    const escapedPath = join(projectRoot, '..', 'escape.md');

    try {
      const { result } = await installFiles(['.opencode/../escape.md', escapedPath], makeOptions(projectRoot, packageRoot));

      expect(result.errors).toHaveLength(2);
      expect(await Bun.file(escapedPath).exists()).toBe(false);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
      await rm(packageRoot, { recursive: true, force: true });
    }
  });
});

describe('installFiles over an unmanaged tree', () => {
  let projectRoot: string;
  let packageRoot: string;
  const relativePath = '.opencode/context/core/standards.md';

  beforeAll(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), 'oac-unmanaged-project-'));
    packageRoot = await mkdtemp(join(tmpdir(), 'oac-unmanaged-package-'));
    await mkdir(join(packageRoot, '.opencode', 'context', 'core'), { recursive: true });
    await mkdir(join(projectRoot, '.opencode', 'context', 'core'), { recursive: true });
    await writeFile(join(packageRoot, relativePath), '# Bundled standards', 'utf8');
    await writeFile(join(projectRoot, relativePath), '# User standards', 'utf8');
  });

  afterAll(async () => {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(packageRoot, { recursive: true, force: true });
  });

  test('preserves an unmanaged file and records protected ownership', async () => {
    const { result, updatedManifest } = await installFiles([relativePath], makeOptions(projectRoot, packageRoot));

    expect(result.skipped).toEqual([relativePath]);
    expect(await Bun.file(join(projectRoot, relativePath)).text()).toBe('# User standards');
    expect(updatedManifest.files[relativePath]).toMatchObject({ source: 'custom', protected: true });
  });

  test('backs up an unmanaged file before yolo overwrites it', async () => {
    const { result } = await installFiles([relativePath], makeOptions(projectRoot, packageRoot, { yolo: true }));

    expect(result.backed_up).toHaveLength(1);
    expect(await Bun.file(join(projectRoot, relativePath)).text()).toBe('# Bundled standards');
    expect(await Bun.file(result.backed_up[0]!).text()).toBe('# User standards');
  });
});
