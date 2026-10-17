// Entry for the P3 phone page (scripts/build-perf-phone-page.mjs bundles it):
// runs the protocol sequence on the phone (docs/qubrain-graph-perf-protocol.md),
// one cold with-layout run, five warm with-layout runs and five no-layout runs,
// in one page, and shows the gating values against the P3 targets.
import { GraphCanvas } from "../dist/graph/index.js";
import { cellMedians, runCell, webglRenderer } from "./canvas-perf-sequence.mjs";

const RUNS = 5;
const PAUSE_MS = 1500;
const TARGETS = { ttiMs: 3000, dragP95: 33 };

// Counts messages from any Worker the canvas starts, so the report can say
// whether the no-layout settle really ran in the worker. A page whose host
// blocks blob workers falls back to the main thread silently.
let workerMessages = 0;
const NativeWorker = globalThis.Worker;
if (typeof NativeWorker === "function") {
  globalThis.Worker = class extends NativeWorker {
    constructor(...args) {
      super(...args);
      this.addEventListener("message", () => workerMessages++);
    }
  };
}

const $ = (id) => document.getElementById(id);
const bundle = (id) => JSON.parse($(id).textContent);
const pause = () => new Promise((done) => setTimeout(done, PAUSE_MS));
const ms = (v) => (typeof v === "number" ? `${Math.round(v)} ms` : "n/a");

function device() {
  return {
    userAgent: navigator.userAgent,
    viewport: `${innerWidth} × ${innerHeight} CSS px`,
    devicePixelRatio: devicePixelRatio,
    cores: navigator.hardwareConcurrency ?? null,
    renderer: webglRenderer().renderer,
  };
}

function row(label, value, target) {
  const tr = document.createElement("tr");
  const verdict =
    target === undefined || typeof value !== "number" ? "" : value <= target ? "pass" : "miss";
  for (const [text, cls] of [
    [label, ""],
    [ms(value), "num"],
    [target === undefined ? "reported" : `≤ ${target} ms`, "num"],
    [verdict === "" ? "" : verdict === "pass" ? "Pass" : "Miss", verdict],
  ]) {
    const td = document.createElement("td");
    td.textContent = text;
    if (cls) td.className = cls;
    tr.append(td);
  }
  return tr;
}

function render(report) {
  const { layout, live, cold } = report.medians;
  $("results").replaceChildren(
    row("Ready to hover and select, with layout", layout.ttiMs, TARGETS.ttiMs),
    row("Drag, slowest 5% of frames, with layout", layout.dragAfterP95, TARGETS.dragP95),
    row("Drag during the live layout, slowest 5%", live.dragDuringSettleP95, TARGETS.dragP95),
    row("Drag after the live layout, slowest 5%", live.dragAfterP95, TARGETS.dragP95),
    row("Hover response, slowest 5%, with layout", layout.hoverP95),
    row("Ready to hover and select, no layout", live.ttiMs),
    row("First visit (graph engine downloaded), with layout", cold.ttiMs),
  );
  $("report").value = JSON.stringify(report, null, 1);
  $("done").hidden = false;
}

async function start() {
  $("start").disabled = true;
  $("done").hidden = true;
  $("note").textContent = "";
  let lock = null;
  try {
    lock = await navigator.wakeLock?.request("screen");
  } catch {
    // The screen may dim during the run; the numbers are unaffected while the page stays visible.
  }
  const host = $("host");
  const plan = [
    { cell: "cold", id: "bundle-layout", live: false, runs: 1 },
    { cell: "layout", id: "bundle-layout", live: false, runs: RUNS },
    { cell: "live", id: "bundle-live", live: true, runs: RUNS },
  ];
  const total = plan.reduce((n, step) => n + step.runs, 0);
  const results = { cold: [], layout: [], live: [] };
  let done = 0;
  try {
    for (const step of plan) {
      for (let run = 0; run < step.runs; run++) {
        $("status").textContent =
          `Run ${done + 1} of ${total}. Keep the screen on and don't touch the graph.`;
        const data = bundle(step.id);
        const before = workerMessages;
        const result = await runCell({ GraphCanvas, host, data, live: step.live });
        result.workerMessages = workerMessages - before;
        if (result.hiddenDuringRun) {
          throw new Error("the page went into the background, which slows it down on purpose");
        }
        results[step.cell].push(result);
        done++;
        await pause();
      }
    }
    const reducedMotion = results.live.some((r) => r.reducedMotion);
    const settleInWorker = results.live.every((r) => r.workerMessages > 0);
    const notes = [];
    if (reducedMotion) {
      notes.push(
        "This phone has Reduce Motion turned on, so the no-layout rows used the reduced-motion path. Turn it off and run again for the standard numbers.",
      );
    }
    if (!settleInWorker) {
      notes.push(
        "The background worker did not run in this browser, so the no-layout rows measured the main-thread fallback.",
      );
    }
    $("note").textContent = notes.join(" ");
    const report = {
      reducedMotion,
      settleInWorker,
      protocol: "docs/qubrain-graph-perf-protocol.md (P3)",
      date: new Date().toISOString(),
      device: device(),
      host: `${host.clientWidth} × ${host.clientHeight} CSS px`,
      medians: {
        cold: cellMedians(results.cold),
        layout: cellMedians(results.layout),
        live: cellMedians(results.live),
      },
      runs: Object.fromEntries(
        Object.entries(results).map(([cell, list]) => [
          cell,
          list.map(
            ({ marks, dragDuringSettle, dragAfter, hover, cadence, workerMessages: wm }) => ({
              marks,
              workerMessages: wm,
              dragDuringSettle,
              dragAfter: {
                n: dragAfter.n,
                p50: dragAfter.p50,
                p95: dragAfter.p95,
                max: dragAfter.max,
              },
              hover: { n: hover.n, p50: hover.p50, p95: hover.p95, handlerP95: hover.handler.p95 },
              idleFrameP50: cadence.p50,
            }),
          ),
        ]),
      ),
    };
    $("status").textContent = `Finished ${total} runs.`;
    render(report);
  } catch (error) {
    $("status").textContent =
      `The run stopped: ${error instanceof Error ? error.message : String(error)}. Reload the page and start again.`;
  } finally {
    $("start").disabled = false;
    await lock?.release().catch(() => undefined);
  }
}

async function copy() {
  const text = $("report").value;
  try {
    await navigator.clipboard.writeText(text);
    $("copied").textContent = "Copied.";
  } catch {
    $("report").select();
    $("copied").textContent = "Selected. Copy it from the box.";
  }
}

$("start").addEventListener("click", () => void start());
$("copy").addEventListener("click", () => void copy());
$("device").textContent = device().renderer ?? "WebGL is not available on this browser.";
