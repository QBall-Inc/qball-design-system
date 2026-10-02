// Gallery deploy gate: the STAGED site must (1) serve the graph styles and have
// them applied, and (2) run the bundled graph specimen to a rendered WebGL frame.
import { expect, test } from "@playwright/test";

test("staged site applies graph.css and renders the bundled graph specimen", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

  const res = await page.goto("/preview/graph-smoke.html");
  expect(res?.status()).toBe(200);

  // The specimen reports through window globals; wait for either outcome.
  await page.waitForFunction(
    () => window.__smokeOk === true || typeof window.__smokeErr === "string",
    null,
    {
      timeout: 20_000,
    },
  );
  const outcome = await page.evaluate(() => ({
    ok: window.__smokeOk === true,
    err: window.__smokeErr ?? null,
  }));
  expect(outcome).toEqual({ ok: true, err: null });

  // graph.css is APPLIED, not just linked: on a light page the canvas tier
  // remaps --bg-primary to the dark-stage --stage-bg, so .graphcanvas's
  // background must equal that token and differ from the page background.
  const colors = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--stage-bg)";
    document.body.appendChild(probe);
    const stage = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return {
      stage,
      canvas: getComputedStyle(document.getElementById("stage")).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    };
  });
  expect(colors.stage).toMatch(/^rgb\(/);
  expect(colors.canvas).toBe(colors.stage);
  expect(colors.canvas).not.toBe(colors.body);

  expect(pageErrors).toEqual([]);
});
