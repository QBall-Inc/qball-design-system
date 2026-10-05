// @qball-inc/elements/trust — claim card, source row, provenance footer,
// verdict stamp and answer feedback (Release A, WP-QB-1.1 / 1.2).
// Must never reference three.js (checked by src/entry-contents.test.ts).

/** Identifies which public entry a module was loaded from. */
export const ENTRY = "trust" as const;

export type { ClaimCardOptions } from "./ClaimCard";
export { REPLACEMENT_UNAVAILABLE, renderClaimCard } from "./ClaimCard";

export type { SourceRowOptions } from "./SourceRow";
export { SOURCE_UNAVAILABLE, renderReadingList, renderSourceRow } from "./SourceRow";

export { renderProvenanceFooter } from "./ProvenanceFooter";

export type { SourceBadge, SourceBadgeOptions } from "./source-badge";

export type { VerdictInput, VerdictStampOptions } from "./VerdictStamp";
export { markStampSeen, renderVerdictStamp, verdictExplanation } from "./VerdictStamp";

export type { FeedbackChange, FeedbackOptions, FeedbackValue } from "./Feedback";
export { renderFeedback } from "./Feedback";
