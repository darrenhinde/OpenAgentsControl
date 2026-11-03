/**
 * oac.aliases — a renamed agent keeps its old ids working.
 *
 * An alias resolves to the current id in every delegation reference (permission.task keys,
 * structured body calls, dependencies, profiles), builds with a deprecation (never an error),
 * and shows up as an additive `aliases` field on the registry entry. Colliding aliases fail.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { plan } from "../../../src/core/BuildPipeline.js";
import { AgentIdResolver, AgentIdResolutionError } from "../../../src/core/AgentIdResolver.js";
import { repoPath } from "../../support/pending.js";

let root: string;

const put = (relativePath: string, content: string): void => {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
};

const agent = (id: string, extra: { aliases?: string[]; previous?: string[]; targets?: string; task?: string[]; body?: string; deps?: string[] } = {}): string =>
  [
    "---",
    `description: Fixture ${id}.`,
    "mode: subagent",
    "permission:",
    ...(extra.task === undefined ? [] : ["  task:", '    "*": deny', ...extra.task.map((k) => `    ${k}: allow`)]),
    "  read:",
    '    "*": allow',
    "oac:",
    `  id: ${id}`,
    `  name: ${id}`,
    "  category: core",
    "  type: subagent",
    ...(extra.aliases === undefined ? [] : [`  aliases: [${extra.aliases.join(", ")}]`]),
    ...(extra.previous === undefined ? [] : [`  previousPaths: [${extra.previous.join(", ")}]`]),
    ...(extra.deps === undefined ? [] : ["  dependencies:", ...extra.deps.map((d) => `    - ${d}`)]),
    `  targets: ${extra.targets ?? "[opencode]"}`,
    ...((extra.targets ?? "").includes("claude-code") ? ["  overrides:", "    claude-code:", "      tools: [Read]"] : []),
    "---",
    "",
    extra.body ?? "Body.",
    "",
  ].join("\n");

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oac-alias-"));
  const registry = { version: "1.0.0", metadata: {}, components: { agents: [], subagents: [], contexts: [{ id: "c1", name: "c1", type: "context", path: ".opencode/context/c1.md", version: "1.0.0", description: "c1", tags: [], dependencies: [], category: "standard" }] }, profiles: {} };
  put("built-ai-configs/registry/registry.json", `${JSON.stringify(registry)}\n`);
  put("built-ai-configs/registry/registry.v1.json", `${JSON.stringify(registry)}\n`);
  put("agent-library/agents/core/context-scout.md", agent("context-scout", { aliases: ["contextscout"] }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("oac.aliases in a build", () => {
  it("resolves a stale permission.task key, builds, and reports a deprecation (not an error)", async () => {
    put("agent-library/agents/core/caller.md", agent("caller", { task: ["contextscout"] }));
    const built = await plan({ root, targets: ["opencode", "opencode-v1"] });

    const emitted = built.files.find((f) => f.path === ".opencode/agent/caller.md")!;
    expect(emitted.content).toContain("context-scout: allow");
    expect(emitted.content).not.toContain("contextscout");
    expect(built.deprecations).toEqual([
      {
        source: "agent-library/agents/core/caller.md",
        reason: 'deprecated alias "contextscout" -> use "context-scout"',
      },
    ]);
  });

  it("resolves a stale subagent_type in the body", async () => {
    put("agent-library/agents/core/caller.md", agent("caller", { body: 'task(subagent_type="contextscout", prompt="x")' }));
    const built = await plan({ root, targets: ["opencode"] });
    expect(built.files.find((f) => f.path === ".opencode/agent/caller.md")!.content).toContain('agent="context-scout"');
    expect(built.deprecations).toHaveLength(1);
  });

  it("reports nothing when references use the current id", async () => {
    put("agent-library/agents/core/caller.md", agent("caller", { task: ["context-scout"] }));
    expect((await plan({ root })).deprecations).toEqual([]);
  });

  it("rewrites a stale dependency to the current id and emits aliases on the registry entry", async () => {
    put("agent-library/agents/core/caller.md", agent("caller", { deps: ["subagent:contextscout"] }));
    const built = await plan({ root, targets: ["opencode"] });
    const registry = JSON.parse(built.files.find((f) => f.path === "built-ai-configs/registry/registry.json")!.content);
    const subagents = registry.components.subagents as Array<{ id: string; dependencies: string[]; aliases?: string[] }>;
    expect(subagents.find((e) => e.id === "caller")!.dependencies).toEqual(["subagent:context-scout"]);
    expect(subagents.find((e) => e.id === "context-scout")!.aliases).toEqual(["contextscout"]);
    expect(subagents.find((e) => e.id === "caller")!.aliases).toBeUndefined();
    expect(built.deprecations.some((d) => d.reason.includes('"contextscout"'))).toBe(true);
  });

  it("rewrites a stale profile agent id to the current id", async () => {
    put("agent-library/profiles/system/essential.json", JSON.stringify({ id: "essential", agents: ["contextscout"], contextProfiles: ["core"] }));
    put("agent-library/profiles/context/core.json", JSON.stringify({ id: "core", contexts: ["c1"] }));
    put(".opencode/context/c1.md", "# c1\n");
    const built = await plan({ root, targets: ["opencode"] });
    const registry = JSON.parse(built.files.find((f) => f.path === "built-ai-configs/registry/registry.json")!.content);
    expect(registry.profiles.essential.components).toContain("subagent:context-scout");
    expect(built.deprecations.some((d) => d.source.endsWith("profiles/system/essential.json"))).toBe(true);
  });

  it("fails the build when an alias is another agent's real id", async () => {
    put("agent-library/agents/core/other.md", agent("other", { aliases: ["context-scout"] }));
    await expect(plan({ root, targets: ["opencode"] })).rejects.toThrow(/collides with the id or name of "context-scout"/);
  });

  it("fails the build when two agents declare the same alias", async () => {
    put("agent-library/agents/core/other.md", agent("other", { aliases: ["contextscout"] }));
    await expect(plan({ root, targets: ["opencode"] })).rejects.toThrow(/declared by both/);
  });
});

describe("v1 and Claude Code alias emission", () => {
  const registryOf = (built: Awaited<ReturnType<typeof plan>>, file: string) =>
    JSON.parse(built.files.find((f) => f.path === file)!.content).components.subagents as Array<{ id: string; path: string; aliases?: string[]; supersedes?: string[] }>;

  it("emits aliases and the superseded paths on the v2 entry (the old flat file name)", async () => {
    const built = await plan({ root, targets: ["opencode"] });
    const entry = registryOf(built, "built-ai-configs/registry/registry.json").find((e) => e.id === "context-scout")!;
    expect(entry.aliases).toEqual(["contextscout"]);
    expect(entry.supersedes).toEqual([".opencode/agent/contextscout.md"]);
  });

  it("emits aliases and superseded paths on the v1 entry: the old name in the same folder plus each previousPaths entry", async () => {
    put("agent-library/agents/core/context-scout.md", agent("context-scout", { aliases: ["contextscout"], previous: ["subagents/core/contextscout.md"], targets: "[opencode, opencode-v1]" }));
    const built = await plan({ root, targets: ["opencode", "opencode-v1"] });
    const entry = registryOf(built, "built-ai-configs/registry/registry.v1.json").find((e) => e.id === "context-scout")!;
    expect(entry.path).toBe("built-ai-configs/opencode-v1/agent/core/context-scout.md");
    expect(entry.aliases).toEqual(["contextscout"]);
    expect(entry.supersedes).toEqual([
      "built-ai-configs/opencode-v1/agent/core/contextscout.md",
      "built-ai-configs/opencode-v1/agent/subagents/core/contextscout.md",
    ]);
    // previousPaths is OAC-only metadata: it never reaches the shipped agent file.
    expect(built.files.find((f) => f.path === "built-ai-configs/opencode-v1/agent/core/context-scout.md")!.content).not.toContain("previousPaths");
    // An agent with nothing to retire carries no field at all.
    put("agent-library/agents/core/plain.md", agent("plain", { targets: "[opencode, opencode-v1]" }));
    const again = await plan({ root, targets: ["opencode", "opencode-v1"] });
    expect(registryOf(again, "built-ai-configs/registry/registry.v1.json").find((e) => e.id === "plain")!.supersedes).toBeUndefined();
  });

  it("rejects a previousPaths entry that could escape the agent root", async () => {
    put("agent-library/agents/core/context-scout.md", agent("context-scout", { previous: ["../../etc/passwd.md"] }));
    await expect(plan({ root, targets: ["opencode"] })).rejects.toThrow();
  });

  it("records aliases on the Claude Code file in the build ledger, and resolves stale dependencies", async () => {
    put("agent-library/agents/core/context-scout.md", agent("context-scout", { aliases: ["contextscout"], targets: "[opencode, claude-code]" }));
    put("agent-library/agents/core/caller.md", agent("caller", { deps: ["subagent:contextscout"], targets: "[opencode, claude-code]" }));
    const built = await plan({ root, targets: ["opencode", "claude-code"] });
    const claude = built.files.find((f) => f.target === "claude-code" && f.agentId === "context-scout")!;
    expect(claude.agentAliases).toEqual(["contextscout"]);
    expect(built.deprecations.some((d) => d.reason.includes('"contextscout"'))).toBe(true);
  });
});

describe("AgentIdResolver aliases", () => {
  const roster = [
    { id: "code-reviewer", oacName: "CodeReviewer", name: "CodeReviewer", aliases: ["reviewer"] },
    { id: "context-scout", oacName: "ContextScout", name: "ContextScout", aliases: ["contextscout"] },
  ];

  it("resolves an alias to the canonical agent and records the use", () => {
    const r = AgentIdResolver.from(roster);
    expect(r.idFor("opencode", "reviewer")).toBe("code-reviewer");
    expect(r.idFor("opencode-v1", "reviewer")).toBe("CodeReviewer");
    expect(r.aliasUses.map((u) => u.alias)).toEqual(["reviewer", "reviewer"]);
  });

  it("reports an alias that merely normalises onto its own agent (contextscout) as an alias use", () => {
    const r = AgentIdResolver.from(roster);
    expect(r.resolve("contextscout")?.id).toBe("context-scout");
    expect(r.aliasUses).toEqual([{ alias: "contextscout", id: "context-scout" }]);
  });

  it("does not record the current id, the display name or a normalised spelling", () => {
    const r = AgentIdResolver.from(roster);
    for (const ref of ["context-scout", "ContextScout", "context_scout"]) expect(r.resolve(ref)?.id).toBe("context-scout");
    expect(r.aliasUses).toEqual([]);
  });

  it("rejects an alias equal to its own id, another id, or another alias", () => {
    expect(() => AgentIdResolver.from([{ ...roster[0]!, aliases: ["code-reviewer"] }])).toThrow(AgentIdResolutionError);
    expect(() => AgentIdResolver.from([{ ...roster[0]!, aliases: ["context-scout"] }, roster[1]!])).toThrow(/collides/);
    expect(() => AgentIdResolver.from([roster[0]!, { ...roster[1]!, aliases: ["reviewer"] }])).toThrow(/declared by both/);
  });
});

describe("the real library", () => {
  it("builds with no deprecated alias use: every reference was moved to the current id", async () => {
    expect((await plan({ root: repoPath() })).deprecations).toEqual([]);
  });

  it("registers the old ids as aliases on the renamed entries (install.sh matches on .aliases)", async () => {
    const built = await plan({ root: repoPath() });
    for (const path of ["built-ai-configs/registry/registry.json", "built-ai-configs/registry/registry.v1.json"]) {
      const registry = JSON.parse(built.files.find((f) => f.path === path)!.content);
      const byId = new Map<string, { aliases?: string[] }>(
        [...registry.components.subagents, ...registry.components.agents].map((e: { id: string; aliases?: string[] }) => [e.id, e]),
      );
      // The renames must stay reachable; a contributor may add more aliases beside them.
      expect(byId.get("test-engineer")!.aliases).toContain("tester");
      expect(byId.get("code-reviewer")!.aliases).toContain("reviewer");
      expect(byId.has("tester")).toBe(false);
    }
  });

  it("records every superseded path: the old flat names (v2) and the old v1 locations", async () => {
    const built = await plan({ root: repoPath() });
    const supersedes = (file: string, id: string): string[] | undefined => {
      const registry = JSON.parse(built.files.find((f) => f.path === file)!.content);
      return [...registry.components.subagents, ...registry.components.agents].find((e: { id: string }) => e.id === id)?.supersedes;
    };
    expect(supersedes("built-ai-configs/registry/registry.json", "test-engineer")).toContain(".opencode/agent/tester.md");
    expect(supersedes("built-ai-configs/registry/registry.json", "task-manager")).toBeUndefined();
    const v1 = "built-ai-configs/opencode-v1/agent";
    expect(supersedes("built-ai-configs/registry/registry.v1.json", "context-scout")).toEqual([
      `${v1}/core/contextscout.md`,
      `${v1}/subagents/core/contextscout.md`,
    ]);
    expect(supersedes("built-ai-configs/registry/registry.v1.json", "task-manager")).toEqual([`${v1}/subagents/core/task-manager.md`]);
  });

  it("records aliases in the build ledger (the drift gate keeps the committed ledger fresh)", () => {
    const ledger = JSON.parse(readFileSync(repoPath(".oac/build-manifest.json"), "utf-8"));
    expect(ledger.files["plugins/claude-code/agents/test-engineer.md"].aliases).toContain("tester");
    expect(ledger.files["plugins/claude-code/agents/coder-agent.md"].aliases).toBeUndefined();
  });
});
