// ClaimCard: the one way a claim renders anywhere. The sentence is primary;
// confidence is glyph + score + word, never colour alone; status labels
// (superseded / endorsed / verified) sit in a strip above the sentence and
// render only when present; the meta is a fixed two-row grid at every width.
// A superseded claim stays visible, struck, with what replaced it — or an
// explicit "replacement not available" line, never an omission or an invented
// sentence.

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

// The right-hand source block spans both meta rows: label on row 1, save date
// on row 2. A linked source reads `view source ↗`; its name stays in the
// accessible name and the tooltip. An inert source shows its name instead.
function sourceElement(source: ClaimSource, options: ClaimCardOptions): HTMLElement {
  if (isSourceUnavailable(source))
    return el("span", "claim__src claim__src--unavailable", SOURCE_UNAVAILABLE);
  const name = resolveSourceBadge(source, options.sourceBadges)?.label ?? sourceHost(source);
  const url = safeExternalUrl(source.url);
  const date = el("span", "claim__src-date", source.save_date);
  if (url === null) {
    const inert = el("span", "claim__src");
    inert.append(el("span", "claim__src-label", name ?? "source"), date);
    return inert;
  }
  const link = el("a", "claim__src");
  // The ↗ sits in its own column so `view source` and the date share a right edge.
  const out = el("span", "claim__src-out", "↗");
  out.setAttribute("aria-hidden", "true");
  link.append(el("span", "claim__src-label", "view source"), out, date);
  link.setAttribute("href", url.href);
  link.setAttribute("rel", EXTERNAL_LINK_REL);
  if (name !== null) link.setAttribute("title", name);
  link.setAttribute(
    "aria-label",
    name === null
      ? `View source, ${source.save_date}`
      : `View source: ${name}, ${source.save_date}`,
  );
  return link;
}

/** `validity: current`, or `validity: <from> - <to>` with a break point before the end date. */
function validityElement(claim: Claim): HTMLElement {
  const validity = el("span", "claim__valid");
  if (claim.valid_to === undefined) {
    validity.textContent = "validity: current";
    return validity;
  }
  validity.append(
    el("span", undefined, `validity: ${claim.valid_from}`),
    document.createTextNode(" "),
    el("span", undefined, `- ${claim.valid_to}`),
  );
  return validity;
}

/** Status labels above the sentence, or null when the claim carries none. */
function tagsElement(claim: Claim, superseded: boolean): HTMLElement | null {
  const tags = el("div", "claim__tags");
  if (superseded) tags.append(el("span", "badge badge--highlight", "superseded"));
  if (claim.endorsement_tier !== undefined)
    tags.append(el("span", "claim__mark--endorsed", "✓ endorsed"));
  if (claim.verification !== undefined)
    tags.append(el("span", "claim__mark--verified", "⁂ verified"));
  return tags.childElementCount === 0 ? null : tags;
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
  const tags = tagsElement(claim, superseded);
  if (tags !== null) card.append(tags);
  card.append(el("p", "claim__text", claim.claim_text));
  if (superseded) {
    const now = el("p", "claim__now");
    now.append(
      el("b", undefined, "now"),
      document.createTextNode(replacementText(claim, replacement)),
    );
    card.append(now);
  }

  // Fixed 2x2 grid (components.css): confidence | source on row 1, validity on
  // row 2; the source block spans both rows. DOM order is the reading order.
  const meta = el("div", "claim__meta");
  meta.append(confidenceSpan(claim), validityElement(claim), sourceElement(claim.source, options));
  card.append(meta);
  return card;
}
