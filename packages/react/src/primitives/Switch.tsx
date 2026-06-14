import { forwardRef } from "react";
import type { ChangeEvent, InputHTMLAttributes, ReactNode } from "react";

/**
 * Switch — token-driven on/off toggle.
 *
 * Composes the shipped `.switch` structure from `@qball-inc/tokens`
 * (`components.css`), matching the `preview/toggle.html` oracle: a `<label class="switch">`
 * wrapping a visually-hidden native `<input type="checkbox">` and a `.switch__ui`
 * track. The brand-native SQUARED knob (4px / `var(--radius-sm)` — explicitly NOT
 * a 9999px pill, FR4) and the sage on-state live entirely in the published token
 * CSS, driven by the `.switch input:checked + .switch__ui` sibling selector. This
 * component authors no CSS and contains no hex.
 *
 * This is deliberately NOT a Radix Switch wrapper: Radix renders a
 * `<button role="switch" data-state>` with no native `:checked` input, so the
 * shipped sibling-selector CSS would never fire. The native checkbox is
 * keyboard-accessible for free; `role="switch"` upgrades the exposed semantics so
 * assistive tech announces on/off rather than checked/unchecked.
 */
export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "role" | "children" | "onChange"
> {
  /** Controlled on/off state. Omit (with `defaultChecked`) for an uncontrolled switch. */
  checked?: boolean;
  /** Fired with the new boolean state whenever the user toggles. */
  onCheckedChange?: (checked: boolean) => void;
  /** Native change handler; fired alongside `onCheckedChange`. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  /** Optional visible label rendered beside the track (the oracle pattern). */
  children?: ReactNode;
  /** className applied to the outer `<label>` (`.switch`), not the hidden input. */
  className?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { checked, onCheckedChange, onChange, disabled, className, children, ...rest },
  ref,
) {
  const labelCls = ["switch", className ?? ""].filter(Boolean).join(" ");

  return (
    <label className={labelCls}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onCheckedChange?.(event.target.checked);
          onChange?.(event);
        }}
        {...rest}
      />
      {/* The track; the squared knob is its `::after` pseudo-element (token CSS). */}
      <span className="switch__ui" aria-hidden="true" />
      {children}
    </label>
  );
});
