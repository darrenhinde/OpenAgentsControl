/**
 * Distribution contract: profiles must not refer to files omitted from the npm tarball.
 * The test reads npm's packed-file manifest rather than the source checkout.
 */
import { describe, expect, test } from 'bun:test';
import { execFile as execFileCallback } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { listBundledFiles } from '../lib/bundled.js';
import { readRegistry, resolveProfile } from '../lib/registry.js';

const execFile = promisify(execFileCallback);
const PACKAGE_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

type PackedFile = { path: string };
type PackResult = { files: PackedFile[] };

const missingFromPackage = (wanted: readonly string[], packed: ReadonlySet<string>): string[] =>
  wanted.filter((file) => !packed.has(file)).sort();

describe('published package profile contents', () => {
  test('packs every file referenced by each install profile and env.example', async () => {
    // Arrange
    const [registry, bundledFiles, command] = await Promise.all([
      readRegistry(PACKAGE_ROOT),
      listBundledFiles(PACKAGE_ROOT),
      execFile('npm', ['pack', '--dry-run', '--json'], { cwd: PACKAGE_ROOT, encoding: 'utf8' }),
    ]);
    const packed = JSON.parse(command.stdout) as PackResult[];
    const packedPaths = new Set(packed[0]?.files.map(({ path }) => path) ?? []);
    const profileFiles = Object.values(registry.profiles)
      .flatMap((profile) => resolveProfile(registry, profile).files);

    // Act
    const missing = missingFromPackage([...profileFiles, ...bundledFiles, 'env.example'], packedPaths);

    // Assert
    expect(missing).toEqual([]);
  });

  test('packs every file the v1 flavor installs from, and both registries', async () => {
    // Arrange
    const [registry, bundledFiles, command] = await Promise.all([
      readRegistry(PACKAGE_ROOT, 'v1'),
      listBundledFiles(PACKAGE_ROOT, 'v1'),
      execFile('npm', ['pack', '--dry-run', '--json'], { cwd: PACKAGE_ROOT, encoding: 'utf8' }),
    ]);
    const packed = JSON.parse(command.stdout) as PackResult[];
    const packedPaths = new Set(packed[0]?.files.map(({ path }) => path) ?? []);
    const profileFiles = Object.values(registry.profiles)
      .flatMap((profile) => resolveProfile(registry, profile).files);

    // Act
    const missing = missingFromPackage(
      [...profileFiles, ...bundledFiles, 'built-ai-configs/registry/registry.json', 'built-ai-configs/registry/registry.v1.json'],
      packedPaths,
    );

    // Assert
    expect(missing).toEqual([]);
    expect(bundledFiles.some((f) => f.startsWith('built-ai-configs/opencode-v1/tool/'))).toBe(true);
  });

  test('reports a profile file that npm did not package', () => {
    // Arrange
    const packedPaths = new Set(['.opencode/context/navigation.md']);

    // Act
    const missing = missingFromPackage(['.opencode/context/navigation.md', 'env.example'], packedPaths);

    // Assert
    expect(missing).toEqual(['env.example']);
  });

  test('npm publish rebuilds the compiler and the CLI first, so a clean tree cannot ship without dist', () => {
    const pkg = JSON.parse(readFileSync(`${PACKAGE_ROOT}package.json`, 'utf8')) as { files: string[]; scripts: Record<string, string> };
    expect(pkg.files).toContain('packages/cli/dist/');
    const script = pkg.scripts['prepublishOnly'] ?? '';
    expect(script).toContain('packages/agent-compiler run build');
    expect(script).toContain('packages/cli run build');
    // the compiler first: the CLI bundles it
    expect(script.indexOf('agent-compiler')).toBeLessThan(script.indexOf('packages/cli'));
  });
});
