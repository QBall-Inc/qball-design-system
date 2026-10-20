// Gallery deploy gate: the STAGED site's GraphExplorer card mounts the bundled
// explorer on the staged mock bundle, settles, filters through its chips and
// opens the panel for a deep link, with no page errors. A REAL click on a
// rendered node (at the point where the canvas draws its label) selects it,
// and a connection row narrates the hop from the card's detail fixtures.
import { expect, test } from "@playwright/test";

async function mounted(page) {
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
  return pageErrors;
}

/** A visible always-on label whose node point is open canvas (not under an overlay). */
async function openNode(page) {
  await expect(page.locator("#explorer .gc-label:not([data-off])").first()).toBeAttached({
    timeout: 30_000,
  });
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const found = await page.evaluate(() => {
    const canvasHost = document.querySelector("#explorer .gx__stage .graphcanvas");
    if (canvasHost === null) return null;
    const box = canvasHost.getBoundingClientRect();
    for (const label of document.querySelectorAll("#explorer .gc-label")) {
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

test("staged GraphExplorer card: a real node click selects, a connection row narrates the hop", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const pageErrors = await mounted(page);
  const crumbs = page.locator("#explorer .epanel__crumbs button");
  const target = await openNode(page);
  await page.mouse.click(target.x, target.y);
  await expect(page.locator("#explorer .gx__panel")).not.toHaveClass(/is-hidden/);
  await expect(crumbs).toHaveText([target.name]);
  const row = page
    .locator("#explorer .epanel__rows .nrow:not(.nrow--more):has(.nrow__kind--typed)")
    .first();
  const next = (await row.locator(".nrow__name").textContent()) ?? "";
  await row.click();
  await expect(crumbs).toHaveText([target.name, next]);
  await expect(page.locator("#explorer .claim").first()).toContainText(
    "episodic memory outperforms flat context past 100 turns",
  );
  expect(pageErrors).toEqual([]);
});

test("staged GraphExplorer card mounts, filters and narrates a deep link", async ({ page }) => {
  test.setTimeout(120_000);
  const pageErrors = await mounted(page);
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
