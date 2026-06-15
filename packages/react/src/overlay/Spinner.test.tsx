import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Spinner, type SpinnerSize } from "./Spinner";

// Reduced-motion conformance is a CSS-source contract (jsdom does not apply the
// external tokens CSS or evaluate @media). This WP closes the gap for BOTH the
// standalone .spinner AND the Button's .btn--loading loop (owner-approved bundle).
//
// vitest runs each package's `vitest run` with cwd = packages/react, so the
// sibling tokens source resolves from cwd. Source == shipped (RB-10 golden rule).
const componentsCss = readFileSync(resolve(process.cwd(), "../tokens/components.css"), "utf8");
const buttonCss = readFileSync(resolve(process.cwd(), "../tokens/colors_and_type.css"), "utf8");

/** Asserts the shipped CSS stops `selector`'s animation inside a reduced-motion block. */
function expectReducedMotionStops(css: string, selector: string): void {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `@media\\s*\\(prefers-reduced-motion:\\s*reduce\\)\\s*\\{\\s*${escaped}\\s*\\{[^}]*animation:\\s*none`,
  );
  expect(css, `no reduced-motion animation:none rule for ${selector}`).toMatch(pattern);
}

describe("Spinner", () => {
  const sizes: { size: SpinnerSize; modifier: string | null }[] = [
    { size: "sm", modifier: "spinner--sm" },
    { size: "md", modifier: null }, // md is the base .spinner (no --md modifier)
    { size: "lg", modifier: "spinner--lg" },
  ];

  it.each(sizes)(
    "renders the $size size with the shipped .spinner class (AC-2/AC-9c)",
    ({ size, modifier }) => {
      render(<Spinner size={size} />);
      const el = screen.getByRole("status");
      const classes = el.className.split(" ");
      expect(classes).toContain("spinner");
      if (modifier === null) {
        // md resolves to the base class with no size modifier.
        expect(classes).toEqual(["spinner"]);
      } else {
        expect(classes).toContain(modifier);
      }
    },
  );

  it("defaults to the md (base) size and a 'Loading' accessible label", () => {
    render(<Spinner />);
    const el = screen.getByRole("status");
    expect(el.className.split(" ")).toEqual(["spinner"]);
    expect(el.getAttribute("aria-label")).toBe("Loading");
  });

  it("accepts a custom accessible label", () => {
    render(<Spinner label="Fetching quotes" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Fetching quotes");
  });

  it("stops rotation entirely under prefers-reduced-motion (CSS contract, AC-3/NFR5)", () => {
    expectReducedMotionStops(componentsCss, ".spinner");
  });

  it("also stops the Button's .btn--loading loop under reduced-motion (NFR5 bundle, D-02)", () => {
    expectReducedMotionStops(buttonCss, ".btn--loading::after");
  });
});
