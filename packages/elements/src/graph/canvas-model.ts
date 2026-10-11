// DOM-free, three-free view model for the graph canvas: indices, sizes,
// neighbor lists, and the per-node dim / per-edge alpha arrays that the
// selection and filter states produce. Ported from the prototype engine
// (design bundle graph/graph-canvas.js L225-235, L280-285, L333-365, L419-455);
// the canvas only copies these arrays into GPU buffers.

import type { BundleNode, SkeletonBundle } from "../types";
import { topLabelIndices } from "./labels";
import { buildAdjacency, type Neighbor } from "./neighbors";
import { comentionEdgeAlpha, typedEdgeAlpha } from "./scales";

/** Point-sprite size: `base * (1 + log2(typed degree + 1) * grow)` (prototype DEFAULTS.node). */
export const NODE_BASE_SIZE = 9;
export const NODE_SIZE_GROWTH = 0.5;
/** Idle opacity of a node with no typed edge (co-mention only): emphasis follows assertion. */
export const COMENTION_ONLY_DIM = 0.55;
/** Opacity of nodes outside the selection's lit set. */
export const UNLIT_NODE_DIM = 0.12;
/** Opacity of nodes an active filter excludes. */
export const FILTERED_NODE_DIM = 0.06;
/** Alpha multiplier for edges outside the selection / filter. */
export const GHOST_EDGE_FACTOR = 0.08;
/** Co-mention alpha ceiling at rest (prototype `Math.min(comAlpha, 0.3)`). */
export const COMENTION_ALPHA_CAP = 0.3;

export interface ModelEdge {
  /** Endpoint node INDICES. */
  readonly a: number;
  readonly b: number;
  /** Claim count (typed) or shared-source count (co-mention). */
  readonly weight: number;
}

export interface CanvasModel {
  readonly nodes: readonly BundleNode[];
  readonly count: number;
  /** Node id -> index, scoped to this bundle revision. */
  readonly indexOf: ReadonlyMap<number, number>;
  /** Typed (asserted) degree per node index. */
  readonly typedDegree: Float32Array;
  /** Point-sprite size per node index. */
  readonly sizes: Float32Array;
  readonly adjacency: readonly (readonly Neighbor[])[];
  readonly typed: readonly ModelEdge[];
  readonly comention: readonly ModelEdge[];
}

/** Indexes a validated bundle for rendering. */
export function buildCanvasModel(bundle: SkeletonBundle): CanvasModel {
  const indexOf = new Map<number, number>();
  bundle.nodes.forEach((node, i) => indexOf.set(node.id, i));
  const at = (id: number): number => indexOf.get(id)!;
  const typed = bundle.typed_edges.map((e) => ({ a: at(e.a), b: at(e.b), weight: e.n }));
  const comention = bundle.comention_edges.map((e) => ({ a: at(e.a), b: at(e.b), weight: e.w }));
  const count = bundle.nodes.length;
  const typedDegree = new Float32Array(count);
  for (const e of typed) {
    typedDegree[e.a]! += 1;
    typedDegree[e.b]! += 1;
  }
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    sizes[i] = NODE_BASE_SIZE * (1 + Math.log2(typedDegree[i]! + 1) * NODE_SIZE_GROWTH);
  }
  return {
    nodes: bundle.nodes,
    count,
    indexOf,
    typedDegree,
    sizes,
    adjacency: buildAdjacency(bundle),
    typed,
    comention,
  };
}

/** How far a hub's colour moves toward the hub-white token, 0..0.5 (prototype L292). */
export function hubBrightening(typedDegree: number): number {
  return Math.min(0.5, Math.max(0, (Math.log2(typedDegree + 1) - 4.5) * 0.13));
}

/** The selection's lit set: the selected node plus its first `shown` ranked neighbors. */
export function litSet(model: CanvasModel, selected: number, shown: number): Set<number> {
  const lit = new Set<number>([selected]);
  for (const nb of model.adjacency[selected]!.slice(0, shown)) lit.add(nb.j);
  return lit;
}

/** Interaction state the arrays below are derived from. */
export interface ViewState {
  /** Selected node index, or -1. */
  selected: number;
  /** Neighbors shown for the selection (the budget, grown by "show more"). */
  shown: number;
  /** Per-node filter match (1 = match), or null when no filter is active. */
  filterMask: Uint8Array | null;
}

/**
 * Per-node opacity for the state (written into the `aDim` attribute). `lit` is
 * the selection's lit set (`litSet`), or null when nothing is selected.
 */
export function nodeDims(
  model: CanvasModel,
  state: ViewState,
  out: Float32Array,
  lit: ReadonlySet<number> | null,
): Float32Array {
  if (lit) {
    for (let i = 0; i < model.count; i++) out[i] = lit.has(i) ? 1 : UNLIT_NODE_DIM;
    return out;
  }
  for (let i = 0; i < model.count; i++) {
    if (state.filterMask) out[i] = state.filterMask[i] ? 1 : FILTERED_NODE_DIM;
    else out[i] = model.typedDegree[i]! > 0 ? 1 : COMENTION_ONLY_DIM;
  }
  return out;
}

/** Edge colour role, resolved to a palette colour by the canvas. */
export const EdgeRole = { rest: 0, litTyped: 1, litComention: 2 } as const;
export type EdgeRole = (typeof EdgeRole)[keyof typeof EdgeRole];

export interface EdgeStyle {
  alpha: Float32Array;
  role: Uint8Array;
}

/**
 * Per-edge alpha and colour role for one edge class. At rest typed edges are
 * opacity-weighted by `n` and co-mention edges by `w`; a selection lights the
 * edges between the selected node and its lit neighbors (typed -> signal,
 * co-mention -> amber) and ghosts the rest; a filter ghosts edges with an
 * excluded endpoint. `lit` is the selection's lit set, or null.
 */
export function edgeStyle(
  model: CanvasModel,
  state: ViewState,
  isTyped: boolean,
  out: EdgeStyle,
  lit: ReadonlySet<number> | null,
): EdgeStyle {
  const edges = isTyped ? model.typed : model.comention;
  for (let k = 0; k < edges.length; k++) {
    const e = edges[k]!;
    let a = isTyped
      ? typedEdgeAlpha(e.weight)
      : Math.min(comentionEdgeAlpha(e.weight), COMENTION_ALPHA_CAP);
    let role: EdgeRole = EdgeRole.rest;
    if (lit) {
      const incident =
        (e.a === state.selected || e.b === state.selected) && lit.has(e.a) && lit.has(e.b);
      if (incident) {
        role = isTyped ? EdgeRole.litTyped : EdgeRole.litComention;
        a = isTyped ? Math.max(a, 0.9) : Math.min(a * 4 + 0.2, 0.6);
      } else {
        a *= GHOST_EDGE_FACTOR;
      }
    } else if (state.filterMask && !(state.filterMask[e.a] && state.filterMask[e.b])) {
      a *= GHOST_EDGE_FACTOR;
    }
    out.alpha[k] = a;
    out.role[k] = role;
  }
  return out;
}

/** Always-on label indices: the `budget` nodes with the most episodes. */
export function baseLabelIndices(model: CanvasModel, budget: number): number[] {
  return topLabelIndices(model.nodes, budget);
}
