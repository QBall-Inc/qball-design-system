import { afterEach, describe, expect, it } from "vitest";
import { MASCOT_SVG, defaultMascot, renderLauncher, setLauncherHidden } from "./Launcher";
import { mount, type ChatHandle } from "./mount";

const BASE = {
  hint: "ask",
  label: "open assistant — or press Q",
  mascot: defaultMascot,
  variant: "corner",
  onStage: false,
} as const;

let handles: ChatHandle[] = [];
afterEach(() => {
  for (const handle of handles) handle.destroy();
  handles = [];
  document.body.replaceChildren();
});

function mountIn(options: Parameters<typeof mount>[1] = {}): ChatHandle {
  const handle = mount(document.body, options);
  handles.push(handle);
  return handle;
}

describe("renderLauncher", () => {
  it("renders the mascot verbatim, the pulse-dot and the hint [Q] caption", () => {
    const button = renderLauncher(BASE);
    expect(button.tagName).toBe("BUTTON");
    expect(button.type).toBe("button");
    expect(button.className).toBe("qlaunch");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-label")).toBe("open assistant — or press Q");

    const svg = button.querySelector(".qbmark > svg");
    expect(svg?.namespaceURI).toBe("http://www.w3.org/2000/svg");
    const reference = document.createElement("div");
    reference.insertAdjacentHTML("afterbegin", MASCOT_SVG);
    expect(svg?.outerHTML).toBe(reference.innerHTML);
    expect(svg?.querySelectorAll(".qb-eye")).toHaveLength(2);

    expect(button.querySelector(".qbmark > .qlaunch__dot")).not.toBeNull();
    const caption = button.querySelector(".qlaunch__cap");
    expect(caption?.textContent).toBe("ask Q");
    expect(caption?.querySelector(".keycap")?.textContent).toBe("Q");
  });

  it("gives each call a fresh mascot node", () => {
    expect(defaultMascot()).not.toBe(defaultMascot());
  });

  it("applies the variant and on-stage modifier classes", () => {
    expect(renderLauncher({ ...BASE, variant: "post-page" }).className).toBe(
      "qlaunch qlaunch--post",
    );
    expect(renderLauncher({ ...BASE, onStage: true }).className).toBe("qlaunch qlaunch--on-stage");
  });

  it("rejects an unknown variant", () => {
    expect(() => renderLauncher({ ...BASE, variant: "floating" as never })).toThrow(RangeError);
  });

  it("uses a consumer mascot factory and rejects a non-element result", () => {
    const custom = (): Element => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      node.setAttribute("data-custom", "yes");
      return node;
    };
    expect(
      renderLauncher({ ...BASE, mascot: custom }).querySelector("[data-custom]"),
    ).not.toBeNull();
    expect(() => renderLauncher({ ...BASE, mascot: () => "<svg/>" as never })).toThrow(TypeError);
  });

  it("setLauncherHidden hides despite the shipped display rule, and shows again", () => {
    const button = renderLauncher(BASE);
    setLauncherHidden(button, true);
    expect(button.hidden).toBe(true);
    expect(button.style.display).toBe("none");
    setLauncherHidden(button, false);
    expect(button.hidden).toBe(false);
    expect(button.style.display).toBe("");
  });
});

describe("mount() launcher options", () => {
  it("defaults are persona-neutral — no owner persona anywhere in the DOM", () => {
    mountIn();
    const html = document.body.outerHTML.toLowerCase();
    for (const persona of ["qubae", "qubrain"]) expect(html).not.toContain(persona);
    expect(document.querySelector(".qpanel__title")?.textContent).toBe("assistant");
    expect(document.querySelector(".qlaunch__cap")?.textContent).toBe("ask Q");
    expect(document.querySelector<HTMLTextAreaElement>(".qpanel__input")?.placeholder).toBe(
      "ask a question…",
    );
    expect(document.querySelector(".qpanel__disc")?.textContent).toBe("");
  });

  it("passes consumer copy through", () => {
    const handle = mountIn({
      title: "helper",
      hint: "query",
      placeholder: "type here",
      disclaimer: "answers come from the docs.",
      label: "open the helper",
    });
    expect(handle.launcher.getAttribute("aria-label")).toBe("open the helper");
    expect(handle.overlay.getAttribute("aria-label")).toBe("helper");
    expect(document.querySelector(".qpanel__title")?.textContent).toBe("helper");
    expect(document.querySelector(".qlaunch__cap")?.textContent).toBe("query Q");
    expect(document.querySelector(".qpanel__disc")?.textContent).toBe(
      "answers come from the docs.",
    );
  });

  it("renders hostile option strings as inert text", () => {
    const payload = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>';
    const handle = mountIn({
      title: payload,
      hint: payload,
      placeholder: `" autofocus onfocus="window.__pwned=1`,
      disclaimer: payload,
      label: "javascript:alert(1)",
    });
    expect(document.querySelector(".qpanel__title")?.textContent).toBe(payload);
    expect(document.querySelector(".qpanel__disc")?.textContent).toBe(payload);
    expect(document.querySelectorAll("img, script")).toHaveLength(0);
    const input = document.querySelector<HTMLTextAreaElement>(".qpanel__input");
    expect(input?.getAttribute("autofocus")).toBeNull();
    expect(input?.getAttribute("onfocus")).toBeNull();
    handle.open();
    expect((window as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("variant, onStage and setHidden reach the launcher", () => {
    const handle = mountIn({ variant: "post-page", onStage: true });
    expect(handle.launcher.classList.contains("qlaunch--post")).toBe(true);
    expect(handle.launcher.classList.contains("qlaunch--on-stage")).toBe(true);
    handle.setHidden(true);
    expect(handle.launcher.style.display).toBe("none");
    handle.setHidden(false);
    expect(handle.launcher.style.display).toBe("");
  });

  it("validates options at the boundary", () => {
    expect(() => mount(null as never)).toThrow(TypeError);
    expect(() => mount(document.body, { title: 3 as never })).toThrow(TypeError);
    expect(() => mount(document.body, { variant: "side" as never })).toThrow(RangeError);
    expect(() => mount(document.body, { mascot: "svg" as never })).toThrow(TypeError);
    expect(() => mount(document.body, { suppressHotkey: true as never })).toThrow(TypeError);
    expect(() => mount(document.body, { onAsk: "send" as never })).toThrow(TypeError);
    expect(document.body.children).toHaveLength(0);
  });
});
