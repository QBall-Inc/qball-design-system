// Confidence is never colour alone: every tier renders as a glyph AND a word.
// The DS maps the backend's tier word; the numeric thresholds that produce the
// tier are the site's call, so a `confidence` number is displayed, never
// re-bucketed here.

export type ConfidenceTier = "high" | "medium" | "low";

export interface ConfidenceMark {
  tier: ConfidenceTier;
  glyph: "◆" | "◈" | "◇";
  word: ConfidenceTier;
}

const MARKS: Record<ConfidenceTier, ConfidenceMark> = {
  high: { tier: "high", glyph: "◆", word: "high" },
  medium: { tier: "medium", glyph: "◈", word: "medium" },
  low: { tier: "low", glyph: "◇", word: "low" },
};

const ALIASES: Record<string, ConfidenceTier> = {
  high: "high",
  medium: "medium",
  med: "medium",
  low: "low",
};

/**
 * Glyph + word for a `confidence_tier` value (case-insensitive; `med` is
 * accepted for medium). Throws on an unknown tier so bad data fails at the
 * boundary instead of rendering an unlabeled mark.
 */
export function confidenceMark(confidenceTier: string): ConfidenceMark {
  const tier = ALIASES[confidenceTier.trim().toLowerCase()];
  if (tier === undefined) {
    throw new RangeError(
      `Unknown confidence_tier "${confidenceTier}" — expected one of: high, medium, low.`,
    );
  }
  return MARKS[tier];
}
