import { describe, test, expect } from 'bun:test';
import {
  DEFAULT_FLAVOR,
  flavorOfConfig,
  isV1Source,
  parseFlavor,
  registryFileFor,
  resolveInitFlavor,
  toDestPath,
  transitionFlavor,
} from './flavor.js';

describe('parseFlavor', () => {
  test('accepts v1/v2 and bare 1/2, case-insensitively', () => {
    expect(parseFlavor('v1')).toBe('v1');
    expect(parseFlavor('V2')).toBe('v2');
    expect(parseFlavor('1')).toBe('v1');
    expect(parseFlavor('2')).toBe('v2');
  });
  test('rejects anything else', () => {
    for (const bad of ['', 'v3', 'latest', 'opencode1']) expect(parseFlavor(bad)).toBeNull();
  });
  test('v2 is the default', () => {
    expect(DEFAULT_FLAVOR).toBe('v2');
  });
});

describe('registryFileFor', () => {
  test('v2 reads registry.json and v1 reads registry.v1.json', () => {
    expect(registryFileFor('v2')).toBe('registry.json');
    expect(registryFileFor('v1')).toBe('registry.v1.json');
  });
});

describe('toDestPath', () => {
  test('hosts/opencode-v1/ installs to .opencode/ and the folder name never reaches the project', () => {
    expect(toDestPath('hosts/opencode-v1/agent/core/openagent.md')).toBe('.opencode/agent/core/openagent.md');
    expect(toDestPath('hosts/opencode-v1/tool/gemini/index.ts')).toBe('.opencode/tool/gemini/index.ts');
  });
  test('every other path is its own destination', () => {
    expect(toDestPath('.opencode/agent/openagent.md')).toBe('.opencode/agent/openagent.md');
    expect(toDestPath('env.example')).toBe('env.example');
  });
  test('does not rewrite a path that merely contains the folder name', () => {
    expect(toDestPath('.opencode/context/hosts/opencode-v1/x.md')).toBe('.opencode/context/hosts/opencode-v1/x.md');
  });
  test('isV1Source recognises only the leading folder', () => {
    expect(isV1Source('hosts/opencode-v1/x')).toBe(true);
    expect(isV1Source('.opencode/hosts/opencode-v1/x')).toBe(false);
  });
});

describe('flavorOfConfig', () => {
  test('a config with no opencode record is a v2 install that has not recorded a choice', () => {
    expect(flavorOfConfig(null)).toEqual({ flavor: 'v2', recorded: false });
    expect(flavorOfConfig({ opencode: undefined })).toEqual({ flavor: 'v2', recorded: false });
  });
  test('reads a recorded choice', () => {
    expect(flavorOfConfig({ opencode: { target: 'v1' } })).toEqual({ flavor: 'v1', recorded: true });
  });
});

describe('transitionFlavor', () => {
  const base = { recorded: false, current: 'v2' as const };

  test('v2 is never changed away from silently: an explicit flag is the only way to v1', () => {
    expect(transitionFlavor({ recorded: true, current: 'v2', requested: undefined, hostMajor: 1 })).toMatchObject({ action: 'keep', flavor: 'v2' });
    expect(transitionFlavor({ recorded: true, current: 'v2', requested: 'v1', hostMajor: 2 })).toMatchObject({ action: 'switch', flavor: 'v1' });
  });

  test('a recorded v1 install stays v1 whatever the host says', () => {
    expect(transitionFlavor({ recorded: true, current: 'v1', requested: undefined, hostMajor: 2 })).toMatchObject({ action: 'keep', flavor: 'v1' });
  });

  test('a legacy install (no record) on a v1 host is refused rather than moved', () => {
    const t = transitionFlavor({ ...base, requested: undefined, hostMajor: 1 });
    expect(t.action).toBe('refuse');
    expect(t.message).toContain('--opencode v1');
    expect(t.message).toContain('--opencode v2');
  });

  test('a legacy install on a v2 or unknown host migrates to v2', () => {
    expect(transitionFlavor({ ...base, requested: undefined, hostMajor: 2 })).toMatchObject({ action: 'migrate', flavor: 'v2' });
    expect(transitionFlavor({ ...base, requested: undefined, hostMajor: null })).toMatchObject({ action: 'migrate', flavor: 'v2' });
  });

  test('a legacy install asked for v1 records v1 without moving files', () => {
    expect(transitionFlavor({ ...base, requested: 'v1', hostMajor: 1 })).toMatchObject({ action: 'record', flavor: 'v1' });
  });

  test('asking for the recorded flavor is a no-op', () => {
    expect(transitionFlavor({ recorded: true, current: 'v1', requested: 'v1', hostMajor: 1 })).toMatchObject({ action: 'keep', flavor: 'v1' });
  });
});

describe('resolveInitFlavor', () => {
  test('a fresh project is v2 unless v1 is asked for', () => {
    expect(resolveInitFlavor({ requested: undefined, recorded: false, current: 'v2', hasInstall: false })).toEqual({ ok: true, flavor: 'v2' });
    expect(resolveInitFlavor({ requested: 'v1', recorded: false, current: 'v2', hasInstall: false })).toEqual({ ok: true, flavor: 'v1' });
  });

  test('a re-run honours the recorded flavor when none is given', () => {
    expect(resolveInitFlavor({ requested: undefined, recorded: true, current: 'v1', hasInstall: true })).toEqual({ ok: true, flavor: 'v1' });
  });

  test('a re-run that asks for a different flavor is pointed at oac update', () => {
    const r = resolveInitFlavor({ requested: 'v2', recorded: true, current: 'v1', hasInstall: true });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toContain('oac update --opencode v2');
  });

  test('an install that predates the record is never re-initialised under a guessed flavor', () => {
    for (const requested of [undefined, 'v2' as const]) {
      const r = resolveInitFlavor({ requested, recorded: false, current: 'v2', hasInstall: true });
      expect(r.ok).toBe(false);
    }
    expect(resolveInitFlavor({ requested: 'v1', recorded: false, current: 'v2', hasInstall: true })).toEqual({ ok: true, flavor: 'v1' });
  });
});
