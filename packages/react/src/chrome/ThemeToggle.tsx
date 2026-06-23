import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, MouseEvent } from "react";

import { Moon, Sun } from "../icons/generated";

/**
 * ThemeToggle — the single global light/dark switch.
 *
 * Painted with the shipped `@qball-inc/tokens` classes `.iconbtn` + `.theme-toggle`
 * (matching the `preview/app-chrome-traditional.html` oracle). BOTH the sun and the
 * moon are inline SVG icons wrapped in `.ic-sun` / `.ic-moon`; the shipped CSS swaps
 * which one shows based on `html[data-theme]` (components.css:637-640) — so there is
 * no icon library dependency and no React state needed for the icon swap.
 *
 * BINDING global-theme contract: a click flips `data-theme` on `document.documentElement`
 * (`<html>`) — never a subtree element, a React context, or a CSS class. The `data-theme`
 * attribute on `<html>` is the mechanism every preview card + the gallery use for theming
 * (gallery.html:155). The current theme is read from the same attribute, defaulting to
 * `"light"` when absent.
 *
 * Inline SVG only — no hardcoded color (the icons stroke with `currentColor`), no
 * `box-shadow`. DESIGN_DENY (RB-8 layer (a)) clean.
 */

export type Theme = "light" | "dark";

/** Reads the live theme from `<html data-theme>`, defaulting to `"light"`. */
function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

export interface ThemeToggleProps extends Omit<ComponentPropsWithoutRef<"button">, "onChange"> {
  /** Fired with the new theme AFTER the toggle writes `data-theme` to `<html>`. */
  onThemeChange?: (theme: Theme) => void;
}

export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(function ThemeToggle(
  { className, onClick, onThemeChange, "aria-label": ariaLabel, ...rest },
  ref,
) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    // Run the consumer's handler first so it can cancel the flip via preventDefault().
    onClick?.(event);
    if (event.defaultPrevented) return;
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    onThemeChange?.(next);
  }

  return (
    <button
      ref={ref}
      type="button"
      className={["iconbtn", "theme-toggle", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel ?? "Toggle theme"}
      onClick={handleClick}
      {...rest}
    >
      <span className="ic-sun">
        <Sun size={19} />
      </span>
      <span className="ic-moon">
        <Moon size={19} />
      </span>
    </button>
  );
});
