import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { countUnmanagedContextFiles, formatUnmanagedContextSummary } from './list.js';
import { addFileToManifest, createEmptyManifest } from '../lib/manifest.js';

const createContextFile = async (projectRoot: string, relativePath: string): Promise<void> => {
  const filePath = join(projectRoot, relativePath);
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, '# Context', 'utf8');
};

describe('oac list unmanaged context reporting', () => {
  test('reports zero when every context file is OAC-managed', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'oac-list-context-'));
    const managedPath = '.opencode/context/core/managed.md';
    try {
      await createContextFile(projectRoot, managedPath);
      const manifest = addFileToManifest(createEmptyManifest('1.0.0'), managedPath, {
        sha256: 'a'.repeat(64), type: 'context', source: 'bundled', installedAt: new Date().toISOString(),
      });

      expect(await countUnmanagedContextFiles(projectRoot, manifest)).toBe(0);
      expect(formatUnmanagedContextSummary(0)).toBe('0 context files of your own (not managed by OAC)');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  test('reports an untracked context file without adding it to the manifest', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'oac-list-context-'));
    const unmanagedPath = '.opencode/context/team/decisions.md';
    try {
      await createContextFile(projectRoot, unmanagedPath);
      const manifest = createEmptyManifest('1.0.0');

      expect(await countUnmanagedContextFiles(projectRoot, manifest)).toBe(1);
      expect(formatUnmanagedContextSummary(1)).toBe('1 context files of your own (not managed by OAC)');
      expect(manifest.files[unmanagedPath]).toBeUndefined();
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
