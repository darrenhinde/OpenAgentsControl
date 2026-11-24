// #367: files OpenCode v2 never loads. v2 has no `.opencode/tool/` scan, and plugins written
// against the v1 `@opencode-ai/plugin` API don't run.
import type { SourceFile } from "./files.ts";

export interface V1Artifact {
  path: string;
  reason: string;
}

export function lintNoV1Artifacts(toolFiles: SourceFile[], pluginFiles: SourceFile[]): V1Artifact[] {
  const out: V1Artifact[] = [];
  for (const f of toolFiles) {
    if (/\.(ts|js|mjs)$/.test(f.path) && !/\.d\.ts$/.test(f.path)) out.push({ path: f.path, reason: ".opencode/tool/** is never scanned by v2" });
  }
  for (const f of pluginFiles) {
    if (!/\.(ts|js|mjs)$/.test(f.path) || /\.d\.ts$/.test(f.path) || /(^|\/)(tests?|__tests__)\//.test(f.path)) continue;
    if (/from\s+["']@opencode-ai\/plugin["']|require\(["']@opencode-ai\/plugin["']\)/.test(f.text)) out.push({ path: f.path, reason: "v1 plugin API (@opencode-ai/plugin)" });
  }
  return out;
}
