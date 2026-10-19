import { afterEach, describe, expect, it } from "vitest";
import { planMessages, startFakeModel, type FakeModel } from "../../../../packages/compatibility-layer/src/verify/fake-model/server.ts";
import { gradeArm, type Observation } from "../../../../packages/compatibility-layer/src/verify/outcomes.ts";
import { flattenScript, normalizeIncludes, substitute, unsupportedReason, variants } from "../../../../packages/compatibility-layer/src/verify/runner.ts";
import { Scenario, loadScenarios } from "../../../../packages/compatibility-layer/src/verify/scenario-schema.ts";
import { SCENARIO_DIR } from "../../src/checks/scenarios.ts";

let m: FakeModel | undefined;
afterEach(async () => {
  await m?.stop();
  m = undefined;
});

const post = async (url: string, body: unknown): Promise<string> =>
  (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).text();

describe("scenario files", () => {
  it("every seed parses and names its file after its id", () => {
    const files = loadScenarios(SCENARIO_DIR);
    expect(files.length).toBeGreaterThanOrEqual(44);
    expect(files.map((f) => f.scenario.id)).toContain("secrets/read-env");
  });
});

describe("planMessages", () => {
  it("folds a say into the next tool turn, skips if_offered turns, and ends on done", () => {
    const plan = planMessages(
      [{ call: "say", text: "hi" }, { call: "write", path: "x", if_offered: true }, { call: "read", path: "a" }, { call: "done" }, { call: "read", path: "never" }],
      "anthropic",
      new Set(["Read"]),
    );
    expect(plan).toEqual([
      { steps: [0, 2], text: "hi", tool: { step: 2, turn: { call: "read", path: "a" }, name: "Read" } },
      { steps: [3], text: "Done." },
    ]);
  });

  it("stops with `missing` when a required tool is not offered, and maps delegate to Agent on CC", () => {
    expect(planMessages([{ call: "shell", command: "ls" }], "openai", new Set(["read"]))[0]?.missing).toBe("shell");
    expect(planMessages([{ call: "delegate", agent: "x" }], "anthropic", new Set(["Agent"]))[0]?.tool?.name).toBe("Agent");
  });
});

describe("fake model", () => {
  it("fills write/edit arguments from the host schema and names calls _oac<k>", async () => {
    m = await startFakeModel({ script: [{ call: "edit", path: "a.ts", old: "1", new: "2" }, { call: "write", path: "b.ts", content: "x" }] });
    const tools = [
      { type: "function", function: { name: "edit", parameters: { properties: { filePath: {}, oldString: {}, newString: {} } } } },
      { type: "function", function: { name: "write", parameters: { properties: { filePath: {}, content: {} } } } },
    ];
    const first = await post(`${m.url}/v1/chat/completions`, { messages: [{ role: "user", content: "go" }], tools });
    expect(first).toContain("call_oac0");
    expect(first).toContain('\\"oldString\\":\\"1\\"');
    // History that dropped the assistant message but kept the tool result still advances.
    const second = await post(`${m.url}/v1/chat/completions`, { messages: [{ role: "user", content: "go" }, { role: "tool", tool_call_id: "call_oac0", content: "ok" }], tools });
    expect(second).toContain('\\"content\\":\\"x\\"');
    expect(m.requests.map((r) => r.steps)).toEqual([[0], [1]]);
  });
});

describe("runner planning", () => {
  it("substitutes nested placeholders and expands include / repeat", () => {
    const vars = { W: "/w", target: { path: "opencode.json", how: "shell", command: "echo > opencode.json" } };
    const script = substitute(normalizeIncludes([{ include: "${target.how}" }, { call: "edit", repeat: 2, path: "src/f${i}.ts" }]), vars);
    expect(flattenScript(script, "claude-code", () => false)).toEqual([
      { call: "shell", command: "echo > opencode.json" },
      { call: "edit", path: "src/f1.ts" },
      { call: "edit", path: "src/f2.ts" },
    ]);
    expect(flattenScript(substitute(normalizeIncludes([{ include: "${t.how}" }]), { t: { path: "a", how: "write", content: "c" } }), "opencode-v2", () => true)).toEqual([
      { call: "read", path: "a" },
      { call: "write", path: "a", content: "c" },
    ]);
  });

  it("drops matrix values restricted to other hosts and explains unsupported scenarios", () => {
    const s = Scenario.parse({
      id: "x/y", title: "t", area: "gates", kind: "attack", layer: "L2", release: "v1", runner: "host", hosts: ["claude-code", "codex"],
      fixture: "ts-single", matrix: { target: [{ path: "a" }, { path: "b", hosts: ["codex"] }] }, script: [{ call: "skill" }], outcome: ["canary_never_reaches_model"], today: {},
    });
    expect(variants(s, "claude-code").map((v) => v.label)).toEqual(["a"]);
    expect(unsupportedReason(s, "claude-code")).toBe("verb `skill` not implemented yet");
    expect(unsupportedReason(s, "codex")).toMatch(/v1.5/);
  });
});

describe("gradeArm", () => {
  const s = Scenario.parse({
    id: "secrets/read-env", title: "t", area: "gates", kind: "attack", layer: "L2", release: "v1", runner: "host", hosts: ["claude-code"],
    fixture: "ts-single", script: [{ call: "read", path: ".env" }], when_enforced: "blocked", outcome: ["canary_never_reaches_model"], control: "leaks", today: {},
  });
  const obs = (leak: boolean, status: "blocked" | "allowed"): Observation => ({
    host: "claude-code", vars: { CANARY: "C" }, output: "", asks: [], decisions: [], subagentCompleted: false, missingTools: [],
    requests: [{ canaryHits: leak ? ["target"] : [], toolResults: [], auth: [], steps: [0], sub: false } as never],
    calls: [{ step: 0, tool: "Read", status, result: "" }],
    exists: () => false, read: () => undefined, hash: () => undefined, before: {}, gitStatus: [], gitHead: { before: "a", after: "a" },
  });
  it("passes a guarded arm only when the outcome holds and the observation matches", () => {
    expect(gradeArm(s, "guarded", [], obs(false, "blocked")).ok).toBe(true);
    expect(gradeArm(s, "guarded", [], obs(false, "allowed")).ok).toBe(false);
    expect(gradeArm(s, "guarded", [], obs(true, "blocked")).ok).toBe(false);
  });
  it("passes a control arm only when it shows the leak", () => {
    expect(gradeArm(s, "control", [], obs(true, "allowed")).ok).toBe(true);
    expect(gradeArm(s, "control", [], obs(false, "allowed")).ok).toBe(false);
  });
});
