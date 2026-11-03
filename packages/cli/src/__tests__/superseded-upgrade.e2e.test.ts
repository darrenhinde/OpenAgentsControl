/**
 * End to end: upgrading an install across a release that renamed and moved agents.
 *
 * The "old release" and "new release" are two small hand-built package roots (same shape as the
 * real bundle: registry + agent files), so the test pins the MECHANISM, not the agent roster:
 *   v2: tester.md / contextscout.md are renamed (aliases) to test-engineer.md / context-scout.md;
 *   v1: agent/subagents/<cat>/x.md moved to agent/<cat>/x.md (oac.previousPaths) and one was renamed.
 * After `oac update` there must be no duplicate, an edited old file must be backed up (not lost),
 * a user's own agent must survive, `--dry-run` must say "would remove", and a second run is a no-op.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const ENTRY = join(REPO, 'packages/cli/src/index.ts');
const roots: string[] = [];

type Run = { code: number; out: string };
const oac = (cwd: string, packageRoot: string, args: string[], host: string): Run => {
  const r = spawnSync('bun', [ENTRY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', HOME: cwd, OAC_PACKAGE_ROOT: packageRoot, OAC_OPENCODE_VERSION: host, OAC_OFFLINE: '1', CI: '' },
  });
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
};

const agentText = (description: string, extra = ''): string =>
  `---\ndescription: ${description}\nmode: subagent\n---\nbody ${description}${extra}\n`;

type Agent = { id: string; path: string; description: string; aliases?: string[]; supersedes?: string[] };

const writePackage = async (root: string, flavor: 'v1' | 'v2', agents: Agent[]): Promise<void> => {
  const write = async (rel: string, text: string): Promise<void> => {
    await mkdir(dirname(join(root, rel)), { recursive: true });
    await writeFile(join(root, rel), text);
  };
  await write('package.json', '{"name":"@controlstack/oac","version":"9.9.9"}\n');
  await write('.opencode/context/navigation.md', '# nav\n');
  await write('.opencode/context/index.md', '# index\n');
  for (const agent of agents) await write(agent.path, agentText(agent.description));
  const entries = agents.map((a) => ({
    id: a.id, name: a.id, type: 'subagent', path: a.path, description: a.description, dependencies: [],
    ...(a.aliases ? { aliases: a.aliases } : {}), ...(a.supersedes ? { supersedes: a.supersedes } : {}),
  }));
  const file = flavor === 'v1' ? 'built-ai-configs/registry/registry.v1.json' : 'built-ai-configs/registry/registry.json';
  await write(file, JSON.stringify({ version: '1', components: { agents: [], subagents: entries }, profiles: {
      full: { name: 'Full', components: [] },
      essential: { name: 'Essential', components: agents.map((a) => `subagent:${a.id}`) },
    } }));
};

const newProject = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'oac-superseded-'));
  roots.push(dir);
  await writeFile(join(dir, 'package.json'), '{"name":"scratch"}\n');
  return dir;
};
const list = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (e) => (e.isDirectory() ? (await list(join(dir, e.name))).map((f) => `${e.name}/${f}`) : [e.name])),
  );
  return nested.flat().sort();
};
const exists = (dir: string, rel: string): Promise<boolean> => stat(join(dir, rel)).then(() => true).catch(() => false);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe('upgrade across a rename (OpenCode v2, flat agents)', () => {
  const setup = async () => {
    const oldRoot = await newProject();
    const newRoot = await newProject();
    await writePackage(oldRoot, 'v2', [
      { id: 'tester', path: '.opencode/agent/tester.md', description: 'Test authoring agent' },
      { id: 'contextscout', path: '.opencode/agent/contextscout.md', description: 'Finds context' },
      { id: 'steady', path: '.opencode/agent/steady.md', description: 'Unchanged agent' },
    ]);
    await writePackage(newRoot, 'v2', [
      { id: 'test-engineer', path: '.opencode/agent/test-engineer.md', description: 'Test authoring agent', aliases: ['tester'], supersedes: ['.opencode/agent/tester.md'] },
      { id: 'context-scout', path: '.opencode/agent/context-scout.md', description: 'Finds context', aliases: ['contextscout'], supersedes: ['.opencode/agent/contextscout.md'] },
      { id: 'steady', path: '.opencode/agent/steady.md', description: 'Unchanged agent' },
    ]);
    const project = await newProject();
    expect(oac(project, oldRoot, ['init', '--profile', 'full'], '2.0.30').code).toBe(0);
    return { project, newRoot };
  };

  test('removes the old files, backs up an edited one, keeps custom agents, is idempotent', async () => {
    const { project, newRoot } = await setup();
    await writeFile(join(project, '.opencode/agent/tester.md'), agentText('Test authoring agent', ' MY EDIT'));
    await writeFile(join(project, '.opencode/agent/my-own.md'), agentText('my own agent'));
    // The user's own agent that merely shares an old id: not the old OAC file, so it is left alone.
    await writeFile(join(project, '.opencode/agent/contextscout.md'), agentText('Finds context'));
    expect(await list(join(project, '.opencode/agent'))).toEqual(['contextscout.md', 'my-own.md', 'steady.md', 'tester.md']);

    const dry = oac(project, newRoot, ['update', '--dry-run'], '2.0.30');
    expect(dry.code).toBe(0);
    expect(dry.out).toContain('would remove: .opencode/agent/tester.md (after backing it up)');
    expect(dry.out).toContain('would remove: .opencode/agent/contextscout.md');
    expect(await exists(project, '.opencode/agent/tester.md')).toBe(true);
    expect(await exists(project, '.opencode/agent/test-engineer.md')).toBe(false);

    const run = oac(project, newRoot, ['update'], '2.0.30');
    expect(run.code).toBe(0);
    expect(run.out).toContain('Removed (superseded by a renamed or moved agent');
    expect(await list(join(project, '.opencode/agent'))).toEqual(['context-scout.md', 'my-own.md', 'steady.md', 'test-engineer.md']);

    const backups = (await list(join(project, '.oac/backups'))).filter((f) => f.endsWith('tester.md'));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(project, '.oac/backups', backups[0]!), 'utf8')).toContain('MY EDIT');
    expect(await readFile(join(project, '.opencode/agent/my-own.md'), 'utf8')).toContain('my own agent');
    const manifest = JSON.parse(await readFile(join(project, '.oac/manifest.json'), 'utf8')) as { files: Record<string, unknown> };
    expect(Object.keys(manifest.files).filter((f) => f.endsWith('/tester.md') || f.endsWith('/contextscout.md'))).toEqual([]);

    const again = oac(project, newRoot, ['update'], '2.0.30');
    expect(again.code).toBe(0);
    expect(again.out).toContain('Everything is already up to date');
    expect(await list(join(project, '.opencode/agent'))).toEqual(['context-scout.md', 'my-own.md', 'steady.md', 'test-engineer.md']);
  });

  test('a user-owned agent that only shares an old id is left in place with a warning', async () => {
    const { project, newRoot } = await setup();
    // Not tracked as OAC's and unlike the old bundled copy.
    await rm(join(project, '.oac/manifest.json'));
    await writeFile(join(project, '.opencode/agent/tester.md'), agentText('My team tester, nothing to do with OAC'));
    // Re-adopt: init records what is there; the foreign tester.md is protected, not OAC's.
    const adopt = oac(project, newRoot, ['init', '--profile', 'full'], '2.0.30');
    expect(adopt.code).toBe(0);
    expect(adopt.out).toContain('looks like your own agent, not the old OAC one replaced by');
    expect(adopt.out).toContain('.opencode/agent/tester.md');
    expect(await exists(project, '.opencode/agent/tester.md')).toBe(true);
    expect(await readFile(join(project, '.opencode/agent/tester.md'), 'utf8')).toContain('My team tester');
    expect(await exists(project, '.opencode/agent/test-engineer.md')).toBe(true);
  });

  test('a tracked file the user fully replaced is left with a warning, not backed up and removed', async () => {
    const { project, newRoot } = await setup();
    await writeFile(join(project, '.opencode/agent/tester.md'), agentText('A completely different tester'));
    const dry = oac(project, newRoot, ['update', '--dry-run'], '2.0.30');
    expect(dry.out).not.toContain('would remove: .opencode/agent/tester.md');
    expect(dry.out).toContain('would supersede: .opencode/agent/contextscout.md');
    expect(dry.out).not.toContain('superseded: ');
    const run = oac(project, newRoot, ['update'], '2.0.30');
    expect(run.code).toBe(0);
    expect(run.out).toContain('looks like your own agent, not the old OAC one replaced by');
    expect(await readFile(join(project, '.opencode/agent/tester.md'), 'utf8')).toContain('A completely different tester');
    expect(await exists(project, '.opencode/agent/contextscout.md')).toBe(false);
    expect((await list(join(project, '.oac/backups'))).filter((f) => f.endsWith('tester.md'))).toEqual([]);
  });

  test('a manifest entry whose superseded file is already gone is dropped, and doctor is healthy', async () => {
    const { project, newRoot } = await setup();
    // A crash between the removal and the manifest write, or the user deleting the duplicate by hand.
    await rm(join(project, '.opencode/agent/tester.md'));
    const before = JSON.parse(await readFile(join(project, '.oac/manifest.json'), 'utf8')) as { files: Record<string, unknown> };
    expect(Object.keys(before.files)).toContain('.opencode/agent/tester.md');
    expect(oac(project, newRoot, ['update'], '2.0.30').code).toBe(0);
    const after = JSON.parse(await readFile(join(project, '.oac/manifest.json'), 'utf8')) as { files: Record<string, unknown> };
    expect(Object.keys(after.files)).not.toContain('.opencode/agent/tester.md');
    expect(Object.keys(after.files)).not.toContain('.opencode/agent/contextscout.md');
    expect(oac(project, newRoot, ['doctor'], '2.0.30').out).toContain('HEALTHY');
  });

  test('oac doctor warns about both copies and names the fix; the fix clears it', async () => {
    const { project, newRoot } = await setup();
    // What install.sh / update.sh leave behind: the new files next to the old ones.
    await writeFile(join(project, '.opencode/agent/test-engineer.md'), agentText('Test authoring agent'));
    const before = oac(project, newRoot, ['doctor'], '2.0.30');
    expect(before.out).toContain('Superseded files');
    expect(before.out).toContain('.opencode/agent/tester.md -> .opencode/agent/test-engineer.md');
    expect(before.out).toContain("run 'oac update'");
    expect(before.out).toContain('WARNING');
    expect(oac(project, newRoot, ['update'], '2.0.30').code).toBe(0);
    const after = oac(project, newRoot, ['doctor'], '2.0.30');
    expect(after.out).toContain('No renamed or moved agents left behind');
    expect(after.out).toContain('HEALTHY');
  });

  test('oac init over an install.sh install (no manifest) retires the old copy too', async () => {
    const { newRoot } = await setup();
    const project = await newProject();
    await mkdir(join(project, '.opencode/agent'), { recursive: true });
    await writeFile(join(project, '.opencode/agent/tester.md'), agentText('Test authoring agent'));
    await writeFile(join(project, '.opencode/agent/steady.md'), agentText('Unchanged agent'));
    const run = oac(project, newRoot, ['init', '--profile', 'full'], '2.0.30');
    expect(run.code).toBe(0);
    expect(run.out).toContain('superseded by renamed or moved agents');
    expect(await list(join(project, '.opencode/agent'))).toEqual(['context-scout.md', 'steady.md', 'test-engineer.md']);
    expect((await list(join(project, '.oac/backups'))).some((f) => f.endsWith('tester.md'))).toBe(true);
  });
});

describe('upgrade across a folder move (OpenCode v1, nested agents)', () => {
  test('agent/subagents/<cat>/x.md moves to agent/<cat>/x.md without leaving a duplicate', async () => {
    const oldRoot = await newProject();
    const newRoot = await newProject();
    const v1 = 'built-ai-configs/opencode-v1/agent';
    await writePackage(oldRoot, 'v1', [
      { id: 'reviewer', path: `${v1}/subagents/code/reviewer.md`, description: 'Reviews code' },
      { id: 'task-manager', path: `${v1}/subagents/core/task-manager.md`, description: 'Breaks down tasks' },
    ]);
    await writeFile(join(oldRoot, `${v1}/subagents/core/0-category.json`), '{"name":"core"}\n');
    await writePackage(newRoot, 'v1', [
      { id: 'code-reviewer', path: `${v1}/code/code-reviewer.md`, description: 'Reviews code', aliases: ['reviewer'], supersedes: [`${v1}/code/reviewer.md`, `${v1}/subagents/code/reviewer.md`] },
      { id: 'task-manager', path: `${v1}/core/task-manager.md`, description: 'Breaks down tasks', supersedes: [`${v1}/subagents/core/task-manager.md`] },
    ]);
    const project = await newProject();
    expect(oac(project, oldRoot, ['init', '--opencode', 'v1', '--profile', 'full'], '1.19.3').code).toBe(0);
    await writeFile(join(project, '.opencode/agent/subagents/code/reviewer.md'), agentText('Reviews code', ' EDITED'));
    await writeFile(join(project, '.opencode/agent/subagents/code/mine.md'), agentText('mine'));
    expect(await exists(project, '.opencode/agent/subagents/core/0-category.json')).toBe(true);

    const run = oac(project, newRoot, ['update'], '1.19.3');
    expect(run.code).toBe(0);
    expect(await list(join(project, '.opencode/agent'))).toEqual([
      'code/code-reviewer.md', 'core/task-manager.md', 'subagents/code/mine.md',
    ]);
    const backups = (await list(join(project, '.oac/backups'))).filter((f) => f.endsWith('reviewer.md'));
    expect(backups).toHaveLength(1);
    expect(await readFile(join(project, '.oac/backups', backups[0]!), 'utf8')).toContain('EDITED');

    const doctor = oac(project, newRoot, ['doctor'], '1.19.3');
    expect(doctor.out).toContain('HEALTHY');
    const again = oac(project, newRoot, ['update'], '1.19.3');
    expect(again.out).toContain('Everything is already up to date');
  });
});

describe('oac apply claude and superseded agents', () => {
  test('does not convert a stale installed agent whose id is an alias of an installed canonical agent', async () => {
    const project = await newProject();
    await mkdir(join(project, '.opencode/agent'), { recursive: true });
    const current = await readFile(join(REPO, '.opencode/agent/test-engineer.md'), 'utf8');
    await writeFile(join(project, '.opencode/agent/test-engineer.md'), current);
    await writeFile(join(project, '.opencode/agent/tester.md'), current);
    await writeFile(join(project, '.opencode/agent/documentation.md'), current);
    await writeFile(join(project, '.opencode/agent/doc-writer.md'), await readFile(join(REPO, '.opencode/agent/doc-writer.md'), 'utf8'));
    await writeFile(join(project, '.opencode/agent/my-own.md'), current);

    const run = oac(project, REPO, ['apply', 'claude'], '2.0.30');
    expect(run.code).toBe(0);
    expect(run.out).toContain('Skipping 2 superseded agent(s)');
    const written = await list(join(project, '.claude/agents'));
    expect(written).toContain('test-engineer.md');
    expect(written).not.toContain('tester.md');
    expect(written).not.toContain('documentation.md');
    expect(written).toContain('doc-writer.md');
    // Only a stale copy is skipped: once doc-writer is gone, documentation.md is the only copy and still converts (only tester is skipped).
    await rm(join(project, '.opencode/agent/doc-writer.md'));
    await rm(join(project, '.claude'), { recursive: true });
    expect(oac(project, REPO, ['apply', 'claude'], '2.0.30').out).toContain('Skipping 1 superseded agent(s)');
  });
});

describe('a hostile registry or symlinks cannot make the removal leave agent/', () => {
  /** A new release whose test-engineer claims to supersede `supersedes`; returns it with an upgraded project. */
  const hostile = async (supersedes: string[]) => {
    const oldRoot = await newProject();
    const newRoot = await newProject();
    await writePackage(oldRoot, 'v2', [{ id: 'tester', path: '.opencode/agent/tester.md', description: 'Test authoring agent' }]);
    await writePackage(newRoot, 'v2', [
      { id: 'test-engineer', path: '.opencode/agent/test-engineer.md', description: 'Test authoring agent', supersedes },
    ]);
    const project = await newProject();
    expect(oac(project, oldRoot, ['init', '--profile', 'full'], '2.0.30').code).toBe(0);
    return { project, newRoot };
  };

  test('supersedes outside agent/ or not .md is ignored (context files, other extensions, traversal)', async () => {
    const { project, newRoot } = await hostile([
      '.opencode/context/index.md', '.opencode/agent/notes.txt', '.opencode/agent/../context/navigation.md', '.opencode/agent/tester.md',
    ]);
    await mkdir(join(project, '.opencode/context'), { recursive: true });
    await writeFile(join(project, '.opencode/context/index.md'), agentText('Test authoring agent'));
    await writeFile(join(project, '.opencode/context/navigation.md'), agentText('Test authoring agent'));
    await writeFile(join(project, '.opencode/agent/notes.txt'), 'keep');
    const before = await list(join(project, '.opencode'));
    const run = oac(project, newRoot, ['update'], '2.0.30');
    expect(run.code).toBe(0);
    expect(await exists(project, '.opencode/context/index.md')).toBe(true);
    expect(await exists(project, '.opencode/context/navigation.md')).toBe(true);
    expect(await exists(project, '.opencode/agent/notes.txt')).toBe(true);
    // Only the legitimate agent/tester.md entry was acted on.
    expect(await list(join(project, '.opencode'))).toEqual(
      [...before.filter((f) => f !== 'agent/tester.md'), 'agent/test-engineer.md'].sort(),
    );
  });

  test('a symlinked directory under agent/ cannot be used to remove a file outside the project', async () => {
    const { project, newRoot } = await hostile(['.opencode/agent/linkdir/victim.md']);
    const outside = await newProject();
    await writeFile(join(outside, 'victim.md'), agentText('Test authoring agent'));
    await symlink(outside, join(project, '.opencode/agent/linkdir'));
    const run = oac(project, newRoot, ['update'], '2.0.30');
    expect(run.code).toBe(0);
    expect(run.out).toContain('is a symlink or sits behind one');
    expect(await exists(outside, 'victim.md')).toBe(true);
    expect(await list(join(project, '.oac/backups')).then((l) => l.filter((f) => f.endsWith('victim.md')))).toEqual([]);
  });

  test('a symlinked file is neither read nor removed', async () => {
    const { project, newRoot } = await hostile(['.opencode/agent/linked.md']);
    const outside = await newProject();
    await writeFile(join(outside, 'real.md'), agentText('Test authoring agent'));
    await symlink(join(outside, 'real.md'), join(project, '.opencode/agent/linked.md'));
    const run = oac(project, newRoot, ['update'], '2.0.30');
    expect(run.code).toBe(0);
    expect(run.out).toContain('is a symlink or sits behind one');
    expect(await readFile(join(outside, 'real.md'), 'utf8')).toContain('Test authoring agent');
    expect((await stat(join(project, '.opencode/agent/linked.md'))).isFile()).toBe(true);
  });
});
