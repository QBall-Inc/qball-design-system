// VerdictStamp: the squared stamp above every answer — glyph + word, never
// colour alone. Clicking it (or Enter/Space, it is a native button) toggles
// the answer's locked explanation line inline to its left; `›` also closes.
// The label shimmers until the stamp is first opened, then stays still. An
// explanation too wide for its row becomes a seamless ticker; under
// prefers-reduced-motion the CSS stops every animation and wraps the text.

import type { GroundedTurn, RefusedTurn, Verdict, WithheldTurn } from "../answer-turn";
import { groundedExplanation, refusedExplanation, withheldExplanation } from "../locked-strings";
import { el } from "./dom";

/**
 * The verdict slice of an answer turn. A FinalTurn can be passed as is; the
 * explanation is built from these numbers and enums only, never free text.
 */
export type VerdictInput =
  | Pick<GroundedTurn, "verdict" | "explanation">
  | Pick<WithheldTurn, "verdict" | "explanation">
  | Pick<RefusedTurn, "verdict" | "reason">;

export interface VerdictStampOptions {
  /**
   * Called each time the explanation opens, with the stamp's row. Only the
   * opened stamp stops shimmering; to stop every stamp in a conversation at
   * once, call markStampSeen on each row from here.
   */
  onOpen?: (row: HTMLElement) => void;
}

const LABELS: Record<Verdict, string> = {
  grounded: "● grounded",
  withheld: "◐ withheld",
  refused: "∅ refused",
};

/** Ticker speed and floor from the design record: ~28px/s, never under 6s a loop. */
const TICKER_PX_PER_SECOND = 28;
const TICKER_MIN_SECONDS = 6;

/** The owner-locked explanation line for a verdict. */
export function verdictExplanation(verdict: VerdictInput): string {
  switch (verdict.verdict) {
    case "grounded":
      return groundedExplanation(verdict.explanation);
    case "withheld":
      return withheldExplanation(verdict.explanation);
    case "refused":
      return refusedExplanation(verdict.reason);
    default: {
      const unknown: unknown = (verdict as { verdict: unknown }).verdict;
      throw new RangeError(
        `Unknown verdict "${String(unknown)}" — expected grounded, withheld or refused.`,
      );
    }
  }
}

/** Stops the label shimmer on the stamp in `row` (a `.vrow` from renderVerdictStamp). */
export function markStampSeen(row: HTMLElement): void {
  row.querySelector(".vstamp")?.classList.add("is-seen");
}

/**
 * Turns an overflowing explanation into a ticker: the text is doubled (the
 * copy hidden from assistive tech) and scrolled at a constant speed. Measured
 * when the row opens, because a closed explanation has no width.
 */
function tickIfOverflowing(row: HTMLElement): void {
  const box = row.querySelector<HTMLElement>(".vrow__txt");
  const track = box?.querySelector<HTMLElement>(".vtick");
  if (box == null || track == null || box.classList.contains("is-ticking")) return;
  if (track.offsetWidth <= box.clientWidth + 1) return;
  const copy = track.firstElementChild?.cloneNode(true);
  if (!(copy instanceof HTMLElement)) return;
  copy.setAttribute("aria-hidden", "true");
  track.append(copy);
  box.classList.add("is-ticking");
  const seconds = Math.max(TICKER_MIN_SECONDS, track.offsetWidth / 2 / TICKER_PX_PER_SECOND);
  box.style.setProperty("--tdur", `${seconds.toFixed(1)}s`);
}

/** `<div class="vrow">`: the explanation slot and the stamp button. */
export function renderVerdictStamp(
  verdict: VerdictInput,
  options: VerdictStampOptions = {},
): HTMLElement {
  const text = verdictExplanation(verdict);
  const label = LABELS[verdict.verdict];
  const word = verdict.verdict;

  const row = el("div", "vrow");
  const explanation = el("span", "vrow__exp");
  const close = el("button", "vrow__close", "›");
  close.setAttribute("type", "button");
  close.setAttribute("aria-label", "close explanation");
  const box = el("span", "vrow__txt");
  const track = el("span", "vtick");
  track.append(el("span", undefined, text));
  box.append(track);
  explanation.append(close, box);

  const stamp = el("button", `vstamp vstamp--${word}`);
  stamp.setAttribute("type", "button");
  stamp.setAttribute("aria-expanded", "false");
  stamp.setAttribute("aria-label", `${word} verdict — explanation`);
  stamp.append(el("span", "vstamp__wave", label));
  row.append(explanation, stamp);

  const setOpen = (open: boolean): void => {
    row.classList.toggle("open", open);
    stamp.setAttribute("aria-expanded", String(open));
  };
  stamp.addEventListener("click", () => {
    const open = !row.classList.contains("open");
    setOpen(open);
    if (!open) return;
    markStampSeen(row);
    tickIfOverflowing(row);
    options.onOpen?.(row);
  });
  close.addEventListener("click", () => {
    setOpen(false);
    // The close button hides with the explanation; keep keyboard focus on the row.
    stamp.focus();
  });
  return row;
}
