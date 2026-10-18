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
  hookResponses: { hook: string; stdout: string; exitCode?: number }[];
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
      r.hookResponses.push({
        hook: String(ev.hook_name ?? ev.hook_event ?? ''),
        stdout: typeof ev.stdout === 'string' ? ev.stdout : '',
        ...(typeof ev.exit_code === 'number' ? { exitCode: ev.exit_code } : {}),
      });
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

export interface SessionStartPayload {
  /** The context the hook injected (additionalContext / additional_context), decoded. */
  context: string;
  lines: number;
  bytes: number;
  stdoutBytes: number;
}

/**
 * What the SessionStart:startup hooks injected. A hook's stdout is JSON carrying
 * `hookSpecificOutput.additionalContext` (or the legacy `additional_context`), or plain text,
 * which Claude Code adds as context as-is. Several hooks are concatenated.
 */
export function sessionStartPayload(r: ClaudeRunResult): SessionStartPayload | undefined {
  const hooks = r.hookResponses.filter((h) => h.hook === 'SessionStart:startup');
  if (!hooks.length) return undefined;
  const parts: string[] = [];
  let stdoutBytes = 0;
  for (const h of hooks) {
    stdoutBytes += Buffer.byteLength(h.stdout);
    const t = h.stdout.trim();
    if (!t) continue;
    let ctx: string | undefined;
    if (t.startsWith('{')) {
      try {
        const j: unknown = JSON.parse(t);
        if (isObj(j)) {
          const hso = isObj(j.hookSpecificOutput) ? j.hookSpecificOutput.additionalContext : undefined;
          const v = hso ?? j.additional_context ?? j.additionalContext;
          ctx = typeof v === 'string' ? v : '';
        }
      } catch {
        /* not JSON: plain text */
      }
    }
    parts.push(ctx ?? t);
  }
  const context = parts.filter(Boolean).join('\n');
  return { context, lines: context ? context.split('\n').length : 0, bytes: Buffer.byteLength(context), stdoutBytes };
}
