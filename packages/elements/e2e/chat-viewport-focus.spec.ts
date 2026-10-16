// Chat patch 2 in real Chromium, with the real @qball-inc/tokens CSS:
// - keyboard fit: the open overlay follows the visual viewport. Headless
//   Chromium has no on-screen keyboard; pinch zoom (CDP page scale) shrinks the
//   visual viewport the same way, so it stands in for the keyboard here;
// - phone type scale (390px vs 1280px) and the composer's 16px floor;
// - the post-page launcher's bottom-left corner at every width;
// - the caption's opaque backing (AA contrast whatever sits behind it);
// - focus return after close: the pre-open element on Q opens, the launcher
//   otherwise, with no focus ring until the next Tab.
// Renders the BUILT dist/chat entry. Needs the built dist/ (`pnpm test` builds it).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");

interface PageSetup {
  theme?: "light" | "dark";
  /** Mount options for the chat (JSON-safe subset). */
  options?: { variant?: "corner" | "post-page"; onStage?: boolean };
  graphCss?: boolean;
  textScale?: number;
}

const html = (setup: PageSetup): string => `<!doctype html>
<html lang="en" data-theme="${setup.theme ?? "light"}">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/components.css">
    ${setup.graphCss === true ? '<link rel="stylesheet" href="/tokens/graph.css">' : ""}
    ${setup.textScale === undefined ? "" : `<style>:root{--text-scale:${setup.textScale}}</style>`}
  </head>
  <body style="margin:0">
    <main>
      <a id="link" href="#top">a page link</a>
      <button id="other" type="button">other</button>
      <button id="next" type="button">next</button>
      <div style="height:3000px"></div>
    </main>
    <script type="module">
      import { mount } from "/dist/chat/index.js";
      window.__handle = mount(document.body, ${JSON.stringify({ title: "qubae", ...setup.options })});
      window.__ready = true;
    </script>
  </body>
</html>`;

declare global {
  interface Window {
    __ready?: boolean;
  }
}

async function load(page: Page, setup: PageSetup = {}): Promise<void> {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: html(setup) });
      return;
    }
    const [base, prefix, type] = pathname.startsWith("/dist/")
      ? [DIST, "/dist/", "text/javascript"]
      : [TOKENS, "/tokens/", "text/css"];
    const file = normalize(join(base, pathname.slice(prefix.length)));
    if (pathname.startsWith(prefix) && file.startsWith(base) && existsSync(file)) {
      await route.fulfill({ contentType: type, body: readFileSync(file) });
    } else {
      await route.fulfill({ status: 404, body: "not found" });
    }
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => window.__ready === true);
  expect(pageErrors).toEqual([]);
}

const overlay = (page: Page) => page.locator(".qoverlay");
const composer = (page: Page) => page.locator(".qpanel__input");

test.beforeAll(() => {
  if (!existsSync(join(DIST, "chat", "index.js"))) {
    throw new Error(`${DIST}/chat/index.js missing — build @qball-inc/elements first (pnpm test).`);
  }
});

test.describe("keyboard fit (visual viewport)", () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });

  /** The visual viewport and the panel parts, in layout-viewport coordinates. */
  const geometry = (page: Page) =>
    page.evaluate(() => {
      const vv = window.visualViewport;
      if (vv === null) throw new Error("no visualViewport");
      const rect = (selector: string) => {
        const node = document.querySelector(selector);
        if (node === null) throw new Error(`${selector} missing`);
        const r = node.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      };
      return {
        viewport: { top: vv.offsetTop, bottom: vv.offsetTop + vv.height, height: vv.height },
        overlay: rect(".qoverlay"),
        panel: rect(".qpanel"),
        head: rect(".qpanel__head"),
        composer: rect(".qpanel__comp"),
        inline: document.querySelector<HTMLElement>(".qoverlay")?.style.cssText ?? "",
      };
    });

  test("the open panel stays inside a shrinking visual viewport, header to composer", async ({
    page,
  }) => {
    await load(page);
    const cdp = await page.context().newCDPSession(page);
    await page.locator(".qlaunch").tap();
    await expect(composer(page)).toBeFocused();
    await expect(page.locator(".qpanel")).toHaveCSS("opacity", "1");

    // Pinch to 2x: the visual viewport halves (800 -> 400), as a keyboard would shrink it.
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await expect.poll(async () => (await geometry(page)).overlay.bottom).toBeCloseTo(400, 0);
    const g = await geometry(page);
    expect(g.viewport.height).toBeCloseTo(400, 0);
    expect(g.overlay.top).toBeCloseTo(g.viewport.top, 0);
    // The panel keeps its 12px gutter inside the visible area, header and composer both in view.
    expect(g.panel.bottom).toBeCloseTo(g.viewport.bottom - 12, 0);
    expect(g.panel.top).toBeGreaterThanOrEqual(g.viewport.top);
    expect(g.head.top).toBeGreaterThanOrEqual(g.viewport.top);
    expect(g.composer.bottom).toBeLessThanOrEqual(g.viewport.bottom);

    // Restoring the scale grows it back.
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await expect.poll(async () => (await geometry(page)).overlay.bottom).toBeCloseTo(800, 0);
  });

  test("close releases the pin: no inline geometry, later viewport changes ignored", async ({
    page,
  }) => {
    await load(page);
    const cdp = await page.context().newCDPSession(page);
    await page.locator(".qlaunch").tap();
    await expect(overlay(page)).toBeVisible();
    expect((await geometry(page)).inline).toContain("height: 800px");
    await page.keyboard.press("Escape");
    await expect(overlay(page)).toBeHidden();
    expect((await geometry(page)).inline).toBe("");
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await expect.poll(async () => (await geometry(page)).viewport.height).toBeCloseTo(400, 0);
    expect((await geometry(page)).inline).toBe("");
  });
});

test.describe("phone type scale", () => {
  const sizes = (page: Page) =>
    page.evaluate(() => {
      const px = (selector: string) => {
        const node = document.querySelector(selector);
        if (node === null) throw new Error(`${selector} missing`);
        return parseFloat(getComputedStyle(node).fontSize);
      };
      return {
        body: px(".qpanel__body"),
        prompt: px(".qpanel__prompt"),
        composer: px(".qpanel__input"),
        disclaimer: px(".qpanel__disc"),
        title: px(".qpanel__title"),
      };
    });

  test("phone (390px): 14px conversation, 16px composer, larger footer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await load(page);
    expect(await sizes(page)).toEqual({
      body: 14,
      prompt: 14,
      composer: 16,
      disclaimer: 11,
      title: 13,
    });
    // The prompt column widens with the type: `qubae ›` fits on one line.
    const fits = await page.evaluate(() => {
      const prompt = document.querySelector<HTMLElement>(".qpanel__prompt");
      if (prompt === null) throw new Error("prompt missing");
      prompt.textContent = "qubae ›";
      return prompt.scrollWidth <= prompt.clientWidth;
    });
    expect(fits).toBe(true);
  });

  test("desktop (1280px): unchanged", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await load(page);
    expect(await sizes(page)).toEqual({
      body: 12.5,
      prompt: 12.5,
      composer: 12.5,
      disclaimer: 9.5,
      title: 11.5,
    });
  });

  test.describe("touch screen wider than 720px (phone held sideways)", () => {
    test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    test("desktop conversation type, but the 16px composer floor (no iOS focus zoom)", async ({
      page,
    }) => {
      await load(page);
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
      const s = await sizes(page);
      expect(s.body).toBe(12.5);
      expect(s.composer).toBe(16);
    });
  });

  test("--text-scale still multiplies; the phone composer never drops below 16px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await load(page, { textScale: 0.8 });
    const s = await sizes(page);
    expect(s.body).toBeCloseTo(11.2, 1);
    expect(s.composer).toBe(16);
  });
});

test.describe("post-page launcher corner", () => {
  for (const [width, left] of [
    [1280, 20.48], // clamp(20px, 1.6vw, 44px) at 1280px
    [1920, 30.72],
    [400, 16],
  ] as const) {
    test(`bottom-left at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await load(page, { options: { variant: "post-page" } });
      const box = await page.locator(".qlaunch").boundingBox();
      if (box === null) throw new Error("launcher has no box");
      expect(box.x).toBeCloseTo(left, 1);
      expect(box.x + box.width).toBeLessThan(width / 2);
    });
  }

  test("the corner variant stays bottom-right", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await load(page);
    const box = await page.locator(".qlaunch").boundingBox();
    if (box === null) throw new Error("launcher has no box");
    expect(box.x).toBeGreaterThan(640);
  });
});

test.describe("caption backing", () => {
  /** Contrast of the caption ink on its own backing, and the backing's alpha. */
  const caption = (page: Page) =>
    page.evaluate(() => {
      const node = document.querySelector(".qlaunch__cap");
      if (node === null) throw new Error("caption missing");
      const style = getComputedStyle(node);
      const parse = (css: string): number[] => {
        const m = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(css);
        if (m === null) throw new Error(`unparsed colour ${css}`);
        return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
      };
      const lum = ([r = 0, g = 0, b = 0]: number[]) => {
        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const ink = lum(parse(style.color));
      const back = parse(style.backgroundColor);
      const patch = lum(back);
      return {
        alpha: back[3],
        ratio: (Math.max(ink, patch) + 0.05) / (Math.min(ink, patch) + 0.05),
      };
    });

  for (const setup of [
    { name: "light page", theme: "light" },
    { name: "dark page", theme: "dark" },
    { name: "on stage (light page)", theme: "light", graphCss: true, options: { onStage: true } },
  ] as const) {
    test(`${setup.name}: opaque patch, AA ink on it`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await load(page, setup);
      const { alpha, ratio } = await caption(page);
      // Opaque, so the page content behind it never affects legibility.
      expect(alpha).toBe(1);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

test.describe("focus return after close", () => {
  /** Focus state of the active element: id/class, :focus-visible, painted outline. */
  const focusState = (page: Page) =>
    page.evaluate(() => {
      const node = document.activeElement;
      if (!(node instanceof HTMLElement)) return { who: "none", visible: false, outline: "none" };
      return {
        who: node.id === "" ? node.className : `#${node.id}`,
        visible: node.matches(":focus-visible"),
        outline: getComputedStyle(node).outlineStyle,
      };
    });

  test("Q from a page element, Esc: focus goes back to it, with no ring", async ({ page }) => {
    await load(page);
    await page.locator("#other").focus();
    await page.keyboard.press("q");
    await expect(composer(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(overlay(page)).toBeHidden();
    expect(await focusState(page)).toEqual({ who: "#other", visible: false, outline: "none" });
  });

  test("a returned link gets no ring either; Tab brings the ring back on the next element", async ({
    page,
  }) => {
    await load(page);
    await page.locator("#link").focus();
    await page.keyboard.press("q");
    await page.keyboard.press("Escape");
    expect(await focusState(page)).toEqual({ who: "#link", visible: false, outline: "none" });
    await page.keyboard.press("Tab");
    const next = await focusState(page);
    expect(next.who).toBe("#other");
    expect(next.visible).toBe(true);
    expect(next.outline).not.toBe("none");
  });

  test("launcher open, keyboard close: focus on the launcher without a ring", async ({ page }) => {
    await load(page);
    await page.locator(".qlaunch").click();
    await expect(composer(page)).toBeFocused();
    await page.keyboard.press("Escape");
    expect(await focusState(page)).toEqual({ who: "qlaunch", visible: false, outline: "none" });
  });

  test("Q open, the element removed meanwhile: focus falls back to the launcher", async ({
    page,
  }) => {
    await load(page);
    await page.locator("#other").focus();
    await page.keyboard.press("q");
    await page.evaluate(() => document.getElementById("other")?.remove());
    await page.keyboard.press("Escape");
    expect(await focusState(page)).toEqual({ who: "qlaunch", visible: false, outline: "none" });
  });
});
