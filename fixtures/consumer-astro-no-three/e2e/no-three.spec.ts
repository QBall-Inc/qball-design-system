// The optional `three` peer, skipped. Vite stubs a missing optional peer, so
// both sites BUILD; the explorer fails at run time instead, inside its own
// frame: the mount resolves with canvasError "three-unavailable", the canvas
// error figure shows, and the facet chips and details panel stay usable. The
// launcher-only site never needs three and runs normally.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const GATE_DIR = fileURLToPath(new URL("..", import.meta.url));

/**
 * True when `three` resolves from the site's own folder (it must not). Asked of
 * plain Node in that folder with a clean environment, as the site's build sees
 * it; the test runner's own resolver and env are not the site's.
 */
function resolvesThree(project: string): boolean {
  const probe = spawnSync(process.execPath, ["-e", 'require.resolve("three")'], {
    cwd: `${GATE_DIR}${project}`,
    // Not the runner's environment: it injects its own module hooks and paths.
    env: { PATH: process.env["PATH"] ?? "" },
  });
  return probe.status === 0;
}

type Mounted = { ok: true; canvasError?: string | null } | { ok: false; error: string };

declare global {
  interface Window {
    __mounted?: Mounted;
  }
}

async function open(page: Page, url: string): Promise<{ mounted: Mounted; errors: string[] }> {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__mounted !== undefined, undefined, { timeout: 30_000 });
  const mounted = await page.evaluate(() => window.__mounted);
  if (mounted === undefined) throw new Error("page script did not report");
  return { mounted, errors };
}

test("explorer without three: the mount resolves, the error figure shows, the chips still work", async ({
  page,
}) => {
  expect(resolvesThree("explorer-only")).toBe(false);
  const { mounted, errors } = await open(page, "http://127.0.0.1:4331/");
  expect(mounted).toEqual({ ok: true, canvasError: "three-unavailable" });
  await expect(page.locator("#explorer .gx .gc-error")).toBeVisible();
  await expect(page.locator("#explorer .gx .gc-error")).toContainText(
    "the graph could not be loaded.",
  );
  await expect(page.locator("#explorer .gx canvas")).toHaveCount(0);
  await page.locator("#explorer .gx__ftoggle").click();
  await page.locator("#explorer .fchip").first().click();
  await expect(page.locator("#explorer .gx__ftoggle")).toHaveText(/1 active/);
  expect(errors).toEqual([]);
});

test("launcher without three: builds, mounts and opens on Q", async ({ page }) => {
  expect(resolvesThree("launcher-only")).toBe(false);
  const { mounted, errors } = await open(page, "http://127.0.0.1:4332/");
  expect(mounted).toEqual({ ok: true });
  await expect(page.locator(".qlaunch")).toHaveCount(1);
  await page.keyboard.press("q");
  await expect(page.locator(".qoverlay")).toBeVisible();
  expect(errors).toEqual([]);
});
