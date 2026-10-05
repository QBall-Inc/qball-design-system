import { describe, expect, it } from "vitest";
import { renderProvenanceFooter } from "./ProvenanceFooter";

describe("renderProvenanceFooter — answer", () => {
  it.each([
    [
      0,
      0,
      0,
      "0 claims",
      "0 claims · 0 episodes · high confidence · snapshot 2026-07-17 · 0 superseded excluded",
    ],
    [
      1,
      1,
      1,
      "1 claim",
      "1 claim · 1 episode · high confidence · snapshot 2026-07-17 · 1 superseded excluded",
    ],
    [
      12,
      9,
      2,
      "12 claims",
      "12 claims · 9 episodes · high confidence · snapshot 2026-07-17 · 2 superseded excluded",
    ],
  ])("claims=%i episodes=%i superseded=%i", (claims, episodes, superseded, bold, text) => {
    const footer = renderProvenanceFooter("answer", {
      claims,
      episodes,
      confidenceTier: "high",
      snapshotDate: "2026-07-17",
      supersededExcluded: superseded,
    });
    expect(footer.tagName).toBe("FOOTER");
    expect(footer.className).toBe("provfoot");
    expect(footer.textContent).toBe(text);
    expect(footer.querySelector("b")?.textContent).toBe(bold);
  });

  it("renders the tier word for each confidence tier", () => {
    const footer = renderProvenanceFooter("answer", {
      claims: 3,
      episodes: 2,
      confidenceTier: "low",
      snapshotDate: "2026-07-17",
      supersededExcluded: 0,
    });
    expect(footer.textContent).toContain(" · low confidence · ");
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
      renderProvenanceFooter("answer", {
        claims: 1,
        episodes: 1,
        confidenceTier: "high",
        snapshotDate: "17 July",
        supersededExcluded: 0,
      }),
    ).toThrow(/ISO date/);
  });
});
