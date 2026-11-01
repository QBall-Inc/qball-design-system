// The one formatter for every owner-locked QuBrain/QuBae line (plan AD-11).
// Lines are built from numbers, dates and enums, and render verbatim except
// that nouns follow their count (`1 claim`, `2 claims`). The two exceptions
// are a grounded answer's outdated-claims and evidence-strength segments: the
// consumer words those through EvidenceLabels (the DS ships no wording for
// them), still from the count and the tier only. Every renderer (verdict
// stamp, provenance footer, sources line, canvas status) reuses these
// functions so no second phrasing can drift.
import { confidenceMark, type ConfidenceTier } from "./confidence";

/** Separator between the segments of a locked line (renderers may split on it). */
export const LOCKED_SEPARATOR = " · ";

/** Why a question was refused: out of scope, or in scope with no evidence saved. */
export type RefusalKind = "out_of_scope" | "no_evidence";

/**
 * The consumer's wording for the two worded segments of a grounded answer's
 * stamp and footer. There is no default: a grounded answer with evidence
 * cannot render without them. Each returns the whole segment.
 */
export interface EvidenceLabels {
  /** The superseded-claims segment from its count, e.g. `(k) => \`${k} outdated claims\``. */
  outdated: (count: number) => string;
  /** The evidence-strength segment from the tier, e.g. `(tier) => \`Evidence: ${tier}\``. */
  evidence: (tier: ConfidenceTier) => string;
}

/** A consumer label marking an answer the agent says its notes do not cover. */
export interface AbstainedMark {
  label: string;
}

const PLURALS = {
  claim: "claims",
  figure: "figures",
  episode: "episodes",
  source: "sources",
  entity: "entities",
} as const;

type Noun = keyof typeof PLURALS;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function count(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${field} must be a non-negative integer (got ${String(value)}).`);
  }
  return value;
}

function isoDate(value: string, field: string): string {
  if (!ISO_DATE.test(value)) {
    throw new RangeError(`${field} must be an ISO date YYYY-MM-DD (got "${value}").`);
  }
  return value;
}

/** The noun agreeing with `n`: `noun(1, "claim")` → `claim`. */
function noun(n: number, singular: Noun): string {
  return n === 1 ? singular : PLURALS[singular];
}

function counted(value: number, singular: Noun, field: string): string {
  const n = count(value, field);
  return `${n} ${noun(n, singular)}`;
}

function line(...segments: string[]): string {
  return segments.join(LOCKED_SEPARATOR);
}

function requireLabels(labels: EvidenceLabels | undefined, where: string): EvidenceLabels {
  if (
    labels === undefined ||
    labels === null ||
    typeof labels.outdated !== "function" ||
    typeof labels.evidence !== "function"
  ) {
    throw new RangeError(
      `${where} needs EvidenceLabels { outdated, evidence } (functions). The design system ships no wording for these segments; pass your own (answer.labels in the chat).`,
    );
  }
  return labels;
}

function labelText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RangeError(`${name} must return a non-empty string.`);
  }
  return value;
}

function evidenceSegment(tier: string, labels: EvidenceLabels): string {
  return labelText(labels.evidence(confidenceMark(tier).tier), "EvidenceLabels.evidence");
}

function abstainedText(mark: AbstainedMark): string {
  const value: unknown = mark;
  if (typeof value !== "object" || value === null) {
    throw new RangeError("abstained must be an object with a label.");
  }
  return labelText(mark.label, "abstained.label");
}

/**
 * Grounded verdict explanation: `N claims · M sources · <evidence label>`.
 * With `abstained` set, its label takes the evidence segment's place (the
 * agent says its notes do not cover the question). A grounded answer with no
 * evidence (0 claims, 0 sources) has no tier; its line is `0 claims · 0 sources`
 * (the chat draws no stamp for it). A tier may be left out only in that case.
 */
export function groundedExplanation(
  input: {
    claims: number;
    sources: number;
    confidenceTier?: string | undefined;
    abstained?: AbstainedMark | undefined;
  },
  labels?: EvidenceLabels,
): string {
  const claims = counted(input.claims, "claim", "claims");
  const sources = counted(input.sources, "source", "sources");
  if (input.confidenceTier === undefined) {
    if (input.claims !== 0 || input.sources !== 0) {
      throw new RangeError(
        "confidenceTier is required unless the answer has no evidence (0 claims, 0 sources).",
      );
    }
    return line(claims, sources);
  }
  if (input.abstained !== undefined) {
    // The label replaces the evidence segment; the tier is still checked so bad data fails here.
    confidenceMark(input.confidenceTier);
    return line(claims, sources, abstainedText(input.abstained));
  }
  return line(
    claims,
    sources,
    evidenceSegment(input.confidenceTier, requireLabels(labels, "groundedExplanation")),
  );
}

/**
 * Withheld verdict explanation: `N figures untraceable · M claims shown`.
 * Counts the answer's figures that no saved evidence supports, and the
 * traceable claims shown in their place.
 */
export function withheldExplanation(input: {
  untraceableFigures: number;
  claimsShown: number;
}): string {
  return line(
    `${counted(input.untraceableFigures, "figure", "untraceableFigures")} untraceable`,
    `${counted(input.claimsShown, "claim", "claimsShown")} shown`,
  );
}

/** Refused verdict explanation, chosen by the refusal kind. */
export function refusedExplanation(kind: RefusalKind): string {
  switch (kind) {
    case "out_of_scope":
      return "out of scope";
    case "no_evidence":
      return line("unable to answer", "0 references found");
    default: {
      const unknown: unknown = kind;
      throw new RangeError(
        `Unknown refusal kind "${String(unknown)}" — expected out_of_scope or no_evidence.`,
      );
    }
  }
}

export interface AnswerFooterInput {
  claims: number;
  sources: number;
  confidenceTier: string;
  /** ISO date (YYYY-MM-DD) of the revision answered on; absent or null when unknown (the segment is left out). */
  revisionDate?: string | null | undefined;
  /** Superseded claims among the evidence retrieved (worded by EvidenceLabels.outdated). */
  supersededExcluded: number;
}

/**
 * Answer-variant provenance footer:
 * `N claims · M sources · <date> · <outdated label> · <evidence label>`.
 * Without a revision date the date segment is left out.
 */
export function answerFooter(input: AnswerFooterInput, labels: EvidenceLabels): string {
  const worded = requireLabels(labels, "answerFooter");
  const segments = [
    counted(input.claims, "claim", "claims"),
    counted(input.sources, "source", "sources"),
  ];
  if (input.revisionDate !== undefined && input.revisionDate !== null) {
    segments.push(isoDate(input.revisionDate, "revisionDate"));
  }
  segments.push(
    labelText(
      worded.outdated(count(input.supersededExcluded, "supersededExcluded")),
      "EvidenceLabels.outdated",
    ),
    evidenceSegment(input.confidenceTier, worded),
  );
  return line(...segments);
}

export interface PanelFooterInput {
  claims: number;
  sources: number;
  revisionDate: string;
  supersededShown: number;
}

/**
 * Panel-variant provenance footer (no confidence slot; panels never hide
 * superseded claims): `N claims · M sources · revision <date> · K superseded shown`.
 */
export function panelFooter(input: PanelFooterInput): string {
  return line(
    counted(input.claims, "claim", "claims"),
    counted(input.sources, "source", "sources"),
    `revision ${isoDate(input.revisionDate, "revisionDate")}`,
    `${count(input.supersededShown, "supersededShown")} superseded shown`,
  );
}

/**
 * Collapsed sources label: `[N sources · newest <mon yyyy>]`. Needs at least
 * one source — with none there is no newest date, so the line is omitted.
 */
export function sourcesLine(input: { sources: number; newestDate: string }): string {
  const sources = count(input.sources, "sources");
  if (sources === 0) {
    throw new RangeError(
      "sourcesLine needs at least one source; omit the line when there are none.",
    );
  }
  const [year, monthNumber] = isoDate(input.newestDate, "newestDate").split("-");
  const month = MONTHS[Number(monthNumber) - 1];
  if (month === undefined) {
    throw new RangeError(`newestDate has no valid month (got "${input.newestDate}").`);
  }
  return `[${line(counted(sources, "source", "sources"), `newest ${month} ${String(year)}`)}]`;
}

/**
 * Canvas status line. Wide: `N entities · N typed · N co-mention ·
 * snapshot <date>`; narrow: `N entities · snapshot <date>`.
 */
export function canvasStatus(
  input: { entities: number; typed: number; comention: number; snapshotDate: string },
  width: "wide" | "narrow" = "wide",
): string {
  const entities = counted(input.entities, "entity", "entities");
  const snapshot = `snapshot ${isoDate(input.snapshotDate, "snapshotDate")}`;
  if (width === "narrow") return line(entities, snapshot);
  return line(
    entities,
    `${count(input.typed, "typed")} typed`,
    `${count(input.comention, "comention")} co-mention`,
    snapshot,
  );
}
