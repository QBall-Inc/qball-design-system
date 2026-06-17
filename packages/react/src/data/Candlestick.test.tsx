import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { componentsCss, ruleBody } from "../test-utils/css-source";
import { Candlestick, type CandlestickDatum } from "./Candlestick";

// 4 bars, 2 up / 2 down — exercises both .trend-up and .trend-down candle classes.
const DATA: CandlestickDatum[] = [
  { date: new Date("2026-04-01"), open: 100, high: 105, low: 99, close: 104 }, // up
  { date: new Date("2026-04-02"), open: 104, high: 106, low: 101, close: 102 }, // down
  { date: new Date("2026-04-03"), open: 102, high: 108, low: 102, close: 107 }, // up
  { date: new Date("2026-04-04"), open: 107, high: 107, low: 103, close: 104 }, // down
];

describe("Candlestick", () => {
  it("renders an SVG with one candle group per datum (AC initial render)", () => {
    const { container } = render(<Candlestick data={DATA} width={400} height={240} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    // one candle <g> per bar
    expect(container.querySelectorAll("g.trend-up, g.trend-down")).toHaveLength(DATA.length);
    // each candle has a wick <line> + a body <rect>
    expect(container.querySelectorAll("g.trend-up line, g.trend-down line").length).toBeGreaterThan(
      0,
    );
    expect(container.querySelectorAll("g.trend-up rect, g.trend-down rect").length).toBeGreaterThan(
      0,
    );
  });

  it("colors candles with the shipped token classes — up=.trend-up, down=.trend-down (AC-3 / FR4)", () => {
    const { container } = render(<Candlestick data={DATA} width={400} height={240} />);
    // 2 up + 2 down bars → both classes present (color is the token, not hardcoded hex)
    expect(container.querySelectorAll("g.trend-up")).toHaveLength(2);
    expect(container.querySelectorAll("g.trend-down")).toHaveLength(2);
    // the candle geometry draws with currentColor, so the class IS the color source
    const wick = container.querySelector("g.trend-up line");
    expect(wick?.getAttribute("stroke")).toBe("currentColor");
  });

  it("the .trend-{up,down} classes it relies on resolve to the data tokens (CSS-source contract)", () => {
    // jsdom does not apply external CSS, so assert the shipped rule body directly.
    expect(ruleBody(componentsCss, ".trend-up")).toContain("var(--data-up)");
    expect(ruleBody(componentsCss, ".trend-down")).toContain("var(--data-down)");
  });

  it("leaks no listeners on unmount — cleanup nulls handlers and clears the SVG (AC-7 / RB-4)", () => {
    const removeSpy = vi.spyOn(EventTarget.prototype, "removeEventListener");
    const { container, unmount } = render(
      <Candlestick data={DATA} width={400} height={240} interactive />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    // interactive mode drew a crosshair + a pointer overlay
    expect(container.querySelector(".crosshair")).not.toBeNull();
    expect(svg?.childElementCount).toBeGreaterThan(0);

    unmount();

    // cleanup cleared the SVG subtree...
    expect(svg?.childElementCount).toBe(0);
    // ...and explicitly nulled the pointer listeners (d3 .on(type, null) → removeEventListener)
    const removedTypes = removeSpy.mock.calls.map((c) => c[0]);
    expect(removedTypes).toContain("pointermove");
    expect(removedTypes).toContain("pointerleave");
    removeSpy.mockRestore();
  });

  it("re-keys the D3 draw when the theme prop changes (AC-6 / AC-8 redraw)", () => {
    const onDraw = vi.fn();
    const { rerender } = render(
      <Candlestick data={DATA} width={400} height={240} theme="light" onDraw={onDraw} />,
    );
    expect(onDraw).toHaveBeenCalledTimes(1);
    // a host theme flip re-runs the keyed effect (cleanup + fresh draw) exactly once more
    rerender(<Candlestick data={DATA} width={400} height={240} theme="dark" onDraw={onDraw} />);
    expect(onDraw).toHaveBeenCalledTimes(2);
  });

  it("invokes onRangeChange with the selected range when a toggle is pressed (AC-5)", async () => {
    const onRangeChange = vi.fn();
    const { getByRole } = render(
      <Candlestick
        data={DATA}
        width={400}
        height={240}
        range="1M"
        ranges={["1D", "1M", "1Y"]}
        onRangeChange={onRangeChange}
      />,
    );
    // the active range is pressed
    expect(getByRole("button", { name: "1M" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(getByRole("button", { name: "1Y" }));
    expect(onRangeChange).toHaveBeenCalledWith("1Y");
  });

  it("omits the interactive layer in compact mode (interactive=false)", () => {
    const { container } = render(
      <Candlestick data={DATA} width={300} height={170} interactive={false} showAxis />,
    );
    // candles still drawn...
    expect(container.querySelectorAll("g.trend-up, g.trend-down")).toHaveLength(DATA.length);
    // ...but no crosshair / pointer overlay
    expect(container.querySelector(".crosshair")).toBeNull();
  });

  it("renders a safe, empty chart for empty data (no throw)", () => {
    const { container } = render(<Candlestick data={[]} width={400} height={240} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("g.trend-up, g.trend-down")).toHaveLength(0);
  });

  it("renders a single bar with a zero-width price domain without throwing (CR-04 guard)", () => {
    // open=high=low=close → a [X, X] price domain; the domain guard must pad it.
    const flat: CandlestickDatum[] = [
      { date: new Date("2026-04-01"), open: 50, high: 50, low: 50, close: 50 },
    ];
    const { container } = render(<Candlestick data={flat} width={400} height={240} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelectorAll("g.trend-up, g.trend-down")).toHaveLength(1);
  });
});
