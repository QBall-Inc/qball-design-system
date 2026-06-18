import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { componentsCss } from "../test-utils/css-source";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  // The toggle mutates <html data-theme> globally — reset between tests.
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("renders the .iconbtn.theme-toggle button hosting both sun and moon icons", () => {
    const { container } = render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: "Toggle theme" });
    expect(btn.classList.contains("iconbtn")).toBe(true);
    expect(btn.classList.contains("theme-toggle")).toBe(true);
    // both icons are always present; the shipped CSS shows the right one per theme
    expect(container.querySelector(".ic-sun")).not.toBeNull();
    expect(container.querySelector(".ic-moon")).not.toBeNull();
  });

  it("flips data-theme on <html> from light to dark and back (BINDING global contract)", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle />);
    const btn = screen.getByRole("button", { name: "Toggle theme" });

    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("defaults to light when data-theme is absent, so the first toggle goes to dark (AC-9)", async () => {
    render(<ThemeToggle />); // no data-theme set
    await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("fires onThemeChange with the new theme AFTER writing it to <html>", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const onThemeChange = vi.fn<(t: "light" | "dark") => void>();
    render(<ThemeToggle onThemeChange={onThemeChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));
    expect(onThemeChange).toHaveBeenCalledWith("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("relies on the shipped CSS icon-swap (CSS-source contract; jsdom can't apply external CSS)", () => {
    // The component renders BOTH icons; the shipped tokens CSS hides the wrong one per theme.
    expect(componentsCss).toContain(".theme-toggle .ic-moon { display: none; }");
    expect(componentsCss).toContain(
      'html[data-theme="dark"] .theme-toggle .ic-sun { display: none; }',
    );
  });
});
