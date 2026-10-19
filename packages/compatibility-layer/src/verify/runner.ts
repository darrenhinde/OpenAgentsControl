/**
 * Scenario runner, host-independent half: decide whether a scenario can run on a host, expand
 * its matrix, substitute placeholders, flatten turn controls, and describe the arms to run.
 * Spawning hosts is the caller's job (the local suite runs every arm under its sandbox).
 *
 * Arms (RUNNER-NEEDS §8):
 *   guarded  OAC on (`guard`), asks per `asks` (default reject). Graded.
 *   control  attacks: OAC off and asks approved. Must FAIL the checks its `control` names.
 *   fp       benign rows with `fp_arm`: an over-broad guard. Must be blocked.
 *   approve  attacks whose guarded arm saw an ask: same guard, asks approved. Reported only.
 */
import { isToolCall, type ScriptTurn } from './fake-model/server.js';
import type { Observed, Scenario, ScriptItem } from './scenario-schema.js';

export type Host = 'claude-code' | 'opencode-v2' | 'codex';
export type Guard = 'poc-secrets' | 'shipped' | 'none' | 'broad';
export type ArmKind = 'guarded' | 'control' | 'fp' | 'approve';

export const SUPPORTED = {
  verbs: ['read', 'write', 'edit', 'shell', 'grep', 'glob', 'delegate', 'say', 'done'],
  setup: ['write', 'symlink', 'sentinel', 'outside', 'failing_test', 'approve', 'git'],
  outcomes: [
    'canary_never_reaches_model', 'marker_reaches_model', 'decision_logged', 'no_decision_logged', 'host_deny_signal', 'host_event',
    'tool_result_contains', 'tool_result_not_contains', 'file_absent', 'file_present', 'file_contains', 'file_unchanged',
    'outside_tree_unchanged', 'sentinel_intact', 'tree_unchanged_outside', 'git_head_unchanged', 'subagent_completed',
    'auth_shape_dummy_only', 'asks_count',
  ],
  turnChecks: ['tools_offered_superset_of', 'tools_offered_disjoint_from', 'ignore_requests'],
  fixtures: ['ts-single', 'oac-tree'],
  controls: ['leaks', 'lands', 'runs', 'config rewritten', 'none'],
};

export const outcomeKind = (o: string | Record<string, unknown>): string => (typeof o === 'string' ? o : Object.keys(o)[0] ?? '');

/** Why this scenario can't run on this host through the runner, or undefined if it can. */
export function unsupportedReason(s: Scenario, host: Host): string | undefined {
  if (host === 'codex') return 'Codex host lands in v1.5';
  if (!s.hosts.includes(host)) return `not a ${host} scenario`;
  if (s.implemented_by?.[host]) return `graded by ${s.implemented_by[host]}`;
  if (s.unsupported) return s.unsupported;
  if (s.runner !== 'host') return `runner: ${s.runner} is not implemented yet`;
  if (!SUPPORTED.fixtures.includes(s.fixture)) return `fixture ${s.fixture} not built yet`;
  const lv = s.levels?.[host];
  if ((typeof lv === 'string' ? lv : lv?.level) === 'unsupported') return `level unsupported on ${host}`;
  const items = [...(s.script ?? []), ...Object.values(s.subagents ?? {}).flat()];
  for (const t of items) {
    if (t.parallel) return 'turn control `parallel` not implemented yet';
    if (t.runner) return 'out-of-band `runner:` turns not implemented yet';
    if (t.call && !SUPPORTED.verbs.includes(t.call)) return `verb \`${t.call}\` not implemented yet`;
    for (const k of Object.keys(t.check ?? {})) if (!SUPPORTED.turnChecks.includes(k)) return `turn check \`${k}\` not implemented yet`;
  }
  for (const op of s.setup ?? []) {
    const k = Object.keys(op)[0] ?? '';
    if (!SUPPORTED.setup.includes(k)) return `setup op \`${k}\` not implemented yet`;
  }
  for (const o of s.outcome) if (!SUPPORTED.outcomes.includes(outcomeKind(o))) return `outcome \`${outcomeKind(o)}\` not implemented yet`;
  if (s.fp_arm && !('expect' in s.fp_arm && s.fp_arm.expect === 'blocked')) return 'fp_arm with an expectation other than `blocked` not implemented yet';
  if (s.negative_arm) return '`negative_arm` not implemented yet';
  for (const t of controlTokens(s)) if (!SUPPORTED.controls.includes(t)) return `control \`${t}\` not implemented yet`;
  return undefined;
}

/** The control expectation as tokens: "config rewritten; leaks" → ["config rewritten", "leaks"]. */
export function controlTokens(s: Scenario): string[] {
  const c = s.control;
  if (c === undefined) return s.kind === 'attack' ? ['leaks'] : ['none'];
  const v = typeof c === 'string' ? c : String(c.expect ?? '');
  return v.split(';').map((x) => x.trim()).filter(Boolean);
}

/** The expected observation for the guarded arm (levels[host] → when_<level>), if any. */
export function expectedObservation(s: Scenario, host: Host): Observed | undefined {
  const lv = s.levels?.[host];
  const level = (typeof lv === 'string' ? lv : lv?.level) ?? 'enforced';
  if (level === 'nudge') return s.when_nudge;
  if (level === 'enforced') return s.when_enforced ?? (s.kind === 'benign' ? 'allowed' : undefined);
  return undefined;
}

/** One expanded matrix variant: its label and the variables it binds. */
export interface Variant {
  label: string;
  vars: Record<string, unknown>;
}

/** Matrix values may carry `hosts: [...]` to restrict them; one variant when there is no matrix. */
export function variants(s: Scenario, host: Host): Variant[] {
  const m = s.matrix;
  if (!m || !Object.keys(m).length) return [{ label: '', vars: {} }];
  const [name, values] = Object.entries(m)[0] as [string, unknown[]];
  return values
    .filter((v) => !(typeof v === 'object' && v !== null && Array.isArray((v as { hosts?: unknown }).hosts) && !((v as { hosts: string[] }).hosts.includes(host))))
    .map((v) => ({
      label: typeof v === 'object' && v !== null ? String((v as Record<string, unknown>).path ?? JSON.stringify(v)) : String(v),
      vars: { [name]: v },
    }));
}

/** `${a}` / `${a.b}` placeholders, deep. Unknown names are left as-is (and reported by the caller). */
export function substitute<T>(value: T, vars: Record<string, unknown>): T {
  const get = (path: string): unknown => path.split('.').reduce<unknown>((o, k) => (typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[k] : undefined), vars);
  const one = (s: string): unknown => {
    const whole = /^\$\{([A-Za-z0-9_.-]+)\}$/.exec(s);
    if (whole) {
      const v = get(whole[1] ?? '');
      if (v !== undefined) return v;
    }
    return s.replace(/\$\{([A-Za-z0-9_.-]+)\}/g, (m, p: string) => {
      const v = get(p);
      return v === undefined ? m : typeof v === 'string' ? v : JSON.stringify(v);
    });
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return one(v);
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object' && v !== null) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** Placeholders still unresolved anywhere in `v`. */
export function unresolved(v: unknown): string[] {
  const s = JSON.stringify(v) ?? '';
  return [...new Set([...s.matchAll(/\$\{([A-Za-z0-9_.-]+)\}/g)].map((m) => m[1] ?? ''))];
}

export interface PlannedTurn extends ScriptTurn {
  check?: Record<string, unknown>;
}

/**
 * Flatten the script for one host: per-host values (`agent: {host: x}`), `repeat` (with `${i}`),
 * and `include: <matrix field>` (a `{how: write|shell, ...}` target becomes that call; a write to
 * a file that already exists is preceded by a read, because Claude Code refuses to overwrite a
 * file it hasn't read).
 */
export function flattenScript(items: ScriptItem[], host: Host, exists: (path: string) => boolean): PlannedTurn[] {
  const out: PlannedTurn[] = [];
  const perHost = (v: unknown): unknown => (typeof v === 'object' && v !== null && !Array.isArray(v) && host in (v) ? (v as Record<string, unknown>)[host] : v);
  const push = (t: Record<string, unknown>): void => {
    const turn = Object.fromEntries(Object.entries(t).filter(([k]) => k !== 'repeat').map(([k, v]) => [k, k === 'check' ? v : perHost(v)])) as unknown as PlannedTurn;
    out.push(turn);
  };
  for (const raw of items) {
    const t = raw as Record<string, unknown>;
    if (typeof t.include === 'object' && t.include !== null) {
      const target = t.include as Record<string, unknown>;
      const path = String(target.path ?? '');
      if (target.how === 'shell') push({ call: 'shell', command: target.command });
      else {
        if (exists(path)) push({ call: 'read', path });
        push({ call: 'write', path, content: target.content ?? '' });
      }
      continue;
    }
    const n = typeof t.repeat === 'number' ? t.repeat : 1;
    for (let i = 1; i <= n; i++) push(n > 1 ? substitute(t, { i: String(i) }) : t);
  }
  return out;
}

/** Tool turns only, in order: the i-th host tool call answers the i-th of these (if offered). */
export const toolTurns = (turns: PlannedTurn[]): { index: number; turn: PlannedTurn }[] =>
  turns.map((turn, index) => ({ index, turn })).filter((x) => isToolCall(x.turn.call));

/** Strings the mock should watch for in every request (beyond the canaries). */
export function watchedMarkers(s: Scenario, vars: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of s.outcome) {
    if (outcomeKind(o) !== 'marker_reaches_model') continue;
    const v = typeof o === 'string' ? '${MARKER}' : String((o).marker_reaches_model ?? '${MARKER}');
    out[`marker:${v}`] = String(substitute(v, vars));
  }
  return out;
}

/**
 * `include: "${target.how}"` names the matrix value's `how`, but the call needs the whole value
 * (path, content, command). Rewrite it to `include: "${target}"` before substitution.
 */
export function normalizeIncludes(items: ScriptItem[]): ScriptItem[] {
  return items.map((t) => (typeof t.include === 'string' ? { ...t, include: t.include.replace(/^\$\{([A-Za-z0-9_-]+)\.how\}$/, '${$1}') } : t));
}
