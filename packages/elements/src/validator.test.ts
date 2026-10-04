import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BundleValidationError, validateSkeletonBundle } from "./validator";

// vitest runs with the package directory as cwd.
const MOCK_BUNDLE = resolve(process.cwd(), "../../fixtures/qubrain/mock-bundle.json");

function validBundle(): Record<string, unknown> {
  return {
    revision: "rev-test",
    stats: {
      entities: 3,
      claims_total: 4,
      claims_valid: 3,
      claims_superseded: 1,
      episodes: 2,
      earliest_claim_date: "2025-01-01",
      latest_claim_date: "2026-07-17",
      snapshot_date: "2026-07-17",
    },
    nodes: [
      { id: 1, name: "agent memory", cls: "concept", eps: 4, aliases: [] },
      {
        id: 2,
        name: "retrieval",
        cls: "concept",
        eps: 2,
        aliases: ["rag"],
        facets: { domains: ["ai"], sub_domains: ["memory"] },
      },
      { id: 3, name: "eval harness", cls: "product", eps: 1, aliases: [] },
    ],
    typed_edges: [{ a: 1, b: 2, n: 3, rels: ["improves"] }],
    comention_edges: [{ a: 2, b: 3, w: 1 }],
    layout: null,
  };
}

function rejection(bundle: unknown): BundleValidationError {
  try {
    validateSkeletonBundle(bundle);
  } catch (error) {
    if (error instanceof BundleValidationError) return error;
    throw error;
  }
  throw new Error("expected validateSkeletonBundle to throw, but it returned");
}

describe("validateSkeletonBundle", () => {
  it("accepts the real mock bundle (fixture of record)", () => {
    const bundle: unknown = JSON.parse(readFileSync(MOCK_BUNDLE, "utf8"));
    expect(() => validateSkeletonBundle(bundle)).not.toThrow();
  });

  it("accepts a minimal valid bundle, with and without a precomputed layout", () => {
    expect(() => validateSkeletonBundle(validBundle())).not.toThrow();
    const withLayout = {
      ...validBundle(),
      layout: { "1": [0, 0, 0], "2": [1.5, -2, 3], "3": [4, 5, 6] },
    };
    expect(() => validateSkeletonBundle(withLayout)).not.toThrow();
  });

  it("rejects a typed edge pointing at a node id that is not in nodes", () => {
    const bundle = { ...validBundle(), typed_edges: [{ a: 1, b: 99, n: 1, rels: [] }] };
    const error = rejection(bundle);
    expect(error.path).toBe("typed_edges[0].b");
    expect(error.message).toBe(
      "Invalid SkeletonBundle at typed_edges[0].b: references node id 99, which is not in nodes",
    );
  });

  it("rejects a co-mention edge pointing at a node id that is not in nodes", () => {
    const bundle = { ...validBundle(), comention_edges: [{ a: 42, b: 3, w: 2 }] };
    const error = rejection(bundle);
    expect(error.path).toBe("comention_edges[0].a");
    expect(error.message).toContain("references node id 42");
  });

  it("rejects a dangling edge in the real mock bundle once a node is removed", () => {
    const bundle = JSON.parse(readFileSync(MOCK_BUNDLE, "utf8")) as {
      nodes: { id: number }[];
      typed_edges: { a: number; b: number }[];
    };
    const edge = bundle.typed_edges[0];
    expect(edge).toBeDefined();
    const removedId = edge?.a;
    bundle.nodes = bundle.nodes.filter((node) => node.id !== removedId);
    const error = rejection(bundle);
    expect(error.message).toContain(`references node id ${String(removedId)}`);
  });

  it("rejects duplicate node ids, naming both positions", () => {
    const bundle = validBundle();
    (bundle["nodes"] as unknown[]).push({
      id: 2,
      name: "dupe",
      cls: "concept",
      eps: 1,
      aliases: [],
    });
    const error = rejection(bundle);
    expect(error.path).toBe("nodes[3].id");
    expect(error.message).toContain("duplicate id 2 (first seen at nodes[1])");
  });

  it.each([
    "entities",
    "claims_total",
    "claims_valid",
    "claims_superseded",
    "episodes",
    "earliest_claim_date",
    "latest_claim_date",
    "snapshot_date",
  ])("rejects a bundle whose stats.%s is missing", (field) => {
    const bundle = validBundle();
    delete (bundle["stats"] as Record<string, unknown>)[field];
    const error = rejection(bundle);
    expect(error.path).toBe(`stats.${field}`);
    expect(error.message).toContain("got undefined");
  });

  it("rejects stats fields of the wrong type", () => {
    const numeric = validBundle();
    (numeric["stats"] as Record<string, unknown>)["claims_total"] = "4";
    expect(rejection(numeric).message).toBe(
      "Invalid SkeletonBundle at stats.claims_total: expected a finite number, got string",
    );

    const dated = validBundle();
    (dated["stats"] as Record<string, unknown>)["snapshot_date"] = 20260717;
    expect(rejection(dated).message).toBe(
      "Invalid SkeletonBundle at stats.snapshot_date: expected a string, got number",
    );
  });

  it("rejects a missing stats block, a non-object root and non-array collections", () => {
    const noStats = validBundle();
    delete noStats["stats"];
    expect(rejection(noStats).path).toBe("stats");
    expect(rejection(null).path).toBe("(root)");
    expect(rejection([]).path).toBe("(root)");
    expect(rejection({ ...validBundle(), nodes: {} }).path).toBe("nodes");
  });

  it("rejects malformed node fields and facets", () => {
    const badAlias = validBundle();
    (badAlias["nodes"] as Record<string, unknown>[])[0] = {
      id: 1,
      name: "agent memory",
      cls: "concept",
      eps: 4,
      aliases: [7],
    };
    expect(rejection(badAlias).path).toBe("nodes[0].aliases[0]");

    const badFacets = validBundle();
    (badFacets["nodes"] as Record<string, unknown>[])[1] = {
      id: 2,
      name: "retrieval",
      cls: "concept",
      eps: 2,
      aliases: [],
      facets: { domains: ["ai"] },
    };
    expect(rejection(badFacets).path).toBe("nodes[1].facets.sub_domains");
  });

  it("accepts optional facet pairs and rejects malformed ones", () => {
    const withPairs = (pairs: unknown): Record<string, unknown> => {
      const bundle = validBundle();
      (bundle["nodes"] as Record<string, unknown>[])[1] = {
        id: 2,
        name: "retrieval",
        cls: "concept",
        eps: 2,
        aliases: [],
        facets: { domains: ["ai"], sub_domains: ["memory"], pairs },
      };
      return bundle;
    };

    expect(() =>
      validateSkeletonBundle(withPairs([{ domain: "ai", sub_domain: "memory" }])),
    ).not.toThrow();
    expect(() => validateSkeletonBundle(withPairs([]))).not.toThrow();

    expect(rejection(withPairs({ domain: "ai" })).path).toBe("nodes[1].facets.pairs");
    expect(rejection(withPairs(["ai|memory"])).path).toBe("nodes[1].facets.pairs[0]");
    expect(rejection(withPairs([{ domain: "ai" }])).path).toBe(
      "nodes[1].facets.pairs[0].sub_domain",
    );
    expect(
      rejection(withPairs([{ domain: "ai", sub_domain: "memory" }, { sub_domain: "x" }])).path,
    ).toBe("nodes[1].facets.pairs[1].domain");
  });

  it("requires layout to be present, and null or [x, y, z] per node", () => {
    const missing = validBundle();
    delete missing["layout"];
    expect(rejection(missing).path).toBe("layout");

    const short = { ...validBundle(), layout: { "1": [0, 0] } };
    expect(rejection(short).message).toContain("expected [x, y, z], got 2 values");
  });
});
