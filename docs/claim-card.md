---
title: ClaimCard, SourceRow, ProvenanceFooter — trust atoms
package: "@qball-inc/elements/trust"
tokens_source: "@qball-inc/tokens (components.css: .claim*, .srclist, .srcrow*, .provfoot)"
preview: preview/claim-card.html
---

# ClaimCard, SourceRow, ProvenanceFooter

The QuBrain trust atoms. **ClaimCard** is the single way a claim renders anywhere —
entity-panel hops, QuBae answers, evidence lists. **SourceRow** is the reading-list
unit. **ProvenanceFooter** is the always-present provenance line under every answer and
every panel view.

Each atom is a pure render function: data in, one `HTMLElement` out. There is no
mount handle, no update/destroy lifecycle and no event wiring. The atoms paint the
`@qball-inc/tokens` CSS, so load `components.css` on the page. They build DOM only
through `createElement` / `textContent` / `setAttribute`; no data value ever reaches
`innerHTML`. They touch `document` only when called, so importing
`@qball-inc/elements/trust` is safe in a DOM-less SSG build.

```ts
import {
  renderClaimCard,
  renderSourceRow,
  renderReadingList,
  renderProvenanceFooter,
} from "@qball-inc/elements/trust";
import { resolveReplacement } from "@qball-inc/elements";
```

## ClaimCard

```ts
renderClaimCard(claim: Claim, options?: ClaimCardOptions): HTMLElement

interface ClaimCardOptions {
  replacement?: Replacement | null; // the resolveReplacement() result
  sourceBadges?: SourceBadgeOptions;
}
```

Anatomy (`<article class="claim">`), top to bottom:

| Part                     | Content                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `.claim__tags`           | Status strip, only when at least one applies, in this order:                            |
| `.badge--highlight`      | Superseded only: `superseded`.                                                          |
| `.claim__mark--endorsed` | `✓ endorsed` — only when `endorsement_tier` is set.                                     |
| `.claim__mark--verified` | `⁂ verified` — only when `verification` is set.                                         |
| `.claim__text`           | `claim_text` in full. Never truncated: designed for 40–200 characters.                  |
| `.claim__now`            | Superseded only: `now` + the replacement's sentence, or `replacement not available`.    |
| `.claim__meta`           | Fixed two-row grid (below).                                                             |
| `.claim__conf--{tier}`   | Row 1, left. Glyph + score (2 decimals) + tier word: `◆ 0.95 high`, `◈ 0.82 medium`.    |
| `.claim__valid`          | Row 2, left. `validity: current`; superseded: `validity: {valid_from} - {valid_to}`.    |
| `.claim__src`            | Right, spanning both rows: `.claim__src-label` (row 1) over `.claim__src-date` (row 2). |

**The meta is one fixed layout at every width.** Row 1 is confidence | source, row 2
is validity | source date. Status labels never share these rows: with every label
present they need more width than a phone has beside the source link, so they sit
in the strip above the sentence instead. Cells wrap only inside themselves: a long
superseded range breaks before `- {valid_to}` and nowhere else.

**The source block** (see also Source labels and URL policy):

- **Linked** (`<a>`, http(s) URL): `view source ↗` over the bare `{save_date}`.
  `view source` and the date end on the same edge; the `↗` (`.claim__src-out`,
  `aria-hidden`) sits in its own column past it. The
  whole block is one link with a tap area at least 44px tall. The source name
  (badge label, else host) is not shown; it is the accessible name
  `View source: {name}, {save_date}` and the `title` tooltip `{name}`.
- **Inert** (`<span>`, any other URL): `{name}` over `{save_date}`, no `↗`, no href.
- **Unavailable** (`span.claim__src--unavailable`): `source unavailable`, no date.
  On ≤720px it wraps to two lines.

Rules:

- **Confidence is never colour alone.** The glyph, score and word always render
  together. The renderer maps the backend's `confidence_tier` (`high` / `medium` /
  `med` / `low`) and displays the score. It never re-buckets the score: the thresholds
  are the site's call. An unknown tier, or a score outside 0..1, throws a `RangeError`.
- **Superseded is retired, never hidden.** A claim is superseded when `valid_to` is
  set. The struck sentence stays on top, and the replacement sits beneath it. Pass
  `resolveReplacement(claim, pool)`: an available replacement renders its sentence;
  `{ kind: "unavailable" }`, `null` or no option renders the explicit
  `replacement not available` line. The atom does no lookups and never invents a
  sentence. Passing a replacement for a current claim, or one whose id differs from
  `superseded_by_claim_id`, throws.
- **Unavailable source.** A `{ kind: "unavailable" }` source renders as plain
  `source unavailable` text: never dropped, never an empty link.

## SourceRow and the reading list

```ts
renderSourceRow(source: ClaimSource, options?: SourceRowOptions): HTMLElement
renderReadingList(sources: readonly ClaimSource[], options?: SourceRowOptions): HTMLElement

interface SourceRowOptions {
  sourceBadges?: SourceBadgeOptions;
}
```

A row (`.srcrow`) shows the badge mark, the title, `saved {save_date}` and `↗`. The full
title stays in the DOM (and in a `title` attribute); CSS ellipsizes it. Unknown
sources render no badge, and an empty cell keeps the title in its column. An
unavailable source renders an inert `source unavailable` row.

`renderReadingList` returns a `.srclist` with one row per `episode_id`. The first
occurrence wins and input order is kept. Unavailable sources without an episode id
are never merged.

## Source labels and badges

A source's **badge** (mark and label) is resolved in this order:

1. **Consumer domains**: `options.sourceBadges.domains`, keyed by bare hostname. A key
   matches its host and every subdomain at a label boundary. `example.com` matches
   `docs.example.com`, never `notexample.com`. The longest matching key wins.
2. **Built-in platforms**, keyed by `source_type`: `github` GH GitHub · `youtube` YT
   YouTube · `substack` SB Substack · `medium` MD Medium · `linkedin` LI LinkedIn ·
   `reddit` RD Reddit · `arxiv` AX arXiv · `x` X X · `huggingface` HF Hugging Face.
3. **None.** No badge is shown; there is never a generic placeholder.

The DS ships only platforms. Company badges (for example, which labs' blogs get a
mark) belong to the consumer, supplied by domain, because company posts arrive as
ordinary `web` sources.

```ts
interface SourceBadge {
  mark: string; // 1–4 characters
  label: string;
}
interface SourceBadgeOptions {
  domains?: Readonly<Record<string, SourceBadge>>;
}
```

The domain table is validated on every call, including entries that don't match the
current source. A `RangeError` is thrown for:

- a key that is not a bare hostname (scheme, path, port, or a single label);
- a mark outside 1–4 characters (rejected, never truncated);
- an empty label.

Keys are case-insensitive, and a leading `www.` is ignored. Marks and labels render
as text.

**ClaimCard's source name** is the badge label (`GitHub`). Without a badge it falls
back to the host (`example.org`). On a link the name is the accessible name and
tooltip; on an inert source it is the visible label (`source` when there is no
usable host). The full title appears only in the reading list.

## URL policy

A source becomes a link only when `url` is an absolute `http:` or `https:` URL.
The `<a>` then carries that `href` and `rel="noopener noreferrer"`. It is a native
focusable link (no `tabindex` override, no click handler).

Every other value renders the same text as an inert `<span>` / `<div>` with no
`href`. This covers `javascript:`, `data:`, `vbscript:`, protocol-relative `//…`,
relative and malformed values. The `↗` is dropped so the row never advertises a
link it doesn't have.

The atoms own this policy. The input model passes URLs through unchanged.

## ProvenanceFooter

```ts
renderProvenanceFooter("answer", data: AnswerFooterInput): HTMLElement
renderProvenanceFooter("panel", data: PanelFooterInput): HTMLElement
```

The two owner-locked formats, rendered verbatim (`<footer class="provfoot">`, first
segment in `<b>`):

- answer — `N claims · M episodes · <tier> confidence · snapshot <date> · K superseded excluded`
- panel — `N claims · M sources · revision <date> · K superseded shown`

The text comes only from `answerFooter` / `panelFooter` in the core entry; this atom
adds markup, never words. Nouns follow the count (`1 claim · 1 source · revision
2026-07-17 · 0 superseded shown`); the format is otherwise locked. The answer variant
says "excluded" because QuBae filters superseded claims out. The panel variant has no
confidence slot and says "shown" because QuBrain never hides them. Invalid counts or
dates throw instead of rendering a malformed line. The footer is never hidden or
collapsed.

## States on the preview

`preview/claim-card.html` renders the built package in light and dark:

- high with both marks, endorsed only, verified only (consumer company label);
- medium with no marks (host label);
- low with a 200-character sentence;
- superseded with replacement, and with replacement not available;
- source unavailable;
- a reading list with platform, company and unbadged rows, a de-duplicated entry and
  an unavailable source;
- both footer variants and singular counts.
