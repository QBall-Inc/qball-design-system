// Always-on label selection, ported from the prototype (design bundle
// graph/graph-canvas.js L371): the `budget` nodes with the most episodes.
// Camera projection and on-screen collision culling stay in the canvas.

import type { BundleNode } from "../types";

/** Default always-on labels (prototype labelBudget; the canvas lowers it on touch devices). */
export const DEFAULT_LABEL_BUDGET = 30;

/**
 * Node INDICES of the top `budget` nodes by episode count, highest first.
 * Ties keep bundle order (stable sort).
 */
export function topLabelIndices(
  nodes: readonly BundleNode[],
  budget: number = DEFAULT_LABEL_BUDGET,
): number[] {
  if (!Number.isInteger(budget) || budget < 0) {
    throw new RangeError(`label budget must be a non-negative integer, got ${budget}`);
  }
  return nodes
    .map((_, i) => i)
    .sort((a, b) => nodes[b]!.eps - nodes[a]!.eps)
    .slice(0, budget);
}
