/**
 * PerformanceMetricsEvaluator - Collects and reports performance metrics
 * 
 * Provides visibility into test execution performance:
 * - Total duration
 * - Tool latencies (time between call and result)
 * - Inference time estimation
 * - Idle time calculation
 * - Event distribution
 * 
 * This evaluator always passes - it's for metrics collection only.
 */

import { BaseEvaluator } from './base-evaluator.js';
import {
  TimelineEvent,
  SessionInfo,
  EvaluationResult,
  Evidence
} from '../types/index.js';

export class PerformanceMetricsEvaluator extends BaseEvaluator {
  name = 'performance-metrics';
  description = 'Collects performance metrics for test execution analysis';

  async evaluate(timeline: TimelineEvent[], sessionInfo: SessionInfo): Promise<EvaluationResult> {
    const metrics = this.collectMetrics(timeline, sessionInfo);
    const evidence = this.buildEvidence(metrics);

    return {
      evaluator: this.name,
      passed: true, // Always passes - metrics only
      score: 100,
      violations: [],
      evidence,
      metadata: {
        metrics,
        summary: this.formatSummary(metrics)
      }
    };
  }

  /**
   * Collect all performance metrics
   */
  private collectMetrics(timeline: TimelineEvent[], sessionInfo: SessionInfo): PerformanceMetrics {
    const totalDuration = this.calculateTotalDuration(timeline);
    const toolLatencies = this.calculateToolLatencies(timeline);
    const inferenceTime = this.estimateInferenceTime(timeline);
    const idleTime = this.calculateIdleTime(timeline);
    const eventDistribution = this.calculateEventDistribution(timeline);

    return {
      total_duration_ms: totalDuration,
      tool_latencies_ms: toolLatencies,
      inference_time_ms: inferenceTime,
      idle_time_ms: idleTime,
      event_distribution: eventDistribution,
      tool_count: this.getToolCalls(timeline).length,
      message_count: this.getAssistantMessages(timeline).length
    };
  }

  /**
   * Calculate total test duration
   */
  private calculateTotalDuration(timeline: TimelineEvent[]): number {
    if (timeline.length === 0) return 0;

    const firstEvent = timeline[0];
    const lastEvent = timeline[timeline.length - 1];

    return lastEvent.timestamp - firstEvent.timestamp;
  }

  /**
   * Calculate latency for each tool call
   * Note: Since timeline doesn't have explicit tool_result events,
   * we estimate latency as time to next event (approximation)
   */
  private calculateToolLatencies(timeline: TimelineEvent[]): Record<string, ToolLatencyStats> {
    const toolCalls = this.getToolCalls(timeline);
    const latencies: Record<string, number[]> = {};

    for (let i = 0; i < toolCalls.length; i++) {
      const call = toolCalls[i];
      const toolName = call.data?.tool;
      if (!toolName) continue;

      // Find next event after this tool call (approximation of completion)
      const nextEventIndex = timeline.findIndex(event => 
        event.timestamp > call.timestamp
      );

      if (nextEventIndex !== -1) {
        const latency = timeline[nextEventIndex].timestamp - call.timestamp;
        if (!latencies[toolName]) {
          latencies[toolName] = [];
        }
        latencies[toolName].push(latency);
      }
    }

    // Calculate stats for each tool
    const stats: Record<string, ToolLatencyStats> = {};
    for (const [tool, values] of Object.entries(latencies)) {
      if (values.length > 0) {
        stats[tool] = {
          count: values.length,
          avg_ms: Math.round(values.reduce((sum, v) => sum + v, 0) / values.length),
          min_ms: Math.min(...values),
          max_ms: Math.max(...values),
          total_ms: values.reduce((sum, v) => sum + v, 0)
        };
      }
    }

    return stats;
  }

  /**
   * Estimate LLM inference time
   * Approximation: time between user message and first assistant response
   */
  private estimateInferenceTime(timeline: TimelineEvent[]): number {
    const userMessages = this.getUserMessages(timeline);
    const assistantMessages = this.getAssistantMessages(timeline);

    if (userMessages.length === 0 || assistantMessages.length === 0) {
      return 0;
    }

    let totalInferenceTime = 0;

    for (const userMsg of userMessages) {
      // Find next assistant message after this user message
      const nextAssistant = assistantMessages.find(
        msg => msg.timestamp > userMsg.timestamp
      );

      if (nextAssistant) {
        totalInferenceTime += nextAssistant.timestamp - userMsg.timestamp;
      }
    }

    return totalInferenceTime;
  }

  /**
   * Calculate idle time (gaps between events)
   */
  private calculateIdleTime(timeline: TimelineEvent[]): number {
    if (timeline.length < 2) return 0;

    let totalIdleTime = 0;
    const IDLE_THRESHOLD_MS = 1000; // Consider gaps >1s as idle time

    for (let i = 1; i < timeline.length; i++) {
      const gap = timeline[i].timestamp - timeline[i - 1].timestamp;
      if (gap > IDLE_THRESHOLD_MS) {
        totalIdleTime += gap;
      }
    }

    return totalIdleTime;
  }

  /**
   * Calculate distribution of event types
   */
  private calculateEventDistribution(timeline: TimelineEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const event of timeline) {
      distribution[event.type] = (distribution[event.type] || 0) + 1;
    }

    return distribution;
  }

  /**
   * Build evidence from metrics
   */
  private buildEvidence(metrics: PerformanceMetrics): Evidence[] {
    const evidence: Evidence[] = [];

    // Total duration evidence
    evidence.push(this.createEvidence(
      'performance',
      `Total test duration: ${this.formatDuration(metrics.total_duration_ms)}`,
      { duration_ms: metrics.total_duration_ms }
    ));

    // Tool latencies evidence
    if (Object.keys(metrics.tool_latencies_ms).length > 0) {
      evidence.push(this.createEvidence(
        'performance',
        'Tool execution latencies',
        metrics.tool_latencies_ms
      ));
    }

    // Inference time evidence
    if (metrics.inference_time_ms > 0) {
      const inferencePercent = Math.round(
        (metrics.inference_time_ms / metrics.total_duration_ms) * 100
      );
      evidence.push(this.createEvidence(
        'performance',
        `LLM inference time: ${this.formatDuration(metrics.inference_time_ms)} (${inferencePercent}%)`,
        { inference_time_ms: metrics.inference_time_ms, percentage: inferencePercent }
      ));
    }

    // Idle time evidence
    if (metrics.idle_time_ms > 0) {
      const idlePercent = Math.round(
        (metrics.idle_time_ms / metrics.total_duration_ms) * 100
      );
      evidence.push(this.createEvidence(
        'performance',
        `Idle time: ${this.formatDuration(metrics.idle_time_ms)} (${idlePercent}%)`,
        { idle_time_ms: metrics.idle_time_ms, percentage: idlePercent }
      ));
    }

    return evidence;
  }

  /**
   * Format metrics summary for display
   */
  private formatSummary(metrics: PerformanceMetrics): string {
    const lines: string[] = [];

    lines.push(`Total Duration: ${this.formatDuration(metrics.total_duration_ms)}`);
    lines.push(`Tool Calls: ${metrics.tool_count}`);
    lines.push(`Messages: ${metrics.message_count}`);

    if (Object.keys(metrics.tool_latencies_ms).length > 0) {
      lines.push('\nTool Latencies:');
      for (const [tool, stats] of Object.entries(metrics.tool_latencies_ms)) {
        lines.push(`  ${tool}: ${this.formatDuration(stats.avg_ms)} avg (${stats.count}x)`);
      }
    }

    if (metrics.inference_time_ms > 0) {
      const inferencePercent = Math.round(
        (metrics.inference_time_ms / metrics.total_duration_ms) * 100
      );
      lines.push(`\nInference Time: ${this.formatDuration(metrics.inference_time_ms)} (${inferencePercent}%)`);
    }

    if (metrics.idle_time_ms > 0) {
      const idlePercent = Math.round(
        (metrics.idle_time_ms / metrics.total_duration_ms) * 100
      );
      lines.push(`Idle Time: ${this.formatDuration(metrics.idle_time_ms)} (${idlePercent}%)`);
    }

    return lines.join('\n');
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.round((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }
}

// ============================================================================
// Types
// ============================================================================

interface PerformanceMetrics {
  total_duration_ms: number;
  tool_latencies_ms: Record<string, ToolLatencyStats>;
  inference_time_ms: number;
  idle_time_ms: number;
  event_distribution: Record<string, number>;
  tool_count: number;
  message_count: number;
}

interface ToolLatencyStats {
  count: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
  total_ms: number;
}
