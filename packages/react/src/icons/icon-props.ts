import type { SVGProps } from "react";

/**
 * Shared prop surface for every icon in the system — the per-icon named exports
 * (`<TrendingUp />`) and the dynamic registry (`<Icon name="trending-up" />`).
 *
 * Icons are **currentColor-only**: they never read a token. The placement wrapper
 * owns color (e.g. `.iconbtn { color: var(--text-muted) }`), and a consumer
 * recolors by setting `color` on any ancestor and resizes via `size`.
 *
 * `children` is omitted — an icon's geometry is baked at codegen time; it is not a
 * slot. (The generated component supplies its paths to the shared `IconBase`.)
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref" | "children"> {
  /** Render size in px → `width` and `height` on the fixed 24 viewBox. Default 24. */
  size?: number;
  /** Stroke width. Default 1.5 (the DS idiom; a few heavier marks use 1.6). */
  strokeWidth?: number;
  /** className merged after the base `ic` class. */
  className?: string;
  /**
   * Accessible label. When present (or an `aria-label` is passed), the icon flips
   * from decorative (`aria-hidden`) to `role="img"` + a linked `<title>`. Omit for
   * decorative icons sitting next to text that already carries the meaning.
   */
  title?: string;
}
