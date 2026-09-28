// @qball-inc/elements — core entry ('.'): the data contract, its validator and
// adapter, confidence and superseded semantics, the locked-string formatter and
// the AnswerTurn model. Zero DOM: this entry must stay importable in a DOM-less
// SSG build (plan AD-6).

/** Identifies which public entry a module was loaded from. */
export const ENTRY = "core" as const;

export type {
  BundleFacets,
  BundleLayout,
  BundleNode,
  BundleStats,
  Claim,
  ClaimSource,
  ComentionEdge,
  ConnectionDetail,
  SkeletonBundle,
  SourceRef,
  TypedEdge,
  UnavailableSource,
} from "./types";
export { isSourceUnavailable } from "./types";

export { BundleValidationError, validateSkeletonBundle } from "./validator";

export type { ProvisionalClaim, ProvisionalConnection, ProvisionalProvenance } from "./adapter";
export { DetailAdapterError, adaptConnection } from "./adapter";

export type { Replacement } from "./claims";
export { isSuperseded, resolveReplacement } from "./claims";

export type { ConfidenceMark, ConfidenceTier } from "./confidence";
export { confidenceMark } from "./confidence";

export type { RefusalKind } from "./locked-strings";
export {
  LOCKED_SEPARATOR,
  answerFooter,
  canvasStatus,
  groundedExplanation,
  panelFooter,
  refusedExplanation,
  sourcesLine,
  withheldExplanation,
} from "./locked-strings";

export type {
  AnswerProvenance,
  AnswerSegment,
  AnswerTurnOptions,
  FinalTurn,
  GroundedTurn,
  RefusedTurn,
  TurnError,
  TurnView,
  Verdict,
  WithheldTurn,
} from "./answer-turn";
export { AnswerTurn } from "./answer-turn";
