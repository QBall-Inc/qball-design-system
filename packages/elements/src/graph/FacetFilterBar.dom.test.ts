import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { HOSTILE_MARKUP, pwned, resetPwned, settle } from "../trust/test-fixtures";
import type { BundleNode } from "../types";
import { mount, type FacetFilterChange } from "./FacetFilterBar";
import { buildFacetModel, type FacetTaxonomy } from "./facets";
import { loadMockBundle } from "./test-helpers";

const taxonomy = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../fixtures/qubrain/taxonomy.json"), "utf8"),
) as FacetTaxonomy;
const bundle = loadMockBundle();

function node(id: number, facets?: BundleNode["facets"]): BundleNode {
  return { id, name: `n${id}`, cls: "concept", eps: 1, aliases: [], ...(facets && { facets }) };
}

// Paired facets: every count is exact (facetsComplete true).
const pairedTaxonomy: FacetTaxonomy = { domains: { a: ["x", "other"], b: ["y", "other"] } };
const pairedNodes = [
  node(1, { domains: ["a"], sub_domains: ["x"], pairs: [{ domain: "a", sub_domain: "x" }] }),
  node(2, {
    domains: ["a", "b"],
    sub_domains: ["other"],
    pairs: [
      { domain: "a", sub_domain: "other" },
      { domain: "b", sub_domain: "other" },
    ],
  }),
  node(3, { domains: ["b"], sub_domains: ["y"], pairs: [{ domain: "b", sub_domain: "y" }] }),
];

let host: HTMLElement;
beforeEach(() => {
  document.body.replaceChildren();
  host = document.createElement("div");
  document.body.append(host);
  resetPwned();
});

const chipsOf = () => [...host.querySelectorAll<HTMLButtonElement>(".fchip")];
const chip = (domain: string, sub: string) => {
  const groups = [...host.querySelectorAll(".facetbar__group")];
  const index = Object.keys(taxonomy.domains).indexOf(domain);
  const found = [...groups[index]!.querySelectorAll<HTMLButtonElement>(".fchip")].find(
    (b) => b.firstChild?.textContent === sub,
  );
  if (!found) throw new Error(`no chip ${domain}/${sub}`);
  return found;
};
const count = () => host.querySelector<HTMLElement>(".facetbar__count")!;
const clearButton = () => host.querySelector<HTMLButtonElement>(".facetbar__clear")!;

describe("FacetFilterBar — chips from the taxonomy", () => {
  it("renders one domain group per taxonomy domain and one chip per sub-domain, in order", () => {
    mount(host, {
      nodes: bundle.nodes,
      taxonomy,
      domainLabels: { "ai-engineering": "AI engineering" },
    });
    const bar = host.querySelector(".facetbar")!;
    expect(bar.getAttribute("role")).toBe("group");
    expect(bar.getAttribute("aria-label")).toBe("filter by facet");
    const groups = [...host.querySelectorAll(".facetbar__group")];
    expect(groups.map((g) => g.querySelector(".facetbar__dom")?.textContent)).toEqual(
      // A domain without a label shows its id: the DS hardcodes no domain names.
      Object.keys(taxonomy.domains).map((d) => (d === "ai-engineering" ? "AI engineering" : d)),
    );
    const expected = Object.values(taxonomy.domains).flat();
    expect(chipsOf().map((b) => b.firstChild?.textContent)).toEqual(expected);
    for (const b of chipsOf()) {
      expect(b.type).toBe("button");
      expect(b.getAttribute("aria-pressed")).toBe("false");
    }
  });

  it("renders no find or search field", () => {
    mount(host, { nodes: bundle.nodes, taxonomy });
    expect(host.querySelector("input, [role=search], [role=searchbox], [type=search]")).toBeNull();
  });

  it("shows neither count nor clear while no chip is active", () => {
    mount(host, { nodes: bundle.nodes, taxonomy });
    expect(count().hidden).toBe(true);
    expect(clearButton().hidden).toBe(true);
  });
});

describe("FacetFilterBar — toggling, OR semantics, clear", () => {
  it("toggles aria-pressed, ORs the active chips and reports the canvas predicate", () => {
    const changes: FacetFilterChange[] = [];
    const bar = mount(host, {
      nodes: pairedNodes,
      taxonomy: pairedTaxonomy,
      onChange: (c) => changes.push(c),
    });
    const x = chipsOf()[0]!; // a/x → node 1
    const y = chipsOf()[2]!; // b/y → node 3
    x.click();
    expect(x.getAttribute("aria-pressed")).toBe("true");
    expect(changes.at(-1)!.matches).toBe(1);
    expect(count().textContent).toBe("1 entity matches");
    y.click();
    const last = changes.at(-1)!;
    expect(last.active).toEqual([
      { domain: "a", sub_domain: "x" },
      { domain: "b", sub_domain: "y" },
    ]);
    expect(last.matches).toBe(2);
    expect(pairedNodes.filter(last.predicate!).map((n) => n.id)).toEqual([1, 3]);
    expect(count().textContent).toBe("2 entities match");
    expect(bar.activeCount).toBe(2);
    x.click();
    expect(x.getAttribute("aria-pressed")).toBe("false");
    expect(changes.at(-1)!.matches).toBe(1);
  });

  it("matches the facet model's count on the real fixture", () => {
    const changes: FacetFilterChange[] = [];
    mount(host, { nodes: bundle.nodes, taxonomy, onChange: (c) => changes.push(c) });
    const first = Object.entries(taxonomy.domains)[0]!;
    const picks = [chip(first[0], first[1][0]!), chip(first[0], first[1][1]!)];
    for (const b of picks) b.click();
    const model = buildFacetModel(bundle.nodes, taxonomy);
    const expected = model.activeFacets([
      { domain: first[0], sub_domain: first[1][0]! },
      { domain: first[0], sub_domain: first[1][1]! },
    ]);
    expect(changes.at(-1)!.matches).toBe(expected.size);
    expect(bundle.nodes.filter(changes.at(-1)!.predicate!).length).toBe(expected.size);
  });

  it("× clear appears only while a chip is active, resets every chip and clears the filter", () => {
    const changes: FacetFilterChange[] = [];
    const bar = mount(host, {
      nodes: pairedNodes,
      taxonomy: pairedTaxonomy,
      onChange: (c) => changes.push(c),
    });
    chipsOf()[0]!.click();
    chipsOf()[1]!.click();
    expect(clearButton().hidden).toBe(false);
    expect(clearButton().textContent).toBe("× clear");
    clearButton().click();
    expect(chipsOf().every((b) => b.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(changes.at(-1)).toEqual({ active: [], matches: 0, predicate: null });
    expect(clearButton().hidden).toBe(true);
    expect(count().hidden).toBe(true);
    expect(bar.activeCount).toBe(0);
    // handle.clear() with nothing active does not report a change.
    const before = changes.length;
    bar.clear();
    expect(changes.length).toBe(before);
  });
});

describe("FacetFilterBar — incomplete facet data (chips usable, gap disclosed)", () => {
  it("marks every chip with unassignable entities and reads the count as N match · K unassignable", () => {
    const model = buildFacetModel(bundle.nodes, taxonomy);
    expect(model.facetsComplete).toBe(false); // precondition: today's fixture is incomplete
    mount(host, { nodes: bundle.nodes, taxonomy });
    const incomplete = model.chips.filter((c) => c.unattributable > 0);
    expect(incomplete.length).toBeGreaterThan(0);
    for (const c of model.chips) {
      const b = chip(c.chip.domain, c.chip.sub_domain);
      const mark = b.querySelector(".fchip__inc");
      if (c.unattributable > 0) {
        expect(b.classList.contains("is-incomplete")).toBe(true);
        expect(mark?.textContent).toBe("≈");
        expect(mark?.getAttribute("aria-hidden")).toBe("true");
        expect(b.getAttribute("aria-label")).toBe(
          `${c.chip.sub_domain}, incomplete: ${String(c.unattributable)} unassignable`,
        );
      } else {
        expect(mark).toBeNull();
        expect(b.hasAttribute("aria-label")).toBe(false);
      }
    }
    const target = incomplete[0]!;
    chip(target.chip.domain, target.chip.sub_domain).click();
    const k = model.unattributableFor([target.chip]).size;
    expect(count().textContent).toBe(`${String(target.matches)} match · ${String(k)} unassignable`);
  });

  it("an active chip set with no unassignable entities reads the plain count even on incomplete data", () => {
    const model = buildFacetModel(bundle.nodes, taxonomy);
    const exact = model.chips.find((c) => c.unattributable === 0 && c.matches > 0)!;
    mount(host, { nodes: bundle.nodes, taxonomy });
    chip(exact.chip.domain, exact.chip.sub_domain).click();
    expect(count().textContent).toMatch(/^\d+ entit(y matches|ies match)$/);
  });

  it("never counts an entity as unassignable when another active chip already matches it", () => {
    const shared: FacetTaxonomy = { domains: { a: ["shared", "x"], b: ["shared", "y"] } };
    const nodes = [
      node(1, { domains: ["a", "b"], sub_domains: ["shared"] }), // unassignable for a/shared
      node(2, { domains: ["a"], sub_domains: ["shared"] }), // matches a/shared
      node(3, { domains: ["a", "b"], sub_domains: ["shared", "x"] }), // matches a/x; unassignable for a/shared
    ];
    const changes: FacetFilterChange[] = [];
    mount(host, { nodes, taxonomy: shared, onChange: (c) => changes.push(c) });
    chipsOf()[0]!.click(); // a/shared
    expect(count().textContent).toBe("1 match · 2 unassignable");
    chipsOf()[1]!.click(); // a/x also matches node 3
    expect(changes.at(-1)!.matches).toBe(2);
    expect(count().textContent).toBe("2 match · 1 unassignable");
  });

  it("renders nothing extra when the facet data is complete", () => {
    mount(host, { nodes: pairedNodes, taxonomy: pairedTaxonomy });
    expect(host.querySelector(".fchip__inc, .is-incomplete, .fchip[aria-label]")).toBeNull();
    chipsOf()[1]!.click();
    expect(count().textContent).toBe("1 entity matches");
  });

  it("takes the consumer's wording for every string", () => {
    mount(host, {
      nodes: bundle.nodes,
      taxonomy,
      labels: {
        group: "topics",
        matches: (n) => `${String(n)} hits`,
        matchesIncomplete: (n, k) => `${String(n)} hits, ${String(k)} unsure`,
        incompleteMark: "?",
        incompleteChip: (s) => `${s} (partial)`,
        clear: "reset",
      },
    });
    expect(host.querySelector(".facetbar")!.getAttribute("aria-label")).toBe("topics");
    expect(clearButton().textContent).toBe("reset");
    const marked = host.querySelector<HTMLButtonElement>(".fchip.is-incomplete")!;
    expect(marked.querySelector(".fchip__inc")!.textContent).toBe("?");
    expect(marked.getAttribute("aria-label")).toMatch(/ \(partial\)$/);
    marked.click();
    expect(count().textContent).toMatch(/^\d+ hits, \d+ unsure$/);
  });
});

describe("FacetFilterBar — data swap, destroy, fail fast, inert text", () => {
  it("setData rebuilds the chips with none active and no change reported", () => {
    const changes: FacetFilterChange[] = [];
    const bar = mount(host, { nodes: bundle.nodes, taxonomy, onChange: (c) => changes.push(c) });
    chipsOf()[0]!.click();
    const reported = changes.length;
    bar.setData(pairedNodes, pairedTaxonomy);
    expect(chipsOf().map((b) => b.firstChild?.textContent)).toEqual(["x", "other", "y", "other"]);
    expect(bar.activeCount).toBe(0);
    expect(count().hidden).toBe(true);
    expect(changes.length).toBe(reported);
  });

  it("setData takes new domain labels, keeps the old ones when given none, and fails fast on bad ones", () => {
    const doms = () => [...host.querySelectorAll(".facetbar__dom")].map((n) => n.textContent);
    const bar = mount(host, {
      nodes: pairedNodes,
      taxonomy: pairedTaxonomy,
      domainLabels: { a: "first" },
    });
    expect(doms()[0]).toBe("first");
    bar.setData(pairedNodes, pairedTaxonomy, { a: "renamed" });
    expect(doms()[0]).toBe("renamed");
    bar.setData(pairedNodes);
    expect(doms()[0]).toBe("renamed");
    expect(() => bar.setData(pairedNodes, undefined, { x: 1 } as never)).toThrow(
      "domainLabels.x must be a string.",
    );
    expect(doms()[0]).toBe("renamed");
  });

  it("destroy removes the bar and stops reporting", () => {
    const changes: FacetFilterChange[] = [];
    const bar = mount(host, {
      nodes: pairedNodes,
      taxonomy: pairedTaxonomy,
      onChange: (c) => changes.push(c),
    });
    const first = chipsOf()[0]!;
    bar.destroy();
    expect(host.querySelector(".facetbar")).toBeNull();
    first.click();
    expect(changes).toEqual([]);
  });

  it("fails fast on bad options", () => {
    expect(() => mount(host, { nodes: "x" as never, taxonomy })).toThrow("nodes must be an array");
    expect(() => mount(host, { nodes: [], taxonomy, onChange: 1 as never })).toThrow(
      "onChange must be a function.",
    );
    expect(() => mount(host, { nodes: [], taxonomy, domainLabels: { a: 1 } as never })).toThrow(
      "domainLabels.a must be a string.",
    );
    expect(() => mount(host, { nodes: [], taxonomy, labels: { nope: "x" } as never })).toThrow(
      "labels.nope is not a known label.",
    );
    expect(() => mount(host, { nodes: [], taxonomy, labels: { matches: "x" } as never })).toThrow(
      "labels.matches must be a function.",
    );
    expect(() => mount(host, { nodes: [], taxonomy: {} as FacetTaxonomy })).toThrow(
      "FacetTaxonomy.domains must be an object",
    );
  });

  it("a domain id that names a built-in object member still shows as its id", () => {
    const odd: FacetTaxonomy = { domains: { constructor: ["x"], toString: ["y"] } };
    mount(host, { nodes: [node(1)], taxonomy: odd, domainLabels: {} });
    expect([...host.querySelectorAll(".facetbar__dom")].map((d) => d.textContent)).toEqual([
      "constructor",
      "toString",
    ]);
  });

  it("taxonomy and domain labels stay inert text", async () => {
    const hostile: FacetTaxonomy = { domains: { [HOSTILE_MARKUP]: [HOSTILE_MARKUP] } };
    mount(host, {
      nodes: [node(1)],
      taxonomy: hostile,
      domainLabels: { [HOSTILE_MARKUP]: HOSTILE_MARKUP },
    });
    expect(host.querySelector(".facetbar__dom")!.textContent).toBe(HOSTILE_MARKUP);
    expect(host.querySelector(".fchip")!.textContent).toBe(HOSTILE_MARKUP);
    expect(host.querySelector("img")).toBeNull();
    await settle();
    expect(pwned()).toBe(false);
  });
});
