import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./Sparkline";

// The trend stroke color lives in the shipped @qball-inc/tokens CSS
// (.trend-{up,down,flat} → color: var(--data-*)), which jsdom does not load. So
// the direction→token mapping is asserted at the CSS-source contract level; the
// DOM tests assert the component applies the .trend-{direction} class and
// stroke="currentColor". vitest runs with cwd = packages/react.
const componentsCss = readFileSync(resolve(process.cwd(), "../tokens/components.css"), "utf8");

/** Returns the declaration body of the first `selector { ... }` rule, or "". */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? "";
}

describe("Sparkline", () => {
  it("renders an inline SVG with role=img and the aria-label", () => {
    const { getByRole } = render(
      <Sparkline data={[1, 2, 3]} direction="up" ariaLabel="AAPL 30-day trend" />,
    );
    const img = getByRole("img");
    expect(img.tagName.toLowerCase()).toBe("svg");
    expect(img.getAttribute("aria-label")).toBe("AAPL 30-day trend");
  });

  it("draws a polyline whose stroke is currentColor (no hardcoded color)", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} direction="up" ariaLabel="t" />);
    const line = container.querySelector("polyline");
    expect(line).not.toBeNull();
    expect(line?.getAttribute("stroke")).toBe("currentColor");
    expect(line?.getAttribute("points")).toBeTruthy();
    // No hex anywhere in the rendered SVG output.
    expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("keys the stroke off direction='up' via .trend-up (CSS contract → --data-up)", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} direction="up" ariaLabel="t" />);
    expect(container.querySelector("svg")?.classList.contains("trend-up")).toBe(true);
    expect(ruleBody(componentsCss, ".trend-up")).toMatch(/color:\s*var\(--data-up\)/);
  });

  it("keys the stroke off direction='down' via .trend-down (CSS contract → --data-down)", () => {
    const { container } = render(<Sparkline data={[3, 2, 1]} direction="down" ariaLabel="t" />);
    expect(container.querySelector("svg")?.classList.contains("trend-down")).toBe(true);
    expect(ruleBody(componentsCss, ".trend-down")).toMatch(/color:\s*var\(--data-down\)/);
  });

  it("keys the stroke off direction='flat' via .trend-flat (CSS contract → --data-flat)", () => {
    const { container } = render(<Sparkline data={[2, 2, 2]} direction="flat" ariaLabel="t" />);
    expect(container.querySelector("svg")?.classList.contains("trend-flat")).toBe(true);
    expect(ruleBody(componentsCss, ".trend-flat")).toMatch(/color:\s*var\(--data-flat\)/);
  });

  it("colors off the direction prop, NOT data order (descending data + up = up; BINDING FR4)", () => {
    // Descending data with direction='up' must still render the up color — proves
    // color is not derived from data[0] vs data[last].
    const { container } = render(<Sparkline data={[9, 5, 1]} direction="up" ariaLabel="t" />);
    const svg = container.querySelector("svg");
    expect(svg?.classList.contains("trend-up")).toBe(true);
    expect(svg?.classList.contains("trend-down")).toBe(false);
  });

  it("renders a flat midline for empty data without throwing", () => {
    const { container } = render(<Sparkline data={[]} direction="flat" ariaLabel="empty" />);
    const line = container.querySelector("polyline");
    expect(line).not.toBeNull();
    const pts = (line?.getAttribute("points") ?? "").trim().split(" ");
    expect(pts.length).toBe(2);
    // A horizontal line: both endpoints share the same y.
    expect(pts[0]?.split(",")[1]).toBe(pts[1]?.split(",")[1]);
  });

  it("renders a flat midline for a single point and for all-identical data", () => {
    const single = render(<Sparkline data={[5]} direction="flat" ariaLabel="one" />);
    const singlePts = (single.container.querySelector("polyline")?.getAttribute("points") ?? "")
      .trim()
      .split(" ");
    expect(singlePts[0]?.split(",")[1]).toBe(singlePts[1]?.split(",")[1]);

    const same = render(<Sparkline data={[4, 4, 4, 4]} direction="flat" ariaLabel="same" />);
    const samePts = (same.container.querySelector("polyline")?.getAttribute("points") ?? "")
      .trim()
      .split(" ");
    expect(samePts.length).toBe(2);
    expect(samePts[0]?.split(",")[1]).toBe(samePts[1]?.split(",")[1]);
  });

  it("plots one point per datum for a real series", () => {
    const { container } = render(<Sparkline data={[1, 4, 2, 8, 5]} direction="up" ariaLabel="t" />);
    const pts = (container.querySelector("polyline")?.getAttribute("points") ?? "")
      .trim()
      .split(" ");
    expect(pts.length).toBe(5);
  });

  it("renders the optional caption in .sparkline__cap", () => {
    const { container } = render(
      <Sparkline data={[1, 2]} direction="up" ariaLabel="t" caption="NVDA · 30d" />,
    );
    expect(container.querySelector(".sparkline__cap")?.textContent).toBe("NVDA · 30d");
  });
});
