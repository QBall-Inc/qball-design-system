# QBall Design System

A portable, self-contained design system: a locked token layer (color, type, spacing,
radii, borders, motion) plus a framework-agnostic component layer, shipped in both light
and dark from the same tokens. The CSS is drop-in; the component map shows how to build the
same components the same way on a modern React stack.

## Read in this order

1. **`DESIGN.md`** — the design source of truth: token front-matter + foundations (color,
   type, layout, elevation, shape, motion, icons, voice), Do's/Don'ts, and a component overview.
2. **`COMPONENT-LIBRARY.md`** — the build map: every component → how to build it on Vite + React +
   shadcn/Radix + Tailwind (+ D3 for charts), with states, library structure, and build order.
3. **`CAVEATS.md`** — resolved open decisions plus the versioning contract.
4. **`FONTS.md`** — the type families and how to load them.
5. **`gallery.html`** — open in a browser: a live contact-sheet of every component in light + dark.

## What's in here

```
README.md                — this index
DESIGN.md                — design source of truth (foundations)
COMPONENT-LIBRARY.md     — component → shadcn/Radix/Tailwind build map + states + build order
CAVEATS.md               — resolved open decisions + versioning
FONTS.md                 — the type families + how to load them
SKILL.md                 — agent-skill front-matter (drop-in)
gallery.html             — live component contact-sheet (light + dark)

colors_and_type.css      — canonical tokens + @font-face + semantic element styles
components.css            — the full application component layer (layer after the tokens)
tokens/
  theme.css              — Tailwind v4 @theme export of the tokens
  tokens.json            — DTCG / Style-Dictionary shape (cross-platform)
assets/                  — logos (wordmark + mark + favicon) + assets/icons/ (Lucide)
preview/                 — one live card per component (the canonical state matrices)
reference/               — usage guide + upstream foundations + historical audit
```

## How to consume it

- **Tokens (lift verbatim, never re-eyeball):** `tokens/theme.css` (Tailwind), `tokens.json` (DTCG),
  or `colors_and_type.css` (raw CSS vars + the `@font-face`).
- **Components:** `components.css` is a drop-in, token-driven layer (framework-agnostic). To build the
  React library, follow `COMPONENT-LIBRARY.md` — it maps each CSS class to a shadcn/Radix component and
  lists the states to implement. Verify each build against the matching `preview/*.html` / `gallery.html`.
- **Theme:** set `data-theme="light|dark"` on `<html>`; tokens swap. Light and dark are both first-class.

## Display font

> **The display font ships as Fira Code in this repository.** The system's intended display
> face is **Berkeley Mono**, a commercial typeface that is **not** redistributed here. The
> token files (`colors_and_type.css`, `tokens/theme.css`, `tokens.json`) default
> `--font-display` to Fira Code so nothing licensed is published.

To restore Berkeley Mono after cloning:

1. Purchase a license from **U.S. Graphics Company** — https://usgraphics.com/typefaces/berkeley-mono
   (a Website License Grant + Web Fonts module is required to serve it as a web font).
2. Drop the `.woff2` files into `fonts/`.
3. Re-add the `@font-face` declarations in `colors_and_type.css` (see the *Display font* comment there).
4. Put `'Berkeley Mono'` first in `--font-display` in `colors_and_type.css`, `tokens/theme.css`,
   and `tokens.json`.

Every other family (Fira Code, Syne, Instrument Serif, JetBrains Mono) is freely available
and loaded from Google Fonts by the host page.

## Non-negotiables (the short list)

- Sage = all wayfinding; amber = the lone highlight; never equal weight in one component.
- Finance palette (green/red/gold/blue) = data semantics only, always with a non-color cue.
- Type stack is locked: display (Berkeley Mono → Fira Code fallback) · Fira Code (UI) · Syne (body) ·
  Instrument Serif italic (quotes) · JetBrains Mono (code).
- Sentence case. No emoji. No drop shadows. No pill buttons. No purple/blue gradients. No glass.
- 8px spacing (4/8/16/32/64/128). Radii 4/8/12 — never above 12. Elevation = border + tonal step + scrim.

## Version

**v1.0.0** — token layer + application component layer. Treat the token + component files as a pinned
dependency; see `CAVEATS.md` → *Versioning* before changing any value.
