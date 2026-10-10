import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mount, type ChatHandle, type ChatMountOptions } from "./mount";

let handles: ChatHandle[] = [];
let page: HTMLElement;

beforeEach(() => {
  page = document.createElement("main");
  page.innerHTML =
    '<input id="field"><textarea id="area"></textarea><select id="pick"></select>' +
    '<div id="rich" contenteditable="true"><span id="rich-child">x</span></div>' +
    '<div id="plain" contenteditable="false"></div><button id="other">other</button>';
  document.body.append(page);
});

afterEach(() => {
  for (const handle of handles) handle.destroy();
  handles = [];
  document.body.replaceChildren();
  document.body.removeAttribute("style");
});

function mountIn(options: ChatMountOptions = {}, host: HTMLElement = document.body): ChatHandle {
  const handle = mount(host, options);
  handles.push(handle);
  return handle;
}

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`#${id} missing`);
  return node as T;
}

function pressKey(
  target: EventTarget,
  init: KeyboardEventInit & { keyCode?: number },
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  if (init.keyCode !== undefined) Object.defineProperty(event, "keyCode", { value: init.keyCode });
  target.dispatchEvent(event);
  return event;
}

function input(handle: ChatHandle): HTMLTextAreaElement {
  const node = handle.overlay.querySelector<HTMLTextAreaElement>(".qpanel__input");
  if (node === null) throw new Error("composer missing");
  return node;
}

describe("overlay structure", () => {
  it("is a closed modal dialog with head, empty body, composer and disclaimer", () => {
    const handle = mountIn();
    const root = handle.overlay;
    expect(root.className).toBe("qoverlay");
    expect(root.getAttribute("role")).toBe("dialog");
    expect(root.getAttribute("aria-modal")).toBe("true");
    expect(root.querySelector(".qoverlay__scrim")).not.toBeNull();
    expect(root.querySelector(".qpanel__head .qbmark svg")).not.toBeNull();
    const esc = root.querySelector<HTMLButtonElement>(".qpanel__esc > button.keycap");
    expect(esc?.textContent).toBe("esc");
    expect(esc?.type).toBe("button");
    expect(handle.body.className).toBe("qpanel__body");
    expect(handle.body.childNodes).toHaveLength(0);
    expect(root.querySelector(".qpanel__prompt")?.textContent).toBe("you ›");
    expect(input(handle).rows).toBe(1);
    expect(handle.isOpen()).toBe(false);
    expect(document.body.lastElementChild).toBe(root);
  });
});

describe("open / close", () => {
  it("opens on launcher click, focuses the composer, locks the page, emits open", () => {
    const handle = mountIn();
    const events: string[] = [];
    handle.on("open", () => events.push("open"));
    handle.launcher.click();
    expect(handle.isOpen()).toBe(true);
    expect(handle.overlay.classList.contains("open")).toBe(true);
    expect(handle.launcher.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(input(handle));
    expect(page.hasAttribute("inert")).toBe(true);
    expect(handle.launcher.hasAttribute("inert")).toBe(true);
    expect(handle.overlay.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
    expect(events).toEqual(["open"]);
  });

  it.each([
    ["Esc", (h: ChatHandle) => pressKey(input(h), { key: "Escape" })],
    [
      "scrim click",
      (h: ChatHandle) => h.overlay.querySelector<HTMLElement>(".qoverlay__scrim")?.click(),
    ],
    [
      "keycap click",
      (h: ChatHandle) => h.overlay.querySelector<HTMLElement>(".qpanel__esc .keycap")?.click(),
    ],
  ])("closes on %s, restores focus to the launcher and releases the page", (_, act) => {
    document.body.style.overflow = "scroll";
    const handle = mountIn();
    const closes: number[] = [];
    handle.on("close", () => closes.push(1));
    handle.open();
    act(handle);
    expect(handle.isOpen()).toBe(false);
    expect(handle.overlay.classList.contains("open")).toBe(false);
    expect(handle.launcher.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(handle.launcher);
    expect(page.hasAttribute("inert")).toBe(false);
    expect(handle.launcher.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("scroll");
    expect(closes).toEqual([1]);
  });

  it("keeps elements that were already inert inert after close", () => {
    const frozen = document.createElement("aside");
    frozen.setAttribute("inert", "");
    document.body.append(frozen);
    const handle = mountIn();
    handle.open();
    handle.close();
    expect(frozen.hasAttribute("inert")).toBe(true);
  });

  it("inerts the whole page even when mounted deep inside it", () => {
    const shell = document.createElement("div");
    const slot = document.createElement("section");
    shell.append(slot);
    document.body.append(shell);
    const handle = mountIn({}, slot);
    handle.open();
    expect(page.hasAttribute("inert")).toBe(true);
    expect(handle.launcher.hasAttribute("inert")).toBe(true);
    expect(shell.hasAttribute("inert")).toBe(false);
    handle.close();
    expect(page.hasAttribute("inert")).toBe(false);
  });

  it("Esc closes even when focus fell to <body> (a click on blank panel space)", () => {
    const handle = mountIn();
    handle.open();
    input(handle).blur();
    expect(document.activeElement).toBe(document.body);
    pressKey(document.body, { key: "Escape" });
    expect(handle.isOpen()).toBe(false);
  });

  it("Esc that cancels an IME composition does not close", () => {
    const handle = mountIn();
    handle.open();
    pressKey(input(handle), { key: "Escape", isComposing: true });
    expect(handle.isOpen()).toBe(true);
  });

  it("Esc while closed is left alone", () => {
    mountIn();
    const event = pressKey(document.body, { key: "Escape" });
    expect(event.defaultPrevented).toBe(false);
  });

  it("toggle flips state; repeat open/close are no-ops", () => {
    const handle = mountIn();
    const events: string[] = [];
    handle.on("open", () => events.push("open"));
    handle.on("close", () => events.push("close"));
    handle.toggle();
    handle.open();
    handle.toggle();
    handle.close();
    expect(events).toEqual(["open", "close"]);
  });

  it("does not move focus to a hidden launcher on close", () => {
    const handle = mountIn();
    handle.setHidden(true);
    handle.open();
    handle.close();
    expect(document.activeElement).not.toBe(handle.launcher);
  });

  it("dispatches events on the host only (not bubbling to document)", () => {
    const shell = document.createElement("div");
    document.body.append(shell);
    const handle = mountIn({}, shell);
    const seenOnDocument: string[] = [];
    const listener = (e: Event): void => {
      seenOnDocument.push(e.type);
    };
    document.addEventListener("open", listener);
    let seenOnHost = 0;
    shell.addEventListener("open", () => (seenOnHost += 1));
    handle.open();
    document.removeEventListener("open", listener);
    expect(seenOnHost).toBe(1);
    expect(seenOnDocument).toEqual([]);
  });
});

describe("Q hotkey", () => {
  it("opens from the page and prevents the default", () => {
    const handle = mountIn();
    const event = pressKey(byId("other"), { key: "q" });
    expect(handle.isOpen()).toBe(true);
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens on uppercase Q", () => {
    const handle = mountIn();
    pressKey(document.body, { key: "Q", shiftKey: true });
    expect(handle.isOpen()).toBe(true);
  });

  it.each(["field", "area", "pick", "rich", "rich-child"])(
    "is suppressed while typing in #%s",
    (id) => {
      const handle = mountIn();
      const event = pressKey(byId(id), { key: "q" });
      expect(handle.isOpen()).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it("is not suppressed by contenteditable=false", () => {
    const handle = mountIn();
    pressKey(byId("plain"), { key: "q" });
    expect(handle.isOpen()).toBe(true);
  });

  it("is suppressed during IME composition (isComposing)", () => {
    const handle = mountIn();
    pressKey(document.body, { key: "q", isComposing: true });
    expect(handle.isOpen()).toBe(false);
  });

  it("is suppressed during IME composition (keyCode 229)", () => {
    const handle = mountIn();
    pressKey(document.body, { key: "q", keyCode: 229 });
    expect(handle.isOpen()).toBe(false);
  });

  it.each(["metaKey", "ctrlKey", "altKey"] as const)("is suppressed with %s held", (modifier) => {
    const handle = mountIn();
    pressKey(document.body, { key: "q", [modifier]: true });
    expect(handle.isOpen()).toBe(false);
  });

  it("is ignored while the overlay is already open", () => {
    const handle = mountIn();
    const opens: number[] = [];
    handle.on("open", () => opens.push(1));
    handle.open();
    const event = pressKey(byId("other"), { key: "q" });
    expect(opens).toEqual([1]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("is suppressed while the consumer flags another dialog open", () => {
    let otherDialogOpen = true;
    const handle = mountIn({ suppressHotkey: () => otherDialogOpen });
    pressKey(document.body, { key: "q" });
    expect(handle.isOpen()).toBe(false);
    otherDialogOpen = false;
    pressKey(document.body, { key: "q" });
    expect(handle.isOpen()).toBe(true);
  });

  it("can be turned off", () => {
    const handle = mountIn({ hotkey: false });
    pressKey(document.body, { key: "q" });
    expect(handle.isOpen()).toBe(false);
  });

  it("ignores other keys and auto-repeat", () => {
    const handle = mountIn();
    pressKey(document.body, { key: "w" });
    pressKey(document.body, { key: "q", repeat: true });
    expect(handle.isOpen()).toBe(false);
  });
});

describe("composer", () => {
  it("Enter submits trimmed text: clears, emits ask, calls onAsk with the handle", () => {
    const asked: [string, ChatHandle][] = [];
    const handle = mountIn({ onAsk: (text, h) => asked.push([text, h]) });
    const events: string[] = [];
    handle.on("ask", (e) => events.push(e.detail.text));
    handle.open();
    const box = input(handle);
    box.value = "  what changed?  ";
    const event = pressKey(box, { key: "Enter" });
    expect(event.defaultPrevented).toBe(true);
    expect(box.value).toBe("");
    expect(events).toEqual(["what changed?"]);
    expect(asked).toEqual([["what changed?", handle]]);
  });

  it("Shift+Enter does not submit", () => {
    const asked: string[] = [];
    const handle = mountIn({ onAsk: (text) => asked.push(text) });
    const box = input(handle);
    box.value = "line one";
    const event = pressKey(box, { key: "Enter", shiftKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(box.value).toBe("line one");
    expect(asked).toEqual([]);
  });

  it("Enter during IME composition does not submit", () => {
    const asked: string[] = [];
    const handle = mountIn({ onAsk: (text) => asked.push(text) });
    const box = input(handle);
    box.value = "にほん";
    pressKey(box, { key: "Enter", isComposing: true });
    expect(asked).toEqual([]);
    expect(box.value).toBe("にほん");
  });

  it("blank input does not submit", () => {
    const asked: string[] = [];
    const handle = mountIn({ onAsk: (text) => asked.push(text) });
    input(handle).value = "   ";
    pressKey(input(handle), { key: "Enter" });
    expect(asked).toEqual([]);
  });

  it("auto-grows from scrollHeight on input", () => {
    const handle = mountIn();
    const box = input(handle);
    Object.defineProperty(box, "scrollHeight", { configurable: true, value: 64 });
    box.dispatchEvent(new Event("input"));
    expect(box.style.height).toBe("64px");
  });
});

describe("focus trap", () => {
  it("Tab from the last focusable wraps to the first, Shift+Tab from the first to the last", () => {
    const handle = mountIn();
    handle.open();
    const esc = handle.overlay.querySelector<HTMLButtonElement>(".qpanel__esc .keycap");
    const box = input(handle);
    expect(esc).not.toBeNull();
    box.focus();
    const forward = pressKey(box, { key: "Tab" });
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(esc);
    const back = pressKey(esc as HTMLButtonElement, { key: "Tab", shiftKey: true });
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(box);
  });

  it("includes focusables that answer turns add to the body", () => {
    const handle = mountIn();
    const link = document.createElement("a");
    link.href = "https://example.com/";
    link.textContent = "source";
    handle.body.append(link);
    handle.open();
    input(handle).focus();
    pressKey(input(handle), { key: "Tab" });
    const esc = handle.overlay.querySelector(".qpanel__esc .keycap");
    expect(document.activeElement).toBe(esc);
    pressKey(esc as HTMLElement, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(input(handle));
  });

  it("lets Tab move normally between middle elements", () => {
    const handle = mountIn();
    const link = document.createElement("a");
    link.href = "https://example.com/";
    handle.body.append(link);
    handle.open();
    link.focus();
    const event = pressKey(link, { key: "Tab" });
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("relayFeedback", () => {
  it("re-emits an answer-feedback change as the handle's feedback event", () => {
    const handle = mountIn();
    const seen: unknown[] = [];
    handle.on("feedback", (e) => seen.push(e.detail));
    handle.relayFeedback({ value: 1, turnRef: "turn-3" });
    handle.relayFeedback({ value: null, turnRef: "turn-3" });
    expect(seen).toEqual([
      { value: 1, turnRef: "turn-3" },
      { value: null, turnRef: "turn-3" },
    ]);
  });

  it("on() returns a working remover", () => {
    const handle = mountIn();
    const seen: number[] = [];
    const off = handle.on("open", () => seen.push(1));
    off();
    handle.open();
    expect(seen).toEqual([]);
  });
});

describe("destroy", () => {
  it("leaves no document-level listener and removes both nodes", () => {
    const added: unknown[] = [];
    const removed: unknown[] = [];
    const add = document.addEventListener.bind(document);
    const remove = document.removeEventListener.bind(document);
    document.addEventListener = ((
      type: string,
      fn: EventListener,
      opts?: AddEventListenerOptions,
    ) => {
      added.push(fn);
      add(type, fn, opts);
    }) as typeof document.addEventListener;
    document.removeEventListener = ((
      type: string,
      fn: EventListener,
      opts?: EventListenerOptions,
    ) => {
      removed.push(fn);
      remove(type, fn, opts);
    }) as typeof document.removeEventListener;
    try {
      const handle = mount(document.body);
      expect(added).toHaveLength(1);
      handle.destroy();
      expect(removed).toEqual(added);
      expect(document.querySelector(".qlaunch, .qoverlay")).toBeNull();
      pressKey(document.body, { key: "q" });
      expect(handle.isOpen()).toBe(false);
      handle.open();
      expect(handle.isOpen()).toBe(false);
      handle.destroy();
    } finally {
      document.addEventListener = add;
      document.removeEventListener = remove;
    }
  });

  it("with the hotkey off, Q does nothing but Esc still closes", () => {
    const handle = mountIn({ hotkey: false });
    pressKey(document.body, { key: "q" });
    expect(handle.isOpen()).toBe(false);
    handle.open();
    pressKey(document.body, { key: "Escape" });
    expect(handle.isOpen()).toBe(false);
  });

  it("releases the inert background and scroll lock when destroyed while open", () => {
    const handle = mount(document.body);
    handle.open();
    handle.destroy();
    expect(page.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });
});
