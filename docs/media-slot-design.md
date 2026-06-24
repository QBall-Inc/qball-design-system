---
title: MediaSlot — Design Specification
wp: WP-B-4b.3
status: signed-off # owner RB-7 sign-off S99 (2026-06-24) via the preview/media-slot.html review loop → binding for the BUILD
owner: Ashay Kubal
designed_by: Claude (session 99)
date: 2026-06-24
supersedes: null
sources:
  - logs/spec-verify-session-99-WP-B-4b.3.md # SD1 verified frame (PROCEED_ADJUSTED, binding)
  - artifacts/research/mediaslot-wp-b-4b3/synthesis.md # 5-viewpoint bulwark-research synthesis (binding)
  - logs/research/mediaslot-wp-b-4b3/0{1..5}-*.md # the 5 viewpoint logs
  - personalsite-v2 P1 consumer ask (§3.2 image-slot.js) + /mnt/c/projects/personalsite-v2/v2-design/image-slot.js (source, read-only)
signoff:
  approved: true
  approver: Ashay Kubal
  approved_date: 2026-06-24
  notes: >
    Approved via the S99 round-1 preview review (preview/media-slot.html): dark-scrim play button,
    responsive/centered/larger placeholders, icon-only avatar empty, drag-drop dropzone (authoring-layer
    visual), video muted/no-autoplay, embed inference + fallback, decorative prop dropped (universal alt).
    Binding for the BUILD (SD1 → component + .media-slot token CSS + tests).
review_log:
  - round: 1
    date: 2026-06-24
    by: Ashay Kubal
    changes:
      - "Facade play button → DARK SCRIM (--color-scrim); the earlier translucent-sage hover blended into a sage thumbnail. Rest = scrim, hover = solid sage, focus = sage ring, light (on-scrim) glyph."
      - "Empty placeholder: content now scales with the box (container-query units); default 'no media' centered + larger; avatar/circle empty is icon-only and spans most of the circle."
      - "Added a drag-drop/upload DROPZONE placeholder treatment (dotted border + upload glyph + Browse button, light emphasis) — this is the WP-B-4b.3a AUTHORING-layer visual, designed now to lock direction; the BEHAVIOR stays deferred."
      - "Video: default NO autoplay + default muted (controls on)."
      - "Embed: infer provider from the URL, WITH an explicit `provider`/`thumbnail` fallback."
      - 'Dropped the `decorative` prop — `alt=""` is the standard decorative signal.'
      - "Documented the fluid/responsive model (slot fills its container; aspect-ratio drives height)."
---

# MediaSlot — Design Specification (`@qball-inc/react`)

> **Scope of this document:** a **DESIGN-only** artifact (mirrors `docs/icon-system-design.md` /
> `docs/tool-use-indicator-design.md`). It defines the **DISPLAY primitive** that ships in DS 1.0.0; it
> does **not** build it. The companion visual oracle is **`preview/media-slot.html`** (a token-driven,
> light/dark contact sheet of every media type × shape × fit × state). The follow-on **BUILD** (after
> owner RB-7 sign-off + a fresh SD1) implements this spec; the binding plan below supersedes the
> original WP-B-4b.3 stub.
>
> **The authoring layer is OUT of scope** (upload / drag-drop / reframe-crop / pluggable persistence /
> oEmbed resolution) — deferred to **WP-B-4b.3a** (post-1.0), owner-approved because no current consumer
> depends on it. This spec covers DISPLAY only. (The dropzone/upload _placeholder visual_ in oracle §5
> was designed in round-1 to lock direction, but its _behavior_ belongs to WP-B-4b.3a.)

---

## 1. Purpose & Scope

A **MediaSlot** is an art-directed, sized, shaped container that displays heterogeneous media —
**static image, animated GIF, self-hosted video, or an embedded remote video** — with consistent
fit / object-position / aspect-ratio / shape-mask / lazy-load / poster / placeholder / a11y semantics.
It is the irreducible core surfaced by the S99 research spike: a static Astro/Sanity site (the
personalsite-v2 consumer) only ever needs DISPLAY — it receives `src`/`type` as props from the CMS at
build time; it never needs an in-page uploader.

**Seeded by** the personalsite-v2 `<image-slot>` custom element (P1 §3.2), but **NOT a port**: that
source is an image-only custom element with a module-eval `customElements.define` (SSR crash) and a hard
`window.omelette` write coupling. We keep the good ideas (shape/fit vocabulary, the `placeholder`
empty-state, the reframe _concept_) and re-architect as a pure, SSR-safe React component.

**Honest framing:** for the static consumer this is mostly a **structural** primitive — a correctly
shaped, fit-controlled frame reusing shape vocabulary the tokens already ship (circle/pill/rounded from
Avatar). The two genuinely-new visual surfaces are the **empty-state placeholder** (incl. the
authoring dropzone) and the **facade play overlay** (for embeds).

---

## 2. Binding Decisions (from the S99 research synthesis + round-1 review)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rationale                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Architecture = Option A: a pure React component** rendering native `<img>`/`<video>`/`<iframe>`. **No** custom element, **no** Shadow DOM.                                                                                                                                                                                                                                                                                                                              | SSR/static-safe by construction; Astro consumes React directly. Option B ruled out — React 19 still mishandles Declarative Shadow DOM (React #33698/#26071) and both consumers are pre-React-19; Polymer's lesson: no framework-agnostic core before a real non-React consumer. |
| D2  | **Discriminated `type` → 4 internal render paths**: `image`/`gif` → `<img>`; `video` → `<video>`; `embed` → facade. One export, four paths.                                                                                                                                                                                                                                                                                                                               | The slot contract is unifying (shape/fit/aspect); the divergence is only the inner element. Native elements ⇒ no library imports ⇒ **zero heavy deps**.                                                                                                                         |
| D3  | **Stays in `@qball-inc/react`** (the single barrel). **No** `@qball-inc/media` split at 1.0.                                                                                                                                                                                                                                                                                                                                                                              | The DISPLAY core has zero heavy deps, so there is **no single-barrel tax**. The package split is a WP-B-4b.3a question (it's where the heavy authoring deps land).                                                                                                              |
| D4  | **SSR/static-safe**: no `window`/`document`/`customElements` at module-eval **or** render. Any DOM work (facade click→swap) is inside an effect/handler.                                                                                                                                                                                                                                                                                                                  | Binding 1.0.0 constraint (the Astro static consumer). Verified by a node-env import/render test.                                                                                                                                                                                |
| D5  | **video** (`type="video"`): **default `muted`, default NO autoplay**, `controls` on by default. **gif-as-video** is an explicit opt-in (`autoPlay loop muted` → adds `playsinline`; iOS needs all four; mp4 `yuv420p` + even dims).                                                                                                                                                                                                                                       | Owner round-1: video must not autoplay and is muted by default. Autoplaying audio is hostile; the loud-decorative-loop case is opt-in.                                                                                                                                          |
| D6  | **embed = facade** on a **dark scrim** (lite-youtube-embed pattern): the provider's **real thumbnail** + a real `<button>` play overlay; on click, swap the real `<iframe>`. **Never auto-load.** **Provider inferred from the URL, with an explicit `provider`/`thumbnail` fallback** for unknown providers or when inference fails. No oEmbed auto-resolution or consent logic in the DS (consumer owns CSP/consent).                                                   | Fast + privacy-safe. Owner round-1: inference + a fallback. **Avoid Tenor (API dies 2026-06-30) + legacy Meta oEmbed (retired Apr-2025).**                                                                                                                                      |
| D7  | **`aspect-ratio` on the container is unconditional** (reserve space → no CLS). Shape masks via `border-radius`/`clip-path` at the frame level; the inner element fills it (`overflow:hidden`).                                                                                                                                                                                                                                                                            | 2021-baseline CLS fix; the most direct layout-stability lesson from prior art.                                                                                                                                                                                                  |
| D8  | **a11y**: `alt` required for informative media; **`alt=""` is the decorative signal** (no separate `decorative` prop). Reduced-motion honored for animated media; the facade play affordance is a real `<button aria-label>`.                                                                                                                                                                                                                                             | Owner round-1: drop the `decorative` prop — `alt=""` is the standard, sufficient decorative signal (matches the Icon System a11y idiom: a label flips it to informative).                                                                                                       |
| D9  | **`adapter?` is a RESERVED, typed, no-op prop** in 1.0 — it declares the WP-B-4b.3a authoring API seam so 1.1 is backward-compatible. **Zero persistence behavior** in 1.0.                                                                                                                                                                                                                                                                                               | Locks the API boundary without shipping the deferred behavior.                                                                                                                                                                                                                  |
| D10 | **New `.media-slot*` token-CSS surface** in `@qball-inc/tokens` → **RB-7 design-first gate + owner sign-off**. Reuses `--radius-*`, surface/border/text tokens, the shared sage `--color-signal` + `--signal-bg`, and **`--color-scrim`** (existing) for the play button. Uses **`container-type: inline-size`** (the `.dt-wrap` DataTable precedent) so placeholder content scales with the box. DESIGN_DENY clean (no hex/rgb/box-shadow literals in component source). | Small new surface, mostly reusing shipped tokens. One likely **token add: `--color-on-scrim`** (a theme-independent light foreground for the play glyph on the scrim) — confirm at build.                                                                                       |

---

## 3. Prop API (DISPLAY 1.0 — locked at sign-off)

```tsx
interface MediaSlotProps {
  src?: string; // image/GIF/video URL, or embed URL. Absent → placeholder/empty state.
  type: "image" | "gif" | "video" | "embed";

  // Art direction
  shape?: "rect" | "rounded" | "circle" | "pill"; // default 'rounded'
  radius?: number; // px, for shape='rounded' (default token --radius-md)
  mask?: string; // CSS clip-path; overrides shape
  fit?: "cover" | "contain" | "fill"; // object-fit, default 'cover'
  position?: string; // object-position, default '50% 50%'
  aspectRatio?: string; // CSS aspect-ratio, e.g. '16 / 9'. Reserves space (CLS).

  // Loading / fallbacks
  lazy?: boolean; // loading='lazy' on <img>; preload='none' on <video>. Default true.
  poster?: string; // <video> poster frame (type='video')
  placeholder?: ReactNode; // empty-state UI when src is absent (default: token placeholder; scales with the box)

  // video (type='video')  — default muted, NOT autoplaying
  controls?: boolean; // default true (false when autoPlay+loop+muted gif-as-video)
  autoPlay?: boolean; // default FALSE
  muted?: boolean; // default TRUE
  loop?: boolean; // default false
  // gif-as-video = autoPlay + loop + muted (+ playsinline applied automatically)

  // embed (type='embed') — facade; provider inferred from src, with explicit fallback
  provider?: "youtube" | "vimeo" | string; // fallback / override when URL inference can't determine it
  thumbnail?: string; // explicit facade thumbnail when the provider has no derivable thumb URL

  // a11y
  alt?: string; // required for informative image/gif; alt='' = decorative (no separate prop)

  // passthrough + reserved seam
  className?: string; // consumer owns WIDTH/layout here (the slot is fluid by default)
  adapter?: MediaSlotAdapter; // RESERVED no-op in 1.0 (WP-B-4b.3a authoring seam)
}
```

**Fluid model:** `.media-slot` is `display:block` and fills its container's width by default; the height
follows from `aspect-ratio`. The **consumer controls the width** via `className`/layout (a grid cell, a
`max-width`, `100%`, or a fixed px). It reflows with the browser; placeholder content scales with the
box (container-query units). The fixed widths in the oracle are contact-sheet styling only.

Resolved round-1: `decorative` prop dropped; video defaults muted/no-autoplay; embed inference + fallback.

---

## 4. Render paths (the discriminated `type`)

| `type`  | Element                             | Notes                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image` | `<img src loading=lazy>`            | static; `object-fit`+`object-position` from `fit`/`position`.                                                                                                                                                                                                                                                                                                        |
| `gif`   | `<img src loading=lazy>`            | animates natively; identical to `image` but semantically tagged (reduced-motion aware).                                                                                                                                                                                                                                                                              |
| `video` | `<video poster preload=none muted>` | **default muted, NO autoplay**, `controls` on. gif-as-video when `autoPlay loop muted` (adds `playsinline`).                                                                                                                                                                                                                                                         |
| `embed` | **facade** → `<iframe>` on click    | static: provider inferred from `src` (YouTube/Vimeo), real thumbnail (e.g. `img.youtube.com/vi/<id>/maxresdefault.jpg` → `hqdefault` fallback) + a `.media-slot__play` `<button>` on `--color-scrim`. Explicit `provider`/`thumbnail` fallback. Click swaps the real `<iframe allow="autoplay; fullscreen">`. **No network until click.** Consumer owns CSP/consent. |

All four sit inside the same `.media-slot` frame (aspect-ratio + shape mask + `overflow:hidden`). The
empty state (no `src`) renders `.media-slot--empty` with the `placeholder`.

---

## 5. The `.media-slot*` token-CSS surface (proposed — RB-7 sign-off)

Shipped into `packages/tokens/components.css` after sign-off (Tabs/Icon precedent). The oracle
(`preview/media-slot.html`) carries the proposed CSS inline for review. Draft surface:

- `.media-slot` — frame: `position:relative; overflow:hidden; container-type:inline-size; aspect-ratio:var(...)`; `display:block`; token surface bg + `.5px` token border.
- `.media-slot > img,>video,>iframe` — `width/height:100%; object-fit:<fit>; object-position:<pos>; display:block`.
- Shapes: `--rect` (radius 0), `--rounded` (`var(--radius-md)`), `--circle` (50%), `--pill` (999px). `mask` → inline `clip-path`.
- `.media-slot--empty` — empty state: dashed token border; `display:grid; place-items:center`.
- `.media-slot__placeholder` — passive placeholder (icon + label); sizes via `clamp(..,cqw,..)` so it scales with the box. `--icon` variant = icon-only, large (avatar empty, spans most of the circle).
- `.media-slot--dropzone` + `.media-slot__dropzone` + `.media-slot__browse` — the **authoring dropzone** visual (dotted border + upload glyph + "Browse" button, light emphasis). **Behavior = WP-B-4b.3a**; the CSS may ship with 4b.3a or be reserved now (decide at build).
- `.media-slot__poster` — facade thumbnail layer.
- `.media-slot__play` — facade play `<button>`: centered, sized via `clamp(..,cqw,..)`, **`background:var(--color-scrim)`** + light glyph (`--color-on-scrim`); hover → `background:var(--color-signal)`; `:focus-visible` → sage outline ring.
- `.media-slot__bar` — video native-controls hint (preview-only stand-in; real `<video controls>` ships the native bar).
- Reduced-motion: animated `gif`/gif-as-video respect `prefers-reduced-motion`.

Token adds expected: at most **`--color-on-scrim`** (theme-independent light foreground for the play
glyph). Everything else reuses shipped tokens. Confirm at build/RB-7.

---

## 6. SSR / static-safety (binding)

- No `window`/`document`/`customElements` at module-eval or render. The facade's click→swap is a state
  toggle inside an event handler; lazy attributes are static markup.
- SSR emits correct semantic markup: `<img loading="lazy">`, `<video preload="none" poster muted>`, the
  facade thumbnail + button. Hydration is optional and additive.
- Verified by a `// @vitest-environment node` import/render test (the build-tool-env pattern).
- Static Astro consumer: emit concrete dimensions / `aspect-ratio` so layout is reserved before CSS
  loads (prior-art lesson from next/image + astro:assets).

---

## 7. Out of scope (→ WP-B-4b.3a, deferred post-1.0)

FILL (upload / drag-drop / paste / URL-paste — the _behavior_ behind oracle §5's dropzone) · TRANSFORM
(reframe / pan / zoom / crop + OffscreenCanvas encode) · PERSIST (`{read,write}` adapters: IndexedDB
default / Sanity-`{hotspot,crop}`-shaped / omelette) · oEmbed auto-resolution + embed consent · video
lazy-play (IntersectionObserver autoplay-on-scroll) · the `@qball-inc/media` package decision. See
`workpackages/WP-B-4b.3a.yaml`. The dropzone placeholder _design_ from round-1 is captured there as a
build pointer.

---

## 8. Acceptance mapping

The DISPLAY ACs are in `workpackages/WP-B-4b.3.yaml` (AC-1…AC-9). This spec is the binding design input
for them: AC-2 ↔ §4 render paths; AC-3 ↔ §5 token surface (this doc + the oracle = the RB-7 artifact);
AC-4 ↔ §3 art-direction props + §5; AC-6 ↔ §2 D8 a11y; AC-7 ↔ §2 D9 reserved adapter; AC-1/AC-8 ↔ §6 +
§2 D3/D4.

---

## 9. Review log (owner sign-off loop)

- **Round 1 (S99, 2026-06-24):** owner reviewed `preview/media-slot.html`. Changes applied (see frontmatter
  `review_log`): dark-scrim play button; responsive + centered + larger placeholders; icon-only avatar empty;
  drag-drop dropzone treatment (authoring-layer visual); video muted/no-autoplay; embed inference + fallback;
  dropped `decorative`; documented the fluid model. _Awaiting next round / RB-7 sign-off._
