# Consumer hand-back packet — `@qball-inc/react` @ 1.0.0

Everything a downstream app needs to adopt the design system in one place. Companion docs are
linked inline; this page is the index.

---

## 1. Install

```sh
# the two published packages
npm install @qball-inc/react @qball-inc/tokens

# required peers (react + the 8 Radix primitives the components are built on)
npm install react react-dom \
  @radix-ui/react-alert-dialog @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-popover @radix-ui/react-select @radix-ui/react-slot \
  @radix-ui/react-tabs @radix-ui/react-tooltip
```

### Peer dependencies (authoritative — from `@qball-inc/react/package.json`)

**Required:**

| Peer | Range | Used by |
|---|---|---|
| `react` | `>=18` | all |
| `react-dom` | `>=18` | all |
| `@radix-ui/react-alert-dialog` | `>=1.1.0` | `Modal` |
| `@radix-ui/react-dialog` | `>=1.1.0` | `Modal` |
| `@radix-ui/react-dropdown-menu` | `>=2.0.0` | `UserMenu` |
| `@radix-ui/react-popover` | `>=1.1.0` | `CommandDock`, `NotificationCenter` |
| `@radix-ui/react-select` | `>=2.0.0` | `Select` |
| `@radix-ui/react-slot` | `>=1.1.0` | `Button` (`asChild`) |
| `@radix-ui/react-tabs` | `>=1.1.0` | `Tabs` |
| `@radix-ui/react-tooltip` | `>=1.1.0` | `Tooltip`, `GroundingFlag` |

**Optional** (install only if you use the component; marked `optional` in
`peerDependenciesMeta`, so a missing one does not warn):

| Peer | Range | Needed for |
|---|---|---|
| `@tanstack/react-table` | `>=8` | `DataTable` |
| `d3` | `>=7` | `Candlestick` |
| `lucide-react` | `>=0.400.0` | supplementary icons |

> There are **eight** required `@radix-ui/*` peers (not seven). Under-installing them breaks
> the corresponding component at runtime, not at build time.

## 2. CSS import recipe

The full ordered recipe (and the non-Tailwind path) lives in
**[`docs/consumer-setup.md`](./consumer-setup.md)**. The short version:

- **Tailwind v4 app:** `@import "tailwindcss"; @import "@qball-inc/tokens/theme.css"; @import "@qball-inc/tokens/colors-and-type.css"; @import "@qball-inc/tokens/components.css";`
- **No Tailwind:** `@import "@qball-inc/tokens/colors-and-type.css"; @import "@qball-inc/tokens/components.css";` — these two alone paint the entire component inventory. `theme.css` is **Tailwind-v4-only** and not required.

## 3. Frozen token surface

The complete set of 1.0.0-stable consumer-facing custom properties (with light/dark values and
the four pinned names) is catalogued in **[`docs/frozen-tokens.md`](./frozen-tokens.md)**.
Removing/renaming a token or changing a `--font-display` fallback value is a major bump.

## 4. Theme mechanism

- Theme is a single attribute: **`data-theme="light" | "dark"` on `<html>`**. Tokens swap
  automatically; no React context/provider, no per-component prop.
- With no attribute set, the system follows `@media (prefers-color-scheme: dark)` and otherwise
  renders light.
- Server-render with `data-theme` already on `<html>` and every static/island component themes
  correctly before any JS runs.
- `<ThemeToggle />` is the only piece needed to *flip* it at runtime (it reads + writes that one
  attribute in a click handler). It is **not** required for theming to work.

## 5. SSR / static-safety + per-component island matrix

Full audit + the Tier A (fully static) / Tier B (static render, island for interactivity) /
Tier C (island-to-display: canvas + D3) classification is in
**[`docs/ssr-static-safety.md`](./ssr-static-safety.md)**.

**Guarantee:** no component reads a browser global at module-eval or render — nothing throws
during SSR. Tier A drops in anywhere; Tier B SSRs a correct initial DOM and needs `client:*`
for interaction; Tier C (`AsciiBg`/`GlyphsBg`/`GridBg`/`Candlestick`) needs `client:*` to paint.

## 6. Font override (Berkeley Mono)

`--font-display` ships as Fira Code. To restore the licensed Berkeley Mono face in your own app
(without redistributing the binaries), follow **[`docs/font-override.md`](./font-override.md)**.
