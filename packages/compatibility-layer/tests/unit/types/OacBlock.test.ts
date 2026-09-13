/**
 * Unit tests for the canonical `oac:` frontmatter block.
 *
 * The block is the canonical metadata carried by every authored agent. OpenCode rejects
 * unknown frontmatter keys, so `oac build` strips this authoring-only block on emit.
 *
 * The load-bearing test here is `accepts every entry in the real corpus` — a schema that
 * does not accept its own corpus is not a schema, it is a wish.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  OacBlockSchema,
  CanonicalAgentSchema,
  OacCategorySchema,
  BuildTargetsSchema,
} from "../../../src/types.js";
import { AgentLoader, CanonicalAgentLoader } from "../../../src/core/AgentLoader.js";

const VALID_BLOCK = {
  id: "openagent",
  name: "OpenAgent",
  category: "core",
  type: "agent",
  version: "1.0.0",
  author: "opencode",
  tags: ["universal", "coordination"],
  dependencies: ["subagent:contextscout", "context:standards-code"],
  targets: ["opencode", "claude-code"],
};

/**
 * A customer-style tree whose retired sidecar deliberately contradicts the authored agent.
 * The fixture, rather than a filesystem spy, makes sidecar use observable in loaded output.
 */
function createConflictingSidecarFixture(): {
  root: string;
  agentPath: string;
  contentRoot: string;
} {
  const root = mkdtempSync(join(tmpdir(), "oac-retired-sidecar-"));
  const agentPath = join(root, "content/agents/fixture-agent.md");
  const contentRoot = join(root, "content/agents");

  mkdirSync(dirname(agentPath), { recursive: true });
  writeFileSync(
    agentPath,
    `---
name: Canonical Fixture Agent
description: Canonical fixture metadata wins
mode: subagent
oac:
  id: canonical-fixture-agent
  name: Canonical Fixture Agent
  category: core
  type: agent
---
Fixture body.\n`,
    "utf-8"
  );
  mkdirSync(join(root, ".opencode/config"), { recursive: true });
  writeFileSync(
    join(root, ".opencode/config/agent-metadata.json"),
    `${JSON.stringify({
      agents: {
        "fixture-agent": {
          id: "sidecar-fixture-agent",
          name: "Sidecar Override",
          category: "meta",
          type: "subagent",
        },
      },
    })}\n`,
    "utf-8"
  );

  return { root, agentPath, contentRoot };
}

describe("OacBlockSchema", () => {
  describe("valid blocks", () => {
    it("accepts a fully populated block", () => {
      const result = OacBlockSchema.parse(VALID_BLOCK);

      expect(result.id).toBe("openagent");
      expect(result.targets).toEqual(["opencode", "claude-code"]);
    });

    it("normalizes flat typed dependency strings to { type, id }", () => {
      const result = OacBlockSchema.parse(VALID_BLOCK);

      expect(result.dependencies).toEqual([
        { type: "subagent", id: "contextscout" },
        { type: "context", id: "standards-code" },
      ]);
    });

    it("accepts structured dependency objects alongside the string form", () => {
      const result = OacBlockSchema.parse({
        ...VALID_BLOCK,
        dependencies: [{ type: "skill", id: "task-management" }, "context:standards-docs"],
      });

      expect(result.dependencies).toEqual([
        { type: "skill", id: "task-management" },
        { type: "context", id: "standards-docs" },
      ]);
    });

    it("accepts path-style dependency ids (registry uses them)", () => {
      const result = OacBlockSchema.parse({
        ...VALID_BLOCK,
        dependencies: ["context:core/standards/code-quality"],
      });

      expect(result.dependencies).toEqual([
        { type: "context", id: "core/standards/code-quality" },
      ]);
    });

    it("defaults version, author, tags, dependencies, targets and overrides", () => {
      const result = OacBlockSchema.parse({
        id: "contextscout",
        name: "ContextScout",
        category: "subagents/core",
        type: "subagent",
      });

      expect(result).toEqual({
        id: "contextscout",
        name: "ContextScout",
        category: "subagents/core",
        type: "subagent",
        version: "1.0.0",
        author: "opencode",
        tags: [],
        dependencies: [],
        targets: ["opencode"],
        // Overrides are opt-in: the common case is a component with nothing target-specific
        // to say, and it must stay writable without an empty ceremonial block.
        overrides: {},
      });
    });
  });

  describe("per-target overrides", () => {
    it("accepts a claude-code override", () => {
      const result = OacBlockSchema.safeParse({
        ...VALID_BLOCK,
        targets: ["opencode", "claude-code"],
        overrides: {
          "claude-code": {
            name: "code-reviewer",
            model: "sonnet",
            tools: ["Read", "Glob", "Grep"],
          },
        },
      });

      expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it("accepts a name-only override, for an agent whose tools need no restating", () => {
      const result = OacBlockSchema.parse({
        ...VALID_BLOCK,
        targets: ["opencode", "claude-code"],
        overrides: { "claude-code": { name: "code-reviewer" } },
      });

      expect(result.overrides["claude-code"]).toEqual({ name: "code-reviewer" });
    });

    it("rejects an unknown key inside an override (strict)", () => {
      const result = OacBlockSchema.safeParse({
        ...VALID_BLOCK,
        targets: ["opencode", "claude-code"],
        overrides: { "claude-code": { toolz: ["Read"] } },
      });

      expect(result.success).toBe(false);
    });

    it("rejects an override for an unknown target", () => {
      const result = OacBlockSchema.safeParse({
        ...VALID_BLOCK,
        overrides: { emacs: { name: "whatever" } },
      });

      expect(result.success).toBe(false);
    });

    it("rejects an override for a target this component does not emit to", () => {
      // Dead config: it looks like it is doing something and never runs. Almost always a
      // half-finished edit to `targets`, and silently ignoring it is how that ships.
      const result = OacBlockSchema.safeParse({
        ...VALID_BLOCK,
        targets: ["opencode"],
        overrides: { "claude-code": { name: "code-reviewer" } },
      });

      expect(result.success).toBe(false);
      expect(result.success ? "" : result.error.issues[0]?.message).toContain("not in targets");
    });
  });

  describe("rejected blocks", () => {
    it("rejects an unknown top-level key (strict)", () => {
      const result = OacBlockSchema.safeParse({ ...VALID_BLOCK, colour: "blue" });

      expect(result.success).toBe(false);
    });

    it("rejects targets: [] — a component that emits nowhere", () => {
      const result = OacBlockSchema.safeParse({ ...VALID_BLOCK, targets: [] });

      expect(result.success).toBe(false);
    });

    it("rejects an unknown target", () => {
      const result = OacBlockSchema.safeParse({ ...VALID_BLOCK, targets: ["emacs"] });

      expect(result.success).toBe(false);
    });

    it("rejects a non-kebab-case id", () => {
      for (const id of ["OpenAgent", "open_agent", "open agent", "-openagent", ""]) {
        expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, id }).success).toBe(false);
      }
    });

    it("rejects a missing id or name", () => {
      const { id: _id, ...noId } = VALID_BLOCK;
      const { name: _name, ...noName } = VALID_BLOCK;

      expect(OacBlockSchema.safeParse(noId).success).toBe(false);
      expect(OacBlockSchema.safeParse(noName).success).toBe(false);
    });

    it("rejects a non-SemVer version", () => {
      for (const version of ["1.0", "v1.0.0", "latest"]) {
        expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, version }).success).toBe(false);
      }
    });

    it("rejects an unknown category root", () => {
      expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, category: "kore" }).success).toBe(
        false
      );
    });

    it("rejects an untyped or unknown-typed dependency", () => {
      for (const dep of ["contextscout", "wizard:merlin", ":contextscout"]) {
        expect(
          OacBlockSchema.safeParse({ ...VALID_BLOCK, dependencies: [dep] }).success
        ).toBe(false);
      }
    });

    it("rejects an unknown type", () => {
      expect(OacBlockSchema.safeParse({ ...VALID_BLOCK, type: "plugin" }).success).toBe(
        false
      );
    });
  });

  describe("retired sidecar isolation", () => {
    it("loads canonical identity from the authored oac block when a conflicting sidecar exists", async () => {
      // Arrange
      const fixture = createConflictingSidecarFixture();
      const loader = new CanonicalAgentLoader(fixture.contentRoot);

      try {
        // Act
        const agents = await loader.loadFromDirectory();

        // Assert
        expect(agents).toHaveLength(1);
        expect(agents[0]?.oac).toMatchObject({
          id: "canonical-fixture-agent",
          name: "Canonical Fixture Agent",
        });
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });

    it("does not merge retired sidecar metadata into the legacy runtime loader", async () => {
      // Arrange
      const fixture = createConflictingSidecarFixture();
      const loader = new AgentLoader(fixture.root);

      try {
        // Act
        const agent = await loader.loadFromFile(fixture.agentPath);

        // Assert — intentionally RED until subtask 03 retires the runtime sidecar merge.
        expect(agent.metadata).toMatchObject({
          id: "fixture-agent",
          name: "Canonical Fixture Agent",
        });
      } finally {
        rmSync(fixture.root, { recursive: true, force: true });
      }
    });
  });
});

describe("OacCategorySchema", () => {
  it("accepts the corpus categories, including the subagents/* paths", () => {
    for (const category of ["core", "meta", "content", "data", "testing", "subagents/core"]) {
      expect(OacCategorySchema.safeParse(category).success).toBe(true);
    }
  });

  it("rejects deep paths and bad segments", () => {
    for (const category of ["subagents/core/extra", "subagents/Core", "/core", "core/"]) {
      expect(OacCategorySchema.safeParse(category).success).toBe(false);
    }
  });
});

describe("BuildTargetsSchema", () => {
  it("defaults to opencode when omitted", () => {
    expect(BuildTargetsSchema.parse(undefined)).toEqual(["opencode"]);
  });

  it("rejects an explicit empty list", () => {
    expect(BuildTargetsSchema.safeParse([]).success).toBe(false);
  });
});

describe("CanonicalAgentSchema", () => {
  const AGENT = {
    name: "OpenAgent",
    description: "Universal coordination agent",
    mode: "primary",
    oac: VALID_BLOCK,
  };

  it("accepts OpenCode-legal frontmatter plus an oac block", () => {
    const result = CanonicalAgentSchema.parse(AGENT);

    expect(result.oac.id).toBe("openagent");
    expect(result.mode).toBe("primary");
  });

  it("requires the oac block", () => {
    const { oac: _oac, ...withoutOac } = AGENT;

    expect(CanonicalAgentSchema.safeParse(withoutOac).success).toBe(false);
  });

  it("still requires OpenCode-legal frontmatter", () => {
    const { description: _description, ...withoutDescription } = AGENT;

    expect(CanonicalAgentSchema.safeParse(withoutDescription).success).toBe(false);
  });

  it("desugars authored permission map sugar into ordered rules", () => {
    const result = CanonicalAgentSchema.parse({
      ...AGENT,
      permission: { edit: "deny", bash: { "*": "deny", "ls*": "allow" } },
    });

    expect(result.permission).toEqual([
      { capability: "edit", rules: [{ pattern: "*", action: "deny" }] },
      {
        capability: "bash",
        rules: [
          { pattern: "*", action: "deny" },
          { pattern: "ls*", action: "allow" },
        ],
      },
    ]);
  });
});
