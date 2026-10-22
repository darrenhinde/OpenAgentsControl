/**
 * Integration tests for MiniMax provider support
 *
 * Validates the end-to-end integration of MiniMax models
 * with the eval framework configuration and variant system.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { MODEL_BEHAVIORS, getModelBehavior, calculateModelTimeout } from '../model-behaviors.js';

const ROOT_DIR = join(__dirname, '..', '..', '..', '..', '..');
const PROMPTS_DIR = join(ROOT_DIR, '.opencode', 'prompts', 'core', 'openagent');

describe('MiniMax Integration', () => {
  describe('environment configuration', () => {
    it('should have MINIMAX_API_KEY in env.example', () => {
      const envPath = join(ROOT_DIR, 'env.example');
      expect(existsSync(envPath)).toBe(true);
      const content = readFileSync(envPath, 'utf-8');
      expect(content).toContain('MINIMAX_API_KEY');
    });

    it('should have MiniMax platform URL in env.example', () => {
      const envPath = join(ROOT_DIR, 'env.example');
      const content = readFileSync(envPath, 'utf-8');
      expect(content).toContain('platform.minimax.io');
    });
  });

  describe('model behavior integration', () => {
    it('should resolve MiniMax-M3 via provider prefix', () => {
      const behavior = getModelBehavior('minimax/MiniMax-M3');
      expect(behavior).not.toBe(MODEL_BEHAVIORS['default']);
      expect(behavior.typicalResponseTime).toBe(8000);
    });

    it('should resolve MiniMax-M2.7 via provider prefix', () => {
      const behavior = getModelBehavior('minimax/MiniMax-M2.7');
      expect(behavior).not.toBe(MODEL_BEHAVIORS['default']);
      expect(behavior.typicalResponseTime).toBe(8000);
    });

    it('should resolve MiniMax-M2.7-highspeed via provider prefix', () => {
      const behavior = getModelBehavior('minimax/MiniMax-M2.7-highspeed');
      expect(behavior).not.toBe(MODEL_BEHAVIORS['default']);
      expect(behavior.typicalResponseTime).toBe(5000);
    });

    it('should calculate appropriate timeouts for eval tests', () => {
      const m3Timeout = calculateModelTimeout(30000, 'minimax/MiniMax-M3');
      const standardTimeout = calculateModelTimeout(30000, 'minimax/MiniMax-M2.7');
      const highspeedTimeout = calculateModelTimeout(30000, 'minimax/MiniMax-M2.7-highspeed');

      // All should be reasonable for eval tests
      expect(m3Timeout).toBeGreaterThanOrEqual(24000);
      expect(m3Timeout).toBeLessThanOrEqual(120000);
      expect(standardTimeout).toBeGreaterThanOrEqual(24000);
      expect(standardTimeout).toBeLessThanOrEqual(120000);
      expect(highspeedTimeout).toBeGreaterThanOrEqual(15000);
      expect(highspeedTimeout).toBeLessThanOrEqual(120000);
    });
  });

  describe('prompt variant integration', () => {
    it('should have minimax.md alongside other variants', () => {
      const variants = ['gpt.md', 'grok.md', 'gemini.md', 'llama.md', 'minimax.md'];
      for (const variant of variants) {
        const variantPath = join(PROMPTS_DIR, variant);
        expect(existsSync(variantPath)).toBe(true);
      }
    });

    it('should be documented in the README', () => {
      const readmePath = join(PROMPTS_DIR, 'README.md');
      expect(existsSync(readmePath)).toBe(true);
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toContain('minimax');
      expect(content).toContain('MiniMax');
    });

    it('should be listed in the capabilities matrix', () => {
      const readmePath = join(PROMPTS_DIR, 'README.md');
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toContain('`minimax`');
    });
  });

  describe('README integration', () => {
    it('should mention MiniMax in the main project README', () => {
      const readmePath = join(ROOT_DIR, 'README.md');
      expect(existsSync(readmePath)).toBe(true);
      const content = readFileSync(readmePath, 'utf-8');
      expect(content).toContain('MiniMax');
    });
  });
});
