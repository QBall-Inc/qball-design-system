<p align="center">
  <a href="https://qball-inc.github.io/qball-design-system/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-dark.gif">
      <img src="https://raw.githubusercontent.com/QBall-Inc/qball-design-system/main/assets/qball-logo-handoff/qball-logo-parchment.gif" alt="QBall Design System" width="180" height="180">
    </picture>
  </a>
</p>

<h1 align="center">@qball-inc/react</h1>

<p align="center">
  The <b>React component library</b> of the QBall Design System — token-driven<br>
  className wrappers over <a href="https://www.npmjs.com/package/@qball-inc/tokens">@qball-inc/tokens</a>. Accessible by default,<br>
  light and dark from the same tokens. Dual ESM/CJS with TypeScript declarations.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@qball-inc/react"><img src="https://img.shields.io/npm/v/@qball-inc/react?color=3F6B5B&label=npm" alt="npm version"></a>
  <a href="https://github.com/QBall-Inc/qball-design-system/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@qball-inc/react?color=3F6B5B" alt="Apache-2.0 license"></a>
  <a href="https://qball-inc.github.io/qball-design-system/"><img src="https://img.shields.io/badge/gallery-live-3F6B5B" alt="component gallery"></a>
</p>

---

Every component is a **Strategy-2 className wrapper**: it applies the shipped
`@qball-inc/tokens` classes and emits **no CSS of its own**. So the React package is
the behavior and accessibility layer; the visual layer arrives entirely from the
token CSS you import.

## Install

```bash
pnpm add @qball-inc/react @qball-inc/tokens react react-dom
```

The components are built on **Radix UI** primitives, declared as peer dependencies —
pnpm/npm install them alongside automatically (with a strict setup, add any your
bundler reports as missing). Two peers are **optional**, needed only for the one
component that uses them:

| Optional peer           | Needed for                          |
| ----------------------- | ----------------------------------- |
| `@tanstack/react-table` | `DataTable` (its headless core)     |
| `d3`                    | `Candlestick` (the D3 chart island) |

The icon system has **no** runtime icon-pack dependency — the marks are compiled to
our own inline SVGs at build time.

## Wire the token CSS (required)

Because the components emit no CSS, you **must** import the `@qball-inc/tokens` layer
or everything renders unstyled. **Order matters.**

```css
/* app.css */
@import "@qball-inc/tokens/colors-and-type.css"; /* tokens + .btn — REQUIRED, first */
@import "@qball-inc/tokens/components.css"; /* component layer — REQUIRED, second */
```

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

Switch themes with `data-theme="light|dark"` on `<html>`. Full wiring guide
(Tailwind `@theme`, the `--font-display` override, `@source` scanning):
[docs/consumer-setup.md](https://github.com/QBall-Inc/qball-design-system/blob/main/docs/consumer-setup.md).

## What's included

| Family           | Components                                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Primitives**   | `Button` · `Input` · `Field` · `Select` · `Switch` · `Segmented` · `SecretInput` · `Search`                                               |
| **Overlays**     | `Modal` · `AlertModal` · `Toaster`/`toast` · `Callout` · `Skeleton` · `Spinner` · `EmptyStateFig`/`ErrorStateFig`                         |
| **Data display** | `Stat` · `Meter` · `Badge` · `Card` · `Divider` · `Tabs` · `Sparkline` · `Tooltip` · `Avatar`/`AvatarGroup` · `DataTable` · `Candlestick` |
| **App chrome**   | `AppBar` · `UserMenu` · `ThemeToggle` · `Scrim` · `CommandDock` · `NotificationCenter`                                                    |
| **AI / domain**  | `Terminal` · `Composer` · `useStreaming` · `GroundingFlag` · `MarkdownRenderer` · `ToolUseIndicator` · `DigestCard`                       |
| **Backgrounds**  | `GridBg` · `AsciiBg` · `GlyphsBg` (+ the `useCanvas2D` driver) — SSR-safe animated `<canvas>`                                             |
| **Icons**        | `Icon` (dynamic registry) + per-icon named exports (tree-shakeable) + a nominative brand-mark track                                       |
| **Media**        | `MediaSlot` — a pure-React, SSR/static-safe display container (image / gif / video / embed-facade)                                        |

All components are token-driven (no hardcoded color, no box-shadow), pair finance
color with a non-color cue, and honor `prefers-reduced-motion`. Browse every one in
the [live gallery](https://qball-inc.github.io/qball-design-system/).

## Part of the QBall Design System

- **Tokens:** [`@qball-inc/tokens`](https://www.npmjs.com/package/@qball-inc/tokens) — the locked token layer this package paints with.
- **Gallery:** [live component contact-sheet](https://qball-inc.github.io/qball-design-system/) (light + dark).
- **Source + docs:** [QBall-Inc/qball-design-system](https://github.com/QBall-Inc/qball-design-system).

## License

[Apache-2.0](https://github.com/QBall-Inc/qball-design-system/blob/main/LICENSE) ©
QBall Inc. The icon system's brand track ships a small set of **third-party brand
marks** for nominative identification only (e.g. a "Sign in with Google"
affordance) — see [MARKS.md](https://github.com/QBall-Inc/qball-design-system/blob/main/packages/react/MARKS.md).
These remain the trademarks of their respective owners.
