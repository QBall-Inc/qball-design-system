import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Search } from "./Search";
import type { SearchItem } from "./Search";

/**
 * Real cmdk render in jsdom (vitest.setup polyfills cover the Radix-style DOM
 * APIs). Items expose `role="option"`; filtering is asserted through the
 * accessibility tree so hidden/removed items are genuinely absent.
 */
const items: SearchItem[] = [
  { id: "1", label: "Apple" },
  { id: "2", label: "Banana" },
  { id: "3", label: "Cherry" },
];

const noop = () => undefined;
const searchInput = (name = "Fruit search") => screen.getByLabelText<HTMLInputElement>(name);

describe("Search — AC-9 idle state", () => {
  it("renders a labelled, focusable input and shows the items", () => {
    render(
      <Search items={items} onSelect={noop} placeholder="Search fruit" label="Fruit search" />,
    );

    const box = searchInput();
    box.focus();
    expect(document.activeElement).toBe(box);
    expect(box.getAttribute("placeholder")).toBe("Search fruit");

    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Banana" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Cherry" })).not.toBeNull();
  });
});

describe("Search — AC-10 typing/filtering state", () => {
  it("filters the result set reactively as the user types", async () => {
    const user = userEvent.setup();
    render(<Search items={items} onSelect={noop} label="Fruit search" />);

    await user.type(searchInput(), "App");

    expect(screen.queryByRole("option", { name: "Apple" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Banana" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Cherry" })).toBeNull();
  });
});

describe("Search — AC-11 results state", () => {
  it("fires onSelect with the chosen item when a result is selected", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Search items={items} onSelect={onSelect} label="Fruit search" />);

    await user.click(screen.getByRole("option", { name: "Cherry" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ id: "3", label: "Cherry" });
  });
});

describe("Search — AC-12 no-results state", () => {
  it("renders the emptyText (not a blank panel) when nothing matches", async () => {
    const user = userEvent.setup();
    render(
      <Search items={items} onSelect={noop} emptyText="No fruit found." label="Fruit search" />,
    );

    await user.type(searchInput(), "zzzzz");

    expect(screen.queryByText("No fruit found.")).not.toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
  });
});

describe("Search — grouping, loading, disabled", () => {
  it("buckets grouped items under their heading and keeps ungrouped items selectable", () => {
    const grouped: SearchItem[] = [
      { id: "a", label: "Alpha", group: "Greek" },
      { id: "b", label: "Beta", group: "Greek" },
      { id: "x", label: "Loose" },
    ];
    render(<Search items={grouped} onSelect={noop} label="Letters" />);

    expect(screen.queryByText("Greek")).not.toBeNull(); // group heading
    expect(screen.queryByRole("option", { name: "Alpha" })).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Loose" })).not.toBeNull();
  });

  it("shows a loading row when isLoading", () => {
    render(<Search items={items} onSelect={noop} isLoading label="Fruit search" />);
    expect(screen.queryByText("Loading…")).not.toBeNull();
  });

  it("disables the input when disabled", () => {
    render(<Search items={items} onSelect={noop} disabled label="Fruit search" />);
    expect(searchInput().disabled).toBe(true);
  });
});

describe("Search — duplicate labels stay distinct (CR-03 cmdk value uniqueness)", () => {
  const dupes: SearchItem[] = [
    { id: "us", label: "Acme", group: "US" },
    { id: "uk", label: "Acme", group: "UK" },
  ];

  it("renders same-label items as distinct options, still filters by label, and selects the right one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Search items={dupes} onSelect={onSelect} label="Tickers" />);

    // Both render despite the shared label — cmdk keys identity on the unique id.
    expect(screen.getAllByRole("option", { name: "Acme" }).length).toBe(2);

    // Label filtering still works: keywords carry the label now that value=id.
    // (If keywords were missing, value="us"/"uk" would not match "Acme" → both vanish.)
    await user.type(searchInput("Tickers"), "Acme");
    const matches = screen.getAllByRole("option", { name: "Acme" });
    expect(matches.length).toBe(2);

    // Selecting the second fires onSelect with that exact item, not its twin.
    const second = matches[1];
    if (second === undefined) throw new Error("expected a second 'Acme' option");
    await user.click(second);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ id: "uk", label: "Acme", group: "UK" });
  });
});
