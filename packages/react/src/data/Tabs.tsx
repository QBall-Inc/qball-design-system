import * as TabsPrimitive from "@radix-ui/react-tabs";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ElementRef } from "react";

/**
 * Tabs — accessible tabbed section switcher built on Radix `Tabs`, painted with
 * the shipped `@qball-inc/tokens` classes (`.tabs`, `.tab-list`, `.tab`,
 * `.tab-panel`) from the `preview/tabs.html` oracle.
 *
 * Radix supplies the behavior — roving-tabindex keyboard nav (Arrow / Home / End),
 * the `role="tablist" / "tab" / "tabpanel"` wiring, and `aria-selected` on the
 * active trigger — while the visual surface is the token CSS. This is the same
 * "Radix for behavior, shipped classes for style" pattern as `Modal` / `Select`.
 * There is NO component CSS and NO hardcoded color.
 *
 * The active tab's sage label + underline is driven by the shipped
 * `.tab[aria-selected="true"]` rule, so selection MUST be expressed via
 * `aria-selected` — which Radix's `Trigger` does. Keyboard focus uses the
 * library's shared sage `:focus-visible` ring (also shipped in `components.css`).
 *
 * Distinct from `Segmented` (a compact boxed inline toggle): Tabs are an
 * underline list for switching larger content regions.
 *
 * Composition (matches the oracle):
 *   <Tabs defaultValue="overview">
 *     <TabsList aria-label="Position detail">
 *       <TabsTrigger value="overview">Overview</TabsTrigger>
 *       <TabsTrigger value="holdings">Holdings</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="overview">…</TabsContent>
 *     <TabsContent value="holdings">…</TabsContent>
 *   </Tabs>
 */

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;
export type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List>;
export type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>;
export type TabsContentProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;

/** Tabs root — owns the active-tab state (`value` / `defaultValue` / `onValueChange`). */
export const Tabs = forwardRef<ElementRef<typeof TabsPrimitive.Root>, TabsProps>(function Tabs(
  { className, ...rest },
  ref,
) {
  return (
    <TabsPrimitive.Root
      ref={ref}
      className={["tabs", className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
});

/** The `role="tablist"` row of triggers (`.tab-list`). */
export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  function TabsList({ className, ...rest }, ref) {
    return (
      <TabsPrimitive.List
        ref={ref}
        className={["tab-list", className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  },
);

/**
 * A single tab trigger (`.tab`). The active trigger shows the sage label +
 * underline via `.tab[aria-selected="true"]`; `disabled` dims it.
 */
export const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  function TabsTrigger({ className, ...rest }, ref) {
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={["tab", className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  },
);

/** The panel shown for the active tab (`.tab-panel`). */
export const TabsContent = forwardRef<ElementRef<typeof TabsPrimitive.Content>, TabsContentProps>(
  function TabsContent({ className, ...rest }, ref) {
    return (
      <TabsPrimitive.Content
        ref={ref}
        className={["tab-panel", className].filter(Boolean).join(" ")}
        {...rest}
      />
    );
  },
);
