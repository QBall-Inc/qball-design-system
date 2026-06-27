import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";

/**
 * Tooltip — a hover/focus hint built on Radix `@radix-ui/react-tooltip`, painted
 * with the shipped `@qball-inc/tokens` inverted-bubble visual from the
 * `preview/tooltip-avatar.html` oracle. Same "Radix for behavior, shipped classes
 * for style" pattern as `Modal` / `Select`.
 *
 * **Portaled to `<body>` (BINDING, RB-5).** `TooltipContent` renders inside a Radix
 * `Portal`, so the bubble escapes any transformed / `backdrop-filter` ancestor —
 * notably the floating `.dock`, which uses `transform: translateX(-50%)` and would
 * otherwise clip or mis-place a parent-anchored tooltip. This is the same
 * portal-to-body guarantee applied to `GroundingFlag`.
 *
 * **Why `.tip-pop`, not `.tip__pop`.** The shipped `.tip__pop` is a parent-anchored
 * pure-CSS hover popover (`position:absolute` relative to `.tip`), which cannot be
 * positioned once the node is portaled to `<body>` — Radix's popper owns placement.
 * So the content carries the position-agnostic `.tip-pop` token class (an
 * owner-approved additive variant): the SAME inverted-bubble look (`background: var(--text-primary)`,
 * `radius-sm`, caret) MINUS the positioning. The lift is the brand no-shadow
 * treatment — there is NO `box-shadow` (FR4). The caret is Radix's `Arrow`,
 * token-filled via `.tip-pop__arrow`.
 *
 * Composition (wrap the tree once in `TooltipProvider`):
 *   <TooltipProvider>
 *     <Tooltip>
 *       <TooltipTrigger asChild><button>…</button></TooltipTrigger>
 *       <TooltipContent>Delayed ~15 min on the hobby tier.</TooltipContent>
 *     </Tooltip>
 *   </TooltipProvider>
 */

/** Wraps the tree (typically once at app root); owns the shared `delayDuration`. Alias of Radix `Tooltip.Provider`. */
export const TooltipProvider = TooltipPrimitive.Provider;

/** A single tooltip; owns its open state. Alias of Radix `Tooltip.Root`. */
export const Tooltip = TooltipPrimitive.Root;

/** The element the tooltip describes; wrap a custom element with `asChild`. Alias of Radix `Tooltip.Trigger`. */
export const TooltipTrigger = TooltipPrimitive.Trigger;

export type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

/**
 * The portaled tooltip bubble (`.tip-pop`) + caret (`.tip-pop__arrow`). Defaults
 * `sideOffset` to 8 (matching the shipped `.tip__pop` gap). Placement, flip, and
 * collision handling are Radix's; the visual is the shipped token CSS.
 */
export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(function TooltipContent({ className, children, sideOffset = 8, ...rest }, ref) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={["tip-pop", className].filter(Boolean).join(" ")}
        {...rest}
      >
        {children}
        <TooltipPrimitive.Arrow className="tip-pop__arrow" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});
