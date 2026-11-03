/**
 * Line-Number Validation Tests
 * 
 * Comprehensive tests for line-number precision format validation.
 * Tests cover all valid and invalid formats, edge cases, and error messages.
 */

import { describe, it, expect } from "vitest";
import {
  validateLineNumberFormat,
  parseLineNumberFormat,
  formatLineNumberRanges,
  isLineInRanges,
  extractLines,
  getValidationMessage,
  type LineNumberValidationResult,
  type ParsedLineRange
} from "../scripts/validators/line-number-validator";

describe("Line-Number Format Validation", () => {
  // ==========================================================================
  // Valid Format Tests
  // ==========================================================================
  describe("Valid formats", () => {
    it("validates single range format", () => {
      const result = validateLineNumberFormat("12-18");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([{ start: 12, end: 18 }]);
    });

    it("validates multiple ranges format", () => {
      const result = validateLineNumberFormat("12,15-20,25");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([
        { start: 12, end: 12 },
        { start: 15, end: 20 },
        { start: 25, end: 25 }
      ]);
    });

    it("validates complex multi-range format", () => {
      const result = validateLineNumberFormat("1-10,25,30-50,100-120");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([
        { start: 1, end: 10 },
        { start: 25, end: 25 },
        { start: 30, end: 50 },
        { start: 100, end: 120 }
      ]);
    });

    it("validates single line number", () => {
      const result = validateLineNumberFormat("42");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([{ start: 42, end: 42 }]);
    });

    it("validates multiple single lines", () => {
      const result = validateLineNumberFormat("5,10,15,20");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([
        { start: 5, end: 5 },
        { start: 10, end: 10 },
        { start: 15, end: 15 },
        { start: 20, end: 20 }
      ]);
    });

    it("validates range with same start and end (with warning)", () => {
      const result = validateLineNumberFormat("10-10");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain("same start and end");
      expect(result.parsed).toEqual([{ start: 10, end: 10 }]);
    });

    it("validates empty string (entire file)", () => {
      const result = validateLineNumberFormat("");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([]);
    });

    it("validates undefined (entire file)", () => {
      const result = validateLineNumberFormat(undefined);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([]);
    });

    it("validates whitespace-only string (entire file)", () => {
      const result = validateLineNumberFormat("   ");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([]);
    });

    it("validates large line numbers", () => {
      const result = validateLineNumberFormat("1000-5000");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual([{ start: 1000, end: 5000 }]);
    });
  });

  // ==========================================================================
  // Invalid Format Tests
  // ==========================================================================
  describe("Invalid formats", () => {
    it("rejects reversed range (start > end)", () => {
      const result = validateLineNumberFormat("50-10");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("start > end");
    });

    it("rejects invalid separator (colon)", () => {
      const result = validateLineNumberFormat("12:18");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid characters");
    });

    it("rejects invalid separator (double dot)", () => {
      const result = validateLineNumberFormat("12..18");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid characters");
    });

    it("rejects non-numeric values", () => {
      const result = validateLineNumberFormat("abc-def");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid characters");
    });

    it("rejects negative numbers", () => {
      const result = validateLineNumberFormat("-5-10");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("cannot start or end with a hyphen");
    });

    it("rejects zero as line number", () => {
      const result = validateLineNumberFormat("0-10");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("must be positive");
    });

    it("rejects leading comma", () => {
      const result = validateLineNumberFormat(",10-20");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("cannot start or end with a comma");
    });

    it("rejects trailing comma", () => {
      const result = validateLineNumberFormat("10-20,");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("cannot start or end with a comma");
    });

    it("rejects consecutive commas", () => {
      const result = validateLineNumberFormat("10-20,,30-40");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("consecutive commas");
    });

    it("rejects consecutive hyphens", () => {
      const result = validateLineNumberFormat("10--20");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("consecutive hyphens");
    });

    it("rejects empty segment", () => {
      const result = validateLineNumberFormat("10-20, ,30-40");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Empty segment");
    });

    it("rejects range with missing start", () => {
      const result = validateLineNumberFormat("-20");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("cannot start or end with a hyphen");
    });

    it("rejects range with missing end", () => {
      const result = validateLineNumberFormat("10-");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("cannot start or end with a hyphen");
    });

    it("rejects range with too many hyphens", () => {
      const result = validateLineNumberFormat("10-20-30");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid range format");
    });

    it("rejects mixed valid and invalid ranges", () => {
      const result = validateLineNumberFormat("10-20,abc,30-40");
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid characters");
    });
  });

  // ==========================================================================
  // Warning Tests
  // ==========================================================================
  describe("Warnings", () => {
    it("warns about overlapping ranges", () => {
      const result = validateLineNumberFormat("10-20,15-25");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain("Overlapping ranges");
    });

    it("warns about adjacent ranges", () => {
      const result = validateLineNumberFormat("10-20,20-30");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain("Overlapping ranges");
    });

    it("does not warn about non-overlapping ranges", () => {
      const result = validateLineNumberFormat("10-20,30-40");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it("warns about same start and end in range", () => {
      const result = validateLineNumberFormat("10-10");
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings![0]).toContain("same start and end");
    });
  });

  // ==========================================================================
  // Parser Tests
  // ==========================================================================
  describe("parseLineNumberFormat", () => {
    it("parses valid format into ranges", () => {
      const ranges = parseLineNumberFormat("1-10,25,30-50");
      expect(ranges).toEqual([
        { start: 1, end: 10 },
        { start: 25, end: 25 },
        { start: 30, end: 50 }
      ]);
    });

    it("returns null for invalid format", () => {
      const ranges = parseLineNumberFormat("invalid");
      expect(ranges).toBeNull();
    });

    it("returns empty array for undefined", () => {
      const ranges = parseLineNumberFormat(undefined);
      expect(ranges).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      const ranges = parseLineNumberFormat("");
      expect(ranges).toEqual([]);
    });
  });

  // ==========================================================================
  // Formatter Tests
  // ==========================================================================
  describe("formatLineNumberRanges", () => {
    it("formats single range", () => {
      const formatted = formatLineNumberRanges([{ start: 12, end: 18 }]);
      expect(formatted).toBe("12-18");
    });

    it("formats multiple ranges", () => {
      const formatted = formatLineNumberRanges([
        { start: 1, end: 10 },
        { start: 25, end: 25 },
        { start: 30, end: 50 }
      ]);
      expect(formatted).toBe("1-10,25,30-50");
    });

    it("formats single line as number (not range)", () => {
      const formatted = formatLineNumberRanges([{ start: 42, end: 42 }]);
      expect(formatted).toBe("42");
    });

    it("formats empty array as empty string", () => {
      const formatted = formatLineNumberRanges([]);
      expect(formatted).toBe("");
    });
  });

  // ==========================================================================
  // Line Inclusion Tests
  // ==========================================================================
  describe("isLineInRanges", () => {
    const ranges: ParsedLineRange[] = [
      { start: 1, end: 10 },
      { start: 25, end: 25 },
      { start: 30, end: 50 }
    ];

    it("returns true for line in first range", () => {
      expect(isLineInRanges(5, ranges)).toBe(true);
    });

    it("returns true for line at range start", () => {
      expect(isLineInRanges(1, ranges)).toBe(true);
    });

    it("returns true for line at range end", () => {
      expect(isLineInRanges(10, ranges)).toBe(true);
    });

    it("returns true for single line range", () => {
      expect(isLineInRanges(25, ranges)).toBe(true);
    });

    it("returns true for line in last range", () => {
      expect(isLineInRanges(40, ranges)).toBe(true);
    });

    it("returns false for line before all ranges", () => {
      expect(isLineInRanges(0, ranges)).toBe(false);
    });

    it("returns false for line between ranges", () => {
      expect(isLineInRanges(15, ranges)).toBe(false);
    });

    it("returns false for line after all ranges", () => {
      expect(isLineInRanges(100, ranges)).toBe(false);
    });

    it("returns false for empty ranges", () => {
      expect(isLineInRanges(10, [])).toBe(false);
    });
  });

  // ==========================================================================
  // Line Extraction Tests
  // ==========================================================================
  describe("extractLines", () => {
    const content = `Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10`;

    it("extracts single range", () => {
      const extracted = extractLines(content, "3-5");
      expect(extracted).toBe("Line 3\nLine 4\nLine 5");
    });

    it("extracts multiple ranges", () => {
      const extracted = extractLines(content, "1-2,5,8-10");
      expect(extracted).toBe("Line 1\nLine 2\nLine 5\nLine 8\nLine 9\nLine 10");
    });

    it("extracts single line", () => {
      const extracted = extractLines(content, "5");
      expect(extracted).toBe("Line 5");
    });

    it("returns entire content for undefined lines", () => {
      const extracted = extractLines(content, undefined);
      expect(extracted).toBe(content);
    });

    it("returns entire content for empty string", () => {
      const extracted = extractLines(content, "");
      expect(extracted).toBe(content);
    });

    it("returns null for invalid format", () => {
      const extracted = extractLines(content, "invalid");
      expect(extracted).toBeNull();
    });

    it("handles ranges beyond file length", () => {
      const extracted = extractLines(content, "1-100");
      expect(extracted).toBe(content);
    });

    it("handles empty content", () => {
      const extracted = extractLines("", "1-10");
      expect(extracted).toBe("");
    });
  });

  // ==========================================================================
  // Validation Message Tests
  // ==========================================================================
  describe("getValidationMessage", () => {
    it("returns 'Valid' for valid format", () => {
      const message = getValidationMessage("10-20");
      expect(message).toBe("Valid");
    });

    it("returns 'Valid (with warnings)' for valid format with warnings", () => {
      const message = getValidationMessage("10-10");
      expect(message).toContain("Valid (with warnings)");
      expect(message).toContain("same start and end");
    });

    it("returns 'Invalid' with errors for invalid format", () => {
      const message = getValidationMessage("50-10");
      expect(message).toContain("Invalid:");
      expect(message).toContain("start > end");
    });

    it("returns 'Valid' for undefined", () => {
      const message = getValidationMessage(undefined);
      expect(message).toBe("Valid");
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe("Edge cases", () => {
    it("handles very large line numbers", () => {
      const result = validateLineNumberFormat("999999-1000000");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([{ start: 999999, end: 1000000 }]);
    });

    it("handles many ranges", () => {
      const ranges = Array.from({ length: 100 }, (_, i) => `${i * 10 + 1}-${i * 10 + 5}`).join(',');
      const result = validateLineNumberFormat(ranges);
      expect(result.valid).toBe(true);
      expect(result.parsed).toHaveLength(100);
    });

    it("handles whitespace in input", () => {
      const result = validateLineNumberFormat("  10-20  ");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([{ start: 10, end: 20 }]);
    });

    it("handles single digit line numbers", () => {
      const result = validateLineNumberFormat("1-9");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([{ start: 1, end: 9 }]);
    });

    it("handles line number 1", () => {
      const result = validateLineNumberFormat("1");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([{ start: 1, end: 1 }]);
    });
  });

  // ==========================================================================
  // Real-World Examples
  // ==========================================================================
  describe("Real-world examples", () => {
    it("validates example from enhanced-task-schema.md", () => {
      const result = validateLineNumberFormat("53-95");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([{ start: 53, end: 95 }]);
    });

    it("validates multi-range example from enhanced-task-schema.md", () => {
      const result = validateLineNumberFormat("1-25,120-145,200-220");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([
        { start: 1, end: 25 },
        { start: 120, end: 145 },
        { start: 200, end: 220 }
      ]);
    });

    it("validates example from test file", () => {
      const result = validateLineNumberFormat("10-50");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([{ start: 10, end: 50 }]);
    });

    it("validates complex example", () => {
      const result = validateLineNumberFormat("1-20,45-60");
      expect(result.valid).toBe(true);
      expect(result.parsed).toEqual([
        { start: 1, end: 20 },
        { start: 45, end: 60 }
      ]);
    });
  });

  // ==========================================================================
  // Integration with Enhanced Schema
  // ==========================================================================
  describe("Integration with enhanced schema", () => {
    it("validates ContextFileReference with valid lines", () => {
      const ref = {
        path: ".opencode/context/core/standards/code-quality.md",
        lines: "53-95",
        reason: "Pure function patterns"
      };

      const result = validateLineNumberFormat(ref.lines);
      expect(result.valid).toBe(true);
    });

    it("validates ContextFileReference without lines (entire file)", () => {
      const ref: { path: string; lines?: string; reason: string } = {
        path: ".opencode/context/core/standards/code-quality.md",
        reason: "All coding standards"
      };

      const result = validateLineNumberFormat(ref.lines);
      expect(result.valid).toBe(true);
    });

    it("rejects ContextFileReference with invalid lines", () => {
      const ref = {
        path: ".opencode/context/core/standards/code-quality.md",
        lines: "invalid-range",
        reason: "Test"
      };

      const result = validateLineNumberFormat(ref.lines);
      expect(result.valid).toBe(false);
    });
  });
});
