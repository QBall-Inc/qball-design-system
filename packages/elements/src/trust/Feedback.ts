// Answer feedback: `+1` / `−1` marks inside the answer box. Mutually
// exclusive toggles — pressing one releases the other, pressing the pressed
// one releases it. Every change is reported through `onChange`; recording it
// is the consumer's job.

import { el } from "./dom";

/** +1, −1, or no feedback. */
export type FeedbackValue = 1 | -1 | null;

export interface FeedbackChange {
  value: FeedbackValue;
  /** The consumer's id for the answer turn, passed through untouched. */
  turnRef: string;
}

export interface FeedbackOptions {
  onChange: (change: FeedbackChange) => void;
  /** Already-recorded feedback to show pressed (default none). */
  initial?: FeedbackValue;
}

/** `<span class="qfb">` with the two toggles for one answer turn. */
export function renderFeedback(turnRef: string, options: FeedbackOptions): HTMLElement {
  if (turnRef.trim().length === 0) {
    throw new RangeError("renderFeedback needs a non-empty turnRef.");
  }
  const initial = options.initial ?? null;
  if (initial !== null && initial !== 1 && initial !== -1) {
    throw new RangeError(`initial must be 1, -1 or null (got ${String(initial)}).`);
  }

  const root = el("span", "qfb");
  const up = el("button", "qfb__up", "+1");
  up.setAttribute("aria-label", "+1 helpful");
  const down = el("button", "qfb__down", "−1");
  down.setAttribute("aria-label", "−1 not helpful");

  let value: FeedbackValue = initial;
  const sync = (): void => {
    up.setAttribute("aria-pressed", String(value === 1));
    down.setAttribute("aria-pressed", String(value === -1));
  };
  const press = (pressed: 1 | -1): void => {
    value = value === pressed ? null : pressed;
    sync();
    options.onChange({ value, turnRef });
  };

  for (const button of [up, down]) button.setAttribute("type", "button");
  up.addEventListener("click", () => {
    press(1);
  });
  down.addEventListener("click", () => {
    press(-1);
  });
  sync();
  root.append(up, down);
  return root;
}
