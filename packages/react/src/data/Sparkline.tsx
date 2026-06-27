import type { ReactNode } from "react";

/**
 * Sparkline — a tiny inline trend chart, drawn as a pure hand-authored SVG
 * `<polyline>` over the shipped `@qball-inc/tokens` `.sparkline` wrapper, matching
 * the `preview/stats-meters.html` oracle (and the in-context sparks in the
 * app-chrome previews).
 *
 * **No chart library (BINDING).** The geometry is computed inline (min/max
 * normalization to a viewport + linear interpolation between points). Recharts,
 * D3, Victory, Chart.js, etc. are NOT imported — and although `d3` is an optional
 * peerDependency of `@qball-inc/react` (for the Candlestick), the
 * Sparkline must NOT pull it in: it is a lightweight atom.
 *
 * **Color comes from `direction`, never from the data (BINDING, FR4 / RB-8).** The
 * stroke color is applied via the shipped `.trend-{up,down,flat}` helper class
 * (which sets `color: var(--data-{up,down,flat})`) with `stroke="currentColor"`,
 * so there is no hardcoded hex and no inline color. The `direction` prop is the
 * single source of truth — the color is deliberately NOT computed from `data[0]`
 * vs `data[last]`, which could contradict an explicit prop on stale/out-of-order
 * data. `direction` IS the directional cue the finance-color-plus-cue rule
 * requires (a parent embedding the spark should still pair it with a label/arrow).
 *
 * **Degenerate data renders safely.** Empty data, a single point, or an
 * all-identical (genuinely flat) series cannot form a trend line, so the geometry
 * collapses to a horizontal line at the vertical midpoint — a valid SVG, never a
 * throw. The color still follows `direction` (pass `direction="flat"` for a flat
 * series). There is no `box-shadow` anywhere (FR4).
 */

export type SparklineDirection = "up" | "down" | "flat";

export interface SparklineProps {
  /** The series to plot. Empty / single-point / all-identical renders a flat midline. */
  data: number[];
  /**
   * Trend direction — the SOLE source of the stroke color (`.trend-{up,down,flat}`
   * → `var(--data-{up,down,flat})`). Never computed from `data` (BINDING FR4).
   */
  direction: SparklineDirection;
  /** Accessible name for the `role="img"` SVG (required — an unlabeled graphic is an a11y violation). */
  ariaLabel: string;
  /** Optional caption shown under the spark (`.sparkline__cap`, e.g. "NVDA · 30d"). */
  caption?: ReactNode;
  /** SVG viewport width in user units. Default 64 (a compact inline size; override for a larger context — the oracle uses 90–150). */
  width?: number;
  /** SVG viewport height in user units. Default 20 (override to ~30 for the oracle's standalone spark). */
  height?: number;
  /** className merged onto the `.sparkline` wrapper. */
  className?: string;
}

// Stroke breathing room (user units) so the 1.5-wide line never clips at the edges.
const PAD = 2;
// Matches the oracle's spark stroke (preview/stats-meters.html / app-chrome).
const STROKE_WIDTH = 1.6;

/** Round to 2dp and stringify — keeps the points attribute tidy + deterministic. */
function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/**
 * Build the `<polyline>` points string. Empty / single-point / zero-range data
 * collapses to a horizontal midline (no trend can be drawn). Higher values map to
 * a smaller y (SVG y grows downward), so the line reads like a chart.
 */
function buildPoints(data: number[], width: number, height: number): string {
  const midY = height / 2;
  const flat = `${round(PAD)},${round(midY)} ${round(width - PAD)},${round(midY)}`;

  // Drop non-finite values (NaN/Infinity — e.g. gaps in a real series) before
  // normalizing; with fewer than 2 finite points no trend can be drawn.
  const finite = data.filter((n) => Number.isFinite(n));
  if (finite.length < 2) return flat;

  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min;
  if (range === 0) return flat;

  const usableW = width - PAD * 2;
  const usableH = height - PAD * 2;
  return finite
    .map((v, i) => {
      const x = PAD + (i / (finite.length - 1)) * usableW;
      const y = PAD + (1 - (v - min) / range) * usableH;
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}

export function Sparkline({
  data,
  direction,
  ariaLabel,
  caption,
  width = 64,
  height = 20,
  className,
}: SparklineProps) {
  const wrapCls = ["sparkline", className].filter(Boolean).join(" ");
  const points = buildPoints(data, width, height);
  return (
    <span className={wrapCls}>
      <svg
        className={`trend-${direction}`}
        role="img"
        aria-label={ariaLabel}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {caption !== undefined ? <span className="sparkline__cap">{caption}</span> : null}
    </span>
  );
}
