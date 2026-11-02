import { describe, test, expect } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCommand } from './apply.js'

const REPO = fileURLToPath(new URL('../../../../', import.meta.url))

describe('oac apply claude', () => {
  test('writes the compiled Claude agent byte for byte, not a conversion of the OpenCode copy', async () => {
    const project = await mkdtemp(join(tmpdir(), 'oac-apply-'))
    const prevCwd = process.cwd()
    const prevRoot = process.env['OAC_PACKAGE_ROOT']
    try {
      await mkdir(join(project, '.opencode', 'agent'), { recursive: true })
      // contextscout is built for Claude as context-scout.md (different name, own host blocks)
      await writeFile(
        join(project, '.opencode', 'agent', 'contextscout.md'),
        await readFile(join(REPO, '.opencode', 'agent', 'contextscout.md'))
      )
      process.env['OAC_PACKAGE_ROOT'] = REPO
      process.chdir(project)
      await applyCommand('claude', { yolo: false, dryRun: false, verbose: false, all: false })

      const applied = await readFile(join(project, '.claude', 'agents', 'context-scout.md'), 'utf-8')
      const compiled = await readFile(join(REPO, 'built-ai-configs', 'claude-code', 'agents', 'context-scout.md'), 'utf-8')
      expect(applied).toBe(compiled)
      expect(applied).toContain('<example>')
    } finally {
      process.chdir(prevCwd)
      if (prevRoot === undefined) delete process.env['OAC_PACKAGE_ROOT']
      else process.env['OAC_PACKAGE_ROOT'] = prevRoot
      await rm(project, { recursive: true, force: true })
      process.exitCode = 0
    }
  })
})
