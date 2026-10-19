/**
 * Installing the v1 build, and moving an install between layouts.
 *
 * The v1 build lives under `v1-opencode/` in the package; a user's project only ever gets
 * `.opencode/`. These tests use a fake package and real temp projects (no network, no host).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { appendFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { syncFiles, updateFiles, type InstallOptions } from './installer.js';
import { listBundledFiles } from './bundled.js';
import { readManifest, writeManifest } from './manifest.js';

let pkg: string;
let project: string;

const put = async (root: string, rel: string, text: string): Promise<void> => {
  await mkdir(dirname(join(root, rel)), { recursive: true });
  await writeFile(join(root, rel), text);
};
const exists = (root: string, rel: string): Promise<boolean> =>
  stat(join(root, rel)).then(() => true).catch(() => false);
const registry = (agents: Array<[string, string]>): string =>
  JSON.stringify({ version: '1', components: { agents: agents.map(([id, path]) => ({ id, name: id, type: 'agent', path })) } });

const opts = (over: Partial<InstallOptions> = {}): InstallOptions => ({
  projectRoot: project,
  packageRoot: pkg,
  dryRun: false,
  yolo: false,
  verbose: false,
  ...over,
});

beforeEach(async () => {
  pkg = await mkdtemp(join(tmpdir(), 'oac-flavor-pkg-'));
  project = await mkdtemp(join(tmpdir(), 'oac-flavor-proj-'));
  await put(pkg, '.opencode/agent/openagent.md', 'v2 openagent');
  await put(pkg, '.opencode/agent/eval-runner.md', 'eval runner');
  await put(pkg, '.opencode/command/c.md', 'command');
  await put(pkg, 'v1-opencode/agent/core/openagent.md', 'v1 openagent');
  await put(pkg, 'v1-opencode/tool/gemini/index.ts', 'tool');
  await put(pkg, 'v1-opencode/plugin/notify.ts', 'plugin');
  await put(pkg, 'registry.json', registry([['openagent', '.opencode/agent/openagent.md'], ['eval-runner', '.opencode/agent/eval-runner.md']]));
  await put(pkg, 'registry.v1.json', registry([['openagent', 'v1-opencode/agent/core/openagent.md'], ['eval-runner', '.opencode/agent/eval-runner.md']]));
});
afterEach(async () => {
  await rm(pkg, { recursive: true, force: true });
  await rm(project, { recursive: true, force: true });
});

describe('installing v1 source paths', () => {
  test('writes them to .opencode/, keys the manifest by destination, and never creates v1-opencode', async () => {
    const files = await listBundledFiles(pkg, 'v1');
    const { result, updatedManifest } = await syncFiles(files, null, opts());

    expect(result.errors).toEqual([]);
    expect(await readFile(join(project, '.opencode/agent/core/openagent.md'), 'utf8')).toBe('v1 openagent');
    expect(await exists(project, '.opencode/tool/gemini/index.ts')).toBe(true);
    expect(await exists(project, '.opencode/plugin/notify.ts')).toBe(true);
    expect(await exists(project, 'v1-opencode')).toBe(false);
    expect(Object.keys(updatedManifest.files).some((k) => k.includes('v1-opencode'))).toBe(false);
    expect(Object.keys(updatedManifest.files)).toContain('.opencode/agent/core/openagent.md');
    expect(await exists(project, '.opencode/agent/openagent.md')).toBe(false); // v2 flat agent is not installed
  });

  test('records the type of a v1 file by where it installs', async () => {
    const { updatedManifest } = await syncFiles(['v1-opencode/tool/gemini/index.ts'], null, opts());
    expect(updatedManifest.files['.opencode/tool/gemini/index.ts']?.type).toBe('other');
  });
});

describe('updateFiles by flavor', () => {
  test('a v1 update installs the v1 view and ignores v2-only files', async () => {
    const { result, updatedManifest } = await updateFiles(opts({ flavor: 'v1' }));
    expect(result.errors).toEqual([]);
    expect(Object.keys(updatedManifest.files).sort()).toEqual([
      '.opencode/agent/core/openagent.md',
      '.opencode/agent/eval-runner.md',
      '.opencode/command/c.md',
      '.opencode/plugin/notify.ts',
      '.opencode/tool/gemini/index.ts',
    ]);
  });

  test('a v1 update refreshes an untouched v1 file in place', async () => {
    const first = await updateFiles(opts({ flavor: 'v1' }));
    await writeManifest(project, first.updatedManifest);
    await put(pkg, 'v1-opencode/agent/core/openagent.md', 'v1 openagent, newer');
    const second = await updateFiles(opts({ flavor: 'v1' }));
    expect(second.result.updated).toContain('.opencode/agent/core/openagent.md');
    expect(await readFile(join(project, '.opencode/agent/core/openagent.md'), 'utf8')).toBe('v1 openagent, newer');
  });
});

describe('migrating a v1-layout install to v2', () => {
  const installV1 = async (): Promise<void> => {
    const { updatedManifest } = await updateFiles(opts({ flavor: 'v1' }));
    await writeManifest(project, updatedManifest);
  };

  test('removes OAC-owned v1-only files, installs the flat v2 files, and keeps shared files', async () => {
    await installV1();
    const { result, updatedManifest } = await updateFiles(opts({ flavor: 'v2', pruneStale: true }));

    expect(result.errors).toEqual([]);
    expect(await exists(project, '.opencode/agent/core/openagent.md')).toBe(false);
    expect(await exists(project, '.opencode/agent/core')).toBe(false); // empty dir tidied
    expect(await exists(project, '.opencode/tool/gemini/index.ts')).toBe(false);
    expect(await exists(project, '.opencode/plugin/notify.ts')).toBe(false);
    expect(await exists(project, '.opencode/agent/openagent.md')).toBe(true);
    expect(await exists(project, '.opencode/agent/eval-runner.md')).toBe(true);
    expect(result.pruned.sort()).toEqual([
      '.opencode/agent/core/openagent.md',
      '.opencode/plugin/notify.ts',
      '.opencode/tool/gemini/index.ts',
    ]);
    expect(Object.keys(updatedManifest.files).sort()).toEqual([
      '.opencode/agent/eval-runner.md',
      '.opencode/agent/openagent.md',
      '.opencode/command/c.md',
    ]);
  });

  test('backs up a v1 file the user edited before removing it, so no duplicate agent survives', async () => {
    await installV1();
    await appendFile(join(project, '.opencode/agent/core/openagent.md'), '\nmy edit');
    const { result } = await updateFiles(opts({ flavor: 'v2', pruneStale: true }));

    expect(await exists(project, '.opencode/agent/core/openagent.md')).toBe(false);
    expect(result.backed_up.length).toBe(1);
    expect(await readFile(result.backed_up[0]!, 'utf8')).toContain('my edit');
  });

  test('never touches a file OAC did not install, even inside a pruned directory', async () => {
    await installV1();
    await put(project, '.opencode/agent/mine.md', 'user agent');
    await put(project, '.opencode/tool/mine.ts', 'user tool');
    await updateFiles(opts({ flavor: 'v2', pruneStale: true }));

    expect(await readFile(join(project, '.opencode/agent/mine.md'), 'utf8')).toBe('user agent');
    expect(await readFile(join(project, '.opencode/tool/mine.ts'), 'utf8')).toBe('user tool');
    expect(await exists(project, '.opencode/tool')).toBe(true); // still holds a user file
  });

  test('without pruneStale a v2 update only warns, as before', async () => {
    await installV1();
    const { result } = await updateFiles(opts({ flavor: 'v2' }));
    expect(result.pruned).toEqual([]);
    expect(await exists(project, '.opencode/agent/core/openagent.md')).toBe(true);
  });

  test('dry run removes nothing', async () => {
    await installV1();
    const { result } = await updateFiles(opts({ flavor: 'v2', pruneStale: true, dryRun: true }));
    expect(await exists(project, '.opencode/agent/core/openagent.md')).toBe(true);
    expect(result.pruned.length).toBe(3);
  });

  test('the manifest written before and after never mentions the v1 source folder', async () => {
    await installV1();
    expect(JSON.stringify(await readManifest(project))).not.toContain('v1-opencode');
  });
});
