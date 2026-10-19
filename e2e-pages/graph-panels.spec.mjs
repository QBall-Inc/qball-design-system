// Gallery deploy gate: the STAGED site's FacetFilterBar and EntityPanel cards
// render the bundled components with no page errors.
import { expect, test } from "@playwright/test";

for (const [path, check] of [
  [
    "/preview/facet-filter-bar.html",
    async (page) => {
      await expect(page.locator(".facetbar")).toHaveCount(4);
      await expect(page.locator('[data-specimen="incomplete"] .facetbar__count')).toHaveText(
        /^\d+ match · \d+ unassignable$/,
      );
    },
  ],
  [
    "/preview/entity-panel.html",
    async (page) => {
      await expect(page.locator(".epanel")).toHaveCount(7);
      await expect(page.locator('[data-specimen="typed"] .claim')).toHaveCount(2);
      await expect(page.locator('[data-specimen="comention"] .epanel__comnote')).toBeVisible();
    },
  ],
]) {
  test(`staged ${path} renders the live components`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("data-specimens", "ready");
    await expect(page.locator(".pending")).toBeHidden();
    await check(page);
    expect(pageErrors).toEqual([]);
  });
}
