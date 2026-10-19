/**
 * Scenario file schema (`<area>/<name>.scenario.yaml`), following 05 §2.1 as extended by the
 * scenario catalogue (RUNNER-NEEDS §1). Validation is deliberately permissive about fields the
 * runner does not read yet (`.passthrough()`): a seed may describe more than the runner can
 * check, and the runner reports what it can't support instead of rejecting the file.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';

const Str = z.string();
const PerHost = <T extends z.ZodTypeAny>(t: T): z.ZodUnion<[T, z.ZodRecord<z.ZodString, T>]> => z.union([t, z.record(Str, t)]);

/** A fake-model turn (§2) or a turn control (§3). Exactly one of call / parallel / include. */
export const ScriptItem = z
  .object({
    call: z.enum(['read', 'write', 'edit', 'shell', 'grep', 'glob', 'delegate', 'say', 'done', 'skill', 'question', 'plan_exit', 'webfetch']).optional(),
    path: Str.optional(),
    content: Str.optional(),
    old: Str.optional(),
    new: Str.optional(),
    pattern: Str.optional(),
    command: Str.optional(),
    agent: PerHost(Str).optional(),
    prompt: Str.optional(),
    text: Str.optional(),
    if_offered: z.boolean().optional(),
    repeat: z.number().int().positive().optional(),
    parallel: z.array(z.record(Str, z.unknown())).optional(),
    include: Str.optional(),
    runner: Str.optional(),
    check: z.record(Str, z.unknown()).optional(),
  })
  .passthrough()
  .refine((t) => [t.call, t.parallel, t.include, t.runner].filter((x) => x !== undefined).length === 1, {
    message: 'a script item needs exactly one of call / parallel / include / runner',
  });
export type ScriptItem = z.infer<typeof ScriptItem>;

export const Level = z.enum(['enforced', 'nudge', 'partial', 'unsupported']);
export const Observed = z.enum(['blocked', 'asked', 'nudged', 'allowed']);
export type Observed = z.infer<typeof Observed>;

export const TodayRow = z
  .object({
    status: z.enum(['pass', 'known-red', 'unknown']),
    ref: Str.optional(),
    ev: Str.optional(),
    note: Str.optional(),
  })
  .passthrough();

export const Scenario = z
  .object({
    id: Str.regex(/^[a-z0-9-]+\/[a-z0-9.-]+$/),
    title: Str,
    area: Str,
    kind: z.enum(['attack', 'benign', 'capability', 'regression']),
    layer: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']),
    release: Str,
    runner: z.enum(['host', 'cli', 'static']),
    hosts: z.array(z.enum(['claude-code', 'opencode-v2', 'codex'])).min(1),
    fixture: Str,
    gate: z.union([Str, z.array(Str)]).optional(),
    profile: z.enum(['solo', 'team']).optional(),
    policy: z.record(Str, z.unknown()).optional(),
    agent: z.record(Str, z.union([Str, z.record(Str, z.unknown())])).optional(),
    asks: z.enum(['reject', 'approve']).optional(),
    setup: z.array(z.record(Str, z.unknown())).optional(),
    matrix: z.record(Str, z.array(z.unknown())).optional(),
    script: z.array(ScriptItem).optional(),
    subagents: z.record(Str, z.array(ScriptItem)).optional(),
    steps: z.array(z.record(Str, z.unknown())).optional(),
    levels: z.record(Str, z.union([Level, z.object({ level: Level, verified: z.boolean().optional(), note: Str.optional() }).passthrough()])).optional(),
    when_enforced: Observed.optional(),
    when_nudge: Observed.optional(),
    /** Per tool call, in order: what each call must show (`any` = not graded). */
    expect_steps: z.array(z.union([Observed, z.literal('any')])).optional(),
    expect_override: z.record(Str, z.unknown()).optional(),
    outcome: z.array(z.union([Str, z.record(Str, z.unknown())])).min(1),
    control: z.union([Str, z.record(Str, z.unknown())]).optional(),
    fp_arm: z.record(Str, z.unknown()).optional(),
    negative_arm: z.record(Str, z.unknown()).optional(),
    today: z.record(Str, TodayRow),
    // Runner bridge fields (new in plan step 6, not in 05 §2.1):
    /** Row ID base in the local suite, e.g. scn/secrets-read-env → scn/secrets-read-env@<host>. */
    check_id: Str.regex(/^[a-z0-9-]+\/[a-z0-9.-]+$/).optional(),
    /** What "OAC on" means for this row today: the poc secrets guard, the shipped tree, or nothing. */
    guard: z.enum(['poc-secrets', 'shipped', 'none']).optional(),
    /** Graded by an existing hard-coded check instead of the runner: host → check id. */
    implemented_by: z.record(Str, Str).optional(),
    /** The runner can't run this yet: why. */
    unsupported: Str.optional(),
  })
  .passthrough();
export type Scenario = z.infer<typeof Scenario>;

export interface ScenarioFile {
  file: string;
  scenario: Scenario;
}

/** Every `*.scenario.yaml` under `dir`, parsed and validated. Throws with all problems at once. */
export function loadScenarios(dir: string): ScenarioFile[] {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.scenario.yaml')) files.push(p);
    }
  };
  walk(dir);
  const out: ScenarioFile[] = [];
  const problems: string[] = [];
  for (const f of files.sort()) {
    const rel = relative(dir, f);
    const r = Scenario.safeParse(yaml.load(readFileSync(f, 'utf8')));
    if (!r.success) {
      problems.push(`${rel}: ${r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
      continue;
    }
    const want = `${r.data.id.split('/')[1] ?? ''}.scenario.yaml`;
    if (!rel.endsWith(want)) problems.push(`${rel}: file name should be ${want} (id ${r.data.id})`);
    out.push({ file: rel, scenario: r.data });
  }
  if (problems.length) throw new Error(`invalid scenario files:\n  ${problems.join('\n  ')}`);
  return out;
}
