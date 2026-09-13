import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RegistryEmitter } from "../../../src/core/RegistryEmitter.js";

let root: string;

function writeJson(relativePath: string, value: unknown): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function writeAgent(id: string, type: "agent" | "subagent"): void {
  const path = join(root, "content/agents", `${id}.md`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `---\nname: ${id}\ndescription: ${id} description\nmode: ${type === "agent" ? "primary" : "subagent"}\noac:\n  id: ${id}\n  name: ${id}\n  category: core\n  type: ${type}\n  version: "1.0.0"\n  author: test\n  tags: []\n  dependencies: []\n  targets:\n    - opencode\n---\n`,
    "utf-8"
  );
}

function fixture(withProfiles = true): void {
  mkdirSync(join(root, "content/agents"), { recursive: true });
  writeAgent("primary", "agent");
  writeAgent("worker", "subagent");
  writeJson("registry.json", {
    components: {
      agents: [{ id: "primary", path: ".opencode/agent/primary.md" }, { id: "eval-runner", path: ".opencode/agent/eval-runner.md" }],
      subagents: [{ id: "worker", path: ".opencode/agent/worker.md" }],
      contexts: [{ id: "core-context", path: ".opencode/context/core/example.md" }],
      commands: [{ id: "build", path: ".opencode/command/build.md" }],
      tools: [{ id: "shell", path: ".opencode/tool/shell.md" }],
      skills: [{ id: "testing", path: ".opencode/skills/testing/SKILL.md" }],
      plugins: [{ id: "hooks", path: ".opencode/plugin/hooks.ts" }],
      config: [{ id: "defaults", path: ".opencode/config/defaults.json" }],
    },
    profiles: {
      selected: {
        name: "Selected",
        description: "Base metadata remains registry-owned.",
        badge: "stable",
        additionalPaths: [".env"],
        components: ["agent:stale"],
      },
      legacy: {
        name: "Legacy",
        description: "Has no canonical source.",
        components: ["agent:primary"],
      },
    },
  });

  if (!withProfiles) return;

  writeJson("content/profiles/context/core.json", { id: "core", contexts: ["core/*"] });
  writeJson("content/profiles/system/selected.json", {
    id: "selected",
    agents: ["worker", "primary", "eval-runner"],
    contextProfiles: ["core"],
    commands: ["build"],
    tools: ["shell"],
    skills: ["testing"],
    plugins: ["hooks"],
    config: ["defaults"],
  });
}

describe("RegistryEmitter profile emission", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "oac-registry-profiles-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("generates install-compatible canonical components while preserving base metadata", async () => {
    fixture();

    const document = await new RegistryEmitter(root).emit();

    expect(document.profiles).toEqual({
      selected: {
        name: "Selected",
        description: "Base metadata remains registry-owned.",
        badge: "stable",
        additionalPaths: [".env"],
        components: [
          "agent:eval-runner",
          "agent:primary",
          "command:build",
          "config:defaults",
          "context:core/*",
          "plugin:hooks",
          "skill:testing",
          "subagent:worker",
          "tool:shell",
        ],
      },
    });
  });

  it("drops base profiles that have no canonical system profile when canonical profiles exist", async () => {
    fixture();

    const document = await new RegistryEmitter(root).emit();

    expect(document.profiles).not.toHaveProperty("legacy");
  });

  it("preserves base profiles when canonical profile content is absent", async () => {
    fixture(false);

    const document = await new RegistryEmitter(root).emit();

    expect(document.profiles).toEqual(JSON.parse(readFileSync(join(root, "registry.json"), "utf-8")).profiles);
  });

  it("is byte-stable after emit, write, and emit", async () => {
    fixture();
    const emitter = new RegistryEmitter(root);
    const first = await emitter.emitJson();
    writeFileSync(join(root, "registry.json"), first, "utf-8");

    const second = await new RegistryEmitter(root).emitJson();

    expect(second).toBe(first);
  });
});
