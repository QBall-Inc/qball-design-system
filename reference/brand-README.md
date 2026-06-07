# Ashay Kubal Design System

The brand identity and design system for **ashaykubal.com** — Ashay Kubal's personal site and research lab — plus an alternate identity placeholder for **Qball Inc**.

This system is the operating manual for any agent or human designing surfaces under this brand. It contains tokens (color, type, spacing, motion), self-hosted fonts, semantic CSS, reusable UI kit components, and SKILL.md so it can be detached and used directly inside Claude Code.

---

## Sources

This system was distilled from material the user provided directly. None of the upstream sources are bundled — keep your own access handy if you need to chase a detail back to the original.

- **Brand spec (local repo, attached read-only):** `brand-identity/brand-spec.md` — v1.0, locked 2026-05-22. The canonical document. Everything in `colors_and_type.css` and the README's *Visual Foundations* / *Content Fundamentals* sections derives from it.
- **Berkeley Mono webfonts (uploaded):** 18× WOFF2 files for the **SemiCondensed** width axis, weights 100–800 plus matching obliques. Copied into `fonts/` and wired into `colors_and_type.css`.
- **Site reference:** [ashaykubal.com](https://ashaykubal.com) — the live site. UI kit `ui_kits/ashaykubal/` is a recreation of the spec's intent (hero, featured posts, code block, pull quote, projects, career timeline, footer). When the live site and the spec disagree, **the spec wins** — that's what was given to us as locked.
- **Qball Inc:** No brand assets were provided. A placeholder folder exists; see *Caveats* below.

---

## Index

The root of this project is the manifest. Everything below is reachable from here.

| Path | What it is |
|---|---|
| `README.md` | This file. Start here. |
| `SKILL.md` | Skill front-matter so this folder works as a Claude-Code Agent Skill. |
| `colors_and_type.css` | All design tokens (CSS custom properties) and semantic element styles. Drop-in stylesheet for any prototype. |
| `brand-identity/brand-spec.md` | The original brand specification (read-only, source of truth). |
| `fonts/` | Self-hosted Berkeley Mono SemiCondensed webfonts (WOFF2). |
| `assets/` | Logos, marks, favicon, generic illustrations. |
| `preview/` | Small HTML cards that populate the Design System tab — type specimens, color swatches, components. |
| `ui_kits/ashaykubal/` | High-fidelity recreation of ashaykubal.com: index.html plus JSX components. |
| `ui_kits/qball/` | Placeholder. Awaiting Qball Inc brand assets. |

---

## Content Fundamentals

The voice is **a working researcher writing for other working researchers** — opinionated, technical, allergic to corporate fluff. Below is how to write copy that sounds like Ashay, not like a SaaS landing page.

### Tone

- **Opinionated, never neutral.** Posts take a position. Project blurbs say what the thing *is for*, not just what it *is*.
- **Technical specificity over abstraction.** Name the library, the model, the language. "Built a vector index over 12k internal docs with `bge-large-en-v1.5`" beats "Built an AI knowledge tool."
- **Dry humor, deadpan delivery.** No exclamation marks. No "🎉". Wit lives in word choice and juxtaposition, not punctuation.
- **First person singular for posts and bio.** "I built…", "I'm interested in…". Never the royal we. The site is a personal lab.
- **Second person sparingly**, only in CTAs and post intros that address the reader directly ("If you're reading this, you probably…").

### Casing

- **Sentence case** for everything: page titles, section headings, post titles, button labels.
- **No Title Case Headlines.** Even H1.
- **lowercase metadata** for dates and read times where the design uses a uppercase eyebrow style — let the CSS handle the transform, not the source string. E.g. write `featured` in source, the `.caption` class uppercases it.
- **ALL CAPS reserved for** the eyebrow caption style (Fira Code 12px with +1.25px tracking). Never inside body copy.

### Punctuation

- **Avoid em-dashes** ( — ). They read as AI-tells now. Use commas, colons, or just a new sentence.
- **No Oxford comma serial commas pile-ups.** Prefer rewriting to a shorter list.
- **Curly quotes** in copy ("like this"), **straight quotes** in code samples.
- **Colons** to introduce examples or punchlines. The line below the colon does the work.

### Emoji & symbols

- **No emoji.** Anywhere. The mono/serif typography carries the personality; emoji breaks the visual frequency.
- **Unicode arrows are acceptable as content:** `→`, `↳`, `·` (middle dot) for separating metadata. Used sparingly.
- **`#` for tags** in source copy — the `.tag` class doesn't render the hash, but it's there in the markup as a semantic affordance.

### Vibe

- "Personal research lab" not "personal brand." The site is where work gets published, not where Ashay gets sold.
- Posts can be **long**. The 720px body width assumes 8–20 minute reads. Don't artificially trim.
- Pull quotes are for **the writer's own words**, lifted from the body of the piece — not for inspirational outside quotes.

### Examples

> **Hero (good):** "Notes on building things with language models, and the occasional aside."
>
> **Hero (bad):** "Welcome to my blog! 👋 I write about AI and tech 🚀"

> **Post intro (good):** "I spent the weekend benchmarking three small embedding models on a corpus of dense legal text. The results were surprising, mostly in how unsurprising the winner turned out to be."
>
> **Post intro (bad):** "In this post, we will explore the fascinating world of embedding models!"

> **Project blurb (good):** `harness — a thin TypeScript wrapper around the OpenAI evals API. Built because I wanted ergonomic asserts in eval suites without bringing in jest.`
>
> **Project blurb (bad):** "Harness is an exciting new tool that helps you evaluate AI!"

---

## Visual Foundations

The brand's visual identity is **terminal-meets-editorial**: huge monospaced display type set against parchment-toned paper, sage and amber as the only chromatic notes, and asymmetric layouts that breathe.

### Color

- **Two backgrounds only:** Parchment `#F7F3EE` (light) or Charcoal `#1E1D1B` (dark). Both have a warm bias — *never* pure white, *never* pure black. The site supports both via `prefers-color-scheme` with manual override.
- **One signal color:** Sage `#3F6B5B` (light) / `#5B9E87` (dark). Used for links, tags, code keywords, code-block left accents, primary CTAs. Sage handles *all* wayfinding.
- **One highlight color:** Amber `#B45309` (light) / `#D97706` (dark). Reserved for "featured" badges, string literals in code, hover-state accents, secondary CTAs.
- **Sage and amber never carry equal visual weight in the same component.** One leads, one supports. In a row of tags, sage is default; amber is "featured" or "pinned" — never both at full saturation side-by-side.
- **Tag backgrounds at 10% (light) / 15% (dark) opacity** of the signal/highlight color, with the saturated color as text.

### Typography

- **Berkeley Mono SemiCondensed for display (H1–H2).** Tightly tracked (-2px at H1). Carries the brand personality.
- **Fira Code for sub-display & UI (H3, H4, tags, buttons, captions, metadata).** Wider monospace; bridges the gap between display mono and body.
- **Syne for body.** Unconventional sans with irregular proportions — gives long-form copy character at 16px / 1.75 line-height.
- **Instrument Serif italic for pull quotes.** The serif-vs-mono tension is the entire point. Max 480px width.
- **JetBrains Mono for code blocks.** Distinct from Berkeley/Fira so code reads as a different *register*, not just a different size.
- **Tracking tightens as size grows:** -2px at H1, -1px at H2, -0.5px at H3, 0 at H4 and body, +1.25px at caption scale (uppercase).

### Backgrounds, imagery, texture

- **No background images, no gradients, no patterns, no grain.** The off-white parchment / off-black charcoal *is* the texture.
- **Imagery is rare and intentional.** When present, it's typically a single asymmetric element — a portrait, a diagram, a screenshot — placed in the negative space of a 60/40 hero. Never decorative.
- **No stock photos.** If a piece needs imagery, it's hand-selected or drawn for that piece.

### Animation & motion

- **Restraint is the rule.** Animations exist to confirm state, not to delight.
- **Duration:** 120ms (`--dur-fast`) for hover, 200ms (`--dur-base`) for state changes, 360ms (`--dur-slow`) for layout/page transitions.
- **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` for outgoing/incoming UI. No bounce, no spring, no overshoot.
- **Fades, not slides.** Theme toggle cross-fades. Cards do not slide in on scroll.
- **No looping/idle animation.** No marquees, no shimmer, no breathing CTAs.

### Hover states

- **Links:** color shifts from sage → amber, plus a 1px underline appears on the bottom edge.
- **Primary CTA:** opacity drops to 0.88. No background change.
- **Secondary/tertiary CTAs:** background fills to the 10% tint of their outline color.
- **Tags:** static — tags don't hover (they're not interactive unless wrapped in a link).
- **Cards:** static by default. Linked cards get a 1px sage border + 0.95 opacity on the body.

### Press / active states

- **`transform: translateY(1px)`** on buttons. No color flash.
- No scale-down, no haptic-style shrink.

### Borders

- **0.5px** for card borders (`--border-default`, rgba black/white at 6%). Hairline by design.
- **1px** for button outlines and dividers.
- **3px solid sage left-accent** for code blocks and pull quotes. **Border radius is 0 on the accented edge** — the accent creates the shape, the right edge has no radius.

### Shadows

- **No shadows.** The system avoids elevation as a metaphor. Surfaces are differentiated by the parchment/surface tonal step (`#F7F3EE` → `#EDE8E1`), not by drop shadow.
- If you need to lift something off the page (modal, popover), use a heavier border (`--border-strong`) and a darker surface, not a shadow.

### Transparency & blur

- **No `backdrop-filter`, no glass effects.** The aesthetic predates "glass UI" by about thirty years.
- The only transparency in use is the **10–15% tint** on tag/badge backgrounds. Solid surfaces otherwise.

### Corner radii

| Token | Value | Where |
|---|---|---|
| `--radius-sm` | 4px | tags, buttons, inline code |
| `--radius-md` | 8px | cards |
| `--radius-lg` | 12px | larger surfaces (modals, hero panels) — used rarely |
| `0` | (override) | code blocks, pull quotes — the left accent is the shape |

Default to **`--radius-sm` or `--radius-md`**. Never round above 12px. Pill shapes (`border-radius: 999px`) are *not part of the brand*.

### Layout rules

- **Asymmetry is the layout strategy.** Hero is 60/40 or 70/30. Section titles can sit left while body text sits right. Don't centre everything by reflex.
- **Max body width: 720px.** Max page width: 1200px. Pull quotes: 480px and *indented from the left*, creating a deliberate negative-space notch.
- **Spacing scale is 8px-based:** 4, 8, 16, 32, 64, 128. Don't invent values between steps.
- **No fixed sticky headers.** Nav scrolls with the page. The site assumes long reads — chrome shouldn't follow you down the page.
- **Footer is left-aligned, mono, and short.** Three columns max.

### Imagery tone

- **Warm-cool neutral.** If imagery is included, it should sit comfortably on parchment — desaturated, slightly warm. No high-saturation hero photography.
- **No grain filters, no duotone treatments.** Imagery is as the camera saw it.

### What this system explicitly **avoids**

- Purple/blue tech gradients
- Glassmorphism / backdrop blur
- Emoji as iconography
- AI-generated stock illustration
- Drop shadows for elevation
- Pill-shaped buttons
- Animated SVG backgrounds
- "Powered by ✨ AI" badge clichés

---

## Iconography

The brand's relationship with icons is **deliberately minimal**.

- **No built-in icon font.** The brand spec does not name an icon family.
- **No emoji.** Reiterated from *Content Fundamentals* — emoji is incompatible with the typographic mood.
- **Unicode glyphs as content:** `→` for CTA arrows, `↳` for nested replies, `·` (middle dot) as a metadata separator. These are content, not icons.
- **When real icons are required** — social-link affordances in the footer, theme-toggle sun/moon — use **Lucide** at stroke-width 1.5, sized 16–20px, coloured `--text-muted` by default and `--color-signal` on hover. Lucide's hairline, geometric style sits naturally next to the mono type without competing.
- **CDN substitution flagged:** Lucide is *not* in the original spec; it's a closest-match substitution chosen for stroke weight and geometric feel. If the user prefers another set (Phosphor at duotone, Heroicons outline), swap globally.
- **SVGs are inline in the JSX,** not loaded as `<img>`. This lets them inherit `currentColor` for theme switching.

Icons live in `assets/icons/` when copied locally. The set used in this kit:

- Theme toggle: `sun`, `moon`
- Social links: `github`, `twitter`, `rss`, `mail`
- CTA arrow: `arrow-right`

---

## UI Kits

| Kit | Status | Notes |
|---|---|---|
| `ui_kits/ashaykubal/` | Built | Hero, featured posts, code block, pull quote, projects grid, career timeline, footer. Includes theme toggle. |
| `ui_kits/qball/` | Placeholder | No Qball Inc brand assets were provided. The folder contains a stub explaining what's needed. |

---

## Caveats & open questions

These are real and the user should weigh in.

1. **Berkeley Mono width axis.** The uploaded fonts are the **SemiCondensed** variant — narrower glyphs than the standard width referenced in the brand spec. The system is wired to use what was provided, but the spec's tracking values (-2px at H1) were authored against standard width. **Confirm:** is SemiCondensed the intended brand width, or should you upload the standard-width WOFF2 files instead?
2. **Berkeley Mono Regular (400).** No Regular-weight SemiCondensed file was provided — the closest match (`BerkeleyMono-SemiCondensed.woff2`, the base-name file) is being treated as the 400-weight roman. If that's wrong, weights will shift.
3. **Qball Inc brand.** Mentioned as an alt identity but no spec, no logo, no colour direction was supplied. A placeholder folder exists. **Need:** brand brief or at minimum logo + 2–3 reference URLs.
4. **Icon set.** Lucide is a substitution, not a brand decision. Confirm or swap.
5. **Live site vs. spec drift.** I didn't crawl ashaykubal.com — the UI kit recreates the *spec*. If the live site has evolved past v1.0 of the spec, point me at the diffs.
