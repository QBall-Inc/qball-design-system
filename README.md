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
  <a href="https://www.npmjs.com/package/@qball-inc/elements"><img src="https://img.shields.io/npm/v/@qball-inc/elements?color=3F6B5B&label=%40qball-inc%2Felements" alt="@qball-inc/elements on npm"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@qball-inc/tokens?color=3F6B5B" alt="Apache-2.0 license"></a>
</p>

<p align="center">
  <a href="https://qball-inc.github.io/qball-design-system/"><b>Gallery</b></a> ·
  <a href="./DESIGN.md">Design</a> ·
  <a href="./COMPONENT-LIBRARY.md">Components</a> ·
  <a href="./packages/tokens">@qball-inc/tokens</a> ·
  <a href="./packages/react">@qball-inc/react</a> ·
  <a href="./packages/elements">@qball-inc/elements</a> ·
  <a href="./llms.txt">llms.txt</a>
</p>

## What it is

The QBall Design System is a small, opinionated design language for data-heavy
and AI-assisted web apps: monospace display type, a sage-and-amber palette with
dedicated finance colours, flat surfaces with no drop shadows, and light and dark
themes from one set of tokens. It ships as three public npm packages, and every
component can be seen running in the
**[live gallery](https://qball-inc.github.io/qball-design-system/)**.

## Which package do I need?

| Package                                      | Use it for                                                                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@qball-inc/tokens`](./packages/tokens)     | The design tokens and component styles as plain CSS, plus a DTCG JSON mirror. No build step, any framework or none. Every page needs this. |
| [`@qball-inc/react`](./packages/react)       | The React component library: buttons, forms, data tables and charts, app chrome, an AI terminal, animated backgrounds and more.            |
| [`@qball-inc/elements`](./packages/elements) | Framework-free components for grounded AI answers: a chat agent widget, claim and source cards, and a 3D knowledge-graph canvas.           |

```bash
# a React app
npm install @qball-inc/tokens @qball-inc/react
# any page, no React: the chat agent, trust and graph components
npm install @qball-inc/tokens @qball-inc/elements
```

Then import the token CSS once, tokens first:

```css
@import "@qball-inc/tokens/colors-and-type.css";
@import "@qball-inc/tokens/components.css";
```

Set `data-theme="light"` or `data-theme="dark"` on `<html>` to pick a theme.
Each package README has its own quick start, and
[docs/consumer-setup.md](./docs/consumer-setup.md) walks through the full wiring
(Tailwind, the display-font override, static and server builds).

## For designers and builders

The design itself is documented alongside the code. Read in this order:

1. **[DESIGN.md](./DESIGN.md)**: the design source of truth. Token values and the
   foundations (colour, type, layout, elevation, shape, motion, icons, voice),
   with do's and don'ts.
2. **[COMPONENT-LIBRARY.md](./COMPONENT-LIBRARY.md)**: every component, its states,
   and how it is built.
3. **[CAVEATS.md](./CAVEATS.md)**: resolved design decisions and the versioning
   contract (what counts as a breaking change).
4. **[FONTS.md](./FONTS.md)**: the type families and how to load them.

Per-component guides live in [`docs/`](./docs), and each component has a live
card in [`preview/`](./preview), collected in the gallery.

## What's in the repo

```
packages/tokens/     @qball-inc/tokens: colors_and_type.css, components.css, graph.css, theme.css, tokens.json
packages/react/      @qball-inc/react: the React component library
packages/elements/   @qball-inc/elements: framework-free chat, trust and graph components
docs/                per-component and consumer guides
preview/             one live card per component (the gallery's source)
gallery.html         the gallery page (published to GitHub Pages)
assets/              logos and icons
DESIGN.md, COMPONENT-LIBRARY.md, CAVEATS.md, FONTS.md, SKILL.md, llms.txt
```

## Development

This is a pnpm workspace. Run `pnpm install` at the root, then use the `Justfile`
recipes: `just typecheck`, `just lint`, `just test`, `just build`, or `just ci`
for the full local gate. Releases use Changesets; see [RELEASING.md](./RELEASING.md).

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

## Versioning and license

Each package follows semver; current versions are on the npm badges above, and
release notes are in each package's `CHANGELOG.md`. `@qball-inc/elements` is on
0.x until its data contract is final. See [CAVEATS.md](./CAVEATS.md) →
_Versioning_ before changing any token value.

Code is [Apache-2.0](./LICENSE). The Berkeley Mono display font is not covered by
this license and is not distributed here (see above).
