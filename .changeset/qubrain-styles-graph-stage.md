---
"@qball-inc/tokens": minor
---

Add the QuBrain knowledge-graph and QuBae chat styles (additive only; no existing token, value or class changes).

- `components.css`: ClaimCard, SourceRow, ProvenanceFooter, FacetFilterBar and EntityPanel classes; the QuBae chat surface (launcher with responsive sizing and a compact corner variant, overlay with mobile geometry, conversation turns, verdict stamps with ticker and shimmer, answer boxes, feedback marks, sources line, withheld-claim rows, notice, answer link, thinking cursor). Every new animation honors `prefers-reduced-motion`.
- New opt-in `@qball-inc/tokens/graph.css`: graph canvas chrome, the explorer frame, glass panel and filter strip, the mobile bottom sheet and the details pill. It pins a dark stage, so the explorer renders the same in light and dark pages. Import order: `colors-and-type.css` → `components.css` → `graph.css`.
- New theme-independent tokens: `--stage-*` (graph dark stage, canvas and panel tiers), `--color-scrim-light` and `--text-scale` (default `1`; multiplies the new component text sizes so a site can scale them with its own type steps).
