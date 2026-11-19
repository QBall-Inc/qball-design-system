// Synthetic claim/source builders for the trust-atom tests (no real data).
import type { EvidenceLabels } from "../locked-strings";
import type { Claim, ClaimReplacement, SourceRef, UnavailableSource } from "../types";

export const HOSTILE_MARKUP = '<img src=x onerror="globalThis.__trustPwned=1">';

export function sourceRef(overrides: Partial<SourceRef> = {}): SourceRef {
  return {
    episode_id: "ep-001",
    title: "Notes on running agents against a shared repository",
    url: "https://example.org/notes",
    source_type: "github",
    save_date: "2025-06-20",
    ...overrides,
  };
}

export function unavailableSource(episode_id: string | null = "ep-gone"): UnavailableSource {
  return { kind: "unavailable", episode_id };
}

export function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    claim_id: 1,
    claim_text: "The tool requires a local server and does not run in the browser build.",
    confidence: 0.95,
    confidence_tier: "high",
    valid_from: "2025-06-20",
    source: sourceRef(),
    ...overrides,
  };
}

/** A superseded claim (id 1) and the claim (id 2) that replaced it. */
export function supersededPair(): { old: Claim; replacement: Claim } {
  return {
    old: claim({
      claim_id: 1,
      claim_text: "The tool is in beta and limited to read access.",
      valid_from: "2025-03-11",
      valid_to: "2025-06-20",
      superseded_by_claim_id: 2,
      confidence: 0.9,
    }),
    replacement: claim({
      claim_id: 2,
      claim_text: "The tool is generally available and adds write access.",
      valid_from: "2025-06-20",
    }),
  };
}

/**
 * A superseded claim carrying its latest replacement inline, in the shapes the
 * backend contract names: one hop, a longer chain (the latest is NOT the first
 * replacement), an incomplete chain, and no replacement at all.
 */
export function inlineSuperseded(shape: "one-hop" | "multi-hop" | "incomplete" | "missing"): Claim {
  const old = supersededPair().old;
  const latest: Record<typeof shape, ClaimReplacement | null> = {
    "one-hop": {
      claim_id: 2,
      claim_text: "The tool is generally available and adds write access.",
      valid_from: "2025-06-20",
      chain_complete: true,
    },
    "multi-hop": {
      claim_id: 7,
      claim_text: "The tool is retired; its features moved into the main product.",
      valid_from: "2026-02-14",
      chain_complete: true,
    },
    incomplete: {
      claim_id: 5,
      claim_text: "The tool adds an offline mode.",
      valid_from: "2025-11-02",
      chain_complete: false,
    },
    missing: null,
  };
  return { ...old, current_replacement: latest[shape] };
}

/** Lets any queued event handlers run before asserting nothing executed. */
export function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Whether HOSTILE_MARKUP's handler ever ran. */
export function pwned(): boolean {
  return Reflect.get(globalThis, "__trustPwned") !== undefined;
}

export function resetPwned(): void {
  Reflect.deleteProperty(globalThis, "__trustPwned");
}

/** Consumer wording the tests pass for the two worded answer segments (the DS ships none). */
export const TEST_LABELS: EvidenceLabels = {
  outdated: (count) => `${String(count)} outdated ${count === 1 ? "claim" : "claims"}`,
  evidence: (tier) => `Evidence: ${tier}`,
};
