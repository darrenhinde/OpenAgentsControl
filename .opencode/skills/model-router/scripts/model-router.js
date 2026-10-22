#!/usr/bin/env node
/**
 * Model Router CLI
 *
 * Manages per-agent model assignments via tier-based configuration.
 * Reads model-tiers.json, resolves agent paths from registry.json,
 * and applies model/temperature/top_p to agent markdown frontmatter.
 *
 * Usage: node model-router.js <command> [args...]
 *
 * Commands:
 *   status                       Show current agent→model assignments and drift
 *   apply                        Sync model-tiers.json → agent frontmatter
 *   tier <name> <model-id>       Change a tier's model
 *   assign <agent-id> <tier>     Move an agent to a different tier
 *   tiers                        List all tier definitions
 *   unassigned                   Show agents in registry not in assignments
 *   help                         Show help message
 */

const fs = require('fs');
const path = require('path');

// --- Path resolution ---

function findProjectRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'model-tiers.json');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'registry.json');

// --- Core functions ---

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Config not found: ${CONFIG_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error(`❌ Registry not found: ${REGISTRY_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

/** Build a map of agent-id → absolute-path from registry */
function buildAgentPathMap(registry) {
  const map = {};
  for (const category of Object.keys(registry.components)) {
    for (const comp of registry.components[category]) {
      if (comp.type === 'agent' || comp.type === 'subagent') {
        map[comp.id] = path.join(PROJECT_ROOT, comp.path);
      }
    }
  }
  return map;
}

/** Parse YAML frontmatter from a markdown file, return { frontmatter, body } */
function parseFrontmatter(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const raw = match[1];
  const body = match[2];
  const frontmatter = {};
  for (const line of raw.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      let value = kv[2].trim();
      // Parse simple YAML values
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value === 'null') value = null;
      else if (/^-?\d+(\.\d+)?$/.test(value)) value = parseFloat(value);
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body };
}

/** Write frontmatter updates back to a markdown file, preserving complex YAML */
function writeFrontmatter(filePath, updates) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/^(---\n)([\s\S]*?)(\n---\n)([\s\S]*)$/);
  if (!match) {
    console.error(`  ⚠️  No frontmatter found in ${filePath}, skipping`);
    return false;
  }

  const prefix = match[1];
  let rawYaml = match[2];
  const suffix = match[3];
  const fileBody = match[4];

  // Apply updates to the raw YAML by targeting specific keys
  for (const [key, value] of Object.entries(updates)) {
    const valueStr = typeof value === 'string' ? value : String(value);

    // Try to replace existing key
    const regex = new RegExp(`^(${key}:\\s*)(.*)$`, 'm');
    if (regex.test(rawYaml)) {
      rawYaml = rawYaml.replace(regex, `$1${valueStr}`);
    } else {
      // Add new key after the last simple key (before nested blocks)
      const lines = rawYaml.split('\n');
      let insertIdx = lines.length;
      // Find the last line that's a simple key-value (not indented)
      for (let i = lines.length - 1; i >= 0; i--) {
        if (/^\w[\w-]*:\s*.+/.test(lines[i])) {
          insertIdx = i + 1;
          break;
        }
      }
      lines.splice(insertIdx, 0, `${key}: ${valueStr}`);
      rawYaml = lines.join('\n');
    }
  }

  fs.writeFileSync(filePath, prefix + rawYaml + suffix + fileBody);
  return true;
}

// --- Commands ---

function cmdStatus() {
  const config = loadConfig();
  const registry = loadRegistry();
  const agentPaths = buildAgentPathMap(registry);

  console.log('═'.repeat(72));
  console.log('🎯 Model Router — Current Assignments');
  console.log('═'.repeat(72));

  // Tier summary
  console.log('\n📦 Tier Definitions:');
  for (const [tierName, tier] of Object.entries(config.tiers)) {
    const agentCount = Object.entries(config.assignments).filter(([, t]) => t === tierName).length;
    console.log(`  ${tierName.padEnd(12)} → ${tier.model.padEnd(40)} (${agentCount} agents)`);
    console.log(`              temp: ${tier.temperature}, top_p: ${tier.top_p}`);
  }

  // Per-agent assignments with drift detection
  console.log('\n🔗 Agent Assignments:');
  const driftFound = [];

  const sortedAssignments = Object.entries(config.assignments).sort(([, a], [, b]) => a.localeCompare(b));
  let currentTier = '';

  for (const [agentId, tierName] of sortedAssignments) {
    if (tierName !== currentTier) {
      currentTier = tierName;
      const tier = config.tiers[tierName];
      if (tier) {
        console.log(`\n  ── ${tierName.toUpperCase()} (${tier.model}) ──`);
      }
    }

    const filePath = agentPaths[agentId];
    let currentModel = '(not found)';
    let drift = false;

    if (filePath) {
      const parsed = parseFrontmatter(filePath);
      if (parsed && parsed.frontmatter.model) {
        currentModel = parsed.frontmatter.model;
        const expectedModel = config.tiers[tierName]?.model;
        if (expectedModel && currentModel !== expectedModel) {
          drift = true;
          driftFound.push(agentId);
        }
      } else if (parsed) {
        currentModel = '(inherited/default)';
      }
    }

    const driftMarker = drift ? ' ⚠️ DRIFT' : '';
    const okMarker = !drift && currentModel !== '(not found)' && currentModel !== '(inherited/default)' ? ' ✅' : '';
    console.log(`    ${agentId.padEnd(24)} ${currentModel.padEnd(42)}${driftMarker}${okMarker}`);
  }

  if (driftFound.length > 0) {
    console.log(`\n⚠️  Drift detected for ${driftFound.length} agent(s). Run 'apply' to sync.`);
  } else {
    console.log('\n✅ All agents in sync with tier definitions.');
  }
}

function cmdApply(dryRun) {
  const config = loadConfig();
  const registry = loadRegistry();
  const agentPaths = buildAgentPathMap(registry);

  console.log('═'.repeat(72));
  if (dryRun) {
    console.log('🔍 Model Router — DRY RUN (no files will be modified)');
  } else {
    console.log('🔄 Model Router — Applying tier assignments to agent files');
  }
  console.log('═'.repeat(72));

  let applied = 0;
  let skipped = 0;
  let errors = 0;

  for (const [agentId, tierName] of Object.entries(config.assignments)) {
    const tier = config.tiers[tierName];
    if (!tier) {
      console.log(`  ❌ ${agentId}: Unknown tier '${tierName}'`);
      errors++;
      continue;
    }

    const filePath = agentPaths[agentId];
    if (!filePath) {
      console.log(`  ⏭️  ${agentId}: Not found in registry, skipping`);
      skipped++;
      continue;
    }

    if (!fs.existsSync(filePath)) {
      console.log(`  ❌ ${agentId}: File not found at ${filePath}`);
      errors++;
      continue;
    }

    const updates = {
      model: tier.model,
      temperature: tier.temperature,
      top_p: tier.top_p,
    };

    if (dryRun) {
      const parsed = parseFrontmatter(filePath);
      const currentModel = parsed?.frontmatter.model || '(none)';
      const changed = currentModel !== tier.model;
      console.log(`  ${changed ? '📝' : '  '} ${agentId}: ${currentModel} → ${tier.model} (temp: ${tier.temperature}, top_p: ${tier.top_p})`);
      applied++;
    } else {
      const success = writeFrontmatter(filePath, updates);
      if (success) {
        console.log(`  ✅ ${agentId}: model=${tier.model}, temperature=${tier.temperature}, top_p=${tier.top_p}`);
        applied++;
      } else {
        console.log(`  ❌ ${agentId}: Failed to update frontmatter`);
        errors++;
      }
    }
  }

  console.log('\n' + '─'.repeat(72));
  if (dryRun) {
    console.log(`Preview: ${applied} would be updated, ${skipped} skipped, ${errors} errors`);
  } else {
    console.log(`Applied: ${applied} updated, ${skipped} skipped, ${errors} errors`);
  }
}

function cmdTier(tierName, modelId) {
  const config = loadConfig();

  if (!config.tiers[tierName]) {
    console.error(`❌ Unknown tier: '${tierName}'`);
    console.log(`Available tiers: ${Object.keys(config.tiers).join(', ')}`);
    process.exit(1);
  }

  const oldModel = config.tiers[tierName].model;
  config.tiers[tierName].model = modelId;
  saveConfig(config);

  console.log(`✅ Updated tier '${tierName}': ${oldModel} → ${modelId}`);
  console.log(`\nRun 'apply' to propagate this change to all agents in the '${tierName}' tier.`);
}

function cmdAssign(agentId, tierName) {
  const config = loadConfig();

  if (!config.tiers[tierName]) {
    console.error(`❌ Unknown tier: '${tierName}'`);
    console.log(`Available tiers: ${Object.keys(config.tiers).join(', ')}`);
    process.exit(1);
  }

  const oldTier = config.assignments[agentId] || '(unassigned)';
  config.assignments[agentId] = tierName;
  saveConfig(config);

  console.log(`✅ Assigned '${agentId}' to tier '${tierName}': ${oldTier} → ${tierName}`);
  console.log(`\nRun 'apply' to propagate this change to the agent's frontmatter.`);
}

function cmdTiers() {
  const config = loadConfig();

  console.log('═'.repeat(72));
  console.log('📦 Model Tier Definitions');
  console.log('═'.repeat(72));

  for (const [tierName, tier] of Object.entries(config.tiers)) {
    const agentCount = Object.entries(config.assignments).filter(([, t]) => t === tierName).length;
    console.log(`\n  ${tierName.toUpperCase()}`);
    console.log(`    Model:        ${tier.model}`);
    console.log(`    Temperature:  ${tier.temperature}`);
    console.log(`    Top-P:        ${tier.top_p}`);
    console.log(`    Description:  ${tier.description}`);
    console.log(`    Agents:       ${agentCount}`);
  }

  console.log('\n' + '─'.repeat(72));
  console.log(`Defaults: primary_agents → '${config.defaults.primary_agents}', subagents → '${config.defaults.subagents}'`);
}

function cmdUnassigned() {
  const config = loadConfig();
  const registry = loadRegistry();
  const agentPaths = buildAgentPathMap(registry);

  const assignedIds = new Set(Object.keys(config.assignments));
  const unassigned = [];

  for (const [id, filePath] of Object.entries(agentPaths)) {
    if (!assignedIds.has(id)) {
      const parsed = parseFrontmatter(filePath);
      unassigned.push({
        id,
        name: parsed?.frontmatter.name || id,
        type: parsed?.frontmatter.mode || 'unknown',
      });
    }
  }

  console.log('═'.repeat(72));
  console.log('🔍 Agents Not in model-tiers.json Assignments');
  console.log('═'.repeat(72));

  if (unassigned.length === 0) {
    console.log('\n✅ All agents in registry are assigned to a tier.');
    return;
  }

  for (const agent of unassigned) {
    console.log(`  ${agent.id.padEnd(24)} (${agent.type}) ${agent.name}`);
  }

  console.log(`\n${unassigned.length} unassigned agent(s). Add them to 'assignments' in model-tiers.json.`);
}

// --- Main router ---

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '-h' || args[0] === '--help') {
    console.log(`
🎯 Model Router CLI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Usage: model-router.js <command> [args...]

COMMANDS:
  status                       Show current agent→model assignments and drift
  apply [--dry-run]            Sync model-tiers.json → agent frontmatter
  tier <name> <model-id>       Change a tier's model
  assign <agent-id> <tier>     Move an agent to a different tier
  tiers                        List all tier definitions
  unassigned                   Show agents not in assignments
  help                         Show this help message

EXAMPLES:
  node model-router.js status
  node model-router.js apply
  node model-router.js apply --dry-run
  node model-router.js tier fast lmstudio/phi-4-mini
  node model-router.js assign contextscout medium
  node model-router.js tiers
  node model-router.js unassigned

CONFIG FILE: .opencode/skills/model-router/config/model-tiers.json
`);
    return;
  }

  const command = args[0];

  switch (command) {
    case 'status':
      cmdStatus();
      break;

    case 'apply':
      cmdApply(args.includes('--dry-run'));
      break;

    case 'tier':
      if (args.length < 3) {
        console.error('❌ Usage: model-router.js tier <name> <model-id>');
        process.exit(1);
      }
      cmdTier(args[1], args[2]);
      break;

    case 'assign':
      if (args.length < 3) {
        console.error('❌ Usage: model-router.js assign <agent-id> <tier>');
        process.exit(1);
      }
      cmdAssign(args[1], args[2]);
      break;

    case 'tiers':
      cmdTiers();
      break;

    case 'unassigned':
      cmdUnassigned();
      break;

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log("Run 'help' for available commands.");
      process.exit(1);
  }
}

main();
