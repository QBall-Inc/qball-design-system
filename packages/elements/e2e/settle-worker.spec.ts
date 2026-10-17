// The live (no-layout) settle runs in a Web Worker started from the blob the
// BUILT './graph' entry carries, in real Chromium. The settled picture must be
// exactly the precomputed-layout picture (the with-layout fixture is
// computeLayout's output for the same bundle). The camera does not depend on
// the positions and never moves on its own, so each always-on label's
// left/top is an exact fingerprint of its node's position. A page whose
// Content-Security-Policy blocks workers must fall back to the main thread and
// reach the same picture.
// Needs the built dist/ (`pnpm test` builds it).
import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SIM_CONFIG } from "../src/graph/sim";
import {
  LAYOUT_BUNDLE,
  LIVE_BUNDLE,
  mountCanvas,
  nextFrames,
  openHarness,
  settle,
} from "./graph-canvas-harness";

test.describe.configure({ timeout: 180_000 });

/** name|left|top of every always-on label, read in one page turn. */
async function fingerprint(page: Page): Promise<string[]> {
  await nextFrames(page);
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#host .gc-label:not([data-off])")]
      .map((l) => [l.textContent ?? "", l.style.left, l.style.top].join("|"))
      .sort(),
  );
}

async function settledPicture(page: Page, bundle: string): Promise<string[]> {
  expect(await mountCanvas(page, bundle)).toEqual({ ok: true });
  expect(await settle(page)).toBe(true);
  return fingerprint(page);
}

/** Counts the messages every Worker the page constructs delivers to it (installed before the page loads). */
const countWorkerMessages = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __workerMessages: number; Worker: typeof Worker };
    w.__workerMessages = 0;
    const Native = w.Worker;
    w.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", () => w.__workerMessages++);
      }
    };
  });

const workerMessages = (page: Page) =>
  page.evaluate(() => (window as unknown as { __workerMessages: number }).__workerMessages);

/** Workers the page starts, and whether each has closed. */
function watchWorkers(page: Page): { started: number; closed: number } {
  const seen = { started: 0, closed: 0 };
  page.on("worker", (worker) => {
    seen.started++;
    worker.on("close", () => seen.closed++);
  });
  return seen;
}

let expected: string[] = [];

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await openHarness(page);
  expected = await settledPicture(page, LAYOUT_BUNDLE);
  await page.close();
  expect(expected.length).toBeGreaterThan(10);
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`reduced motion: ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test("settles in a worker to exactly the precomputed layout, then stops it", async ({
      page,
    }) => {
      const workers = watchWorkers(page);
      await countWorkerMessages(page);
      await openHarness(page);
      expect(await settledPicture(page, LIVE_BUNDLE)).toEqual(expected);
      expect(workers.started).toBe(1);
      // Every simulation step arrived from the worker: the picture is the worker's, not a fallback's.
      expect(await workerMessages(page)).toBe(DEFAULT_SIM_CONFIG.iters);
      await expect.poll(() => workers.closed).toBe(1);
    });

    test("with workers blocked by the page's CSP, settles on the main thread to the same layout", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __violations: string[] };
        w.__violations = [];
        document.addEventListener("securitypolicyviolation", (e) =>
          w.__violations.push(e.effectiveDirective),
        );
      });
      const workers = watchWorkers(page);
      await openHarness(page, { csp: "worker-src 'none'" });
      expect(await settledPicture(page, LIVE_BUNDLE)).toEqual(expected);
      // The canvas did try a worker and the policy stopped it (the check is not vacuous).
      const violations = await page.evaluate(
        () => (window as unknown as { __violations: string[] }).__violations,
      );
      expect(violations).toContain("worker-src");
      expect(workers.started).toBe(0);
    });
  });
}

test("starts no worker for a bundle with a precomputed layout", async ({ page }) => {
  const workers = watchWorkers(page);
  await openHarness(page);
  await settledPicture(page, LAYOUT_BUNDLE);
  expect(workers.started).toBe(0);
});
