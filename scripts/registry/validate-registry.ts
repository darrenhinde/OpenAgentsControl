#!/usr/bin/env bun

/**
 * Registry Validator Script (TypeScript/Bun version)
 * Validates that all paths in built-ai-configs/registry/registry.json point to actual files
 * Exit codes:
 *   0 = All paths valid
 *   1 = Missing files found
 *   2 = Registry parse error or missing dependencies
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

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

// Configuration
const REGISTRY_FILE = 'built-ai-configs/registry/registry.json';
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

// Counters
let TOTAL_PATHS = 0;
let VALID_PATHS = 0;
let MISSING_PATHS = 0;
let ORPHANED_FILES = 0;
let MISSING_DEPENDENCIES = 0;

// Arrays to store results
const MISSING_FILES: string[] = [];
const ORPHANED_COMPONENTS: string[] = [];
const MISSING_DEPS: string[] = [];

// CLI flags
let VERBOSE = false;
let FIX_MODE = false;

// Types
interface Component {
  id: string;
  name: string;
  type: string;
  path: string;
  dependencies?: string[];
  [key: string]: any;
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
}

// Utility Functions
function printHeader(): void {
  console.log(`${colors.cyan}${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║           Registry Validator v2.0.0 (TypeScript)              ║');
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

function usage(): void {
  console.log('Usage: bun run scripts/registry/validate-registry.ts [OPTIONS]');
  console.log('');
  console.log('Options:');
  console.log('  -v, --verbose       Show detailed validation output');
  console.log('  -f, --fix           Suggest fixes for missing files');
  console.log('  -h, --help          Show this help message');
  console.log('');
  console.log('Exit codes:');
  console.log('  0 = All paths valid');
  console.log('  1 = Missing files found');
  console.log('  2 = Registry parse error or missing dependencies');
  process.exit(0);
}

// Registry Validation
function validateRegistryFile(): Registry {
  const registryPath = join(REPO_ROOT, REGISTRY_FILE);
  
  if (!existsSync(registryPath)) {
    printError(`Registry file not found: ${REGISTRY_FILE}`);
    process.exit(2);
  }
  
  try {
    const content = readFileSync(registryPath, 'utf-8');
    const registry = JSON.parse(content) as Registry;
    printSuccess('Registry file is valid JSON');
    return registry;
  } catch (error) {
    printError('Registry file is not valid JSON');
    console.error(error);
    process.exit(2);
  }
}

function validateComponentPaths(
  category: keyof Registry['components'],
  categoryDisplay: string,
  registry: Registry
): void {
  console.error(`Checking ${categoryDisplay}...`);
  
  const components = registry.components[category];
  
  if (!components || components.length === 0) {
    console.error(`No ${categoryDisplay} found`);
    return;
  }
  
  for (const component of components) {
    const { id, path, name } = component;
    
    TOTAL_PATHS++;
    
    const fullPath = join(REPO_ROOT, path);
    
    if (existsSync(fullPath)) {
      VALID_PATHS++;
      if (VERBOSE) {
        printSuccess(`${categoryDisplay}: ${name} (${id})`);
      }
    } else {
      MISSING_PATHS++;
      MISSING_FILES.push(`${category}:${id}|${name}|${path}`);
      printError(`${categoryDisplay}: ${name} (${id}) - File not found: ${path}`);
      
      if (FIX_MODE) {
        suggestFix(path, id);
      }
    }
  }
}

function suggestFix(missingPath: string, componentId: string): void {
  const dir = dirname(missingPath);
  const baseDir = dir.split('/').slice(0, 3).join('/');
  const searchPath = join(REPO_ROOT, baseDir);
  
  try {
    // Search for markdown files matching the component ID
    const pattern = join(searchPath, '**', '*.md');
    const files = globSync(pattern, { nodir: true });
    
    const matches = files.filter(file => 
      file.toLowerCase().includes(componentId.toLowerCase())
    );
    
    if (matches.length > 0) {
      console.log(`  ${colors.yellow}→ Possible matches:${colors.reset}`);
      matches.forEach(file => {
        const relPath = file.replace(REPO_ROOT + '/', '');
        console.log(`    ${colors.cyan}${relPath}${colors.reset}`);
      });
    } else {
      console.log(`  ${colors.yellow}→ No similar files found in ${baseDir}${colors.reset}`);
    }
  } catch (error) {
    console.log(`  ${colors.yellow}→ Search in: ${baseDir}${colors.reset}`);
    console.log(`  ${colors.yellow}→ Looking for files matching: ${componentId}${colors.reset}`);
  }
}

function checkDependencyExists(dep: string, registry: Registry): string {
  // Parse dependency format: type:id
  const match = dep.match(/^([^:]+):(.+)$/);
  
  if (!match) {
    return 'invalid_format';
  }
  
  const [, depType, depId] = match;
  
  // Map dependency type to registry category
  const categoryMap: Record<string, keyof Registry['components']> = {
    agent: 'agents',
    subagent: 'subagents',
    command: 'commands',
    tool: 'tools',
    plugin: 'plugins',
    context: 'contexts',
    config: 'config',
    skill: 'skills',
  };
  
  const registryCategory = categoryMap[depType];
  
  if (!registryCategory) {
    return 'unknown_type';
  }
  
  const components = registry.components[registryCategory];
  
  if (!components) {
    return 'not_found';
  }
  
  // Check if component exists in registry - exact ID match
  const exists = components.find((c) => c.id === depId);
  
  if (exists) {
    return 'found';
  }
  
  // For context dependencies, also try path-based lookup
  if (depType === 'context') {
    // Check for wildcard pattern (e.g., context:core/context-system/*)
    if (depId.includes('*')) {
      const prefix = depId.split('*')[0];
      const matches = components.find((c) =>
        c.path.startsWith(`.opencode/context/${prefix}`)
      );
      
      if (matches) {
        return 'found';
      }
    } else {
      // Try exact path match
      const contextPath = `.opencode/context/${depId}.md`;
      const existsByPath = components.find((c) => c.path === contextPath);
      
      if (existsByPath) {
        return 'found';
      }
    }
  }
  
  return 'not_found';
}

function validateComponentDependencies(registry: Registry): void {
  console.log('');
  printInfo('Validating component dependencies...');
  console.log('');
  
  const componentTypes = Object.keys(registry.components) as Array<
    keyof Registry['components']
  >;
  
  for (const compType of componentTypes) {
    const components = registry.components[compType];
    
    if (!components || components.length === 0) {
      continue;
    }
    
    for (const component of components) {
      const { id, name, dependencies } = component;
      
      if (!dependencies || dependencies.length === 0) {
        continue;
      }
      
      for (const dep of dependencies) {
        if (!dep) {
          continue;
        }
        
        const result = checkDependencyExists(dep, registry);
        
        switch (result) {
          case 'found':
            if (VERBOSE) {
              printSuccess(`Dependency OK: ${name} → ${dep}`);
            }
            break;
          case 'not_found':
            MISSING_DEPENDENCIES++;
            MISSING_DEPS.push(`${compType}|${id}|${name}|${dep}`);
            printError(
              `Missing dependency: ${name} (${compType.replace(/s$/, '')}) depends on "${dep}" (not found in registry)`
            );
            break;
          case 'invalid_format':
            MISSING_DEPENDENCIES++;
            MISSING_DEPS.push(`${compType}|${id}|${name}|${dep}`);
            printError(
              `Invalid dependency format: ${name} (${compType.replace(/s$/, '')}) has invalid dependency "${dep}" (expected format: type:id)`
            );
            break;
          case 'unknown_type':
            MISSING_DEPENDENCIES++;
            MISSING_DEPS.push(`${compType}|${id}|${name}|${dep}`);
            printError(
              `Unknown dependency type: ${name} (${compType.replace(/s$/, '')}) has unknown dependency type in "${dep}"`
            );
            break;
        }
      }
    }
  }
}

function scanDirectory(dir: string, registryPaths: Set<string>): void {
  if (!existsSync(dir)) {
    return;
  }

  const entries = readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = fullPath.replace(REPO_ROOT + '/', '');
    
    if (entry.isDirectory()) {
      // Skip node_modules
      if (entry.name === 'node_modules') continue;
      // Skip plugin internal directories
      if (relPath.includes('/plugin/docs/') || relPath.includes('/plugin/tests/')) continue;
      // Skip scripts directories
      if (relPath.includes('/scripts/')) continue;
      
      scanDirectory(fullPath, registryPaths);
    } else if (entry.isFile()) {
      // Only check .md and .ts files
      if (!entry.name.endsWith('.md') && !entry.name.endsWith('.ts')) continue;
      
      // Skip exclusions
      if (entry.name === 'README.md') continue;
      if (entry.name.endsWith('-template.md')) continue;
      if (relPath.endsWith('/tool/index.ts')) continue;
      if (relPath.endsWith('/tool/template/index.ts')) continue;
      if (relPath.endsWith('/plugin/agent-validator.ts')) continue;
      
      // Skip skill support files (only SKILL.md needs to be in registry, all other files are copied with the skill)
      if (relPath.includes('/skills/') && !entry.name.match(/^SKILL\.md$/i)) continue;
      
      // Check if in registry
      if (!registryPaths.has(relPath)) {
        ORPHANED_FILES++;
        ORPHANED_COMPONENTS.push(relPath);
        if (VERBOSE) {
          printWarning(`Orphaned file (not in registry): ${relPath}`);
        }
      }
    }
  }
}

function scanForOrphanedFiles(registry: Registry): void {
  if (!VERBOSE) return;
  
  console.log('');
  console.log(`${colors.bold}Scanning for orphaned files...${colors.reset}`);
  
  // Get all paths from registry
  const registryPaths = new Set<string>();
  for (const category of Object.keys(registry.components)) {
    const components = registry.components[category as keyof Registry['components']];
    if (components) {
      components.forEach(c => registryPaths.add(c.path));
    }
  }
  
  const categories = ['agent', 'command', 'tool', 'plugin', 'context', 'skill'];
  
  for (const category of categories) {
    const categoryDir = join(REPO_ROOT, '.opencode', category);
    scanDirectory(categoryDir, registryPaths);
  }
}

function printSummary(): boolean {
  console.log('');
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Validation Summary${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log('');
  console.log(`Total paths checked:    ${colors.cyan}${TOTAL_PATHS}${colors.reset}`);
  console.log(`Valid paths:            ${colors.green}${VALID_PATHS}${colors.reset}`);
  console.log(`Missing paths:          ${colors.red}${MISSING_PATHS}${colors.reset}`);
  console.log(`Missing dependencies:   ${colors.red}${MISSING_DEPENDENCIES}${colors.reset}`);
  
  if (VERBOSE) {
    console.log(`Orphaned files:         ${colors.yellow}${ORPHANED_FILES}${colors.reset}`);
  }
  
  console.log('');
  
  let hasErrors = false;
  
  // Check for missing paths
  if (MISSING_PATHS > 0) {
    hasErrors = true;
    printError(`Found ${MISSING_PATHS} missing file(s)`);
    console.log('');
    console.log('Missing files:');
    for (const entry of MISSING_FILES) {
      const [catId, name, path] = entry.split('|');
      console.log(`  - ${path} (${catId})`);
    }
    console.log('');
    
    if (!FIX_MODE) {
      printInfo('Run with --fix flag to see suggested fixes');
      console.log('');
    }
  }
  
  // Check for missing dependencies
  if (MISSING_DEPENDENCIES > 0) {
    hasErrors = true;
    printError(`Found ${MISSING_DEPENDENCIES} missing or invalid dependencies`);
    console.log('');
    console.log('Missing dependencies:');
    for (const entry of MISSING_DEPS) {
      const [compType, id, name, dep] = entry.split('|');
      console.log(`  - ${name} (${compType.replace(/s$/, '')}) → ${dep}`);
    }
    console.log('');
    printInfo('Fix by either:');
    console.log('  1. Adding the missing component to the registry');
    console.log('  2. Removing the dependency from the component\'s frontmatter');
    console.log('');
  }
  
  // Success case
  if (!hasErrors) {
    printSuccess('All registry paths are valid!');
    printSuccess('All component dependencies are valid!');
    
    if (ORPHANED_FILES > 0 && VERBOSE) {
      console.log('');
      printWarning(`Found ${ORPHANED_FILES} orphaned file(s) not in registry`);
      console.log('');
      console.log('Orphaned files:');
      for (const file of ORPHANED_COMPONENTS) {
        console.log(`  - ${file}`);
      }
      console.log('');
      console.log('Consider adding these to built-ai-configs/registry/registry.json or removing them.');
    }
    
    return true;
  } else {
    console.log('Please fix these issues before proceeding.');
    return false;
  }
}

// Main
function main(): void {
  // Parse arguments
  const args = process.argv.slice(2);
  
  for (const arg of args) {
    switch (arg) {
      case '-v':
      case '--verbose':
        VERBOSE = true;
        break;
      case '-f':
      case '--fix':
        FIX_MODE = true;
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
  
  printHeader();
  
  // Validate registry file
  const registry = validateRegistryFile();
  
  console.log('');
  printInfo('Validating component paths...');
  console.log('');
  
  // Validate each category
  validateComponentPaths('agents', 'Agents', registry);
  validateComponentPaths('subagents', 'Subagents', registry);
  validateComponentPaths('commands', 'Commands', registry);
  validateComponentPaths('tools', 'Tools', registry);
  validateComponentPaths('plugins', 'Plugins', registry);
  validateComponentPaths('contexts', 'Contexts', registry);
  validateComponentPaths('config', 'Config', registry);
  validateComponentPaths('skills', 'Skills', registry);
  
  // Validate component dependencies
  validateComponentDependencies(registry);
  
  // Scan for orphaned files if verbose
  if (VERBOSE) {
    scanForOrphanedFiles(registry);
  }
  
  // Print summary and exit with appropriate code
  if (printSummary()) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

main();
