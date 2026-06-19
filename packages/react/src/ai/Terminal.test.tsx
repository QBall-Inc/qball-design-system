import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Composer } from "./Composer";
import { Terminal } from "./Terminal";
import type { TerminalMessage } from "./Terminal";

// The .term* surface (transcript layout, prefixes, the streaming cursor +
// reduced-motion guard) lives in the shipped @qball-inc/tokens components.css,
// which jsdom does NOT load (no external stylesheet, no @media evaluation). The
// reduced-motion behaviour is therefore asserted at the CSS-source contract
// level; the DOM tests assert the component applies the classes those rules
// target. vitest runs with cwd = packages/react, so the sibling tokens source
// resolves (source == shipped, RB-10 golden rule).
const componentsCss = readFileSync(resolve(process.cwd(), "../tokens/components.css"), "utf8");

const CONVO: TerminalMessage[] = [
  { role: "user", content: "What's driving NVDA?" },
  { role: "assistant", content: "Up 8.4% on the week." },
];

describe("Terminal", () => {
  it("prefixes user turns with 'you ›' and assistant turns with 'stocky ›' (AC-2)", () => {
    const { container } = render(<Terminal messages={CONVO} />);
    const you = container.querySelector(".term__pre--you");
    const bot = container.querySelector(".term__pre--bot");
    expect(you?.textContent).toBe("you ›");
    expect(bot?.textContent).toBe("stocky ›");
    // The turn text is rendered under the role-specific text class.
    expect(container.querySelector(".term__txt--you")?.textContent).toBe("What's driving NVDA?");
    expect(container.querySelector(".term__txt--bot")?.textContent).toContain("Up 8.4%");
  });

  it("renders a divider between turns but not before the first (AC-2)", () => {
    const { container } = render(<Terminal messages={CONVO} />);
    // Two turns → exactly one separator.
    expect(container.querySelectorAll(".term__sep")).toHaveLength(1);
  });

  it("renders a persistent, non-dismissible AI disclaimer via Callout (AC-4)", () => {
    const { container, rerender } = render(<Terminal messages={CONVO} />);
    const disc = container.querySelector(".term__disc");
    expect(disc).not.toBeNull();
    expect(disc?.className).toContain("callout"); // it IS the shipped Callout (owner S86)
    expect(disc?.textContent).toContain("not financial advice");
    // No dismiss control (.callout__x) — the disclaimer is persistent.
    expect(disc?.querySelector(".callout__x")).toBeNull();
    // ...and it survives a message append.
    rerender(<Terminal messages={[...CONVO, { role: "user", content: "Should I buy?" }]} />);
    expect(container.querySelector(".term__disc")?.textContent).toContain("not financial advice");
  });

  it("auto-scrolls to the newest content when a message is appended (AC-3)", () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");
    const { rerender } = render(<Terminal messages={CONVO} />);
    scrollSpy.mockClear();
    rerender(<Terminal messages={[...CONVO, { role: "assistant", content: "more" }]} />);
    expect(scrollSpy).toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("renders the streaming cursor on the in-progress assistant turn, and removes it on close (AC-10)", () => {
    const { container, rerender } = render(<Terminal messages={CONVO} streaming />);
    expect(container.querySelectorAll('[data-testid="term-cursor"]')).toHaveLength(1);
    // The cursor sits inside the LAST (assistant) turn's text.
    const lastTurnText = container.querySelectorAll(".term__txt--bot");
    expect(lastTurnText[lastTurnText.length - 1]?.querySelector(".term__cursor")).not.toBeNull();
    // Stream closes → cursor gone.
    rerender(<Terminal messages={CONVO} streaming={false} />);
    expect(container.querySelector('[data-testid="term-cursor"]')).toBeNull();
  });

  it("does not render a cursor when the last turn is a user turn (even while streaming)", () => {
    const userLast: TerminalMessage[] = [
      { role: "assistant", content: "hi" },
      { role: "user", content: "hello" },
    ];
    const { container } = render(<Terminal messages={userLast} streaming />);
    expect(container.querySelector('[data-testid="term-cursor"]')).toBeNull();
  });

  it("renders the cursor on ONLY the last assistant turn when several assistant turns exist", () => {
    const multi: TerminalMessage[] = [
      { role: "assistant", content: "first" },
      { role: "assistant", content: "second" },
    ];
    const { container } = render(<Terminal messages={multi} streaming />);
    expect(container.querySelectorAll('[data-testid="term-cursor"]')).toHaveLength(1);
    const bots = container.querySelectorAll(".term__txt--bot");
    expect(bots[0]?.querySelector(".term__cursor")).toBeNull();
    expect(bots[bots.length - 1]?.querySelector(".term__cursor")).not.toBeNull();
  });

  it("ships a cursor animation that is disabled under prefers-reduced-motion (CSS contract, AC-11)", () => {
    // Base rule animates...
    expect(componentsCss).toMatch(/\.term__cursor\s*\{[^}]*animation:\s*term-blink/);
    // ...and the reduced-motion media block switches it to a static character.
    expect(componentsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.term__cursor\s*\{\s*animation:\s*none/,
    );
  });

  it("surfaces a retryable error as a transient 'Retrying…' warning row (AC-8/AC-9)", () => {
    const { container } = render(
      <Terminal
        messages={CONVO}
        error={{ kind: "error", retryable: true, message: "rate limited" }}
      />,
    );
    const row = container.querySelector(".term__errrow");
    expect(row).not.toBeNull();
    expect(row?.className).toContain("callout--warn"); // warning, distinct from fatal
    expect(row?.textContent).toContain("Retrying…");
    expect(row?.textContent).toContain("rate limited");
    // A retryable row offers no "Try again" action.
    expect(row?.textContent).not.toContain("Try again");
  });

  it("surfaces a fatal error as an error row with a 'Try again' action firing onRetry (AC-9)", async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <Terminal
        messages={CONVO}
        error={{ kind: "error", retryable: false, message: "stream failed" }}
        onRetry={onRetry}
      />,
    );
    const row = container.querySelector(".term__errrow");
    expect(row?.className).toContain("callout--error"); // fatal, distinct from retryable
    expect(row?.textContent).toContain("stream failed");
    const tryAgain = container.querySelector<HTMLButtonElement>(".term__errrow .btn");
    expect(tryAgain?.textContent).toContain("Try again");
    await userEvent.click(tryAgain as HTMLButtonElement);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a composer slot inside the terminal footer", () => {
    const { container } = render(
      <Terminal messages={CONVO} composer={<Composer onSend={vi.fn()} />} />,
    );
    expect(container.querySelector(".term .term__composer")).not.toBeNull();
  });
});
