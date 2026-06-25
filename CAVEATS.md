# CAVEATS.md — open decisions & their resolutions

The five caveats the system carried, now with the owner's decisions recorded so downstream builds
stop re-litigating them. Treat these as binding unless the owner revises.

## 1. Berkeley Mono width — SemiCondensed (current) · Regular is a future seam

- **State:** the bundled `fonts/` are the **SemiCondensed** width axis (100–800 + obliques). The
  original brand spec referenced the standard width; SemiCondensed is narrower, so lines are shorter at
  equal character count and the −2px H1 tracking reads tighter.
- **Decision:** **SemiCondensed is the locked, current width.** It is correct for everything today.
- **Seam:** the project may expand to **Regular (standard) width** later; if so, the owner uploads the
  Regular woff2 files and they're added as a **parallel** `@font-face` family (e.g. `"Berkeley Mono
  Std"`) — *added alongside*, never swapped under existing work. Until that upload happens, SemiCondensed
  is the only width. (See `FONTS.md`.)

## 2. Berkeley Mono Regular-weight (400) file

- **State:** no dedicated standard-width Regular-400 file was supplied; the 400 slot is filled by the
  base-name `BerkeleyMono-SemiCondensed.woff2`.
- **Decision:** **correct as-is for the SemiCondensed width.** Revisit only if/when the standard width
  is introduced under #1 (the Regular file would arrive with that upload).

## 3. Qball Inc — KEEP (org identity, inherits this system)

- **State:** Qball Inc was a near-empty placeholder with no separate brand assets.
- **Decision:** **keep it.** Qball Inc is the owner's **org identity and it builds on this very design
  system** — it is not a separate brand needing its own spec. It inherits all foundations (color, type,
  spacing, motion, components) unchanged.
- **Open (minor):** Qball-specific *overrides* — at minimum a logo/wordmark, and optionally a single
  accent decision — are still to be supplied. Until then, Qball surfaces use the Ashay Kubal foundations
  verbatim. The `ui_kits/qball/` stub stays as the slot for those overrides.

## 4. Icons — Lucide is the default (swap kept open)

- **State:** Lucide was introduced as a closest-match substitution (the brand spec names no icon family).
- **Decision:** **Lucide is the default set** — stroke-width 1.5, 16–20px, `--text-muted` →
  `--color-signal` on hover, inlined as SVG (inherits `currentColor`). It is **swappable globally** if a
  project prefers another geometric outline set (Phosphor, Heroicons). No emoji, ever.

## 5. Live-site vs spec drift / the app-shell departure

- **State:** the UI kit recreates the *spec* (v1.0), not a crawl of the live ashaykubal.com. Separately,
  the spec says "no fixed sticky headers," but the **application** layer uses a fixed, hide-on-scroll app
  bar + command dock.
- **Decision:** **the spec wins for editorial/marketing surfaces** (nav scrolls with the page). The
  **fixed, hide-on-scroll app chrome is an intentional, documented departure for application surfaces
  only** (data/AI products like Stocky) — it is not drift, it's a deliberate extension. If the live site
  has moved past spec v1.0, point Claude at the diffs; absent that, spec v1.0 is canonical.

---

## Versioning (so tokens don't change under a project mid-build)

This packet represents **v1.0.0** (brand tokens locked 2026-05-22; application component layer added
2026-05-30). When consuming it as a dependency:

- Treat `packages/tokens/` (`colors_and_type.css` + `components.css` + `theme.css` + `tokens.json`) as a **pinned version**. A change to any
  token value is a **minor/major bump**, never a silent edit — downstream layouts are tuned to these
  exact values.
- Additive-only changes (new component, new variant) → **minor**. Token value changes or removals,
  type-stack changes, radius/spacing-scale changes → **major**.
- Record changes in a `CHANGELOG.md` at the system root when this gets committed to its repo.
