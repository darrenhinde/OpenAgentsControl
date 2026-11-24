// T1 part 2 (#362): every `permission.task` key and every delegation string in prompts must
// name an agent ID the v2 host actually has. v2 resolves subagents by exact path ID.
import { emittedId, frontmatter, type SourceFile } from "./files.ts";

export interface BadRef {
  path: string;
  kind: "task-key" | "body-ref";
  name: string;
}

const globToRe = (g: string): RegExp => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");

export function lintSubagentKeys(agentFiles: SourceFile[], promptFiles: SourceFile[]): { ids: string[]; bad: BadRef[]; refs: number } {
  const ids = agentFiles.map((f) => emittedId(f.path));
  const exists = (name: string): boolean => (name.includes("*") || name.includes("?") ? ids.some((id) => globToRe(name).test(id)) : ids.includes(name));
  const bad: BadRef[] = [];
  let refs = 0;
  for (const f of agentFiles) {
    const task = frontmatter(f.text).data.permission;
    const t = typeof task === "object" && task !== null ? (task as Record<string, unknown>).task : undefined;
    if (typeof t !== "object" || t === null) continue;
    for (const k of Object.keys(t as Record<string, unknown>)) {
      if (k === "*") continue;
      refs++;
      if (!exists(k)) bad.push({ path: f.path, kind: "task-key", name: k });
    }
  }
  // A delegation value, not a word that merely ends in "agent": `coder-agent: "allow"` is a task
  // key. Only the body is scanned; frontmatter keys are checked above.
  const re = /(?<![\w-])(?:subagent_type|agent)\s*[=:]\s*["']([A-Za-z0-9_./-]+)["']/g;
  for (const f of promptFiles) {
    for (const m of frontmatter(f.text).body.matchAll(re)) {
      const name = m[1] ?? "";
      refs++;
      if (!exists(name)) bad.push({ path: f.path, kind: "body-ref", name });
    }
  }
  return { ids, bad, refs };
}
