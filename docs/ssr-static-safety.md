# SSR / static-safety audit — `@qball-inc/react` @ 1.0.0

**Question this answers (consumer P0):** can every shipped component be rendered in a
server / static-generation context (Astro, Next RSC/SSR, `renderToString`) without
throwing, and which ones need a client island (`client:*`) to be functional or to display
correctly?

**Headline guarantee — audited, whole library:**

> **No shipped component reads a browser global (`window`, `document`, `matchMedia`,
> `getComputedStyle`, `customElements`, `navigator`, `localStorage`, `ResizeObserver`,
> `requestAnimationFrame`) during module evaluation or render.** Every such access lives
> inside a `useEffect`, an event handler, or a per-frame `<canvas>` draw closure — code
> that never runs on the server. Nothing throws during SSR.

So the only thing the matrix below distinguishes is whether a component **needs hydration
to be correct**, not whether it is *safe* to render — all of them are.

---

## How this was verified

Every `.ts`/`.tsx` under `packages/react/src` (excluding tests) was swept for browser-global
access, then each hit was classified by *where* it executes:

| Access site | Examples | SSR? |
|---|---|---|
| Module top-level | `const x = window.x` | ❌ would run on server — **none found** |
| Render body / `useState`/`useMemo`/`useRef` initializer | `useState(() => document…)` | ❌ runs during render — **none found** |
| `useEffect` / `useLayoutEffect` body | scroll listeners, scroll-lock, `ResizeObserver` | ✅ client-only |
| Event handler | click, change | ✅ client-only |
| `<canvas>` per-frame draw closure | `getComputedStyle` token reads | ✅ client-only (inside the rAF loop) |

The first two rows — the only ones that would execute on the server — returned **zero**
matches across the source tree. Evidence per hotspot:

- **`ThemeToggle`** — `document.documentElement` is touched only inside `handleClick`
  (read + `setAttribute`); `readTheme()` is never called at render. (`chrome/ThemeToggle.tsx:45-46`)
- **`Scrim`** — `document.body.style.overflow` is set/restored inside `useEffect`, and the
  `if (!open) return null` early-return sits *after* the effect. (`chrome/Scrim.tsx:30-39`)
- **`AppBar` / `CommandDock`** — `scrollContainer ?? window` + `addEventListener("scroll", …)`
  live inside `useEffect` with matching cleanup. (`chrome/AppBar.tsx:105-119`, `chrome/CommandDock.tsx:141-160`)
- **`useCanvas2D`** (drives all three backgrounds) — `window.matchMedia`,
  `window.devicePixelRatio`, `ResizeObserver`, `requestAnimationFrame` are **all** inside the
  effect, which early-returns when there is no canvas/2D context (server, jsdom). (`primitives/backgrounds/useCanvas2D.ts:53-110`)
- **`backgrounds/tokens.ts`** — `getComputedStyle(document.documentElement)` is reached only
  from the per-frame draw callbacks of `AsciiBg`/`GlyphsBg`/`GridBg`, i.e. inside the rAF loop
  inside the effect — never at render. (`primitives/backgrounds/tokens.ts:31`)
- **`Candlestick`** — `ResizeObserver` and the D3 draw are each inside a `useEffect`; the
  render body reads only props/state. (`data/Candlestick.tsx:182, 198`)
- **`MediaSlot`** — `window.matchMedia` is explicitly SSR/jsdom-guarded
  (`typeof window === "undefined" || typeof window.matchMedia !== "function"`) inside its
  effect. (`media/MediaSlot.tsx:172-174`)

**No source changes were required** — the library was already render-safe by construction.
(GroundingFlag / MarkdownRenderer / ToolUseIndicator only *mention* `matchMedia` in JSDoc to
document that they deliberately have none.)

---

## Per-component matrix

Three tiers. **Tier A** and **Tier B** both emit complete, correct static HTML on the server;
they differ only in whether interactivity needs a client island. **Tier C** renders an inert
container on the server and paints after hydration.

### Tier A — fully static (no `client:*` needed)

Pure display / markup styled entirely by shipped CSS. Native interactivity (links, form
inputs) works without JS.

| Component(s) | Notes |
|---|---|
| `Button` | `asChild` uses `@radix-ui/react-slot` (a render helper, SSR-safe). |
| `Field`, `Input`, `SecretInput`, `Switch` | Native inputs render statically and toggle uncontrolled with no JS (the `Switch` is a CSS-driven `<input type="checkbox">`, **not** Radix); the secret reveal toggle and any React-controlled state are progressive enhancement. |
| `Badge`, `Card`, `Divider`, `Meter`, `Stat`, `Avatar` | Presentational. |
| `Sparkline` | Pure inline SVG (no canvas, no effect). |
| `Skeleton`, `Spinner`, `Callout`, `StateFig`, `Toast` | Presentational; CSS-only animation. |
| `DigestCard`, `Surface` | Presentational. |
| `Icon`, `IconBase`, all `icons/generated/*` | Pure inline SVG. |
| `MarkdownRenderer`, `Terminal`, `ToolUseIndicator` | Render markup/CSS shimmer; no globals. |
| `GroundingFlag` | The flag renders statically; its Radix tooltip is a hover enhancement that needs hydration. |
| `MediaSlot` | DISPLAY-first facade renders server-side (poster/embed-facade); `matchMedia` is guarded. |

### Tier B — static render, interactivity needs `client:*`

SSR a correct initial DOM (default tab, closed menu, idle control); a client island is
required for the interaction.

| Component(s) | Interactivity that needs hydration |
|---|---|
| `Select` (Radix Select) | open/keyboard panel |
| `Segmented` (native `<button aria-pressed>`, stateful) | selection |
| `Search` | type-ahead / results popover |
| `Tabs` (Radix Tabs) | tab switching (default panel renders) |
| `Tooltip` (Radix Tooltip) | hover/focus content (trigger renders) |
| `Modal` (Radix Dialog/AlertDialog) | open/close (trigger renders) |
| `Composer` | submit / input state |
| `AppBar` | hide-on-scroll |
| `CommandDock` (Radix Popover) | hide-on-scroll + popover |
| `NotificationCenter` (Radix Popover) | popover open (bell + count render) |
| `UserMenu` (Radix DropdownMenu) | menu open (trigger renders) |
| `ThemeToggle` | the theme flip itself |
| `Scrim` | scroll-lock effect (backdrop renders) |
| `DataTable` (@tanstack/react-table) | sort / interaction (rows render) |

### Tier C — needs `client:*` to display at all

`<canvas>` / D3 paint nothing on the server; they render an inert element that fills after
hydration. Use `client:visible` (decorative) or `client:load`.

| Component(s) | Why |
|---|---|
| `AsciiBg`, `GlyphsBg`, `GridBg` | Animated `<canvas>`; paints inside the effect's rAF loop. |
| `Candlestick` | D3 draws into the SVG inside a `useEffect`. |

---

## Consumer guidance (Astro islands)

- **Tier A** → drop in anywhere, including static `.astro`/MDX, with no directive.
- **Tier B** → render statically for first paint; add `client:load` (or `client:visible`)
  on the island wrapper when you need the interaction.
- **Tier C** → always wrap in a client island; `client:visible` is ideal for decorative
  backgrounds.
- **Theme** is global and JS-free at the token layer: it is driven entirely by
  `data-theme="light|dark"` on `<html>` (see [consumer-setup.md](./consumer-setup.md#theme-switching)).
  Server-render with the attribute already set and every Tier A/B component themes correctly
  before any JS runs. `ThemeToggle` is only needed to *flip* it at runtime.

## Durability note

This guarantee is currently upheld by construction + this audit, not by an automated gate. A
follow-up lint rule (forbidding `window`/`document`/`getComputedStyle` outside effects/handlers
in `packages/react/src`) would make it regression-proof — tracked as a post-1.0 hardening item.
