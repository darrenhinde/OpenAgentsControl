/**
 * Canonical skills and commands: load, emit per host, mirror, ledger, prune, registry, lint.
 * Runs against a throwaway tree; the real tree's counts are pinned in assets-corpus.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { check, plan, readManifest, write } from "../../../src/core/BuildPipeline.js";
import { RegistryEmitter } from "../../../src/core/RegistryEmitter.js";
import { AssetLoadError, loadCanonicalAssets } from "../../../src/core/AssetLoader.js";
import { lintAssetNaming, lintAssetReferences } from "../../../src/verify/lint/assets.js";

let root: string;

const put = (path: string, content: string, mode?: number): void => {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
  if (mode !== undefined) chmodSync(absolute, mode);
};
const read = (path: string): string => readFileSync(join(root, path), "utf-8");

const AGENT = [
  "---",
  "description: A scout.",
  "mode: subagent",
  "permission:",
  "  read:",
  '    "*": "allow"',
  "oac:",
  "  id: task-manager",
  "  name: TaskManager",
  "  category: core",
  "  type: subagent",
  "  overrides:",
  "    claude-code:",
  "      tools: [Read]",
  "---",
  "",
  "Body.",
  "",
].join("\n");

const REGISTRY = {
  version: "1.0.0",
  metadata: { lastUpdated: "2026-01-01" },
  components: { agents: [], subagents: [], commands: [], skills: [], contexts: [] },
  profiles: {},
};

// A skill hand-written for OpenCode, then given an oac block at the end of its frontmatter.
const SKILL = [
  "---",
  "name: demo",
  "description: Demo skill",
  "oac:",
  "  id: demo",
  "  name: Demo",
  "  category: essential",
  "  tags: [a, b]",
  "  dependencies:",
  "    - subagent:task-manager",
  "  targets: [opencode, opencode-v1]",
  "---",
  "",
  "# Demo",
  "",
  "<!-- oac:only opencode -->",
  "v2 only",
  "<!-- /oac:only -->",
  "",
  'task(subagent_type="TaskManager", description="x")',
  "",
].join("\n");

const NO_OAC_SKILL = SKILL.split("\n").filter((l) => !/^oac:/.test(l) && !/^  /.test(l)).join("\n");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oac-assets-"));
  put("built-ai-configs/registry/registry.json", `${JSON.stringify(REGISTRY, null, 2)}\n`);
  put("built-ai-configs/registry/registry.v1.json", `${JSON.stringify(REGISTRY, null, 2)}\n`);
  put("agent-library/agents/core/task-manager.md", AGENT);
  put("agent-library/skills/demo/SKILL.md", SKILL);
  put("agent-library/skills/demo/router.sh", "#!/bin/bash\necho hi\n", 0o755);
  put("agent-library/skills/demo/notes.md", "plain notes\n");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const COMMAND_PLAIN = [
  "---",
  "oac:",
  "  id: validate",
  "  name: Validate",
  "  description: Validate things",
  "  targets: [opencode]",
  "---",
  "# Validate",
  "",
].join("\n");

describe("loading", () => {
  it("rejects an id that is not the folder name", () => {
    put("agent-library/skills/demo/SKILL.md", SKILL.replace("id: demo", "id: other"));
    expect(() => loadCanonicalAssets(root)).toThrow(/must equal the folder name "demo"/);
  });

  it("rejects a skill whose frontmatter name differs from its id", () => {
    put("agent-library/skills/demo/SKILL.md", SKILL.replace("name: demo\n", "name: Demo Skill\n"));
    expect(() => loadCanonicalAssets(root)).toThrow(/frontmatter name "Demo Skill"/);
  });

  it("rejects a command whose id is not the file name, and a command with no description", () => {
    put("agent-library/commands/validate.md", COMMAND_PLAIN.replace("id: validate", "id: nope"));
    expect(() => loadCanonicalAssets(root)).toThrow(/must equal the file name "validate"/);
    put("agent-library/commands/validate.md", COMMAND_PLAIN.replace("  description: Validate things\n", ""));
    expect(() => loadCanonicalAssets(root)).toThrow(/no description/);
  });

  it("rejects a duplicate id or alias within a kind", () => {
    put("agent-library/commands/a.md", COMMAND_PLAIN.replace("id: validate", "id: a").replace("name: Validate", "name: A"));
    put("agent-library/commands/g/b.md", COMMAND_PLAIN.replace("id: validate", "id: b\n  aliases: [a]"));
    expect(() => loadCanonicalAssets(root)).toThrow(/Duplicate command id\/alias "a"/);
  });

  it("rejects a loose file in skills/, a folder without SKILL.md, a non-md file and too-deep commands", () => {
    put("agent-library/skills/loose.md", "x");
    expect(() => loadCanonicalAssets(root)).toThrow(/a loose file is not a skill/);
    rmSync(join(root, "agent-library/skills/loose.md"));
    put("agent-library/skills/empty/notes.md", "x");
    expect(() => loadCanonicalAssets(root)).toThrow(/has no SKILL.md/);
    rmSync(join(root, "agent-library/skills/empty"), { recursive: true });
    put("agent-library/commands/x.yaml", "a: b");
    expect(() => loadCanonicalAssets(root)).toThrow(/only .md files/);
    rmSync(join(root, "agent-library/commands/x.yaml"));
    put("agent-library/commands/a/b/c/d.md", COMMAND_PLAIN);
    expect(() => loadCanonicalAssets(root)).toThrow(/at most 2 folders/);
  });

  it("rejects an unknown oac key and a missing oac block with the file named", () => {
    put("agent-library/skills/demo/SKILL.md", SKILL.replace("  tags: [a, b]", "  tags: [a, b]\n  bogus: 1"));
    expect(() => loadCanonicalAssets(root)).toThrow(AssetLoadError);
    put("agent-library/skills/demo/SKILL.md", NO_OAC_SKILL);
    expect(() => loadCanonicalAssets(root)).toThrow(/No `oac:` block/);
  });

  it("rejects an override for a host the asset does not ship to", () => {
    put("agent-library/skills/demo/SKILL.md", SKILL.replace("  targets: [opencode, opencode-v1]", "  targets: [opencode]\n  overrides:\n    claude-code:\n      description: x"));
    expect(() => loadCanonicalAssets(root)).toThrow(/not in the effective targets/);
  });
});

describe("emission", () => {
  it("cuts only the oac block, host-filters, rewrites delegation per OpenCode major, copies the rest", async () => {
    const built = await plan({ root });
    const byPath = new Map(built.files.map((f) => [f.path, f]));

    const v2 = byPath.get("built-ai-configs/opencode/skills/demo/SKILL.md")!;
    expect(v2.content).toBe(
      ["---", "name: demo", "description: Demo skill", "---", "", "# Demo", "", "v2 only", "", 'subagent(agent="task-manager", description="x")', ""].join("\n"),
    );
    const v1 = byPath.get("built-ai-configs/opencode-v1/skills/demo/SKILL.md")!;
    expect(v1.content).toContain('task(subagent_type="TaskManager", description="x")');
    expect(v1.content).not.toContain("v2 only");

    expect(byPath.get("built-ai-configs/opencode/skills/demo/notes.md")!.content).toBe("plain notes\n");
    expect(byPath.get("built-ai-configs/opencode/skills/demo/router.sh")!.executable).toBe(true);
    expect(byPath.get("built-ai-configs/opencode/skills/demo/notes.md")!.executable).toBeUndefined();
    // Claude Code is not a declared target
    expect([...byPath.keys()].some((p) => p.includes("claude-code/skills"))).toBe(false);
  });

  it("mirrors to the live paths, records the ledger, sets the exec bit and passes its own drift check", async () => {
    const built = await plan({ root });
    write(built, { root });

    expect(read(".opencode/skills/demo/SKILL.md")).toBe(read("built-ai-configs/opencode/skills/demo/SKILL.md"));
    expect(statSync(join(root, ".opencode/skills/demo/router.sh")).mode & 0o111).not.toBe(0);
    expect(statSync(join(root, ".opencode/skills/demo/notes.md")).mode & 0o111).toBe(0);
    expect(existsSync(join(root, "built-ai-configs/opencode-v1/skills/demo/router.sh"))).toBe(true);

    const ledger = readManifest(root).files;
    expect(ledger[".opencode/skills/demo/SKILL.md"]).toMatchObject({ target: "opencode", root: ".opencode/skills", assetKind: "skill", assetId: "demo" });
    expect(check(await plan({ root }), { root })).toEqual([]);

    // drift: content and exec bit
    writeFileSync(join(root, ".opencode/skills/demo/notes.md"), "edited");
    chmodSync(join(root, ".opencode/skills/demo/router.sh"), 0o644);
    const drift = check(await plan({ root }), { root }).map((d) => d.path);
    expect(drift).toEqual([".opencode/skills/demo/notes.md", ".opencode/skills/demo/router.sh"]);
  });

  it("is deterministic and idempotent", async () => {
    write(await plan({ root }), { root });
    const second = write(await plan({ root }), { root });
    expect(second.changed).toEqual([]);
  });

  it("emits a command without frontmatter when only the oac block was authored, and keeps its group folder", async () => {
    put("agent-library/commands/openagents/validate.md", COMMAND_PLAIN);
    const built = await plan({ root });
    const file = built.files.find((f) => f.path === "built-ai-configs/opencode/command/openagents/validate.md")!;
    expect(file.content).toBe("# Validate\n");
    expect(built.files.some((f) => f.path === ".opencode/command/openagents/validate.md")).toBe(true);
    // targets: [opencode] also ships to v1 (v1 follows v2), not to claude-code
    expect(built.files.some((f) => f.path === "built-ai-configs/opencode-v1/command/openagents/validate.md")).toBe(true);
    expect(built.files.some((f) => f.path.includes("claude-code/commands"))).toBe(false);
  });

  it("applies a claude-code description override only there, and ships claude commands to the plugin dirs", async () => {
    put(
      "agent-library/skills/demo/SKILL.md",
      SKILL.replace("  targets: [opencode, opencode-v1]", "  targets: [opencode, claude-code]\n  overrides:\n    claude-code:\n      description: Use when demoing"),
    );
    const built = await plan({ root });
    const cc = built.files.find((f) => f.path === "plugins/claude-code/skills/demo/SKILL.md")!;
    expect(cc.content).toContain("description: Use when demoing");
    expect(cc.content).not.toContain("v2 only");
    expect(built.files.find((f) => f.path === "built-ai-configs/opencode/skills/demo/SKILL.md")!.content).toContain("description: Demo skill");
  });

  it("fails on a malformed host block, naming the file and line", async () => {
    put("agent-library/skills/demo/SKILL.md", SKILL.replace("<!-- /oac:only -->", "<!-- oac:only -->"));
    await expect(plan({ root })).rejects.toThrow(/SKILL\.md:\d+/);
  });

  it("prunes outputs of a deleted skill and leaves unclaimed files in the same folder alone", async () => {
    write(await plan({ root }), { root });
    put(".opencode/skills/mine/SKILL.md", "hand written");
    rmSync(join(root, "agent-library/skills/demo"), { recursive: true });
    const result = write(await plan({ root }), { root });
    expect(result.removed).toContain(".opencode/skills/demo/SKILL.md");
    expect(existsSync(join(root, ".opencode/skills/demo"))).toBe(false);
    expect(existsSync(join(root, ".opencode/skills/mine/SKILL.md"))).toBe(true);
  });
});

describe("registry", () => {
  it("generates skill and command entries in the carried shape, per registry", async () => {
    put("agent-library/commands/openagents/validate.md", COMMAND_PLAIN.replace("targets: [opencode]", "targets: [opencode]\n  category: standard\n  tags: [t]"));
    const v2 = await new RegistryEmitter(root, { target: "opencode" }).emit();
    expect(v2.components.skills).toEqual([
      {
        id: "demo",
        name: "Demo",
        type: "skill",
        path: ".opencode/skills/demo/SKILL.md",
        description: "Demo skill",
        tags: ["a", "b"],
        dependencies: ["subagent:task-manager"],
        category: "essential",
        files: [".opencode/skills/demo/SKILL.md", ".opencode/skills/demo/notes.md", ".opencode/skills/demo/router.sh"],
      },
    ]);
    expect(Object.keys(v2.components.skills![0]!)).toEqual(["id", "name", "type", "path", "description", "tags", "dependencies", "category", "files"]);
    expect(v2.components.commands).toEqual([
      {
        id: "validate",
        name: "Validate",
        type: "command",
        path: ".opencode/command/openagents/validate.md",
        description: "Validate things",
        tags: ["t"],
        dependencies: [],
        category: "standard",
      },
    ]);
    const v1 = await new RegistryEmitter(root, { target: "opencode-v1" }).emit();
    expect(v1.components.skills![0]!.path).toBe("built-ai-configs/opencode-v1/skills/demo/SKILL.md");
  });

  it("does not list an asset a target does not ship, and withdraws entries whose source is gone", async () => {
    put("agent-library/skills/demo/SKILL.md", SKILL.replace("[opencode, opencode-v1]", "[claude-code]").replace("  dependencies:\n    - subagent:task-manager\n", "  dependencies: []\n"));
    expect((await new RegistryEmitter(root).emit()).components.skills).toEqual([]);

    put("agent-library/skills/demo/SKILL.md", SKILL);
    write(await plan({ root }), { root });
    rmSync(join(root, "agent-library/skills/demo"), { recursive: true });
    write(await plan({ root }), { root });
    expect(JSON.parse(read("built-ai-configs/registry/registry.json")).components.skills).toEqual([]);
  });

  it("carries hand-maintained entries it does not own, untouched and in order", async () => {
    const hand = { id: "legacy", name: "L", type: "skill", path: ".opencode/skills/legacy/SKILL.md", description: "d", tags: [], dependencies: [], category: "essential", files: [".opencode/skills/legacy/SKILL.md"] };
    put("built-ai-configs/registry/registry.json", `${JSON.stringify({ ...REGISTRY, components: { ...REGISTRY.components, skills: [hand] } }, null, 2)}\n`);
    const skills = (await new RegistryEmitter(root).emit()).components.skills!;
    expect(skills.map((s) => s.id)).toEqual(["demo", "legacy"]);
    expect(skills[1]).toEqual(hand);
  });
});

describe("lints", () => {
  it("flags a dead dependency, a repeated type suffix, a run-together word and an unknown forked agent", () => {
    put("agent-library/skills/demo/SKILL.md", SKILL.replace("subagent:task-manager", "subagent:ghost").replace("[opencode, opencode-v1]", "[opencode, claude-code]").replace("description: Demo skill", "description: Demo skill\nagent: nobody"));
    put("agent-library/skills/contextscout-skill/SKILL.md", SKILL.replace(/id: demo/, "id: contextscout-skill").replace("name: demo", "name: contextscout-skill"));
    const loaded = loadCanonicalAssets(root);
    const agents = [{ oac: { id: "task-manager", aliases: [], targets: ["opencode", "claude-code"], exclude: [] } }] as never;
    const refs = lintAssetReferences({ ...loaded, agents }).map((f) => f.rule).sort();
    expect(refs).toEqual(["dead-dependency", "skill-agent-unknown"]);
    const naming = lintAssetNaming(loaded.skills).map((f) => `${f.id}:${f.rule}`);
    expect(naming).toContain("contextscout-skill:id-type-suffix");
    expect(naming).toContain("contextscout-skill:id-compound-word");
    expect(naming.some((n) => n.startsWith("demo:"))).toBe(false);
  });

  it("accepts the grandfathered legacy names", () => {
    put("agent-library/skills/smart-router-skill/SKILL.md", SKILL.replace(/id: demo/, "id: smart-router-skill").replace("name: demo", "name: smart-router-skill"));
    const naming = lintAssetNaming(loadCanonicalAssets(root).skills);
    expect(naming).toEqual([]);
  });
});
