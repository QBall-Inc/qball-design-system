# @qball-inc/tokens

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
