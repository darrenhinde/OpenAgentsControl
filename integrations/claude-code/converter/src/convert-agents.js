#!/usr/bin/env node

/**
 * convert-agents.js
 * Converts OpenAgents Control to Claude Code format
 *
 * Usage: node convert-agents.js [--watch]
 */

const fs = require('fs');
const path = require('path');

// Configuration - Use absolute paths from the script location
const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.resolve(path.join(SCRIPT_DIR, '../../../../'));
const SOURCE_DIR = path.join(REPO_ROOT, '.opencode/agent');
const OUTPUT_DIR = path.join(SCRIPT_DIR, '../generated');

const CLAUDE_AGENTS_DIR = path.join(OUTPUT_DIR, 'agents');
const CLAUDE_SKILLS_DIR = path.join(OUTPUT_DIR, 'skills');

// Claude frontmatter fields (subset of OpenCode)
const CLAUDE_FIELDS = ['name', 'description', 'tools', 'model', 'permissionMode', 'skills', 'hooks'];

console.log('🚀 OpenAgents Control → Claude Code Converter');
console.log(`   Source: ${SOURCE_DIR}`);
console.log(`   Output: ${OUTPUT_DIR}\n`);

/**
 * Parses YAML frontmatter from markdown
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, content };
  
  const yaml = match[1];
  const body = match[2];
  
  const frontmatter = {};
  yaml.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(v => v.trim().replace(/"/g, ''));
      }
      
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, body };
}

/**
 * Converts OpenCode frontmatter to Claude format
 */
function convertFrontmatter(ocFrontmatter) {
  const claude = {};
  
  // Map OpenCode fields to Claude fields
  claude.name = ocFrontmatter.id || ocFrontmatter.name;
  claude.description = ocFrontmatter.description;
  
  // Map tools from OpenCode permissions to Claude
  if (ocFrontmatter.tools) {
    claude.tools = ocFrontmatter.tools;
  } else if (ocFrontmatter.permissions) {
    // Extract allowed tools from permissions block
    const tools = [];
    if (ocFrontmatter.permissions.read) tools.push('Read');
    if (ocFrontmatter.permissions.grep) tools.push('Grep');
    if (ocFrontmatter.permissions.glob) tools.push('Glob');
    if (ocFrontmatter.permissions.edit) tools.push('Edit');
    if (ocFrontmatter.permissions.write) tools.push('Write');
    if (ocFrontmatter.permissions.bash) tools.push('Bash');
    claude.tools = tools.join(', ');
  }
  
  // Map model
  claude.model = mapModel(ocFrontmatter.model);
  
  // Map permissionMode (default to 'default' if not specified)
  claude.permissionMode = ocFrontmatter.mode === 'subagent' ? 'plan' : 'default';
  
  return claude;
}

/**
 * Maps OpenCode model names to Claude model aliases
 */
function mapModel(model) {
  const modelMap = {
    'opencode/grok-code': 'sonnet',
    'opencode/grok': 'opus',
    'gpt-4': 'sonnet',
    'gpt-4o': 'sonnet',
    'haiku': 'haiku',
  };
  return modelMap[model] || 'sonnet';
}

/**
 * Generates Claude markdown from converted data
 */
function generateClaudeMarkdown(claudeFrontmatter, body) {
  const fm = Object.entries(claudeFrontmatter)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${key}: [${value.map(v => `"${v}"`).join(', ')}]`;
      }
      return `${key}: "${value}"`;
    })
    .join('\n');
  
  return `---\n${fm}\n---\n\n${body}`;
}

/**
 * Recursively finds all .md files in a directory
 */
function findMarkdownFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findMarkdownFiles(fullPath, files);
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Processes a single agent file
 */
function processAgent(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content);
  
  if (!frontmatter) {
    console.log(`⚠️  Skipping ${filePath} (no frontmatter)`);
    return;
  }
  
  const claudeFrontmatter = convertFrontmatter(frontmatter);
  const claudeMarkdown = generateClaudeMarkdown(claudeFrontmatter, body);
  
  // Determine output path
  const relativePath = path.relative(SOURCE_DIR, filePath);
  const outputPath = path.join(CLAUDE_AGENTS_DIR, relativePath);
  
  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  
  fs.writeFileSync(outputPath, claudeMarkdown);
  console.log(`✅ Converted: ${relativePath}`);
}

/**
 * Main conversion function
 */
function convert() {
  // Clean output directories
  if (fs.existsSync(CLAUDE_AGENTS_DIR)) fs.rmSync(CLAUDE_AGENTS_DIR, { recursive: true });
  if (fs.existsSync(CLAUDE_SKILLS_DIR)) fs.rmSync(CLAUDE_SKILLS_DIR, { recursive: true });
  
  fs.mkdirSync(CLAUDE_AGENTS_DIR, { recursive: true });
  fs.mkdirSync(path.join(CLAUDE_SKILLS_DIR, 'openagents-control-standards'), { recursive: true });
  
  console.log('📦 Converting agents...\n');
  
  // Process category agents
  const agentFiles = findMarkdownFiles(SOURCE_DIR);
  agentFiles.forEach(processAgent);
  
  // Create default context-scout subagent
  const contextScoutContent = `---
name: context-scout
description: Discovers and recommends OpenAgents Control context files using glob, read, and grep tools. Use when you need to find OpenAgents Control standards, guides, or domain knowledge in the .opencode/context directory.
tools: Read, Grep, Glob
model: haiku
permissionMode: plan
---

# ContextScout

You discover and recommend relevant OpenAgents Control context files from \`.opencode/context/\` based on the user's request.

## Your Process

1. Use \`Glob\` to find files in \`.opencode/context/\`.
2. Use \`Read\` or \`Grep\` to verify relevance.
3. Return file paths with brief descriptions.
`;

  fs.writeFileSync(
    path.join(CLAUDE_AGENTS_DIR, 'context-scout.md'),
    contextScoutContent
  );
  
  // Create openagents-control-standards skill
  const skillContent = `---
name: openagents-control-standards
description: Automatically triggers before any task to ensure OpenAgents Control standards and context are loaded. Use when the user asks to create, modify, or analyze anything in this repository.
---

# OpenAgents Control Standards Loader

Before proceeding with the user's request:

1. Call the \`context-scout\` subagent with the user's request to find relevant OpenAgents Control context files.
2. Read the returned "Critical" and "High" priority files.
3. Apply the OpenAgents Control standards found to your work.
`;

  fs.writeFileSync(
    path.join(CLAUDE_SKILLS_DIR, 'openagents-control-standards/SKILL.md'),
    skillContent
  );
  
  console.log('\n✨ Conversion complete!');
  console.log(`   Output: ${OUTPUT_DIR}`);
}

// Run conversion
convert();
