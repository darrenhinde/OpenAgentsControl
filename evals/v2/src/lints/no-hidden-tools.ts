// T1 (#349): a permission block whose LAST rule is `"*": deny` after earlier allows hides the
// whole tool on OpenCode (v1 `Permission.disabled`, v2 `whollyDisabled`): the allows never apply.
import { frontmatter, v2Action, type SourceFile } from "./files.ts";

export interface HiddenTool {
  path: string;
  key: string;
  action: string;
  allows: string[];
}

export function lintNoHiddenTools(files: SourceFile[]): HiddenTool[] {
  const out: HiddenTool[] = [];
  for (const f of files) {
    const perm = frontmatter(f.text).data.permission;
    if (typeof perm !== "object" || perm === null || Array.isArray(perm)) continue;
    for (const [key, rules] of Object.entries(perm as Record<string, unknown>)) {
      if (typeof rules !== "object" || rules === null || Array.isArray(rules)) continue;
      const entries = Object.entries(rules as Record<string, unknown>);
      const last = entries[entries.length - 1];
      if (!last || last[0] !== "*" || last[1] !== "deny") continue;
      const allows = entries.slice(0, -1).filter(([, v]) => v === "allow").map(([k]) => k);
      if (allows.length) out.push({ path: f.path, key, action: v2Action(key), allows });
    }
  }
  return out;
}
