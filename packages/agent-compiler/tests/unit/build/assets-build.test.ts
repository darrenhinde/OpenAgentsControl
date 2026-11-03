/**
 * Canonical skills and commands: load, emit per host, mirror, ledger, prune, registry, lint.
 * Runs against a throwaway tree; the real tree's counts are pinned in assets-corpus.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
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

// A PNG signature, a lone 0x80 / 0xFF (invalid UTF-8) and every byte value: what a utf-8 round trip corrupts.
const BINARY = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x80, 0xff, 0xfe]),
  Buffer.from(Array.from({ length: 256 }, (_, i) => i)),
]);

describe("binary supporting files", () => {
  const putBytes = (path: string, bytes: Buffer): void => {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, bytes);
  };

  it("round-trips byte-identical through build, the mirrors, the ledger and the drift check", async () => {
    putBytes("agent-library/skills/demo/assets/logo.png", BINARY);
    const built = await plan({ root });
    const emitted = built.files.find((f) => f.path === "built-ai-configs/opencode/skills/demo/assets/logo.png")!;
    expect(Buffer.isBuffer(emitted.content)).toBe(true);
    write(built, { root });

    for (const out of [
      "built-ai-configs/opencode/skills/demo/assets/logo.png",
      ".opencode/skills/demo/assets/logo.png",
      "built-ai-configs/opencode-v1/skills/demo/assets/logo.png",
    ]) {
      expect(readFileSync(join(root, out)).equals(BINARY)).toBe(true);
    }
    expect(readManifest(root).files[".opencode/skills/demo/assets/logo.png"]!.sha256).toBe(
      createHash("sha256").update(BINARY).digest("hex"),
    );
    // unchanged on rebuild, clean drift check
    expect(write(await plan({ root }), { root }).changed).toEqual([]);
    expect(check(await plan({ root }), { root })).toEqual([]);

    // a one-byte edit is drift
    const edited = Buffer.from(BINARY);
    edited[20] ^= 0x01;
    writeFileSync(join(root, ".opencode/skills/demo/assets/logo.png"), edited);
    expect(check(await plan({ root }), { root })).toEqual([{ path: ".opencode/skills/demo/assets/logo.png", status: "modified" }]);
  });

  it("prunes an unedited binary when its source is deleted, and keeps an edited one", async () => {
    putBytes("agent-library/skills/demo/assets/logo.png", BINARY);
    write(await plan({ root }), { root });
    rmSync(join(root, "agent-library/skills/demo/assets"), { recursive: true });
    const edited = Buffer.from(BINARY);
    edited[3] = 0;
    writeFileSync(join(root, "built-ai-configs/opencode/skills/demo/assets/logo.png"), edited);
    const result = write(await plan({ root }), { root });
    expect(result.removed).toContain(".opencode/skills/demo/assets/logo.png");
    expect(result.kept.map((k) => k.path)).toEqual(["built-ai-configs/opencode/skills/demo/assets/logo.png"]);
  });

  it("keeps text files as strings", async () => {
    const built = await plan({ root });
    expect(typeof built.files.find((f) => f.path === "built-ai-configs/opencode/skills/demo/router.sh")!.content).toBe("string");
  });
});

describe("hostile skill folders", () => {
  it("never follows a symlink inside a skill (to a file or a folder), and does not crash", async () => {
    put("outside/secret.txt", "TOP SECRET");
    symlinkSync(join(root, "outside/secret.txt"), join(root, "agent-library/skills/demo/passwd-link"));
    symlinkSync("/etc/passwd", join(root, "agent-library/skills/demo/etc-passwd"));
    symlinkSync(join(root, "outside"), join(root, "agent-library/skills/demo/dir-link"));
    const loaded = loadCanonicalAssets(root);
    expect(loaded.skills.find((s) => s.oac.id === "demo")!.supporting.map((f) => f.relativePath)).toEqual(["notes.md", "router.sh"]);
    const built = await plan({ root });
    expect(built.files.some((f) => /passwd|secret|dir-link/.test(f.path))).toBe(false);
    expect(built.files.some((f) => typeof f.content === "string" && f.content.includes("TOP SECRET"))).toBe(false);
  });

  it("skips .git folders and .DS_Store but ships other dotfiles", () => {
    put("agent-library/skills/demo/.git/config", "x");
    put("agent-library/skills/demo/.DS_Store", "x");
    put("agent-library/skills/demo/node_modules/m/index.js", "x");
    put("agent-library/skills/demo/.env.example", "A=1\n");
    const supporting = loadCanonicalAssets(root).skills[0]!.supporting.map((f) => f.relativePath);
    expect(supporting).toEqual([".env.example", "notes.md", "router.sh"]);
  });

  it("copies deep nesting and file names with spaces and unicode", async () => {
    put("agent-library/skills/demo/a/b/c/d/e/f/g/deep.txt", "deep\n");
    put("agent-library/skills/demo/my notes/Résumé \u00fcber.txt", "uni\n");
    const built = await plan({ root });
    const paths = built.files.map((f) => f.path);
    expect(paths).toContain("built-ai-configs/opencode/skills/demo/a/b/c/d/e/f/g/deep.txt");
    expect(paths).toContain("built-ai-configs/opencode/skills/demo/my notes/Résumé über.txt");
  });

  it("fails clearly, naming the file, on a malformed oac:only marker in a supporting .md", async () => {
    put("agent-library/skills/demo/bad.md", "<!-- oac:only opencode -->\nnever closed\n");
    await expect(plan({ root })).rejects.toThrow(/bad\.md/);
    put("agent-library/skills/demo/bad.md", "<!-- oac:only nonsense-host -->\nx\n<!-- /oac:only -->\n");
    await expect(plan({ root })).rejects.toThrow(/unknown target "nonsense-host"/);
  });

  it("requires a command group folder to be kebab-case", () => {
    put("agent-library/commands/Open Agents/validate.md", COMMAND_PLAIN);
    expect(() => loadCanonicalAssets(root)).toThrow(/group folder "Open Agents" must be kebab-case/);
    rmSync(join(root, "agent-library/commands/Open Agents"), { recursive: true });
    put("agent-library/commands/open_agents/validate.md", COMMAND_PLAIN);
    expect(() => loadCanonicalAssets(root)).toThrow(/must be kebab-case/);
    rmSync(join(root, "agent-library/commands/open_agents"), { recursive: true });
    put("agent-library/commands/ok-group/sub-group/validate.md", COMMAND_PLAIN);
    expect(loadCanonicalAssets(root).commands.map((c) => c.group)).toEqual(["ok-group/sub-group"]);
  });
});
