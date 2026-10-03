import { describe, expect, it } from "vitest";
import {
  DEFAULT_NEIGHBOR_BUDGET,
  buildAdjacency,
  expandNeighbors,
  topNeighbors,
} from "./neighbors";
import { loadMockBundle } from "./test-helpers";

const bundle = loadMockBundle();
const adjacency = buildAdjacency(bundle);

describe("buildAdjacency (full mock)", () => {
  it("lists every edge from both ends", () => {
    const entries = adjacency.reduce((sum, list) => sum + list.length, 0);
    expect(entries).toBe(2 * (2857 + 10003));
  });

  it("sorts each list by descending weight, typed (100 + n) above co-mention (w)", () => {
    expect(adjacency.length).toBe(bundle.nodes.length);
    let mixed = 0;
    for (const list of adjacency) {
      for (let k = 1; k < list.length; k++) {
        expect(list[k - 1]!.w).toBeGreaterThanOrEqual(list[k]!.w);
      }
      const firstCom = list.findIndex((x) => !x.typed);
      if (firstCom > 0) {
        mixed++;
        expect(list.slice(firstCom).every((x) => !x.typed)).toBe(true);
      }
    }
    expect(mixed).toBeGreaterThan(0); // the ordering claim was exercised
  });

  it("weights typed edges 100 + n and co-mention edges w", () => {
    const e = bundle.typed_edges[0]!;
    const a = bundle.nodes.findIndex((nd) => nd.id === e.a);
    const b = bundle.nodes.findIndex((nd) => nd.id === e.b);
    expect(adjacency[a]!.some((x) => x.j === b && x.typed && x.w === 100 + e.n)).toBe(true);
    const c = bundle.comention_edges[0]!;
    const ca = bundle.nodes.findIndex((nd) => nd.id === c.a);
    const cb = bundle.nodes.findIndex((nd) => nd.id === c.b);
    expect(adjacency[ca]!.some((x) => x.j === cb && !x.typed && x.w === c.w)).toBe(true);
  });
});

describe("topNeighbors / expandNeighbors (full mock)", () => {
  const big = adjacency.reduce((best, list) => (list.length > best.length ? list : best));

  it("returns exactly the budget for a node with more neighbors than the budget", () => {
    expect(big.length).toBeGreaterThan(3 * DEFAULT_NEIGHBOR_BUDGET);
    const first = topNeighbors(big);
    expect(first.items.length).toBe(20);
    expect(first.shown).toBe(20);
    expect(first.total).toBe(big.length);
    expect(first.hasMore).toBe(true);
    expect(first.items).toEqual(big.slice(0, 20));
  });

  it("show more grows the same ranked slice by another budget", () => {
    const first = topNeighbors(big);
    const second = expandNeighbors(big, first);
    expect(second.shown).toBe(40);
    expect(second.items.slice(0, 20)).toEqual(first.items);
    expect(second.items).toEqual(big.slice(0, 40));
  });

  it("stops at the end of the list", () => {
    const small = adjacency.find((list) => list.length > 0 && list.length < 20)!;
    const page = expandNeighbors(small, topNeighbors(small));
    expect(page.shown).toBe(small.length);
    expect(page.hasMore).toBe(false);
  });

  it("rejects a non-integer or negative budget", () => {
    expect(() => topNeighbors(big, -1)).toThrow(RangeError);
    expect(() => topNeighbors(big, 2.5)).toThrow(RangeError);
  });
});

describe("buildAdjacency input checks", () => {
  it("names the missing node id", () => {
    const broken = {
      ...bundle,
      typed_edges: [{ a: -999, b: bundle.nodes[0]!.id, n: 1, rels: [] }],
    };
    expect(() => buildAdjacency(broken)).toThrow(/node id -999/);
  });
});
