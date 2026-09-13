/**
 * Schema validation at the FILE level: every `.md` in `content/` must parse against the
 * `oac:` schema.
 *
 * `tests/unit/types/OacBlock.test.ts` (subtask 02) already covers the schema as an object
 * API. This suite covers the thing that actually ships: a markdown file on disk, its YAML
 * frontmatter, and the corpus under `content/`. The distinction matters — a schema can be
 * perfect and still reject every real file over a quoting or nesting detail.
 *
 * `content/` is authored by subtask 09, in parallel with this one. Until it lands the corpus
 * tests are red with a sentence naming subtask 09, not an ENOENT stack trace.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { basename, relative } from "node:path";
import matter from "gray-matter";
import { CanonicalAgentSchema, OacBlockSchema } from "../../../src/types.js";
import { listFiles, packagePath, requireDir } from "../../support/pending.js";

const OWED_BY = "subtask 09 (content/agents/)";
const FIXTURE = packagePath("tests/golden/fixtures/fixture-reviewer.md");

/**
 * Parse a file's frontmatter into a FRESH object.
 *
 * gray-matter memoises by input string and hands back the same `data` object every time, so
 * a test that mutates it silently corrupts every later test parsing the same source. Cloning
 * at the boundary keeps these tests independent — which is the whole point of the mutation
 * helpers below.
 */
function frontmatterOf(source: string): Record<string, unknown> {
  return structuredClone(matter(source).data) as Record<string, unknown>;
}

/** Parse a canonical agent file the way the build will: frontmatter -> schema. */
function parseFile(source: string): ReturnType<typeof CanonicalAgentSchema.safeParse> {
  return CanonicalAgentSchema.safeParse(frontmatterOf(source));
}

function fixtureSource(): string {
  return readFileSync(FIXTURE, "utf-8");
}

/** The fixture's frontmatter with its `oac:` block mutated. Never touches the cached parse. */
function withOac(mutate: (oac: Record<string, unknown>) => void): unknown {
  const data = frontmatterOf(fixtureSource());
  mutate(data.oac as Record<string, unknown>);
  return data;
}

/** The fixture's frontmatter with a top-level key removed. */
function without(key: string): unknown {
  const data = frontmatterOf(fixtureSource());
  delete data[key];
  return data;
}

// ============================================================================
// Green today — file-level parsing against the schema that landed in subtask 02
// ============================================================================

describe("canonical agent files", () => {
  it("accepts a valid canonical agent file", () => {
    const result = parseFile(fixtureSource());

    expect(
      result.success ? [] : result.error.issues,
      "the golden fixture must satisfy the canonical schema"
    ).toEqual([]);
  });

  it("carries the oac block through from YAML frontmatter", () => {
    const result = parseFile(fixtureSource());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.oac.id).toBe("fixture-reviewer");
    expect(result.data.oac.category).toBe("subagents/test");
    expect(result.data.oac.targets).toEqual(["opencode", "claude-code"]);
    expect(result.data.oac.dependencies).toEqual([{ type: "context", id: "standards-code" }]);
  });

  it("desugars the authored permission map into ordered rules, preserving source order", () => {
    const result = parseFile(readFileSync(packagePath("tests/golden/fixtures/fixture-planner.md"), "utf-8"));

    expect(result.success).toBe(true);
    if (!result.success) return;

    const bash = result.data.permission?.find((entry) => entry.capability === "bash");

    // The catch-all deny is FIRST and the git allows come after it. Under last-match-wins
    // that is what makes `git status` allowed; any reordering silently changes the outcome.
    expect(bash?.rules).toEqual([
      { pattern: "*", action: "deny" },
      { pattern: "git status", action: "allow" },
      { pattern: "git log*", action: "allow" },
    ]);
  });

  it("rejects a file with no oac block", () => {
    expect(CanonicalAgentSchema.safeParse(without("oac")).success).toBe(false);
  });

  it("rejects an unknown key inside the oac block", () => {
    const data = withOac((oac) => {
      oac.colour = "blue";
    });

    expect(CanonicalAgentSchema.safeParse(data).success).toBe(false);
  });

  it("rejects an empty targets list", () => {
    const data = withOac((oac) => {
      oac.targets = [];
    });

    expect(CanonicalAgentSchema.safeParse(data).success).toBe(false);
  });

  it("rejects an unknown category root", () => {
    const data = withOac((oac) => {
      oac.category = "kore";
    });

    expect(CanonicalAgentSchema.safeParse(data).success).toBe(false);
  });

  it("rejects a bad build target", () => {
    const data = withOac((oac) => {
      oac.targets = ["emacs"];
    });

    expect(CanonicalAgentSchema.safeParse(data).success).toBe(false);
  });

  it("rejects an agent file whose frontmatter is not OpenCode-legal", () => {
    expect(CanonicalAgentSchema.safeParse(without("description")).success).toBe(false);
  });
});

// ============================================================================
// CANONICAL CORPUS — real authored files and the registry-carried exception
// ============================================================================

describe("content/agents corpus", () => {
  it("every file parses against the canonical schema", () => {
    const dir = requireDir(
      "content/agents",
      OWED_BY,
      "every authored agent file parses against the oac: schema, with no unknown fields and " +
        "no bad categories"
    );

    const rejected = listFiles(dir)
      .map((file) => ({ file, result: parseFile(readFileSync(file, "utf-8")) }))
      .filter(({ result }) => !result.success)
      .map(
        ({ file, result }) =>
          `  ${relative(packagePath("../.."), file)}\n    ${JSON.stringify(
            result.success ? [] : result.error.issues
          )}`
      );

    expect(rejected.join("\n") || "", "files rejected by CanonicalAgentSchema").toBe("");
  });

  it("deliberately excludes registry-carried eval-runner from the canonical corpus", () => {
    // Arrange
    const dir = requireDir(
      "content/agents",
      OWED_BY,
      "the canonical corpus must be available to verify its registry-carried exception"
    );
    const canonical = new Set(listFiles(dir).map((file) => basename(file, ".md")));

    // Act
    const hasEvalRunner = canonical.has("eval-runner");

    // Assert
    expect(
      hasEvalRunner,
      "eval-runner is deliberately registry-carried and must not become a canonical source requirement"
    ).toBe(false);
  });

  it("gives every agent a unique oac id", () => {
    const dir = requireDir(
      "content/agents",
      OWED_BY,
      "agent ids are unique, so the build can address each agent unambiguously"
    );

    // NB: the id deliberately does NOT have to match the filename. `test-engineer.md` declares
    // id `tester`; the id is the identity and the path is just where it sits.
    const ids = listFiles(dir).flatMap((file) => {
      const { data } = matter(readFileSync(file, "utf-8"));
      const parsed = OacBlockSchema.safeParse(data.oac);
      return parsed.success ? [{ file: basename(file), id: parsed.data.id }] : [];
    });

    const duplicated = ids.filter(
      (entry, at) => ids.findIndex((other) => other.id === entry.id) !== at
    );

    expect(duplicated, "two agents share an oac id").toEqual([]);
    expect(ids.length, "no agent file parsed — is content/agents/ populated?").toBeGreaterThan(0);
  });

  it("emits no oac: key into any generated OpenCode agent file", () => {
    // The inverse of the corpus check: `oac:` is authoring-only. If it survives into
    // .opencode/agent/**, OpenCode rejects the file as an unknown field.
    const generated = listFiles(requireDir(".opencode/agent", "n/a — already on disk", "n/a"));
    const leaked = generated.filter((file) => {
      const { data } = matter(readFileSync(file, "utf-8"));
      return data.oac !== undefined;
    });

    expect(leaked.map((file) => relative(packagePath("../.."), file))).toEqual([]);
  });
});
