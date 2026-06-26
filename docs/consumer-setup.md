# Consumer setup — wiring `@qball-inc/tokens` + `@qball-inc/react`

How a downstream app wires the QBall Design System. The whole visual layer is
**plain CSS custom properties + component classes** — every React component is a
Strategy-2 className wrapper that emits **no** CSS of its own, so styling arrives
entirely from the token CSS you import here.

## Install

```bash
pnpm add @qball-inc/tokens @qball-inc/react
```

> `@qball-inc/tokens` is published (early-access `0.x`); `@qball-inc/react` ships at
> `1.0.0`. Until then you can consume the token CSS directly from `@qball-inc/tokens`.

## The import sequence (order matters)

Put this in your app's CSS entry (e.g. the file your `main.tsx` imports, or your
Tailwind v4 entry). **Do not reorder** — the cascade depends on it.

```css
/* app.css — the canonical @qball-inc wiring */

/* 1. Tailwind base/reset + utility engine (OPTIONAL — see "Required vs optional"). */
@import "tailwindcss";

/* 2. Token @theme export — exposes the design tokens as Tailwind theme values and
      carries the --font-display seam (OPTIONAL — utility surface + font override). */
@import "@qball-inc/tokens/theme.css";

/* 3. Tokens + semantic element styles + the button family .btn (REQUIRED —
      defines every --token the component layer references, incl.
      --data-up/down/flat and --font-display). */
@import "@qball-inc/tokens/colors-and-type.css";

/* 4. The application component layer (REQUIRED — .stat, .stat__delta, .num,
      .badge, .meter, .modal, .switch, .field … the rest of the inventory). */
@import "@qball-inc/tokens/components.css";

/* 5. Opt the installed component dist into Tailwind's content scan (OPTIONAL —
      a forward-safety belt; the Strategy-2 wrappers emit no utilities today).
      @source MUST follow the @import block (CSS requires imports first). */
@source "@qball-inc/react/dist";
```

Then render components — their classes are already styled by the imports above:

```tsx
// main.tsx
import "./app.css";
import { Button, Stat } from "@qball-inc/react";

export function App() {
  return (
    <main>
      <Button variant="primary">Add to watchlist</Button>
      <Stat label="AAPL" value="184.30" unit="USD" direction="up" delta="+8.4%" />
    </main>
  );
}
```

## What each layer delivers

| #   | Import                                  | Delivers                                                                                                                                                                          | Required?    |
| --- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | `tailwindcss`                           | The single Tailwind base/reset + the utility engine for **your own** markup.                                                                                                      | Optional     |
| 2   | `@qball-inc/tokens/theme.css`           | The `@theme` token export (token-named Tailwind utilities) + the `--font-display` override seam.                                                                                  | Optional     |
| 3   | `@qball-inc/tokens/colors-and-type.css` | Every CSS custom property the components reference (colors, `--data-*` finance signals, `--font-display`, radii, spacing) + semantic element styles + the button family (`.btn`). | **Required** |
| 4   | `@qball-inc/tokens/components.css`      | The application component layer (`.stat`, `.stat__delta`, `.num`, `.modal`, `.switch`, `.badge`, `.meter`, `.field`, …).                                                          | **Required** |
| 5   | `@source "@qball-inc/react/dist"`       | Opts the installed component dist into Tailwind's scan (inert today; forward-safety).                                                                                             | Optional     |

## Required vs optional

- **Minimum to style every component:** imports **3 + 4** (`colors-and-type.css`
  then `components.css`, in that order). These two alone paint the entire inventory.
  Omitting either leaves components **unstyled** — a silent failure, not an error.
- **The optional trio (1, 2, 5)** is the _consumer-app-utility surface_: it gives
  **your own** markup token-named Tailwind utilities (e.g. `bg-surface`) and enables
  the `--font-display` font override (see [font-override.md](./font-override.md)).
  It does **not** style the components — they are styled by 3 + 4.

## Why order matters

CSS cascades top-to-bottom. `colors-and-type.css` must come **before** `components.css`
so the `--token` values exist when the component rules read them via `var()`. The
Strategy-2 atoms (`.btn` in `colors-and-type.css`; `.stat__delta`, `.num`, … in
`components.css`) are real CSS rules, not generated utilities — they need their tokens
defined first, and they are **not** subject to Tailwind purging.

## Theme switching

Set `data-theme="light|dark"` on `<html>` (or any ancestor) — the tokens swap; light
and dark are both first-class. `colors-and-type.css` also honors
`prefers-color-scheme` when no explicit `data-theme` is set.

## Fonts

The free families (Fira Code, Syne, Instrument Serif, JetBrains Mono) load from
`@fontsource/*` — see [FONTS.md](../FONTS.md). The display face defaults to **Fira
Code**; to restore the brand's **Berkeley Mono** display font, see
[font-override.md](./font-override.md).

## Local two-repo development

Developing the design system and a consumer app side-by-side? See
[dual-repo-dev.md](./dual-repo-dev.md) for the `pnpm.overrides` `link:` workflow.
