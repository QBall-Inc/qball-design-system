---
"@qball-inc/elements": minor
"@qball-inc/tokens": patch
---

`@qball-inc/elements/graph` adds `FacetFilterBar` and `EntityPanel`. Both are renderers: you pass data in and they report what the visitor does; neither fetches. See docs/entity-panel.md.

- **FacetFilterBar.** Facet chips grouped by domain, built from your `taxonomy` (an option, not a bundle field), with `domainLabels`. Active chips OR together. A match count and a `× clear` button appear while chips are active. `onChange` hands you the predicate for `GraphCanvas.setFilter`. When the facet data has no pairs, a chip with unassignable entities carries a mark and the count reads `N match · K unassignable`.
- **EntityPanel.** Breadcrumbs, the entity header, the hop (claim cards, or the co-mention note), connection rows with "show more", a deduplicated reading list, and the pinned panel footer. Hop detail comes from your `detail` callback. A stale response is discarded, and its `signal` is aborted.
- Every string can be replaced through `labels`. `buildFacetModel` and its types are now public.

tokens: adds the `.fchip__inc` mark. `.facetbar__count`, `.facetbar__dom` and `.nrow__kind--com` move to `--text-secondary`, so they meet AA contrast on a bare page in both themes.
