import type { ReactNode } from "react";

/**
 * Stat — a single metric tile, painted with the shipped `@qball-inc/tokens`
 * `.stat` classes from the `preview/stats-meters.html` oracle.
 *
 * A label, the main figure (Berkeley Mono tabular display font via `.stat__value`),
 * an optional unit, an optional delta with a finance-direction treatment, and
 * optional foot/sparkline slots. Every visual comes from the token CSS — `.stat`
 * + `.stat__{label,row,value,unit,delta,foot,spark}` + the `--up/--down/--flat`
 * delta modifiers; there is no component CSS, no hardcoded color, no box-shadow.
 *
 * Two binding rules from DESIGN.md (FR4):
 * - **Missing value renders '—'.** When `value` is `null` or `undefined` the figure
 *   renders '—' (U+2014 EM DASH) — NEVER '0', an empty string, or any other
 *   placeholder. A stat with no data must read as "no data", not "zero".
 * - **Finance color is always paired with a non-color cue.** The delta direction
 *   drives both the `.stat__delta--{up,down,flat}` color AND a leading ▲/▼/—
 *   glyph, so color is never the sole signal (RB-8). Matches the oracle's
 *   '▲ +8.4%' / '▼ −4.7%' / '— flat'.
 */

export type StatDirection = "up" | "down" | "flat";

export interface StatProps {
  /** Eyebrow label (`.stat__label`). Optional. */
  label?: ReactNode;
  /**
   * The main figure (`.stat__value`). `null`/`undefined` renders '—' (EM DASH),
   * never '0'. Numbers render as-is; pre-format (thousands separators, etc.) upstream.
   */
  value: number | string | null | undefined;
  /** Optional unit suffix (`.stat__unit`, e.g. '%'). */
  unit?: ReactNode;
  /**
   * Delta direction. Drives the `.stat__delta--*` finance color AND the ▲/▼/—
   * non-color cue (FR4). Omit for a stat with no change indicator.
   */
  direction?: StatDirection;
  /** Delta text shown after the directional cue (e.g. '+8.4%'). Rendered only when `direction` is set. */
  delta?: ReactNode;
  /** Footnote (`.stat__foot`). Optional. */
  foot?: ReactNode;
  /** Inline sparkline slot (`.stat__spark`). Optional (e.g. a future <Sparkline>). */
  spark?: ReactNode;
  /** className merged onto the `.stat` root. */
  className?: string;
}

// ▲/▼/— is the non-color directional cue paired with --data-up/down/flat (FR4 /
// RB-8): finance color is never the sole signal. Geometric glyphs (not emoji),
// matching the stats-meters.html oracle.
const DELTA_CUE: Record<StatDirection, string> = { up: "▲", down: "▼", flat: "—" };

// U+2014 EM DASH — the missing-value render. NEVER '0' or ''.
const EM_DASH = "—";

export function Stat({ label, value, unit, direction, delta, foot, spark, className }: StatProps) {
  const cls = ["stat", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      {label !== undefined ? <span className="stat__label">{label}</span> : null}
      <div className="stat__row">
        <span className="stat__value">{value == null ? EM_DASH : value}</span>
        {unit !== undefined ? <span className="stat__unit">{unit}</span> : null}
        {direction !== undefined ? (
          <span className={`stat__delta stat__delta--${direction}`}>
            <span>{DELTA_CUE[direction]}</span>
            {delta !== undefined ? <span>{delta}</span> : null}
          </span>
        ) : null}
      </div>
      {spark !== undefined ? <span className="stat__spark">{spark}</span> : null}
      {foot !== undefined ? <span className="stat__foot">{foot}</span> : null}
    </div>
  );
}
