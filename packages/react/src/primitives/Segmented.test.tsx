import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Segmented, SegmentedItem } from "./Segmented";

describe("Segmented", () => {
  it("renders a role=group of contiguous aria-pressed buttons (min 2 items)", () => {
    const { getByRole, getAllByRole } = render(
      <Segmented defaultValue="above" aria-label="Alert direction">
        <SegmentedItem value="above">Above</SegmentedItem>
        <SegmentedItem value="below">Below</SegmentedItem>
      </Segmented>,
    );
    const group = getByRole("group", { name: "Alert direction" });
    expect(group.className.split(" ")).toContain("segmented");
    const buttons = getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => b.hasAttribute("aria-pressed"))).toBe(true);
  });

  it("starts with defaultValue pressed", () => {
    const { getByRole } = render(
      <Segmented defaultValue="below" aria-label="dir">
        <SegmentedItem value="above">Above</SegmentedItem>
        <SegmentedItem value="below">Below</SegmentedItem>
      </Segmented>,
    );
    expect(getByRole("button", { name: "Above" }).getAttribute("aria-pressed")).toBe("false");
    expect(getByRole("button", { name: "Below" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("exclusive selection: choosing an item presses it and unpresses the rest, firing onValueChange", () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      <Segmented defaultValue="above" onValueChange={onValueChange} aria-label="dir">
        <SegmentedItem value="above">Above</SegmentedItem>
        <SegmentedItem value="below">Below</SegmentedItem>
        <SegmentedItem value="either">Either</SegmentedItem>
      </Segmented>,
    );
    fireEvent.click(getByRole("button", { name: "Below" }));
    expect(onValueChange).toHaveBeenCalledWith("below");
    expect(getByRole("button", { name: "Below" }).getAttribute("aria-pressed")).toBe("true");
    expect(getByRole("button", { name: "Above" }).getAttribute("aria-pressed")).toBe("false");
    expect(getByRole("button", { name: "Either" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("no full-deselect: re-pressing the active item is a no-op (one item always stays pressed)", () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      <Segmented defaultValue="above" onValueChange={onValueChange} aria-label="dir">
        <SegmentedItem value="above">Above</SegmentedItem>
        <SegmentedItem value="below">Below</SegmentedItem>
      </Segmented>,
    );
    fireEvent.click(getByRole("button", { name: "Above" }));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(getByRole("button", { name: "Above" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("controlled value: parent owns selection; onValueChange still fires on a different item", () => {
    const onValueChange = vi.fn();
    const { getByRole } = render(
      <Segmented value="above" onValueChange={onValueChange} aria-label="dir">
        <SegmentedItem value="above">Above</SegmentedItem>
        <SegmentedItem value="below">Below</SegmentedItem>
      </Segmented>,
    );
    fireEvent.click(getByRole("button", { name: "Below" }));
    expect(onValueChange).toHaveBeenCalledWith("below");
    // Controlled: without a parent state update the pressed item does not change.
    expect(getByRole("button", { name: "Above" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("CS3 fail-fast: SegmentedItem outside a Segmented throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<SegmentedItem value="x">X</SegmentedItem>)).toThrow(
      /must be rendered inside a <Segmented>/,
    );
    spy.mockRestore();
  });
});
