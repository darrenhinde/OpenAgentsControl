/**
 * AgentIdResolver — one alias table, two id spaces.
 *
 * v1 registers an agent under its frontmatter `name:`; v2 under its file name, which the build
 * makes `oac.id`. The resolver is the single place that knows both, so a delegation reference
 * written in ANY accepted spelling resolves to the right id for the target being emitted.
 */
import { describe, it, expect } from "vitest";
import {
  AgentIdResolver,
  AgentIdResolutionError,
  normalizeAlias,
  type ResolverAgent,
} from "../../../src/core/AgentIdResolver.js";
import { CanonicalAgentLoader } from "../../../src/core/AgentLoader.js";
import { repoPath } from "../../support/pending.js";

const A: ResolverAgent[] = [
  { id: "contextscout", oacName: "ContextScout", name: "ContextScout" },
  { id: "tester", oacName: "TestEngineer", name: "TestEngineer" },
  { id: "documentation", oacName: "DocWriter", name: "DocWriter" },
  { id: "context-retriever", oacName: "Context Retriever", name: "Context Retriever" },
];

describe("normalizeAlias", () => {
  it("lowercases and drops every non-alphanumeric", () => {
    expect(normalizeAlias("Context Retriever")).toBe("contextretriever");
    expect(normalizeAlias("context-retriever")).toBe("contextretriever");
    expect(normalizeAlias("ContextScout")).toBe("contextscout");
  });
});

describe("AgentIdResolver.resolve", () => {
  const r = AgentIdResolver.from(A);

  it("accepts the oac id, the display name, and a case-different spelling", () => {
    for (const ref of ["tester", "TestEngineer", "testengineer", "TESTENGINEER"]) {
      expect(r.resolve(ref)?.id, ref).toBe("tester");
    }
  });

  it("returns undefined for an unknown reference", () => {
    expect(r.resolve("nobody")).toBeUndefined();
  });

  it("resolves spaced and kebab spellings of one agent to the same agent", () => {
    expect(r.resolve("Context Retriever")?.id).toBe("context-retriever");
    expect(r.resolve("context-retriever")?.id).toBe("context-retriever");
  });
});

describe("AgentIdResolver.idFor", () => {
  const r = AgentIdResolver.from(A);

  it("v2 yields the oac id", () => {
    expect(r.idFor("opencode", "TestEngineer")).toBe("tester");
    expect(r.idFor("opencode", "documentation")).toBe("documentation");
  });

  it("v1 yields the frontmatter name, so v1 matches what the host registers", () => {
    expect(r.idFor("opencode-v1", "tester")).toBe("TestEngineer");
    expect(r.idFor("opencode-v1", "contextscout")).toBe("ContextScout");
    expect(r.idFor("opencode-v1", "Context Retriever")).toBe("Context Retriever");
  });

  it("passes globs through untouched on both targets", () => {
    for (const target of ["opencode", "opencode-v1"] as const) {
      expect(r.idFor(target, "*")).toBe("*");
      expect(r.idFor(target, "context*")).toBe("context*");
    }
  });

  it("throws, naming the reference, when nothing matches", () => {
    expect(() => r.idFor("opencode", "ghost")).toThrow(AgentIdResolutionError);
    expect(() => r.idFor("opencode", "ghost")).toThrow(/ghost/);
  });
});

describe("AgentIdResolver.from rejects ambiguity", () => {
  it("two agents sharing a normalised alias", () => {
    expect(() =>
      AgentIdResolver.from([
        { id: "alpha-one", oacName: "AlphaOne", name: "AlphaOne" },
        { id: "alphaone", oacName: "Other", name: "Other" },
      ]),
    ).toThrow(/ambiguous|collid/i);
  });

  it("duplicate ids", () => {
    expect(() =>
      AgentIdResolver.from([
        { id: "a", oacName: "A", name: "A" },
        { id: "a", oacName: "B", name: "B" },
      ]),
    ).toThrow(/duplicate|collid|ambiguous/i);
  });
});

describe("the real corpus", () => {
  it("builds without ambiguity and maps every id to a unique v1 name", async () => {
    const agents = await new CanonicalAgentLoader(repoPath("content/agents")).loadFromDirectory();
    const r = AgentIdResolver.fromCanonical(agents);
    const names = agents.map((a) => r.idFor("opencode-v1", a.oac.id));
    const ids = agents.map((a) => r.idFor("opencode", a.oac.id));
    expect(new Set(names).size).toBe(agents.length);
    expect(ids).toEqual(agents.map((a) => a.oac.id));
    expect(r.idFor("opencode", "TestEngineer")).toBe("tester");
    expect(r.idFor("opencode-v1", "tester")).toBe("TestEngineer");
  });
});
