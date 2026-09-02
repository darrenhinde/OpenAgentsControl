import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ideCheckResult,
  ideCheckResults,
  manifestUnavailable,
  overallStatus,
  safeReadManifest,
  summariseResults,
  type CheckResult,
} from './doctor-checks.js';
import { createEmptyManifest, writeManifest } from './manifest.js';

// ── safeReadManifest ──────────────────────────────────────────────────────────

describe('safeReadManifest', () => {
  let missingRoot: string;
  let corruptRoot: string;
  let invalidRoot: string;
  let validRoot: string;

  beforeAll(async () => {
    missingRoot = await mkdtemp(join(tmpdir(), 'oac-doctor-missing-'));

    corruptRoot = await mkdtemp(join(tmpdir(), 'oac-doctor-corrupt-'));
    await mkdir(join(corruptRoot, '.oac'), { recursive: true });
    await writeFile(join(corruptRoot, '.oac', 'manifest.json'), '{ not json', 'utf8');

    invalidRoot = await mkdtemp(join(tmpdir(), 'oac-doctor-invalid-'));
    await mkdir(join(invalidRoot, '.oac'), { recursive: true });
    await writeFile(join(invalidRoot, '.oac', 'manifest.json'), '{"files": "nope"}', 'utf8');

    validRoot = await mkdtemp(join(tmpdir(), 'oac-doctor-valid-'));
    await writeManifest(validRoot, createEmptyManifest('1.1.0'));
  });

  afterAll(async () => {
    await Promise.all(
      [missingRoot, corruptRoot, invalidRoot, validRoot].map((d) =>
        rm(d, { recursive: true, force: true }),
      ),
    );
  });

  test('absent manifest is ok with null', async () => {
    expect(await safeReadManifest(missingRoot)).toEqual({ ok: true, manifest: null });
  });

  test('unparseable JSON is a value, not an exception', async () => {
    const read = await safeReadManifest(corruptRoot);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.length).toBeGreaterThan(0);
  });

  test('schema-invalid manifest is a value, not an exception', async () => {
    const read = await safeReadManifest(invalidRoot);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error).toContain('Invalid manifest');
  });

  test('valid manifest is returned', async () => {
    const read = await safeReadManifest(validRoot);
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.manifest?.files).toEqual({});
  });
});

// ── manifestUnavailable ───────────────────────────────────────────────────────

describe('manifestUnavailable', () => {
  test('invalid manifest becomes an error check', () => {
    const result = manifestUnavailable('Files on disk', { ok: false, error: 'boom' });
    expect(result?.status).toBe('error');
    expect(result?.message).toContain('invalid');
  });

  test('missing manifest becomes an error check', () => {
    const result = manifestUnavailable('Files on disk', { ok: true, manifest: null });
    expect(result?.status).toBe('error');
    expect(result?.message).toContain('missing');
  });

  test('valid manifest lets the check proceed', () => {
    const result = manifestUnavailable('Files on disk', {
      ok: true,
      manifest: createEmptyManifest('1.1.0'),
    });
    expect(result).toBeNull();
  });
});

// ── IDE lines ─────────────────────────────────────────────────────────────────

describe('ideCheckResult', () => {
  test('OpenCode present is ok and never tells the user to apply', () => {
    const result = ideCheckResult({
      type: 'opencode',
      detected: true,
      indicator: '.opencode/ directory',
    });
    expect(result.status).toBe('ok');
    expect(result.message).not.toContain('oac apply opencode');
  });

  test('Claude present is informational and points at the valid target', () => {
    const result = ideCheckResult({ type: 'claude', detected: true, indicator: 'CLAUDE.md file' });
    expect(result.status).toBe('info');
    expect(result.message).toContain("oac apply claude");
  });

  test('a fresh install with only .opencode/ yields no warnings', () => {
    const lines = ideCheckResults([
      { type: 'opencode', detected: true, indicator: '.opencode/ directory' },
      { type: 'claude', detected: false, indicator: '.claude/ directory or CLAUDE.md (not found)' },
    ]);
    expect(lines).toHaveLength(1);
    expect(summariseResults(lines).warnings).toBe(0);
  });

  test('nothing detected yields a single hint', () => {
    const lines = ideCheckResults([
      { type: 'opencode', detected: false, indicator: '' },
      { type: 'claude', detected: false, indicator: '' },
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.status).toBe('info');
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────

describe('summariseResults / overallStatus', () => {
  const mk = (status: CheckResult['status']): CheckResult => ({ name: 'x', status, message: '' });

  test('info counts as ok', () => {
    expect(summariseResults([mk('ok'), mk('info')])).toEqual({ ok: 2, warnings: 0, errors: 0 });
    expect(overallStatus(summariseResults([mk('ok'), mk('info')]))).toBe('healthy');
  });

  test('a warning downgrades to warning', () => {
    expect(overallStatus(summariseResults([mk('ok'), mk('warn')]))).toBe('warning');
  });

  test('an error wins over warnings', () => {
    expect(overallStatus(summariseResults([mk('warn'), mk('error')]))).toBe('error');
  });
});
