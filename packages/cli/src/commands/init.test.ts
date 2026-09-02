/**
 * Tests for the pure planning half of `oac init`: which files a profile installs.
 */
import { describe, test, expect } from 'bun:test';
import { planInstall, countByType, formatFileSummary } from './init.js';
import { RegistrySchema } from '../lib/registry.js';

const REGISTRY = RegistrySchema.parse({
  version: '1.0.0',
  components: {
    agents: [{ id: 'openagent', name: 'OpenAgent', type: 'agent', path: '.opencode/agent/core/openagent.md', description: '' }],
    contexts: [{ id: 'quick-start', name: 'Quick Start', type: 'context', path: '.opencode/context/core/quick-start.md', description: '' }],
    skills: [
      {
        id: 'task-management',
        name: 'Tasks',
        type: 'skill',
        path: '.opencode/skills/task-management/SKILL.md',
        description: '',
        files: ['.opencode/skills/task-management/SKILL.md', '.opencode/skills/task-management/router.sh'],
      },
    ],
  },
  profiles: {
    essential: { name: 'Essential', components: ['agent:openagent', 'context:quick-start', 'skill:task-management', 'context:missing'] },
    full: { name: 'Full', components: [] },
  },
});

const BUNDLE = [
  '.opencode/agent/core/openagent.md',
  '.opencode/agent/content/copywriter.md',
  '.opencode/context/core/quick-start.md',
  '.opencode/context/ui/web.md',
  '.opencode/skills/task-management/SKILL.md',
  '.opencode/skills/task-management/router.sh',
];

describe('planInstall', () => {
  test('essential resolves through the registry, not the whole bundle', () => {
    const plan = planInstall(REGISTRY, BUNDLE, { profile: 'essential', contextOnly: false })!;
    expect(plan.profileName).toBe('Essential');
    expect(plan.files).toEqual([
      '.opencode/agent/core/openagent.md',
      '.opencode/context/core/quick-start.md',
      '.opencode/skills/task-management/SKILL.md',
      '.opencode/skills/task-management/router.sh',
    ]);
    expect(plan.unresolved).toEqual(['context:missing']);
  });

  test('full installs every bundled file', () => {
    const plan = planInstall(REGISTRY, BUNDLE, { profile: 'full', contextOnly: false })!;
    expect(plan.files).toEqual([...BUNDLE].sort());
    expect(plan.unresolved).toEqual([]);
  });

  test('full --context-only keeps only bundled context files', () => {
    const plan = planInstall(REGISTRY, BUNDLE, { profile: 'full', contextOnly: true })!;
    expect(plan.files).toEqual(['.opencode/context/core/quick-start.md', '.opencode/context/ui/web.md']);
  });

  test('essential --context-only keeps only the profile context refs', () => {
    const plan = planInstall(REGISTRY, BUNDLE, { profile: 'essential', contextOnly: true })!;
    expect(plan.files).toEqual(['.opencode/context/core/quick-start.md']);
  });

  test('unknown profile yields null', () => {
    expect(planInstall(REGISTRY, BUNDLE, { profile: 'nope', contextOnly: false })).toBeNull();
  });
});

describe('countByType / formatFileSummary', () => {
  test('counts every bundled kind', () => {
    const counts = countByType([
      '.opencode/agent/a.md',
      '.opencode/context/c.md',
      '.opencode/context/d.md',
      '.opencode/skills/s/SKILL.md',
      '.opencode/command/x.md',
      '.opencode/tool/env/index.ts',
      'env.example',
    ]);
    expect(counts).toEqual({ agent: 1, context: 2, skill: 1, command: 1, tool: 1, config: 1 });
    expect(formatFileSummary(counts)).toBe(
      '1 agent, 2 context files, 1 skill file, 1 command, 1 tool file, 1 config file',
    );
  });

  test('empty list formats as 0 files', () => {
    expect(formatFileSummary(countByType([]))).toBe('0 files');
  });
});
