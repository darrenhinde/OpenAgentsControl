#!/usr/bin/env bun
// Usage: bun test-plugin.ts

import { createAbilitiesPlugin } from './src/plugin.js'

async function main() {
  console.log('🧪 Testing Abilities Plugin\n')
  console.log('='.repeat(50))

  const mockClient = {
    session: {
      get: async () => ({}),
      list: async () => [],
      command: async () => ({}),
      prompt: async () => ({}),
      todo: async () => ({})
    },
    events: {
      publish: async (options: unknown) => {
        console.log('[Event Published]', JSON.stringify(options, null, 2))
      }
    }
  }

  const mockContext = {
    directory: process.cwd(),
    worktree: process.cwd(),
    client: mockClient,
    $: () => ({ text: async () => '' })
  }

  console.log('\n📦 Initializing plugin...\n')
  
  const projectRoot = process.cwd().replace('/packages/plugin-abilities', '')
  
  const plugin = await createAbilitiesPlugin(mockContext as any, {
    abilities: {
      directories: [`${projectRoot}/.opencode/abilities`]
    }
  })

  console.log('\n📋 Testing ability.list tool...\n')
  const tools = plugin.tool
  const listResult = await tools['ability.list'].execute({})
  console.log(listResult)

  console.log('\n='.repeat(50))
  console.log('\n✅ Testing ability.validate tool...\n')
  const validateResult = await tools['ability.validate'].execute({ name: 'hello-world' })
  console.log(validateResult)

  console.log('\n='.repeat(50))
  console.log('\n🚀 Testing ability.run tool...\n')
  const runResult = await tools['ability.run'].execute({ 
    name: 'hello-world',
    inputs: { name: 'OpenAgents Control' }
  })
  console.log(JSON.stringify(runResult, null, 2))

  console.log('\n='.repeat(50))
  console.log('\n📊 Testing ability.status tool...\n')
  const statusResult = await tools['ability.status'].execute({})
  console.log(JSON.stringify(statusResult, null, 2))

  console.log('\n='.repeat(50))
  console.log('\n🔍 Testing trigger detection (chat.message hook)...\n')
  
  const mockOutput = {
    parts: [
      { type: 'text', text: 'hello can you greet me?', synthetic: false }
    ]
  }
  
  await plugin['chat.message']({}, mockOutput)
  
  if (mockOutput.parts.length > 1) {
    console.log('✅ Ability detected! Injected message:')
    console.log(mockOutput.parts[0].text)
  } else {
    console.log('❌ No ability detected')
  }

  console.log('\n='.repeat(50))
  console.log('\n✅ All tests completed!')
}

main().catch(console.error)
