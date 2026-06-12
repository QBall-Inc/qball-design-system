import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("renders a text <input> carrying the shipped .input class by default", () => {
    const { getByRole } = render(<Input placeholder="you@somewhere.com" />);
    const input = getByRole("textbox") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
    expect(input.className.split(" ")).toContain("input");
  });

  it("numeric variant adds the .num class and a decimal keypad", () => {
    const { getByRole } = render(<Input numeric aria-label="Threshold" defaultValue="200.00" />);
    const input = getByRole("textbox") as HTMLInputElement;
    expect(input.className.split(" ")).toContain("input");
    expect(input.className.split(" ")).toContain("num");
    expect(input.getAttribute("inputmode")).toBe("decimal");
  });

  it("aria-invalid applies the .input--error class and sets the DOM attribute", () => {
    const { getByRole } = render(<Input aria-label="Email" aria-invalid />);
    const input = getByRole("textbox");
    expect(input.className.split(" ")).toContain("input--error");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("omits .input--error when valid", () => {
    const { getByRole } = render(<Input aria-label="Email" />);
    expect(getByRole("textbox").className.split(" ")).not.toContain("input--error");
  });

  it("passes aria-describedby and disabled through to the DOM", () => {
    const { getByRole } = render(<Input aria-label="Email" aria-describedby="help-1" disabled />);
    const input = getByRole("textbox") as HTMLInputElement;
    expect(input.getAttribute("aria-describedby")).toBe("help-1");
    expect(input.disabled).toBe(true);
  });

  it("forwards value/onChange (controlled)", () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Input aria-label="Ticker" value="NVDA" onChange={onChange} />);
    const input = getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("NVDA");
    fireEvent.change(input, { target: { value: "AAPL" } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
