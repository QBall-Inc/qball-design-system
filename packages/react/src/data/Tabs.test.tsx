import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
import { componentsCss, ruleBody } from "../test-utils/css-source";

// Tabs wraps Radix `Tabs` and paints the shipped `.tabs/.tab-list/.tab/.tab-panel`
// classes from @qball-inc/tokens. The DOM tests drive the REAL Radix behavior
// (no mocking the SUT — T1): render, click-to-switch, roving-tabindex keyboard
// nav, disabled. The visual contract (sage active cue + the shared focus ring)
// lives in the shipped CSS, which jsdom does not load, so it is asserted at the
// CSS-source level via the shared test-utils/css-source helper.

function renderTabs() {
  return render(
    <Tabs defaultValue="overview">
      <TabsList aria-label="Position detail">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="holdings">Holdings</TabsTrigger>
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="filings" disabled>
          Filings
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview panel</TabsContent>
      <TabsContent value="holdings">Holdings panel</TabsContent>
      <TabsContent value="activity">Activity panel</TabsContent>
    </Tabs>,
  );
}

describe("Tabs — render + structure", () => {
  it("renders the tablist, triggers, and active panel with the shipped token classes", () => {
    const { container } = renderTabs();

    expect(container.querySelector(".tabs")).not.toBeNull();

    const list = screen.getByRole("tablist", { name: "Position detail" });
    expect(list.className.split(" ")).toContain("tab-list");

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    for (const tab of tabs) {
      expect(tab.className.split(" ")).toContain("tab");
    }

    const panel = screen.getByRole("tabpanel");
    expect(panel.className.split(" ")).toContain("tab-panel");
    expect(panel.textContent).toBe("Overview panel");
  });

  it("marks the default tab selected and shows only its panel", () => {
    renderTabs();
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Holdings" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    // Radix unmounts inactive panels (no forceMount): only Overview is present.
    expect(screen.queryByText("Holdings panel")).toBeNull();
  });
});

describe("Tabs — active-tab switching (WP-B-3.3 AC-12j)", () => {
  it("switches the active tab + panel on click", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Holdings" }));

    expect(screen.getByRole("tab", { name: "Holdings" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe(
      "false",
    );
    expect(screen.getByRole("tabpanel").textContent).toBe("Holdings panel");
    expect(screen.queryByText("Overview panel")).toBeNull();
  });

  it("moves selection with the arrow keys (real Radix roving tabindex)", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Overview" }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Holdings" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(screen.getByRole("tabpanel").textContent).toBe("Holdings panel");
  });

  it("does not select a disabled trigger on click", async () => {
    const user = userEvent.setup();
    renderTabs();

    const filings = screen.getByRole("tab", { name: "Filings" });
    expect(filings.hasAttribute("disabled")).toBe(true);

    await user.click(filings);

    // Selection stays on the default; the disabled tab never activates.
    expect(filings.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tabpanel").textContent).toBe("Overview panel");
  });
});

describe("Tabs — className passthrough", () => {
  it("merges a custom className with the shipped class on each part", () => {
    const { container } = render(
      <Tabs defaultValue="a" className="my-tabs">
        <TabsList className="my-list">
          <TabsTrigger value="a" className="my-trigger">
            A
          </TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="my-panel">
          Panel A
        </TabsContent>
      </Tabs>,
    );

    expect(container.querySelector(".tabs")?.className.split(" ")).toEqual(
      expect.arrayContaining(["tabs", "my-tabs"]),
    );
    expect(screen.getByRole("tablist").className.split(" ")).toEqual(
      expect.arrayContaining(["tab-list", "my-list"]),
    );
    expect(screen.getByRole("tab").className.split(" ")).toEqual(
      expect.arrayContaining(["tab", "my-trigger"]),
    );
    expect(screen.getByRole("tabpanel").className.split(" ")).toEqual(
      expect.arrayContaining(["tab-panel", "my-panel"]),
    );
  });
});

describe("Tabs — controlled mode", () => {
  it("drives value + onValueChange through a controlled parent", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = useState("overview");
      return (
        <Tabs
          value={value}
          onValueChange={(next) => {
            onValueChange(next);
            setValue(next);
          }}
        >
          <TabsList aria-label="Position detail">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="holdings">Holdings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">Overview panel</TabsContent>
          <TabsContent value="holdings">Holdings panel</TabsContent>
        </Tabs>
      );
    }

    render(<Controlled />);
    await user.click(screen.getByRole("tab", { name: "Holdings" }));

    // Observable: the controlled callback fired with the new value, and the
    // parent-driven value swap shows the holdings panel.
    expect(onValueChange).toHaveBeenCalledWith("holdings");
    expect(screen.getByRole("tabpanel").textContent).toBe("Holdings panel");
  });
});

describe("Tabs — shipped CSS contract (jsdom can't compute external CSS)", () => {
  it("ships the active-tab sage cue (label + underline) on aria-selected", () => {
    const body = ruleBody(componentsCss, '.tab[aria-selected="true"]');
    expect(body).not.toBe("");
    expect(body).toContain("color: var(--color-signal)");
    expect(body).toContain("border-bottom-color: var(--color-signal)");
  });

  it("the .tab base rule uses only token colors (no hex/rgb/shadow)", () => {
    const body = ruleBody(componentsCss, ".tab");
    expect(body).not.toBe("");
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,}/);
    expect(body).not.toMatch(/rgba?\(/);
    expect(body).not.toContain("shadow");
  });

  it("ships ONE shared sage :focus-visible ring retrofitting all interactive surfaces (global)", () => {
    for (const selector of [
      ".btn:focus-visible",
      ".iconbtn:focus-visible",
      ".tab:focus-visible",
      ".appnav a:focus-visible",
      ".segmented button:focus-visible",
      ".menu__item:focus-visible",
      ".dropdown__row:focus-visible",
      ".notif__item:focus-visible",
    ]) {
      expect(componentsCss).toContain(selector);
    }
    expect(componentsCss).toMatch(/outline:\s*2px solid var\(--color-signal\)/);
  });

  it("uses an OUTSET ring on standalone controls and an INSET ring where containers clip", () => {
    // Standalone group (.btn..tab..appnav a) is outset (+2px).
    expect(componentsCss).toMatch(
      /\.tab:focus-visible[\s\S]*?\{\s*outline:\s*2px solid var\(--color-signal\);\s*outline-offset:\s*2px;\s*\}/,
    );
    // In-container group (.segmented button..notif__item) is inset (-2px) so the
    // ring is not clipped by overflow:hidden / scrolling panels.
    expect(componentsCss).toMatch(
      /\.segmented button:focus-visible[\s\S]*?\{\s*outline:\s*2px solid var\(--color-signal\);\s*outline-offset:\s*-2px;\s*\}/,
    );
  });

  it("is additive — the pre-existing .switch focus ring is left untouched", () => {
    expect(componentsCss).toContain(".switch input:focus-visible");
  });
});
