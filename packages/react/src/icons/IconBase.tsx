import { useId, type ReactNode } from "react";
import type { IconProps } from "./icon-props";

interface IconBaseProps extends IconProps {
  /** The icon geometry (paths/circles/lines), supplied by the generated component. */
  children: ReactNode;
}

/**
 * The one shared `<svg>` renderer behind every icon. Owns the DS stroke idiom
 * (the `SVG_PROPS` const hand-rolled 21× across the library — see
 * `ai/ToolUseIndicator.tsx`), the `size`→`width`/`height` mapping, the `ic`
 * base class, and the accessibility flip:
 *
 * - **Decorative (default)**: `aria-hidden="true"`, no role. Matches every current
 *   call site, where adjacent text or a labelled control carries the meaning.
 * - **Labelled**: when a `title` (or an incoming `aria-label`) is supplied, emit
 *   `role="img"` and drop `aria-hidden`. A `title` additionally renders a `<title>`
 *   child linked via `aria-labelledby` (an `aria-hidden` + `role="img"` element
 *   would be contradictory).
 *
 * currentColor-only and zero-hex by construction (DESIGN_DENY clean); SSR-safe
 * (no `window`/DOM access at render).
 *
 * `{...rest}` is spread BEFORE the computed `role`/`aria-hidden`/`aria-labelledby`
 * so that a11y invariant is authoritative: a consumer can override the visual
 * attrs (e.g. `viewBox`) but cannot force the contradictory `role="img"` +
 * `aria-hidden="true"` state §9 forbids.
 */
export function IconBase({
  size = 24,
  strokeWidth = 1.5,
  className,
  title,
  children,
  ...rest
}: IconBaseProps) {
  const titleId = useId();
  const labelled = title !== undefined || rest["aria-label"] !== undefined;
  const cls = ["ic", className].filter(Boolean).join(" ");
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      {...rest}
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-labelledby={title !== undefined ? titleId : undefined}
    >
      {title !== undefined ? <title id={titleId}>{title}</title> : null}
      {children}
    </svg>
  );
}
