import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "./Switch";

// Read the SHIPPED token CSS so the square-radius assertion (AC-5) has real teeth:
// jsdom does not apply linked CSS, so toHaveStyle on a className-styled element is
// vacuous. Asserting against the published components.css source is masking-proof —
// the same technique the consumer-distribution CSS gate uses. Resolved by walking
// up from cwd (vitest's cwd is the package dir locally and the repo root in CI;
// import.meta.url is not a file URL under vitest), so the lookup is independent of
// which surface runs the test.
function readComponentsCss(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, "packages", "tokens", "components.css");
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf8");
    }
    dir = dirname(dir);
  }
  throw new Error(`components.css not found walking up from ${process.cwd()}`);
}

const componentsCss = readComponentsCss();

// Narrow the HTMLElement from getByRole to HTMLInputElement with a runtime guard,
// so a future refactor that changes the rendered element fails loudly here rather
// than reading `.checked`/`.disabled` as undefined through a blind cast.
function getSwitchInput(el: HTMLElement): HTMLInputElement {
  if (!(el instanceof HTMLInputElement)) {
    throw new Error("expected the switch to render an <input> element");
  }
  return el;
}

describe("Switch", () => {
  it("renders the oracle structure: .switch label + role=switch input + .switch__ui track", () => {
    const { getByRole, container } = render(<Switch aria-label="Enable alerts" />);
    const input = getSwitchInput(getByRole("switch", { name: "Enable alerts" }));
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("checkbox");
    expect(container.querySelector("label.switch")).not.toBeNull();
    expect(container.querySelector("span.switch__ui")).not.toBeNull();
  });

  it("uncontrolled toggle flips the checked state and fires onCheckedChange with the new value", () => {
    const onCheckedChange = vi.fn();
    const { getByRole } = render(
      <Switch defaultChecked={false} onCheckedChange={onCheckedChange} aria-label="Alerts" />,
    );
    const input = getSwitchInput(getByRole("switch"));
    expect(input.checked).toBe(false);

    fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    fireEvent.click(input);
    expect(input.checked).toBe(false);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("controlled checked prop reflects the aria state", () => {
    const { getByRole, rerender } = render(<Switch checked aria-label="Alerts" />);
    expect(getSwitchInput(getByRole("switch")).checked).toBe(true);
    rerender(<Switch checked={false} aria-label="Alerts" />);
    expect(getSwitchInput(getByRole("switch")).checked).toBe(false);
  });

  it("disabled blocks the toggle (no state change, no callback)", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { getByRole } = render(
      <Switch
        disabled
        defaultChecked={false}
        onCheckedChange={onCheckedChange}
        aria-label="Alerts"
      />,
    );
    const input = getSwitchInput(getByRole("switch"));
    expect(input.disabled).toBe(true);
    // user-event respects the disabled state (a real user cannot toggle it),
    // unlike fireEvent which dispatches the raw click jsdom would still apply.
    await user.click(input);
    expect(input.checked).toBe(false);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("renders an optional visible label beside the track", () => {
    const { getByText, container } = render(<Switch>Notify me</Switch>);
    expect(getByText("Notify me")).not.toBeNull();
    expect(container.querySelector("label.switch")?.textContent).toContain("Notify me");
  });

  // AC-4/AC-5 — BRAND NON-NEGOTIABLE: the switch track is SQUARED (var(--radius-sm)
  // = 4px), never a 9999px/rounded-full pill. This assertion is red-green: changing
  // the shipped `.switch__ui` radius to a pill makes it fail.
  it("enforces the squared (var(--radius-sm)) track radius in the shipped CSS — not a pill", () => {
    const block = componentsCss.match(/\.switch__ui\s*\{[^}]*\}/);
    if (block === null) {
      throw new Error(".switch__ui rule not found in components.css");
    }
    const rule = block[0];
    expect(rule).toContain("border-radius: var(--radius-sm)");
    // No numeric-literal radius: the token is the only radius source, so any px
    // pill (e.g. 9999px) regressed into the shipped rule trips this (red-green).
    expect(rule).not.toMatch(/border-radius:\s*\d/);
    // The rendered track actually carries the class the rule targets.
    const { container } = render(<Switch aria-label="Alerts" />);
    expect(container.querySelector("span.switch__ui")).not.toBeNull();
  });
});
