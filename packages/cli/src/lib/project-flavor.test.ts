import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readProjectFlavor } from './project-flavor.js';

describe('readProjectFlavor', () => {
  let root: string;
  beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'oac-pf-')); });
  afterEach(async () => { await rm(root, { recursive: true, force: true }); });

  const marker = async (text: string) => {
    await mkdir(join(root, '.opencode'), { recursive: true });
    await writeFile(join(root, '.opencode', '.oac-opencode'), text);
  };

  test('nothing recorded anywhere is an unrecorded v2', async () => {
    expect(await readProjectFlavor(root)).toMatchObject({ flavor: 'v2', recorded: false, source: 'none' });
  });

  test('falls back to the marker install.sh writes', async () => {
    await marker('v1\n');
    expect(await readProjectFlavor(root)).toMatchObject({ flavor: 'v1', recorded: true, source: 'marker' });
  });

  test('a garbled marker is ignored', async () => {
    await marker('banana');
    expect(await readProjectFlavor(root)).toMatchObject({ recorded: false, source: 'none' });
  });

  test('the config wins over the marker', async () => {
    await marker('v1\n');
    await mkdir(join(root, '.oac'), { recursive: true });
    await writeFile(
      join(root, '.oac', 'config.json'),
      JSON.stringify({ version: '1', preferences: { yoloMode: false, autoBackup: true }, opencode: { target: 'v2' } }),
    );
    expect(await readProjectFlavor(root)).toMatchObject({ flavor: 'v2', recorded: true, source: 'config' });
  });
});
