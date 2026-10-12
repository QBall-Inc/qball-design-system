// GraphCanvas in real Chromium (SwiftShader WebGL) on the full QuBrain mock
// bundle with the real tokens CSS: the ported shaders compile and draw
// class-coloured points; the two edge classes stay visually distinct; real
// mouse, keyboard, touch and wheel input drives selection, hover, orbit, pan,
// zoom, pinch and node drag. jsdom has no WebGL, so this is the only place
// these are provable. States and lifecycle: graph-canvas-states.spec.ts.
// Renders the BUILT dist/graph entry. Needs the built dist/ (`pnpm test` builds it).
import { expect, test, type Page } from "@playwright/test";
import {
  LAYOUT_BUNDLE,
  countBlends,
  nearestHue,
  segmentColors,
  events,
  labelMap,
  mountCanvas,
  openHarness,
  shared,
  spread,
  tokenRgb,
  visibleLabels,
  type PlacedLabel,
} from "./graph-canvas-harness";

test.describe.configure({ timeout: 90_000 });

/** Opens the harness and mounts the full bundle (precomputed layout: no settle). */
async function mounted(
  page: Page,
  options: Record<string, unknown> = {},
  host?: { width: number; height: number },
): Promise<void> {
  await openHarness(page, host);
  expect(await mountCanvas(page, LAYOUT_BUNDLE, options)).toEqual({ ok: true });
  await expect(page.locator("#host .gc-status")).toHaveText(/entities/);
}

/** The visible always-on label of the entity with the most episodes (labels are ordered by eps). */
async function topLabel(page: Page): Promise<PlacedLabel> {
  const labels = await visibleLabels(page);
  expect(labels.length).toBeGreaterThan(0);
  return labels[0]!;
}

async function lastEvent(page: Page) {
  return (await events(page)).at(-1);
}

test.describe("rendering", () => {
  test("the ported shaders compile and draw class-coloured points on the stage", async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on("pageerror", (err) => problems.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error" || /shader|program/i.test(msg.text())) problems.push(msg.text());
    });
    await mounted(page);

    expect(problems).toEqual([]);
    const stage = await tokenRgb(page, "--bg-primary");
    const sage = await tokenRgb(page, "--color-signal");
    const { total, stage: bare, blends } = await countBlends(page, stage, [sage]);
    // Most of the frame is the deep-ink stage, but a large share is drawn on.
    expect(bare).toBeGreaterThan(total * 0.3);
    expect(total - bare).toBeGreaterThan(20_000);
    // `tool` (the most common class) renders in brand sage.
    expect(blends[0]).toBeGreaterThan(500);
    expect((await visibleLabels(page)).length).toBeGreaterThan(5);
  });

  test("typed and co-mention edges render as two distinct colours when lit", async ({ page }) => {
    await mounted(page);
    const stage = await tokenRgb(page, "--bg-primary");
    const sage = await tokenRgb(page, "--color-signal");
    const amber = await tokenRgb(page, "--color-highlight");

    // n8n has 8 asserted (typed) and 55 co-mention neighbours: the first
    // budget of 20 lights all 8 typed edges sage and 12 co-mention edges amber.
    expect(await page.evaluate(() => window.__gc.select("n8n"))).toBe(true);
    const detail = (await lastEvent(page))!.detail;
    const typed = new Set(detail.neighbors!.filter((n) => n.typed).map((n) => n.node.name));
    expect(typed.size).toBe(8);
    expect(detail.neighbors!.length - typed.size).toBe(12);

    // Read the colour along each lit edge whose far end carries a label (the
    // engine places labels at their node's projected point).
    const labels = await labelMap(page);
    const centre = labels.get("n8n")!;
    const angle = (l: { x: number; y: number }) => Math.atan2(l.y - centre.y, l.x - centre.x);
    const lit = [...labels.values()].filter(
      (l) => l.name !== "n8n" && Math.hypot(l.x - centre.x, l.y - centre.y) > 40,
    );
    // Skip an edge that runs within 10° of a lit edge of the other class: the
    // two lines overlap on screen and the sample would read the stronger one.
    const ends = lit.filter((l) =>
      lit.every((o) => {
        if (typed.has(o.name) === typed.has(l.name)) return true;
        const d = Math.abs(angle(o) - angle(l));
        return Math.min(d, 2 * Math.PI - d) > (10 * Math.PI) / 180;
      }),
    );
    const colors = await segmentColors(
      page,
      stage,
      ends.map((to) => ({ from: centre, to })),
    );
    const verdicts = ends.map((end, i) => ({
      typed: typed.has(end.name),
      hue: nearestHue(stage, colors[i]!, [sage, amber]) === 0 ? "sage" : "amber",
    }));
    // Both edge classes are sampled, and each renders in its own colour.
    expect(verdicts.filter((v) => v.typed).length).toBeGreaterThan(1);
    expect(verdicts.filter((v) => !v.typed).length).toBeGreaterThan(1);
    for (const v of verdicts) expect(v.hue).toBe(v.typed ? "sage" : "amber");
  });
});

test.describe("mouse and keyboard", () => {
  test("clicking a rendered node selects it with the budgeted neighbour list", async ({ page }) => {
    await mounted(page);
    const target = await topLabel(page);
    await page.mouse.click(target.x, target.y);

    const event = await lastEvent(page);
    expect(event?.type).toBe("select");
    expect(event?.detail.node?.name).toBe(target.name);
    expect(event?.detail.neighbors).toHaveLength(20);
    expect(event?.detail.total).toBeGreaterThan(20);
    const chip = page.locator("#host .gc-chip");
    await expect(chip).toBeVisible();
    await expect(chip).toContainText(target.name);
    await expect(chip).toContainText(`showing 20 of ${event?.detail.total} neighbors`);
    // The selected label takes the highlight ink from graph.css.
    const selected = page.locator('#host .gc-label[data-kind="sel"]');
    await expect(selected).toHaveText(target.name);
    const highlight = await tokenRgb(page, "--color-highlight");
    await expect(selected).toHaveCSS("color", `rgb(${highlight.join(", ")})`);
  });

  test("hovering a node shows its name and class; leaving hides the tip", async ({ page }) => {
    await mounted(page);
    const target = await topLabel(page);
    const tip = page.locator("#host .gc-hover");
    await page.mouse.move(target.x, target.y);
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(target.name);
    await expect(tip.locator(".gc-cls")).not.toBeEmpty();
    await page.mouse.move(2, 2);
    await expect(tip).toBeHidden();
  });

  test("Esc clears the selection when focus is in the canvas", async ({ page }) => {
    await mounted(page);
    const target = await topLabel(page);
    await page.mouse.click(target.x, target.y);
    await expect(page.locator("#host .gc-chip")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#host .gc-chip")).toBeHidden();
    expect((await lastEvent(page))?.type).toBe("clear");
  });

  test("dragging empty stage orbits: labels move unevenly and nothing is selected", async ({
    page,
  }) => {
    await mounted(page, { draggable: false });
    const before = await labelMap(page);
    await page.mouse.move(450, 300);
    await page.mouse.down();
    await page.mouse.move(560, 330, { steps: 10 });
    await page.mouse.up();
    const pairs = shared(before, await labelMap(page));
    expect(pairs.length).toBeGreaterThan(3);
    const moves = pairs.map(([a, b]) => b.x - a.x);
    expect(Math.max(...moves.map(Math.abs))).toBeGreaterThan(10);
    // A rotation swings near and far points opposite ways (a pan never does).
    expect(moves.some((m) => m > 2) && moves.some((m) => m < -2)).toBe(true);
    expect(await events(page)).toEqual([]);
  });

  test("alt-drag pans: every label shifts the same way as the pointer", async ({ page }) => {
    await mounted(page, { draggable: false });
    const before = await labelMap(page);
    await page.keyboard.down("Alt");
    await page.mouse.move(450, 300);
    await page.mouse.down();
    await page.mouse.move(520, 340, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    const pairs = shared(before, await labelMap(page));
    expect(pairs.length).toBeGreaterThan(3);
    const dx = pairs.map(([a, b]) => b.x - a.x);
    const dy = pairs.map(([a, b]) => b.y - a.y);
    // A pan translates the view: every label moves the same direction (by
    // more for nearer ones, under perspective), unlike an orbit.
    const sameWay = (values: number[]) => values.every((v) => v > 2) || values.every((v) => v < -2);
    expect(sameWay(dx)).toBe(true);
    expect(sameWay(dy)).toBe(true);
    expect(await events(page)).toEqual([]);
  });

  test("the wheel zooms the cloud in and out, clamped to the zoom range", async ({ page }) => {
    await mounted(page, { labelBudget: 60 });
    const base = await labelMap(page);
    await page.mouse.move(450, 300);
    await page.mouse.wheel(0, -300);
    const zoomedIn = await labelMap(page);
    const inPairs = shared(base, zoomedIn);
    expect(spread(inPairs.map(([, b]) => b))).toBeGreaterThan(
      spread(inPairs.map(([a]) => a)) * 1.1,
    );

    // Far past the 6000 limit: further wheel-out stops changing the picture.
    for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
    const atLimit = await labelMap(page);
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 600);
    const pastLimit = shared(atLimit, await labelMap(page));
    expect(pastLimit.length).toBeGreaterThan(3);
    for (const [a, b] of pastLimit) expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.5);
  });

  test("dragging a node moves it with the pointer and selects it on release only if still", async ({
    page,
  }) => {
    await mounted(page);
    const target = await topLabel(page);
    const others = (await visibleLabels(page)).slice(1);
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.mouse.move(target.x + 60, target.y + 40, { steps: 8 });
    await page.mouse.up();
    const after = await labelMap(page);
    const moved = after.get(target.name);
    expect(moved).toBeDefined();
    expect(Math.hypot(moved!.x - (target.x + 60), moved!.y - (target.y + 40))).toBeLessThan(12);
    // The camera did not orbit: a label far from the dragged node stays put.
    const far = others.reduce((a, b) =>
      Math.hypot(b.x - target.x, b.y - target.y) > Math.hypot(a.x - target.x, a.y - target.y)
        ? b
        : a,
    );
    const farAfter = after.get(far.name);
    expect(farAfter).toBeDefined();
    expect(Math.hypot(farAfter!.x - far.x, farAfter!.y - far.y)).toBeLessThan(2);
    expect(await events(page)).toEqual([]);
  });
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 760 } });

  test("tap selects a node; the coarse hint and collapsed legend show", async ({ page }) => {
    await mounted(page, {}, { width: 380, height: 600 });
    await expect(page.locator("#host .gc-hint")).toHaveText(/pinch to zoom/);
    await expect(page.locator("#host .gc-lgbtn")).toBeVisible();
    const target = await topLabel(page);
    await page.touchscreen.tap(target.x, target.y);
    const event = await lastEvent(page);
    expect(event?.type).toBe("select");
    expect(event?.detail.node?.name).toBe(target.name);
  });

  test("a two-finger pinch zooms the cloud", async ({ page }) => {
    await mounted(page, { labelBudget: 40 }, { width: 380, height: 600 });
    const before = await labelMap(page);
    const cdp = await page.context().newCDPSession(page);
    const box = (await page.locator("#host").boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const fingers = (gap: number) => [
      { x: cx - gap, y: cy, id: 1 },
      { x: cx + gap, y: cy, id: 2 },
    ];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: fingers(20) });
    for (const gap of [40, 60, 80, 100]) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: fingers(gap) });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    const pairs = shared(before, await labelMap(page));
    expect(pairs.length).toBeGreaterThan(2);
    expect(spread(pairs.map(([, b]) => b))).toBeGreaterThan(spread(pairs.map(([a]) => a)) * 1.3);
    expect(await events(page)).toEqual([]);
  });
});
