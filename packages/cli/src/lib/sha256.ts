import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** Returns the hex SHA256 of a file's contents. Throws if file does not exist. */
export async function computeFileHash(filePath: string): Promise<string> {
  return readFile(filePath)
    .then((contents) => createHash("sha256").update(contents).digest("hex"))
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`computeFileHash: cannot read "${filePath}" — ${msg}`);
    });
}

/** Returns the hex SHA256 of a string (synchronous). */
export function computeStringHash(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Returns true when two hex SHA256 strings are identical (case-insensitive). */
export function hashesMatch(hash1: string, hash2: string): boolean {
  return hash1.toLowerCase() === hash2.toLowerCase();
}
