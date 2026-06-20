import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/**
 * GroundingFlag — the inline `[source]` / `[unverified]` grounding annotation for
 * AI answers, painted with the shipped `@qball-inc/tokens` grounding surface
 * (`.ground-wave` wave-shimmer + the `.gtip*` explainer bubble) from the
 * `preview/conversation-terminal.html` + `preview/briefing.html` oracles.
 *
 * **Standalone marker, NOT a value wrapper (oracle semantics).** The flag is the
 * small shimmering `[source]`/`[unverified]` label itself; the flagged value
 * (a price, a percent) lives in the surrounding prose — e.g. `NVDA leads [source]
 * at +8.4%`. `children`, when supplied, OVERRIDES the label glyph; it is not a
 * wrapped value.
 *
 * **Shimmer + reduced-motion are shipped CSS, not JS.** The wave-shimmer is the
 * shipped `.ground-wave` + `.ground-wave--{source|unverified}` keyframe; a
 * `@media (prefers-reduced-motion: reduce)` block in the same stylesheet swaps the
 * animation for a static `var(--wave-base)` fill. The component applies BOTH
 * classes (the modifier supplies `--wave-base`/`--wave-hi`); there is no
 * `matchMedia` in here.
 *
 * **Portaled to `<body>` (BINDING, RB-5).** The explainer bubble composes
 * `@radix-ui/react-tooltip` directly, so it portals to `<body>` and Radix's popper
 * keeps it on-screen (collision-clamped) — the same portal-to-body guarantee as the
 * sibling `Tooltip` (WP-B-3.4). We do NOT reuse the shipped `TooltipContent` wrapper:
 * it force-joins `.tip-pop` (the DARK inverted bubble), whereas grounding uses the
 * deliberately LIGHT guardrail bubble. The position-agnostic `.gtip-pop` token class
 * carries that light look minus the parent-anchored `.gtip` positioning (Radix owns
 * placement); `.gtip__k`/`.gtip__src`/`.gtip--{cited,unverified}` descendants compose
 * in unchanged.
 *
 * Self-contained: bundles its own `TooltipProvider`, so it drops into any tree
 * (Terminal message content, a DigestCard narrated number) without app-root setup.
 *
 *   <p>NVDA leads <GroundingFlag variant="source" explainer="Live last-sale quote.">
 *     <span className="gtip__src">Nasdaq · 3:42pm ET</span>
 *   </GroundingFlag> at +8.4%.</p>
 */

export type GroundingVariant = "source" | "unverified";

export interface GroundingFlagProps {
  /** `'source'` renders the cited `[source]` flag; `'unverified'` renders `[unverified]`. */
  variant: GroundingVariant;
  /**
   * The explainer body shown in the hover/focus bubble. Caller-supplied — this
   * component owns the portal/clamp/shimmer, not the copy. A `.gtip__k` kicker
   * (`Source` / `Unverified`) is rendered automatically above it.
   */
  explainer: ReactNode;
  /** Optional override for the shimmer label glyph; defaults to `[source]` / `[unverified]`. */
  children?: ReactNode;
  /** Pin the explainer open (uncontrolled initial state) — useful for docs/specimens. */
  defaultOpen?: boolean;
}

/** Hover-open delay; focus opens immediately (Radix). */
const HOVER_DELAY_MS = 200;

const DEFAULT_LABEL: Record<GroundingVariant, string> = {
  source: "[source]",
  unverified: "[unverified]",
};

/** Kicker shown above the explainer, matching the oracle `.gtip__k`. */
const KICKER: Record<GroundingVariant, string> = {
  source: "Source",
  unverified: "Unverified",
};

/**
 * Bubble (`.gtip-*`) modifier. The shipped naming is intentionally split: the
 * SHIMMER classes are `.ground-wave--source` / `.ground-wave--unverified`, but the
 * BUBBLE descendant-coloring classes are `.gtip--cited` / `.gtip--unverified`
 * ('cited' is the 'source' semantic). So `variant='source'` → `.gtip--cited`.
 * (There is no `.ground-wave--cited` or `.gtip--source`.)
 */
const TIP_MODIFIER: Record<GroundingVariant, string> = {
  source: "gtip--cited",
  unverified: "gtip--unverified",
};

export function GroundingFlag({ variant, explainer, children, defaultOpen }: GroundingFlagProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={HOVER_DELAY_MS}>
      <TooltipPrimitive.Root defaultOpen={defaultOpen ?? false}>
        <TooltipPrimitive.Trigger asChild>
          {/* .gwrap = focusable trigger wrapper; .ground-wave = the inner shimmer
              label (nested per the oracle, so the gradient text-clip runs on a
              plain inline span, not a flex container). */}
          <span className="gwrap" tabIndex={0}>
            <span className={`ground-wave ground-wave--${variant}`}>
              {children ?? DEFAULT_LABEL[variant]}
            </span>
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={`gtip-pop ${TIP_MODIFIER[variant]}`}
            side="top"
            sideOffset={8}
            collisionPadding={8}
          >
            <span className="gtip__k">{KICKER[variant]}</span>
            {explainer}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
