/**
 * Claude Code host driver for conformance tests (generalises poc/run-claude.sh).
 *
 * Builds argv and parses stream-json; the caller spawns through its sandbox wrapper.
 * `--setting-sources project` keeps user/local settings out; `--strict-mcp-config` with no
 * `--mcp-config` keeps MCP servers out. Never `--bare` for gate tests: it skips hooks.
 */

export interface ClaudeRunOptions {
  prompt: string;
  allowedTools?: string[];
  pluginDir?: string;
  bin?: string;
  /** Refuse --bare when the check depends on hooks (R15). */
  bare?: boolean;
  needsHooks?: boolean;
}

export function claudeRunArgv(o: ClaudeRunOptions): string[] {
  if (o.bare && o.needsHooks) throw new Error('claude driver: --bare skips hooks; refusing for a hook-dependent check');
  return [
    o.bin ?? 'claude', '-p', o.prompt,
    '--output-format', 'stream-json', '--verbose',
    '--setting-sources', 'project',
    '--strict-mcp-config',
    '--no-session-persistence',
    ...(o.allowedTools?.length ? ['--allowedTools', o.allowedTools.join(',')] : []),
    ...(o.pluginDir ? ['--plugin-dir', o.pluginDir] : []),
    ...(o.bare ? ['--bare'] : []),
  ];
}

export interface ClaudeRunResult {
  init?: Record<string, unknown>;
  apiKeySource?: string;
  permissionDenials: unknown[];
  toolResults: string[];
  hookResponses: { hook: string; stdout: string }[];
  resultSubtype?: string;
  isError?: boolean;
  events: number;
  unparsed: number;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseClaudeStream(out: string): ClaudeRunResult {
  const r: ClaudeRunResult = { permissionDenials: [], toolResults: [], hookResponses: [], events: 0, unparsed: 0 };
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('{')) {
      if (t) r.unparsed++;
      continue;
    }
    let ev: unknown;
    try {
      ev = JSON.parse(t);
    } catch {
      r.unparsed++;
      continue;
    }
    if (!isObj(ev)) continue;
    r.events++;
    if (ev.type === 'system' && ev.subtype === 'init') {
      r.init = ev;
      if (typeof ev.apiKeySource === 'string') r.apiKeySource = ev.apiKeySource;
    }
    if (ev.type === 'system' && ev.subtype === 'hook_response') {
      r.hookResponses.push({ hook: String(ev.hook_name ?? ev.hook_event ?? ''), stdout: typeof ev.stdout === 'string' ? ev.stdout : '' });
    }
    if (ev.type === 'user' && isObj(ev.message) && Array.isArray(ev.message.content)) {
      for (const b of ev.message.content as unknown[]) {
        if (isObj(b) && b.type === 'tool_result') r.toolResults.push(typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? ''));
      }
    }
    if (ev.type === 'result') {
      if (Array.isArray(ev.permission_denials)) r.permissionDenials = ev.permission_denials as unknown[];
      if (typeof ev.subtype === 'string') r.resultSubtype = ev.subtype;
      if (typeof ev.is_error === 'boolean') r.isError = ev.is_error;
    }
  }
  return r;
}
