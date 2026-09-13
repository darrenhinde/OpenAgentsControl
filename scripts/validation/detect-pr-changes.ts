#!/usr/bin/env bun

import { appendFile } from 'node:fs/promises'

export type ChangeFlags = {
  'has-evals': boolean
  'has-docs': boolean
  'has-workflows': boolean
  'has-packages': boolean
  /**
   * Anything that can move the generated trees, and therefore must re-run the drift gate:
   * the canonical source, the build that reads it, and the committed output itself.
   *
   * Separate from `has-packages` on purpose. A content-only edit must run the drift gate but
   * has no reason to run the cli/compatibility-layer test suites, and a PR that hand-edits
   * `.opencode/agent/**` alone touches no `packages/**` path at all — folding this into
   * `has-packages` would either skip the gate on exactly the change it exists to catch, or
   * run every package suite on every prose tweak.
   */
  'has-canonical': boolean
}

export function parseChangedPaths(input: string): string[] {
  return input.split('\0').filter((path) => path.length > 0)
}

export function classifyChangedPaths(paths: readonly string[]): ChangeFlags {
  const hasWorkspaceChange = paths.some((path) =>
    ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'].includes(path),
  )

  return {
    'has-evals': hasWorkspaceChange || paths.some((path) => path.startsWith('evals/')),
    'has-docs': paths.some((path) => path.startsWith('docs/')),
    'has-workflows': paths.some((path) => path.startsWith('.github/workflows/')),
    'has-packages': hasWorkspaceChange || paths.some((path) =>
      path.startsWith('packages/') ||
      path === '.github/dependabot.yml' ||
      path === '.github/workflows/packages-checks.yml' ||
      path === 'scripts/validation/detect-pr-changes.ts' ||
      path === 'scripts/validation/detect-pr-changes.test.ts',
    ),
    'has-canonical': hasWorkspaceChange || paths.some((path) =>
      // The canonical source.
      path.startsWith('content/') ||
      // The build that turns it into output.
      path.startsWith('packages/') ||
      // The committed output — a hand-edit here is precisely what the gate exists to catch.
      path.startsWith('.opencode/agent/') ||
      path.startsWith('.oac/') ||
      path === 'registry.json' ||
      // The gate's own machinery.
      path === 'Makefile' ||
      path === 'scripts/validation/check-build-drift.sh' ||
      path === '.github/workflows/packages-checks.yml',
    ),
  }
}

export function formatGitHubOutput(flags: ChangeFlags): string {
  return [
    `has-evals=${flags['has-evals']}`,
    `has-docs=${flags['has-docs']}`,
    `has-workflows=${flags['has-workflows']}`,
    `has-packages=${flags['has-packages']}`,
    `has-canonical=${flags['has-canonical']}`,
  ].join('\n') + '\n'
}

async function main(): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required but was not set')

  const paths = parseChangedPaths(await Bun.stdin.text())
  const output = formatGitHubOutput(classifyChangedPaths(paths))

  await appendFile(outputPath, output, 'utf8').catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to append change detection outputs to GITHUB_OUTPUT (${outputPath}): ${message}`)
  })
}

if (import.meta.main) {
  await main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`detect-pr-changes: ${message}`)
    process.exitCode = 1
  })
}
