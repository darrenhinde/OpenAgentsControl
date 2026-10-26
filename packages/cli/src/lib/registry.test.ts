/**
 * Tests for the pure registry helpers: ref resolution, profile resolution and the
 * "never write outside .opencode/" guard. No I/O.
 */
import { describe, test, expect } from 'bun:test';
import {
  RegistrySchema,
  resolveComponent,
  resolveProfile,
  listProfiles,
  getProfile,
  filesForComponent,
  isInstallablePath,
  listComponents,
  expandRef,
  readRegistry,
  getRegistryPath,
  type Registry,
} from './registry.js';

// ── Fixture ───────────────────────────────────────────────────────────────────

const component = (type: string, id: string, path: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  type,
  path,
  description: `${id} description`,
  ...extra,
});

const FIXTURE: Registry = RegistrySchema.parse({
  version: '1.0.0',
  components: {
    agents: [component('agent', 'openagent', '.opencode/agent/core/openagent.md')],
    subagents: [component('subagent', 'contextscout', '.opencode/agent/subagents/core/contextscout.md')],
    contexts: [
      component('context', 'standards-code', '.opencode/context/core/standards/code-quality.md', { aliases: ['code-standards'] }),
      component('context', 'quick-start', '.opencode/context/core/quick-start.md'),
      component('context', 'paths', '.opencode/context/core/config/paths.json'),
      component('context', 'web-ui', '.opencode/context/ui/web.md'),
    ],
    skills: [
      component('skill', 'task-management', '.opencode/skills/task-management/SKILL.md', {
        files: [
          '.opencode/skills/task-management/SKILL.md',
          '.opencode/skills/task-management/router.sh',
          '.opencode/skills/task-management/scripts/task-cli.ts',
        ],
      }),
    ],
    commands: [component('command', 'clean', '.opencode/command/clean.md')],
    tools: [component('tool', 'env', '.opencode/tool/env/index.ts')],
    plugins: [],
    config: [
      component('config', 'env-example', 'env.example'),
      component('config', 'readme', 'README.md'),
    ],
  },
  profiles: {
    essential: {
      name: 'Essential',
      description: 'Minimal',
      components: [
        'agent:openagent',
        'subagent:contextscout',
        'context:standards-code',
        'context:quick-start',
        'skill:task-management',
        'command:clean',
        'tool:env',
        'config:env-example',
        'config:readme',
        'context:does-not-exist',
        'agent:openagent',
      ],
    },
    full: { name: 'Full', components: [] },
  },
});

// ── Schema ────────────────────────────────────────────────────────────────────

describe('RegistrySchema', () => {
  test('accepts every component kind and the profiles map', () => {
    expect(listComponents(FIXTURE)).toHaveLength(11);
    expect(listProfiles(FIXTURE).map((p) => p.id)).toEqual(['essential', 'full']);
  });

  test('defaults profiles to an empty map when absent', () => {
    const parsed = RegistrySchema.parse({ version: '1', components: {} });
    expect(parsed.profiles).toEqual({});
    expect(listComponents(parsed)).toEqual([]);
  });
});

// ── resolveComponent ──────────────────────────────────────────────────────────

describe('resolveComponent', () => {
  test('resolves every kind by type:id', () => {
    expect(resolveComponent(FIXTURE, 'agent:openagent')?.path).toBe('.opencode/agent/core/openagent.md');
    expect(resolveComponent(FIXTURE, 'subagent:contextscout')?.type).toBe('subagent');
    expect(resolveComponent(FIXTURE, 'command:clean')?.type).toBe('command');
    expect(resolveComponent(FIXTURE, 'tool:env')?.type).toBe('tool');
    expect(resolveComponent(FIXTURE, 'config:env-example')?.path).toBe('env.example');
  });

  test('returns null for unknown ids, unknown types and malformed refs', () => {
    expect(resolveComponent(FIXTURE, 'context:nope')).toBeNull();
    expect(resolveComponent(FIXTURE, 'widget:clean')).toBeNull();
    expect(resolveComponent(FIXTURE, 'clean')).toBeNull();
    expect(resolveComponent(FIXTURE, ':clean')).toBeNull();
    expect(resolveComponent(FIXTURE, 'agent:')).toBeNull();
  });

  test('does not find an id under the wrong type', () => {
    expect(resolveComponent(FIXTURE, 'agent:contextscout')).toBeNull();
  });
});

// ── filesForComponent / isInstallablePath ─────────────────────────────────────

describe('filesForComponent', () => {
  test('returns files[] when present', () => {
    const skill = resolveComponent(FIXTURE, 'skill:task-management')!;
    expect(filesForComponent(skill)).toHaveLength(3);
    expect(filesForComponent(skill)).toContain('.opencode/skills/task-management/router.sh');
  });

  test('falls back to path when files[] is absent', () => {
    const ctx = resolveComponent(FIXTURE, 'context:quick-start')!;
    expect(filesForComponent(ctx)).toEqual(['.opencode/context/core/quick-start.md']);
  });
});

describe('isInstallablePath', () => {
  test('allows anything under .opencode/ and the env template', () => {
    expect(isInstallablePath('.opencode/agent/x.md')).toBe(true);
    expect(isInstallablePath('.opencode/tool/env/index.ts')).toBe(true);
    expect(isInstallablePath('env.example')).toBe(true);
  });

  test('refuses project-level files', () => {
    expect(isInstallablePath('README.md')).toBe(false);
    expect(isInstallablePath('package.json')).toBe(false);
    expect(isInstallablePath('.opencode')).toBe(false);
  });

  test('refuses absolute and traversal paths regardless of destination prefix', () => {
    expect(isInstallablePath('/tmp/escape.md')).toBe(false);
    expect(isInstallablePath('C:\\temp\\escape.md')).toBe(false);
    expect(isInstallablePath('.opencode/../escape.md')).toBe(false);
    expect(isInstallablePath('.opencode\\..\\escape.md')).toBe(false);
  });
});

// ── resolveProfile ────────────────────────────────────────────────────────────

describe('resolveProfile', () => {
  const essential = getProfile(FIXTURE, 'essential')!;

  test('expands refs to files, including every file of a multi-file skill', () => {
    const { files } = resolveProfile(FIXTURE, essential);
    expect(files).toContain('.opencode/agent/core/openagent.md');
    expect(files).toContain('.opencode/agent/subagents/core/contextscout.md');
    expect(files).toContain('.opencode/skills/task-management/router.sh');
    expect(files).toContain('.opencode/skills/task-management/scripts/task-cli.ts');
    expect(files).toContain('.opencode/command/clean.md');
    expect(files).toContain('.opencode/tool/env/index.ts');
    expect(files).toContain('env.example');
  });

  test('dedupes repeated refs and returns a sorted list', () => {
    const { files } = resolveProfile(FIXTURE, essential);
    expect(files.filter((f) => f.endsWith('openagent.md'))).toHaveLength(1);
    expect(files).toEqual([...files].sort());
  });

  test('reports unknown refs instead of throwing', () => {
    const { unresolved } = resolveProfile(FIXTURE, essential);
    expect(unresolved).toEqual(['context:does-not-exist']);
  });

  test('refuses refs that would write outside .opencode/', () => {
    const { refused, files } = resolveProfile(FIXTURE, essential);
    expect(refused).toEqual(['config:readme']);
    expect(files).not.toContain('README.md');
  });

  test('contextOnly keeps only context refs', () => {
    const { files, unresolved } = resolveProfile(FIXTURE, essential, { contextOnly: true });
    expect(files).toEqual([
      '.opencode/context/core/config/navigation.md',
      '.opencode/context/core/config/paths.json',
      '.opencode/context/core/navigation.md',
      '.opencode/context/core/quick-start.md',
      '.opencode/context/core/standards/code-quality.md',
      '.opencode/context/core/standards/navigation.md',
      '.opencode/context/index.md',
      '.opencode/context/navigation.md',
    ]);
    expect(unresolved).toEqual(['context:does-not-exist']);
  });

  test('adds the root spine and each context ancestor navigation exactly once', () => {
    const { files } = resolveProfile(FIXTURE, essential);
    expect(files).toContain('.opencode/context/index.md');
    expect(files).toContain('.opencode/context/navigation.md');
    expect(files).toContain('.opencode/context/core/config/paths.json');
    expect(files).toContain('.opencode/context/core/navigation.md');
    expect(files).toContain('.opencode/context/core/standards/navigation.md');
    expect(files.filter((file) => file === '.opencode/context/navigation.md')).toHaveLength(1);
  });

  test('an empty profile resolves to nothing', () => {
    const { files, unresolved, refused } = resolveProfile(FIXTURE, getProfile(FIXTURE, 'full')!);
    expect(files).toEqual([]);
    expect(unresolved).toEqual([]);
    expect(refused).toEqual([]);
  });
});

// ── path-shaped refs, aliases and wildcards ───────────────────────────────────

describe('resolveComponent — path-shaped context refs and aliases', () => {
  test('resolves a context by its path under .opencode/context/, with or without .md', () => {
    expect(resolveComponent(FIXTURE, 'context:core/standards/code-quality')?.id).toBe('standards-code');
    expect(resolveComponent(FIXTURE, 'context:core/config/paths.json')?.id).toBe('paths');
  });

  test('resolves an alias', () => {
    expect(resolveComponent(FIXTURE, 'context:code-standards')?.id).toBe('standards-code');
  });

  test('a path that is not in the registry is null', () => {
    expect(resolveComponent(FIXTURE, 'context:core/nope')).toBeNull();
  });
});

describe('expandRef', () => {
  test('a plain ref expands to one component', () => {
    expect(expandRef(FIXTURE, 'agent:openagent').map((c) => c.id)).toEqual(['openagent']);
    expect(expandRef(FIXTURE, 'agent:nope')).toEqual([]);
  });

  test('context:core/* expands to every context under that directory, recursively', () => {
    const ids = expandRef(FIXTURE, 'context:core/*').map((c) => c.id).sort();
    expect(ids).toEqual(['paths', 'quick-start', 'standards-code']);
  });

  test('a narrower glob only matches its subtree', () => {
    expect(expandRef(FIXTURE, 'context:core/standards/*').map((c) => c.id)).toEqual(['standards-code']);
    expect(expandRef(FIXTURE, 'context:nothing/*')).toEqual([]);
  });
});

describe('resolveProfile — wildcards', () => {
  test('a wildcard ref contributes every matching file and is not reported as unresolved', () => {
    const profile = { name: 'W', description: '', components: ['context:core/*', 'context:missing/*'] };
    const { files, unresolved } = resolveProfile(FIXTURE, profile);
    expect(files).toEqual([
      '.opencode/context/core/config/navigation.md',
      '.opencode/context/core/config/paths.json',
      '.opencode/context/core/navigation.md',
      '.opencode/context/core/quick-start.md',
      '.opencode/context/core/standards/code-quality.md',
      '.opencode/context/core/standards/navigation.md',
      '.opencode/context/index.md',
      '.opencode/context/navigation.md',
    ]);
    expect(unresolved).toEqual(['context:missing/*']);
  });
});

// ── Flavor-aware registry ─────────────────────────────────────────────────────

describe('flavor-aware registry', () => {
  test('v1 reads registry.v1.json from the package root', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = await mkdtemp(join(tmpdir(), 'oac-registry-flavor-'));
    try {
      const doc = (id: string) => JSON.stringify({ version: '1', components: { agents: [{ id, name: id, type: 'agent', path: `.opencode/agent/${id}.md` }] } });
      await writeFile(join(root, 'registry.json'), doc('v2agent'));
      await writeFile(join(root, 'registry.v1.json'), doc('v1agent'));
      expect((await readRegistry(root)).components.agents[0]?.id).toBe('v2agent');
      expect((await readRegistry(root, 'v2')).components.agents[0]?.id).toBe('v2agent');
      expect((await readRegistry(root, 'v1')).components.agents[0]?.id).toBe('v1agent');
      expect(getRegistryPath(root, 'v1')).toBe(join(root, 'registry.v1.json'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('a hosts/opencode-v1 source path is installable; traversal out of it is not', () => {
    expect(isInstallablePath('hosts/opencode-v1/agent/core/openagent.md')).toBe(true);
    expect(isInstallablePath('hosts/opencode-v1/../README.md')).toBe(false);
    expect(isInstallablePath('hosts/opencode-v1')).toBe(false);
    expect(isInstallablePath('other/hosts/opencode-v1/x')).toBe(false);
  });
});
