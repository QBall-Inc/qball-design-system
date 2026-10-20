# @qball-inc/tokens

## 1.3.0

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

### Patch Changes

- 0d413db: `EntityPanel` connection rows (and the "show more" row) now span the full width of the list, so the divider lines line up and the whole row is the click target, not just its text.
- 3445af9: `@qball-inc/elements/graph` adds `FacetFilterBar` and `EntityPanel`. Both are renderers: you pass data in and they report what the visitor does; neither fetches. See docs/entity-panel.md.
  - **FacetFilterBar.** Facet chips grouped by domain, built from your `taxonomy` (an option, not a bundle field), with `domainLabels`. Active chips OR together. A match count and a `× clear` button appear while chips are active. `onChange` hands you the predicate for `GraphCanvas.setFilter`. When the facet data has no pairs, a chip with unassignable entities carries a mark and the count reads `N match · K unassignable`.
  - **EntityPanel.** Breadcrumbs, the entity header, the hop (claim cards, or the co-mention note), connection rows with "show more", a deduplicated reading list, and the pinned panel footer. Hop detail comes from your `detail` callback. A stale response is discarded, and its `signal` is aborted.
  - Every string can be replaced through `labels`. `buildFacetModel` and its types are now public.

  tokens: adds the `.fchip__inc` mark. `.facetbar__count`, `.facetbar__dom` and `.nrow__kind--com` move to `--text-secondary`, so they meet AA contrast on a bare page in both themes.

## 1.2.0

### Minor Changes

- 515d01f: Site links now look like the sources: a collapsed toggle line (`button.qsrcline.ground-wave.ground-wave--sources.qsitelinks__line`, the consumer's `siteLinks.heading` verbatim, `aria-expanded`) opening reading-list rows (`div.srclist.qsrclist.qsitelinks` of `.srcrow.qsitelinks__link`: title and ↗, no badge or date; an inert link is a `div.is-inert` row with no ↗). Replaces the `.qsitelinks__heading` / `ul.qsitelinks__list` markup. The `siteLinks` input is unchanged. tokens (minor — removes classes): the old `.qsitelinks`, `.qsitelinks__heading` and `.qsitelinks__list` rules are removed (use with elements 0.4.0+); adds `.qsitelinks__line` and the inert-row title colour.
- 5873fb9: graph.css: canvas label rules (`.graphcanvas .gc-label`, with `data-kind` top/selected variants and the stage-colour halo) and a new `--stage-hub` token (the parchment-white the biggest graph hubs brighten toward). Required by `@qball-inc/elements` GraphCanvas.

### Patch Changes

- 4c2a7dc: Chat links can open in a new tab: `mountTranscript({ openLinksInNewTab: true })` (off by default) opens every link the chat draws — explorer link, site links, reading-list sources, notice `action.href` — with `target="_blank"` and `rel="noopener noreferrer"`. The same field works on `answer`, `renderAnswer`, `renderNotice`, `renderSourceRow` and `renderReadingList`. Optional `newTabLabel` is your own wording, read out (visually hidden) after each such link; the DS ships none. tokens: `.qnewtab` visually hidden text rule.
- 93be9ea: graph.css: every GraphCanvas button (legend toggle, selection chip "show more" / clear, retry) now shows the library's sage keyboard-focus ring (`:focus-visible` only; pointer clicks stay clean).

## 1.1.4

### Patch Changes

- d12eba8: Chat styles for the answer-turn status text (`.qstatus`, `.qturn--thinking`) and the site-links list (`.qsitelinks*`), including the phone type scale.

## 1.1.3

### Patch Changes

- 46f1ae5: Chat styles: larger type in the panel at 720px and narrower (14px conversation; 16px composer, also on any touch screen, so iOS does not zoom on focus); the panel sizes from the overlay instead of `100vh`/`100dvh`; the post-page launcher sits bottom-left at every width; the launcher caption sits on a small page-colour patch so it stays legible over any page content.

## 1.1.2

### Patch Changes

- a4c8535: `components.css`: styles for chat answer turns:
  - Structured answer bodies inside `.vbox` (paragraphs, headings, lists, tables, code), reset from the page's global element styles.
  - Citation markers (`.qcite`) and gap markers (`.qgap`).
  - The withheld lead-in (`.qlead`) and the refused closing line (`.qclose`).
  - The footer spacing under an answer, and the error box (`.vbox--error`).
  - Notice actions (`.qnotice__act`).
  - The disabled composer (`.qpanel__comp.is-disabled`, opacity .45).

- a53fa23: `components.css`: the trust and chat atoms now meet WCAG AA colour contrast in both themes.
  - Their small grey text moves from `--text-muted` to `--text-secondary`.
  - Green, amber and gold text on tinted surfaces uses a deeper component-scoped mix of the brand colour.
  - Unpressed feedback marks are no longer faded; a pressed mark is underlined.

  No token values change.

## 1.1.1

### Patch Changes

- 2042d32: ClaimCard: one fixed two-row meta layout at every width. Row 1 is confidence | `view source ↗`, row 2 is validity | source date; the source block is one link spanning both rows, with a tap area of at least 44px.
  - Status labels (`superseded`, `✓ endorsed`, `⁂ verified`) move into a new `.claim__tags` strip above the sentence.
  - Validity reads `validity: current`, or `validity: {from} - {to}` for a superseded claim (new `.claim__valid`).
  - The source name and `saved` leave the visible text: the name is now the link's accessible name (`View source: {name}, {date}`) and its `title`. New `.claim__src-label` / `.claim__src-date`; an unavailable source is `.claim__src--unavailable`.
  - The `.claim__meta` styles in tokens `components.css` are now a grid.

  This release also ships the `./chat` entry: `mount(host, options)` renders the ask launcher and the modal ask overlay (see docs/chat-launcher.md).

- daf0bd9: graph.css: the mascot inside `.qlaunch--on-stage` now takes the launcher's stage ink (and its hover tint). Previously `.qbmark` kept the page text colour, so in the light theme the mascot drew dark on the dark graph stage.

## 1.1.0

### Minor Changes

- 5418e49: Add the QuBrain knowledge-graph and QuBae chat styles (additive only; no existing token, value or class changes).
  - `components.css`: ClaimCard, SourceRow, ProvenanceFooter, FacetFilterBar and EntityPanel classes; the QuBae chat surface (launcher with responsive sizing and a compact corner variant, overlay with mobile geometry, conversation turns, verdict stamps with ticker and shimmer, answer boxes, feedback marks, sources line, withheld-claim rows, notice, answer link, thinking cursor). Every new animation honors `prefers-reduced-motion`.
  - New opt-in `@qball-inc/tokens/graph.css`: graph canvas chrome, the explorer frame, glass panel and filter strip, the mobile bottom sheet and the details pill. It pins a dark stage, so the explorer renders the same in light and dark pages. Import order: `colors-and-type.css` → `components.css` → `graph.css`.
  - New theme-independent tokens: `--stage-*` (graph dark stage, canvas and panel tiers), `--color-scrim-light` and `--text-scale` (default `1`; multiplies the new component text sizes so a site can scale them with its own type steps).

## 1.0.1

### Patch Changes

- 92ec07c: Add per-package npm READMEs (landing pages) with the QBall logo header, install +
  wiring instructions, and the full component inventory. Refresh repo docs to reflect
  both packages published at 1.0.0 (no more "early-access 0.x" / "not yet published"
  status). No API, token, or runtime changes.

## 1.0.0

### Major Changes

- Initial stable **1.0.0** release of the QBall Design System.
  - **@qball-inc/tokens** — design tokens shipped as CSS custom properties, DTCG JSON, and component CSS (zero build step, Berkeley-free).
  - **@qball-inc/react** — React component library: primitives, overlays, data display, app chrome, AI/domain surfaces, a comprehensive icon system, and the SSR-safe MediaSlot display primitive. Token-CSS className wrappers over the shipped tokens; dual ESM/CJS + type declarations.
