import { spawn } from 'child_process'
import type {
  Ability,
  Step,
  ScriptStep,
  AgentStep,
  SkillStep,
  ApprovalStep,
  WorkflowStep,
  AbilityExecution,
  StepResult,
  ExecutorContext,
  InputValues,
} from '../types/index.js'
import { validateInputs } from '../validator/index.js'

/**
 * Executor - Handles all step types
 *
 * - script: Execute shell commands
 * - agent: Delegate to agent via context
 * - skill: Load skill via context
 * - approval: Request user approval via context
 * - workflow: Delegate to nested ability (not yet implemented)
 */

function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

const MAX_CONTEXT_LENGTH = 50000

function interpolateVariables(text: string, inputs: InputValues, stepOutputs?: Map<string, string>): string {
  let result = text.replace(/\{\{inputs\.(\w+)\}\}/g, (match, name) => {
    const value = inputs[name]
    return value !== undefined ? String(value) : match
  })

  if (stepOutputs) {
    result = result.replace(/\{\{steps\.(\w[\w-]*)\.output\}\}/g, (match, stepId) => {
      const output = stepOutputs.get(stepId)
      return output !== undefined ? output.trim() : match
    })
  }

  return result
}

/**
 * Wraps a value in single quotes and escapes any existing single quotes so
 * the result is safe to embed directly in a POSIX shell command string.
 * Prevents command injection when user-supplied inputs are interpolated into
 * `sh -c` commands.
 */
function shellEscape(value: string): string {
  // Replace every ' with '"'"' (close quote, escaped quote, reopen quote)
  return "'" + value.replace(/'/g, "'\\''") + "'"
}

/**
 * Like `interpolateVariables` but shell-escapes every substituted value so
 * the resulting string is safe to pass to `sh -c`. Only used for script steps.
 */
function interpolateForShell(text: string, inputs: InputValues, stepOutputs?: Map<string, string>): string {
  let result = text.replace(/\{\{inputs\.(\w+)\}\}/g, (match, name) => {
    const value = inputs[name]
    return value !== undefined ? shellEscape(String(value)) : match
  })

  if (stepOutputs) {
    result = result.replace(/\{\{steps\.(\w[\w-]*)\.output\}\}/g, (match, stepId) => {
      const output = stepOutputs.get(stepId)
      // Step outputs are produced by our own scripts/agents, but escape them
      // anyway to prevent injection when one step's output feeds another.
      return output !== undefined ? shellEscape(output.trim()) : match
    })
  }

  return result
}

function truncateOutput(output: string, maxLength: number = MAX_CONTEXT_LENGTH): string {
  if (output.length <= maxLength) return output
  const half = Math.floor(maxLength / 2)
  const omitted = output.length - maxLength
  return `${output.slice(0, half)}\n\n... [${omitted} characters truncated] ...\n\n${output.slice(-half)}`
}

function summarizeOutput(output: string): string {
  const lines = output.split('\n')
  if (lines.length <= 20) return output
  const head = lines.slice(0, 10).join('\n')
  const tail = lines.slice(-5).join('\n')
  return `## Output Summary\n\n${head}\n\n... [${lines.length - 15} lines omitted] ...\n\n${tail}`
}

async function runScript(
  command: string,
  options: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', command], {
      cwd: options.cwd || process.cwd(),
      // Use Object.create(null) to prevent prototype pollution from a crafted
      // __proto__ key that could appear in step.env or ctx.env.
      env: Object.assign(Object.create(null), process.env, options.env),
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 })
    })

    proc.on('error', (error) => {
      resolve({ stdout, stderr: error.message, exitCode: 1 })
    })
  })
}

async function executeScriptStep(
  step: ScriptStep,
  execution: AbilityExecution,
  ctx: ExecutorContext,
  stepOutputs: Map<string, string>
): Promise<StepResult> {
  const startedAt = Date.now()

  // Use shell-safe interpolation to prevent command injection via user inputs.
  const command = interpolateForShell(step.run, execution.inputs, stepOutputs)

  console.log(`[abilities] Executing: ${command}`)

  try {
    const result = await runScript(command, {
      cwd: step.cwd || ctx.cwd,
      // Object.create(null) prevents prototype pollution from a crafted
      // __proto__ key in ctx.env or step.env.
      env: Object.assign(Object.create(null), ctx.env, step.env),
    })

    // Validate exit code if specified
    let failed = false
    let error: string | undefined

    if (step.validation?.exit_code !== undefined && result.exitCode !== step.validation.exit_code) {
      failed = true
      error = `Exit code ${result.exitCode}, expected ${step.validation.exit_code}`
    }

    return {
      stepId: step.id,
      status: failed ? 'failed' : 'completed',
      output: result.stdout || result.stderr,
      error,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeAgentStep(
  step: AgentStep,
  execution: AbilityExecution,
  ctx: ExecutorContext,
  stepOutputs: Map<string, string>
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.agents) {
    return {
      stepId: step.id,
      status: 'failed',
      error: 'Agent execution not available in this context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    let prompt = interpolateVariables(step.prompt, execution.inputs, stepOutputs)

    // Inject context from prior steps if this step has dependencies
    if (step.needs && step.needs.length > 0) {
      const priorOutputs = execution.completedSteps
        .filter((r) => step.needs!.includes(r.stepId) && r.output)
        .map((r) => {
          let output = r.output!
          // Check if the prior step requested summarization
          const priorStep = execution.ability.steps.find((s) => s.id === r.stepId)
          if (priorStep && priorStep.type === 'agent' && (priorStep as AgentStep).summarize) {
            output = summarizeOutput(output)
          } else {
            output = truncateOutput(output)
          }
          return `### ${r.stepId}\n${output}`
        })

      if (priorOutputs.length > 0) {
        prompt = `${prompt}\n\n## Context from prior steps\n\n${priorOutputs.join('\n\n')}`
      }
    }

    const output = await ctx.agents.call({
      agent: step.agent,
      prompt,
    })

    return {
      stepId: step.id,
      status: 'completed',
      output,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeSkillStep(
  step: SkillStep,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.skills) {
    return {
      stepId: step.id,
      status: 'failed',
      error: 'Skill execution not available in this context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    const output = await ctx.skills.load(step.skill)

    return {
      stepId: step.id,
      status: 'completed',
      output,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeApprovalStep(
  step: ApprovalStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.approval) {
    return {
      stepId: step.id,
      status: 'failed',
      error: 'Approval not available in this context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    const prompt = interpolateVariables(step.prompt, execution.inputs)
    const approved = await ctx.approval.request({ prompt })

    return {
      stepId: step.id,
      status: approved ? 'completed' : 'failed',
      output: approved ? 'Approved' : 'Rejected',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

function evaluateCondition(condition: string, inputs: InputValues, stepOutputs: Map<string, string>): boolean {
  // Simple condition evaluator: "inputs.key == \"value\""
  const match = condition.match(/^inputs\.(\w+)\s*==\s*"([^"]*)"$/)
  if (match) {
    const [, key, expected] = match
    return String(inputs[key]) === expected
  }
  return true // default: condition met
}

function buildExecutionOrder(steps: Step[]): Step[] {
  const result: Step[] = []
  const completed = new Set<string>()
  const remaining = [...steps]

  while (remaining.length > 0) {
    const next = remaining.find((step) => {
      if (!step.needs || step.needs.length === 0) return true
      return step.needs.every((dep) => completed.has(dep))
    })

    if (!next) {
      console.error('[abilities] Unable to resolve step order - circular dependency?')
      break
    }

    result.push(next)
    completed.add(next.id)
    remaining.splice(remaining.indexOf(next), 1)
  }

  return result
}

async function executeWorkflowStep(
  step: WorkflowStep,
  execution: AbilityExecution,
  ctx: ExecutorContext
): Promise<StepResult> {
  const startedAt = Date.now()

  if (!ctx.abilities) {
    return {
      stepId: step.id,
      status: 'failed',
      error: 'Workflow execution not available in this context',
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  const childAbility = ctx.abilities.get(step.workflow)
  if (!childAbility) {
    return {
      stepId: step.id,
      status: 'failed',
      error: `Nested ability '${step.workflow}' not found`,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }

  try {
    // Interpolate inputs if provided
    const workflowInputs: Record<string, unknown> = {}
    if (step.inputs) {
      for (const [key, value] of Object.entries(step.inputs)) {
        workflowInputs[key] = typeof value === 'string'
          ? interpolateVariables(value, execution.inputs)
          : value
      }
    }

    const childExecution = await ctx.abilities.execute(childAbility, workflowInputs)

    return {
      stepId: step.id,
      status: childExecution.status === 'completed' ? 'completed' : 'failed',
      output: childExecution.status === 'completed'
        ? `Nested ability '${step.workflow}' completed successfully`
        : `Nested ability '${step.workflow}' failed: ${childExecution.error}`,
      error: childExecution.status !== 'completed' ? childExecution.error : undefined,
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: Date.now(),
      duration: Date.now() - startedAt,
    }
  }
}

async function executeStep(
  step: Step,
  execution: AbilityExecution,
  ctx: ExecutorContext,
  stepOutputs: Map<string, string>
): Promise<StepResult> {
  switch (step.type) {
    case 'script':
      return executeScriptStep(step, execution, ctx, stepOutputs)
    case 'agent':
      return executeAgentStep(step, execution, ctx, stepOutputs)
    case 'skill':
      return executeSkillStep(step, ctx)
    case 'approval':
      return executeApprovalStep(step, execution, ctx)
    case 'workflow':
      return executeWorkflowStep(step, execution, ctx)
    default:
      return {
        stepId: step.id,
        status: 'failed',
        error: `Unknown step type: ${(step as { type: string }).type}`,
        startedAt: Date.now(),
        completedAt: Date.now(),
        duration: 0,
      }
  }
}

export async function executeAbility(
  ability: Ability,
  inputs: InputValues,
  ctx: ExecutorContext,
  signal?: AbortSignal
): Promise<AbilityExecution> {
  // Validate inputs
  const inputErrors = validateInputs(ability, inputs)
  if (inputErrors.length > 0) {
    return {
      id: generateExecutionId(),
      ability,
      inputs,
      status: 'failed',
      currentStep: null,
      currentStepIndex: -1,
      completedSteps: [],
      pendingSteps: ability.steps,
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: `Input validation failed: ${inputErrors.map((e) => e.message).join(', ')}`,
    }
  }

  // Apply defaults
  const resolvedInputs: InputValues = { ...inputs }
  if (ability.inputs) {
    for (const [name, def] of Object.entries(ability.inputs)) {
      if (resolvedInputs[name] === undefined && def.default !== undefined) {
        resolvedInputs[name] = def.default
      }
    }
  }

  // Build execution order based on dependencies
  const orderedSteps = buildExecutionOrder(ability.steps)

  // Check for cancellation before starting execution
  if (signal?.aborted) {
    return {
      id: generateExecutionId(),
      ability,
      inputs: resolvedInputs,
      status: 'failed',
      currentStep: null,
      currentStepIndex: -1,
      completedSteps: [],
      pendingSteps: orderedSteps,
      startedAt: Date.now(),
      completedAt: Date.now(),
      error: 'Cancelled',
    }
  }

  const stepOutputs = new Map<string, string>()

  const execution: AbilityExecution = {
    id: generateExecutionId(),
    ability,
    inputs: resolvedInputs,
    status: 'running',
    currentStep: null,
    currentStepIndex: -1,
    completedSteps: [],
    pendingSteps: [...orderedSteps],
    startedAt: Date.now(),
  }

  // Execute steps sequentially
  for (let i = 0; i < orderedSteps.length; i++) {
    const step = orderedSteps[i]
    execution.currentStep = step
    execution.currentStepIndex = i

    // Check for cancellation before starting each step
    if (signal?.aborted) {
      execution.status = 'failed'
      execution.error = 'Cancelled'
      execution.completedAt = Date.now()
      return execution
    }

    // Evaluate condition if present
    if (step.when) {
      const conditionMet = evaluateCondition(step.when, resolvedInputs, stepOutputs)
      if (!conditionMet) {
        const skipped: StepResult = {
          stepId: step.id,
          status: 'skipped',
          output: `Condition not met: ${step.when}`,
          startedAt: Date.now(),
          completedAt: Date.now(),
          duration: 0,
        }
        execution.completedSteps.push(skipped)
        execution.pendingSteps = execution.pendingSteps.filter((s) => s.id !== step.id)
        continue
      }
    }

    console.log(`[abilities] Step ${i + 1}/${orderedSteps.length}: ${step.id}`)

    ctx.onStepStart?.(step)

    const result = await executeStep(step, execution, ctx, stepOutputs)
    execution.completedSteps.push(result)
    execution.pendingSteps = execution.pendingSteps.filter((s) => s.id !== step.id)

    if (result.output) {
      stepOutputs.set(step.id, result.output)
    }

    if (result.status === 'failed') {
      ctx.onStepFail?.(step, new Error(result.error || 'Step failed'))

      // Check on_failure policy
      if (step.on_failure === 'continue') {
        continue
      }

      if (step.on_failure === 'retry') {
        console.warn(`[abilities] on_failure: retry not yet implemented for step '${step.id}', treating as stop`)
      }
      if (step.on_failure === 'ask') {
        console.warn(`[abilities] on_failure: ask not yet implemented for step '${step.id}', treating as stop`)
      }

      execution.status = 'failed'
      execution.error = result.error
      execution.completedAt = Date.now()
      return execution
    }

    ctx.onStepComplete?.(step, result)
  }

  execution.status = 'completed'
  execution.currentStep = null
  execution.completedAt = Date.now()

  return execution
}

export function formatExecutionResult(execution: AbilityExecution): string {
  const lines: string[] = []

  lines.push(`Ability: ${execution.ability.name}`)
  lines.push(`Status: ${execution.status === 'completed' ? '✅ Complete' : '❌ Failed'}`)

  if (execution.error) {
    lines.push(`Error: ${execution.error}`)
  }

  lines.push('')
  lines.push('Steps:')

  for (const result of execution.completedSteps) {
    const icon = result.status === 'completed' ? '✅' : result.status === 'skipped' ? '⏭️' : '❌'
    const duration = result.duration ? ` (${(result.duration / 1000).toFixed(1)}s)` : ''
    lines.push(`  ${icon} ${result.stepId}${duration}`)
    if (result.error) {
      lines.push(`     Error: ${result.error}`)
    }
  }

  const totalDuration = execution.completedAt
    ? ((execution.completedAt - execution.startedAt) / 1000).toFixed(1)
    : 'N/A'
  lines.push('')
  lines.push(`Duration: ${totalDuration}s`)

  return lines.join('\n')
}
