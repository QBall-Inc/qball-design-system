<p align="center">
  <a href="https://qball-inc.github.io/qball-design-system/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-dark.gif">
      <img src="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-parchment.gif" alt="QBall Design System" width="200" height="200">
    </picture>
  </a>
</p>

<h1 align="center">QBall Design System</h1>

<p align="center">
  A portable, self-contained design system — a locked token layer plus a<br>
  framework-agnostic component layer, shipped light and dark from the same tokens.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@qball-inc/tokens"><img src="https://img.shields.io/npm/v/@qball-inc/tokens?color=3F6B5B&label=%40qball-inc%2Ftokens" alt="@qball-inc/tokens on npm"></a>
  <a href="https://www.npmjs.com/package/@qball-inc/react"><img src="https://img.shields.io/npm/v/@qball-inc/react?color=3F6B5B&label=%40qball-inc%2Freact" alt="@qball-inc/react on npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@qball-inc/tokens?color=3F6B5B" alt="Apache-2.0 license"></a>
</p>

<p align="center">
  <a href="https://qball-inc.github.io/qball-design-system/"><b>Gallery</b></a> ·
  <a href="./DESIGN.md">Design</a> ·
  <a href="./COMPONENT-LIBRARY.md">Components</a> ·
  <a href="./packages/tokens">@qball-inc/tokens</a> ·
  <a href="./packages/react">@qball-inc/react</a> ·
  <a href="./llms.txt">llms.txt</a>
</p>

The CSS is drop-in (color, type, spacing, radii, borders, motion); the component map
shows how to build the same components the same way on a modern React stack.

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

packages/tokens/         — the canonical, published token layer (@qball-inc/tokens):
  colors_and_type.css    — canonical tokens + @font-face seam + semantic element styles
  components.css         — the full application component layer (layer after the tokens)
  theme.css              — Tailwind v4 @theme export of the tokens
  tokens.json            — DTCG / Style-Dictionary shape (cross-platform)
packages/react/          — the @qball-inc/react component library
assets/                  — logos (wordmark + mark + favicon) + assets/icons/ (Lucide)
preview/                 — one live card per component (the canonical state matrices)
reference/               — usage guide + upstream foundations + historical audit
```

## How to consume it

- **Tokens (lift verbatim, never re-eyeball):** `packages/tokens/theme.css` (Tailwind), `packages/tokens/tokens.json` (DTCG),
  or `packages/tokens/colors_and_type.css` (raw CSS vars + the `@font-face`).
- **Components:** `packages/tokens/components.css` is a drop-in, token-driven layer (framework-agnostic). To build the
  React library, follow `COMPONENT-LIBRARY.md` — it maps each CSS class to a shadcn/Radix component and
  lists the states to implement. Verify each build against the matching `preview/*.html` / `gallery.html`.
- **Theme:** set `data-theme="light|dark"` on `<html>`; tokens swap. Light and dark are both first-class.

## Packages (npm)

This repo is a **pnpm workspace** that publishes the design system as two versioned,
public packages under the `@qball-inc` scope (Apache-2.0):

- **[`@qball-inc/tokens`](https://www.npmjs.com/package/@qball-inc/tokens)** — the locked token layer as drop-in CSS + DTCG JSON (zero build step).
- **[`@qball-inc/react`](https://www.npmjs.com/package/@qball-inc/react)** — the framework-agnostic component layer as a React library.

```bash
pnpm add @qball-inc/tokens @qball-inc/react
```

> **Status:** both packages are published at **v1.0.0**. The canonical CSS source is
> `packages/tokens/` (`colors_and_type.css` / `components.css` / `theme.css` / `tokens.json`)
> — what the npm package ships verbatim. See [docs/consumer-setup.md](./docs/consumer-setup.md)
> for the full consumer wiring sequence.

Workspace layout: `packages/tokens/` and `packages/react/`. Local development uses
`pnpm install` at the repo root + the `Justfile` recipes (`just typecheck`, `just lint`,
`just build`, `just test`).

## Display font

> **The display font ships as Fira Code in this repository.** The system's intended display
> face is **Berkeley Mono**, a commercial typeface that is **not** redistributed here. The
> token files (`packages/tokens/colors_and_type.css`, `packages/tokens/theme.css`, `packages/tokens/tokens.json`) default
> `--font-display` to Fira Code so nothing licensed is published.

To restore Berkeley Mono after cloning:

1. Purchase a license from **U.S. Graphics Company** — https://usgraphics.com/typefaces/berkeley-mono
   (a Website License Grant + Web Fonts module is required to serve it as a web font).
2. Drop the `.woff2` files into `fonts/`.
3. Re-add the `@font-face` declarations in `packages/tokens/colors_and_type.css` (see the _Display font_ comment there).
4. Put `'Berkeley Mono'` first in `--font-display` in `packages/tokens/colors_and_type.css`, `packages/tokens/theme.css`,
   and `packages/tokens/tokens.json`.

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
dependency; see `CAVEATS.md` → _Versioning_ before changing any value.
