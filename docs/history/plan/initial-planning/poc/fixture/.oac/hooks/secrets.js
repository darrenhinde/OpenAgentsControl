// OAC secrets gate for Claude Code PreToolUse. Denies any tool input naming a .env file
// and appends one decision row to .oac/logs/decisions.jsonl.
const fs = require("fs"), path = require("path");
let s = ""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => {
  const ev = JSON.parse(s), inp = JSON.stringify(ev.tool_input ?? {});
  const deny = /(^|[\/"\s])\.env(\.|"|\s|$)/.test(inp);
  const dir = path.join(ev.cwd ?? ".", ".oac/logs"); fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, "decisions.jsonl"), JSON.stringify({ host: "claude-code", gate: "oac/secrets", tool: ev.tool_name, decision: deny ? "deny" : "allow" }) + "\n");
  if (deny) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "OAC blocked [oac/secrets]: .env is protected. Fix: ask a human for the value." } }));
});
