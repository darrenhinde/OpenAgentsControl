/**
 * Distribution contract: profiles must not refer to files omitted from the npm tarball.
 * The test reads npm's packed-file manifest rather than the source checkout.
 */
import { describe, expect, test } from 'bun:test';
import { execFile as execFileCallback } from 'node:child_process';
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

  test('reports a profile file that npm did not package', () => {
    // Arrange
    const packedPaths = new Set(['.opencode/context/navigation.md']);

    // Act
    const missing = missingFromPackage(['.opencode/context/navigation.md', 'env.example'], packedPaths);

    // Assert
    expect(missing).toEqual(['env.example']);
  });
});
