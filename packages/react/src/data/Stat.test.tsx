import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stat } from "./Stat";

describe("Stat", () => {
  it("renders direction='up' with the ▲ non-color cue and the --up delta color class (AC-12a/FR4)", () => {
    const { container } = render(<Stat value="1,024.88" direction="up" delta="+8.4%" />);
    const delta = container.querySelector(".stat__delta");
    expect(delta).not.toBeNull();
    expect(delta?.className.split(" ")).toContain("stat__delta--up");
    // The ▲ glyph is the non-color cue — color is never the sole signal.
    expect(delta?.textContent).toContain("▲");
    expect(delta?.textContent).toContain("+8.4%");
  });

  it("renders direction='down' with the ▼ cue", () => {
    const { container } = render(<Stat value="178.10" direction="down" delta="−4.7%" />);
    const delta = container.querySelector(".stat__delta--down");
    expect(delta?.textContent).toContain("▼");
  });

  it("renders direction='flat' with the — cue", () => {
    const { container } = render(<Stat value="0.00" direction="flat" delta="flat" />);
    const delta = container.querySelector(".stat__delta--flat");
    expect(delta?.textContent).toContain("—");
  });

  it("renders '—' (em dash) when value is null — NEVER '0' (AC-12b)", () => {
    const { container } = render(<Stat value={null} />);
    const value = container.querySelector(".stat__value");
    expect(value?.textContent).toBe("—");
    expect(value?.textContent).not.toBe("0");
  });

  it("renders '—' (em dash) when value is undefined (AC-12c)", () => {
    const { container } = render(<Stat value={undefined} />);
    expect(container.querySelector(".stat__value")?.textContent).toBe("—");
  });

  it("renders the literal '0' when value is 0 — zero is data, not missing", () => {
    const { container } = render(<Stat value={0} />);
    const value = container.querySelector(".stat__value");
    expect(value?.textContent).toBe("0");
    expect(value?.textContent).not.toBe("—");
  });

  it("renders label, value, and unit on the shipped .stat anatomy", () => {
    const { container } = render(<Stat label="NVDA · Last" value="1,024.88" unit="%" />);
    expect(container.querySelector(".stat__label")?.textContent).toBe("NVDA · Last");
    expect(container.querySelector(".stat__value")?.textContent).toBe("1,024.88");
    expect(container.querySelector(".stat__unit")?.textContent).toBe("%");
  });

  it("omits the delta entirely when direction is not set", () => {
    const { container } = render(<Stat value="42" />);
    expect(container.querySelector(".stat__delta")).toBeNull();
  });

  it("renders the optional foot and spark slots", () => {
    const { container } = render(
      <Stat value="42" foot="Day range" spark={<svg data-testid="spark" />} />,
    );
    expect(container.querySelector(".stat__foot")?.textContent).toBe("Day range");
    expect(container.querySelector(".stat__spark [data-testid='spark']")).not.toBeNull();
  });
});
