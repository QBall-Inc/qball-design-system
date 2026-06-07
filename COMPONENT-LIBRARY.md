# COMPONENT-LIBRARY.md — building the system into a real component library

**Audience:** Claude (directed by the owner), turning this design system into a reusable React
component library and consuming it across projects (Stocky first, more later).
**Goal:** every project builds the *same button, the same switch, the same modal* — no per-project
drift. This doc is the contract that guarantees that.

**Companions:** `DESIGN.md` (design truth + tokens), `components.css` (the canonical CSS layer — every
class referenced below exists there), `reference/COMPONENTS-usage.md` (the CSS-class usage guide with
each class's states), `reference/component-audit.md` (the original build/extend/create verdicts),
`preview/*.html` + `gallery.html` (live state matrices), `tokens/theme.css` + `tokens.json`.

---

## 0. Target stack & conventions

- **Vite + React 18 + TypeScript**, **shadcn/ui + Radix primitives + Tailwind CSS** (components copied
  into the repo — favor shadcn/Radix patterns), **TanStack Router/Query** + **Zustand** for state,
  **D3.js** for the candlestick (and inline SVG sparklines). This is the stack Stocky targets; keep the
  library framework-agnostic at the token layer so other projects can reuse it.
- **Wire tokens first:** `@import "tailwindcss"; @import "./tokens/theme.css"; @import
  "./colors_and_type.css";` — the last brings the `@font-face` + semantic element styles (h1–h4, p,
  blockquote, code, a, `.num`). Then build components with Tailwind utilities mapped to the theme
  (`bg-surface`, `text-signal`, `border-strong`, `font-display`, `rounded-md`, `text-up`…).
- **Two valid strategies — pick per component, don't mix within one:**
  1. **shadcn/Radix + Tailwind** (preferred for anything interactive/accessible) — take the shadcn
     component, restyle to tokens, match the prototype's states.
  2. **Port the CSS class as-is** (good for purely presentational atoms — `.stat`, `.digest`,
     `.sparkline`, `.term`) — wrap the existing `components.css` class in a thin React component.
- **Every interactive/data component must implement the full state set:** `default, hover, focus,
  disabled, loading, empty, error` (where applicable). The prototype already demonstrates each — see
  the matching `preview/*.html`.
- **Theme:** `data-theme="light|dark"` on `<html>`; tokens swap automatically. Theme state is global
  client state (Zustand), never per-surface.
- **Accessibility floor:** visible focus (sage ring), 44px min hit targets on touch, color never the
  sole signal (finance states pair with arrow/sign/label), reduced-motion honored on every loop.

---

## 1. Forms & controls

| Component | Build with | From | States / notes |
|---|---|---|---|
| **Button** | shadcn **Button** restyled | `.btn` + `--primary/--secondary/--tertiary/--ghost/--destructive/--icon/--loading` | primary = sage fill, text = `--bg-primary`; secondary/tertiary = sage/amber outline; ghost = transparent→surface; destructive = `--color-error`; press = `translateY(1px)` (no color flash); `--loading` hides label, shows the one sanctioned spinner; disabled = 0.4 opacity, no pointer. **As-`<a>`:** add the link-hover override so it doesn't inherit the editorial amber-underline. |
| **Text input** | shadcn **Input** + **Label** | `.field` / `.input` | focus (sage ring), error (`.input--error` + `.field__error` text), disabled, numeric variant. Field wrapper = label + control + help + error; drives 400/422 display. |
| **Secret / masked input** | Input `type=password` + reveal toggle | `preview/secret-input.html` | mask + show/hide; set / rotate / remove affordances; never echo the secret beyond the field. (BYO-key entry.) |
| **Select** | Radix **Select** | `.select` / `.menu` | chevron affix; custom open panel; keyboard nav. |
| **Switch / toggle** | Radix **Switch** restyled | `.switch` | **squared (4px), NOT a pill** — this is a brand non-negotiable. |
| **Segmented control** | Radix **ToggleGroup** (single) | `.segmented` | 2–3 short options; the brand's radio-group substitute. |
| **Search / autocomplete** | Command/Combobox (cmdk) or custom | `.search-pop` / `.sresult` | idle / typing / results / no-results; type-ahead. |

## 2. Layout, navigation & app chrome

| Component | Build with | From | Notes |
|---|---|---|---|
| **App bar** | custom shell component | `.appbar` + `.appnav` + `.iconbtn` + `.badge-count` + `.usermenu` | brand · nav · bell(+count) · theme toggle · user menu. **Application** surfaces may fix it and **hide-on-scroll**; editorial surfaces do not fix nav (see DESIGN.md → Layout). |
| **Command dock** | custom + Radix **Popover** | `.dock` + `.dock-pop` | the floating action island (e.g. search · primary action · AI). Translucent + blurred, hides on scroll. Two documented directions exist: **Traditional** (everything in the bar) vs **Island** (dock) — pick per app. |
| **User menu / dropdown** | Radix **DropdownMenu** | `.dropdown` | |
| **Notification center** | Radix **Popover** + list | `.notif` | distinct visual treatment per source type; mark-read; unread count drives the bell badge. |
| **Theme toggle** | custom button | `.theme-toggle` | single-click sun/moon; **global** (lives in chrome, never per-surface); cross-fade. |
| **Scrim** | custom overlay | `.app-scrim` | blur+dim behind any open popover/modal; owns scroll-lock. |
| **Card / surface** | styled `div` | `.card` | 0.5px border, `md` radius, `surface` bg; linked cards get a sage border + 0.95 body on hover; add a `selected` state where needed. |
| **Tabs / breadcrumb / divider** | Radix **Tabs** / custom / `<hr>` | `.rule` | tabs often replaced by `.segmented`; divider = `hr`/`.rule`. |

## 3. Data display & charts

| Component | Build with | From | Notes |
|---|---|---|---|
| **Data table** | TanStack Table + styled rows | `.dt` | compact rows, tabular numerics, row hover/selected/actions, semantic finance colors; skeleton/empty/error; mobile → card list. |
| **Stat / metric tile** | styled component | `.stat` / `.ministat` | up/down/flat; **null renders "—", never "0".** |
| **Meter** | styled component | `.meter` | usage/progress, `--warn`/`--over`. |
| **Badge** | styled span | `.badge` (`--up/--down/--warn/--info/--signal/--highlight`) | semantic + finance variants. |
| **Sparkline** | **inline SVG** component | `.sparkline` (`sparkPath` logic) | up/down/flat color; **no chart lib.** |
| **Candlestick** | **D3.js** in a React island | `preview/chart-candlestick-*.html`, `drawChart` | crosshair + OHLC tooltip + range toggles; traditional green/red from `--data-up/--data-down`; compact card view vs interactive detail view. Run D3 in `useEffect` keyed on `[data, range, theme]`; clean up on re-run. **Not Recharts** — even if a stack note says otherwise. |
| **Tooltip** | Radix **Tooltip** *or* the portal approach | `.tip` | must escape transformed ancestors — see the grounding tooltip note in §5. |
| **Avatar** | styled component | `.avatar` | initials/image, sizes, tone, status dot, group. |

## 4. Overlays, feedback & states

| Component | Build with | From | Notes |
|---|---|---|---|
| **Modal / dialog** | Radix **Dialog** + **AlertDialog** | `.modal` + `.modal-overlay` | **no shadow** — lift via `border-strong` + scrim; scroll-lock + focus-trap. Confirm-delete = AlertDialog. |
| **Toast** | **Sonner** or Radix **Toast** | `.toast` | top-center, semantic left-accent + icon, auto-dismiss + manual close, stacks. |
| **Callout / banner** | styled component | `.callout` (info/warn/error/neutral) | hosts disclaimers + degraded-data/outage messages. |
| **Skeleton** | styled component | `.skel` | per-shape; preferred over spinners for content; honor reduced-motion. |
| **Spinner** | styled component | `.spinner` | sizes + button-loading variant. |
| **Empty / error state** | styled component | `.state-fig` (+ `--error`) | icon + headline + CTA; error variant carries retry; isolate per section so one failure doesn't blank the page. |
| **Inline validation** | within field | `.field__error` / `.input--error` | drives 400/422. |

## 5. AI conversation & grounding (domain)

| Component | Build with | From | Notes |
|---|---|---|---|
| **Conversation surface** | custom React island | `.term` | the canonical terminal transcript: `you ›` / `stocky ›` personas, line separators, **streaming cursor**, growable + scrolling body, fluid width, persistent AI disclaimer. A deliberate choice over generic chat bubbles. |
| **Composer** | textarea + send | `.term__composer` | disabled → a "add your key" prompt when no provider key is set (BYO gate). |
| **Streaming** | consume SSE | `.term__thinking` + cursor | render token-by-token from a `message_delta`-style stream; map provider error states to retryable error frames. |
| **Markdown renderer** | add one (e.g. react-markdown) | prose element styles | the system's h/p/code/pre/quote/a styles map directly; **the library lacks a scoped renderer — add one** for streamed assistant text. (Only real `Partial`.) |
| **Grounding wave-flag** | custom inline span + portal | `.ground-wave--source` / `--unverified`, `.gwrap` + `.gtip` | `[source]` (slate) / `[unverified]` (amber) shimmer over the glyphs; hover explainer tooltip **portaled to `<body>`** + viewport-clamped so transformed ancestors (dock/modal) don't clip it. Honor reduced-motion (static fill fallback). **Critical for AI+data — never let a number blend in.** |
| **Mascot** | inline SVG component | `.stocky-icon` | the CRT-bot (antenna, blinking eyes, scanline); inherits `currentColor`; reduced-motion stops the loop. (App-specific; generalize or omit per project.) |

## 6. Briefings (domain)

| Component | Build with | From | Notes |
|---|---|---|---|
| **Digest / briefing card** | styled component | `.digest` (`--unread`/`--read`, loading, empty) | unread = sage accent + dot; narrated numbers may carry inline grounding flags. The Stocky app extends this with a hero variant, a horizontal tile-scroller, and a dwell-to-read "breathe" — generalize only if a project needs them. |

---

## 7. Suggested library structure

```
@aksys/tokens     → theme.css + tokens.json + colors_and_type.css + fonts/   (no React; reusable everywhere)
@aksys/react      → the components above (depends on @aksys/tokens + Radix)
  primitives/     Button Input Select Switch Segmented Field Search ...
  data/           DataTable Stat Meter Badge Sparkline Candlestick Tooltip Avatar
  overlay/        Modal Toast Callout Skeleton Spinner StateFig
  chrome/         AppBar CommandDock NotificationCenter UserMenu ThemeToggle Scrim
  ai/             Terminal Composer GroundingFlag (+ MarkdownRenderer)
  briefings/      DigestCard
```

Each component ships with: the React component, a Storybook/preview story mirroring its
`preview/*.html` state matrix, and a token-only style (no hard-coded colors). Verify every build
against the matching `preview/*.html` and the `gallery.html` contact sheet.

## 8. Build order

1. `@aksys/tokens` — wire `theme.css`, port `@font-face` (Berkeley Mono self-hosted, others via
   `@fontsource`), confirm light/dark flips on `data-theme`.
2. Primitives (Button → Input/Field → Select → Switch → Segmented → Search). Verify against previews.
3. Overlays (Modal/AlertDialog → Toast → Callout → Skeleton/Spinner → StateFig).
4. Data (DataTable → Stat/Meter/Badge → Sparkline → **Candlestick (D3)** → Tooltip/Avatar).
5. Chrome (AppBar + CommandDock + NotificationCenter + UserMenu + ThemeToggle + Scrim) — build **once**,
   reuse across every route/app.
6. AI/domain (Terminal + Composer + GroundingFlag + MarkdownRenderer; DigestCard).
7. QA each against `gallery.html` and the DESIGN.md Do's/Don'ts (no shadows, no pills, sage-leads-amber,
   finance-color-plus-cue, reduced-motion).

## 9. Gaps to close in code (from the audit)

- **Markdown renderer** — add a scoped one for assistant text (prose styles exist; the component doesn't).
- **Tool-use / skill indicator** — P1, not yet designed; design it before building if a project needs it.
- **Berkeley Mono Regular (standard width)** — only if a project opts into the wider face (CAVEATS #1).

Everything else the audit flagged as `No`/`Partial` has since been built into `components.css` — treat
that file + the previews as the source of truth, not the original audit's verdict column.
