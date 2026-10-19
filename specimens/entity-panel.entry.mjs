// EntityPanel specimen: mounts the BUILT @qball-inc/elements ./graph panel
// into preview/entity-panel.html in every state: idle, loading, error, a typed
// hop with a superseded claim, a co-mention hop, connections with "show more",
// the reading list, and the panel on the dark stage. Detail comes from the
// input-model fixtures through the callback, as a consumer would supply it.
// Synthetic content only.
import { EntityPanel } from "../packages/elements/dist/graph/index.js";
import comention from "../fixtures/qubrain/detail/comention-connection.json";
import superseded from "../fixtures/qubrain/detail/typed-superseded-with-replacement.json";

const stats = {
  entities: 3294,
  claims_total: 0,
  claims_valid: 0,
  claims_superseded: 0,
  episodes: 412,
  earliest_claim_date: "2025-01-01",
  latest_claim_date: "2026-07-01",
  snapshot_date: "2026-07-17",
};

const node = (id, name, cls, eps, aliases = [], facets) => ({
  id,
  name,
  cls,
  eps,
  aliases,
  ...(facets && { facets }),
});
const memory = node(1, "agent memory", "concept", 41, ["long-term memory"], {
  domains: ["ai-engineering"],
  sub_domains: ["agents", "rag"],
});
const store = node(2, "vector store", "tool", 12, [], {
  domains: ["ai-engineering"],
  sub_domains: ["rag"],
});
const context = node(3, "context engineering", "technique", 9);
const neighbors = [
  { node: store, typed: true, weight: 12 },
  { node: context, typed: true, weight: 4 },
  { node: node(4, "retrieval eval", "concept", 3), typed: false, weight: 3 },
];

const never = () => new Promise(() => undefined);
const fail = () => Promise.reject(new Error("offline"));
const answer = (detail) => () => Promise.resolve(detail);

const SPECIMENS = {
  idle: () =>
    EntityPanel.mount(slot("idle"), {
      stats,
      detail: never,
      labels: { idleTitle: "knowledge graph" },
    }),
  loading: () =>
    EntityPanel.mount(slot("loading"), { stats, detail: never }).show({ path: [memory, store] }),
  error: () =>
    EntityPanel.mount(slot("error"), { stats, detail: fail }).show({ path: [memory, store] }),
  typed: () =>
    EntityPanel.mount(slot("typed"), { stats, detail: answer(superseded) }).show({
      path: [memory, store],
      neighbors,
      total: 27,
    }),
  comention: () =>
    EntityPanel.mount(slot("comention"), { stats, detail: answer(comention) }).show({
      path: [memory, context],
    }),
  connections: () => {
    const panel = EntityPanel.mount(slot("connections"), {
      stats,
      detail: never,
      onShowMore: () =>
        panel.setNeighbors(
          [
            ...neighbors,
            ...neighbors.map((n, i) => ({
              ...n,
              node: { ...n.node, id: 10 + i, name: `${n.node.name} (more)` },
            })),
          ],
          27,
        ),
    });
    panel.show({ path: [memory], neighbors, total: 27 });
  },
  stage: () =>
    EntityPanel.mount(slot("stage"), { stats, detail: answer(superseded) }).show({
      path: [memory, store],
      neighbors,
      total: 27,
    }),
};

function slot(name) {
  return document.querySelector(`[data-specimen="${name}"]`);
}

for (const element of document.querySelectorAll("[data-specimen]")) {
  const make = SPECIMENS[element.getAttribute("data-specimen")];
  if (make === undefined)
    throw new Error(`unknown specimen "${element.getAttribute("data-specimen")}"`);
  make();
}
document.documentElement.setAttribute("data-specimens", "ready");
