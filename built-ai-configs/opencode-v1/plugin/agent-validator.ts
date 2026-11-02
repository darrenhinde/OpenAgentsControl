import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { writeFile } from "fs/promises"
import path from "path"

/**
 * Helper function to check if a message contains approval request language
 */
function checkForApprovalLanguage(msg: any): boolean {
  if (!msg.parts) return false

  const approvalKeywords = [
    "approval",
    "approve",
    "proceed",
    "confirm",
    "permission",
    "before proceeding",
    "should i",
    "may i",
    "can i proceed",
  ]

  for (const part of msg.parts) {
    if (part.type === "text" && part.text) {
      const text = part.text.toLowerCase()
      if (approvalKeywords.some(keyword => text.includes(keyword))) {
        return true
      }
    }
  }

  return false
}

/**
 * Helper function to check if a user message contains approval response
 */
function checkForUserApproval(msg: any): boolean {
  if (!msg.parts) return false

  const userApprovalKeywords = [
    "proceed",
    "approved",
    "yes",
    "go ahead",
    "ok",
    "okay",
    "sure",
    "do it",
    "continue",
  ]

  for (const part of msg.parts) {
    if (part.type === "text" && part.text) {
      const text = part.text.toLowerCase().trim()
      // Check for exact matches or phrases containing approval keywords
      if (userApprovalKeywords.some(keyword => text === keyword || text.includes(keyword))) {
        return true
      }
    }
  }

  return false
}

/**
 * Agent Validation Plugin
 * 
 * Validates that agents follow their defined prompts and execution rules.
 * Tracks tool calls, approval gates, delegation decisions, and critical rule compliance.
 */
export const AgentValidatorPlugin: Plugin = async ({ client, project, directory }) => {
  // Track agent behavior in real-time
  const behaviorLog: Array<{
    timestamp: number
    sessionID: string
    agent: string
    event: string
    data: any
  }> = []

  // Track tool execution for approval gate validation
  const toolExecutionTracker = new Map<string, {
    approvalRequested: boolean
    toolsExecuted: string[]
    timestamp: number
  }>()

  // Track current agent for each session
  const sessionAgentTracker = new Map<string, string>()

  return {
    // Listen to all events
    async event(input) {
      const { event } = input
      // Silently track events (removed console.log to reduce noise)
      
      // Track session-level events for validation
      if (event.type === "message.updated") {
        const msg = event.properties.info
        behaviorLog.push({
          timestamp: Date.now(),
          sessionID: msg.sessionID,
          agent: msg.role === "user" ? msg.agent : "assistant",
          event: "message_created",
          data: {
            messageID: msg.id,
            role: msg.role,
          },
        })
      }
    },

    // Capture agent information from chat messages
    "chat.message": async (input, output) => {
      const { sessionID, agent } = input
      
      // Track which agent is currently active for this session
      if (agent) {
        sessionAgentTracker.set(sessionID, agent)
      }
    },

    // Monitor tool execution
    "tool.execute.before": async (input, output) => {
      const { tool, sessionID, callID } = input
      const key = `${sessionID}-${callID}`
      
      // Silently track tools (removed console.log to reduce noise)

      // Get current agent for this session
      const currentAgent = sessionAgentTracker.get(sessionID) || "unknown"

      // Track context file reads
      if (tool === "read") {
        const filePath = output.args?.filePath || output.args?.target_file
        if (filePath && filePath.includes(".opencode/")) {
          // Context file read detected - track silently
          behaviorLog.push({
            timestamp: Date.now(),
            sessionID,
            agent: currentAgent,
            event: "context_file_read",
            data: {
              tool: "read",
              filePath,
              callID,
            },
          })
        }
      }

      // Track execution tools that require approval
      const executionTools = ["bash", "write", "edit", "task"]
      
      if (executionTools.includes(tool)) {
        // Track execution tool silently
        const tracker = toolExecutionTracker.get(sessionID) || {
          approvalRequested: false,
          toolsExecuted: [],
          timestamp: Date.now(),
        }
        
        // Check recent messages for approval flow
        try {
          const messagesResponse = await client.session.messages({
            path: { id: sessionID },
          })
          const messages = messagesResponse.data || []
          
          // Look at last few messages for approval pattern
          const recentMessages = messages.slice(-5)
          for (let i = 0; i < recentMessages.length - 1; i++) {
            const msg = recentMessages[i]
            const nextMsg = recentMessages[i + 1]
            const role = msg.info?.role
            const nextRole = nextMsg.info?.role
            
            if (role === "assistant" && checkForApprovalLanguage(msg) &&
                nextRole === "user" && checkForUserApproval(nextMsg)) {
              tracker.approvalRequested = true
              // Approval flow detected - tracked silently
              break
            }
          }
        } catch (err) {
          // Error checking messages - continue silently
        }
        
        tracker.toolsExecuted.push(tool)
        toolExecutionTracker.set(sessionID, tracker)

        behaviorLog.push({
          timestamp: Date.now(),
          sessionID,
          agent: currentAgent,
          event: "execution_tool_called",
          data: {
            tool,
            callID,
            args: output.args,
            approvalRequested: tracker.approvalRequested,
          },
        })
      }
    },

    // Track tool execution results
    "tool.execute.after": async (input, output) => {
      const { tool, sessionID } = input
      
      // Track tool completion silently
      const currentAgent = sessionAgentTracker.get(sessionID) || "unknown"

      behaviorLog.push({
        timestamp: Date.now(),
        sessionID,
        agent: currentAgent,
        event: "tool_executed",
        data: {
          tool,
          title: output.title,
          metadata: output.metadata,
        },
      })
    },

    // Provide validation tools
    tool: {
      // Validate current session
      validate_session: tool({
        description: "Validate that the current agent session is following its defined prompt rules and execution patterns. Returns a detailed validation report.",
        args: {
          include_details: tool.schema.boolean()
            .optional()
            .describe("Include detailed evidence for each validation check"),
        },
        async execute(args, context) {
          const { sessionID } = context

          try {
            // Fetch session messages using SDK
            const messagesResponse = await client.session.messages({
              path: { id: sessionID },
            })

            if (messagesResponse.error) {
              return `Error fetching session: ${messagesResponse.error}`
            }

            const messages = messagesResponse.data || []
            
            // Analyze agent behavior
            const validation = await validateSessionBehavior({
              sessionID,
              messages,
              behaviorLog: behaviorLog.filter(log => log.sessionID === sessionID),
              includeDetails: args.include_details ?? false,
            })

            return formatValidationReport(validation)
          } catch (err) {
            return `Validation error: ${err instanceof Error ? err.message : String(err)}`
          }
        },
      }),

      // Check approval gate compliance
      check_approval_gates: tool({
        description: "Check if approval gates were properly enforced before execution operations (bash, write, edit, task). Returns compliance status.",
        args: {},
        async execute(args, context) {
          const { sessionID } = context
          const tracker = toolExecutionTracker.get(sessionID)

          if (!tracker) {
            return "No execution operations tracked in this session."
          }

          const { approvalRequested, toolsExecuted } = tracker
          const violations = approvalRequested ? [] : toolsExecuted

          if (violations.length === 0) {
            return `✅ Approval gate compliance: PASSED\n\nAll ${toolsExecuted.length} execution operation(s) were properly approved.`
          }

          return `⚠️ Approval gate compliance: FAILED\n\nExecuted ${violations.length} operation(s) without approval:\n${violations.map(t => `  - ${t}`).join("\n")}\n\nCritical rule violated: approval_gate`
        },
      }),

      // Export validation report
      export_validation_report: tool({
        description: "Export a comprehensive validation report for the current session to a markdown file",
        args: {
          output_path: tool.schema.string()
            .optional()
            .describe("Path to save the report (defaults to .tmp/validation-{sessionID}.md)"),
        },
        async execute(args, context) {
          const { sessionID } = context

          try {
            const messagesResponse = await client.session.messages({
              path: { id: sessionID },
            })

            if (messagesResponse.error) {
              return `Error fetching session: ${messagesResponse.error}`
            }

            const messages = messagesResponse.data || []

            const validation = await validateSessionBehavior({
              sessionID,
              messages,
              behaviorLog: behaviorLog.filter(log => log.sessionID === sessionID),
              includeDetails: true,
            })

            const report = generateDetailedReport(validation, messages)
            const outputPath = args.output_path || path.join(directory, `.tmp/validation-${sessionID.slice(0, 8)}.md`)

            await writeFile(outputPath, report, "utf-8")

            return `✅ Validation report exported to: ${outputPath}\n\n${formatValidationReport(validation)}`
          } catch (err) {
            return `Export error: ${err instanceof Error ? err.message : String(err)}`
          }
        },
      }),

      // Analyze delegation decisions
      analyze_delegation: tool({
        description: "Analyze whether delegation decisions followed the 4+ file rule and complexity criteria",
        args: {},
        async execute(args, context) {
          const { sessionID } = context

          const messagesResponse = await client.session.messages({
            path: { id: sessionID },
          })

          if (messagesResponse.error) {
            return `Error: ${messagesResponse.error}`
          }

          const messages = messagesResponse.data || []
          const analysis = analyzeDelegationDecisions(messages)

          return formatDelegationAnalysis(analysis)
        },
      }),

      // Analyze context file reads
      analyze_context_reads: tool({
        description: "Show all context files that were read during the session (e.g., .opencode/agent/openagent.md)",
        args: {},
        async execute(args, context) {
          const { sessionID } = context

          // Filter behavior log for context file reads
          const contextReads = behaviorLog.filter(
            log => log.sessionID === sessionID && log.event === "context_file_read"
          )

          if (contextReads.length === 0) {
            return "📚 No context files read in this session yet.\n\nContext files are in `.opencode/` directories (agent definitions, workflows, standards, etc.)"
          }

          const lines: string[] = [
            `## Context Files Read`,
            ``,
            `**Total reads:** ${contextReads.length}`,
            ``,
          ]

          // Group by file path
          const fileReadCounts = new Map<string, number>()
          contextReads.forEach(log => {
            const filePath = log.data.filePath
            fileReadCounts.set(filePath, (fileReadCounts.get(filePath) || 0) + 1)
          })

          // Sort by read count (most read first)
          const sorted = Array.from(fileReadCounts.entries()).sort((a, b) => b[1] - a[1])

          lines.push(`### Files Read:`)
          sorted.forEach(([filePath, count]) => {
            const fileName = filePath.split('/').pop()
            const readText = count === 1 ? "read" : "reads"
            lines.push(`- **${fileName}** (${count} ${readText})`)
            lines.push(`  \`${filePath}\``)
          })

          lines.push(``)
          lines.push(`### Timeline:`)
          contextReads.forEach((log, idx) => {
            const time = new Date(log.timestamp).toLocaleTimeString()
            const fileName = log.data.filePath.split('/').pop()
            lines.push(`${idx + 1}. [${time}] ${fileName}`)
          })

          return lines.join("\n")
        },
      }),

      // Check context loading compliance
      check_context_compliance: tool({
        description: "Check if required context files were read BEFORE executing tasks (e.g., read docs.md before writing documentation)",
        args: {},
        async execute(args, context) {
          const { sessionID } = context

          const messagesResponse = await client.session.messages({
            path: { id: sessionID },
          })

          if (messagesResponse.error) {
            return `Error: ${messagesResponse.error}`
          }

          const messages = messagesResponse.data || []
          const sessionBehaviorLog = behaviorLog.filter(log => log.sessionID === sessionID)
          
          const checks = analyzeContextLoadingCompliance(messages, sessionBehaviorLog)

          if (checks.length === 0) {
            return "📋 No tasks detected that require specific context files.\n\nContext loading rules apply when:\n- Writing documentation → should read standards/docs.md\n- Writing code → should read standards/code.md\n- Reviewing code → should read workflows/review.md\n- Delegating tasks → should read workflows/delegation.md\n- Writing tests → should read standards/tests.md"
          }

          const passed = checks.filter(c => c.passed).length
          const failed = checks.filter(c => !c.passed).length
          const score = Math.round((passed / checks.length) * 100)

          const lines: string[] = [
            `## Context Loading Compliance`,
            ``,
            `**Score:** ${score}%`,
            `- ✅ Compliant: ${passed}`,
            `- ⚠️  Non-compliant: ${failed}`,
            ``,
          ]

          if (failed > 0) {
            lines.push(`### ⚠️  Issues Found:`)
            checks.filter(c => !c.passed).forEach(check => {
              lines.push(`- ${check.details}`)
            })
            lines.push(``)
          }

          if (passed > 0) {
            lines.push(`### ✅ Compliant Actions:`)
            checks.filter(c => c.passed).forEach(check => {
              lines.push(`- ${check.details}`)
            })
            lines.push(``)
          }

          lines.push(`### Context Loading Rules:`)
          lines.push(`According to OpenAgent prompt, the agent should:`)
          lines.push(`1. Detect task type from user request`)
          lines.push(`2. Read required context file FIRST`)
          lines.push(`3. Then execute task following those standards`)
          lines.push(``)
          lines.push(`**Pattern:** "Fetch context BEFORE starting work, not during or after"`)

          return lines.join("\n")
        },
      }),

      // Analyze which agents were used
      analyze_agent_usage: tool({
        description: "Show which agents were active during the session and what tools they used",
        args: {},
        async execute(args, context) {
          const { sessionID } = context

          const sessionBehaviorLog = behaviorLog.filter(log => log.sessionID === sessionID)

          if (sessionBehaviorLog.length === 0) {
            return "📊 No agent activity tracked yet in this session."
          }

          // Group by agent
          const agentStats = new Map<string, {
            toolCalls: Map<string, number>
            events: string[]
            firstSeen: number
            lastSeen: number
          }>()

          sessionBehaviorLog.forEach(log => {
            const agent = log.agent || "unknown"
            
            if (!agentStats.has(agent)) {
              agentStats.set(agent, {
                toolCalls: new Map(),
                events: [],
                firstSeen: log.timestamp,
                lastSeen: log.timestamp
              })
            }

            const stats = agentStats.get(agent)!
            stats.lastSeen = log.timestamp
            stats.events.push(log.event)

            // Track tool usage
            if (log.event === "execution_tool_called" || log.event === "tool_executed") {
              const tool = log.data.tool
              stats.toolCalls.set(tool, (stats.toolCalls.get(tool) || 0) + 1)
            }
          })

          const lines: string[] = [
            `## Agent Usage Report`,
            ``,
            `**Agents detected:** ${agentStats.size}`,
            `**Total events:** ${sessionBehaviorLog.length}`,
            ``,
          ]

          // Sort agents by first seen
          const sortedAgents = Array.from(agentStats.entries()).sort((a, b) => a[1].firstSeen - b[1].firstSeen)

          sortedAgents.forEach(([agent, stats]) => {
            const duration = stats.lastSeen - stats.firstSeen
            const durationStr = duration > 0 ? `${Math.round(duration / 1000)}s` : "instant"
            
            lines.push(`### ${agent === "unknown" ? "Unknown Agent" : agent}`)
            lines.push(``)
            lines.push(`**Active duration:** ${durationStr}`)
            lines.push(`**Events:** ${stats.events.length}`)
            
            if (stats.toolCalls.size > 0) {
              lines.push(``)
              lines.push(`**Tools used:**`)
              const sortedTools = Array.from(stats.toolCalls.entries()).sort((a, b) => b[1] - a[1])
              sortedTools.forEach(([tool, count]) => {
                lines.push(`- ${tool}: ${count}x`)
              })
            }
            
            lines.push(``)
          })

          return lines.join("\n")
        },
      }),

      // Debug tool to inspect tracking
      debug_validator: tool({
        description: "Debug tool to inspect what the validator is tracking (behavior log, messages, etc.)",
        args: {},
        async execute(args, context) {
          const { sessionID } = context
          
          // Debug tool - gather information silently

          // Get messages from SDK
          const messagesResponse = await client.session.messages({
            path: { id: sessionID },
          })

          const messages = messagesResponse.data || []
          const sessionBehaviorLog = behaviorLog.filter(log => log.sessionID === sessionID)
          const tracker = toolExecutionTracker.get(sessionID)

          const debug = {
            sessionID,
            behaviorLogEntries: sessionBehaviorLog.length,
            behaviorLogSampleFirst: sessionBehaviorLog.slice(0, 3),
            behaviorLogSampleLast: sessionBehaviorLog.slice(-3),
            messagesCount: messages.length,
            messagesSample: messages.slice(0, 2).map(m => ({
              role: m.info?.role,
              partsCount: m.parts?.length,
              partTypes: m.parts?.map((p: any) => p.type),
            })),
            toolTracker: tracker ? {
              approvalRequested: tracker.approvalRequested,
              toolsExecuted: tracker.toolsExecuted,
            } : null,
            allBehaviorLogs: behaviorLog.length,
          }

          return `## Debug Information\n\n\`\`\`json\n${JSON.stringify(debug, null, 2)}\n\`\`\`\n\n**Analysis:**\n- Behavior log entries for this session: ${sessionBehaviorLog.length}\n- Total behavior log entries: ${behaviorLog.length}\n- Messages in session: ${messages.length}\n- Tool execution tracker: ${tracker ? 'Active' : 'None'}`
        },
      }),
    },
  }
}

// Validation logic
interface ValidationCheck {
  rule: string
  passed: boolean
  severity: "info" | "warning" | "error"
  details: string
  evidence?: any
}

interface ValidationResult {
  sessionID: string
  checks: ValidationCheck[]
  summary: {
    passed: number
    failed: number
    warnings: number
    score: number
  }
}

async function validateSessionBehavior(input: {
  sessionID: string
  messages: any[]
  behaviorLog: any[]
  includeDetails: boolean
}): Promise<ValidationResult> {
  const checks: ValidationCheck[] = []

  // Check 1: Tool usage patterns
  const toolUsage = analyzeToolUsage(input.messages)
  checks.push(...toolUsage)

  // Check 2: Approval gate enforcement
  const approvalChecks = analyzeApprovalGates(input.messages, input.behaviorLog)
  checks.push(...approvalChecks)

  // Check 3: Lazy context loading
  const contextChecks = analyzeContextLoading(input.messages)
  checks.push(...contextChecks)

  // Check 4: Delegation appropriateness
  const delegationChecks = analyzeDelegation(input.messages)
  checks.push(...delegationChecks)

  // Check 5: Critical rule compliance
  const criticalChecks = analyzeCriticalRules(input.messages)
  checks.push(...criticalChecks)

  // Check 6: Context loading compliance (read required files BEFORE execution)
  const contextComplianceChecks = analyzeContextLoadingCompliance(input.messages, input.behaviorLog)
  checks.push(...contextComplianceChecks)

  // Calculate summary
  const passed = checks.filter(c => c.passed).length
  const failed = checks.filter(c => !c.passed && c.severity === "error").length
  const warnings = checks.filter(c => !c.passed && c.severity === "warning").length
  const score = checks.length > 0 ? Math.round((passed / checks.length) * 100) : 0

  return {
    sessionID: input.sessionID,
    checks,
    summary: { passed, failed, warnings, score },
  }
}

function analyzeToolUsage(messages: any[]): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  
  for (const msg of messages) {
    // Messages have structure: { info: Message, parts: Part[] }
    const role = msg.info?.role || msg.role
    if (role !== "assistant") continue
    
    const tools = extractToolsFromMessage(msg)
    
    if (tools.length > 0) {
      checks.push({
        rule: "tool_usage",
        passed: true,
        severity: "info",
        details: `Used ${tools.length} tool(s): ${tools.join(", ")}`,
      })
    }
  }

  return checks
}

function analyzeApprovalGates(messages: any[], behaviorLog: any[]): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  const executionTools = ["bash", "write", "edit", "task"]

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const role = msg.info?.role || msg.role
    if (role !== "assistant") continue

    const tools = extractToolsFromMessage(msg)
    const executionOps = tools.filter(t => executionTools.includes(t))

    if (executionOps.length > 0) {
      // Check if approval language is present in this message OR in recent previous messages
      let hasApprovalRequest = checkForApprovalLanguage(msg)
      
      // Look back up to 3 messages to find approval request
      if (!hasApprovalRequest) {
        for (let j = Math.max(0, i - 3); j < i; j++) {
          const prevMsg = messages[j]
          const prevRole = prevMsg.info?.role || prevMsg.role
          if (prevRole === "assistant" && checkForApprovalLanguage(prevMsg)) {
            // Check if there's a user approval response after the request
            if (j + 1 < messages.length) {
              const userResponse = messages[j + 1]
              const userRole = userResponse.info?.role || userResponse.role
              if (userRole === "user" && checkForUserApproval(userResponse)) {
                hasApprovalRequest = true
                break
              }
            }
          }
        }
      }

      checks.push({
        rule: "approval_gate_enforcement",
        passed: hasApprovalRequest,
        severity: hasApprovalRequest ? "info" : "warning",
        details: hasApprovalRequest
          ? `Properly requested approval before ${executionOps.length} execution op(s)`
          : `⚠️ Executed ${executionOps.length} operation(s) without explicit approval request`,
        evidence: { executionOps, hasApprovalRequest },
      })
    }
  }

  return checks
}

function analyzeContextLoading(messages: any[]): ValidationCheck[] {
  const checks: ValidationCheck[] = []

  for (const msg of messages) {
    const role = msg.info?.role || msg.role
    if (role !== "assistant") continue

    // Look for read operations on .opencode/context/ files
    const contextReads = extractContextReads(msg)

    if (contextReads.length > 0) {
      checks.push({
        rule: "lazy_context_loading",
        passed: true,
        severity: "info",
        details: `Lazy-loaded ${contextReads.length} context file(s): ${contextReads.join(", ")}`,
      })
    }
  }

  return checks
}

function analyzeDelegation(messages: any[]): ValidationCheck[] {
  const checks: ValidationCheck[] = []

  for (const msg of messages) {
    const role = msg.info?.role || msg.role
    if (role !== "assistant") continue

    const tools = extractToolsFromMessage(msg)
    const hasDelegation = tools.includes("task")
    const writeEditCount = tools.filter(t => t === "write" || t === "edit").length

    if (hasDelegation) {
      const shouldDelegate = writeEditCount >= 4

      checks.push({
        rule: "delegation_appropriateness",
        passed: shouldDelegate,
        severity: shouldDelegate ? "info" : "warning",
        details: shouldDelegate
          ? `Appropriately delegated (${writeEditCount} files)`
          : `Delegated but only ${writeEditCount} files (< 4 threshold)`,
      })
    } else if (writeEditCount >= 4) {
      checks.push({
        rule: "delegation_appropriateness",
        passed: false,
        severity: "warning",
        details: `Should have delegated (${writeEditCount} files >= 4 threshold)`,
      })
    }
  }

  return checks
}

function analyzeCriticalRules(messages: any[]): ValidationCheck[] {
  const checks: ValidationCheck[] = []

  // Look for auto-fix attempts after errors
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i]
    const nextMsg = messages[i + 1]

    const role = msg.info?.role || msg.role
    const metadata = msg.info?.metadata || msg.metadata

    if (role === "assistant" && metadata?.error) {
      const nextTools = extractToolsFromMessage(nextMsg)
      const hasAutoFix = nextTools.some(t => ["write", "edit", "bash"].includes(t))

      if (hasAutoFix) {
        checks.push({
          rule: "stop_on_failure",
          passed: false,
          severity: "error",
          details: "⛔ Auto-fix attempted after error - violates stop_on_failure rule",
          evidence: { error: metadata.error, autoFixTools: nextTools },
        })
      }
    }
  }

  return checks
}

function analyzeContextLoadingCompliance(messages: any[], behaviorLog: any[]): ValidationCheck[] {
  const checks: ValidationCheck[] = []
  
  // Define required context files for different task types
  const contextRules = [
    {
      taskKeywords: ["write doc", "create doc", "documentation", "write readme", "document"],
      requiredFile: "standards/docs.md",
      taskType: "documentation"
    },
    {
      taskKeywords: ["write code", "create function", "implement", "add feature", "build"],
      requiredFile: "standards/code.md",
      taskType: "code writing"
    },
    {
      taskKeywords: ["review code", "check code", "analyze code", "code review"],
      requiredFile: "workflows/review.md",
      taskType: "code review"
    },
    {
      taskKeywords: ["delegate", "create task", "subagent"],
      requiredFile: "workflows/delegation.md",
      taskType: "delegation"
    },
    {
      taskKeywords: ["write test", "create test", "test coverage", "unit test"],
      requiredFile: "standards/tests.md",
      taskType: "testing"
    }
  ]

  // Get all context file reads from behavior log
  const contextReads = behaviorLog
    .filter(log => log.event === "context_file_read")
    .map(log => ({
      timestamp: log.timestamp,
      filePath: log.data.filePath
    }))

  // Analyze each message for task execution
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const role = msg.info?.role || msg.role
    
    if (role !== "assistant") continue

    const tools = extractToolsFromMessage(msg)
    const executionTools = tools.filter(t => ["write", "edit", "bash", "task"].includes(t))
    
    if (executionTools.length === 0) continue

    // Get message text to detect task type
    const messageText = extractMessageText(msg).toLowerCase()
    
    // Check if this message matches any context loading rules
    for (const rule of contextRules) {
      const matchesTask = rule.taskKeywords.some(keyword => messageText.includes(keyword))
      
      if (matchesTask) {
        // Check if required context file was read BEFORE this message
        const msgTimestamp = msg.info?.timestamp || Date.now()
        const contextReadBefore = contextReads.some(read => 
          read.filePath.includes(rule.requiredFile) && read.timestamp < msgTimestamp
        )

        checks.push({
          rule: "context_loading_compliance",
          passed: contextReadBefore,
          severity: contextReadBefore ? "info" : "warning",
          details: contextReadBefore
            ? `✅ Loaded ${rule.requiredFile} before ${rule.taskType}`
            : `⚠️ Did not load ${rule.requiredFile} before ${rule.taskType} task`,
          evidence: {
            taskType: rule.taskType,
            requiredFile: rule.requiredFile,
            contextReadBefore,
            executionTools
          }
        })
      }
    }
  }

  return checks
}

function analyzeDelegationDecisions(messages: any[]): {
  delegations: number
  appropriate: number
  inappropriate: number
  fileCountStats: number[]
} {
  const stats = {
    delegations: 0,
    appropriate: 0,
    inappropriate: 0,
    fileCountStats: [] as number[],
  }

  for (const msg of messages) {
    const role = msg.info?.role || msg.role
    if (role !== "assistant") continue

    const tools = extractToolsFromMessage(msg)
    const hasDelegation = tools.includes("task")
    const writeEditCount = tools.filter(t => t === "write" || t === "edit").length

    if (hasDelegation) {
      stats.delegations++
      stats.fileCountStats.push(writeEditCount)
      
      if (writeEditCount >= 4) {
        stats.appropriate++
      } else {
        stats.inappropriate++
      }
    }
  }

  return stats
}

// Helper functions
function extractToolsFromMessage(msg: any): string[] {
  const tools: string[] = []
  
  // Messages from SDK have structure: { info: Message, parts: Part[] }
  const parts = msg.parts || []

  for (const part of parts) {
    // Check for tool type (from SDK: part.type === "tool")
    if (part.type === "tool" && part.tool) {
      tools.push(part.tool)
    }
    // Also check for tool-invocation format (legacy)
    if (part.type === "tool-invocation" && part.toolInvocation) {
      tools.push(part.toolInvocation.toolName)
    }
  }

  return tools
}

function extractMessageText(msg: any): string {
  if (!msg.parts) return ""
  
  let text = ""
  for (const part of msg.parts) {
    if (part.type === "text" && part.text) {
      text += part.text + " "
    }
  }
  
  return text.trim()
}

function extractContextReads(msg: any): string[] {
  const contextFiles: string[] = []
  
  if (!msg.parts) return contextFiles

  for (const part of msg.parts) {
    if (part.type === "tool-invocation" && 
        part.toolInvocation?.toolName === "read" &&
        part.toolInvocation?.args?.target_file?.includes(".opencode/context/")) {
      contextFiles.push(part.toolInvocation.args.target_file)
    }
  }

  return contextFiles
}

// Formatting functions
function formatValidationReport(validation: ValidationResult): string {
  const { summary, checks } = validation
  
  const lines: string[] = [
    `## Validation Report`,
    ``,
    `**Score:** ${summary.score}%`,
    `- ✅ Passed: ${summary.passed}`,
    `- ⚠️  Warnings: ${summary.warnings}`,
    `- ❌ Failed: ${summary.failed}`,
    ``,
  ]

  // Group by severity
  const errors = checks.filter(c => !c.passed && c.severity === "error")
  const warnings = checks.filter(c => !c.passed && c.severity === "warning")

  if (errors.length > 0) {
    lines.push(`### ❌ Errors`)
    errors.forEach(check => {
      lines.push(`- **${check.rule}**: ${check.details}`)
    })
    lines.push(``)
  }

  if (warnings.length > 0) {
    lines.push(`### ⚠️  Warnings`)
    warnings.forEach(check => {
      lines.push(`- **${check.rule}**: ${check.details}`)
    })
    lines.push(``)
  }

  return lines.join("\n")
}

function formatDelegationAnalysis(analysis: any): string {
  const lines: string[] = [
    `## Delegation Analysis`,
    ``,
    `**Total delegations:** ${analysis.delegations}`,
    `- ✅ Appropriate: ${analysis.appropriate}`,
    `- ⚠️  Questionable: ${analysis.inappropriate}`,
    ``,
  ]

  if (analysis.fileCountStats.length > 0) {
    const avg = analysis.fileCountStats.reduce((a: number, b: number) => a + b, 0) / analysis.fileCountStats.length
    lines.push(`**File count per delegation:**`)
    lines.push(`- Average: ${avg.toFixed(1)} files`)
    lines.push(`- Range: ${Math.min(...analysis.fileCountStats)} - ${Math.max(...analysis.fileCountStats)} files`)
    lines.push(`- Threshold: 4+ files`)
  }

  return lines.join("\n")
}

function generateDetailedReport(validation: ValidationResult, messages: any[]): string {
  const lines: string[] = [
    `# Agent Validation Report`,
    ``,
    `**Session:** ${validation.sessionID}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Messages analyzed:** ${messages.length}`,
    ``,
    formatValidationReport(validation),
    ``,
    `## Detailed Checks`,
    ``,
  ]

  validation.checks.forEach(check => {
    const icon = check.passed ? "✅" : check.severity === "error" ? "❌" : "⚠️"
    lines.push(`### ${icon} ${check.rule}`)
    lines.push(``)
    lines.push(check.details)
    lines.push(``)
    
    if (check.evidence) {
      lines.push(`**Evidence:**`)
      lines.push(`\`\`\`json`)
      lines.push(JSON.stringify(check.evidence, null, 2))
      lines.push(`\`\`\``)
      lines.push(``)
    }
  })

  return lines.join("\n")
}

export default AgentValidatorPlugin
