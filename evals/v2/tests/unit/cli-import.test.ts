import { describe, expect, it, vi } from "vitest";

// U3, tests-first (component-p1-2.md): importing the orchestration entry module is
// side-effect-free. src/main.ts holds main(); src/cli.ts stays the executable entry that
// calls it, so `tsx src/cli.ts` (root and evals/v2 test:local) keeps working unchanged.
// Importing main.ts must spawn nothing, register no process listeners and not exit.

const execMock = vi.hoisted(() => vi.fn());
const whichMock = vi.hoisted(() => vi.fn());
vi.mock("../../src/core/exec.ts", () => ({ exec: execMock, which: whichMock }));

describe("src/main.ts import: no side effects", () => {
  it("exports main without spawning, registering process listeners or exiting", async () => {
    // Arrange
    const exitListeners = process.listenerCount("exit");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    // Act
    const mod = await import("../../src/main.ts");
    // Assert
    expect(typeof mod.main).toBe("function");
    expect(execMock).not.toHaveBeenCalled();
    expect(whichMock).not.toHaveBeenCalled();
    expect(process.listenerCount("exit")).toBe(exitListeners);
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });
});
