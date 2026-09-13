import path from "node:path";
import { stat } from "node:fs/promises";

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdeType = "opencode" | "claude";

export type DetectedIde = {
  type: IdeType;
  detected: boolean;
  /** Human-readable description of what was found (or checked). */
  indicator: string;
};

// ─── IDE Definitions ──────────────────────────────────────────────────────────

/** Maps each IDE to its display name and output file for `oac apply`. */
const IDE_DISPLAY_NAMES: Record<IdeType, string> = {
  opencode: "OpenCode",
  claude: "Claude",
};

/** Output file/directory written by `oac apply` for each IDE. */
const IDE_OUTPUT_FILES: Record<IdeType, string> = {
  opencode: ".opencode/",
  claude: "CLAUDE.md",
};

// ─── Detection Logic ──────────────────────────────────────────────────────────

/** Returns true if `p` is an existing directory. Never throws. */
const dirExists = (p: string): Promise<boolean> =>
  stat(p).then((s) => s.isDirectory()).catch(() => false);

/** Returns true if `p` is an existing file. Never throws. */
const fileExists = (p: string): Promise<boolean> =>
  stat(p).then((s) => s.isFile()).catch(() => false);

/** Returns the indicator string and detected status for a single IDE. */
async function checkIde(
  projectRoot: string,
  ide: IdeType
): Promise<{ detected: boolean; indicator: string }> {
  if (ide === "opencode") {
    const p = path.join(projectRoot, ".opencode");
    return (await dirExists(p))
      ? { detected: true, indicator: ".opencode/ directory" }
      : { detected: false, indicator: ".opencode/ directory (not found)" };
  }
  // claude
  const dir = path.join(projectRoot, ".claude");
  const file = path.join(projectRoot, "CLAUDE.md");
  if (await dirExists(dir)) return { detected: true, indicator: ".claude/ directory" };
  if (await fileExists(file)) return { detected: true, indicator: "CLAUDE.md file" };
  return { detected: false, indicator: ".claude/ directory or CLAUDE.md (not found)" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Detects a single IDE in the given project root. */
export async function detectIde(
  projectRoot: string,
  ide: IdeType
): Promise<DetectedIde> {
  const { detected, indicator } = await checkIde(projectRoot, ide);
  return { type: ide, detected, indicator };
}

/** Detects all supported IDEs in the given project root. */
export async function detectIdes(projectRoot: string): Promise<DetectedIde[]> {
  const ides: IdeType[] = ["opencode", "claude"];
  return Promise.all(ides.map((ide) => detectIde(projectRoot, ide)));
}

/** Returns true if the given IDE is present in the project root. */
export async function isIdePresent(
  projectRoot: string,
  ide: IdeType
): Promise<boolean> {
  const result = await detectIde(projectRoot, ide);
  return result.detected;
}

/** Returns the output file path (relative) written by `oac apply` for an IDE. */
export function getIdeOutputFile(ide: IdeType): string {
  return IDE_OUTPUT_FILES[ide];
}

/** Returns the human-readable display name for an IDE. */
export function getIdeDisplayName(ide: IdeType): string {
  return IDE_DISPLAY_NAMES[ide];
}
