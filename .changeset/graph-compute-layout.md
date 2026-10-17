---
"@qball-inc/elements": minor
---

`@qball-inc/elements/graph` exports `computeLayout(bundle)` and `LAYOUT_VERSION`: run the canvas's own seeded layout once on a server (Node-safe), ship it in the bundle's `layout`, and the canvas renders at once with no live settle. `LAYOUT_VERSION` changes only when the same bundle would lay out differently; key stored layouts by revision plus this value.
