import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * MediaSlot — an art-directed, sized, shaped container that displays
 * heterogeneous media (static image / animated GIF / self-hosted video / an
 * embedded remote video) with one unifying contract: shape mask, object-fit,
 * object-position, aspect-ratio (CLS reserve), lazy-load, poster, placeholder,
 * and a11y. Painted with the shipped `@qball-inc/tokens` `.media-slot` family
 * from the `preview/media-slot.html` oracle — every visual comes from the token
 * CSS / token-valued custom properties (no hardcoded hex, no `box-shadow`).
 *
 * **Pure React, SSR/static-safe by construction** (WP-B-4b.3, research Option A):
 * renders native `<img>`/`<video>`/`<iframe>`; NO `window`/`document`/
 * `customElements` access at module-eval OR render. The only client-side work —
 * the embed facade's click→swap and the reduced-motion probe — lives in an event
 * handler / effect, so it never runs during SSR.
 *
 * **Discriminated `type` → 4 render paths:**
 * - `image`/`gif` → `<img>` (gif animates natively in the UA).
 * - `video` → `<video poster preload="none">`, **default muted, NO autoplay**,
 *   native `controls`. gif-as-video = `autoPlay loop muted` (adds `playsInline`;
 *   autoplay is suppressed under `prefers-reduced-motion`).
 * - `embed` → a **facade**: the provider's real thumbnail + a real `<button>` play
 *   overlay on the shipped dark `--color-scrim`; the real `<iframe>` is swapped in
 *   only on click — **no network until click** (consumer owns CSP/consent). The
 *   facade resets when `src`/`provider` changes, so a reused instance never
 *   auto-loads a new embed.
 *
 * The DISPLAY primitive only. Upload / drag-drop / reframe-crop / persistence /
 * oEmbed resolution are the deferred authoring layer (WP-B-4b.3a); `adapter` is a
 * reserved, no-op seam that declares that future API for forward-compatibility.
 */

export type MediaSlotType = "image" | "gif" | "video" | "embed";
export type MediaSlotShape = "rect" | "rounded" | "circle" | "pill";
export type MediaSlotFit = "cover" | "contain" | "fill";

/**
 * RESERVED no-op seam for the WP-B-4b.3a authoring layer (read/persist adapters).
 * Declared in 1.0 so 1.1 can ship the authoring behavior backward-compatibly;
 * MediaSlot ignores it entirely at 1.0 (zero persistence behavior).
 */
export interface MediaSlotAdapter {
  read?: (...args: never[]) => unknown;
  write?: (...args: never[]) => unknown;
}

export interface MediaSlotProps {
  /** Image/GIF/video URL, or an embed URL. Absent ⇒ the empty-state placeholder. */
  src?: string;
  /** Discriminated render path. */
  type: MediaSlotType;

  // ----- Art direction -----
  /** Frame shape. Default `rounded`. Ignored when `mask` is set. */
  shape?: MediaSlotShape;
  /** Corner radius (px) for `shape="rounded"`. Defaults to the `--radius-md` token. */
  radius?: number;
  /** A CSS `clip-path` that overrides `shape`. */
  mask?: string;
  /** `object-fit` of the inner media. Default `cover`. */
  fit?: MediaSlotFit;
  /** `object-position` of the inner media. Default `50% 50%`. */
  position?: string;
  /** CSS `aspect-ratio` (e.g. `"16 / 9"`). Reserves the box → no CLS. Circle defaults to `1 / 1`. */
  aspectRatio?: string;

  // ----- Loading / fallbacks -----
  /** `loading="lazy"` on `<img>` / `preload="none"` on `<video>`. Default `true`. */
  lazy?: boolean;
  /** `<video>` poster frame (`type="video"`). */
  poster?: string;
  /** Empty-state UI when `src` is absent. Defaults to a token-styled glyph placeholder. */
  placeholder?: ReactNode;

  // ----- video (type="video") — default muted, NOT autoplaying -----
  /** Native `controls`. Default `true` (auto-`false` for a gif-as-video loop). */
  controls?: boolean;
  /** Autoplay. Default `false`. Suppressed under `prefers-reduced-motion`. */
  autoPlay?: boolean;
  /** Muted. Default `true`. */
  muted?: boolean;
  /** Loop. Default `false`. `autoPlay + loop + muted` = gif-as-video. */
  loop?: boolean;

  // ----- embed (type="embed") — facade; provider inferred from src -----
  /** Provider override/fallback when URL inference can't determine it. Recognized
   *  values: `"youtube"`, `"vimeo"`; any other value treats `src` as the embed URL. */
  provider?: string;
  /** Explicit facade thumbnail when the provider has no derivable thumb URL (e.g. Vimeo). */
  thumbnail?: string;

  // ----- a11y -----
  /** Required for informative media; `alt=""` (the default) marks it decorative. */
  alt?: string;

  // ----- passthrough + reserved seam -----
  /** Optional in-frame type chip (e.g. "gif"). Rendered only when provided. */
  badge?: ReactNode;
  /** Merged onto the `.media-slot` root. The consumer owns WIDTH/layout here. */
  className?: string;
  /** RESERVED no-op in 1.0 (WP-B-4b.3a authoring seam). */
  adapter?: MediaSlotAdapter;
}

// Scheme allowlists (defense-in-depth, mirroring the WP-2.4 httpUrl + Avatar guards):
// any consumer-supplied media/poster/thumbnail URL must be http(s) / root-or-relative /
// data:image|video / blob:; an embed iframe target must be https. A `javascript:` /
// `data:text/html` URL is dropped (the affordance falls back to the empty state / no poster).
const SAFE_MEDIA_SRC = /^(?:https?:\/\/|\/|\.\.?\/|data:(?:image|video)\/|blob:)/i;
const SAFE_EMBED_SRC = /^https:\/\//i;

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;

/** A custom-property-aware style for the `.media-slot` frame (the CSS reads `var(--ms-*)`). */
type MediaSlotStyle = CSSProperties & {
  "--ms-aspect"?: string;
  "--ms-fit"?: string;
  "--ms-pos"?: string;
  "--ms-radius"?: string;
};

/** Returns the URL only if it passes the media scheme allowlist; else undefined (dropped). */
function safeMediaUrl(url: string | undefined): string | undefined {
  return url !== undefined && SAFE_MEDIA_SRC.test(url) ? url : undefined;
}

interface ResolvedEmbed {
  iframeSrc: string;
  poster?: string;
  posterFallback?: string;
}

/**
 * Resolve an embed `src` (+ optional provider/thumbnail) to a facade. YouTube and
 * Vimeo are recognized from the URL; an unknown provider treats `src` as the embed
 * URL directly (and needs an explicit `thumbnail`). Pure string work — SSR-safe.
 */
function resolveEmbed(src: string, provider?: string, thumbnail?: string): ResolvedEmbed | null {
  const yt = YOUTUBE_RE.exec(src);
  if ((provider === undefined || provider === "youtube") && yt?.[1] !== undefined) {
    const id = yt[1];
    return {
      iframeSrc: `https://www.youtube.com/embed/${id}?autoplay=1`,
      poster: thumbnail ?? `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      // Only the derived maxres thumbnail has an hqdefault fallback; an explicit
      // thumbnail does not (and is honored as-is).
      ...(thumbnail === undefined
        ? { posterFallback: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }
        : {}),
    };
  }
  const vm = VIMEO_RE.exec(src);
  if ((provider === undefined || provider === "vimeo") && vm?.[1] !== undefined) {
    // Vimeo has no static thumbnail URL → relies on an explicit `thumbnail`.
    return {
      iframeSrc: `https://player.vimeo.com/video/${vm[1]}?autoplay=1`,
      ...(thumbnail !== undefined ? { poster: thumbnail } : {}),
    };
  }
  // Unknown provider: treat src as the embed URL directly; needs an explicit thumbnail.
  return { iframeSrc: src, ...(thumbnail !== undefined ? { poster: thumbnail } : {}) };
}

/** SSR-safe `prefers-reduced-motion` probe: false on the server / first paint; the
 *  real value is read in a client-only effect (no `window` at module-eval or render). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    // Guarded for SSR (no window) and jsdom (no matchMedia) — both leave it false.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = (): void => {
      setReduced(mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
    };
  }, []);
  return reduced;
}

/** Default empty-state glyph (token-stroked by `.media-slot__placeholder svg`). */
function DefaultMediaGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

interface RenderResult {
  node: ReactNode;
  empty: boolean;
}

export function MediaSlot({
  src,
  type,
  shape = "rounded",
  radius,
  mask,
  fit = "cover",
  position = "50% 50%",
  aspectRatio,
  lazy = true,
  poster,
  placeholder,
  controls,
  autoPlay = false,
  muted = true,
  loop = false,
  provider,
  thumbnail,
  alt,
  badge,
  className,
}: MediaSlotProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [activated, setActivated] = useState(false);
  const [posterErrored, setPosterErrored] = useState(false);

  // Reset the facade (and its poster fallback) when the media identity changes, so a
  // reused instance never auto-loads a NEW embed's <iframe> without a fresh click
  // (the "no network until click" contract). Prev-prop pattern — synchronous and
  // SSR-safe (no effect); runs before the iframe would render and converges immediately.
  const identity = `${src ?? ""}|${provider ?? ""}`;
  const [prevIdentity, setPrevIdentity] = useState(identity);
  if (identity !== prevIdentity) {
    setPrevIdentity(identity);
    setActivated(false);
    setPosterErrored(false);
  }

  function renderPlaceholder(): ReactNode {
    if (placeholder !== undefined) {
      return <div className="media-slot__placeholder">{placeholder}</div>;
    }
    const iconOnly = shape === "circle";
    return (
      <div
        className={
          iconOnly
            ? "media-slot__placeholder media-slot__placeholder--icon"
            : "media-slot__placeholder"
        }
      >
        <DefaultMediaGlyph />
        {iconOnly ? null : <span>No media</span>}
      </div>
    );
  }

  function renderImageOrGif(): RenderResult {
    const safeSrc = safeMediaUrl(src);
    if (safeSrc === undefined) return { node: renderPlaceholder(), empty: true };
    return {
      node: <img src={safeSrc} alt={alt ?? ""} loading={lazy ? "lazy" : undefined} />,
      empty: false,
    };
  }

  function renderVideo(): RenderResult {
    const safeSrc = safeMediaUrl(src);
    if (safeSrc === undefined) return { node: renderPlaceholder(), empty: true };
    const gifAsVideo = autoPlay && loop && muted;
    return {
      node: (
        <video
          src={safeSrc}
          poster={safeMediaUrl(poster)}
          preload={lazy ? "none" : "metadata"}
          muted={muted}
          controls={controls ?? !gifAsVideo}
          autoPlay={autoPlay && !reducedMotion}
          loop={loop}
          playsInline={gifAsVideo}
        />
      ),
      empty: false,
    };
  }

  function renderEmbed(): RenderResult {
    if (src === undefined || src === "") return { node: renderPlaceholder(), empty: true };
    const resolved = resolveEmbed(src, provider, thumbnail);
    if (resolved === null || !SAFE_EMBED_SRC.test(resolved.iframeSrc)) {
      return { node: renderPlaceholder(), empty: true };
    }
    if (activated) {
      return {
        node: (
          <iframe
            src={resolved.iframeSrc}
            title={alt !== undefined && alt !== "" ? alt : "Embedded video"}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ),
        empty: false,
      };
    }
    const rawPoster =
      posterErrored && resolved.posterFallback !== undefined
        ? resolved.posterFallback
        : resolved.poster;
    const posterSrc = safeMediaUrl(rawPoster);
    return {
      node: (
        <>
          {posterSrc !== undefined ? (
            <img
              className="media-slot__poster"
              src={posterSrc}
              alt={alt ?? ""}
              loading={lazy ? "lazy" : undefined}
              onError={
                resolved.posterFallback !== undefined
                  ? () => {
                      setPosterErrored(true);
                    }
                  : undefined
              }
            />
          ) : null}
          <button
            type="button"
            className="media-slot__play"
            aria-label={alt !== undefined && alt !== "" ? `Play: ${alt}` : "Play video"}
            onClick={() => {
              setActivated(true);
            }}
          >
            <span className="tri" aria-hidden="true" />
          </button>
        </>
      ),
      empty: false,
    };
  }

  const { node: inner, empty } =
    type === "embed" ? renderEmbed() : type === "video" ? renderVideo() : renderImageOrGif();

  const shapeClass = mask !== undefined ? null : `media-slot--${shape}`;
  const emptyClass = empty ? "media-slot--empty" : null;
  const cls = ["media-slot", shapeClass, emptyClass, className].filter(Boolean).join(" ");

  // Custom properties the shipped .media-slot* CSS reads (`var(--ms-*)`); they
  // inherit down to the inner <img>/<video>/<iframe>. No colors here → DESIGN_DENY-clean.
  const slotStyle: MediaSlotStyle = {
    "--ms-fit": fit,
    "--ms-pos": position,
    ...(aspectRatio !== undefined || shape === "circle"
      ? { "--ms-aspect": aspectRatio ?? "1 / 1" }
      : {}),
    ...(shape === "rounded" && radius !== undefined ? { "--ms-radius": `${radius}px` } : {}),
    ...(mask !== undefined ? { clipPath: mask } : {}),
  };

  return (
    <div className={cls} style={slotStyle} data-media-type={type}>
      {inner}
      {badge !== undefined ? <span className="media-slot__badge">{badge}</span> : null}
    </div>
  );
}
