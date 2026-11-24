import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { isRetirablePath, loadRetired } from "../../../src/core/RetiredFiles.js";

const H = "a".repeat(64);
let root: string;
const put = (entries: unknown): void => {
  const file = join(root, "agent-library/retired.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ retired: entries }));
};

beforeEach(() => { root = mkdtempSync(join(tmpdir(), "oac-retired-")); });
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("retired.json", () => {
  it("is an empty list when the file is absent", () => {
    expect(loadRetired(root, [])).toEqual([]);
  });

  it("accepts and sorts entries under the three retirable folders", () => {
    put([
      { path: ".opencode/skills/x/a.md", sha256: [H] },
      { path: ".opencode/command/g/a.md", sha256: [H], replacedBy: "docs/a.md" },
      { path: ".opencode/agent/a.md", sha256: [H] },
    ]);
    expect(loadRetired(root, []).map((e) => e.path)).toEqual([".opencode/agent/a.md", ".opencode/command/g/a.md", ".opencode/skills/x/a.md"]);
  });

  it("accepts the OAC-owned contributor docs under context/openagents-repo/", () => {
    expect(isRetirablePath(".opencode/context/openagents-repo/guides/creating-subagents.md")).toBe(true);
  });

  it.each([
    ".opencode/context/index.md",
    ".opencode/context/project/x.md",
    ".opencode/context/project-intelligence/x.md",
    ".opencode/context/openagents-repo/",
    ".opencode/tool/x.ts",
    ".opencode/command/../context/x.md",
    ".opencode/command/./x.md",
    ".opencode\\command\\x.md",
    ".opencode/command/",
    "/etc/passwd",
    "../x.md",
    "built-ai-configs/opencode/command/x.md",
  ])("rejects the path %s", (path) => {
    expect(isRetirablePath(path)).toBe(false);
    put([{ path, sha256: [H] }]);
    expect(() => loadRetired(root, [])).toThrow(/must be a normalised path under/);
  });

  it("rejects a bad hash, an unknown key, a duplicate, and a path a component still ships", () => {
    put([{ path: ".opencode/command/x.md", sha256: ["abc"] }]);
    expect(() => loadRetired(root, [])).toThrow(/sha256/);
    put([{ path: ".opencode/command/x.md", sha256: [H], extra: 1 }]);
    expect(() => loadRetired(root, [])).toThrow(/invalid/);
    put([{ path: ".opencode/command/x.md", sha256: [H] }, { path: ".opencode/command/x.md", sha256: [H] }]);
    expect(() => loadRetired(root, [])).toThrow(/duplicate/);
    put([{ path: ".opencode/command/x.md", sha256: [H] }]);
    expect(() => loadRetired(root, [".opencode/command/x.md"])).toThrow(/still shipped/);
    // the v1 registry spells the same destination differently
    expect(() => loadRetired(root, ["built-ai-configs/opencode-v1/command/x.md"])).toThrow(/still shipped/);
  });
});
