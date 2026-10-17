// Desktop driver for the GraphCanvas performance protocol
// (docs/qubrain-graph-perf-protocol.md): runs perf/canvas-perf-sequence.mjs in
// native Windows Chrome on the real GPU, driven over the DevTools Protocol from
// WSL, for profiles P1 (no throttle) and P2 (4x CPU slowdown) and both bundles.
// Refuses any run whose WebGL renderer is a software rasteriser. Writes the raw
// numbers and per-cell medians as JSON.
//
// Usage (via `just qb-perf-measure`, which builds dist/ first):
//   node scripts/measure-canvas-perf.mjs [--runs N] [--port N] [--out FILE] [--quick]
// --quick: 1 run per cell with a short drag and a small hover grid (driver check only;
// its numbers are not results).
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, normalize, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";
import { cellMedians } from "../perf/canvas-perf-sequence.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const PERF = join(ROOT, "perf");
const TOKENS = resolve(ROOT, "..", "tokens");
const FIXTURES = resolve(ROOT, "..", "..", "fixtures", "qubrain");
const THREE_BUILD_DIR = dirname(createRequire(import.meta.url).resolve("three"));
const CHROME = "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe";
const ORIGIN = "http://perf.test";
const HOST = { width: 1000, height: 640 };
const VIEWPORT = { width: 1280, height: 800 };

const BUNDLES = { layout: "mock-bundle.with-layout.json", live: "mock-bundle.json" };
const CELLS = [
  { profile: "P1", throttle: 1, bundle: "layout" },
  { profile: "P1", throttle: 1, bundle: "live" },
  { profile: "P2", throttle: 4, bundle: "layout" },
  { profile: "P2", throttle: 4, bundle: "live" },
  { profile: "P2", throttle: 4, bundle: "live", reducedMotion: true },
];
const QUICK = { dragFrames: 30, hoverCols: 4, hoverRows: 3, cadenceFrames: 20 };

const { values: args } = parseArgs({
  options: {
    runs: { type: "string", default: "5" },
    port: { type: "string", default: "9333" },
    out: { type: "string" },
    quick: { type: "boolean", default: false },
  },
});
const runs = args.quick ? 1 : Number(args.runs);
const port = Number(args.port);
if (!Number.isInteger(runs) || runs < 1)
  throw new Error(`--runs must be a positive integer, got ${args.runs}`);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error(`--port must be an integer from 1024 to 65535, got ${args.port}`);
if (!existsSync(CHROME)) throw new Error(`Windows Chrome not found at ${CHROME}`);
if (!existsSync(join(DIST, "graph", "index.js")))
  throw new Error("dist/graph is missing: build first (just qb-perf-measure builds it)");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = resolve(args.out ?? join(ROOT, "perf-results", `qb-perf-${stamp}.json`));

const PAGE = `<!doctype html>
<html lang="en" data-theme="light">
  <head>
    <meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="/tokens/colors_and_type.css">
    <link rel="stylesheet" href="/tokens/graph.css">
    <style>html,body{margin:0}#host{width:${HOST.width}px;height:${HOST.height}px;position:relative}</style>
    <script type="importmap">{ "imports": { "three": "/three/three.module.js" } }</script>
  </head>
  <body>
    <div id="host"></div>
    <script type="module">
      import { GraphCanvas } from "/dist/graph/index.js";
      import { runCell } from "/perf/canvas-perf-sequence.mjs";
      window.__perf = async (name, live, options) => {
        const data = await fetch("/fixtures/" + name).then((r) => r.json());
        return runCell({ GraphCanvas, host: document.getElementById("host"), data, live, options });
      };
      window.__ready = true;
    </script>
  </body>
</html>`;

const TYPES = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
};
const typeOf = (file) => TYPES[file.slice(file.lastIndexOf("."))] ?? "text/plain";
const ROOTS = [
  ["/dist/", DIST],
  ["/perf/", PERF],
  ["/tokens/", TOKENS],
  ["/fixtures/", FIXTURES],
];

/** Serves the page, the built package, tokens, fixtures and three from local files. */
async function serve(route) {
  const { pathname } = new URL(route.request().url());
  if (pathname === "/") return route.fulfill({ contentType: "text/html", body: PAGE });
  if (pathname.startsWith("/three/")) {
    const file = join(THREE_BUILD_DIR, basename(pathname));
    if (existsSync(file))
      return route.fulfill({ contentType: "text/javascript", body: readFileSync(file) });
  }
  for (const [prefix, root] of ROOTS) {
    if (!pathname.startsWith(prefix)) continue;
    const file = normalize(join(root, pathname.slice(prefix.length)));
    if (file.startsWith(root + sep) && existsSync(file)) {
      return route.fulfill({ contentType: typeOf(file), body: readFileSync(file) });
    }
  }
  return route.fulfill({ status: 404, body: "not found" });
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const devtoolsAnswers = async () => {
  try {
    return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok;
  } catch {
    return false;
  }
};

const removeProfile = (profile) => {
  const dir = execFileSync("wslpath", ["-u", profile]).toString().trim();
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
};

/** Starts headless Windows Chrome listening on 127.0.0.1 only, with a throwaway profile. */
async function launchChrome() {
  // A browser already on the port would answer for ours: the run would measure the wrong browser.
  if (await devtoolsAnswers()) {
    throw new Error(`something already answers on DevTools port ${port}; close it or pass --port`);
  }
  const winTemp = execFileSync("cmd.exe", ["/c", "echo %TEMP%"], { cwd: "/mnt/c" })
    .toString()
    .trim();
  const profile = `${winTemp}\\qb-perf-${stamp}`;
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const exited = new Promise((done) => child.once("exit", done));
  for (let i = 0; i < 100; i++) {
    if (await devtoolsAnswers()) return { child, exited, profile };
    await sleep(200);
  }
  child.kill();
  await Promise.race([exited, sleep(5_000)]);
  removeProfile(profile);
  throw new Error(`Windows Chrome did not open the DevTools port ${port} within 20 s`);
}

async function measure(browser, cell, run) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  try {
    await context.route(`${ORIGIN}/**`, serve);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    if (cell.reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cell.throttle });
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => globalThis.__ready === true);
    const result = await page.evaluate(
      ([name, live, options]) => globalThis.__perf(name, live, options),
      [BUNDLES[cell.bundle], cell.bundle === "live", args.quick ? QUICK : {}],
    );
    if (errors.length > 0)
      throw new Error(
        `page errors in ${cell.profile}/${cell.bundle} run ${run}: ${errors.join("; ")}`,
      );
    const where = `${cell.profile}/${cell.bundle} run ${run}`;
    if (result.software || !result.renderer || !result.unmaskedRenderer) {
      throw new Error(
        `refused ${where}: software, hidden or missing WebGL renderer (${result.renderer}); not a performance number`,
      );
    }
    if (result.reducedMotion !== Boolean(cell.reducedMotion)) {
      throw new Error(
        `refused ${where}: reduced motion is ${result.reducedMotion}, the cell expects ${Boolean(cell.reducedMotion)}`,
      );
    }
    if (result.hiddenDuringRun)
      throw new Error(`refused ${where}: the page was hidden during the run`);
    if (!result.dragAfter.movedView || (result.dragDuring && !result.dragDuring.movedView)) {
      throw new Error(
        `refused ${where}: a drag sweep did not move the view, so it timed idle frames`,
      );
    }
    return result;
  } finally {
    await context.close();
  }
}

const fmt = (v) => (typeof v === "number" ? v.toFixed(1) : "-");

async function main() {
  const chrome = await launchChrome();
  let browser = null;
  // Ctrl-C mid-batch: stop Chrome and drop its profile before exiting.
  const onSignal = () => {
    chrome.child.kill();
    void Promise.race([chrome.exited, sleep(5_000)]).then(() => {
      removeProfile(chrome.profile);
      process.exit(130);
    });
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const report = {
      protocol: "docs/qubrain-graph-perf-protocol.md",
      quick: args.quick,
      date: new Date().toISOString(),
      browser: `Chrome ${browser.version()} (Windows, headless=new, over CDP)`,
      renderer: null,
      host: HOST,
      runsPerCell: runs,
      cells: [],
    };
    for (const cell of CELLS) {
      const results = [];
      for (let run = 1; run <= runs; run++) {
        const result = await measure(browser, cell, run);
        report.renderer ??= result.renderer;
        if (result.renderer !== report.renderer)
          throw new Error(`renderer changed mid-batch: ${result.renderer}`);
        results.push(result);
        console.log(
          `${cell.profile} ${cell.bundle}${cell.reducedMotion ? " reduced-motion" : ""} run ${run}/${runs}: ` +
            `tti ${fmt(result.marks.ttiMs)} ms, drag p50/p95 ${fmt(result.dragAfter.p50)}/${fmt(result.dragAfter.p95)} ms, ` +
            `hover p95 ${fmt(result.hover.p95)} ms (${result.hover.n} hits), idle frame p50 ${fmt(result.cadence.p50)} ms`,
        );
      }
      report.cells.push({
        ...cell,
        fixture: BUNDLES[cell.bundle],
        medians: cellMedians(results),
        runs: results,
      });
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
    console.log(`renderer: ${report.renderer}`);
    console.log(`browser: ${report.browser}`);
    for (const c of report.cells)
      console.log(
        `${c.profile} ${c.bundle}${c.reducedMotion ? " reduced-motion" : ""} medians: ${JSON.stringify(c.medians)}`,
      );
    console.log(`wrote ${out}`);
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    const closed = browser
      ? await browser
          .newBrowserCDPSession()
          .then((session) => session.send("Browser.close"))
          .then(
            () => true,
            () => false,
          )
      : false;
    if (!closed) chrome.child.kill();
    await Promise.race([chrome.exited, sleep(10_000)]);
    removeProfile(chrome.profile);
  }
}

await main();
