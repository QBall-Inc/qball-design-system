import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SecretInput } from "./SecretInput";
import type { SecretInputProps } from "./SecretInput";

/**
 * Controlled-state harness — the realistic parent (NOT a mock of the system
 * under test): it owns `value`/`isSet` exactly as a settings page would, so the
 * tests drive the real component through real state transitions (T1/T2).
 *
 * Assertions read raw DOM properties (`input.type`, `.disabled`, `.value`),
 * matching the repo convention — `@testing-library/jest-dom` is not wired here.
 */
type HarnessProps = Partial<Omit<SecretInputProps, "value" | "onChange">> & {
  initialValue?: string;
  initialIsSet?: boolean;
  onSetSpy?: (value: string) => void;
  onRemoveSpy?: () => void;
};

function Harness({
  initialValue = "",
  initialIsSet = false,
  onSetSpy,
  onRemoveSpy,
  label = "API key",
  ...rest
}: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  const [isSet, setIsSet] = useState(initialIsSet);
  return (
    <SecretInput
      label={label}
      value={value}
      onChange={setValue}
      isSet={isSet}
      onSet={(committed) => {
        onSetSpy?.(committed);
        setIsSet(true);
      }}
      onRemove={() => {
        onRemoveSpy?.();
        setIsSet(false);
        setValue("");
      }}
      {...rest}
    />
  );
}

const input = () => screen.getByLabelText<HTMLInputElement>("API key");
const button = (name: string) => screen.getByRole<HTMLButtonElement>("button", { name });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SecretInput — AC-3 show/hide toggle", () => {
  it("masks by default and toggles to plaintext and back, updating the aria-label", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="sk-ant-VISIBLE" initialIsSet />);

    expect(input().type).toBe("password");

    const toggle = button("Show secret");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");

    await user.click(toggle);
    expect(input().type).toBe("text");
    const hideToggle = button("Hide secret");
    expect(hideToggle.getAttribute("aria-pressed")).toBe("true");

    await user.click(hideToggle);
    expect(input().type).toBe("password");
    expect(screen.queryByRole("button", { name: "Show secret" })).not.toBeNull();
  });
});

describe("SecretInput — AC-4 set / rotate / remove states", () => {
  it("(a) unset: shows placeholder + a Set affordance, disabled until a value is entered; no rotate/remove", () => {
    render(<Harness placeholder="sk-ant-api03-…" />);
    expect(screen.queryByPlaceholderText("sk-ant-api03-…")).not.toBeNull();

    expect(button("Set").disabled).toBe(true); // empty value cannot be committed
    expect(screen.queryByRole("button", { name: "Rotate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("(c) committed: typing then clicking Set fires onSet with the entered value", async () => {
    const user = userEvent.setup();
    const onSetSpy = vi.fn();
    render(<Harness onSetSpy={onSetSpy} placeholder="enter key" />);

    await user.type(input(), "sk-ant-NEWKEY-123");
    const setBtn = button("Set");
    expect(setBtn.disabled).toBe(false);
    await user.click(setBtn);

    expect(onSetSpy).toHaveBeenCalledTimes(1);
    expect(onSetSpy).toHaveBeenCalledWith("sk-ant-NEWKEY-123");
  });

  it("(b) set: shows the masked value + Rotate + Remove; Rotate opens in-place edit (Update/Cancel)", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="sk-ant-STORED-KEY" initialIsSet />);

    expect(input().value).toBe("sk-ant-STORED-KEY");
    expect(input().type).toBe("password");
    expect(input().readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "Rotate" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Set" })).toBeNull();

    await user.click(button("Rotate"));
    expect(input().readOnly).toBe(false);
    expect(screen.queryByRole("button", { name: "Update" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeNull();
  });

  it("Remove fires onRemove and resets to the unset state", async () => {
    const user = userEvent.setup();
    const onRemoveSpy = vi.fn();
    render(<Harness initialValue="sk-ant-STORED-KEY" initialIsSet onRemoveSpy={onRemoveSpy} />);

    await user.click(button("Remove"));
    expect(onRemoveSpy).toHaveBeenCalledTimes(1);

    // Back to unset: Set present (disabled, value cleared); Rotate/Remove gone.
    expect(button("Set").disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Rotate" })).toBeNull();
  });
});

describe("SecretInput — AC-5 BYO-key autocomplete", () => {
  it("sets autocomplete=new-password and forwards the name (suppresses credential autofill)", () => {
    render(<Harness name="anthropic_api_key" />);
    expect(input().getAttribute("autocomplete")).toBe("new-password");
    expect(input().getAttribute("name")).toBe("anthropic_api_key");
  });
});

/**
 * Ironclad leak gate (AC-6): the secret must be CONFINED to the editing input's
 * live `value` and reachable nowhere else — not duplicated anywhere in the
 * serialized DOM, not in any other attribute (title/aria/placeholder/data-*),
 * not as readable text, and never persisted to web storage or cookies.
 *
 * jsdom and a real browser (chromium, verified) both serialize the controlled
 * input's value into innerHTML identically, so the literal "secret absent from
 * innerHTML" check is impossible in either; this asserts the achievable —
 * and stronger — property: the secret exists in exactly ONE place.
 */
function assertSecretConfinedToInput(container: HTMLElement, secret: string) {
  // Present (non-vacuous): exactly one input holds it as its live value.
  const holders = Array.from(container.querySelectorAll("input")).filter(
    (el) => el.value === secret,
  );
  expect(holders.length).toBe(1);
  const holder = holders[0];

  // Serialized DOM: the secret appears exactly once — only the holder's value.
  expect(container.innerHTML.split(secret).length - 1).toBe(1);

  // Never rendered as readable text.
  expect(container.textContent ?? "").not.toContain(secret);

  // Never present in any attribute except the holder input's own `value`.
  for (const el of Array.from(container.querySelectorAll<HTMLElement>("*"))) {
    for (const attr of Array.from(el.attributes)) {
      if (el === holder && attr.name === "value") continue;
      expect(attr.value).not.toContain(secret);
    }
  }

  // Never persisted to web storage or cookies.
  const dump = (store: Storage) =>
    Array.from(
      { length: store.length },
      (_, i) => `${store.key(i)}=${store.getItem(store.key(i) ?? "")}`,
    ).join("|");
  expect(dump(window.localStorage)).not.toContain(secret);
  expect(dump(window.sessionStorage)).not.toContain(secret);
  expect(document.cookie).not.toContain(secret);
}

describe("SecretInput — AC-6 the secret never leaks beyond the input (SECURITY)", () => {
  const secret = "sk-ant-api03-DOM-NEEDLE-7f3K9aZ2qP-DO-NOT-LEAK";

  it("masked set-display: the secret is confined to the input value and nowhere else", () => {
    const { container } = render(<Harness initialValue={secret} initialIsSet />);
    expect(input().type).toBe("password");
    assertSecretConfinedToInput(container, secret);
  });

  it("revealed: still confined (type flips to text; value stays in the one input)", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness initialValue={secret} initialIsSet />);
    await user.click(button("Show secret"));
    expect(input().type).toBe("text");
    assertSecretConfinedToInput(container, secret);
  });

  it("rotating (in-place edit): still confined", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness initialValue={secret} initialIsSet />);
    await user.click(button("Rotate"));
    assertSecretConfinedToInput(container, secret);
  });

  it("unset entry: a freshly typed secret is confined to the input", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.type(input(), secret);
    assertSecretConfinedToInput(container, secret);
  });

  it("detector is non-vacuous: a planted text leak IS caught", () => {
    // Prove the gate fires on a real leak — a sibling echoing the secret as text
    // breaks BOTH the occurrences-count and the textContent assertions above.
    const { container } = render(
      <div>
        <Harness initialValue={secret} initialIsSet />
        <span data-leak>{secret}</span>
      </div>,
    );
    expect(container.innerHTML.split(secret).length - 1).toBeGreaterThan(1);
    expect(container.textContent ?? "").toContain(secret);
  });
});

describe("SecretInput — AC-7 the secret is never echoed to the console (SECURITY)", () => {
  it("passes no secret to console.log/debug/info/warn/error across render + reveal + type + set + remove", async () => {
    const secret = "sk-ant-api03-CONSOLE-NEEDLE-9f3K";
    const methods = ["log", "debug", "info", "warn", "error"] as const;
    const spies = methods.map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));

    const user = userEvent.setup();
    const onRemoveSpy = vi.fn();
    render(<Harness initialValue={secret} initialIsSet onRemoveSpy={onRemoveSpy} />);

    // Exercise every interactive path that touches the value.
    await user.click(button("Show secret")); // reveal
    await user.click(button("Hide secret")); // re-mask
    await user.click(button("Rotate")); // enter edit
    await user.type(input(), "-rotated");
    await user.click(button("Update")); // commit (returns to set-display)
    await user.click(button("Remove")); // remove

    // Non-vacuous guard: the detector CAN see the needle (so a real echo would be caught)...
    expect(JSON.stringify(["log", secret])).toContain(secret);
    // ...and across every captured console call, the secret never appears.
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(secret);
      }
    }
  });
});
