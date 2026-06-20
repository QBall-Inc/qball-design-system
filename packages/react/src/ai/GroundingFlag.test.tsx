import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { componentsCss, ruleBody } from "../test-utils/css-source";
import { GroundingFlag } from "./GroundingFlag";

// The grounding surface (.ground-wave shimmer + reduced-motion @media + the
// .gtip-pop bubble) ships in @qball-inc/tokens CSS, which jsdom does not load;
// motion / no-shadow / token-only guarantees are asserted at the CSS-source
// contract level via the shared test-utils/css-source helpers. componentSrc reads
// the component itself for the no-shadow / no-hex source grep (cwd = package dir).
const componentSrc = readFileSync(resolve(process.cwd(), "src/ai/GroundingFlag.tsx"), "utf8");

describe("GroundingFlag", () => {
  it("renders the [source] label for the source variant", () => {
    render(<GroundingFlag variant="source" explainer="x" />);
    const flag = document.querySelector(".ground-wave");
    expect(flag).not.toBeNull();
    expect(flag?.textContent).toBe("[source]");
  });

  it("renders the [unverified] label for the unverified variant", () => {
    render(<GroundingFlag variant="unverified" explainer="x" />);
    const flag = document.querySelector(".ground-wave");
    expect(flag?.textContent).toBe("[unverified]");
  });

  it("uses children as a label-glyph override (standalone marker, not a value wrapper)", () => {
    render(
      <GroundingFlag variant="source" explainer="x">
        $308
      </GroundingFlag>,
    );
    // The flagged value, when passed, replaces the default [source] glyph — it is
    // the marker itself, never a wrapped child the component adds a label beside.
    expect(document.querySelector(".ground-wave")?.textContent).toBe("$308");
  });

  it("applies the shipped shimmer classes (.ground-wave + .ground-wave--{variant})", () => {
    const { rerender } = render(<GroundingFlag variant="source" explainer="x" />);
    let flag = document.querySelector(".ground-wave");
    expect(flag?.classList.contains("ground-wave")).toBe(true);
    expect(flag?.classList.contains("ground-wave--source")).toBe(true);

    rerender(<GroundingFlag variant="unverified" explainer="x" />);
    flag = document.querySelector(".ground-wave");
    expect(flag?.classList.contains("ground-wave--unverified")).toBe(true);
  });

  it("suppresses the shimmer for reduced-motion with an explicit static fill (CSS contract, NFR5)", () => {
    // jsdom can't compute external @media; assert the shipped stylesheet declares
    // a reduced-motion block that swaps the animation for a static var(--wave-base)
    // fill (an explicit fallback, not a silent no-op).
    expect(componentsCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.ground-wave\s*\{[^}]*animation:\s*none[^}]*var\(--wave-base\)[^}]*\}/,
    );
  });

  it("lifts the explainer via a light token surface, not a shadow (CSS contract, FR4)", () => {
    const body = ruleBody(componentsCss, ".gtip-pop");
    expect(body).not.toBe("");
    expect(body).not.toContain("shadow");
    // Light guardrail bubble, token-driven, no hardcoded hex.
    expect(body).toMatch(/background:\s*var\(--bg-primary\)/);
    expect(body).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("portals the explainer to <body>, escaping a transformed ancestor (RB-5 anti-clip)", () => {
    const { getByTestId, container } = render(
      <div data-testid="xform" style={{ transform: "translateZ(0)" }}>
        <GroundingFlag variant="source" explainer="Live last-sale quote." defaultOpen />
      </div>,
    );
    const xform = getByTestId("xform");
    const bubble = document.querySelector(".gtip-pop");
    expect(bubble).not.toBeNull();
    // The bubble lives under <body>, NOT inside the transformed wrapper (which would
    // otherwise clip/mis-place it), and NOT inside the in-tree container.
    expect(document.body.contains(bubble)).toBe(true);
    expect(xform.contains(bubble)).toBe(false);
    expect(container.contains(bubble)).toBe(false);
  });

  it("renders the kicker + caller explainer in the open bubble", () => {
    render(<GroundingFlag variant="source" explainer="Live last-sale quote." defaultOpen />);
    const bubble = document.querySelector(".gtip-pop");
    expect(bubble?.querySelector(".gtip__k")?.textContent).toBe("Source");
    expect(bubble?.textContent).toContain("Live last-sale quote.");
    expect(bubble?.classList.contains("gtip--cited")).toBe(true);
  });

  it("renders no explainer bubble before hover/focus (Radix unmount contract)", () => {
    render(<GroundingFlag variant="unverified" explainer="x" />);
    expect(document.querySelector(".gtip-pop")).toBeNull();
  });

  it("emits no shadow and no hardcoded color in component source (FR4)", () => {
    // The literal "box-shadow" is itself DESIGN_DENY-blocked (as in Tooltip.test);
    // assert the broad "shadow" substring — also catches drop/text-shadow.
    expect(componentSrc).not.toContain("shadow");
    expect(componentSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(componentSrc).not.toMatch(/\b(rgb|hsl)\(/);
  });
});
