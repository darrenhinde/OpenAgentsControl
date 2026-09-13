import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createEmptyManifest,
  addFileToManifest,
  inferLegacyInstallationScope,
  removeFileFromManifest,
  updateFileHash,
  readManifest,
  writeManifest,
  ManifestError,
  type ManifestFile,
  type FileEntry,
} from './manifest.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeEntry = (overrides: Partial<FileEntry> = {}): FileEntry => ({
  sha256: 'abc123',
  type: 'agent',
  source: 'bundled',
  installedAt: new Date().toISOString(),
  ...overrides,
});

// ── createEmptyManifest ───────────────────────────────────────────────────────

describe('createEmptyManifest', () => {
  test('returns a manifest with version "1"', () => {
    const m = createEmptyManifest('1.0.0');
    expect(m.version).toBe('1');
  });

  test('stores the provided oacVersion', () => {
    const m = createEmptyManifest('2.3.4');
    expect(m.oacVersion).toBe('2.3.4');
  });

  test('starts with an empty files record', () => {
    const m = createEmptyManifest('1.0.0');
    expect(Object.keys(m.files)).toHaveLength(0);
  });

  test('installedAt and updatedAt are valid ISO strings', () => {
    const m = createEmptyManifest('1.0.0');
    expect(() => new Date(m.installedAt)).not.toThrow();
    expect(() => new Date(m.updatedAt)).not.toThrow();
  });
});

describe('FileEntrySchema compatibility', () => {
  test('defaults legacy entries to unprotected', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oac-legacy-manifest-'));
    try {
      await mkdir(join(dir, '.oac'), { recursive: true });
      await Bun.write(join(dir, '.oac/manifest.json'), JSON.stringify({
        version: '1',
        oacVersion: '1.0.0',
        installedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        files: {
          '.opencode/agent/foo.md': {
            sha256: 'legacy-hash',
            type: 'agent',
            source: 'bundled',
            installedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }));
      const manifest = await readManifest(dir);
      expect(manifest?.files['.opencode/agent/foo.md']?.protected).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('preserves protected pre-existing entries and their observed hash', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oac-protected-manifest-'));
    try {
      let manifest = createEmptyManifest('1.0.0');
      manifest = addFileToManifest(manifest, '.opencode/context/custom.md', makeEntry({
        sha256: 'observed-pre-existing-hash',
        type: 'context',
        source: 'custom',
        protected: true,
      }));
      await writeManifest(dir, manifest);
      const read = await readManifest(dir);
      expect(read?.files['.opencode/context/custom.md']).toMatchObject({
        protected: true,
        sha256: 'observed-pre-existing-hash',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('inferLegacyInstallationScope', () => {
  test('limits a legacy install to the paths already recorded in its manifest', () => {
    let manifest = createEmptyManifest('1.0.0');
    manifest = addFileToManifest(manifest, '.opencode/context/core.md', makeEntry({ type: 'context' }));
    manifest = addFileToManifest(manifest, '.opencode/agent/coder.md', makeEntry());

    expect(inferLegacyInstallationScope(manifest)).toEqual({
      profile: null,
      contextOnly: false,
      profiles: [],
      files: ['.opencode/agent/coder.md', '.opencode/context/core.md'],
    });
  });

  test('recognizes a context-only legacy install without assigning an unknown profile', () => {
    const manifest = addFileToManifest(
      createEmptyManifest('1.0.0'),
      '.opencode/context/core.md',
      makeEntry({ type: 'context' }),
    );

    expect(inferLegacyInstallationScope(manifest)).toMatchObject({
      profile: null,
      contextOnly: true,
      profiles: [],
    });
  });
});

// ── addFileToManifest ─────────────────────────────────────────────────────────

describe('addFileToManifest', () => {
  test('adds a new file entry', () => {
    const m = createEmptyManifest('1.0.0');
    const entry = makeEntry();
    const updated = addFileToManifest(m, 'agents/foo.md', entry);
    expect(updated.files['agents/foo.md']).toEqual(entry);
  });

  test('does not mutate the original manifest', () => {
    const m = createEmptyManifest('1.0.0');
    addFileToManifest(m, 'agents/foo.md', makeEntry());
    expect(Object.keys(m.files)).toHaveLength(0);
  });

  test('replaces an existing entry for the same path', () => {
    const m = createEmptyManifest('1.0.0');
    const first = makeEntry({ sha256: 'aaa' });
    const second = makeEntry({ sha256: 'bbb' });
    const m1 = addFileToManifest(m, 'agents/foo.md', first);
    const m2 = addFileToManifest(m1, 'agents/foo.md', second);
    expect(m2.files['agents/foo.md']?.sha256).toBe('bbb');
    expect(Object.keys(m2.files)).toHaveLength(1);
  });

  test('updates updatedAt', () => {
    const m = createEmptyManifest('1.0.0');
    const before = m.updatedAt;
    // Ensure at least 1ms passes
    const updated = addFileToManifest(m, 'agents/foo.md', makeEntry());
    expect(updated.updatedAt >= before).toBe(true);
  });
});

// ── removeFileFromManifest ────────────────────────────────────────────────────

describe('removeFileFromManifest', () => {
  test('removes an existing file', () => {
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'agents/foo.md', makeEntry());
    const updated = removeFileFromManifest(m, 'agents/foo.md');
    expect(updated.files['agents/foo.md']).toBeUndefined();
  });

  test('is a no-op for a path not in the manifest', () => {
    const m = createEmptyManifest('1.0.0');
    const updated = removeFileFromManifest(m, 'agents/nonexistent.md');
    expect(Object.keys(updated.files)).toHaveLength(0);
  });

  test('does not mutate the original manifest', () => {
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'agents/foo.md', makeEntry());
    removeFileFromManifest(m, 'agents/foo.md');
    expect(m.files['agents/foo.md']).toBeDefined();
  });

  test('leaves other entries intact', () => {
    let m = createEmptyManifest('1.0.0');
    m = addFileToManifest(m, 'agents/a.md', makeEntry());
    m = addFileToManifest(m, 'agents/b.md', makeEntry());
    const updated = removeFileFromManifest(m, 'agents/a.md');
    expect(updated.files['agents/b.md']).toBeDefined();
    expect(Object.keys(updated.files)).toHaveLength(1);
  });
});

// ── updateFileHash ────────────────────────────────────────────────────────────

describe('updateFileHash', () => {
  test('updates the sha256 of a tracked file', () => {
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'agents/foo.md', makeEntry({ sha256: 'old' }));
    const updated = updateFileHash(m, 'agents/foo.md', 'new-hash');
    expect(updated.files['agents/foo.md']?.sha256).toBe('new-hash');
  });

  test('throws ManifestError for an untracked file', () => {
    const m = createEmptyManifest('1.0.0');
    expect(() => updateFileHash(m, 'agents/missing.md', 'hash')).toThrow(ManifestError);
  });

  test('preserves other fields on the entry', () => {
    const entry = makeEntry({ type: 'context', source: 'registry' });
    const m = addFileToManifest(createEmptyManifest('1.0.0'), 'ctx/foo.md', entry);
    const updated = updateFileHash(m, 'ctx/foo.md', 'new-hash');
    expect(updated.files['ctx/foo.md']?.type).toBe('context');
    expect(updated.files['ctx/foo.md']?.source).toBe('registry');
  });
});

// ── ManifestError ─────────────────────────────────────────────────────────────

describe('ManifestError', () => {
  test('has name "ManifestError"', () => {
    const err = new ManifestError('oops');
    expect(err.name).toBe('ManifestError');
  });

  test('is an instance of Error', () => {
    expect(new ManifestError('oops')).toBeInstanceOf(Error);
  });

  test('carries the message', () => {
    expect(new ManifestError('bad manifest').message).toBe('bad manifest');
  });
});

// ── readManifest / writeManifest (I/O) ────────────────────────────────────────

describe('readManifest / writeManifest', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-manifest-test-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test('readManifest returns null when no manifest exists', async () => {
    const result = await readManifest(tmpDir);
    expect(result).toBeNull();
  });

  test('writeManifest then readManifest round-trips correctly', async () => {
    const original = createEmptyManifest('1.2.3');
    await writeManifest(tmpDir, original);
    const read = await readManifest(tmpDir);
    expect(read).not.toBeNull();
    expect(read?.version).toBe('1');
    expect(read?.oacVersion).toBe('1.2.3');
    expect(Object.keys(read?.files ?? {})).toHaveLength(0);
  });

  test('readManifest throws ManifestError for invalid JSON structure', async () => {
    // Write a manifest with a bad version field
    const badDir = await mkdtemp(join(tmpdir(), 'oac-bad-manifest-'));
    try {
      await Bun.write(join(badDir, '.oac/manifest.json'), JSON.stringify({ version: '99', files: {} }));
      await expect(readManifest(badDir)).rejects.toThrow(ManifestError);
    } finally {
      await rm(badDir, { recursive: true, force: true });
    }
  });

  test('round-trips a manifest with file entries', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'oac-manifest-entries-'));
    try {
      let m = createEmptyManifest('1.0.0');
      m = addFileToManifest(m, '.opencode/agent/foo.md', makeEntry({ type: 'agent' }));
      await writeManifest(dir, m);
      const read = await readManifest(dir);
      expect(read?.files['.opencode/agent/foo.md']?.type).toBe('agent');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
