/**
 * End to end: retired files (the registry's top-level `retired` list).
 *
 * A release stopped shipping `.opencode/command/openagents/new-agents/{README.md,templates/*}` (docs,
 * not commands). Installs made earlier still hold them, and OpenCode loads the .md ones as junk
 * commands. `oac update` / `oac init` retire them under the rules used for superseded agent files:
 * normalised path under .opencode/{agent,command,skills}/, no symlinks (file or directory), the
 * bytes must still hash to a version OAC shipped (otherwise the file is the user's: left and
 * reported), a copy is taken before any file OAC cannot prove untouched is removed.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const ENTRY = join(REPO, 'packages/cli/src/index.ts');
const roots: string[] = [];

const oac = (cwd: string, packageRoot: string, args: string[], host = '2.0.30'): { code: number; out: string } => {
  const r = spawnSync('bun', [ENTRY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', HOME: cwd, OAC_PACKAGE_ROOT: packageRoot, OAC_OPENCODE_VERSION: host, OAC_OFFLINE: '1', CI: '' },
  });
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
};

const sha = (data: string | Buffer): string => createHash('sha256').update(data).digest('hex');
const DIR = '.opencode/command/openagents/new-agents';
const README_V1 = '# New agents (old readme)\n';
const README_V2 = '# New agents (newer readme)\n';
const TEMPLATE = 'name: test-config\nexpect: [a, b]\n';
const BINARYISH = Buffer.from([0x00, 0xff, 0x80, 0x0a]);

type Retired = { path: string; sha256: string[]; replacedBy?: string };

const writePackage = async (root: string, files: Record<string, string | Buffer>, retired: Retired[], flavor: 'v2' | 'v1' = 'v2'): Promise<void> => {
  const write = async (rel: string, data: string | Buffer): Promise<void> => {
    await mkdir(dirname(join(root, rel)), { recursive: true });
    await writeFile(join(root, rel), data);
  };
  await write('package.json', '{"name":"@controlstack/oac","version":"9.9.9"}\n');
  await write('.opencode/context/navigation.md', '# nav\n');
  await write('.opencode/context/index.md', '# index\n');
  for (const [rel, data] of Object.entries(files)) await write(rel, data);
  const file = flavor === 'v1' ? 'built-ai-configs/registry/registry.v1.json' : 'built-ai-configs/registry/registry.json';
  await write(file, JSON.stringify({
    version: '1',
    components: { agents: [], subagents: [], commands: [{ id: 'keep', name: 'keep', type: 'command', path: '.opencode/command/keep.md', description: 'd', dependencies: [] }] },
    profiles: { full: { name: 'Full', components: [] }, essential: { name: 'Essential', components: ['command:keep'] } },
    ...(retired.length > 0 ? { retired } : {}),
  }));
};

const OLD_FILES: Record<string, string | Buffer> = {
  '.opencode/command/keep.md': '---\ndescription: keep\n---\nkeep\n',
  [`${DIR}/README.md`]: README_V2,
  [`${DIR}/templates/agent-template.md`]: '---\ndescription: template\n---\nT\n',
  [`${DIR}/templates/t1.yaml`]: TEMPLATE,
  [`${DIR}/templates/blob.bin`]: BINARYISH,
  [`${DIR}/create-agent.md`]: '---\ndescription: create\n---\nC\n',
};
const RETIRED: Retired[] = [
  { path: `${DIR}/README.md`, sha256: [sha(README_V1), sha(README_V2)], replacedBy: 'docs/guides/new-agents/README.md' },
  { path: `${DIR}/templates/agent-template.md`, sha256: [sha('---\ndescription: template\n---\nT\n')] },
  { path: `${DIR}/templates/t1.yaml`, sha256: [sha(TEMPLATE)] },
  { path: `${DIR}/templates/blob.bin`, sha256: [sha(BINARYISH)] },
];
const NEW_FILES: Record<string, string | Buffer> = {
  '.opencode/command/keep.md': OLD_FILES['.opencode/command/keep.md']!,
  [`${DIR}/create-agent.md`]: OLD_FILES[`${DIR}/create-agent.md`]!,
};

const newProject = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'oac-retired-'));
  roots.push(dir);
  await writeFile(join(dir, 'package.json'), '{"name":"scratch"}\n');
  return dir;
};
const list = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map(async (e) => (e.isDirectory() ? (await list(join(dir, e.name))).map((f) => `${e.name}/${f}`) : [e.name])));
  return nested.flat().sort();
};
const exists = (dir: string, rel: string): Promise<boolean> => stat(join(dir, rel)).then(() => true).catch(() => false);
const manifestKeys = async (project: string): Promise<string[]> =>
  Object.keys((JSON.parse(await readFile(join(project, '.oac/manifest.json'), 'utf8')) as { files: Record<string, unknown> }).files);

afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

const setup = async (flavor: 'v2' | 'v1' = 'v2') => {
  const oldRoot = await newProject();
  const newRoot = await newProject();
  await writePackage(oldRoot, OLD_FILES, [], flavor);
  await writePackage(newRoot, NEW_FILES, RETIRED, flavor);
  const project = await newProject();
  const flags = flavor === 'v1' ? ['--opencode', 'v1'] : [];
  expect(oac(project, oldRoot, ['init', ...flags, '--profile', 'full'], flavor === 'v1' ? '1.19.3' : '2.0.30').code).toBe(0);
  return { project, newRoot, host: flavor === 'v1' ? '1.19.3' : '2.0.30' };
};

describe('oac update retires files no release ships', () => {
  test('removes pristine tracked files (md, yaml, binary), keeps commands, is idempotent, doctor goes healthy', async () => {
    const { project, newRoot } = await setup();
    expect(await list(join(project, DIR))).toContain('README.md');
    const before = oac(project, newRoot, ['doctor']);
    expect(before.out).toContain('Retired files');
    expect(before.out).toContain(`${DIR}/README.md`);
    expect(before.out).toContain('WARNING');

    const dry = oac(project, newRoot, ['update', '--dry-run']);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain(`would retire: ${DIR}/README.md`);
    expect(await exists(project, `${DIR}/README.md`)).toBe(true);

    const run = oac(project, newRoot, ['update']);
    expect(run.code).toBe(0);
    expect(await list(join(project, DIR))).toEqual(['create-agent.md']);
    expect(await exists(project, '.opencode/command/keep.md')).toBe(true);
    expect((await manifestKeys(project)).filter((k) => k.includes('new-agents'))).toEqual([`${DIR}/create-agent.md`]);
    // pristine + tracked: removed outright, nothing to back up
    expect(await list(join(project, '.oac/backups'))).toEqual([]);
    expect(oac(project, newRoot, ['update']).out).toContain('Everything is already up to date');
    const after = oac(project, newRoot, ['doctor']);
    expect(after.out).toContain('No files from earlier releases left behind');
    expect(after.out).toContain('HEALTHY');
  });

  test('a user-edited retired file is left in place with a warning; the pristine ones still go', async () => {
    const { project, newRoot } = await setup();
    await writeFile(join(project, `${DIR}/README.md`), `${README_V2}MY NOTES\n`);
    const run = oac(project, newRoot, ['update']);
    expect(run.code).toBe(0);
    expect(run.out).toContain('differs from the version OAC shipped');
    expect(await readFile(join(project, `${DIR}/README.md`), 'utf8')).toContain('MY NOTES');
    expect(await list(join(project, DIR))).toEqual(['README.md', 'create-agent.md']);
    const doctor = oac(project, newRoot, ['doctor']).out;
    expect(doctor).toContain(`${DIR}/README.md`);
    expect(doctor).toContain('edited, a symlink or your own');
  });

  test('any recorded version of the file is accepted (older release)', async () => {
    const { project, newRoot } = await setup();
    await writeFile(join(project, `${DIR}/README.md`), README_V1);
    expect(oac(project, newRoot, ['update']).code).toBe(0);
    expect(await exists(project, `${DIR}/README.md`)).toBe(false);
  });

  test('a file the manifest does not track (install.sh install) is backed up before it is removed', async () => {
    const { newRoot } = await setup();
    const project = await newProject();
    for (const [rel, data] of Object.entries(OLD_FILES)) {
      await mkdir(dirname(join(project, rel)), { recursive: true });
      await writeFile(join(project, rel), data);
    }
    const run = oac(project, newRoot, ['init', '--profile', 'full']);
    expect(run.code).toBe(0);
    expect(await list(join(project, DIR))).toEqual(['create-agent.md']);
    const backups = await list(join(project, '.oac/backups'));
    expect(backups.some((f) => f.endsWith('new-agents/README.md'))).toBe(true);
    expect(backups.some((f) => f.endsWith('templates/blob.bin'))).toBe(true);
    const copy = backups.find((f) => f.endsWith('templates/blob.bin'))!;
    expect((await readFile(join(project, '.oac/backups', copy))).equals(BINARYISH)).toBe(true);
  });

  test('a manifest entry whose retired file is already gone is dropped', async () => {
    const { project, newRoot } = await setup();
    await rm(join(project, `${DIR}/README.md`));
    expect(await manifestKeys(project)).toContain(`${DIR}/README.md`);
    expect(oac(project, newRoot, ['update']).code).toBe(0);
    expect(await manifestKeys(project)).not.toContain(`${DIR}/README.md`);
    expect(oac(project, newRoot, ['doctor']).out).toContain('HEALTHY');
  });

  test('OpenCode v1 installs retire the same files', async () => {
    const { project, newRoot, host } = await setup('v1');
    expect(await exists(project, `${DIR}/README.md`)).toBe(true);
    expect(oac(project, newRoot, ['update', '--opencode', 'v1'], host).code).toBe(0);
    expect(await list(join(project, DIR))).toEqual(['create-agent.md']);
  });
});

describe('a hostile registry or symlinks cannot make retirement leave its folder', () => {
  const hostile = async (retired: Retired[]) => {
    const oldRoot = await newProject();
    const newRoot = await newProject();
    await writePackage(oldRoot, OLD_FILES, []);
    await writePackage(newRoot, NEW_FILES, retired);
    const project = await newProject();
    expect(oac(project, oldRoot, ['init', '--profile', 'full']).code).toBe(0);
    return { project, newRoot };
  };

  test('paths outside agent/, command/ and skills/, traversal and backslashes are ignored, even on a hash match', async () => {
    const victim = 'precious\n';
    const { project, newRoot } = await hostile([
      { path: '.opencode/context/index.md', sha256: [sha('# index\n')] },
      { path: '.opencode/context/navigation.md', sha256: [sha('# nav\n')] },
      { path: '.opencode/command/../context/navigation.md', sha256: [sha('# nav\n')] },
      { path: '.opencode/command/./keep.md', sha256: [sha(OLD_FILES['.opencode/command/keep.md']!)] },
      { path: '.opencode\\command\\keep.md', sha256: [sha(OLD_FILES['.opencode/command/keep.md']!)] },
      { path: '../outside.md', sha256: [sha(victim)] },
      { path: '/etc/hosts', sha256: [sha(victim)] },
      { path: '.opencode/tool/x.ts', sha256: [sha(victim)] },
      { path: '.opencode/command', sha256: [sha(victim)] },
    ]);
    await mkdir(join(project, '.opencode/tool'), { recursive: true });
    await writeFile(join(project, '.opencode/tool/x.ts'), victim);
    const before = await list(join(project, '.opencode'));
    const run = oac(project, newRoot, ['update']);
    expect(run.code).toBe(0);
    expect(await list(join(project, '.opencode'))).toEqual(before);
    expect(oac(project, newRoot, ['doctor']).out).toContain('No files from earlier releases left behind');
  });

  test('a symlinked directory cannot be used to remove a file outside the project', async () => {
    const { project, newRoot } = await hostile([{ path: '.opencode/command/linkdir/victim.md', sha256: [sha('v\n')] }]);
    const outside = await newProject();
    await writeFile(join(outside, 'victim.md'), 'v\n');
    await symlink(outside, join(project, '.opencode/command/linkdir'));
    const run = oac(project, newRoot, ['update']);
    expect(run.code).toBe(0);
    expect(run.out).toContain('is a symlink or sits behind one');
    expect(await readFile(join(outside, 'victim.md'), 'utf8')).toBe('v\n');
  });

  test('a symlinked file is neither read nor removed', async () => {
    const { project, newRoot } = await hostile([{ path: '.opencode/skills/old-skill/notes.md', sha256: [sha('v\n')] }]);
    const outside = await newProject();
    await writeFile(join(outside, 'real.md'), 'v\n');
    await mkdir(join(project, '.opencode/skills/old-skill'), { recursive: true });
    await symlink(join(outside, 'real.md'), join(project, '.opencode/skills/old-skill/notes.md'));
    const run = oac(project, newRoot, ['update']);
    expect(run.code).toBe(0);
    expect(run.out).toContain('is a symlink or sits behind one');
    expect(await readFile(join(outside, 'real.md'), 'utf8')).toBe('v\n');
    expect((await stat(join(project, '.opencode/skills/old-skill/notes.md'))).isFile()).toBe(true);
  });

  test('skills/ and agent/ are valid roots: a hash-matching leftover there is retired (with a backup, it is untracked)', async () => {
    const { project, newRoot } = await hostile([
      { path: '.opencode/skills/old-skill/SKILL.md', sha256: [sha('s\n')] },
      { path: '.opencode/agent/old-agent.md', sha256: [sha('a\n')] },
    ]);
    await mkdir(join(project, '.opencode/skills/old-skill'), { recursive: true });
    await mkdir(join(project, '.opencode/agent'), { recursive: true });
    await writeFile(join(project, '.opencode/skills/old-skill/SKILL.md'), 's\n');
    await writeFile(join(project, '.opencode/agent/old-agent.md'), 'a\n');
    await writeFile(join(project, '.opencode/skills/old-skill/mine.md'), 'user file\n');
    expect(oac(project, newRoot, ['update']).code).toBe(0);
    expect(await exists(project, '.opencode/skills/old-skill/SKILL.md')).toBe(false);
    expect(await exists(project, '.opencode/agent/old-agent.md')).toBe(false);
    expect(await readFile(join(project, '.opencode/skills/old-skill/mine.md'), 'utf8')).toBe('user file\n');
    const backups = await list(join(project, '.oac/backups'));
    expect(backups.some((f) => f.endsWith('old-skill/SKILL.md'))).toBe(true);
    expect(backups.some((f) => f.endsWith('old-agent.md'))).toBe(true);
  });
});
