import { describe, expect, it } from "vitest";
import { isSuperseded, resolveReplacement } from "./claims";
import type { Claim } from "./types";

function claim(overrides: Partial<Claim> & Pick<Claim, "claim_id">): Claim {
  return {
    claim_text: `claim ${overrides.claim_id}`,
    confidence: 0.9,
    confidence_tier: "high",
    valid_from: "2026-01-01",
    source: { kind: "unavailable", episode_id: null },
    ...overrides,
  };
}

describe("isSuperseded", () => {
  it("is true exactly when valid_to is set", () => {
    expect(isSuperseded(claim({ claim_id: 1 }))).toBe(false);
    expect(isSuperseded(claim({ claim_id: 1, valid_to: "2026-02-01" }))).toBe(true);
  });
});

describe("resolveReplacement", () => {
  const current = claim({ claim_id: 2 });

  it("returns null for a current claim", () => {
    expect(resolveReplacement(current, [current])).toBeNull();
  });

  it("returns the replacement claim when it is in the pool", () => {
    const retired = claim({ claim_id: 1, valid_to: "2026-02-01", superseded_by_claim_id: 2 });
    expect(resolveReplacement(retired, [retired, current])).toEqual({
      kind: "available",
      claim: current,
    });
  });

  it("is unavailable (with the id) when the replacement is not in the pool", () => {
    const retired = claim({ claim_id: 1, valid_to: "2026-02-01", superseded_by_claim_id: 9 });
    expect(resolveReplacement(retired, [retired, current])).toEqual({
      kind: "unavailable",
      claim_id: 9,
    });
  });

  it("is unavailable (no id) when a superseded claim names no replacement", () => {
    const retired = claim({ claim_id: 1, valid_to: "2026-02-01" });
    expect(resolveReplacement(retired, [retired, current])).toEqual({
      kind: "unavailable",
      claim_id: null,
    });
  });
});
