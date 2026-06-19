import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Composer } from "./Composer";

describe("Composer", () => {
  it("fires onSend with the typed text on Enter (no Shift) and clears the textarea (AC-5)", async () => {
    const onSend = vi.fn();
    const { container } = render(<Composer onSend={onSend} />);
    const ta = container.querySelector<HTMLTextAreaElement>(".term__input");
    expect(ta).not.toBeNull();
    await userEvent.type(ta as HTMLTextAreaElement, "what's the price?{Enter}");
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("what's the price?");
    expect((ta as HTMLTextAreaElement).value).toBe("");
  });

  it("does NOT send on Shift+Enter (newline instead)", async () => {
    const onSend = vi.fn();
    const { container } = render(<Composer onSend={onSend} />);
    const ta = container.querySelector<HTMLTextAreaElement>(".term__input");
    await userEvent.type(ta as HTMLTextAreaElement, "line one");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("fires onSend on a send-button click and clears the textarea (AC-5)", async () => {
    const onSend = vi.fn();
    const { container } = render(<Composer onSend={onSend} />);
    const ta = container.querySelector<HTMLTextAreaElement>(".term__input");
    await userEvent.type(ta as HTMLTextAreaElement, "buy NVDA?");
    const send = container.querySelector<HTMLButtonElement>(".term__send");
    await userEvent.click(send as HTMLButtonElement);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("buy NVDA?");
    expect((ta as HTMLTextAreaElement).value).toBe("");
  });

  it("does not send whitespace-only input", async () => {
    const onSend = vi.fn();
    const { container } = render(<Composer onSend={onSend} />);
    const ta = container.querySelector<HTMLTextAreaElement>(".term__input");
    await userEvent.type(ta as HTMLTextAreaElement, "   {Enter}");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables the textarea + send and shows an 'Add your key' prompt when keyProvided=false (AC-6)", () => {
    const { container } = render(<Composer onSend={vi.fn()} keyProvided={false} />);
    const ta = container.querySelector<HTMLTextAreaElement>(".term__input");
    const send = container.querySelector<HTMLButtonElement>(".term__send");
    expect(ta?.disabled).toBe(true);
    expect(send?.disabled).toBe(true);
    const hint = container.querySelector(".term__keyhint");
    expect(hint).not.toBeNull();
    expect(hint?.textContent?.toLowerCase()).toContain("add your key");
  });

  it("does NOT invoke onSend while gated (keyProvided=false) (AC-6)", () => {
    const onSend = vi.fn();
    const { container } = render(<Composer onSend={onSend} keyProvided={false} />);
    const ta = container.querySelector<HTMLTextAreaElement>(".term__input");
    // Even if a synthetic Enter / click is dispatched straight at the disabled
    // controls (fireEvent bypasses the browser's disabled-event suppression),
    // the component's own disabled guard means onSend is never reached.
    fireEvent.keyDown(ta as HTMLTextAreaElement, { key: "Enter" });
    fireEvent.click(container.querySelector(".term__send") as HTMLButtonElement);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("re-enables the input + send when keyProvided flips to true", () => {
    const { container, rerender } = render(<Composer onSend={vi.fn()} keyProvided={false} />);
    expect(container.querySelector<HTMLTextAreaElement>(".term__input")?.disabled).toBe(true);
    rerender(<Composer onSend={vi.fn()} keyProvided />);
    expect(container.querySelector<HTMLTextAreaElement>(".term__input")?.disabled).toBe(false);
    expect(container.querySelector(".term__keyhint")).toBeNull();
  });
});
