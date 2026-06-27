import { Children, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Avatar — a user/entity glyph, painted with the shipped `@qball-inc/tokens`
 * `.avatar` family from the `preview/tooltip-avatar.html` oracle. Two display
 * modes: an `<img>` (with graceful fallback to initials when it fails to load),
 * or token-tiled initials derived from `name`. Every visual comes from the token
 * CSS / token-valued custom properties — no hardcoded hex, no `box-shadow`.
 *
 * - **Size**: `sm` (`.avatar--sm`), `md` (the base `.avatar`, no modifier), `lg`
 *   (`.avatar--lg`), `xl` (`.avatar--xl`). md = base mirrors the Spinner size model.
 * - **Initials color is deterministic**: the same `name` always maps to the same
 *   token-backed tile (a `charCodeAt`-sum hash into a small palette of `var(--*)`
 *   background/foreground pairs). No hardcoded color.
 * - **Status dot** (`online`/`offline`/`busy`/`away`): a presence indicator, NOT a
 *   finance signal — so the dot shape itself is the cue and no paired arrow is
 *   required (this carve-out is intentional, distinct from the finance-color-plus-
 *   cue rule). `online` is the base `.avatar__status` (gain green); the other three
 *   map to `--data-flat` / `--data-down` / `--data-warn`. Omitted ⇒ no dot.
 */

export type AvatarSize = "sm" | "md" | "lg" | "xl";
export type AvatarStatus = "online" | "offline" | "busy" | "away";

// md is the base `.avatar` (no modifier), like Spinner's md=base.
const SIZE_CLASS: Partial<Record<AvatarSize, string>> = {
  sm: "avatar--sm",
  lg: "avatar--lg",
  xl: "avatar--xl",
};

// online is the base `.avatar__status`; the rest add a token-mapped variant.
const STATUS_CLASS: Partial<Record<AvatarStatus, string>> = {
  offline: "avatar__status--offline",
  busy: "avatar__status--busy",
  away: "avatar__status--away",
};

// Deterministic initials palette — token-valued background/foreground pairs only
// (no hex; `var()` refs are DESIGN_DENY-clean, same idiom as Modal's tinted badge).
// Loss-red is deliberately excluded (it would read as an error tile).
const INITIALS_PALETTE: ReadonlyArray<CSSProperties> = [
  { background: "var(--signal-bg)", color: "var(--color-signal)" },
  { background: "var(--data-info-bg)", color: "var(--data-info)" },
  { background: "var(--data-up-bg)", color: "var(--data-up)" },
  { background: "var(--data-warn-bg)", color: "var(--data-warn)" },
  { background: "var(--bg-surface)", color: "var(--text-secondary)" },
];

// Overflow (+N) tile tint — info blue, matching the oracle's group overflow tile.
const OVERFLOW_STYLE: CSSProperties = {
  background: "var(--data-info-bg)",
  color: "var(--data-info)",
};

// Scheme allowlist for `src` (defense-in-depth, mirroring the httpUrl
// guard): http(s), root/relative paths, and data:image/ only. A `javascript:` or
// `data:text/html` src is rejected and the avatar falls back to initials.
const SAFE_SRC_RE = /^(?:https?:\/\/|\/|\.\.?\/|data:image\/)/i;

/** Up to two initials: first letter of the first + last word (1 letter for a single name). */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0] ?? "";
  if (parts.length === 1) return first.charAt(0).toUpperCase();
  const last = parts[parts.length - 1] ?? "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** Stable name → palette index (same name ⇒ same tile, across renders and mounts). */
function paletteIndex(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return sum % INITIALS_PALETTE.length;
}

export interface AvatarProps {
  /** Image source. When set (and the image loads), renders an `<img>`; otherwise falls back to initials. */
  src?: string;
  /** Alt text for the image. Falls back to `name` then empty (decorative). */
  alt?: string;
  /** Display name — drives the initials AND the deterministic tile color; also the image-fallback content. */
  name?: string;
  /** Size variant. Default `md` (the base `.avatar`). */
  size?: AvatarSize;
  /** Presence status dot. Omitted ⇒ no dot. */
  status?: AvatarStatus;
  /** Round (circular) avatar (`.avatar--round`). Default `false` (squared, `--radius-sm`). */
  round?: boolean;
  /** className merged onto the `.avatar` root. */
  className?: string;
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  status,
  round = false,
  className,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = src !== undefined && src !== "" && SAFE_SRC_RE.test(src) && !imgFailed;

  const cls = ["avatar", SIZE_CLASS[size], round ? "avatar--round" : null, className]
    .filter(Boolean)
    .join(" ");

  // Tile color applies only to the initials render (the image covers the tile).
  const tileStyle =
    !showImage && name !== undefined ? INITIALS_PALETTE[paletteIndex(name)] : undefined;

  const statusCls =
    status !== undefined
      ? ["avatar__status", STATUS_CLASS[status]].filter(Boolean).join(" ")
      : null;

  // a11y: an initials tile announces the full name (+ status), not the letters.
  // Image mode is labelled by the <img alt>, so the wrapper takes no role there.
  const labelProps =
    !showImage && name !== undefined
      ? { role: "img" as const, "aria-label": status !== undefined ? `${name} (${status})` : name }
      : {};

  return (
    <span className={cls} style={tileStyle} {...labelProps}>
      {showImage ? (
        <img src={src} alt={alt ?? name ?? ""} onError={() => setImgFailed(true)} />
      ) : (
        initialsFrom(name ?? "")
      )}
      {statusCls !== null ? <span className={statusCls} aria-hidden="true" /> : null}
    </span>
  );
}

export interface AvatarGroupProps {
  /** The `Avatar` instances to stack. */
  children: ReactNode;
  /** Cap the visible avatars; the remainder collapse into a `+N` overflow tile. */
  max?: number;
  /** Round the overflow tile to match round group members. Default `false`. */
  round?: boolean;
  /** className merged onto the `.avatar-group` root. */
  className?: string;
}

/**
 * AvatarGroup — overlapping stack of `Avatar`s (`.avatar-group`, negative-margin
 * overlap from the token CSS). With `max`, the overflow collapses into a single
 * token-tinted `+N` tile (info blue, matching the oracle).
 */
export function AvatarGroup({ children, max, round = false, className }: AvatarGroupProps) {
  const items = Children.toArray(children);
  const visible = max !== undefined && items.length > max ? items.slice(0, max) : items;
  const overflow = items.length - visible.length;

  const cls = ["avatar-group", className].filter(Boolean).join(" ");
  const tileCls = ["avatar", round ? "avatar--round" : null].filter(Boolean).join(" ");

  return (
    <span className={cls}>
      {visible}
      {overflow > 0 ? (
        <span className={tileCls} style={OVERFLOW_STYLE} role="img" aria-label={`${overflow} more`}>
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}
