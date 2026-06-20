---
title: Tool-use / skill indicator — design spec
component: ToolUseIndicator
status: signed-off
wp: WP-B-4.3
gates: WP-B-4.4
binds_via: WP-B-4.3 owner sign-off (RB-7 / OQ4)
signoff:
  owner: "Ashay Kubal"
  date: "2026-06-20"
  decision: "approved" # approved as the binding spec for WP-B-4.4 (session 89; preview layout + idle/pending/error bg fixes applied pre-approval)
tokens_source: "@qball-inc/tokens (theme.css / components.css)"
preview: preview/tool-use-indicator.html
---

# Tool-use / skill indicator — design spec

> **Design-only WP (WP-B-4.3).** This document + `preview/tool-use-indicator.html` are the
> binding spec for the WP-B-4.4 build. No React source ships in this WP. Owner sign-off (see
> front-matter) is the hard gate: until it is recorded, WP-B-4.4's indicator build is NOT
> unblocked. If sign-off is not obtained, the indicator descopes to v2 (DigestCard, the other
> WP-B-4.4 deliverable, is unaffected).

## 1. Purpose & placement

When Stocky answers a question it often dispatches a **skill / tool** — `news-research`,
`sec-filings-lookup`, `alert-evaluation`, `market-data-lookup`, etc. (the `apps/agent`
skill catalogue). The **tool-use indicator** is the compact, inline affordance that tells the
user _which_ skill is running and _what state_ it is in, so a multi-second tool call never
looks like a hang.

It lives **inside the bot turn of the AI terminal transcript** (the WP-B-4.1a `Terminal`),
rendered just above or inline-before the streamed response text. It is a sibling of the
existing generic "thinking" cursor (`.term__cursor`, shipped WP-B-4.1a) — but where the
thinking cursor says only "Stocky is composing", the tool-use indicator names the **specific
skill** and its **lifecycle state**.

It is a _transient, status-bearing chip_ — not a button, not a control. It carries no action;
it reports state.

## 2. State set

Six states map to the real skill-invocation lifecycle in `apps/agent` (a BullMQ-backed skill
dispatch + SSE token stream). The state names are a UI abstraction over that lifecycle — there
is no backend coupling to these exact strings.

| State     | Lifecycle meaning                                                            | Leading color                         | Non-color cue (glyph / form)                                                      |
| --------- | ---------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `idle`    | no skill active; the indicator is absent or collapsed                        | `--text-muted`                        | hidden (or a single muted dot); **no animation**                                  |
| `pending` | skill dispatched, BullMQ job queued, not yet executing                       | `--color-info` / `--text-muted`       | static **clock** glyph (Lucide `clock`)                                           |
| `running` | job executing / SSE tokens streaming                                         | **`--color-signal`** (sage)           | **spinner** (`.spinner--sm`, the one sanctioned loop) **or** the streaming cursor |
| `success` | job complete, result appended to transcript                                  | `--color-success`                     | static **check** glyph (Lucide `check`)                                           |
| `error`   | job failed — hard error surfaced to the user                                 | `--color-error`                       | static **alert / x** glyph (Lucide `alert-triangle` or `x`)                       |
| `partial` | job complete but degraded (rate-limited / partial fundamentals / stale feed) | `--color-warn` (finance caution gold) | static **alert-triangle** glyph **+ the literal word "partial" / "rate-limited"** |

**`partial` is the FR4-critical state.** Caution gold (`--color-warn`) is a _finance/data_
hue, so per DESIGN.md it must _always_ pair with a non-color cue — here the glyph **and** an
explicit text label ("partial" / "rate-limited"). Color alone never carries the `partial`
meaning. (This guards against the gold reading as a price.)

**Sage leads, amber supports.** The leading accent is **sage** (`running` = sage). Amber
(`--color-highlight`) is _deliberately not_ a state color in this component — it stays reserved
for the `[unverified]` / "featured" grounding role elsewhere, so sage remains the sole
wayfinding lead (DESIGN.md "one leads, one supports").

## 3. Anatomy

A single inline-flex chip. Every named sub-element, its role, token refs, and layout relation:

```
┌─ .tuf  (wrapper chip — inline-flex row) ───────────────────────┐
│  [.tuf__glyph]  .tuf__label "news-research · running"  [.tuf__meta] │
└────────────────────────────────────────────────────────────────┘
```

| Sub-element    | Role                                                                                              | Token refs                                                                                                                                                                                                   | Layout                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `.tuf`         | wrapper chip; the state lives here as a `data-state` attribute                                    | `--radius-sm` (4px); per-state fill — `--bg-surface` (idle/pending), `--color-signal-bg` (running/success), `--color-down-bg` (error), `--color-warn-bg` (partial); hairline `--border-default`; `--font-ui` | `display:inline-flex; align-items:center; gap:6px; padding:3px 8px`; sits in the bot turn |
| `.tuf__glyph`  | **leading status glyph** — the primary non-color cue (Lucide icon, the `.spinner`, or the cursor) | `--color-signal` / `--color-success` / `--color-error` / `--color-warn`; 16px, stroke 1.5                                                                                                                    | first child; fixed 16×16 box so the row doesn't reflow on glyph swap                      |
| `.tuf__label`  | skill id + state verb, e.g. `news-research · running`                                             | `--font-ui` 11.5px; skill id may use `--font-display` (mono); `--text-primary` / `--text-secondary`                                                                                                          | flex body                                                                                 |
| `.tuf__meta`   | optional trailing meta — elapsed time, result count, or "rate-limited"                            | `--text-muted` 10.5px                                                                                                                                                                                        | trailing; muted; omitted when empty                                                       |
| `.tuf__cursor` | (running, streaming variant) the streaming cursor reused from the terminal                        | `--color-signal`; reuses the shipped `.term__cursor` pattern                                                                                                                                                 | inline after the label; mutually exclusive with the spinner                               |

No progress _track_ / bar element: DESIGN.md favors restraint, and the spinner or cursor
already conveys "in progress" without a determinate bar (skill duration is not known ahead of
time). A determinate track is explicitly **out of scope** for v1.

## 4. Motion spec

DESIGN.md Motion: durations **120ms** (hover) / **200ms** (state change) / **360ms**
(layout); easing `--ease-out` `cubic-bezier(.22,1,.36,1)` for incoming/outgoing UI,
`--ease-in-out` `cubic-bezier(.65,0,.35,1)` for the rare sanctioned breathing/looping. **Fades,
not slides. No bounce/spring/overshoot/marquee. No looping _idle_ animation** — the only
sanctioned loops are _transient state indicators_ (the button spinner, the grounding shimmer),
all of which honor `prefers-reduced-motion`.

| Transition                              | Trigger                      | Property animated                                 | Duration token            | Easing       | `prefers-reduced-motion: reduce` fallback                                                     |
| --------------------------------------- | ---------------------------- | ------------------------------------------------- | ------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| **appear**                              | indicator mounts (any state) | `opacity` 0→1                                     | `--duration-fast` (120ms) | `--ease-out` | instant (no fade)                                                                             |
| **pending → running**                   | job starts executing         | glyph cross-fade clock→spinner; `opacity`/`color` | `--duration-base` (200ms) | `--ease-out` | instant glyph swap                                                                            |
| **running — spinner**                   | while executing              | `transform: rotate` (continuous)                  | n/a (continuous)          | `linear`     | **`animation: none`** — spinner shows as a static ring; state still read from glyph + color   |
| **running — streaming cursor**          | while SSE tokens stream      | cursor blink (`steps(1)`)                         | 1s loop                   | `steps`      | **`animation: none`** — solid (non-blinking) cursor; matches shipped `.term__cursor` fallback |
| **running → success / error / partial** | job resolves                 | glyph + color cross-fade                          | `--duration-base` (200ms) | `--ease-out` | instant swap                                                                                  |

`idle` and `pending` carry **no loop** (DESIGN.md idle-loop ban). The `running` loop is a
_transient_ state indicator (sanctioned), reusing the shipped `.spinner` (one sanctioned loop)
and/or the shipped `.term__cursor` — the component does **not** invent a new looping animation.

## 5. Reduced-motion fallbacks (explicit)

Every animated element degrades under `@media (prefers-reduced-motion: reduce)`:

- **spinner** → `animation: none` (static ring) — mirrors the shipped `.spinner` reduced-motion rule.
- **streaming cursor** → `animation: none` (solid, non-blinking) — mirrors the shipped `.term__cursor` reduced-motion rule.
- **appear / state-change fades** → `transition: none` (instant).

In every case the state remains fully legible from the **static glyph + color + label** — no
information is animation-dependent. This is the same contract WP-B-3.2 (Skeleton/Spinner) and
WP-B-3.7 (ThemeToggle) ship.

## 6. Token list (canonical `@qball-inc/tokens`)

The WP-B-4.4 React component consumes these **`@qball-inc/tokens`** names (zero hardcoded hex):

| Role                   | Token                                                                               | Notes                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| running / sage lead    | `--color-signal`                                                                    | the wayfinding accent                                                                                                          |
| success                | `--color-success`                                                                   | sage-family hue; paired with check glyph                                                                                       |
| error                  | `--color-error`                                                                     | hard error                                                                                                                     |
| partial / caution      | `--color-warn`                                                                      | finance-caution gold; **always** + non-color cue (FR4)                                                                         |
| pending / idle         | `--color-info`, `--text-muted`                                                      | neutral                                                                                                                        |
| (reserved, **unused**) | `--color-highlight`                                                                 | amber — deliberately not a state color                                                                                         |
| idle / pending fill    | `--bg-surface`                                                                      | neutral surface — separates the pre-result chip from the page parchment                                                        |
| running / success tint | `--color-signal-bg`                                                                 | sage chip background                                                                                                           |
| error tint             | `--color-down-bg`                                                                   | faint red; no dedicated `--color-error-bg` token exists — a candidate token-add for WP-B-4.4 if a true error surface is wanted |
| partial tint           | `--color-warn-bg`                                                                   | caution chip background                                                                                                        |
| chrome                 | `--bg-primary`, `--border-default`                                                  | page bg + hairline                                                                                                             |
| radius                 | `--radius-sm` (4px)                                                                 | chip; ≤12px; no pill; count-badge/meter carve-out **not** used                                                                 |
| motion                 | `--duration-fast` (120ms), `--duration-base` (200ms), `--ease-out`, `--ease-in-out` | per §4                                                                                                                         |
| type                   | `--font-ui` (label), `--font-display` (mono skill id)                               | 11–11.5px                                                                                                                      |
| icons                  | Lucide, stroke 1.5, 16px                                                            | `clock` / `check` / `alert-triangle` / `x`; **no emoji**                                                                       |

> **Preview-vs-spec token-name note.** The shipped `preview/tool-use-indicator.html` imports the
> gallery's root `colors_and_type.css` + `components.css` (the convention every other preview
> card follows). That root file currently names the tint/finance tokens `--signal-bg`,
> `--data-up/--data-down/--data-warn` (+ `-bg`), whereas the canonical `@qball-inc/tokens`
> (packages/tokens) names them `--color-signal-bg`, `--color-up/--color-down/--color-warn`. The
> **values are identical**; only the variable names differ (the stale-root delta WP-B-3.3b will
> consolidate). The preview therefore uses the **root** names so it renders in the gallery
> today; this spec + the WP-B-4.4 React component use the **canonical** names above. The 1:1
> mapping: `--color-signal-bg`↔`--signal-bg`, `--color-warn`↔`--data-warn`, `--color-warn-bg`↔`--data-warn-bg`,
> `--color-down-bg`↔`--data-down-bg`. (`--bg-surface` is the same name in both.)

## 7. DESIGN.md conformance checklist

- [x] **Zero drop-shadows** — no `shadow` declarations of any kind; surfaces differentiate by a tonal tint + hairline border only.
- [x] **No hardcoded hex** — every color is a `var(--*)` token.
- [x] **Radius ≤ 12px** — the chip is `--radius-sm` (4px); no pill (`999px`); the count-badge/meter carve-out is **not** invoked.
- [x] **Finance color + non-color cue** — `partial` (caution gold) always pairs the glyph **and** the word "partial"/"rate-limited"; `success`/`error` pair color + glyph.
- [x] **No emoji** — Lucide icons only (stroke 1.5, 16px).
- [x] **Sage leads, amber supports** — `running` = sage; amber (`--color-highlight`) deliberately unused as a state color.
- [x] **No `backdrop-filter`, no gradient, no glass** — flat tonal tints only.
- [x] **No looping idle animation** — `idle`/`pending` are static; the only loop is the `running` spinner/cursor (a sanctioned transient state indicator) and it honors `prefers-reduced-motion`.

## 8. Out of scope (v1) / open for WP-B-4.4

- Determinate progress bar / track (skill duration is unknown ahead of time).
- A "cancel skill" action (the chip reports state; it is not a control).
- Per-skill custom iconography beyond the Lucide status glyphs (a single shared glyph set in v1).
- The exact `.tuf*` class names are a proposal; WP-B-4.4 may finalize them when it ships the
  token-CSS class family (the Terminal/GroundingFlag precedent: a small additive
  `components.css` block), pending its own SD1.

## 9. Sign-off

Owner reviews this spec **and** `preview/tool-use-indicator.html` (state matrix, light + dark).
On approval, fill the front-matter `signoff:` block (owner / date / `decision: approved`) — that
record unblocks WP-B-4.4. If not approved in-session, the descope path applies:
`docs/tool-use-indicator-v2-deferral.md` is authored and WP-B-4.4's indicator sub-task is marked
deferred in `tasks.yaml` (DigestCard stays unblocked).
