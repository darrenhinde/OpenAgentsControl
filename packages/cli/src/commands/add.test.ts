import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addCommand, removeCommand } from './add.js';

const componentPath = '.opencode/context/example.md';
const originalCwd = process.cwd();
const originalPackageRoot = process.env.OAC_PACKAGE_ROOT;
const temporaryRoots: string[] = [];

const makeFixture = async (): Promise<{ projectRoot: string; packageRoot: string; destPath: string }> => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'oac-command-project-'));
  const packageRoot = await mkdtemp(join(tmpdir(), 'oac-command-package-'));
  temporaryRoots.push(projectRoot, packageRoot);
  await mkdir(join(packageRoot, '.opencode', 'context'), { recursive: true });
  await writeFile(join(packageRoot, componentPath), '# Bundled version', 'utf8');
  await writeFile(join(packageRoot, 'registry.json'), JSON.stringify({
    version: '1.0.0',
    components: {
      contexts: [{ id: 'example', name: 'Example', type: 'context', path: componentPath, description: '' }],
    },
  }), 'utf8');
  process.env.OAC_PACKAGE_ROOT = packageRoot;
  process.chdir(projectRoot);
  return { projectRoot, packageRoot, destPath: join(projectRoot, componentPath) };
};

afterEach(async () => {
  process.chdir(originalCwd);
  if (originalPackageRoot === undefined) delete process.env.OAC_PACKAGE_ROOT;
  else process.env.OAC_PACKAGE_ROOT = originalPackageRoot;
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('addCommand safety', () => {
  test('preserves a modified file unless yolo, which backs it up before overwrite', async () => {
    const { projectRoot, destPath } = await makeFixture();
    const normal = { force: false, dryRun: false, verbose: false, yolo: false };

    await addCommand('context:example', normal);
    await writeFile(destPath, '# User version', 'utf8');
    await addCommand('context:example', { ...normal, force: true });
    expect(await readFile(destPath, 'utf8')).toBe('# User version');

    await addCommand('context:example', { ...normal, force: true, yolo: true });
    expect(await readFile(destPath, 'utf8')).toBe('# Bundled version');
    expect((await stat(join(projectRoot, '.oac', 'backups'))).isDirectory()).toBe(true);
  });
});

describe('removeCommand safety', () => {
  test('preserves a modified file unless yolo, which backs it up before deletion', async () => {
    const { projectRoot, destPath } = await makeFixture();
    const options = { dryRun: false, verbose: false, yolo: false };

    await addCommand('context:example', { ...options, force: false });
    await writeFile(destPath, '# User version', 'utf8');
    await removeCommand('context:example', options);
    expect(await Bun.file(destPath).exists()).toBe(true);

    await removeCommand('context:example', { ...options, yolo: true });
    expect(await Bun.file(destPath).exists()).toBe(false);
    expect((await stat(join(projectRoot, '.oac', 'backups'))).isDirectory()).toBe(true);
  });
});
