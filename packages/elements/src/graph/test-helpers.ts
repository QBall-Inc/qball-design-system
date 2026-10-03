// Shared loaders for the graph-logic tests (vitest runs with the package
// directory as cwd, so fixture paths resolve from process.cwd()).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SkeletonBundle } from "../types";
import { validateSkeletonBundle } from "../validator";

export const MOCK_BUNDLE_PATH = resolve(process.cwd(), "../../fixtures/qubrain/mock-bundle.json");
export const WITH_LAYOUT_PATH = resolve(
  process.cwd(),
  "../../fixtures/qubrain/mock-bundle.with-layout.json",
);

/** The full fixture of record (3,294 nodes), validated through the public contract. */
export function loadMockBundle(): SkeletonBundle {
  const bundle: unknown = JSON.parse(readFileSync(MOCK_BUNDLE_PATH, "utf8"));
  validateSkeletonBundle(bundle);
  return bundle;
}

/** The derived fixture (mock + the package's own seeded layout), validated the same way. */
export function loadWithLayoutBundle(): SkeletonBundle {
  const bundle: unknown = JSON.parse(readFileSync(WITH_LAYOUT_PATH, "utf8"));
  validateSkeletonBundle(bundle);
  return bundle;
}

/**
 * A small synthetic bundle: two components (a 3-node main cloud and a 2-node
 * satellite) with pseudonymous names. Used only for the branches the fixture of
 * record cannot exercise (a populated layout; a second revision of the same graph).
 */
export function syntheticBundle(revision = "synthetic-r1"): SkeletonBundle {
  return {
    revision,
    stats: {
      entities: 5,
      claims_total: 9,
      claims_valid: 8,
      claims_superseded: 1,
      episodes: 4,
      earliest_claim_date: "2025-01-01",
      latest_claim_date: "2026-01-01",
      snapshot_date: "2026-01-01",
    },
    nodes: [
      { id: 10, name: "alpha method", cls: "technique", eps: 3, aliases: [] },
      { id: 11, name: "beta toolkit", cls: "tool", eps: 5, aliases: [] },
      { id: 12, name: "gamma dataset", cls: "dataset-benchmark", eps: 1, aliases: [] },
      { id: 13, name: "delta protocol", cls: "standard-protocol", eps: 2, aliases: [] },
      { id: 14, name: "epsilon model", cls: "model", eps: 4, aliases: [] },
    ],
    typed_edges: [
      { a: 10, b: 11, n: 4, rels: ["uses"] },
      { a: 13, b: 14, n: 1, rels: ["implements"] },
    ],
    comention_edges: [{ a: 11, b: 12, w: 2 }],
    layout: null,
  };
}
