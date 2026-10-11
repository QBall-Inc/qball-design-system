---
title: Knowledge-graph canvas — GraphCanvas
package: "@qball-inc/elements/graph"
tokens_source: "@qball-inc/tokens (colors_and_type.css: --stage-*; graph.css: .graphcanvas, .gc-*)"
preview: preview/graph-canvas.html (lands with the browser test layer)
---

# Knowledge-graph canvas

The QuBrain 3D explorer canvas ("Observatory"): entities as class-coloured
dots on a deep-ink stage, asserted relationships as quiet slate lines,
co-mentions as fainter ones. `GraphCanvas.mount()` from
`@qball-inc/elements/graph` renders a bundle you pass in and reports what the
visitor does as events. It is data-only: it never fetches.

```ts
import { GraphCanvas, GraphCanvasError } from "@qball-inc/elements/graph";

try {
  const graph = await GraphCanvas.mount(host, { data: bundle, hint: false });
  graph.on("select", (e) => syncUrl(e.detail.node.name));
  graph.on("clear", () => syncUrl(null));
} catch (error) {
  if (error instanceof GraphCanvasError) showStaticMessage(error.code);
}
```

Prerequisites:

- Install the optional peer `three` at `>=0.186.0 <0.187.0`. It is imported
  lazily inside `mount()`, so pages that never mount a canvas never load it,
  and the entry stays safe to import during a static build.
- Load `colors_and_type.css` and `graph.css` from `@qball-inc/tokens`. Every
  canvas colour is read from these tokens at mount.
- Give the host a size: the canvas fills it. The host's previous content is
  replaced.

Mount once the bundle is in hand. Loading and fetch errors for the data belong
to you (or to the explorer organism); the canvas has no data-fetch states.

## `GraphCanvas.mount(host, options) → Promise<GraphCanvasHandle>`

Resolves as soon as the canvas is rendering. The layout then settles live on
screen (instantly under `prefers-reduced-motion`); `handle.settled` resolves
when it is done. A bundle that carries a complete precomputed `layout` renders
those positions unchanged, with no simulation. Without one, the layout is
seeded from `bundle.revision`, so the same revision always settles to the same
picture.

| Option           | Default              | What it does                                                                     |
| ---------------- | -------------------- | -------------------------------------------------------------------------------- |
| `data`           | required             | A `SkeletonBundle`, validated at mount (path-naming errors).                     |
| `labels`         | see below            | Partial overrides for every visible string.                                      |
| `hint`           | `true`               | The interaction hint in the bottom bar. Pass `false` if your page shows its own. |
| `legend`         | `true`               | The class legend (collapsed behind a toggle below 640px or on touch).            |
| `chip`           | `true`               | The selection chip. An explorer with its own panel passes `false`.               |
| `draggable`      | `true`               | Mouse-drag moves a node, pulling its strongest neighbours gently along.          |
| `neighborBudget` | `20`                 | Neighbours shown per selection, and per "show more".                             |
| `labelBudget`    | `30` (`14` on touch) | Always-on labels: the entities with the most episodes. `0` for none.             |
| `suppressKeys`   | none                 | Return `true` to make Esc do nothing, e.g. while one of your overlays is open.   |
| `errorUi`        | `true`               | Render the error figure on failure. Pass `false` to show your own message.       |

## Handle

| Member                  | Behaviour                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select(idOrName)`      | Selects by revision-scoped id or canonical name. Returns `false` (and does nothing) if unknown.                                                   |
| `clearSelection()`      | Clears the selection.                                                                                                                             |
| `expandNeighbors()`     | "Show more": grows the neighbour list by the budget. `false` when nothing is left.                                                                |
| `setFilter(fn \| null)` | Non-matching nodes fade to 6%, their edges to 8%. Returns the match count.                                                                        |
| `setData(bundle)`       | Swaps the graph in place (no remount). Clears selection and filter. Throws `invalid-bundle` and keeps the current graph if the bundle is invalid. |
| `settled`               | Promise for the current bundle's layout settling. Also resolves if that bundle is replaced, lost or destroyed first, so it never hangs.           |
| `snapshotDate`          | `bundle.stats.snapshot_date`.                                                                                                                     |
| `on(type, listener)`    | Typed listener on the host; returns the remover.                                                                                                  |
| `destroy()`             | Stops rendering, disposes every GPU object and listener, and removes only what this mount added (a newer mount on the same host survives).        |

Ids are scoped to one bundle revision. Anything that outlives a bundle (a deep
link, a breadcrumb) should refer to an entity by name.

## Events

Dispatched on the host element. They do not bubble, so listen on the host
itself. (Bare names match `./chat`. The native `select` event bubbles up from
text inputs, so an ancestor listener could catch the wrong one.)

| Event    | `detail`                     | When                                                                                                                                                                                                  |
| -------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `select` | `{ node, neighbors, total }` | A node is selected, or "show more" grows the list. `neighbors` is the budgeted list currently shown (`{ node, typed, weight }`, strongest first; asserted before co-mention), `total` is all of them. |
| `clear`  | `{}`                         | The selection is cleared, including when a new filter excludes it.                                                                                                                                    |
| `filter` | `{ matches }`                | After every `setFilter`. `matches: 0` also shows the empty-filter note.                                                                                                                               |
| `retry`  | `{ code }`                   | The error figure's retry button was pressed. Mount again to retry.                                                                                                                                    |
| `error`  | `{ code, message }`          | The WebGL context was lost after mount (the error figure is shown).                                                                                                                                   |

## Failures

`mount()` rejects with a `GraphCanvasError`. Unless `errorUi: false`, it first
renders a centred error figure (copy from `labels`) with a retry button that
dispatches `retry`. You never get a blank box, and the canvas never refetches. To retry
after a context loss, `destroy()` the old handle and mount again; after a
mount failure there is no handle, so just mount again.

| `code`              | Cause                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| `three-unavailable` | The `three` peer could not be imported (not installed, or the chunk failed).       |
| `webgl-unavailable` | No WebGL context could be created (also emitted as `error` on context loss).       |
| `invalid-bundle`    | `data` failed validation. `cause` is the path-naming `BundleValidationError`.      |
| `missing-styles`    | The colour tokens did not resolve: `graph.css` / `colors_and_type.css` not loaded. |

## Keys and focus

The canvas binds one key: **Esc**. The first press clears the selection; the
second recentres a panned view. It acts only when focus is inside the canvas,
or when nothing is focused and the pointer is over it. It does nothing when:

- another handler already called `preventDefault()` (the chat overlay does);
- the key came from a text field or a dialog;
- an `aria-modal="true"` element is shown anywhere on the page (the chat
  overlay sets one) or the canvas sits inside an `inert` region;
- your `suppressKeys()` returns `true`.

The canvas never binds Q (that is the chat hotkey). Clicking the canvas focuses
it (`tabindex="-1"`, so it is not a tab stop); `destroy()` does not move focus.
Keyboard traversal of the chrome arrives with the explorer.

## Rendering

The canvas draws only when something changes, and pauses while the tab is
hidden or the canvas is scrolled offscreen. There is no idle animation, and
camera moves are instant.

Colours are design-reviewed values that intentionally depart from the page
dark theme for legibility on the deep-ink stage. They are pinned on
`.graphcanvas` by `graph.css`, so a light page never repaints the nodes. Nodes
take their class colour; the biggest hubs brighten toward `--stage-hub`. Typed
edges use `--anno-source`, co-mention edges `--text-muted`; a selection lights
its typed edges sage and its co-mention edges amber, and dims everything else.
Label font, colour, weight and halo come from `.graphcanvas .gc-label` in
`graph.css`. Per frame, only label position and visibility change.

The status line is `canvasStatus()` from the core entry
(`N entities · N typed · N co-mention · snapshot {date}`, shortened below
640px). Counts are not locale-formatted.

Node names, class labels and every option string land via `textContent`. The
module contains no `innerHTML`.

## Labels

Override any subset with `labels`; the rest keep these defaults. Defaults are
lowercase and contain no em-dashes.

| Key              | Default                                                                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loading`        | `loading graph…`                                                                                                                                   |
| `settling(pct)`  | `settling… {pct}%`                                                                                                                                 |
| `hintFine`       | `drag to orbit · alt/⌘+drag to pan · scroll to zoom · click to select · esc clears`                                                                |
| `hintCoarse`     | `drag to orbit · pinch to zoom · two-finger drag to pan · tap to select`                                                                           |
| `legendShow`     | `legend ▾`                                                                                                                                         |
| `legendHide`     | `legend ▴`                                                                                                                                         |
| `classes`        | `tool`, `resource`, `technique`, `person`, `model`, `org`, `protocol`, `dataset`, `concept` (keyed by `cls`; unknown classes show their raw `cls`) |
| `episodes(n)`    | `{n} episode(s)`                                                                                                                                   |
| `showing(x, y)`  | `showing {x} of {y} neighbors`                                                                                                                     |
| `showMore`       | `show more`                                                                                                                                        |
| `clearSelection` | `clear selection` (accessible name of the chip's `×`)                                                                                              |
| `emptyFilter`    | `no entities match the active filters.`                                                                                                            |
| `error`          | `the graph could not be loaded.`                                                                                                                   |
| `retry`          | `retry`                                                                                                                                            |
| `canvas`         | `knowledge graph` (the canvas's accessible name)                                                                                                   |

## Build marker

Every mounted canvas element carries `data-qb-engine="qball-elements-graphcanvas"`
(exported as `GRAPH_CANVAS_MARKER`). The string appears in any bundle chunk
that includes the canvas. Grep your build output for it to prove a page, or a
flag-off build, ships no graph code.

## Port record

- **Source**: the prototype engine `graph/graph-canvas.js` from the Claude
  Design project (live copy verified identical to the handed-off copy at the
  start of the port). Layout, scales, neighbour ranking and label ranking are the
  package's pure graph modules (`sim`, `scales`, `neighbors`, `labels`).
- **three.js**: verified against 0.186. The GLSL is unchanged: three's
  `ShaderMaterial` maps the GLSL ES 1.0 `attribute` / `varying` /
  `gl_FragColor` forms onto WebGL2. Real-GPU checks run in headless Chromium
  (SwiftShader).
- **Deliberate changes from the prototype**: data-only (no `src` / fetch);
  seeded layout; Esc scoped to the canvas instead of `window`; colours and label
  styling from tokens instead of literals and inline styles; DOM built without
  `innerHTML`; on-demand rendering that pauses when hidden; typed failures.
- **Visual fidelity**: the side-by-side comparison against the prototype (fixed
  camera, the port's settled positions injected into both) and owner sign-off
  are recorded here when the browser test layer lands.
