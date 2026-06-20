import type { ReactNode } from "react";

/**
 * ToolUseIndicator — the compact, inline lifecycle chip for a skill / tool call
 * inside the AI terminal transcript (the WP-B-4.1a `Terminal`). It names the
 * specific skill (`news-research`, `sec-filings-lookup`, …) and reports the state
 * of its run, so a multi-second tool call never reads as a hang.
 *
 * Built to the WP-B-4.3 **owner-signed-off** design spec
 * (`docs/tool-use-indicator-design.md`) + `preview/tool-use-indicator.html`. It is a
 * transient, status-bearing chip — it reports state, it is NOT a control.
 *
 * **All visuals come from the shipped `@qball-inc/tokens` `.tuf*` classes** (added in
 * WP-B-4.4 from the signed-off design — the Terminal/GroundingFlag token-CSS-port
 * precedent). `data-state` drives the per-state color + tint; the color flows to the
 * leading glyph + verb via `currentColor`. There is no component CSS and no hardcoded
 * color (FR4 / DESIGN_DENY-clean — flat tonal tints, no elevation).
 *
 * **Glyph = the primary non-color cue (FR4).** Each state carries a distinct leading
 * glyph — an inline SVG (Lucide geometry, stroke 1.5, 16px; matching the ThemeToggle /
 * StateFig inline-SVG precedent, NOT a `lucide-react` import) — except `running`, which
 * reuses the shipped `.spinner` (the one sanctioned loop) or, in `streaming` mode, the
 * shipped `.term__cursor` blink. `partial` (caution gold) ALWAYS pairs its color with
 * the glyph AND the literal verb word, so color never carries the meaning alone.
 *
 * **Reduced-motion is shipped CSS, not JS.** The `.spinner`, `.term__cursor`, and `.tuf`
 * appear/cross-fade all stop under `@media (prefers-reduced-motion: reduce)` in the token
 * stylesheet; the state stays fully legible from the static glyph + color + label. There
 * is no `matchMedia` in here (the Skeleton / GroundingFlag contract).
 *
 * `idle` renders nothing — the chip is absent/collapsed (the approved "absent or
 * collapsed" latitude); no looping idle animation.
 *
 *   <ToolUseIndicator state="running" skill="news-research" meta="3.1s" />
 *   <ToolUseIndicator state="partial" skill="news-research" meta="rate-limited" />
 *   <ToolUseIndicator state="running" streaming>analyzing filings</ToolUseIndicator>
 */

export type ToolUseState = "idle" | "pending" | "running" | "success" | "error" | "partial";

export interface ToolUseIndicatorProps {
  /** Lifecycle state. `idle` renders nothing (the chip is absent/collapsed). */
  state: ToolUseState;
  /** The skill / tool id, e.g. `"news-research"`. Rendered before the state verb. */
  skill?: string;
  /**
   * Override the state verb (the default per state: queued / running / done /
   * failed / partial). Ignored when `children` supplies a free-form label. For
   * `state="partial"`, keep a caution word ("partial" / "rate-limited") so the
   * FR4 non-color cue survives — the glyph is always present, but the word
   * reinforces it; never suppress the text cue entirely.
   */
  verb?: string;
  /** Optional trailing meta — elapsed time, result count, or `"rate-limited"`. */
  meta?: ReactNode;
  /**
   * `running` only: render the streaming text-cursor (the shipped `.term__cursor`)
   * after the label instead of the leading `.spinner` glyph — for the
   * SSE-token-streaming variant.
   */
  streaming?: boolean;
  /**
   * Free-form label override (e.g. `"analyzing filings"`). When supplied, it
   * replaces the constructed `{skill} · {verb}` label. `null`/`undefined` both
   * fall through to the constructed label, so a conditional `children` never
   * yields an empty chip.
   */
  children?: ReactNode;
  /** Merged onto the `.tuf` root. */
  className?: string;
}

/** Default state verb when `verb` / `children` are not supplied. */
const DEFAULT_VERB: Record<Exclude<ToolUseState, "idle">, string> = {
  pending: "queued",
  running: "running",
  success: "done",
  error: "failed",
  partial: "partial",
};

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Inline status glyphs (Lucide geometry, copied from the signed-off preview oracle). */
function ClockGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

function ErrorGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

function PartialGlyph() {
  return (
    <svg {...SVG_PROPS}>
      <path d="M12 4.5 2.7 20h18.6L12 4.5Z" />
      <path d="M12 10v4.6" />
      <path d="M12 17.7v.01" />
    </svg>
  );
}

/**
 * The leading glyph for a state. `running` (non-streaming) reuses the shipped
 * `.spinner`; `running` + `streaming` has no leading glyph (the `.term__cursor`
 * trails the label instead). Returns `null` when no leading glyph applies.
 */
function leadingGlyph(state: Exclude<ToolUseState, "idle">, streaming: boolean): ReactNode {
  switch (state) {
    case "pending":
      return <ClockGlyph />;
    case "running":
      return streaming ? null : <span className="spinner spinner--sm" aria-hidden />;
    case "success":
      return <CheckGlyph />;
    case "error":
      return <ErrorGlyph />;
    case "partial":
      return <PartialGlyph />;
  }
}

export function ToolUseIndicator({
  state,
  skill,
  verb,
  meta,
  streaming = false,
  children,
  className,
}: ToolUseIndicatorProps) {
  // idle: the chip is absent/collapsed — no active indicator (approved latitude).
  if (state === "idle") return null;

  const glyph = leadingGlyph(state, streaming);
  const resolvedVerb = verb ?? DEFAULT_VERB[state];
  const cls = ["tuf", className].filter(Boolean).join(" ");

  return (
    // role=status: announce the async tool call's lifecycle politely to assistive
    // tech (pending → running → success/error) from the visible text label.
    // (aria-busy is intentionally not on the chip — it lives on the parent
    // Terminal region, which owns the "a response is in progress" state.)
    <span className={cls} data-state={state} role="status">
      {glyph !== null ? <span className="tuf__glyph">{glyph}</span> : null}
      <span className="tuf__label">
        {children ?? (
          <>
            {skill !== undefined && skill !== "" ? `${skill} · ` : null}
            <span className="tuf__verb">{resolvedVerb}</span>
          </>
        )}
        {state === "running" && streaming ? <span className="term__cursor" aria-hidden /> : null}
      </span>
      {meta !== undefined ? <span className="tuf__meta">{meta}</span> : null}
    </span>
  );
}
