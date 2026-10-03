// Edge opacity scales, ported from the prototype (design bundle
// graph/graph-canvas.js L333-335): log-scaled over the observed data domains,
// typed-edge claim count n in 1..47 and co-mention source count w in 1..8.
//
// One deliberate change: the normalised position is clamped to [0, 1], so a
// value beyond the observed ceiling pins to the top of the range instead of
// extrapolating past it (the prototype had no clamp). In-domain outputs are
// identical to the prototype.

/** [min, max] output range of a scale. */
export type AlphaRange = readonly [number, number];

/** Prototype DEFAULTS.edge.typedA. */
export const TYPED_EDGE_ALPHA: AlphaRange = [0.14, 0.5];
/** Prototype DEFAULTS.edge.comA. */
export const COMENTION_EDGE_ALPHA: AlphaRange = [0.025, 0.07];

const LOG47 = Math.log(48);
const LOG8 = Math.log(9);

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

const lerp = (range: AlphaRange, t: number): number => range[0] + (range[1] - range[0]) * t;

/** Opacity for a typed (asserted) edge backed by `n` claims. */
export function typedEdgeAlpha(n: number, range: AlphaRange = TYPED_EDGE_ALPHA): number {
  return lerp(range, clamp01(Math.log(n + 1) / LOG47));
}

/** Opacity for a co-mention edge shared by `w` sources. */
export function comentionEdgeAlpha(w: number, range: AlphaRange = COMENTION_EDGE_ALPHA): number {
  return lerp(range, clamp01(Math.log(w + 1) / LOG8));
}
