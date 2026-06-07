# Stocky App Components — Usage Guide

The Ashay Kubal design system was originally an **editorial / terminal personal-site brand** (see the root `README.md` and `colors_and_type.css`). This guide documents the **application component layer** added on top of it to build **Stocky** — the hobby-tier stock watchlist with an AI sidekick.

Everything here layers on the brand tokens. Nothing replaces them.

## Files

| File | What it is |
|---|---|
| `colors_and_type.css` | Brand tokens (color, type, spacing, radii, motion) + the **finance/data palette** and **annotation** tokens added for Stocky. Single source of truth. |
| `components.css` | The **app component layer** — every class documented below. Layer it after `colors_and_type.css`. |
| `preview/*.html` | One self-contained card per component (feeds the Design System tab). Each links the two CSS files and shows the component's states in light + dark. |
| `ui_kits/stocky/` | The full working app prototype assembling these components. Start here to see them in context. |

## Token extensions (in `colors_and_type.css`)

- **Finance / data palette** — `--data-up` (green), `--data-down` (red), `--data-warn` (gold), `--data-info` (blue), `--data-flat` (stone), each with a `-bg` tint. Traditional market hues, warm-tuned for parchment + charcoal. Used **only** for data semantics (gains/losses/caution/info), never for wayfinding.
- **Annotation accent** — `--anno-source` (slate) + `--anno-source-bg`. Deliberately **outside** the finance palette so a cited "[source]" never reads as a price color.
- **Numerics** — `.num` / `.tabular` apply Berkeley Mono tabular figures. Use for all prices, %, OHLC.
- The brand's sage (`--color-signal`) stays the one signal for links/CTAs/selection; amber (`--color-highlight`) stays the one highlight (and marks "[unverified]").

## Component catalog (in `components.css`)

**Forms & controls**
- Buttons — extends the brand `.btn` with `--ghost`, `--destructive`, `--icon`, `--loading`, `:disabled`.
- `.field` / `.input` — label + control + helper + error; states: focus, error, disabled, numeric, with-affordance.
- `.select` / `.menu` — native control + chevron; custom open panel.
- Secret input — masked field with reveal toggle (see `preview/secret-input.html`).
- `.switch` (brand-native square toggle) · `.segmented` (2–3 options). Pills are off-brand.

**Data display**
- `.dt` — data table (compact rows, tabular numerics, row hover/selected, semantic colors).
- `.stat` / `.ministat` — metric tiles (up/down/flat).
- `.meter` — usage/progress (`--warn`, `--over`).
- `.badge` — semantic pills (`--up/--down/--warn/--info/--signal/--highlight`).
- `.sparkline`, `.tip` (tooltip), `.avatar` (sizes, tones, status dot, group).
- Candlestick — D3-drawn; see `preview/chart-candlestick-*.html` for the color + chrome decisions (traditional green/red; compact card view vs. interactive detail view).

**Overlays & feedback**
- `.modal` (lifted by border + scrim — no shadows) · `.toast` · `.callout` (banner; hosts the disclaimer).
- `.spinner` · `.skel` (skeleton) · `.state-fig` (empty / error with retry).

**App chrome**
- `.appbar` + `.appnav` + `.iconbtn` + `.badge-count` + `.usermenu` + `.dropdown` / `.notif` (notification center).
- `.dock` — the **command island** (search · Ask Stocky · add); translucent + blurred, hides on scroll, popovers via `.dock-pop`. Two documented directions: **Traditional** (all in the bar) and **Island**.
- `.theme-toggle` — single-click sun/moon. Theme is **global**, lives in the chrome, never on individual surfaces.
- `.stocky-icon` — the Stocky CRT mascot (antenna, blinking eyes, simmering scanline). Inherits `currentColor`.

**AI conversation & grounding**
- `.term` — the locked **terminal transcript** (the canonical AI surface): `you ›` / `stocky ›` personas, line separators, streaming cursor, growable + scrolling body, fluid width, AI disclaimer.
- Grounding guardrail — `.ground-wave--source` (slate) and `.ground-wave--unverified` (amber) shimmer across the glyphs to draw the eye; `.gwrap` + `.gtip` give the hover explainer. **Critical for AI finance answers** — never let a number blend in.

**Briefings**
- `.digest` — LLM market-briefing card; states: `--unread` (sage accent + dot), `--read` (muted), loading (skeleton), empty. Narrated numbers may carry the grounding annotations inline.

## Conventions

- **Theme**: set `data-theme="light|dark"` on `<html>`; tokens swap automatically. Light is the default.
- **Alignment**: app chrome and page content share one fluid side margin — `clamp(40px, 6vw, 160px)`.
- **Fluid type**: data content scales with the viewport via `clamp()`, capped (see the kit's `styles.css`).
- **Numerics**: Berkeley Mono, tabular. **Gains/losses**: finance palette. **Source/unverified**: slate/amber, never finance hues.
- **No** gradients, glass, drop-shadows, or pills — elevation is border + scrim; toggles are squared.

## Where to start

Open `ui_kits/stocky/index.html` for the assembled app, then browse `preview/*.html` for each component's full state matrix.
