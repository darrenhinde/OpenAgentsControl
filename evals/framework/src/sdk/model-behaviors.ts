/**
 * Model-specific behavior configuration
 * 
 * Different AI models have different completion behaviors:
 * - Some models send final text after tool execution
 * - Some models end with 'tool-calls' finish reason
 * - Response times vary significantly
 * 
 * This module provides model-specific configurations to handle these differences.
 */

export interface ModelBehavior {
  /** Model sends final text after tool execution */
  sendsCompletionText: boolean;
  /** Model may end turn with tool-calls finish reason */
  mayEndWithToolCalls: boolean;
  /** Typical response time (ms) for timeout calculation */
  typicalResponseTime: number;
  /** Grace period after tool completion (ms) */
  toolCompletionGrace: number;
}

/**
 * Known model behaviors
 * Add new models here as they are tested
 */
export const MODEL_BEHAVIORS: Record<string, ModelBehavior> = {
  'grok-code': {
    sendsCompletionText: false,
    mayEndWithToolCalls: true,
    typicalResponseTime: 5000,
    toolCompletionGrace: 3000,
  },
  'grok-code-fast': {
    sendsCompletionText: false,
    mayEndWithToolCalls: true,
    typicalResponseTime: 3000,
    toolCompletionGrace: 2000,
  },
  'big-pickle': {
    sendsCompletionText: true,
    mayEndWithToolCalls: true,
    typicalResponseTime: 8000,
    toolCompletionGrace: 4000,
  },
  'pickle': {
    sendsCompletionText: true,
    mayEndWithToolCalls: true,
    typicalResponseTime: 6000,
    toolCompletionGrace: 3000,
  },
  'claude-4-5-sonnet': {
    sendsCompletionText: true,
    mayEndWithToolCalls: false,
    typicalResponseTime: 10000,
    toolCompletionGrace: 5000,
  },
  'claude-opus-4-5': {
    sendsCompletionText: true,
    mayEndWithToolCalls: false,
    typicalResponseTime: 15000,
    toolCompletionGrace: 5000,
  },
  'gpt-5-mini': {
    sendsCompletionText: true,
    mayEndWithToolCalls: false,
    typicalResponseTime: 8000,
    toolCompletionGrace: 4000,
  },
  'gpt-4o': {
    sendsCompletionText: true,
    mayEndWithToolCalls: false,
    typicalResponseTime: 6000,
    toolCompletionGrace: 3000,
  },
  'MiniMax-M3': {
    sendsCompletionText: true,
    mayEndWithToolCalls: false,
    typicalResponseTime: 8000,
    toolCompletionGrace: 4000,
  },
  'MiniMax-M2.7-highspeed': {
    sendsCompletionText: true,
    mayEndWithToolCalls: false,
    typicalResponseTime: 5000,
    toolCompletionGrace: 3000,
  },
  'MiniMax-M2.7': {
    sendsCompletionText: true,
    mayEndWithToolCalls: false,
    typicalResponseTime: 8000,
    toolCompletionGrace: 4000,
  },
  // Default for unknown models
  'default': {
    sendsCompletionText: true,
    mayEndWithToolCalls: true,
    typicalResponseTime: 10000,
    toolCompletionGrace: 5000,
  },
};

/**
 * Get model behavior configuration
 * Tries exact match first, then partial match, then default
 */
export function getModelBehavior(modelId: string): ModelBehavior {
  // Try exact match first
  if (MODEL_BEHAVIORS[modelId]) {
    return MODEL_BEHAVIORS[modelId];
  }
  
  // Try partial match (e.g., "claude-3-5-sonnet-20241022" matches "claude-3-5-sonnet")
  for (const [key, behavior] of Object.entries(MODEL_BEHAVIORS)) {
    if (key !== 'default' && (modelId.includes(key) || key.includes(modelId))) {
      return behavior;
    }
  }
  
  // Return default
  return MODEL_BEHAVIORS['default'];
}

/**
 * Calculate timeout based on model behavior
 */
export function calculateModelTimeout(
  baseTimeout: number,
  modelId: string
): number {
  const behavior = getModelBehavior(modelId);
  
  // Adjust based on model behavior
  const modelMultiplier = behavior.typicalResponseTime / 10000; // Normalize to 10s baseline
  
  return Math.max(
    baseTimeout,
    baseTimeout * modelMultiplier,
    behavior.typicalResponseTime * 3 // At least 3x typical response time
  );
}
