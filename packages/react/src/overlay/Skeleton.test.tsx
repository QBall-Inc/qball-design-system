import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton, type SkeletonShape } from "./Skeleton";

// The reduced-motion guarantee lives in the shipped @qball-inc/tokens CSS, which
// jsdom does NOT load or evaluate (no external stylesheet, no @media matching).
// So the conformance is asserted at the CSS-source contract level: the shipped
// rule must stop the animation under prefers-reduced-motion. The React test below
// asserts the component applies the class that this rule targets.
//
// vitest runs each package's `vitest run` with cwd = packages/react (just test,
// root `pnpm test`, and direct --filter all invoke the package's own script), so
// the sibling tokens source resolves from cwd. Source == shipped (RB-10 golden rule).
const componentsCss = readFileSync(resolve(process.cwd(), "../tokens/components.css"), "utf8");

/** Asserts the shipped CSS stops `selector`'s animation inside a reduced-motion block. */
function expectReducedMotionStops(css: string, selector: string): void {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `@media\\s*\\(prefers-reduced-motion:\\s*reduce\\)\\s*\\{\\s*${escaped}\\s*\\{[^}]*animation:\\s*none`,
  );
  expect(css, `no reduced-motion animation:none rule for ${selector}`).toMatch(pattern);
}

describe("Skeleton", () => {
  const shapes: { shape: SkeletonShape; modifier: string }[] = [
    { shape: "text", modifier: "skel--text" },
    { shape: "line", modifier: "skel--line" },
    { shape: "title", modifier: "skel--title" },
    { shape: "block", modifier: "skel--block" },
    { shape: "circle", modifier: "skel--circle" },
  ];

  it.each(shapes)(
    "renders the $shape shape with the shipped .skel + modifier (AC-1/AC-9a)",
    ({ shape, modifier }) => {
      const { container } = render(<Skeleton shape={shape} />);
      const el = container.querySelector(".skel");
      expect(el).not.toBeNull();
      expect(el?.className.split(" ")).toContain(modifier);
      // Decorative placeholder — hidden from assistive tech.
      expect(el?.getAttribute("aria-hidden")).toBe("true");
    },
  );

  it("defaults to the line shape", () => {
    const { container } = render(<Skeleton />);
    const el = container.querySelector(".skel");
    expect(el).not.toBeNull();
    expect(el?.className.split(" ")).toContain("skel--line");
  });

  it("merges width/height convenience props onto style", () => {
    const { container } = render(<Skeleton shape="circle" width={32} height={32} />);
    const el = container.querySelector<HTMLElement>(".skel");
    expect(el?.style.width).toBe("32px");
    expect(el?.style.height).toBe("32px");
  });

  it("stops the shimmer entirely under prefers-reduced-motion (CSS contract, AC-9b/NFR5)", () => {
    // The shipped .skel reduced-motion rule was already present; assert it holds.
    expectReducedMotionStops(componentsCss, ".skel");
  });
});
