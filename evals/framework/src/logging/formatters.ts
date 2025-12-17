/**
 * Multi-Agent Logging System - Formatters
 * 
 * Visual formatting utilities for pretty-printing delegation hierarchies.
 */

/**
 * Format a session header with box drawing
 */
export function formatSessionHeader(
  sessionId: string,
  agent: string,
  depth: number,
  parentId?: string
): string {
  const indent = '  '.repeat(depth);
  const type = depth === 0 ? 'PARENT' : 'CHILD';
  const shortId = sessionId.substring(0, 12);
  const boxWidth = 60;
  
  let header = `\n${indent}┌${'─'.repeat(boxWidth)}┐\n`;
  header += `${indent}│ 🎯 ${type}: ${agent} (${shortId}...)`;
  
  // Pad to box width
  const contentLength = ` 🎯 ${type}: ${agent} (${shortId}...)`.length;
  const padding = boxWidth - contentLength;
  header += ' '.repeat(Math.max(0, padding)) + '│\n';
  
  if (parentId) {
    const shortParent = parentId.substring(0, 12);
    header += `${indent}│    Parent: ${shortParent}...`;
    const parentLineLength = `    Parent: ${shortParent}...`.length;
    const parentPadding = boxWidth - parentLineLength;
    header += ' '.repeat(Math.max(0, parentPadding)) + '│\n';
    
    header += `${indent}│    Depth: ${depth}`;
    const depthLineLength = `    Depth: ${depth}`.length;
    const depthPadding = boxWidth - depthLineLength;
    header += ' '.repeat(Math.max(0, depthPadding)) + '│\n';
  }
  
  header += `${indent}└${'─'.repeat(boxWidth)}┘`;
  
  return header;
}

/**
 * Format a message with emoji and indentation
 */
export function formatMessage(
  role: 'user' | 'assistant',
  text: string,
  depth: number
): string {
  const indent = '  '.repeat(depth + 1);
  const emoji = role === 'user' ? '📝' : '🤖';
  const label = role === 'user' ? 'User' : 'Agent';
  
  // Truncate long messages
  const maxLength = 80;
  const displayText = text.length > maxLength 
    ? text.substring(0, maxLength) + '...' 
    : text;
  
  return `${indent}${emoji} ${label}: ${displayText}`;
}

/**
 * Format a tool call with indentation
 */
export function formatToolCall(
  tool: string,
  input: any,
  depth: number
): string {
  const indent = '  '.repeat(depth + 1);
  
  let output = `${indent}🔧 TOOL: ${tool}`;
  
  // Add relevant input details
  if (input?.filePath) {
    output += `\n${indent}   └─ file: ${input.filePath}`;
  } else if (input?.pattern) {
    output += `\n${indent}   └─ pattern: ${input.pattern}`;
  } else if (input?.command) {
    const cmd = input.command.substring(0, 50);
    output += `\n${indent}   └─ command: ${cmd}${input.command.length > 50 ? '...' : ''}`;
  }
  
  return output;
}

/**
 * Format a delegation event
 */
export function formatDelegation(
  toAgent: string,
  prompt: string,
  depth: number
): string {
  const indent = '  '.repeat(depth + 1);
  
  // Truncate long prompts
  const maxLength = 50;
  const displayPrompt = prompt.length > maxLength 
    ? prompt.substring(0, maxLength) + '...' 
    : prompt;
  
  let output = `\n${indent}🔧 TOOL: task\n`;
  output += `${indent}   ├─ subagent: ${toAgent}\n`;
  output += `${indent}   ├─ prompt: ${displayPrompt}\n`;
  output += `${indent}   └─ Creating child session...`;
  
  return output;
}

/**
 * Format child session linked message
 */
export function formatChildLinked(
  childSessionId: string,
  depth: number
): string {
  const indent = '  '.repeat(depth + 1);
  const shortId = childSessionId.substring(0, 12);
  return `${indent}   └─ Child session: ${shortId}...`;
}

/**
 * Format session completion
 */
export function formatSessionComplete(
  sessionType: 'PARENT' | 'CHILD',
  duration: number,
  depth: number
): string {
  const indent = '  '.repeat(depth);
  const durationSec = (duration / 1000).toFixed(1);
  return `${indent}✅ ${sessionType} COMPLETE (${durationSec}s)\n`;
}

/**
 * Format a system message
 */
export function formatSystemMessage(
  message: string,
  depth: number
): string {
  const indent = '  '.repeat(depth + 1);
  return `${indent}ℹ️  ${message}`;
}
