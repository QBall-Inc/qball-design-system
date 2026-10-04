import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { BundleNode } from "../types";
import { buildFacetModel, type ChipCount, type FacetTaxonomy } from "./facets";
import { loadMockBundle } from "./test-helpers";

const TAXONOMY_PATH = resolve(process.cwd(), "../../fixtures/qubrain/taxonomy.json");
const taxonomy = JSON.parse(readFileSync(TAXONOMY_PATH, "utf8")) as FacetTaxonomy;
const bundle = loadMockBundle();

function count(chips: readonly ChipCount[], domain: string, sub: string): ChipCount {
  const found = chips.find((c) => c.chip.domain === domain && c.chip.sub_domain === sub);
  if (!found) throw new Error(`no chip (${domain}, ${sub})`);
  return found;
}

function node(id: number, facets?: BundleNode["facets"]): BundleNode {
  return { id, name: `n${id}`, cls: "concept", eps: 1, aliases: [], ...(facets && { facets }) };
}

describe("buildFacetModel (fixture of record, flat arrays)", () => {
  const model = buildFacetModel(bundle.nodes, taxonomy);
  // Computed from the fixture, never hardcoded: cross-domain nodes carrying the shared tag.
  const ambiguousOther = bundle.nodes.filter(
    (n) =>
      n.facets?.sub_domains.includes("other") &&
      n.facets.domains.includes("ai-engineering") &&
      n.facets.domains.includes("pm-craft"),
  );

  it("lists one chip per taxonomy entry, in taxonomy order", () => {
    const expected = Object.entries(taxonomy.domains).flatMap(([domain, subs]) =>
      subs.map((sub_domain) => ({ domain, sub_domain })),
    );
    expect(expected.length).toBe(19);
    expect(model.chips.map((c) => c.chip)).toEqual(expected);
  });

  it("reports cross-domain 'other' nodes as unattributable for both domains, matching neither", () => {
    expect(ambiguousOther.length).toBeGreaterThan(0);
    const ambiguousIds = ambiguousOther.map((n) => n.id);
    for (const domain of ["ai-engineering", "pm-craft"]) {
      expect(count(model.chips, domain, "other").unattributable).toBe(ambiguousOther.length);
      const matched = model.activeFacets([{ domain, sub_domain: "other" }]);
      expect(ambiguousIds.some((id) => matched.has(id))).toBe(false);
    }
    expect(model.facetsComplete).toBe(false);
  });

  it("attributes sub-domains owned by one domain, so only 'other' chips carry unattributable", () => {
    for (const c of model.chips) {
      if (c.chip.sub_domain !== "other") expect(c.unattributable).toBe(0);
    }
    const agentic = bundle.nodes.filter(
      (n) =>
        n.facets?.sub_domains.includes("agentic") && n.facets.domains.includes("ai-engineering"),
    );
    expect(agentic.length).toBeGreaterThan(0);
    expect(count(model.chips, "ai-engineering", "agentic").matches).toBe(agentic.length);
  });

  it("counts single-domain 'other' nodes as matches", () => {
    const pmOnlyOther = bundle.nodes.filter(
      (n) =>
        n.facets?.sub_domains.includes("other") &&
        n.facets.domains.length === 1 &&
        n.facets.domains[0] === "pm-craft",
    );
    expect(pmOnlyOther.length).toBeGreaterThan(0);
    expect(count(model.chips, "pm-craft", "other").matches).toBe(pmOnlyOther.length);
  });

  it("ORs active chips, counting a node once", () => {
    const a = model.activeFacets([{ domain: "ai-engineering", sub_domain: "agentic" }]);
    const b = model.activeFacets([{ domain: "ai-engineering", sub_domain: "evals" }]);
    const both = model.activeFacets([
      { domain: "ai-engineering", sub_domain: "agentic" },
      { domain: "ai-engineering", sub_domain: "evals" },
    ]);
    const overlap = [...a].filter((id) => b.has(id)).length;
    expect(overlap).toBeGreaterThan(0);
    expect(both.size).toBe(a.size + b.size - overlap);
    expect(model.activeFacets([]).size).toBe(0);
  });
});

describe("buildFacetModel (synthetic, paired facets)", () => {
  const two: FacetTaxonomy = {
    domains: { ai: ["agents", "other"], pm: ["growth", "other"] },
  };
  // Node 1 would be ambiguous from its arrays; its pairs say exactly which 'other' it is.
  const nodes = [
    node(1, {
      domains: ["ai", "pm"],
      sub_domains: ["growth", "other"],
      pairs: [
        { domain: "ai", sub_domain: "other" },
        { domain: "pm", sub_domain: "growth" },
      ],
    }),
    node(2, {
      domains: ["pm"],
      sub_domains: ["other"],
      pairs: [{ domain: "pm", sub_domain: "other" }],
    }),
    node(3),
  ];

  it("matches exact pairs, never unattributable, and reports complete", () => {
    const model = buildFacetModel(nodes, two);
    expect(
      model.chips.map((c) => [c.chip.domain, c.chip.sub_domain, c.matches, c.unattributable]),
    ).toEqual([
      ["ai", "agents", 0, 0],
      ["ai", "other", 1, 0],
      ["pm", "growth", 1, 0],
      ["pm", "other", 1, 0],
    ]);
    expect(model.facetsComplete).toBe(true);
    expect([...model.activeFacets([{ domain: "pm", sub_domain: "other" }])]).toEqual([2]);
  });

  it("uses pairs over arrays per node in a mixed bundle", () => {
    const mixed = [...nodes, node(4, { domains: ["ai", "pm"], sub_domains: ["other"] })];
    const model = buildFacetModel(mixed, two);
    expect(count(model.chips, "ai", "other")).toMatchObject({ matches: 1, unattributable: 1 });
    expect(count(model.chips, "pm", "other")).toMatchObject({ matches: 1, unattributable: 1 });
    expect(model.facetsComplete).toBe(false);
    expect([...model.activeFacets([{ domain: "ai", sub_domain: "other" }])]).toEqual([1]);
  });
});

describe("buildFacetModel (generic over domain count)", () => {
  it("resolves a sub-domain shared by two of three domains from the node's own domains", () => {
    const three: FacetTaxonomy = {
      domains: { a: ["x", "shared"], b: ["y", "shared"], c: ["z"] },
    };
    const model = buildFacetModel(
      [
        node(1, { domains: ["a", "c"], sub_domains: ["shared", "z"] }),
        node(2, { domains: ["a", "b"], sub_domains: ["shared"] }),
      ],
      three,
    );
    expect(count(model.chips, "a", "shared")).toMatchObject({ matches: 1, unattributable: 1 });
    expect(count(model.chips, "b", "shared")).toMatchObject({ matches: 0, unattributable: 1 });
    expect(count(model.chips, "c", "z")).toMatchObject({ matches: 1, unattributable: 0 });
    expect(model.chips.length).toBe(5);
  });
});

describe("buildFacetModel (fail fast)", () => {
  it("rejects a malformed taxonomy with an actionable message", () => {
    expect(() => buildFacetModel([], { domains: { a: ["x", "x"] } })).toThrow(
      'FacetTaxonomy.domains["a"] lists "x" more than once',
    );
    expect(() => buildFacetModel([], { domains: { a: "x" } } as unknown as FacetTaxonomy)).toThrow(
      'FacetTaxonomy.domains["a"] must be an array of strings',
    );
    expect(() => buildFacetModel([], {} as FacetTaxonomy)).toThrow(
      "FacetTaxonomy.domains must be an object",
    );
  });

  it("rejects an active chip that is not in the taxonomy", () => {
    const model = buildFacetModel(bundle.nodes, taxonomy);
    expect(() => model.activeFacets([{ domain: "pm-craft", sub_domain: "agentic" }])).toThrow(
      "chip (pm-craft, agentic) is not in the facet taxonomy",
    );
  });
});
