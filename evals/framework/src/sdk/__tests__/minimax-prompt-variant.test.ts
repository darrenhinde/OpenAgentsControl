/**
 * Tests for MiniMax prompt variant
 *
 * Validates that the MiniMax prompt variant file exists,
 * has correct metadata, and follows the variant conventions.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROMPTS_DIR = join(__dirname, '..', '..', '..', '..', '..', '.opencode', 'prompts', 'core', 'openagent');

describe('MiniMax Prompt Variant', () => {
  const variantPath = join(PROMPTS_DIR, 'minimax.md');

  it('should exist as a prompt variant file', () => {
    expect(existsSync(variantPath)).toBe(true);
  });

  describe('metadata', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(variantPath, 'utf-8');
    });

    it('should have model_family set to minimax', () => {
      expect(content).toContain('model_family: "minimax"');
    });

    it('should recommend MiniMax-M3 as primary model', () => {
      expect(content).toContain('minimax/MiniMax-M3');
    });

    it('should retain MiniMax-M2.7 as legacy alternative', () => {
      expect(content).toContain('minimax/MiniMax-M2.7');
    });

    it('should retain MiniMax-M2.7-highspeed as legacy alternative', () => {
      expect(content).toContain('minimax/MiniMax-M2.7-highspeed');
    });

    it('should have YAML frontmatter delimiters', () => {
      const frontmatterStart = content.indexOf('---');
      const frontmatterEnd = content.indexOf('---', frontmatterStart + 3);
      expect(frontmatterStart).toBeGreaterThanOrEqual(0);
      expect(frontmatterEnd).toBeGreaterThan(frontmatterStart);
    });

    it('should include standard agent configuration', () => {
      expect(content).toContain('mode: primary');
      expect(content).toContain('temperature: 0.2');
    });

    it('should include tool permissions', () => {
      expect(content).toContain('read: true');
      expect(content).toContain('write: true');
      expect(content).toContain('edit: true');
      expect(content).toContain('bash: true');
      expect(content).toContain('task: true');
    });
  });

  describe('prompt content', () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(variantPath, 'utf-8');
    });

    it('should include critical context requirement', () => {
      expect(content).toContain('<critical_context_requirement>');
    });

    it('should include critical rules', () => {
      expect(content).toContain('<critical_rules');
      expect(content).toContain('approval_gate');
      expect(content).toContain('stop_on_failure');
      expect(content).toContain('report_first');
      expect(content).toContain('confirm_cleanup');
    });

    it('should include workflow stages', () => {
      expect(content).toContain('name="Analyze"');
      expect(content).toContain('name="Approve"');
      expect(content).toContain('name="Execute"');
      expect(content).toContain('name="Validate"');
      expect(content).toContain('name="Summarize"');
      expect(content).toContain('name="Confirm"');
    });

    it('should include delegation rules', () => {
      expect(content).toContain('<delegation_rules');
    });

    it('should include execution priority tiers', () => {
      expect(content).toContain('<execution_priority>');
      expect(content).toContain('Safety & Approval Gates');
      expect(content).toContain('Core Workflow');
      expect(content).toContain('Optimization');
    });

    it('should include context loading references', () => {
      expect(content).toContain('code-quality.md');
      expect(content).toContain('documentation.md');
      expect(content).toContain('test-coverage.md');
    });
  });

  describe('consistency with other variants', () => {
    it('should have same structure as gpt.md variant', () => {
      const gptPath = join(PROMPTS_DIR, 'gpt.md');
      if (!existsSync(gptPath)) return; // Skip if gpt variant missing

      const minimax = readFileSync(variantPath, 'utf-8');
      const gpt = readFileSync(gptPath, 'utf-8');

      // Both should have the same core sections
      const coreSections = [
        '<critical_context_requirement>',
        '<critical_rules',
        '<execution_priority>',
        '<execution_paths>',
        '<workflow>',
        '<delegation_rules',
        '<principles>',
        '<static_context>',
        '<constraints',
      ];

      for (const section of coreSections) {
        const gptHas = gpt.includes(section);
        const minimaxHas = minimax.includes(section);
        expect(minimaxHas).toBe(gptHas);
      }
    });
  });
});

// Import beforeAll for the describe blocks
import { beforeAll } from 'vitest';
