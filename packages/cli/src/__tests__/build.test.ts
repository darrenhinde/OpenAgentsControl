/**
 * `oac build` wiring.
 *
 * The pipeline itself is tested in `packages/compatibility-layer` under vitest — loading,
 * adapting, determinism and the orphan-removal safety envelope all live there. What is left
 * here is the part this package actually owns: which targets a flag selects, and that every
 * one of them is emitted in place.
 *
 * `plugins/claude-code/agents/**` is emitted in place like the OpenCode trees (D-017): its
 * Claude-specific frontmatter and body come from `oac.overrides.claude-code` and
 * `<!-- oac:only -->` host blocks in the canonical source, and the capability lint guards it
 * against the L-001 regression. The test below pins that no target is left out.
 */

import { describe, test, expect } from 'bun:test';
import { BUILD_TARGETS, lintBuild } from '@controlstack/compatibility-layer';
import { IN_PLACE_TARGETS, assertInPlace, selectTargets, strictExitCode } from '../commands/build.js';

// ── selectTargets ─────────────────────────────────────────────────────────────

describe('selectTargets', () => {
  test('defaults to every wired target', () => {
    expect(selectTargets(undefined)).toEqual(['opencode', 'opencode-v1', 'claude-code']);
    expect(selectTargets([])).toEqual(['opencode', 'opencode-v1', 'claude-code']);
  });

  test('honours an explicit --target', () => {
    expect(selectTargets(['opencode'])).toEqual(['opencode']);
  });

  test('rejects an unknown target by name, listing the known ones', () => {
    expect(() => selectTargets(['emacs'])).toThrow(/unknown target\(s\): emacs/);
    expect(() => selectTargets(['emacs'])).toThrow(/opencode, opencode-v1, claude-code/);
  });
});

// ── in-place emission ─────────────────────────────────────────────────────────

describe('in-place emission', () => {
  test('every wired target, claude-code included, is emitted in place', () => {
    expect([...IN_PLACE_TARGETS].sort()).toEqual([...BUILD_TARGETS].sort());
    expect(IN_PLACE_TARGETS).toContain('claude-code');
  });

  test('accepts every selectable target', () => {
    expect(() => assertInPlace(selectTargets(undefined))).not.toThrow();
  });

  test('refuses a target that is not wired for in-place emission', () => {
    expect(() => assertInPlace(['emacs' as never])).toThrow(/not wired for in-place emission: emacs/);
  });
});

// ── lints under --strict ──────────────────────────────────────────────────────

describe('strictExitCode', () => {
  test('fails only under --strict, on any warning, dead reference or lint finding', () => {
    expect(strictExitCode(false, 3, 2, 5)).toBe(0);
    expect(strictExitCode(true, 0, 0, 0)).toBe(0);
    expect(strictExitCode(true, 0, 0, 1)).toBe(1);
    expect(strictExitCode(true, 1, 0, 0)).toBe(1);
  });
});

describe('build lints', () => {
  test('the capability lint the build runs catches an L-001 Claude agent', () => {
    const [result] = lintBuild([
      {
        target: 'claude-code',
        path: 'plugins/claude-code/agents/code-reviewer.md',
        content:
          '---\nname: code-reviewer\ndescription: Code review agent\ntools: Read, Glob, Grep\n' +
          'disallowedTools: Write, Edit, Bash, Task\n---\n\nALWAYS call ContextScout BEFORE reviewing any code.\n',
      },
    ]);
    expect(result?.findings.map((f) => f.rule).sort()).toEqual([
      'delegation-without-task',
      'description-no-example',
    ]);
  });
});
