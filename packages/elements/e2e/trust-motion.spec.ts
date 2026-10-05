// VerdictStamp motion + keyboard in real Chromium: overflow ticker,
// prefers-reduced-motion, and keyboard toggling of stamp and feedback. jsdom
// has no layout or CSS animation, so these can only be proven here. Renders
// the BUILT dist/trust atoms with the real @qball-inc/tokens CSS.
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
    <div id="narrow" style="width:220px"></div>
    <div id="wide" style="width:900px"></div>
    <div id="fb"></div>
    <script type="module">
      import { renderVerdictStamp, renderFeedback } from "/dist/trust/index.js";
      const long = { verdict: "grounded", explanation: { claims: 1234567, episodes: 7654321, confidenceTier: "medium" } };
      document.getElementById("narrow").append(renderVerdictStamp(long));
      document.getElementById("wide").append(renderVerdictStamp(long));
      window.__feedback = [];
      document.getElementById("fb").append(renderFeedback("turn-1", { onChange: (c) => window.__feedback.push(c.value) }));
      window.__ready = true;
    </script>
  </body>
</html>`;

declare global {
  interface Window {
    __ready?: boolean;
    __feedback?: (number | null)[];
  }
}

async function open(page: Page): Promise<void> {
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

test.beforeAll(() => {
  if (!existsSync(join(DIST, "trust", "index.js"))) {
    throw new Error(
      `${DIST}/trust/index.js missing — build @qball-inc/elements first (pnpm test).`,
    );
  }
});

test("an overflowing explanation becomes a seamless ticker; one that fits does not", async ({
  page,
}) => {
  await open(page);
  for (const id of ["narrow", "wide"]) await page.click(`#${id} .vstamp`);

  const narrow = page.locator("#narrow .vrow__txt");
  await expect(narrow).toHaveClass(/is-ticking/);
  await expect(narrow.locator(".vtick > span")).toHaveCount(2);
  await expect(narrow.locator('.vtick > span[aria-hidden="true"]')).toHaveCount(1);
  const seconds = await narrow.evaluate((n) => parseFloat(n.style.getPropertyValue("--tdur")));
  expect(seconds).toBeGreaterThanOrEqual(6);
  const animation = await narrow
    .locator(".vtick")
    .evaluate((n) => getComputedStyle(n).animationName);
  expect(animation).toBe("vtick");

  const wide = page.locator("#wide .vrow__txt");
  await expect(wide).not.toHaveClass(/is-ticking/);
  await expect(wide.locator(".vtick > span")).toHaveCount(1);
});

test("the stamp label shimmers until opened, then stays still", async ({ page }) => {
  await open(page);
  const wave = page.locator("#wide .vstamp__wave");
  expect(await wave.evaluate((n) => getComputedStyle(n).animationName)).toBe("vstamp-wave");
  await page.click("#wide .vstamp");
  await page.click("#wide .vstamp");
  expect(await wave.evaluate((n) => getComputedStyle(n).animationName)).toBe("none");
});

test("reduced motion: no shimmer, no ticker motion, the explanation wraps", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  expect(
    await page.locator("#narrow .vstamp__wave").evaluate((n) => getComputedStyle(n).animationName),
  ).toBe("none");
  await page.click("#narrow .vstamp");
  const box = page.locator("#narrow .vrow__txt");
  expect(await box.evaluate((n) => getComputedStyle(n).whiteSpace)).toBe("normal");
  expect(await box.locator(".vtick").evaluate((n) => getComputedStyle(n).animationName)).toBe(
    "none",
  );
  const hiddenCopies = await box
    .locator('.vtick > span[aria-hidden="true"]')
    .evaluateAll((nodes) => nodes.filter((n) => getComputedStyle(n).display !== "none").length);
  expect(hiddenCopies).toBe(0);
});

test("keyboard: Enter/Space toggle the explanation and the feedback marks", async ({ page }) => {
  await open(page);
  const stamp = page.locator("#wide .vstamp");
  await stamp.focus();
  await page.keyboard.press("Enter");
  await expect(stamp).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#wide .vrow__exp")).toBeVisible();
  await page.keyboard.press("Space");
  await expect(stamp).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#wide .vrow__exp")).toBeHidden();

  await page.keyboard.press("Enter");
  await page.locator("#wide .vrow__close").focus();
  await page.keyboard.press("Enter");
  await expect(stamp).toHaveAttribute("aria-expanded", "false");
  await expect(stamp).toBeFocused();

  const up = page.locator("#fb .qfb__up");
  await up.focus();
  await page.keyboard.press("Space");
  await expect(up).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#fb .qfb__down")).toHaveAttribute("aria-pressed", "true");
  await expect(up).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => window.__feedback)).toEqual([1, -1]);
});
