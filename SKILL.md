---
name: ashaykubal-design-system
description: >-
  Use this skill to design and build interfaces under the Ashay Kubal Design System (and the Qball Inc
  org identity that inherits it) — for production component libraries, real apps, or throwaway
  prototypes/mocks. Terminal-meets-editorial: mono display type on parchment/charcoal, sage for all
  wayfinding, amber as the lone highlight, a finance palette + grounding guardrail for data/AI surfaces.
  Contains tokens, fonts, the full component layer, a build map, and live previews.
user-invocable: true
---

Read `README.md` first (it indexes everything), then `DESIGN.md` (the design source of truth) before
producing anything. The system is mono-heavy and editorial — terminal aesthetics, parchment/charcoal
backgrounds, sage + amber as the only chromatic notes, asymmetric layouts, no shadows. **Never** add
gradients, glassmorphism, emoji, or pill-shaped buttons; they are explicitly outside the brand.

## What to read, by task

- **Building a real component library or app** → `DESIGN.md` (foundations) + `COMPONENT-LIBRARY.md`
  (component → shadcn/Radix/Tailwind build map, states, build order) + `packages/tokens/theme.css` /
  `packages/tokens/tokens.json` (lift verbatim) + `packages/tokens/colors_and_type.css` + `packages/tokens/components.css` (the canonical CSS).
- **Throwaway prototype / mock / slides** → copy `packages/tokens/colors_and_type.css` + `packages/tokens/components.css` + the fonts/
  assets out, build static HTML. Browse `preview/*.html` (or open `gallery.html`) for every component's
  state matrix; copy the closest card and adapt.
- **Understanding the brand voice / writing copy** → `reference/brand-README.md` → *Content Fundamentals*.
- **Open decisions** (font width, icons, Qball, versioning) → `CAVEATS.md`.

## Golden rules

- **Lift token + component values verbatim** from `packages/tokens/` (`colors_and_type.css` / `components.css` / `theme.css` / `tokens.json`).
  Never re-derive a color, spacing, radius, or type setting by eye.
- **Theme:** set `data-theme="light|dark"` on `<html>`; tokens swap automatically. Theme is global,
  lives in the chrome, never per-surface. Dark + light both first-class.
- **Sage handles all wayfinding; amber accents only.** Never equal weight in one component. The finance
  palette (green/red/gold/blue) is for **data semantics only** and always pairs with a non-color cue.
- **Type:** Berkeley Mono (display + all numerics), Fira Code (UI), Syne (body), Instrument Serif italic
  (pull quotes), JetBrains Mono (code). The stack is locked — no substitutions.
- **Sentence case everywhere. No emoji. No drop shadows. No pills. No purple/blue gradients.**
- Asymmetric layouts. 8px spacing scale (4/8/16/32/64/128). 4/8/12px radii — never above 12.

## Map

- `README.md` — index + how to consume + version.
- `DESIGN.md` — foundations (color, type, layout, elevation, shapes, motion, icons, voice, do/don't).
- `COMPONENT-LIBRARY.md` — the build map: each component → real-stack implementation + states.
- `CAVEATS.md` — open decisions + resolutions + versioning.
- `FONTS.md` — the five families + Berkeley Mono licensing/width notes.
- `packages/tokens/` — the canonical token layer (`@qball-inc/tokens`): `colors_and_type.css` (tokens + `@font-face` + semantic element styles), `components.css` (the full application component layer), `theme.css` (Tailwind v4), `tokens.json` (DTCG/Style-Dictionary).
- `fonts/` — Berkeley Mono SemiCondensed woff2 (self-hosted, license-restricted, embed per-app).
- `assets/` — logos (wordmark + mark + favicon) + `assets/icons/` (Lucide).
- `preview/*.html` + `gallery.html` — one live card per component; the contact sheet.
- `reference/` — the upstream brand README, the CSS-class usage guide, the original gap audit.

If invoked without guidance, ask what to build, ask a few questions, and act as an expert designer
who outputs HTML artifacts *or* production code, depending on the need.
