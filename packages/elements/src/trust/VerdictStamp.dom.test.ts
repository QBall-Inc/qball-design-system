import { beforeEach, describe, expect, it } from "vitest";
import type { FinalTurn } from "../answer-turn";
import { groundedExplanation, refusedExplanation, withheldExplanation } from "../locked-strings";
import {
  markStampSeen,
  renderVerdictStamp,
  verdictExplanation,
  type VerdictInput,
} from "./VerdictStamp";

function parts(row: HTMLElement): {
  stamp: HTMLButtonElement;
  close: HTMLButtonElement;
  text: string;
} {
  const stamp = row.querySelector<HTMLButtonElement>("button.vstamp");
  const close = row.querySelector<HTMLButtonElement>("button.vrow__close");
  const text = row.querySelector(".vrow__txt .vtick > span")?.textContent;
  if (stamp === null || close === null || text == null) throw new Error("stamp row incomplete");
  return { stamp, close, text };
}

const grounded: VerdictInput = {
  verdict: "grounded",
  explanation: { claims: 6, episodes: 4, confidenceTier: "high" },
};
const withheld: VerdictInput = {
  verdict: "withheld",
  explanation: { untraceableFigures: 2, claimsShown: 3 },
};

beforeEach(() => {
  document.body.replaceChildren();
});

describe("renderVerdictStamp — structure and wording", () => {
  it.each([
    [grounded, "vstamp--grounded", "● grounded", "6 claims · 4 episodes · high confidence"],
    [withheld, "vstamp--withheld", "◐ withheld", "2 figures untraceable · 3 claims shown"],
    [
      { verdict: "refused", reason: "off_topic" } as const,
      "vstamp--refused",
      "∅ refused",
      "out of scope",
    ],
    [
      { verdict: "refused", reason: "in_scope_empty" } as const,
      "vstamp--refused",
      "∅ refused",
      "unable to answer · 0 references found",
    ],
    [
      { verdict: "refused", reason: "abstained" } as const,
      "vstamp--refused",
      "∅ refused",
      "insufficient evidence",
    ],
  ])("%j → %s %s", (verdict, cls, label, explanation) => {
    const row = renderVerdictStamp(verdict);
    const { stamp, close, text } = parts(row);
    expect(row.className).toBe("vrow");
    expect(stamp.classList.contains(cls)).toBe(true);
    expect(stamp.querySelector(".vstamp__wave")?.textContent).toBe(label);
    expect(stamp.getAttribute("type")).toBe("button");
    expect(close.textContent).toBe("›");
    expect(close.getAttribute("aria-label")).toBe("close explanation");
    expect(text).toBe(explanation);
  });

  it.each([
    [0, 0, "0 claims · 0 episodes · low confidence"],
    [1, 1, "1 claim · 1 episode · low confidence"],
    [12, 9, "12 claims · 9 episodes · low confidence"],
  ])("grounded claims=%i episodes=%i → %s", (claims, episodes, expected) => {
    const row = renderVerdictStamp({
      verdict: "grounded",
      explanation: { claims, episodes, confidenceTier: "low" },
    });
    expect(parts(row).text).toBe(expected);
  });

  it.each([
    [0, 0, "0 figures untraceable · 0 claims shown"],
    [1, 1, "1 figure untraceable · 1 claim shown"],
    [2, 12, "2 figures untraceable · 12 claims shown"],
  ])("withheld figures=%i shown=%i → %s", (untraceableFigures, claimsShown, expected) => {
    const row = renderVerdictStamp({
      verdict: "withheld",
      explanation: { untraceableFigures, claimsShown },
    });
    expect(parts(row).text).toBe(expected);
  });

  it("uses the shared locked-string formatters, so the stamp can never drift from them", () => {
    expect(verdictExplanation(grounded)).toBe(
      groundedExplanation({ claims: 6, episodes: 4, confidenceTier: "high" }),
    );
    expect(verdictExplanation(withheld)).toBe(
      withheldExplanation({ untraceableFigures: 2, claimsShown: 3 }),
    );
    expect(verdictExplanation({ verdict: "refused", reason: "abstained" })).toBe(
      refusedExplanation("abstained"),
    );
  });

  it("accepts a whole FinalTurn", () => {
    const turn: FinalTurn = {
      verdict: "refused",
      reason: "off_topic",
      body: [{ kind: "paragraph", inlines: [{ kind: "text", text: "not something i cover." }] }],
    };
    expect(parts(renderVerdictStamp(turn)).text).toBe("out of scope");
  });

  it("fails fast on bad input instead of rendering an unlabeled stamp", () => {
    expect(() =>
      renderVerdictStamp({
        verdict: "grounded",
        explanation: { claims: 1, episodes: 1, confidenceTier: "certain" },
      }),
    ).toThrow(RangeError);
    expect(() =>
      renderVerdictStamp({
        verdict: "withheld",
        explanation: { untraceableFigures: -1, claimsShown: 0 },
      }),
    ).toThrow(RangeError);
    expect(() => renderVerdictStamp({ verdict: "maybe" } as unknown as VerdictInput)).toThrow(
      /Unknown verdict "maybe"/,
    );
  });
});

describe("renderVerdictStamp — toggling", () => {
  it("starts closed and unseen", () => {
    const row = renderVerdictStamp(grounded);
    const { stamp } = parts(row);
    expect(row.classList.contains("open")).toBe(false);
    expect(stamp.getAttribute("aria-expanded")).toBe("false");
    expect(stamp.classList.contains("is-seen")).toBe(false);
  });

  it("opens and closes from the stamp, keeping aria-expanded in step", () => {
    const row = renderVerdictStamp(grounded);
    const { stamp } = parts(row);
    stamp.click();
    expect(row.classList.contains("open")).toBe(true);
    expect(stamp.getAttribute("aria-expanded")).toBe("true");
    stamp.click();
    expect(row.classList.contains("open")).toBe(false);
    expect(stamp.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes from › and returns focus to the stamp", () => {
    const row = renderVerdictStamp(grounded);
    document.body.append(row);
    const { stamp, close } = parts(row);
    stamp.click();
    close.focus();
    close.click();
    expect(row.classList.contains("open")).toBe(false);
    expect(stamp.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(stamp);
  });

  it("stops the shimmer on first open, and it stays stopped after closing", () => {
    const row = renderVerdictStamp(withheld);
    const { stamp } = parts(row);
    stamp.click();
    expect(stamp.classList.contains("is-seen")).toBe(true);
    stamp.click();
    expect(stamp.classList.contains("is-seen")).toBe(true);
  });

  it("leaves other stamps shimmering by default, and markStampSeen stops one on request", () => {
    const first = renderVerdictStamp(grounded);
    const second = renderVerdictStamp(withheld);
    parts(first).stamp.click();
    expect(parts(second).stamp.classList.contains("is-seen")).toBe(false);
    markStampSeen(second);
    expect(parts(second).stamp.classList.contains("is-seen")).toBe(true);
  });

  it("calls onOpen with the row on every open, not on close", () => {
    const opened: HTMLElement[] = [];
    const row = renderVerdictStamp(grounded, { onOpen: (r) => opened.push(r) });
    const { stamp } = parts(row);
    stamp.click();
    stamp.click();
    stamp.click();
    expect(opened).toEqual([row, row]);
  });

  it("supports conversation-wide shimmer stop through onOpen + markStampSeen", () => {
    const rows: HTMLElement[] = [];
    const stopAll = (): void => {
      for (const r of rows) markStampSeen(r);
    };
    rows.push(renderVerdictStamp(grounded, { onOpen: stopAll }));
    rows.push(renderVerdictStamp(withheld, { onOpen: stopAll }));
    parts(rows[0] as HTMLElement).stamp.click();
    expect(rows.every((r) => parts(r).stamp.classList.contains("is-seen"))).toBe(true);
  });

  it("does not tick an explanation that fits (overflow is checked in e2e/trust-motion.spec.ts)", () => {
    const row = renderVerdictStamp(grounded);
    document.body.append(row);
    parts(row).stamp.click();
    expect(row.querySelector(".vrow__txt")?.classList.contains("is-ticking")).toBe(false);
    expect(row.querySelectorAll(".vtick > span")).toHaveLength(1);
  });
});
