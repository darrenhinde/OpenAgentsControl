import type { Ability, LoadedAbility, ExecutorContext, AbilityExecution, Step } from './types/index.js'
import { loadAbilities, listAbilities } from './loader/index.js'
import { validateAbility, validateInputs } from './validator/index.js'
import { executeAbility, formatExecutionResult } from './executor/index.js'
import { ExecutionManager } from './executor/execution-manager.js'

interface OpencodeClient {
  session: {
    get: (options: { path: { id: string } }) => Promise<unknown>
    list: () => Promise<Array<{ id: string }>>
    command: (options: { path: { id: string }; body: { command: string; arguments: string; agent?: string; model?: string } }) => Promise<unknown>
    prompt: (options: unknown) => Promise<unknown>
    todo: (options: unknown) => Promise<unknown>
  }
  events: {
    publish: (options: { body: { type: string; properties: Record<string, unknown> } }) => Promise<void>
  }
}

interface PluginContext {
  directory: string
  worktree: string
  client: OpencodeClient
  $: (strings: TemplateStringsArray, ...values: unknown[]) => { text: () => Promise<string> }
}

interface PluginConfig {
  abilities?: {
    enabled?: boolean
    auto_trigger?: boolean
    enforcement?: 'strict' | 'normal' | 'loose'
    directories?: string[]
  }
  disabled_abilities?: string[]
}

interface EventInput {
  event: {
    type: string
    properties?: Record<string, unknown>
  }
}

interface ChatMessageOutput {
  parts: Array<{ type: string; text: string; synthetic?: boolean }>
}

interface ToolExecuteInput {
  tool: string
  sessionID?: string
  callID?: string
}

interface ToolExecuteOutput {
  args: Record<string, unknown>
}

interface SessionIdleOutput {
  inject?: string
}

// Tools allowed during different step types
const ALLOWED_TOOLS_BY_STEP_TYPE: Record<string, string[]> = {
  // Script steps block ALL tools (script runs deterministically)
  script: [],
  // Agent steps allow agent-invocation tools
  agent: ['task', 'background_task', 'call_omo_agent'],
  // Skill steps allow skill-loading tools  
  skill: ['skill', 'slashcommand'],
  // Approval steps only allow approval-related actions
  approval: ['ability.status', 'ability.cancel'],
  // Workflow steps allow nested ability execution
  workflow: ['ability.run', 'ability.status'],
}

// Tools always allowed regardless of step (read-only/status tools)
const ALWAYS_ALLOWED_TOOLS = [
  'ability.list',
  'ability.status',
  'ability.cancel',
  'todoread',
  'read',
  'glob',
  'grep',
  'lsp_hover',
  'lsp_diagnostics',
  'lsp_document_symbols',
]

class AbilitiesPlugin {
  private abilities: Map<string, LoadedAbility> = new Map()
  private executionManager: ExecutionManager
  private config: PluginConfig = {}
  private ctx: PluginContext | null = null
  private mainSessionID: string | undefined
  private initialized = false
  private currentAgentId: string | undefined
  private agentAbilityBindings: Map<string, string[]> = new Map()

  constructor() {
    this.executionManager = new ExecutionManager()
  }

  async initialize(ctx: PluginContext, config: PluginConfig = {}): Promise<void> {
    // Clear stale state so re-initialization doesn't accumulate abilities from prior runs
    this.abilities.clear()
    this.ctx = ctx
    this.config = config

    const directories = config.abilities?.directories || [
      `${ctx.directory}/.opencode/abilities`,
    ]

    for (const dir of directories) {
      const loaded = await loadAbilities({ projectDir: dir, includeGlobal: true })
      for (const [name, ability] of loaded) {
        if (!config.disabled_abilities?.includes(name)) {
          this.abilities.set(name, ability)
        }
      }
    }

    this.initialized = true
    console.log(`[abilities] Loaded ${this.abilities.size} abilities`)
  }

  private matchesTrigger(text: string, ability: Ability): boolean {
    if (!ability.triggers) return false
    if (this.config.abilities?.auto_trigger === false) return false

    const lowerText = text.toLowerCase()

    if (ability.triggers.keywords) {
      for (const keyword of ability.triggers.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return true
        }
      }
    }

    if (ability.triggers.patterns) {
      for (const pattern of ability.triggers.patterns) {
        try {
          if (new RegExp(pattern, 'i').test(text)) {
            return true
          }
        } catch {
          continue
        }
      }
    }

    return false
  }

  private detectAbility(text: string): Ability | null {
    for (const [, loaded] of this.abilities) {
      if (this.matchesTrigger(text, loaded.ability)) {
        return loaded.ability
      }
    }
    return null
  }

  private formatPlan(ability: Ability, inputs: Record<string, unknown>): string {
    const lines: string[] = []

    lines.push(`## Ability: ${ability.name}`)
    lines.push(ability.description)
    lines.push('')

    if (Object.keys(inputs).length > 0) {
      lines.push('### Inputs')
      for (const [key, value] of Object.entries(inputs)) {
        lines.push(`- ${key}: ${JSON.stringify(value)}`)
      }
      lines.push('')
    }

    lines.push('### Steps')
    for (let i = 0; i < ability.steps.length; i++) {
      const step = ability.steps[i]
      const deps = step.needs?.length ? ` (after: ${step.needs.join(', ')})` : ''
      lines.push(`${i + 1}. **${step.id}** [${step.type}]${deps}`)
      if (step.description) {
        lines.push(`   ${step.description}`)
      }
    }

    return lines.join('\n')
  }

  private formatAbilityList(): string {
    if (this.abilities.size === 0) {
      return 'No abilities loaded.'
    }

    const list = listAbilities(this.abilities)
    const lines: string[] = ['Available abilities:', '']

    for (const item of list) {
      lines.push(`- **${item.name}** (${item.source})`)
      lines.push(`  ${item.description}`)
    }

    return lines.join('\n')
  }

  private async showToast(title: string, message: string, variant: 'success' | 'error' | 'info' = 'info'): Promise<void> {
    if (!this.ctx?.client?.events?.publish) return

    try {
      await this.ctx.client.events.publish({
        body: {
          type: 'tui.toast.show',
          properties: {
            title,
            message,
            variant,
            duration: 5000
          }
        }
      })
    } catch {
      console.log(`[abilities] Toast: ${title} - ${message}`)
    }
  }

  private createExecutorContext(): ExecutorContext {
    const ctx = this.ctx
    const self = this

    return {
      cwd: ctx?.directory || process.cwd(),
      env: {},

      agents: ctx?.client ? {
        async call(options: { agent: string; prompt: string }): Promise<string> {
          console.log(`[abilities] Agent step: ${options.agent}`)
          console.log(`[abilities] Prompt: ${options.prompt.slice(0, 200)}...`)

          return `[Agent "${options.agent}" invocation pending - use Task tool with subagent_type="${options.agent}" and the provided prompt]`
        },
        async background(options: { agent: string; prompt: string }): Promise<string> {
          return this.call(options)
        }
      } : undefined,

      skills: ctx?.client ? {
        async load(name: string): Promise<string> {
          console.log(`[abilities] Skill step: ${name}`)
          return `[Skill "${name}" loaded - follow skill instructions]`
        }
      } : undefined,

      approval: ctx?.client ? {
        async request(options: { prompt: string; options?: string[] }): Promise<boolean> {
          console.log(`[abilities] Approval required: ${options.prompt}`)
          await self.showToast('Approval Required', options.prompt, 'info')
          return true
        }
      } : undefined,

      abilities: {
        get: (name: string) => {
          const loaded = self.abilities.get(name)
          return loaded?.ability
        },
        execute: async (ability, inputs) => {
          console.log(`[abilities] Nested workflow: ${ability.name}`)
          return executeAbility(ability, inputs, self.createExecutorContext())
        }
      },

      onStepStart: (step) => {
        console.log(`[abilities] Step started: ${step.id} (${step.type})`)
      },
      onStepComplete: (step, result) => {
        console.log(`[abilities] Step completed: ${step.id} - ${result.status}`)
      },
      onStepFail: (step, error) => {
        console.log(`[abilities] Step failed: ${step.id} - ${error.message}`)
      }
    }
  }

  async handleEvent(input: EventInput): Promise<void> {
    const { event } = input
    const props = event.properties

    if (event.type === 'session.created') {
      const sessionInfo = props?.info as { id?: string; parentID?: string } | undefined
      if (!sessionInfo?.parentID) {
        this.mainSessionID = sessionInfo?.id
      }
    }

    if (event.type === 'session.deleted') {
      const sessionInfo = props?.info as { id?: string } | undefined
      if (sessionInfo?.id) {
        this.executionManager.onSessionDeleted(sessionInfo.id)

        if (sessionInfo.id === this.mainSessionID) {
          this.mainSessionID = undefined
        }
      }
    }

    if (event.type === 'agent.changed') {
      const agentInfo = props?.agent as { id?: string; abilities?: string[] } | undefined
      if (agentInfo?.id) {
        this.setCurrentAgent(agentInfo.id)
        if (agentInfo.abilities && agentInfo.abilities.length > 0) {
          this.registerAgentAbilities(agentInfo.id, agentInfo.abilities)
        }
      }
    }
  }

  async handleSessionIdle(): Promise<SessionIdleOutput> {
    const execution = this.executionManager.getActive()
    
    if (!execution || execution.status !== 'running') {
      return {}
    }

    const currentStep = execution.currentStep
    const enforcement = this.config.abilities?.enforcement || 'strict'

    const lines: string[] = [
      `## Ability In Progress: ${execution.ability.name}`,
      '',
      `Progress: ${execution.completedSteps.length}/${execution.ability.steps.length} steps`,
    ]

    if (currentStep) {
      lines.push(`Current step: **${currentStep.id}** [${currentStep.type}]`)
      lines.push('')
      lines.push(this.getStepInstructions(currentStep))
    }

    if (enforcement === 'strict') {
      lines.push('')
      lines.push('**[STRICT]** You cannot exit or work on other tasks until this ability completes.')
      lines.push('Use `ability.cancel` if you need to abort.')
    } else {
      lines.push('')
      lines.push('Continue with the current step or use `ability.cancel` to abort.')
    }

    console.log(`[abilities] Session idle - injecting continuation for: ${execution.ability.name}`)

    return {
      inject: lines.join('\n')
    }
  }

  async handleChatMessage(
    _input: Record<string, unknown>,
    output: ChatMessageOutput
  ): Promise<void> {
    const activeExecution = this.executionManager.getActive()
    
    if (activeExecution && activeExecution.status === 'running') {
      const contextText = this.buildAbilityContextInjection(activeExecution)
      output.parts.unshift({
        type: 'text',
        synthetic: true,
        text: contextText,
      })
      return
    }

    const userText = output.parts
      .filter((p) => p.type === 'text' && !p.synthetic)
      .map((p) => p.text)
      .join(' ')

    const detected = this.detectAbility(userText)
    if (detected) {
      output.parts.unshift({
        type: 'text',
        synthetic: true,
        text: `## Ability Detected: ${detected.name}\n\n${detected.description}\n\nUse \`ability.run\` tool with name="${detected.name}" to execute.`,
      })
    }
  }

  private buildAbilityContextInjection(execution: AbilityExecution): string {
    const ability = execution.ability
    const currentStep = execution.currentStep
    const completed = execution.completedSteps.length
    const total = ability.steps.length
    const progress = `${completed}/${total}`

    const lines: string[] = [
      `## Active Ability: ${ability.name}`,
      '',
      `**Progress:** ${progress} steps completed`,
      '',
    ]

    if (currentStep) {
      lines.push(`### Current Step: ${currentStep.id} [${currentStep.type}]`)
      if (currentStep.description) {
        lines.push(currentStep.description)
      }
      lines.push('')
      lines.push(this.getStepInstructions(currentStep))
    }

    const enforcement = this.config.abilities?.enforcement || 'strict'
    if (enforcement === 'strict') {
      lines.push('')
      lines.push('**[STRICT MODE]** You MUST complete this step before proceeding. Other tools are blocked.')
    }

    return lines.join('\n')
  }

  private getStepInstructions(step: Step): string {
    switch (step.type) {
      case 'script':
        return `**Action:** Script is executing. Wait for completion.`
      case 'agent': {
        // The switch on step.type narrows to AgentStep — no cast needed
        const agentName = step.agent ?? 'unknown'
        const prompt = step.prompt ?? ''
        return `**Action:** Invoke agent "${agentName}" with the prompt:\n\`\`\`\n${prompt}\n\`\`\``
      }
      case 'skill': {
        // Narrowed to SkillStep
        const skillName = step.skill ?? 'unknown'
        return `**Action:** Load and follow skill "${skillName}".`
      }
      case 'approval': {
        // Narrowed to ApprovalStep
        const prompt = step.prompt ?? ''
        return `**Action:** Request user approval:\n"${prompt}"`
      }
      case 'workflow': {
        // Narrowed to WorkflowStep
        const workflowName = step.workflow ?? 'unknown'
        return `**Action:** Execute nested ability "${workflowName}".`
      }
      default:
        return '**Action:** Complete the current step.'
    }
  }

  async handleToolExecuteBefore(
    input: ToolExecuteInput,
    _output: ToolExecuteOutput
  ): Promise<void> {
    const execution = this.executionManager.getActive()
    if (!execution) return

    const currentStep = execution.currentStep
    if (!currentStep) return

    const enforcement = this.config.abilities?.enforcement || 'strict'
    if (enforcement === 'loose') return

    const tool = input.tool

    if (ALWAYS_ALLOWED_TOOLS.includes(tool)) {
      return
    }

    const allowedTools = ALLOWED_TOOLS_BY_STEP_TYPE[currentStep.type] || []

    if (enforcement === 'strict') {
      if (!allowedTools.includes(tool)) {
        const stepTypeMsg = this.getStepTypeBlockMessage(currentStep)
        throw new Error(
          `[abilities] Tool '${tool}' blocked during ${currentStep.type} step '${currentStep.id}'. ${stepTypeMsg}`
        )
      }
    } else if (enforcement === 'normal') {
      const destructiveTools = ['write', 'edit', 'bash', 'task']
      if (destructiveTools.includes(tool) && !allowedTools.includes(tool)) {
        throw new Error(
          `[abilities] Destructive tool '${tool}' blocked during ${currentStep.type} step '${currentStep.id}'.`
        )
      }
    }

    console.log(`[abilities] Tool '${tool}' allowed during ${currentStep.type} step '${currentStep.id}'`)
  }

  private getStepTypeBlockMessage(step: Step): string {
    switch (step.type) {
      case 'script':
        return 'Script steps run deterministically - wait for completion.'
      case 'agent':
        return 'Only agent invocation tools (task, background_task) allowed.'
      case 'approval':
        return 'Waiting for user approval - only status/cancel tools allowed.'
      case 'skill':
        return 'Only skill-loading tools allowed.'
      case 'workflow':
        return 'Only ability execution tools allowed.'
      default:
        return 'Wait for step completion.'
    }
  }

  async handleToolExecuteAfter(
    input: ToolExecuteInput,
    output: ToolExecuteOutput
  ): Promise<void> {
    const execution = this.executionManager.getActive()
    if (!execution) return

    if (input.tool === 'ability.run') {
      const result = output.args as { status?: string; ability?: string }
      if (result.status === 'completed') {
        this.showToast(
          'Ability Complete',
          `${result.ability} finished successfully`,
          'success'
        )
      } else if (result.status === 'failed') {
        this.showToast(
          'Ability Failed',
          `${result.ability} encountered an error`,
          'error'
        )
      }
    }
  }

  getTools() {
    return {
      'ability.list': {
        description: 'List all available abilities',
        parameters: {},
        execute: async () => {
          return this.formatAbilityList()
        },
      },

      'ability.validate': {
        description: 'Validate an ability definition',
        parameters: {
          name: { type: 'string', description: 'Ability name to validate' },
        },
        execute: async (params: { name: string }) => {
          const loaded = this.abilities.get(params.name)
          if (!loaded) {
            return `Ability '${params.name}' not found`
          }

          const result = validateAbility(loaded.ability)
          if (result.valid) {
            return `Ability '${params.name}' is valid`
          }

          const errors = result.errors.map((e) => `- ${e.path}: ${e.message}`).join('\n')
          return `Ability '${params.name}' has errors:\n${errors}`
        },
      },

      'ability.run': {
        description: `Execute an ability workflow.

Available abilities:
${Array.from(this.abilities.values())
  .map((l) => `- ${l.ability.name}: ${l.ability.description}`)
  .join('\n')}

Use: ability.run({ name: "ability-name", inputs: { ... } })`,
        parameters: {
          name: { type: 'string', description: 'Ability name to run' },
          inputs: { type: 'object', description: 'Input values for the ability' },
        },
        execute: async (
          params: { name: string; inputs?: Record<string, unknown> }
        ) => {
          const loaded = this.abilities.get(params.name)
          if (!loaded) {
            return { error: `Ability '${params.name}' not found` }
          }

          const ability = loaded.ability

          if (this.currentAgentId && !this.isAbilityAllowedForAgent(params.name, this.currentAgentId)) {
            return { error: `Ability '${params.name}' is not allowed for agent '${this.currentAgentId}'` }
          }

          const inputs = params.inputs || {}

          const inputErrors = validateInputs(ability, inputs)
          if (inputErrors.length > 0) {
            return {
              error: 'Input validation failed',
              details: inputErrors.map((e) => e.message),
            }
          }

          const plan = this.formatPlan(ability, inputs)
          console.log(`[abilities] Executing:\n${plan}`)

          const executorCtx = this.createExecutorContext()

          try {
            const execution = await this.executionManager.execute(
              ability,
              inputs,
              executorCtx
            )

            return {
              status: execution.status,
              ability: ability.name,
              result: formatExecutionResult(execution),
              steps: execution.completedSteps.map((s) => ({
                id: s.stepId,
                status: s.status,
                duration: s.duration,
              })),
            }
          } catch (error) {
            return {
              status: 'error',
              error: error instanceof Error ? error.message : String(error),
            }
          }
        },
      },

      'ability.status': {
        description: 'Get status of active ability execution',
        parameters: {},
        execute: async () => {
          const execution = this.executionManager.getActive()
          if (!execution) {
            return { status: 'none', message: 'No active ability execution' }
          }

          return {
            status: execution.status,
            ability: execution.ability.name,
            currentStep: execution.currentStep?.id,
            progress: `${execution.completedSteps.length}/${execution.ability.steps.length}`,
            result: formatExecutionResult(execution),
          }
        },
      },

      'ability.cancel': {
        description: 'Cancel the active ability execution',
        parameters: {},
        execute: async () => {
          const cancelled = this.executionManager.cancelActive()
          if (cancelled) {
            return { status: 'cancelled', message: 'Ability execution cancelled' }
          }
          return { status: 'none', message: 'No active ability to cancel' }
        },
      },

      'ability.agent': {
        description: 'List abilities available to the current agent',
        parameters: {
          agent: { type: 'string', description: 'Agent ID (optional, defaults to current agent)' },
        },
        execute: async (params: { agent?: string }) => {
          const agentId = params.agent || this.currentAgentId

          if (!agentId) {
            return {
              message: 'No agent specified and no current agent set.',
              hint: 'Provide an agent ID or use this tool after an agent is active.'
            }
          }

          const abilities = this.getAgentAbilities(agentId)

          if (abilities.length === 0) {
            return {
              agent: agentId,
              abilities: [],
              message: `No abilities registered for agent '${agentId}'`
            }
          }

          return {
            agent: agentId,
            abilities: abilities.map(a => ({
              name: a.ability.name,
              description: a.ability.description,
              triggers: a.ability.triggers?.keywords || [],
              exclusive: a.ability.exclusive_agent === agentId,
            })),
          }
        },
      },
    }
  }

  cleanup(): void {
    this.executionManager.cleanup()
    this.abilities.clear()
    this.agentAbilityBindings.clear()
    this.currentAgentId = undefined
    this.initialized = false
  }

  registerAgentAbilities(agentId: string, abilityNames: string[]): void {
    this.agentAbilityBindings.set(agentId, abilityNames)
    console.log(`[abilities] Registered ${abilityNames.length} abilities for agent: ${agentId}`)
  }

  setCurrentAgent(agentId: string | undefined): void {
    this.currentAgentId = agentId
    if (agentId) {
      console.log(`[abilities] Current agent set to: ${agentId}`)
    }
  }

  getAgentAbilities(agentId: string): LoadedAbility[] {
    const boundNames = this.agentAbilityBindings.get(agentId) || []
    const result: LoadedAbility[] = []

    for (const name of boundNames) {
      const loaded = this.abilities.get(name)
      if (loaded) {
        result.push(loaded)
      }
    }

    for (const [, loaded] of this.abilities) {
      const ability = loaded.ability
      if (ability.compatible_agents?.includes(agentId)) {
        if (!result.find(r => r.ability.name === ability.name)) {
          result.push(loaded)
        }
      }
      if (ability.exclusive_agent === agentId) {
        if (!result.find(r => r.ability.name === ability.name)) {
          result.push(loaded)
        }
      }
    }

    return result
  }

  isAbilityAllowedForAgent(abilityName: string, agentId: string): boolean {
    const loaded = this.abilities.get(abilityName)
    if (!loaded) return false

    const ability = loaded.ability

    if (ability.exclusive_agent && ability.exclusive_agent !== agentId) {
      return false
    }

    if (ability.compatible_agents && ability.compatible_agents.length > 0) {
      return ability.compatible_agents.includes(agentId)
    }

    const boundNames = this.agentAbilityBindings.get(agentId)
    if (boundNames) {
      return boundNames.includes(abilityName)
    }

    return true
  }

  getCurrentAgent(): string | undefined {
    return this.currentAgentId
  }
}

const pluginInstance = new AbilitiesPlugin()

export async function createAbilitiesPlugin(ctx: PluginContext, config: PluginConfig = {}) {
  await pluginInstance.initialize(ctx, config)

  return {
    tool: pluginInstance.getTools(),

    event: async (input: EventInput) => {
      await pluginInstance.handleEvent(input)
    },

    'chat.message': async (input: Record<string, unknown>, output: ChatMessageOutput) => {
      await pluginInstance.handleChatMessage(input, output)
    },

    'tool.execute.before': async (input: ToolExecuteInput, output: ToolExecuteOutput) => {
      await pluginInstance.handleToolExecuteBefore(input, output)
    },

    'tool.execute.after': async (input: ToolExecuteInput, output: ToolExecuteOutput) => {
      await pluginInstance.handleToolExecuteAfter(input, output)
    },

    'session.idle': async (): Promise<SessionIdleOutput> => {
      return pluginInstance.handleSessionIdle()
    },
  }
}

export { AbilitiesPlugin }
export default createAbilitiesPlugin
