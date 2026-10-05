// ClaimCard: the one way a claim renders anywhere. The sentence is primary;
// confidence is glyph + score + word, never colour alone; endorsed/verified
// marks render only when present; a superseded claim stays visible, struck,
// with what replaced it — or an explicit "replacement not available" line,
// never an omission or an invented sentence.

import { isSuperseded, type Replacement } from "../claims";
import { confidenceMark, type ConfidenceTier } from "../confidence";
import { isSourceUnavailable, type Claim, type ClaimSource } from "../types";
import { el } from "./dom";
import { resolveSourceBadge, sourceHost, type SourceBadgeOptions } from "./source-badge";
import { SOURCE_UNAVAILABLE } from "./SourceRow";
import { EXTERNAL_LINK_REL, safeExternalUrl } from "./url";

export interface ClaimCardOptions {
  /**
   * What replaced a superseded claim — pass the `resolveReplacement()` result.
   * Omitted or `null` on a superseded claim renders the replacement-unavailable
   * state. Must be omitted for a current claim.
   */
  replacement?: Replacement | null;
  /** Consumer domain badges (see SourceBadgeOptions). */
  sourceBadges?: SourceBadgeOptions;
}

/** Shown in place of a replacement sentence the payload does not carry. */
export const REPLACEMENT_UNAVAILABLE = "replacement not available";

const TIER_CLASS: Record<ConfidenceTier, string> = {
  high: "claim__conf--high",
  medium: "claim__conf--med",
  low: "claim__conf--low",
};

function confidenceSpan(claim: Claim): HTMLElement {
  const score = claim.confidence;
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new RangeError(
      `claim ${String(claim.claim_id)}: confidence must be 0..1 (got ${String(score)}).`,
    );
  }
  const mark = confidenceMark(claim.confidence_tier);
  return el(
    "span",
    `claim__conf ${TIER_CLASS[mark.tier]}`,
    `${mark.glyph} ${score.toFixed(2)} ${mark.word}`,
  );
}

function sourceElement(source: ClaimSource, options: ClaimCardOptions): HTMLElement {
  if (isSourceUnavailable(source)) return el("span", "claim__src", SOURCE_UNAVAILABLE);
  const label = resolveSourceBadge(source, options.sourceBadges)?.label ?? sourceHost(source);
  const saved = `saved ${source.save_date}`;
  const text = label === null ? saved : `${label} · ${saved}`;
  const url = safeExternalUrl(source.url);
  if (url === null) return el("span", "claim__src", text);
  const link = el("a", "claim__src", `${text} ↗`);
  link.setAttribute("href", url.href);
  link.setAttribute("rel", EXTERNAL_LINK_REL);
  return link;
}

function replacementText(claim: Claim, replacement: Replacement | null): string {
  if (replacement === null || replacement.kind === "unavailable") return REPLACEMENT_UNAVAILABLE;
  if (replacement.claim.claim_id !== claim.superseded_by_claim_id) {
    throw new RangeError(
      `claim ${String(claim.claim_id)}: replacement is claim ${String(replacement.claim.claim_id)}, but superseded_by_claim_id is ${String(claim.superseded_by_claim_id)}.`,
    );
  }
  return replacement.claim.claim_text;
}

/** `<article class="claim">` for one claim. */
export function renderClaimCard(claim: Claim, options: ClaimCardOptions = {}): HTMLElement {
  const superseded = isSuperseded(claim);
  const replacement = options.replacement ?? null;
  if (!superseded && replacement !== null) {
    throw new RangeError(
      `claim ${String(claim.claim_id)} is current; a replacement applies only to a superseded claim.`,
    );
  }

  const card = el("article", superseded ? "claim claim--superseded" : "claim");
  card.append(el("p", "claim__text", claim.claim_text));

  const meta = el("div", "claim__meta");
  if (superseded) {
    const now = el("p", "claim__now");
    now.append(
      el("b", undefined, "now"),
      document.createTextNode(replacementText(claim, replacement)),
    );
    card.append(now);
    meta.append(el("span", "badge badge--highlight", "superseded"));
  }
  meta.append(confidenceSpan(claim));
  meta.append(
    el(
      "span",
      undefined,
      claim.valid_to === undefined
        ? `valid from ${claim.valid_from}`
        : `valid ${claim.valid_from} → ${claim.valid_to}`,
    ),
  );
  if (claim.endorsement_tier !== undefined)
    meta.append(el("span", "claim__mark--endorsed", "✓ endorsed"));
  if (claim.verification !== undefined)
    meta.append(el("span", "claim__mark--verified", "⁂ verified"));
  meta.append(sourceElement(claim.source, options));
  card.append(meta);
  return card;
}
