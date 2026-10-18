/**
 * Scripted fake model for host conformance tests (generalises .tmp/planning-fix/poc/mock-model.js).
 *
 * Speaks Anthropic Messages (SSE and JSON; Claude Code) and OpenAI chat completions (SSE;
 * OpenCode's `@ai-sdk/openai-compatible` provider). It replays a host-neutral script turn by
 * turn: `read` maps to Read/read, `shell` to Bash/shell, `delegate` to Task/subagent.
 * Title-generator side requests are answered with plain text and never advance the script.
 *
 * Every request is recorded with: header NAMES only, the auth SHAPE (never the value), the tools
 * offered, the action taken, tool results seen, and which planted canaries the body or headers
 * contained. That record is the ground truth for "the secret never reached the model".
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type NeutralCall = 'read' | 'shell' | 'delegate';

export interface ScriptTurn {
  call: NeutralCall;
  /** read: the file path. */
  path?: string;
  /** shell: the command. */
  command?: string;
  /** delegate: the subagent id / type. */
  agent?: string;
  prompt?: string;
}

export interface FakeModelOptions {
  /** 0 = pick a free port. */
  port?: number;
  script?: ScriptTurn[];
  /** Named canaries; any hit in a request is recorded (by name). */
  canaries?: Record<string, string>;
  /** The run's dummy keys. Any other credential is an auth-shape violation. */
  expectedAuth?: { anthropicKey?: string; openaiKey?: string };
  /**
   * Requests whose first user message contains this marker belong to a delegated sub-session:
   * they get a plain "Done." and never replay the script (else a delegate turn would recurse).
   */
  subSessionMarker?: string;
}

export type AuthShape = 'dummy' | 'absent' | 'unexpected';

export interface RequestRecord {
  t: number;
  api: 'anthropic' | 'openai' | 'other';
  url: string;
  headerNames: string[];
  auth: { header: string; shape: AuthShape; hint?: string }[];
  tools: string[];
  title: boolean;
  /** A delegated sub-session request (see FakeModelOptions.subSessionMarker). */
  sub: boolean;
  turn: number;
  action: string;
  toolResults: string[];
  canaryHits: string[];
  /** Short marker excerpts of the system prompt (first 200 chars). */
  system: string;
}

export interface FakeModel {
  url: string;
  port: number;
  requests: RequestRecord[];
  setScript: (script: ScriptTurn[]) => void;
  reset: () => void;
  stop: () => Promise<void>;
}

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : v === undefined ? '' : JSON.stringify(v));

const NEUTRAL_TO_HOST: Record<NeutralCall, { anthropic: string; openai: string }> = {
  read: { anthropic: 'Read', openai: 'read' },
  shell: { anthropic: 'Bash', openai: 'shell' },
  delegate: { anthropic: 'Task', openai: 'subagent' },
};

/** Describe a credential without ever recording it. */
export function authShape(value: string | undefined, expected: string | undefined): { shape: AuthShape; hint?: string } {
  if (value === undefined || value === '') return { shape: 'absent' };
  const v = value.replace(/^Bearer\s+/i, '');
  if (expected !== undefined && v === expected) return { shape: 'dummy' };
  const prefix = /^(sk-ant-[a-z]{3}|sk-[a-z]{2,4}|oc-|ey|gh[pousr]_)/i.exec(v)?.[0] ?? '?';
  return { shape: 'unexpected', hint: `${prefix}… (${v.length} chars)` };
}

function titleRequest(raw: string): boolean {
  return /title generator|generate a (short )?title/i.test(raw);
}

function pickArgKey(schema: unknown, re: RegExp, fallback: string): string {
  const props = isObj(schema) && isObj(schema.properties) ? Object.keys(schema.properties) : [];
  return props.find((k) => re.test(k)) ?? fallback;
}

function argsFor(turn: ScriptTurn, schema: unknown): Json {
  switch (turn.call) {
    case 'read':
      return { [pickArgKey(schema, /path/i, 'file_path')]: turn.path ?? '' };
    case 'shell': {
      const out: Json = { [pickArgKey(schema, /command/i, 'command')]: turn.command ?? '' };
      const props = isObj(schema) && isObj(schema.properties) ? schema.properties : {};
      if ('description' in props) out.description = 'scripted';
      return out;
    }
    case 'delegate': {
      const props = isObj(schema) && isObj(schema.properties) ? schema.properties : {};
      const out: Json = { description: 'scripted', prompt: turn.prompt ?? 'DELEGATED-TASK say done' };
      out['subagent_type' in props ? 'subagent_type' : 'agent'] = turn.agent ?? '';
      return out;
    }
  }
}

function canaryHits(text: string, canaries: Record<string, string>): string[] {
  return Object.entries(canaries)
    .filter(([, v]) => v !== '' && text.includes(v))
    .map(([k]) => k);
}

export async function startFakeModel(opts: FakeModelOptions = {}): Promise<FakeModel> {
  let script = opts.script ?? [];
  const canaries = opts.canaries ?? {};
  const requests: RequestRecord[] = [];

  const handle = (req: IncomingMessage, res: ServerResponse, raw: string): void => {
    let body: Json = {};
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (isObj(parsed)) body = parsed;
    } catch {
      /* non-JSON body: recorded as-is */
    }
    const url = req.url ?? '';
    const headerText = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(',') : v ?? ''}`)
      .join('\n');
    const api: RequestRecord['api'] = url.includes('/chat/completions') ? 'openai' : url.includes('/messages') ? 'anthropic' : 'other';
    const expected = api === 'openai' ? opts.expectedAuth?.openaiKey : opts.expectedAuth?.anthropicKey;
    const auth = (['x-api-key', 'authorization'] as const).map((h) => {
      const v = req.headers[h];
      return { header: h, ...authShape(Array.isArray(v) ? v[0] : v, expected) };
    });
    const messages = arr(body.messages);
    const tools = arr(body.tools);
    const title = titleRequest(raw);
    const firstUser = messages.find((m) => isObj(m) && m.role === 'user');
    const sub = opts.subSessionMarker !== undefined && isObj(firstUser) && str(firstUser.content).includes(opts.subSessionMarker);
    const rec: RequestRecord = {
      t: Date.now(),
      api,
      url,
      headerNames: Object.keys(req.headers).sort(),
      auth,
      tools: tools.map((t) => (isObj(t) ? (isObj(t.function) ? str(t.function.name) : str(t.name)) : '')),
      title,
      sub,
      turn: 0,
      action: 'text',
      toolResults: [],
      canaryHits: canaryHits(raw + '\n' + headerText, canaries),
      system: '',
    };
    requests.push(rec);

    if (url.includes('count_tokens')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ input_tokens: 10 }));
      return;
    }
    if (api === 'other') {
      rec.action = 'unhandled';
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'not_found', message: `fake model: unhandled ${url}` } }));
      return;
    }

    if (api === 'openai') {
      rec.system = messages
        .filter((m) => isObj(m) && m.role === 'system')
        .map((m) => (isObj(m) ? str(m.content) : ''))
        .join('\n')
        .slice(0, 200);
      const assistantCalls = messages.filter((m) => isObj(m) && m.role === 'assistant' && arr(m.tool_calls).length > 0).length;
      rec.toolResults = messages.filter((m) => isObj(m) && m.role === 'tool').map((m) => (isObj(m) ? str(m.content).slice(0, 400) : ''));
      rec.turn = assistantCalls;
      const step = title || sub ? undefined : script[assistantCalls];
      const toolName = step ? NEUTRAL_TO_HOST[step.call].openai : undefined;
      const tool = tools.find((t) => isObj(t) && isObj(t.function) && t.function.name === toolName);
      const base = { id: 'c1', object: 'chat.completion.chunk', created: 0, model: str(body.model) };
      const ch = (delta: Json, fr: string | null = null): string =>
        `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: fr }] })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      if (step && isObj(tool) && isObj(tool.function)) {
        const args = JSON.stringify(argsFor(step, tool.function.parameters));
        rec.action = `tool_call:${str(toolName)}`;
        res.write(ch({ role: 'assistant', tool_calls: [{ index: 0, id: `call_${assistantCalls + 1}`, type: 'function', function: { name: toolName, arguments: args } }] }));
        res.write(ch({}, 'tool_calls'));
      } else {
        if (step) rec.action = `tool_missing:${str(toolName)}`;
        res.write(ch({ role: 'assistant', content: 'Done.' }));
        res.write(ch({}, 'stop'));
      }
      res.end('data: [DONE]\n\n');
      return;
    }

    // Anthropic Messages
    rec.system = str(body.system).slice(0, 200);
    let assistantCalls = 0;
    for (const m of messages) {
      if (!isObj(m)) continue;
      const blocks = arr(m.content).filter(isObj);
      if (m.role === 'assistant' && blocks.some((b) => b.type === 'tool_use')) assistantCalls++;
      if (m.role === 'user') for (const b of blocks) if (b.type === 'tool_result') rec.toolResults.push(str(b.content).slice(0, 400));
    }
    rec.turn = assistantCalls;
    const step = title || sub ? undefined : script[assistantCalls];
    const toolName = step ? NEUTRAL_TO_HOST[step.call].anthropic : undefined;
    const tool = tools.find((t) => isObj(t) && t.name === toolName);
    const act = step !== undefined && isObj(tool);
    if (step && !act) rec.action = `tool_missing:${str(toolName)}`;
    const input = act && isObj(tool) ? argsFor(step, tool.input_schema) : {};
    if (act) rec.action = `tool_call:${str(toolName)}`;
    const id = `toolu_${assistantCalls + 1}`;
    const stop = act ? 'tool_use' : 'end_turn';
    const message = { id: 'msg_1', type: 'message', role: 'assistant', model: str(body.model), content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } };
    if (body.stream !== true) {
      const content = act ? [{ type: 'tool_use', id, name: toolName, input }] : [{ type: 'text', text: 'Done.' }];
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...message, content, stop_reason: stop }));
      return;
    }
    const ev = (n: string, d: Json): string => `event: ${n}\ndata: ${JSON.stringify(d)}\n\n`;
    const block = act ? { type: 'tool_use', id, name: toolName, input: {} } : { type: 'text', text: '' };
    const delta = act ? { type: 'input_json_delta', partial_json: JSON.stringify(input) } : { type: 'text_delta', text: 'Done.' };
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write(ev('message_start', { type: 'message_start', message }));
    res.write(ev('content_block_start', { type: 'content_block_start', index: 0, content_block: block }));
    res.write(ev('content_block_delta', { type: 'content_block_delta', index: 0, delta }));
    res.write(ev('content_block_stop', { type: 'content_block_stop', index: 0 }));
    res.write(ev('message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 5 } }));
    res.end(ev('message_stop', { type: 'message_stop' }));
  };

  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => handle(req, res, raw));
  });
  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    requests,
    setScript: (s: ScriptTurn[]): void => {
      script = s;
    },
    reset: (): void => {
      requests.length = 0;
    },
    stop: (): Promise<void> => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Requests that count as real turns (not title/side requests). */
export function modelTurns(reqs: RequestRecord[]): RequestRecord[] {
  return reqs.filter((r) => !r.title && r.api !== 'other' && !r.url.includes('count_tokens'));
}
