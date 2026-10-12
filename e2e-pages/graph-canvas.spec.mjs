// Gallery deploy gate: the STAGED site's GraphCanvas card mounts the bundled
// canvas on the staged mock bundle, settles, and shows the live freshness line.
import { expect, test } from "@playwright/test";

test("staged GraphCanvas card mounts, settles and shows the status line", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const res = await page.goto("/preview/graph-canvas.html");
  expect(res?.status()).toBe(200);
  await page.waitForFunction(
    () => window.__canvasOk === true || typeof window.__canvasErr === "string",
    null,
    { timeout: 90_000 },
  );
  expect(await page.evaluate(() => window.__canvasErr ?? null)).toBeNull();
  await expect(page.locator("#canvas canvas")).toHaveCount(1);
  await expect(page.locator("#canvas .gc-status")).toHaveText(
    /^\d+ entities · .* · snapshot \d{4}-\d{2}-\d{2}$/,
  );
  await expect(page.locator(".pending")).toBeHidden();

  await page.getByRole("button", { name: "none" }).click();
  await expect(page.locator("#canvas .gc-note")).toBeVisible();
  await expect(page.locator("#events")).toHaveText("filter · 0 matches");

  expect(pageErrors).toEqual([]);
});
