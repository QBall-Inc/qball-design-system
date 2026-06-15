import type { CSSProperties, HTMLAttributes } from "react";

/**
 * Skeleton — content placeholder, painted with the shipped `@qball-inc/tokens`
 * `.skel` classes from the `preview/loading.html` oracle.
 *
 * A purely presentational shimmer placeholder for content that is still loading.
 * Every visual comes from the token CSS — `.skel` + `.skel--{text,line,title,
 * block,circle}`; there is no component CSS, no hardcoded color, no box-shadow.
 *
 * Reduced-motion is handled by the token CSS, not here: the shipped
 * `@media (prefers-reduced-motion: reduce)` rule stops `.skel` shimmer entirely
 * (falls back to a static `--bg-surface` tint), satisfying FR4/NFR5. The
 * component only applies the class; the conformance is inherited.
 *
 * Skeletons are decorative, so the element is `aria-hidden` — announce the
 * loading state on the surrounding region (e.g. `aria-busy` on the list) rather
 * than on each placeholder. Prefer a skeleton over a {@link Spinner} for content
 * that has a known shape (mirror the real layout so it doesn't jump on load).
 */
export type SkeletonShape = "text" | "line" | "title" | "block" | "circle";

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /**
   * Placeholder shape (the shipped `.skel--*` set). Default `line`. The AC's
   * "rect" is `block` (full-height fill); `circle` is for avatars/icons.
   */
  shape?: SkeletonShape;
  /** Convenience width (e.g. `"46%"`, `120`). Merged onto `style`; overrides `style.width`. */
  width?: string | number;
  /** Convenience height (e.g. `32`). Merged onto `style`; overrides `style.height`. */
  height?: string | number;
}

const SHAPE_CLASS: Record<SkeletonShape, string> = {
  text: "skel--text",
  line: "skel--line",
  title: "skel--title",
  block: "skel--block",
  circle: "skel--circle",
};

export function Skeleton({
  shape = "line",
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps) {
  const cls = ["skel", SHAPE_CLASS[shape], className].filter(Boolean).join(" ");
  const mergedStyle: CSSProperties = {
    ...style,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
  return <span aria-hidden {...rest} className={cls} style={mergedStyle} />;
}
