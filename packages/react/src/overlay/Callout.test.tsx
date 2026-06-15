import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Callout } from "./Callout";

describe("Callout", () => {
  const variants = [
    { variant: "info", modifier: null, role: "status" },
    { variant: "warning", modifier: "callout--warn", role: "status" },
    { variant: "error", modifier: "callout--error", role: "alert" },
    { variant: "neutral", modifier: "callout--neutral", role: "note" },
  ] as const;

  it.each(variants)(
    "renders the $variant variant with the shipped class + role + icon (AC-11/AC-12)",
    ({ variant, modifier, role }) => {
      render(
        <Callout variant={variant} title={`${variant} title`}>
          {variant} body
        </Callout>,
      );
      const banner = screen.getByRole(role);
      const classes = banner.className.split(" ");
      expect(classes).toContain("callout");
      if (modifier === null) {
        // info is the base `.callout` with no modifier class.
        expect(classes).toEqual(["callout"]);
      } else {
        expect(classes).toContain(modifier);
      }
      // Leading semantic icon (non-color cue), per the oracle's inline SVG.
      expect(banner.querySelector(".callout__icon svg")).not.toBeNull();
      expect(within(banner).getByText(`${variant} title`)).not.toBeNull();
      expect(within(banner).getByText(`${variant} body`)).not.toBeNull();
    },
  );

  it("hosts a disclaimer with rich inline children incl. a link (AC-12/AC-13)", () => {
    render(
      <Callout variant="neutral" title="Not financial advice">
        Stocky is a hobby-tier project. Data is delayed.{" "}
        <a href="https://example.com/disclaimer">Read the disclaimer</a>.
      </Callout>,
    );
    const banner = screen.getByRole("note");
    // The disclaimer-style copy documents the designated host role.
    expect(within(banner).getByText(/hobby-tier project/)).not.toBeNull();
    // Rich inline content (a link) survives in the children slot.
    const link = within(banner).getByRole("link", { name: "Read the disclaimer" });
    expect(link.getAttribute("href")).toBe("https://example.com/disclaimer");
  });

  it("is not dismissible by default (disclaimers are persistent)", () => {
    render(<Callout variant="neutral">Persistent notice</Callout>);
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  it("fires onDismiss when dismissible and the close button is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Callout variant="warning" dismissible onDismiss={onDismiss}>
        Degraded data
      </Callout>,
    );
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("omits the icon when icon={false}", () => {
    render(
      <Callout variant="info" icon={false}>
        No icon here
      </Callout>,
    );
    expect(screen.getByRole("status").querySelector(".callout__icon")).toBeNull();
  });
});
