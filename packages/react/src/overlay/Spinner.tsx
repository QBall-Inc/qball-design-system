import type { HTMLAttributes } from "react";

/**
 * Spinner — the ONE sanctioned loading spinner for the library, painted with the
 * shipped `@qball-inc/tokens` `.spinner` classes from the `preview/loading.html`
 * oracle.
 *
 * There is exactly one spinner concept in `@qball-inc/react`. This component is
 * it; no other component file may introduce an alternative rotating-SVG / loading
 * pattern. The {@link Button} `loading` prop paints the SAME sanctioned loop via
 * the shipped `.btn--loading` class (it does not compose this component), so a
 * loading button needs no `<Spinner>`. For an inline wait next to text, or a
 * spinner alongside button-like content, use `size="sm"` (the `.load-inline`
 * pattern in the oracle). Every visual comes from the token CSS — `.spinner` +
 * `.spinner--{sm,lg}`; there is no component CSS, no hardcoded color.
 *
 * Reduced-motion is handled by the token CSS, not here: the shipped
 * `@media (prefers-reduced-motion: reduce)` rule stops `.spinner` rotation
 * entirely (static ring, no spin), satisfying FR4/NFR5.
 *
 * Use a spinner only for true indeterminate waits (a submit in flight, an SSE
 * reconnect). For content with a known shape, prefer a {@link Skeleton}.
 */
export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /**
   * Size. Default `md` — the base `.spinner` (18px). `sm` (13px, `.spinner--sm`)
   * is the inline / inside-a-button size; `lg` (28px, `.spinner--lg`) is for
   * full-panel waits. (There is no `--md` modifier — `md` is the base class.)
   */
  size?: SpinnerSize;
  /** Accessible label announced to assistive tech. Default `"Loading"`. */
  label?: string;
}

// md is the base `.spinner` (no modifier — omitted so its lookup is `undefined`
// and drops out of the className join).
const SIZE_CLASS: Partial<Record<SpinnerSize, string>> = {
  sm: "spinner--sm",
  lg: "spinner--lg",
};

export function Spinner({ size = "md", label = "Loading", className, ...rest }: SpinnerProps) {
  const cls = ["spinner", SIZE_CLASS[size], className].filter(Boolean).join(" ");
  return <span role="status" aria-label={label} {...rest} className={cls} />;
}
