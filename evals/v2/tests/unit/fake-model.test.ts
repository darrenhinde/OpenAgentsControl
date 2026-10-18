import { afterEach, describe, expect, it } from "vitest";
import { authShape, modelTurns, startFakeModel, type FakeModel } from "../../../../packages/compatibility-layer/src/verify/fake-model/server.ts";

let m: FakeModel | undefined;
afterEach(async () => {
  await m?.stop();
  m = undefined;
});

const post = async (url: string, body: unknown, headers: Record<string, string>): Promise<string> => {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  return r.text();
};

describe("fake model", () => {
  it("replays a read on Anthropic Messages, then answers text after the tool result", async () => {
    m = await startFakeModel({ script: [{ call: "read", path: "/w/.env" }], canaries: { target: "SECRET-1" }, expectedAuth: { anthropicKey: "k" } });
    const tools = [{ name: "Read", input_schema: { properties: { file_path: {} } } }];
    const first = await post(`${m.url}/v1/messages`, { model: "x", messages: [{ role: "user", content: "hi" }], tools }, { "x-api-key": "k" });
    expect(JSON.parse(first)).toMatchObject({ stop_reason: "tool_use", content: [{ type: "tool_use", name: "Read", input: { file_path: "/w/.env" } }] });
    const second = await post(
      `${m.url}/v1/messages`,
      { model: "x", tools, messages: [{ role: "assistant", content: [{ type: "tool_use" }] }, { role: "user", content: [{ type: "tool_result", content: "AWS=SECRET-1" }] }] },
      { "x-api-key": "k" },
    );
    expect(JSON.parse(second)).toMatchObject({ stop_reason: "end_turn" });
    expect(m.requests.map((r) => r.canaryHits)).toEqual([[], ["target"]]);
    expect(m.requests.every((r) => r.auth.find((a) => a.header === "x-api-key")?.shape === "dummy")).toBe(true);
  });

  it("maps neutral calls to OpenAI tool names and skips title requests", async () => {
    m = await startFakeModel({ script: [{ call: "shell", command: "ls" }] });
    const tools = [{ type: "function", function: { name: "shell", parameters: { properties: { command: {}, description: {} } } } }];
    const title = await post(`${m.url}/v1/chat/completions`, { messages: [{ role: "system", content: "You are a title generator." }], tools: [] }, {});
    expect(title).toContain("Done.");
    const sse = await post(`${m.url}/v1/chat/completions`, { messages: [{ role: "user", content: "hi" }], tools }, {});
    expect(sse).toContain('"name":"shell"');
    expect(sse).toContain('\\"command\\":\\"ls\\"');
    expect(modelTurns(m.requests)).toHaveLength(1);
  });

  it("describes credentials by shape only", () => {
    expect(authShape(undefined, "k")).toEqual({ shape: "absent" });
    expect(authShape("Bearer k", "k")).toEqual({ shape: "dummy" });
    const s = authShape("sk-ant-oat01-REALLOOKING", "k");
    expect(s.shape).toBe("unexpected");
    expect(s.hint).not.toContain("REALLOOKING");
  });
});
