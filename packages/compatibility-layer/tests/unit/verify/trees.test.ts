/**
 * The committed trees: what lives in `.opencode/` (v2) and `v1-opencode/` (v1), and that both
 * registries point only at files that exist.
 *
 * `v1-opencode/` is a display copy of the v1 build; installs write its contents into the user's
 * `.opencode/`. These tests pin the split: anything OpenCode v2 cannot load lives ONLY under
 * `v1-opencode/`, and the few hand-authored files that carry delegation examples exist as a v1
 * variant plus a v2 file derived from it.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { AgentIdResolver } from "../../../src/core/AgentIdResolver.js";
import { CanonicalAgentLoader } from "../../../src/core/AgentLoader.js";
import { rewriteBodyRefs } from "../../../src/core/DelegationRewriter.js";
import { lintV1Agents, lintV1Artifacts } from "../../../src/verify/lint/opencode.js";
import { repoPath } from "../../support/pending.js";

const walk = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.name === "node_modules" ? [] : e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      );
const posix = (p: string): string => relative(repoPath(), p).split(sep).join("/");

/** Hand-authored files whose delegation examples differ by target: v1 variant -> v2 file. */
const VARIANTS: Array<[v1: string, v2: string]> = [
  ["v1-opencode/command/openagents/check-context-deps.md", ".opencode/command/openagents/check-context-deps.md"],
  ["v1-opencode/skills/task-management/SKILL.md", ".opencode/skills/task-management/SKILL.md"],
];

describe("registries only name files that exist", () => {
  for (const file of ["registry.json", "registry.v1.json"]) {
    it(`${file}: every path and files[] entry is on disk`, () => {
      const registry = JSON.parse(readFileSync(repoPath(file), "utf-8")) as {
        components: Record<string, Array<{ id: string; path?: string; files?: string[] }>>;
      };
      const missing: string[] = [];
      for (const [category, entries] of Object.entries(registry.components)) {
        for (const entry of entries) {
          for (const path of [entry.path, ...(entry.files ?? [])]) {
            if (path === undefined || path.includes("*")) continue;
            if (!existsSync(repoPath(path))) missing.push(`${category}:${entry.id} -> ${path}`);
          }
        }
      }
      expect(missing).toEqual([]);
    });
  }
});

describe(".opencode/ is a v2 tree", () => {
  it("has no tool/, plugin/ or plugins/ directory", () => {
    for (const rel of [".opencode/tool", ".opencode/plugin", ".opencode/plugins"]) {
      expect(existsSync(repoPath(rel)), rel).toBe(false);
    }
  });

  it("has no hand-authored command/skill/skill file still speaking v1 delegation", () => {
    const offenders = [".opencode/command", ".opencode/skill", ".opencode/skills"]
      .flatMap((d) => walk(repoPath(d)))
      .filter((f) => f.endsWith(".md"))
      .filter((f) => /subagent_type|(?<![\w.$])task\(/.test(readFileSync(f, "utf-8")))
      .map(posix);
    expect(offenders).toEqual([]);
  });
});

describe("v1-opencode/ carries everything v2 cannot load", () => {
  it("holds the v1 tools and plugins, all written against the v1 plugin API", () => {
    // The modules OpenCode v1 actually loads: tool/<name>/index.ts, plugin/*.ts, plugins/<name>/index.ts.
    const entries = [...walk(repoPath("v1-opencode/tool")), ...walk(repoPath("v1-opencode/plugin")), ...walk(repoPath("v1-opencode/plugins"))]
      .map(posix)
      .filter((p) => /^v1-opencode\/(tool\/[^/]+\/index|tool\/index|plugin\/[^/]+|plugins\/[^/]+\/index)\.ts$/.test(p))
      .filter((p) => !/\.d\.ts$/.test(p));
    expect(entries.length).toBeGreaterThanOrEqual(5);
    expect(lintV1Artifacts(entries.map((path) => ({ path, text: readFileSync(repoPath(path), "utf-8") })))).toEqual([]);
  });

  it("holds the v1 category metadata that only the nested layout uses", () => {
    expect(existsSync(repoPath("v1-opencode/agent/core/0-category.json"))).toBe(true);
    expect(existsSync(repoPath(".opencode/agent/core"))).toBe(false);
  });

  it("holds v1 variants of the hand-authored files whose delegation examples differ", () => {
    for (const [v1] of VARIANTS) expect(existsSync(repoPath(v1)), v1).toBe(true);
  });
});

describe("delegation examples in hand-authored carried files", () => {
  let resolver: AgentIdResolver;
  beforeAll(async () => {
    resolver = AgentIdResolver.fromCanonical(await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory());
  });

  it.each(VARIANTS)("%s is the v1 text, and %s is exactly its v2 rewrite", (v1, v2) => {
    const v1Text = readFileSync(repoPath(v1), "utf-8");
    expect(v1Text).toMatch(/subagent_type/);
    const dead: string[] = [];
    const derived = rewriteBodyRefs(v1Text, "opencode", resolver, { unknown: "keep", onUnknown: (v) => dead.push(v) });
    expect(readFileSync(repoPath(v2), "utf-8")).toBe(derived);
    // A reference to an agent that does not exist is a pre-existing bug in the command, on both hosts.
    expect([...new Set(dead)]).toEqual(v1.includes("check-context-deps") ? ["PatternAnalyst"] : []);
  });

  it.each(VARIANTS)("%s names only agents that exist under their v1 names", (v1) => {
    const text = readFileSync(repoPath(v1), "utf-8");
    const names = [...text.matchAll(/subagent_type\s*=\s*"([^"]+)"/g)].map((m) => m[1]!);
    for (const name of names.filter((n) => n !== "PatternAnalyst")) expect(resolver.idFor("opencode-v1", name)).toBe(name);
  });

  it("the v1 agent tree passes the v1 lint as committed", () => {
    const files = walk(repoPath("v1-opencode/agent"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ path: posix(f), text: readFileSync(f, "utf-8") }));
    expect(files.length).toBeGreaterThan(30);
    expect(lintV1Agents(files)).toEqual([]);
  });
});
