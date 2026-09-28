// Superseded-claim semantics. "The graph used to believe X; it now believes Y"
// is the trust feature, so a retired claim is never hidden and its replacement
// is either shown or explicitly marked unavailable — never omitted or invented.
import type { Claim } from "./types";

/** What replaced a superseded claim, as far as the current payload knows. */
export type Replacement =
  | { kind: "available"; claim: Claim }
  | { kind: "unavailable"; claim_id: number | null };

/** A claim is superseded exactly when `valid_to` is set. */
export function isSuperseded(claim: Claim): boolean {
  return claim.valid_to !== undefined;
}

/**
 * The replacement for `claim`, looked up in `pool` (the other claims of the
 * same payload). Returns `null` for a current claim. A superseded claim whose
 * replacement id is missing or not in `pool` yields `{ kind: "unavailable" }`.
 */
export function resolveReplacement(claim: Claim, pool: readonly Claim[]): Replacement | null {
  if (!isSuperseded(claim)) return null;
  const id = claim.superseded_by_claim_id;
  if (id === undefined) return { kind: "unavailable", claim_id: null };
  const replacement = pool.find((candidate) => candidate.claim_id === id);
  return replacement === undefined
    ? { kind: "unavailable", claim_id: id }
    : { kind: "available", claim: replacement };
}
