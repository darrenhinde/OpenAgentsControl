#!/usr/bin/env npx ts-node
/**
 * Stage Orchestration CLI
 *
 * Usage: npx ts-node stage-cli.ts <command> <feature> [args...]
 *
 * Commands:
 *   init <feature>                    - Initialize stage tracking for feature
 *   status <feature>                  - Show current stage and progress
 *   validate <feature> <stage>        - Validate stage prerequisites and readiness
 *   complete <feature> <stage>        - Mark stage complete and validate outputs
 *   rollback <feature> <stage>        - Rollback stage to previous state
 *   abort <feature>                   - Abort workflow and archive work
 *   resume <feature> <stage>          - Resume workflow from specific stage
 *
 * Stage tracking files are stored in .tmp/sessions/:
 *   .tmp/sessions/{timestamp}-{feature}/stage-tracking.json
 */

const fs = require('fs');
const path = require('path');

// Find project root (look for .git or package.json)
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const SESSIONS_DIR = path.join(PROJECT_ROOT, '.tmp', 'sessions');

// Stage definitions
const STAGES = [
  {
    id: 1,
    name: 'Architecture Decomposition',
    description: 'Define system boundaries and components',
    prerequisites: [] as number[],
    outputs: ['architecture.md', 'components.json', 'integration-points.md'],
    validationCriteria: [
      'All major components identified',
      'Component boundaries clearly defined',
      'Integration points documented',
      'Technical approach validated'
    ]
  },
  {
    id: 2,
    name: 'Story Mapping',
    description: 'Map user journeys and create stories',
    prerequisites: [1],
    outputs: ['personas.json', 'journey-maps.md', 'stories.json', 'story-map.md'],
    validationCriteria: [
      'All user journeys documented',
      'Stories written with acceptance criteria',
      'Stories organized by priority',
      'Dependencies identified'
    ]
  },
  {
    id: 3,
    name: 'Prioritization',
    description: 'Sequence work by value and dependencies',
    prerequisites: [2],
    outputs: ['prioritized-backlog.json', 'risk-matrix.md', 'dependency-graph.md', 'execution-plan.md'],
    validationCriteria: [
      'All stories prioritized',
      'Dependencies mapped',
      'Execution phases defined',
      'Critical path identified'
    ]
  },
  {
    id: 4,
    name: 'Enhanced Task Breakdown',
    description: 'Create atomic, executable tasks',
    prerequisites: [3],
    outputs: ['.tmp/tasks/{feature}/task.json', '.tmp/tasks/{feature}/subtask_*.json'],
    validationCriteria: [
      'All tasks defined with clear objectives',
      'Dependencies mapped correctly',
      'Parallel batches identified',
      'Task JSON validated'
    ]
  },
  {
    id: 5,
    name: 'Contract Definition',
    description: 'Define interfaces before implementation',
    prerequisites: [4],
    outputs: ['contracts/*.ts', 'api-contracts.md', 'data-schemas.ts'],
    validationCriteria: [
      'All integration points have contracts',
      'Contracts validated against architecture',
      'Type definitions complete',
      'Documentation written'
    ]
  },
  {
    id: 6,
    name: 'Parallel Execution',
    description: 'Execute independent work simultaneously',
    prerequisites: [5],
    outputs: ['Implemented deliverables', 'Completed tasks', 'Self-review reports'],
    validationCriteria: [
      'All tasks completed successfully',
      'Deliverables verified',
      'Acceptance criteria met',
      'No blocking failures'
    ]
  },
  {
    id: 7,
    name: 'Integration & Validation',
    description: 'Integrate and validate components',
    prerequisites: [6],
    outputs: ['Integrated system', 'Integration test results', 'Validation report'],
    validationCriteria: [
      'All components integrated',
      'Integration tests passing',
      'Acceptance criteria met',
      'System validated end-to-end'
    ]
  },
  {
    id: 8,
    name: 'Release & Learning',
    description: 'Deploy and capture insights',
    prerequisites: [7],
    outputs: ['Deployed feature', 'Release notes', 'Lessons learned', 'Updated standards'],
    validationCriteria: [
      'Feature deployed successfully',
      'Production validated',
      'Insights documented',
      'Team aligned on learnings'
    ]
  }
];

interface StageStatus {
  id: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  outputs?: string[];
  validation_results?: {
    criterion: string;
    passed: boolean;
    notes?: string;
  }[];
  error?: string;
}

interface StageTracking {
  feature: string;
  workflow_status: 'active' | 'completed' | 'aborted' | 'failed';
  current_stage: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  stages: StageStatus[];
  rollback_history?: {
    stage: number;
    timestamp: string;
    reason: string;
  }[];
}

// Helper functions
function getSessionDir(feature: string): string | null {
  if (!fs.existsSync(SESSIONS_DIR)) {
    return null;
  }
  
  const sessions = fs.readdirSync(SESSIONS_DIR)
    .filter((dir: string) => dir.endsWith(`-${feature}`))
    .sort()
    .reverse();
  
  return sessions.length > 0 ? path.join(SESSIONS_DIR, sessions[0]) : null;
}

function getOrCreateSessionDir(feature: string): string {
  const existingSession = getSessionDir(feature);
  if (existingSession) {
    return existingSession;
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  const sessionDir = path.join(SESSIONS_DIR, `${timestamp}-${feature}`);
  fs.mkdirSync(sessionDir, { recursive: true });
  return sessionDir;
}

function loadStageTracking(feature: string): StageTracking | null {
  const sessionDir = getSessionDir(feature);
  if (!sessionDir) {
    return null;
  }
  
  const trackingFile = path.join(sessionDir, 'stage-tracking.json');
  if (!fs.existsSync(trackingFile)) {
    return null;
  }
  
  return JSON.parse(fs.readFileSync(trackingFile, 'utf-8'));
}

function saveStageTracking(feature: string, tracking: StageTracking): void {
  const sessionDir = getOrCreateSessionDir(feature);
  const trackingFile = path.join(sessionDir, 'stage-tracking.json');
  tracking.updated_at = new Date().toISOString();
  fs.writeFileSync(trackingFile, JSON.stringify(tracking, null, 2));
}

function getStageById(stageId: number) {
  return STAGES.find(s => s.id === stageId);
}

// Command implementations
function initCommand(feature: string): void {
  const existingTracking = loadStageTracking(feature);
  if (existingTracking && existingTracking.workflow_status === 'active') {
    console.log(`❌ Stage tracking already exists for feature: ${feature}`);
    console.log(`   Current stage: ${existingTracking.current_stage} (${getStageById(existingTracking.current_stage)?.name})`);
    console.log(`   Use 'status' to view progress or 'abort' to start over`);
    process.exit(1);
  }
  
  const tracking: StageTracking = {
    feature,
    workflow_status: 'active',
    current_stage: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    stages: STAGES.map(stage => ({
      id: stage.id,
      name: stage.name,
      status: 'pending' as const
    })),
    rollback_history: []
  };
  
  saveStageTracking(feature, tracking);
  
  console.log(`✅ Stage tracking initialized for feature: ${feature}`);
  console.log(`   Session: ${getSessionDir(feature)}`);
  console.log(`   Starting stage: 1 (${STAGES[0].name})`);
  console.log(`\n   Use 'status ${feature}' to view progress`);
}

function statusCommand(feature: string): void {
  const tracking = loadStageTracking(feature);
  if (!tracking) {
    console.log(`❌ No stage tracking found for feature: ${feature}`);
    console.log(`   Use 'init ${feature}' to initialize stage tracking`);
    process.exit(1);
  }
  
  console.log(`\n[${feature}] Multi-Stage Orchestration Workflow`);
  console.log(`  Status: ${tracking.workflow_status} | Current Stage: ${tracking.current_stage}`);
  console.log(`  Created: ${tracking.created_at}`);
  if (tracking.completed_at) {
    console.log(`  Completed: ${tracking.completed_at}`);
  }
  console.log(`\n  Stages:`);
  
  tracking.stages.forEach(stage => {
    const stageInfo = getStageById(stage.id);
    const icon = stage.status === 'completed' ? '✅' : 
                 stage.status === 'in_progress' ? '🔄' :
                 stage.status === 'failed' ? '❌' : '○';
    
    console.log(`  ${icon} ${stage.id}. ${stage.name} [${stage.status}]`);
    
    if (stage.status === 'in_progress' && stage.started_at) {
      console.log(`     Started: ${stage.started_at}`);
    }
    
    if (stage.status === 'completed' && stage.completed_at) {
      console.log(`     Completed: ${stage.completed_at}`);
      if (stage.outputs && stage.outputs.length > 0) {
        console.log(`     Outputs: ${stage.outputs.join(', ')}`);
      }
    }
    
    if (stage.status === 'failed' && stage.error) {
      console.log(`     Error: ${stage.error}`);
    }
  });
  
  if (tracking.rollback_history && tracking.rollback_history.length > 0) {
    console.log(`\n  Rollback History:`);
    tracking.rollback_history.forEach(rollback => {
      console.log(`  - Stage ${rollback.stage} rolled back at ${rollback.timestamp}`);
      console.log(`    Reason: ${rollback.reason}`);
    });
  }
  
  const currentStage = getStageById(tracking.current_stage);
  if (currentStage && tracking.workflow_status === 'active') {
    console.log(`\n  Next Action: Complete stage ${tracking.current_stage} (${currentStage.name})`);
    console.log(`  Command: stage-cli.ts complete ${feature} ${tracking.current_stage}`);
  }
}

function validateCommand(feature: string, stageId: number): void {
  const tracking = loadStageTracking(feature);
  if (!tracking) {
    console.log(`❌ No stage tracking found for feature: ${feature}`);
    process.exit(1);
  }
  
  const stage = getStageById(stageId);
  if (!stage) {
    console.log(`❌ Invalid stage ID: ${stageId}`);
    process.exit(1);
  }
  
  console.log(`\n🔍 Validating Stage ${stageId}: ${stage.name}`);
  
  // Check prerequisites
  const prerequisitesFailed: number[] = [];
  stage.prerequisites.forEach(prereqId => {
    const prereqStage = tracking.stages.find(s => s.id === prereqId);
    if (!prereqStage || prereqStage.status !== 'completed') {
      prerequisitesFailed.push(prereqId);
    }
  });
  
  if (prerequisitesFailed.length > 0) {
    console.log(`\n❌ Prerequisites not met:`);
    prerequisitesFailed.forEach(prereqId => {
      const prereq = getStageById(prereqId);
      const prereqStatus = tracking.stages.find(s => s.id === prereqId);
      console.log(`   - Stage ${prereqId} (${prereq?.name}): ${prereqStatus?.status || 'unknown'}`);
    });
    console.log(`\n   Complete prerequisite stages before proceeding.`);
    process.exit(1);
  }
  
  console.log(`✅ Prerequisites met`);
  
  // Check if stage is in correct sequence
  if (stageId !== tracking.current_stage) {
    console.log(`\n⚠️  Warning: Stage ${stageId} is not the current stage`);
    console.log(`   Current stage: ${tracking.current_stage} (${getStageById(tracking.current_stage)?.name})`);
    console.log(`   Cannot skip stages - must execute sequentially`);
    process.exit(1);
  }
  
  console.log(`✅ Stage sequence valid`);
  console.log(`\n✅ Stage ${stageId} is ready to execute`);
  console.log(`\n   Expected outputs:`);
  stage.outputs.forEach(output => {
    console.log(`   - ${output}`);
  });
  console.log(`\n   Validation criteria:`);
  stage.validationCriteria.forEach(criterion => {
    console.log(`   - ${criterion}`);
  });
}

function completeCommand(feature: string, stageId: number): void {
  const tracking = loadStageTracking(feature);
  if (!tracking) {
    console.log(`❌ No stage tracking found for feature: ${feature}`);
    process.exit(1);
  }
  
  const stage = getStageById(stageId);
  if (!stage) {
    console.log(`❌ Invalid stage ID: ${stageId}`);
    process.exit(1);
  }
  
  if (stageId !== tracking.current_stage) {
    console.log(`❌ Cannot complete stage ${stageId} - not the current stage`);
    console.log(`   Current stage: ${tracking.current_stage}`);
    process.exit(1);
  }
  
  const stageStatus = tracking.stages.find(s => s.id === stageId);
  if (!stageStatus) {
    console.log(`❌ Stage status not found`);
    process.exit(1);
  }
  
  // Mark stage as completed
  stageStatus.status = 'completed';
  stageStatus.completed_at = new Date().toISOString();
  
  // Move to next stage or complete workflow
  if (stageId < STAGES.length) {
    tracking.current_stage = stageId + 1;
    const nextStage = tracking.stages.find(s => s.id === stageId + 1);
    if (nextStage) {
      nextStage.status = 'in_progress';
      nextStage.started_at = new Date().toISOString();
    }
  } else {
    tracking.workflow_status = 'completed';
    tracking.completed_at = new Date().toISOString();
  }
  
  saveStageTracking(feature, tracking);
  
  console.log(`✅ Stage ${stageId} (${stage.name}) marked complete`);
  
  if (tracking.workflow_status === 'completed') {
    console.log(`\n🎉 Workflow completed for feature: ${feature}`);
    console.log(`   All 8 stages completed successfully`);
  } else {
    const nextStage = getStageById(tracking.current_stage);
    console.log(`\n   Next stage: ${tracking.current_stage} (${nextStage?.name})`);
    console.log(`   Command: stage-cli.ts validate ${feature} ${tracking.current_stage}`);
  }
}

function rollbackCommand(feature: string, stageId: number, reason?: string): void {
  const tracking = loadStageTracking(feature);
  if (!tracking) {
    console.log(`❌ No stage tracking found for feature: ${feature}`);
    process.exit(1);
  }
  
  const stage = getStageById(stageId);
  if (!stage) {
    console.log(`❌ Invalid stage ID: ${stageId}`);
    process.exit(1);
  }
  
  const stageStatus = tracking.stages.find(s => s.id === stageId);
  if (!stageStatus) {
    console.log(`❌ Stage status not found`);
    process.exit(1);
  }
  
  console.log(`\n🔄 Rolling back Stage ${stageId}: ${stage.name}`);
  
  // Reset stage status
  stageStatus.status = 'pending';
  stageStatus.started_at = undefined;
  stageStatus.completed_at = undefined;
  stageStatus.outputs = undefined;
  stageStatus.validation_results = undefined;
  stageStatus.error = undefined;
  
  // Reset all subsequent stages
  tracking.stages.forEach(s => {
    if (s.id > stageId) {
      s.status = 'pending';
      s.started_at = undefined;
      s.completed_at = undefined;
      s.outputs = undefined;
      s.validation_results = undefined;
      s.error = undefined;
    }
  });
  
  // Update current stage
  tracking.current_stage = stageId;
  
  // Record rollback in history
  if (!tracking.rollback_history) {
    tracking.rollback_history = [];
  }
  tracking.rollback_history.push({
    stage: stageId,
    timestamp: new Date().toISOString(),
    reason: reason || 'Manual rollback'
  });
  
  saveStageTracking(feature, tracking);
  
  console.log(`✅ Stage ${stageId} rolled back to pending`);
  console.log(`   All subsequent stages reset`);
  console.log(`   Current stage: ${tracking.current_stage}`);
  console.log(`\n   Use 'validate ${feature} ${stageId}' to restart stage`);
}

function abortCommand(feature: string, reason?: string): void {
  const tracking = loadStageTracking(feature);
  if (!tracking) {
    console.log(`❌ No stage tracking found for feature: ${feature}`);
    process.exit(1);
  }
  
  tracking.workflow_status = 'aborted';
  tracking.completed_at = new Date().toISOString();
  
  saveStageTracking(feature, tracking);
  
  console.log(`\n⚠️  Workflow aborted for feature: ${feature}`);
  console.log(`   Reason: ${reason || 'Manual abort'}`);
  console.log(`   Current stage at abort: ${tracking.current_stage}`);
  console.log(`\n   Work preserved in: ${getSessionDir(feature)}`);
  console.log(`   Use 'init ${feature}' to start a new workflow`);
}

function resumeCommand(feature: string, stageId: number): void {
  const tracking = loadStageTracking(feature);
  if (!tracking) {
    console.log(`❌ No stage tracking found for feature: ${feature}`);
    process.exit(1);
  }
  
  if (tracking.workflow_status !== 'aborted' && tracking.workflow_status !== 'failed') {
    console.log(`❌ Cannot resume - workflow status is: ${tracking.workflow_status}`);
    console.log(`   Resume is only for aborted or failed workflows`);
    process.exit(1);
  }
  
  const stage = getStageById(stageId);
  if (!stage) {
    console.log(`❌ Invalid stage ID: ${stageId}`);
    process.exit(1);
  }
  
  tracking.workflow_status = 'active';
  tracking.current_stage = stageId;
  
  const stageStatus = tracking.stages.find(s => s.id === stageId);
  if (stageStatus) {
    stageStatus.status = 'in_progress';
    stageStatus.started_at = new Date().toISOString();
  }
  
  saveStageTracking(feature, tracking);
  
  console.log(`✅ Workflow resumed for feature: ${feature}`);
  console.log(`   Resuming at stage: ${stageId} (${stage.name})`);
  console.log(`\n   Use 'status ${feature}' to view progress`);
}

// Main CLI
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Stage Orchestration CLI

Usage: npx ts-node stage-cli.ts <command> <feature> [args...]

Commands:
  init <feature>                    - Initialize stage tracking for feature
  status <feature>                  - Show current stage and progress
  validate <feature> <stage>        - Validate stage prerequisites and readiness
  complete <feature> <stage>        - Mark stage complete and validate outputs
  rollback <feature> <stage>        - Rollback stage to previous state
  abort <feature>                   - Abort workflow and archive work
  resume <feature> <stage>          - Resume workflow from specific stage

Stages:
  1. Architecture Decomposition
  2. Story Mapping
  3. Prioritization
  4. Enhanced Task Breakdown
  5. Contract Definition
  6. Parallel Execution
  7. Integration & Validation
  8. Release & Learning

Examples:
  stage-cli.ts init auth-system
  stage-cli.ts status auth-system
  stage-cli.ts validate auth-system 1
  stage-cli.ts complete auth-system 1
  stage-cli.ts rollback auth-system 3
  stage-cli.ts abort auth-system
    `);
    process.exit(0);
  }
  
  const command = args[0];
  const feature = args[1];
  
  if (!feature && command !== 'help') {
    console.log(`❌ Feature name required`);
    process.exit(1);
  }
  
  switch (command) {
    case 'init':
      initCommand(feature);
      break;
    
    case 'status':
      statusCommand(feature);
      break;
    
    case 'validate':
      const validateStage = parseInt(args[2], 10);
      if (isNaN(validateStage)) {
        console.log(`❌ Stage ID required (1-8)`);
        process.exit(1);
      }
      validateCommand(feature, validateStage);
      break;
    
    case 'complete':
      const completeStage = parseInt(args[2], 10);
      if (isNaN(completeStage)) {
        console.log(`❌ Stage ID required (1-8)`);
        process.exit(1);
      }
      completeCommand(feature, completeStage);
      break;
    
    case 'rollback':
      const rollbackStage = parseInt(args[2], 10);
      if (isNaN(rollbackStage)) {
        console.log(`❌ Stage ID required (1-8)`);
        process.exit(1);
      }
      const rollbackReason = args[3];
      rollbackCommand(feature, rollbackStage, rollbackReason);
      break;
    
    case 'abort':
      const abortReason = args[2];
      abortCommand(feature, abortReason);
      break;
    
    case 'resume':
      const resumeStage = parseInt(args[2], 10);
      if (isNaN(resumeStage)) {
        console.log(`❌ Stage ID required (1-8)`);
        process.exit(1);
      }
      resumeCommand(feature, resumeStage);
      break;
    
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log(`   Use 'stage-cli.ts' without arguments to see usage`);
      process.exit(1);
  }
}

main();
