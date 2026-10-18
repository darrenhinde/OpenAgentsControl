// Scripted fake model for conformance tests. Speaks Anthropic Messages (SSE + JSON) and
// OpenAI chat completions (SSE). Turn 1: if a read tool is offered, call it on MOCK_TARGET.
// Later turns: reply "Done." Every request is logged, and LEAK is flagged if the canary
// ever reaches the model (that is the ground-truth outcome check).
const http = require("http"), fs = require("fs");
const PORT = +process.env.MOCK_PORT || 18765, TARGET = process.env.MOCK_TARGET, CANARY = process.env.MOCK_CANARY;
const LOG = process.env.MOCK_LOG || "mock.log.jsonl";
const log = o => fs.appendFileSync(LOG, JSON.stringify({ t: Date.now(), ...o }) + "\n");
const pathKey = schema => Object.keys(schema?.properties ?? {}).find(k => /path/i.test(k)) ?? "file_path";
function sse(res, events) { res.writeHead(200, { "content-type": "text/event-stream" }); for (const e of events) res.write(e); res.end(); }
http.createServer((req, res) => {
  let b = ""; req.on("data", c => b += c); req.on("end", () => {
    const body = b ? JSON.parse(b) : {}, raw = b;
    const leak = !!CANARY && raw.includes(CANARY);
    if (req.url.includes("count_tokens")) { res.end(JSON.stringify({ input_tokens: 10 })); return; }
    const msgs = body.messages ?? [];
    const sawToolResult = /tool_result|"role":"tool"/.test(raw);
    if (req.url.includes("/chat/completions")) {                      // OpenAI-compatible (OpenCode)
      const tool = (body.tools ?? []).find(t => t.function?.name?.toLowerCase() === "read");
      const act = !sawToolResult && tool;
      log({ api: "openai", url: req.url, tools: (body.tools ?? []).map(t => t.function?.name), act: act ? "tool_call" : "text", leak });
      const base = { id: "c1", object: "chat.completion.chunk", created: 0, model: body.model };
      const ch = (delta, fr = null) => `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: fr }] })}\n\n`;
      if (act) {
        const args = JSON.stringify({ [pathKey(tool.function.parameters)]: TARGET });
        sse(res, [ch({ role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: tool.function.name, arguments: args } }] }), ch({}, "tool_calls"), "data: [DONE]\n\n"]);
      } else sse(res, [ch({ role: "assistant", content: "Done." }), ch({}, "stop"), "data: [DONE]\n\n"]);
      return;
    }
    // Anthropic Messages (Claude Code)
    const tool = (body.tools ?? []).find(t => t.name === "Read");
    const act = !sawToolResult && tool;
    log({ api: "anthropic", url: req.url, stream: !!body.stream, tools: (body.tools ?? []).length, act: act ? "tool_use" : "text", leak });
    const block = act ? { type: "tool_use", id: "toolu_1", name: "Read", input: {} } : { type: "text", text: "" };
    const delta = act ? { type: "input_json_delta", partial_json: JSON.stringify({ [pathKey(tool.input_schema)]: TARGET }) } : { type: "text_delta", text: "Done." };
    const stop = act ? "tool_use" : "end_turn";
    const message = { id: "msg_1", type: "message", role: "assistant", model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } };
    if (!body.stream) {
      const content = act ? [{ ...block, input: JSON.parse(delta.partial_json) }] : [{ type: "text", text: "Done." }];
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ...message, content, stop_reason: stop })); return;
    }
    const ev = (n, d) => `event: ${n}\ndata: ${JSON.stringify(d)}\n\n`;
    sse(res, [ev("message_start", { type: "message_start", message }), ev("content_block_start", { type: "content_block_start", index: 0, content_block: block }),
      ev("content_block_delta", { type: "content_block_delta", index: 0, delta }), ev("content_block_stop", { type: "content_block_stop", index: 0 }),
      ev("message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 5 } }), ev("message_stop", { type: "message_stop" })]);
  });
}).listen(PORT, "127.0.0.1", () => console.log("mock on", PORT));
