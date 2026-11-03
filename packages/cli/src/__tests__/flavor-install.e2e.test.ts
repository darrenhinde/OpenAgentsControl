/**
 * End to end: the real `oac` CLI against throwaway projects.
 *
 * Proves the contract of the dual OpenCode build on the install side:
 *   - v2 is the default and v1 is only ever an explicit opt-in;
 *   - `--opencode v1` writes a COMPLETE v1 `.opencode/` into the project (agents, tools, plugins,
 *     skills, commands, context) and never a `built-ai-configs/opencode-v1/` folder;
 *   - the choice is recorded and `add` / `update` honour it;
 *   - a v1-layout install is migrated or kept, never silently moved;
 *   - `oac doctor` flags a mismatch with the OpenCode on PATH.
 *
 * The host is never run: `OAC_OPENCODE_VERSION` stands in for `opencode --version`, and
 * `OAC_OFFLINE=1` keeps doctor off the network.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintV1Agents, lintV2Agents } from '@controlstack/agent-compiler';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const ENTRY = join(REPO, 'packages/cli/src/index.ts');
const roots: string[] = [];

type Run = { code: number; out: string };

const oac = (cwd: string, args: string[], host = '2.0.30'): Run => {
  const r = spawnSync('bun', [ENTRY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', HOME: cwd, OAC_PACKAGE_ROOT: REPO, OAC_OPENCODE_VERSION: host, OAC_OFFLINE: '1', CI: '' },
  });
  return { code: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
};

const newProject = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'oac-flavor-e2e-'));
  roots.push(dir);
  await writeFile(join(dir, 'package.json'), '{"name":"scratch"}\n');
  return dir;
};
const exists = (dir: string, rel: string): Promise<boolean> => stat(join(dir, rel)).then(() => true).catch(() => false);
const walk = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (e) => (e.isDirectory() ? (await walk(join(dir, e.name))).map((f) => `${e.name}/${f}`) : [e.name])),
  );
  return nested.flat();
};
const config = async (dir: string): Promise<{ opencode?: { target: string } }> =>
  JSON.parse(await readFile(join(dir, '.oac/config.json'), 'utf8'));
const agentTexts = async (dir: string): Promise<Array<{ path: string; text: string }>> => {
  const files = (await walk(join(dir, '.opencode/agent'))).filter((f) => f.endsWith('.md'));
  return Promise.all(files.map(async (f) => ({ path: `.opencode/agent/${f}`, text: await readFile(join(dir, '.opencode/agent', f), 'utf8') })));
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((r) => rm(r, { recursive: true, force: true })));
});

describe('oac init', () => {
  test('defaults to v2: flat agents, no v1 tools or plugins, flavor recorded', async () => {
    const dir = await newProject();
    const r = oac(dir, ['init', '--profile', 'full']);
    expect(r.code).toBe(0);

    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(true);
    expect(await exists(dir, '.opencode/agent/core')).toBe(false);
    expect(await exists(dir, '.opencode/tool')).toBe(false);
    expect(await exists(dir, '.opencode/plugin')).toBe(false);
    expect(await exists(dir, '.opencode/agent/image-specialist.md')).toBe(false);
    expect((await config(dir)).opencode).toEqual({ target: 'v2' });
    expect(lintV2Agents(await agentTexts(dir))).toEqual([]);
  });

  test('--opencode v1 writes a complete v1 .opencode/ and never a built-ai-configs/ folder', async () => {
    const dir = await newProject();
    const r = oac(dir, ['init', '--opencode', 'v1', '--profile', 'full'], '1.19.3');
    expect(r.code).toBe(0);

    // agents: nested, v1 names
    const openagent = await readFile(join(dir, '.opencode/agent/core/openagent.md'), 'utf8');
    expect(openagent).toMatch(/^name: OpenAgent$/m);
    expect(await exists(dir, '.opencode/agent/core/context-scout.md')).toBe(true);
    expect(await exists(dir, '.opencode/agent/content/image-specialist.md')).toBe(true);
    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(false);
    // everything else v1 needs
    expect(await exists(dir, '.opencode/tool/gemini/index.ts')).toBe(true);
    expect(await exists(dir, '.opencode/tool/index.ts')).toBe(true);
    expect(await exists(dir, '.opencode/plugin/notify.ts')).toBe(true);
    expect(await exists(dir, '.opencode/skills/task-management/SKILL.md')).toBe(true);
    expect(await exists(dir, '.opencode/command/openagents/check-context-deps.md')).toBe(true);
    expect(await exists(dir, '.opencode/context/navigation.md')).toBe(true);
    // the v1 variant of the hand-authored command, not the v2 rewrite
    expect(await readFile(join(dir, '.opencode/command/openagents/check-context-deps.md'), 'utf8')).toContain('subagent_type=');
    // the source folder name never reaches a project
    expect(await exists(dir, 'built-ai-configs')).toBe(false);
    expect(await readFile(join(dir, '.oac/manifest.json'), 'utf8')).not.toContain('built-ai-configs/');
    expect((await config(dir)).opencode).toEqual({ target: 'v1' });
    // and what landed is valid for v1
    expect(lintV1Agents(await agentTexts(dir))).toEqual([]);
  });

  test('is never v1 by inference: a v1 host without the flag still gets v2, with a warning', async () => {
    const dir = await newProject();
    const r = oac(dir, ['init'], '1.19.3');
    expect(r.code).toBe(0);
    expect(r.out).toContain('--opencode v1');
    expect((await config(dir)).opencode).toEqual({ target: 'v2' });
    expect(await exists(dir, '.opencode/agent/core')).toBe(false);
  });

  test('rejects an unknown flavor', async () => {
    const dir = await newProject();
    const r = oac(dir, ['init', '--opencode', 'v3']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('v1 or v2');
  });

  test('a re-run keeps the recorded flavor, and refuses to switch it', async () => {
    const dir = await newProject();
    oac(dir, ['init', '--opencode', 'v1'], '1.19.3');
    expect(oac(dir, ['init'], '1.19.3').code).toBe(0);
    expect((await config(dir)).opencode).toEqual({ target: 'v1' });
    const bad = oac(dir, ['init', '--opencode', 'v2']);
    expect(bad.code).toBe(1);
    expect(bad.out).toContain('oac update --opencode v2');
  });
});

describe('oac add and update honour the recorded flavor', () => {
  test('a renamed agent still installs by its old id, through the registry alias', async () => {
    const v2 = await newProject();
    oac(v2, ['init']);
    expect(oac(v2, ['add', 'subagent:tester']).code).toBe(0);
    expect(await exists(v2, '.opencode/agent/test-engineer.md')).toBe(true);
    expect(await exists(v2, '.opencode/agent/tester.md')).toBe(false);
  });

  test('add resolves against the v1 registry in a v1 project, and the v2 one otherwise', async () => {
    const v1 = await newProject();
    oac(v1, ['init', '--opencode', 'v1'], '1.19.3');
    expect(oac(v1, ['add', 'subagent:image-specialist'], '1.19.3').code).toBe(0);
    expect(await exists(v1, '.opencode/agent/content/image-specialist.md')).toBe(true);

    const v2 = await newProject();
    oac(v2, ['init']);
    const r = oac(v2, ['add', 'subagent:image-specialist']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('not found');
  });

  test('update keeps a v1 project on v1 even when the host says v2', async () => {
    const dir = await newProject();
    oac(dir, ['init', '--opencode', 'v1'], '1.19.3');
    const r = oac(dir, ['update'], '2.0.30');
    expect(r.code).toBe(0);
    expect(await exists(dir, '.opencode/agent/core/openagent.md')).toBe(true);
    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(false);
    expect((await config(dir)).opencode).toEqual({ target: 'v1' });
  });

  test('update --opencode switches layouts and prunes the other one', async () => {
    const dir = await newProject();
    oac(dir, ['init', '--opencode', 'v1', '--profile', 'full'], '1.19.3');
    expect(await exists(dir, '.opencode/agent/core/openagent.md')).toBe(true);

    const r = oac(dir, ['update', '--opencode', 'v2'], '2.0.30');
    expect(r.code).toBe(0);
    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(true);
    expect(await exists(dir, '.opencode/agent/core')).toBe(false);
    expect(await exists(dir, '.opencode/agent/code')).toBe(false);
    expect(await exists(dir, '.opencode/tool/gemini')).toBe(false);
    expect((await config(dir)).opencode).toEqual({ target: 'v2' });
    expect(lintV2Agents(await agentTexts(dir))).toEqual([]);
    // the shell scripts' marker follows the config, so update.sh does not refuse a migrated project
    expect(await readFile(join(dir, '.opencode/.oac-opencode'), 'utf8')).toBe('v2\n');
  });

  test('a switch also removes untracked files of the previous flavor, backing up edited ones (install.sh leftovers)', async () => {
    const copy = async (dir: string, from: string, to: string, edit = false): Promise<void> => {
      const text = await readFile(join(REPO, from), 'utf8');
      await mkdir(join(dir, to, '..'), { recursive: true });
      await writeFile(join(dir, to), edit ? `${text}\nMY EDIT\n` : text);
    };
    // v1 -> v2: files install.sh placed that the CLI's profile (and so the manifest) does not know.
    const v1 = await newProject();
    oac(v1, ['init', '--opencode', 'v1', '--profile', 'essential'], '1.19.3');
    await copy(v1, 'built-ai-configs/opencode-v1/agent/code/coder-agent.md', '.opencode/agent/code/coder-agent.md');
    await copy(v1, 'built-ai-configs/opencode-v1/agent/core/batch-executor.md', '.opencode/agent/core/batch-executor.md', true);
    expect(oac(v1, ['update', '--opencode', 'v2'], '2.0.30').code).toBe(0);
    expect(await exists(v1, '.opencode/agent/code')).toBe(false);
    expect((await walk(join(v1, '.oac/backups'))).filter((f) => f.endsWith('batch-executor.md')).length).toBe(1);

    // v2 -> v1: a flat v2 agent left behind.
    const v2 = await newProject();
    oac(v2, ['init', '--profile', 'essential']);
    await copy(v2, 'built-ai-configs/opencode/agent/coder-agent.md', '.opencode/agent/coder-agent.md');
    expect(oac(v2, ['update', '--opencode', 'v1'], '1.19.3').code).toBe(0);
    expect(await exists(v2, '.opencode/agent/coder-agent.md')).toBe(false);
    expect(await exists(v2, '.opencode/agent/core/openagent.md')).toBe(true);
  });

  test('update --check words its summary as a preview', async () => {
    const dir = await newProject();
    oac(dir, ['init', '--opencode', 'v1', '--profile', 'essential'], '1.19.3');
    const r = oac(dir, ['update', '--check', '--opencode', 'v2'], '2.0.30');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/would be (updated|removed)/);
    expect(r.out).not.toMatch(/\d+ file\(s\) updated/);
    expect(await exists(dir, '.opencode/agent/core/openagent.md')).toBe(true);
  });

  test('init writes the marker, and an update with nothing to change reports it as unchanged', async () => {
    const dir = await newProject();
    oac(dir, ['init', '--opencode', 'v1'], '1.19.3');
    expect(await readFile(join(dir, '.opencode/.oac-opencode'), 'utf8')).toBe('v1\n');
    const r = oac(dir, ['update'], '1.19.3');
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/\d+ file\(s\) updated/);
    expect(r.out).toContain('unchanged');
  });
});

describe('an install that predates the flavor record', () => {
  const legacy = async (): Promise<string> => {
    const dir = await newProject();
    oac(dir, ['init', '--opencode', 'v1', '--profile', 'full'], '1.19.3');
    const cfg = await config(dir);
    delete cfg.opencode;
    await writeFile(join(dir, '.oac/config.json'), JSON.stringify(cfg, null, 2));
    await rm(join(dir, '.opencode/.oac-opencode'), { force: true }); // an old install has neither record
    return dir;
  };

  test('on a v1 host is refused untouched, with both ways forward', async () => {
    const dir = await legacy();
    const before = await readFile(join(dir, '.oac/manifest.json'), 'utf8');
    const r = oac(dir, ['update'], '1.19.3');
    expect(r.code).toBe(1);
    expect(r.out).toContain('--opencode v1');
    expect(r.out).toContain('--opencode v2');
    expect(await readFile(join(dir, '.oac/manifest.json'), 'utf8')).toBe(before);
    expect(await exists(dir, '.opencode/agent/core/openagent.md')).toBe(true);
  });

  test('with no host detected is refused untouched too, never silently migrated', async () => {
    const dir = await legacy();
    const r = oac(dir, ['update'], 'none');
    expect(r.code).toBe(1);
    expect(r.out).toContain('--opencode v1');
    expect(r.out).toContain('--opencode v2');
    expect(await exists(dir, '.opencode/agent/core/openagent.md')).toBe(true);
    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(false);
  });

  test('--opencode v1 just records the choice and keeps the layout', async () => {
    const dir = await legacy();
    expect(oac(dir, ['update', '--opencode', 'v1'], '1.19.3').code).toBe(0);
    expect((await config(dir)).opencode).toEqual({ target: 'v1' });
    expect(await exists(dir, '.opencode/agent/core/openagent.md')).toBe(true);
  });

  test('on a v2 host migrates to v2, backing up what the user edited', async () => {
    const dir = await legacy();
    await writeFile(join(dir, '.opencode/agent/core/openagent.md'), (await readFile(join(dir, '.opencode/agent/core/openagent.md'), 'utf8')) + '\nMY EDIT\n');
    const r = oac(dir, ['update'], '2.0.30');
    expect(r.code).toBe(0);
    expect(await exists(dir, '.opencode/agent/core')).toBe(false);
    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(true);
    expect((await config(dir)).opencode).toEqual({ target: 'v2' });
    const backups = (await walk(join(dir, '.oac/backups'))).filter((f) => f.endsWith('core/openagent.md'));
    expect(backups.length).toBe(1);
    expect(lintV2Agents(await agentTexts(dir))).toEqual([]);
  });
});

describe('a project installed by install.sh (marker only, no manifest)', () => {
  const shellInstalled = async (): Promise<string> => {
    const dir = await newProject();
    // What `install.sh --opencode v1` leaves: v1 files and the marker, but no .oac/.
    await mkdir(join(dir, '.opencode/agent/core'), { recursive: true });
    await writeFile(join(dir, '.opencode/agent/core/openagent.md'), 'from install.sh\n');
    await writeFile(join(dir, '.opencode/.oac-opencode'), 'v1\n');
    return dir;
  };

  test('oac init honours the marker: v1 layout, no flat v2 agents beside the nested ones', async () => {
    const dir = await shellInstalled();
    const r = oac(dir, ['init', '--profile', 'full'], '1.19.3');
    expect(r.code).toBe(0);
    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(false);
    expect(await exists(dir, '.opencode/agent/core/openagent.md')).toBe(true);
    expect((await config(dir)).opencode).toEqual({ target: 'v1' });
  });

  test('oac init refuses to flip the marked flavor', async () => {
    const dir = await shellInstalled();
    const r = oac(dir, ['init', '--opencode', 'v2', '--profile', 'full'], '2.0.30');
    expect(r.code).toBe(1);
    expect(await exists(dir, '.opencode/agent/openagent.md')).toBe(false);
  });

  test('oac update explains the missing manifest instead of the generic message', async () => {
    const dir = await shellInstalled();
    const r = oac(dir, ['update'], '1.19.3');
    expect(r.code).toBe(1);
    expect(r.out).toContain('install.sh');
    expect(r.out).not.toContain('No manifest found');
  });

  test('oac doctor reads the marker as the recorded flavor', async () => {
    const dir = await shellInstalled();
    const r = oac(dir, ['doctor'], '2.0.30');
    expect(r.out).toContain('installed for OpenCode v1 but OpenCode 2');
  });
});

describe('oac doctor', () => {
  const doctor = (dir: string, host: string): { code: number; check?: { status: string; message: string } } => {
    const r = oac(dir, ['doctor', '--json'], host);
    const json = JSON.parse(r.out.slice(r.out.indexOf('{'))) as { checks: Array<{ name: string; status: string; message: string }> };
    return { code: r.code, check: json.checks.find((c) => c.name === 'OpenCode version') };
  };

  test('passes when the recorded flavor matches the host', async () => {
    const v2 = await newProject();
    oac(v2, ['init']);
    expect(doctor(v2, '2.0.30').check?.status).toBe('ok');
    const v1 = await newProject();
    oac(v1, ['init', '--opencode', 'v1'], '1.19.3');
    expect(doctor(v1, '1.19.3').check?.status).toBe('ok');
  });

  test('fails when they do not, in both directions', async () => {
    const v2 = await newProject();
    oac(v2, ['init']);
    const a = doctor(v2, '1.19.3');
    expect(a.check?.status).toBe('error');
    expect(a.code).toBe(1);

    const v1 = await newProject();
    oac(v1, ['init', '--opencode', 'v1'], '1.19.3');
    const b = doctor(v1, '2.0.30');
    expect(b.check?.status).toBe('error');
    expect(b.code).toBe(1);
  });

  test('a 0.x host gets upgrade advice, never a migration to the other flavor', async () => {
    const v1 = await newProject();
    oac(v1, ['init', '--opencode', 'v1'], '1.19.3');
    const c = doctor(v1, '0.15.0').check;
    expect(c?.status).toBe('error');
    expect(c?.message).toContain('upgrade OpenCode');
    expect(c?.message).not.toContain('--opencode v2');
  });
});
