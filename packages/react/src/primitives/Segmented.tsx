import { createContext, forwardRef, useContext, useState } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Segmented — exclusive (single-select) segmented control.
 *
 * Composes the shipped `.segmented` structure from `@qball-inc/tokens`
 * (`components.css`), matching the `preview/toggle.html` oracle: a
 * `<div class="segmented" role="group">` of contiguous `<button aria-pressed>`
 * items sharing a border with no gap. The selected segment's sage tint is driven
 * by the `.segmented button[aria-pressed="true"]` token CSS — so the component
 * MUST express selection via `aria-pressed`, which is exactly what this wrapper
 * does. This is deliberately NOT a Radix ToggleGroup wrapper: Radix's items emit
 * `data-state`/radio semantics whose `aria-pressed` contract is unverified
 * against the shipped CSS selector. No component CSS, no hex.
 *
 * Single-select with no full-deselect: re-pressing the active item is a no-op, so
 * at least one item always stays pressed (AC-8), provided a `value` or
 * `defaultValue` is supplied.
 */
interface SegmentedContextValue {
  value: string | undefined;
  onSelect: (value: string) => void;
}

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

export interface SegmentedProps {
  /** Controlled selected value. */
  value?: string;
  /** Uncontrolled initial value; ensures one item starts pressed. */
  defaultValue?: string;
  /** Fired with the newly selected value (never with empty — no full-deselect). */
  onValueChange?: (value: string) => void;
  /** Accessible group label (the control has no visible heading). */
  "aria-label"?: string;
  /** `SegmentedItem` children. */
  children?: ReactNode;
  /** className applied to the `.segmented` group container. */
  className?: string;
}

export function Segmented({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
  "aria-label": ariaLabel,
}: SegmentedProps) {
  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const onSelect = (next: string) => {
    // No full-deselect: re-pressing the active segment is a no-op (AC-8).
    if (next === current) return;
    if (!isControlled) setInternal(next);
    onValueChange?.(next);
  };

  const groupCls = ["segmented", className ?? ""].filter(Boolean).join(" ");

  return (
    <div className={groupCls} role="group" aria-label={ariaLabel}>
      <SegmentedContext.Provider value={{ value: current, onSelect }}>
        {children}
      </SegmentedContext.Provider>
    </div>
  );
}

export interface SegmentedItemProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "type" | "aria-pressed"
> {
  /** The value this segment selects. */
  value: string;
  children?: ReactNode;
}

export const SegmentedItem = forwardRef<HTMLButtonElement, SegmentedItemProps>(
  function SegmentedItem({ value, children, onClick, ...rest }, ref) {
    const ctx = useContext(SegmentedContext);
    // CS3 fail-fast: a SegmentedItem outside a Segmented has no selection context.
    if (ctx === null) {
      throw new Error("SegmentedItem must be rendered inside a <Segmented>.");
    }
    const pressed = ctx.value === value;

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={pressed}
        onClick={(event) => {
          ctx.onSelect(value);
          onClick?.(event);
        }}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
