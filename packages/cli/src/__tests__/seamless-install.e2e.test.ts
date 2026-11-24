/**
 * Scratch-project lifecycle coverage for the seamless-install contract.
 * These tests use the real registry and bundled files but never call networked doctor checks.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureClaudeDiscoveryConfig, planInstall } from '../commands/init.js';
import { resolveUpdateScope } from '../commands/update.js';
import { listBundledFiles, getBundledFilePath } from '../lib/bundled.js';
import { createDefaultConfig, type OacConfig } from '../lib/config.js';
import { checkClaudeDiscoveryConfig, checkContextRootNavigation } from '../lib/doctor-checks.js';
import { installFiles, syncFiles } from '../lib/installer.js';
import { type ManifestFile, writeManifest } from '../lib/manifest.js';
import { readRegistry } from '../lib/registry.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const scratchRoots: string[] = [];

const installOptions = (projectRoot: string, yolo = false) => ({
  projectRoot,
  packageRoot: PACKAGE_ROOT,
  dryRun: false,
  yolo,
  verbose: false,
});

const newScratchProject = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'oac-seamless-install-'));
  scratchRoots.push(root);
  await writeFile(join(root, 'package.json'), '{"name":"scratch"}\n');
  return root;
};

afterEach(async () => {
  await Promise.all(scratchRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('seamless install scratch project', () => {
  test('keeps an essential install scoped while allowing a cumulative developer upgrade and downgrade', async () => {
    // Arrange
    const projectRoot = await newScratchProject();
    const [registry, bundledFiles] = await Promise.all([readRegistry(PACKAGE_ROOT), listBundledFiles(PACKAGE_ROOT)]);
    const essential = planInstall(registry, bundledFiles, { profile: 'essential', contextOnly: false })!;
    const developer = planInstall(registry, bundledFiles, { profile: 'developer', contextOnly: false })!;
    const initial = await installFiles(essential.files, installOptions(projectRoot));
    const managedFile = essential.files.find((file) => file.startsWith('.opencode/agent/'))!;
    await writeManifest(projectRoot, initial.updatedManifest);
    await ensureClaudeDiscoveryConfig(projectRoot, false);
    await appendFile(join(projectRoot, managedFile), '\n<!-- user edit -->\n');

    // Act
    const reinitialised = await syncFiles(essential.files, initial.updatedManifest, installOptions(projectRoot));
    const essentialScope = resolveUpdateScope(
      registry,
      bundledFiles,
      reinitialised.updatedManifest,
      createDefaultConfig(),
    );
    const developerScope = resolveUpdateScope(
      registry,
      bundledFiles,
      reinitialised.updatedManifest,
      { ...createDefaultConfig(), installationScope: { profile: 'essential', contextOnly: false, profiles: ['essential'] } },
      'developer',
    );
    const downgradedConfig: OacConfig = {
      ...createDefaultConfig(),
      installationScope: { profile: 'essential', contextOnly: false, profiles: ['essential', 'developer'] },
    };
    const downgradedScope = resolveUpdateScope(registry, bundledFiles, reinitialised.updatedManifest, downgradedConfig);
    const [navigation, claude] = await Promise.all([
      checkContextRootNavigation(projectRoot),
      checkClaudeDiscoveryConfig(projectRoot),
    ]);

    // Assert
    expect(reinitialised.result.skipped).toContain(managedFile);
    expect(await readFile(join(projectRoot, managedFile), 'utf8')).toContain('user edit');
    expect(essentialScope.files).toEqual(essential.files);
    expect(developerScope.files).toEqual([...new Set([...essential.files, ...developer.files])].sort());
    expect(downgradedScope.files).toEqual(developerScope.files);
    expect(navigation.status).toBe('ok');
    expect(claude.status).toBe('ok');
  });

  test('protects an install.sh-style pre-existing tree unless yolo backs it up first', async () => {
    // Arrange
    const projectRoot = await newScratchProject();
    const registry = await readRegistry(PACKAGE_ROOT);
    const target = planInstall(registry, await listBundledFiles(PACKAGE_ROOT), { profile: 'essential', contextOnly: false })!
      .files.find((file) => file.startsWith('.opencode/agent/'))!;
    const destination = join(projectRoot, target);
    const userContent = '# User-owned install.sh content\n';
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, userContent);

    // Act
    const protectedInstall = await installFiles([target], installOptions(projectRoot));
    const yoloInstall = await syncFiles([target], protectedInstall.updatedManifest, installOptions(projectRoot, true));

    // Assert
    expect(protectedInstall.updatedManifest.files[target]?.protected).toBe(true);
    expect(yoloInstall.result.backed_up).toHaveLength(1);
    expect(await readFile(join(projectRoot, target), 'utf8')).toBe(
      await readFile(getBundledFilePath(PACKAGE_ROOT, target), 'utf8'),
    );
  });
});
