# Font override — restoring Berkeley Mono via `--font-display`

The design system's intended **display** face (H1–H2, tickers, prices, all numerics —
e.g. `.stat__value`, `.num`) is **Berkeley Mono**, a commercial typeface from
[U.S. Graphics Company](https://usgraphics.com/typefaces/berkeley-mono). It is **not**
redistributed in the published packages.

> **Zero binaries.** `@qball-inc/tokens` ships **no font files** of any kind — only the
> `--font-display` token with a **Fira Code fallback value** and the cascade _seam_ to
> override it. If you hold a Berkeley Mono license, restoring it is a one-variable CSS
> override plus serving your own woff2.

## What the package ships

`--font-display` is defined in both `theme.css` and `colors-and-type.css` as the Fira
Code fallback stack:

```css
--font-display: "Fira Code", "SF Mono", "Cascadia Code", monospace;
```

Out of the box, every display/numeric element renders in Fira Code. Nothing licensed is
published, and the package tree contains zero `woff2/woff/ttf/otf/eot` files.

## Restore Berkeley Mono (two steps)

You need a valid Berkeley Mono license (a Website License Grant + Web Fonts module to
serve it as a web font). Then:

### 1. Serve the font yourself (`@font-face`)

Place your licensed `.woff2` files in your app and declare an `@font-face` — the package
ships neither the binary nor this rule:

```css
/* your-app/fonts.css — your licensed assets, served by your app under your license */
@font-face {
  font-family: "Berkeley Mono";
  src: url("/fonts/BerkeleyMono.woff2") format("woff2");
  font-weight: 100 800;
  font-display: swap;
}
```

### 2. Override the single token

After the `@qball-inc/tokens` imports (see
[consumer-setup.md](./consumer-setup.md)), override `--font-display` so the family is
requested first, with Fira Code kept as the fallback:

```css
:root {
  --font-display: "Berkeley Mono", "Fira Code", "SF Mono", monospace;
}
```

That is the **only** change. Every element that reads `var(--font-display)` —
`.stat__value`, `.stat__unit`, `.input.num`, `.dt .num`, display headings — now renders
in Berkeley Mono, cascade-only. No component, token, or package edit is required.

> Keep `"Fira Code"` (or at least `monospace`) in the stack as a graceful fallback while
> the woff2 loads or if the license is absent in some environment.

## Revert to Fira Code

Remove the `--font-display` override (and, if you added it, the `@font-face`). With no
override present, the token falls back to its shipped Fira Code value — the default
state. There is nothing to uninstall.

## Licensing

Serving Berkeley Mono is **your** responsibility under **your** license from U.S.
Graphics Company. Do not commit the woff2 files to a public repository or redistribute
them. The QBall packages stay binary-free precisely so that nothing licensed is
published downstream — keep it that way in your own public surfaces.
