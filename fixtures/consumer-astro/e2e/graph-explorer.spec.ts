// The graph explorer through the PACKED tarballs on a real Astro route that
// shares ChatLayout with the launcher pages. The page must prerender the graph
// entry server-side, load graph.css after the two launcher sheets, and mount
// the explorer on the mock bundle. A REAL click on a rendered node (found at
// the screen point where the canvas draws that node's label) selects it; a
// connection row then narrates the hop through the page's real `detail`
// callback. Q still opens the launcher, Esc closes the launcher before it
// touches the explorer, and the launcher yields while the details panel is
// open. A build-output scan proves the explorer route did not leak three.js
// into the launcher-only pages.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const FIXTURE_DIR = fileURLToPath(new URL("..", import.meta.url));
const DIST = join(FIXTURE_DIR, "dist");

/** Same matcher as e2e/trust-atoms.spec.ts and e2e/chat-launcher.spec.ts. */
const THREE_REF = /\bthree\b|\bTHREE\b|WebGLRenderer/;

type ExplorerResult =
  | {
      ok: true;
      canvasError: string | null;
      hops: [string, string][];
      events: { type: string; node?: string | null; open?: boolean }[];
    }
  | { ok: false; error: string };

declare global {
  interface Window {
    __explorer?: ExplorerResult;
  }
}

async function openExplorer(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explorer/");
  await page.waitForFunction(() => window.__explorer !== undefined, undefined, { timeout: 30_000 });
  const result = await page.evaluate(() => window.__explorer);
  if (result === undefined || !result.ok) {
    throw new Error(`explorer did not mount: ${JSON.stringify(result)}`);
  }
  expect(result.canvasError).toBeNull();
  await expect(page.locator("#explorer .gx canvas")).toHaveCount(1);
  return errors;
}

const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
  );

/** A visible always-on label whose node point is open canvas (not under an overlay). */
async function openNode(page: Page): Promise<{ name: string; x: number; y: number }> {
  // The bundle carries no layout, so the canvas settles it first; labels appear after.
  await expect(page.locator(".gx .gc-label:not([data-off])").first()).toBeAttached({
    timeout: 30_000,
  });
  await frames(page);
  const found = await page.evaluate(() => {
    const canvasHost = document.querySelector<HTMLElement>(".gx__stage .graphcanvas");
    if (canvasHost === null) return null;
    const box = canvasHost.getBoundingClientRect();
    for (const label of document.querySelectorAll<HTMLElement>(".gx .gc-label")) {
      if (label.hasAttribute("data-off")) continue;
      const x = box.left + parseFloat(label.style.left);
      const y = box.top + parseFloat(label.style.top);
      const hit = document.elementFromPoint(x, y);
      if (hit === null || !canvasHost.contains(hit)) continue;
      if (hit.closest(".gc-lgwrap, .gc-hud, .gc-error")) continue;
      return { name: label.textContent ?? "", x, y };
    }
    return null;
  });
  if (found === null) throw new Error("no open node to click");
  return found;
}

const panel = (page: Page) => page.locator("#explorer .gx__panel");
const crumbs = (page: Page) => page.locator("#explorer .epanel__crumbs button");
const overlay = (page: Page) => page.locator(".qoverlay");
const result = async (page: Page) => {
  const r = await page.evaluate(() => window.__explorer);
  if (r === undefined || !r.ok) throw new Error("no explorer result");
  return r;
};

test.describe("explorer page", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("prerenders the graph entry and loads graph.css after the launcher sheets", async ({
    page,
    request,
  }) => {
    await page.goto("/explorer/");
    await expect(page.locator("#explorer")).toHaveAttribute("data-ssr-entry", "graph");
    await expect(page.locator('meta[name="qball-ssr-entries"]')).toHaveAttribute("content", "chat");
    const hrefs = await page
      .locator('link[rel="stylesheet"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
    expect(hrefs.length).toBeGreaterThan(0);
    // Astro may split the sheets into chunks; concatenate in link order.
    const css = (await Promise.all(hrefs.map(async (h) => (await request.get(h)).text()))).join(
      "\n",
    );
    const offsets = ["--stage-bg:", ".claim__conf--high", ".graphcanvas"].map((m) =>
      css.indexOf(m),
    );
    for (const offset of offsets) expect(offset).toBeGreaterThanOrEqual(0);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  test("a real click selects a node; a connection row narrates the hop through the detail callback; the launcher yields while the panel is open", async ({
    page,
  }) => {
    const errors = await openExplorer(page);
    await expect(panel(page)).toHaveClass(/is-hidden/);
    await expect(page.locator(".qlaunch")).toBeVisible();

    const target = await openNode(page);
    await page.mouse.click(target.x, target.y);
    await expect(panel(page)).not.toHaveClass(/is-hidden/);
    await expect(crumbs(page)).toHaveText([target.name]);
    await expect(page.locator(".qlaunch")).toBeHidden();

    const row = page
      .locator("#explorer .epanel__rows .nrow:not(.nrow--more):has(.nrow__kind--typed)")
      .first();
    const next = (await row.locator(".nrow__name").textContent()) ?? "";
    await row.click();
    await expect(crumbs(page)).toHaveText([target.name, next]);
    // The typed fixture's claim text, rendered by the panel from the callback's answer.
    await expect(page.locator("#explorer .claim").first()).toContainText(
      "episodic memory outperforms flat context past 100 turns",
    );
    expect((await result(page)).hops).toEqual([[target.name, next]]);

    await page.locator("#explorer .epanel__action").click(); // hide ▸
    await expect(panel(page)).toHaveClass(/is-hidden/);
    await expect(page.locator(".qlaunch")).toBeVisible();
    expect((await result(page)).events.filter((e) => e.type === "panel")).toEqual([
      { type: "panel", open: true },
      { type: "panel", open: false },
    ]);
    expect(errors).toEqual([]);
  });

  test("Q opens the launcher over the explorer; Esc closes the launcher first, then clears the selection", async ({
    page,
  }) => {
    const errors = await openExplorer(page);
    const target = await openNode(page);
    await page.mouse.click(target.x, target.y);
    await expect(crumbs(page)).toHaveText([target.name]);
    await page.locator("#explorer .epanel__action").click();
    await expect(panel(page)).toHaveClass(/is-hidden/);

    await page.keyboard.press("q");
    await expect(overlay(page)).toBeVisible();
    await expect(page.locator(".qpanel__input")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(overlay(page)).toBeHidden();
    // The explorer yielded to the open dialog: the selection survived.
    expect((await result(page)).events.filter((e) => e.type === "pathchange").at(-1)).toEqual({
      type: "pathchange",
      node: target.name,
    });

    await page.locator("#explorer .gx__stage canvas").focus();
    await page.keyboard.press("Escape");
    await expect
      .poll(async () => (await result(page)).events.filter((e) => e.type === "pathchange").at(-1))
      .toEqual({ type: "pathchange", node: null });
    expect(errors).toEqual([]);
  });
});

/** Every JS file a built page loads: its script srcs plus their static and dynamic imports, transitively. */
function pageScripts(htmlFile: string): Map<string, string> {
  const html = readFileSync(htmlFile, "utf8");
  const seen = new Map<string, string>();
  const queue = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1] ?? "");
  // Inline module scripts import their chunks too.
  for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
    for (const i of (m[1] ?? "").matchAll(/["'](\/_astro\/[^"']+\.js)["']/g))
      queue.push(i[1] ?? "");
  }
  while (queue.length > 0) {
    const src = queue.shift() ?? "";
    if (!src.startsWith("/_astro/") || seen.has(src)) continue;
    const file = join(DIST, src);
    if (!existsSync(file)) throw new Error(`${htmlFile} references missing ${src}`);
    const text = readFileSync(file, "utf8");
    seen.set(src, text);
    for (const i of text.matchAll(/["'`]\.\/([^"'`]+\.js)["'`]/g))
      queue.push(`/_astro/${i[1] ?? ""}`);
  }
  return seen;
}

test("build output: the launcher-only pages load no three.js; the explorer page does (positive control)", () => {
  const explorer = pageScripts(join(DIST, "explorer", "index.html"));
  // Positive control: the explorer route really reaches three's own module chunk,
  // so the scan below can see a leak (not just the graph's "three-unavailable" text).
  const threeChunks = [...explorer].filter(
    ([src, text]) => /three\.module/.test(src) && /WebGLRenderer/.test(text),
  );
  expect(threeChunks.length).toBeGreaterThan(0);
  for (const page of ["launcher-standard", "launcher-post-page"]) {
    const scripts = pageScripts(join(DIST, page, "index.html"));
    expect(scripts.size).toBeGreaterThan(0);
    for (const [src, text] of scripts) {
      expect(THREE_REF.test(text), `${page} loads ${src}, which references three`).toBe(false);
    }
  }
});
