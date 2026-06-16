import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";

// The .tip-pop lift (inverted token surface, no shadow) lives in the shipped
// @qball-inc/tokens CSS, which jsdom does not load. The no-shadow + token-surface
// guarantees are asserted at the CSS-source contract level; the DOM tests assert
// the portal-escape behavior and that the component applies the .tip-pop class.
const componentsCss = readFileSync(resolve(process.cwd(), "../tokens/components.css"), "utf8");

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? "";
}

const TIP_TEXT = "Delayed ~15 min on the hobby tier.";

/** A pinned-open tooltip; `style` lets a test wrap the trigger in a transformed ancestor. */
function PinnedTooltip({ style }: { style?: CSSProperties }) {
  return (
    <TooltipProvider delayDuration={0}>
      <div data-testid="xform" style={style}>
        <Tooltip open>
          <TooltipTrigger asChild>
            <button type="button">info</button>
          </TooltipTrigger>
          <TooltipContent>{TIP_TEXT}</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("renders the tooltip bubble (.tip-pop) with its content when open", () => {
    render(<PinnedTooltip />);
    const content = document.querySelector(".tip-pop");
    expect(content).not.toBeNull();
    expect(content?.textContent).toContain(TIP_TEXT);
  });

  it("renders no bubble when closed (Radix unmount contract)", () => {
    render(
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button">info</button>
          </TooltipTrigger>
          <TooltipContent>{TIP_TEXT}</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(document.querySelector(".tip-pop")).toBeNull();
  });

  it("portals the content to <body>, escaping a transformed ancestor (RB-5 anti-clip)", () => {
    const { getByTestId, container } = render(
      <PinnedTooltip style={{ transform: "translateZ(0)" }} />,
    );
    const xform = getByTestId("xform");
    const content = document.querySelector(".tip-pop");
    expect(content).not.toBeNull();
    // The bubble lives under <body>, NOT inside the transformed wrapper (which
    // would otherwise clip/mis-place it), and NOT inside the in-tree container.
    expect(document.body.contains(content)).toBe(true);
    expect(xform.contains(content)).toBe(false);
    expect(container.contains(content)).toBe(false);
  });

  it("lifts via an inverted token surface, not a shadow (CSS contract, FR4)", () => {
    const body = ruleBody(componentsCss, ".tip-pop");
    expect(body).not.toBe("");
    // Broad "shadow" substring (the box-shadow literal is itself DESIGN_DENY-blocked).
    expect(body).not.toContain("shadow");
    // Inverted-bubble visual via token, no hardcoded hex.
    expect(body).toMatch(/background:\s*var\(--text-primary\)/);
    expect(body).not.toMatch(/#[0-9a-f]{3,6}/i);
  });

  it("renders the caret as a token-filled Radix arrow (no hex)", () => {
    render(<PinnedTooltip />);
    const arrow = document.querySelector(".tip-pop__arrow");
    expect(arrow).not.toBeNull();
    expect(ruleBody(componentsCss, ".tip-pop__arrow")).toMatch(/fill:\s*var\(--text-primary\)/);
  });
});
