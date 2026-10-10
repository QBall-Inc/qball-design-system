// Trust atoms through the PACKED tarballs in a real static Astro site.
// Each themed page must: carry the server-side import marker, render every
// state, resolve the packed token CSS to that theme's exact colours, keep
// hostile text and URLs inert (with a positive control proving they would
// fire), and load no three.js. The token stylesheets must land in their
// locked order. Expected colours come from the INSTALLED tokens CSS, so a
// palette change in the tokens package never needs an edit here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const FIXTURE_DIR = fileURLToPath(new URL("..", import.meta.url));
const TOKENS_CSS = join(FIXTURE_DIR, "node_modules", "@qball-inc", "tokens", "colors_and_type.css");
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

/** Same matcher as packages/elements/src/entry-contents.test.ts, plus the renderer class. */
const THREE_REF = /\bthree\b|\bTHREE\b|WebGLRenderer/;

/** `#3F6B5B` → `rgb(63, 107, 91)`, the form getComputedStyle returns. */
function hexToRgb(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (m === null) throw new Error(`not a #rrggbb colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h ?? "", 16));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

/** Token value in the first block opened by `selector`, from the installed CSS. */
function tokenColor(theme: Theme, name: string): string {
  const css = readFileSync(TOKENS_CSS, "utf8");
  const selector = theme === "light" ? ":root {" : '[data-theme="dark"] {';
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`${selector} block not found in ${TOKENS_CSS}`);
  const block = css.slice(start, css.indexOf("}", start));
  const m = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(block);
  if (m?.[1] === undefined) throw new Error(`--${name} not set in the ${theme} block`);
  return hexToRgb(m[1]);
}

interface HostileResult {
  controlFired: number;
  fired: number;
  imgs: number;
  hrefs: (string | null)[];
  hostileTextShown: boolean;
}
type TrustResult = { ok: true; hostile: HostileResult } | { ok: false; error: string };

declare global {
  interface Window {
    __trust?: TrustResult;
  }
}

/** Opens a themed page, records errors/dialogs, and waits for the client script. */
async function openPage(page: Page, theme: Theme) {
  const errors: string[] = [];
  const dialogs: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.goto(`/${theme}/`);
  await page.waitForFunction(() => window.__trust !== undefined);
  const result = await page.evaluate(() => window.__trust);
  if (result === undefined) throw new Error("client script did not publish a result");
  if (!result.ok) throw new Error(`client script failed: ${result.error}`);
  return { result, errors, dialogs };
}

const atom = (page: Page, name: string) => page.locator(`[data-atom="${name}"]`);

for (const theme of THEMES) {
  test.describe(`${theme} page`, () => {
    test("prerendered with the server-side import and the page theme", async ({ page }) => {
      await openPage(page, theme);
      await expect(page.locator('meta[name="qball-ssr-entries"]')).toHaveAttribute(
        "content",
        "core,trust",
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    });

    test("renders every claim, source and footer state", async ({ page }) => {
      await openPage(page, theme);
      const marks = async (name: string) => [
        await atom(page, name).locator(".claim__mark--endorsed").count(),
        await atom(page, name).locator(".claim__mark--verified").count(),
      ];
      expect(await marks("claim-high-both")).toEqual([1, 1]);
      expect(await marks("claim-endorsed-only")).toEqual([1, 0]);
      expect(await marks("claim-verified-only")).toEqual([0, 1]);
      expect(await marks("claim-medium-none")).toEqual([0, 0]);

      await expect(atom(page, "claim-high-both").locator(".claim__conf--high")).toHaveCount(1);
      await expect(atom(page, "claim-medium-none").locator(".claim__conf--med")).toHaveCount(1);
      await expect(atom(page, "claim-low").locator(".claim__conf--low")).toHaveCount(1);

      const withReplacement = atom(page, "claim-superseded-replacement");
      await expect(withReplacement.locator("article.claim--superseded")).toHaveCount(1);
      await expect(withReplacement.locator(".claim__now")).toContainText(
        "The server is generally available.",
      );
      const noReplacement = atom(page, "claim-superseded-unavailable");
      await expect(noReplacement.locator("article.claim--superseded")).toHaveCount(1);
      await expect(noReplacement.locator(".claim__now")).toContainText("replacement not available");

      // Consumer company badge by domain; an unknown host gets no badge, only its host.
      await expect(atom(page, "claim-company-badge").locator(".claim__src")).toContainText(
        "Example Lab · saved 2025-06-20",
      );
      const noBadge = atom(page, "claim-no-badge").locator(".claim__src");
      await expect(noBadge).toContainText("blog.example.org · saved 2025-06-20");
      await expect(noBadge).not.toContainText("Example Lab");

      const list = atom(page, "reading-list");
      await expect(list.locator(".srcrow")).toHaveCount(4);
      await expect(list.locator(".srcrow__mark", { hasText: "EL" })).toHaveCount(1);
      await expect(list).toContainText("source unavailable");

      await expect(atom(page, "footer-answer").locator("footer.provfoot")).toContainText(
        "snapshot 2026-07-17",
      );
      await expect(atom(page, "footer-panel").locator("footer.provfoot")).toHaveCount(1);
    });

    test("verdict stamps open and close; feedback toggles", async ({ page }) => {
      await openPage(page, theme);
      for (const word of ["grounded", "withheld", "refused"]) {
        const host = atom(page, `stamp-${word}`);
        const stamp = host.locator(`.vstamp--${word}`);
        await expect(stamp).toHaveAttribute("aria-expanded", "false");
        await stamp.click();
        await expect(stamp).toHaveAttribute("aria-expanded", "true");
        await expect(host.locator(".vrow")).toHaveClass(/\bopen\b/);
        await expect(host).toHaveAttribute("data-opened", "1");
        await host.locator(".vrow__close").click();
        await expect(stamp).toHaveAttribute("aria-expanded", "false");
      }

      const feedback = atom(page, "feedback");
      const up = feedback.locator(".qfb__up");
      await up.click();
      await expect(up).toHaveAttribute("aria-pressed", "true");
      await expect(feedback).toHaveAttribute("data-change", "1:consumer-turn");
      await up.click();
      await expect(up).toHaveAttribute("aria-pressed", "false");
      await expect(feedback).toHaveAttribute("data-change", "null:consumer-turn");
    });

    test("packed token CSS resolves to this theme's colours", async ({ page }) => {
      await openPage(page, theme);
      const color = (selector: string, property = "color") =>
        page
          .locator(selector)
          .first()
          .evaluate((node, prop) => getComputedStyle(node).getPropertyValue(prop), property);

      expect(await color("body", "background-color")).toBe(tokenColor(theme, "bg-primary"));
      expect(await color(".vstamp--grounded")).toBe(tokenColor(theme, "color-signal"));
      expect(await color(".vstamp--withheld")).toBe(tokenColor(theme, "color-highlight"));
      expect(await color(".claim__conf--high")).toBe(tokenColor(theme, "color-signal"));
      expect(await color(".claim__conf--med")).toBe(tokenColor(theme, "data-warn"));
      expect(await color(".claim__conf--low")).toBe(tokenColor(theme, "data-flat"));
      expect(await color(".provfoot b")).toBe(tokenColor(theme, "text-secondary"));
      expect(await color(".srcrow__mark")).toBe(tokenColor(theme, "anno-source"));

      // Feedback colours apply only to the pressed toggle; the CSS fades
      // colour in, so poll until the transition settles.
      const feedback = atom(page, "feedback");
      await feedback.locator(".qfb__down").click();
      await expect.poll(() => color(".qfb__down")).toBe(tokenColor(theme, "color-highlight"));
      await feedback.locator(".qfb__up").click();
      await expect.poll(() => color(".qfb__up")).toBe(tokenColor(theme, "color-signal"));
    });

    test("hostile text and URLs stay inert (positive control fires)", async ({ page }) => {
      const { result, errors, dialogs } = await openPage(page, theme);
      // The same payloads injected unsafely ran twice (img onerror + javascript: link)...
      expect(result.hostile.controlFired).toBe(2);
      // ...but through the packed atoms nothing ran, no <img> was parsed, the
      // markup shows as text and no link carries the javascript: URL.
      expect(result.hostile.fired).toBe(0);
      expect(result.hostile.imgs).toBe(0);
      expect(result.hostile.hostileTextShown).toBe(true);
      expect(result.hostile.hrefs).toEqual([]);
      expect(errors).toEqual([]);
      expect(dialogs).toEqual([]);
    });

    test("loads no three.js", async ({ page }) => {
      const pending: Promise<string>[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "script") pending.push(response.text());
      });
      await openPage(page, theme);
      const inline = await page
        .locator("script:not([src])")
        .evaluateAll((nodes) => nodes.map((n) => n.textContent ?? ""));
      const bodies = await Promise.all(pending);
      // Non-vacuous: the page really loaded its bundled module script.
      expect(bodies.length).toBeGreaterThan(0);
      for (const text of [...bodies, ...inline]) expect(text).not.toMatch(THREE_REF);
    });
  });
}

test("token stylesheets land in the locked order", async ({ page, request }) => {
  await openPage(page, "light");
  const hrefs = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
  expect(hrefs).toHaveLength(1);
  const css = await (await request.get(hrefs[0] ?? "")).text();
  // One marker that exists in only one file each: colors_and_type.css,
  // components.css, graph.css.
  const offsets = ["--stage-bg:", ".claim__conf--high", ".graphcanvas"].map((m) => css.indexOf(m));
  for (const offset of offsets) expect(offset).toBeGreaterThanOrEqual(0);
  expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
});
