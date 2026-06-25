# Fonts

Five families. The two that carry the brand (Berkeley Mono, Fira Code) are monospace; Syne is the
body sans; Instrument Serif is the lone serif (pull quotes only); JetBrains Mono is a distinct code
register. **The stack is locked — no substitutions on type.**

| Role | Family | Weights used | Hosting |
|---|---|---|---|
| Display (H1–H2, tickers, prices, all numerics) | **Berkeley Mono SemiCondensed** | 100–800 + obliques | **self-hosted** (`fonts/`, license-restricted) |
| Sub-display + UI (H3–H4, nav, buttons, captions, metadata) | **Fira Code** | 400/500/600/700 | `@fontsource/fira-code` |
| Body (long-form copy) | **Syne** | 400/500/700/800 | `@fontsource/syne` |
| Pull quotes (italic) | **Instrument Serif** | 400 + italic | `@fontsource/instrument-serif` |
| Code blocks | **JetBrains Mono** | 400/500 | `@fontsource/jetbrains-mono` |

## Berkeley Mono — the one that needs care

- **Self-hosted and license-restricted.** The 18 woff2 files in `fonts/` are the **SemiCondensed**
  width axis (100–800 + matching obliques). They are wired into `packages/tokens/colors_and_type.css` via `@font-face`
  (weights 100/200/300/350/400/500/600/700/800). **Embed per-app; do not redistribute publicly.**
- **Width = SemiCondensed (current, locked).** This is narrower than the standard-width family the
  original brand spec referenced. Consequence: at the same character count, lines are shorter and the
  tight H1 tracking (−2px) reads even tighter. We design against SemiCondensed as-is.
- **Regular (standard) width is a documented future seam.** If a project needs the wider face, the
  Regular woff2 files get uploaded and added as a parallel `@font-face` family (e.g. `"Berkeley Mono
  Std"`) — *added*, not swapped. Until then, SemiCondensed is the only width. (See `CAVEATS.md` #1.)
- **No Regular-400 standard-width file exists yet**; the 400 slot is filled by
  `BerkeleyMono-SemiCondensed.woff2` (the base-name roman). Correct for SemiCondensed; revisit only if
  the standard width is introduced.

## In a real (Vite + React) app

```ts
// main.tsx — load the npm-hosted families
import "@fontsource/fira-code/400.css";
import "@fontsource/fira-code/500.css";
import "@fontsource/fira-code/600.css";
import "@fontsource/fira-code/700.css";
import "@fontsource/syne/400.css";
import "@fontsource/syne/500.css";
import "@fontsource/syne/700.css";
import "@fontsource/syne/800.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
// Berkeley Mono: copy fonts/ into the app and import packages/tokens/colors_and_type.css (carries the @font-face),
// OR re-declare the @font-face block pointing at your asset path. Keep font-display: swap.
```

Do **not** rely on the Google Fonts CDN in production — use `@fontsource/*`. The prototype/preview
cards use the CDN only for convenience.
