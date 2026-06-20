import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { componentsCss, ruleBody } from "../test-utils/css-source";
import { ToolUseIndicator, type ToolUseState } from "./ToolUseIndicator";

// The .tuf surface (per-state color/tint + appear/cross-fade + reduced-motion)
// ships in @qball-inc/tokens CSS, which jsdom does not load; motion / no-shadow /
// token-only guarantees are asserted at the CSS-source-contract level. componentSrc
// reads the component itself for the no-shadow / no-hex source grep (cwd = pkg dir).
const componentSrc = readFileSync(resolve(process.cwd(), "src/ai/ToolUseIndicator.tsx"), "utf8");

/** The five states that render a chip (idle renders nothing). */
const VISIBLE_STATES: Exclude<ToolUseState, "idle">[] = [
  "pending",
  "running",
  "success",
  "error",
  "partial",
];

describe("ToolUseIndicator", () => {
  it("renders nothing for the idle state (chip absent/collapsed)", () => {
    const { container } = render(<ToolUseIndicator state="idle" skill="news-research" />);
    expect(container.querySelector(".tuf")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("renders a distinct .tuf[data-state] chip for each of the five visible states", () => {
    const seen = new Set<string>();
    for (const state of VISIBLE_STATES) {
      const { container } = render(<ToolUseIndicator state={state} skill="news-research" />);
      const chip = container.querySelector(".tuf");
      expect(chip).not.toBeNull();
      expect(chip?.getAttribute("data-state")).toBe(state);
      // each state's verb is distinct (queued/running/done/failed/partial)
      const verb = container.querySelector(".tuf__verb")?.textContent ?? "";
      expect(verb).not.toBe("");
      expect(seen.has(verb)).toBe(false);
      seen.add(verb);
    }
    expect(seen.size).toBe(VISIBLE_STATES.length);
  });

  it("builds the label as '{skill} · {verb}'", () => {
    const { container } = render(<ToolUseIndicator state="running" skill="news-research" />);
    const label = container.querySelector(".tuf__label");
    expect(label?.textContent).toBe("news-research · running");
    expect(container.querySelector(".tuf__verb")?.textContent).toBe("running");
  });

  it("renders a static SVG glyph (not a spinner) for pending/success/error/partial", () => {
    for (const state of ["pending", "success", "error", "partial"] as const) {
      const { container } = render(<ToolUseIndicator state={state} skill="s" />);
      expect(container.querySelector(".tuf__glyph svg")).not.toBeNull();
      expect(container.querySelector(".spinner")).toBeNull();
    }
  });

  it("running reuses the shipped .spinner (the one sanctioned loop), no SVG glyph", () => {
    const { container } = render(<ToolUseIndicator state="running" skill="news-research" />);
    expect(container.querySelector(".tuf__glyph .spinner.spinner--sm")).not.toBeNull();
    expect(container.querySelector(".tuf__glyph svg")).toBeNull();
    expect(container.querySelector(".term__cursor")).toBeNull();
  });

  it("running + streaming reuses the shipped .term__cursor (no spinner, no leading glyph)", () => {
    const { container } = render(
      <ToolUseIndicator state="running" streaming>
        analyzing filings
      </ToolUseIndicator>,
    );
    expect(container.querySelector(".term__cursor")).not.toBeNull();
    expect(container.querySelector(".spinner")).toBeNull();
    expect(container.querySelector(".tuf__glyph")).toBeNull();
    expect(container.querySelector(".tuf__label")?.textContent).toContain("analyzing filings");
  });

  it("partial pairs caution color with the literal word + a glyph (FR4 non-color cue)", () => {
    const { container } = render(
      <ToolUseIndicator state="partial" skill="news-research" meta="rate-limited" />,
    );
    // the word carries the meaning, not color alone
    expect(container.querySelector(".tuf")?.textContent).toContain("partial");
    expect(container.querySelector(".tuf__glyph svg")).not.toBeNull();
    expect(container.querySelector(".tuf__meta")?.textContent).toBe("rate-limited");
  });

  it("renders trailing meta only when supplied", () => {
    const withMeta = render(<ToolUseIndicator state="success" skill="s" meta="6 sources" />);
    expect(withMeta.container.querySelector(".tuf__meta")?.textContent).toBe("6 sources");

    const noMeta = render(<ToolUseIndicator state="success" skill="s" />);
    expect(noMeta.container.querySelector(".tuf__meta")).toBeNull();
  });

  it("uses children as a free-form label override and a custom verb otherwise", () => {
    const free = render(<ToolUseIndicator state="running">crunching numbers</ToolUseIndicator>);
    expect(free.container.querySelector(".tuf__label")?.textContent).toContain("crunching numbers");
    expect(free.container.querySelector(".tuf__verb")).toBeNull();

    const custom = render(<ToolUseIndicator state="pending" skill="s" verb="waiting" />);
    expect(custom.container.querySelector(".tuf__verb")?.textContent).toBe("waiting");
  });

  it("exposes the chip as a polite status region (assistive-tech lifecycle)", () => {
    const { container } = render(<ToolUseIndicator state="running" skill="s" />);
    expect(container.querySelector(".tuf")?.getAttribute("role")).toBe("status");
  });

  it("stops every loop/fade under reduced-motion (CSS contract, NFR5)", () => {
    // jsdom can't compute external @media; assert the shipped stylesheet stops the
    // .tuf appear/cross-fade AND the reused .spinner / .term__cursor loops.
    expect(componentsCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.tuf\s*\{[^}]*animation:\s*none[^}]*transition:\s*none[^}]*\}/,
    );
    expect(componentsCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.spinner\s*\{[^}]*animation:\s*none/,
    );
    expect(componentsCss).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.term__cursor\s*\{[^}]*animation:\s*none/,
    );
  });

  it("paints the chip from tokens with no shadow (CSS contract, FR4)", () => {
    const body = ruleBody(componentsCss, ".tuf");
    expect(body).not.toBe("");
    expect(body).not.toContain("shadow");
    expect(body).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("emits no shadow and no hardcoded color in component source (FR4)", () => {
    // The literal "box-shadow" is itself DESIGN_DENY-blocked (as in Tooltip.test);
    // assert the broad "shadow" substring — also catches drop/text-shadow.
    expect(componentSrc).not.toContain("shadow");
    expect(componentSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(componentSrc).not.toMatch(/\b(rgb|hsl)\(/);
  });
});
