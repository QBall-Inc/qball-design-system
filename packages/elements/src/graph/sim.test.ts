import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkeletonBundle } from "../types";
import { rngForRevision } from "./prng";
import {
  DEFAULT_SIM_CONFIG,
  buildSimEdges,
  makeSim,
  positionsFromLayout,
  resolvePositions,
  runToCompletion,
} from "./sim";
import { loadMockBundle, loadWithLayoutBundle, syntheticBundle } from "./test-helpers";

const bytes = (a: Float32Array) => Buffer.from(a.buffer, a.byteOffset, a.byteLength);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("seeded layout over the full mock bundle", () => {
  const bundle = loadMockBundle();
  // Two independent full runs (fresh edges, fresh rng) for the determinism proof.
  const first = resolvePositions(bundle);
  const second = resolvePositions(bundle);

  it("simulates when the bundle has no layout", () => {
    expect(bundle.layout).toBeNull();
    expect(first.source).toBe("simulated");
    expect(first.positions.length).toBe(3 * 3294);
  });

  it("is byte-identical across runs for the same revision (G-CON-4)", () => {
    expect(bytes(first.positions).equals(bytes(second.positions))).toBe(true);
  });

  it("produces finite, bounded positions", () => {
    const maxR = DEFAULT_SIM_CONFIG.radius * 1.6;
    for (let i = 0; i < 3294; i++) {
      const [x, y, z] = [
        first.positions[i * 3]!,
        first.positions[i * 3 + 1]!,
        first.positions[i * 3 + 2]!,
      ];
      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);
      expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(maxR * (1 + 1e-6));
    }
  });

  it("matches the committed derived fixture, which takes the layout path at full scale", () => {
    // A stale fixture (simulation changed, generator not re-run) fails here:
    // re-run `just elements-layout-fixture` and commit the result.
    const derived = resolvePositions(loadWithLayoutBundle());
    expect(derived.source).toBe("layout");
    expect(bytes(derived.positions).equals(bytes(first.positions))).toBe(true);
  });

  it("never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random called");
    });
    expect(() => resolvePositions(syntheticBundle())).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("re-seeding on a new revision (synthetic bundle)", () => {
  it("lays the same graph out differently under a different revision, each deterministic", () => {
    const r1a = resolvePositions(syntheticBundle("synthetic-r1")).positions;
    const r1b = resolvePositions(syntheticBundle("synthetic-r1")).positions;
    const r2a = resolvePositions(syntheticBundle("synthetic-r2")).positions;
    const r2b = resolvePositions(syntheticBundle("synthetic-r2")).positions;
    expect(bytes(r1a).equals(bytes(r1b))).toBe(true);
    expect(bytes(r2a).equals(bytes(r2b))).toBe(true);
    expect(bytes(r1a).equals(bytes(r2a))).toBe(false);
  });
});

describe("makeSim stepping", () => {
  const bundle = syntheticBundle();
  const edges = buildSimEdges(bundle);

  it("advances one iteration per step and reports progress", () => {
    const cfg = { ...DEFAULT_SIM_CONFIG, iters: 10 };
    const sim = makeSim(bundle.nodes.length, edges, cfg, rngForRevision(bundle.revision));
    expect(sim.progress).toBe(0);
    const before = sim.pos.slice();
    expect(sim.step()).toBe(true);
    expect(sim.progress).toBeCloseTo(0.1, 12);
    expect(bytes(sim.pos).equals(bytes(before))).toBe(false);
    let steps = 1;
    while (sim.step()) steps++;
    expect(steps + 1).toBe(10);
    expect(sim.progress).toBe(1);
  });

  it("pausing between batches gives the same result as one uninterrupted run", () => {
    const rng = () => rngForRevision(bundle.revision);
    const straight = runToCompletion(makeSim(5, edges, DEFAULT_SIM_CONFIG, rng()));
    const batched = makeSim(5, edges, DEFAULT_SIM_CONFIG, rng());
    let more = true;
    while (more) {
      for (let k = 0; k < 12 && more; k++) more = batched.step();
    }
    expect(bytes(batched.pos).equals(bytes(straight))).toBe(true);
  });

  it("rejects an edge whose endpoint is outside the node range", () => {
    expect(() =>
      makeSim(5, [{ a: 0, b: 5, s: 1 }], DEFAULT_SIM_CONFIG, rngForRevision("x")),
    ).toThrow(/edges\[0\] joins 0-5, outside node indices 0..4/);
  });

  it("does not mutate the caller's edges", () => {
    const snapshot = JSON.stringify(edges);
    runToCompletion(makeSim(5, edges, DEFAULT_SIM_CONFIG, rngForRevision("x")));
    expect(JSON.stringify(edges)).toBe(snapshot);
  });

  it("anchors the satellite component away from the main cloud", () => {
    const pos = resolvePositions(bundle).positions;
    const at = (i: number) => [pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!] as const;
    // Nodes 0-2 form the main component (centred on the origin); 3-4 the satellite.
    const r = (i: number) => Math.hypot(...at(i));
    expect(Math.min(r(3), r(4))).toBeGreaterThan(Math.max(r(0), r(1), r(2)));
  });
});

describe("buildSimEdges", () => {
  it("uses the prototype spring strengths, typed edges first", () => {
    const edges = buildSimEdges(syntheticBundle());
    expect(edges).toEqual([
      { a: 0, b: 1, s: 1 + Math.log(4) },
      { a: 3, b: 4, s: 1 },
      { a: 1, b: 2, s: 0.05 * (1 + Math.log(2)) },
    ]);
  });

  it("rejects a count below 1, which would turn every position into NaN", () => {
    const zeroClaims = {
      ...syntheticBundle(),
      typed_edges: [{ a: 10, b: 11, n: 0, rels: [] }],
    };
    expect(() => buildSimEdges(zeroClaims)).toThrow(
      /typed_edges\[0\]\.n must be a finite count >= 1/,
    );
    const zeroSources = { ...syntheticBundle(), comention_edges: [{ a: 10, b: 11, w: 0 }] };
    expect(() => buildSimEdges(zeroSources)).toThrow(/comention_edges\[0\]\.w/);
  });

  it("fails fast on an edge to a missing node", () => {
    const bad = { ...syntheticBundle(), comention_edges: [{ a: 10, b: 77, w: 1 }] };
    expect(() => buildSimEdges(bad)).toThrow(/comention_edges\[0\].*node id 77/);
  });
});

describe("precomputed layout (G-CON-3, synthetic bundle)", () => {
  const layout: NonNullable<SkeletonBundle["layout"]> = {
    "10": [1.5, -2.25, 3],
    "11": [100, 200, 300],
    "12": [-7, 0, 7],
    "13": [0.125, 0.5, -0.75],
    "14": [9, 8, 7],
  };

  it("returns the layout's positions unchanged and skips the simulation", () => {
    const resolved = resolvePositions({ ...syntheticBundle(), layout });
    expect(resolved.source).toBe("layout");
    expect(Array.from(resolved.positions)).toEqual([
      1.5, -2.25, 3, 100, 200, 300, -7, 0, 7, 0.125, 0.5, -0.75, 9, 8, 7,
    ]);
  });

  it("falls back to simulation when the layout misses a node", () => {
    const partial = { ...layout };
    delete partial["12"];
    const bundle = { ...syntheticBundle(), layout: partial };
    expect(positionsFromLayout(bundle)).toBeNull();
    expect(resolvePositions(bundle).source).toBe("simulated");
  });
});
