/**
 * The real tree's skills and commands: counts pinned, outputs consistent, nothing hand-maintained
 * left in a generated folder. A deliberate add or removal updates the numbers here.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { loadCanonicalAssets } from "../../../src/core/AssetLoader.js";
import { loadCanonicalAgents } from "../../../src/core/AgentLoader.js";
import { plan, readManifest } from "../../../src/core/BuildPipeline.js";
import { emitsTo } from "../../../src/core/TargetPolicy.js";
import { lintAssetNaming, lintAssetReferences } from "../../../src/verify/lint/assets.js";
import { repoPath } from "../../support/pending.js";

const REPO = repoPath();
const { skills, commands } = loadCanonicalAssets(REPO);
const shipsTo = (assets: typeof skills, target: "opencode" | "opencode-v1" | "claude-code"): string[] =>
  assets.filter((asset) => emitsTo(asset, target)).map((asset) => asset.oac.id);

const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.name === "node_modules" ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      );
const posix = (p: string): string => relative(REPO, p).split(sep).join("/");

describe("canonical skills and commands (pinned counts)", () => {
  it("has 17 skills: 12 for Claude Code, 5 for OpenCode (v2 and v1)", () => {
    expect(skills).toHaveLength(17);
    expect(shipsTo(skills, "claude-code")).toHaveLength(12);
    expect(shipsTo(skills, "opencode")).toEqual(["context-manager", "context7", "project-orchestration", "smart-router-skill", "task-management"]);
    expect(shipsTo(skills, "opencode-v1")).toEqual(shipsTo(skills, "opencode"));
  });

  it("has 23 commands: 6 for Claude Code, 17 for OpenCode (v2 and v1)", () => {
    expect(commands).toHaveLength(23);
    expect(shipsTo(commands, "claude-code")).toEqual(["brainstorm", "debug", "install-context", "oac-cleanup", "oac-help", "oac-status"]);
    expect(shipsTo(commands, "opencode")).toHaveLength(17);
    expect(shipsTo(commands, "opencode-v1")).toEqual(shipsTo(commands, "opencode"));
  });

  it("no host-shared id collides across targets (a Claude and an OpenCode asset never share an id)", () => {
    const claude = new Set(shipsTo(skills, "claude-code"));
    expect(shipsTo(skills, "opencode").filter((id) => claude.has(id))).toEqual([]);
  });

  it("passes the reference lints with no findings and no naming warnings", async () => {
    const agents = await loadCanonicalAgents(repoPath("agent-library/agents"));
    expect(lintAssetReferences({ skills, commands, agents })).toEqual([]);
    expect(lintAssetNaming([...skills, ...commands]).filter((f) => f.level === "warn")).toEqual([]);
  });
});

describe("registries list exactly the OpenCode skills and commands", () => {
  for (const [file, root] of [
    ["built-ai-configs/registry/registry.json", ".opencode"],
    ["built-ai-configs/registry/registry.v1.json", "built-ai-configs/opencode-v1"],
  ] as const) {
    it(`${file}: 5 skills, 17 commands, every file on disk, no Claude-only entry`, () => {
      const registry = JSON.parse(readFileSync(repoPath(file), "utf-8")) as { components: Record<string, Array<{ id: string; path: string; files?: string[] }>> };
      expect(registry.components.skills!.map((e) => e.id)).toEqual(shipsTo(skills, "opencode"));
      expect(registry.components.commands!.map((e) => e.id)).toEqual(shipsTo(commands, "opencode").sort());
      for (const entry of registry.components.skills!) {
        expect(entry.path).toBe(`${root}/skills/${entry.id}/SKILL.md`);
        expect(entry.files![0]).toBe(entry.path);
        for (const f of entry.files!) expect(existsSync(repoPath(f)), f).toBe(true);
      }
      for (const entry of registry.components.commands!) expect(existsSync(repoPath(entry.path)), entry.path).toBe(true);
    });
  }
});

describe("generated folders hold only generated files", () => {
  const ledger = new Set(Object.keys(readManifest(REPO).files));
  const folders = [".opencode/skills", ".opencode/command", "plugins/claude-code/skills", "plugins/claude-code/commands", "built-ai-configs/opencode/skills", "built-ai-configs/opencode/command", "built-ai-configs/opencode-v1/skills", "built-ai-configs/opencode-v1/command", "built-ai-configs/claude-code/skills", "built-ai-configs/claude-code/commands"];

  it("every file under a skills/commands folder is in the ledger", () => {
    const strays = folders.flatMap((folder) => walk(repoPath(folder)).map(posix)).filter((path) => !ledger.has(path));
    expect(strays).toEqual([]);
  });

  it("the singular .opencode/skill folder is gone", () => {
    expect(existsSync(repoPath(".opencode/skill"))).toBe(false);
  });

  it("the 12 Claude skills and 6 Claude commands are in the plugin folders", async () => {
    const built = await plan({ root: REPO, targets: ["claude-code"], skipRegistry: true });
    const plugin = built.files.filter((f) => f.mirrorOf !== undefined && f.assetKind !== undefined).map((f) => f.path);
    expect(plugin.filter((p) => p.endsWith("/SKILL.md"))).toHaveLength(12);
    expect(plugin.filter((p) => p.startsWith("plugins/claude-code/commands/"))).toHaveLength(6);
  });

  it("scripts keep their executable bit through the build", () => {
    for (const path of [".opencode/skills/task-management/router.sh", "built-ai-configs/opencode-v1/skills/smart-router-skill/scripts/yoda-workflow.sh"]) {
      expect(statSync(repoPath(path)).mode & 0o111, path).not.toBe(0);
    }
  });
});
