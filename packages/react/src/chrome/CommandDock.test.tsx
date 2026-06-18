import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommandDock } from "./CommandDock";

afterEach(() => {
  vi.useRealTimers();
});

describe("CommandDock", () => {
  it("renders the .dock island with the three prototype action triggers + the divider", () => {
    const { container } = render(<CommandDock />);
    const dock = container.querySelector(".dock");
    expect(dock).not.toBeNull();
    expect(screen.getByRole("button", { name: "Search" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Ask Stocky" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Add stock" })).not.toBeNull();
    expect(dock?.querySelector(".dock__div")).not.toBeNull();
  });

  it("opens the Search popover on trigger click and auto-focuses the search input (AC-5)", async () => {
    const user = userEvent.setup();
    render(<CommandDock actions={[{ id: "a", label: "Refresh", onSelect: vi.fn() }]} />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    const input = await screen.findByRole("textbox", { name: "Search" });
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it("filters the actions list by case-insensitive substring; renders no-results for no match (AC-5)", async () => {
    const user = userEvent.setup();
    render(
      <CommandDock
        actions={[
          { id: "a", label: "Refresh", onSelect: vi.fn() },
          { id: "b", label: "Settings", onSelect: vi.fn() },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Search" }));
    const input = await screen.findByRole("textbox", { name: "Search" });

    await user.type(input, "REF"); // case-insensitive
    expect(screen.getByRole("button", { name: "Refresh" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();

    await user.clear(input);
    await user.type(input, "zzz");
    expect(screen.getByText("No results")).not.toBeNull();
  });

  it("selecting an action calls onSelect and closes the popover (AC-6)", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(<CommandDock actions={[{ id: "a", label: "Refresh", onSelect: onRefresh }]} />);

    await user.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByRole("textbox", { name: "Search" });
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Search" })).toBeNull());
  });

  it("disables the AI composer + shows the BYO-key message when aiEnabled is false (AC-7)", async () => {
    const user = userEvent.setup();
    render(<CommandDock onAiSubmit={vi.fn()} />); // aiEnabled defaults false

    await user.click(screen.getByRole("button", { name: "Ask Stocky" }));
    const textarea = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "Ask Stocky",
    });

    expect(textarea.disabled).toBe(true);
    expect(screen.getByText("Add your API key to enable AI")).not.toBeNull();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Ask" }).disabled).toBe(true);
  });

  it("submits the prompt and clears the input when aiEnabled is true (AC-7)", async () => {
    const user = userEvent.setup();
    const onAiSubmit = vi.fn();
    render(<CommandDock aiEnabled onAiSubmit={onAiSubmit} />);

    await user.click(screen.getByRole("button", { name: "Ask Stocky" }));
    const textarea = await screen.findByRole<HTMLTextAreaElement>("textbox", {
      name: "Ask Stocky",
    });

    await user.type(textarea, "How is NVDA?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(onAiSubmit).toHaveBeenCalledWith("How is NVDA?");
    expect(textarea.value).toBe("");
  });

  it("opens the Add popover and selecting a suggestion fires its onSelect", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<CommandDock addSuggestions={[{ id: "m", label: "MSFT", onSelect: onAdd }]} />);

    await user.click(screen.getByRole("button", { name: "Add stock" }));
    await user.click(await screen.findByRole("button", { name: "MSFT" }));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("fires onAddQueryChange as the user types in the Add input", async () => {
    const user = userEvent.setup();
    const onAddQueryChange = vi.fn();
    render(<CommandDock onAddQueryChange={onAddQueryChange} />);

    await user.click(screen.getByRole("button", { name: "Add stock" }));
    const input = await screen.findByRole("textbox", { name: "Add stock" });
    await user.type(input, "ms");

    expect(onAddQueryChange).toHaveBeenLastCalledWith("ms");
  });

  it("hideOnScroll uses a custom scrollContainer when provided (listener on the element, not window)", () => {
    vi.useFakeTimers();
    const el = document.createElement("div");
    const addSpy = vi.spyOn(el, "addEventListener");
    const removeSpy = vi.spyOn(el, "removeEventListener");

    const { container, unmount } = render(<CommandDock hideOnScroll scrollContainer={el} />);
    const dock = container.querySelector(".dock") as HTMLElement;

    expect(addSpy.mock.calls.map((c) => c[0])).toContain("scroll");

    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    expect(dock.classList.contains("dock--hidden")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(dock.classList.contains("dock--hidden")).toBe(false);

    unmount();
    expect(removeSpy.mock.calls.map((c) => c[0])).toContain("scroll");

    addSpy.mockRestore();
    removeSpy.mockRestore();
    vi.useRealTimers();
  });

  it("applies .dock--hidden when the hidden prop is set", () => {
    const { container } = render(<CommandDock hidden />);
    const dock = container.querySelector(".dock") as HTMLElement;
    expect(dock.classList.contains("dock--hidden")).toBe(true);
    expect(dock.dataset["hidden"]).toBe("true");
  });

  it("hideOnScroll: hides via .dock--hidden while scrolling, springs back after 220ms, removes the listener on unmount (no leak)", () => {
    vi.useFakeTimers();
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { container, unmount } = render(<CommandDock hideOnScroll />);
    const dock = container.querySelector(".dock") as HTMLElement;

    expect(addSpy.mock.calls.map((c) => c[0])).toContain("scroll");
    expect(dock.classList.contains("dock--hidden")).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });
    expect(dock.classList.contains("dock--hidden")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(dock.classList.contains("dock--hidden")).toBe(false);

    unmount();
    expect(removeSpy.mock.calls.map((c) => c[0])).toContain("scroll");

    addSpy.mockRestore();
    removeSpy.mockRestore();
    vi.useRealTimers();
  });

  it("emits no shadow in source — lift is the shipped .dock glass + border (FR4)", () => {
    const src = readFileSync(resolve(process.cwd(), "src/chrome/CommandDock.tsx"), "utf8");
    // Assemble the needles from fragments so this assertion's own source does not trip the
    // DESIGN_DENY lint (which scans src literals for the shadow keyword — the canonical gate).
    const styleProp = "box" + "Shadow";
    const cssDecl = "box" + "-shadow:";
    expect(src).not.toContain(styleProp);
    expect(src).not.toContain(cssDecl);
  });
});
