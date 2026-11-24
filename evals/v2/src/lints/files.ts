import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";

export interface SourceFile {
  /** Path relative to the repo root. */
  path: string;
  text: string;
}

/** Recursively list files under `dir` (relative to repo), skipping node_modules. */
export function listFiles(repo: string, dir: string, filter: (p: string) => boolean = () => true): SourceFile[] {
  const root = join(repo, dir);
  if (!existsSync(root)) return [];
  const out: SourceFile[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && filter(p)) out.push({ path: relative(repo, p), text: readFileSync(p, "utf8") });
    }
  };
  walk(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export interface Frontmatter {
  data: Record<string, unknown>;
  body: string;
}

/** Split `---\nyaml\n---\nbody`. Key order is preserved (it is policy: last match wins). */
export function frontmatter(text: string): Frontmatter {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { data: {}, body: text };
  let data: unknown = {};
  try {
    data = parse(m[1] ?? "") ?? {};
  } catch {
    data = {};
  }
  return { data: typeof data === "object" && data !== null && !Array.isArray(data) ? (data as Record<string, unknown>) : {}, body: m[2] ?? "" };
}

/** V1 permission key → the V2 tool/action it controls (research-opencode-v2.md §1.3). */
export function v2Action(key: string): string {
  return ({ bash: "shell", task: "subagent", write: "edit", patch: "edit" } as Record<string, string>)[key] ?? key;
}

/** Emitted OpenCode v2 agent ID = path under .opencode/agent without .md (v2 ignores `name:`). */
export function emittedId(path: string): string {
  return path.replace(/^\.opencode\/agents?\//, "").replace(/\.md$/, "");
}
