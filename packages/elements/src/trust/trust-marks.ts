// Trust-mark switches: one object a consumer passes to show or hide each
// trust signal. Every mark shows by default, so leaving the object out (or a
// key out) keeps the full set. Validated at the boundary: an unknown key or a
// non-boolean value throws, so a typo never silently leaves a mark on.

/** Which trust marks to draw. Every key defaults to true. */
export interface TrustMarks {
  /** The verdict stamp above each answer (and its explanation line). */
  stamp?: boolean;
  /** The provenance footer under answers and under the graph panel. */
  footer?: boolean;
  /** The `endorsed` label on claim cards. */
  endorsed?: boolean;
  /** The `verified` label on claim cards. */
  verified?: boolean;
  /** The `superseded` label on claim cards (the struck sentence and its replacement stay). */
  superseded?: boolean;
  /** Confidence: the score on claim cards and the glyph + word on a withheld answer's claims. */
  confidence?: boolean;
}

export type ResolvedTrustMarks = Readonly<Required<TrustMarks>>;

const KEYS = ["stamp", "footer", "endorsed", "verified", "superseded", "confidence"] as const;

/** The default: every mark shown. */
export const ALL_TRUST_MARKS: ResolvedTrustMarks = Object.freeze({
  stamp: true,
  footer: true,
  endorsed: true,
  verified: true,
  superseded: true,
  confidence: true,
});

/** `trustMarks` with defaults filled in. Throws on a non-object, an unknown key or a non-boolean value. */
export function resolveTrustMarks(value: unknown): ResolvedTrustMarks {
  if (value === undefined) return ALL_TRUST_MARKS;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("trustMarks must be an object of booleans.");
  }
  const known = new Set<string>(KEYS);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) {
      throw new TypeError(`trustMarks has an unknown key "${key}" (expected ${KEYS.join(", ")}).`);
    }
  }
  const marks = { ...ALL_TRUST_MARKS } as Record<(typeof KEYS)[number], boolean>;
  for (const key of KEYS) {
    const flag: unknown = (value as Record<string, unknown>)[key];
    if (flag === undefined) continue;
    if (typeof flag !== "boolean") throw new TypeError(`trustMarks.${key} must be a boolean.`);
    marks[key] = flag;
  }
  return Object.freeze(marks);
}
