// Gallery deploy gate: the STAGED site's GraphExplorer card mounts the bundled
// explorer on the staged mock bundle, settles, filters through its chips and
// opens the panel for a deep link, with no page errors.
import { expect, test } from "@playwright/test";

test("staged GraphExplorer card mounts, filters and narrates a deep link", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const res = await page.goto("/preview/graph-explorer.html");
  expect(res?.status()).toBe(200);
  await page.waitForFunction(
    () => window.__explorerOk === true || typeof window.__explorerErr === "string",
    null,
    { timeout: 90_000 },
  );
  expect(await page.evaluate(() => window.__explorerErr ?? null)).toBeNull();
  await expect(page.locator("#explorer .gx canvas")).toHaveCount(1);
  await expect(page.locator(".pending")).toBeHidden();
  await expect(page.locator("#explorer .gx__panel")).toHaveClass(/is-hidden/);

  await page.locator("#explorer .gx__ftoggle").click();
  await page.locator("#explorer .fchip").first().click();
  await expect(page.locator("#explorer .gx__ftoggle")).toHaveText(/1 active/);

  expect(await page.evaluate(() => window.__explorer.select("n8n", { openPanel: true }))).toBe(
    true,
  );
  await expect(page.locator("#explorer .gx__panel")).not.toHaveClass(/is-hidden/);
  await expect(page.locator("#events")).toHaveText(/n8n/);

  expect(pageErrors).toEqual([]);
});
