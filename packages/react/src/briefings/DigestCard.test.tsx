import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GroundingFlag } from "../ai/GroundingFlag";
import { componentsCss, ruleBody } from "../test-utils/css-source";
import { DigestCard, type DigestState } from "./DigestCard";

// The .digest surface ships in @qball-inc/tokens CSS, which jsdom does not load;
// the sage-dot token + grounding-inline guarantees are asserted at the CSS-source
// contract level. componentSrc reads the component for the no-shadow / no-hex grep.
const componentSrc = readFileSync(resolve(process.cwd(), "src/briefings/DigestCard.tsx"), "utf8");

describe("DigestCard", () => {
  it("unread renders the sage dot + the sage left-border class", () => {
    const { container, getByTestId } = render(
      <DigestCard state="unread" period="Morning briefing · 30 May" title="Up 1.8%" />,
    );
    expect(getByTestId("digest-dot")).not.toBeNull();
    expect(container.querySelector(".digest")?.classList.contains("digest--unread")).toBe(true);
  });

  it("read dims the card and renders NO dot", () => {
    const { container, queryByTestId } = render(
      <DigestCard state="read" period="Midday briefing · 29 May" title="Quiet session" />,
    );
    expect(queryByTestId("digest-dot")).toBeNull();
    expect(container.querySelector(".digest")?.classList.contains("digest--read")).toBe(true);
  });

  it("loading composes Skeleton placeholders + marks the region busy, no dot", () => {
    const { container, queryByTestId } = render(<DigestCard state="loading" />);
    expect(container.querySelectorAll(".skel").length).toBeGreaterThan(0);
    expect(container.querySelector(".digest")?.getAttribute("aria-busy")).toBe("true");
    expect(queryByTestId("digest-dot")).toBeNull();
  });

  it("empty composes EmptyStateFig with a default headline, no dot", () => {
    const { container, queryByTestId } = render(<DigestCard state="empty" />);
    const fig = container.querySelector(".state-fig");
    expect(fig).not.toBeNull();
    expect(fig?.querySelector(".state-fig__title")?.textContent).toBe("No briefings yet");
    expect(queryByTestId("digest-dot")).toBeNull();
  });

  it("renders the sage dot present in DOM only for unread (AC-7 presence/absence matrix)", () => {
    // Scope each query to its OWN render container: render() binds queries to
    // document.body, and there is no cleanup between renders inside one it(), so a
    // container-scoped lookup is what isolates each state.
    const dotFor = (state: DigestState) =>
      render(<DigestCard state={state} title="t" />).container.querySelector(
        '[data-testid="digest-dot"]',
      );
    expect(dotFor("unread")).not.toBeNull();
    for (const state of ["read", "loading", "empty"] as DigestState[]) {
      expect(dotFor(state)).toBeNull();
    }
  });

  it("renders the period, title, body, time, and actions slots (unread/read)", () => {
    const { container } = render(
      <DigestCard
        state="unread"
        period="Morning briefing · 30 May"
        title="Your watchlist is up 1.8% pre-open"
        time="Generated 7:02am ET"
        actions={<button type="button">Dismiss</button>}
      >
        Markets opened firm.
      </DigestCard>,
    );
    expect(container.querySelector(".digest__period")?.textContent).toBe(
      "Morning briefing · 30 May",
    );
    expect(container.querySelector(".digest__title")?.textContent).toBe(
      "Your watchlist is up 1.8% pre-open",
    );
    expect(container.querySelector(".digest__body")?.textContent).toBe("Markets opened firm.");
    expect(container.querySelector(".digest__time")?.textContent).toBe("Generated 7:02am ET");
    expect(container.querySelector(".digest__actions button")?.textContent).toBe("Dismiss");
  });

  it("hosts a GroundingFlag marker inline in the body next to a narrated number", () => {
    const { container } = render(
      <DigestCard state="unread" period="Morning briefing · 30 May" title="Up 1.8%">
        <b>NVDA</b> leads <GroundingFlag variant="source" explainer="Live last-sale quote." /> at{" "}
        <b>+8.4%</b> on the week.
      </DigestCard>,
    );
    const body = container.querySelector(".digest__body");
    expect(body).not.toBeNull();
    // (a) the DEFAULT [source] marker is present (standalone marker — the value is
    // NOT passed as children, so the label is not overridden); the number lives in
    // the prose as a sibling.
    expect(body?.querySelector(".ground-wave")?.textContent).toBe("[source]");
    expect(body?.textContent).toContain("+8.4%");
  });

  it("the grounding wrapper is inline-level — no block reflow in the card (CSS contract)", () => {
    // jsdom can't compute external CSS; assert the shipped .gwrap rule is an
    // inline-level box (inline / inline-block / inline-flex) so it flows in prose.
    expect(ruleBody(componentsCss, ".gwrap")).toMatch(/display:\s*inline/);
  });

  it("delivers the sage accent via the token class, not an inline color (CSS contract)", () => {
    // The dot's sage comes from the shipped .digest__dot (var(--color-signal)),
    // proving the component inlines no color of its own.
    expect(ruleBody(componentsCss, ".digest__dot")).toMatch(/background:\s*var\(--color-signal\)/);
    expect(ruleBody(componentsCss, ".digest--unread")).toMatch(/var\(--color-signal\)/);
  });

  it("emits no shadow and no hardcoded color in component source (FR4)", () => {
    // Broad "shadow" substring (the literal "box-shadow" is DESIGN_DENY-blocked).
    expect(componentSrc).not.toContain("shadow");
    expect(componentSrc).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(componentSrc).not.toMatch(/\b(rgb|hsl)\(/);
  });
});
