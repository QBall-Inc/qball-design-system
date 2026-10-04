// The one formatter for every owner-locked QuBrain/QuBae line (plan AD-11).
// Lines are built from numbers, dates and enums only — never from free text —
// and render verbatim except that nouns follow their count (`1 claim`,
// `2 claims`). Every renderer (verdict stamp, provenance footer, sources line,
// canvas status) reuses these functions so no second phrasing can drift.
import { confidenceMark } from "./confidence";

/** Separator between the segments of a locked line (renderers may split on it). */
export const LOCKED_SEPARATOR = " · ";

/**
 * Why a question was refused: off-topic; in scope but nothing in the graph; or
 * the agent judged the evidence too weak and explains why in its own words.
 */
export type RefusalKind = "off_topic" | "in_scope_empty" | "abstained";

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

/** Grounded verdict explanation: `N claims · M episodes · <tier> confidence`. */
export function groundedExplanation(input: {
  claims: number;
  episodes: number;
  confidenceTier: string;
}): string {
  return line(
    counted(input.claims, "claim", "claims"),
    counted(input.episodes, "episode", "episodes"),
    `${confidenceMark(input.confidenceTier).word} confidence`,
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
    case "off_topic":
      return "out of scope";
    case "in_scope_empty":
      return line("unable to answer", "0 references found");
    case "abstained":
      return "insufficient evidence";
  }
}

/**
 * Answer-variant provenance footer:
 * `N claims · M episodes · <tier> confidence · <snapshot date> · K superseded excluded`.
 */
export function answerFooter(input: {
  claims: number;
  episodes: number;
  confidenceTier: string;
  snapshotDate: string;
  supersededExcluded: number;
}): string {
  return line(
    counted(input.claims, "claim", "claims"),
    counted(input.episodes, "episode", "episodes"),
    `${confidenceMark(input.confidenceTier).word} confidence`,
    isoDate(input.snapshotDate, "snapshotDate"),
    `${count(input.supersededExcluded, "supersededExcluded")} superseded excluded`,
  );
}

/**
 * Panel-variant provenance footer (no confidence slot; panels never hide
 * superseded claims): `N claims · M sources · revision <date> · K superseded shown`.
 */
export function panelFooter(input: {
  claims: number;
  sources: number;
  revisionDate: string;
  supersededShown: number;
}): string {
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
