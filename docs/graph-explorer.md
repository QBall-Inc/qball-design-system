---
title: Graph explorer — GraphExplorer
package: "@qball-inc/elements/graph"
tokens_source: "@qball-inc/tokens (graph.css: .gx, .gx__stage, .gx__facets, .gx__ftoggle, .gx__pshow, .gx__panel, .gx__phide; components.css: .facetbar*, .fchip*, .epanel*)"
preview: preview/graph-explorer.html
---

# Graph explorer

`GraphExplorer` is the assembled knowledge-graph organism from
`@qball-inc/elements/graph`. One mount gives you:

- the 3D canvas (`GraphCanvas`, with its legend, hint and status line);
- the facet chips (`FacetFilterBar`) behind a collapsible `filters` toggle;
- the reading panel (`EntityPanel`) behind a `details` pill, with a `hide`
  control in its header.

All of it sits in one `.gx` frame. graph.css pins the frame to the dark stage
in either page theme, and the frame's `isolation: isolate` keeps its internal
z-indices inside it.

The explorer owns the click path and the panel's open state. It never fetches,
never writes the URL and never touches `document.body`. Instead it reports what
changed through events on your host, so your page decides what to do with them.

```ts
import "@qball-inc/tokens/colors_and_type.css";
import "@qball-inc/tokens/components.css";
import "@qball-inc/tokens/graph.css";
import { GraphExplorer } from "@qball-inc/elements/graph";

const explorer = await GraphExplorer.mount(document.querySelector(".gxhost")!, {
  bundle, // a ready SkeletonBundle; your page loads it and shows its own fetch errors
  taxonomy, // { domains: { [domain]: sub_domain[] } }
  domainLabels: { "ai-engineering": "AI engineering" },
  detail: ({ from, to, signal }) => loadHop(from, to, { signal }), // → ConnectionDetail
  panelLabels: { idleTitle: "my graph" },
});

// URL sync: write your own slug when the path changes.
explorer.on("pathchange", ({ detail }) => setEntityParam(detail.node));
// Launcher yield: hide your launcher while the panel is open.
explorer.on("panel", ({ detail }) => chat.setHidden(detail.open));
// Deep link: open the panel for the entity in the URL, at every width.
if (wanted) explorer.select(wanted, { openPanel: true });
```

`three` is an optional peer of the package. Install it on pages that mount the
explorer (see [graph canvas](graph-canvas.md)). If it is missing, the build
still passes (Vite stubs the missing optional peer) and the explorer shows its
`three-unavailable` error figure. Catch that in CI by failing the build when
the output contains `Could not resolve "three"` (the exact check is in the
[consumer hand-back](consumer-handback-elements.md#install-three-on-graph-pages)).

## Mount

`GraphExplorer.mount(host, options) → Promise<handle>`. The host's previous
content is replaced by the `.gx` frame. Give the host a height. The frame fills
it (`height: 100%`, at least 480px).

| Option         | Type                                             | Notes                                                                                                                        |
| -------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `bundle`       | `SkeletonBundle`                                 | Required. Validated at mount. An invalid bundle rejects with `GraphCanvasError` `invalid-bundle`.                            |
| `taxonomy`     | `FacetTaxonomy`                                  | Required. The facet chips, in display order.                                                                                 |
| `domainLabels` | `Record<string, string>`                         | Display label per domain id.                                                                                                 |
| `detail`       | `(hop: HopRequest) => Promise<ConnectionDetail>` | Required. The hop the panel narrates (see [entity panel](entity-panel.md)).                                                  |
| `autoOpen`     | `boolean`                                        | Open the panel when an entity is selected. Default: yes above 900px, no at 900px and below.                                  |
| `canvas`       | canvas options                                   | Passed to `GraphCanvas`: `labels`, `hint`, `legend`, `draggable`, `neighborBudget`, `labelBudget`, `errorUi`. `chip` is off. |
| `labels`       | `Partial<ExplorerLabels>`                        | The frame's own strings (below).                                                                                             |
| `panelLabels`  | `Partial<PanelLabels>`                           | The panel's strings, e.g. `idleTitle`.                                                                                       |
| `facetLabels`  | `Partial<FacetBarLabels>`                        | The chips' strings.                                                                                                          |
| `sourceBadges` | `SourceBadgeOptions`                             | Domain badges for claim cards and the reading list.                                                                          |
| `suppressKeys` | `() => boolean`                                  | Return true to make Esc do nothing, e.g. while one of your overlays is open.                                                 |
| `onWarn`       | `(message) => void`                              | Development warnings.                                                                                                        |

Bad options throw (or reject) naming the key, and leave the host empty.

## Handle

| Member                                          | Notes                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select(idOrName, { openPanel? })`              | Selects as a click would: by revision-scoped id or canonical name. `false` when unknown or when the canvas is not running. `openPanel: true` opens the panel at every width. |
| `clearSelection()`                              | Clears the selection and the click path.                                                                                                                                     |
| `setData(bundle, { taxonomy?, domainLabels? })` | A revision swap. Clears the path, the chips and the panel, and re-seeds the canvas. A bad bundle or labels throw and change nothing.                                         |
| `openPanel()` / `closePanel()`                  | Programmatic open and close.                                                                                                                                                 |
| `path`                                          | The click path, oldest first.                                                                                                                                                |
| `panelOpen`                                     | Whether the panel is open.                                                                                                                                                   |
| `canvas`                                        | The running `GraphCanvasHandle`, or `null` when the canvas could not start or lost its WebGL context.                                                                        |
| `canvasError`                                   | Why the canvas is not running (`three-unavailable`, `webgl-unavailable`, `missing-styles`), or `null`.                                                                       |
| `on(type, listener)`                            | Typed listener on the host. Returns the remover.                                                                                                                             |
| `destroy()`                                     | Destroys the canvas, chips and panel and removes the frame.                                                                                                                  |

## Events

Dispatched on your host as `CustomEvent`s. They do not bubble.

| Event        | Detail                                             | When                                                                                                                                            |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pathchange` | `{ node: BundleNode \| null, path: BundleNode[] }` | The click path changed: a select, a crumb, a clear, a filter that hid the selection, a revision swap. Not fired for "show more".                |
| `panel`      | `{ open: boolean }`                                | The details panel opened or closed.                                                                                                             |
| `error`      | `{ code: GraphCanvasErrorCode, message: string }`  | After mount: the canvas lost its WebGL context, or a retry could not start it. A failure during mount is read from `canvasError`, not an event. |

The names differ from the canvas's own `select` and `clear`, which fire on the
canvas element inside the frame.

## The click path

- **Select.** A canvas click or tap pushes the entity onto the path. Selecting
  the current entity again does not push.
- **Hop.** With two entities in the path, the panel narrates the hop between
  the last two through `detail`.
- **Connection row.** A row selects that neighbour, through the same canvas
  select a click uses.
- **Crumb.** A crumb truncates the path at that entity and re-selects it.
- **Show more.** Grows the connection rows. The path does not change.
- **Clear.** Esc, an empty-canvas click, or a filter that hides the selected
  entity clears the path, and the panel returns to idle. Esc works with focus
  on the canvas, or anywhere in the frame (the panel, the chips). It yields to
  typing targets, an open modal dialog, and `suppressKeys`.

## Overlays and breakpoints

Every overlay starts minimized at every width: the filters strip, the canvas
legend on narrow or touch screens, and the details panel.

**Filters.** The toggle reads `filters ▾` when collapsed and `filters ▴` when
open. While chips are active it adds `N active` (in sage). It has
`aria-expanded` and `aria-controls`. The chips filter the canvas, and `× clear`
restores it.

**Details panel, above 900px.** A 400px right overlay (`top: 44px`,
`right: 12px`, `bottom: 42px`). It opens when an entity is selected. While it
is open, the filters strip stops at its left edge.

**Details panel, at 900px and below.** A near-full bottom sheet (`top: 44px`,
`left/right/bottom: 12px`). Selecting an entity does not open it, so the graph
stays walkable. The pill reads `details ▴` followed by the entity name (sage,
not uppercased, cut off at 44vw). `hide ▾` slides the sheet away.

**Open filters push the pill and the sheet down.** Expanded chips wrap onto
several rows. The explorer keeps the pill (at every width) and the sheet (at
900px and below) just below the strip, through the `--gx-top` custom property
it sets on the frame. With the filters collapsed both sit at the designed
44px.

**`autoOpen`** overrides the width rule both ways. A deep link
(`select(name, { openPanel: true })`) always opens the panel.

**Focus.** A hidden panel is `inert`, so Tab never lands in it. The pill
focuses the panel when it opens it. `hide` returns focus to the pill without a
focus ring, and so does any close while focus was inside the panel.

## When the canvas cannot run

There is no 2D fallback. When three.js is missing, or the browser has no WebGL,
or the token CSS is not loaded, the mount still resolves:

- `canvas` is `null` and `canvasError` names the reason (no `error` event: the
  handle did not exist yet);
- the canvas error figure shows in the stage;
- the chips and the panel still work.

The figure's retry button mounts the canvas again, from a clean path and chips.
A WebGL context lost after mount fires `error`, sets `canvas` to `null`, clears
the path and shows the same figure. A retry that cannot start the canvas fires
`error` too.

## Dark stage

The frame resolves every colour against the dark stage, whatever the page theme.
That covers the canvas tier (deep ink `#12161F`) and the panel tier (`#1E1D1B`,
with lighter text greys). Markup needs no `data-theme` attributes. On the stage,
a pressed facet chip's label uses `--signal-strong`, which meets AA on the
chip's fill.

## Labels

The canvas, chips and panel keep their own label sets (`canvas.labels`,
`facetLabels`, `panelLabels`). The frame's strings are `ExplorerLabels`
(`DEFAULT_EXPLORER_LABELS`). Every default is lowercase, because the frame's CSS
sets the case.

| Key             | Default                                             |
| --------------- | --------------------------------------------------- |
| `region`        | `graph explorer` (accessible name)                  |
| `filtersShow`   | `filters ▾`                                         |
| `filtersHide`   | `filters ▴`                                         |
| `filtersActive` | `(n) => "N active"`                                 |
| `detailsShow`   | `◂ details` (pill, above 900px)                     |
| `detailsSheet`  | `details ▴` (pill, ≤900px; the entity name follows) |
| `hide`          | `hide ▸`                                            |
| `hideSheet`     | `hide ▾`                                            |

## Status

Built and tested against the input-model fixtures:
`fixtures/qubrain/mock-bundle.json`, `taxonomy.json` and `detail/*.json`.
Integration with a certified backend contract is not yet proven.
