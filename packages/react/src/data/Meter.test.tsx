import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Meter } from "./Meter";

describe("Meter", () => {
  it("renders the fill at the value/max percentage (AC-12d)", () => {
    const { container } = render(<Meter value={42} max={100} label="Tokens" />);
    const fill = container.querySelector<HTMLElement>(".meter__fill");
    expect(fill).not.toBeNull();
    // 42 / 100 -> 42% (rounded; no floating-point leak like 42.00000000000001%).
    expect(fill?.style.width).toBe("42%");
  });

  it("computes the percentage against a non-100 max", () => {
    const { container } = render(<Meter value={3} max={12} />);
    expect(container.querySelector<HTMLElement>(".meter__fill")?.style.width).toBe("25%");
  });

  it("renders the warn threshold variant without error (AC-12e)", () => {
    const { container } = render(<Meter value={86} max={100} variant="warn" />);
    expect(container.querySelector(".meter")?.className.split(" ")).toContain("meter--warn");
  });

  it("renders the over threshold variant", () => {
    const { container } = render(<Meter value={12} max={10} variant="over" />);
    expect(container.querySelector(".meter")?.className.split(" ")).toContain("meter--over");
  });

  it("clamps the fill to 0–100% when value exceeds max or is negative", () => {
    const over = render(<Meter value={150} max={100} />);
    expect(over.container.querySelector<HTMLElement>(".meter__fill")?.style.width).toBe("100%");
    const under = render(<Meter value={-20} max={100} />);
    expect(under.container.querySelector<HTMLElement>(".meter__fill")?.style.width).toBe("0%");
  });

  it("renders 0% (not NaN%) when max is 0 — guards against division by zero (F-02)", () => {
    const { container } = render(<Meter value={50} max={0} />);
    expect(container.querySelector<HTMLElement>(".meter__fill")?.style.width).toBe("0%");
  });

  it("defaults the readout to '{value} / {max}' and max to 100", () => {
    const { container } = render(<Meter value={42} label="Tokens this month" />);
    expect(container.querySelector(".meter__val")?.textContent).toBe("42 / 100");
    expect(container.querySelector(".meter__label")?.textContent).toBe("Tokens this month");
  });

  it("accepts a custom readout", () => {
    const { container } = render(<Meter value={42180} max={100000} readout="42,180 / 100,000" />);
    expect(container.querySelector(".meter__val")?.textContent).toBe("42,180 / 100,000");
  });

  it("exposes meter semantics on the track (role + aria-valuenow/min/max)", () => {
    const { container } = render(<Meter value={42} max={100} label="Tokens" />);
    const track = container.querySelector(".meter__track");
    expect(track?.getAttribute("role")).toBe("meter");
    expect(track?.getAttribute("aria-valuenow")).toBe("42");
    expect(track?.getAttribute("aria-valuemin")).toBe("0");
    expect(track?.getAttribute("aria-valuemax")).toBe("100");
    expect(track?.getAttribute("aria-label")).toBe("Tokens");
  });

  it("uses an explicit ariaLabel over the label, and omits aria-label for a non-string label (F-03)", () => {
    // Branch 1: explicit ariaLabel wins even when a string label is present.
    const explicit = render(<Meter value={42} label="Tokens" ariaLabel="Monthly token usage" />);
    expect(explicit.container.querySelector(".meter__track")?.getAttribute("aria-label")).toBe(
      "Monthly token usage",
    );
    // Branch 2: a non-string (JSX) label can't be an accessible name → no aria-label.
    const jsxLabel = render(<Meter value={42} label={<strong>Tokens</strong>} />);
    expect(
      jsxLabel.container.querySelector(".meter__track")?.getAttribute("aria-label"),
    ).toBeNull();
  });
});
