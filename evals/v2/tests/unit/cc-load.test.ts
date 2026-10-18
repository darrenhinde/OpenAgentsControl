import { describe, expect, it } from "vitest";
import { parseClaudeStream, sessionStartPayload } from "../../../../packages/compatibility-layer/src/hosts/claude-code/driver.ts";

const ev = (o: unknown): string => JSON.stringify(o);

describe("sessionStartPayload", () => {
  it("decodes JSON additional_context and counts its lines and bytes", () => {
    const stdout = JSON.stringify({ additional_context: "a\nb\nc MUST" }, null, 2);
    const s = parseClaudeStream([ev({ type: "system", subtype: "hook_response", hook_name: "SessionStart:startup", stdout, exit_code: 0 })].join("\n"));
    const p = sessionStartPayload(s);
    expect(p).toMatchObject({ context: "a\nb\nc MUST", lines: 3, bytes: 10, stdoutBytes: Buffer.byteLength(stdout) });
  });

  it("reads hookSpecificOutput.additionalContext and plain-text stdout, ignoring other hooks", () => {
    const s = parseClaudeStream(
      [
        ev({ type: "system", subtype: "hook_response", hook_name: "SessionStart:startup", stdout: ev({ hookSpecificOutput: { additionalContext: "one" } }) }),
        ev({ type: "system", subtype: "hook_response", hook_name: "SessionStart:startup", stdout: "two\n" }),
        ev({ type: "system", subtype: "hook_response", hook_name: "PreToolUse:Read", stdout: "x" }),
      ].join("\n"),
    );
    expect(sessionStartPayload(s)?.context).toBe("one\ntwo");
  });

  it("is undefined when no SessionStart hook ran", () => {
    expect(sessionStartPayload(parseClaudeStream(ev({ type: "system", subtype: "init" })))).toBeUndefined();
  });
});
