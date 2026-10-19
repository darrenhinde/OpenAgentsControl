/**
 * Static lints over emitted OpenCode trees (v1 and v2). Pure: text in, findings out.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────────────────
 *
 * The v2-pinned host harness (evals/v2) can boot a v2 tree on a real binary but cannot load a v1
 * tree. `lintV1Agents` and `lintV1Artifacts` are therefore the always-on, deterministic check
 * that the v1 tree is what v1 loads — the inverse of evals/v2's `no-v1-artifacts` lint. They
 * read the rules from the OpenCode v1 source (config.ts:311-343 for ids, 635-652 for known keys,
 * tool/task.ts:44-58 and util/wildcard.ts for case-sensitive delegation). They prove
 * self-consistency, not that a real v1 binary accepts the files; that needs a host run.
 */

import {
  OPENCODE_KNOWN_KEYS,
  parseFrontmatter,
  splitFrontmatter,
} from "../../adapters/opencode/surgery.js";
import { isGlob } from "../../core/AgentIdResolver.js";

export interface LintFile {
  /** Repo-relative or tree-relative POSIX path. */
  path: string;
  text: string;
}

export interface LintFinding {
  path: string;
  rule: string;
  message: string;
}

interface Parsed {
  file: LintFile;
  data: Record<string, unknown>;
  body: string;
}

/** A value that is a template placeholder (`[agent-name]`), not a reference. */
const PLACEHOLDER = /[[\]<>{}$]/;
const SUBAGENT_TYPE = /\bsubagent_type\s*[=:]\s*(["'])([^"'\n]*)\1/g;
const AGENT_VALUE = /(?<![\w])agent\s*=\s*(["'])([^"'\n]*)\1/g;

function parse(file: LintFile, findings: LintFinding[]): Parsed | undefined {
  try {
    const { frontmatter, rest } = splitFrontmatter(file.text);
    return { file, data: parseFrontmatter(frontmatter), body: rest };
  } catch (cause) {
    findings.push({
      path: file.path,
      rule: "frontmatter-invalid",
      message: cause instanceof Error ? cause.message : String(cause),
    });
    return undefined;
  }
}

function taskKeys(data: Record<string, unknown>): string[] {
  const permission = data["permission"];
  if (typeof permission !== "object" || permission === null) return [];
  const task = (permission as Record<string, unknown>)["task"];
  return typeof task === "object" && task !== null ? Object.keys(task) : [];
}

/** #349: the last rule for an action is a catch-all deny after allows, so the tool is hidden. */
function trailingDenyActions(data: Record<string, unknown>): string[] {
  const permission = data["permission"];
  if (typeof permission !== "object" || permission === null) return [];
  const hidden: string[] = [];
  for (const [action, rules] of Object.entries(permission as Record<string, unknown>)) {
    if (typeof rules !== "object" || rules === null) continue;
    const entries = Object.entries(rules as Record<string, unknown>);
    const last = entries[entries.length - 1];
    if (last === undefined || last[0] !== "*" || last[1] !== "deny") continue;
    if (entries.slice(0, -1).some(([, v]) => v === "allow")) hidden.push(action);
  }
  return hidden;
}

function values(re: RegExp, text: string): string[] {
  return [...text.matchAll(re)].map((m) => m[2]!).filter((v) => !PLACEHOLDER.test(v));
}

// ============================================================================
// v1
// ============================================================================

/** Lint v1 agent files: ids, delegation, schema keys, and no v2 vocabulary. */
export function lintV1Agents(files: readonly LintFile[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const parsed = files.map((file) => parse(file, findings)).filter((p): p is Parsed => p !== undefined);

  const names = new Map<string, Parsed[]>();
  for (const p of parsed) {
    const name = p.data["name"];
    if (typeof name !== "string" || name === "") {
      findings.push({ path: p.file.path, rule: "name-missing", message: "v1 registers an agent under `name:`; without it the id is the path" });
      continue;
    }
    names.set(name, [...(names.get(name) ?? []), p]);
  }
  for (const [name, owners] of names) {
    if (owners.length > 1) {
      for (const o of owners) findings.push({ path: o.file.path, rule: "name-duplicate", message: `name "${name}" is used by ${owners.length} agents` });
    }
  }

  for (const p of parsed) {
    const { path } = p.file;
    if (p.data["mode"] === undefined) {
      findings.push({ path, rule: "mode-missing", message: "mode defaults to `all` on v1 and `primary` on v2; set it explicitly" });
    }
    for (const key of Object.keys(p.data)) {
      if (!OPENCODE_KNOWN_KEYS.has(key)) findings.push({ path, rule: "unknown-key", message: `frontmatter key "${key}" is outside the v1 Agent schema` });
    }
    for (const key of taskKeys(p.data)) {
      if (!isGlob(key) && !names.has(key)) {
        findings.push({ path, rule: "task-key-unknown", message: `permission.task key "${key}" matches no agent name exactly (v1 matching is case-sensitive)` });
      }
    }
    for (const value of values(SUBAGENT_TYPE, p.body)) {
      if (!names.has(value)) findings.push({ path, rule: "subagent-type-unknown", message: `subagent_type "${value}" matches no agent name` });
    }
    if (/(?<![\w.$])subagent\(/.test(p.body)) {
      findings.push({ path, rule: "v2-vocabulary", message: "`subagent(` is the v2 delegation tool; v1 calls `task(`" });
    }
    for (const action of trailingDenyActions(p.data)) {
      findings.push({ path, rule: "trailing-deny-hides-tool", message: `${action}: a trailing catch-all deny after allows hides the tool` });
    }
  }
  return findings;
}

/** Lint v1 tool modules and plugins: they must be written against the v1 plugin API. */
export function lintV1Artifacts(files: readonly LintFile[]): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const file of files) {
    if (!/\.(ts|js|mjs)$/.test(file.path) || /\.d\.ts$/.test(file.path)) continue;
    if (/(^|\/)(tests?|__tests__)\//.test(file.path)) continue;
    if (/from\s+["']@opencode\/plugin["']/.test(file.text) || /Plugin\.define\(/.test(file.text)) {
      findings.push({ path: file.path, rule: "v2-plugin-api", message: "this uses the v2 plugin API; it does not run on v1" });
    } else if (!/["']@opencode-ai\/plugin["']/.test(file.text)) {
      findings.push({ path: file.path, rule: "no-plugin-import", message: "a v1 tool or plugin module imports @opencode-ai/plugin" });
    }
  }
  return findings;
}

// ============================================================================
// v2
// ============================================================================

/** Lint v2 agent files: flat ids, no `name:`, id references only, no v1 vocabulary. */
export function lintV2Agents(files: readonly LintFile[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const parsed = files.map((file) => parse(file, findings)).filter((p): p is Parsed => p !== undefined);
  const idOf = (path: string): string => path.replace(/^.*\/agents?\//, "").replace(/\.md$/, "");
  const ids = new Set(parsed.map((p) => idOf(p.file.path)));

  for (const p of parsed) {
    const { path } = p.file;
    if (idOf(path).includes("/")) findings.push({ path, rule: "nested-path", message: "v2 derives the id from the path, so a nested file gets a directory-prefixed id" });
    if ("name" in p.data) findings.push({ path, rule: "name-key", message: "v2 ignores `name:`; the file name is the id" });
    if (p.data["mode"] === undefined) findings.push({ path, rule: "mode-missing", message: "set mode explicitly" });
    for (const key of taskKeys(p.data)) {
      if (!isGlob(key) && !ids.has(key)) findings.push({ path, rule: "task-key-unknown", message: `permission.task key "${key}" is not an emitted agent id` });
    }
    for (const value of values(AGENT_VALUE, p.body)) {
      if (!ids.has(value)) findings.push({ path, rule: "agent-value-unknown", message: `agent="${value}" is not an emitted agent id` });
    }
    if (/\bsubagent_type\b/.test(p.body)) findings.push({ path, rule: "v1-vocabulary", message: "`subagent_type` is the v1 parameter; v2 uses `agent`" });
    if (/(?<![\w.$])task\(/.test(p.body)) findings.push({ path, rule: "v1-vocabulary", message: "`task(` is the v1 tool; v2 calls `subagent(`" });
    for (const action of trailingDenyActions(p.data)) {
      findings.push({ path, rule: "trailing-deny-hides-tool", message: `${action}: a trailing catch-all deny after allows hides the tool` });
    }
  }
  return findings;
}
