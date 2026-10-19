/**
 * TargetPolicy — which build targets an agent is emitted to.
 *
 * `opencode-v1` follows `opencode` (an agent opts into OpenCode once and gets both builds), but
 * can also be declared ALONE to make an agent v1-only — how image-specialist, which needs a v1
 * tool that v2 cannot load, stays off the v2 install.
 */
import { describe, it, expect } from "vitest";
import { emitsTo } from "../../../src/core/TargetPolicy.js";

const agent = (...targets: string[]): { oac: { targets: string[] } } => ({ oac: { targets } });

describe("emitsTo", () => {
  it("opencode declares v2 and, implicitly, v1", () => {
    expect(emitsTo(agent("opencode"), "opencode")).toBe(true);
    expect(emitsTo(agent("opencode"), "opencode-v1")).toBe(true);
    expect(emitsTo(agent("opencode"), "claude-code")).toBe(false);
  });

  it("opencode-v1 alone is v1-only", () => {
    expect(emitsTo(agent("opencode-v1"), "opencode")).toBe(false);
    expect(emitsTo(agent("opencode-v1"), "opencode-v1")).toBe(true);
  });

  it("claude-code is independent of the OpenCode targets", () => {
    expect(emitsTo(agent("claude-code"), "opencode")).toBe(false);
    expect(emitsTo(agent("claude-code"), "opencode-v1")).toBe(false);
    expect(emitsTo(agent("claude-code"), "claude-code")).toBe(true);
  });
});
