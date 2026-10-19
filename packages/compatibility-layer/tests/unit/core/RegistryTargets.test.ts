/**
 * Registry emission per target: `registry.json` (v2, default) and `registry.v1.json`.
 *
 * Installers read paths from the registry, so the two files differ in exactly the entries whose
 * files differ: agents (flat `<id>.md` vs nested under `v1-opencode/`), and the components v2
 * cannot load (tools, plugins, v1-only agents), which the v2 registry omits entirely.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { RegistryEmitter, type RegistryDocument } from "../../../src/core/RegistryEmitter.js";
import { REGISTRY_TARGETS } from "../../../src/core/RegistryTargets.js";

let root: string;
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text, "utf-8");
};
const json = (rel: string, v: unknown): void => put(rel, `${JSON.stringify(v, null, 2)}\n`);

function agent(id: string, targets: string[], category = "subagents/test"): string {
  return `---\nname: ${id}\ndescription: ${id} d\nmode: subagent\noac:\n  id: ${id}\n  name: ${id}\n  category: ${category}\n  type: subagent\n  version: "1.0.0"\n  author: t\n  targets:\n${targets.map((t) => `    - ${t}`).join("\n")}\n---\n`;
}

const BASE = {
  components: {
    agents: [],
    subagents: [],
    contexts: [{ id: "ctx", path: ".opencode/context/ctx.md" }],
    commands: [{ id: "build", path: ".opencode/command/build.md" }],
    tools: [{ id: "env", path: ".opencode/tool/env/index.ts" }],
    skills: [],
    plugins: [{ id: "notify", path: ".opencode/plugin/notify.ts" }],
    config: [],
  },
  profiles: {},
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "oac-regt-"));
  put("content/agents/subagents/test/alpha.md", agent("alpha", ["opencode"]));
  put("content/agents/subagents/test/imager.md", agent("imager", ["opencode-v1"]));
  json("registry.json", BASE);
  json("registry.v1.json", {
    ...BASE,
    components: {
      ...BASE.components,
      tools: [{ id: "env", path: "v1-opencode/tool/env/index.ts" }],
      plugins: [{ id: "notify", path: "v1-opencode/plugin/notify.ts" }],
    },
  });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const ids = (d: RegistryDocument, c: string): string[] => (d.components[c] ?? []).map((e) => e.id);
const path = (d: RegistryDocument, c: string, id: string): string | undefined => d.components[c]?.find((e) => e.id === id)?.path;

describe("REGISTRY_TARGETS", () => {
  it("v2 writes registry.json, v1 writes registry.v1.json", () => {
    expect(REGISTRY_TARGETS.opencode.file).toBe("registry.json");
    expect(REGISTRY_TARGETS["opencode-v1"].file).toBe("registry.v1.json");
  });
});

describe("v2 registry", () => {
  it("points agents at the flat file and omits v1-only agents", async () => {
    const d = await new RegistryEmitter(root).emit();
    expect(path(d, "subagents", "alpha")).toBe(".opencode/agent/alpha.md");
    expect(ids(d, "subagents")).not.toContain("imager");
  });

  it("carries no tools or plugins, which v2 cannot load, but keeps the keys", async () => {
    const d = await new RegistryEmitter(root).emit();
    expect(d.components["tools"]).toEqual([]);
    expect(d.components["plugins"]).toEqual([]);
    expect(ids(d, "commands")).toEqual(["build"]);
  });
});

describe("v1 registry", () => {
  const v1 = (): RegistryEmitter => new RegistryEmitter(root, { target: "opencode-v1" });

  it("reads registry.v1.json as its base and points agents at the nested v1 tree", async () => {
    const d = await v1().emit();
    expect(path(d, "subagents", "alpha")).toBe("v1-opencode/agent/subagents/test/alpha.md");
    expect(path(d, "subagents", "imager")).toBe("v1-opencode/agent/subagents/test/imager.md");
  });

  it("keeps the tools and plugins its base carries, at their v1-opencode paths", async () => {
    const d = await v1().emit();
    expect(path(d, "tools", "env")).toBe("v1-opencode/tool/env/index.ts");
    expect(path(d, "plugins", "notify")).toBe("v1-opencode/plugin/notify.ts");
  });

  it("is a fixed point over its own output", async () => {
    const first = await v1().emitJson();
    put("registry.v1.json", first);
    expect(await v1().emitJson()).toBe(first);
  });
});
