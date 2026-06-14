import * as RSelect from "@radix-ui/react-select";
import { forwardRef } from "react";
import type { ReactNode } from "react";

/**
 * Select — custom dropdown (no native `<select>`).
 *
 * Radix `@radix-ui/react-select` provides the behavior (keyboard navigation,
 * focus management, typeahead, portalled panel — AC-2) while the visual surface
 * is the shipped `@qball-inc/tokens` CSS: the trigger applies `.select` (whose
 * chevron is a CSS background-image, so no icon dep is needed), and the panel +
 * items apply `.menu` / `.menu__item` / `.menu__check` — matching the
 * `preview/select.html` oracle. This is the same "Radix for behavior, shipped
 * classes for style" pattern as Button's `asChild` Slot. No component CSS, no hex.
 *
 * NOTE (visual conformance / token-package concern): Radix exposes item highlight
 * via `data-highlighted` and selection via `data-state`, whereas the shipped
 * `.menu__item` tint keys on `:hover` + `[aria-selected]`. The selected item's
 * check (`.menu__check`, via Radix `ItemIndicator`) always renders; refining the
 * keyboard-highlight tint to `[data-highlighted]` is a tokens-package edit (a
 * separate WP / semver event), not a React-component change here.
 */
export interface SelectProps {
  /** Controlled selected value. */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  /** Fired with the newly selected value. */
  onValueChange?: (value: string) => void;
  /** Shown on the trigger when no value is selected. */
  placeholder?: string;
  /** Disables the trigger (applies the shipped `.select:disabled` styling). */
  disabled?: boolean;
  /** Accessible name for the trigger when there is no associated `<label>`. */
  "aria-label"?: string;
  /** `SelectItem` children. */
  children?: ReactNode;
  /** className merged onto the `.select` trigger. */
  className?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { value, defaultValue, onValueChange, placeholder, disabled, children, className, ...rest },
  ref,
) {
  const triggerCls = ["select", className ?? ""].filter(Boolean).join(" ");

  return (
    <RSelect.Root
      // exactOptionalPropertyTypes: spread each optional prop only when defined so
      // an explicit `undefined` is never passed (it is not assignable to Radix's
      // `prop?: T`). Do NOT collapse to direct `prop={prop}` forwarding — it will
      // not typecheck under the base tsconfig.
      {...(value !== undefined ? { value } : {})}
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(onValueChange !== undefined ? { onValueChange } : {})}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <RSelect.Trigger ref={ref} className={triggerCls} {...rest}>
        <RSelect.Value placeholder={placeholder} />
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className="menu" position="popper" sideOffset={4}>
          <RSelect.Viewport>{children}</RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
});

export interface SelectItemProps {
  /** The value selected when this item is chosen. */
  value: string;
  /** Disables this option. */
  disabled?: boolean;
  /** The visible option label. */
  children?: ReactNode;
  /** className merged onto the `.menu__item` element. */
  className?: string;
}

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(function SelectItem(
  { value, disabled, children, className },
  ref,
) {
  const itemCls = ["menu__item", className ?? ""].filter(Boolean).join(" ");
  return (
    <RSelect.Item
      ref={ref}
      className={itemCls}
      value={value}
      {...(disabled !== undefined ? { disabled } : {})}
    >
      <RSelect.ItemText>{children}</RSelect.ItemText>
      <RSelect.ItemIndicator className="menu__check">
        {/* Matches the oracle's check glyph (preview/select.html). */}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </RSelect.ItemIndicator>
    </RSelect.Item>
  );
});
