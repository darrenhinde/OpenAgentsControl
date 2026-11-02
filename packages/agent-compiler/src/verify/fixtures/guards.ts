/**
 * File-based guards a scenario arm can install in its workdir.
 *   poc-secrets  the poc `.env` guard (03): a Claude Code PreToolUse hook, and an OpenCode
 *                `read` deny rule. Stand-in for the v1.2 secrets gate.
 *   broad        an over-broad guard for fp arms: denies any call naming one of `needles`.
 * The `shipped` guard (the emitted .opencode/ tree, plugins/claude-code) is copied by the caller.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Denies any tool input naming a .env file and logs one decision row (poc hook, unchanged). */
export const SECRETS_HOOK = `// OAC secrets gate for Claude Code PreToolUse. Denies any tool input naming a .env file
// and appends one decision row to .oac/logs/decisions.jsonl.
const fs = require("fs"), path = require("path");
let s = ""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => {
  const ev = JSON.parse(s), inp = JSON.stringify(ev.tool_input ?? {});
  const deny = /(^|[\\/"\\s])\\.env(\\.|"|\\s|$)/.test(inp);
  const dir = path.join(ev.cwd ?? ".", ".oac/logs"); fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "decisions.jsonl"), JSON.stringify({ host: "claude-code", gate: "oac/secrets", tool: ev.tool_name, decision: deny ? "deny" : "allow" }) + "\\n");
  if (deny) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "OAC blocked [oac/secrets]: .env is protected. Fix: ask a human for the value." } }));
});
`;

/** fp arms: deny any tool input that contains one of the needles. */
export function broadHook(needles: string[]): string {
  return `// Over-broad test guard (fp arm): denies any tool input naming ${JSON.stringify(needles)}.
const fs = require("fs"), path = require("path"), needles = ${JSON.stringify(needles)};
let s = ""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => {
  const ev = JSON.parse(s), inp = JSON.stringify(ev.tool_input ?? {});
  const deny = needles.some(n => inp.includes(n));
  const dir = path.join(ev.cwd ?? ".", ".oac/logs"); fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "decisions.jsonl"), JSON.stringify({ host: "claude-code", gate: "oac/fp-broad", tool: ev.tool_name, decision: deny ? "deny" : "allow" }) + "\\n");
  if (deny) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "OAC blocked [oac/fp-broad]" } }));
});
`;
}

export const claudeHookSettings = (file: string): Record<string, unknown> => ({
  hooks: {
    PreToolUse: [{ matcher: 'Read|Grep|Glob|Bash|Edit|Write', hooks: [{ type: 'command', command: `node "$CLAUDE_PROJECT_DIR/.oac/hooks/${file}"` }] }],
  },
});

/** OpenCode's guard for the poc scenario (poc/run-opencode.sh). */
export const OPENCODE_ENV_DENY = { read: { '*': 'allow', '*.env': 'deny', '**/.env': 'deny', '.env': 'deny' } };

export type FileGuard = 'poc-secrets' | 'broad';

/** Install a file guard; returns the OpenCode `permission` block to put in opencode.json, if any. */
export function installFileGuard(work: string, host: 'claude-code' | 'opencode-v2', guard: FileGuard, needles: string[] = []): Record<string, unknown> | undefined {
  if (host === 'opencode-v2') {
    if (guard === 'poc-secrets') return OPENCODE_ENV_DENY;
    const read: Record<string, string> = { '*': 'allow' };
    for (const n of needles) {
      read[n] = 'deny';
      read[`**/${n}`] = 'deny';
    }
    return { read };
  }
  // .cjs: in a repo whose package.json says "type": "module", a .js hook using require() crashes,
  // and Claude Code treats a crashed PreToolUse hook as "allow" (fails open).
  const file = guard === 'poc-secrets' ? 'secrets.cjs' : 'fp-broad.cjs';
  mkdirSync(join(work, '.claude'), { recursive: true });
  mkdirSync(join(work, '.oac', 'hooks'), { recursive: true });
  writeFileSync(join(work, '.claude', 'settings.json'), JSON.stringify(claudeHookSettings(file), null, 2) + '\n');
  writeFileSync(join(work, '.oac', 'hooks', file), guard === 'poc-secrets' ? SECRETS_HOOK : broadHook(needles));
  return undefined;
}
