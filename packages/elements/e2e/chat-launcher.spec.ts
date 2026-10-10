// Ask launcher + overlay in real Chromium: the Q hotkey with real keyboard
// input, focus trap and restore, inert background, the three close paths,
// panel geometry, and the CSS-owned motion under prefers-reduced-motion.
// jsdom has no layout, CSS or real focus rules, so these are proven here.
// Renders the BUILT dist/chat entry with the real @qball-inc/tokens CSS.
// Needs the built dist/ (`pnpm test` builds it; CI runs it first).
import { existsSync, readFileSync } from "node:fs";
import { join, normalize, resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://elements.test";
const DIST = resolve(process.cwd(), "dist");
const TOKENS = resolve(process.cwd(), "..", "tokens");

const PAGE = `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/components.css">
  </head>
  <body>
    <main>
      <input id="field" aria-label="field">
      <div id="rich" contenteditable="true">edit me</div>
      <button id="other" type="button">other</button>
      <div style="height:3000px"></div>
    </main>
    <script type="module">
      import { mount } from "/dist/chat/index.js";
      window.__events = [];
      const handle = mount(document.body, {
        onAsk: (text) => window.__events.push("onAsk:" + text),
      });
      for (const type of ["open", "close", "ask"]) {
        handle.on(type, (e) => window.__events.push(type + (e.detail.text ? ":" + e.detail.text : "")));
      }
      window.__ready = true;
    </script>
  </body>
</html>`;

declare global {
  interface Window {
    __ready?: boolean;
    __events?: string[];
  }
}

async function load(page: Page): Promise<void> {
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") {
      await route.fulfill({ contentType: "text/html", body: PAGE });
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

const events = (page: Page): Promise<string[]> => page.evaluate(() => window.__events ?? []);
const overlay = (page: Page) => page.locator(".qoverlay");
const composer = (page: Page) => page.locator(".qpanel__input");

test.beforeAll(() => {
  if (!existsSync(join(DIST, "chat", "index.js"))) {
    throw new Error(`${DIST}/chat/index.js missing — build @qball-inc/elements first (pnpm test).`);
  }
});

test("Q opens the overlay from the page and focuses the composer", async ({ page }) => {
  await load(page);
  await expect(overlay(page)).toBeHidden();
  await page.locator("#other").focus();
  await page.keyboard.press("q");
  await expect(overlay(page)).toBeVisible();
  await expect(composer(page)).toBeFocused();
  // Once open, q is just a letter in the composer.
  await page.keyboard.type("q?");
  await expect(composer(page)).toHaveValue("q?");
  expect(await events(page)).toEqual(["open"]);
});

test("Q is suppressed in editable fields and with modifiers held", async ({ page }) => {
  await load(page);
  await page.locator("#field").focus();
  await page.keyboard.press("q");
  await expect(page.locator("#field")).toHaveValue("q");
  await page.locator("#rich").focus();
  await page.keyboard.press("q");
  await expect(overlay(page)).toBeHidden();

  await page.locator("#other").focus();
  for (const chord of ["Control+q", "Alt+q", "Meta+q"]) await page.keyboard.press(chord);
  await expect(overlay(page)).toBeHidden();
  expect(await events(page)).toEqual([]);
});

test("Tab and Shift+Tab stay inside the panel; the background is inert and unscrollable", async ({
  page,
}) => {
  await load(page);
  await page.locator(".qlaunch").click();
  await expect(composer(page)).toBeFocused();
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector(".qoverlay")?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() =>
        document.querySelector(".qoverlay")?.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  const backgroundFocusable = await page.evaluate(() => {
    const other = document.getElementById("other");
    other?.focus();
    return document.activeElement === other;
  });
  expect(backgroundFocusable).toBe(false);
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
});

for (const [name, close] of [
  ["Esc", (page: Page) => page.keyboard.press("Escape")],
  ["a scrim click", (page: Page) => page.mouse.click(20, 20)],
  ["the esc keycap", (page: Page) => page.locator(".qpanel__esc .keycap").click()],
] as const) {
  test(`${name} closes the overlay and focus returns to the launcher`, async ({ page }) => {
    await load(page);
    await page.locator(".qlaunch").click();
    await expect(composer(page)).toBeFocused();
    await close(page);
    await expect(overlay(page)).toBeHidden();
    await expect(page.locator(".qlaunch")).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
    expect(await page.evaluate(() => document.querySelector("main")?.hasAttribute("inert"))).toBe(
      false,
    );
    expect(await events(page)).toEqual(["open", "close"]);
  });
}

test("Enter asks, Shift+Enter adds a line", async ({ page }) => {
  await load(page);
  await page.locator(".qlaunch").click();
  await page.keyboard.type("first line");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("second");
  const grown = await composer(page).evaluate((n) => n.clientHeight);
  await page.keyboard.press("Enter");
  await expect(composer(page)).toHaveValue("");
  expect(grown).toBeGreaterThan(await composer(page).evaluate((n) => n.clientHeight));
  expect(await events(page)).toEqual([
    "open",
    "ask:first line\nsecond",
    "onAsk:first line\nsecond",
  ]);
});

test("desktop panel geometry: 460 × 600, lifted 18 / 16 off the corner", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await load(page);
  await page.locator(".qlaunch").click();
  await expect(page.locator(".qpanel")).toHaveCSS("opacity", "1");
  const settled = await page.locator(".qpanel").boundingBox();
  if (settled === null) throw new Error("panel has no box");
  // The shipped .qpanel is content-box: 460 × 600 plus its 1px hairline frame.
  await expect(page.locator(".qpanel")).toHaveCSS("width", "460px");
  await expect(page.locator(".qpanel")).toHaveCSS("height", "600px");
  expect(Math.round(settled.width)).toBe(462);
  expect(Math.round(1280 - (settled.x + settled.width))).toBe(18);
  expect(Math.round(800 - (settled.y + settled.height))).toBe(16);
});

test("narrow panel geometry: full width with equal 12px gutters", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 700 });
  await load(page);
  await page.locator(".qlaunch").click();
  await expect(page.locator(".qpanel")).toHaveCSS("opacity", "1");
  const box = await page.locator(".qpanel").boundingBox();
  if (box === null) throw new Error("panel has no box");
  expect(Math.round(box.x)).toBe(12);
  expect(Math.round(400 - (box.x + box.width))).toBe(12);
  expect(Math.round(700 - (box.y + box.height))).toBe(12);
});

test("default motion: the pulse-dot breathes and the panel rises 14px as it fades in", async ({
  page,
}) => {
  await load(page);
  const dot = page.locator(".qlaunch__dot");
  expect(await dot.evaluate((n) => getComputedStyle(n).animationName)).toBe("qb-pulse");
  expect(await dot.evaluate((n) => getComputedStyle(n).animationDuration)).toBe("2.4s");
  const panel = page.locator(".qpanel");
  expect(await panel.evaluate((n) => getComputedStyle(n).transform)).toBe(
    "matrix(1, 0, 0, 1, 0, 14)",
  );
  expect(await panel.evaluate((n) => getComputedStyle(n).transitionProperty)).toContain(
    "transform",
  );
});

test("reduced motion: static pulse-dot at .8, panel fades without the rise", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await load(page);
  const dot = page.locator(".qlaunch__dot");
  expect(await dot.evaluate((n) => getComputedStyle(n).animationName)).toBe("none");
  expect(await dot.evaluate((n) => getComputedStyle(n).opacity)).toBe("0.8");
  const panel = page.locator(".qpanel");
  expect(await panel.evaluate((n) => getComputedStyle(n).transform)).toBe("none");
  expect(await panel.evaluate((n) => getComputedStyle(n).transitionProperty)).toContain("opacity");
  await page.locator(".qlaunch").click();
  await expect(panel).toHaveCSS("opacity", "1");
  expect(await panel.evaluate((n) => getComputedStyle(n).transform)).toBe("none");
});

test("on stage (graph.css): the mascot takes the stage ink in the light theme", async ({
  page,
}) => {
  await load(page);
  const inks = await page.evaluate(async () => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/tokens/graph.css";
    await new Promise((done) => {
      link.addEventListener("load", done);
      document.head.append(link);
    });
    const entry = "/dist/chat/index.js";
    const { mount } = (await import(entry)) as typeof import("../src/chat");
    const stage = document.createElement("div");
    document.body.append(stage);
    const handle = mount(stage, { onStage: true, hotkey: false });
    const probe = document.createElement("span");
    probe.style.color = "var(--stage-mark)";
    document.body.append(probe);
    const mark = handle.launcher.querySelector(".qbmark");
    return {
      expected: getComputedStyle(probe).color,
      page: getComputedStyle(document.body).color,
      mascot: mark === null ? "" : getComputedStyle(mark).color,
    };
  });
  expect(inks.mascot).toBe(inks.expected);
  expect(inks.mascot).not.toBe(inks.page);
});

test("after a click on blank panel space, Esc still closes and Tab returns to the panel", async ({
  page,
}) => {
  await load(page);
  await page.locator(".qlaunch").click();
  await page.locator(".qpanel__body").click({ position: { x: 200, y: 200 } });
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(() =>
      document.querySelector(".qoverlay")?.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.locator(".qpanel__body").click({ position: { x: 200, y: 200 } });
  await page.keyboard.press("Escape");
  await expect(overlay(page)).toBeHidden();
  await expect(page.locator(".qlaunch")).toBeFocused();
});
