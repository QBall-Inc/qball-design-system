---
name: Ashay Kubal Design System
description: >-
  A terminal-meets-editorial system: huge monospaced display type on warm
  parchment/charcoal, sage as the single wayfinding color, amber as the lone
  highlight, and a deliberately restrained, asymmetric, shadowless surface
  language. Built for personal-lab editorial surfaces and for data/AI
  applications (a finance palette + grounding guardrail extend it). No shadows,
  no gradients, no glass, no emoji, no pill buttons.
owner: Ashay Kubal · Qball Inc (org identity inherits this system)
version: 1.0.0 (tokens locked 2026-05-22; app layer added 2026-05-30)
status: internal — not public; consumed by the owner + Claude to build apps
colors:
  bg: "#F7F3EE"            # parchment (light)
  bg-dark: "#1E1D1B"       # charcoal (dark)
  surface: "#EDE8E1"
  surface-dark: "#2A2826"
  fg: "#141414"
  fg-dark: "#E7E0D6"
  fg-secondary: "#57534E"
  fg-secondary-dark: "#A8A29E"
  fg-muted: "#78716C"
  signal: "#3F6B5B"        # sage — ALL wayfinding (light)
  signal-dark: "#5B9E87"
  highlight: "#B45309"     # amber — featured/secondary (light)
  highlight-dark: "#D97706"
  # finance/data — semantics ONLY (light / dark)
  up: "#2E7D4F"  ; up-dark: "#4FB07A"
  down: "#B5342B" ; down-dark: "#E2705F"
  warn: "#9A7D0F" ; warn-dark: "#D9B43C"
  data-info: "#2C6395" ; data-info-dark: "#5B9BD6"
  flat: "#78716C"
  anno-source: "#4E6577" ; anno-source-dark: "#93A7B5"  # grounding (outside finance palette)
typography:
  display: Berkeley Mono SemiCondensed   # H1–H2 + all numerics/tickers/prices
  heading: Fira Code                     # H3–H4, UI, nav, buttons, captions, metadata
  body: Syne                             # long-form body (16/1.75)
  quote: Instrument Serif                # pull quotes (italic, ≤480px)
  code: JetBrains Mono                   # code blocks
  scale: { h1: 56, h2: 36, h3: 24, h4: 18, body: 16, caption: 12, tag: 11, button: 13 }
  tracking: { h1: -2, h2: -1, h3: -0.5, h4: 0, body: 0, caption: 1.25 }
rounded: 4 / 8 / 12px (sm/md/lg). Pills (999px) are NOT part of the brand.
spacing: 8px base — 4, 8, 16, 32, 64, 128 (no intermediate values)
elevation: none (no shadows). Lift = heavier border + tonal surface step + scrim.
icons: Lucide (default, stroke 1.5, 16–20px) — swappable globally; no emoji ever.
motion:
  ease-out: cubic-bezier(0.22, 1, 0.36, 1)
  ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)
  durations: { fast: 120ms, base: 200ms, slow: 360ms }
---

# Ashay Kubal Design System — Design

> **This file is the design source of truth.** Its companions in this packet:
> `COMPONENT-LIBRARY.md` (how to build each component on Vite+React+shadcn/Radix+Tailwind),
> `packages/tokens/` (`theme.css` Tailwind export + `tokens.json` DTCG + `colors_and_type.css` +
> `components.css` — the canonical CSS to lift verbatim), `CAVEATS.md` (open decisions),
> `FONTS.md`, `gallery.html` (live component contact-sheet), and `reference/` (the upstream brand
> README, the CSS-class usage guide, and the original gap audit).
>
> **Golden rule:** lift token + component *values* verbatim from `packages/tokens/colors_and_type.css` /
> `packages/tokens/components.css` / `packages/tokens/theme.css`. Never re-derive a color, spacing, radius, or type setting by eye.

## Overview

This is the brand identity and UI system for **ashaykubal.com** (a personal research lab) and the
**Qball Inc** org identity that builds on it. The aesthetic is **terminal-meets-editorial**:
oversized monospaced display type on warm parchment (light) or charcoal (dark), generous asymmetric
whitespace, and exactly two chromatic notes — **sage** for all wayfinding and **amber** as the lone
highlight. It reads like a well-set technical document that happens to be software.

The system began as an editorial personal-site brand (tokens + type ramp + semantic prose styles +
a marketing homepage kit) and was extended into a full **application UI layer** (forms, data tables,
charts, overlays, an AI-chat surface, and app states) plus two domain additions for data products: a
**finance/data palette** (green/red/gold/blue, semantics only) and a **grounding guardrail** that
flags unsourced AI output. Both layers share one token source; the app layer never replaces the brand.

It is deliberately old-fashioned about a few things, and that restraint *is* the brand: **no drop
shadows, no gradients, no glass/backdrop-blur as decoration, no emoji, no pill buttons, no purple/blue
"tech" gradients, no looping idle animation.** Surfaces differentiate by a tonal step
(`bg → surface`), not elevation. Theme is a global dark⇄light toggle (`data-theme` on `<html>`),
honoring `prefers-color-scheme` with manual override.

## Color

Two backgrounds only, both warm-biased — **never pure white, never pure black.**

| Role | Light | Dark | Usage |
|---|---|---|---|
| Background | `#F7F3EE` parchment | `#1E1D1B` charcoal | page |
| Surface | `#EDE8E1` | `#2A2826` | raised cards, inputs, chips |
| Text primary | `#141414` | `#E7E0D6` | headings, key figures |
| Text secondary | `#57534E` | `#A8A29E` | body, labels |
| Text muted | `#78716C` | `#78716C` | metadata, timestamps |
| **Signal (sage)** | `#3F6B5B` | `#5B9E87` | links, CTAs, active nav, focus, selection, code keywords — **all wayfinding** |
| **Highlight (amber)** | `#B45309` | `#D97706` | "featured/pinned" badges, secondary CTAs, string literals, `[unverified]` |
| Border default | `rgba(0,0,0,.06)` | `rgba(255,255,255,.06)` | 0.5px hairline card borders |
| Border strong | `rgba(0,0,0,.14)` | `rgba(255,255,255,.14)` | 1px dividers, button outlines, modal/popover lift |

> **Sage and amber never carry equal visual weight in one component.** One leads, one supports. In a
> row of tags, sage is the default and amber is the single "featured" — never both at full saturation
> side by side. Tag/badge backgrounds are the 10% (light) / 15% (dark) tint of their color.

**Finance / data palette — semantics ONLY** (gains/losses/caution/info; only in data products). It is
visually separate from sage/amber on purpose, and must always pair with a non-color cue (arrow, sign,
label) for accessibility:

| | Light | Dark | tint (light/dark) |
|---|---|---|---|
| Up / gain | `#2E7D4F` | `#4FB07A` | `rgba(46,125,79,.10)` / `rgba(79,176,122,.15)` |
| Down / loss | `#B5342B` | `#E2705F` | `rgba(181,52,43,.10)` / `rgba(226,112,95,.15)` |
| Warn / caution | `#9A7D0F` | `#D9B43C` | `rgba(154,125,15,.12)` / `rgba(217,180,60,.16)` |
| Info | `#2C6395` | `#5B9BD6` | `rgba(44,99,149,.10)` / `rgba(91,155,214,.15)` |
| Flat / neutral | `#78716C` | `#A8A29E` | — |

**Grounding annotation** (for AI surfaces): cited `[source]` = cool slate `#4E6577` / `#93A7B5`;
`[unverified]` = the amber highlight. Kept **outside** the finance palette so a citation never reads
as a price. Never use sage or a finance hue for this.

## Typography

- **Berkeley Mono SemiCondensed** — display (H1–H2) and *all* numerics: tickers, prices, percentages,
  OHLC (tabular figures via `.num`/`.tabular`). Tightly tracked (−2px at H1). Carries the personality.
- **Fira Code** — sub-display + UI: H3–H4, nav, buttons, tags, captions, metadata, table cells.
- **Syne** — long-form body at 16px / 1.75. Irregular proportions give copy character.
- **Instrument Serif** (italic) — pull quotes only, ≤480px. The serif-vs-mono tension is the point.
- **JetBrains Mono** — code blocks, a distinct register from Berkeley/Fira.

Scale (px): H1 56 · H2 36 · H3 24 · H4 18 · body 16 · caption 12 · tag 11 · button 13. Tracking
tightens as size grows: −2 (H1) → −1 (H2) → −0.5 (H3) → 0 (H4/body) → +1.25 (uppercase caption).
**Casing is sentence case everywhere** — even H1. ALL-CAPS is reserved for the eyebrow caption style
(Fira Code 12px, +1.25px tracking) and applied by CSS `text-transform`, not typed into source copy.

## Layout

- **Asymmetry is the strategy.** Heroes are 60/40 or 70/30; a section title can sit left while body
  sits right. Don't centre everything by reflex.
- Max body width **720px** (assumes 8–20 min reads), max page width **1200px**, pull quotes **480px**
  and indented (a deliberate negative-space notch).
- **8px spacing scale**: 4 / 8 / 16 / 32 / 64 / 128. Never invent intermediate values.
- **Marketing/editorial surfaces:** no fixed sticky header — nav scrolls with the page (long reads).
- **Application surfaces:** the app frame (top bar + optional command dock) may be fixed; the proven
  pattern hides it on scroll and springs it back on stop. App chrome and content share one fluid side
  margin: `clamp(40px, 6vw, 160px)`. (This app-shell departure is documented — see `CAVEATS.md` #5 and
  `COMPONENT-LIBRARY.md` → App chrome.)
- Footer is left-aligned, mono, short (three columns max).

## Elevation & Depth

**No shadows, anywhere.** Depth comes from the tonal step `bg → surface` and from border weight:
0.5px hairline for cards, 1px for outlines/dividers, `border-strong` to lift a modal or popover. The
only blur is the app chrome's translucent bar/dock and the overlay scrim — never decorative glass on
content. No `backdrop-filter` as ornament.

## Shapes

Radii: **`sm` 4px** (tags, buttons, inline code, chips, switches), **`md` 8px** (cards), **`lg` 12px**
(modals, dock, hero panels — sparingly). **Never above 12px. Pills (`999px`) are off-brand** — the only
sanctioned exceptions are the tiny notification count badge and a meter track. Code blocks and pull
quotes use a **3px solid sage left accent with 0 radius on that edge** — the accent makes the shape.

## Motion

Restraint is the rule — animation confirms state, it doesn't delight. Durations: **120ms** (hover),
**200ms** (state change), **360ms** (layout/page). Easing: `ease-out cubic-bezier(.22,1,.36,1)` for
incoming/outgoing UI; `ease-in-out cubic-bezier(.65,0,.35,1)` for the rare sanctioned breathing/looping
affordance. **Fades, not slides.** No bounce, spring, overshoot, marquee, or idle/breathing CTA. The
only sanctioned loops are transient state indicators (button spinner, the grounding shimmer, a
dwell-to-read breathe) — all of which must honor `prefers-reduced-motion`.

## Iconography

**Lucide** is the default icon set (stroke-width 1.5, 16–20px, `--text-muted` default → `--color-signal`
on hover), inlined as SVG so it inherits `currentColor` for theme switching. It is a chosen default,
**swappable globally** if a project prefers another geometric set (Phosphor, Heroicons outline). Unicode
glyphs are *content*, not icons: `→` (CTA arrow), `↳` (nested reply), `·` (metadata separator). **No
emoji, ever** — it breaks the typographic frequency.

## Voice (for any copy generated under this brand)

Opinionated, technical, dry. First-person singular for posts/bio. Sentence case. **Avoid em-dashes**
(use commas, colons, or a new sentence), no exclamation marks, no emoji. Name the specific thing
(library, model, number) over the abstraction. Curly quotes in prose, straight quotes in code. Full
guidance in `reference/brand-README.md` → *Content Fundamentals*.

## Do's and Don'ts

**Do**
- Use sage for every wayfinding/interactive affordance; amber only to mark "featured/latest."
- Differentiate surfaces with the tonal step + border weight, never a shadow.
- Pair every finance/gain-loss state with a non-color cue (arrow/sign/label).
- On AI surfaces, flag every model number `[source]` or `[unverified]`; keep the disclaimer present.
- Define loading / empty / error for every data surface; isolate section errors.
- Keep the type stack and the 8px/4-8-12 radius scales exactly as specified.

**Don't**
- No drop shadows, gradients, glass, emoji, or pill buttons.
- Don't let amber and sage fight at equal weight in one component.
- Don't use color alone for finance semantics.
- Don't round above 12px or invent spacing between the 8px steps.
- Don't substitute the type families. Don't introduce a third chromatic accent.

## Component overview

The full built layer is `packages/tokens/components.css` (drop-in, token-driven, framework-agnostic), with one live
preview card per component under `preview/` (assembled in `gallery.html`). Headline members — forms
(button/input/secret/select/switch/segmented/field/search), data (table/stat/meter/badge/sparkline/
**candlestick (D3)**/tooltip/avatar), overlays (modal/toast/notification-center/callout/skeleton/
spinner/state-fig), app chrome (app bar/command dock/popovers/scrim/user-menu/theme-toggle/mascot),
and AI/finance domain (`.term` terminal chat, grounding wave-flag + portaled tooltip, `.digest`
briefing card). **How to build each on the real stack is `COMPONENT-LIBRARY.md`.**
