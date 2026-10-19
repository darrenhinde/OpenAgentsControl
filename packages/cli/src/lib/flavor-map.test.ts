import { describe, test, expect } from 'bun:test';
import { mapTrackedFiles } from './flavor-map.js';
import { RegistrySchema } from './registry.js';

const registry = (components: Record<string, Array<{ id: string; path: string; files?: string[] }>>) =>
  RegistrySchema.parse({
    version: '1',
    components: Object.fromEntries(
      Object.entries(components).map(([k, v]) => [k, v.map((c) => ({ ...c, name: c.id, type: k === 'agents' ? 'agent' : k === 'tools' ? 'tool' : k === 'skills' ? 'skill' : 'context' }))]),
    ),
  });

const v1 = registry({
  agents: [{ id: 'openagent', path: 'v1-opencode/agent/core/openagent.md' }],
  tools: [{ id: 'gemini', path: 'v1-opencode/tool/gemini/index.ts' }],
  skills: [{ id: 'task-management', path: 'v1-opencode/skills/task-management/SKILL.md', files: ['v1-opencode/skills/task-management/SKILL.md', '.opencode/skills/task-management/router.sh'] }],
  contexts: [{ id: 'nav', path: '.opencode/context/navigation.md' }],
});
const v2 = registry({
  agents: [{ id: 'openagent', path: '.opencode/agent/openagent.md' }],
  tools: [],
  skills: [{ id: 'task-management', path: '.opencode/skills/task-management/SKILL.md', files: ['.opencode/skills/task-management/SKILL.md', '.opencode/skills/task-management/router.sh'] }],
  contexts: [{ id: 'nav', path: '.opencode/context/navigation.md' }],
});

describe('mapTrackedFiles', () => {
  test('v1 -> v2 maps a tracked component to the same component in the target registry', () => {
    const tracked = ['.opencode/agent/core/openagent.md', '.opencode/tool/gemini/index.ts', '.opencode/skills/task-management/SKILL.md', '.opencode/context/navigation.md'];
    expect(mapTrackedFiles(tracked, v1, v2)).toEqual([
      '.opencode/agent/openagent.md',
      '.opencode/context/navigation.md',
      '.opencode/skills/task-management/SKILL.md',
      '.opencode/skills/task-management/router.sh',
    ]);
  });

  test('v2 -> v1 maps back, producing v1-opencode SOURCE paths', () => {
    const out = mapTrackedFiles(['.opencode/agent/openagent.md'], v2, v1);
    expect(out).toEqual(['v1-opencode/agent/core/openagent.md']);
  });

  test('same flavor is the identity on component files', () => {
    expect(mapTrackedFiles(['.opencode/agent/core/openagent.md'], v1, v1)).toEqual(['v1-opencode/agent/core/openagent.md']);
  });

  test('a tracked file no registry knows is kept as it is', () => {
    expect(mapTrackedFiles(['.opencode/context/custom/x.md'], v1, v2)).toEqual(['.opencode/context/custom/x.md']);
  });

  test('a component the target does not ship is dropped, not invented', () => {
    expect(mapTrackedFiles(['.opencode/tool/gemini/index.ts'], v1, v2)).toEqual([]);
  });
});
