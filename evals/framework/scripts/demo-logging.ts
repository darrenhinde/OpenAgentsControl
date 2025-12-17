#!/usr/bin/env tsx
/**
 * Demo: Multi-Agent Logging System
 * 
 * Demonstrates the logging system with a realistic multi-agent scenario.
 * Run with: tsx scripts/demo-logging.ts
 */

import { MultiAgentLogger } from '../src/logging/index.js';

console.log('🎬 Multi-Agent Logging System Demo\n');
console.log('Simulating: openagent → simple-responder delegation\n');
console.log('═'.repeat(70));

// Create logger
const logger = new MultiAgentLogger(true);

// Simulate parent session (openagent)
console.log('\n📍 Starting parent session...\n');
logger.logSessionStart('ses_4d2a3c41fffeWb3uquPEEamO11', 'openagent');

// User prompt
logger.logMessage('ses_4d2a3c41fffeWb3uquPEEamO11', 'user', 'Call the simple-responder subagent and ask it to respond. Use the task tool to delegate.');

// Agent analyzes
logger.logMessage('ses_4d2a3c41fffeWb3uquPEEamO11', 'assistant', 'I will delegate to the simple-responder subagent...');

// Agent loads context
logger.logToolCall('ses_4d2a3c41fffeWb3uquPEEamO11', 'read', { 
  filePath: '.opencode/context/core/workflows/delegation.md' 
});

// Agent creates context bundle
logger.logToolCall('ses_4d2a3c41fffeWb3uquPEEamO11', 'bash', { 
  command: 'mkdir -p .tmp/sessions/20251217-call-simple-responder' 
});

logger.logToolCall('ses_4d2a3c41fffeWb3uquPEEamO11', 'write', { 
  filePath: '.tmp/sessions/20251217-call-simple-responder/context.md' 
});

// Agent requests approval
logger.logMessage('ses_4d2a3c41fffeWb3uquPEEamO11', 'assistant', 'Approval needed before proceeding. Do you approve this plan?');

// User approves
logger.logMessage('ses_4d2a3c41fffeWb3uquPEEamO11', 'user', 'Yes, proceed with the delegation.');

// Agent delegates
console.log('\n📍 Delegating to child session...\n');
const delegationId = logger.logDelegation(
  'ses_4d2a3c41fffeWb3uquPEEamO11',
  'simple-responder',
  'Read context from .tmp/sessions/20251217-call-simple-responder/context.md and respond.'
);

// Simulate child session creation
console.log('\n📍 Child session created...\n');
logger.logSessionStart('ses_4d2a38343ffeGNvW7Db92BbP06', 'simple-responder', 'ses_4d2a3c41fffeWb3uquPEEamO11');
logger.logChildLinked(delegationId, 'ses_4d2a38343ffeGNvW7Db92BbP06');

// Child session activity
logger.logMessage('ses_4d2a38343ffeGNvW7Db92BbP06', 'user', 'Read context from .tmp/sessions/20251217-call-simple-responder/context.md and respond.');
logger.logMessage('ses_4d2a38343ffeGNvW7Db92BbP06', 'assistant', 'AWESOME TESTING');

// Child completes
console.log('\n📍 Child session completing...\n');
logger.logSessionComplete('ses_4d2a38343ffeGNvW7Db92BbP06');

// Parent continues
logger.logMessage('ses_4d2a3c41fffeWb3uquPEEamO11', 'assistant', 'The subagent responded with "AWESOME TESTING"');

// Parent completes
console.log('\n📍 Parent session completing...\n');
logger.logSessionComplete('ses_4d2a3c41fffeWb3uquPEEamO11');

// Show hierarchy analysis
console.log('\n' + '═'.repeat(70));
console.log('\n📊 Hierarchy Analysis\n');

const tracker = logger.getTracker();
const tree = tracker.buildTree('ses_4d2a3c41fffeWb3uquPEEamO11');

if (tree) {
  console.log(`Total Sessions: ${tree.totalSessions}`);
  console.log(`Max Depth: ${tree.maxDepth}`);
  console.log(`Delegations: ${tree.delegations.length}`);
  
  console.log('\nSession Tree:');
  console.log(`  Root: ${tree.root.agent} (depth ${tree.root.depth})`);
  tree.root.children.forEach(child => {
    console.log(`    └─ Child: ${child.agent} (depth ${child.depth})`);
  });
  
  console.log('\nDelegations:');
  tree.delegations.forEach(del => {
    console.log(`  ${del.fromAgent} → ${del.toAgent}`);
    console.log(`    Prompt: ${del.prompt.substring(0, 60)}...`);
  });
}

console.log('\n' + '═'.repeat(70));
console.log('\n✅ Demo complete!\n');
console.log('This is what the logging system will show during actual eval tests.');
console.log('Next step: Integrate into event-stream-handler.ts\n');
