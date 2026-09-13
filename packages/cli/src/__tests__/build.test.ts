/**
 * `oac build` wiring.
 *
 * The pipeline itself is tested in `packages/compatibility-layer` under vitest — loading,
 * adapting, determinism and the orphan-removal safety envelope all live there. What is left
 * here is the part this package actually owns: which targets a flag selects, and which of them
 * are staged rather than emitted in place.
 *
 * The staging assertion is not a formality. `plugins/claude-code/agents/**` must NOT be
 * emitted in place: regenerating it changes what 4 shipped agents may do, and that tightening
 * is pending review. A refactor that quietly flips the default is exactly what this test is
 * here to catch.
 */

import { describe, test, expect } from 'bun:test';
import { CLAUDE_STAGING_ROOT, outputRootsFor, selectTargets } from '../commands/build.js';

// ── selectTargets ─────────────────────────────────────────────────────────────

describe('selectTargets', () => {
  test('defaults to every wired target', () => {
    expect(selectTargets(undefined)).toEqual(['opencode', 'claude-code']);
    expect(selectTargets([])).toEqual(['opencode', 'claude-code']);
  });

  test('honours an explicit --target', () => {
    expect(selectTargets(['opencode'])).toEqual(['opencode']);
  });

  test('rejects an unknown target by name, listing the known ones', () => {
    expect(() => selectTargets(['emacs'])).toThrow(/unknown target\(s\): emacs/);
    expect(() => selectTargets(['emacs'])).toThrow(/opencode, claude-code/);
  });
});

// ── outputRootsFor ────────────────────────────────────────────────────────────

describe('outputRootsFor', () => {
  test('emits opencode in place — it has no staging root', () => {
    expect(outputRootsFor(['opencode'], CLAUDE_STAGING_ROOT)).toEqual({});
  });

  test('stages claude-code rather than emitting it in place', () => {
    expect(outputRootsFor(['claude-code'], CLAUDE_STAGING_ROOT)).toEqual({
      'claude-code': CLAUDE_STAGING_ROOT,
    });
  });

  test('stages claude-code even when every target is built', () => {
    const roots = outputRootsFor(['opencode', 'claude-code'], CLAUDE_STAGING_ROOT);

    expect(roots['claude-code']).toBe(CLAUDE_STAGING_ROOT);
    expect(roots.opencode).toBeUndefined();
  });

  test('honours a --stage override', () => {
    expect(outputRootsFor(['claude-code'], 'build/out')).toEqual({ 'claude-code': 'build/out' });
  });

  test('the staging root is gitignored, so a build never dirties the tree', () => {
    expect(CLAUDE_STAGING_ROOT.startsWith('.tmp/')).toBe(true);
  });
});
