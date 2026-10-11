// AnswerBox: the content of one finished bot turn, per verdict — the verdict
// stamp row, the verdict-tinted box (structured body + feedback marks), then
// grounded: the sources line + reading list, the provenance footer and an
// optional explorer link; withheld: the traceable claims; refused: the
// consumer's closing line. Composes the shipped trust atoms; every data string
// lands through textContent / setAttribute, never innerHTML (plan AD-4).

import type {
  AnswerBlock,
  AnswerBody,
  AnswerInline,
  FinalTurn,
  GroundedTurn,
  RefusedTurn,
  WithheldTurn,
} from "../answer-turn";
import { confidenceMark } from "../confidence";
import { sourcesLine } from "../locked-strings";
import { isSourceUnavailable, type Claim, type ClaimSource } from "../types";
import { el } from "../trust/dom";
import { renderFeedback, type FeedbackChange, type FeedbackValue } from "../trust/Feedback";
import { renderProvenanceFooter } from "../trust/ProvenanceFooter";
import { SOURCE_UNAVAILABLE, renderReadingList } from "../trust/SourceRow";
import type { SourceBadgeOptions } from "../trust/source-badge";
import { safeInternalUrl } from "../trust/url";
import { renderVerdictStamp } from "../trust/VerdictStamp";

export interface AnswerFeedbackOptions {
  /** The consumer's id for this turn, passed back with every change. */
  turnRef: string;
  onChange: (change: FeedbackChange) => void;
  /** Already-recorded feedback to show pressed. */
  initial?: FeedbackValue;
}

export interface AnswerOptions {
  /** Shows the +1 / −1 marks in the box; leave out to show none. */
  feedback?: AnswerFeedbackOptions;
  /** Called when a verdict stamp opens (see VerdictStampOptions.onOpen). */
  onStampOpen?: (row: HTMLElement) => void;
  /** Consumer domain badges for the reading list. */
  sourceBadges?: SourceBadgeOptions;
  /** Origins an absolute explorer link may point at (root-relative is always allowed). */
  allowedOrigins?: readonly string[];
  /** Explorer link text (default `open in the explorer →`). */
  explorerLinkLabel?: string;
  /** Line before a withheld answer's traceable claims (default `here's the part i can stand behind:`). */
  withheldLead?: string;
}

export const ANSWER_DEFAULTS = {
  explorerLinkLabel: "open in the explorer →",
  withheldLead: "here’s the part i can stand behind:",
} as const;

/** Claim-tier class suffixes as shipped in the tokens CSS (`.qclaim__conf--med`). */
const TIER_CLASS = { high: "high", medium: "med", low: "low" } as const;

/** Sources a citation can resolve against, numbered in reading-list order. */
interface CitationIndex {
  numberOf(episodeId: string): { n: number; source: ClaimSource } | null;
}

/** One entry per episode id (first wins), in input order — the reading list's order. */
function readingOrder(sources: readonly ClaimSource[]): ClaimSource[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const id = source.episode_id;
    if (id === null) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function citationIndex(sources: readonly ClaimSource[]): CitationIndex {
  const ordered = readingOrder(sources);
  return {
    numberOf(episodeId) {
      const at = ordered.findIndex((source) => source.episode_id === episodeId);
      const source = ordered[at];
      return source === undefined ? null : { n: at + 1, source };
    },
  };
}

function renderCitation(episodeId: string, index: CitationIndex): HTMLElement {
  const hit = index.numberOf(episodeId);
  if (hit === null || isSourceUnavailable(hit.source)) {
    const label = hit === null ? `[${SOURCE_UNAVAILABLE}]` : `[${String(hit.n)}]`;
    const node = el("span", "qcite is-unavailable", label);
    node.setAttribute("title", SOURCE_UNAVAILABLE);
    return node;
  }
  const node = el("span", "qcite", `[${String(hit.n)}]`);
  node.setAttribute("title", hit.source.title);
  return node;
}

function renderInline(inline: AnswerInline, index: CitationIndex): Node {
  switch (inline.kind) {
    case "text":
      return document.createTextNode(inline.text);
    case "emphasis":
      return el(inline.strength === "strong" ? "strong" : "em", undefined, inline.text);
    case "code":
      return el("code", undefined, inline.text);
    case "figure":
      return el("span", "qn", inline.text);
    case "citation":
      return renderCitation(inline.episode_id, index);
    case "marker":
      return el("span", "qgap", inline.text);
    default: {
      const unknown: unknown = (inline as { kind: unknown }).kind;
      throw new RangeError(`Unknown answer inline kind "${String(unknown)}".`);
    }
  }
}

function withInlines<T extends HTMLElement>(
  node: T,
  inlines: readonly AnswerInline[],
  index: CitationIndex,
): T {
  for (const inline of inlines) node.append(renderInline(inline, index));
  return node;
}

function renderBlock(block: AnswerBlock, index: CitationIndex): HTMLElement {
  switch (block.kind) {
    case "paragraph":
      return withInlines(el("p"), block.inlines, index);
    case "heading":
      return withInlines(el(`h${String(block.level)}` as "h1" | "h2" | "h3"), block.inlines, index);
    case "list": {
      const list = el(block.ordered ? "ol" : "ul");
      for (const item of block.items) {
        const li = withInlines(el("li"), item.inlines, index);
        if (item.sublist !== undefined) {
          const sub = el(item.sublist.ordered ? "ol" : "ul");
          for (const inlines of item.sublist.items)
            sub.append(withInlines(el("li"), inlines, index));
          li.append(sub);
        }
        list.append(li);
      }
      return list;
    }
    case "table": {
      const table = el("table");
      const head = el("tr");
      for (const cell of block.header) head.append(withInlines(el("th"), cell, index));
      const thead = el("thead");
      thead.append(head);
      const tbody = el("tbody");
      for (const row of block.rows) {
        const tr = el("tr");
        for (const cell of row) tr.append(withInlines(el("td"), cell, index));
        tbody.append(tr);
      }
      table.append(thead, tbody);
      return table;
    }
    case "code":
      return el("pre", undefined, block.text);
    default: {
      const unknown: unknown = (block as { kind: unknown }).kind;
      throw new RangeError(`Unknown answer block kind "${String(unknown)}".`);
    }
  }
}

/** The verdict-tinted box: the body, then the feedback marks when enabled. */
function renderBox(
  verdict: FinalTurn["verdict"],
  body: AnswerBody,
  index: CitationIndex,
  options: AnswerOptions,
): HTMLElement {
  const box = el("div", `vbox vbox--${verdict}`);
  for (const block of body) box.append(renderBlock(block, index));
  const feedback = options.feedback;
  if (feedback !== undefined) {
    box.append(
      renderFeedback(feedback.turnRef, {
        onChange: feedback.onChange,
        ...(feedback.initial === undefined ? {} : { initial: feedback.initial }),
      }),
    );
  }
  return box;
}

/** ISO date of the newest available source, or null when none has one. */
function newestDate(sources: readonly ClaimSource[]): string | null {
  let newest: string | null = null;
  for (const source of sources) {
    if (isSourceUnavailable(source)) continue;
    if (newest === null || source.save_date > newest) newest = source.save_date;
  }
  return newest;
}

/**
 * The sources line toggling the reading list. With no sources both are left
 * out; when every source is unavailable there is no date for the line, so the
 * list shows on its own.
 */
function renderSources(sources: readonly ClaimSource[], options: AnswerOptions): HTMLElement[] {
  if (sources.length === 0) return [];
  const list = renderReadingList(
    sources,
    options.sourceBadges === undefined ? {} : { sourceBadges: options.sourceBadges },
  );
  list.classList.add("qsrclist");
  const newest = newestDate(sources);
  if (newest === null) {
    list.classList.add("open");
    return [list];
  }
  const toggle = el(
    "button",
    "qsrcline ground-wave ground-wave--sources",
    sourcesLine({ sources: list.childElementCount, newestDate: newest }),
  );
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    const open = list.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  return [toggle, list];
}

function renderExplorerLink(raw: string, options: AnswerOptions): HTMLElement {
  const label = options.explorerLinkLabel ?? ANSWER_DEFAULTS.explorerLinkLabel;
  const href = safeInternalUrl(raw, options.allowedOrigins ?? []);
  // A link that fails the internal-link policy stays visible as inert text.
  if (href === null) return el("span", "qlink", label);
  const link = el("a", "qlink", label);
  link.setAttribute("href", href);
  return link;
}

function isNoEvidence(turn: GroundedTurn): boolean {
  return turn.explanation.claims === 0 && turn.explanation.episodes === 0;
}

function groundedParts(turn: GroundedTurn, options: AnswerOptions): HTMLElement[] {
  if (turn.provenance === undefined && !isNoEvidence(turn)) {
    throw new RangeError(
      "A grounded answer needs provenance unless it has no evidence (0 claims, 0 episodes).",
    );
  }
  const parts = [
    renderBox("grounded", turn.body, citationIndex(turn.sources), options),
    ...renderSources(turn.sources, options),
  ];
  if (turn.provenance !== undefined) parts.push(renderProvenanceFooter("answer", turn.provenance));
  if (turn.explorerLink !== undefined) parts.push(renderExplorerLink(turn.explorerLink, options));
  return parts;
}

function renderClaimRow(claim: Claim): HTMLElement {
  const mark = confidenceMark(claim.confidence_tier);
  const row = el("div", "qclaim");
  row.append(
    el("span", `qclaim__conf qclaim__conf--${TIER_CLASS[mark.tier]}`, mark.glyph),
    el("span", undefined, claim.claim_text),
    el("span", "qclaim__lvl", mark.word),
  );
  return row;
}

function withheldParts(turn: WithheldTurn, options: AnswerOptions): HTMLElement[] {
  const index = citationIndex(turn.traceableClaims.map((claim) => claim.source));
  const parts = [renderBox("withheld", turn.body, index, options)];
  if (turn.traceableClaims.length > 0) {
    const claims = el("div", "qclaims");
    for (const claim of turn.traceableClaims) claims.append(renderClaimRow(claim));
    parts.push(el("div", "qlead", options.withheldLead ?? ANSWER_DEFAULTS.withheldLead), claims);
  }
  return parts;
}

function refusedParts(turn: RefusedTurn, options: AnswerOptions): HTMLElement[] {
  const parts = [renderBox("refused", turn.body, citationIndex([]), options)];
  if (turn.closingLine !== undefined && turn.closingLine.length > 0) {
    parts.push(el("div", "qclose", turn.closingLine));
  }
  return parts;
}

/** The nodes of one finished turn, in order: stamp row, box, then per-verdict extras. */
export function renderAnswer(turn: FinalTurn, options: AnswerOptions = {}): HTMLElement[] {
  const stamp = renderVerdictStamp(
    turn,
    options.onStampOpen === undefined ? {} : { onOpen: options.onStampOpen },
  );
  switch (turn.verdict) {
    case "grounded":
      return [stamp, ...groundedParts(turn, options)];
    case "withheld":
      return [stamp, ...withheldParts(turn, options)];
    case "refused":
      return [stamp, ...refusedParts(turn, options)];
    default: {
      const unknown: unknown = (turn as { verdict: unknown }).verdict;
      throw new RangeError(`Unknown verdict "${String(unknown)}".`);
    }
  }
}

/** A failed turn: a plain box with a short user-facing line — no stamp, no feedback. */
export function renderErrorAnswer(text: string): HTMLElement {
  const box = el("div", "vbox vbox--error", text);
  box.setAttribute("role", "alert");
  return box;
}
