/**
 * The context library (`agent-library/context/**`): load, copy verbatim to `.opencode/context/`,
 * symlinks, ledger, prune, drift, registry `contexts`, lints. Runs against a throwaway tree; the
 * real tree is pinned in context-corpus.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { check, plan, readManifest, write } from "../../../src/core/BuildPipeline.js";
import { RegistryEmitter } from "../../../src/core/RegistryEmitter.js";
import { ContextLoadError, loadContextLibrary } from "../../../src/core/ContextLoader.js";
import { lintContext } from "../../../src/verify/lint/context.js";

let root: string;

const put = (path: string, content: string | Buffer): void => {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
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
  components: { agents: [], subagents: [], commands: [], skills: [], contexts: [{ id: "stale", name: "Stale", type: "context", path: ".opencode/context/stale.md", description: "x", tags: [], category: "standard" }] },
  profiles: {},
};
const COMPONENTS = {
  version: 1,
  components: [
    { id: "zeta", name: "Zeta", file: "core/zeta.md", description: "Z", tags: ["z"], dependencies: [], category: "essential" },
    { id: "alpha", name: "Alpha", file: "core/alpha.md", aliases: ["alpha-old"], description: "A", tags: [], category: "standard" },
  ],
};
const NAV = "<!-- Context: navigation -->\n\n- [Alpha](core/alpha.md)\n- `core/zeta.md`\n";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oac-context-"));
  put("built-ai-configs/registry/registry.json", `${JSON.stringify(REGISTRY, null, 2)}\n`);
  put("built-ai-configs/registry/registry.v1.json", `${JSON.stringify(REGISTRY, null, 2)}\n`);
  put("agent-library/agents/core/task-manager.md", AGENT);
  put("agent-library/context/navigation.md", NAV);
  put("agent-library/context/core/alpha.md", "<!-- Context: core/alpha -->\r\nAlpha, with CRLF and `.opencode/context` text.\r\n");
  put("agent-library/context/core/zeta.md", "Zeta\n");
  put("agent-library/context/components.json", `${JSON.stringify(COMPONENTS, null, 2)}\n`);
  symlinkSync("alpha.md", join(root, "agent-library/context/core/a.md"));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("loading", () => {
  it("ships every file but components.json, links included", () => {
    const library = loadContextLibrary(root);
    expect(library.files.map((f) => f.relativePath)).toEqual(["core/a.md", "core/alpha.md", "core/zeta.md", "navigation.md"]);
    expect(library.files.find((f) => f.relativePath === "core/a.md")!.linkTarget).toBe("alpha.md");
    expect(library.components.map((c) => c.id)).toEqual(["zeta", "alpha"]);
  });

  it("treats a missing library as empty", () => {
    expect(loadContextLibrary(mkdtempSync(join(tmpdir(), "oac-empty-")))).toEqual({ files: [], components: [] });
  });

  it("rejects a registered file that does not exist, a duplicate id or alias, and a bad path", () => {
    const set = (components: unknown[]): void => put("agent-library/context/components.json", JSON.stringify({ version: 1, components }));
    const base = COMPONENTS.components[0]!;
    set([{ ...base, file: "core/missing.md" }]);
    expect(() => loadContextLibrary(root)).toThrow(/does not exist in agent-library\/context/);
    set([base, { ...base, file: "core/alpha.md" }]);
    expect(() => loadContextLibrary(root)).toThrow(/declared by both/);
    set([{ ...base, file: "../outside.md" }]);
    expect(() => loadContextLibrary(root)).toThrow(/normalised relative path/);
    set([{ ...base, surprise: 1 }]);
    expect(() => loadContextLibrary(root)).toThrow(ContextLoadError);
  });

  it("ships an absolute link that points inside the library as the equivalent relative link", () => {
    unlinkSync(join(root, "agent-library/context/core/a.md"));
    symlinkSync(join(root, "agent-library/context/core/alpha.md"), join(root, "agent-library/context/core/a.md"));
    expect(loadContextLibrary(root).files.find((f) => f.relativePath === "core/a.md")!.linkTarget).toBe("alpha.md");
  });

  it("rejects a link to an absolute path outside the library, one that leaves it, and one to nothing", () => {
    for (const target of ["/etc/hosts", "../../../../outside.md", "missing.md"]) {
      unlinkSync(join(root, "agent-library/context/core/a.md"));
      symlinkSync(target, join(root, "agent-library/context/core/a.md"));
      expect(() => loadContextLibrary(root), target).toThrow(/symlink target/);
    }
  });
});

describe("emission", () => {
  it("copies bytes verbatim (CRLF included) to .opencode/context, links as links, nothing else", async () => {
    const built = await plan({ root });
    const context = built.files.filter((f) => f.contextId !== undefined);
    expect(context.map((f) => f.path)).toEqual([
      ".opencode/context/core/a.md",
      ".opencode/context/core/alpha.md",
      ".opencode/context/core/zeta.md",
      ".opencode/context/navigation.md",
    ]);
    expect(context.every((f) => f.target === "opencode" && f.mirrorOf === undefined)).toBe(true);
    write(built, { root });

    expect(readFileSync(join(root, ".opencode/context/core/alpha.md"))).toEqual(readFileSync(join(root, "agent-library/context/core/alpha.md")));
    expect(lstatSync(join(root, ".opencode/context/core/a.md")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(root, ".opencode/context/core/a.md"))).toBe("alpha.md");
    expect(existsSync(join(root, ".opencode/context/components.json"))).toBe(false);
    expect(readManifest(root).files[".opencode/context/core/alpha.md"]).toMatchObject({ target: "opencode", root: ".opencode/context", assetKind: "context", assetId: "core/alpha.md" });
  });

  it("is idempotent and passes its own drift check", async () => {
    write(await plan({ root }), { root });
    const second = write(await plan({ root }), { root });
    expect(second.changed).toEqual([]);
    expect(check(await plan({ root }), { root })).toEqual([]);
  });

  it("builds nothing for context when the opencode target is not selected", async () => {
    const built = await plan({ root, targets: ["claude-code"], skipRegistry: true });
    expect(built.files.some((f) => f.contextId !== undefined)).toBe(false);
  });

  it("reports edits, a retargeted link and a file where a link belongs as drift, and fixes them without writing through a link", async () => {
    write(await plan({ root }), { root });
    writeFileSync(join(root, ".opencode/context/core/zeta.md"), "edited");
    rmSync(join(root, ".opencode/context/core/a.md"));
    symlinkSync("zeta.md", join(root, ".opencode/context/core/a.md"));
    expect(check(await plan({ root }), { root }).map((d) => [d.path, d.status])).toEqual([
      [".opencode/context/core/a.md", "modified"],
      [".opencode/context/core/zeta.md", "modified"],
    ]);
    write(await plan({ root }), { root });
    expect(readlinkSync(join(root, ".opencode/context/core/a.md"))).toBe("alpha.md");
    expect(read("agent-library/context/core/zeta.md")).toBe("Zeta\n");
    expect(check(await plan({ root }), { root })).toEqual([]);
  });

  it("never writes through a symlink that sits where a regular file is planned", async () => {
    mkdirSync(join(root, ".opencode/context/core"), { recursive: true });
    put("victim.md", "precious");
    symlinkSync(join(root, "victim.md"), join(root, ".opencode/context/core/zeta.md"));
    write(await plan({ root }), { root });
    expect(read("victim.md")).toBe("precious");
    expect(lstatSync(join(root, ".opencode/context/core/zeta.md")).isSymbolicLink()).toBe(false);
    expect(read(".opencode/context/core/zeta.md")).toBe("Zeta\n");
  });

  it("prunes a file and a link whose source is gone, keeps an edited one, and never touches an unledgered file", async () => {
    write(await plan({ root }), { root });
    put(".opencode/context/mine.md", "user file");
    rmSync(join(root, "agent-library/context/core/a.md"));
    rmSync(join(root, "agent-library/context/core/zeta.md"));
    writeFileSync(join(root, ".opencode/context/core/zeta.md"), "user edit");
    put("agent-library/context/components.json", JSON.stringify({ version: 1, components: [COMPONENTS.components[1]] }));

    const result = write(await plan({ root }), { root });
    expect(result.removed).toEqual([".opencode/context/core/a.md"]);
    expect(result.kept.map((k) => k.path)).toEqual([".opencode/context/core/zeta.md"]);
    expect(existsSync(join(root, ".opencode/context/mine.md"))).toBe(true);
    expect(lstatSync(join(root, ".opencode/context/core/alpha.md")).isFile()).toBe(true);
  });
});

describe("registry", () => {
  it("generates components.contexts from components.json: order kept, shape fixed, nothing carried", async () => {
    const registry = await new RegistryEmitter(root).emit();
    const contexts = registry.components.contexts!;
    expect(contexts.map((c) => c.id)).toEqual(["zeta", "alpha"]);
    expect(Object.keys(contexts[0]!)).toEqual(["id", "name", "type", "path", "description", "tags", "dependencies", "category"]);
    expect(Object.keys(contexts[1]!)).toEqual(["id", "name", "type", "path", "aliases", "description", "tags", "category"]);
    expect(contexts[1]).toMatchObject({ type: "context", path: ".opencode/context/core/alpha.md", aliases: ["alpha-old"] });
    expect(JSON.stringify(registry)).not.toContain("stale");
  });

  it("emits the same contexts for the v1 registry", async () => {
    const v2 = await new RegistryEmitter(root, { target: "opencode" }).emit();
    const v1 = await new RegistryEmitter(root, { target: "opencode-v1" }).emit();
    expect(v1.components.contexts).toEqual(v2.components.contexts);
  });

  it("carries the committed contexts when the library declares none", async () => {
    put("agent-library/context/components.json", JSON.stringify({ version: 1, components: [] }));
    expect((await new RegistryEmitter(root).emit()).components.contexts!.map((c) => c.id)).toEqual(["stale"]);
  });
});

describe("lints", () => {
  it("reports dead links, dead navigation entries, unreachable and unregistered files", () => {
    put("agent-library/context/navigation.md", `${NAV}- \`core/gone.md\`\n- \`.opencode/agent/x.md\`\n`);
    put("agent-library/context/core/alpha.md", "See [missing](missing.md) and [web](https://x.y/z.md) and `.opencode/context/core/zeta.md` and [ph](.opencode/context/security/auth-patterns.md).\n");
    put("agent-library/context/core/orphan.md", "nobody links here\n");
    const findings = lintContext(loadContextLibrary(root)).map((f) => `${f.rule} ${f.path}`);
    expect(findings).toEqual([
      "navigation-dead-entry navigation.md",
      "dead-link core/alpha.md",
      "unreachable core/orphan.md",
      "unregistered core/orphan.md",
      "unregistered navigation.md",
    ]);
  });

  it("finds nothing wrong in a consistent library", () => {
    put(
      "agent-library/context/components.json",
      JSON.stringify({ version: 1, components: [...COMPONENTS.components, { id: "nav", name: "Nav", file: "navigation.md", description: "N", tags: [], category: "essential" }] }),
    );
    expect(lintContext(loadContextLibrary(root))).toEqual([]);
  });
});
