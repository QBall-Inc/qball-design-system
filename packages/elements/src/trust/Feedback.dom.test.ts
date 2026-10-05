import { describe, expect, it } from "vitest";
import { renderFeedback, type FeedbackChange, type FeedbackValue } from "./Feedback";

function setup(initial?: FeedbackValue): {
  root: HTMLElement;
  up: HTMLButtonElement;
  down: HTMLButtonElement;
  changes: FeedbackChange[];
} {
  const changes: FeedbackChange[] = [];
  const root = renderFeedback("turn-7", {
    onChange: (change) => changes.push(change),
    ...(initial === undefined ? {} : { initial }),
  });
  const up = root.querySelector<HTMLButtonElement>("button.qfb__up");
  const down = root.querySelector<HTMLButtonElement>("button.qfb__down");
  if (up === null || down === null) throw new Error("feedback buttons missing");
  return { root, up, down, changes };
}

function pressed(button: HTMLButtonElement): string | null {
  return button.getAttribute("aria-pressed");
}

describe("renderFeedback", () => {
  it("renders +1 / −1 native toggle buttons, none pressed", () => {
    const { root, up, down, changes } = setup();
    expect(root.className).toBe("qfb");
    expect(up.textContent).toBe("+1");
    expect(down.textContent).toBe("−1");
    expect([up.type, down.type]).toEqual(["button", "button"]);
    expect([pressed(up), pressed(down)]).toEqual(["false", "false"]);
    expect(up.getAttribute("aria-label")).toBe("+1 helpful");
    expect(down.getAttribute("aria-label")).toBe("−1 not helpful");
    expect(changes).toEqual([]);
  });

  it("walks the toggle matrix and reports every change", () => {
    const { up, down, changes } = setup();
    up.click();
    expect([pressed(up), pressed(down)]).toEqual(["true", "false"]);
    down.click();
    expect([pressed(up), pressed(down)]).toEqual(["false", "true"]);
    down.click();
    expect([pressed(up), pressed(down)]).toEqual(["false", "false"]);
    down.click();
    up.click();
    up.click();
    expect([pressed(up), pressed(down)]).toEqual(["false", "false"]);
    expect(changes.map((c) => c.value)).toEqual([1, -1, null, -1, 1, null]);
    expect(changes.every((c) => c.turnRef === "turn-7")).toBe(true);
  });

  it("shows already-recorded feedback without reporting it", () => {
    const { up, down, changes } = setup(-1);
    expect([pressed(up), pressed(down)]).toEqual(["false", "true"]);
    expect(changes).toEqual([]);
    down.click();
    expect(changes).toEqual([{ value: null, turnRef: "turn-7" }]);
  });

  it("never renders the turn reference", () => {
    const root = renderFeedback("<img src=x>", { onChange: () => undefined });
    expect(root.textContent).toBe("+1−1");
    expect(root.querySelector("img")).toBeNull();
  });

  it("fails fast on a missing turn reference or a bad initial value", () => {
    expect(() => renderFeedback("  ", { onChange: () => undefined })).toThrow(/non-empty turnRef/);
    expect(() =>
      renderFeedback("t", { onChange: () => undefined, initial: 2 as unknown as FeedbackValue }),
    ).toThrow(/initial must be 1, -1 or null/);
  });
});
