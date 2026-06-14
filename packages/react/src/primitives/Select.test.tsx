import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select, SelectItem } from "./Select";

function renderSelect(props: Partial<Parameters<typeof Select>[0]> = {}) {
  return render(
    <Select placeholder="Pick one" aria-label="Alert type" {...props}>
      <SelectItem value="price">Price threshold</SelectItem>
      <SelectItem value="percent">Percent change</SelectItem>
      <SelectItem value="volume">Volume spike</SelectItem>
    </Select>,
  );
}

describe("Select", () => {
  it("displays the placeholder on the .select trigger when no value is selected (AC-3)", () => {
    renderSelect();
    const trigger = screen.getByRole("combobox", { name: "Alert type" });
    expect(trigger.className.split(" ")).toContain("select");
    expect(trigger.textContent).toContain("Pick one");
  });

  it("displays the selected item's label when controlled by value (AC-3)", () => {
    renderSelect({ value: "percent" });
    expect(screen.getByRole("combobox").textContent).toContain("Percent change");
  });

  it("opens via keyboard, navigates with ArrowDown, selects with Enter, and updates the trigger (AC-2)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn<(value: string) => void>();
    renderSelect({ onValueChange });

    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");

    const listbox = await screen.findByRole("listbox");
    expect(listbox).not.toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(3);

    await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const firstCall = onValueChange.mock.calls[0];
    if (firstCall === undefined) {
      throw new Error("expected onValueChange to have been called");
    }
    const selected = firstCall[0];
    expect(["price", "percent", "volume"]).toContain(selected);

    const labelFor: Record<string, string> = {
      price: "Price threshold",
      percent: "Percent change",
      volume: "Volume spike",
    };
    expect(screen.getByRole("combobox").textContent).toContain(labelFor[selected]);
  });

  it("closes the panel on Escape (AC-2)", async () => {
    const user = userEvent.setup();
    renderSelect();
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("listbox")).not.toBeNull();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("disabled trigger does not open and exposes the disabled state", async () => {
    const user = userEvent.setup();
    renderSelect({ disabled: true });
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveProperty("disabled", true);
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
