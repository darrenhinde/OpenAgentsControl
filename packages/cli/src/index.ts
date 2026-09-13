#!/usr/bin/env node

import { Command } from 'commander'
import { readCliVersion } from './lib/version.js'

const program = new Command()

program
  .name('oac')
  .description('OpenAgents Control — install, manage, and update AI agents and context files')
  .version(readCliVersion(), '-v, --version', 'Print version and exit')

// Lazy-load command modules in parallel — keeps startup < 100ms
async function main(): Promise<void> {
  // Fast path: --version only — --help needs all commands registered first
  const args = process.argv.slice(2)
  const isFastPath =
    args.includes('--version') || args.includes('-v')

  if (isFastPath) {
    await program.parseAsync(process.argv)
    return
  }

  const [
    { registerInitCommand },
    { registerUpdateCommand },
    { registerAddCommand },
    { registerApplyCommand },
    { registerBuildCommand },
    { registerDoctorCommand },
    { registerListCommand },
    { registerStatusCommand },
  ] = await Promise.all([
    import('./commands/init.js'),
    import('./commands/update.js'),
    import('./commands/add.js'),
    import('./commands/apply.js'),
    import('./commands/build.js'),
    import('./commands/doctor.js'),
    import('./commands/list.js'),
    import('./commands/status.js'),
  ])

  registerInitCommand(program)
  registerUpdateCommand(program)
  registerAddCommand(program) // also registers `remove`
  registerApplyCommand(program)
  registerBuildCommand(program)
  registerDoctorCommand(program)
  registerListCommand(program)
  registerStatusCommand(program)

  // Unknown commands: print a helpful error and exit 1
  program.on('command:*', (operands: string[]) => {
    console.error(`error: unknown command '${operands[0]}'\n`)
    console.error(`Run 'oac --help' to see available commands.`)
    process.exitCode = 1
  })

  await program.parseAsync(process.argv)

  // Print help when no command is given
  if (args.length === 0) {
    program.help()
  }
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
