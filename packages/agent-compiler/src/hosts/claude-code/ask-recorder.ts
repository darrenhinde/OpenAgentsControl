/**
 * A stdio MCP server that answers Claude Code permission prompts in `-p` mode, wired with
 * `--mcp-config <cfg> --permission-prompt-tool mcp__oacasks__answer` (verified on 2.1.302,
 * L-012). Every ask is appended to ASKS_LOG as {tool_name, input, tool_use_id}; ASKS_MODE
 * `approve` allows it unchanged, anything else denies it.
 */
export const ASK_TOOL = 'mcp__oacasks__answer';

export const ASK_RECORDER_JS = `const rl = require("readline").createInterface({ input: process.stdin });
const fs = require("fs");
const send = (m) => process.stdout.write(JSON.stringify(m) + "\\n");
rl.on("line", (l) => {
  let m; try { m = JSON.parse(l); } catch { return; }
  if (m.method === "initialize") send({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: (m.params && m.params.protocolVersion) || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "oacasks", version: "0" } } });
  else if (m.method === "tools/list") send({ jsonrpc: "2.0", id: m.id, result: { tools: [{ name: "answer", description: "Answers permission prompts for the OAC test suite", inputSchema: { type: "object", properties: { tool_name: { type: "string" }, input: { type: "object" }, tool_use_id: { type: "string" } } } }] } });
  else if (m.method === "tools/call") {
    const a = (m.params && m.params.arguments) || {};
    fs.appendFileSync(process.env.ASKS_LOG, JSON.stringify(a) + "\\n");
    const d = process.env.ASKS_MODE === "approve" ? { behavior: "allow", updatedInput: a.input } : { behavior: "deny", message: "OAC test: ask rejected" };
    send({ jsonrpc: "2.0", id: m.id, result: { content: [{ type: "text", text: JSON.stringify(d) }] } });
  } else if (m.id !== undefined) send({ jsonrpc: "2.0", id: m.id, result: {} });
});
`;

export function askRecorderMcpConfig(o: { node: string; script: string; log: string; mode: 'approve' | 'reject' }): Record<string, unknown> {
  return { mcpServers: { oacasks: { command: o.node, args: [o.script], env: { ASKS_LOG: o.log, ASKS_MODE: o.mode } } } };
}
