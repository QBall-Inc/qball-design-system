// GraphCanvas specimen: mounts the BUILT @qball-inc/elements ./graph canvas
// on the scrubbed QuBrain mock bundle in preview/graph-canvas.html, so the
// gallery shows the real engine, not a screenshot. The filter buttons drive
// handle.setFilter; the event line echoes the canvas's host events. Reports
// through window globals for the deploy gate:
//   window.__canvasOk = true        — mounted and settled
//   window.__canvasErr = "<message>" — anything failed
import { GraphCanvas } from "../packages/elements/dist/graph/index.js";

const host = document.getElementById("canvas");
const log = document.getElementById("events");
const show = (text) => {
  log.textContent = text;
};

async function run() {
  const res = await fetch("../fixtures/qubrain/mock-bundle.json");
  if (!res.ok) throw new Error(`mock bundle: HTTP ${res.status}`);
  const graph = await GraphCanvas.mount(host, { data: await res.json() });
  document.documentElement.setAttribute("data-specimens", "ready");

  graph.on("select", (e) => {
    const { node, neighbors, total } = e.detail;
    show(`select · ${node.name} · ${neighbors.length} of ${total} neighbors`);
  });
  graph.on("clear", () => show("clear"));
  graph.on("filter", (e) => show(`filter · ${e.detail.matches} matches`));

  for (const button of document.querySelectorAll("[data-filter]")) {
    button.addEventListener("click", () => {
      const cls = button.getAttribute("data-filter");
      graph.setFilter(cls === "all" ? null : cls === "none" ? () => false : (n) => n.cls === cls);
      for (const b of document.querySelectorAll("[data-filter]")) {
        b.setAttribute("aria-pressed", b === button ? "true" : "false");
      }
    });
  }
  await graph.settled;
  window.__canvasOk = true;
}

run().catch((error) => {
  window.__canvasErr = String(error && error.message ? error.message : error);
  show(`error · ${window.__canvasErr}`);
});
