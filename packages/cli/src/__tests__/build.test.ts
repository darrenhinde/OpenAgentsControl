/**
 * `oac build` wiring.
 *
 * The pipeline itself is tested in `packages/agent-compiler` under vitest — loading,
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
import { BUILD_TARGETS, lintBuild } from '@controlstack/agent-compiler';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { IN_PLACE_TARGETS, assertInPlace, selectTargets, strictExitCode, buildExitCode, runBuild } from '../commands/build.js';

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

describe('buildExitCode', () => {
  test('a lint error fails a plain build; warnings only fail under --strict', () => {
    expect(buildExitCode(false, 1, 0, 0, 1)).toBe(1);
    expect(buildExitCode(false, 0, 9, 0, 0)).toBe(0);
    expect(buildExitCode(true, 0, 9, 0, 0)).toBe(1);
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

describe('naming lint is report-only', () => {
  // A scratch root with just what a dry-run plan reads. Adding an agent that breaks four naming
  // rules must not change the exit code, even under --strict.
  const repo = resolve(import.meta.dir, '../../../..')
  const exitCodeWith = async (extraAgent: string | undefined, strict: boolean): Promise<{ code: number; out: string }> => {
    const root = mkdtempSync(join(tmpdir(), 'oac-naming-'))
    const lines: string[] = []
    const realLog = console.log
    try {
      for (const dir of ['agent-library', 'built-ai-configs', '.oac', '.opencode', 'plugins']) {
        mkdirSync(join(root, dir), { recursive: true })
        cpSync(join(repo, dir), join(root, dir), { recursive: true, verbatimSymlinks: true, filter: (src) => !src.includes('node_modules') })
      }
      if (extraAgent !== undefined) {
        writeFileSync(join(root, 'agent-library/agents/core/BadName.md'), extraAgent)
      }
      console.log = (...args: unknown[]): void => { lines.push(args.join(' ')) }
      const code = await runBuild({ target: undefined, check: false, dryRun: true, strict, prune: true, verbose: false, json: false } as never, root)
      return { code, out: lines.join('\n') }
    } finally {
      console.log = realLog
      rmSync(root, { recursive: true, force: true })
    }
  }

  test('a naming violation prints under its own heading, after the summary, and leaves the exit code alone', async () => {
    const bad = [
      '---', 'name: bad name', 'description: Badly named.', 'mode: subagent', 'oac:', '  id: bad-thing', '  name: bad name',
      '  category: subagents/nowhere', '  type: subagent', '  targets: [opencode]', '---', '', 'Body.', '',
    ].join('\n')
    const clean = await exitCodeWith(undefined, false)
    const dirty = await exitCodeWith(bad, false)
    expect(clean.code).toBe(0)
    expect(dirty.code).toBe(0)
    // --strict fails on the tree's baseline degradation warnings either way; naming adds nothing.
    expect((await exitCodeWith(bad, true)).code).toBe((await exitCodeWith(undefined, true)).code)
    expect(dirty.out).toContain('BadName.md [filename-is-id]')
    expect(dirty.out.indexOf('naming lint (report-only')).toBeGreaterThan(dirty.out.lastIndexOf('oac build'))
    expect(clean.out).not.toContain('BadName')
  }, 60_000)
})
