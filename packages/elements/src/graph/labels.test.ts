import { describe, expect, it } from "vitest";
import { DEFAULT_LABEL_BUDGET, topLabelIndices } from "./labels";
import { loadMockBundle } from "./test-helpers";

const { nodes } = loadMockBundle();

describe("topLabelIndices (full mock)", () => {
  it("picks the 30 nodes with the most episodes, highest first", () => {
    const top = topLabelIndices(nodes);
    expect(DEFAULT_LABEL_BUDGET).toBe(30);
    expect(top.length).toBe(30);
    const eps = top.map((i) => nodes[i]!.eps);
    for (let k = 1; k < eps.length; k++) expect(eps[k - 1]!).toBeGreaterThanOrEqual(eps[k]!);
    // No unlabeled node has more episodes than the least-labeled one.
    const chosen = new Set(top);
    const floor = eps[eps.length - 1]!;
    expect(nodes.every((nd, i) => chosen.has(i) || nd.eps <= floor)).toBe(true);
  });

  it("is independent of camera state: same input, same answer", () => {
    expect(topLabelIndices(nodes, 14)).toEqual(topLabelIndices(nodes).slice(0, 14));
  });

  it("rejects a non-integer or negative budget", () => {
    expect(() => topLabelIndices(nodes, -3)).toThrow(RangeError);
  });
});
