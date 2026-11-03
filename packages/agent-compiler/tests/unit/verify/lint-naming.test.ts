import { describe, it, expect } from "vitest";
import { lintNaming, type NamingSubject } from "../../../src/verify/lint/naming.js";
import { CanonicalAgentLoader } from "../../../src/core/AgentLoader.js";
import { repoPath } from "../../support/pending.js";

const a = (relativePath: string, id: string, name?: string): NamingSubject => ({
  relativePath,
  oac: { id, overrides: name === undefined ? {} : { "claude-code": { name } } },
});
const rules = (s: NamingSubject): string[] => lintNaming([s]).map((f) => f.rule).sort();

describe("lintNaming", () => {
  it("passes a conforming agent", () => {
    expect(rules(a("core/context-scout.md", "context-scout"))).toEqual([]);
  });
  it("flags non-kebab ids", () => {
    expect(rules(a("core/ContextScout.md", "ContextScout"))).toContain("id-kebab-case");
  });
  it("flags filename != id", () => {
    expect(rules(a("code/test-engineer.md", "tester"))).toContain("filename-is-id");
  });
  it("flags -agent suffix", () => {
    expect(rules(a("code/coder-agent.md", "coder-agent"))).toContain("id-agent-suffix");
  });
  it("flags a subagents folder", () => {
    expect(rules(a("subagents/code/code-reviewer.md", "code-reviewer"))).toEqual(["subagents-folder"]);
  });
  it("flags a claude name override unless it equals the id", () => {
    expect(rules(a("core/x-scout.md", "x-scout", "XScout"))).toEqual(["host-name-override"]);
    expect(rules(a("core/x-scout.md", "x-scout", "x-scout"))).toEqual([]);
  });
  it("gives unknown suffixes an info note, not a warning", () => {
    const f = lintNaming([a("core/foo-thing.md", "foo-thing")]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "role-suffix", level: "info" });
  });
  it("accepts every vocabulary suffix", () => {
    expect(rules(a("core/x-engine.md", "x-engine"))).toEqual([]);
  });
  it("runs over the real library without throwing (report-only)", async () => {
    const agents = await new CanonicalAgentLoader(repoPath("agent-library/agents")).loadFromDirectory();
    expect(Array.isArray(lintNaming(agents))).toBe(true);
  });
});
