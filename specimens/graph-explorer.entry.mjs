// GraphExplorer specimen: mounts the BUILT @qball-inc/elements ./graph
// explorer on the scrubbed QuBrain mock bundle in preview/graph-explorer.html.
// Hop detail comes from the input-model fixtures through the callback (typed
// pairs get the asserted-claims fixture, the rest the co-mention one); the
// event line echoes the explorer's host events. Reports through window
// globals for the deploy gate:
//   window.__explorerOk = true        — mounted and the canvas settled
//   window.__explorerErr = "<message>" — anything failed
//   window.__explorer                 — the handle (deep-link checks)
import { GraphExplorer } from "../packages/elements/dist/graph/index.js";
import comention from "../fixtures/qubrain/detail/comention-connection.json";
import typed from "../fixtures/qubrain/detail/typed-connection.json";
import taxonomy from "../fixtures/qubrain/taxonomy.json";

const host = document.getElementById("explorer");
const log = document.getElementById("events");
const show = (text) => {
  log.textContent = text;
};

async function run() {
  const res = await fetch("../fixtures/qubrain/mock-bundle.json");
  if (!res.ok) throw new Error(`mock bundle: HTTP ${res.status}`);
  const bundle = await res.json();
  const typedPairs = new Set(bundle.typed_edges.flatMap((e) => [`${e.a}:${e.b}`, `${e.b}:${e.a}`]));
  const explorer = await GraphExplorer.mount(host, {
    bundle,
    taxonomy,
    domainLabels: { "ai-engineering": "AI engineering", "pm-craft": "Product management" },
    detail: ({ from, to }) =>
      Promise.resolve(typedPairs.has(`${from.id}:${to.id}`) ? typed : comention),
    panelLabels: { idleTitle: "knowledge graph" },
  });
  window.__explorer = explorer;
  document.documentElement.setAttribute("data-specimens", "ready");

  explorer.on("pathchange", (e) => {
    const names = e.detail.path.map((n) => n.name);
    show(names.length === 0 ? "pathchange · cleared" : `pathchange · ${names.join(" › ")}`);
  });
  explorer.on("panel", (e) => show(`panel · ${e.detail.open ? "open" : "closed"}`));
  explorer.on("error", (e) => show(`error · ${e.detail.code}`));
  if (explorer.canvas === null) throw new Error(`canvas: ${explorer.canvasError}`);
  await explorer.canvas.settled;
  window.__explorerOk = true;
}

run().catch((error) => {
  window.__explorerErr = String(error && error.message ? error.message : error);
  show(`error · ${window.__explorerErr}`);
});
