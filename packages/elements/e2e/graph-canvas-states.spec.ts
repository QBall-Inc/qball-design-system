// GraphCanvas states and lifecycle in real Chromium (SwiftShader WebGL), with
// the real tokens CSS and the full QuBrain mock bundle: loading, settling
// (live, and instant under reduced motion), idle, selected, filtered, empty
// filter and error states; expand / "show more"; setData revision swaps;
// destroy; a failed lazy three import; a lost WebGL context. Hover is covered
// with the real-input tests in graph-canvas.spec.ts.
// Renders the BUILT dist/graph entry. Needs the built dist/ (`pnpm test` builds it).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  LAYOUT_BUNDLE,
  LIVE_BUNDLE,
  events,
  mountCanvas,
  openHarness,
  settle,
  visibleLabels,
} from "./graph-canvas-harness";

test.describe.configure({ timeout: 180_000 });

interface FixtureNode {
  name: string;
  cls: string;
}
const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "..", "..", "fixtures", "qubrain", LAYOUT_BUNDLE), "utf8"),
) as {
  nodes: FixtureNode[];
  typed_edges: unknown[];
  comention_edges: unknown[];
  stats: { snapshot_date: string };
};
const WIDE_STATUS = `${fixture.nodes.length} entities · ${fixture.typed_edges.length} typed · ${fixture.comention_edges.length} co-mention · snapshot ${fixture.stats.snapshot_date}`;
const NARROW_STATUS = `${fixture.nodes.length} entities · snapshot ${fixture.stats.snapshot_date}`;

const status = (page: Page) => page.locator("#host .gc-status");

async function mounted(page: Page, options: Record<string, unknown> = {}): Promise<void> {
  await openHarness(page);
  expect(await mountCanvas(page, LAYOUT_BUNDLE, options)).toEqual({ ok: true });
  await expect(status(page)).toHaveText(WIDE_STATUS);
}

test.describe("states", () => {
  test("loading: the status line reads loading until three.js arrives", async ({ page }) => {
    const harness = await openHarness(page, { holdThree: true });
    const mounting = mountCanvas(page, LAYOUT_BUNDLE);
    await expect(status(page)).toHaveText("loading graph…");
    await expect(page.locator("#host canvas")).toHaveCount(0);
    harness.releaseThree();
    expect(await mounting).toEqual({ ok: true });
    await expect(status(page)).toHaveText(WIDE_STATUS);
  });

  test("settling: a live percentage while the layout moves, then the idle status", async ({
    page,
  }) => {
    await openHarness(page);
    expect(await mountCanvas(page, LIVE_BUNDLE)).toEqual({ ok: true });
    await expect(status(page)).toHaveText(/^settling… \d+%$/);
    // Status and label positions are read in one page turn, sampled until the
    // settle ends. The worker settle can finish fast, so no particular
    // percentage is awaited — only that progress climbs and the cloud moves.
    const sample = () =>
      page.evaluate(() => ({
        status: document.querySelector("#host .gc-status")?.textContent ?? "",
        labels: [...document.querySelectorAll<HTMLElement>("#host .gc-label:not([data-off])")].map(
          (l) => ({
            name: l.textContent ?? "",
            x: parseFloat(l.style.left),
            y: parseFloat(l.style.top),
          }),
        ),
      }));
    const settling: Awaited<ReturnType<typeof sample>>[] = [];
    for (let now = await sample(); now.status.startsWith("settling"); now = await sample()) {
      settling.push(now);
    }
    const percents = settling.map((s) => Number(/(\d+)%$/.exec(s.status)?.[1]));
    // The live percentage was seen at least twice, and it only ever climbs.
    expect(percents.every((p) => Number.isInteger(p))).toBe(true);
    expect(new Set(percents).size).toBeGreaterThan(1);
    expect(percents).toEqual([...percents].sort((a, b) => a - b));
    // The cloud is visibly moving while it settles.
    const early = new Map(settling[0]!.labels.map((l) => [l.name, l]));
    const moved = settling.slice(1).some((s) =>
      s.labels.some((b) => {
        const a = early.get(b.name);
        return a !== undefined && Math.hypot(b.x - a.x, b.y - a.y) > 3;
      }),
    );
    expect(moved).toBe(true);
    expect(await settle(page)).toBe(true);
    await expect(status(page)).toHaveText(WIDE_STATUS);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("settling paints no motion: the picture jumps once to the settled layout", async ({
      page,
    }) => {
      await openHarness(page);
      expect(await mountCanvas(page, LIVE_BUNDLE)).toEqual({ ok: true });
      // Status and label positions are read in one page turn, so a sample
      // never mixes a "settling" status with the final paint.
      const sample = () =>
        page.evaluate(() => ({
          status: document.querySelector("#host .gc-status")?.textContent ?? "",
          labels: [
            ...document.querySelectorAll<HTMLElement>("#host .gc-label:not([data-off])"),
          ].map((l) => [l.textContent ?? "", l.style.left, l.style.top].join("|")),
        }));
      await expect(page.locator("#host .gc-label:not([data-off])").first()).toBeAttached();
      const first = await sample();
      expect(first.status).toMatch(/^settling/);
      expect(first.labels.length).toBeGreaterThan(0);
      let samples = 0;
      for (let now = await sample(); now.status.startsWith("settling"); now = await sample()) {
        samples++;
        expect(now.labels).toEqual(first.labels);
      }
      // Precondition: the settle was observed mid-way, so the check is not vacuous.
      expect(samples).toBeGreaterThan(1);
      expect(await settle(page)).toBe(true);
      await expect(status(page)).toHaveText(WIDE_STATUS);
      expect((await visibleLabels(page)).length).toBeGreaterThan(0);
    });
  });

  test("idle: the freshness line has real counts, short form on a narrow host", async ({
    page,
  }) => {
    await mounted(page);
    await expect(status(page)).toHaveText(WIDE_STATUS);

    const narrow = await page.context().newPage();
    await openHarness(narrow, { width: 500, height: 500 });
    expect(await mountCanvas(narrow, LAYOUT_BUNDLE)).toEqual({ ok: true });
    await expect(status(narrow)).toHaveText(NARROW_STATUS);
  });

  test("selected: lit neighbours keep their labels while the rest dim away", async ({ page }) => {
    await mounted(page);
    const before = await visibleLabels(page);
    expect(await page.evaluate(() => window.__gc.select("n8n"))).toBe(true);
    const event = (await events(page)).at(-1)!;
    const lit = new Set([
      event.detail.node!.name,
      ...event.detail.neighbors!.map((n) => n.node.name),
    ]);
    await expect(page.locator('#host .gc-label[data-kind="sel"]')).toHaveText("n8n");
    await expect(page.locator('#host .gc-label[data-kind="nbr"]').first()).toBeAttached();
    const after = await visibleLabels(page);
    expect(after.length).toBeGreaterThan(0);
    for (const label of after) expect(lit.has(label.name)).toBe(true);
    // Some always-on labels of unlit entities were hidden by the dimming.
    expect(before.some((label) => !lit.has(label.name))).toBe(true);
  });

  test("filtered: only matching entities keep labels; the filter event reports matches", async ({
    page,
  }) => {
    await mounted(page);
    const people = new Set(fixture.nodes.filter((n) => n.cls === "person").map((n) => n.name));
    const matches = await page.evaluate(() => window.__gc.filterClass("person"));
    expect(matches).toBe(people.size);
    expect((await events(page)).at(-1)).toEqual({
      type: "filter",
      detail: { matches: people.size },
    });
    const labels = await visibleLabels(page);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(people.has(label.name)).toBe(true);
    await expect(page.locator("#host .gc-note")).toBeHidden();

    expect(await page.evaluate(() => window.__gc.filterClass(null))).toBe(fixture.nodes.length);
  });

  test("empty filter: the centred note shows and the filter event reports zero", async ({
    page,
  }) => {
    await mounted(page);
    expect(await page.evaluate(() => window.__gc.filterNone())).toBe(0);
    await expect(page.locator("#host .gc-note")).toBeVisible();
    await expect(page.locator("#host .gc-note")).toHaveText(
      "no entities match the active filters.",
    );
    expect((await events(page)).at(-1)).toEqual({ type: "filter", detail: { matches: 0 } });
    expect(await visibleLabels(page)).toEqual([]);
  });

  test("error: a failed three.js import rejects typed and shows the figure; retry is an event", async ({
    page,
  }) => {
    await openHarness(page, { breakThree: true });
    const result = await mountCanvas(page, LAYOUT_BUNDLE);
    expect(result).toMatchObject({ ok: false, typed: true, code: "three-unavailable" });
    const figure = page.locator("#host .gc-error");
    await expect(figure).toBeVisible();
    await expect(figure).toContainText("the graph could not be loaded.");
    await expect(page.locator("#host canvas")).toHaveCount(0);
    await figure.getByRole("button", { name: "retry" }).click();
    expect(await events(page)).toEqual([{ type: "retry", detail: { code: "three-unavailable" } }]);
  });

  test("error: errorUi false leaves the message to the consumer", async ({ page }) => {
    await openHarness(page, { breakThree: true });
    const result = await mountCanvas(page, LAYOUT_BUNDLE, { errorUi: false });
    expect(result).toMatchObject({ ok: false, typed: true, code: "three-unavailable" });
    await expect(page.locator("#host .gc-error")).toHaveCount(0);
  });

  test("error: losing the WebGL context after mount shows the figure and emits error", async ({
    page,
  }) => {
    await mounted(page);
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>("#host canvas")!;
      const gl = canvas.getContext("webgl2")!;
      gl.getExtension("WEBGL_lose_context")!.loseContext();
    });
    await expect(page.locator("#host .gc-error")).toBeVisible();
    const last = (await events(page)).at(-1);
    expect(last).toMatchObject({ type: "error", detail: { code: "webgl-unavailable" } });
  });
});

test.describe("lifecycle", () => {
  test("show more grows the budgeted neighbour list; the chip button does the same", async ({
    page,
  }) => {
    await mounted(page);
    expect(await page.evaluate(() => window.__gc.select("Claude Code"))).toBe(true);
    const first = (await events(page)).at(-1)!;
    expect(first.detail.neighbors).toHaveLength(20);
    const total = first.detail.total!;

    expect(await page.evaluate(() => window.__gc.expand())).toBe(true);
    const second = (await events(page)).at(-1)!;
    expect(second.type).toBe("select");
    expect(second.detail.neighbors).toHaveLength(40);
    // Expanding extends the list; it does not re-sort what was shown.
    expect(second.detail.neighbors!.slice(0, 20)).toEqual(first.detail.neighbors);

    await page.locator("#host .gc-chip").getByRole("button", { name: "show more" }).click();
    expect((await events(page)).at(-1)!.detail.neighbors).toHaveLength(60);
    await expect(page.locator("#host .gc-chip")).toContainText(`showing 60 of ${total} neighbors`);
  });

  test("setData swaps revisions in place: selection clears, names still resolve", async ({
    page,
  }) => {
    await mounted(page);
    expect(await page.evaluate(() => window.__gc.select("n8n"))).toBe(true);
    await page.evaluate(() => window.__gc.setData("mock-bundle.with-layout.json", "mock-rev-2"));
    await expect(page.locator("#host .gc-chip")).toBeHidden();
    await expect(page.locator("#host canvas")).toHaveCount(1);
    await expect(status(page)).toHaveText(WIDE_STATUS);
    expect(await page.evaluate(() => window.__gc.select("n8n"))).toBe(true);
    expect((await events(page)).at(-1)?.detail.node?.name).toBe("n8n");
    expect(await page.evaluate(() => window.__gc.select("no such entity"))).toBe(false);
  });

  test("destroy removes the canvas and its chrome; input no longer reaches it", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await mounted(page);
    const target = (await visibleLabels(page))[0]!;
    // Precondition: the same click selects while mounted.
    await page.mouse.click(target.x, target.y);
    expect((await events(page)).at(-1)?.detail.node?.name).toBe(target.name);
    await page.evaluate(() => window.__gc.clear());
    await page.evaluate(() => {
      window.__gc.events.length = 0;
    });
    await page.evaluate(() => window.__gc.destroy());
    await expect(page.locator("#host canvas")).toHaveCount(0);
    await expect(page.locator("#host [class^='gc-']")).toHaveCount(0);
    await page.mouse.click(target.x, target.y);
    await page.keyboard.press("Escape");
    expect(await events(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
