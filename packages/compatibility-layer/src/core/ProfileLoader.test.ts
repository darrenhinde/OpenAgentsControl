import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ProfileLoader } from "./ProfileLoader.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const SYSTEM_PROFILE_IDS = ["essential", "developer", "business", "advanced", "full"] as const;

const readProfile = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), "utf-8")) as T;

describe("user-facing profile memberships", () => {
  it("keeps maintainer context out of engineering while preserving core quick starts", async () => {
    const engineering = readProfile<{ contexts: string[] }>(
      "../../../../content/profiles/context/engineering.json",
    );
    const core = readProfile<{ contexts: string[] }>("../../../../content/profiles/context/core.json");
    const resolved = await new ProfileLoader(REPOSITORY_ROOT).resolveSystemProfile("developer");

    expect(engineering.contexts).not.toContain("openagents-repo/*");
    expect(core.contexts).toContain("quick-start");
    expect(core.contexts).toContain("adding-skill-basics");
    expect(resolved.contexts).toContain("quick-start");
    expect(resolved.contexts).toContain("adding-skill-basics");
  });

  it.each(SYSTEM_PROFILE_IDS)("omits config:readme from %s", (profileId) => {
    const profile = readProfile<{ config?: string[] }>(
      `../../../../content/profiles/system/${profileId}.json`,
    );

    expect(profile.config ?? []).not.toContain("readme");
  });
});
