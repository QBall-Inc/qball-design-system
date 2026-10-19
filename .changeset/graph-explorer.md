---
"@qball-inc/elements": minor
"@qball-inc/tokens": minor
---

`@qball-inc/elements/graph` adds `GraphExplorer`: the canvas, the facet chips and the entity panel assembled into one dark-stage frame. See docs/graph-explorer.md.

- **One mount.** `GraphExplorer.mount(host, { bundle, taxonomy, detail, … })` resolves to a handle with `select(idOrName, { openPanel })`, `clearSelection`, `setData(bundle, { taxonomy, domainLabels })`, `openPanel` / `closePanel`, `path`, `panelOpen` and `canvas`.
- **The click path lives here.** A select pushes, a crumb truncates and re-selects, a connection row selects through the same canvas path, and Esc (anywhere in the frame) or an empty-canvas click clears.
- **Overlays start minimized.** Above 900px the panel opens on select. At 900px and below it is a bottom sheet behind a `details ▴ <name>` pill (`autoOpen` overrides both). A deep link with `openPanel: true` opens it at every width. Open filters push the pill and the sheet below the chip strip.
- **Events, not side effects.** `pathchange` (for URL sync), `panel` (for launcher yield) and `error` (the canvas failed after mount). The explorer never fetches, never writes history and never touches `document.body`.
- **No WebGL.** The mount still resolves: the canvas error figure shows, and the chips and panel keep working. Retry mounts the canvas again.
- Answer turns: the sources line and the site-links line now carry `aria-controls` naming the list they open.
- `EntityPanel` gains `headAction`, one consumer control in the header's top row. `FacetFilterBar.setData` takes new `domainLabels`.

tokens: adds `--signal-strong` (and `--stage-signal-strong`), a sage that meets AA on a `--signal-bg` fill. Pressed facet chips use it, so their label passes in dark themes and on the stage. Adds the `.epanel__top` / `.epanel__action` header row. `.gx__pshow` and the ≤900px `.gx__panel` follow `--gx-top`, which the explorer sets below an expanded filters strip.
