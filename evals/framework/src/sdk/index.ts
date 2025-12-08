// Server and client management
export { ServerManager } from './server-manager.js';
export type { ServerConfig } from './server-manager.js';

export { ClientManager } from './client-manager.js';
export type { ClientConfig, PromptOptions, SessionInfo } from './client-manager.js';

export { EventStreamHandler } from './event-stream-handler.js';
export type {
  EventType,
  ServerEvent,
  PermissionRequestEvent,
  EventHandler,
  PermissionHandler,
} from './event-stream-handler.js';

// Approval strategies
export type { ApprovalStrategy, ApprovalDecision } from './approval/approval-strategy.js';
export { AutoApproveStrategy } from './approval/auto-approve-strategy.js';
export { AutoDenyStrategy } from './approval/auto-deny-strategy.js';
export { SmartApprovalStrategy } from './approval/smart-approval-strategy.js';
export type { SmartApprovalConfig } from './approval/smart-approval-strategy.js';

// Test execution (modular components)
export { TestRunner } from './test-runner.js';
export type { TestRunnerConfig, TestResult } from './test-runner.js';

export { TestExecutor } from './test-executor.js';
export type { ExecutionConfig, ExecutionResult, ExecutionLogger } from './test-executor.js';

export { ResultValidator } from './result-validator.js';
export type { ValidationLogger } from './result-validator.js';

export { logEvent, createLogger } from './event-logger.js';

// Test case loading
export { loadTestCase, loadTestCases } from './test-case-loader.js';
export type { TestCase, BehaviorExpectation } from './test-case-schema.js';

// Result saving
export { ResultSaver } from './result-saver.js';
export type { SaveOptions, ResultMetadata, ResultSummary } from './result-saver.js';

// Prompt management
export { PromptManager } from './prompt-manager.js';
export type { PromptMetadata, SwitchResult } from './prompt-manager.js';
