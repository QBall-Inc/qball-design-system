# Frozen token reference — `@qball-inc/tokens` @ 1.0.0

The consumer-facing CSS custom properties that ship in `@qball-inc/tokens` and are **stable
for the 1.0.0 line**. These are defined on `:root` in `colors-and-type.css` and re-themed for
dark under `[data-theme="dark"]` (and `@media (prefers-color-scheme: dark)`). Component CSS
(`components.css`) consumes *only* these names — so this table is the complete surface a
consumer may safely read, override, or map into Tailwind `@theme`.

**Stability contract:** removing or renaming any token below, or changing a `--font-display`
fallback *value*, is a **major** version bump (see the semver contract in the release notes).
Adding new tokens is minor. Changing a `$description`/comment is exempt.

Source of truth: [`packages/tokens/colors_and_type.css`](../packages/tokens/colors_and_type.css).
The four names the personalsite consumer pins (asserted via computed-style) are marked **📌
pinned** — these are guaranteed never to move in 1.x: `--color-signal`, `--color-highlight`,
`--text-primary`, `--text-muted`.

---

## Typography

### Font families
| Token | Light / default value |
|---|---|
| `--font-display` | `'Fira Code', 'SF Mono', 'Cascadia Code', monospace` |
| `--font-heading` | `'Fira Code', 'SF Mono', 'Cascadia Code', monospace` |
| `--font-body` | `'Syne', 'Inter', system-ui, sans-serif` |
| `--font-quote` | `'Instrument Serif', 'Georgia', serif` |
| `--font-code` | `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace` |
| `--font-ui` | `'Fira Code', 'SF Mono', monospace` |

> `--font-display` ships as Fira Code in this public package; the intended Berkeley Mono is a
> licensed face you can swap in via override (see [font-override.md](./font-override.md)).

### Type sizes
`--size-h1` 56px · `--size-h2` 36px · `--size-h3` 24px · `--size-h4` 18px ·
`--size-body` 16px · `--size-quote` 20px · `--size-code` 14px · `--size-caption` 12px ·
`--size-tag` 11px · `--size-button` 13px

## Color (theme-aware: light → dark)

### Surfaces & text
| Token | Light | Dark |
|---|---|---|
| `--bg-primary` | `#F7F3EE` | `#1E1D1B` |
| `--bg-surface` | `#EDE8E1` | `#2A2826` |
| `--text-primary` 📌 | `#141414` | `#E7E0D6` |
| `--text-secondary` | `#57534E` | `#A8A29E` |
| `--text-muted` 📌 | `#78716C` | `#78716C` |

### Brand signal & status
| Token | Light | Dark |
|---|---|---|
| `--color-signal` 📌 | `#3F6B5B` (sage) | `#5B9E87` |
| `--color-highlight` 📌 | `#B45309` (amber) | `#D97706` |
| `--color-error` | `#991B1B` | `#EF4444` |
| `--color-success` | `#3F6B5B` | `#5B9E87` |
| `--color-warning` | `#B45309` | `#D97706` |
| `--color-info` | `#78716C` | `#A8A29E` |

### Borders & tints
| Token | Light | Dark |
|---|---|---|
| `--border-default` | `rgba(0,0,0,.06)` | `rgba(255,255,255,.06)` |
| `--border-strong` | `rgba(0,0,0,.14)` | `rgba(255,255,255,.14)` |
| `--signal-bg` | `rgba(63,107,91,.10)` | `rgba(91,158,135,.15)` |
| `--highlight-bg` | `rgba(180,83,9,.10)` | `rgba(217,119,6,.15)` |

### Overlay / scrim (theme-independent)
| Token | Value |
|---|---|
| `--color-scrim` | `rgba(20,20,20,.45)` (dark veil behind dialogs) |
| `--color-on-scrim` | `rgba(255,255,255,.96)` (light glyphs on the scrim) |

### Finance / data palette (theme-aware)
| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--data-up` | `#2E7D4F` | `#4FB07A` | gain |
| `--data-down` | `#B5342B` | `#E2705F` | loss |
| `--data-warn` | `#9A7D0F` | `#D9B43C` | caution |
| `--data-info` | `#2C6395` | `#5B9BD6` | info |
| `--data-flat` | `#78716C` | `#A8A29E` | unchanged |
| `--data-up-bg` / `--data-down-bg` / `--data-warn-bg` / `--data-info-bg` | tint | tint | row/cell tints |

### Annotation (grounding guardrail)
| Token | Light | Dark |
|---|---|---|
| `--anno-source` | `#4E6577` | `#93A7B5` |
| `--anno-source-bg` | `rgba(78,101,119,.12)` | `rgba(147,167,181,.16)` |

## Spacing, radii & widths (theme-independent)

- **Spacing** (8px base): `--space-xs` 4 · `--space-sm` 8 · `--space-md` 16 · `--space-lg` 32 · `--space-xl` 64 · `--space-2xl` 128
- **Radii:** `--radius-sm` 4px · `--radius-md` 8px · `--radius-lg` 12px
- **Content widths:** `--width-body` 720px · `--width-page` 1200px · `--width-code` 800px · `--width-quote` 480px

## Motion

- **Easing:** `--ease-out` `cubic-bezier(.22,1,.36,1)` · `--ease-in-out` `cubic-bezier(.65,0,.35,1)`
- **Duration:** `--dur-fast` 120ms · `--dur-base` 200ms · `--dur-slow` 360ms

---

## NOT consumer tokens — component-provided

These `var(--…)` names appear in `components.css` but are **set inline by the component**, not
defined on `:root`. A consumer never pins or overrides them globally; they are listed here only
so a `getComputedStyle` sweep of `:root` doesn't flag them as "missing":

| Token(s) | Set by | Where |
|---|---|---|
| `--wave-base`, `--wave-hi` | `GroundingFlag` (`.ground-wave--*`) | inline class rule |
| `--ms-aspect`, `--ms-fit`, `--ms-pos`, `--ms-radius` | `MediaSlot` | typed `style` prop on the element |

## Using these with Tailwind v4

`theme.css` (Tailwind-v4-only) maps a subset of these tokens to Tailwind utility names via
`@theme`. If you are **not** on Tailwind v4, import `colors-and-type.css` + `components.css`
directly and reference the custom properties above — see
[consumer-setup.md](./consumer-setup.md). `theme.css` is **not** required for the components to
be fully styled.

---

## QuBrain graph stage & text scale (added in 1.1.0)

Additive tokens for the QuBrain knowledge-graph explorer and the QuBae chat surface. All are
**theme-independent** (defined once on `:root`, never re-themed). The same stability contract
applies: renaming or removing one is a major bump.

**Import order** (fixed): `colors-and-type.css` → `components.css` → `graph.css`. Load
`@qball-inc/tokens/graph.css` only on pages that render the graph explorer; `components.css`
alone never pulls it in, so existing consumers get no new bytes from it.

### Text scale
| Token | Default | Meaning |
|---|---|---|
| `--text-scale` | `1` | Multiplies every QuBrain / QuBae component text size. `1` = exactly as designed. A site that steps its type up on wide screens sets it to match, e.g. `@media (min-width:1600px){:root{--text-scale:1.25}}`. The chat launcher keeps its own fluid `clamp()` sizing. |

### Chat scrim
| Token | Value |
|---|---|
| `--color-scrim-light` | `rgba(20,20,20,.22)` (QuBae overlay — dims the page less than a modal) |

### Graph stage (dark-only by ruling)
The explorer never follows the page theme. `graph.css` maps the ordinary tokens (`--bg-*`,
`--text-*`, `--border-*`, `--color-signal/highlight`, `--data-*`, `--anno-*`) onto these inside
the explorer, so it renders identically in a light or dark page. Consumers normally never
reference them directly.

**Canvas tier** (the 3D canvas, its HUD, legend and labels)
| Token | Value |
|---|---|
| `--stage-bg` | `#12161F` (deep ink) |
| `--stage-surface` | `#1A1F2B` |
| `--stage-text-primary` | `#EDE8E1` |
| `--stage-text-secondary` | `#D6D1C8` |
| `--stage-text-muted` | `#A8A29E` |
| `--stage-border` | `rgba(255,255,255,.06)` |
| `--stage-border-strong` | `rgba(255,255,255,.25)` |

**Panel tier** (entity panel, filter bar, details pill and everything inside them)
| Token | Value |
|---|---|
| `--stage-panel-bg` | `#1E1D1B` |
| `--stage-panel-surface` | `#2A2826` |
| `--stage-panel-text-primary` | `#E7E0D6` |
| `--stage-panel-text-secondary` | `#CDC6BB` |
| `--stage-panel-text-muted` | `#8A847D` |
| `--stage-panel-border` | `rgba(255,255,255,.06)` |
| `--stage-panel-border-strong` | `rgba(255,255,255,.14)` |
| `--stage-panel-divider` | `rgba(255,255,255,.07)` (glass filter-strip hairline) |
| `--stage-mark` | `#E7E2DA` (chat launcher mascot ink over the stage) |

**Accents** (both tiers — the luminous palette, pinned)
| Token | Value |
|---|---|
| `--stage-signal` / `--stage-highlight` | `#5B9E87` / `#D97706` |
| `--stage-signal-bg` / `--stage-highlight-bg` | `rgba(91,158,135,.15)` / `rgba(217,119,6,.15)` |
| `--stage-data-up` / `-down` / `-warn` / `-info` / `-flat` | `#4FB07A` / `#E2705F` / `#D9B43C` / `#5B9BD6` / `#A8A29E` |
| `--stage-data-up-bg` / `-down-bg` / `-warn-bg` / `-info-bg` | `rgba(79,176,122,.15)` / `rgba(226,112,95,.15)` / `rgba(217,180,60,.16)` / `rgba(91,155,214,.15)` |
| `--stage-anno-source` / `--stage-anno-source-bg` | `#93A7B5` / `rgba(147,167,181,.16)` |

### Component-provided (not consumer tokens)
| Token | Set by | Where |
|---|---|---|
| `--tdur` | chat verdict row | inline style on `.vrow__txt` when its explanation overflows and tickers |
