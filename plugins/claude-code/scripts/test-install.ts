#!/usr/bin/env bun
/**
 * Test script for context installer
 * Tests against real GitHub repository
 */

import { existsSync } from 'fs'
import { join } from 'path'
import { fetchRegistry, filterContextByProfile } from './utils/registry-fetcher'
import { installContext } from './install-context'

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

function printHeader(msg: string): void {
  console.log(`\n${colors.bold}${colors.cyan}${msg}${colors.reset}\n`)
}

function printSuccess(msg: string): void {
  console.log(`${colors.green}✓${colors.reset} ${msg}`)
}

function printError(msg: string): void {
  console.log(`${colors.red}✗${colors.reset} ${msg}`)
}

function printInfo(msg: string): void {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`)
}

async function runTests(): Promise<void> {
  let passed = 0
  let failed = 0

  printHeader('Testing Context Installer')
  printInfo('Testing against real GitHub repository')
  console.log('')

  // Test 1: Fetch Registry
  printHeader('Test 1: Fetch Registry')
  try {
    const registry = await fetchRegistry({ source: 'github' })
    printSuccess(`Fetched from: https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/built-ai-configs/registry/registry.json`)
    printSuccess(`Registry version: ${registry.version}`)
    printSuccess(`Context components found: ${registry.components.contexts?.length || 0}`)
    passed++
  } catch (error) {
    printError(`Failed to fetch registry: ${error}`)
    failed++
  }
  console.log('')

  // Test 2: Filter by Profile
  printHeader('Test 2: Filter by Profile')
  try {
    const registry = await fetchRegistry({ source: 'github' })
    const essential = filterContextByProfile(registry, 'essential')
    printSuccess(`Essential profile: ${essential.length} components`)
    
    for (const component of essential.slice(0, 5)) {
      console.log(`  - ${component.id}: ${component.path}`)
    }
    
    if (essential.length > 5) {
      console.log(`  ... and ${essential.length - 5} more`)
    }
    
    passed++
  } catch (error) {
    printError(`Failed to filter by profile: ${error}`)
    failed++
  }
  console.log('')

  // Test 3: Dry Run Installation
  printHeader('Test 3: Dry Run Installation')
  try {
    const result = await installContext({
      profile: 'essential',
      dryRun: true,
      verbose: false,
    })
    
    if (result.success) {
      printSuccess('Dry run completed successfully')
      printSuccess(`Would install ${result.manifest.context.length} components`)
      printSuccess(`Profile: ${result.manifest.profile}`)
      passed++
    } else {
      printError('Dry run failed')
      if (result.errors) {
        for (const error of result.errors) {
          printError(`  ${error}`)
        }
      }
      failed++
    }
  } catch (error) {
    printError(`Dry run error: ${error}`)
    failed++
  }
  console.log('')

  // Test 4: Actual Installation (optional - commented out by default)
  // Uncomment to test actual installation
  /*
  printHeader('Test 4: Install Essential Profile')
  try {
    const result = await installContext({
      profile: 'essential',
      dryRun: false,
      force: true,
      verbose: true,
    })
    
    if (result.success) {
      printSuccess('Installation complete')
      printSuccess(`Installed ${result.manifest.context.length} components`)
      printSuccess(`Commit: ${result.manifest.source.commit}`)
      
      // Verify files exist
      let filesExist = 0
      let filesMissing = 0
      
      for (const component of result.manifest.context) {
        if (existsSync(component.local_path)) {
          filesExist++
        } else {
          filesMissing++
          printError(`Missing: ${component.id}`)
        }
      }
      
      printSuccess(`Files verified: ${filesExist}/${result.manifest.context.length}`)
      
      if (filesMissing === 0) {
        passed++
      } else {
        printError(`${filesMissing} files missing`)
        failed++
      }
    } else {
      printError('Installation failed')
      if (result.errors) {
        for (const error of result.errors) {
          printError(`  ${error}`)
        }
      }
      failed++
    }
  } catch (error) {
    printError(`Installation error: ${error}`)
    failed++
  }
  console.log('')
  */

  // Summary
  printHeader('Test Summary')
  console.log(`Total tests: ${passed + failed}`)
  printSuccess(`Passed: ${passed}`)
  
  if (failed > 0) {
    printError(`Failed: ${failed}`)
  }
  
  console.log('')
  
  if (failed === 0) {
    printSuccess('All tests passed! ✓')
  } else {
    printError('Some tests failed')
    process.exit(1)
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
