import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Card } from "./Card";

// The .card surface + its hover/selected states live in the shipped
// @qball-inc/tokens CSS, which jsdom does NOT load (no external stylesheet, no
// :hover matching). So the no-shadow guarantee and the hover-sage rule are
// asserted at the CSS-source contract level; the DOM tests assert the component
// applies the classes those rules target. vitest runs with cwd = packages/react,
// so the sibling tokens source resolves (source == shipped, RB-10 golden rule).
const colorsCss = readFileSync(resolve(process.cwd(), "../tokens/colors_and_type.css"), "utf8");

/** Returns the declaration body of the first `selector { ... }` rule, or "". */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? "";
}

describe("Card", () => {
  it("renders the .card surface with no shadow (AC-12h / DESIGN.md No-Shadows)", () => {
    const { container } = render(<Card>content</Card>);
    const card = container.querySelector<HTMLElement>(".card");
    expect(card).not.toBeNull();
    expect(card?.textContent).toBe("content");
    // No inline shadow on the element...
    expect(card?.style.boxShadow).toBe("");
    // ...and the shipped .card rule itself declares no shadow of any kind (the
    // literal "box-shadow" is itself a DESIGN_DENY-blocked token, so we assert on
    // the broader "shadow" substring — also covers text-/drop-shadow).
    const body = ruleBody(colorsCss, ".card");
    expect(body).not.toBe("");
    expect(body).not.toContain("shadow");
  });

  it("applies the selected-surface treatment when selected={true} (AC-12i)", () => {
    const { container } = render(<Card selected>content</Card>);
    expect(container.querySelector(".card")?.className.split(" ")).toContain("card--selected");
  });

  it("does not apply the selected class by default", () => {
    const { container } = render(<Card>content</Card>);
    expect(container.querySelector(".card")?.className.split(" ")).not.toContain("card--selected");
  });

  it("applies the interactive class when interactive={true}", () => {
    const { container } = render(<Card interactive>content</Card>);
    expect(container.querySelector(".card")?.className.split(" ")).toContain("card--interactive");
  });

  it("ships a hover rule that lifts the interactive card border to sage (CSS contract)", () => {
    expect(colorsCss).toMatch(
      /\.card--interactive:hover\s*\{[^}]*border-color:\s*var\(--color-signal\)/,
    );
  });

  it("ships a selected rule with a sage border (CSS contract)", () => {
    expect(colorsCss).toMatch(/\.card--selected\s*\{[^}]*border-color:\s*var\(--color-signal\)/);
  });

  it("passes through DOM attributes (onClick, role, tabIndex) for accessible interactive cards", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { container } = render(
      <Card interactive role="button" tabIndex={0} onClick={onClick}>
        pick me
      </Card>,
    );
    const card = container.querySelector<HTMLElement>(".card");
    expect(card?.getAttribute("role")).toBe("button");
    expect(card?.getAttribute("tabindex")).toBe("0");
    await user.click(card!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
