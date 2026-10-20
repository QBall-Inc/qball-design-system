# @qball-inc/elements

## 0.5.0

### Minor Changes

- b38e096: `@qball-inc/elements/graph` adds `GraphExplorer`: the canvas, the facet chips and the entity panel assembled into one dark-stage frame. See docs/graph-explorer.md.
  - **One mount.** `GraphExplorer.mount(host, { bundle, taxonomy, detail, … })` resolves to a handle with `select(idOrName, { openPanel })`, `clearSelection`, `setData(bundle, { taxonomy, domainLabels })`, `openPanel` / `closePanel`, `path`, `panelOpen` and `canvas`.
  - **The click path lives here.** A select pushes, a crumb truncates and re-selects, a connection row selects through the same canvas path, and Esc (anywhere in the frame) or an empty-canvas click clears.
  - **Overlays start minimized.** Above 900px the panel opens on select. At 900px and below it is a bottom sheet behind a `details ▴ <name>` pill (`autoOpen` overrides both). A deep link with `openPanel: true` opens it at every width. Open filters push the pill and the sheet below the chip strip.
  - **Events, not side effects.** `pathchange` (for URL sync), `panel` (for launcher yield) and `error` (the canvas failed after mount). The explorer never fetches, never writes history and never touches `document.body`.
  - **No WebGL.** The mount still resolves: the canvas error figure shows, and the chips and panel keep working. Retry mounts the canvas again.
  - Answer turns: the sources line and the site-links line now carry `aria-controls` naming the list they open.
  - `EntityPanel` gains `headAction`, one consumer control in the header's top row. `FacetFilterBar.setData` takes new `domainLabels`.

  tokens: adds `--signal-strong` (and `--stage-signal-strong`), a sage that meets AA on a `--signal-bg` fill. Pressed facet chips use it, so their label passes in dark themes and on the stage. Adds the `.epanel__top` / `.epanel__action` header row. `.gx__pshow` and the ≤900px `.gx__panel` follow `--gx-top`, which the explorer sets below an expanded filters strip.

- 3445af9: `@qball-inc/elements/graph` adds `FacetFilterBar` and `EntityPanel`. Both are renderers: you pass data in and they report what the visitor does; neither fetches. See docs/entity-panel.md.
  - **FacetFilterBar.** Facet chips grouped by domain, built from your `taxonomy` (an option, not a bundle field), with `domainLabels`. Active chips OR together. A match count and a `× clear` button appear while chips are active. `onChange` hands you the predicate for `GraphCanvas.setFilter`. When the facet data has no pairs, a chip with unassignable entities carries a mark and the count reads `N match · K unassignable`.
  - **EntityPanel.** Breadcrumbs, the entity header, the hop (claim cards, or the co-mention note), connection rows with "show more", a deduplicated reading list, and the pinned panel footer. Hop detail comes from your `detail` callback. A stale response is discarded, and its `signal` is aborted.
  - Every string can be replaced through `labels`. `buildFacetModel` and its types are now public.

  tokens: adds the `.fchip__inc` mark. `.facetbar__count`, `.facetbar__dom` and `.nrow__kind--com` move to `--text-secondary`, so they meet AA contrast on a bare page in both themes.

## 0.4.0

### Minor Changes

- 4c2a7dc: Chat links can open in a new tab: `mountTranscript({ openLinksInNewTab: true })` (off by default) opens every link the chat draws — explorer link, site links, reading-list sources, notice `action.href` — with `target="_blank"` and `rel="noopener noreferrer"`. The same field works on `answer`, `renderAnswer`, `renderNotice`, `renderSourceRow` and `renderReadingList`. Optional `newTabLabel` is your own wording, read out (visually hidden) after each such link; the DS ships none. tokens: `.qnewtab` visually hidden text rule.
- 515d01f: Site links now look like the sources: a collapsed toggle line (`button.qsrcline.ground-wave.ground-wave--sources.qsitelinks__line`, the consumer's `siteLinks.heading` verbatim, `aria-expanded`) opening reading-list rows (`div.srclist.qsrclist.qsitelinks` of `.srcrow.qsitelinks__link`: title and ↗, no badge or date; an inert link is a `div.is-inert` row with no ↗). Replaces the `.qsitelinks__heading` / `ul.qsitelinks__list` markup. The `siteLinks` input is unchanged. tokens (minor — removes classes): the old `.qsitelinks`, `.qsitelinks__heading` and `.qsitelinks__list` rules are removed (use with elements 0.4.0+); adds `.qsitelinks__line` and the inert-row title colour.
- 5873fb9: GraphCanvas: the QuBrain 3D knowledge-graph canvas in `./graph` (`GraphCanvas.mount(host, { data })`). Data-only, three.js loaded lazily as an optional peer (`>=0.186.0 <0.187.0`), seeded or precomputed layout, select / expand / filter / setData / destroy, typed `select`/`clear`/`filter`/`retry`/`error` events, overridable `labels`, scoped Esc with `suppressKeys`, typed `GraphCanvasError` failures, render pausing while hidden, and the `GRAPH_CANVAS_MARKER` build marker. See docs/graph-canvas.md.
- 98cfb60: `@qball-inc/elements/graph` exports `computeLayout(bundle)` and `LAYOUT_VERSION`: run the canvas's own seeded layout once on a server (Node-safe), ship it in the bundle's `layout`, and the canvas renders at once with no live settle. `LAYOUT_VERSION` changes only when the same bundle would lay out differently; key stored layouts by revision plus this value.
- 91dc714: GraphCanvas: a bundle without a precomputed layout now settles in a Web Worker, so the page keeps drawing smoothly while the layout settles (the worker ships inside `./graph` and starts from a `blob:` URL; no extra file). Pages with a Content-Security-Policy need `worker-src 'self' blob:`; without it, or with no `Worker`, the canvas settles on the main thread as before. The settled layout is unchanged. See docs/graph-canvas.md, "Live settle in a worker".

## 0.3.3

### Patch Changes

- d12eba8: Chat answer turns: two neutral slots for the consumer's own content. `AnswerTurn.setStatus(label | null)` shows short status text beside the thinking cursor, announced politely and only when it changes. `GroundedTurn.siteLinks` (`{ heading, items }`) shows a titled list of links into the consumer's pages under a grounded answer, through the internal-link policy, with a development warning for any link left inert. Neither ships default wording.

## 0.3.2

### Patch Changes

- 46f1ae5: Chat: the open overlay follows the visible viewport, so the on-screen keyboard no longer pushes the panel header off-screen on phones. Closing after a Q-key open returns focus to the element that had it before, and the element that receives focus on close shows no focus ring until the next Tab.

## 0.3.1

### Patch Changes

- aca0d5e: chat: `BotTurnOptions.initialFeedback` (`1 | -1 | null`) restores a visitor's earlier vote on a replayed answer turn. The mark renders pressed without firing `onFeedback`, and later clicks toggle from it. An invalid value throws a `RangeError` when the turn is added; passing it without `onFeedback` throws a `TypeError`.

## 0.3.0

### Minor Changes

- a4c8535: `./chat`: answer turns. `mountTranscript(container, options)` renders a conversation into the overlay's `handle.body` or any page element. Each bot turn is an `AnswerTurn` whose streamed draft never reaches the page until it is finalized. It renders every verdict (grounded with sources line, reading list, footer and optional explorer link; withheld with traceable-claim rows; refused with the site's closing line), error turns and limit notices (`renderNotice`, with an optional link or button action). Also adds `renderAnswer` / `renderErrorAnswer`, and `ChatHandle.setComposerDisabled(disabled, placeholder?)` / `isComposerDisabled()` for usage limits. `safeInternalUrl` (`./trust`) is the internal-link policy for explorer links and notice actions: root-relative paths or allow-listed origins only.

  Input model: a grounded answer with no evidence may leave out `explanation.confidenceTier` and `provenance`. Its stamp reads `0 claims · 0 episodes`, with no sources line or footer. `snapshotDate` is now optional: when missing or null, the footer leaves out the `snapshot <date>` segment instead of throwing.

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
