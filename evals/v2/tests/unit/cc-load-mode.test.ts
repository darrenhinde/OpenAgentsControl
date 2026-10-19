import { describe, expect, it, vi } from "vitest";

// The validate checks must report the sandbox mode that actually ran, not a hard-coded
// "seatbelt" (wrong under OAC_SANDBOX=iso or off macOS). Every effect is mocked.

vi.mock("node:fs", async (importOriginal) => ({ ...(await importOriginal<typeof import("node:fs")>()), cpSync: vi.fn() }));
vi.mock("../../src/sandbox/env.ts", () => ({
  sandboxMode: () => "iso",
  makeIsoDirs: () => ({ root: "/r", work: "/r/work", home: "/r/home", cache: "/r/cache" }),
  isoEnv: () => ({}),
  safePath: () => "/usr/bin",
  runIsolated: vi.fn(async () => ({ code: 0, out: "", ms: 1, timedOut: false })),
}));
vi.mock("../../src/checks/helpers.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/checks/helpers.ts")>()),
  cachedWhich: vi.fn(async () => "/bin/claude"),
}));

import { ccLoadChecks } from "../../src/checks/cc-load.ts";
import type { RunContext } from "../../src/core/types.ts";

const ctx: RunContext = {
  checkId: "cc/plugin-validate", workload: "host-check", repo: "/repo", runDir: "/run", tmpRoot: "/tmp/x",
  runId: "1", tier: "hosts", log: () => {}, logPath: "/run/x.log", artifactDir: () => "/run/a", shared: new Map(),
};

describe("cc validate checks: reported sandbox mode", () => {
  it.each(["cc/plugin-validate", "cc/marketplace-validate"])("%s reports sandboxMode(), not a hard-coded seatbelt", async (id) => {
    // Arrange
    const check = ccLoadChecks.find((c) => c.id === id);
    // Act
    const outcome = await check?.run({ ...ctx, checkId: id });
    // Assert
    expect(outcome?.sandbox?.mode).toBe("iso");
  });
});
