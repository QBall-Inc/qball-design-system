// Seeded randomness for the graph layout (prototype audit G-CON-4): the same
// bundle `revision` always yields the same layout, and a new revision re-seeds.
//
// Algorithm choice (neither the plan nor the audit names one): FNV-1a 32-bit
// over the revision's UTF-16 code units for the seed, mulberry32 for the
// stream. Both are tiny, fast, integer-only (bit-identical on every JS engine)
// and statistically ample for scattering initial node positions.

/** A source of uniform floats in [0, 1), like `Math.random`. */
export type Rng = () => number;

/** Derives a 32-bit unsigned seed from a bundle revision string (FNV-1a). */
export function seedFromRevision(revision: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < revision.length; i++) {
    hash ^= revision.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a deterministic stream of floats in [0, 1) from a 32-bit seed. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The layout's random stream for a given revision. */
export function rngForRevision(revision: string): Rng {
  return mulberry32(seedFromRevision(revision));
}
