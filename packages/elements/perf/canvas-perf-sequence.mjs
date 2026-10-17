// The self-timing performance sequence for GraphCanvas, as fixed by
// docs/qubrain-graph-perf-protocol.md. It runs inside the page under test and
// has no Node or Playwright dependency, so the desktop driver
// (scripts/measure-canvas-perf.mjs) and the phone page run the same steps.
// All times are performance.now() milliseconds.

/** Protocol constants. Tests pass smaller values through `runCell` options. */
export const PROTOCOL = Object.freeze({
  dragFrames: 180,
  dragStepPx: 6,
  hoverCols: 20,
  hoverRows: 12,
  hoverHoldMs: 120,
  cadenceFrames: 60,
});

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software/i;

/** Whether a WebGL renderer string names a software rasteriser. */
export function isSoftwareRenderer(renderer) {
  return SOFTWARE_RENDERER.test(renderer);
}

/**
 * The WebGL renderer string of this browser and whether it is a software
 * rasteriser. `unmasked` is false when the browser hides the real renderer
 * (no WEBGL_debug_renderer_info): the string then cannot show which GPU drew.
 */
export function webglRenderer() {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return { renderer: null, unmasked: false, software: true };
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { renderer, unmasked: info !== null, software: isSoftwareRenderer(renderer) };
}

/** Nearest-rank p50 / p95 and the max of a list of numbers. */
export function summarize(values) {
  if (values.length === 0) return { n: 0, p50: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p) => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return { n: sorted.length, p50: rank(0.5), p95: rank(0.95), max: sorted[sorted.length - 1] };
}

/** Resolves with performance.now() taken inside the next animation frame callback. */
const nextFrame = () => new Promise((done) => requestAnimationFrame(() => done(performance.now())));
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const deltas = (stamps) => stamps.slice(1).map((t, i) => t - stamps[i]);

/** Intervals between consecutive animation frames with nothing else running. */
async function frameCadence(frames) {
  const stamps = [];
  for (let i = 0; i < frames; i++) stamps.push(await nextFrame());
  return summarize(deltas(stamps));
}

function pointer(canvas, type, x, y, buttons) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    clientX: x,
    clientY: y,
    button: type === "pointermove" ? -1 : 0,
    buttons,
  });
  canvas.dispatchEvent(event);
  return event;
}

/** Page positions of the visible always-on labels; they move when the view rotates. */
const labelPositions = (host) =>
  [...host.querySelectorAll(".gc-label:not([data-off])")]
    .map((label) => `${label.style.left},${label.style.top}`)
    .join(";");

/**
 * Drag-rotation: pointer-down at the canvas centre, then one pointer move per
 * animation frame, `dragStepPx` to the right, for `dragFrames` frames. Every
 * frame carries input, so the frame intervals measure the redraw cost.
 */
async function dragSweep(canvas, host, { dragFrames, dragStepPx }) {
  const before = labelPositions(host);
  const box = canvas.getBoundingClientRect();
  let x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  pointer(canvas, "pointerdown", x, y, 1);
  const stamps = [];
  for (let i = 0; i < dragFrames; i++) {
    stamps.push(await nextFrame());
    x += dragStepPx;
    pointer(canvas, "pointermove", x, y, 1);
  }
  pointer(canvas, "pointerup", x, y, 0);
  const frames = deltas(stamps);
  // A sweep that left the view in place timed idle frames, not redraws.
  const movedView = labelPositions(host) !== before;
  return { ...summarize(frames), frames, stamps, movedView };
}

/** The intervals of a sweep that ended at or before `at` (a performance.now() time). */
function framesUntil(sweep, at) {
  return sweep.frames.filter((_, i) => sweep.stamps[i + 1] <= at);
}

/**
 * Hover/pick: a pointer moves across a `hoverCols` × `hoverRows` grid over the
 * canvas, holding each point `hoverHoldMs`. A move counts when the hover card
 * is rebuilt for a different node (the card replaces its children only then);
 * its latency runs from the event's timeStamp to the next animation frame.
 * The moves follow a fixed timer, so they tend to land at the same point in
 * the frame; `handler` (event to the end of the pick and card update) is
 * reported too, and handler + one frame interval bounds the latency at any
 * point in the frame.
 */
async function hoverGrid(canvas, card, { hoverCols, hoverRows, hoverHoldMs }) {
  const box = canvas.getBoundingClientRect();
  const watcher = new MutationObserver(() => undefined);
  watcher.observe(card, { childList: true });
  const latencies = [];
  const handlerMs = [];
  try {
    for (let row = 0; row < hoverRows; row++) {
      for (let col = 0; col < hoverCols; col++) {
        const x = box.left + ((col + 0.5) * box.width) / hoverCols;
        const y = box.top + ((row + 0.5) * box.height) / hoverRows;
        const event = pointer(canvas, "pointermove", x, y, 0);
        const handled = performance.now() - event.timeStamp;
        const changed = watcher.takeRecords().length > 0;
        if (changed) {
          handlerMs.push(handled);
          latencies.push((await nextFrame()) - event.timeStamp);
        }
        await wait(Math.max(0, hoverHoldMs - (performance.now() - event.timeStamp)));
      }
    }
  } finally {
    watcher.disconnect();
  }
  return {
    ...summarize(latencies),
    points: hoverCols * hoverRows,
    latencies,
    handler: summarize(handlerMs),
  };
}

/**
 * One measured run: mount `data` into `host` and time it, drag-rotate (twice
 * when `live`: during the settle and after it), then the hover grid. `data`
 * must already be parsed: JSON parsing stays outside the timed window.
 *
 * Marks, in ms from just before `GraphCanvas.mount`:
 * - `mountMs`: mount resolved (the canvas is drawing).
 * - `settledMs`: `handle.settled` resolved.
 * - `ttiMs`: the first animation frame after that (hover, pick and node drag respond).
 */
export async function runCell({ GraphCanvas, host, data, live, options = {} }) {
  const p = { ...PROTOCOL, ...options };
  // Reduced motion runs the no-layout settle on a different code path; record it with the run.
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let hidden = document.visibilityState !== "visible";
  const onVisibility = () => {
    if (document.visibilityState !== "visible") hidden = true;
  };
  document.addEventListener("visibilitychange", onVisibility);
  const gpu = webglRenderer();
  const cadence = await frameCadence(p.cadenceFrames);

  const t0 = performance.now();
  // Node drag off: a pointer-down on a node would drag it instead of rotating the view.
  const handle = await GraphCanvas.mount(host, { data, draggable: false });
  const mountMs = performance.now() - t0;
  const canvas = host.querySelector("canvas");
  const card = host.querySelector(".gc-hover");
  if (!canvas || !card) throw new Error("GraphCanvas did not render its canvas and hover card");
  // The browser rejects capture for a synthetic pointer id; capture does not change drawing cost.
  canvas.setPointerCapture = () => undefined;
  canvas.releasePointerCapture = () => undefined;

  let settledMs = null;
  let ttiMs = null;
  const interactive = handle.settled.then(async () => {
    settledMs = performance.now() - t0;
    ttiMs = (await nextFrame()) - t0;
  });

  try {
    const dragDuring = live ? await dragSweep(canvas, host, p) : null;
    const settledBeforeDragEnded = live ? settledMs !== null : null;
    await interactive;
    // The sweep can outlast the settle: its frames before the settle ended are the settle's cost.
    const dragDuringSettle = dragDuring ? summarize(framesUntil(dragDuring, t0 + settledMs)) : null;
    const dragAfter = await dragSweep(canvas, host, p);
    const hover = await hoverGrid(canvas, card, p);
    return {
      renderer: gpu.renderer,
      software: gpu.software,
      cadence,
      unmaskedRenderer: gpu.unmasked,
      reducedMotion,
      // The browser throttles frames and timers in a hidden page: such a run is not a measurement.
      hiddenDuringRun: hidden,
      startedAt: t0,
      marks: { mountMs, settledMs, ttiMs },
      settledBeforeDragEnded,
      dragDuring,
      dragDuringSettle,
      dragAfter,
      hover,
    };
  } finally {
    document.removeEventListener("visibilitychange", onVisibility);
    handle.destroy();
  }
}

/** The middle value (the lower one of an even count), ignoring missing values. */
export function median(values) {
  const nums = values.filter((v) => typeof v === "number").sort((a, b) => a - b);
  return nums.length === 0 ? null : nums[Math.floor((nums.length - 1) / 2)];
}

/** Gating values per the protocol over a cell's runs: median TTI, median of the runs' p95s. */
export function cellMedians(results) {
  const pick = (f) => median(results.map(f));
  return {
    mountMs: pick((r) => r.marks.mountMs),
    settledMs: pick((r) => r.marks.settledMs),
    ttiMs: pick((r) => r.marks.ttiMs),
    dragDuringP50: pick((r) => r.dragDuring?.p50),
    dragDuringP95: pick((r) => r.dragDuring?.p95),
    dragDuringSettleP50: pick((r) => r.dragDuringSettle?.p50),
    dragDuringSettleP95: pick((r) => r.dragDuringSettle?.p95),
    dragDuringSettleFrames: pick((r) => r.dragDuringSettle?.n),
    dragAfterP50: pick((r) => r.dragAfter.p50),
    dragAfterP95: pick((r) => r.dragAfter.p95),
    hoverP50: pick((r) => r.hover.p50),
    hoverP95: pick((r) => r.hover.p95),
    hoverHits: pick((r) => r.hover.n),
    hoverHandlerP95: pick((r) => r.hover.handler.p95),
    cadenceP50: pick((r) => r.cadence.p50),
  };
}
