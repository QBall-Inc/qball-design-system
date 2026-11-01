import { describe, expect, it } from "vitest";
import { renderProvenanceFooter } from "./ProvenanceFooter";
import { TEST_LABELS } from "./test-fixtures";

describe("renderProvenanceFooter — answer", () => {
  it.each([
    [0, 0, 0, "0 claims", "0 claims · 0 sources · 2026-07-17 · 0 outdated claims · Evidence: high"],
    [1, 1, 1, "1 claim", "1 claim · 1 source · 2026-07-17 · 1 outdated claim · Evidence: high"],
    [
      12,
      9,
      2,
      "12 claims",
      "12 claims · 9 sources · 2026-07-17 · 2 outdated claims · Evidence: high",
    ],
  ])("claims=%i sources=%i superseded=%i", (claims, sources, superseded, bold, text) => {
    const footer = renderProvenanceFooter(
      "answer",
      {
        claims,
        sources,
        confidenceTier: "high",
        revisionDate: "2026-07-17",
        supersededExcluded: superseded,
      },
      TEST_LABELS,
    );
    expect(footer.tagName).toBe("FOOTER");
    expect(footer.className).toBe("provfoot");
    expect(footer.textContent).toBe(text);
    expect(footer.querySelector("b")?.textContent).toBe(bold);
  });

  it("ends with the consumer's evidence label for the tier", () => {
    const footer = renderProvenanceFooter(
      "answer",
      {
        claims: 3,
        sources: 2,
        confidenceTier: "low",
        revisionDate: "2026-07-17",
        supersededExcluded: 0,
      },
      TEST_LABELS,
    );
    expect(footer.textContent?.endsWith(" · Evidence: low")).toBe(true);
    expect(footer.textContent).not.toContain("confidence");
  });
});

describe("renderProvenanceFooter — panel", () => {
  it.each([
    [0, 0, 0, "0 claims", "0 claims · 0 sources · revision 2026-07-17 · 0 superseded shown"],
    [1, 1, 0, "1 claim", "1 claim · 1 source · revision 2026-07-17 · 0 superseded shown"],
    [7, 5, 1, "7 claims", "7 claims · 5 sources · revision 2026-07-17 · 1 superseded shown"],
  ])("claims=%i sources=%i superseded=%i", (claims, sources, superseded, bold, text) => {
    const footer = renderProvenanceFooter("panel", {
      claims,
      sources,
      revisionDate: "2026-07-17",
      supersededShown: superseded,
    });
    expect(footer.textContent).toBe(text);
    expect(footer.querySelector("b")?.textContent).toBe(bold);
    expect(footer.textContent).toContain("revision");
    expect(footer.textContent).toContain("superseded shown");
    expect(footer.textContent).not.toContain("confidence");
  });
});

describe("renderProvenanceFooter — invalid data", () => {
  it("fails fast instead of rendering a malformed locked line", () => {
    expect(() =>
      renderProvenanceFooter("panel", {
        claims: -1,
        sources: 1,
        revisionDate: "2026-07-17",
        supersededShown: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      renderProvenanceFooter(
        "answer",
        {
          claims: 1,
          sources: 1,
          confidenceTier: "high",
          revisionDate: "17 July",
          supersededExcluded: 0,
        },
        TEST_LABELS,
      ),
    ).toThrow(/ISO date/);
  });
});
