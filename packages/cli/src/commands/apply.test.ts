import { describe, test, expect } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCommand } from './apply.js'

const REPO = fileURLToPath(new URL('../../../../', import.meta.url))

/**
 * Install `installedAs` (a file name under `.opencode/agent/`) holding the bytes of the current
 * `source` agent, run `oac apply claude`, and return what was written for `compiled`.
 */
const applyInstalled = async (source: string, installedAs: string, compiled: string) => {
  const project = await mkdtemp(join(tmpdir(), 'oac-apply-'))
  const prevCwd = process.cwd()
  const prevRoot = process.env['OAC_PACKAGE_ROOT']
  try {
    await mkdir(join(project, '.opencode', 'agent'), { recursive: true })
    await writeFile(join(project, '.opencode', 'agent', installedAs), await readFile(join(REPO, '.opencode', 'agent', source)))
    process.env['OAC_PACKAGE_ROOT'] = REPO
    process.chdir(project)
    await applyCommand('claude', { yolo: false, dryRun: false, verbose: false, all: false })
    return {
      applied: await readFile(join(project, '.claude', 'agents', compiled), 'utf-8'),
      expected: await readFile(join(REPO, 'built-ai-configs', 'claude-code', 'agents', compiled), 'utf-8'),
    }
  } finally {
    process.chdir(prevCwd)
    if (prevRoot === undefined) delete process.env['OAC_PACKAGE_ROOT']
    else process.env['OAC_PACKAGE_ROOT'] = prevRoot
    await rm(project, { recursive: true, force: true })
    process.exitCode = 0
  }
}

describe('oac apply claude', () => {
  test('writes the compiled Claude agent byte for byte, not a conversion of the OpenCode copy', async () => {
    const { applied, expected } = await applyInstalled('context-scout.md', 'context-scout.md', 'context-scout.md')
    expect(applied).toBe(expected)
    expect(applied).toContain('<example>')
  })

  test('an install made before the rename (contextscout.md) still gets the compiled agent, via the recorded alias', async () => {
    const { applied, expected } = await applyInstalled('context-scout.md', 'contextscout.md', 'context-scout.md')
    expect(applied).toBe(expected)
  })

  test('the pre-rename tester.md maps to test-engineer.md', async () => {
    const { applied, expected } = await applyInstalled('test-engineer.md', 'tester.md', 'test-engineer.md')
    expect(applied).toBe(expected)
  })
})
