#!/usr/bin/env bun
/**
 * Comprehensive Registry Dependency Checker
 * 
 * This script validates that:
 * 1. All component dependencies exist in the registry
 * 2. All profile components exist in the registry
 * 3. Critical infrastructure files are included
 * 4. No orphaned references exist
 * 
 * Exit codes:
 *   0 = All checks passed
 *   1 = Missing dependencies found
 *   2 = Critical files missing
 *   3 = Configuration errors
 */

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuration
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REGISTRY_FILE = join(REPO_ROOT, 'built-ai-configs/registry/registry.json');

// Colors
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  cyan: '\x1b[0;36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

// Counters
let TOTAL_CHECKS = 0;
let PASSED_CHECKS = 0;
let FAILED_CHECKS = 0;

// Issues
const MISSING_PROFILE_COMPONENTS: string[] = [];
const ORPHANED_DEPENDENCIES: string[] = [];
const CRITICAL_FILES_MISSING: string[] = [];

// CLI flags
let VERBOSE = false;

// Types
interface Component {
  id: string;
  name: string;
  type: string;
  path: string;
  dependencies?: string[];
}

interface Registry {
  version: string;
  schema_version: string;
  repository: string;
  categories: Record<string, string>;
  components: {
    agents?: Component[];
    subagents?: Component[];
    commands?: Component[];
    tools?: Component[];
    plugins?: Component[];
    contexts?: Component[];
    config?: Component[];
    skills?: Component[];
  };
  profiles?: Record<string, {
    name: string;
    description: string;
    components: string[];
  }>;
}

// Critical files that must be in registry
const CRITICAL_FILES = [
  { id: 'root-navigation', path: '.opencode/context/navigation.md', description: 'Root navigation file - ContextScout starts here' },
  { id: 'context-paths-config', path: '.opencode/context/core/config/paths.json', description: 'Context paths configuration - loaded via @ reference' },
  { id: 'context-system', path: '.opencode/context/core/context-system.md', description: 'Context system guide' },
];

// Print functions
function printHeader(): void {
  console.log(`${colors.cyan}${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║        Comprehensive Dependency Checker v1.0.0                 ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
}

function printSuccess(msg: string): void {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function printError(msg: string): void {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function printWarning(msg: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

function printInfo(msg: string): void {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

function printStep(msg: string): void {
  console.log(`\n${colors.bold}${msg}${colors.reset}`);
}

function usage(): void {
  console.log('Usage: bun run scripts/registry/check-dependencies.ts [OPTIONS]');
  console.log('');
  console.log('Options:');
  console.log('  -v, --verbose       Show detailed validation output');
  console.log('  -h, --help          Show this help message');
  console.log('');
  console.log('Exit codes:');
  console.log('  0 = All checks passed');
  console.log('  1 = Missing dependencies found');
  console.log('  2 = Critical files missing');
  process.exit(0);
}

// Load registry
function loadRegistry(): Registry {
  if (!existsSync(REGISTRY_FILE)) {
    printError(`Registry file not found: ${REGISTRY_FILE}`);
    process.exit(3);
  }

  try {
    const content = readFileSync(REGISTRY_FILE, 'utf-8');
    const registry = JSON.parse(content) as Registry;
    printSuccess('Registry loaded successfully');
    return registry;
  } catch (error) {
    printError('Failed to parse built-ai-configs/registry/registry.json');
    process.exit(3);
  }
}

// Load profiles
function loadProfiles(): Record<string, any> {
  const profiles: Record<string, any> = {};
  
  const registry = loadRegistry();
  if (registry.profiles) {
    Object.assign(profiles, registry.profiles);
  }
  
  printSuccess(`Loaded ${Object.keys(profiles).length} profiles`);
  return profiles;
}

// Build component lookup map
function buildComponentMap(registry: Registry): Map<string, Component> {
  const map = new Map<string, Component>();
  
  const categories = ['agents', 'subagents', 'commands', 'tools', 'plugins', 'contexts', 'config', 'skills'];
  
  for (const category of categories) {
    const components = registry.components[category as keyof Registry['components']];
    if (components) {
      for (const component of components) {
        const key = `${category.replace(/s$/, '')}:${component.id}`;
        map.set(key, component);
        map.set(component.id, component);
      }
    }
  }
  
  return map;
}

// Check if component exists
function componentExists(dep: string, componentMap: Map<string, Component>): boolean {
  if (dep.includes('*')) return true; // Skip wildcards
  
  const match = dep.match(/^([^:]+):(.+)$/);
  if (!match) return false;
  
  const [, type, id] = match;
  const fullKey = `${type}:${id}`;
  return componentMap.has(fullKey) || componentMap.has(id);
}

// Check critical files
function checkCriticalFiles(registry: Registry): void {
  printStep('Checking Critical Infrastructure Files...');
  
  const allPaths = new Set<string>();
  const allIds = new Set<string>();
  
  for (const category of Object.keys(registry.components)) {
    const components = registry.components[category as keyof Registry['components']];
    if (components) {
      for (const c of components) {
        allPaths.add(c.path);
        allIds.add(c.id);
      }
    }
  }
  
  for (const critical of CRITICAL_FILES) {
    TOTAL_CHECKS++;
    
    const hasPath = allPaths.has(critical.path);
    const hasId = allIds.has(critical.id);
    
    if (hasPath && hasId) {
      PASSED_CHECKS++;
      printSuccess(`${critical.description}`);
    } else {
      FAILED_CHECKS++;
      CRITICAL_FILES_MISSING.push(critical.id);
      printError(`MISSING CRITICAL FILE: ${critical.description}`);
      printInfo(`  Expected ID: ${critical.id}`);
      printInfo(`  Expected path: ${critical.path}`);
    }
  }
}

// Validate profiles
function validateProfiles(profiles: Record<string, any>, componentMap: Map<string, Component>): void {
  printStep('Validating Profile Components...');
  
  for (const [profileName, profile] of Object.entries(profiles)) {
    if (VERBOSE) {
      printInfo(`Checking profile: ${profileName}`);
    }
    
    const components = profile.components || [];
    
    for (const componentRef of components) {
      TOTAL_CHECKS++;
      
      if (componentRef.includes('*')) {
        PASSED_CHECKS++;
        continue;
      }
      
      if (componentExists(componentRef, componentMap)) {
        PASSED_CHECKS++;
        if (VERBOSE) {
          printSuccess(`  ${componentRef}`);
        }
      } else {
        FAILED_CHECKS++;
        MISSING_PROFILE_COMPONENTS.push(`${profileName}|${componentRef}`);
        printError(`Profile "${profileName}" references missing: ${componentRef}`);
      }
    }
  }
}

// Validate component dependencies
function validateComponentDependencies(registry: Registry, componentMap: Map<string, Component>): void {
  printStep('Validating Component Dependencies...');
  
  const categories = Object.keys(registry.components) as Array<keyof Registry['components']>;
  
  for (const category of categories) {
    const components = registry.components[category];
    if (!components) continue;
    
    for (const component of components) {
      if (!component.dependencies || component.dependencies.length === 0) continue;
      
      for (const dep of component.dependencies) {
        if (!dep) continue;
        
        TOTAL_CHECKS++;
        
        if (componentExists(dep, componentMap)) {
          PASSED_CHECKS++;
          if (VERBOSE) {
            printSuccess(`${component.name} → ${dep}`);
          }
        } else {
          FAILED_CHECKS++;
          ORPHANED_DEPENDENCIES.push(`${category}|${component.id}|${dep}`);
          printError(`${component.name} (${category}) → missing: ${dep}`);
        }
      }
    }
  }
}

// Print summary
function printSummary(): number {
  console.log('');
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Dependency Check Summary${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log('');
  console.log(`Total checks:    ${colors.cyan}${TOTAL_CHECKS}${colors.reset}`);
  console.log(`Passed:          ${colors.green}${PASSED_CHECKS}${colors.reset}`);
  console.log(`Failed:          ${colors.red}${FAILED_CHECKS}${colors.reset}`);
  console.log('');
  
  let exitCode = 0;
  
  if (CRITICAL_FILES_MISSING.length > 0) {
    exitCode = 2;
    printError(`CRITICAL: ${CRITICAL_FILES_MISSING.length} infrastructure file(s) missing!`);
    console.log('');
    console.log('Missing critical files:');
    for (const id of CRITICAL_FILES_MISSING) {
      const critical = CRITICAL_FILES.find(c => c.id === id);
      console.log(`  - ${id}: ${critical?.description}`);
      console.log(`    Path: ${critical?.path}`);
    }
    console.log('');
  }
  
  if (MISSING_PROFILE_COMPONENTS.length > 0) {
    exitCode = exitCode || 1;
    printError(`Found ${MISSING_PROFILE_COMPONENTS.length} missing profile component(s)`);
    console.log('');
    for (const entry of MISSING_PROFILE_COMPONENTS) {
      const [profile, component] = entry.split('|');
      console.log(`  - Profile "${profile}" → ${component}`);
    }
    console.log('');
  }
  
  if (ORPHANED_DEPENDENCIES.length > 0) {
    exitCode = exitCode || 1;
    printError(`Found ${ORPHANED_DEPENDENCIES.length} orphaned dependency(ies)`);
    console.log('');
    for (const entry of ORPHANED_DEPENDENCIES) {
      const [category, id, dep] = entry.split('|');
      console.log(`  - ${id} (${category}) → ${dep}`);
    }
    console.log('');
  }
  
  if (exitCode === 0) {
    printSuccess('All dependency checks passed!');
    console.log('');
    printInfo('No issues found. Registry is consistent.');
  } else {
    console.log(`${colors.yellow}Action required:${colors.reset}`);
    console.log('  1. Add missing components to built-ai-configs/registry/registry.json');
    console.log('  2. Update profile references to use valid component IDs');
    console.log('  3. Ensure all component dependencies exist');
    console.log('');
    console.log(`${colors.yellow}Prevention:${colors.reset}`);
    console.log('  Run this check before committing changes:');
    console.log('    bun run scripts/registry/check-dependencies.ts');
  }
  
  return exitCode;
}

// Main
function main(): void {
  printHeader();
  
  // Parse arguments
  const args = process.argv.slice(2);
  for (const arg of args) {
    switch (arg) {
      case '-v':
      case '--verbose':
        VERBOSE = true;
        break;
      case '-h':
      case '--help':
        usage();
        break;
      default:
        console.log(`Unknown option: ${arg}`);
        usage();
    }
  }
  
  // Load data
  const registry = loadRegistry();
  const profiles = loadProfiles();
  const componentMap = buildComponentMap(registry);
  
  printInfo(`Loaded ${componentMap.size} components`);
  console.log('');
  
  // Run checks
  checkCriticalFiles(registry);
  validateProfiles(profiles, componentMap);
  validateComponentDependencies(registry, componentMap);
  
  // Print summary and exit
  const exitCode = printSummary();
  process.exit(exitCode);
}

main();
