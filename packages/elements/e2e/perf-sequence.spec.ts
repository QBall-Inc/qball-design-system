// The performance sequence (perf/canvas-perf-sequence.mjs) in real Chromium on
// the full mock bundles. CI renders through SwiftShader, so these check that
// the sequence runs and reports a complete, well-formed result, and that it
// flags the software renderer; they never assert a timing target (those are
// measured on real GPUs: docs/qubrain-graph-perf-protocol.md).
// Needs the built dist/ (`pnpm test` builds it).
import { expect, test, type Page } from "@playwright/test";
import { LAYOUT_BUNDLE, LIVE_BUNDLE, openHarness } from "./graph-canvas-harness";

test.describe.configure({ timeout: 120_000 });

interface Summary {
  n: number;
  p50: number | null;
  p95: number | null;
  max: number | null;
}

type Sweep = Summary & { frames: number[]; stamps: number[]; movedView: boolean };

interface CellResult {
  renderer: string | null;
  unmaskedRenderer: boolean;
  software: boolean;
  reducedMotion: boolean;
  hiddenDuringRun: boolean;
  startedAt: number;
  cadence: Summary;
  marks: { mountMs: number; settledMs: number | null; ttiMs: number | null };
  settledBeforeDragEnded: boolean | null;
  dragDuring: Sweep | null;
  dragDuringSettle: Summary | null;
  dragAfter: Sweep;
  hover: Summary & { points: number; latencies: number[]; handler: Summary };
  hostEmptyAfter: boolean;
}

const SMALL = { dragFrames: 12, hoverCols: 8, hoverRows: 5, hoverHoldMs: 20, cadenceFrames: 6 };

/** Runs one cell in the page with the small options, importing the modules the way the driver does. */
async function runCell(page: Page, bundle: string, live: boolean): Promise<CellResult> {
  await openHarness(page, { width: 1000, height: 640 });
  return page.evaluate<CellResult>(`(async () => {
    const { GraphCanvas } = await import("/dist/graph/index.js");
    const { runCell } = await import("/perf/canvas-perf-sequence.mjs");
    const host = document.getElementById("host");
    const data = await fetch("/fixtures/${bundle}").then((r) => r.json());
    const result = await runCell({ GraphCanvas, host, data, live: ${live}, options: ${JSON.stringify(SMALL)} });
    return { ...result, hostEmptyAfter: host.querySelector("canvas") === null };
  })()`);
}

const isTime = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0;

test("with-layout bundle: ordered marks, one frame interval per drag step, hover hits", async ({
  page,
}) => {
  const result = await runCell(page, LAYOUT_BUNDLE, false);

  expect(isTime(result.marks.mountMs)).toBe(true);
  expect(result.marks.settledMs).toBeGreaterThanOrEqual(result.marks.mountMs);
  expect(result.marks.ttiMs).toBeGreaterThanOrEqual(result.marks.settledMs!);
  expect(result.dragDuring).toBeNull();
  expect(result.dragDuringSettle).toBeNull();
  expect(result.settledBeforeDragEnded).toBeNull();
  expect(result.dragAfter.frames).toHaveLength(SMALL.dragFrames - 1);
  expect(result.dragAfter.frames.every(isTime)).toBe(true);
  expect(result.dragAfter.p95).toBeGreaterThanOrEqual(result.dragAfter.p50!);
  // The sweep's pointer moves rotated the view: the on-canvas labels moved.
  expect(result.dragAfter.movedView).toBe(true);
  expect(result.cadence.n).toBe(SMALL.cadenceFrames - 1);
  expect(isTime(result.cadence.p50)).toBe(true);
  expect(result.reducedMotion).toBe(false);
  expect(result.hiddenDuringRun).toBe(false);
  expect(result.hover.points).toBe(SMALL.hoverCols * SMALL.hoverRows);
  // Only moves onto a different node count, so some grid points must not.
  expect(result.hover.n).toBeGreaterThan(0);
  expect(result.hover.n).toBeLessThan(result.hover.points);
  expect(result.hover.latencies).toHaveLength(result.hover.n);
  expect(result.hover.latencies.every(isTime)).toBe(true);
  expect(result.hover.handler.n).toBe(result.hover.n);
  expect(result.hover.handler.max).toBeLessThanOrEqual(result.hover.max!);
  expect(result.hostEmptyAfter).toBe(true);
});

test("the software renderer CI draws with is flagged, so the driver would refuse it", async ({
  page,
}) => {
  const result = await runCell(page, LAYOUT_BUNDLE, false);

  expect(result.renderer).toMatch(/SwiftShader/i);
  expect(result.unmaskedRenderer).toBe(true);
  expect(result.software).toBe(true);
});

test("hardware renderer strings are not flagged as software", async ({ page }) => {
  await openHarness(page);
  const flags = await page.evaluate<boolean[]>(`(async () => {
    const { isSoftwareRenderer } = await import("/perf/canvas-perf-sequence.mjs");
    return [
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 2080 (0x00001E82) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "Apple GPU",
      "Adreno (TM) 642L",
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
    ].map(isSoftwareRenderer);
  })()`);

  expect(flags).toEqual([false, false, false, true, true]);
});

test("no-layout bundle: a drag during the live settle, then settle, then the rest", async ({
  page,
}) => {
  const result = await runCell(page, LIVE_BUNDLE, true);

  expect(result.dragDuring).not.toBeNull();
  expect(result.dragDuring!.frames).toHaveLength(SMALL.dragFrames - 1);
  expect(result.dragDuring!.movedView).toBe(true);
  expect(typeof result.settledBeforeDragEnded).toBe("boolean");
  // Only the sweep's frames that ended before the settle count as the settle's cost.
  const settleEnd = result.startedAt + result.marks.settledMs!;
  const { frames, stamps } = result.dragDuring!;
  const expected = frames.filter((_, i) => stamps[i + 1]! <= settleEnd);
  expect(result.dragDuringSettle).toMatchObject({ n: expected.length });
  expect(expected.length).toBeGreaterThan(0);
  if (expected.length > 0) {
    expect(result.dragDuringSettle!.max).toBe(Math.max(...expected));
  }
  // A live settle takes many frames, so it ends after mount resolves.
  expect(result.marks.settledMs).toBeGreaterThan(result.marks.mountMs);
  expect(result.marks.ttiMs).toBeGreaterThanOrEqual(result.marks.settledMs!);
  expect(result.dragAfter.frames).toHaveLength(SMALL.dragFrames - 1);
  expect(result.dragAfter.movedView).toBe(true);
  expect(result.hover.n).toBeGreaterThan(0);
});

test("summarize: nearest-rank p50 and p95, and nulls for no samples", async ({ page }) => {
  await openHarness(page);
  const [twenty, unsorted, empty] = await page.evaluate<Summary[]>(`(async () => {
    const { summarize } = await import("/perf/canvas-perf-sequence.mjs");
    return [
      summarize(Array.from({ length: 20 }, (_, i) => i + 1)),
      summarize([9, 1, 5]),
      summarize([]),
    ];
  })()`);

  expect(twenty).toEqual({ n: 20, p50: 10, p95: 19, max: 20 });
  expect(unsorted).toEqual({ n: 3, p50: 5, p95: 9, max: 9 });
  expect(empty).toEqual({ n: 0, p50: null, p95: null, max: null });
});

test("median and cellMedians: the gating values the protocol reads from a cell's runs", async ({
  page,
}) => {
  await openHarness(page);
  const [odd, even, missing, cell] = await page.evaluate<
    [number | null, number | null, number | null, Record<string, number | null>]
  >(`(async () => {
    const { median, cellMedians } = await import("/perf/canvas-perf-sequence.mjs");
    // Every field gets its own base value plus the run offset k, so a swapped field shows up.
    const run = (k) => ({
      marks: { mountMs: 100 + k, settledMs: 200 + k, ttiMs: 300 + k },
      dragDuring: { p50: 400 + k, p95: 500 + k },
      dragDuringSettle: { n: 600 + k, p50: 700 + k, p95: 800 + k },
      dragAfter: { p50: 900 + k, p95: 1000 + k },
      hover: { n: 1100 + k, p50: 1200 + k, p95: 1300 + k, handler: { p95: 1400 + k } },
      cadence: { p50: 1500 + k },
    });
    return [
      median([5, 1, 9]),
      median([4, 1, 3, 2]),
      median([null, undefined]),
      cellMedians([run(2), run(0), run(1)]),
    ];
  })()`);

  expect(odd).toBe(5);
  // An even count takes the lower middle value.
  expect(even).toBe(2);
  expect(missing).toBeNull();
  // The middle run (offset 1) for every field.
  expect(cell).toEqual({
    mountMs: 101,
    settledMs: 201,
    ttiMs: 301,
    dragDuringP50: 401,
    dragDuringP95: 501,
    dragDuringSettleFrames: 601,
    dragDuringSettleP50: 701,
    dragDuringSettleP95: 801,
    dragAfterP50: 901,
    dragAfterP95: 1001,
    hoverHits: 1101,
    hoverP50: 1201,
    hoverP95: 1301,
    hoverHandlerP95: 1401,
    cadenceP50: 1501,
  });
});
