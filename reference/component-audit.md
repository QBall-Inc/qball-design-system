# Component Inventory — Design-System Gap Audit

**System audited:** Ashay Kubal Design System (`colors_and_type.css` tokens + semantic element styles, `ui_kits/ashaykubal/` UI kit, `preview/` cards).
**Against:** the consumer's component inventory (Stock Watcher frontend).
**Date:** 2026-05-30

## Headline

The existing system is an **editorial / terminal personal-site brand** — tokens, type ramp, semantic prose styles, and a marketing homepage kit (header, hero, post cards, code block, pull quote, projects, timeline, subscribe, footer). It is a strong *foundation* (color, type, spacing, motion, radii, borders are all locked and reusable) but it ships **almost none of the application UI** the Stock Watcher needs: forms, data tables, charts, overlays, AI-chat surfaces, and app-level states.

| Verdict | Count | Meaning |
|---|---|---|
| **Yes** | 2 | Exists and meets the required variants/states |
| **Partial** | 10 | Exists but missing required variants/states — extend it |
| **No** | 28 | Must be created |

Every **P0** row below that is `No`/`Partial` is on the blocking gap list for the consumer's build.

---

## 1. Primitives & Forms

| Component | Verdict | Gap / note |
|---|---|---|
| Button | **Partial** | Have `primary`/`secondary`/`tertiary`. Missing: `destructive`, `ghost`, `icon-only`, `loading` (spinner), `disabled`. |
| Text input | **Partial** | Subscribe `<input>` exists with focus state only. Missing: `error`, `disabled`, numeric variant, inline error text. No reusable class. |
| Secret / masked input | **No** | BYO Anthropic key entry; needs mask + reveal toggle + set/rotate/delete. |
| Select / dropdown | **No** | — |
| Toggle / switch | **No** | ⚠️ Conventional toggles are pill-shaped — explicitly outside the brand. Needs a brand-native square design. |
| Radio group | **No** | (Or segmented control.) |
| Form field wrapper | **No** | Label + control + helper + error. Drives 400/422 display. |
| Search / autocomplete | **No** | Ticker type-ahead. |

## 2. Layout & Navigation

| Component | Verdict | Gap / note |
|---|---|---|
| App shell / top nav | **Partial** | Marketing header exists. No signed-in app shell (user menu + bell), no signed-in/out states. |
| Notification bell + badge | **No** | SSE unread count. |
| User menu | **No** | — |
| Responsive page grid | **Partial** | Page scaffold + breakpoints exist. No ~12-col app grid. |
| Card / surface | **Partial** | `.card` + hover patterns exist. Missing `selected` state. |
| Tabs | **No** | — |
| Breadcrumb | **No** | — |
| Divider / separator | **Yes** | `hr` / `.rule`. |
| Footer | **Yes** | Exists; needs a slot for the hobby-tier disclaimer. |

## 3. Data Display & Charts

| Component | Verdict | Gap / note |
|---|---|---|
| Candlestick chart | **No** | P0 headline chart. OHLC tooltip + crosshair + range toggles. ⚠️ Needs a gain/loss color decision (see questions). |
| Line / area chart | **No** | — |
| Sparkline | **No** | Inline watchlist trend. |
| Data table | **No** | Sortable, row hover/actions, skeleton/empty/error. |
| Stat / metric tile | **No** | pos/neg/neutral coloring. |
| Badge / pill | **Partial** | `.tag` + `.tag--featured` (sage/amber). Missing semantic success/warn/error/neutral set. |
| Tag / chip | **Partial** | Static `.tag` only. Missing removable variant. |
| List item | **Partial** | Post/timeline patterns exist. No generic stateful list item. |
| Key-value / definition list | **No** | — |
| Tooltip | **No** | — |
| Progress / usage meter | **No** | Token usage. |
| Avatar | **No** | Image / initials. |

## 4. Feedback, Overlays & States

| Component | Verdict | Gap / note |
|---|---|---|
| Modal / dialog | **No** | P0. ⚠️ No shadows in brand — elevation via heavier border + darker surface. |
| Toast | **No** | P0. SSE-driven, stacking, auto-dismiss. |
| Notification center / dropdown | **No** | — |
| Banner / inline callout | **No** | Hosts disclaimer + degraded-data messages. |
| Skeleton loader | **No** | Preferred over spinners for content. |
| Spinner | **No** | — |
| Empty state | **No** | — |
| Error state / boundary | **No** | With retry. |
| Inline validation error | **No** | — |

## 5. AI Conversation (domain-specific)

| Component | Verdict | Gap / note |
|---|---|---|
| Conversation panel | **No** | Core AI surface. |
| Message bubble | **No** | user / assistant / system. |
| Streaming / typing indicator | **No** | — |
| Markdown renderer | **Partial** | Prose element styles (h/p/code/pre/quote/a) exist and map well. No scoped renderer component. |
| Tool-use / skill indicator | **No** | P1. |
| Composer / chat input | **No** | Incl. disabled (no BYO key) state. |

## 6. Grounding Guardrail (domain-specific)

| Component | Verdict | Gap / note |
|---|---|---|
| "(unverified)" annotation | **No** | P0. Inline tag + hover explainer. Distinct but non-alarming. |
| Grounding / source indicator | **No** | P1. |

## 7. Briefings & Disclaimers (domain-specific)

| Component | Verdict | Gap / note |
|---|---|---|
| Briefing / digest card | **Partial** | `.card` base exists. No read/unread digest variant. |
| v1 hobby-tier disclaimer | **No** | P0. Needs the banner/footer component. |

## 8. Auth-specific

| Component | Verdict | Gap / note |
|---|---|---|
| Magic-link request form | **Partial** | Subscribe form is the visual pattern. Needs idle/submitting/sent/error states. |
| "Check your email" state | **No** | — |
| Verify / redirect loader | **No** | loading / success / expired-or-invalid. |

---

## Blocking P0 gap list (to build before screen prototyping)

**Create (No):** Secret/masked input · Select · Toggle/switch · Form-field wrapper · Search/autocomplete · Notification bell+badge · User menu · Candlestick chart · Data table · Stat tile · Tooltip · Modal · Toast · Notification center · Banner/callout · Skeleton · Spinner · Empty state · Error state · Inline validation error · Conversation panel · Message bubble · Streaming indicator · Composer · "(unverified)" annotation · Hobby-tier disclaimer · "Check your email" · Verify loader.

**Extend (Partial):** Button (destructive/ghost/icon/loading/disabled) · Text input (error/disabled/numeric) · App shell (signed-in) · Page grid (12-col) · Card (selected) · Badge (semantic set) · Markdown renderer (scoped) · Magic-link form (states).
