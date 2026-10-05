---
title: VerdictStamp and answer feedback — trust atoms
package: "@qball-inc/elements/trust"
tokens_source: "@qball-inc/tokens (components.css: .vrow*, .vstamp*, .vtick, .vbox--*, .qfb*)"
preview: preview/verdict-stamp.html
---

# VerdictStamp and answer feedback

Every QuBae answer carries a **verdict stamp** above its box and **feedback
marks** inside it. Both are pure render functions from
`@qball-inc/elements/trust`: data in, one `HTMLElement` out, built only through
`textContent` / `setAttribute`. They paint the `@qball-inc/tokens`
`components.css` classes.

This is a new, separate component. The React `GroundingFlag`
(`[source]` / `[unverified]`) is unchanged and shares no code with it.

```ts
import {
  renderVerdictStamp,
  markStampSeen,
  verdictExplanation,
  renderFeedback,
} from "@qball-inc/elements/trust";
```

## VerdictStamp

```ts
renderVerdictStamp(verdict: VerdictInput, options?: VerdictStampOptions): HTMLElement

type VerdictInput =
  | { verdict: "grounded"; explanation: { claims; episodes; confidenceTier } }
  | { verdict: "withheld"; explanation: { untraceableFigures; claimsShown } }
  | { verdict: "refused"; reason: "off_topic" | "in_scope_empty" | "abstained" };

interface VerdictStampOptions {
  onOpen?: (row: HTMLElement) => void;
}
```

`VerdictInput` is the verdict slice of an answer turn, so a `FinalTurn` from the
`AnswerTurn` model can be passed as is. It returns a `.vrow`: the explanation
slot (`.vrow__exp` with the `›` close button and the text) and the stamp button.

| verdict  | stamp        | tone                                    |
| -------- | ------------ | --------------------------------------- |
| grounded | `● grounded` | sage                                    |
| withheld | `◐ withheld` | amber                                   |
| refused  | `∅ refused`  | stone, dashed: a boundary, not an error |

The stamp shows a glyph and a word, never colour alone.

### Locked explanation lines

The explanation is built only from the counts and enums above, through the same
formatters the rest of the package uses (`verdictExplanation` exposes the
result). The atom never accepts free text. Nouns follow their counts.

- grounded — `N claims · M episodes · <tier> confidence`
- withheld — `N figures untraceable · M claims shown`
- refused, off topic — `out of scope`
- refused, in scope but nothing in the graph — `unable to answer · 0 references found`
- refused, evidence too weak — `insufficient evidence`

The line carries counts only. The reason itself lives in the answer text.

### Behaviour

- **Toggle.** The stamp is a native `<button>` with `aria-expanded`. Clicking
  it, or pressing Enter or Space, opens or closes the explanation inline.
  `›` also closes, and returns focus to the stamp. There are no hover tooltips.
- **Shimmer.** The label shimmers until the stamp is first opened. After that
  it stays still for good (`.is-seen`), even when closed again.
  - **Default: per stamp.** Opening one stamp doesn't affect the others.
  - **Conversation-wide.** To stop every stamp in a conversation once any one
    is opened, call `markStampSeen(row)` for each row from `onOpen`.
  - `onOpen` fires on every open, not on close.
- **Ticker.** When the open explanation is wider than its row, it becomes a
  seamless ticker. The text is doubled, with the copy hidden from assistive
  tech, and edge fades are added. It scrolls at about 28px/s, with no loop
  shorter than 6s, and pauses on hover.
- **Reduced motion.** Under `prefers-reduced-motion: reduce`, the CSS stops the
  shimmer and the ticker. The explanation wraps instead, and the duplicate is
  hidden.
- **Fail fast.** An unknown verdict, an unknown confidence tier, or a negative
  or non-integer count throws a `RangeError`.

## Feedback

```ts
renderFeedback(turnRef: string, options: FeedbackOptions): HTMLElement

interface FeedbackOptions {
  onChange: (change: { value: 1 | -1 | null; turnRef: string }) => void;
  initial?: 1 | -1 | null;
}
```

This renders `+1` / `−1` (`.qfb`) as two native toggle buttons with
`aria-pressed`. They are mutually exclusive: pressing one releases the other,
and pressing the pressed one clears it.

- Every change calls `onChange` with the new value: `1`, `-1`, or `null` for
  cleared. Recording it, or re-dispatching it as an event, is the consumer's
  job.
- `initial` shows feedback that was already recorded, without reporting it.
- `turnRef` is the consumer's id for the turn. It is passed back untouched and
  never rendered; an empty one throws.
- The marks sit at 55% opacity and wake when the answer box is hovered or a
  mark is pressed. Pressed `+1` is sage; pressed `−1` is amber.
