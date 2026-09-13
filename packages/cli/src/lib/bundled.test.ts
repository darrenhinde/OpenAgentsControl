import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import {
  classifyBundledFile,
  findPackageRoot,
  getBundledFilePath,
  listBundledFiles,
  bundledFileExists,
  type BundledFileType,
  toManifestType,
} from './bundled.js';

const execFile = promisify(execFileCallback);
const PACKAGE_ROOT = join(import.meta.dir, '../../../../');

// ── classifyBundledFile ───────────────────────────────────────────────────────
// Pure function — no I/O, no setup needed.

describe('classifyBundledFile', () => {
  // ✅ Positive: agent prefix
  test('returns "agent" for .opencode/agent/ paths', () => {
    // Arrange
    const path = '.opencode/agent/core/openagent.md';
    // Act
    const result: BundledFileType = classifyBundledFile(path);
    // Assert
    expect(result).toBe('agent');
  });

  // ✅ Positive: agent prefix — nested deeply
  test('returns "agent" for deeply nested agent paths', () => {
    expect(classifyBundledFile('.opencode/agent/sub/dir/file.md')).toBe('agent');
  });

  // ✅ Positive: context prefix
  test('returns "context" for .opencode/context/ paths', () => {
    expect(classifyBundledFile('.opencode/context/standards.md')).toBe('context');
  });

  // ✅ Positive: context prefix — nested
  test('returns "context" for nested context paths', () => {
    expect(classifyBundledFile('.opencode/context/sub/file.md')).toBe('context');
  });

  // ✅ Positive: skill prefix
  test('returns "skill" for .opencode/skills/ paths', () => {
    expect(classifyBundledFile('.opencode/skills/my-skill.md')).toBe('skill');
  });

  // ✅ Positive: skill prefix — nested
  test('returns "skill" for nested skills paths', () => {
    expect(classifyBundledFile('.opencode/skills/category/skill.md')).toBe('skill');
  });

  // ✅ Positive: config fallback — arbitrary path
  test('returns "config" for unrecognised paths', () => {
    expect(classifyBundledFile('some/other/file.json')).toBe('config');
  });

  // ✅ Positive: config fallback — root-level file
  test('returns "config" for a root-level file', () => {
    expect(classifyBundledFile('README.md')).toBe('config');
  });

  // ❌ Negative: path that starts with .opencode/ but not a known subdir
  test('returns "config" for .opencode/ paths with unknown subdir', () => {
    expect(classifyBundledFile('.opencode/unknown/file.md')).toBe('config');
  });

  // ❌ Negative: partial prefix match should NOT classify as agent
  test('returns "config" for path that only partially matches agent prefix', () => {
    // ".opencode/agentX/" is NOT ".opencode/agent/"
    expect(classifyBundledFile('.opencode/agentX/file.md')).toBe('config');
  });

  // ❌ Negative: partial prefix match should NOT classify as context
  test('returns "config" for path that only partially matches context prefix', () => {
    expect(classifyBundledFile('.opencode/contexts/file.md')).toBe('config');
  });

  // ❌ Negative: empty string
  test('returns "config" for an empty string', () => {
    expect(classifyBundledFile('')).toBe('config');
  });
});

// ── getBundledFilePath ────────────────────────────────────────────────────────
// Pure function — no I/O.

describe('getBundledFilePath', () => {
  // ✅ Positive: joins packageRoot and relativePath
  test('joins packageRoot and relativePath correctly', () => {
    // Arrange
    const packageRoot = '/usr/local/lib/oac';
    const relativePath = '.opencode/agent/core/openagent.md';
    // Act
    const result = getBundledFilePath(packageRoot, relativePath);
    // Assert
    expect(result).toBe('/usr/local/lib/oac/.opencode/agent/core/openagent.md');
  });

  // ✅ Positive: works with nested relative paths
  test('handles nested relative paths', () => {
    const result = getBundledFilePath('/root', '.opencode/skills/sub/skill.md');
    expect(result).toBe('/root/.opencode/skills/sub/skill.md');
  });

  // ❌ Negative: empty relative path returns just the packageRoot
  test('returns packageRoot when relativePath is empty', () => {
    const result = getBundledFilePath('/root', '');
    expect(result).toBe('/root');
  });
});

// ── findPackageRoot ───────────────────────────────────────────────────────────

describe('findPackageRoot', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-bundled-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  /** Writes a package.json with the given name at `dir`. */
  const writePackageJson = async (dir: string, name: string): Promise<void> => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name }), 'utf8');
  };

  // ✅ Positive: finds the directory whose package.json name is @controlstack/oac
  test('returns the directory whose package.json is named @controlstack/oac', async () => {
    // Arrange — create a fake package root
    const fakeRoot = join(tmpDir, 'fake-pkg');
    await mkdir(join(fakeRoot, '.opencode'), { recursive: true });
    await writePackageJson(fakeRoot, '@controlstack/oac');
    // Also create a subdirectory to start the walk from
    const startDir = join(fakeRoot, 'dist', 'lib');
    await mkdir(startDir, { recursive: true });

    // Act
    const result = findPackageRoot(startDir);

    // Assert
    expect(result).toBe(fakeRoot);
  });

  // ✅ Positive: finds root when starting exactly at the package root
  test('returns the start directory itself when it is the package root', async () => {
    // Arrange
    const fakeRoot = join(tmpDir, 'exact-root');
    await mkdir(join(fakeRoot, '.opencode'), { recursive: true });
    await writePackageJson(fakeRoot, '@controlstack/oac');

    // Act
    const result = findPackageRoot(fakeRoot);

    // Assert
    expect(result).toBe(fakeRoot);
  });

  // ✅ Regression: the published tarball ships registry.json NEXT TO .opencode/ at
  // the package root. The previous heuristic excluded any directory containing a
  // registry.json, so it walked straight past the real root and `oac init` failed
  // on every `npm i -g` install. The root must still be found.
  test('finds the package root even when registry.json sits beside .opencode/', async () => {
    // Arrange — mirror the installed layout exactly
    const installedRoot = join(tmpDir, 'installed-pkg');
    await mkdir(join(installedRoot, '.opencode', 'agent'), { recursive: true });
    await writePackageJson(installedRoot, '@controlstack/oac');
    await writeFile(join(installedRoot, 'registry.json'), '{"components":[]}', 'utf8');
    const startDir = join(installedRoot, 'packages', 'cli', 'dist');
    await mkdir(startDir, { recursive: true });

    // Act
    const result = findPackageRoot(startDir);

    // Assert
    expect(result).toBe(installedRoot);
  });

  // ❌ Negative: a differently-named package.json must not match
  test('walks past a package.json belonging to a different package', async () => {
    // Arrange — @controlstack/oac-cli must NOT be mistaken for @controlstack/oac
    const outer = join(tmpDir, 'named-outer');
    await mkdir(join(outer, '.opencode'), { recursive: true });
    await writePackageJson(outer, '@controlstack/oac');
    const inner = join(outer, 'packages', 'cli');
    await writePackageJson(inner, '@controlstack/oac-cli');

    // Act — starting inside the CLI package, the walk must reach the outer root
    const result = findPackageRoot(inner);

    // Assert
    expect(result).toBe(outer);
  });

  // ❌ Negative: throws when no package root is found (isolated tmp dir with no markers)
  test('throws an error when no package root is found walking to filesystem root', async () => {
    // Arrange — a directory with neither .opencode/ nor package.json
    const isolated = join(tmpDir, 'isolated-no-markers');
    await mkdir(isolated, { recursive: true });

    // Act & Assert — we cannot actually walk to the real filesystem root in a
    // test (it would find the monorepo's package.json), so we test the error
    // message shape by checking that a directory missing .opencode throws when
    // the walk terminates. We use a path that IS the filesystem root equivalent
    // by mocking: instead, we verify the thrown error message format by calling
    // with a path that has package.json but no .opencode, and one that has
    // .opencode but no package.json — neither should match, but the walk will
    // eventually reach the real monorepo root. So we test the error path by
    // verifying the function throws when given a path that cannot possibly
    // resolve (we use the OS tmpdir itself, which has no .opencode).
    //
    // The safest approach: create a temp dir tree that is self-contained and
    // has no .opencode anywhere. We can't prevent the walk from going above
    // tmpdir, so we test the error message by checking it contains the
    // expected substring when we know it will throw.
    //
    // NOTE: In CI / a clean environment this will throw because there is no
    // .opencode above the tmpdir. In a monorepo dev environment the walk may
    // find the repo root. We therefore test the error *shape* by directly
    // calling with a path that we know will fail: the filesystem root '/'.
    expect(() => findPackageRoot('/')).toThrow(
      'getPackageRoot: could not find the "@controlstack/oac" package root',
    );
  });

  // ❌ Negative: error message includes the start directory
  test('error message includes the starting directory', () => {
    // Arrange & Act & Assert
    let thrownMessage = '';
    try {
      findPackageRoot('/');
    } catch (err) {
      thrownMessage = err instanceof Error ? err.message : String(err);
    }
    expect(thrownMessage).toContain('"/"');
  });

  // ❌ Negative: an unnamed package.json does not match
  test('does not match a directory whose package.json has no name', async () => {
    // Arrange — a directory with an anonymous package.json
    const unnamed = join(tmpDir, 'unnamed-pkg');
    await mkdir(unnamed, { recursive: true });
    await writeFile(join(unnamed, 'package.json'), '{}', 'utf8');

    // Act — the walk passes through and continues upward; it may find the real
    // monorepo root above tmpdir, or throw. Either is fine.
    let result: string | undefined;
    try {
      result = findPackageRoot(unnamed);
    } catch {
      result = undefined;
    }

    // Assert — the key property: it never returns the unnamed directory
    expect(result).not.toBe(unnamed);
  });

  // ❌ Negative: a malformed package.json is skipped rather than throwing
  test('walks past a malformed package.json without throwing a parse error', async () => {
    // Arrange
    const broken = join(tmpDir, 'broken-pkg');
    await mkdir(broken, { recursive: true });
    await writeFile(join(broken, 'package.json'), '{ not json', 'utf8');

    // Act & Assert — must not surface a JSON.parse error
    let thrownMessage = '';
    try {
      const found = findPackageRoot(broken);
      expect(found).not.toBe(broken);
    } catch (err) {
      thrownMessage = err instanceof Error ? err.message : String(err);
    }
    if (thrownMessage !== '') {
      expect(thrownMessage).toContain('could not find the "@controlstack/oac" package root');
    }
  });
});

// ── listBundledFiles ──────────────────────────────────────────────────────────

describe('listBundledFiles', () => {
  let packageRoot: string;

  beforeAll(async () => {
    packageRoot = await mkdtemp(join(tmpdir(), 'oac-list-bundled-'));

    // Create a fake package structure with files in every installable directory.
    await mkdir(join(packageRoot, '.opencode', 'agent', 'core'), { recursive: true });
    await mkdir(join(packageRoot, '.opencode', 'command'), { recursive: true });
    await mkdir(join(packageRoot, '.opencode', 'context'), { recursive: true });
    await mkdir(join(packageRoot, '.opencode', 'plugin'), { recursive: true });
    await mkdir(join(packageRoot, '.opencode', 'skills', 'sub'), { recursive: true });
    await mkdir(join(packageRoot, '.opencode', 'tool', 'env', 'node_modules', 'dependency'), { recursive: true });

    await writeFile(join(packageRoot, '.opencode', 'agent', 'core', 'openagent.md'), '# Agent', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'agent', 'helper.md'), '# Helper', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'command', 'clean.md'), '# Command', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'context', 'standards.md'), '# Standards', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'plugin', 'notify.ts'), 'export {};', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'skills', 'sub', 'skill.md'), '# Skill', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'tool', 'env', 'index.ts'), 'export {};', 'utf8');
    await writeFile(join(packageRoot, '.opencode', 'tool', 'env', 'node_modules', 'dependency', 'index.js'), 'module.exports = {};', 'utf8');
    await writeFile(join(packageRoot, 'env.example'), 'EXAMPLE=value\n', 'utf8');
  });

  afterAll(async () => {
    await rm(packageRoot, { recursive: true, force: true });
  });

  test('returns every installable path and excludes nested node_modules', async () => {
    // Act
    const files = await listBundledFiles(packageRoot);

    expect(files).toContain('.opencode/agent/core/openagent.md');
    expect(files).toContain('.opencode/agent/helper.md');
    expect(files).toContain('.opencode/command/clean.md');
    expect(files).toContain('.opencode/context/standards.md');
    expect(files).toContain('.opencode/plugin/notify.ts');
    expect(files).toContain('.opencode/skills/sub/skill.md');
    expect(files).toContain('.opencode/tool/env/index.ts');
    expect(files).toContain('env.example');
    expect(files).not.toContain('.opencode/tool/env/node_modules/dependency/index.js');
    expect(files).toHaveLength(8);
  });

  // ✅ Positive: paths are relative (not absolute)
  test('returns relative paths, not absolute paths', async () => {
    const files = await listBundledFiles(packageRoot);
    for (const f of files) {
      expect(f.startsWith('/')).toBe(false);
    }
  });

  test('returns only .opencode paths or explicitly allowlisted root files', async () => {
    const files = await listBundledFiles(packageRoot);
    for (const f of files) {
      expect(f.startsWith('.opencode/') || f === 'env.example').toBe(true);
    }
  });

  // ❌ Negative: missing subdirectories are silently skipped
  test('silently skips subdirectories that do not exist', async () => {
    // Arrange — a package root with only the agent subdir
    const sparseRoot = await mkdtemp(join(tmpdir(), 'oac-sparse-pkg-'));
    try {
      await mkdir(join(sparseRoot, '.opencode', 'agent'), { recursive: true });
      await writeFile(join(sparseRoot, '.opencode', 'agent', 'only.md'), '# Only', 'utf8');

      // Act — context/ and skills/ don't exist
      const files = await listBundledFiles(sparseRoot);

      // Assert — only the agent file, no errors
      expect(files).toHaveLength(1);
      expect(files[0]).toBe('.opencode/agent/only.md');
    } finally {
      await rm(sparseRoot, { recursive: true, force: true });
    }
  });

  test('skips secrets, ignore files, nested package manifests, and alias symlinks', async () => {
    const filteredRoot = await mkdtemp(join(tmpdir(), 'oac-filtered-pkg-'));
    try {
      await mkdir(join(filteredRoot, '.opencode', 'context', 'core', 'standards'), { recursive: true });
      await mkdir(join(filteredRoot, '.opencode', 'plugin'), { recursive: true });
      await mkdir(join(filteredRoot, '.opencode', 'tool'), { recursive: true });
      await writeFile(join(filteredRoot, '.opencode', 'context', 'core', 'standards', 'code-quality.md'), '# Code', 'utf8');
      await writeFile(join(filteredRoot, '.opencode', 'plugin', 'notify.ts'), 'export {};', 'utf8');
      await writeFile(join(filteredRoot, '.opencode', 'plugin', 'package.json'), '{"name":"plugin"}', 'utf8');
      await writeFile(join(filteredRoot, '.opencode', 'plugin', '.env'), 'SECRET=1', 'utf8');
      await writeFile(join(filteredRoot, '.opencode', 'plugin', '.gitignore'), 'node_modules', 'utf8');
      await writeFile(join(filteredRoot, '.opencode', 'tool', 'package.json'), '{"name":"tool"}', 'utf8');
      await symlink('code-quality.md', join(filteredRoot, '.opencode', 'context', 'core', 'standards', 'code.md'));

      const files = await listBundledFiles(filteredRoot);

      expect(files).toContain('.opencode/context/core/standards/code-quality.md');
      expect(files).toContain('.opencode/plugin/notify.ts');
      expect(files).not.toContain('.opencode/context/core/standards/code.md');
      expect(files).not.toContain('.opencode/plugin/package.json');
      expect(files).not.toContain('.opencode/tool/package.json');
      expect(files).not.toContain('.opencode/plugin/.env');
      expect(files).not.toContain('.opencode/plugin/.gitignore');
    } finally {
      await rm(filteredRoot, { recursive: true, force: true });
    }
  });

  // ❌ Negative: empty package root returns empty array
  test('returns empty array when no bundled subdirs exist', async () => {
    // Arrange — completely empty package root
    const emptyRoot = await mkdtemp(join(tmpdir(), 'oac-empty-pkg-'));
    try {
      const files = await listBundledFiles(emptyRoot);
      expect(files).toHaveLength(0);
    } finally {
      await rm(emptyRoot, { recursive: true, force: true });
    }
  });
});

describe('published package contents', () => {
  test('npm pack --dry-run includes env.example and excludes node_modules', async () => {
    const { stdout } = await execFile('npm', ['pack', '--dry-run', '--json'], {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    });
    const packed = JSON.parse(stdout) as Array<{ files: Array<{ path: string }> }>;
    const files = packed[0]?.files.map((file) => file.path) ?? [];

    expect(files).toContain('env.example');
    expect(files.some((file) => file.includes('node_modules'))).toBe(false);
  });
});

// ── bundledFileExists ─────────────────────────────────────────────────────────

describe('bundledFileExists', () => {
  let packageRoot: string;

  beforeAll(async () => {
    packageRoot = await mkdtemp(join(tmpdir(), 'oac-exists-test-'));
    await mkdir(join(packageRoot, '.opencode', 'agent'), { recursive: true });
    await writeFile(join(packageRoot, '.opencode', 'agent', 'present.md'), '# Present', 'utf8');
  });

  afterAll(async () => {
    await rm(packageRoot, { recursive: true, force: true });
  });

  // ✅ Positive: returns true for a file that exists
  test('returns true when the bundled file exists', async () => {
    const exists = await bundledFileExists(packageRoot, '.opencode/agent/present.md');
    expect(exists).toBe(true);
  });

  // ❌ Negative: returns false for a file that does not exist
  test('returns false when the bundled file does not exist', async () => {
    const exists = await bundledFileExists(packageRoot, '.opencode/agent/missing.md');
    expect(exists).toBe(false);
  });
});

// ── classifyBundledFile — commands, tools, plugins ────────────────────────────

describe('classifyBundledFile — profile kinds', () => {
  test('returns "command" for .opencode/command/ paths', () => {
    expect(classifyBundledFile('.opencode/command/clean.md')).toBe('command');
  });

  test('returns "tool" for .opencode/tool/ paths', () => {
    expect(classifyBundledFile('.opencode/tool/env/index.ts')).toBe('tool');
  });

  test('returns "plugin" for .opencode/plugin/ paths', () => {
    expect(classifyBundledFile('.opencode/plugin/notify.ts')).toBe('plugin');
  });

  test('returns "config" for the env template', () => {
    expect(classifyBundledFile('env.example')).toBe('config');
  });
});

describe('toManifestType', () => {
  test('folds registry kinds into the manifest vocabulary', () => {
    expect(toManifestType('agent')).toBe('agent');
    expect(toManifestType('subagent')).toBe('agent');
    expect(toManifestType('context')).toBe('context');
    expect(toManifestType('skill')).toBe('skill');
    expect(toManifestType('config')).toBe('config');
    expect(toManifestType('command')).toBe('other');
    expect(toManifestType('tool')).toBe('other');
    expect(toManifestType('plugin')).toBe('other');
  });
});
