import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

/**
 * Candlestick — a finance OHLC candlestick chart drawn with **D3** as a React
 * "island", matching the `preview/chart-candlestick-color.html` (color) and
 * `preview/chart-candlestick-chrome.html` (compact vs. detail chrome) oracles.
 *
 * **D3 owns the SVG subtree; React never reconciles its children (BINDING, RB-4).**
 * All drawing happens inside a single `useEffect` keyed on
 * `[data, range, theme, width, height, interactive, showGrid, showAxis]`. The
 * effect's cleanup nulls every registered listener (`.on(type, null)`),
 * interrupts any running transition, and clears the SVG (`selectAll('*').remove()`)
 * so no D3 selection, event handler, or timer survives an unmount or a re-key —
 * the no-leaked-listeners obligation. The only React-owned node is the HTML OHLC
 * tooltip rendered OUTSIDE the `<svg>`.
 *
 * **No charting library but D3 (BINDING).** Recharts/Victory/Chart.js are NOT
 * imported. `d3` is an OPTIONAL peerDependency of `@qball-inc/react` (it is large,
 * ~580 KB, and consumers that already ship D3 must not double-bundle it). A
 * consumer that renders `Candlestick` must install `d3` themselves; the optional
 * meta only suppresses the install warning — it does not make the chart work
 * without D3.
 *
 * **Color comes from tokens, never hardcoded hex (BINDING, FR4 / RB-8).** Up
 * candles (close ≥ open) carry the shipped `.trend-up` class, down candles
 * `.trend-down` (both set `color: var(--data-{up,down})`); the wick + body draw
 * with `currentColor`, so the candle color is the token, theme-aware via the
 * ambient `[data-theme]` cascade — exactly the Sparkline mechanism. Axes, grid,
 * crosshair, and the SVG frame are styled inline with `var(--token)` references
 * (`--text-muted`, `--border-default`, `--bg-surface`, …), so there is no
 * hardcoded color anywhere and no component CSS is added to `@qball-inc/tokens`.
 *
 * **Color is never the sole finance signal (FR4).** The OHLC tooltip pairs the
 * up/down color with a directional `▲`/`▼` arrow and a signed change value, so the
 * direction reads without relying on color perception.
 *
 * **Controlled `range`; `theme` is a redraw signal.** `range` is a controlled prop
 * — the range toggle calls `onRangeChange(next)` and the parent re-passes `range`
 * (the component never mutates a passed `range`). The `theme` prop does not carry
 * the palette (the tokens do, via `[data-theme]`); it is a dependency of the draw
 * effect so a host theme flip re-keys the redraw (AC-6/AC-8) and no stale
 * JS-derived value survives.
 *
 * **Degenerate data renders safely.** Empty or single-point data draws an empty,
 * valid `<svg>` (axes/candles are skipped) rather than throwing.
 */

/** A discrete time range the chart can be toggled between. */
export type CandlestickRange = "1D" | "5D" | "1M" | "3M" | "1Y";

/** One OHLCV bar. Price fields are in the instrument's quote currency. */
export interface CandlestickDatum {
  /** Bar timestamp — a `Date` or any `Date`-parseable string (e.g. ISO 8601). */
  date: Date | string;
  /** Opening price. @unit quote currency (e.g. USD) */
  open: number;
  /** Session high. @unit quote currency (e.g. USD) */
  high: number;
  /** Session low. @unit quote currency (e.g. USD) */
  low: number;
  /** Closing price. @unit quote currency (e.g. USD) */
  close: number;
  /** Traded volume (optional; not plotted in v1). @unit shares */
  volume?: number;
}

export interface CandlestickProps {
  /** The OHLC series, oldest-first. Empty / single-point renders a safe empty chart. */
  data: CandlestickDatum[];
  /** The selected range (controlled). The toggle calls `onRangeChange`; the parent re-passes this. */
  range?: CandlestickRange;
  /** Which range toggles to render. Default: all five. Pass `[]` to hide the toggle row. */
  ranges?: CandlestickRange[];
  /** Called when a range toggle is pressed, with the selected range. */
  onRangeChange?: (range: CandlestickRange) => void;
  /**
   * Redraw signal. The tokens own the palette (via `[data-theme]`); this prop is a
   * draw-effect dependency so a host theme flip re-keys the redraw. Optional.
   */
  theme?: "light" | "dark";
  /** Explicit SVG viewport width (user units). Omit to fill the container via `ResizeObserver`. */
  width?: number;
  /** SVG viewport height (user units). Default 300. */
  height?: number;
  /** Crosshair + OHLC tooltip on pointer. Default `true`. `false` = the compact, static card view. */
  interactive?: boolean;
  /** Draw the dashed horizontal grid. Default: follows `interactive`. */
  showGrid?: boolean;
  /** Draw the price + date axes. Default `true`. `false` = bare candles (inline preview). */
  showAxis?: boolean;
  /** Accessible name for the chart's `role="img"` SVG. Default `"Candlestick chart"`. */
  ariaLabel?: string;
  /** Called after every (re)draw completes — useful for redraw assertions / screenshot timing. */
  onDraw?: () => void;
  /** className merged onto the `.candlestick` figure wrapper. */
  className?: string;
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 300;
const ALL_RANGES: CandlestickRange[] = ["1D", "5D", "1M", "3M", "1Y"];
/** Plot margins (user units): top, right, bottom (date axis), left (price axis). */
const MARGIN = { top: 14, right: 10, bottom: 22, left: 34 } as const;
/** Minimum candle-body height so a doji (open ≈ close) is still visible. */
const MIN_BODY_HEIGHT = 1.2;

/** Internal, fully-resolved bar (date coerced to `Date`). */
interface Bar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Coerce a datum's `date` to a `Date`; drop bars with an unparseable date or non-finite prices. */
function normalize(data: CandlestickDatum[]): Bar[] {
  const out: Bar[] = [];
  for (const d of data) {
    const date = d.date instanceof Date ? d.date : new Date(d.date);
    if (Number.isNaN(date.getTime())) continue;
    if (![d.open, d.high, d.low, d.close].every((n) => Number.isFinite(n))) continue;
    out.push({ date, open: d.open, high: d.high, low: d.low, close: d.close });
  }
  return out;
}

/** Hovered-bar state for the React-owned tooltip + the snapped crosshair position. */
interface Hover {
  index: number;
  /** Candle-center x in SVG user units. */
  cx: number;
  /** Close-price y in SVG user units. */
  cy: number;
}

export function Candlestick({
  data,
  range,
  ranges = ALL_RANGES,
  onRangeChange,
  theme,
  width: widthProp,
  height: heightProp,
  interactive = true,
  showGrid,
  showAxis = true,
  ariaLabel = "Candlestick chart",
  onDraw,
  className,
}: CandlestickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const bars = useMemo(() => normalize(data), [data]);

  // d3 formatters are created lazily in the component body, NOT at module scope, so
  // merely importing the barrel never invokes the optional `d3` peer — only rendering
  // <Candlestick> does (a consumer who imports e.g. Button without installing d3 is
  // unaffected). Stable identity via useMemo so they never re-key the draw effect.
  const fmt = useMemo(
    () => ({ date: d3.timeFormat("%b %d"), price: d3.format(".2f"), axis: d3.format("~s") }),
    [],
  );

  // Stable ref to `onDraw` so an inline `onDraw={() => …}` prop does not re-key the
  // draw effect (which would tear down + redraw on every parent render).
  const onDrawRef = useRef(onDraw);
  useEffect(() => {
    onDrawRef.current = onDraw;
  }, [onDraw]);

  const width = widthProp ?? measuredWidth ?? DEFAULT_WIDTH;
  const height = heightProp ?? DEFAULT_HEIGHT;
  const grid = showGrid ?? interactive;

  // Container-fill sizing (AC-1): when no explicit width is given, observe the
  // wrapper and redraw on resize. Own cleanup disconnects the observer (RB-4).
  useEffect(() => {
    if (widthProp != null) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr && cr.width > 0) setMeasuredWidth(cr.width);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, [widthProp]);

  // The D3 island. Keyed on every input that changes the drawing so a re-key tears
  // down (cleanup) and redraws from scratch — React never touches the SVG children.
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3
      .select(svgEl)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
    svg.selectAll("*").remove();

    // The overlay rect carries the pointer listeners; held here so cleanup can null
    // them. Stays null when bars is empty or interactive=false — cleanup optional-chains.
    let overlay: d3.Selection<SVGRectElement, unknown, null, undefined> | null = null;

    if (bars.length > 0) {
      const plotBottom = height - MARGIN.bottom;
      const x = d3
        .scaleBand<number>()
        .domain(d3.range(bars.length))
        .range([MARGIN.left, width - MARGIN.right])
        .padding(0.3);
      const lo = d3.min(bars, (d) => d.low) ?? 0;
      const hi = d3.max(bars, (d) => d.high) ?? 1;
      // Guard a zero-width price domain (a single bar, or an all-equal series): a
      // [X, X] domain collapses every price onto one pixel. Pad it (mirrors the
      // Sparkline range===0 safety) so candles + the crosshair stay legible.
      const pad = lo === hi ? Math.abs(lo) * 0.05 || 1 : 0;
      const y = d3
        .scaleLinear()
        .domain([lo - pad, hi + pad])
        .nice()
        .range([plotBottom, MARGIN.top]);
      const bw = x.bandwidth();
      const cxOf = (i: number) => (x(i) ?? 0) + bw / 2;

      // Dashed horizontal grid (token border color).
      if (grid) {
        svg
          .append("g")
          .selectAll("line")
          .data(y.ticks(4))
          .join("line")
          .attr("x1", MARGIN.left)
          .attr("x2", width - MARGIN.right)
          .attr("y1", (d) => y(d))
          .attr("y2", (d) => y(d))
          .style("stroke", "var(--border-default)")
          .style("stroke-dasharray", "2 3");
      }

      // Axes (price left, date bottom); domain line removed to match the oracle.
      if (showAxis) {
        const everyN = Math.max(1, Math.ceil(bars.length / 5));
        const ay = svg
          .append("g")
          .attr("transform", `translate(${MARGIN.left},0)`)
          .call(
            d3
              .axisLeft(y)
              .ticks(5)
              .tickSize(0)
              .tickFormat((v) => fmt.axis(v as number)),
          );
        ay.select(".domain").remove();
        const ax = svg
          .append("g")
          .attr("transform", `translate(0,${plotBottom})`)
          .call(
            d3
              .axisBottom(x)
              .tickValues(x.domain().filter((_, i) => i % everyN === 0))
              .tickSize(0)
              .tickFormat((i) => {
                // `i` is already `number` for a scaleBand<number> domain (no cast needed).
                const b = bars[i];
                return b ? fmt.date(b.date) : "";
              }),
          );
        ax.select(".domain").remove();
        svg
          .selectAll<SVGTextElement, unknown>(".tick text")
          .style("fill", "var(--text-muted)")
          .style("font-family", "var(--font-display)")
          .style("font-size", "9.5px");
        svg
          .selectAll<SVGLineElement, unknown>(".tick line")
          .style("stroke", "var(--border-default)");
      }

      // Candles. The shipped `.trend-{up,down}` class sets `color: var(--data-*)`;
      // wick + body draw with `currentColor`, so candle color IS the token (FR4).
      const candle = svg
        .append("g")
        .selectAll<SVGGElement, Bar>("g")
        .data(bars)
        .join("g")
        .attr("class", (d) => (d.close >= d.open ? "trend-up" : "trend-down"));
      candle
        .append("line")
        .attr("x1", (_, i) => cxOf(i))
        .attr("x2", (_, i) => cxOf(i))
        .attr("y1", (d) => y(d.high))
        .attr("y2", (d) => y(d.low))
        .attr("stroke", "currentColor")
        .attr("stroke-width", 1);
      candle
        .append("rect")
        .attr("x", (_, i) => x(i) ?? 0)
        .attr("y", (d) => y(Math.max(d.open, d.close)))
        .attr("width", bw)
        .attr("height", (d) => Math.max(MIN_BODY_HEIGHT, Math.abs(y(d.open) - y(d.close))))
        .attr("fill", "currentColor")
        .attr("stroke", "currentColor")
        .attr("stroke-width", 1);

      // Crosshair + pointer overlay (interactive/detail view only).
      if (interactive) {
        const crosshair = svg.append("g").attr("class", "crosshair").style("opacity", 0);
        const vline = crosshair
          .append("line")
          .attr("y1", MARGIN.top)
          .attr("y2", plotBottom)
          .style("stroke", "var(--text-muted)")
          .style("stroke-width", 1)
          .style("stroke-dasharray", "3 3");
        const hline = crosshair
          .append("line")
          .attr("x1", MARGIN.left)
          .attr("x2", width - MARGIN.right)
          .style("stroke", "var(--text-muted)")
          .style("stroke-width", 1)
          .style("stroke-dasharray", "3 3");
        const dot = crosshair
          .append("circle")
          .attr("r", 3.5)
          .style("fill", "none")
          .style("stroke", "var(--text-primary)")
          .style("stroke-width", 1.5);

        const nearestIndex = (mx: number) => {
          const raw = Math.round((mx - MARGIN.left - bw / 2) / x.step());
          return Math.max(0, Math.min(bars.length - 1, raw));
        };

        overlay = svg
          .append("rect")
          .attr("x", MARGIN.left)
          .attr("y", MARGIN.top)
          .attr("width", Math.max(0, width - MARGIN.right - MARGIN.left))
          .attr("height", Math.max(0, plotBottom - MARGIN.top))
          .attr("fill", "transparent")
          .style("cursor", "crosshair");
        overlay
          .on("pointermove", (event: PointerEvent) => {
            const [mx] = d3.pointer(event, svgEl);
            const index = nearestIndex(mx);
            const d = bars[index];
            if (!d) return;
            const cx = cxOf(index);
            const cy = y(d.close);
            crosshair.style("opacity", 1);
            vline.attr("x1", cx).attr("x2", cx);
            hline.attr("y1", cy).attr("y2", cy);
            dot.attr("cx", cx).attr("cy", cy);
            setHover((prev) => (prev?.index === index ? prev : { index, cx, cy }));
          })
          .on("pointerleave", () => {
            crosshair.style("opacity", 0);
            setHover(null);
          });
      }
    }

    onDrawRef.current?.();

    return () => {
      // RB-4 cleanup: null listeners, cancel transitions, clear the subtree. Also
      // drop hover so the pointermove listener can't queue a state update on a
      // torn-down component during the unmount window.
      setHover(null);
      overlay?.on("pointermove", null).on("pointerleave", null);
      svg.selectAll("*").interrupt();
      svg.selectAll("*").remove();
    };
  }, [bars, range, theme, width, height, interactive, grid, showAxis, fmt]);

  const hoverBar = hover ? bars[hover.index] : null;
  const change = hoverBar ? hoverBar.close - hoverBar.open : 0;
  const up = change >= 0;
  const pct = hoverBar && hoverBar.open !== 0 ? (change / hoverBar.open) * 100 : 0;
  // Snap the tooltip to the hovered candle (percent of the viewBox, so it tracks
  // the responsive SVG); flip to the left of the crosshair past the mid-line.
  const leftPct = hover ? (hover.cx / width) * 100 : 0;
  const flip = leftPct > 60;

  const wrapCls = ["candlestick", className].filter(Boolean).join(" ");

  return (
    <figure
      ref={containerRef}
      className={wrapCls}
      style={{
        position: "relative",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {ranges.length > 0 ? (
        <div className="segmented" role="group" aria-label="Time range">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => onRangeChange?.(r)}
            >
              {r}
            </button>
          ))}
        </div>
      ) : null}

      <svg
        ref={svgRef}
        role="img"
        aria-label={ariaLabel}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          border: ".5px solid var(--border-default)",
          borderRadius: "var(--radius-md)",
          background: "var(--bg-surface)",
        }}
      />

      {interactive && hover && hoverBar ? (
        <div
          role="tooltip"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${leftPct}%`,
            top: "8px",
            transform: flip ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
            pointerEvents: "none",
            minWidth: "118px",
            padding: "8px 10px",
            background: "var(--bg-primary)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-display)",
            fontSize: "11px",
            lineHeight: 1.5,
            color: "var(--text-secondary)",
            zIndex: 5,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "9.5px",
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "4px",
            }}
          >
            {fmt.date(hoverBar.date)}
          </div>
          {(["open", "high", "low", "close"] as const).map((k) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: "14px" }}>
              <span style={{ color: "var(--text-muted)" }}>{k.charAt(0).toUpperCase()}</span>
              <b style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {fmt.price(hoverBar[k])}
              </b>
            </div>
          ))}
          <div
            style={{
              marginTop: "4px",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              color: up ? "var(--data-up)" : "var(--data-down)",
            }}
          >
            {up ? "▲" : "▼"} {up ? "+" : ""}
            {fmt.price(change)} ({up ? "+" : ""}
            {pct.toFixed(2)}%)
          </div>
        </div>
      ) : null}
    </figure>
  );
}
