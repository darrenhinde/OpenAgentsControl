/**
 * `oac:only` host blocks through the whole build: a malformed or unknown-target marker in any
 * canonical file fails `plan()` (which `oac build`, `--check` and `--dry-run` all share, so the
 * CLI exits non-zero), and the error names the canonical file and line for every target.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { plan } from "../../../src/core/BuildPipeline.js";
import type { BuildTarget } from "../../../src/types.js";
import { FIRST_MARKER_LINE, HOST_BLOCK_SOURCE, UNKNOWN_TARGET_SOURCE } from "../../support/host-blocks.js";

const REL = "content/agents/core/probe.md";
const REGISTRY = {
  version: "1.0.0",
  metadata: { lastUpdated: "2026-01-01" },
  components: { agents: [], subagents: [], contexts: [] },
  profiles: {},
};

let root: string;

function put(relativePath: string, content: string): void {
  const absolute = join(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf-8");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oac-hostblocks-"));
  put("registry.json", `${JSON.stringify(REGISTRY, null, 2)}\n`);
  put("registry.v1.json", `${JSON.stringify(REGISTRY, null, 2)}\n`);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("oac build with oac:only host blocks", () => {
  it("emits each target's own section", async () => {
    put(REL, HOST_BLOCK_SOURCE);
    const built = await plan({ root, skipRegistry: true });
    const byTarget = new Map(built.files.map((file) => [file.target, file.content]));

    expect(byTarget.get("opencode")).toContain("V2-ONLY");
    expect(byTarget.get("opencode")).not.toMatch(/CLAUDE-ONLY|V1-ONLY/);
    expect(byTarget.get("opencode-v1")).toContain("V1-ONLY");
    expect(byTarget.get("opencode-v1")).not.toMatch(/CLAUDE-ONLY|V2-ONLY/);
    expect(byTarget.get("claude-code")).toContain("CLAUDE-ONLY");
    expect(byTarget.get("claude-code")).not.toMatch(/V1-ONLY|V2-ONLY|OPENCODE-ANY/);
  });

  for (const target of ["opencode", "opencode-v1", "claude-code"] as BuildTarget[]) {
    it(`fails the ${target} build on an unknown marker target, naming file and line`, async () => {
      put(REL, UNKNOWN_TARGET_SOURCE);
      const failure = plan({ root, targets: [target], skipRegistry: true });
      await expect(failure).rejects.toThrow(/unknown target "emacs"/);
      await expect(failure).rejects.toThrow(new RegExp(`${REL.replace(/\./g, "\\.")}:.*\\b${FIRST_MARKER_LINE}\\b`));
    });
  }
});
