import { Slot } from "@radix-ui/react-slot";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button — token-driven, framework-agnostic at the CSS layer.
 *
 * Styling is delivered entirely by the published `@qball-inc/tokens` CSS: this
 * component only composes the shipped semantic class names (`.btn`, `.btn--*`)
 * shown in the `preview/buttons*.html` oracle cards. There is NO component CSS,
 * no hardcoded hex, no box-shadow, no Tailwind, and no shadcn runtime — the
 * `.btn` rules (radius `--radius-sm`, border-only focus, the sanctioned loading
 * spinner) live in `colors_and_type.css` and resolve from the consumer's token
 * CSS import. DESIGN.md conformance is therefore inherited, not re-authored.
 *
 * `icon` and `loading` are layered MODIFIERS (per the oracle: `btn btn--secondary
 * btn--icon`, `btn btn--primary btn--loading`), not standalone color variants.
 */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Color treatment. Default `primary`. The `destructive` variant signals a
   * dangerous action with color — always pair it with a text label (or, for an
   * icon-only destructive control, an `aria-label`) so the meaning is not
   * carried by color alone (DESIGN.md finance-color-plus-cue).
   */
  variant?: ButtonVariant;
  /** Icon-only square treatment (`.btn--icon`). Pair with `variant` for color; provide an `aria-label`. */
  icon?: boolean;
  /** Loading state (`.btn--loading`): hides the label, shows the spinner, sets `aria-busy`, and blocks interaction. */
  loading?: boolean;
  /**
   * Render the single child element instead of a `<button>` (Radix Slot). The
   * `.btn` classes merge onto the child, so `<Button asChild><a href="…">…</a></Button>`
   * renders an `<a>` with identical styling. Note: the forwarded `ref` is typed
   * as `HTMLButtonElement` for the default case; under `asChild` it resolves to
   * the child's element type at runtime (e.g. `HTMLAnchorElement`).
   */
  asChild?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", icon, loading, asChild, disabled, type, className, children, ...rest },
  ref,
) {
  const isDisabled = disabled === true || loading === true;
  const cls = [
    "btn",
    `btn--${variant}`,
    icon === true ? "btn--icon" : "",
    loading === true ? "btn--loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  // asChild: the consumer owns the element (e.g. an anchor). `type`/`disabled`
  // are button-only attributes, so they are not forwarded; disabled intent is
  // expressed via `aria-disabled` instead.
  if (asChild === true) {
    return (
      <Slot
        ref={ref}
        className={cls}
        aria-busy={loading === true ? true : undefined}
        aria-disabled={isDisabled ? true : undefined}
        {...rest}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cls}
      disabled={isDisabled}
      aria-busy={loading === true ? true : undefined}
      {...rest}
    >
      {children}
    </button>
  );
});
