import { describe, test, expect } from 'bun:test';
import { detectOpenCodeMajor, parseOpenCodeMajor } from './opencode-host.js';

describe('parseOpenCodeMajor', () => {
  test('reads the major from a bare version or a labelled one', () => {
    expect(parseOpenCodeMajor('1.19.3\n')).toBe(1);
    expect(parseOpenCodeMajor('2.0.30')).toBe(2);
    expect(parseOpenCodeMajor('opencode version 2.0.31')).toBe(2);
    expect(parseOpenCodeMajor('v1.1.48')).toBe(1);
  });
  test('answers null rather than guessing for anything unparseable', () => {
    for (const s of ['', 'command not found', 'dev', '0.15.29-beta'.replace(/\d/g, 'x')]) expect(parseOpenCodeMajor(s)).toBeNull();
  });
});

describe('detectOpenCodeMajor', () => {
  test('the OAC_OPENCODE_VERSION override wins and the binary is never run', async () => {
    let ran = false;
    const major = await detectOpenCodeMajor({
      env: { OAC_OPENCODE_VERSION: '1.19.3' },
      exec: async () => { ran = true; return '2.0.0'; },
    });
    expect(major).toBe(1);
    expect(ran).toBe(false);
  });
  test('an override of "none" means no host is installed', async () => {
    expect(await detectOpenCodeMajor({ env: { OAC_OPENCODE_VERSION: 'none' }, exec: async () => '2.0.0' })).toBeNull();
  });
  test('runs `opencode --version` otherwise', async () => {
    const seen: string[][] = [];
    const major = await detectOpenCodeMajor({ env: {}, exec: async (cmd, args) => { seen.push([cmd, ...args]); return '2.0.30\n'; } });
    expect(major).toBe(2);
    expect(seen).toEqual([['opencode', '--version']]);
  });
  test('a missing or failing binary yields null', async () => {
    expect(await detectOpenCodeMajor({ env: {}, exec: async () => { throw new Error('ENOENT'); } })).toBeNull();
  });
});
