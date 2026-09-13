import { describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  classifyChangedPaths,
  formatGitHubOutput,
  parseChangedPaths,
} from './detect-pr-changes'

const NO_CHANGES = {
  'has-evals': false,
  'has-docs': false,
  'has-workflows': false,
  'has-packages': false,
  'has-canonical': false,
}

const SCRIPT_PATH = join(import.meta.dir, 'detect-pr-changes.ts')
const WORKFLOW_PATH = join(import.meta.dir, '..', '..', '.github', 'workflows', 'pr-checks.yml')
const PACKAGES_WORKFLOW_PATH = join(import.meta.dir, '..', '..', '.github', 'workflows', 'packages-checks.yml')
const DRIFT_SCRIPT_PATH = join(import.meta.dir, 'check-build-drift.sh')

type CliResult = {
  exitCode: number
  stderr: string
  stdout: string
}

async function runCli(input: string, outputPath?: string): Promise<CliResult> {
  const env = { ...process.env }
  if (outputPath === undefined) delete env.GITHUB_OUTPUT
  else env.GITHUB_OUTPUT = outputPath

  const subprocess = Bun.spawn([process.execPath, 'run', SCRIPT_PATH], {
    env,
    stderr: 'pipe',
    stdin: new Blob([input]),
    stdout: 'pipe',
  })

  const [exitCode, stderr, stdout] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stderr).text(),
    new Response(subprocess.stdout).text(),
  ])

  return { exitCode, stderr, stdout }
}

async function withTempDir<T>(run: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'detect-pr-changes-'))
  try {
    return await run(directory)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

describe('classifyChangedPaths', () => {
  test('detects eval changes', () => {
    expect(classifyChangedPaths(['evals/framework/src/index.ts'])).toEqual({
      ...NO_CHANGES,
      'has-evals': true,
    })
  })

  test('detects docs changes', () => {
    expect(classifyChangedPaths(['docs/maintenance/guide.md'])).toEqual({
      ...NO_CHANGES,
      'has-docs': true,
    })
  })

  test('detects workflow changes', () => {
    expect(classifyChangedPaths(['.github/workflows/pr-checks.yml'])).toEqual({
      ...NO_CHANGES,
      'has-workflows': true,
    })
  })

  test('detects packages changes', () => {
    expect(classifyChangedPaths(['packages/cli/src/index.ts'])).toEqual({
      ...NO_CHANGES,
      'has-packages': true,
      'has-canonical': true,
    })
    expect(classifyChangedPaths(['packages/compatibility-layer/package.json'])).toEqual({
      ...NO_CHANGES,
      'has-packages': true,
      'has-canonical': true,
    })
  })

  test('detects shared workspace dependency changes', () => {
    for (const path of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) {
      expect(classifyChangedPaths([path])).toEqual({
        ...NO_CHANGES,
        'has-evals': true,
        'has-packages': true,
        'has-canonical': true,
      })
    }
  })

  test('detects package automation changes', () => {
    for (const path of [
      '.github/dependabot.yml',
      '.github/workflows/packages-checks.yml',
      'scripts/validation/detect-pr-changes.ts',
      'scripts/validation/detect-pr-changes.test.ts',
    ]) {
      expect(classifyChangedPaths([path])).toEqual({
        ...NO_CHANGES,
        'has-packages': true,
        ...(path.startsWith('.github/workflows/') ? { 'has-workflows': true } : {}),
        ...(path === '.github/workflows/packages-checks.yml' ? { 'has-canonical': true } : {}),
      })
    }
  })

  test('routes canonical source changes to the drift gate', () => {
    for (const path of ['content/agents/core/openagent.md', 'content/profiles/default.yaml']) {
      expect(classifyChangedPaths([path])).toEqual({
        ...NO_CHANGES,
        'has-canonical': true,
      })
    }
  })

  test('routes generated-tree changes to the drift gate', () => {
    // A PR that hand-edits generated output touches no packages/** path at all. If these did
    // not set has-canonical, the gate would skip exactly the change it exists to catch.
    for (const path of [
      '.opencode/agent/core/openagent.md',
      '.oac/build-manifest.json',
      'registry.json',
    ]) {
      expect(classifyChangedPaths([path])).toEqual({
        ...NO_CHANGES,
        'has-canonical': true,
      })
    }
  })

  test('routes drift-gate machinery changes to the drift gate', () => {
    for (const path of ['Makefile', 'scripts/validation/check-build-drift.sh']) {
      expect(classifyChangedPaths([path])).toEqual({
        ...NO_CHANGES,
        'has-canonical': true,
      })
    }
  })

  test('rejects near-prefix paths for canonical routing', () => {
    expect(
      classifyChangedPaths([
        'content-old/agents/x.md',
        'nested/content/agents/x.md',
        'contents/x.md',
        '.opencode/command/add-context.md',
        'registry.json.bak',
        'Makefile.old',
      ]),
    ).toEqual(NO_CHANGES)
  })

  test('detects mixed changes', () => {
    expect(
      classifyChangedPaths([
        'evals/framework/package.json',
        'docs/README.md',
        '.github/workflows/release.yml',
        'packages/cli/package.json',
        'src/index.ts',
      ]),
    ).toEqual({
      'has-evals': true,
      'has-docs': true,
      'has-workflows': true,
      'has-packages': true,
      'has-canonical': true,
    })
  })

  test('returns false for every category when paths do not match', () => {
    expect(classifyChangedPaths(['README.md', 'scripts/check.ts'])).toEqual(NO_CHANGES)
  })

  test('returns false for every category when input is empty', () => {
    expect(classifyChangedPaths([])).toEqual(NO_CHANGES)
  })

  test('rejects near-prefix paths', () => {
    expect(
      classifyChangedPaths([
        'evals-old/test.ts',
        'docs.md',
        '.github/workflows-old/check.yml',
        'nested/evals/test.ts',
        'packages-old/cli/index.ts',
        'packages.json',
        'nested/packages/cli/index.ts',
      ]),
    ).toEqual(NO_CHANGES)
  })
})

describe('parseChangedPaths', () => {
  test('preserves path identity and removes empty NUL records', () => {
    expect(parseChangedPaths('  evals/test.ts  \0\0docs/雪\n$HOME; file.md\0')).toEqual([
      '  evals/test.ts  ',
      'docs/雪\n$HOME; file.md',
    ])
  })
})

describe('formatGitHubOutput', () => {
  test('formats newline-delimited GitHub outputs', () => {
    expect(
      formatGitHubOutput({
        'has-evals': true,
        'has-docs': false,
        'has-workflows': true,
        'has-packages': false,
        'has-canonical': false,
      }),
    ).toBe(
      'has-evals=true\nhas-docs=false\nhas-workflows=true\nhas-packages=false\n' +
        'has-canonical=false\n',
    )
  })
})

describe('CLI', () => {
  test('appends outputs to GITHUB_OUTPUT', async () => {
    await withTempDir(async (directory) => {
      const outputPath = join(directory, 'github-output')
      await writeFile(outputPath, 'existing=value\n')

      const result = await runCli('evals/test.ts\0', outputPath)

      expect(result).toEqual({ exitCode: 0, stderr: '', stdout: '' })
      expect(await readFile(outputPath, 'utf8')).toBe(
        'existing=value\nhas-evals=true\nhas-docs=false\nhas-workflows=false\n' +
          'has-packages=false\nhas-canonical=false\n',
      )
    })
  })

  test('writes false outputs for empty stdin', async () => {
    await withTempDir(async (directory) => {
      const outputPath = join(directory, 'github-output')

      const result = await runCli('', outputPath)

      expect(result.exitCode).toBe(0)
      expect(await readFile(outputPath, 'utf8')).toBe(
        'has-evals=false\nhas-docs=false\nhas-workflows=false\nhas-packages=false\n' +
          'has-canonical=false\n',
      )
    })
  })

  test('fails clearly when GITHUB_OUTPUT is missing', async () => {
    const result = await runCli('evals/test.ts\0')

    expect(result.exitCode).not.toBe(0)
    expect(result.stderr).toContain('GITHUB_OUTPUT is required but was not set')
  })

  test('writes an error to stderr and exits nonzero for an unwritable target', async () => {
    await withTempDir(async (directory) => {
      const outputPath = join(directory, 'output-directory')
      await mkdir(outputPath)

      const result = await runCli('docs/guide.md\0', outputPath)

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('Unable to append change detection outputs to GITHUB_OUTPUT')
    })
  })

  test('handles NUL-delimited Unicode and metacharacter filenames without changing identity', async () => {
    await withTempDir(async (directory) => {
      const outputPath = join(directory, 'github-output')
      const paths = [
        'evals/ leading and trailing .ts ',
        'docs/雪\n$HOME;$(touch never).md',
        '.github/workflows/[check]& weird.yml',
        'packages/cli/src/ spaced 雪.ts',
      ]

      const result = await runCli(`${paths.join('\0')}\0`, outputPath)

      expect(result.exitCode).toBe(0)
      expect(await readFile(outputPath, 'utf8')).toBe(
        'has-evals=true\nhas-docs=true\nhas-workflows=true\nhas-packages=true\n' +
          'has-canonical=true\n',
      )
    })
  })

  test('does not trim leading whitespace into a matching path', async () => {
    await withTempDir(async (directory) => {
      const outputPath = join(directory, 'github-output')

      const result = await runCli(' evals/not-under-evals.ts\0', outputPath)

      expect(result.exitCode).toBe(0)
      expect(await readFile(outputPath, 'utf8')).toContain('has-evals=false\n')
    })
  })
})

describe('PR checks workflow contract', () => {
  test('uses the NUL-delimited detector and exact output names', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8')

    expect(workflow).toContain('git diff --name-only -z')
    expect(workflow).toMatch(/git diff --name-only -z[^\n]*\|[\s\S]*bun run scripts\/validation\/detect-pr-changes\.ts/)
    expect(workflow).toContain('has-evals: ${{ steps.filter.outputs.has-evals }}')
    expect(workflow).toContain('has-docs: ${{ steps.filter.outputs.has-docs }}')
    expect(workflow).toContain('has-workflows: ${{ steps.filter.outputs.has-workflows }}')
    expect(workflow).not.toMatch(/steps\.filter\.outputs\.(evals|docs|workflows)(?:\s|})/)
    expect(workflow).toContain('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6')
    expect(workflow).toContain('bun-version: 1.3.14')
  })

  test('requires successful change detection before reporting overall success', async () => {
    const workflow = await readFile(WORKFLOW_PATH, 'utf8')
    const overallStatus = workflow.slice(workflow.indexOf('# Overall status'))

    expect(overallStatus).toContain('needs.check-changes.result }}" == "success"')
    expect(overallStatus).toContain('needs.check-changes.outputs.has-evals }}" != "true"')
    expect(overallStatus).toContain('exit 1')
  })
})

describe('Packages checks workflow contract', () => {
  test('uses the NUL-delimited detector and the has-packages output', async () => {
    const workflow = await readFile(PACKAGES_WORKFLOW_PATH, 'utf8')

    expect(workflow).toContain('git diff --name-only -z')
    expect(workflow).toMatch(/git diff --name-only -z[^\n]*\|[\s\S]*bun run scripts\/validation\/detect-pr-changes\.ts/)
    expect(workflow).toContain('has-packages: ${{ steps.filter.outputs.has-packages }}')
    expect(workflow).toContain('oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6')
    expect(workflow).toContain('bun-version: 1.3.14')
  })

  test('gates every package check job on the has-packages flag', async () => {
    const workflow = await readFile(PACKAGES_WORKFLOW_PATH, 'utf8')

    expect(workflow).toContain('cli-checks:')
    expect(workflow).toContain('compatibility-layer-checks:')

    const gates = workflow.match(/needs\.check-changes\.outputs\.has-packages == 'true'/g) ?? []
    expect(gates.length).toBeGreaterThanOrEqual(2)
  })

  test('triggers on packages/** pull request changes', async () => {
    const workflow = await readFile(PACKAGES_WORKFLOW_PATH, 'utf8')

    expect(workflow).toContain('pull_request:')
    expect(workflow).toContain("- 'packages/**'")
  })
})

describe('Canonical drift gate contract', () => {
  test('triggers on the canonical source and the generated trees', async () => {
    const workflow = await readFile(PACKAGES_WORKFLOW_PATH, 'utf8')

    for (const path of [
      "- 'content/**'",
      "- '.opencode/agent/**'",
      "- '.oac/**'",
      "- 'registry.json'",
      "- 'Makefile'",
      "- 'scripts/validation/check-build-drift.sh'",
    ]) {
      expect(workflow).toContain(path)
    }
  })

  test('gates the drift job on has-canonical and runs the same make target as contributors', async () => {
    const workflow = await readFile(PACKAGES_WORKFLOW_PATH, 'utf8')

    expect(workflow).toContain('canonical-drift:')
    expect(workflow).toContain('has-canonical: ${{ steps.filter.outputs.has-canonical }}')
    expect(workflow).toContain("needs.check-changes.outputs.has-canonical == 'true'")
    expect(workflow).toContain('run: make check-canonical-drift')
  })

  test('is blocking — never continue-on-error, and the summary fails on it', async () => {
    const workflow = await readFile(PACKAGES_WORKFLOW_PATH, 'utf8')

    // A gate that cannot fail the PR reads as coverage while providing none. Match the YAML
    // key rather than the bare phrase, which also appears in the job's own comment.
    expect(workflow).not.toMatch(/^\s*continue-on-error:\s*true/m)
    expect(workflow).toContain('needs: [check-changes, cli-checks, compatibility-layer-checks, canonical-drift]')
    expect(workflow).toContain('"${{ needs.canonical-drift.result }}"')

    const summary = workflow.slice(workflow.indexOf('  summary:'))
    expect(summary).toContain('exit 1')
  })

  test('the drift script rebuilds and compares the committed generated trees', async () => {
    const script = await readFile(DRIFT_SCRIPT_PATH, 'utf8')

    // A write build, not `--check`: check() never compares the manifest, which is committed.
    expect(script).toContain('bun packages/cli/dist/index.js build')
    expect(script).toContain('.oac/build-manifest.json')
    expect(script).toContain('git status --porcelain')
    expect(script).toContain('exit 1')
    // plugins/claude-code/** is staged and compared, never emitted — not this gate's business.
    expect(script).not.toContain('plugins/claude-code/agents)')
  })
})
