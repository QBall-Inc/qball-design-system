// FacetFilterBar specimen: mounts the BUILT @qball-inc/elements ./graph facet
// bar into preview/facet-filter-bar.html — idle, two chips active, incomplete
// facet data (the chip mark + "N match · K unassignable"), and the bar on the
// dark stage inside an explorer frame. Synthetic content only.
import { FacetFilterBar } from "../packages/elements/dist/graph/index.js";

const taxonomy = {
  domains: {
    ai: ["agents", "mcp", "coding-tools", "models", "rag", "other"],
    pm: ["craft", "metrics", "growth", "other"],
  },
};
const domainLabels = { ai: "AI engineering", pm: "Product management" };

const node = (id, domains, sub_domains, paired) => ({
  id,
  name: `entity ${id}`,
  cls: "concept",
  eps: 1,
  aliases: [],
  facets: {
    domains,
    sub_domains,
    ...(paired && {
      pairs: domains.flatMap((domain) =>
        sub_domains
          .filter((sub) => taxonomy.domains[domain].includes(sub))
          .map((sub_domain) => ({ domain, sub_domain })),
      ),
    }),
  },
});

/** A small bundle's nodes; `paired` makes every count exact. */
function nodes(paired) {
  const list = [];
  let id = 0;
  const subs = { ai: taxonomy.domains.ai, pm: taxonomy.domains.pm };
  for (let i = 0; i < 60; i++) {
    const domain = i % 3 === 0 ? "pm" : "ai";
    list.push(node(++id, [domain], [subs[domain][i % subs[domain].length]], paired));
  }
  // Entities filed under both domains with the shared "other" tag: unplaceable
  // without pairs.
  for (let i = 0; i < 8; i++) list.push(node(++id, ["ai", "pm"], ["other"], paired));
  return list;
}

const complete = nodes(true);
const incomplete = nodes(false);

function mount(slot, data, press = []) {
  const bar = FacetFilterBar.mount(slot, { nodes: data, taxonomy, domainLabels });
  for (const label of press) {
    const [domain, sub] = label.split("/");
    const group = [...slot.querySelectorAll(".facetbar__group")][
      Object.keys(taxonomy.domains).indexOf(domain)
    ];
    [...group.querySelectorAll(".fchip")].find((b) => b.firstChild.textContent === sub).click();
  }
  return bar;
}

mount(document.querySelector('[data-specimen="idle"]'), complete);
mount(document.querySelector('[data-specimen="active"]'), complete, ["ai/agents", "ai/mcp"]);
mount(document.querySelector('[data-specimen="incomplete"]'), incomplete, ["ai/other"]);
mount(document.querySelector('[data-specimen="stage"]'), incomplete, ["ai/mcp"]);
document.documentElement.setAttribute("data-specimens", "ready");
