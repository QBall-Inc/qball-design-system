import { forwardRef, useEffect } from "react";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Scrim — the canonical library-wide scroll-lock primitive + dim backdrop.
 *
 * Painted with the shipped `.scrim` class (components.css:273-277): a full-viewport
 * `position: fixed; inset: 0` layer dimmed with `var(--color-scrim)`. The shipped
 * `.scrim` is DELIBERATELY flat — no `backdrop-filter` blur (the brand dims with a
 * flat tone), so this is a pure className wrapper with no inline color and no shadow.
 *
 * Scrim OWNS scroll-lock: while `open` is true it sets `document.body` `overflow:hidden`,
 * capturing the prior value, and restores that exact prior value when `open` becomes
 * false OR when the component unmounts (no leaked lock).
 *
 * NOTE: Radix overlays (Modal/Dialog) keep their OWN robust scroll-lock
 * (react-remove-scroll). This Scrim is the scroll-lock owner for NON-Radix / custom
 * overlays; the Modal's overlay already shares this same `.scrim` class for the visual
 * backdrop.
 */
export interface ScrimProps extends ComponentPropsWithoutRef<"div"> {
  /** When true, render the dim backdrop AND lock `document.body` scroll. */
  open: boolean;
}

export const Scrim = forwardRef<HTMLDivElement, ScrimProps>(function Scrim(
  { open, className, ...rest },
  ref,
) {
  useEffect(() => {
    if (!open) return;
    // Capture the prior overflow so a nested/pre-existing lock is restored verbatim
    // (LIFO-correct for stacked overlays: each Scrim restores the value it captured).
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return <div ref={ref} className={["scrim", className].filter(Boolean).join(" ")} {...rest} />;
});
