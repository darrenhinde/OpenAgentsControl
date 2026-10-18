/**
 * OpenCode v2 host driver for conformance tests (generalises poc/run-opencode.sh).
 *
 * The driver only builds config and argv and parses output. It never spawns the host itself:
 * the caller runs the argv through its sandbox wrapper (env scrub, throwaway HOME, Seatbelt).
 * Always `--standalone`: without it OpenCode talks to the user's managed background service.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OPENCODE_MODEL = 'mock/m';

export interface OpenCodeConfigOptions {
  /** Base URL of the fake model, e.g. http://127.0.0.1:1234 (no /v1). */
  mockUrl: string;
  apiKey: string;
  permission?: Record<string, unknown>;
}

export function openCodeConfig(o: OpenCodeConfigOptions): Record<string, unknown> {
  return {
    $schema: 'https://opencode.ai/config.json',
    ...(o.permission ? { permission: o.permission } : {}),
    provider: {
      mock: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Mock',
        options: { baseURL: `${o.mockUrl}/v1`, apiKey: o.apiKey },
        models: { m: { name: 'm', tool_call: true } },
      },
    },
    model: OPENCODE_MODEL,
  };
}

export function writeOpenCodeConfig(workdir: string, o: OpenCodeConfigOptions): string {
  const p = join(workdir, 'opencode.json');
  writeFileSync(p, JSON.stringify(openCodeConfig(o), null, 2) + '\n');
  return p;
}

export interface OpenCodeRunOptions {
  prompt: string;
  agent?: string;
  /** Auto-approve permissions that are not explicitly denied. */
  auto?: boolean;
  bin?: string;
}

export function openCodeRunArgv(o: OpenCodeRunOptions): string[] {
  return [
    o.bin ?? 'opencode', 'run', '--standalone', '--format', 'json', '-m', OPENCODE_MODEL,
    ...(o.auto ? ['--auto'] : []),
    ...(o.agent ? ['--agent', o.agent] : []),
    o.prompt,
  ];
}

export interface OpenCodeToolUse {
  tool: string;
  status: string;
  error?: string;
  input?: unknown;
}

export interface OpenCodeRunResult {
  events: number;
  errors: string[];
  toolUses: OpenCodeToolUse[];
  /** Any sign the host denied a permission. */
  denied: boolean;
  unparsed: number;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parse `opencode run --format json` output (one JSON event per line; other lines ignored). */
export function parseOpenCodeOutput(out: string): OpenCodeRunResult {
  const r: OpenCodeRunResult = { events: 0, errors: [], toolUses: [], denied: false, unparsed: 0 };
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
    if (ev.type === 'error') {
      const e = ev.error;
      const msg = isObj(e) && isObj(e.data) && typeof e.data.message === 'string' ? e.data.message : JSON.stringify(e ?? ev).slice(0, 300);
      r.errors.push(msg);
    }
    if (ev.type === 'tool_use' && isObj(ev.part) && isObj(ev.part.state)) {
      const st = ev.part.state;
      const use: OpenCodeToolUse = { tool: String(ev.part.tool), status: String(st.status), input: st.input };
      if (typeof st.error === 'string') use.error = st.error;
      r.toolUses.push(use);
    }
  }
  r.denied = /denied|rejected|not allowed|permission/i.test(r.toolUses.map((u) => u.error ?? '').join('\n')) || /"denied"|permission (was )?denied/i.test(out);
  return r;
}
