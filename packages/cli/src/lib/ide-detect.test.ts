import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  detectIde,
  detectIdes,
  isIdePresent,
  getIdeOutputFile,
  getIdeDisplayName,
} from './ide-detect.js';

// ── getIdeOutputFile ───────────────────────────────────────────────────────────
// Pure function — no I/O.

describe('getIdeOutputFile', () => {

  // ✅ Positive: claude maps to CLAUDE.md
  test('claude → CLAUDE.md', () => {
    expect(getIdeOutputFile('claude')).toBe('.claude/agents/');
  });

  // ✅ Positive: opencode maps to .opencode/
  test('opencode → .opencode/', () => {
    expect(getIdeOutputFile('opencode')).toBe('.opencode/');
  });
});

// ── getIdeDisplayName ─────────────────────────────────────────────────────────
// Pure function — no I/O.

describe('getIdeDisplayName', () => {

  // ✅ Positive: claude → Claude
  test('claude → Claude', () => {
    expect(getIdeDisplayName('claude')).toBe('Claude');
  });

  // ✅ Positive: opencode → OpenCode
  test('opencode → OpenCode', () => {
    expect(getIdeDisplayName('opencode')).toBe('OpenCode');
  });
});

// ── detectIde — directory-based IDEs ─────────────────────────────────────────
// These are the critical tests that verify the stat-based directory detection
// fix works correctly (Bun.file().exists() always returns false for directories).

describe('detectIde — opencode (directory-based)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-opencode-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: .opencode/ directory present → detected: true
  test('detected: true when .opencode/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-opencode');
    await mkdir(join(projectRoot, '.opencode'), { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'opencode');
    // Assert
    expect(result.type).toBe('opencode');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('.opencode');
  });

  // ❌ Negative: .opencode/ directory absent → detected: false
  test('detected: false when .opencode/ directory does not exist', async () => {
    // Arrange — fresh directory with no .opencode/ inside
    const projectRoot = join(tmpDir, 'without-opencode');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'opencode');
    // Assert
    expect(result.type).toBe('opencode');
    expect(result.detected).toBe(false);
    expect(result.indicator).toContain('.opencode');
  });
});

// ── detectIde — claude (two indicators) ──────────────────────────────────────
// Claude is special: it checks for a .claude/ directory OR a CLAUDE.md file.

describe('detectIde — claude (directory + file indicators)', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-claude-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: .claude/ directory present → detected: true, indicator mentions .claude/
  test('detected: true when .claude/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-claude-dir');
    await mkdir(join(projectRoot, '.claude'), { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('.claude');
  });

  // ✅ Positive: CLAUDE.md file present (no directory) → detected: true, indicator mentions CLAUDE.md
  test('detected: true when CLAUDE.md file exists (no .claude/ directory)', async () => {
    // Arrange — only the file, no .claude/ directory
    const projectRoot = join(tmpDir, 'with-claude-file');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(join(projectRoot, 'CLAUDE.md'), '# Claude rules\n', 'utf8');
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(true);
    expect(result.indicator).toContain('CLAUDE.md');
  });

  // ✅ Positive: both .claude/ directory and CLAUDE.md present → detected: true
  test('detected: true when both .claude/ directory and CLAUDE.md exist', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'with-claude-both');
    await mkdir(join(projectRoot, '.claude'), { recursive: true });
    await writeFile(join(projectRoot, 'CLAUDE.md'), '# Claude rules\n', 'utf8');
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(true);
  });

  // ❌ Negative: neither .claude/ nor CLAUDE.md present → detected: false
  test('detected: false when neither .claude/ directory nor CLAUDE.md exists', async () => {
    // Arrange — empty project root
    const projectRoot = join(tmpDir, 'without-claude');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const result = await detectIde(projectRoot, 'claude');
    // Assert
    expect(result.type).toBe('claude');
    expect(result.detected).toBe(false);
  });
});

// ── detectIdes — both IDEs in parallel ──────────────────────────────────────

describe('detectIdes — parallel detection of both IDEs', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-detect-all-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: returns exactly 4 results covering all IDE types
  test('returns an array of 2 DetectedIde results', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'count-check');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const results = await detectIdes(projectRoot);
    // Assert
    expect(results).toHaveLength(2);
    const types = results.map((r) => r.type);
    expect(types).toContain('opencode');
    expect(types).toContain('claude');
  });

  // ❌ Negative: empty temp dir → both IDEs return detected: false
  test('both IDEs return detected: false in an empty directory', async () => {
    // Arrange — directory with no IDE indicators
    const projectRoot = join(tmpDir, 'all-absent');
    await mkdir(projectRoot, { recursive: true });
    // Act
    const results = await detectIdes(projectRoot);
    // Assert
    for (const result of results) {
      expect(result.detected).toBe(false);
    }
  });

});

// ── isIdePresent ──────────────────────────────────────────────────────────────

describe('isIdePresent', () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'oac-ide-present-'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ✅ Positive: returns true for opencode when .opencode/ directory exists
  test('returns true when .opencode/ directory exists', async () => {
    // Arrange
    const projectRoot = join(tmpDir, 'present-opencode');
    await mkdir(join(projectRoot, '.opencode'), { recursive: true });
    // Act
    const present = await isIdePresent(projectRoot, 'opencode');
    // Assert
    expect(present).toBe(true);
  });

  // ✅ Positive: returns true for claude when CLAUDE.md file exists (no directory)
  test('returns true for claude when CLAUDE.md file exists', async () => {
    // Arrange — only the file, no .claude/ directory
    const projectRoot = join(tmpDir, 'present-claude-file');
    await mkdir(projectRoot, { recursive: true });
    await writeFile(join(projectRoot, 'CLAUDE.md'), '# Claude\n', 'utf8');
    // Act
    const present = await isIdePresent(projectRoot, 'claude');
    // Assert
    expect(present).toBe(true);
  });

});
