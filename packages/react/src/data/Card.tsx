import type { HTMLAttributes, ReactNode } from "react";

/**
 * Card — a surface container, painted with the shipped `@qball-inc/tokens`
 * `.card` class (`colors_and_type.css`) from the `preview/card-featured.html`
 * and `preview/borders.html` oracles.
 *
 * The base `.card` is a static content surface: `var(--bg-surface)` background, a
 * 0.5px `var(--border-default)` hairline border (intentional sub-pixel — renders
 * as a hairline on retina; do NOT round up to 1px), `var(--radius-md)` (8px ≤12px)
 * radius, and `var(--space-md)` padding. There is **no box-shadow** anywhere — the
 * lift comes from the border weight + tonal surface step (DESIGN.md No-Shadows).
 *
 * Two optional states (the `.card--interactive` / `.card--selected`
 * additions to `colors_and_type.css`):
 * - `interactive` — a selectable card; the border lifts to sage
 *   (`var(--color-signal)`) on hover, with a pointer cursor.
 * - `selected` — applies the selected-surface treatment (sage border + faint sage
 *   tint).
 *
 * All other `<div>` attributes (e.g. `onClick`, `role`, `tabIndex`, `aria-*`) pass
 * through, so a consumer can make an interactive card fully keyboard-accessible.
 */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Card content. */
  children?: ReactNode;
  /** Selectable card: sage border on hover + pointer cursor. Default `false` (static content card). */
  interactive?: boolean;
  /** Apply the selected-surface treatment (`.card--selected`). Default `false`. */
  selected?: boolean;
}

export function Card({
  children,
  interactive = false,
  selected = false,
  className,
  ...rest
}: CardProps) {
  const cls = [
    "card",
    interactive ? "card--interactive" : null,
    selected ? "card--selected" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
}
