/**
 * Scripted fake model for host conformance tests (generalises .tmp/planning-fix/poc/mock-model.js).
 *
 * Speaks Anthropic Messages (SSE and JSON; Claude Code) and OpenAI chat completions (SSE;
 * OpenCode's `@ai-sdk/openai-compatible` provider). It replays a host-neutral script turn by
 * turn (`read`→Read/read, `write`→Write/write, `edit`→Edit/edit, `shell`→Bash/shell,
 * `grep`→Grep/grep, `glob`→Glob/glob, `delegate`→Task/subagent). `say` and `done` are text
 * turns: a `say` followed by a tool turn is sent in the same assistant message, and a text
 * turn with nothing after it ends the session. Argument names come from the tool schema the
 * host sends, so host renames survive. A tool turn marked `if_offered` is skipped when the
 * host does not offer the tool; otherwise a missing tool ends the session as `tool_missing`.
 * Title-generator side requests are answered with plain text and never advance the script.
 *
 * Every request is recorded with: header NAMES only, the auth SHAPE (never the value), the tools
 * offered, the action taken, tool results seen, and which planted canaries the body or headers
 * contained. That record is the ground truth for "the secret never reached the model".
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export type ToolCall = 'read' | 'write' | 'edit' | 'shell' | 'grep' | 'glob' | 'delegate';
export type NeutralCall = ToolCall | 'say' | 'done';

export interface ScriptTurn {
  call: NeutralCall;
  /** read / write / edit: the file path; grep / glob: the search root (optional). */
  path?: string;
  /** write: the file body. */
  content?: string;
  /** edit: the text to replace and its replacement. */
  old?: string;
  new?: string;
  /** grep / glob: the pattern. */
  pattern?: string;
  /** shell: the command. */
  command?: string;
  /** delegate: the subagent id / type. */
  agent?: string;
  prompt?: string;
  /** say: the assistant text. */
  text?: string;
  /** Skip this tool turn (as passed) when the host does not offer the tool. */
  if_offered?: boolean;
}

export const TOOL_CALLS: ToolCall[] = ['read', 'write', 'edit', 'shell', 'grep', 'glob', 'delegate'];
export const isToolCall = (c: NeutralCall): c is ToolCall => (TOOL_CALLS as string[]).includes(c);

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
  /** Script indexes this response played (a say folded into a tool turn plays two). */
  steps: number[];
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

/**
 * Host tool names per verb. Claude Code 2.1.302 offers its delegate tool as `Agent` in requests
 * while system/init still lists `Task`; `HOST_ALIASES` covers such renames.
 */
export const HOST_ALIASES: Partial<Record<ToolCall, string[]>> = { delegate: ['Agent', 'Task'] };
export const NEUTRAL_TO_HOST: Record<ToolCall, { anthropic: string; openai: string }> = {
  read: { anthropic: 'Read', openai: 'read' },
  write: { anthropic: 'Write', openai: 'write' },
  edit: { anthropic: 'Edit', openai: 'edit' },
  shell: { anthropic: 'Bash', openai: 'shell' },
  grep: { anthropic: 'Grep', openai: 'grep' },
  glob: { anthropic: 'Glob', openai: 'glob' },
  delegate: { anthropic: 'Task', openai: 'subagent' },
};

/** Host tool name → neutral verb (both APIs). */
export function neutralName(tool: string): ToolCall | undefined {
  for (const [k, v] of Object.entries(NEUTRAL_TO_HOST)) if (v.anthropic === tool || v.openai === tool || HOST_ALIASES[k as ToolCall]?.includes(tool)) return k as ToolCall;
  return undefined;
}

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

const propsOf = (schema: unknown): Json => (isObj(schema) && isObj(schema.properties) ? schema.properties : {});

function argsFor(turn: ScriptTurn, schema: unknown): Json {
  const props = propsOf(schema);
  const key = (re: RegExp, fallback: string): string => pickArgKey(schema, re, fallback);
  switch (turn.call) {
    case 'read':
      return { [key(/path/i, 'file_path')]: turn.path ?? '' };
    case 'write':
      return { [key(/path/i, 'file_path')]: turn.path ?? '', [key(/content/i, 'content')]: turn.content ?? '' };
    case 'edit':
      return { [key(/path/i, 'file_path')]: turn.path ?? '', [key(/old/i, 'old_string')]: turn.old ?? '', [key(/new/i, 'new_string')]: turn.new ?? '' };
    case 'grep':
    case 'glob': {
      const out: Json = { [key(/pattern/i, 'pattern')]: turn.pattern ?? '' };
      if (turn.path !== undefined) out[key(/^path$|dir/i, 'path')] = turn.path;
      return out;
    }
    case 'shell': {
      const out: Json = { [key(/command/i, 'command')]: turn.command ?? '' };
      if ('description' in props) out.description = 'scripted';
      return out;
    }
    case 'delegate': {
      const out: Json = { description: 'scripted', prompt: turn.prompt ?? 'DELEGATED-TASK say done' };
      out['subagent_type' in props ? 'subagent_type' : 'agent'] = turn.agent ?? '';
      return out;
    }
    default:
      return {};
  }
}

/** One assistant message the mock will send: optional text, then optional tool call. */
export interface PlannedMessage {
  steps: number[];
  text?: string;
  tool?: { step: number; turn: ScriptTurn; name: string };
  /** A tool turn the host did not offer (not if_offered): the session ends here. */
  missing?: string;
}

/**
 * Group the script into assistant messages for a host that offers `offered` tools. Text turns
 * fold into the next tool turn; a trailing text turn (or `done`) ends the session.
 */
export function planMessages(script: ScriptTurn[], api: 'anthropic' | 'openai', offered: Set<string>): PlannedMessage[] {
  const out: PlannedMessage[] = [];
  let pending: { steps: number[]; text: string[] } = { steps: [], text: [] };
  for (let i = 0; i < script.length; i++) {
    const t = script[i] as ScriptTurn;
    if (!isToolCall(t.call)) {
      pending.steps.push(i);
      pending.text.push(t.call === 'say' ? t.text ?? '' : 'Done.');
      if (t.call === 'done') break;
      continue;
    }
    const names = [NEUTRAL_TO_HOST[t.call][api], ...(api === 'anthropic' ? HOST_ALIASES[t.call] ?? [] : [])];
    const name = names.find((n) => offered.has(n)) ?? names[0] ?? '';
    if (!offered.has(name)) {
      if (t.if_offered) continue;
      out.push({ steps: [...pending.steps, i], text: pending.text.join('\n') || undefined, missing: name });
      return out;
    }
    out.push({ steps: [...pending.steps, i], text: pending.text.join('\n') || undefined, tool: { step: i, turn: t, name } });
    pending = { steps: [], text: [] };
  }
  if (pending.steps.length) out.push({ steps: pending.steps, text: pending.text.join('\n') });
  return out;
}

function canaryHits(text: string, canaries: Record<string, string>): string[] {
  return Object.entries(canaries)
    .filter(([, v]) => v !== '' && text.includes(v))
    .map(([k]) => k);
}

/** A host stuck in a loop gets plain text after this many requests (and the run is flagged). */
export const LOOP_CAP = 300;

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
      steps: [],
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

    /**
     * Which planned message comes next. The mock names each tool call it issues `…_oac<k>`
     * (k = planned message index); the next message is one past the highest k in the history.
     * Counting assistant messages is not enough: Claude Code drops a rejected call from the
     * history it resends, which made the count stall and the session loop.
     */
    const nextIndex = (): number => {
      let k = -1;
      for (const m of raw.matchAll(/(?:toolu|call)_oac(\d+)/g)) k = Math.max(k, Number(m[1]));
      return k + 1;
    };
    const pick = (_calls: number, offered: Set<string>, which: 'anthropic' | 'openai'): PlannedMessage | undefined => {
      if (title || sub) return undefined;
      if (requests.length > LOOP_CAP) {
        rec.action = 'loop_cap';
        return undefined;
      }
      const m = planMessages(script, which, offered)[nextIndex()];
      if (m) {
        rec.steps = m.steps;
        rec.action = m.tool ? `tool_call:${m.tool.name}` : m.missing ? `tool_missing:${m.missing}` : 'text';
      }
      return m;
    };

    if (api === 'openai') {
      rec.system = messages
        .filter((m) => isObj(m) && m.role === 'system')
        .map((m) => (isObj(m) ? str(m.content) : ''))
        .join('\n')
        .slice(0, 200);
      const assistantCalls = messages.filter((m) => isObj(m) && m.role === 'assistant' && arr(m.tool_calls).length > 0).length;
      rec.toolResults = messages.filter((m) => isObj(m) && m.role === 'tool').map((m) => (isObj(m) ? str(m.content).slice(0, 400) : ''));
      rec.turn = assistantCalls;
      const m = pick(assistantCalls, new Set(rec.tools), 'openai');
      const tool = m?.tool ? tools.find((t) => isObj(t) && isObj(t.function) && t.function.name === m.tool?.name) : undefined;
      const base = { id: 'c1', object: 'chat.completion.chunk', created: 0, model: str(body.model) };
      const ch = (delta: Json, fr: string | null = null): string =>
        `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: fr }] })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      if (m?.tool && isObj(tool) && isObj(tool.function)) {
        const args = JSON.stringify(argsFor(m.tool.turn, tool.function.parameters));
        if (m.text) res.write(ch({ role: 'assistant', content: m.text }));
        res.write(ch({ ...(m.text ? {} : { role: 'assistant' }), tool_calls: [{ index: 0, id: `call_oac${nextIndex()}`, type: 'function', function: { name: m.tool.name, arguments: args } }] }));
        res.write(ch({}, 'tool_calls'));
      } else {
        res.write(ch({ role: 'assistant', content: m?.text || 'Done.' }));
        res.write(ch({}, 'stop'));
      }
      res.end('data: [DONE]\n\n');
      return;
    }

    // Anthropic Messages
    rec.system = str(body.system).slice(0, 200);
    let assistantCalls = 0;
    for (const msg of messages) {
      if (!isObj(msg)) continue;
      const blocks = arr(msg.content).filter(isObj);
      if (msg.role === 'assistant' && blocks.some((b) => b.type === 'tool_use')) assistantCalls++;
      if (msg.role === 'user') for (const b of blocks) if (b.type === 'tool_result') rec.toolResults.push(str(b.content).slice(0, 400));
    }
    rec.turn = assistantCalls;
    const m = pick(assistantCalls, new Set(rec.tools), 'anthropic');
    const tool = m?.tool ? tools.find((t) => isObj(t) && t.name === m.tool?.name) : undefined;
    const act = m?.tool !== undefined && isObj(tool);
    const input = act && m?.tool && isObj(tool) ? argsFor(m.tool.turn, tool.input_schema) : {};
    const id = `toolu_oac${nextIndex()}`;
    const stop = act ? 'tool_use' : 'end_turn';
    const text = act ? m?.text : m?.text || 'Done.';
    const blocks: { start: Json; delta?: Json; full: Json }[] = [];
    if (text) blocks.push({ start: { type: 'text', text: '' }, delta: { type: 'text_delta', text }, full: { type: 'text', text } });
    if (act) blocks.push({ start: { type: 'tool_use', id, name: m?.tool?.name, input: {} }, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) }, full: { type: 'tool_use', id, name: m?.tool?.name, input } });
    const message = { id: 'msg_1', type: 'message', role: 'assistant', model: str(body.model), content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } };
    if (body.stream !== true) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...message, content: blocks.map((b) => b.full), stop_reason: stop }));
      return;
    }
    const ev = (n: string, d: Json): string => `event: ${n}\ndata: ${JSON.stringify(d)}\n\n`;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write(ev('message_start', { type: 'message_start', message }));
    blocks.forEach((b, index) => {
      res.write(ev('content_block_start', { type: 'content_block_start', index, content_block: b.start }));
      res.write(ev('content_block_delta', { type: 'content_block_delta', index, delta: b.delta }));
      res.write(ev('content_block_stop', { type: 'content_block_stop', index }));
    });
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
