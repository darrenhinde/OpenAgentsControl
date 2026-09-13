/**
 * RED-FIRST specification for the smallest reusable context profile and system profile.
 *
 * Subtask 02 owns the production schemas and resolver. These tests deliberately exercise the
 * public behavior through temporary customer-style fixture trees so missing references cannot
 * be hidden by this repository's real registry or content.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importPendingSymbols, requireMethod } from "../../support/pending.js";

const OWED_BY = "subtask 02 (profile schemas and resolver)";

interface Schema<T> {
  parse(input: unknown): T;
}

interface ResolvedSystemProfile {
  agents: string[];
  contexts: string[];
  commands: string[];
  tools: string[];
  skills: string[];
  plugins: string[];
  config: string[];
}

interface ProfileLoaderApi {
  resolveSystemProfile(id: string): Promise<ResolvedSystemProfile>;
}

interface ProfileSchemas {
  ContextProfileSchema: Schema<{ id: string; contexts: string[] }>;
  SystemProfileSchema: Schema<{ id: string; agents: string[]; contextProfiles: string[] }>;
}

async function schemas(): Promise<ProfileSchemas> {
  return importPendingSymbols<ProfileSchemas>(
    "src/types.ts",
    ["ContextProfileSchema", "SystemProfileSchema"],
    OWED_BY,
    "strict public schemas accept only the minimal context-profile and system-profile shapes"
  );
}

async function loader(root: string): Promise<ProfileLoaderApi> {
  const { ProfileLoader } = await importPendingSymbols<{
    ProfileLoader: new (root: string) => ProfileLoaderApi;
  }>(
    "src/core/ProfileLoader.ts",
    ["ProfileLoader"],
    OWED_BY,
    "a system profile resolves its deduplicated agent and context closure"
  );

  return requireMethod(
    new ProfileLoader(root),
    "resolveSystemProfile",
    OWED_BY,
    "a system profile resolves its deduplicated agent and context closure"
  );
}

function writeJson(root: string, relativePath: string, value: unknown): void {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function fixture(
  root: string,
  options: {
    contextProfile?: unknown;
    systemProfile?: unknown;
    agents?: string[];
    contexts?: string[];
    commands?: string[];
    tools?: string[];
    skills?: string[];
    plugins?: string[];
    config?: string[];
  } = {}
): void {
  writeJson(root, "content/profiles/context/basic-context.json", options.contextProfile ?? {
    id: "basic-context",
    contexts: ["team-standard"],
  });
  writeJson(root, "content/profiles/system/basic-system.json", options.systemProfile ?? {
    id: "basic-system",
    agents: ["simple-responder"],
    contextProfiles: ["basic-context"],
  });

  const components: Record<string, { id: string; path: string }[]> = {
    agents: (options.agents ?? ["simple-responder"]).map((id) => ({
      id,
      path: `content/agents/${id}.md`,
    })),
    contexts: (options.contexts ?? ["team-standard"]).map((id) => ({
      id,
      path: `content/context/${id}.md`,
    })),
  };
  const kinds = [
    ["commands", "content/commands"],
    ["tools", "content/tools"],
    ["skills", "content/skills"],
    ["plugins", "content/plugins"],
    ["config", "content/config"],
  ] as const;
  for (const [field, dir] of kinds) {
    const ids = options[field];
    if (ids !== undefined) components[field] = ids.map((id) => ({ id, path: `${dir}/${id}.md` }));
  }

  writeJson(root, "registry.json", { components, profiles: {} });
}

describe("profile schemas", () => {
  it("accepts the minimal context profile and system profile", async () => {
    // Arrange
    const { ContextProfileSchema, SystemProfileSchema } = await schemas();
    const contextProfile = { id: "basic-context", contexts: ["team-standard"] };
    const systemProfile = {
      id: "basic-system",
      agents: ["simple-responder"],
      contextProfiles: ["basic-context"],
    };

    // Act
    const parsedContext = ContextProfileSchema.parse(contextProfile);
    const parsedSystem = SystemProfileSchema.parse(systemProfile);

    // Assert
    expect({ parsedContext, parsedSystem }).toEqual({
      parsedContext: contextProfile,
      parsedSystem: systemProfile,
    });
  });

  it("rejects missing required references and unknown keys", async () => {
    // Arrange
    const { ContextProfileSchema, SystemProfileSchema } = await schemas();
    const invalidContext = { id: "basic-context", contexts: [], adapter: "opencode" };
    const invalidSystem = {
      id: "basic-system",
      agents: [],
      contextProfiles: [],
      targets: ["opencode"],
    };

    // Act
    const parseContext = () => ContextProfileSchema.parse(invalidContext);
    const parseSystem = () => SystemProfileSchema.parse(invalidSystem);

    // Assert
    expect(parseContext).toThrow(/contexts|at least one|unrecognized|adapter/i);
    expect(parseSystem).toThrow(/agents|contextProfiles|at least one|unrecognized|targets/i);
  });

  it("accepts optional component kinds and rejects legacy-only keys", async () => {
    // Arrange
    const { SystemProfileSchema } = await schemas();
    const systemProfile = {
      id: "full-system",
      agents: ["simple-responder"],
      contextProfiles: ["basic-context"],
      commands: ["commit"],
      tools: ["env"],
      skills: ["task-management"],
      plugins: ["notify"],
      config: ["env-example"],
    };
    // `subagents` is deliberately absent from the schema: the canonical tree collapses
    // subagents into agents, so the legacy category must not resurrect as a field.
    const invalidSystem = {
      id: "basic-system",
      agents: ["simple-responder"],
      contextProfiles: ["basic-context"],
      subagents: ["tester"],
    };

    // Act
    const parsed = SystemProfileSchema.parse(systemProfile);
    const parseInvalid = () => SystemProfileSchema.parse(invalidSystem);

    // Assert
    expect(parsed).toEqual(systemProfile);
    expect(parseInvalid).toThrow(/unrecognized|subagents/i);
  });
});

describe("system profile resolution", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "oac-system-profile-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("includes one selected agent and the context profile closure", async () => {
    // Arrange
    fixture(root);
    const profileLoader = await loader(root);

    // Act
    const resolved = await profileLoader.resolveSystemProfile("basic-system");

    // Assert
    expect(resolved).toEqual({
      agents: ["simple-responder"],
      contexts: ["team-standard"],
      commands: [],
      tools: [],
      skills: [],
      plugins: [],
      config: [],
    });
  });

  it("deduplicates and locale-independently sorts differently ordered inputs", async () => {
    // Arrange
    fixture(root, {
      contextProfile: {
        id: "basic-context",
        contexts: ["zeta-standard", "alpha-standard", "zeta-standard"],
      },
      systemProfile: {
        id: "basic-system",
        agents: ["zeta-agent", "alpha-agent", "zeta-agent"],
        contextProfiles: ["basic-context", "basic-context"],
      },
      agents: ["zeta-agent", "alpha-agent"],
      contexts: ["zeta-standard", "alpha-standard"],
    });
    const profileLoader = await loader(root);

    // Act
    const first = await profileLoader.resolveSystemProfile("basic-system");
    fixture(root, {
      contextProfile: {
        id: "basic-context",
        contexts: ["alpha-standard", "zeta-standard", "alpha-standard"],
      },
      systemProfile: {
        id: "basic-system",
        agents: ["alpha-agent", "zeta-agent", "alpha-agent"],
        contextProfiles: ["basic-context"],
      },
      agents: ["alpha-agent", "zeta-agent"],
      contexts: ["alpha-standard", "zeta-standard"],
    });
    const second = await (await loader(root)).resolveSystemProfile("basic-system");

    // Assert
    expect(first).toEqual({
      agents: ["alpha-agent", "zeta-agent"],
      contexts: ["alpha-standard", "zeta-standard"],
      commands: [],
      tools: [],
      skills: [],
      plugins: [],
      config: [],
    });
    expect(second).toEqual(first);
  });

  it("resolves commands, tools, skills, plugins and config against the registry", async () => {
    // Arrange
    fixture(root, {
      systemProfile: {
        id: "basic-system",
        agents: ["simple-responder"],
        contextProfiles: ["basic-context"],
        commands: ["commit", "test"],
        tools: ["env"],
        skills: ["task-management"],
        plugins: ["notify"],
        config: ["env-example"],
      },
      commands: ["commit", "test"],
      tools: ["env"],
      skills: ["task-management"],
      plugins: ["notify"],
      config: ["env-example"],
    });
    const profileLoader = await loader(root);

    // Act
    const resolved = await profileLoader.resolveSystemProfile("basic-system");

    // Assert
    expect(resolved).toEqual({
      agents: ["simple-responder"],
      contexts: ["team-standard"],
      commands: ["commit", "test"],
      tools: ["env"],
      skills: ["task-management"],
      plugins: ["notify"],
      config: ["env-example"],
    });
  });

  it("fails actionably for an unknown command", async () => {
    // Arrange
    fixture(root, {
      systemProfile: {
        id: "basic-system",
        agents: ["simple-responder"],
        contextProfiles: ["basic-context"],
        commands: ["missing-command"],
      },
    });
    const profileLoader = await loader(root);

    // Act
    const resolution = profileLoader.resolveSystemProfile("basic-system");

    // Assert
    await expect(resolution).rejects.toThrow(
      /command.*missing-command.*(not found|unknown|resolve)/i
    );
  });

  it("fails actionably for an unknown system profile", async () => {
    // Arrange
    fixture(root);
    const profileLoader = await loader(root);

    // Act
    const resolution = profileLoader.resolveSystemProfile("missing-system");

    // Assert
    await expect(resolution).rejects.toThrow(/system profile.*missing-system.*(not found|unknown)/i);
  });

  it("fails actionably for an unknown context profile", async () => {
    // Arrange
    fixture(root, {
      systemProfile: {
        id: "basic-system",
        agents: ["simple-responder"],
        contextProfiles: ["missing-context-profile"],
      },
    });
    const profileLoader = await loader(root);

    // Act
    const resolution = profileLoader.resolveSystemProfile("basic-system");

    // Assert
    await expect(resolution).rejects.toThrow(
      /context profile.*missing-context-profile.*(not found|unknown)/i
    );
  });

  it("fails actionably for an unknown agent without widening the selection", async () => {
    // Arrange
    fixture(root, {
      systemProfile: {
        id: "basic-system",
        agents: ["missing-agent"],
        contextProfiles: ["basic-context"],
      },
    });
    const profileLoader = await loader(root);

    // Act
    const resolution = profileLoader.resolveSystemProfile("basic-system");

    // Assert
    await expect(resolution).rejects.toThrow(/agent.*missing-agent.*(not found|unknown|resolve)/i);
  });

  it("fails actionably for an unknown context without widening the selection", async () => {
    // Arrange
    fixture(root, {
      contextProfile: { id: "basic-context", contexts: ["missing-context"] },
    });
    const profileLoader = await loader(root);

    // Act
    const resolution = profileLoader.resolveSystemProfile("basic-system");

    // Assert
    await expect(resolution).rejects.toThrow(
      /context.*missing-context.*(not found|unknown|resolve)/i
    );
  });
});
