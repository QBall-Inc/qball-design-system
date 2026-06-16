import type { HTMLAttributes } from "react";

/**
 * Divider — a horizontal separator, painted with the shipped `@qball-inc/tokens`
 * `hr, .rule` style (`colors_and_type.css`) from the `preview/borders.html` oracle.
 *
 * Renders a native `<hr>` (implicit `role="separator"`, horizontal orientation)
 * carrying the `.rule` class: a 1px `var(--border-top)` hairline via
 * `var(--border-default)`, no box-shadow, no hardcoded hex (FR4). The `<hr>`
 * element is the correct semantics for a thematic break and is announced as a
 * separator by assistive tech.
 *
 * Horizontal only in v1 (the borders.html oracle ships horizontal dividers); a
 * vertical variant is deferred (no shipped vertical-rule substrate).
 */

export interface DividerProps extends HTMLAttributes<HTMLHRElement> {
  /** className merged onto the `.rule` separator. */
  className?: string;
}

export function Divider({ className, ...rest }: DividerProps) {
  const cls = ["rule", className].filter(Boolean).join(" ");
  return <hr className={cls} {...rest} />;
}
