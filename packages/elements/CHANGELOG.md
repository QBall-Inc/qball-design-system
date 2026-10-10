# @qball-inc/elements

## 0.2.0

### Minor Changes

- 2042d32: ClaimCard: one fixed two-row meta layout at every width. Row 1 is confidence | `view source ↗`, row 2 is validity | source date; the source block is one link spanning both rows, with a tap area of at least 44px.
  - Status labels (`superseded`, `✓ endorsed`, `⁂ verified`) move into a new `.claim__tags` strip above the sentence.
  - Validity reads `validity: current`, or `validity: {from} - {to}` for a superseded claim (new `.claim__valid`).
  - The source name and `saved` leave the visible text: the name is now the link's accessible name (`View source: {name}, {date}`) and its `title`. New `.claim__src-label` / `.claim__src-date`; an unavailable source is `.claim__src--unavailable`.
  - The `.claim__meta` styles in tokens `components.css` are now a grid.

  This release also ships the `./chat` entry: `mount(host, options)` renders the ask launcher and the modal ask overlay (see docs/chat-launcher.md).

## 0.1.0

### Minor Changes

- First release: framework-free TypeScript + DOM components for the QBall Design System, on 0.x.
  - `@qball-inc/elements/trust`: `renderClaimCard`, `renderSourceRow` / `renderReadingList`, `renderProvenanceFooter`, `renderVerdictStamp` and `renderFeedback`. Pure render functions (data in, one element out) that paint the `@qball-inc/tokens` CSS. Text is never parsed as HTML, and only absolute http(s) source URLs become links.
  - `@qball-inc/elements`: the input model types, `validateSkeletonBundle`, confidence and superseded semantics, the locked-string formatters and the AnswerTurn model. No DOM, so it is safe to import in a static build.
  - `./chat` and `./graph` are placeholders until later releases.
