import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

/**
 * Input — token-driven text/numeric input.
 *
 * Composes the shipped `.input` class from `@qball-inc/tokens`
 * (`components.css`), matching the `preview/form-input.html` and
 * `preview/form-controls.html` oracle cards. Border-only sage focus, error
 * border, and tabular numerics all live in the published token CSS — this
 * component authors no CSS and contains no hex.
 *
 * `numeric` opts into finance-grade tabular figures (`.num`) and an
 * `inputMode="decimal"` keypad, following the oracle's `class="input num"
 * inputmode="decimal"` cell rather than a native `type="number"` (which loses
 * `inputMode` control and adds spinner chrome).
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Numeric variant: tabular figures (`.num`) + decimal keypad for finance contexts. */
  numeric?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { numeric, type, inputMode, className, "aria-invalid": ariaInvalid, ...rest },
  ref,
) {
  const invalid = ariaInvalid === true || ariaInvalid === "true";
  const cls = [
    "input",
    numeric === true ? "num" : "",
    invalid ? "input--error" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <input
      ref={ref}
      type={type ?? "text"}
      inputMode={inputMode ?? (numeric === true ? "decimal" : undefined)}
      className={cls}
      aria-invalid={ariaInvalid}
      {...rest}
    />
  );
});
