/**
 * OpenCodeAdapter — the OpenCode v2 target.
 *
 * v2 derives an agent's id from its FILE NAME and ignores `name:` (V2SRC
 * core/src/config/plugin/agent.ts L180-211), and resolves delegation by exact id. So the v2
 * emission differs from the pure `oac:` strip in exactly four ways, each pinned here:
 *   1. the file is written flat, as `<oac.id>.md`;
 *   2. the ignored `name:` line is dropped;
 *   3. `permission.task` keys become ids;
 *   4. `task(subagent_type=…)` examples become `subagent(agent=…)`.
 * The byte-preserving behaviour shared with v1 is covered by OpenCodeV1Adapter.test.ts.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import * as yaml from "js-yaml";
import { OpenCodeAdapter } from "../../../src/adapters/OpenCodeAdapter.js";
import { AgentIdResolver } from "../../../src/core/AgentIdResolver.js";
import { CanonicalAgentLoader, type CanonicalAgentFile } from "../../../src/core/AgentLoader.js";
import { repoPath } from "../../support/pending.js";

const adapter = (): OpenCodeAdapter => new OpenCodeAdapter();

const fm = (content: string): Record<string, unknown> =>
  yaml.load(/^---\n([\s\S]*?)\n---\n/.exec(content)![1]!) as Record<string, unknown>;

const SOURCE = [
  "---",
  "name: Caller",
  "description: d",
  "mode: subagent",
  "# keep this comment",
  "permission:",
  "  task:",
  '    "*": "deny"',
  "    contextscout: allow",
  "    TestEngineer: allow",
  "oac:",
  "  id: caller",
  "  name: Caller",
  "  category: core",
  "  type: subagent",
  "---",
  "",
  "Call ContextScout first.",
  'task(subagent_type="ContextScout", description="d")',
  "",
].join("\n");

const R = AgentIdResolver.from([
  { id: "caller", oacName: "Caller", name: "Caller" },
  { id: "contextscout", oacName: "ContextScout", name: "ContextScout" },
  { id: "tester", oacName: "TestEngineer", name: "TestEngineer" },
]);

describe("OpenCodeAdapter (v2) identity and layout", () => {
  it("is the opencode target, writing under .opencode/agent/", () => {
    expect(adapter().name).toBe("opencode");
    expect(adapter().getConfigPath()).toBe(".opencode/agent/");
  });

  it("writes a FLAT file named by oac.id, whatever the source's category directory", () => {
    expect(adapter().outputPath("subagents/code/test-engineer.md", "tester")).toBe(".opencode/agent/tester.md");
    expect(adapter().outputPath("core/openagent.md", "openagent")).toBe(".opencode/agent/openagent.md");
  });
});

describe("OpenCodeAdapter (v2) emission", () => {
  it("drops the ignored name: line and nothing else but oac:, keeping comments and order", async () => {
    const { content } = await adapter().fromCanonical(SOURCE, { resolver: R });
    expect(Object.keys(fm(content))).toEqual(["description", "mode", "permission"]);
    expect(content).toContain("# keep this comment");
    expect(content).not.toMatch(/^name:/m);
  });

  it("rewrites task keys to ids", async () => {
    const { content } = await adapter().fromCanonical(SOURCE, { resolver: R });
    const task = (fm(content)["permission"] as { task: Record<string, string> }).task;
    expect(Object.keys(task)).toEqual(["*", "contextscout", "tester"]);
  });

  it("rewrites the structured call but leaves prose alone", async () => {
    const { content } = await adapter().fromCanonical(SOURCE, { resolver: R });
    expect(content).toContain('subagent(agent="contextscout", description="d")');
    expect(content).toContain("Call ContextScout first.");
    expect(content).not.toContain("subagent_type");
  });

  it("rejects a reference that names no agent", async () => {
    await expect(
      adapter().fromCanonical(SOURCE.replace("TestEngineer: allow", "Ghost: allow"), { resolver: R })
    ).rejects.toThrow(/Ghost/);
  });

  it("without a resolver, emits refs as authored and says so", async () => {
    const { content, warnings } = await adapter().fromCanonical(SOURCE);
    expect(content).toContain("subagent_type");
    expect(warnings.join("\n")).toMatch(/resolver/i);
  });
});

describe("OpenCodeAdapter (v2) against the real corpus", () => {
  let agents: CanonicalAgentFile[];
  let resolver: AgentIdResolver;
  beforeAll(async () => {
    agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    resolver = AgentIdResolver.fromCanonical(agents);
  });

  const emit = (a: CanonicalAgentFile): Promise<{ content: string }> =>
    adapter().fromCanonical(readFileSync(a.filePath, "utf-8"), { filePath: a.filePath, resolver });

  it("reproduces every committed .opencode/agent/<id>.md byte-for-byte", async () => {
    const drifted: string[] = [];
    for (const a of agents) {
      const { content } = await emit(a);
      const committed = readFileSync(repoPath(adapter().outputPath(a.relativePath, a.oac.id)), "utf-8");
      if (content !== committed) drifted.push(a.oac.id);
    }
    expect(drifted).toEqual([]);
  });

  it("leaves no v1 vocabulary and no name: key in any v2 output", async () => {
    for (const a of agents) {
      const { content } = await emit(a);
      expect(content, a.oac.id).not.toMatch(/subagent_type/);
      expect(content, a.oac.id).not.toMatch(/(?<![\w.$])task\(/);
      expect(fm(content), a.oac.id).not.toHaveProperty("name");
    }
  });

  it("every task key and agent= value is an emitted v2 id (the #362 oracle)", async () => {
    const ids = new Set(agents.map((a) => a.oac.id));
    let refs = 0;
    for (const a of agents) {
      const { content } = await emit(a);
      const perm = fm(content)["permission"] as { task?: Record<string, string> } | undefined;
      for (const key of Object.keys(perm?.task ?? {})) {
        if (key === "*") continue;
        refs += 1;
        expect(ids.has(key), `${a.oac.id}: task key ${key}`).toBe(true);
      }
      for (const m of content.matchAll(/\bagent=(["'])([^"'\n]+)\1/g)) {
        if (/[[\]<>{}$]/.test(m[2]!)) continue;
        refs += 1;
        expect(ids.has(m[2]!), `${a.oac.id}: agent=${m[2]}`).toBe(true);
      }
    }
    expect(refs).toBeGreaterThan(80);
  });
});
