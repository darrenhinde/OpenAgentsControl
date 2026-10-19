/**
 * OpenCodeV1Adapter — the v1 target. Unit 1 pins that it is today's behaviour, moved: the
 * emission is the canonical file minus its `oac:` block, written under `v1-opencode/agent/`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { OpenCodeAdapter } from "../../../src/adapters/OpenCodeAdapter.js";
import { OpenCodeV1Adapter, OPENCODE_V1_AGENT_ROOT } from "../../../src/adapters/v1/OpenCodeV1Adapter.js";
import { listFiles, repoPath } from "../../support/pending.js";

describe("OpenCodeV1Adapter identity", () => {
  it("names itself opencode-v1 and writes under v1-opencode/agent/", () => {
    const adapter = new OpenCodeV1Adapter();
    expect(adapter.name).toBe("opencode-v1");
    expect(OPENCODE_V1_AGENT_ROOT).toBe("v1-opencode/agent");
    expect(adapter.outputPath("subagents/code/coder-agent.md")).toBe("v1-opencode/agent/subagents/code/coder-agent.md");
    expect(adapter.getConfigPath()).toBe("v1-opencode/agent/");
  });

  it("is a separate target from v2", () => {
    expect(new OpenCodeV1Adapter().name).not.toBe(new OpenCodeAdapter().name);
  });
});

describe("OpenCodeV1Adapter emission", () => {
  it("strips the oac block and keeps the name: line and body", async () => {
    const source = readFileSync(repoPath("content/agents/subagents/code/coder-agent.md"), "utf-8");
    const { content } = await new OpenCodeV1Adapter().fromCanonical(source);
    expect(content).not.toMatch(/^oac:/m);
    expect(content).toMatch(/^name: CoderAgent$/m);
    expect(content).toContain("# CoderAgent");
  });

  it("emits every canonical agent without throwing", async () => {
    const files = listFiles(repoPath("content/agents"), ".md");
    expect(files.length).toBe(33);
    for (const file of files) await new OpenCodeV1Adapter().fromCanonical(readFileSync(file, "utf-8"), { filePath: file });
  });
});
