import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export const KnownRedEntry = z.object({
  ref: z.string().min(1),          // issue or release that turns it green: "#349", "v1.1"
  until: z.string().min(1),        // release by which it must be green
  note: z.string().min(1),         // one line: what is wrong today
}).strict();
export const KnownRedFile = z.record(z.string().regex(/^[a-z0-9-]+\/[A-Za-z0-9@._-]+$/), KnownRedEntry);
export type KnownRed = z.infer<typeof KnownRedFile>;

export function loadKnownRed(path: string): KnownRed {
  const raw: unknown = parse(readFileSync(path, "utf8")) ?? {};
  const r = KnownRedFile.safeParse(raw);
  if (!r.success) throw new Error(`known-red.yaml is invalid: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return r.data;
}
