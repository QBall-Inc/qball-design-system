import { describe, expect, it } from "vitest";
import {
  COMENTION_EDGE_ALPHA,
  TYPED_EDGE_ALPHA,
  comentionEdgeAlpha,
  typedEdgeAlpha,
} from "./scales";
import { loadMockBundle } from "./test-helpers";

// The prototype's unclamped formulas (graph-canvas.js L333-335), the in-domain oracle.
const protoTyped = (n: number) => 0.14 + (0.5 - 0.14) * (Math.log(n + 1) / Math.log(48));
const protoCom = (w: number) => 0.025 + (0.07 - 0.025) * (Math.log(w + 1) / Math.log(9));

describe("typedEdgeAlpha", () => {
  it("matches the prototype at the domain floor and ceiling", () => {
    expect(typedEdgeAlpha(1)).toBeCloseTo(protoTyped(1), 12);
    expect(typedEdgeAlpha(47)).toBe(TYPED_EDGE_ALPHA[1]);
  });

  it("clamps beyond the ceiling instead of extrapolating", () => {
    expect(protoTyped(200)).toBeGreaterThan(0.5); // the prototype would overshoot
    expect(typedEdgeAlpha(200)).toBe(TYPED_EDGE_ALPHA[1]);
    expect(typedEdgeAlpha(0)).toBe(TYPED_EDGE_ALPHA[0]);
  });

  it("maps every typed edge of the full mock into range, equal to the prototype", () => {
    const { typed_edges } = loadMockBundle();
    expect(typed_edges.length).toBe(2857);
    for (const e of typed_edges) {
      const a = typedEdgeAlpha(e.n);
      expect(a).toBeGreaterThanOrEqual(TYPED_EDGE_ALPHA[0]);
      expect(a).toBeLessThanOrEqual(TYPED_EDGE_ALPHA[1]);
      expect(a).toBeCloseTo(protoTyped(e.n), 12);
    }
  });
});

describe("comentionEdgeAlpha", () => {
  it("matches the prototype at the domain floor and ceiling", () => {
    expect(comentionEdgeAlpha(1)).toBeCloseTo(protoCom(1), 12);
    expect(comentionEdgeAlpha(8)).toBe(COMENTION_EDGE_ALPHA[1]);
  });

  it("clamps beyond the ceiling instead of extrapolating", () => {
    expect(protoCom(30)).toBeGreaterThan(0.07);
    expect(comentionEdgeAlpha(30)).toBe(COMENTION_EDGE_ALPHA[1]);
  });

  it("maps every co-mention edge of the full mock into range, equal to the prototype", () => {
    const { comention_edges } = loadMockBundle();
    expect(comention_edges.length).toBe(10003);
    for (const e of comention_edges) {
      const a = comentionEdgeAlpha(e.w);
      expect(a).toBeGreaterThanOrEqual(COMENTION_EDGE_ALPHA[0]);
      expect(a).toBeLessThanOrEqual(COMENTION_EDGE_ALPHA[1]);
      expect(a).toBeCloseTo(protoCom(e.w), 12);
    }
  });

  it("accepts a custom output range", () => {
    expect(comentionEdgeAlpha(8, [0, 1])).toBe(1);
    expect(comentionEdgeAlpha(0, [0.2, 0.9])).toBe(0.2);
  });
});
