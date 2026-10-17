import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SkeletonBundle } from "../types";
import { BundleValidationError } from "../validator";
import { LAYOUT_VERSION, computeLayout } from "./layout";
import { positionsFromLayout, resolvePositions } from "./sim";
import { loadMockBundle, loadWithLayoutBundle, syntheticBundle } from "./test-helpers";

/**
 * sha256 of JSON.stringify(computeLayout(mock-bundle.json)) per LAYOUT_VERSION.
 * When the algorithm's output changes, this test fails: bump LAYOUT_VERSION in
 * layout.ts, add its hash here, and regenerate the derived fixture
 * (`just elements-layout-fixture`). Never edit an existing entry. Editing the
 * fixture of record also trips it; then only the hash is refreshed (the
 * algorithm did not change, so LAYOUT_VERSION stays).
 */
const OUTPUT_HASH_BY_VERSION: Readonly<Record<number, string>> = {
  1: "26ebf22b758f6e13d67fb241bfdafd0d4fdb9401c90430b76985611fff5e6ca5",
};

const sha256 = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

/** A deep copy, so a mutation never leaks into the bundle it came from. */
const clone = (bundle: SkeletonBundle): SkeletonBundle =>
  JSON.parse(JSON.stringify(bundle)) as SkeletonBundle;

describe("computeLayout over the full mock bundle", () => {
  const mock = loadMockBundle();
  const layout = computeLayout(mock);

  it("is exactly the committed derived fixture's layout", () => {
    expect(JSON.stringify(layout)).toBe(JSON.stringify(loadWithLayoutBundle().layout));
  });

  it("matches the output pinned for the current LAYOUT_VERSION", () => {
    expect(OUTPUT_HASH_BY_VERSION[LAYOUT_VERSION]).toBe(sha256(layout));
  });

  it("places every node, keyed by its stringified id, with finite coordinates", () => {
    expect(Object.keys(layout)).toEqual(mock.nodes.map((node) => String(node.id)));
    for (const position of Object.values(layout)) {
      expect(position).toHaveLength(3);
      expect(position.every(Number.isFinite)).toBe(true);
    }
  });

  it("gives the canvas the same positions as its own live simulation", () => {
    const fromLayout = positionsFromLayout({ ...mock, layout });
    expect(fromLayout).not.toBeNull();
    expect(Array.from(fromLayout!)).toEqual(Array.from(resolvePositions(mock).positions));
  });
});

describe("computeLayout inputs", () => {
  const base = syntheticBundle();
  const expected = JSON.stringify(computeLayout(base));

  it("is byte-identical across runs", () => {
    expect(JSON.stringify(computeLayout(clone(base)))).toBe(expected);
  });

  it("ignores every field except revision, node ids and edges", () => {
    const changed = clone(base);
    changed._note = "a different note";
    changed.stats = { ...changed.stats, entities: 999, snapshot_date: "2030-01-01" };
    changed.nodes = changed.nodes.map((node) => ({
      ...node,
      name: `${node.name} (renamed)`,
      cls: "concept",
      eps: node.eps + 7,
      aliases: ["alias"],
      facets: { domains: ["other"], sub_domains: ["other"] },
    }));
    changed.typed_edges = changed.typed_edges.map((edge) => ({ ...edge, rels: ["renamed"] }));
    changed.layout = Object.fromEntries(
      changed.nodes.map((node) => [String(node.id), [1, 2, 3] as [number, number, number]]),
    );
    expect(JSON.stringify(computeLayout(changed))).toBe(expected);
  });

  it("changes with the revision (positive control)", () => {
    expect(JSON.stringify(computeLayout(syntheticBundle("synthetic-r2")))).not.toBe(expected);
  });

  it("changes with an edge weight (positive control)", () => {
    const heavier = clone(base);
    heavier.typed_edges[0]!.n += 5;
    expect(JSON.stringify(computeLayout(heavier))).not.toBe(expected);
  });

  it("changes with a co-mention weight (positive control)", () => {
    const heavier = clone(base);
    heavier.comention_edges[0]!.w += 5;
    expect(JSON.stringify(computeLayout(heavier))).not.toBe(expected);
  });

  it("changes with the node order, which is part of its input (positive control)", () => {
    const reordered = clone(base);
    reordered.nodes.reverse();
    const layout = computeLayout(reordered);
    const ids = base.nodes.map((node) => String(node.id));
    expect(Object.keys(layout).sort()).toEqual(ids.sort());
    expect(JSON.stringify(layout)).not.toBe(expected);
  });

  it("does not mutate the bundle it is given", () => {
    const input = clone(base);
    const before = JSON.stringify(input);
    computeLayout(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("rejects a bundle that is not a valid SkeletonBundle", () => {
    const broken = clone(base) as unknown as Record<string, unknown>;
    delete broken["revision"];
    expect(() => computeLayout(broken as unknown as SkeletonBundle)).toThrow(BundleValidationError);
  });

  it("rejects an edge to a node the bundle does not have, before simulating", () => {
    const dangling = clone(base);
    dangling.typed_edges[0]!.b = 9_999;
    expect(() => computeLayout(dangling)).toThrow(BundleValidationError);
  });

  it("produces a layout the canvas rejects for a bundle whose node ids differ", () => {
    const layout = computeLayout(base);
    const other = clone(base);
    other.nodes[0]!.id = 9_999;
    for (const edge of [...other.typed_edges, ...other.comention_edges]) {
      if (edge.a === base.nodes[0]!.id) edge.a = 9_999;
      if (edge.b === base.nodes[0]!.id) edge.b = 9_999;
    }
    expect(positionsFromLayout({ ...other, layout })).toBeNull();
  });
});
