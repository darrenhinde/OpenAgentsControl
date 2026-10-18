// Unit tests for the L0 lint logic on small inline fixtures. The checks themselves run the
// same functions over the real tree (src/checks/gates.ts, oc-load.ts, cc-load.ts).
import { describe, expect, it } from "vitest";
import { lintCcAgentExamples } from "../../src/lints/cc-agent-examples.ts";
import { emittedId, frontmatter, v2Action } from "../../src/lints/files.ts";
import { lintNoHiddenTools } from "../../src/lints/no-hidden-tools.ts";
import { lintNoV1Artifacts } from "../../src/lints/no-v1-artifacts.ts";
import { lintSubagentKeys } from "../../src/lints/subagent-keys.ts";

const agent = (path: string, fm: string, body = "body"): { path: string; text: string } => ({ path, text: `---\n${fm}\n---\n${body}\n` });

describe("frontmatter helpers", () => {
  it("keeps key order", () => {
    const fm = frontmatter('---\npermission:\n  bash:\n    "tsc": allow\n    "*": deny\n---\nx');
    expect(Object.keys((fm.data.permission as Record<string, Record<string, string>>).bash ?? {})).toEqual(["tsc", "*"]);
  });
  it("maps v1 keys to v2 actions and paths to v2 IDs", () => {
    expect(v2Action("bash")).toBe("shell");
    expect(v2Action("task")).toBe("subagent");
    expect(v2Action("read")).toBe("read");
    expect(emittedId(".opencode/agent/subagents/core/contextscout.md")).toBe("subagents/core/contextscout");
  });
});

describe("gates/no-hidden-tools (#349)", () => {
  it("flags allow rules followed by a trailing \"*\": deny", () => {
    const f = agent("a.md", 'permission:\n  bash:\n    "tsc": allow\n    "*": deny\n  task:\n    contextscout: allow\n    "*": deny');
    const r = lintNoHiddenTools([f]);
    expect(r.map((h) => h.action)).toEqual(["shell", "subagent"]);
  });
  it("accepts the catch-all first (last match wins)", () => {
    expect(lintNoHiddenTools([agent("a.md", 'permission:\n  bash:\n    "*": deny\n    "tsc": allow')])).toEqual([]);
  });
  it("accepts a deny-only block and a resource-scoped deny", () => {
    expect(lintNoHiddenTools([agent("a.md", 'permission:\n  bash:\n    "*": deny\n  edit:\n    "x": allow\n    "**/*": deny')])).toEqual([]);
  });
});

describe("gates/subagent-keys-exist (#362)", () => {
  const agents = [agent(".opencode/agent/subagents/core/contextscout.md", "name: ContextScout"), agent(".opencode/agent/core/openagent.md", 'permission:\n  task:\n    contextscout: allow\n    "subagents/core/contextscout": allow\n    "*": deny')];
  it("flags task keys and body refs that are not emitted IDs", () => {
    const prompts = [{ path: "c.md", text: 'use subagent_type="ContextScout" or agent: "subagents/core/contextscout"' }];
    const r = lintSubagentKeys(agents, prompts);
    expect(r.bad.map((b) => b.name)).toEqual(["contextscout", "ContextScout"]);
    expect(r.refs).toBe(4);
  });
  it("supports glob keys", () => {
    const r = lintSubagentKeys([agents[0]!, agent(".opencode/agent/x.md", 'permission:\n  task:\n    "subagents/*": allow')], []);
    expect(r.bad).toEqual([]);
  });
});

describe("oc/no-v1-artifacts (#367)", () => {
  it("flags tool modules and v1 plugin imports, not tests or other plugins", () => {
    const r = lintNoV1Artifacts(
      [{ path: ".opencode/tool/env/index.ts", text: "" }, { path: ".opencode/tool/README.md", text: "" }],
      [
        { path: ".opencode/plugin/notify.ts", text: 'import type { Plugin } from "@opencode-ai/plugin"' },
        { path: ".opencode/plugin/tests/x.ts", text: 'import "@opencode-ai/plugin"' },
        { path: ".opencode/plugins/ok/index.ts", text: 'import { x } from "@opencode/plugin"' },
      ],
    );
    expect(r.map((x) => x.path)).toEqual([".opencode/tool/env/index.ts", ".opencode/plugin/notify.ts"]);
  });
});

describe("cc/agent-dispatch-examples", () => {
  it("counts agents with and without <example>", () => {
    const r = lintCcAgentExamples([{ name: "a.md", text: "<example>x</example>" }, { name: "b.md", text: "none" }]);
    expect(r).toEqual({ total: 2, withExamples: 1, missing: ["b.md"] });
  });
});

describe("T2 expected tool set", async () => {
  const { expectedTools } = await import("../../src/checks/oc-agents.ts");
  it("expects every v2 action that has an allow rule", () => {
    const t = agent("a.md", 'permission:\n  bash:\n    "tsc": allow\n    "*": deny\n  edit: deny\n  webfetch: allow\n  task:\n    "*": deny').text;
    expect(expectedTools(t)).toEqual(["shell", "webfetch"]);
  });
});
