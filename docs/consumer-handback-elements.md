# Consumer hand-back packet — `@qball-inc/elements` @ 0.5.0

Everything a site needs to adopt the framework-free trust, chat and graph components. Companion docs are
linked inline; this page is the index. For `@qball-inc/react`, see
[consumer-handback.md](./consumer-handback.md).

---

## 1. Install

```sh
npm install @qball-inc/elements @qball-inc/tokens
```

`@qball-inc/elements` has no runtime dependencies. It does not depend on
`@qball-inc/tokens`: install both and import the tokens CSS yourself (section 2).
`three` is an optional peer, needed only on pages that mount the graph (section 7).

The package is on **0.x**: the API can still adjust between minor versions until the data
contract is final and `1.0.0` is cut.

## 2. CSS — the locked import order

Import the token stylesheets once per page, in exactly this order:

1. `@qball-inc/tokens/colors-and-type.css` — tokens, light/dark values, base type
2. `@qball-inc/tokens/components.css` — every component class, the trust atoms included
3. `@qball-inc/tokens/graph.css` — graph and explorer chrome (pins a dark stage); pages that
   show the graph only

Later files build on earlier ones, so the order is part of the contract. Set
`data-theme="light"` or `data-theme="dark"` on `<html>`. Without it, the page follows the
visitor's system setting.

## 3. What 0.5.0 ships

| Entry                       | Contents                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `@qball-inc/elements`       | The input model types, `validateSkeletonBundle`, confidence and superseded helpers, locked-string formatters, AnswerTurn    |
| `@qball-inc/elements/trust` | `renderClaimCard`, `renderSourceRow`, `renderReadingList`, `renderProvenanceFooter`, `renderVerdictStamp`, `renderFeedback` |
| `@qball-inc/elements/chat`  | `mount` (ask launcher + overlay), `mountTranscript`, `renderAnswer`, `renderNotice` — see section 6                         |
| `@qball-inc/elements/graph` | `GraphExplorer`, `GraphCanvas`, `FacetFilterBar`, `EntityPanel`, `computeLayout` — see section 7 (needs `three`)            |

The trust and answer components are plain functions: data in, one `HTMLElement` out;
the launcher and the graph are `mount()` calls (sections 6 and 7). Nothing touches
`window` or `document` until you call one, so every entry is safe to import during a
static (SSG) build.

Full component references:

- [claim-card.md](./claim-card.md) — ClaimCard, SourceRow / reading list, ProvenanceFooter,
  source badges, URL policy
- [verdict-stamp.md](./verdict-stamp.md) — VerdictStamp (locked explanation lines, ticker,
  shimmer) and the +1 / −1 feedback toggle
- [qubrain-data-contract.md](./qubrain-data-contract.md) — the input model your backend data
  is mapped into, its invariants, and the validator
- [chat-launcher.md](./chat-launcher.md) — the ask launcher, overlay, hotkey and events
- [qubae-answers.md](./qubae-answers.md) — the transcript, answer turns, notices and the
  disabled composer

## 4. Worked example — Astro

The components need no framework island. A plain `<script>` in an Astro page is bundled
as a module and runs in the browser:

```astro
---
// src/pages/answer.astro
import "@qball-inc/tokens/colors-and-type.css";
import "@qball-inc/tokens/components.css";
---

<html lang="en" data-theme="light">
  <body>
    <section id="answer"></section>
    <script>
      import {
        renderVerdictStamp,
        renderClaimCard,
        renderReadingList,
        renderProvenanceFooter,
      } from "@qball-inc/elements/trust";

      const source = {
        episode_id: "ep-1",
        title: "Running a server locally",
        url: "https://example.com/local-server",
        source_type: "github",
        save_date: "2025-06-20",
      };

      document.querySelector("#answer")?.append(
        renderVerdictStamp({
          verdict: "grounded",
          explanation: { claims: 1, episodes: 1, confidenceTier: "high" },
        }),
        renderClaimCard(
          {
            claim_id: 1,
            claim_text: "The server runs on the local machine.",
            confidence: 0.95,
            confidence_tier: "high",
            valid_from: "2025-06-20",
            source,
          },
          // Company badges are yours to supply, keyed by domain.
          { sourceBadges: { domains: { "example-lab.com": { mark: "EL", label: "Example Lab" } } } },
        ),
        renderReadingList([source]),
        renderProvenanceFooter("answer", {
          claims: 1,
          episodes: 1,
          confidenceTier: "high",
          snapshotDate: "2026-07-17",
          supersededExcluded: 0,
        }),
      );
    </script>
  </body>
</html>
```

In a real site the data comes from your backend, mapped into the input model (see
[qubrain-data-contract.md](./qubrain-data-contract.md)). A `FinalTurn` can be passed to
`renderVerdictStamp` as it is.

This exact setup — packed tarballs, the CSS order above, a plain `<script>`, light and
dark pages — is exercised on every CI run by `fixtures/consumer-astro`.

## 5. URLs — two rules

- **External source links** (`SourceRef.url`, from your data): the components link a
  source only when its URL is an absolute `http:` / `https:` URL, with
  `rel="noopener noreferrer"`. Anything else (`javascript:`, `data:`, relative, malformed)
  renders as plain text with no link. You don't need to pre-filter; the components enforce
  this.
- **Site-supplied internal links** (an answer's `explorerLink`, a notice's
  `action.href`): linked only when root-relative (`/explore?e=…`) or an absolute http(s)
  URL on an origin you list in `answer.allowedOrigins`; anything else renders as inert
  text. `safeInternalUrl` applies the same rule elsewhere. Details:
  [qubae-answers.md](./qubae-answers.md#explorer-link-and-notice-actions-internal-link-policy).

All data text (claim text, titles, badge labels) is rendered as text, never as HTML.

## 6. Release B — the ask launcher and answer turns

### Mount it once from your layout

Put the launcher in the one layout every page uses, not in each page. The layout imports
`colors-and-type.css` and `components.css` only (the launcher needs no `graph.css`), and a
plain `<script>` mounts it with your persona copy:

```astro
---
// src/layouts/Base.astro
import "@qball-inc/tokens/colors-and-type.css";
import "@qball-inc/tokens/components.css";
const { variant = "corner" } = Astro.props;
---
<html lang="en" data-theme="light">
  <body>
    <slot />
    <div id="chat" data-variant={variant} hidden></div>
    <script>
      import { mount, mountTranscript } from "@qball-inc/elements/chat";

      const variant = document.getElementById("chat")?.dataset.variant;
      const chat = mount(document.body, {
        variant: variant === "post-page" ? "post-page" : "corner",
        title: "your assistant name",
        hint: "ask",
        placeholder: "ask about these notes…",
        disclaimer: "your own disclaimer line",
        onAsk: (text) => {
          transcript.addUserTurn(text);
          const turn = transcript.addBotTurn({ turnRef: crypto.randomUUID() });
          // stream your backend reply into `turn` (see below)
        },
      });
      const transcript = mountTranscript(chat.body, {
        onFeedback: (change) => chat.relayFeedback(change),
      });
    </script>
  </body>
</html>
```

`fixtures/consumer-astro` proves exactly this pattern on every CI run: one shared layout,
two pages, the packed tarballs, Q/Esc/scrim/keycap behaviour, answers inside the overlay,
no `three` in the bundle, and hostile persona and answer text staying inert.

### Which variant

- `corner` (default): the fixed bottom-right launcher, for standard pages.
- `post-page`: moves the launcher bottom-left on small screens (under 720px), for pages
  whose bottom-right corner already holds other chrome (a post's reading controls, a
  back-to-top button).

### Events

The handle dispatches typed, non-bubbling events on the host: `open`, `close`,
`ask` (`{ text }`) and `feedback` (the +1 / −1 change). Wire them to your analytics with
`chat.on("ask", (e) => …)`; recording feedback is your job.

### Mapping your backend stream into an answer turn

Each bot turn is an `AnswerTurn`: call `start()`, then `appendText(chunk)` for each streamed
chunk (buffered, never shown), then exactly one of `finalize(turn)` with the final
grounded / withheld / refused turn, or `fail(message)`. With the default settings no
draft ever reaches the page. Drafts show as they stream only with `earlyDisplay: true` plus `turn.authorize("grounded")`, and only
when your backend sends an irreversible grounded verdict before any tokens. The full
mapping, every verdict and the notices are in
[qubae-answers.md](./qubae-answers.md).

**Renderer-only; backend integration at phase_5.** This release proves the components
render the input model correctly from stored fixtures, inside a real static site. It does
not prove any particular backend stream maps into it; that integration is a later, gated
step.

## 7. Release C — the graph explorer

The graph canvas went to npm early, in elements `0.4.0` with tokens `1.2.0`. Release C
(elements `0.5.0`, tokens `1.3.0`) adds the assembled explorer: the canvas, the facet chips
and the details panel in one dark-stage frame. Pin the two together: bump
`@qball-inc/elements` to `0.5.0` and `@qball-inc/tokens` to `1.3.0` in the same change.
Full reference: [graph-explorer.md](./graph-explorer.md), with
[graph-canvas.md](./graph-canvas.md) and [entity-panel.md](./entity-panel.md) for the
parts.

### Install `three` on graph pages

`three` is an optional peer: install it yourself, inside the supported range.

```sh
npm install three@">=0.186.0 <0.187.0"
```

Pages that only use the launcher, the trust components or the answer turns never load it.
`fixtures/consumer-astro` proves on every CI run that adding an explorer route leaks no
`three` into launcher-only pages.

**If you forget it, your build still passes.** Vite replaces a missing optional peer
with a stub that throws in the browser. The explorer catches that: the mount resolves with
`canvasError: "three-unavailable"` and shows the canvas error figure, and the chips and
panel keep working. Nothing crashes, but nothing warns you at build time either. Add this
check to your CI after the build (point it at your build's output folder):

```sh
if [ ! -d dist ] || grep -rqF 'Could not resolve "three"' dist/; then
  echo "dist/ missing, or a page ships a graph that cannot load: install three"; exit 1
fi
```

It fails when the stub is in the output, and also when the folder is missing, so a renamed
output folder cannot make it pass silently. `fixtures/consumer-astro-no-three`
proves both halves on every CI run: without `three`, an explorer-only site builds, contains
the stub and shows the error figure, and a launcher-only site builds clean and runs.

### Mount the explorer

Import `graph.css` after the two launcher sheets, on graph pages only. Give the host a
height.

```astro
---
// src/pages/graph.astro
import Base from "../layouts/Base.astro"; // the layout from section 6 (launcher included)
import "@qball-inc/tokens/graph.css"; // after the layout's two sheets
---
<Base>
  <div id="explorer" style="height: 640px"></div>
  <script>
    import { GraphExplorer } from "@qball-inc/elements/graph";

    const bundle = await fetch("/data/graph.json").then((r) => r.json());
    const explorer = await GraphExplorer.mount(document.getElementById("explorer")!, {
      bundle, // a SkeletonBundle (validated at mount)
      taxonomy, // { domains: { [domain]: sub_domain[] } } for the facet chips
      domainLabels: { "ai-engineering": "AI engineering" },
      detail: ({ from, to, signal }) => loadHop(from, to, { signal }), // → ConnectionDetail
      panelLabels: { idleTitle: "your graph's name" },
    });
  </script>
</Base>
```

A bundle without a `layout` settles in a Web Worker started from a `blob:` URL. If your
site sends a Content-Security-Policy, allow `worker-src 'self' blob:`; without it the
canvas settles on the main thread instead (same result, less smooth). To skip the live
settle entirely, run `computeLayout(bundle)` on your server and ship the result in the
bundle's `layout` (see [graph-canvas.md](./graph-canvas.md)).

`fixtures/consumer-astro`'s explorer route is this pattern, tested with real clicks: a
click on a rendered node selects it, a connection row narrates the hop through `detail`,
Q opens the launcher, and Esc closes the launcher before it touches the explorer.

### The handle and its events

- `select(idOrName, { openPanel })`, `clearSelection()`, `setData(bundle, { taxonomy,
domainLabels })`, `openPanel()`, `closePanel()`, `destroy()`.
- Read-only: `path` (oldest first), `panelOpen`, `canvas` (null when it could not start),
  `canvasError`.
- Events on the host (they do not bubble), via `explorer.on(type, listener)`:
  - `pathchange` `{ node, path }`: the click path changed. Use it for URL sync.
  - `panel` `{ open }`: the details panel opened or closed. Use it for launcher yield.
  - `error` `{ code, message }`: the canvas failed after mount (for example a lost WebGL
    context). A failure during mount is not an event; read `canvasError` instead.

The explorer never fetches, never writes history and never touches `document.body`.

### Recipes

```ts
// URL sync: write your own slug when the path changes.
explorer.on("pathchange", ({ detail }) => setEntityParam(detail.node));
// Deep link: open the panel for the entity in the URL, at every width.
if (wanted) explorer.select(wanted, { openPanel: true });
// Launcher yield: hide the launcher while the panel is open.
explorer.on("panel", ({ detail }) => chat.setHidden(detail.open));
```

`setHidden` only toggles visibility; the launcher hotkey keeps working. For a fade, add
your own class to `chat.launcher` for an opacity transition, then call
`setHidden(true)` on `transitionend`. The library only sets the launcher's classes when it
creates it and never overwrites yours.

### Keys and focus

- The explorer binds **Esc** anywhere in its frame: first press clears the selection.
  Inside the canvas, after a pan, a second press recentres the view.
- Esc yields to typing targets, to any visible modal dialog (the open chat overlay
  included, so Esc closes the chat first), and to your `suppressKeys()`.
- Nothing in the graph binds Q, so the chat hotkey works on graph pages.
- Clicking the canvas focuses it (not a tab stop). Hiding the panel moves focus to the
  details pill, and closing the chat returns focus to where it was, both without a
  focus ring.

### When the canvas cannot start

`GraphCanvasErrorCode` has four codes: `three-unavailable`, `webgl-unavailable`,
`invalid-bundle` and `missing-styles` (the token CSS is not loaded). By default the
error figure shows with a retry. To show your own message, pass
`canvas: { errorUi: false }` and read `canvasError`.

### Labels

Every string can be replaced, and the defaults ship lowercase with no em-dashes. Each set
lists its keys and defaults in its reference:

- Canvas, `canvas.labels` ([graph-canvas.md](./graph-canvas.md#labels)): `loading`,
  `settling`, `hintFine`, `hintCoarse`, `legendShow`, `legendHide`, `classes`, `episodes`,
  `showing`, `showMore`, `clearSelection`, `emptyFilter`, `error`, `retry`, `canvas`.
- Facet chips, `facetLabels` ([entity-panel.md](./entity-panel.md#labels)): `group`,
  `matches`, `matchesIncomplete`, `incompleteMark`, `incompleteChip`, `clear`.
- Panel, `panelLabels` ([entity-panel.md](./entity-panel.md#labels)): `idleTitle`,
  `idleMeta`, `idleBody`, `pickHop`, `crumbs`, `classes`, `episodes`, `aka`, `hopAsserts`,
  `hopComention`, `comentionNote`, `hopLoading`, `hopError`, `retry`, `connections`,
  `rowClaims`, `rowComention`, `showMore`, `remaining`, `readingList`.
- Explorer frame, `labels` ([graph-explorer.md](./graph-explorer.md#labels)): `region`,
  `filtersShow`, `filtersHide`, `filtersActive`, `detailsShow`, `detailsSheet`, `hide`,
  `hideSheet`.

The canvas status-line counts are not locale-formatted.

### Also in this release

- tokens `1.3.0` adds `--signal-strong` (the pressed facet chip label, AA in every theme)
  and the panel's head-action row. Connection rows in the panel now span the full width.
- `EntityPanel` gains `headAction` (one control in the header's top row), and
  `FacetFilterBar.setData` takes `domainLabels`. You only need these if you assemble the
  parts yourself.
- Answer turns: the sources line and the site-links line carry `aria-controls` naming the
  list they open.
- Since `0.4.0`: `mountTranscript(el, { openLinksInNewTab: true, newTabLabel })` opens
  answer links in a new tab (see [qubae-answers.md](./qubae-answers.md)).
- Build marker: every canvas carries `data-qb-engine="qball-elements-graphcanvas"`
  (`GRAPH_CANVAS_MARKER`). Grep your build output for it to prove a page, or a flag-off
  build, ships no graph code.

**Renderer-only; backend integration comes later.** The explorer is proven against stored
fixtures (`fixtures/qubrain`) inside a real static site. However complete the demo looks,
it does not prove any backend maps into the input model; that integration is a later,
gated step.

## 8. Not yet available

Nothing site-facing is outstanding. The one remaining step is adopting the certified
backend contract, in a later integration phase.
