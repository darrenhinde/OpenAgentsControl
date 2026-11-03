/**
 * AssetEmitter: turn one canonical skill or command into the files one host receives.
 *
 * Deliberately text-level, like the OpenCode agent adapters: the authored frontmatter is kept
 * line for line and only the `oac:` block is cut out, so a skill that was hand-written for a host
 * and then given an `oac:` block comes out byte-identical to what it was. If the frontmatter is
 * empty once `oac:` is gone, no frontmatter is emitted at all.
 *
 * Per host, in this order, for every `.md` file of the asset:
 *   1. `<!-- oac:only <host> -->` blocks are kept or dropped (HostBlocks);
 *   2. on the OpenCode hosts, structured delegation calls are rewritten to that major's syntax and
 *      agent ids (`task(subagent_type="TaskManager")` -> `subagent(agent="task-manager")` on v2),
 *      the same rewrite agents get. Author the v1 form; an unknown agent name is left alone.
 * `oac.overrides.claude-code.{name,description}` replace the matching frontmatter field on Claude
 * Code only; a file with an override has that host's frontmatter re-serialised.
 * Files that are not Markdown are copied verbatim.
 */

import * as yaml from "js-yaml";
import type { AgentIdResolver } from "./AgentIdResolver.js";
import type { CanonicalAssetFile } from "./AssetLoader.js";
import { rewriteBodyRefs } from "./DelegationRewriter.js";
import { filterHostBlocks } from "./HostBlocks.js";
import { readFileSync } from "node:fs";
import type { BuildTarget } from "./TargetPolicy.js";

/** One emitted file, path relative to the asset's output root (`skills/` or `command/`). */
export interface AssetOutput {
  relativePath: string;
  content: string;
  executable: boolean;
}

function transformBody(body: string, target: BuildTarget, resolver: AgentIdResolver | undefined, file: string, lineOffset: number): string {
  let out = filterHostBlocks(body, target, { file, lineOffset });
  if (target !== "claude-code" && resolver !== undefined) {
    out = rewriteBodyRefs(out, target, resolver, { unknown: "keep" });
  }
  return out;
}

function renderFrontmatter(asset: CanonicalAssetFile, target: BuildTarget): string | null {
  const override = target === "claude-code" ? asset.oac.overrides["claude-code"] : undefined;
  if (override !== undefined && (override.name !== undefined || override.description !== undefined)) {
    const fields: Record<string, unknown> = { ...asset.fields };
    if (override.name !== undefined) fields.name = override.name;
    if (override.description !== undefined) fields.description = override.description;
    return `---\n${yaml.dump(fields, { lineWidth: -1 }).replace(/\n$/, "")}\n---\n`;
  }
  const lines = asset.frontmatter;
  if (lines.every((line) => line.trim() === "")) return null;
  return `---\n${lines.join("\n")}\n---\n`;
}

/** The main file (`SKILL.md` or the command file) for one host. */
export function emitAssetMain(asset: CanonicalAssetFile, target: BuildTarget, resolver?: AgentIdResolver): string {
  const body = transformBody(asset.body, target, resolver, asset.filePath, asset.bodyLineOffset);
  return `${renderFrontmatter(asset, target) ?? ""}${body}`;
}

/** Every file one host receives for an asset: the main file first, then supporting files by path. */
export function emitAsset(asset: CanonicalAssetFile, target: BuildTarget, resolver?: AgentIdResolver): AssetOutput[] {
  const main: AssetOutput = {
    relativePath: asset.kind === "skill" ? `${asset.oac.id}/SKILL.md` : asset.relativePath,
    content: emitAssetMain(asset, target, resolver),
    executable: asset.executable,
  };
  const supporting = asset.supporting.map((file): AssetOutput => {
    const raw = readFileSync(file.filePath, "utf-8");
    return {
      relativePath: `${asset.oac.id}/${file.relativePath}`,
      content: file.relativePath.endsWith(".md") ? transformBody(raw, target, resolver, file.filePath, 0) : raw,
      executable: file.executable,
    };
  });
  return [main, ...supporting];
}
