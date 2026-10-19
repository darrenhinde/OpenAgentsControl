import { describe, expect, it } from "vitest";
import { diffSnapshots, type Snapshot } from "../../src/sandbox/snapshot.ts";

// diffSnapshots is pure; no real $HOME or git is read here.
const snap = (homeEntries: string[]): Snapshot => ({ files: {}, homeEntries, repoHead: "abc", repoStatus: "" });

describe("diffSnapshots: $HOME entries", () => {
  it("reports an entry added to $HOME", () => {
    expect(diffSnapshots(snap([".a"]), snap([".a", ".b"]))).toEqual(["~/.b (new in $HOME)"]);
  });

  it("reports an entry removed from $HOME", () => {
    expect(diffSnapshots(snap([".a", ".b"]), snap([".a"]))).toEqual(["~/.b (removed from $HOME)"]);
  });

  it("reports nothing when the entries are unchanged", () => {
    expect(diffSnapshots(snap([".a"]), snap([".a"]))).toEqual([]);
  });
});
