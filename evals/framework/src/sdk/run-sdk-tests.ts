#!/usr/bin/env node

/**
 * Main CLI entry point for SDK-based test execution
 * 
 * Usage:
 *   npm run eval:sdk
 *   npm run eval:sdk -- --debug
 *   npm run eval:sdk -- --verbose
 *   npm run eval:sdk -- --no-evaluators
 *   npm run eval:sdk -- --core
 *   npm run eval:sdk -- --agent=opencoder
 *   npm run eval:sdk -- --agent=openagent
 *   npm run eval:sdk -- --model=opencode/grok-code-fast
 *   npm run eval:sdk -- --model=anthropic/claude-3-5-sonnet-20241022
 *   npm run eval:sdk -- --pattern="developer/*.yaml" --model=openai/gpt-4-turbo
 *   npm run eval:sdk -- --prompt-variant=gpt --agent=openagent
 *   npm run eval:sdk -- --agent=opencoder --verbose  # Show full conversations
 * 
 * Options:
 *   --debug              Enable debug logging and keep sessions for inspection
 *   --verbose            Show full conversation (prompts + responses) after each test
 *                        (automatically enables --debug)
 *   --no-evaluators      Skip running evaluators (faster)
 *   --core               Run core test suite only (7 tests, ~5-8 min)
 *   --agent=AGENT        Run tests for specific agent (openagent, opencoder)
 *   --subagent=NAME      Test a subagent (coder-agent, tester, reviewer, etc.)
 *                        Default: Standalone mode (forces mode: primary)
 *   --delegate           Test subagent via parent delegation (requires --subagent)
 *                        Uses appropriate parent agent (opencoder, openagent, etc.)
 *   --model=PROVIDER/MODEL  Override default model (default: opencode/grok-code-fast)
 *   --pattern=GLOB       Run specific test files (default: star-star/star.yaml)
 *   --timeout=MS         Test timeout in milliseconds (default: 60000)
 *   --prompt-variant=NAME Use specific prompt variant (e.g., gpt, gemini, grok, llama)
 *                         Auto-detects recommended model from prompt metadata
 */

import { TestRunner } from './test-runner.js';
import { loadTestCase, loadTestCases } from './test-case-loader.js';
import { ResultSaver } from './result-saver.js';
import { PromptManager } from './prompt-manager.js';
import { SuiteValidator } from './suite-validator.js';
import { globSync } from 'glob';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, existsSync, readdirSync } from 'fs';
import type { TestResult } from './test-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CliArgs {
  debug: boolean;
  verbose: boolean;
  noEvaluators: boolean;
  core: boolean;
  suite?: string;
  agent?: string;
  pattern?: string;
  timeout?: number;
  model?: string;
  promptVariant?: string;
  subagent?: string;      // Test a subagent
  delegate?: boolean;     // Test subagent via delegation (requires --subagent)
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  
  return {
    debug: args.includes('--debug'),
    verbose: args.includes('--verbose'),
    noEvaluators: args.includes('--no-evaluators'),
    core: args.includes('--core'),
    suite: args.find(a => a.startsWith('--suite='))?.split('=')[1],
    agent: args.find(a => a.startsWith('--agent='))?.split('=')[1],
    pattern: args.find(a => a.startsWith('--pattern='))?.split('=')[1],
    timeout: parseInt(args.find(a => a.startsWith('--timeout='))?.split('=')[1] || '60000'),
    model: args.find(a => a.startsWith('--model='))?.split('=')[1],
    promptVariant: args.find(a => a.startsWith('--prompt-variant='))?.split('=')[1],
    subagent: args.find(a => a.startsWith('--subagent='))?.split('=')[1],
    delegate: args.includes('--delegate'),
  };
}

/**
 * Clean up test_tmp directory, preserving README.md and .gitignore
 */
function cleanupTestTmp(testTmpDir: string): void {
  if (!existsSync(testTmpDir)) {
    return;
  }
  
  const preserveFiles = ['README.md', '.gitignore'];
  
  try {
    const files = readdirSync(testTmpDir);
    let cleanedCount = 0;
    
    for (const file of files) {
      if (!preserveFiles.includes(file)) {
        const filePath = join(testTmpDir, file);
        rmSync(filePath, { recursive: true, force: true });
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} file(s) from test_tmp/\n`);
    }
  } catch (error) {
    console.warn(`Warning: Could not clean test_tmp: ${(error as Error).message}`);
  }
}

function printResults(results: TestResult[]): void {
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  console.log('\n' + '='.repeat(70));
  console.log('TEST RESULTS');
  console.log('='.repeat(70));
  
  results.forEach((result, idx) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`\n${idx + 1}. ${icon} ${result.testCase.id} - ${result.testCase.name}`);
    console.log(`   Duration: ${result.duration}ms`);
    console.log(`   Events: ${result.events.length}`);
    console.log(`   Approvals: ${result.approvalsGiven}`);
    
    // Show context loading details if available
    if (result.evaluation) {
      const contextEval = result.evaluation.evaluatorResults.find(e => e.evaluator === 'context-loading');
      if (contextEval && contextEval.metadata) {
        const metadata = contextEval.metadata;
        
        // Check if this is a task session
        if (metadata.isTaskSession) {
          if (metadata.isBashOnly) {
            console.log(`   Context Loading: ⊘ Bash-only task (not required)`);
          } else if (metadata.contextCheck) {
            const check = metadata.contextCheck;
            if (check.contextFileLoaded) {
              const timeDiff = check.executionTimestamp && check.loadTimestamp 
                ? check.executionTimestamp - check.loadTimestamp 
                : 0;
              console.log(`   Context Loading:`);
              console.log(`     ✓ Loaded: ${check.contextFilePath}`);
              console.log(`     ✓ Timing: Context loaded ${timeDiff}ms before execution`);
            } else {
              console.log(`   Context Loading:`);
              console.log(`     ✗ No context loaded before execution`);
            }
          }
        } else {
          console.log(`   Context Loading: ⊘ Conversational session (not required)`);
        }
      }
      
      console.log(`   Violations: ${result.evaluation.totalViolations} (${result.evaluation.violationsBySeverity.error} errors, ${result.evaluation.violationsBySeverity.warning} warnings)`);
    }
    
    if (result.errors.length > 0) {
      console.log(`   Errors:`);
      result.errors.forEach(err => console.log(`     - ${err}`));
    }
  });
  
  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY: ${passed}/${results.length} tests passed (${failed} failed)`);
  console.log('='.repeat(70) + '\n');
  
  // Print failed tests details
  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(result => {
      console.log(`\n  ❌ ${result.testCase.id}`);
      if (result.errors.length > 0) {
        console.log(`     Errors: ${result.errors.join(', ')}`);
      }
      if (result.evaluation && result.evaluation.totalViolations > 0) {
        console.log(`     Violations: ${result.evaluation.totalViolations}`);
        result.evaluation.allViolations.forEach(v => {
          console.log(`       - [${v.severity}] ${v.type}: ${v.message}`);
        });
      }
    });
    console.log();
  }
}

/**
 * Display full conversation from a session
 */
async function displayConversation(sessionId: string): Promise<void> {
  const { homedir } = await import('os');
  const { readFileSync, readdirSync, existsSync } = await import('fs');
  
  const sessionDir = join(homedir(), '.local', 'share', 'opencode', 'storage', 'message', sessionId);
  const partDir = join(homedir(), '.local', 'share', 'opencode', 'storage', 'part');
  
  if (!existsSync(sessionDir)) {
    console.log(`⚠️  Session not found: ${sessionId}`);
    return;
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('FULL CONVERSATION');
  console.log('='.repeat(70));
  console.log(`Session: ${sessionId}\n`);
  
  // Read all message files and sort by creation time
  const messageFiles = readdirSync(sessionDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const content = JSON.parse(readFileSync(join(sessionDir, f), 'utf-8'));
      return { file: f, content, created: content.time?.created || 0 };
    })
    .sort((a, b) => a.created - b.created);
  
  for (const { content: msg } of messageFiles) {
    const role = msg.role;
    const msgId = msg.id;
    
    if (role === 'user') {
      console.log('━'.repeat(70));
      console.log('👤 USER PROMPT');
      console.log('━'.repeat(70));
      
      // Get actual user prompt from parts
      const msgPartDir = join(partDir, msgId);
      if (existsSync(msgPartDir)) {
        const partFiles = readdirSync(msgPartDir).filter(f => f.endsWith('.json'));
        for (const partFile of partFiles) {
          const part = JSON.parse(readFileSync(join(msgPartDir, partFile), 'utf-8'));
          if (part.type === 'text' && part.text) {
            console.log(part.text);
          }
        }
      }
      console.log();
      
    } else if (role === 'assistant') {
      console.log('━'.repeat(70));
      console.log('🤖 ASSISTANT');
      console.log('━'.repeat(70));
      
      // Read parts from the part directory
      const msgPartDir = join(partDir, msgId);
      if (existsSync(msgPartDir)) {
        const partFiles = readdirSync(msgPartDir)
          .filter(f => f.endsWith('.json'))
          .map(f => {
            const content = JSON.parse(readFileSync(join(msgPartDir, f), 'utf-8'));
            return { file: f, content, created: content.time?.start || content.time?.created || 0 };
          })
          .sort((a, b) => a.created - b.created);
        
        for (const { content: part } of partFiles) {
          if ((part.type === 'text' || part.type === 'reasoning') && part.text) {
            console.log(part.text);
            console.log();
          } else if (part.type === 'tool') {
            const toolInput = part.state?.input || part.input || {};
            console.log(`🔧 TOOL CALL: ${part.tool}`);
            console.log(`   Input: ${JSON.stringify(toolInput, null, 2)}`);
            console.log();
          } else if (part.type === 'tool_result') {
            const result = (part.state?.result || part.result || '').toString().substring(0, 300);
            if (result) {
              console.log(`📊 TOOL RESULT:`);
              console.log(result + (result.length > 300 ? '...' : ''));
              console.log();
            }
          }
        }
      }
      console.log();
    }
  }
  
  console.log('='.repeat(70) + '\n');
}

async function main() {
  const args = parseArgs();
  
  // If --verbose is set, automatically enable --debug (required for session data)
  if (args.verbose && !args.debug) {
    args.debug = true;
    console.log('ℹ️  --verbose flag automatically enabled --debug (required for session data)\n');
  }
  
  // Set DEBUG_VERBOSE early if debug mode is enabled
  if (args.debug) {
    process.env.DEBUG_VERBOSE = 'true';
  }
  
  console.log('🚀 OpenCode SDK Test Runner\n');
  
  // Determine project root (for prompt management)
  const projectRoot = join(__dirname, '../../../..');
  
  // Determine which agent(s) to test
  const agentsDir = join(__dirname, '../../..', 'agents');
  
  // Handle subagent testing
  let agentToTest = args.agent;
  let isSubagentTest = false;
  let isDelegationTest = false;
  let parentAgent: string | undefined;
  
  if (args.subagent) {
    // Validate --delegate flag usage
    if (args.delegate && args.agent) {
      console.error('❌ Error: Cannot use --delegate with --agent');
      console.error('   Use either:');
      console.error('     --subagent=NAME              (standalone mode)');
      console.error('     --subagent=NAME --delegate   (delegation mode)');
      console.error('     --agent=NAME                 (main agent)\n');
      process.exit(1);
    }
    
    isSubagentTest = true;
    isDelegationTest = args.delegate || false;
    
    // Map subagents to their parent agents for delegation testing
    const subagentParentMap: Record<string, string> = {
      // Code subagents → opencoder
      'coder-agent': 'opencoder',
      'CoderAgent': 'opencoder',
      'tester': 'opencoder',
      'TestEngineer': 'opencoder',
      'reviewer': 'opencoder',
      'CodeReviewer': 'opencoder',
      'build-agent': 'opencoder',
      'BuildAgent': 'opencoder',
      'codebase-pattern-analyst': 'opencoder',
      'PatternAnalyst': 'opencoder',
      
      // Core subagents → openagent
      'task-manager': 'openagent',
      'TaskManager': 'openagent',
      'documentation': 'openagent',
      'DocWriter': 'openagent',
      'contextscout': 'openagent',
      'ContextScout': 'openagent',
      'delegation-controller': 'openagent',
      'DelegationController': 'openagent',
      
      // System-builder subagents → system-builder
      'agent-generator': 'system-builder',
      'AgentGenerator': 'system-builder',
      'command-creator': 'system-builder',
      'CommandCreator': 'system-builder',
      'context-organizer': 'system-builder',
      'ContextOrganizer': 'system-builder',
      'domain-analyzer': 'system-builder',
      'DomainAnalyzer': 'system-builder',
      'workflow-designer': 'system-builder',
      'WorkflowDesigner': 'system-builder',
      
      // Utils → openagent
      'image-specialist': 'openagent',
      'ImageSpecialist': 'openagent',
    };
    
    if (isDelegationTest) {
      // Delegation mode: use parent agent
      parentAgent = subagentParentMap[args.subagent];
      
      if (!parentAgent) {
        console.error(`❌ Error: Unknown subagent '${args.subagent}'`);
        console.error('\n📋 Available subagents:');
        console.error('\n  Code subagents (parent: opencoder):');
        console.error('    - CoderAgent, TestEngineer, CodeReviewer, BuildAgent, PatternAnalyst');
        console.error('\n  Core subagents (parent: openagent):');
        console.error('    - TaskManager, DocWriter, ContextScout');
        console.error('\n  System-builder subagents (parent: system-builder):');
        console.error('    - AgentGenerator, CommandCreator, ContextOrganizer');
        console.error('    - DomainAnalyzer, WorkflowDesigner');
        console.error('\n  Utils subagents (parent: openagent):');
        console.error('    - ImageSpecialist\n');
        process.exit(1);
      }
      
      agentToTest = parentAgent;
      console.log(`🔗 Delegation Test Mode`);
      console.log(`   Subagent: ${args.subagent}`);
      console.log(`   Parent: ${parentAgent}`);
      console.log(`   Tests will verify delegation from ${parentAgent} → ${args.subagent}\n`);
    } else {
      // Standalone mode: test subagent directly (will force mode: primary)
      agentToTest = args.subagent;
      console.log(`⚡ Standalone Test Mode`);
      console.log(`   Subagent: ${args.subagent}`);
      console.log(`   Mode: Forced to 'primary' for direct testing`);
      console.log(`   Note: In production, this subagent runs as 'mode: subagent'\n`);
    }
  }
  
  // Initialize prompt manager for variant switching
  const promptManager = new PromptManager(projectRoot);
  let promptVariant = args.promptVariant;
  let modelFamily: string | undefined;
  let switchedPrompt = false;
  
  /**
   * Resolve agent path to support both old and new directory structures
   * Old: agents/openagent/tests
   * New: agents/core/openagent/tests
   * Subagents: agents/subagents/code/coder-agent/tests
   */
  const resolveAgentTestDir = (agent: string): string => {
    // Map old agent names to new category-based paths
    const agentCategoryMap: Record<string, string> = {
      'openagent': 'core/openagent',
      'OpenAgent': 'core/openagent',
      'opencoder': 'core/opencoder',
      'OpenCoder': 'core/opencoder',
      'system-builder': 'meta/system-builder',
      'OpenSystemBuilder': 'meta/system-builder',
      'codebase-agent': 'development/codebase-agent',
      'OpenCodebaseAgent': 'development/codebase-agent',
      'devops-specialist': 'development/devops-specialist',
      'OpenDevopsSpecialist': 'development/devops-specialist',
      'frontend-specialist': 'development/frontend-specialist',
      'OpenFrontendSpecialist': 'development/frontend-specialist',
      'backend-specialist': 'development/backend-specialist',
      'OpenBackendSpecialist': 'development/backend-specialist',
      'technical-writer': 'content/technical-writer',
      'OpenTechnicalWriter': 'content/technical-writer',
      'copywriter': 'content/copywriter',
      'OpenCopywriter': 'content/copywriter',
      'data-analyst': 'data/data-analyst',
      'OpenDataAnalyst': 'data/data-analyst',
      'repo-manager': 'meta/repo-manager',
      'OpenRepoManager': 'meta/repo-manager',
    };
    
    // Map subagent names to their full paths
    const subagentPathMap: Record<string, string> = {
      // Code subagents
      'coder-agent': 'subagents/code/coder-agent',
      'CoderAgent': 'subagents/code/coder-agent',
      'tester': 'subagents/code/tester',
      'TestEngineer': 'subagents/code/tester',
      'reviewer': 'subagents/code/reviewer',
      'CodeReviewer': 'subagents/code/reviewer',
      'build-agent': 'subagents/code/build-agent',
      'BuildAgent': 'subagents/code/build-agent',
      'codebase-pattern-analyst': 'subagents/code/codebase-pattern-analyst',
      'PatternAnalyst': 'subagents/code/codebase-pattern-analyst',
      // Core subagents
      'task-manager': 'subagents/core/task-manager',
      'TaskManager': 'subagents/core/task-manager',
      'documentation': 'subagents/core/documentation',
      'DocWriter': 'subagents/core/documentation',
      'contextscout': 'subagents/core/contextscout',
      'ContextScout': 'subagents/core/contextscout',
      'delegation-controller': 'subagents/core/delegation-controller',
      'DelegationController': 'subagents/core/delegation-controller',
      // System-builder subagents
      'agent-generator': 'subagents/system-builder/agent-generator',
      'AgentGenerator': 'subagents/system-builder/agent-generator',
      'command-creator': 'subagents/system-builder/command-creator',
      'CommandCreator': 'subagents/system-builder/command-creator',
      'context-organizer': 'subagents/system-builder/context-organizer',
      'ContextOrganizer': 'subagents/system-builder/context-organizer',
      'domain-analyzer': 'subagents/system-builder/domain-analyzer',
      'DomainAnalyzer': 'subagents/system-builder/domain-analyzer',
      'workflow-designer': 'subagents/system-builder/workflow-designer',
      'WorkflowDesigner': 'subagents/system-builder/workflow-designer',
      // Utils subagents
      'image-specialist': 'subagents/utils/image-specialist',
      'ImageSpecialist': 'subagents/utils/image-specialist',
    };
    
    // Check if it's a subagent first
    if (subagentPathMap[agent]) {
      return join(agentsDir, subagentPathMap[agent], 'tests');
    }
    
    // If agent already contains a slash, it's category-based
    const agentPath = agent.includes('/') ? agent : (agentCategoryMap[agent] || agent);
    return join(agentsDir, agentPath, 'tests');
  };
  
  let testDirs: string[] = [];
  
  // Shared tests directory (available to all agents)
  const sharedTestsDir = join(agentsDir, 'shared', 'tests');
  
  if (agentToTest) {
    // Test specific agent + shared tests
    const agentTestDir = resolveAgentTestDir(agentToTest);
    testDirs = [agentTestDir, sharedTestsDir];
    console.log(`Testing agent: ${agentToTest}\n`);
  } else {
    // Test all core agents + shared tests (using new category-based paths)
    const availableAgents = ['core/openagent', 'core/opencoder'];
    testDirs = [...availableAgents.map(a => resolveAgentTestDir(a)), sharedTestsDir];
    console.log(`Testing all agents: ${availableAgents.join(', ')}\n`);
  }
  
  // Find test files across all test directories
  let pattern = args.pattern || '**/*.yaml';
  let testFiles: string[] = [];
  
  // If --suite flag is set, load suite definition
  if (args.suite && agentToTest) {
    console.log(`🎯 Loading test suite: ${args.suite}\n`);
    
    const suiteValidator = new SuiteValidator(agentsDir);
    
    try {
      // Load suite definition
      const suite = suiteValidator.loadSuite(agentToTest, args.suite);
      
      // Validate suite
      const validation = suiteValidator.validateSuite(agentToTest, suite);
      
      if (!validation.valid) {
        console.error('❌ Suite validation failed:\n');
        validation.errors.forEach(err => {
          console.error(`   ${err.field}: ${err.message}`);
        });
        
        if (validation.warnings.length > 0) {
          console.warn('\n⚠️  Warnings:\n');
          validation.warnings.forEach(warn => console.warn(`   ${warn}`));
        }
        
        process.exit(1);
      }
      
      // Show warnings but continue
      if (validation.warnings.length > 0) {
        console.warn('⚠️  Warnings:\n');
        validation.warnings.forEach(warn => console.warn(`   ${warn}`));
        console.log();
      }
      
      // Get test paths from suite
      testFiles = suiteValidator.getTestPaths(agentToTest, suite);
      
      console.log(`✅ Suite validated: ${suite.name}`);
      console.log(`   Tests: ${suite.totalTests}`);
      console.log(`   Estimated runtime: ${suite.estimatedRuntime}\n`);
      
    } catch (error) {
      console.error(`❌ Failed to load suite: ${(error as Error).message}`);
      process.exit(1);
    }
  }
  // If --core flag is set, use core test patterns (legacy)
  else if (args.core) {
    console.log('🎯 Running CORE test suite (7 tests)\n');
    const coreTests = [
      '01-critical-rules/approval-gate/05-approval-before-execution-positive.yaml',
      '01-critical-rules/context-loading/01-code-task.yaml',
      '01-critical-rules/context-loading/09-multi-standards-to-docs.yaml',
      '01-critical-rules/stop-on-failure/02-stop-and-report-positive.yaml',
      '08-delegation/simple-task-direct.yaml',
      '06-integration/medium/04-subagent-verification.yaml',
      '09-tool-usage/dedicated-tools-usage.yaml'
    ];
    
    for (const testDir of testDirs) {
      for (const coreTest of coreTests) {
        const testPath = join(testDir, coreTest);
        if (existsSync(testPath)) {
          testFiles.push(testPath);
        }
      }
    }
  } else {
    for (const testDir of testDirs) {
      const files = globSync(pattern, { cwd: testDir, absolute: true });
      testFiles = testFiles.concat(files);
    }
  }
  
  if (testFiles.length === 0) {
    console.error(`❌ No test files found matching pattern: ${pattern}`);
    console.error(`   Searched in: ${testDirs.join(', ')}`);
    process.exit(1);
  }
  
  console.log(`Found ${testFiles.length} test file(s):\n`);
  testFiles.forEach((f: string, idx: number) => {
    // Show relative path from agents dir
    const relativePath = f.replace(agentsDir + '/', '');
    console.log(`  ${idx + 1}. ${relativePath}`);
  });
  console.log();
  
  // Load test cases
  console.log('Loading test cases...');
  const testCases = await loadTestCases(testFiles);
  console.log(`✅ Loaded ${testCases.length} test case(s)\n`);
  
  // Handle prompt variant switching
  let modelToUse = args.model;
  
  if (promptVariant && agentToTest) {
    console.log(`📝 Switching to prompt variant: ${promptVariant}\n`);
    
    // Check if variant exists
    if (!promptManager.variantExists(agentToTest, promptVariant)) {
      const available = promptManager.listVariants(agentToTest);
      console.error(`❌ Prompt variant '${promptVariant}' not found for agent '${agentToTest}'`);
      console.error(`   Available variants: ${available.join(', ')}`);
      process.exit(1);
    }
    
    // Switch to variant
    const switchResult = promptManager.switchToVariant(agentToTest, promptVariant);
    
    if (!switchResult.success) {
      console.error(`❌ Failed to switch prompt: ${switchResult.error}`);
      process.exit(1);
    }
    
    switchedPrompt = true;
    modelFamily = switchResult.metadata.model_family;
    
    console.log(`   ✅ Switched to: ${switchResult.variantPath}`);
    console.log(`   Model family: ${modelFamily || 'unknown'}`);
    console.log(`   Status: ${switchResult.metadata.status || 'unknown'}`);
    
    // Auto-detect model from metadata if not specified
    if (!modelToUse && switchResult.recommendedModel) {
      modelToUse = switchResult.recommendedModel;
      console.log(`   📌 Auto-detected model: ${modelToUse}`);
    }
    
    if (switchResult.metadata.recommended_models && switchResult.metadata.recommended_models.length > 1) {
      console.log(`   Other recommended models:`);
      switchResult.metadata.recommended_models.slice(1).forEach(m => {
        console.log(`     - ${m}`);
      });
    }
    console.log();
  } else if (promptVariant && !agentToTest) {
    console.warn(`⚠️  --prompt-variant requires --agent to be specified`);
    console.warn(`   Example: --agent=openagent --prompt-variant=gpt\n`);
  }
  
  // Create test runner
  const runner = new TestRunner({
    debug: args.debug,
    defaultTimeout: args.timeout,
    runEvaluators: !args.noEvaluators,
    defaultModel: modelToUse, // Will use 'opencode/grok-code-fast' if not specified
  });
  
  if (modelToUse) {
    console.log(`Using model: ${modelToUse}`);
  } else {
    console.log('Using default model: opencode/grok-code-fast (free tier)');
  }
  console.log();
  
  // Clean up test_tmp directory before running tests
  const testTmpDir = join(agentsDir, '..', 'test_tmp');
  cleanupTestTmp(testTmpDir);
  
  try {
    // Start runner with the agent to test
    console.log('Starting test runner...');
    const forceStandalone = isSubagentTest && !isDelegationTest;
    await runner.start(agentToTest || 'openagent', forceStandalone);
    console.log('✅ Test runner started\n');
    
    // Run tests
    console.log('Running tests...\n');
    const results = await runner.runTests(testCases);
    
    // Stop runner
    console.log('\nStopping test runner...');
    await runner.stop();
    console.log('✅ Test runner stopped\n');
    
    // Clean up test_tmp directory after tests
    cleanupTestTmp(testTmpDir);
    
    // Restore default prompt if we switched
    if (switchedPrompt && agentToTest) {
      console.log(`\n📝 Restoring default prompt for ${agentToTest}...`);
      const restored = promptManager.restoreDefault(agentToTest);
      if (restored) {
        console.log('   ✅ Default prompt restored\n');
      } else {
        console.warn('   ⚠️  Failed to restore default prompt\n');
      }
    }
    
    // Save results to JSON
    if (results.length > 0) {
      const resultsDir = join(agentsDir, '..', 'results');
      const resultSaver = new ResultSaver(resultsDir);
      
      // Determine agent from test cases (all tests should be for same agent)
      // Normalize agent to category-based format for consistency
      let agent = testCases[0].agent || agentToTest || 'unknown';
      
      // Normalize to category-based format if needed
      const agentCategoryMap: Record<string, string> = {
        'openagent': 'core/openagent',
        'OpenAgent': 'core/openagent',
        'opencoder': 'core/opencoder',
        'OpenCoder': 'core/opencoder',
        'system-builder': 'meta/system-builder',
        'OpenSystemBuilder': 'meta/system-builder',
        'codebase-agent': 'development/codebase-agent',
        'OpenCodebaseAgent': 'development/codebase-agent',
        'devops-specialist': 'development/devops-specialist',
        'OpenDevopsSpecialist': 'development/devops-specialist',
        'frontend-specialist': 'development/frontend-specialist',
        'OpenFrontendSpecialist': 'development/frontend-specialist',
        'backend-specialist': 'development/backend-specialist',
        'OpenBackendSpecialist': 'development/backend-specialist',
        'technical-writer': 'content/technical-writer',
        'OpenTechnicalWriter': 'content/technical-writer',
        'copywriter': 'content/copywriter',
        'OpenCopywriter': 'content/copywriter',
        'data-analyst': 'data/data-analyst',
        'OpenDataAnalyst': 'data/data-analyst',
        'repo-manager': 'meta/repo-manager',
        'OpenRepoManager': 'meta/repo-manager',
      };
      
      if (!agent.includes('/') && agentCategoryMap[agent]) {
        agent = agentCategoryMap[agent];
      }
      
      const model = modelToUse || 'opencode/grok-code-fast';
      
      try {
        const savedPath = await resultSaver.save(results, agent, model, {
          promptVariant: promptVariant,
          modelFamily: modelFamily,
          promptsDir: promptManager.getPromptsDir(),
        });
        console.log(`\n📊 Results saved to: ${savedPath}`);
        console.log(`📊 Latest results: ${join(resultsDir, 'latest.json')}`);
        
        if (promptVariant) {
          const variantResultsPath = join(promptManager.getPromptsDir(), agent, 'results', `${promptVariant}-results.json`);
          console.log(`📊 Variant results: ${variantResultsPath}`);
        }
        
        console.log(`📊 View dashboard: file://${join(resultsDir, 'index.html')}\n`);
      } catch (error) {
        console.warn(`\n⚠️  Failed to save results: ${(error as Error).message}\n`);
      }
    }
    
    // Print results
    printResults(results);
    
    // Show full conversations if --verbose flag is set
    if (args.verbose) {
      console.log('\n' + '='.repeat(70));
      console.log('VERBOSE MODE: Displaying full conversations');
      console.log('='.repeat(70) + '\n');
      
      for (const result of results) {
        console.log(`\nTest: ${result.testCase.id}`);
        console.log(`Session ID: ${result.sessionId || 'N/A'}`);
        
        if (result.sessionId) {
          console.log(`📥 Fetching full transcript from session storage...\n`);
          await displayConversation(result.sessionId);
        } else {
          console.log('⚠️  No session ID available for this test\n');
        }
      }
    }
    
    // Exit with appropriate code
    const allPassed = results.every(r => r.passed);
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Fatal error:', (error as Error).message);
    console.error((error as Error).stack);
    
    // Restore default prompt if we switched
    if (switchedPrompt && agentToTest) {
      console.log(`\n📝 Restoring default prompt for ${agentToTest}...`);
      promptManager.restoreDefault(agentToTest);
    }
    
    try {
      await runner.stop();
    } catch {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Run main
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
