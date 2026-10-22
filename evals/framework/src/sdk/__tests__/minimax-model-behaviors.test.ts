/**
 * Tests for MiniMax model behavior configuration
 *
 * Validates that MiniMax models are properly registered in the
 * model behavior registry and return correct configuration values.
 */

import { describe, it, expect } from 'vitest';
import { MODEL_BEHAVIORS, getModelBehavior, calculateModelTimeout } from '../model-behaviors.js';

describe('MiniMax Model Behaviors', () => {
  describe('MODEL_BEHAVIORS registry', () => {
    it('should include MiniMax-M3 entry', () => {
      expect(MODEL_BEHAVIORS['MiniMax-M3']).toBeDefined();
    });

    it('should include MiniMax-M2.7 entry', () => {
      expect(MODEL_BEHAVIORS['MiniMax-M2.7']).toBeDefined();
    });

    it('should include MiniMax-M2.7-highspeed entry', () => {
      expect(MODEL_BEHAVIORS['MiniMax-M2.7-highspeed']).toBeDefined();
    });

    it('should have correct properties for MiniMax-M3', () => {
      const behavior = MODEL_BEHAVIORS['MiniMax-M3'];
      expect(behavior.sendsCompletionText).toBe(true);
      expect(behavior.mayEndWithToolCalls).toBe(false);
      expect(behavior.typicalResponseTime).toBe(8000);
      expect(behavior.toolCompletionGrace).toBe(4000);
    });

    it('should have correct properties for MiniMax-M2.7', () => {
      const behavior = MODEL_BEHAVIORS['MiniMax-M2.7'];
      expect(behavior.sendsCompletionText).toBe(true);
      expect(behavior.mayEndWithToolCalls).toBe(false);
      expect(behavior.typicalResponseTime).toBe(8000);
      expect(behavior.toolCompletionGrace).toBe(4000);
    });

    it('should have correct properties for MiniMax-M2.7-highspeed', () => {
      const behavior = MODEL_BEHAVIORS['MiniMax-M2.7-highspeed'];
      expect(behavior.sendsCompletionText).toBe(true);
      expect(behavior.mayEndWithToolCalls).toBe(false);
      expect(behavior.typicalResponseTime).toBe(5000);
      expect(behavior.toolCompletionGrace).toBe(3000);
    });

    it('should have faster response time for highspeed variant', () => {
      const standard = MODEL_BEHAVIORS['MiniMax-M2.7'];
      const highspeed = MODEL_BEHAVIORS['MiniMax-M2.7-highspeed'];
      expect(highspeed.typicalResponseTime).toBeLessThan(standard.typicalResponseTime);
    });
  });

  describe('getModelBehavior()', () => {
    it('should return exact match for MiniMax-M3', () => {
      const behavior = getModelBehavior('MiniMax-M3');
      expect(behavior).toBe(MODEL_BEHAVIORS['MiniMax-M3']);
    });

    it('should return exact match for MiniMax-M2.7', () => {
      const behavior = getModelBehavior('MiniMax-M2.7');
      expect(behavior).toBe(MODEL_BEHAVIORS['MiniMax-M2.7']);
    });

    it('should return exact match for MiniMax-M2.7-highspeed', () => {
      const behavior = getModelBehavior('MiniMax-M2.7-highspeed');
      expect(behavior).toBe(MODEL_BEHAVIORS['MiniMax-M2.7-highspeed']);
    });

    it('should return partial match for minimax/MiniMax-M3', () => {
      const behavior = getModelBehavior('minimax/MiniMax-M3');
      expect(behavior.typicalResponseTime).toBe(8000);
    });

    it('should return partial match for minimax/MiniMax-M2.7', () => {
      const behavior = getModelBehavior('minimax/MiniMax-M2.7');
      expect(behavior.typicalResponseTime).toBe(8000);
    });

    it('should return partial match for minimax/MiniMax-M2.7-highspeed', () => {
      const behavior = getModelBehavior('minimax/MiniMax-M2.7-highspeed');
      expect(behavior.typicalResponseTime).toBe(5000);
    });
  });

  describe('calculateModelTimeout()', () => {
    it('should calculate timeout for MiniMax-M3', () => {
      const timeout = calculateModelTimeout(30000, 'MiniMax-M3');
      expect(timeout).toBeGreaterThanOrEqual(24000); // At least 3x typicalResponseTime
    });

    it('should calculate timeout for MiniMax-M2.7', () => {
      const timeout = calculateModelTimeout(30000, 'MiniMax-M2.7');
      expect(timeout).toBeGreaterThanOrEqual(24000); // At least 3x typicalResponseTime
    });

    it('should calculate shorter timeout for MiniMax-M2.7-highspeed', () => {
      const timeoutStandard = calculateModelTimeout(30000, 'MiniMax-M2.7');
      const timeoutHighspeed = calculateModelTimeout(30000, 'MiniMax-M2.7-highspeed');
      expect(timeoutHighspeed).toBeLessThanOrEqual(timeoutStandard);
    });

    it('should respect minimum base timeout', () => {
      const timeout = calculateModelTimeout(60000, 'MiniMax-M2.7');
      expect(timeout).toBeGreaterThanOrEqual(60000);
    });
  });
});
