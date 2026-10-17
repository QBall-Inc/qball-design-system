// Builds the P3 phone page for the GraphCanvas performance protocol
// (docs/qubrain-graph-perf-protocol.md): one self-contained HTML file with the
// built graph entry and the perf sequence bundled inline, the real tokens CSS,
// both mock bundles inline, and three from jsDelivr (pinned to the installed
// version). Published privately for the owner to open on a phone.
//
// Usage (via `just qb-perf-phone-page`, which builds dist/ first):
//   node scripts/build-perf-phone-page.mjs [--out FILE]
// The file has no <html>/<head>/<body> tags: the publishing host wraps it.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const ROOT = resolve(import.meta.dirname, "..");
const TOKENS = resolve(ROOT, "..", "tokens");
const FIXTURES = resolve(ROOT, "..", "..", "fixtures", "qubrain");
const require = createRequire(import.meta.url);
// esbuild comes with tsup, the package's declared build tool.
const esbuild = createRequire(require.resolve("tsup"))("esbuild");
const THREE_VERSION = JSON.parse(
  readFileSync(join(dirname(require.resolve("three")), "..", "package.json"), "utf8"),
).version;
const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
const FONTS =
  "https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Syne:wght@400;500;700&display=swap";

const { values: args } = parseArgs({ options: { out: { type: "string" } } });
const out = resolve(args.out ?? join(ROOT, "perf-results", "graph-speed-check.html"));
if (!existsSync(join(ROOT, "dist", "graph", "index.js"))) {
  throw new Error("dist/graph is missing: build first (just qb-perf-phone-page builds it)");
}

const { outputFiles } = await esbuild.build({
  entryPoints: [join(ROOT, "perf", "phone-page.mjs")],
  bundle: true,
  format: "esm",
  external: ["three"],
  minify: true,
  write: false,
  target: "es2022",
});
// Inline <script> content must not close the element early.
const script = outputFiles[0].text.replaceAll("</script", "<\\/script");
const css = ["colors_and_type.css", "graph.css"]
  .map((f) => readFileSync(join(TOKENS, f), "utf8"))
  .join("\n");
const json = (file) => readFileSync(join(FIXTURES, file), "utf8").replaceAll("</", "<\\/");

const page = `<title>Graph Speed Check</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${FONTS}">
<style>
${css}
/* Layout: one column; the graph runs edge to edge at 70% of the screen height, as on a phone page. */
:root {
  --page-bg: var(--bg-primary);
  --page-fg: var(--text-primary);
  --page-soft: var(--text-secondary);
  --page-line: var(--border-strong);
  --page-accent: var(--color-signal);
  --page-miss: var(--color-error);
  --page-panel: var(--bg-surface);
}
body { background: var(--page-bg); color: var(--page-fg); font-family: var(--font-body); }
.gutter { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px; display: grid; gap: 14px; max-width: 46rem; }
h1 { font-family: var(--font-heading); font-size: 1.35rem; font-weight: 600; margin: 0; text-wrap: balance; }
p { margin: 0; line-height: 1.55; color: var(--page-soft); max-width: 65ch; }
.device { font-family: var(--font-ui); font-size: 0.75rem; color: var(--page-soft); overflow-wrap: anywhere; }
button { font-family: var(--font-ui); font-size: 0.875rem; padding: 0.7rem 1.1rem; border: 1px solid var(--page-accent); background: var(--page-accent); color: var(--page-bg); border-radius: 6px; cursor: pointer; justify-self: start; }
button.quiet { background: transparent; color: var(--page-accent); }
button:disabled { opacity: 0.55; cursor: progress; }
button:focus-visible { outline: 2px solid var(--page-fg); outline-offset: 2px; }
#status { font-family: var(--font-ui); font-size: 0.8125rem; color: var(--page-fg); min-height: 1.4em; }
#host { width: 100%; height: 70vh; position: relative; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.875rem; }
td { padding: 0.5rem 0.4rem; border-bottom: 1px solid var(--page-line); vertical-align: top; }
td.num { font-family: var(--font-ui); font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right; }
td.pass { color: var(--page-accent); font-weight: 700; }
td.miss { color: var(--page-miss); font-weight: 700; }
textarea { width: 100%; box-sizing: border-box; min-height: 9rem; font-family: var(--font-code); font-size: 0.6875rem; background: var(--page-panel); color: var(--page-fg); border: 1px solid var(--page-line); border-radius: 6px; padding: 0.5rem; }
.row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
#copied { font-size: 0.8125rem; color: var(--page-soft); }
</style>
<script type="importmap">{ "imports": { "three": "${THREE_URL}" } }</script>

<div class="gutter">
  <h1>Graph speed check</h1>
  <p>This page times the knowledge graph on this phone. Tap Start, keep the screen on and leave the graph alone: the page drags and hovers it by itself. It takes about six minutes. When it finishes, copy the results and send them back.</p>
  <div class="device" id="device"></div>
  <button id="start" type="button">Start</button>
  <div id="status" role="status" aria-live="polite"></div>
</div>
<div id="host"></div>
<div class="gutter" id="done" hidden>
  <p id="note" role="status"></p>
  <div class="table-wrap"><table><tbody id="results"></tbody></table></div>
  <p>Each figure is the middle of five runs. The first-visit run includes downloading the graph engine.</p>
  <label for="report"><p>Full results</p></label>
  <textarea id="report" readonly></textarea>
  <div class="row"><button id="copy" class="quiet" type="button">Copy results</button><span id="copied" role="status"></span></div>
</div>
<script type="application/json" id="bundle-layout">${json("mock-bundle.with-layout.json")}</script>
<script type="application/json" id="bundle-live">${json("mock-bundle.json")}</script>
<script type="module">${script}</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`three ${THREE_VERSION} from ${THREE_URL}`);
console.log(`wrote ${out} (${(page.length / 1e6).toFixed(2)} MB)`);
