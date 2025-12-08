#!/usr/bin/env node
/**
 * CLI tool to validate test suite JSON files
 * 
 * Usage:
 *   npm run validate:suites
 *   npm run validate:suites -- openagent
 *   npm run validate:suites -- --all
 */

import { SuiteValidator } from './suite-validator.js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

interface ValidationStats {
  totalSuites: number;
  validSuites: number;
  invalidSuites: number;
  totalErrors: number;
  totalWarnings: number;
}

function validateSuite(agent: string, suitePath: string, agentsDir: string): boolean {
  const suiteName = suitePath.split('/').pop()?.replace('.json', '') || 'unknown';
  
  console.log(`${colors.blue}Validating:${colors.reset} ${agent}/${suiteName}`);
  
  const validator = new SuiteValidator(agentsDir);
  const result = validator.validateSuiteFile(agent, suitePath);
  
  if (result.valid) {
    const testCount = result.suite?.tests.length || 0;
    console.log(`  ${colors.green}✅ Valid${colors.reset} (${testCount} tests)`);
    
    if (result.warnings.length > 0) {
      result.warnings.forEach(warn => {
        console.log(`  ${colors.yellow}⚠️  ${warn}${colors.reset}`);
      });
    }
  } else {
    console.log(`  ${colors.red}❌ Invalid${colors.reset} (${result.errors.length} errors, ${result.warnings.length} warnings)`);
    
    result.errors.forEach(err => {
      console.log(`     ${colors.red}Error:${colors.reset} ${err.field}: ${err.message}`);
      if (err.value) {
        console.log(`       Value: ${err.value}`);
      }
    });
    
    if (result.missingTests.length > 0) {
      console.log(`  ${colors.red}Missing test files (${result.missingTests.length}):${colors.reset}`);
      result.missingTests.forEach(path => {
        console.log(`     - ${path}`);
      });
    }
  }
  
  console.log();
  
  return result.valid;
}

function main() {
  const args = process.argv.slice(2);
  const validateAll = args.includes('--all');
  const agent = validateAll ? null : (args[0] || 'openagent');
  
  console.log(`${colors.blue}🔍 Validating Test Suites${colors.reset}\n`);
  
  const projectRoot = join(__dirname, '../../../..');
  const agentsDir = join(projectRoot, 'evals', 'agents');
  
  const stats: ValidationStats = {
    totalSuites: 0,
    validSuites: 0,
    invalidSuites: 0,
    totalErrors: 0,
    totalWarnings: 0
  };
  
  const agentsToValidate = validateAll 
    ? readdirSync(agentsDir).filter(f => {
        const agentPath = join(agentsDir, f);
        return existsSync(join(agentPath, 'config'));
      })
    : [agent!];
  
  for (const agentName of agentsToValidate) {
    const agentConfigDir = join(agentsDir, agentName, 'config');
    
    if (!existsSync(agentConfigDir)) {
      console.log(`${colors.yellow}⚠️  No config directory for agent: ${agentName}${colors.reset}\n`);
      continue;
    }
    
    // Check for suites directory
    const suitesDir = join(agentConfigDir, 'suites');
    const suiteFiles: string[] = [];
    
    if (existsSync(suitesDir)) {
      const files = readdirSync(suitesDir);
      files.filter(f => f.endsWith('.json')).forEach(f => {
        suiteFiles.push(join(suitesDir, f));
      });
    }
    
    // Check for suite files in config directory (legacy location)
    const configFiles = readdirSync(agentConfigDir);
    configFiles
      .filter(f => f.endsWith('.json') && f !== 'suite-schema.json')
      .forEach(f => {
        const filePath = join(agentConfigDir, f);
        if (!suiteFiles.includes(filePath)) {
          suiteFiles.push(filePath);
        }
      });
    
    if (suiteFiles.length === 0) {
      console.log(`${colors.yellow}⚠️  No test suites found for agent: ${agentName}${colors.reset}\n`);
      continue;
    }
    
    // Validate each suite
    for (const suiteFile of suiteFiles) {
      stats.totalSuites++;
      const isValid = validateSuite(agentName, suiteFile, agentsDir);
      
      if (isValid) {
        stats.validSuites++;
      } else {
        stats.invalidSuites++;
      }
    }
  }
  
  // Print summary
  console.log(`${colors.blue}${'='.repeat(55)}${colors.reset}`);
  console.log(`${colors.blue}Summary${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(55)}${colors.reset}`);
  console.log(`Total suites:    ${stats.totalSuites}`);
  console.log(`${colors.green}Valid suites:    ${stats.validSuites}${colors.reset}`);
  
  if (stats.invalidSuites > 0) {
    console.log(`${colors.red}Invalid suites:  ${stats.invalidSuites}${colors.reset}`);
  }
  
  console.log();
  
  if (stats.invalidSuites > 0) {
    console.log(`${colors.red}❌ Validation failed${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ All suites valid${colors.reset}`);
    process.exit(0);
  }
}

main();
