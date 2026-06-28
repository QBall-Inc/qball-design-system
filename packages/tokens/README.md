<p align="center">
  <a href="https://qball-inc.github.io/qball-design-system/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-dark.gif">
      <img src="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-parchment.gif" alt="QBall Design System" width="180" height="180">
    </picture>
  </a>
</p>

<h1 align="center">@qball-inc/tokens</h1>

<p align="center">
  The locked <b>token layer</b> of the QBall Design System — drop-in CSS custom properties,<br>
  component classes, and a DTCG / Style-Dictionary JSON mirror. Zero build step.<br>
  Framework-agnostic. Light and dark from the same source.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@qball-inc/tokens"><img src="https://img.shields.io/npm/v/@qball-inc/tokens?color=3F6B5B&label=npm" alt="npm version"></a>
  <a href="https://github.com/QBall-Inc/qball-design-system/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@qball-inc/tokens?color=3F6B5B" alt="Apache-2.0 license"></a>
  <a href="https://qball-inc.github.io/qball-design-system/"><img src="https://img.shields.io/badge/gallery-live-3F6B5B" alt="component gallery"></a>
</p>

---

## Install

```bash
pnpm add @qball-inc/tokens
```

## Usage

The token layer is **plain CSS** plus a JSON mirror — there is no build step and no
runtime. Import the CSS in your app's style entry. **Order matters:** the component
layer reads `var(--token)` values defined by the layer above it.

```css
/* app.css */

/* REQUIRED — every --token (colors, --data-* finance signals, --font-display,
   radii, spacing) + semantic element styles + the button family (.btn). */
@import "@qball-inc/tokens/colors-and-type.css";

/* REQUIRED — the application component layer (.stat, .num, .badge, .meter,
   .modal, .switch, .field, …). Must come AFTER colors-and-type.css. */
@import "@qball-inc/tokens/components.css";

/* OPTIONAL — Tailwind v4 @theme export: token-named utilities for your own
   markup + the --font-display override seam. */
@import "@qball-inc/tokens/theme.css";
```

Switch themes by setting `data-theme` on the root — light and dark are both
first-class and swap every token:

```html
<html data-theme="dark">
  <!-- … --></html>
```

Consume the tokens as cross-platform data (DTCG / Style-Dictionary shape) from the
package root or the explicit subpath:

```js
import tokens from "@qball-inc/tokens"; // → tokens.json
// or: import tokens from "@qball-inc/tokens/tokens.json";
```

## What's in the package

| Import | File | Delivers | Required? |
| --- | --- | --- | --- |
| `@qball-inc/tokens/colors-and-type.css` | `colors_and_type.css` | Every CSS custom property the components reference + semantic element styles + the `.btn` family. | **Yes** |
| `@qball-inc/tokens/components.css` | `components.css` | The full application component layer (the rest of the class inventory). | **Yes** |
| `@qball-inc/tokens/theme.css` | `theme.css` | Tailwind v4 `@theme` export (token-named utilities + the `--font-display` seam). | Optional |
| `@qball-inc/tokens` · `@qball-inc/tokens/tokens.json` | `tokens.json` | DTCG / Style-Dictionary JSON mirror (cross-platform). | Optional |

Importing **only `colors-and-type.css` then `components.css`** (in that order) paints
the entire component inventory. Omitting either leaves components unstyled — a silent
miss, not an error. Full wiring guide:
[docs/consumer-setup.md](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/consumer-setup.md).

## Display font

This package ships with **Fira Code** as the default display face. The system's
intended display face is **Berkeley Mono**, a commercial typeface that is **not**
redistributed here, so nothing licensed reaches the published package. To restore
Berkeley Mono in a private build, see the
[repository README](https://github.com/QBall-Inc/qball-design-system#display-font).

## Part of the QBall Design System

- **Components:** [`@qball-inc/react`](https://www.npmjs.com/package/@qball-inc/react) — the token-driven React component library.
- **Gallery:** [live component contact-sheet](https://qball-inc.github.io/qball-design-system/) (light + dark).
- **Source + docs:** [QBall-Inc/qball-design-system](https://github.com/QBall-Inc/qball-design-system).

## License

[Apache-2.0](https://github.com/QBall-Inc/qball-design-system/blob/main/LICENSE) ©
QBall Inc. (The Apache-2.0 license covers this package's code; it is distinct from the
Berkeley Mono font license, which is not granted here.)
