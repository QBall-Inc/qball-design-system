// Neighbor ranking for a selected node, ported from the prototype (design
// bundle graph/graph-canvas.js L230-233 adjacency; L420/L458 budget + "show
// more"). Typed (asserted) neighbors always outrank co-mention ones: typed
// weight is 100 + n (n <= 47 observed), co-mention weight is w (<= 8).

import type { SkeletonBundle } from "../types";

/** Default neighbors shown per selection, and per "show more" step (prototype budgetN). */
export const DEFAULT_NEIGHBOR_BUDGET = 20;

export interface Neighbor {
  /** Neighbor node INDEX in `bundle.nodes`. */
  j: number;
  /** Ranking weight: 100 + n for typed edges, w for co-mention edges. */
  w: number;
  typed: boolean;
}

/**
 * Per-node neighbor lists (indexed like `bundle.nodes`), each sorted once by
 * descending weight. Ties keep insertion order: typed edges first, then
 * co-mention, each in bundle order (Array.prototype.sort is stable).
 */
export function buildAdjacency(bundle: SkeletonBundle): Neighbor[][] {
  const indexOf = new Map<number, number>();
  bundle.nodes.forEach((node, i) => indexOf.set(node.id, i));
  const at = (id: number): number => {
    const i = indexOf.get(id);
    if (i === undefined)
      throw new Error(`edge references node id ${id}, which is not in the bundle`);
    return i;
  };
  const lists: Neighbor[][] = bundle.nodes.map(() => []);
  for (const e of bundle.typed_edges) {
    const a = at(e.a);
    const b = at(e.b);
    lists[a]!.push({ j: b, w: 100 + e.n, typed: true });
    lists[b]!.push({ j: a, w: 100 + e.n, typed: true });
  }
  for (const e of bundle.comention_edges) {
    const a = at(e.a);
    const b = at(e.b);
    lists[a]!.push({ j: b, w: e.w, typed: false });
    lists[b]!.push({ j: a, w: e.w, typed: false });
  }
  for (const list of lists) list.sort((x, y) => y.w - x.w);
  return lists;
}

/** A budgeted view of one node's ranked neighbors: shows `shown` of `total`. */
export interface NeighborPage {
  readonly items: readonly Neighbor[];
  readonly shown: number;
  readonly total: number;
  readonly hasMore: boolean;
}

/** The first `budget` neighbors of a pre-sorted list. */
export function topNeighbors(
  sorted: readonly Neighbor[],
  budget: number = DEFAULT_NEIGHBOR_BUDGET,
): NeighborPage {
  return page(sorted, budget);
}

/** "Show more": grows a page by another `budget` entries from the same sorted list. */
export function expandNeighbors(
  sorted: readonly Neighbor[],
  current: NeighborPage,
  budget: number = DEFAULT_NEIGHBOR_BUDGET,
): NeighborPage {
  return page(sorted, current.shown + budget);
}

function page(sorted: readonly Neighbor[], limit: number): NeighborPage {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError(`neighbor budget must be a non-negative integer, got ${limit}`);
  }
  const items = sorted.slice(0, limit);
  return {
    items,
    shown: items.length,
    total: sorted.length,
    hasMore: items.length < sorted.length,
  };
}
