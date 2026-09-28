import { describe, expect, it } from "vitest";
import { confidenceMark } from "./confidence";

describe("confidenceMark", () => {
  it.each([
    ["high", "◆", "high"],
    ["medium", "◈", "medium"],
    ["low", "◇", "low"],
  ] as const)("maps %s to a glyph AND a word", (tier, glyph, word) => {
    expect(confidenceMark(tier)).toEqual({ tier, glyph, word });
  });

  it("accepts case and whitespace variants and the 'med' shorthand", () => {
    expect(confidenceMark(" HIGH ").glyph).toBe("◆");
    expect(confidenceMark("Med").tier).toBe("medium");
  });

  it("gives every tier a distinct glyph and a non-empty word", () => {
    const marks = ["high", "medium", "low"].map(confidenceMark);
    expect(new Set(marks.map((m) => m.glyph)).size).toBe(3);
    for (const mark of marks) expect(mark.word.length).toBeGreaterThan(0);
  });

  it.each(["", "certain", "0.9"])("throws an actionable error for unknown tier %j", (tier) => {
    expect(() => confidenceMark(tier)).toThrow(
      `Unknown confidence_tier "${tier}" — expected one of: high, medium, low.`,
    );
  });
});
