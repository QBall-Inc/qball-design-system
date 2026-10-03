import { describe, expect, it } from "vitest";
import type { SkeletonBundle } from "../types";
import { resolveByName } from "./resolveByName";
import { loadMockBundle } from "./test-helpers";

/** The same graph re-published under a new revision with every id renumbered. */
function renumbered(bundle: SkeletonBundle): SkeletonBundle {
  const remap = new Map(bundle.nodes.map((nd, i) => [nd.id, 100000 + (bundle.nodes.length - i)]));
  const id = (old: number) => remap.get(old)!;
  return {
    ...bundle,
    revision: `${bundle.revision}-renumbered`,
    nodes: bundle.nodes.map((nd) => ({ ...nd, id: id(nd.id) })),
    typed_edges: bundle.typed_edges.map((e) => ({ ...e, a: id(e.a), b: id(e.b) })),
    comention_edges: bundle.comention_edges.map((e) => ({ ...e, a: id(e.a), b: id(e.b) })),
  };
}

describe("resolveByName (full mock)", () => {
  const first = loadMockBundle();
  const second = renumbered(first);

  it("finds a node by exact name", () => {
    const target = first.nodes[1234]!;
    expect(resolveByName(first.nodes, target.name)).toBe(target);
  });

  it("resolves the same name to the right node in a renumbered bundle", () => {
    const target = first.nodes[1234]!;
    const found = resolveByName(second.nodes, target.name)!;
    expect(found.id).not.toBe(target.id);
    expect(found.name).toBe(target.name);
    expect(found.cls).toBe(target.cls);
    expect(found.eps).toBe(target.eps);
    // The old id means nothing in the new bundle.
    expect(second.nodes.some((nd) => nd.id === target.id)).toBe(false);
  });

  it("returns undefined for an unknown or differently-cased name", () => {
    expect(resolveByName(first.nodes, "no such entity")).toBeUndefined();
    const name = first.nodes[0]!.name;
    expect(
      resolveByName(
        first.nodes,
        name.toUpperCase() === name ? name.toLowerCase() : name.toUpperCase(),
      ),
    ).toBeUndefined();
  });

  it("resolves duplicate names to the first in bundle order", () => {
    const nodes = [
      { id: 1, name: "same name", cls: "tool", eps: 1, aliases: [] },
      { id: 2, name: "same name", cls: "org", eps: 9, aliases: [] },
    ];
    expect(resolveByName(nodes, "same name")!.id).toBe(1);
  });
});
