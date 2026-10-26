/**
 * HostBlocks — `<!-- oac:only <target>[,<target>] -->` … `<!-- /oac:only -->` filtering.
 */
import { describe, it, expect } from "vitest";
import { filterHostBlocks, HostBlocksError, HOST_BLOCK_TARGETS } from "../../../src/core/HostBlocks.js";
import { BUILD_TARGETS } from "../../../src/core/BuildPipeline.js";

const OPEN_CC = "<!-- oac:only claude-code -->";
const OPEN_OC = "<!-- oac:only opencode,opencode-v1 -->";
const CLOSE = "<!-- /oac:only -->";
const j = (...ls: string[]): string => ls.join("\n");

describe("filterHostBlocks", () => {
  it("returns a marker-free body byte-identical (same string)", () => {
    const bodies = ["", "\n", "# T\n\n\npara  \n", "no newline", "a\r\nb\r\n", "<!-- other comment -->\n"];
    for (const b of bodies) {
      for (const t of HOST_BLOCK_TARGETS) expect(filterHostBlocks(b, t)).toBe(b);
    }
  });

  it("known targets are the build's target list (single source)", () => {
    expect([...HOST_BLOCK_TARGETS].sort()).toEqual([...BUILD_TARGETS].sort());
  });

  describe("paragraph-style block (blank line before and after)", () => {
    const body = j("A", "", OPEN_CC, "Claude text", CLOSE, "", "B", "");

    it("keeps content and removes marker lines when the target is listed", () => {
      expect(filterHostBlocks(body, "claude-code")).toBe(j("A", "", "Claude text", "", "B", ""));
    });

    it("removes the whole block and one blank line when the target is not listed", () => {
      expect(filterHostBlocks(body, "opencode")).toBe(j("A", "", "B", ""));
      expect(filterHostBlocks(body, "opencode-v1")).toBe(j("A", "", "B", ""));
    });
  });

  it("collapses blank lines separating markers from content when kept", () => {
    const body = j("A", "", OPEN_CC, "", "Claude", "", CLOSE, "", "B", "");
    expect(filterHostBlocks(body, "claude-code")).toBe(j("A", "", "Claude", "", "B", ""));
    expect(filterHostBlocks(body, "opencode")).toBe(j("A", "", "B", ""));
  });

  it("handles a multi-target marker and complementary blocks", () => {
    const body = j("Shared", "", OPEN_CC, "CC only", CLOSE, "", OPEN_OC, "OC only", CLOSE, "", "End", "");
    expect(filterHostBlocks(body, "claude-code")).toBe(j("Shared", "", "CC only", "", "End", ""));
    expect(filterHostBlocks(body, "opencode")).toBe(j("Shared", "", "OC only", "", "End", ""));
    expect(filterHostBlocks(body, "opencode-v1")).toBe(j("Shared", "", "OC only", "", "End", ""));
  });

  it("tolerates whitespace inside and around markers", () => {
    const body = j("A", "  <!--   oac:only  opencode ,  claude-code   -->  ", "X", "\t<!--/oac:only-->", "B");
    expect(filterHostBlocks(body, "claude-code")).toBe(j("A", "X", "B"));
    expect(filterHostBlocks(body, "opencode-v1")).toBe(j("A", "B"));
  });

  it("drops an inline (list-item) block without touching neighbouring lines", () => {
    const body = j("- one", OPEN_CC, "- two", CLOSE, "- three", "");
    expect(filterHostBlocks(body, "claude-code")).toBe(j("- one", "- two", "- three", ""));
    expect(filterHostBlocks(body, "opencode")).toBe(j("- one", "- three", ""));
  });

  it("handles blocks at the start and end of the body", () => {
    const start = j(OPEN_CC, "X", CLOSE, "", "B", "");
    expect(filterHostBlocks(start, "opencode")).toBe(j("B", ""));
    expect(filterHostBlocks(start, "claude-code")).toBe(j("X", "", "B", ""));

    const end = j("A", "", OPEN_CC, "X", CLOSE, "");
    expect(filterHostBlocks(end, "opencode")).toBe(j("A", ""));
    expect(filterHostBlocks(end, "claude-code")).toBe(j("A", "", "X", ""));
  });

  it("preserves a missing final newline", () => {
    const body = j("A", OPEN_CC, "X", CLOSE);
    expect(filterHostBlocks(body, "claude-code")).toBe(j("A", "X"));
    expect(filterHostBlocks(body, "opencode")).toBe("A");
  });

  it("preserves CRLF line endings", () => {
    const body = ["A", "", OPEN_CC, "X", CLOSE, "", "B", ""].join("\r\n");
    expect(filterHostBlocks(body, "claude-code")).toBe(["A", "", "X", "", "B", ""].join("\r\n"));
    expect(filterHostBlocks(body, "opencode")).toBe(["A", "", "B", ""].join("\r\n"));
  });

  it("an empty kept block vanishes cleanly", () => {
    const body = j("A", "", OPEN_CC, CLOSE, "", "B");
    expect(filterHostBlocks(body, "claude-code")).toBe(j("A", "", "B"));
  });

  it("is idempotent on its own output", () => {
    const body = j("A", "", OPEN_CC, "X", CLOSE, "", "B", "");
    const once = filterHostBlocks(body, "claude-code");
    expect(filterHostBlocks(once, "claude-code")).toBe(once);
  });

  it("honours an explicit knownTargets list", () => {
    const body = j("<!-- oac:only cursor -->", "X", CLOSE, "Y");
    expect(filterHostBlocks(body, "cursor", { knownTargets: ["cursor"] })).toBe(j("X", "Y"));
    expect(() => filterHostBlocks(body, "claude-code")).toThrow(/unknown target "cursor"/);
  });

  describe("errors", () => {
    const err = (body: string, target = "claude-code"): HostBlocksError => {
      try {
        filterHostBlocks(body, target, { file: "content/agents/x.md" });
      } catch (e) {
        expect(e).toBeInstanceOf(HostBlocksError);
        return e as HostBlocksError;
      }
      throw new Error("expected filterHostBlocks to throw");
    };

    it("unknown target in a marker names the file, line and target", () => {
      const e = err(j("A", "<!-- oac:only claude-code,cursr -->", "X", CLOSE));
      expect(e.message).toBe(
        'content/agents/x.md:2: unknown target "cursr" in oac:only marker (known: opencode, opencode-v1, claude-code)',
      );
      expect(e.file).toBe("content/agents/x.md");
      expect(e.line).toBe(2);
    });

    it("unknown build target argument throws", () => {
      expect(err("A\n", "cursor").message).toMatch(/content\/agents\/x\.md: unknown build target "cursor"/);
    });

    it("unclosed open throws at the open line", () => {
      const e = err(j("A", OPEN_CC, "X"));
      expect(e.line).toBe(2);
      expect(e.message).toMatch(/never closed/);
    });

    it("stray close throws at the close line", () => {
      const e = err(j("A", "X", CLOSE));
      expect(e.line).toBe(3);
      expect(e.message).toMatch(/without a matching/);
    });

    it("nested open throws at the inner open", () => {
      const e = err(j(OPEN_CC, "X", OPEN_OC, "Y", CLOSE, CLOSE));
      expect(e.line).toBe(3);
      expect(e.message).toMatch(/nested .*line 1/);
    });

    it("malformed markers throw (inline, empty target list, trailing text)", () => {
      expect(err(j("text <!-- oac:only claude-code --> more", CLOSE)).line).toBe(1);
      expect(err(j("<!-- oac:only -->", "X", CLOSE)).message).toMatch(/malformed/);
      expect(err(j("<!-- oac:only claude-code extra -->", "X", CLOSE)).message).toMatch(/malformed/);
      expect(err(j(OPEN_CC, "X", "<!-- /oac:only claude-code -->")).message).toMatch(/malformed/);
    });

    it("omits the file prefix when no file is given", () => {
      expect(() => filterHostBlocks(j("A", CLOSE), "opencode")).toThrow(/^line 2: /);
    });
  });
});
