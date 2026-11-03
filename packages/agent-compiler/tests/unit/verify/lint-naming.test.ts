import { describe, it, expect } from "vitest";
import {
  lintNaming,
  derivedDisplayName,
  ROLE_SUFFIXES,
  type NamingSubject,
} from "../../../src/verify/lint/naming.js";
import { CanonicalAgentLoader } from "../../../src/core/AgentLoader.js";
import { repoPath } from "../../support/pending.js";

/** A subject whose category is the folder and whose display name is derived, so it is clean by default. */
const a = (
  relativePath: string,
  id: string,
  extra: { override?: string; display?: string; category?: string } = {},
): NamingSubject => ({
  relativePath,
  oac: {
    id,
    name: extra.display ?? derivedDisplayName(id),
    category: extra.category ?? relativePath.split("/").slice(0, -1).join("/"),
    overrides: extra.override === undefined ? {} : { "claude-code": { name: extra.override } },
  },
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
  it("flags -agent suffix, except the documented legacy exceptions", () => {
    expect(rules(a("code/review-agent.md", "review-agent"))).toContain("id-agent-suffix");
    expect(rules(a("code/coder-agent.md", "coder-agent"))).not.toContain("id-agent-suffix");
    expect(rules(a("code/build-agent.md", "build-agent"))).not.toContain("id-agent-suffix");
  });
  it("flags a subagents folder", () => {
    expect(rules(a("subagents/code/code-reviewer.md", "code-reviewer", { category: "subagents/code" }))).toEqual([
      "category-deprecated",
      "subagents-folder",
    ]);
  });
  it("flags a claude name override unless it equals the id", () => {
    expect(rules(a("core/x-scout.md", "x-scout", { override: "XScout" }))).toEqual(["host-name-override"]);
    expect(rules(a("core/x-scout.md", "x-scout", { override: "x-scout" }))).toEqual([]);
  });
  it("gives unknown suffixes an info note, not a warning", () => {
    const f = lintNaming([a("core/foo-thing.md", "foo-thing")]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "role-suffix", level: "info" });
  });
  it.each(ROLE_SUFFIXES)("accepts the vocabulary suffix -%s", (suffix) => {
    expect(rules(a(`core/x-${suffix}.md`, `x-${suffix}`))).toEqual([]);
  });
  it("flags run-together ids from the known-compound dictionary", () => {
    for (const [id, fix] of [["contextscout", "context-scout"], ["externalscout", "external-scout"]] as const) {
      const f = lintNaming([a(`core/${id}.md`, id)]).filter((x) => x.rule === "id-compound-word");
      expect(f).toHaveLength(1);
      expect(f[0]!.message).toContain(fix);
    }
    expect(rules(a("core/context-scout.md", "context-scout"))).not.toContain("id-compound-word");
  });

  describe("display-name", () => {
    it("derives PascalCase from the id, upper-casing listed acronyms", () => {
      expect(derivedDisplayName("context-scout")).toBe("ContextScout");
      expect(derivedDisplayName("adr-manager")).toBe("ADRManager");
    });
    it("flags a mismatch", () => {
      expect(rules(a("core/context-retriever.md", "context-retriever", { display: "Context Retriever" }))).toEqual(["display-name"]);
      expect(rules(a("core/eval-runner.md", "eval-runner", { display: "eval-runner" }))).toEqual(["display-name"]);
    });
    it("exempts brand ids and allows an Open prefix", () => {
      expect(rules(a("core/openagent.md", "openagent", { display: "OpenAgent" }))).toEqual([]);
      expect(rules(a("core/opencoder.md", "opencoder", { display: "OpenCoder" }))).toEqual([]);
      expect(rules(a("dev/devops-specialist.md", "devops-specialist", { display: "OpenDevopsSpecialist" }))).toEqual([]);
    });
    it("prefers the OpenCode frontmatter name over oac.name", () => {
      const s = { ...a("core/x-scout.md", "x-scout"), frontmatter: { name: "Wrong" } };
      expect(rules(s)).toEqual(["display-name"]);
    });
  });

  describe("category", () => {
    it("flags a deprecated category", () => {
      expect(rules(a("dev/x-runner.md", "x-runner", { category: "testing" }))).toContain("category-deprecated");
      expect(rules(a("dev/x-runner.md", "x-runner", { category: "development" }))).toContain("category-deprecated");
    });
    it("flags a folder that is not the category", () => {
      expect(rules(a("core/x-scout.md", "x-scout", { category: "code" }))).toEqual(["category-folder"]);
      expect(rules(a("x-scout.md", "x-scout", { category: "core" }))).toEqual(["category-folder"]);
    });
  });

  it("runs over the real library without throwing (report-only)", async () => {
    const agents = await new CanonicalAgentLoader(repoPath("agent-library/agents")).loadFromDirectory();
    expect(Array.isArray(lintNaming(agents))).toBe(true);
  });
});
